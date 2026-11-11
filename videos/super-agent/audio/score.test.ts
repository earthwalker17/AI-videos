// The score's building blocks: its landmarks on the cue sheet, its sync with the picture's
// schedules (every sound on its contact frame), and its voices. The full render is exercised by
// `aiv audio super-agent --verify` (two fresh processes, identical bytes); its levels are in
// out/super-agent/audio/audio.json and the stage's log (index.ts prints the report).
import { describe, expect, it } from 'vitest';
import type { ScoreContext } from '@aiv/pipeline/audio';
import { peakOf, timeline, type Place, type StereoClip } from '@aiv/pipeline/audio/kit';
import { BEAT_5, BEAT_6, FIX_A, FIX_B, LAMP_VISITS, MT1, WARMTH, at, cues } from '../src/cues.ts';
import { FOLDERS, actOneAt } from '../src/desk/actOne.ts';
import { ACT_ONE_CAMERA, FOLDER_X, actOneFrameAt, flagSnaps, swings, warmthAt } from './actOne.ts';
import { ACT_ONE_MOVE, CAMERA_EASE, moveFraming } from '../src/desk/camera.ts';
import { arrange, marks } from './arrangement.ts';
import { BATCH_CHORDS, TAB_LANDS } from './keepUp.ts';
import { REPLY_FLIGHT } from './fixes.ts';
import { TESTS_DONE } from './levels.ts';
import { detent, gateClack, inkClick, inkSwell, paperFold, paperTear, paperThump, plateTap, pointerTick, printTap, ratchet, sandTrickle, sketchScratch, woodKnock, woodblockHop } from './foley.ts';
import { bowedNote, brightPluck, chirp, fallTone, feltPiano, fmMallet, hum, loupeBell, marimba, sineBass, smear, softPulse, woodTick } from './instruments.ts';

const SR = 48_000;
const ctx: ScoreContext = {
  sampleRate: SR,
  cues,
  fps: cues.fps,
  filmSamples: Math.round((cues.filmFrames * SR) / cues.fps),
  frameToSample: (f) => Math.round((f * SR) / cues.fps),
  library: () => {
    throw new Error('the score plays no samples');
  },
  seed: 12345,
};
const S = (frame: number) => ctx.frameToSample(frame);
const T = timeline(ctx);

describe('the score on the cue sheet', () => {
  it('reads its landmarks by cue id', () => {
    const m = marks(T);
    expect(m.hub).toBe(S(at(12)));
    expect(m.hush).toEqual([S(at(12, 4)), S(at(13))]);
    expect(m.split).toBe(S(at(13)));
    expect(m.question).toBe(S(at(18)));
    expect(m.breath).toEqual([S(at(18, 3)), S(at(19))]);
    expect(m.turn).toBe(S(at(19)));
    expect(m.stepDown).toBe(S(MT1.stampIn));
    expect(m.rest).toEqual([S(at(29, 2)), S(at(30))]);
    expect(m.intrusion).toEqual([S(at(63)), S(at(63, 3))]);
    expect(m.signoff).toEqual([S(at(69, 3)), S(at(70, 3.5))]);
    expect(m.tail).toEqual([S(at(84, 4)), S(cues.filmFrames)]);
    expect(m.bed).toBe(S(at(44)));
    expect(m.end).toBe(ctx.filmSamples);
  });
});

describe('act one follows the picture', () => {
  it('swings on LAMP_VISITS, frame for frame, and never after f870', () => {
    const sw = swings(T);
    expect(sw.map((s) => [s.frame, s.folder])).toEqual(LAMP_VISITS.map(([f, n]) => [f, n]));
    expect(sw.every((s) => s.at === S(s.frame))).toBe(true);
    expect(sw[sw.length - 1].frame).toBe(870);
    expect(new Set(sw.map((s) => s.step))).toEqual(new Set([1, 0.5, 0.25]));
  });

  it('pans by the folders the picture lays out (src/desk/actOne.ts FOLDERS)', () => {
    expect(FOLDER_X).toEqual(FOLDERS.map((fl) => fl.c[0]));
  });

  it('pans through act one’s camera as the picture moves it (src/desk/camera.ts ACT_ONE_MOVE on the camera token)', () => {
    const { from, to, a, b } = ACT_ONE_MOVE;
    expect([from, to]).toEqual([ACT_ONE_CAMERA.from, ACT_ONE_CAMERA.to]);
    expect([a.x, a.zoom, b.x, b.zoom]).toEqual([ACT_ONE_CAMERA.hook.x, ACT_ONE_CAMERA.hook.zoom, ACT_ONE_CAMERA.a.x, ACT_ONE_CAMERA.a.zoom]);
    const ease = CAMERA_EASE;
    for (let f = 0; f <= 400; f += 5) {
      const fr = f <= from ? a : f >= to ? b : moveFraming(ACT_ONE_MOVE, ease((f - from) / (to - from)));
      const got = actOneFrameAt(f);
      expect(got.x, `f${f}`).toBeCloseTo(fr.x, 3);
      expect(got.halfW, `f${f}`).toBeCloseTo(960 / fr.zoom, 3);
    }
  });

  it('lights each motif with the picture’s warmth, and sounds a falling tone where a flag snaps up', () => {
    for (let f = 0; f < 880; f += 3) {
      const st = actOneAt(f);
      for (const fl of FOLDERS) expect(warmthAt(fl.n, f)).toBeCloseTo(st.folders[fl.n - 1].warmth, 9);
    }
    // the picture's flags rising from tucked (between f and f + 1), before the hub and not on a folder's landing
    const rising: { f: number; n: number }[] = [];
    let prev = actOneAt(380);
    for (let f = 381; f < 870; f++) {
      const st = actOneAt(f);
      for (const fl of FOLDERS) if (prev.folders[fl.n - 1].flag === 0 && st.folders[fl.n - 1].flag > 0 && prev.folders[fl.n - 1].present) rising.push({ f: f - 1, n: fl.n });
      prev = st;
    }
    const snaps = flagSnaps(870);
    expect(snaps.length).toBeGreaterThan(0);
    expect(snaps.map((s) => ({ f: Math.floor(s.frame), n: s.folder }))).toEqual(rising);
    // and each lands where the warmth crosses the flag's threshold
    for (const s of snaps) expect(warmthAt(s.folder, s.frame)).toBeCloseTo(WARMTH.flagUp, 9);
  });
});

/** A placement as the recorder saw it. */
interface Placed {
  at: number;
  part: string;
  bus: string;
  len: number;
  until?: number;
  sum: number;
}
function record(): Placed[] {
  const calls: Placed[] = [];
  arrange(T, {
    add(at: number, clip: Float32Array | StereoClip, p: Place) {
      const l = clip instanceof Float32Array ? clip : clip.l;
      let sum = 0;
      for (let i = 0; i < l.length; i += 97) sum += l[i] * ((i % 7) + 1);
      calls.push({ at, part: p.part, bus: p.bus, len: l.length, ...(p.until !== undefined ? { until: p.until } : {}), sum });
    },
  });
  return calls;
}

describe('every sound on its contact frame', () => {
  const placed = record();
  const partsAt = (s: number) => placed.filter((p) => p.at === s).map((p) => p.part);
  const has = (part: string, s: number) => placed.some((p) => p.part === part && p.at === s);

  it('places a sound on every hit in bars 1-43, and on the marks with a picture event', () => {
    const hits = cues.events.filter((e) => e.kind === 'hit' && e.frame < at(44));
    expect(hits.length).toBeGreaterThan(15);
    for (const e of hits) expect(partsAt(S(e.frame)), e.id).not.toEqual([]);
    const marked = ['fix-a', 'fix-b', 'fix-b-break', 'trait-continuous', 'thread-row', 'gauge', 'ghost-router', 'arm-tests', 'arm-docs', 'report-up', 'stamp-in', 'reply-lands', 'dispatch-fresh', 'key-dock', 'plate-proactive', 'spike-in', 'cache-eject', 'review-card', 'review-in', 'hop-1', 'hop-2', 'hop-3', 'recall-answer', 'flyover', 'intrusion', 'stamp', 'bookend'];
    for (const id of marked) expect(partsAt(T.cue(id)), id).not.toEqual([]);
  });

  it('taps a woodblock on every swing of your lamp but the one that began before the film', () => {
    expect(placed.filter((p) => p.part === 'hop').map((p) => p.at)).toEqual(LAMP_VISITS.slice(1).map(([f]) => S(f)));
  });

  it('follows the schedules: Fix A’s steps, Fix B’s replies, the gate’s slips, the batches, the cache', () => {
    const m = marks(T);
    for (const f of FIX_A.steps) expect(has('plod', S(f)), `plod f${f}`).toBe(S(f) < m.question);
    [...FIX_B.replies, FIX_B.reply7].forEach((f) => {
      expect(has('stubs', S(f)), `stub f${f}`).toBe(true);
      expect(has('replies', S(f + REPLY_FLIGHT)), `reply f${f + REPLY_FLIGHT}`).toBe(true);
    });
    for (const { f, keep } of BEAT_5.slips) {
      expect(has('clack', S(f + BEAT_5.impale)), `clack f${f}`).toBe(!keep);
      expect(has('bell', S(f + BEAT_5.notchAfter)), `bell f${f}`).toBe(keep);
    }
    BEAT_6.batches.forEach(({ sweep, slips }, b) => {
      for (const s of slips) expect(has('held-tick', S(s)), `held tick f${s}`).toBe(true);
      // the chord is thicker for the longer strip: more notes, and mallets on its top
      const chord = placed.filter((p) => p.part === 'batch' && p.at >= S(sweep) && p.at < S(sweep) + T.s(0.03));
      expect(chord.length).toBe(BATCH_CHORDS[b].length * 2 + (b === 1 ? 3 : 0));
      expect(Math.min(...chord.map((p) => p.at))).toBe(S(sweep));
      expect(placed.filter((p) => p.part === 'held-tone' && p.at >= S(slips[0]) && p.at < S(sweep)).length).toBe(slips.length);
    });
    expect(has('pointer', S(BEAT_6.cacheFold + TAB_LANDS))).toBe(true);
    expect(placed.filter((p) => p.part === 'hop-note').map((p) => p.at)).toEqual(BEAT_6.recall.hops.map(S));
  });

  it('keeps the rests and silences: nothing starts in a silence, and only their own quiet sounds in a rest', () => {
    for (const [a, b] of T.silences) expect(placed.filter((p) => p.at >= a && p.at < b)).toEqual([]);
    const inSpan = (id: string) => {
      const [a, b] = T.span(id);
      return [...new Set(placed.filter((p) => p.at >= a && p.at < b).map((p) => p.part))].sort();
    };
    expect(inSpan('rest-breath')).toEqual([]);
    expect(inSpan('rest-model')).toEqual(['rest-pluck']);
    expect(inSpan('rest-signoff')).toEqual(['pad']);
    expect(inSpan('rest-tail')).toEqual([]);
    // the fresh bay rises inside the rest: its pluck, no knock
    expect(partsAt(S(MT1.dispatchFresh))).toEqual(['rest-pluck']);
  });

  it('lets the tests voice stop as its lamps go out, and gives the Router’s tick on 2 and 4 from bar 21', () => {
    const testsDone = T.beat(TESTS_DONE.bar, TESTS_DONE.beat);
    const workers = placed.filter((p) => p.part === 'workers');
    expect(workers.length).toBeGreaterThan(20);
    expect(workers.every((p) => p.at < marks(T).rest[0] - T.beats(1) + 1)).toBe(true);
    const ticks = placed.filter((p) => p.part === 'ticks').map((p) => p.at);
    expect(ticks[0]).toBe(T.beat(21, 2));
    expect(ticks).toContain(S(BEAT_6.recall.stampIn) - T.beats(2));
    expect(ticks).not.toContain(S(BEAT_6.recall.stampIn));
    expect(testsDone).toBe(S(2140));
  });

  it('is the same placement, clip for clip, every time', () => {
    expect(record()).toEqual(placed);
  }, 180_000);
});

describe('the voices', () => {
  const seed = 7;
  const mono: [string, () => Float32Array, number][] = [
    ['fmMallet', () => fmMallet(69, { vel: 0.8 }), 0.8],
    ['fmMallet with a droop', () => fmMallet(77, { vel: 0.5, droop: 40, droopTime: 0.6, tau: 0.28 }), 0.5],
    ['marimba', () => marimba(62, { seed, k: 1, vel: 0.7, cents: 12 }), 0.7],
    ['feltPiano', () => feltPiano(38, { seed, k: 1, vel: 0.75, hold: 1 }), 0.75],
    ['sineBass', () => sineBass(38, { len: 1, vel: 0.9 }), 0.9],
    ['woodTick', () => woodTick(1250, { seed, k: 1 }), 0.7],
    ['brightPluck', () => brightPluck(81, { seed, k: 1 }), 0.7],
    ['smear', () => smear(51, 50, { len: 0.55, glide: 0.35 }), 0.7],
    ['smear, held', () => smear(60, 59, { len: 2.5, glide: 0.4, vel: 0.6, attack: 0.3, release: 0.67 }), 0.6],
    ['chirp', () => chirp({ f0: 1500, f1: 2200, len: 0.06 }), 0.6],
    ['fallTone', () => fallTone(74), 0.6],
    ['hum', () => hum(38, { len: 4.7, attack: 0.25 }), 0.7],
    ['softPulse', () => softPulse(62, { vel: 0.6 }), 0.6],
    ['loupeBell', () => loupeBell(81, { vel: 0.55 }), 0.55],
    ['woodblockHop', () => woodblockHop(seed, 1), 1],
    ['sketchScratch', () => sketchScratch(seed, { len: 0.3 }), 1],
    ['sketchScratch, dry', () => sketchScratch(seed, { len: 0.22, k: 2, dry: true }), 1],
    ['inkClick', () => inkClick(seed, 1), 1],
    ['paperThump', () => paperThump(seed), 1],
    ['woodKnock', () => woodKnock(seed, 1), 1],
    ['sandTrickle', () => sandTrickle(seed, { len: 1.1 }), 1],
    ['paperTear', () => paperTear(seed), 1],
    ['plateTap', () => plateTap(seed, 0), 1],
    ['printTap', () => printTap(seed, 0), 1],
    ['gateClack', () => gateClack(seed, 3), 1],
    ['detent', () => detent(seed, 0), 1],
    ['paperFold', () => paperFold(seed), 1],
    ['pointerTick', () => pointerTick(seed, 0), 1],
    ['ratchet', () => ratchet(seed, { len: 0.8 }), 1],
  ];
  it.each(mono)('%s is finite, peaks at its velocity and is the same every time', (_, make, vel) => {
    const a = make();
    expect(a.every((x) => Number.isFinite(x))).toBe(true);
    expect(peakOf(a)).toBeCloseTo(vel, 5);
    expect(make()).toEqual(a);
  });

  it('starts the ratchet on its hit: its first click within 2 ms of the clip’s start', () => {
    const r = ratchet(seed, { len: 0.8 });
    const first = r.findIndex((x) => Math.abs(x) > 0.05 * peakOf(r));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first / 48000).toBeLessThan(0.002);
  });

  it('keeps the sketch’s smear when no attack or release is given', () => {
    expect(smear(51, 50, { len: 0.55, glide: 0.35, vel: 0.7, attack: 0.07, release: 0.18 })).toEqual(smear(51, 50, { len: 0.55, glide: 0.35, vel: 0.7 }));
  });

  it('a bowed note keeps its fixed scale whatever its pitch; the ink swell is a stereo spread', () => {
    for (const midi of [50, 66]) {
      const a = bowedNote(midi, { seed, k: midi, len: 2.5, attack: 0.8, release: 0.6 });
      expect(a.every((x) => Number.isFinite(x))).toBe(true);
      expect(peakOf(a)).toBeGreaterThan(0.5);
      expect(peakOf(a)).toBeLessThan(1.4);
      expect(bowedNote(midi, { seed, k: midi, len: 2.5, attack: 0.8, release: 0.6 })).toEqual(a);
    }
    const swell = inkSwell(seed, { len: 1 });
    expect(Math.max(peakOf(swell.l), peakOf(swell.r))).toBeCloseTo(1, 5);
    expect(swell.l).not.toEqual(swell.r);
  });
});
