import { describe, expect, it } from 'vitest';
import { DriveClient, FOLDER_MIME, SHORTCUT_MIME, assertDriveId, escapeDriveQueryLiteral } from '../server/google/drive.ts';
import { GoogleApiError } from '../server/google/accounts.ts';
import { json, mockFetch } from './helpers.ts';

const noSleep = async () => {};
const folder = (id: string, name: string, parents: string[] = ['root']) => ({ id, name, mimeType: FOLDER_MIME, parents });
const img = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, mimeType: 'image/jpeg', size: '1000', parents: ['p'], thumbnailLink: 'https://lh3.googleusercontent.com/x=s220', ...extra,
});

/** Fake Drive: children keyed by parent ID, supports paging of 2 items per page. */
function fakeDrive(tree: Record<string, unknown[]>, pageSize = 2) {
  return mockFetch((url) => {
    if (!url.pathname.endsWith('/drive/v3/files')) return undefined;
    const q = url.searchParams.get('q') ?? '';
    const parent = q.match(/'([^']+)' in parents/)?.[1] ?? '__none__';
    const all = tree[parent] ?? [];
    const start = Number(url.searchParams.get('pageToken') ?? 0);
    const slice = all.slice(start, start + pageSize);
    const next = start + pageSize < all.length ? String(start + pageSize) : undefined;
    return json({ files: slice, nextPageToken: next });
  });
}

describe('Drive client – real hierarchy, not heuristics', () => {
  it('lists the direct children of My Drive root using parent query only (no name-based guessing)', async () => {
    const f = fakeDrive({ root: [folder('f1', 'Enable Disable'), folder('f2', 'Photo Viewer Restore'), img('i1', 'a.jpg')] }, 100);
    const page = await new DriveClient('tok', f, { sleep: noSleep }).listFolder({ scope: 'my_drive' });
    const q = new URL(f.calls[0].url).searchParams.get('q')!;
    expect(q).toContain("'root' in parents");
    expect(q).not.toMatch(/name contains/);
    expect(q).not.toMatch(/Photo|Album|Camera/);
    // Names are whatever Drive said they are – and they are FOLDERS in the Drive source, never "albums".
    expect(page.folders.map((x) => x.name)).toEqual(['Enable Disable', 'Photo Viewer Restore']);
    expect(page.images.map((x) => x.name)).toEqual(['a.jpg']);
  });

  it('nested folders are NOT relabeled as computer backups: listing a folder uses its own ID', async () => {
    const f = fakeDrive({ P: [folder('c1', 'Baseball', ['P'])] }, 100);
    const page = await new DriveClient('tok', f).listFolder({ folderId: 'P' });
    expect(new URL(f.calls[0].url).searchParams.get('q')).toContain("'P' in parents");
    expect(page.folders[0]).toMatchObject({ id: 'c1', name: 'Baseball', parents: ['P'], isShortcut: false });
  });

  it('sends the bearer token and requests only real metadata fields', async () => {
    const f = fakeDrive({ root: [] });
    await new DriveClient('SECRET', f).listFolder({});
    expect((f.calls[0].init!.headers as Record<string, string>).Authorization).toBe('Bearer SECRET');
    expect(decodeURIComponent(f.calls[0].url)).toContain('md5Checksum');
  });

  it('keeps size undefined when Drive does not return one (no fabricated sizes)', async () => {
    const f = fakeDrive({ root: [{ id: 'x', name: 'n.jpg', mimeType: 'image/jpeg' }] });
    const { images } = await new DriveClient('t', f).listFolder({});
    expect(images[0].size).toBeUndefined();
    expect(images[0].hasThumbnail).toBe(false);
  });

  it('resolves shortcuts to their targets and ignores shortcuts to non-images', async () => {
    const f = fakeDrive({
      root: [
        { id: 's1', name: 'Link to folder', mimeType: SHORTCUT_MIME, shortcutDetails: { targetId: 'T1', targetMimeType: FOLDER_MIME } },
        { id: 's2', name: 'Link to photo', mimeType: SHORTCUT_MIME, shortcutDetails: { targetId: 'T2', targetMimeType: 'image/png' } },
        { id: 's3', name: 'Link to doc', mimeType: SHORTCUT_MIME, shortcutDetails: { targetId: 'T3', targetMimeType: 'application/pdf' } },
      ],
    }, 100);
    const r = await new DriveClient('t', f).listFolder({});
    expect(r.folders).toMatchObject([{ id: 'T1', isShortcut: true }]);
    expect(r.images).toMatchObject([{ id: 'T2', isShortcut: true, mimeType: 'image/png' }]);
    expect(r.skippedNonImage).toBe(1);
  });

  it('shared drives use corpora=drive+driveId; shared-with-me uses sharedWithMe', async () => {
    const f = fakeDrive({ SD1: [] });
    const c = new DriveClient('t', f);
    await c.listFolder({ folderId: 'SD1', driveId: 'SD1' });
    await c.listFolder({ scope: 'shared_with_me' });
    const u0 = new URL(f.calls[0].url).searchParams;
    expect(u0.get('corpora')).toBe('drive');
    expect(u0.get('driveId')).toBe('SD1');
    const u1 = new URL(f.calls[1].url).searchParams;
    expect(u1.get('q')).toContain('sharedWithMe = true');
  });

  it('search is escaped and cannot break out of the query', async () => {
    const f = fakeDrive({});
    await new DriveClient('t', f).listFolder({ search: "o'brien\\' or trashed=true or '" });
    const q = new URL(f.calls[0].url).searchParams.get('q')!;
    expect(q).toContain(escapeDriveQueryLiteral("o'brien\\' or trashed=true or '"));
    expect(escapeDriveQueryLiteral("a'b\\c")).toBe("a\\'b\\\\c");
  });

  it('rejects malformed IDs instead of interpolating them', async () => {
    expect(() => assertDriveId("x' or '1'='1")).toThrow(GoogleApiError);
    await expect(new DriveClient('t', fakeDrive({})).listFolder({ folderId: "a' in parents or 'b" })).rejects.toThrow(/Invalid Drive ID/);
  });
});

describe('Drive client – pagination, recursion, summaries', () => {
  const tree = {
    root: [folder('S', 'Stamps'), folder('C', 'Cards'), img('r1', 'top.jpg', { md5Checksum: 'm1' })],
    S: [folder('US', 'United States', ['S']), img('s1', 's1.jpg', { md5Checksum: 'm2' }), img('s2', 's2.png', { mimeType: 'image/png', md5Checksum: 'm2' })],
    US: [img('u1', 'u1.jpg', { size: '2000' }), img('u2', 'u2.svg', { mimeType: 'image/svg+xml' })],
    C: [img('c1', 'c1.heic', { mimeType: 'image/heic', size: undefined })],
  };

  it('follows nextPageToken until exhausted', async () => {
    const f = fakeDrive({ big: Array.from({ length: 7 }, (_, i) => img(`i${i}`, `${i}.jpg`)) }, 3);
    const seen: string[] = [];
    for await (const e of new DriveClient('t', f).walkImages({ folderId: 'big', recursive: false })) if (e.kind === 'image') seen.push(e.image.id);
    expect(seen).toHaveLength(7);
    expect(f.calls).toHaveLength(3);
  });

  it('non-recursive walk of a folder only sees direct files', async () => {
    const s = await new DriveClient('t', fakeDrive(tree)).summarize({ folderId: 'S', recursive: false });
    expect(s).toMatchObject({ files: 2, folders: 0, unsupported: 0 });
  });

  it('recursive walk includes the entire descendant tree and reports totals', async () => {
    const s = await new DriveClient('t', fakeDrive(tree)).summarize({ folderId: undefined, recursive: true });
    expect(s.files).toBe(6 - 1 /* svg */);           // top, s1, s2, u1, c1
    expect(s.unsupported).toBe(1);                      // u2.svg
    expect(s.folders).toBe(3);                          // S, C, US
    expect(s.duplicates).toBe(1);                       // s1 & s2 share md5
    expect(s.bytesUnknownFiles).toBe(1);                // c1 has no size – counted, not invented
    expect(s.totalBytes).toBe(1000 + 1000 + 1000 + 2000);
  });

  it('is cycle-safe (shortcut loops)', async () => {
    const loop = { A: [folder('B', 'B', ['A'])], B: [folder('A', 'A', ['B']), img('x', 'x.jpg')] };
    const s = await new DriveClient('t', fakeDrive(loop)).summarize({ folderId: 'A', recursive: true });
    expect(s.files).toBe(1);
  });

  it('enforces a folder limit', async () => {
    const wide: Record<string, unknown[]> = { R: Array.from({ length: 5 }, (_, i) => folder(`F${i}`, `F${i}`, ['R'])) };
    await expect(new DriveClient('t', fakeDrive(wide)).summarize({ folderId: 'R', recursive: true, maxFolders: 3 })).rejects.toThrow(/Folder limit/);
  });

  it('can be cancelled', async () => {
    const ac = new AbortController();
    ac.abort();
    const s = await new DriveClient('t', fakeDrive(tree)).summarize({ folderId: undefined, recursive: true, signal: ac.signal });
    expect(s.files).toBe(0);
  });
});

describe('Drive client – errors and resilience', () => {
  it('retries 429/5xx with backoff then succeeds', async () => {
    let n = 0;
    const f = mockFetch(() => (++n < 3 ? json({ error: { message: 'slow down' } }, 429) : json({ files: [] })));
    const r = await new DriveClient('t', f, { sleep: noSleep }).listFolder({});
    expect(r.folders).toEqual([]);
    expect(f.calls).toHaveLength(3);
  });

  it('maps 401, 403 and 404 to clear, actionable messages', async () => {
    const make = (status: number, reason?: string) => new DriveClient('t', mockFetch(() => json({ error: { message: 'raw', errors: [{ reason }] } }, status)), { maxRetries: 0 });
    await expect(make(401).listFolder({})).rejects.toMatchObject({ status: 401, message: expect.stringMatching(/Reconnect/) });
    await expect(make(403, 'insufficientPermissions').listFolder({})).rejects.toMatchObject({ message: expect.stringMatching(/not granted/) });
    await expect(make(403, 'forbidden').listFolder({})).rejects.toMatchObject({ message: expect.stringMatching(/permission/) });
    await expect(make(404).listFolder({})).rejects.toMatchObject({ message: expect.stringMatching(/not found or not accessible/) });
  });

  it('breadcrumbs return real names and stop gracefully at an inaccessible parent', async () => {
    const files: Record<string, unknown> = {
      c: { id: 'c', name: 'Baseball', parents: ['b'] },
      b: { id: 'b', name: 'Sports Cards', parents: ['a'] },
    };
    const f = mockFetch((url) => {
      const id = url.pathname.split('/').pop()!;
      return files[id] ? json(files[id]) : json({ error: { message: 'nf' } }, 404);
    });
    expect(await new DriveClient('t', f).getBreadcrumbs('c')).toEqual([{ id: 'b', name: 'Sports Cards' }, { id: 'c', name: 'Baseball' }]);
  });

  it('thumbnail returns null when Drive has none, and refuses foreign hosts', async () => {
    const none = mockFetch(() => json({}));
    expect(await new DriveClient('t', none).thumbnail('abc')).toBeNull();
    const evil = mockFetch(() => json({ thumbnailLink: 'https://evil.example.com/x=s220' }));
    expect(await new DriveClient('t', evil).thumbnail('abc')).toBeNull();
    expect(evil.calls).toHaveLength(1); // never fetched the foreign URL
  });
});
