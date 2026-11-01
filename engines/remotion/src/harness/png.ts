/**
 * A minimal PNG decoder on node:zlib, for the frames Chrome's screenshot hands to Remotion's
 * onFrameBuffer: 8-bit truecolour (RGB, colour type 2) or truecolour + alpha (RGBA, type 6),
 * non-interlaced, filters 0-4. Anything else is refused loudly rather than guessed at.
 *
 * Output: tightly packed RGBA (width*4 stride, top row first), the layout the runner hashes and
 * streams into the FFV1 mezzanine. Ancillary chunks (sRGB, gAMA, iCCP, …) are ignored on
 * purpose: the values are taken as written, like ffmpeg's PNG decoder does (png.test.ts pins
 * that against ffmpeg). Every chunk's CRC is checked: a truncated or corrupt screenshot must
 * never become a frame.
 */
import { crc32, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface DecodedPng {
  width: number;
  height: number;
  /** tightly packed RGBA */
  rgba: Uint8Array;
  /** the PNG carried an alpha channel (colour type 6) */
  hadAlpha: boolean;
}

const fail = (why: string): never => {
  throw new Error(`PNG decoder: ${why}`);
};

/** Paeth predictor (PNG spec, filter type 4). */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(buf: Uint8Array): DecodedPng {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length < 8 || !b.subarray(0, 8).equals(SIGNATURE)) fail('not a PNG (bad signature)');
  let off = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Buffer[] = [];
  let sawEnd = false;
  while (off + 12 <= b.length) {
    const len = b.readUInt32BE(off);
    const type = b.toString('latin1', off + 4, off + 8);
    if (off + 12 + len > b.length) fail(`chunk ${type} runs past the end of the file (truncated?)`);
    const data = b.subarray(off + 8, off + 8 + len);
    if (crc32(data, crc32(b.subarray(off + 4, off + 8))) !== b.readUInt32BE(off + 8 + len)) fail(`chunk ${type} has a bad CRC`);
    off += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, ct, compression, filter, interlace] = [data[8], data[9], data[10], data[11], data[12]];
      if (depth !== 8) fail(`bit depth ${depth} is not supported (8 only)`);
      if (ct !== 2 && ct !== 6) fail(`colour type ${ct} is not supported (2 = RGB, 6 = RGBA only)`);
      if (compression !== 0 || filter !== 0) fail('unknown compression or filter method');
      if (interlace !== 0) fail('interlaced PNGs are not supported');
      if (!width || !height) fail('zero-sized image');
      colorType = ct;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') {
      sawEnd = true;
      break;
    } else if (type === 'PLTE') {
      /* allowed (suggested palette) for truecolour, unused */
    } else if ((type.charCodeAt(0) & 0x20) === 0) fail(`unknown critical chunk ${type}`);
  }
  if (colorType < 0) fail('no IHDR chunk');
  if (!sawEnd) fail('no IEND chunk (truncated?)');
  if (!idat.length) fail('no image data');

  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length !== height * (stride + 1)) fail(`image data is ${raw.length} bytes, expected ${height * (stride + 1)} for ${width}x${height}`);

  // unfilter in place, row by row: `prev` is the reconstructed row above (zeros for the first)
  const rows = new Uint8Array(height * stride);
  const zero = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const cur = rows.subarray(y * stride, (y + 1) * stride);
    const prev = y ? rows.subarray((y - 1) * stride, y * stride) : zero;
    switch (ft) {
      case 0:
        cur.set(raw.subarray(src, src + stride));
        break;
      case 1:
        for (let x = 0; x < stride; x++) cur[x] = (raw[src + x] + (x >= bpp ? cur[x - bpp] : 0)) & 255;
        break;
      case 2:
        for (let x = 0; x < stride; x++) cur[x] = (raw[src + x] + prev[x]) & 255;
        break;
      case 3:
        for (let x = 0; x < stride; x++) cur[x] = (raw[src + x] + (((x >= bpp ? cur[x - bpp] : 0) + prev[x]) >> 1)) & 255;
        break;
      case 4:
        for (let x = 0; x < stride; x++) cur[x] = (raw[src + x] + paeth(x >= bpp ? cur[x - bpp] : 0, prev[x], x >= bpp ? prev[x - bpp] : 0)) & 255;
        break;
      default:
        fail(`row ${y} has unknown filter type ${ft}`);
    }
  }
  if (bpp === 4) return { width, height, rgba: rows, hadAlpha: true };
  const rgba = new Uint8Array(width * height * 4);
  for (let s = 0, d = 0; s < rows.length; s += 3, d += 4) {
    rgba[d] = rows[s];
    rgba[d + 1] = rows[s + 1];
    rgba[d + 2] = rows[s + 2];
    rgba[d + 3] = 255;
  }
  return { width, height, rgba, hadAlpha: false };
}

/** Index of the first pixel whose alpha is not 255, or -1 (the mezzanine drops alpha: frames must be opaque). */
export function firstTransparent(rgba: Uint8Array): number {
  for (let o = 3; o < rgba.length; o += 4) if (rgba[o] !== 255) return (o - 3) / 4;
  return -1;
}
