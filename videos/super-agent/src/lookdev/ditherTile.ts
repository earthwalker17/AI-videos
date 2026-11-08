/**
 * The static dither tile (assets/dither-256.png), baked once from a seed and never animated
 * (TREATMENT.md, Palette). Each pixel is white at an alpha of 0, 1 or 2 out of 255, with chances of
 * 1/4, 1/2 and 1/4. Drawn 1:1 over the dark ground (kit/dither.tsx), it adds 0, 1 or 2 code values
 * to a pixel: noise that breaks up the bands of a slow gradient such as the centre lift, and that
 * never lowers the ground (the QA black margin). On the film's ink (232) it adds under 0.2 codes.
 *
 * The file is a 2-bit palette PNG with a tRNS chunk, written with stored (uncompressed) deflate
 * blocks so the encoder needs no zlib: about 17 KB. Regenerate it from the repository root with
 *   pnpm exec tsx -e "import('./videos/super-agent/src/lookdev/ditherTile.ts').then((m) => require('node:fs').writeFileSync('videos/super-agent/assets/dither-256.png', m.ditherTilePng()))"
 * ditherTile.test.ts pins the bytes, so a change to this file that changes the tile fails there.
 */
import { rand } from '@aiv/core';

export const DITHER_SIZE = 256;
export const DITHER_SEED = 2202;

/** The tile's levels (0, 1 or 2: the alpha of a white pixel, out of 255), row by row. */
export function ditherLevels(size = DITHER_SIZE, seed = DITHER_SEED): Uint8Array {
  const out = new Uint8Array(size * size);
  // the sum of two fair coins: 0, 1, 2 with chances 1/4, 1/2, 1/4
  for (let i = 0; i < out.length; i++) out[i] = (rand(seed, 'dither', 2 * i) < 0.5 ? 0 : 1) + (rand(seed, 'dither', 2 * i + 1) < 0.5 ? 0 : 1);
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (ISO 3309, as PNG chunks use it). */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const x of bytes) {
    a = (a + x) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** A zlib stream of stored deflate blocks (no compression). */
function zlibStored(data: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(data.length / 65535));
  const out = new Uint8Array(2 + blocks * 5 + data.length + 4);
  let o = 0;
  out[o++] = 0x78;
  out[o++] = 0x01;
  for (let i = 0; i < blocks; i++) {
    const chunk = data.subarray(i * 65535, Math.min(data.length, (i + 1) * 65535));
    out[o++] = i === blocks - 1 ? 1 : 0;
    out[o++] = chunk.length & 0xff;
    out[o++] = chunk.length >>> 8;
    out[o++] = ~chunk.length & 0xff;
    out[o++] = (~chunk.length >>> 8) & 0xff;
    out.set(chunk, o);
    o += chunk.length;
  }
  const ad = adler32(data);
  out[o++] = ad >>> 24;
  out[o++] = (ad >>> 16) & 0xff;
  out[o++] = (ad >>> 8) & 0xff;
  out[o] = ad & 0xff;
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** The tile as PNG bytes: 2-bit palette (three white entries), tRNS alphas 0, 1, 2. */
export function ditherTilePng(size = DITHER_SIZE, seed = DITHER_SEED): Uint8Array {
  const levels = ditherLevels(size, seed);
  const rowBytes = Math.ceil(size / 4);
  const raw = new Uint8Array(size * (1 + rowBytes));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + rowBytes);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) raw[row + 1 + (x >> 2)] |= levels[y * size + x] << (6 - 2 * (x & 3));
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, size);
  v.setUint32(4, size);
  ihdr.set([2, 3, 0, 0, 0], 8); // bit depth 2, colour type 3 (palette), deflate, adaptive filters, no interlace
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255])),
    chunk('tRNS', new Uint8Array([0, 1, 2])),
    chunk('IDAT', zlibStored(raw)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
