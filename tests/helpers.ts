import type { FetchLike } from '../server/google/accounts.ts';

export interface Call { url: string; init?: RequestInit }
type Responder = (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined;

/** Minimal scripted fetch: first responder returning a Response wins. Unmatched requests fail the test loudly. */
export function mockFetch(...responders: Responder[]): FetchLike & { calls: Call[] } {
  const calls: Call[] = [];
  const fn = (async (input: string, init?: RequestInit) => {
    calls.push({ url: input, init });
    const url = new URL(input);
    for (const r of responders) {
      const out = await r(url, init);
      if (out) return out;
    }
    throw new Error(`Unmocked fetch: ${init?.method ?? 'GET'} ${input}`);
  }) as FetchLike & { calls: Call[] };
  fn.calls = calls;
  return fn;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const bytes = (b: Uint8Array | Buffer, type = 'image/jpeg') =>
  new Response(b as BodyInit, { status: 200, headers: { 'Content-Type': type } });

export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('JFIF fake body for tests')]);
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png body')]);
