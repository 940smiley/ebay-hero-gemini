import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { PhotosPickerClient, parseDurationMs } from '../server/google/photosPicker.ts';
import { ImageRejectedError, ManagedLibrary, sniffImageMime } from '../server/library.ts';
import { JPEG, PNG, bytes, json, mockFetch } from './helpers.ts';

describe('Google Photos Picker client', () => {
  it('creates a session against the Picker API (not Drive) and appends /autoclose', async () => {
    const f = mockFetch((url, init) => {
      if (url.href === 'https://photospicker.googleapis.com/v1/sessions' && init?.method === 'POST') {
        return json({ id: 's1', pickerUri: 'https://photos.google.com/picker/abc', pollingConfig: { pollInterval: '3.5s', timeoutIn: '900s' }, mediaItemsSet: false });
      }
    });
    const s = await new PhotosPickerClient('tok', f).createSession();
    expect(s).toMatchObject({ id: 's1', pickerUri: 'https://photos.google.com/picker/abc/autoclose', pollIntervalMs: 3500, timeoutMs: 900000, mediaItemsSet: false });
    expect(f.calls.every((c) => !c.url.includes('/drive/'))).toBe(true);
  });

  it('validates maxItemCount', async () => {
    const c = new PhotosPickerClient('t', mockFetch(() => json({})));
    await expect(c.createSession(0)).rejects.toThrow(/between 1 and 2000/);
    await expect(c.createSession(5000)).rejects.toThrow();
  });

  it('lists all picked items across pages and keeps unavailable metadata undefined', async () => {
    const f = mockFetch((url) => {
      if (!url.pathname.endsWith('/mediaItems')) return;
      expect(url.searchParams.get('sessionId')).toBe('s1');
      if (!url.searchParams.get('pageToken')) {
        return json({ mediaItems: [{ id: 'a', type: 'PHOTO', createTime: '2024-01-02T00:00:00Z', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/a', mimeType: 'image/jpeg', filename: 'IMG_1.jpg', mediaFileMetadata: { width: 10, height: 20, cameraMake: 'Canon' } } }], nextPageToken: 'p2' });
      }
      return json({ mediaItems: [{ id: 'b', type: 'VIDEO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/b' } }, { id: 'broken' }] });
    });
    const items = await new PhotosPickerClient('t', f).listPickedItems('s1');
    expect(items.map((i) => i.id)).toEqual(['a', 'b']); // item with no mediaFile dropped
    expect(items[0]).toMatchObject({ filename: 'IMG_1.jpg', width: 10, cameraMake: 'Canon' });
    expect(items[1].filename).toBeUndefined();
    expect(items[1].type).toBe('VIDEO');
  });

  it('downloads originals with =d and thumbnails with =w/-h, sending the bearer token', async () => {
    const f = mockFetch(() => bytes(JPEG));
    const c = new PhotosPickerClient('TOK', f);
    await c.fetchMedia('https://lh3.googleusercontent.com/a', 'original');
    await c.fetchMedia('https://lh3.googleusercontent.com/a', 'thumb', 128);
    expect(f.calls[0].url.endsWith('=d')).toBe(true);
    expect(f.calls[1].url.endsWith('=w128-h128')).toBe(true);
    expect((f.calls[0].init!.headers as Record<string, string>).Authorization).toBe('Bearer TOK');
  });

  it('refuses to fetch media from a non-Google host', async () => {
    const f = mockFetch(() => bytes(JPEG));
    await expect(new PhotosPickerClient('t', f).fetchMedia('https://evil.example.com/x', 'original')).rejects.toThrow(/unexpected host/);
    expect(f.calls).toHaveLength(0);
  });

  it('gives an actionable message for 403 (API not enabled / scope missing) and expired sessions', async () => {
    const mk = (status: number) => new PhotosPickerClient('t', mockFetch(() => json({ error: { message: 'x' } }, status)));
    await expect(mk(403).getSession('s')).rejects.toThrow(/not been granted|not enabled/);
    await expect(mk(404).getSession('s')).rejects.toThrow(/expired/);
    await expect(mk(401).getSession('s')).rejects.toThrow(/Reconnect/);
  });

  it('parses protobuf durations', () => {
    expect(parseDurationMs('10s', 1)).toBe(10000);
    expect(parseDurationMs('0.5s', 1)).toBe(500);
    expect(parseDurationMs(undefined, 42)).toBe(42);
    expect(parseDurationMs('bogus', 42)).toBe(42);
  });
});

describe('Managed image library', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ebh-lib-'));
  const src = { type: 'local_upload' as const };

  it('identifies formats from magic bytes only', () => {
    expect(sniffImageMime(JPEG)).toBe('image/jpeg');
    expect(sniffImageMime(PNG)).toBe('image/png');
    expect(sniffImageMime(Buffer.from('GIF89a....'))).toBe('image/gif');
    expect(sniffImageMime(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImageMime(Buffer.from('\0\0\0\x18ftypheic\0\0\0\0'))).toBe('image/heic');
    expect(sniffImageMime(Buffer.from('II*\0abcd'))).toBe('image/tiff');
    expect(sniffImageMime(Buffer.from('<?xml svg'))).toBeNull();
  });

  it('rejects a non-image renamed to .jpg and leaves nothing behind', async () => {
    const dir = tmp();
    const lib = new ManagedLibrary(dir);
    await expect(lib.ingest(Readable.from([Buffer.from('MZ\x90\x00 definitely an exe')]), 'holiday.jpg', src)).rejects.toMatchObject({ code: 'not_an_image' });
    expect(fs.readdirSync(dir).filter((f) => f !== 'index.json')).toEqual([]);
    expect(lib.list()).toHaveLength(0);
  });

  it('stores the real type regardless of declared name, never uses the user-supplied name as a path', async () => {
    const dir = tmp();
    const lib = new ManagedLibrary(dir);
    const { record } = await lib.ingest(Readable.from([PNG]), '../../etc/passwd.jpg', src);
    expect(record.mimeType).toBe('image/png');
    expect(record.storedFile).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(record.originalName).toBe('passwd.jpg');
    expect(lib.filePath(record).startsWith(dir)).toBe(true);
  });

  it('detects duplicates by content hash and reuses the existing record', async () => {
    const lib = new ManagedLibrary(tmp());
    const a = await lib.ingest(Readable.from([JPEG]), 'a.jpg', src);
    const b = await lib.ingest(Readable.from([JPEG]), 'copy-of-a.jpg', src);
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.record.id).toBe(a.record.id);
    expect(lib.list()).toHaveLength(1);
  });

  it('enforces the size limit mid-stream', async () => {
    const lib = new ManagedLibrary(tmp(), 100);
    const big = Buffer.concat([JPEG, Buffer.alloc(500)]);
    await expect(lib.ingest(Readable.from([big]), 'big.jpg', src)).rejects.toBeInstanceOf(ImageRejectedError);
  });

  it('rejects empty files', async () => {
    const lib = new ManagedLibrary(tmp());
    await expect(lib.ingest(Readable.from([]), 'e.jpg', src)).rejects.toMatchObject({ code: 'empty' });
  });
});
