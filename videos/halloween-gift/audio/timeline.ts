/**
 * Where the score's sounds go, in samples, from the cue sheet the stage hands the score
 * (ctx.cues) and the bar grid of src/cues.ts. A beat is 24 000 samples (120 bpm at 48 kHz), a
 * frame 2 000, so every frame-aligned position is exact.
 */
import type { ScoreContext } from '@aiv/pipeline/audio';
import { BEAT, BEATS_PER_BAR, BPM, at } from '../src/cues.ts';
import { SR } from './dsp.ts';

export interface Timeline {
  ctx: ScoreContext;
  /** samples in the film */
  n: number;
  /** the sample of bar `bar` (1-based) beat `b` (1-based, any fraction): exact, not frame-rounded */
  beat(bar: number, b?: number): number;
  /** the first sample of a film frame */
  frame(f: number): number;
  /** the sample of a cue by id (throws on an unknown id) */
  cue(id: string): number;
  /** a span cue's [start, end) in samples */
  span(id: string): [number, number];
  /** seconds → samples */
  s(t: number): number;
  /** the digital silences: [start, end) in samples, in time order */
  silences: [number, number][];
  /** the hard stop: the music cuts on bar 17's downbeat (the knock) */
  hardStop: number;
  /** cut points per bus: a clip never sounds past the next cut after its onset */
  cuts: { music: number[]; sfx: number[]; hall: number[]; room: number[] };
}

/** Samples per beat: exactly 24 000. */
export const BEAT_SAMPLES = (60 / BPM) * SR;

export function timeline(ctx: ScoreContext): Timeline {
  const ev = ctx.cues.events;
  const find = (id: string) => {
    const e = ev.find((x) => x.id === id);
    if (!e) throw new Error(`the score needs cue '${id}', which src/cues.ts does not have`);
    return e;
  };
  const frame = (f: number) => ctx.frameToSample(f);
  const silences = ev
    .filter((e) => e.kind === 'silence' && e.end !== undefined)
    .map((e) => [frame(e.frame), frame(e.end!)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const hardStop = frame(find('knock-1').frame);
  const starts = silences.map((s) => s[0]);
  const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);
  return {
    ctx,
    n: ctx.filmSamples,
    beat: (bar, b = 1) => Math.round(((bar - 1) * BEATS_PER_BAR + (b - 1)) * BEAT_SAMPLES),
    frame,
    cue: (id) => frame(find(id).frame),
    span: (id) => {
      const e = find(id);
      return [frame(e.frame), frame(e.end ?? e.frame)];
    },
    s: (t) => Math.round(t * SR),
    silences,
    hardStop,
    cuts: {
      music: uniq([hardStop, ...starts]),
      sfx: uniq(starts),
      hall: uniq([hardStop, ...starts]),
      room: uniq(starts),
    },
  };
}

/**
 * Clawd's footfalls, from the walks blocked in src/film/actors.ts (repeated here: a score may
 * not import picture code): a walk from frame a to b lands a foot every beat after a, and once
 * more on arrival. Change them together.
 */
export const WALKS: readonly (readonly [number, number])[] = [
  [at(8, 2), at(9) + 8],
  [at(9) + 18, at(11, 1)],
  [at(11, 3) + 6, at(13) + 16],
  [at(14) + 8, at(16, 3)],
  [at(33, 2), at(34, 3)],
];

/** Every footfall: its frame, which walk it belongs to, and how far along that walk (0..1). */
export function footfalls(): { frame: number; walk: number; u: number }[] {
  const out: { frame: number; walk: number; u: number }[] = [];
  WALKS.forEach(([a, b], walk) => {
    for (let f = a + BEAT; f < b; f += BEAT) out.push({ frame: f, walk, u: (f - a) / (b - a) });
    out.push({ frame: b, walk, u: 1 });
  });
  return out;
}
