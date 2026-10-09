import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Encrypted-at-rest JSON store for credentials/tokens (AES-256-GCM).
 *
 * Key source, in order:
 *   1. APP_SECRET_KEY env var (any string; hashed with SHA-256)
 *   2. data/.secret.key (32 random bytes generated on first use, mode 0600, git-ignored)
 *
 * Secrets are never logged and never returned by any API route.
 */
export const DATA_DIR = path.resolve(process.env.EBAY_HERO_DATA_DIR || path.join(process.cwd(), 'data'));

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function getEncryptionKey(dataDir: string = DATA_DIR): Buffer {
  const envKey = process.env.APP_SECRET_KEY;
  if (envKey && envKey.length >= 16) {
    return crypto.createHash('sha256').update(envKey).digest();
  }
  ensureDir(dataDir);
  const keyPath = path.join(dataDir, '.secret.key');
  if (fs.existsSync(keyPath)) {
    const raw = fs.readFileSync(keyPath);
    if (raw.length === 32) return raw;
    throw new Error(`Corrupt key file at ${keyPath}; refusing to continue (delete it to re-key, tokens will need re-connecting).`);
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key, { mode: 0o600 });
  return key;
}

export function encryptJson(value: unknown, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: tag.toString('base64'), data: enc.toString('base64') });
}

export function decryptJson<T>(payload: string, key: Buffer): T {
  const { v, iv, tag, data } = JSON.parse(payload);
  if (v !== 1) throw new Error('Unsupported secret store version');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
  return JSON.parse(dec.toString('utf8')) as T;
}

export class EncryptedJsonFile<T> {
  constructor(private readonly filePath: string, private readonly defaults: () => T, private readonly key: Buffer) {}

  read(): T {
    if (!fs.existsSync(this.filePath)) return this.defaults();
    return decryptJson<T>(fs.readFileSync(this.filePath, 'utf8'), this.key);
  }

  write(value: T): void {
    ensureDir(path.dirname(this.filePath));
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, encryptJson(value, this.key), { mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
  }
}
