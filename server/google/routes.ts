import express, { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import { GoogleAccountService, GoogleApiError, GoogleAuthError, FetchLike } from './accounts.ts';
import { DriveClient, DriveScope } from './drive.ts';
import { PhotosPickerClient, PickedPhoto } from './photosPicker.ts';
import { resolveDriveSelection, summarizeDriveSelection } from './selectionResolver.ts';
import { ImageRejectedError, ManagedLibrary } from '../library.ts';
import { serverLogger } from '../logger.ts';
import type { SerializedSelection } from '../../src/lib/selection.ts';

export interface GoogleRouterDeps {
  accounts: GoogleAccountService;
  library: ManagedLibrary;
  fetchImpl?: FetchLike;
}

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler => (req, res, next) => {
  fn(req, res).catch(next);
};

/** State-changing requests must carry a custom header, which browsers will not attach cross-origin without CORS approval. */
export const requireCsrfHeader: RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'ebay-hero') {
    res.status(403).json({ error: 'Missing X-Requested-With header.', code: 'csrf' });
    return;
  }
  next();
};

function parseSelection(body: unknown): SerializedSelection {
  const b = (body ?? {}) as Partial<SerializedSelection>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const scopes = Array.isArray(b.scopes) ? b.scopes.filter((s) => s && typeof s.folderId === 'string' && typeof s.label === 'string') : [];
  return { scopes: scopes as SerializedSelection['scopes'], included: arr(b.included), excluded: arr(b.excluded) };
}

interface CachedPickerItems { items: PickedPhoto[]; fetchedAt: number; accountId: string }
const PICKER_ITEM_TTL_MS = 45 * 60 * 1000; // baseUrls last ~60 min; refresh before that

export function createGoogleRouter(deps: GoogleRouterDeps): Router {
  const { accounts, library, fetchImpl } = deps;
  const router = express.Router();
  const pickerCache = new Map<string, CachedPickerItems>();

  router.use(express.json({ limit: '1mb' }));
  router.use(requireCsrfHeader);

  const drive = async () => new DriveClient(await accounts.getAccessToken('drive'), fetchImpl);
  const photos = async () => new PhotosPickerClient(await accounts.getAccessToken('photos'), fetchImpl);
  const activeId = () => accounts.getActiveAccount()?.id ?? 'unknown';

  // ---------- Connection management ----------
  router.get('/status', (_req, res) => res.json(accounts.publicStatus()));

  router.get('/oauth/start', (req, res) => {
    const service = req.query.service === 'photos' ? 'photos' : req.query.service === 'drive' ? 'drive' : null;
    if (!service) { res.status(400).json({ error: 'service must be "drive" or "photos"' }); return; }
    res.redirect(accounts.buildAuthUrl(service));
  });

  router.get('/oauth/callback', wrap(async (req, res) => {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    const page = (ok: boolean, msg: string) => {
      const safe = msg.replace(/[<>&"']/g, '');
      res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Google connection</title>
<body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem">
<h3>${ok ? 'Connected' : 'Connection failed'}</h3><p>${safe}</p><p>You can close this window.</p>
<script>try{window.opener&&window.opener.postMessage({type:'ebay-hero-google',ok:${ok}},window.location.origin)}catch(e){}
${ok ? 'setTimeout(function(){window.close()},800)' : ''}</script></body>`);
    };
    if (error) return page(false, error === 'access_denied' ? 'Access was denied on the Google consent screen.' : `Google returned: ${error}`);
    if (!code || !state) return page(false, 'Missing authorization code.');
    try {
      const acct = await accounts.handleCallback(code, state);
      page(true, `Connected ${acct.email}.`);
    } catch (e) {
      page(false, e instanceof Error ? e.message : 'Unknown error');
    }
  }));

  router.post('/accounts/:id/activate', (req, res) => {
    accounts.setActiveAccount(req.params.id);
    res.json(accounts.publicStatus());
  });

  router.post('/accounts/:id/disconnect', wrap(async (req, res) => {
    const { revoked } = await accounts.disconnect(req.params.id);
    res.json({ revoked, status: accounts.publicStatus() });
  }));

  router.get('/diagnostics', wrap(async (_req, res) => {
    const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
    const status = accounts.publicStatus();
    checks.push({ name: 'OAuth client configured', ok: status.configured, detail: status.configured ? 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET present.' : 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
    checks.push({ name: 'Redirect URI', ok: true, detail: `Add this exact URI to the OAuth client: ${status.redirectUri}` });
    const acct = accounts.getActiveAccount();
    checks.push({ name: 'Active account', ok: Boolean(acct), detail: acct ? acct.email : 'No account connected.' });
    if (acct) {
      checks.push({ name: 'Refresh token stored', ok: Boolean(acct.refreshToken), detail: acct.refreshToken ? 'Yes (encrypted at rest).' : 'No - reconnect to obtain one.' });
      for (const svc of ['drive', 'photos'] as const) {
        if (!accounts.hasScope(acct, svc)) { checks.push({ name: `Google ${svc === 'drive' ? 'Drive' : 'Photos'}`, ok: false, detail: 'Permission not granted.' }); continue; }
        try {
          if (svc === 'drive') {
            const about = await (await drive()).about();
            checks.push({ name: 'Google Drive', ok: true, detail: `Authenticated as ${about.email}.` });
          } else {
            await accounts.getAccessToken('photos'); // verifies refresh works; Picker has no read-only probe endpoint
            checks.push({ name: 'Google Photos Picker', ok: true, detail: 'Access token valid. Sessions are created on demand.' });
          }
          accounts.markSuccess(acct.id);
        } catch (e) {
          checks.push({ name: `Google ${svc === 'drive' ? 'Drive' : 'Photos'}`, ok: false, detail: e instanceof Error ? e.message : String(e) });
        }
      }
    }
    res.json({ checks });
  }));

  // ---------- Google Drive ----------
  router.get('/drive/shared-drives', wrap(async (req, res) => {
    res.json(await (await drive()).listSharedDrives(req.query.pageToken as string | undefined));
  }));

  router.get('/drive/list', wrap(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;
    const scope = (['my_drive', 'shared_with_me', 'shared_drives'].includes(q.scope ?? '') ? q.scope : 'my_drive') as DriveScope;
    const pageSize = q.pageSize ? Number(q.pageSize) : 100;
    res.json(await (await drive()).listFolder({
      scope,
      folderId: q.folderId && q.folderId !== 'root' ? q.folderId : undefined,
      driveId: q.driveId,
      search: q.search,
      pageToken: q.pageToken,
      pageSize: Number.isFinite(pageSize) ? pageSize : 100,
    }));
  }));

  router.get('/drive/breadcrumbs', wrap(async (req, res) => {
    const id = req.query.folderId as string | undefined;
    if (!id) { res.status(400).json({ error: 'folderId required' }); return; }
    res.json({ trail: await (await drive()).getBreadcrumbs(id) });
  }));

  router.post('/drive/selection/summary', wrap(async (req, res) => {
    const ac = new AbortController();
    res.on('close', () => ac.abort());
    res.json(await summarizeDriveSelection(await drive(), parseSelection(req.body), ac.signal));
  }));

  router.get('/drive/thumb/:id', wrap(async (req, res) => {
    const size = Number(req.query.size) || 256;
    const client = await drive();
    let upstream = await client.thumbnail(req.params.id, size);
    if (!upstream) {
      try {
        upstream = await client.download(req.params.id);
      } catch {}
    }
    if (!upstream) { res.status(404).json({ error: 'No thumbnail available from Drive for this file.' }); return; }
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(upstream.body as never).pipe(res);
  }));

  /** NDJSON stream: {type:'start'|'item'|'skip'|'error'|'done'}; aborting the HTTP request cancels the import. */
  router.post('/drive/import', wrap(async (req, res) => {
    const client = await drive();
    const account = activeId();
    const sel = parseSelection(req.body);
    const ac = new AbortController();
    res.on('close', () => ac.abort());
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-store');
    const send = (o: unknown) => res.write(JSON.stringify(o) + '\n');

    const stats = { imported: 0, duplicates: 0, skipped: 0, failed: 0 };
    send({ type: 'start' });
    try {
      for await (const { image, folderPath } of resolveDriveSelection(client, sel, { signal: ac.signal })) {
        if (ac.signal.aborted) break;
        if (!image.supported) { stats.skipped++; send({ type: 'skip', id: image.id, name: image.name, reason: `Unsupported type ${image.mimeType}` }); continue; }
        try {
          const dl = await client.download(image.id);
          const { record, duplicate } = await library.ingest(dl.body as never, image.name, {
            type: 'google_drive', fileId: image.id, account, folderPath, modifiedTime: image.modifiedTime,
          });
          duplicate ? stats.duplicates++ : stats.imported++;
          send({ type: 'item', sourceId: image.id, duplicate, folderPath, item: publicRecord(record) });
        } catch (e) {
          stats.failed++;
          const rejected = e instanceof ImageRejectedError;
          send({ type: 'error', id: image.id, name: image.name, retryable: !rejected, message: e instanceof Error ? e.message : String(e) });
        }
      }
    } catch (e) {
      send({ type: 'error', fatal: true, message: e instanceof Error ? e.message : String(e) });
    }
    send({ type: 'done', cancelled: ac.signal.aborted, ...stats });
    res.end();
  }));

  // ---------- Google Photos Picker ----------
  router.post('/photos/session', wrap(async (req, res) => {
    const max = req.body?.maxItemCount;
    const session = await (await photos()).createSession(max === undefined ? undefined : Number(max));
    res.json(session);
  }));

  router.get('/photos/session/:id', wrap(async (req, res) => {
    const client = await photos();
    const session = await client.getSession(req.params.id);
    let itemCount: number | null = null;
    if (session.mediaItemsSet) {
      try {
        const items = await getPickerItems(client, req.params.id, true);
        itemCount = items.length;
      } catch (e) {
        console.warn(`[photos] Could not preload item count for session ${req.params.id}:`, e);
      }
    }
    res.json({ ...session, itemCount });
  }));

  router.get('/photos/session/:id/items', wrap(async (req, res) => {
    const client = await photos();
    const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
    const items = await getPickerItems(client, req.params.id, refresh);
    res.json({
      items: items.map((m) => ({
        id: m.id, type: m.type, filename: m.filename ?? null, filenameAvailable: Boolean(m.filename),
        mimeType: m.mimeType ?? null, width: m.width ?? null, height: m.height ?? null, createTime: m.createTime ?? null,
        cameraMake: m.cameraMake ?? null, cameraModel: m.cameraModel ?? null,
      })),
    });
  }));

  router.get('/photos/session/:id/thumb/:mediaId', wrap(async (req, res) => {
    const client = await photos();
    const item = (await getPickerItems(client, req.params.id, false)).find((m) => m.id === req.params.mediaId);
    if (!item) { res.status(404).json({ error: 'Item is not part of this picker session.' }); return; }
    const upstream = await client.fetchMedia(item.baseUrl, 'thumb', Number(req.query.size) || 256);
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(upstream.body as never).pipe(res);
  }));

  router.post('/photos/session/:id/import', wrap(async (req, res) => {
    const client = await photos();
    const account = activeId();
    const opId = (req.headers['x-operation-id'] as string) || (req.body?.operationId as string) || serverLogger.generateId('photos-imp');
    const only = Array.isArray(req.body?.itemIds) ? new Set<string>(req.body.itemIds) : null;
    const items = (await getPickerItems(client, req.params.id, true)).filter((m) => !only || only.has(m.id));
    const ac = new AbortController();
    res.on('close', () => ac.abort());
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-store');
    const send = (o: unknown) => res.write(JSON.stringify(o) + '\n');
    const stats = { imported: 0, duplicates: 0, skipped: 0, failed: 0 };
    serverLogger.info('Google Photos', 'import_start', `Starting import for session ${req.params.id} (${items.length} items)`, { operationId: opId, details: { sessionId: req.params.id, count: items.length } });
    send({ type: 'start', total: items.length, opId });
    for (const m of items) {
      if (ac.signal.aborted) {
        serverLogger.warn('Google Photos', 'import_aborted', 'Client aborted import connection mid-stream', { operationId: opId, details: { sessionId: req.params.id } });
        break;
      }
      const name = m.filename ?? `google-photos-${m.id.slice(0, 8)}`;
      if (m.type !== 'PHOTO') {
        stats.skipped++;
        serverLogger.debug('Google Photos', 'import_skipped_type', `Skipped non-photo item: ${m.type}`, { operationId: opId, details: { id: m.id, type: m.type } });
        send({ type: 'skip', id: m.id, name, reason: `${m.type} items are not imported` });
        continue;
      }
      try {
        const dl = await client.fetchMedia(m.baseUrl, 'original');
        const { record, duplicate } = await library.ingest(dl.body as never, name, { type: 'google_photos', mediaItemId: m.id, account, createTime: m.createTime });
        duplicate ? stats.duplicates++ : stats.imported++;
        serverLogger.info('Google Photos', 'import_item_success', `Ingested photo ${name} (id: ${record.id}, duplicate: ${duplicate})`, {
          operationId: opId,
          details: {
            mediaItemId: m.id,
            libraryId: record.id,
            duplicate,
            size: record.size,
          },
        });
        send({ type: 'item', sourceId: m.id, duplicate, filenameFromGoogle: Boolean(m.filename), item: publicRecord(record) });
      } catch (e) {
        stats.failed++;
        const message = e instanceof Error ? e.message : String(e);
        const code = e instanceof GoogleApiError ? e.reason : e instanceof ImageRejectedError ? e.code : 'download_error';
        serverLogger.error('Google Photos', 'import_item_error', `Failed importing photo ${name}: ${message}`, {
          operationId: opId,
          details: {
            mediaItemId: m.id,
            code,
            error: message,
          },
        });
        send({ type: 'error', id: m.id, name, retryable: !(e instanceof ImageRejectedError), message, code, opId });
      }
    }
    serverLogger.info('Google Photos', 'import_complete', `Import completed. Imported: ${stats.imported}, Dups: ${stats.duplicates}, Failed: ${stats.failed}`, { operationId: opId, details: { stats } });
    send({ type: 'done', cancelled: ac.signal.aborted, opId, ...stats });
    res.end();
  }));

  router.delete('/photos/session/:id', wrap(async (req, res) => {
    pickerCache.delete(req.params.id);
    try { await (await photos()).deleteSession(req.params.id); } catch (e) {
      if (!(e instanceof GoogleApiError && e.status === 404)) throw e; // already expired is fine
    }
    res.json({ deleted: true });
  }));

  async function getPickerItems(client: PhotosPickerClient, sessionId: string, refreshHint: boolean): Promise<PickedPhoto[]> {
    const cached = pickerCache.get(sessionId);
    if (!refreshHint && cached && cached.items.length > 0 && Date.now() - cached.fetchedAt < PICKER_ITEM_TTL_MS && cached.accountId === activeId()) {
      return cached.items;
    }
    const items = await client.listPickedItems(sessionId);
    pickerCache.set(sessionId, { items, fetchedAt: Date.now(), accountId: activeId() });
    return items;
  }

  // ---------- error mapping ----------
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof GoogleAuthError) { res.status(err.status).json({ error: err.message, code: err.code }); return; }
    if (err instanceof GoogleApiError) { res.status(err.status === 401 ? 401 : err.status).json({ error: err.message, code: err.status === 401 ? 'reauth_required' : 'google_api', reason: err.reason }); return; }
    console.error('[google] unexpected error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Unexpected server error.', code: 'internal' });
  });

  return router;
}

export function createLibraryRouter(library: ManagedLibrary): Router {
  const router = express.Router();

  // List all ingested records in the library
  router.get('/', (_req, res) => {
    const records = library.list().map(publicRecord);
    res.json({ items: records, total: records.length });
  });

  router.get('/:id', (req, res) => {
    const rec = library.get(req.params.id);
    if (!rec) { res.status(404).json({ error: 'Library record not found' }); return; }
    res.json(publicRecord(rec));
  });

  router.get('/:id/file', (req, res) => {
    const rec = library.get(req.params.id);
    if (!rec) { res.status(404).json({ error: 'Library record not found' }); return; }
    const fPath = library.filePath(rec);
    if (!fs.existsSync(fPath)) {
      res.status(404).json({ error: 'File data missing from disk', id: rec.id });
      return;
    }
    const stat = fs.statSync(fPath);
    res.setHeader('Content-Type', rec.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const stream = fs.createReadStream(fPath);
    stream.on('error', (err) => {
      console.error('[library] stream error:', err);
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  });

  // Upload a single file into the managed asset library
  router.post('/upload', async (req: Request, res: Response) => {
    const opId = (req.headers['x-operation-id'] as string) || serverLogger.generateId('upload');
    try {
      const filename = req.body?.filename || req.body?.originalFilename || 'upload.jpg';
      const dataBase64 = req.body?.dataBase64 || req.body?.imageBase64;
      const relativePath = req.body?.relativePath || filename;
      if (!dataBase64) {
        res.status(400).json({ error: 'Missing dataBase64 or imageBase64 payload' });
        return;
      }
      const raw = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
      const buffer = Buffer.from(raw, 'base64');
      const { record, duplicate } = await library.ingest(buffer, filename, {
        type: 'local_upload',
        relativePath,
        lastModified: req.body?.lastModified || Date.now(),
      });
      serverLogger.info('Managed Library', 'local_upload_success', `Ingested local file: ${filename} (ID: ${record.id}, duplicate: ${duplicate})`, {
        operationId: opId,
        details: {
          filename,
          size: record.size,
          duplicate,
        },
      });
      res.json({ item: publicRecord(record), duplicate });
    } catch (err: any) {
      serverLogger.error('Managed Library', 'local_upload_error', err.message || 'Upload failed', {
        operationId: opId,
        details: {
          filename: req.body?.filename,
          code: err instanceof ImageRejectedError ? err.code : undefined,
        },
      });
      res.status(err instanceof ImageRejectedError ? 400 : 500).json({
        error: err.message || 'Upload failed',
        code: err instanceof ImageRejectedError ? err.code : 'upload_failed',
      });
    }
  });

  // Batch upload multiple files into the managed asset library
  router.post('/upload/batch', async (req: Request, res: Response) => {
    const opId = (req.headers['x-operation-id'] as string) || serverLogger.generateId('batch-up');
    try {
      const files = req.body?.files;
      if (!Array.isArray(files) || files.length === 0) {
        res.status(400).json({ error: 'Missing files array in request body' });
        return;
      }
      const results: Array<{ item?: ReturnType<typeof publicRecord>; duplicate?: boolean; error?: string; filename: string }> = [];
      for (const file of files) {
        const filename = file.filename || file.originalFilename || 'upload.jpg';
        const dataBase64 = file.dataBase64 || file.imageBase64;
        const relativePath = file.relativePath || filename;
        if (!dataBase64) {
          results.push({ error: 'Missing image data', filename });
          continue;
        }
        try {
          const raw = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
          const buffer = Buffer.from(raw, 'base64');
          const { record, duplicate } = await library.ingest(buffer, filename, {
            type: 'local_upload',
            relativePath,
            lastModified: file.lastModified || Date.now(),
          });
          results.push({ item: publicRecord(record), duplicate, filename });
        } catch (err: any) {
          results.push({
            error: err.message || 'Upload failed',
            filename,
          });
        }
      }
      serverLogger.info('Managed Library', 'batch_upload_complete', `Batch uploaded ${results.length} files`, { operationId: opId, details: { count: results.length } });
      res.json({ results });
    } catch (err: any) {
      serverLogger.error('Managed Library', 'batch_upload_error', err.message || 'Batch upload failed', { operationId: opId });
      res.status(500).json({ error: err.message || 'Batch upload failed' });
    }
  });

  router.delete('/:id', (req, res) => {
    const deleted = library.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Library record not found' });
      return;
    }
    res.json({ deleted: true, id: req.params.id });
  });

  return router;
}

export function publicRecord(r: ReturnType<ManagedLibrary['list']>[number]) {
  return {
    id: r.id, originalName: r.originalName, mimeType: r.mimeType, size: r.size, sha256: r.sha256,
    importedAt: r.importedAt, source: r.source, url: `/api/library/${r.id}/file`,
  };
}

