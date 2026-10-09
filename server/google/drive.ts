import { FetchLike, GoogleApiError } from './accounts.ts';

export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';

/** Raster formats the processing pipeline accepts. Anything else with image/* is counted as unsupported. */
export const SUPPORTED_IMAGE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/tiff', 'image/bmp', 'image/gif',
]);

export type DriveScope = 'my_drive' | 'shared_with_me' | 'shared_drives';

export interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
  driveId?: string;
  isShortcut: boolean;
  modifiedTime?: string;
}

export interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
  size?: number; // undefined = Drive did not return it
  modifiedTime?: string;
  parents?: string[];
  driveId?: string;
  md5Checksum?: string;
  hasThumbnail: boolean;
  supported: boolean;
  isShortcut: boolean;
}

export interface SharedDrive { id: string; name: string }

interface RawFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
  driveId?: string;
  md5Checksum?: string;
  thumbnailLink?: string;
  shortcutDetails?: { targetId: string; targetMimeType: string };
}

const FILE_FIELDS = 'id,name,mimeType,size,modifiedTime,parents,driveId,md5Checksum,thumbnailLink,shortcutDetails(targetId,targetMimeType)';

/** Escape a value for use inside a single-quoted Drive query literal. */
export function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Reject anything that is not shaped like a Drive file ID (prevents query/path injection). */
export function assertDriveId(id: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new GoogleApiError('Invalid Drive ID.', 400, 'invalidId');
  return id;
}

export interface DriveClientOptions {
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
}

export class DriveClient {
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;

  constructor(private readonly token: string, private readonly fetchImpl: FetchLike = (u, i) => fetch(u, i), opts: DriveClientOptions = {}) {
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.maxRetries = opts.maxRetries ?? 3;
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    let attempt = 0;
    for (;;) {
      const res = await this.fetchImpl(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${this.token}` } });
      if (res.ok) return res;
      const retriable = res.status === 429 || res.status >= 500;
      if (retriable && attempt < this.maxRetries) {
        attempt++;
        await this.sleep(250 * 2 ** attempt);
        continue;
      }
      throw await toApiError(res);
    }
  }

  private async json<T>(url: string): Promise<T> {
    return (await this.request(url)).json() as Promise<T>;
  }

  /** The authenticated user, for diagnostics. */
  async about(): Promise<{ email: string; name: string; storageLimit?: number; storageUsage?: number }> {
    const d = await this.json<{ user: { emailAddress: string; displayName: string }; storageQuota?: { limit?: string; usage?: string } }>(
      `${DRIVE_API}/about?fields=user(emailAddress,displayName),storageQuota(limit,usage)`,
    );
    return {
      email: d.user.emailAddress,
      name: d.user.displayName,
      storageLimit: d.storageQuota?.limit ? Number(d.storageQuota.limit) : undefined,
      storageUsage: d.storageQuota?.usage ? Number(d.storageQuota.usage) : undefined,
    };
  }

  async listSharedDrives(pageToken?: string): Promise<{ drives: SharedDrive[]; nextPageToken?: string }> {
    const p = new URLSearchParams({ pageSize: '100', fields: 'nextPageToken,drives(id,name)' });
    if (pageToken) p.set('pageToken', pageToken);
    const d = await this.json<{ drives?: SharedDrive[]; nextPageToken?: string }>(`${DRIVE_API}/drives?${p}`);
    return { drives: d.drives ?? [], nextPageToken: d.nextPageToken };
  }

  async getRootId(): Promise<string> {
    return (await this.json<{ id: string }>(`${DRIVE_API}/files/root?fields=id`)).id;
  }

  /** One page of the *direct* children of a folder (or of a scope root), folders first. */
  async listFolder(opts: {
    scope?: DriveScope;
    folderId?: string; // real Drive ID, or omitted for scope root
    driveId?: string;
    search?: string;
    pageToken?: string;
    pageSize?: number;
    includeUnsupported?: boolean;
  }): Promise<{ folders: DriveFolder[]; images: DriveImage[]; nextPageToken?: string; skippedNonImage: number }> {
    const { scope = 'my_drive', folderId, driveId, search, pageToken, pageSize = 100 } = opts;
    const clauses = ['trashed = false'];

    if (folderId) clauses.push(`'${assertDriveId(folderId)}' in parents`);
    else if (scope === 'my_drive' && !search) clauses.push(`'root' in parents`);
    else if (scope === 'shared_with_me') clauses.push('sharedWithMe = true');
    if (search?.trim()) clauses.push(`name contains '${escapeDriveQueryLiteral(search.trim())}'`);
    clauses.push(`(mimeType = '${FOLDER_MIME}' or mimeType contains 'image/' or mimeType = '${SHORTCUT_MIME}')`);

    const p = new URLSearchParams({
      q: clauses.join(' and '),
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: String(Math.min(Math.max(pageSize, 1), 1000)),
      orderBy: 'folder,name_natural',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (driveId) {
      p.set('corpora', 'drive');
      p.set('driveId', assertDriveId(driveId));
    } else if (scope === 'shared_drives') {
      p.set('corpora', 'allDrives');
    } else {
      p.set('corpora', 'user');
    }
    if (pageToken) p.set('pageToken', pageToken);

    const data = await this.json<{ files?: RawFile[]; nextPageToken?: string }>(`${DRIVE_API}/files?${p}`);
    const folders: DriveFolder[] = [];
    const images: DriveImage[] = [];
    let skippedNonImage = 0;
    for (const raw of data.files ?? []) {
      const n = normalize(raw);
      if (!n) { skippedNonImage++; continue; }
      if (n.kind === 'folder') folders.push(n.folder);
      else if (opts.includeUnsupported || n.image.supported) images.push(n.image);
      else skippedNonImage++;
    }
    return { folders, images, nextPageToken: data.nextPageToken, skippedNonImage };
  }

  /** Real ancestor names for breadcrumbs. Stops at My Drive root or at the first inaccessible parent. */
  async getBreadcrumbs(folderId: string, maxDepth = 25): Promise<Array<{ id: string; name: string }>> {
    const trail: Array<{ id: string; name: string }> = [];
    let current: string | undefined = assertDriveId(folderId);
    for (let i = 0; current && i < maxDepth; i++) {
      let f: { id: string; name: string; parents?: string[] };
      try {
        f = await this.json(`${DRIVE_API}/files/${current}?fields=id,name,parents&supportsAllDrives=true`);
      } catch (e) {
        if (e instanceof GoogleApiError && (e.status === 403 || e.status === 404)) break; // parent not visible to this user
        throw e;
      }
      trail.unshift({ id: f.id, name: f.name });
      current = f.parents?.[0];
    }
    return trail;
  }

  /**
   * Walks a folder tree yielding every supported image. Pagination is followed to the end.
   * Unsupported image/* files are yielded with `supported: false` so callers can count them.
   */
  async *walkImages(opts: {
    folderId?: string;
    driveId?: string;
    scope?: DriveScope;
    recursive: boolean;
    maxFolders?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<{ kind: 'image'; image: DriveImage; folderPath: string } | { kind: 'folder'; folder: DriveFolder }> {
    const maxFolders = opts.maxFolders ?? 5000;
    const queue: Array<{ id?: string; path: string }> = [{ id: opts.folderId, path: '' }];
    const seen = new Set<string>();
    let visited = 0;
    while (queue.length) {
      if (opts.signal?.aborted) return;
      const cur = queue.shift()!;
      if (cur.id) {
        if (seen.has(cur.id)) continue; // shortcut loops / multi-parent
        seen.add(cur.id);
      }
      if (++visited > maxFolders) throw new GoogleApiError(`Folder limit (${maxFolders}) reached while enumerating.`, 413, 'tooManyFolders');
      let token: string | undefined;
      do {
        const page = await this.listFolder({
          scope: opts.scope,
          folderId: cur.id,
          driveId: opts.driveId,
          pageToken: token,
          pageSize: 1000,
          includeUnsupported: true,
        });
        for (const image of page.images) yield { kind: 'image', image, folderPath: cur.path };
        for (const folder of page.folders) {
          yield { kind: 'folder', folder };
          if (opts.recursive) queue.push({ id: folder.id, path: cur.path ? `${cur.path}/${folder.name}` : folder.name });
        }
        token = page.nextPageToken;
      } while (token);
    }
  }

  async summarize(opts: Parameters<DriveClient['walkImages']>[0]): Promise<DriveScopeSummary> {
    const s: DriveScopeSummary = { files: 0, folders: 0, totalBytes: 0, bytesUnknownFiles: 0, unsupported: 0, duplicates: 0 };
    const md5 = new Set<string>();
    for await (const e of this.walkImages(opts)) {
      if (e.kind === 'folder') { if (opts.recursive) s.folders++; continue; }
      if (!e.image.supported) { s.unsupported++; continue; }
      s.files++;
      if (e.image.size === undefined) s.bytesUnknownFiles++;
      else s.totalBytes += e.image.size;
      if (e.image.md5Checksum) {
        if (md5.has(e.image.md5Checksum)) s.duplicates++;
        else md5.add(e.image.md5Checksum);
      }
    }
    return s;
  }

  async getFileMeta(fileId: string): Promise<DriveImage> {
    const raw = await this.json<RawFile>(`${DRIVE_API}/files/${assertDriveId(fileId)}?fields=${encodeURIComponent(FILE_FIELDS)}&supportsAllDrives=true`);
    const n = normalize(raw);
    if (!n || n.kind !== 'image') throw new GoogleApiError('Not an image file.', 415, 'notImage');
    return n.image;
  }

  /** Streams original bytes. Google-native documents (not images) are rejected earlier by listing filters. */
  async download(fileId: string): Promise<Response> {
    return this.request(`${DRIVE_API}/files/${assertDriveId(fileId)}?alt=media&supportsAllDrives=true`);
  }

  /** Fetches a thumbnail via the file's current (short-lived) thumbnailLink. Returns null if Drive has none or host is foreign. */
  async thumbnail(fileId: string, size = 256): Promise<Response | null> {
    const raw = await this.json<{ thumbnailLink?: string }>(`${DRIVE_API}/files/${assertDriveId(fileId)}?fields=thumbnailLink&supportsAllDrives=true`);
    if (!raw.thumbnailLink) return null;
    const url = raw.thumbnailLink.replace(/=s\d+$/, `=s${Math.min(Math.max(size, 32), 1024)}`);
    if (!/^https:\/\/[a-z0-9.-]*\.(googleusercontent|google)\.com\//i.test(url)) return null;

    // Google usercontent links should be fetched without Authorization header to avoid 401/403
    try {
      const unauthedRes = await this.fetchImpl(url);
      if (unauthedRes.ok) return unauthedRes;
    } catch {
      // fallback to auth
    }

    try {
      return await this.request(url);
    } catch {
      return null;
    }
  }
}

export interface DriveScopeSummary {
  files: number;
  folders: number;
  totalBytes: number;
  bytesUnknownFiles: number;
  unsupported: number;
  duplicates: number;
}

function normalize(raw: RawFile): { kind: 'folder'; folder: DriveFolder } | { kind: 'image'; image: DriveImage } | null {
  if (raw.mimeType === FOLDER_MIME) {
    return { kind: 'folder', folder: { id: raw.id, name: raw.name, parents: raw.parents, driveId: raw.driveId, isShortcut: false, modifiedTime: raw.modifiedTime } };
  }
  if (raw.mimeType === SHORTCUT_MIME) {
    const t = raw.shortcutDetails;
    if (!t) return null;
    if (t.targetMimeType === FOLDER_MIME) {
      return { kind: 'folder', folder: { id: t.targetId, name: raw.name, parents: raw.parents, isShortcut: true, modifiedTime: raw.modifiedTime } };
    }
    if (t.targetMimeType.startsWith('image/')) {
      return { kind: 'image', image: toImage({ ...raw, id: t.targetId, mimeType: t.targetMimeType }, true) };
    }
    return null;
  }
  if (raw.mimeType.startsWith('image/')) return { kind: 'image', image: toImage(raw, false) };
  return null;
}

function toImage(raw: RawFile, isShortcut: boolean): DriveImage {
  return {
    id: raw.id,
    name: raw.name,
    mimeType: raw.mimeType,
    size: raw.size !== undefined ? Number(raw.size) : undefined,
    modifiedTime: raw.modifiedTime,
    parents: raw.parents,
    driveId: raw.driveId,
    md5Checksum: raw.md5Checksum,
    hasThumbnail: Boolean(raw.thumbnailLink),
    supported: SUPPORTED_IMAGE_MIMES.has(raw.mimeType),
    isShortcut,
  };
}

async function toApiError(res: Response): Promise<GoogleApiError> {
  let reason: string | undefined;
  let message = `Google API error (${res.status})`;
  try {
    const body = (await res.json()) as { error?: { message?: string; errors?: Array<{ reason?: string }> } };
    message = body.error?.message ?? message;
    reason = body.error?.errors?.[0]?.reason;
  } catch { /* non-JSON error body */ }
  if (res.status === 401) message = 'Google rejected the access token. Reconnect your account.';
  else if (res.status === 403 && reason === 'insufficientPermissions') message = 'This Google account has not granted the required Drive permission.';
  else if (res.status === 403 && (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded')) message = 'Google Drive rate limit reached. Try again shortly.';
  else if (res.status === 403) message = 'You do not have permission to access this item.';
  else if (res.status === 404) message = 'Item not found or not accessible with this account.';
  return new GoogleApiError(message, res.status, reason);
}
