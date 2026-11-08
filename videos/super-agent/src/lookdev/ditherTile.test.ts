import { describe, expect, it } from 'vitest';
import { crc32, DITHER_SIZE, ditherLevels, ditherTilePng } from './ditherTile.ts';

/** Read back the chunks of a PNG, checking each CRC. */
function chunks(png: Uint8Array): { type: string; data: Uint8Array }[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const out: { type: string; data: Uint8Array }[] = [];
  let o = 8;
  while (o < png.length) {
    const len = view.getUint32(o);
    const type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    const data = png.subarray(o + 8, o + 8 + len);
    expect(view.getUint32(o + 8 + len), `${type} CRC`).toBe(crc32(png.subarray(o + 4, o + 8 + len)));
    out.push({ type, data });
    o += 12 + len;
  }
  return out;
}

/** Undo the stored deflate blocks of a zlib stream. */
function unstore(z: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let o = 2;
  for (;;) {
    const final = z[o] & 1;
    expect(z[o] >> 1).toBe(0); // stored
    const len = z[o + 1] | (z[o + 2] << 8);
    expect((z[o + 3] | (z[o + 4] << 8)) ^ 0xffff).toBe(len);
    parts.push(z.subarray(o + 5, o + 5 + len));
    o += 5 + len;
    if (final) break;
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let k = 0;
  for (const p of parts) {
    out.set(p, k);
    k += p.length;
  }
  return out;
}

describe('the dither tile', () => {
  it('has levels 0, 1, 2 at about 1/4, 1/2, 1/4, and is the same every time', () => {
    const lv = ditherLevels();
    expect(lv.length).toBe(DITHER_SIZE * DITHER_SIZE);
    const count = [0, 0, 0];
    for (const v of lv) count[v]++;
    expect(count[0] / lv.length).toBeCloseTo(0.25, 1);
    expect(count[1] / lv.length).toBeCloseTo(0.5, 1);
    expect(count[2] / lv.length).toBeCloseTo(0.25, 1);
    expect(ditherLevels()).toEqual(lv);
    expect(ditherLevels(DITHER_SIZE, 1)).not.toEqual(lv);
  });

  it('is a valid 2-bit palette PNG whose pixels are those levels', () => {
    const png = ditherTilePng();
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const cs = chunks(png);
    expect(cs.map((c) => c.type)).toEqual(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);
    const ihdr = new DataView(cs[0].data.buffer, cs[0].data.byteOffset);
    expect([ihdr.getUint32(0), ihdr.getUint32(4), ...cs[0].data.subarray(8)]).toEqual([256, 256, 2, 3, 0, 0, 0]);
    expect([...cs[2].data]).toEqual([0, 1, 2]);
    const raw = unstore(cs[3].data);
    const lv = ditherLevels();
    const rowBytes = 64;
    expect(raw.length).toBe(256 * (1 + rowBytes));
    for (let y = 0; y < 256; y += 37) {
      expect(raw[y * (1 + rowBytes)]).toBe(0);
      for (let x = 0; x < 256; x++) expect((raw[y * (1 + rowBytes) + 1 + (x >> 2)] >> (6 - 2 * (x & 3))) & 3).toBe(lv[y * 256 + x]);
    }
    expect(png.length).toBeLessThan(20_000);
  });

  it('keeps the committed tile: assets/dither-256.png is these bytes', () => {
    // the CRC-32 of the whole file as committed; regenerate the asset (ditherTile.ts) if this changes
    expect(crc32(ditherTilePng()).toString(16)).toBe(PINNED);
  });
});

const PINNED = '556ace7f';
