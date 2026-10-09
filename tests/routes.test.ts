import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EncryptedJsonFile, getEncryptionKey } from '../server/security/secretStore.ts';
import { GOOGLE_SCOPES, GoogleAccountService, GoogleStoreShape } from '../server/google/accounts.ts';
import { createGoogleRouter, createLibraryRouter } from '../server/google/routes.ts';
import { FOLDER_MIME } from '../server/google/drive.ts';
import { ManagedLibrary } from '../server/library.ts';
import { JPEG, PNG, bytes, json, mockFetch } from './helpers.ts';

const H = { 'X-Requested-With': 'ebay-hero', 'Content-Type': 'application/json' };

let server: http.Server;
let base: string;
let tmp: string;

function start(opts: { scopes: string[]; googleFetch: ReturnType<typeof mockFetch>; refreshFail?: boolean }) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ebh-route-'));
  const store = new EncryptedJsonFile<GoogleStoreShape>(path.join(tmp, 'g.enc.json'), () => ({ accounts: {} }), getEncryptionKey(tmp));
  store.write({
    activeAccountId: 'u1',
    accounts: {
      u1: {
        id: 'u1', email: 'seller@example.com', refreshToken: 'RT', accessToken: 'AT',
        accessTokenExpiresAt: Date.now() + 3_600_000, grantedScopes: opts.scopes, connectedAt: new Date().toISOString(),
      },
    },
  });
  const accounts = new GoogleAccountService(store, { clientId: 'c', clientSecret: 's', redirectUri: 'http://x/cb' }, opts.googleFetch);
  const library = new ManagedLibrary(path.join(tmp, 'lib'));
  const app = express();
  app.use('/api/google', createGoogleRouter({ accounts, library, fetchImpl: opts.googleFetch }));
  app.use('/api/library', createLibraryRouter(library));
  return new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      resolve();
    });
  });
}

afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

const driveFiles = (q: string) => {
  if (q.includes("'root' in parents")) return [{ id: 'F1', name: 'Stamps', mimeType: FOLDER_MIME }, { id: 'I0', name: 'top.jpg', mimeType: 'image/jpeg', size: '30' }];
  if (q.includes("'F1' in parents")) return [{ id: 'I1', name: 'one.png', mimeType: 'image/png', size: '20' }, { id: 'I2', name: 'bad.jpg', mimeType: 'image/jpeg', size: '5' }];
  return [];
};

describe('Google routes over HTTP', () => {
  describe('Drive-only connection', () => {
    beforeEach(async () => {
      const f = mockFetch(
        (url) => {
          if (url.pathname.endsWith('/drive/v3/files')) return json({ files: driveFiles(url.searchParams.get('q') ?? '') });
          if (url.pathname.includes('/drive/v3/files/I0') && url.searchParams.get('alt') === 'media') return bytes(JPEG);
          if (url.pathname.includes('/drive/v3/files/I1') && url.searchParams.get('alt') === 'media') return bytes(PNG, 'image/png');
          if (url.pathname.includes('/drive/v3/files/I2') && url.searchParams.get('alt') === 'media') return bytes(Buffer.from('not an image at all'));
        },
      );
      await start({ scopes: [...GOOGLE_SCOPES.drive], googleFetch: f });
    });

    it('status exposes connection state but no secrets', async () => {
      const body = await (await fetch(`${base}/api/google/status`)).json();
      expect(body.accounts[0]).toMatchObject({ email: 'seller@example.com', drive: true, photos: false });
      expect(JSON.stringify(body)).not.toMatch(/"AT"|"RT"|refreshToken|accessToken"/);
    });

    it('blocks state-changing requests without the CSRF header', async () => {
      const r = await fetch(`${base}/api/google/drive/selection/summary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      expect(r.status).toBe(403);
    });

    it('lists real Drive folders and images; photos endpoints are refused without Photos consent', async () => {
      const list = await (await fetch(`${base}/api/google/drive/list`)).json();
      expect(list.folders.map((f: { name: string }) => f.name)).toEqual(['Stamps']);
      expect(list.images.map((f: { name: string }) => f.name)).toEqual(['top.jpg']);
      const photos = await fetch(`${base}/api/google/photos/session`, { method: 'POST', headers: H, body: '{}' });
      expect(photos.status).toBe(403);
      expect((await photos.json()).code).toBe('scope_missing');
    });

    it('summarises a recursive selection with exclusions before import', async () => {
      const sel = {
        scopes: [{ key: 'google_drive:root:r', source: 'google_drive', folderId: 'root', recursive: true, label: 'My Drive' }],
        included: [], excluded: ['I2'],
      };
      const r = await (await fetch(`${base}/api/google/drive/selection/summary`, { method: 'POST', headers: H, body: JSON.stringify(sel) })).json();
      expect(r).toMatchObject({ files: 2, folders: 2 /* root scope counted + Stamps */, totalBytes: 50, unsupported: 0 });
    });

    it('imports a recursive selection: valid files stored, fake image rejected and reported, no stock-photo fallback', async () => {
      const sel = {
        scopes: [{ key: 'google_drive:root:r', source: 'google_drive', folderId: 'root', recursive: true, label: 'My Drive' }],
        included: [], excluded: [],
      };
      const res = await fetch(`${base}/api/google/drive/import`, { method: 'POST', headers: H, body: JSON.stringify(sel) });
      const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
      const items = lines.filter((l) => l.type === 'item');
      const errors = lines.filter((l) => l.type === 'error');
      expect(items.map((i) => i.item.originalName).sort()).toEqual(['one.png', 'top.jpg']);
      expect(items.find((i) => i.item.originalName === 'one.png').folderPath).toBe('Stamps');
      expect(items[0].item.source).toMatchObject({ type: 'google_drive', account: 'u1' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ name: 'bad.jpg', retryable: false });
      expect(lines.at(-1)).toMatchObject({ type: 'done', imported: 2, failed: 1, cancelled: false });

      // the library serves the stored file with the sniffed type
      const file = await fetch(`${base}${items[0].item.url}`);
      expect(file.headers.get('content-type')).toMatch(/^image\//);
      expect(file.headers.get('x-content-type-options')).toBe('nosniff');
      expect((await file.arrayBuffer()).byteLength).toBeGreaterThan(0);
    });
  });

  describe('Photos Picker flow', () => {
    it('create session -> poll -> list -> import -> delete, using only the Picker API', async () => {
      let deleted = false;
      const f = mockFetch((url, init) => {
        if (url.hostname === 'photospicker.googleapis.com') {
          if (url.pathname === '/v1/sessions' && init?.method === 'POST') return json({ id: 'S1', pickerUri: 'https://photos.google.com/picker/z', pollingConfig: { pollInterval: '2s', timeoutIn: '600s' }, mediaItemsSet: false });
          if (url.pathname === '/v1/sessions/S1' && !init?.method) return json({ id: 'S1', pickerUri: 'https://photos.google.com/picker/z', mediaItemsSet: true });
          if (url.pathname === '/v1/sessions/S1' && init?.method === 'DELETE') { deleted = true; return json({}); }
          if (url.pathname === '/v1/mediaItems') return json({ mediaItems: [
            { id: 'P1', type: 'PHOTO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/p1', mimeType: 'image/jpeg', filename: 'IMG_0001.jpg' } },
            { id: 'P2', type: 'PHOTO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/p2', mimeType: 'image/png' } },
            { id: 'V1', type: 'VIDEO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/v1', filename: 'clip.mp4' } },
          ] });
        }
        if (url.hostname === 'lh3.googleusercontent.com') return url.pathname.startsWith('/p1') ? bytes(JPEG) : bytes(PNG, 'image/png');
      });
      await start({ scopes: [...GOOGLE_SCOPES.photos], googleFetch: f });

      const session = await (await fetch(`${base}/api/google/photos/session`, { method: 'POST', headers: H, body: '{}' })).json();
      expect(session.pickerUri).toBe('https://photos.google.com/picker/z/autoclose');

      const polled = await (await fetch(`${base}/api/google/photos/session/S1`)).json();
      expect(polled).toMatchObject({ mediaItemsSet: true, itemCount: 3 });

      const items = (await (await fetch(`${base}/api/google/photos/session/S1/items`)).json()).items;
      expect(items).toHaveLength(3);
      expect(items[1]).toMatchObject({ filename: null, filenameAvailable: false }); // unavailable metadata stays distinguishable
      expect(JSON.stringify(items)).not.toContain('googleusercontent'); // baseUrls never reach the browser

      const res = await fetch(`${base}/api/google/photos/session/S1/import`, { method: 'POST', headers: H, body: '{}' });
      const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
      const imported = lines.filter((l) => l.type === 'item');
      expect(imported).toHaveLength(2);
      expect(imported[0].item.source).toMatchObject({ type: 'google_photos', mediaItemId: 'P1' });
      expect(imported[1].filenameFromGoogle).toBe(false);
      expect(imported[1].item.originalName).toMatch(/^google-photos-P2/); // generated placeholder is flagged, not presented as Google's name
      expect(lines.find((l) => l.type === 'skip')).toMatchObject({ id: 'V1' });
      expect(lines.at(-1)).toMatchObject({ type: 'done', imported: 2, skipped: 1, failed: 0 });

      // Drive endpoints refuse (no drive scope) - Photos resources can never surface as Drive folders
      expect((await fetch(`${base}/api/google/drive/list`)).status).toBe(403);

      expect((await fetch(`${base}/api/google/photos/session/S1`, { method: 'DELETE', headers: H })).status).toBe(200);
      expect(deleted).toBe(true);
    });
  });

  describe('Expired authentication', () => {
    it('returns 401 reauth_required when Google rejects the token mid-session', async () => {
      const f = mockFetch((url) => (url.pathname.endsWith('/drive/v3/files') ? json({ error: { message: 'Invalid Credentials' } }, 401) : undefined));
      await start({ scopes: [...GOOGLE_SCOPES.drive], googleFetch: f });
      const r = await fetch(`${base}/api/google/drive/list`);
      expect(r.status).toBe(401);
      expect(await r.json()).toMatchObject({ code: 'reauth_required' });
    });
  });
});
