import crypto from 'node:crypto';
import { EncryptedJsonFile } from '../security/secretStore.ts';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const GOOGLE_SCOPES = {
  identity: ['openid', 'email', 'profile'],
  // drive.readonly is required to browse arbitrary folders. drive.file only exposes files the app created
  // or the user opened through Google's own Picker, which cannot provide a folder tree.
  drive: ['https://www.googleapis.com/auth/drive.readonly'],
  // Google Photos Library API read scopes were removed 2025-03-31. The Picker API is the supported path.
  photos: ['https://www.googleapis.com/auth/photospicker.mediaitems.readonly'],
} as const;

export type GoogleService = 'drive' | 'photos';

export interface GoogleAccountRecord {
  id: string; // Google "sub"
  email: string;
  name?: string;
  picture?: string;
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpiresAt?: number; // epoch ms
  grantedScopes: string[];
  connectedAt: string;
  lastSuccessAt?: string;
  lastError?: string;
  needsReconnect?: boolean;
}

export interface GoogleStoreShape {
  activeAccountId?: string;
  accounts: Record<string, GoogleAccountRecord>;
}

export interface GoogleOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
}

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    public readonly code: 'not_configured' | 'not_connected' | 'reauth_required' | 'scope_missing' | 'oauth_failed' | 'state_mismatch',
    public readonly status = 401,
  ) {
    super(message);
  }
}

export class GoogleApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly reason?: string) {
    super(message);
  }
}

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_SKEW_MS = 60 * 1000;

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): GoogleOAuthConfig {
  const appUrl = (env.APP_URL && !env.APP_URL.startsWith('MY_') ? env.APP_URL : `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, '');
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${appUrl}/api/google/oauth/callback`,
  };
}

export class GoogleAccountService {
  private pending = new Map<string, { service: GoogleService; createdAt: number; accountHint?: string }>();

  constructor(
    private readonly store: EncryptedJsonFile<GoogleStoreShape>,
    private readonly config: GoogleOAuthConfig,
    private readonly fetchImpl: FetchLike = (u, i) => fetch(u, i),
    private readonly now: () => number = () => Date.now(),
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.clientId && this.config.clientSecret);
  }

  private requireConfigured() {
    if (!this.isConfigured()) {
      throw new GoogleAuthError(
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server environment (see README).',
        'not_configured',
        503,
      );
    }
  }

  buildAuthUrl(service: GoogleService): string {
    this.requireConfigured();
    this.gcPending();
    const state = crypto.randomBytes(24).toString('hex');
    this.pending.set(state, { service, createdAt: this.now() });
    const scopes = [...GOOGLE_SCOPES.identity, ...GOOGLE_SCOPES[service]];
    const params = new URLSearchParams({
      client_id: this.config.clientId!,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      include_granted_scopes: 'true', // incremental authorization keeps previously granted service scopes
      prompt: 'consent select_account',
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<GoogleAccountRecord> {
    this.requireConfigured();
    this.gcPending();
    const pending = this.pending.get(state);
    if (!pending) throw new GoogleAuthError('OAuth state mismatch or expired. Start the connection again.', 'state_mismatch', 400);
    this.pending.delete(state);

    const tokenRes = await this.postForm(TOKEN_URL, {
      code,
      client_id: this.config.clientId!,
      client_secret: this.config.clientSecret!,
      redirect_uri: this.config.redirectUri,
      grant_type: 'authorization_code',
    });
    if (!tokenRes.ok) throw new GoogleAuthError(`Google rejected the authorization code (${tokenRes.status}).`, 'oauth_failed', 400);
    const tokens = (await tokenRes.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope: string };

    const infoRes = await this.fetchImpl(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!infoRes.ok) throw new GoogleAuthError('Could not read the Google account profile.', 'oauth_failed', 502);
    const info = (await infoRes.json()) as { sub: string; email: string; name?: string; picture?: string };

    const data = this.store.read();
    const prev = data.accounts[info.sub];
    const granted = new Set([...(prev?.grantedScopes ?? []), ...tokens.scope.split(' ')]);
    const nowIso = new Date(this.now()).toISOString();
    const record: GoogleAccountRecord = {
      id: info.sub,
      email: info.email,
      name: info.name,
      picture: info.picture,
      refreshToken: tokens.refresh_token ?? prev?.refreshToken,
      accessToken: tokens.access_token,
      accessTokenExpiresAt: this.now() + tokens.expires_in * 1000,
      grantedScopes: [...granted],
      connectedAt: prev?.connectedAt ?? nowIso,
      lastSuccessAt: nowIso,
      needsReconnect: false,
    };
    data.accounts[info.sub] = record;
    data.activeAccountId = info.sub;
    this.store.write(data);
    return record;
  }

  listAccounts(): GoogleAccountRecord[] {
    return Object.values(this.store.read().accounts);
  }

  setActiveAccount(accountId: string) {
    const data = this.store.read();
    if (!data.accounts[accountId]) throw new GoogleAuthError('Unknown Google account.', 'not_connected', 404);
    data.activeAccountId = accountId;
    this.store.write(data);
  }

  hasScope(account: GoogleAccountRecord | undefined, service: GoogleService): boolean {
    return Boolean(account && GOOGLE_SCOPES[service].every((s) => account.grantedScopes.includes(s)));
  }

  getActiveAccount(): GoogleAccountRecord | undefined {
    const data = this.store.read();
    return data.activeAccountId ? data.accounts[data.activeAccountId] : undefined;
  }

  /** Returns a valid access token for the active account, refreshing if needed. */
  async getAccessToken(service: GoogleService, accountId?: string): Promise<string> {
    const data = this.store.read();
    const id = accountId ?? data.activeAccountId;
    const account = id ? data.accounts[id] : undefined;
    if (!account) throw new GoogleAuthError('No Google account is connected.', 'not_connected');
    if (!this.hasScope(account, service)) {
      throw new GoogleAuthError(`Google ${service === 'drive' ? 'Drive' : 'Photos'} access has not been granted for ${account.email}. Connect it in Google Connections.`, 'scope_missing', 403);
    }
    if (account.needsReconnect) {
      throw new GoogleAuthError('Google access expired or was revoked. Reconnect your account.', 'reauth_required');
    }
    if (account.accessToken && account.accessTokenExpiresAt && account.accessTokenExpiresAt - REFRESH_SKEW_MS > this.now()) {
      return account.accessToken;
    }
    return this.refresh(account.id);
  }

  async refresh(accountId: string): Promise<string> {
    this.requireConfigured();
    const data = this.store.read();
    const account = data.accounts[accountId];
    if (!account?.refreshToken) {
      if (account) {
        account.needsReconnect = true;
        account.lastError = 'No refresh token stored.';
        this.store.write(data);
      }
      throw new GoogleAuthError('No refresh token available. Reconnect your Google account.', 'reauth_required');
    }
    const res = await this.postForm(TOKEN_URL, {
      client_id: this.config.clientId!,
      client_secret: this.config.clientSecret!,
      refresh_token: account.refreshToken,
      grant_type: 'refresh_token',
    });
    if (!res.ok) {
      let reason = '';
      try { reason = ((await res.json()) as { error?: string }).error ?? ''; } catch { /* ignore */ }
      if (reason === 'invalid_grant' || res.status === 400 || res.status === 401) {
        account.needsReconnect = true;
        account.accessToken = undefined;
        account.accessTokenExpiresAt = undefined;
        account.lastError = `Token refresh failed (${reason || res.status}).`;
        this.store.write(data);
        throw new GoogleAuthError('Google access expired or was revoked. Reconnect your account.', 'reauth_required');
      }
      throw new GoogleAuthError(`Google token endpoint error (${res.status}). Try again shortly.`, 'oauth_failed', 502);
    }
    const t = (await res.json()) as { access_token: string; expires_in: number; scope?: string };
    account.accessToken = t.access_token;
    account.accessTokenExpiresAt = this.now() + t.expires_in * 1000;
    account.lastSuccessAt = new Date(this.now()).toISOString();
    account.lastError = undefined;
    this.store.write(data);
    return t.access_token;
  }

  markSuccess(accountId: string) {
    const data = this.store.read();
    if (data.accounts[accountId]) {
      data.accounts[accountId].lastSuccessAt = new Date(this.now()).toISOString();
      this.store.write(data);
    }
  }

  /** Revoke at Google (best effort) and delete local credentials. */
  async disconnect(accountId: string): Promise<{ revoked: boolean }> {
    const data = this.store.read();
    const account = data.accounts[accountId];
    if (!account) throw new GoogleAuthError('Unknown Google account.', 'not_connected', 404);
    let revoked = false;
    const token = account.refreshToken ?? account.accessToken;
    if (token) {
      try {
        const res = await this.postForm(REVOKE_URL, { token });
        revoked = res.ok;
      } catch { /* network failure: still remove local credentials */ }
    }
    delete data.accounts[accountId];
    if (data.activeAccountId === accountId) data.activeAccountId = Object.keys(data.accounts)[0];
    this.store.write(data);
    return { revoked };
  }

  /** Sanitised view for the UI. Never includes tokens. */
  publicStatus() {
    const data = this.store.read();
    const now = this.now();
    return {
      configured: this.isConfigured(),
      redirectUri: this.config.redirectUri,
      activeAccountId: data.activeAccountId ?? null,
      accounts: Object.values(data.accounts).map((a) => ({
        id: a.id,
        email: a.email,
        name: a.name ?? null,
        picture: a.picture ?? null,
        active: a.id === data.activeAccountId,
        connectedAt: a.connectedAt,
        lastSuccessAt: a.lastSuccessAt ?? null,
        lastError: a.lastError ?? null,
        needsReconnect: Boolean(a.needsReconnect),
        drive: this.hasScope(a, 'drive'),
        photos: this.hasScope(a, 'photos'),
        grantedScopes: a.grantedScopes,
        hasRefreshToken: Boolean(a.refreshToken),
        accessTokenExpiresInSeconds: a.accessTokenExpiresAt ? Math.round((a.accessTokenExpiresAt - now) / 1000) : null,
      })),
    };
  }

  private async postForm(url: string, body: Record<string, string>) {
    return this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });
  }

  private gcPending() {
    const cutoff = this.now() - STATE_TTL_MS;
    for (const [k, v] of this.pending) if (v.createdAt < cutoff) this.pending.delete(k);
  }
}
