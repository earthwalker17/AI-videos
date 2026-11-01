import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export const sha256 = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');

/** Streamed sha256 of a file (deliverables can be gigabytes). */
export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(path, { highWaterMark: 1 << 20 })
      .on('data', (d) => h.update(d))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}

/** JSON with sorted object keys: a stable byte form for hashing settings. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    }
    return v;
  });
}
