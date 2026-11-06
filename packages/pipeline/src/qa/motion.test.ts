// Motion QA: the pure measures on synthetic series, the meter on synthetic frames, and the whole
// path (ffmpeg decode, motion.png, strips, runQa) on tiny lavfi videos: a pan on ones with a
// subject on twos must judder, the same with the subject on ones must not.
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ffmpeg } from '../media/bin.ts';
import { tempRepo, type TempRepo } from '../testing.ts';
import type { DeliveryCue } from './audio.ts';
import {
  analyseMotion,
  analysisSize,
  boilSpans,
  cadenceSpans,
  cadenceWindows,
  drawMotionSheet,
  flashEvents,
  lossyEvidence,
  measureMotion,
  median,
  MOTION_THRESHOLDS,
  motionChecks,
  motionEstimateS,
  MotionMeter,
  planStrips,
  popEvents,
  type MotionSeries,
} from './motion.ts';
import { runQa } from './qa.ts';

// a deterministic wobble, so "smooth" series are not perfectly flat
const wobble = (i: number, amp: number) => amp * Math.sin(i * 1.7) * Math.cos(i * 0.37);
// a D-like series: frame 0 has no previous frame (0)
const range = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => (i === 0 ? 0 : f(i)));
const luma = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));

/**
 * A series whose picture and every tile share `d`, unless `tile` gives one tile its own. Its
 * coarse difference DC (picture and tiles) is 0.9 D unless given: motion (grain alone would give
 * about 0.4 D).
 */
function series(d: number[], o: { hf?: number[]; dc?: number[]; tile?: { k: number; d: number[]; dc?: number[] }; others?: number[]; y?: number[] } = {}): MotionSeries {
  const n = d.length;
  const tiles = Array.from({ length: 12 }, (_, k) => (o.tile && o.tile.k === k ? o.tile.d : (o.others ?? d)));
  return {
    fps: 24,
    width: 480,
    height: 270,
    cols: 4,
    rows: 3,
    y: o.y ?? new Array<number>(n).fill(50),
    d,
    hf: o.hf ?? new Array<number>(n).fill(0.5),
    dc: o.dc ?? d.map((x) => 0.9 * x),
    tiles,
    tilesDc: tiles.map((t, k) => (o.tile && o.tile.k === k && o.tile.dc ? o.tile.dc : t.map((x) => 0.9 * x))),
  };
}

describe('cadence', () => {
  it('measures an alternating D as alternating, consistent and of a parity', () => {
    const d = range(40, (i) => (i % 2 ? 6 : 10));
    const w = cadenceWindows(d, 12).find((x) => x.start === 10)!;
    expect(w.r).toBeCloseTo(10 / 6, 5);
    expect(w.c).toBe(1);
    expect(w.evenHigh).toBe(true);
    expect(w.a).toBeCloseTo(4 / 8, 5);
  });

  it('flags judder when the frames between the steps still move, and on twos when everything holds', () => {
    // a picture moving on ones (D 6 on every frame) with a part stepping on twos on top (+4 on even frames)
    const judder = cadenceSpans(series(range(60, (i) => (i % 2 ? 6 : 10))));
    expect(judder).toHaveLength(1);
    expect(judder[0]).toMatchObject({ kind: 'judder', start: 1, end: 60 });
    // everything held every other frame: D falls to the grain, which averages out of DC
    const held = range(60, (i) => (i % 2 ? 0.4 : 8));
    const twos = cadenceSpans(series(held, { dc: held.map((x, i) => (i % 2 ? 0.16 : 0.9 * x)) }));
    expect(twos.map((s) => s.kind)).toEqual(['twos']);
    // a strong grain (D 2.4 on held frames) is still a hold: DC 0.96 is over holdAbs, but only 0.4 D
    const grainy = range(60, (i) => (i % 2 ? 2.4 : 12));
    expect(cadenceSpans(series(grainy, { dc: grainy.map((x, i) => (i % 2 ? 0.96 : 0.9 * x)) })).map((s) => s.kind)).toEqual(['twos']);
  });

  it('leaves a camera move on ones, a still picture with grain and a fluctuation in pairs alone', () => {
    expect(cadenceSpans(series(range(80, (i) => 7 + wobble(i, 0.4))))).toEqual([]);
    // held frames: only grain changes (under the motion floor)
    expect(cadenceSpans(series(range(80, (i) => 0.6 + wobble(i, 0.05))))).toEqual([]);
    // low low high high: a big parity ratio by chance, but not frame by frame
    expect(cadenceSpans(series(range(80, (i) => (Math.floor(i / 2) % 2 ? 9 : 4))))).toEqual([]);
  });

  it('finds judder in one tile when the picture as a whole hardly shows it', () => {
    const pan = range(60, (i) => 5 + wobble(i, 0.2));
    const subject = range(60, (i) => (i % 2 ? 12 : 18));
    const spans = cadenceSpans(series(pan, { tile: { k: 6, d: subject }, others: pan }));
    expect(spans).toHaveLength(1);
    expect(spans[0].kind).toBe('judder');
    expect(spans[0].sources).toEqual(['r1c2']);
    // its strip is the steadiest window, in the middle of the flagged run
    expect(spans[0].steady).toBeGreaterThan(15);
    expect(spans[0].steady).toBeLessThan(35);
  });

  it('does not judge windows over an excluded span (a cut, a flash)', () => {
    const d = range(40, (i) => (i % 2 ? 6 : 10));
    expect(cadenceSpans(series(d), MOTION_THRESHOLDS, [[0, 40]])).toEqual([]);
  });

  describe('on a lossy file', () => {
    const lossy = { lossy: true };
    // a pan on ones (D 4) in one tile with the encoder's small rhythm on it, and the level step of
    // a flat area panning in (as h264_qsv made of a test pattern): where seven high frames are in
    // a window, one parity has four of them and the other three, and the medians of six fall on
    // either side of the step
    const step = range(80, (i) => (i < 46 ? 5.7 : 1.5) + (i % 2 ? 0.12 : -0.12));
    const pan = range(80, () => 4);
    const th = MOTION_THRESHOLDS;
    const flagged = (d: readonly number[]) => cadenceWindows(d, th.window).filter((w) => w.med >= th.motionFloor && w.r >= th.parity && w.a >= th.alternation && w.c >= th.consistency);

    it('takes a level step under the encoder rhythm for a cadence without, and for none with, the lossy rule', () => {
      expect(cadenceSpans(series(pan, { tile: { k: 1, d: step }, others: pan })).map((s) => s.sources)).toEqual([['r0c1']]);
      expect(cadenceSpans(series(pan, { tile: { k: 1, d: step }, others: pan }), th, [], lossy)).toEqual([]);
      // it is the halves that refuse it: one half of each window is all on one side of the step
      const halves = new Map(cadenceWindows(step, th.window >> 1).map((w) => [w.start, w]));
      const ws = flagged(step);
      expect(ws.length).toBeGreaterThan(0);
      for (const w of ws) expect(lossyEvidence(w, { d: step, dc: step.map((x) => 0.9 * x) }, halves), `window ${w.start}`).toBe(false);
      const judder = range(40, (i) => (i % 2 ? 6 : 10));
      const jh = new Map(cadenceWindows(judder, th.window >> 1).map((w) => [w.start, w]));
      expect(flagged(judder).every((w) => lossyEvidence(w, { d: judder, dc: judder.map((x) => 0.9 * x) }, jh))).toBe(true);
    });

    it('needs the alternation in what moves, not in the grain', () => {
      // a flat tile whose grain alternates with the frame types: DC is a third of D (grain averages out)
      const grain = range(80, (i) => (i % 2 ? 1.5 : 2.1));
      const s = series(pan, { tile: { k: 4, d: grain, dc: grain.map((x) => x / 3) }, others: pan });
      expect(cadenceSpans(s)).toHaveLength(1);
      expect(cadenceSpans(s, MOTION_THRESHOLDS, [], lossy)).toEqual([]);
    });

    it('counts a window only in a run of lossyRun windows in a row of its source', () => {
      // 60 frames of judder: the 48 windows from frame 1 on, all flagged, all in a row
      const judder = series(range(60, (i) => (i % 2 ? 6 : 10)));
      expect(cadenceSpans(judder, { ...th, lossyRun: 48 }, [], lossy)).toHaveLength(1);
      expect(cadenceSpans(judder, { ...th, lossyRun: 49 }, [], lossy)).toEqual([]);
      // an excluded span (a cut) breaks the run: windows 1-16 and 31-48 are left, 16 and 18 in a row
      expect(cadenceSpans(judder, { ...th, lossyRun: 17 }, [[28, 31]], lossy).map((s) => [s.start, s.end])).toEqual([[31, 60]]);
      expect(cadenceSpans(judder, { ...th, lossyRun: 3 }, [[28, 31]], lossy).map((s) => [s.start, s.end])).toEqual([[1, 60]]);
    });

    it('still flags a sustained judder, and a subject on twos in one tile', () => {
      const judder = range(60, (i) => (i % 2 ? 6 : 10));
      expect(cadenceSpans(series(judder), MOTION_THRESHOLDS, [], lossy)).toMatchObject([{ kind: 'judder', start: 1, end: 60 }]);
      const p = range(60, (i) => 5 + wobble(i, 0.2));
      const subject = range(60, (i) => (i % 2 ? 12 : 18));
      expect(cadenceSpans(series(p, { tile: { k: 6, d: subject }, others: p }), MOTION_THRESHOLDS, [], lossy).map((s) => s.sources)).toEqual([['r1c2']]);
    });

    it('says in the cadence check that the file was lossy and that tile-only spans may be the codec', () => {
      const p = range(60, (i) => 5 + wobble(i, 0.2));
      const subject = range(60, (i) => (i % 2 ? 12 : 18));
      const m = analyseMotion(series(p, { tile: { k: 6, d: subject }, others: p }), [], { lossy: true });
      expect(m.lossy).toBe(true);
      const [cadence] = motionChecks(m, 24, 'out/x.mp4');
      expect(cadence.detail).toMatch(/measured on out\/x\.mp4, a lossy file: .*3 windows in a row; 1 seen only in tiles may still come from the codec/);
      expect(motionChecks(analyseMotion(series(p, { tile: { k: 6, d: subject }, others: p }), []), 24, 'out/x.mkv')[0].detail).not.toMatch(/lossy/);
    });
  });
});

describe('flashes and pops', () => {
  const hits = (frame: number) => [{ id: 'boom', frame }];
  // a flicker: up at 30, down at 33
  const y = luma(80, (i) => (i >= 30 && i < 33 ? 95 : 50));

  it('reports a luma jump as one flash, intended when it starts on a hit', () => {
    expect(flashEvents(y, { hits: [], cuts: [] })).toEqual([{ frame: 30, end: 34, size: 45 }]);
    expect(flashEvents(y, { hits: hits(32), cuts: [] })[0].cue).toBe('boom');
    // three frames off the hit: not intended
    expect(flashEvents(y, { hits: hits(27), cuts: [] })[0].cue).toBeUndefined();
    // a cut is no flash; a small or a relative-only change neither
    expect(flashEvents(luma(80, (i) => (i >= 30 ? 95 : 50)), { hits: [], cuts: [30] })).toEqual([]);
    expect(flashEvents(luma(80, (i) => (i >= 30 ? 58 : 50)), { hits: [], cuts: [] })).toEqual([]);
    expect(flashEvents(luma(80, (i) => (i >= 30 ? 200 : 185)), { hits: [], cuts: [] })).toEqual([]);
  });

  it('reports a one-frame spike of D as a pop, and a glitch frame as one pop', () => {
    const none = { hits: [], cuts: [], flashes: [] };
    const d = range(80, (i) => (i === 40 ? 20 : 2 + wobble(i, 0.1)));
    expect(popEvents(d, none).map((p) => [p.frame, p.end])).toEqual([[40, 41]]);
    expect(popEvents(d, { ...none, hits: hits(41) })[0].cue).toBe('boom');
    expect(popEvents(d, { ...none, cuts: [{ id: 'cut-1', frame: 40 }] })[0].cue).toBe('cut-1');
    const glitch = range(80, (i) => (i === 40 || i === 41 ? 20 : 2));
    expect(popEvents(glitch, none).map((p) => [p.frame, p.end])).toEqual([[40, 42]]);
  });

  it('does not call a burst of motion or an animation on twos a pop', () => {
    const none = { hits: [], cuts: [], flashes: [] };
    // a light pulse over five frames
    const bump = range(80, (i) => [2, 4.5, 7.5, 9.5, 8, 4.5, 2][i - 37] ?? 2);
    expect(popEvents(bump, none)).toEqual([]);
    // a knock on twos: four equal steps with held frames between, after a hold
    const knock = range(80, (i) => (i >= 48 && i <= 54 && i % 2 === 0 ? 15 : 0.6));
    expect(popEvents(knock, none)).toEqual([]);
    expect(popEvents(range(80, (i) => (i % 2 ? 0.3 : 8)), none)).toEqual([]);
  });
});

describe('boil, the analysis and its checks', () => {
  it('reports the fine-detail change where the edge tiles are still', () => {
    const n = 80;
    const s = series(range(n, () => 0.3), { hf: range(n, (i) => (i < 40 ? 0.3 : 0.7)) });
    s.tiles = s.tiles.map(() => range(n, (i) => (i >= 50 ? 3 : 0.2)));
    expect(boilSpans(s)).toEqual([{ start: 1, end: 50, level: expect.closeTo((39 * 0.3 + 10 * 0.7) / 49, 6) }]);
  });

  it('builds information checks, a watch list, strips and the sheet', () => {
    const n = 120;
    const d = range(n, (i) => (i >= 20 && i < 70 ? (i % 2 ? 6 : 10) : 7 + wobble(i, 0.3)));
    const y = luma(n, (i) => (i === 90 ? 130 : 50));
    const cues: DeliveryCue[] = [{ id: 'boom', kind: 'hit', filmFrame: 100, frame: 100 }];
    const s = series(d, { y });
    const m = analyseMotion(s, cues);
    expect(m.cadence.map((c) => c.kind)).toEqual(['judder']);
    expect(m.flashes.map((f) => [f.frame, f.cue])).toEqual([[90, undefined]]);
    expect(m.watch.map((w) => w.what.split(' ')[0])).toEqual(['judder', 'flash:']);
    const checks = motionChecks(m, 24, 'x.mkv');
    expect(checks.map((c) => c.id)).toEqual(['motion.cadence', 'motion.flash', 'motion.pop', 'motion.boil', 'motion.watch']);
    expect(checks.every((c) => c.info && c.passed)).toBe(true);
    expect(checks[0].detail).toMatch(/1 judder span/);
    const plans = planStrips(m, n, 24);
    expect(plans.map((p) => p.file)).toEqual([`01-judder-f${String(m.cadence[0].steady).padStart(5, '0')}.png`, '02-flash-f00085.png']);
    expect(planStrips(m, n, 24, 1)).toHaveLength(1);
    const sheet = drawMotionSheet(s, m, cues);
    expect(sheet.rgb.length).toBe(sheet.width * sheet.height * 3);
    expect(sheet.labels.map((l) => l.text)).toContain('boom');
  });
});

describe('MotionMeter', () => {
  it('measures the luma, the difference per frame and per tile, and the fine detail', () => {
    const m = new MotionMeter(8, 6, 4, 3);
    const flat = new Uint8Array(48).fill(100);
    m.push(flat);
    m.push(flat);
    // one pixel brighter, in tile r1c2 (x 4-5, y 2-3)
    const dot = Uint8Array.from(flat);
    dot[2 * 8 + 4] = 190;
    m.push(dot);
    expect(m.y.slice(0, 2)).toEqual([100, 100]);
    expect(m.d).toEqual([0, 0, 90 / 48]);
    expect(m.tiles[6][2]).toBe(90 / 4);
    expect(m.tiles.filter((t) => t[2] > 0)).toHaveLength(1);
    // the dot is fine detail: H changes by 9·90 - 90 at the dot and -90 in its 8 neighbours, in ninths
    expect(m.hf[2]).toBeCloseTo((8 * 90 + 8 * 90) / 9 / 48, 6);
    // two 4x4 blocks (x 0-3 and 4-7, y 0-3; rows 4-5 make no whole block): the dot's moves by 90/16
    expect(m.dc[2]).toBeCloseTo(90 / 16 / 2, 6);
    // per tile: the blocks belong to the tiles of their centres (2,2) r1c1 and (6,2) r1c3; the dot's block is r1c3's only one
    expect(m.tilesDc[7][2]).toBeCloseTo(90 / 16, 6);
    expect(m.tilesDc.filter((t) => t[2] > 0)).toHaveLength(1);
    expect(m.tilesDc.every((t) => t.length === 3)).toBe(true);
    expect(analysisSize(1920, 1080)).toEqual({ width: 480, height: 270 });
    expect(analysisSize(320, 180)).toEqual({ width: 320, height: 180 });
  });

  it('estimates the decode from the pixels: about a second per second of a 1080p24 mezzanine', () => {
    const [lo, hi] = motionEstimateS(24, 1920, 1080, false);
    expect(lo).toBeGreaterThan(0.8);
    expect(lo).toBeLessThan(1);
    expect(hi).toBeCloseTo(3 * lo, 9);
    expect(motionEstimateS(24, 1920, 1080, true)[0]).toBeLessThan(lo);
  });
});

let repo: TempRepo;
beforeAll(() => {
  repo = tempRepo();
  mkdirSync(join(repo.root, 'out'), { recursive: true });
});
afterAll(() => repo?.cleanup());

/**
 * 3 s at 24 fps: a still test pattern panned 2 px per frame (a camera on ones) with a white
 * square crossing it, stepping on twos (`twos`) or on ones. Lossless (FFV1), or H.264 for a delivery.
 */
async function pan(name: string, o: { twos: boolean; h264?: boolean; seconds?: number }): Promise<string> {
  const out = join(repo.root, 'out', `${name}.${o.h264 ? 'mp4' : 'mkv'}`);
  const x = o.twos ? '40+floor(n/2)*8' : '40+n*4';
  const graph = `testsrc2=s=640x180:r=24:d=1,trim=end_frame=1,loop=loop=${24 * (o.seconds ?? 3)}:size=1,setpts=N/24/TB,crop=320:180:x='n*2':y=0[bg];color=c=white:s=40x40:r=24[sq];[bg][sq]overlay=x='${x}':y=70:shortest=1,format=yuv420p`;
  await ffmpeg(['-loglevel', 'error', '-f', 'lavfi', '-i', graph, '-frames:v', String(24 * (o.seconds ?? 3)), ...(o.h264 ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '12'] : ['-c:v', 'ffv1']), out], `make ${name}`);
  return out;
}

describe('motion QA on synthetic videos', () => {
  it('flags a subject on twos under a pan on ones, and not the same subject on ones', async () => {
    const judder = await measureMotion(await pan('judder', { twos: true }), { width: 320, height: 180, fps: 24 });
    expect(judder.d).toHaveLength(72);
    const flagged = analyseMotion(judder, []).cadence;
    expect(flagged.map((c) => c.kind)).toEqual(['judder']);
    expect(flagged[0].start).toBeLessThan(10);
    expect(flagged[0].end).toBeGreaterThan(60);
    const ones = await measureMotion(await pan('ones', { twos: false }), { width: 320, height: 180, fps: 24 });
    expect(analyseMotion(ones, []).cadence).toEqual([]);
  });

  // The lossy negative control: a grainy test pattern panned on ones, as a draft delivery encodes
  // it (libx264 crf 28 with its default B-frames; crf 30 with one). On this host's pinned ffmpeg
  // the plain rule flags judder in single tiles of both (1 and 2 spans; h264_qsv, the draft
  // preset, did the same in the calibration), the lossless source nothing.
  it('flags no cadence in a grainy pan on ones through a lossy draft encode', { timeout: 60_000 }, async () => {
    let plain = 0;
    for (const [px, seed, enc] of [
      [4, 604, ['-crf', '28']],
      [8, 608, ['-crf', '30', '-bf', '1']],
    ] as const) {
      const out = join(repo.root, 'out', `grain-pan-${px}.mp4`);
      const graph = `testsrc2=s=1920x360:r=24:d=1,trim=end_frame=1,loop=loop=144:size=1,setpts=N/24/TB,crop=640:360:x='n*${px}':y=0,noise=alls=6:allf=t:all_seed=${seed},format=yuv420p`;
      await ffmpeg(['-loglevel', 'error', '-f', 'lavfi', '-i', graph, '-frames:v', '144', '-c:v', 'libx264', ...enc, out], `make grain pan ${px}`);
      const s = await measureMotion(out, { width: 640, height: 360, fps: 24 });
      // it moves, over the motion floor where the pattern is detailed
      expect(Math.max(...s.tiles.map((t) => median(t.slice(1))))).toBeGreaterThan(MOTION_THRESHOLDS.motionFloor);
      plain += analyseMotion(s, []).cadence.length;
      expect(analyseMotion(s, [], { lossy: true }).cadence).toEqual([]);
    }
    // the control is not vacuous (a new ffmpeg or x264 that changes this: recalibrate it)
    expect(plain).toBeGreaterThan(0);
  });

  it('runQa measures the mezzanine when it matches, writes motion.png, motion.json and strips, and stays information', async () => {
    const mezz = await pan('mezz', { twos: true });
    const file = await pan('delivery', { twos: true, h264: true });
    const outDir = join(repo.root, 'out', 'qa-motion');
    const r = await runQa({ file, root: repo.root, expect: { width: 320, height: 180, fps: 24, frames: 72, audio: false }, contact: null, outDir, motion: { mezzanine: mezz } });
    const cadence = r.checks.find((c) => c.id === 'motion.cadence')!;
    expect(cadence.info).toBe(true);
    expect(cadence.detail).toMatch(/1 judder span.*measured on out\/mezz\.mkv/);
    expect(r.checks.filter((c) => c.id.startsWith('motion')).every((c) => c.info)).toBe(true);
    expect(existsSync(join(outDir, 'motion.png'))).toBe(true);
    expect(existsSync(join(outDir, 'motion.json'))).toBe(true);
    expect(readdirSync(join(outDir, 'strips'))).toEqual([expect.stringMatching(/^01-judder-f\d{5}\.png$/)]);
    // a mezzanine of another length is not the delivery's picture: the delivery is measured
    const short = await pan('short', { twos: true, seconds: 2 });
    const r2 = await runQa({ file, root: repo.root, expect: { width: 320, height: 180, fps: 24, audio: false }, contact: null, outDir, motion: { mezzanine: short } });
    expect(r2.checks.find((c) => c.id === 'motion.cadence')!.detail).toMatch(/1 judder span.*measured on out\/delivery\.mp4, a lossy file/);
    // --no-motion: the report says it was not analysed, and nothing is measured or written
    const skipDir = join(repo.root, 'out', 'qa-skip');
    const r3 = await runQa({ file, root: repo.root, expect: { width: 320, height: 180, fps: 24, audio: false }, contact: null, outDir: skipDir, motion: { skipped: '--no-motion' } });
    expect(r3.checks.filter((c) => c.id.startsWith('motion'))).toEqual([expect.objectContaining({ id: 'motion', info: true, detail: 'motion NOT analysed: --no-motion' })]);
    expect(existsSync(join(skipDir, 'motion.png'))).toBe(false);
  });
});
