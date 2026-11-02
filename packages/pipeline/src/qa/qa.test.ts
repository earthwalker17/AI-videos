// QA on tiny synthetic files made with ffmpeg lavfi (testsrc2 + sine): what it must catch.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CueSheet, type QaReport } from '@aiv/core';
import { ffmpeg, ffmpegBin } from '../media/bin.ts';
import { probe } from '../media/probe.ts';
import { tempRepo, type TempRepo } from '../testing.ts';
import { execBuffer } from '../util/proc.ts';
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
async function make(name: string, o: { frozenS?: number; tags?: boolean; audio?: string[]; audioSource?: string } = {}): Promise<string> {
  const out = join(repo.root, 'out', `${name}.mp4`);
  const frozen = o.frozenS ? `;color=c=gray:s=${W}x${H}:r=30:d=${o.frozenS}[c]` : '';
  const graph = `color=c=black:s=${W}x${H}:r=30:d=1[a];testsrc2=s=${W}x${H}:r=30:d=1[b]${frozen};[a][b]${o.frozenS ? '[c]' : ''}concat=n=${o.frozenS ? 3 : 2}[out0]`;
  const total = 2 + (o.frozenS ?? 0);
  await ffmpeg(
    [
      '-loglevel', 'error', '-f', 'lavfi', '-i', graph, '-f', 'lavfi', '-i', o.audioSource ?? `sine=f=440:r=48000:d=${total}`,
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

  it('shifts video.json spans by where a partial render starts', async () => {
    // the file is composition frames [30, 90) of a longer film: its black opening is composition [30, 60)
    const file = await make('partial');
    const expect_ = { width: W, height: H, fps: 30, frames: 60 };
    expect(byId(await runQa({ file, root: repo.root, expect: expect_, allowBlack: [[30, 60]] }), 'black').passed).toBe(false);
    expect(byId(await runQa({ file, root: repo.root, expect: expect_, allowBlack: [[30, 60]], startFrame: 30 }), 'black').passed).toBe(true);
    // swatch frames are composition frames too: [40, 50) is file frames [10, 20) (no strip here, so it fails there)
    const moved = byId(await runQa({ file, root: repo.root, expect: expect_, allowBlack: [[30, 60]], startFrame: 30, swatch: { frames: [40, 50] }, contact: null }), 'swatches');
    expect(moved.passed).toBe(false);
    expect((moved.value as { frame: number }[]).map((r) => r.frame)).toEqual([10, 14, 19]);
    // outside the partial render: not verified, and said so
    const outside = byId(await runQa({ file, root: repo.root, expect: expect_, allowBlack: [[30, 60]], startFrame: 30, swatch: { frames: [0, 15] }, contact: null }), 'swatches');
    expect(outside).toMatchObject({ passed: true, info: true });
    expect(outside.detail).toMatch(/NOT VERIFIED: the swatch frames \[0, 15\) are outside this partial render/);
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

describe('audio QA with a cue sheet', () => {
  // 2 s at 30 fps over 1 s black + 1 s testsrc2: a tone to 0.8 s, digital silence, a 1 kHz knock
  // at 1.5 s (frame 45), silence again
  const tone = 'if(lt(t,0.8),0.3*sin(2*PI*440*t),if(between(t,1.5,1.6),0.8*sin(2*PI*1000*t),0))';
  const sheet = CueSheet.parse({
    schemaVersion: 1,
    fps: 30,
    filmFrames: 60,
    leaderFrames: 0,
    events: [
      { id: 'dark', kind: 'black', frame: 0, end: 30 },
      { id: 'title', kind: 'card', frame: 0, end: 20, text: { en: 'Knock' } },
      { id: 'gap', kind: 'silence', frame: 25, end: 44 },
      { id: 'knock', kind: 'hit', frame: 45, label: 'door' },
      { id: 'lull', kind: 'rest', frame: 50, end: 60 },
    ],
  });

  it('measures the cues, re-reports intent checks, lists where to listen and draws audio.png from a 2 s generated file', async () => {
    const file = await make('cued', { audioSource: `aevalsrc='${tone}|${tone}':s=48000:d=2:c=stereo`, audio: ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'] });
    const outDir = join(repo.root, 'out', 'qa-cued');
    const intent = [
      { id: 'cards.length', passed: true, detail: 'title held 0.67 s' },
      { id: 'cuts.bars', passed: true, info: true, detail: 'no grid' },
    ];
    const r = await runQa({ file, root: repo.root, expect: { width: W, height: H, fps: 30, frames: 60 }, cues: { sheet, intent }, audioSheet: {}, outDir });
    expect(r.checks.filter((c) => !c.passed && !c.info)).toEqual([]);
    expect(byId(r, 'audio.clipping').detail).toMatch(/sample peak -[12]\.\d\d dBFS/);
    expect(byId(r, 'audio.silence.gap').passed).toBe(true);
    expect(byId(r, 'audio.rest.lull').passed).toBe(true);
    const hit = byId(r, 'audio.hit.knock');
    expect(hit.info).toBe(true);
    expect(hit.passed).toBe(true);
    expect(byId(r, 'intent.cards.length').passed).toBe(true);
    expect(byId(r, 'intent.cuts.bars').info).toBe(true);
    expect(r.listening!.map((l) => [l.t, l.id])).toEqual([
      [0, 'title'],
      [0.833, 'gap'],
      [1.5, 'knock'],
      [1.667, 'lull'],
    ]);

    // audio.png: the spectrogram (legend included) over the waveform, the knock's line where 1.5 s is
    expect(r.audioSheet).toBe('out/qa-cued/audio.png');
    expect(byId(r, 'audio.sheet').info).toBe(true);
    const png = join(outDir, 'audio.png');
    expect(existsSync(png)).toBe(true);
    const v = (await probe(png)).video!;
    expect(v.width).toBeGreaterThan(1600);
    expect(v.height).toBeGreaterThan(400 + 160);
    const raw = await execBuffer(ffmpegBin(), ['-hide_banner', '-loglevel', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
    // the bottom row of the waveform area: background, except for the cue lines (and span shading)
    const y = v.height - 26 - 2;
    const red: number[] = [];
    for (let x = 0; x < v.width; x++) {
      const o = (y * v.width + x) * 3;
      if (raw.stdout[o] > 180 && raw.stdout[o + 1] < 120 && raw.stdout[o + 2] < 100) red.push(x);
    }
    const plotX = (v.width - 1600) / 2;
    expect(red.length).toBeGreaterThan(0);
    for (const x of red) expect(Math.abs(x - (plotX + 0.75 * 1600))).toBeLessThanOrEqual(3);
  });

  it('allows black cue spans, and fails a silence cue that is not silent', async () => {
    // 1 s black, 1 s testsrc2, a sine bed throughout
    const file = await make('cued-black');
    const s = CueSheet.parse({
      schemaVersion: 1,
      fps: 30,
      filmFrames: 60,
      leaderFrames: 0,
      events: [
        { id: 'dark', kind: 'black', frame: 0, end: 30 },
        { id: 'hush', kind: 'silence', frame: 30, end: 60 },
      ],
    });
    const r = await runQa({ file, root: repo.root, expect: { width: W, height: H, fps: 30, frames: 60 }, cues: { sheet: s } });
    expect(byId(r, 'black').passed).toBe(true);
    expect(byId(r, 'audio.silence.hush').passed).toBe(false);
    expect(r.passed).toBe(false);
    // no audio sheet asked for: none drawn, and the report says so
    expect(r.audioSheet).toBeNull();
  });
});
