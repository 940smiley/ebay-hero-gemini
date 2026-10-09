import { FetchLike, GoogleApiError } from './accounts.ts';

/**
 * Google Photos Picker API client.
 *
 * Flow (https://developers.google.com/photos/picker/guides/get-started-picker):
 *   1. POST   /v1/sessions                   -> { id, pickerUri, pollingConfig, expireTime, mediaItemsSet }
 *   2. User opens `pickerUri` (+ "/autoclose") and chooses items inside Google's own UI.
 *   3. GET    /v1/sessions/{id}              -> poll until mediaItemsSet == true
 *   4. GET    /v1/mediaItems?sessionId=...   -> PickedMediaItem[] (paginated)
 *   5. GET    {baseUrl}=d  (Authorization: Bearer) -> original bytes. baseUrl expires after ~60 min.
 *   6. DELETE /v1/sessions/{id}              -> clean up when done
 *
 * The API deliberately offers NO album listing, library browsing or "select all" - selection happens in Google's UI.
 */
export const PHOTOS_PICKER_API = 'https://photospicker.googleapis.com/v1';

export interface PickerSession {
  id: string;
  pickerUri: string;
  pollIntervalMs: number;
  timeoutMs: number;
  expireTime?: string;
  mediaItemsSet: boolean;
}

export interface PickedPhoto {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'TYPE_UNSPECIFIED';
  createTime?: string;
  filename?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  cameraMake?: string;
  cameraModel?: string;
  /** Requires Authorization header; expires ~60 min after listing. Never send to the browser. */
  baseUrl: string;
}

interface RawSession {
  id: string;
  pickerUri: string;
  pollingConfig?: { pollInterval?: string; timeoutIn?: string };
  expireTime?: string;
  mediaItemsSet?: boolean;
}

/** Parses protobuf-JSON durations such as "3.5s". */
export function parseDurationMs(d: string | undefined, fallbackMs: number): number {
  const m = d?.match(/^(\d+(?:\.\d+)?)s$/);
  return m ? Math.round(Number(m[1]) * 1000) : fallbackMs;
}

function toSession(r: RawSession): PickerSession {
  return {
    id: r.id,
    pickerUri: r.pickerUri.endsWith('/autoclose') ? r.pickerUri : `${r.pickerUri}/autoclose`,
    pollIntervalMs: parseDurationMs(r.pollingConfig?.pollInterval, 5000),
    timeoutMs: parseDurationMs(r.pollingConfig?.timeoutIn, 600000),
    expireTime: r.expireTime,
    mediaItemsSet: Boolean(r.mediaItemsSet),
  };
}

export class PhotosPickerClient {
  constructor(private readonly token: string, private readonly fetchImpl: FetchLike = (u, i) => fetch(u, i)) {}

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const res = await this.fetchImpl(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${this.token}` } });
    if (res.ok) return res;
    let message = `Google Photos Picker error (${res.status})`;
    let reason: string | undefined;
    try {
      const b = (await res.json()) as { error?: { message?: string; status?: string } };
      message = b.error?.message ?? message;
      reason = b.error?.status;
    } catch { /* non-JSON */ }
    if (res.status === 401) message = 'Google rejected the access token. Reconnect your account.';
    else if (res.status === 403) message = 'Google Photos access has not been granted, or the Photos Picker API is not enabled for this Google Cloud project.';
    else if (res.status === 404) message = 'Picker session not found or expired. Start a new one.';
    throw new GoogleApiError(message, res.status, reason);
  }

  async createSession(maxItemCount?: number): Promise<PickerSession> {
    const body: Record<string, unknown> = {};
    if (maxItemCount !== undefined) {
      if (!Number.isInteger(maxItemCount) || maxItemCount < 1 || maxItemCount > 2000) {
        throw new GoogleApiError('maxItemCount must be an integer between 1 and 2000.', 400, 'invalidArgument');
      }
      body.pickingConfig = { maxItemCount: String(maxItemCount) };
    }
    const res = await this.request(`${PHOTOS_PICKER_API}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return toSession((await res.json()) as RawSession);
  }

  async getSession(id: string): Promise<PickerSession> {
    const res = await this.request(`${PHOTOS_PICKER_API}/sessions/${encodeURIComponent(id)}`);
    return toSession((await res.json()) as RawSession);
  }

  async deleteSession(id: string): Promise<void> {
    await this.request(`${PHOTOS_PICKER_API}/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  /** Lists every picked item, following pagination to the end. */
  async listPickedItems(sessionId: string): Promise<PickedPhoto[]> {
    const out: PickedPhoto[] = [];
    let pageToken: string | undefined;
    do {
      const p = new URLSearchParams({ sessionId, pageSize: '100' });
      if (pageToken) p.set('pageToken', pageToken);
      const res = await this.request(`${PHOTOS_PICKER_API}/mediaItems?${p}`);
      const d = (await res.json()) as {
        mediaItems?: Array<{
          id: string;
          type?: PickedPhoto['type'];
          createTime?: string;
          mediaFile?: {
            baseUrl: string;
            mimeType?: string;
            filename?: string;
            mediaFileMetadata?: { width?: number; height?: number; cameraMake?: string; cameraModel?: string };
          };
        }>;
        nextPageToken?: string;
      };
      for (const m of d.mediaItems ?? []) {
        if (!m.mediaFile?.baseUrl) continue;
        out.push({
          id: m.id,
          type: m.type ?? 'TYPE_UNSPECIFIED',
          createTime: m.createTime,
          filename: m.mediaFile.filename,
          mimeType: m.mediaFile.mimeType,
          width: m.mediaFile.mediaFileMetadata?.width,
          height: m.mediaFile.mediaFileMetadata?.height,
          cameraMake: m.mediaFile.mediaFileMetadata?.cameraMake,
          cameraModel: m.mediaFile.mediaFileMetadata?.cameraModel,
          baseUrl: m.mediaFile.baseUrl,
        });
      }
      pageToken = d.nextPageToken;
    } while (pageToken);
    return out;
  }

  /** `mode`: 'original' downloads full bytes (=d); 'thumb' returns a bounded-size rendering (=w..-h..). */
  async fetchMedia(baseUrl: string, mode: 'original' | 'thumb', thumbSize = 256): Promise<Response> {
    if (!/^https:\/\/[a-z0-9.-]*\.(googleusercontent|google)\.com\//i.test(baseUrl)) {
      throw new GoogleApiError('Refusing to fetch media from an unexpected host.', 400, 'badHost');
    }
    const suffix = mode === 'original' ? '=d' : `=w${thumbSize}-h${thumbSize}`;
    let currentUrl = baseUrl + suffix;
    let redirectCount = 0;
    const maxRedirects = 5;

    while (redirectCount < maxRedirects) {
      // First attempt with Authorization header and manual redirect handling
      const res = await this.fetchImpl(currentUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.token}` },
        redirect: 'manual',
      });

      // Check if redirect
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        if (!location) {
          throw new GoogleApiError('Redirect response missing Location header.', res.status, 'redirectError');
        }
        currentUrl = new URL(location, currentUrl).href;
        if (!/^https:\/\/[a-z0-9.-]*\.(googleusercontent|google)\.com\//i.test(currentUrl)) {
          throw new GoogleApiError('Refusing to follow redirect to an untrusted host.', 400, 'badHost');
        }
        redirectCount++;
        continue;
      }

      // If initial or redirected request returned 401/403 on redirected CDN host, retry once without Authorization header
      if ((res.status === 401 || res.status === 403) && redirectCount > 0) {
        const retryRes = await this.fetchImpl(currentUrl, {
          method: 'GET',
          redirect: 'manual',
        });
        if (retryRes.ok) {
          return retryRes;
        }
      }

      if (res.ok) {
        return res;
      }

      let message = `Google Photos Picker error (${res.status})`;
      let reason: string | undefined;
      try {
        const b = (await res.json()) as { error?: { message?: string; status?: string } };
        message = b.error?.message ?? message;
        reason = b.error?.status;
      } catch { /* non-JSON */ }
      if (res.status === 401) message = 'Google rejected the access token. Reconnect your account.';
      else if (res.status === 403) message = 'Google Photos access has not been granted, or the Photos Picker API is not enabled for this Google Cloud project.';
      else if (res.status === 404) message = 'Photo item not found or expired.';
      throw new GoogleApiError(message, res.status, reason);
    }

    throw new GoogleApiError('Too many redirects while downloading photo media.', 500, 'tooManyRedirects');
  }
}

