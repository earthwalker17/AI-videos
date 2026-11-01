// QA on tiny synthetic files made with ffmpeg lavfi (testsrc2 + sine): what it must catch.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { QaReport } from '@aiv/core';
import { ffmpeg } from '../media/bin.ts';
import { tempRepo, type TempRepo } from '../testing.ts';
import { decodedFrameHashes } from './frames.ts';
import { runQa } from './qa.ts';

let repo: TempRepo;
beforeAll(() => {
  repo = tempRepo();
  mkdirSync(join(repo.root, 'out'), { recursive: true });
});
afterAll(() => repo?.cleanup());

const W = 320;
const H = 180;
const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
const byId = (r: QaReport, id: string) => r.checks.find((c) => c.id === id)!;

/** 1 s black, 1 s testsrc2, then `frozenS` of one still frame; a sine bed under it all. */
async function make(name: string, o: { frozenS?: number; tags?: boolean; audio?: string[] } = {}): Promise<string> {
  const out = join(repo.root, 'out', `${name}.mp4`);
  const frozen = o.frozenS ? `;color=c=gray:s=${W}x${H}:r=30:d=${o.frozenS}[c]` : '';
  const graph = `color=c=black:s=${W}x${H}:r=30:d=1[a];testsrc2=s=${W}x${H}:r=30:d=1[b]${frozen};[a][b]${o.frozenS ? '[c]' : ''}concat=n=${o.frozenS ? 3 : 2}[out0]`;
  const total = 2 + (o.frozenS ?? 0);
  await ffmpeg(
    [
      '-loglevel', 'error', '-f', 'lavfi', '-i', graph, '-f', 'lavfi', '-i', `sine=f=440:r=48000:d=${total}`,
      // measured on ffmpeg 8.0.1: -color_primaries/-color_trc alone did not reach the stream
      // (probe said null); the encoder writes the VUI from frame properties, hence setparams
      '-vf', o.tags === false ? 'format=yuv420p' : 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-g', '15', ...(o.tags === false ? [] : BT709),
      ...(o.audio ?? ['-c:a', 'aac', '-ar', '48000', '-ac', '2']), '-t', String(total), out,
    ],
    `make ${name}`,
  );
  return out;
}

describe('runQa on synthetic files', () => {
  it('passes a clean file once its intentional black opening is declared', async () => {
    const file = await make('clean');
    const expect_ = { width: W, height: H, fps: 30, frames: 60, durationS: 2 };
    const strict = await runQa({ file, root: repo.root, expect: expect_ });
    expect(byId(strict, 'black').passed).toBe(false);
    expect(byId(strict, 'black').detail).toMatch(/0\.00-1\.00 s/);
    const r = await runQa({ file, root: repo.root, expect: expect_, allowBlack: [[0, 30]] });
    expect(r.checks.filter((c) => !c.passed && !c.info)).toEqual([]);
    expect(r.passed).toBe(true);
    expect(byId(r, 'loudness').info).toBe(true);
    expect(r.loudness!.i).toBeLessThan(-14);
  });

  it('fails untagged video, wrong audio format, a long freeze and the wrong frame count', async () => {
    const file = await make('bad', { tags: false, frozenS: 4, audio: ['-c:a', 'aac', '-ar', '44100', '-ac', '1'] });
    const r = await runQa({ file, root: repo.root, expect: { width: W, height: H, fps: 30, frames: 100 }, allowBlack: [[0, 30]], loudness: { integrated: -14, tolerance: 1, truePeakMax: -1 } });
    expect(r.passed).toBe(false);
    for (const id of ['probe.color', 'probe.audio', 'probe.frames', 'freeze', 'loudness.integrated']) expect(byId(r, id).passed, id).toBe(false);
    expect(byId(r, 'freeze').detail).toMatch(/2\.\d+-6\.00 s/);
    expect(byId(r, 'probe.size').passed).toBe(true);
  });

  it('catches A/V length mismatch beyond one frame', async () => {
    const file = join(repo.root, 'out', 'short-audio.mp4');
    await ffmpeg(['-loglevel', 'error', '-f', 'lavfi', '-i', `testsrc2=s=${W}x${H}:r=30:d=2`, '-f', 'lavfi', '-i', 'sine=f=440:r=48000:d=1.5', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', file], 'short audio');
    const r = await runQa({ file, root: repo.root, expect: { width: W, height: H, fps: 30 } });
    expect(byId(r, 'av.duration').passed).toBe(false);
  });

  it('decoded frame hashes are stable per frame and differ between frames', async () => {
    const file = await make('hashes');
    const a = await decodedFrameHashes(file, [40, 45, 45, 50]);
    const b = await decodedFrameHashes(file, [50, 40, 45]);
    expect(a.map((x) => x.i)).toEqual([40, 45, 50]);
    expect(b).toEqual(a);
    expect(new Set(a.map((x) => x.sha256)).size).toBe(3);
  });
});
