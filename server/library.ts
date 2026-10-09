import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DATA_DIR } from './security/secretStore.ts';

export const MAX_IMAGE_BYTES = 100 * 1024 * 1024;

export type ImageSourceRef =
  | { type: 'google_drive'; fileId: string; account: string; folderPath?: string; modifiedTime?: string }
  | { type: 'google_photos'; mediaItemId: string; account: string; createTime?: string }
  | { type: 'local_upload'; relativePath?: string; lastModified?: number };

export interface LibraryRecord {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  sha256: string;
  storedFile: string; // relative to library dir
  source: ImageSourceRef;
  importedAt: string;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/bmp': 'bmp', 'image/tiff': 'tif', 'image/heic': 'heic', 'image/heif': 'heif',
};

/** Identify an image from its first bytes. Never trusts filename or declared MIME type. */
export function sniffImageMime(head: Buffer): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (head.length >= 6 && /^GIF8[79]a$/.test(head.subarray(0, 6).toString('latin1'))) return 'image/gif';
  if (head.length >= 12 && head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (head.length >= 2 && head[0] === 0x42 && head[1] === 0x4d) return 'image/bmp';
  if (head.length >= 4 && ((head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0x00) || (head[0] === 0x4d && head[1] === 0x4d && head[2] === 0x00 && head[3] === 0x2a))) return 'image/tiff';
  if (head.length >= 12 && head.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = head.subarray(8, 12).toString('latin1');
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1', 'heim', 'heis'].includes(brand)) return 'image/heif';
  }
  return null;
}

export class ImageRejectedError extends Error {
  constructor(message: string, public readonly code: 'not_an_image' | 'too_large' | 'empty') {
    super(message);
  }
}

export class ManagedLibrary {
  private readonly dir: string;
  private readonly indexPath: string;

  constructor(baseDir: string = path.join(DATA_DIR, 'library'), private readonly maxBytes = MAX_IMAGE_BYTES) {
    this.dir = baseDir;
    this.indexPath = path.join(baseDir, 'index.json');
    fs.mkdirSync(baseDir, { recursive: true });
  }

  private readIndex(): LibraryRecord[] {
    if (!fs.existsSync(this.indexPath)) return [];
    return JSON.parse(fs.readFileSync(this.indexPath, 'utf8')) as LibraryRecord[];
  }

  private writeIndex(records: LibraryRecord[]) {
    const tmp = `${this.indexPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(records, null, 2));
    fs.renameSync(tmp, this.indexPath);
  }

  list(): LibraryRecord[] {
    return this.readIndex();
  }

  get(id: string): LibraryRecord | undefined {
    return this.readIndex().find((r) => r.id === id);
  }

  delete(id: string): boolean {
    const index = this.readIndex();
    const idx = index.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    const [rec] = index.splice(idx, 1);
    try {
      const full = path.resolve(this.dir, rec.storedFile);
      if (fs.existsSync(full)) fs.rmSync(full, { force: true });
    } catch {}
    this.writeIndex(index);
    return true;
  }

  filePath(record: LibraryRecord): string {
    const full = path.resolve(this.dir, record.storedFile);
    if (!full.startsWith(path.resolve(this.dir) + path.sep)) throw new Error('Path escapes library directory');
    return full;
  }

  /**
   * Streams bytes to disk, validating size and real image type. If an identical file (sha256) already exists it is
   * reused and `duplicate` is true. Original files at the source are never touched.
   */
  async ingest(body: ReadableStream<Uint8Array> | Readable | Buffer, originalName: string, source: ImageSourceRef): Promise<{ record: LibraryRecord; duplicate: boolean }> {
    const tmpFile = path.join(this.dir, `.incoming-${crypto.randomUUID()}`);
    const hash = crypto.createHash('sha256');
    let size = 0;
    const limiter = new Transform({
      transform: (chunk: Buffer, _enc, cb) => {
        size += chunk.length;
        if (size > this.maxBytes) return cb(new ImageRejectedError(`File exceeds the ${Math.round(this.maxBytes / 1048576)} MB limit.`, 'too_large'));
        hash.update(chunk);
        cb(null, chunk);
      },
    });
    const readable = Buffer.isBuffer(body)
      ? Readable.from(body)
      : body instanceof Readable
      ? body
      : Readable.fromWeb(body as never);
    try {
      await pipeline(readable, limiter, fs.createWriteStream(tmpFile));
      if (size === 0) throw new ImageRejectedError('File is empty.', 'empty');
      const fd = fs.openSync(tmpFile, 'r');
      const head = Buffer.alloc(32);
      const n = fs.readSync(fd, head, 0, 32, 0);
      fs.closeSync(fd);
      const mime = sniffImageMime(head.subarray(0, n));
      if (!mime) throw new ImageRejectedError('File content is not a supported image format.', 'not_an_image');

      const sha256 = hash.digest('hex');
      const index = this.readIndex();
      const existing = index.find((r) => r.sha256 === sha256);
      if (existing) {
        fs.rmSync(tmpFile, { force: true });
        return { record: existing, duplicate: true };
      }
      const id = crypto.randomUUID();
      const storedFile = `${id}.${EXT_BY_MIME[mime]}`;
      fs.renameSync(tmpFile, path.join(this.dir, storedFile));
      const record: LibraryRecord = {
        id, originalName: path.basename(originalName), mimeType: mime, size, sha256, storedFile, source,
        importedAt: new Date().toISOString(),
      };
      index.push(record);
      this.writeIndex(index);
      return { record, duplicate: false };
    } catch (e) {
      fs.rmSync(tmpFile, { force: true });
      throw e;
    }
  }
}
