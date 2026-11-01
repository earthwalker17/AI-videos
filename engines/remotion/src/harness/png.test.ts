/**
 * The PNG decoder against ffmpeg's: the same PNG files (every prediction filter, RGB and RGBA,
 * odd sizes) must decode to the same RGBA bytes. ffmpeg writes the PNGs; ffmpeg also decodes
 * them to rawvideo rgba as the reference.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execBuffer, ffmpegBin, sha256 } from '@aiv/pipeline';
import { afterAll, describe, expect, it } from 'vitest';
import { decodePng, firstTransparent } from './png.ts';

const dir = mkdtempSync(join(tmpdir(), 'aiv-png-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A PNG written by ffmpeg from a noisy test pattern (high entropy: every filter path gets exercised). */
async function makePng(name: string, w: number, h: number, pixFmt: string, pred: string): Promise<string> {
  const file = join(dir, `${name}.png`);
  const alpha = pixFmt === 'rgba' ? ',geq=r=r(X\\,Y):g=g(X\\,Y):b=b(X\\,Y):a=mod(X*7+Y*13\\,256)' : '';
  const r = await execBuffer(ffmpegBin(), [
    '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=s=${w + 1}x${h + 1}:r=1,format=rgba,crop=${w}:${h}:0:0,noise=alls=40:allf=t${alpha}`,
    '-frames:v', '1', '-pix_fmt', pixFmt, '-c:v', 'png', '-pred', pred, '-y', file,
  ]);
  expect(r.code, r.stderr).toBe(0);
  return file;
}

async function ffmpegRgba(file: string): Promise<Buffer> {
  const r = await execBuffer(ffmpegBin(), ['-v', 'error', '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
  expect(r.code, r.stderr).toBe(0);
  return r.stdout;
}

describe('decodePng', () => {
  for (const pixFmt of ['rgb24', 'rgba'] as const) {
    for (const pred of ['none', 'sub', 'up', 'avg', 'paeth', 'mixed']) {
      it(`decodes ${pixFmt} with ${pred} prediction exactly like ffmpeg`, async () => {
        const file = await makePng(`${pixFmt}-${pred}`, 97, 33, pixFmt, pred);
        const ours = decodePng(readFileSync(file));
        expect([ours.width, ours.height]).toEqual([97, 33]);
        expect(ours.hadAlpha).toBe(pixFmt === 'rgba');
        const ref = await ffmpegRgba(file);
        expect(ours.rgba.length).toBe(ref.length);
        expect(sha256(ours.rgba)).toBe(sha256(ref));
      });
    }
  }

  it('reports transparent pixels (frames must be opaque)', async () => {
    const opaque = decodePng(readFileSync(await makePng('opaque', 16, 8, 'rgb24', 'mixed')));
    expect(firstTransparent(opaque.rgba)).toBe(-1);
    const see = decodePng(readFileSync(await makePng('alpha', 16, 8, 'rgba', 'mixed')));
    expect(firstTransparent(see.rgba)).toBe(0);
  });

  it('refuses what it does not implement, loudly', async () => {
    for (const [pixFmt, why] of [
      ['rgb48be', /bit depth 16/],
      ['gray', /colour type 0/],
      ['pal8', /colour type 3/],
      ['ya8', /colour type 4/],
    ] as const) {
      const file = await makePng(`bad-${pixFmt}`, 16, 8, pixFmt, 'none');
      expect(() => decodePng(readFileSync(file)), pixFmt).toThrow(why);
    }
    const good = readFileSync(await makePng('crc', 16, 8, 'rgb24', 'none'));
    const corrupt = Buffer.from(good);
    corrupt[corrupt.length - 20] ^= 0xff;
    expect(() => decodePng(corrupt)).toThrow(/bad CRC/);
    expect(() => decodePng(good.subarray(0, good.length - 12))).toThrow(/IEND|truncated/);
    expect(() => decodePng(Buffer.from('not a png at all'))).toThrow(/signature/);
  });
});
