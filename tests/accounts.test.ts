import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { EncryptedJsonFile, getEncryptionKey } from '../server/security/secretStore.ts';
import { GOOGLE_SCOPES, GoogleAccountService, GoogleAuthError, GoogleStoreShape } from '../server/google/accounts.ts';
import { json, mockFetch } from './helpers.ts';

const cfg = { clientId: 'cid', clientSecret: 'csecret', redirectUri: 'http://localhost:3000/api/google/oauth/callback' };
let dir: string;
let file: string;
let store: EncryptedJsonFile<GoogleStoreShape>;
let clock: number;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ebh-'));
  file = path.join(dir, 'google.enc.json');
  store = new EncryptedJsonFile<GoogleStoreShape>(file, () => ({ accounts: {} }), getEncryptionKey(dir));
  clock = 1_700_000_000_000;
});

const driveScope = GOOGLE_SCOPES.drive.join(' ');
const photosScope = GOOGLE_SCOPES.photos.join(' ');

function oauthFetch(opts: { scope?: string; refresh?: boolean; refreshFail?: { status: number; error: string } } = {}) {
  return mockFetch(
    (url, init) => {
      if (url.href.startsWith('https://oauth2.googleapis.com/token')) {
        const body = new URLSearchParams(init!.body as string);
        if (body.get('grant_type') === 'authorization_code') {
          return json({ access_token: 'AT1', refresh_token: 'RT1', expires_in: 3600, scope: `openid email profile ${opts.scope ?? driveScope}` });
        }
        if (opts.refreshFail) return json({ error: opts.refreshFail.error }, opts.refreshFail.status);
        return json({ access_token: 'AT2', expires_in: 3600 });
      }
    },
    (url) => url.href.startsWith('https://openidconnect.googleapis.com/') ? json({ sub: '123', email: 'seller@example.com', name: 'Seller' }) : undefined,
    (url) => url.href.startsWith('https://oauth2.googleapis.com/revoke') ? json({}) : undefined,
  );
}

async function connect(svc: GoogleAccountService, service: 'drive' | 'photos' = 'drive') {
  const url = new URL(svc.buildAuthUrl(service));
  return svc.handleCallback('code', url.searchParams.get('state')!);
}

describe('Google OAuth – server-side connection', () => {
  it('refuses to start when the client is not configured, with setup instructions', () => {
    const svc = new GoogleAccountService(store, { redirectUri: cfg.redirectUri });
    expect(() => svc.buildAuthUrl('drive')).toThrow(/GOOGLE_CLIENT_ID/);
    expect(svc.publicStatus().configured).toBe(false);
  });

  it('requests minimal scopes per service (no 15-scope dump), offline access and incremental auth', () => {
    const svc = new GoogleAccountService(store, cfg, oauthFetch());
    const drive = new URL(svc.buildAuthUrl('drive')).searchParams;
    expect(drive.get('scope')!.split(' ').sort()).toEqual(['email', 'https://www.googleapis.com/auth/drive.readonly', 'openid', 'profile']);
    expect(drive.get('access_type')).toBe('offline');
    expect(drive.get('include_granted_scopes')).toBe('true');
    expect(drive.get('redirect_uri')).toBe(cfg.redirectUri);
    const photos = new URL(svc.buildAuthUrl('photos')).searchParams.get('scope')!;
    expect(photos).toContain('photospicker.mediaitems.readonly');
    expect(photos).not.toContain('drive');
    expect(photos).not.toContain('photoslibrary'); // removed from Library API in 2025
  });

  it('rejects unknown or replayed state', async () => {
    const svc = new GoogleAccountService(store, cfg, oauthFetch());
    await expect(svc.handleCallback('code', 'forged')).rejects.toMatchObject({ code: 'state_mismatch' });
    const state = new URL(svc.buildAuthUrl('drive')).searchParams.get('state')!;
    await svc.handleCallback('code', state);
    await expect(svc.handleCallback('code', state)).rejects.toMatchObject({ code: 'state_mismatch' });
  });

  it('connects an account, and the public status never contains tokens', async () => {
    const svc = new GoogleAccountService(store, cfg, oauthFetch(), () => clock);
    await connect(svc);
    const status = svc.publicStatus();
    expect(status.accounts[0]).toMatchObject({ email: 'seller@example.com', drive: true, photos: false, hasRefreshToken: true, active: true });
    const text = JSON.stringify(status);
    expect(text).not.toMatch(/AT1|RT1|csecret/);
  });

  it('stores tokens encrypted at rest', async () => {
    const svc = new GoogleAccountService(store, cfg, oauthFetch());
    await connect(svc);
    const raw = fs.readFileSync(file, 'utf8');
    expect(raw).not.toContain('RT1');
    expect(raw).not.toContain('AT1');
    expect(raw).not.toContain('seller@example.com');
    // wrong key cannot read it
    const other = new EncryptedJsonFile<GoogleStoreShape>(file, () => ({ accounts: {} }), Buffer.alloc(32, 7));
    expect(() => other.read()).toThrow();
  });

  it('adding Photos later keeps Drive consent (incremental) and the refresh token', async () => {
    const f = oauthFetch({ scope: driveScope });
    const svc = new GoogleAccountService(store, cfg, f, () => clock);
    await connect(svc, 'drive');
    // second consent: Google returns only the new scope + no refresh token
    const f2 = mockFetch(
      (u) => u.href.includes('/token') ? json({ access_token: 'AT3', expires_in: 3600, scope: `openid email profile ${photosScope}` }) : undefined,
      (u) => u.href.includes('openidconnect') ? json({ sub: '123', email: 'seller@example.com' }) : undefined,
    );
    const svc2 = new GoogleAccountService(store, cfg, f2, () => clock);
    await connect(svc2, 'photos');
    const a = svc2.publicStatus().accounts[0];
    expect(a).toMatchObject({ drive: true, photos: true, hasRefreshToken: true });
  });

  it('refreshes an expiring access token transparently', async () => {
    const f = oauthFetch();
    const svc = new GoogleAccountService(store, cfg, f, () => clock);
    await connect(svc);
    expect(await svc.getAccessToken('drive')).toBe('AT1'); // still valid, no refresh
    clock += 3600 * 1000; // expired
    expect(await svc.getAccessToken('drive')).toBe('AT2');
    expect(svc.publicStatus().accounts[0].lastError).toBeNull();
  });

  it('flags the account for reconnect when Google revokes/expires the refresh token (invalid_grant)', async () => {
    const svc = new GoogleAccountService(store, cfg, oauthFetch({ refreshFail: { status: 400, error: 'invalid_grant' } }), () => clock);
    await connect(svc);
    clock += 3600 * 1000;
    await expect(svc.getAccessToken('drive')).rejects.toMatchObject({ code: 'reauth_required' });
    const a = svc.publicStatus().accounts[0];
    expect(a.needsReconnect).toBe(true);
    expect(a.lastError).toMatch(/invalid_grant/);
    // subsequent calls fail fast without contacting Google again
    const callsBefore = (svc as unknown as { fetchImpl: { calls: unknown[] } }).fetchImpl.calls.length;
    await expect(svc.getAccessToken('drive')).rejects.toBeInstanceOf(GoogleAuthError);
    expect((svc as unknown as { fetchImpl: { calls: unknown[] } }).fetchImpl.calls.length).toBe(callsBefore);
  });

  it('reports a precise error when a service was never granted', async () => {
    const svc = new GoogleAccountService(store, cfg, oauthFetch(), () => clock);
    await connect(svc, 'drive');
    await expect(svc.getAccessToken('photos')).rejects.toMatchObject({ code: 'scope_missing', status: 403 });
  });

  it('supports multiple accounts without mixing them, and switching the active one', async () => {
    const mk = (sub: string, email: string) => mockFetch(
      (u) => u.href.includes('/token') ? json({ access_token: `AT-${sub}`, refresh_token: `RT-${sub}`, expires_in: 3600, scope: driveScope }) : undefined,
      (u) => u.href.includes('openidconnect') ? json({ sub, email }) : undefined,
    );
    await connect(new GoogleAccountService(store, cfg, mk('1', 'a@x.com'), () => clock));
    const svc = new GoogleAccountService(store, cfg, mk('2', 'b@x.com'), () => clock);
    await connect(svc);
    expect(svc.publicStatus().accounts.map((a) => a.email).sort()).toEqual(['a@x.com', 'b@x.com']);
    expect(await svc.getAccessToken('drive')).toBe('AT-2'); // newest is active
    svc.setActiveAccount('1');
    expect(await svc.getAccessToken('drive')).toBe('AT-1');
  });

  it('disconnect revokes at Google and deletes local credentials', async () => {
    const f = oauthFetch();
    const svc = new GoogleAccountService(store, cfg, f, () => clock);
    await connect(svc);
    const r = await svc.disconnect('123');
    expect(r.revoked).toBe(true);
    expect(f.calls.some((c) => c.url.includes('/revoke'))).toBe(true);
    expect(svc.publicStatus().accounts).toHaveLength(0);
    await expect(svc.getAccessToken('drive')).rejects.toMatchObject({ code: 'not_connected' });
  });
});
