import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ManagedLibrary } from '../server/library.ts';
import { AiService } from '../server/ai/aiService.ts';
import { EbayService } from '../server/ebay/ebayService.ts';
import { PluginRegistry } from '../server/plugins/pluginRegistry.ts';
import { createExtendedApiRouter } from '../server/routes/apiRoutes.ts';
import { createLibraryRouter } from '../server/google/routes.ts';
import { serverLogger } from '../server/logger.ts';

// 1x1 transparent PNG buffer
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

describe('Diagnostics & Asset Pipeline End-to-End', () => {
  let tmpDir: string;
  let library: ManagedLibrary;
  let aiService: AiService;
  let ebayService: EbayService;
  let pluginRegistry: PluginRegistry;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-hero-pipe-test-'));
    const libDir = path.join(tmpDir, 'library');
    fs.mkdirSync(libDir, { recursive: true });

    library = new ManagedLibrary(libDir);
    aiService = new AiService(tmpDir);
    ebayService = new EbayService(tmpDir);
    pluginRegistry = new PluginRegistry(tmpDir);

    const app = express();
    app.use(express.json());
    app.use('/api/library', createLibraryRouter(library));
    app.use('/api', createExtendedApiRouter({
      aiService,
      ebayService,
      pluginRegistry,
      library,
    }));
    serverLogger.clear();

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      if (server) {
        if (typeof (server as any).closeAllConnections === 'function') {
          (server as any).closeAllConnections();
        }
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('GET /api/diagnostics/health executes full health check suite and returns structured results', async () => {
    const res = await fetch(`${baseUrl}/api/diagnostics/health`, {
      headers: { 'X-Requested-With': 'ebay-hero' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toBeInstanceOf(Array);
    expect(body.results.length).toBeGreaterThanOrEqual(5);

    const ids = body.results.map((r: any) => r.id);
    expect(ids).toContain('oauth-config');
    expect(ids).toContain('active-account');
    expect(ids).toContain('drive-api');
    expect(ids).toContain('photos-api');
    expect(ids).toContain('gemini-vision');
    expect(ids).toContain('library-storage');
  });

  it('GET /api/diagnostics/logs and POST /api/diagnostics/client-log record and retrieve entries', async () => {
    const postRes = await fetch(`${baseUrl}/api/diagnostics/client-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'ebay-hero',
      },
      body: JSON.stringify({
        level: 'INFO',
        subsystem: 'Google Drive',
        event: 'user_selected_folder',
        message: 'Folder Collectibles selected',
        operationId: 'op-drive-1',
        details: { folderId: 'f123' },
      }),
    });
    expect(postRes.status).toBe(200);

    const res = await fetch(`${baseUrl}/api/diagnostics/logs`, {
      headers: { 'X-Requested-With': 'ebay-hero' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.logs.find((l: any) => l.event === 'user_selected_folder');
    expect(found).toBeDefined();
    expect(found.subsystem).toBe('Google Drive');
    expect(found.operationId).toBe('op-drive-1');
  });

  it('GET /api/library/:id/file sets proper streaming headers and Content-Length', async () => {
    const { record } = await library.ingest(TINY_PNG, 'sample_card.png', {
      type: 'local_upload',
    });

    const res = await fetch(`${baseUrl}/api/library/${record.id}/file`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-length')).toBe(String(TINY_PNG.length));
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
  });

  it('GET /api/library/:id/file returns 404 with JSON when item does not exist', async () => {
    const res = await fetch(`${baseUrl}/api/library/non-existent-id/file`);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Library record not found');
  });

  it('POST /api/ai/analyze resolves library file directly from disk and produces proposedFilename and ebayDraft', async () => {
    const { record } = await library.ingest(TINY_PNG, '1999_charizard_holo.png', {
      type: 'google_drive',
      fileId: 'drive-file-123',
      account: 'test@gmail.com',
    });

    const res = await fetch(`${baseUrl}/api/ai/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'ebay-hero',
      },
      body: JSON.stringify({
        imageBase64: `/api/library/${record.id}/file`,
        mimeType: 'image/png',
        originalFilename: '1999_charizard_holo.png',
        provider: 'gemini',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposedFilename).toBeDefined();
    expect(body.proposedRelativeFolder).toBeDefined();
    expect(body.ebayDraft).toBeDefined();
    expect(body.ebayDraft.title).toBeDefined();
    expect(body.ebayDraft.title.length).toBeLessThanOrEqual(80);
    expect(body.ebayDraft.itemSpecifics).toBeDefined();
  }, 30000);

  it('POST /api/library/upload ingests local base64 file and returns public record with persistent URL', async () => {
    const res = await fetch(`${baseUrl}/api/library/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'pikachu_card.png',
        dataBase64: TINY_PNG.toString('base64'),
        relativePath: 'Pokemon/pikachu_card.png',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item).toBeDefined();
    expect(body.item.originalName).toBe('pikachu_card.png');
    expect(body.item.mimeType).toBe('image/png');
    expect(body.item.url).toMatch(/^\/api\/library\/[0-9a-f-]{36}\/file$/);
    expect(body.duplicate).toBe(false);

    // Re-uploading identical file returns duplicate: true and same ID
    const resDup = await fetch(`${baseUrl}/api/library/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'pikachu_card_copy.png',
        dataBase64: TINY_PNG.toString('base64'),
      }),
    });
    const dupBody = await resDup.json();
    expect(dupBody.duplicate).toBe(true);
    expect(dupBody.item.id).toBe(body.item.id);
  });

  it('POST /api/library/upload/batch ingests multiple files in one batch request', async () => {
    const res = await fetch(`${baseUrl}/api/library/upload/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [
          { filename: 'card1.png', dataBase64: TINY_PNG.toString('base64'), relativePath: 'Batch/card1.png' },
          { filename: 'corrupted.png', dataBase64: 'bm90LWFuLWltYWdl', relativePath: 'Batch/corrupted.png' },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0].item).toBeDefined();
    expect(body.results[0].filename).toBe('card1.png');
    expect(body.results[1].error).toBeDefined();
    expect(body.results[1].filename).toBe('corrupted.png');
  });

  it('GET /api/library lists records and DELETE /api/library/:id removes record', async () => {
    const { record } = await library.ingest(TINY_PNG, 'to_delete.png', { type: 'local_upload' });

    const listRes = await fetch(`${baseUrl}/api/library`);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.items.some((i: any) => i.id === record.id)).toBe(true);

    const delRes = await fetch(`${baseUrl}/api/library/${record.id}`, { method: 'DELETE' });
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.deleted).toBe(true);

    // Verify file route returns 404
    const getFileRes = await fetch(`${baseUrl}/api/library/${record.id}/file`);
    expect(getFileRes.status).toBe(404);
  });
});

