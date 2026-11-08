/**
 * Where a score's sounds go, in samples, from the cue sheet the stage hands it (ctx.cues): its
 * bar grid (bpm, beats per bar and offsetFrames, the film frame of bar 1 beat 1), its cues and
 * its silences. It reads only the context, never a video's files, so any score can use it.
 *
 * A grid position is exact in samples (rounded once, from the grid's own origin), not rounded to
 * a frame first: at 90 bpm and 30 fps a beat is 20 frames and 32 000 samples, so every beat
 * that falls on a frame is also exactly that frame's first sample.
 */
import type { CueEvent, CueKind } from '@aiv/core';
import type { ScoreContext } from '../types.ts';
import { SR } from './dsp.ts';

export interface Timeline {
  ctx: ScoreContext;
  /** samples in the film */
  n: number;
  /** the grid; null when the cue sheet has none (then bar and beat helpers throw) */
  grid: { bpm: number; beatsPerBar: number; offsetFrames: number } | null;
  /** samples per beat (60 · SR / bpm; may be fractional) */
  beatSamples: number;
  /** the sample of bar `bar` (1-based) beat `b` (1-based, any fraction): exact, not frame-rounded */
  beat(bar: number, b?: number): number;
  /** the film frame where bar `bar` beat `b` starts (rounded to the nearest frame) */
  beatFrame(bar: number, b?: number): number;
  /** the length of `count` beats in samples (rounded): a tempo-synced time, e.g. beats(0.5) for an eighth */
  beats(count: number): number;
  /** the bar (1-based) and beat (1-based, fractional) a sample falls in */
  position(sample: number): { bar: number; beat: number };
  /** the first sample of a film frame */
  frame(f: number): number;
  /** seconds → samples (rounded) */
  s(t: number): number;
  /** a cue by id (throws on an unknown id) */
  event(id: string): CueEvent;
  /** the first sample of a cue by id */
  cue(id: string): number;
  /** a span cue's [start, end) in samples (a point cue: [start, start]) */
  span(id: string): [number, number];
  /** every span cue of a kind as [start, end) in samples, in time order */
  spans(kind: CueKind): [number, number][];
  /** the digital silences: [start, end) in samples, in time order */
  silences: [number, number][];
  /**
   * Cut points for a bus: the start of every digital silence plus `extra` (samples), sorted and
   * unique. A mixer bus truncates a clip at its next cut, so nothing sounds into a silence.
   */
  cuts(...extra: number[]): number[];
}

export function timeline(ctx: ScoreContext): Timeline {
  const ev = ctx.cues.events;
  const grid = ctx.cues.grid ? { bpm: ctx.cues.grid.bpm, beatsPerBar: ctx.cues.grid.beatsPerBar, offsetFrames: ctx.cues.grid.offsetFrames ?? 0 } : null;
  const need = () => {
    if (!grid) throw new Error('the score needs a bar grid, and src/cues.ts has none (cues.grid)');
    return grid;
  };
  const beatSamples = grid ? (60 * SR) / grid.bpm : NaN;
  const framesPerBeat = grid ? (60 * ctx.fps) / grid.bpm : NaN;
  /** beats from bar 1 beat 1 */
  const beatsAt = (bar: number, b: number) => (bar - 1) * need().beatsPerBar + (b - 1);
  const frame = (f: number) => ctx.frameToSample(f);
  const find = (id: string) => {
    const e = ev.find((x) => x.id === id);
    if (!e) throw new Error(`the score needs cue '${id}', which src/cues.ts does not have`);
    return e;
  };
  const spans = (kind: CueKind) =>
    ev
      .filter((e) => e.kind === kind && e.end !== undefined)
      .map((e) => [frame(e.frame), frame(e.end!)] as [number, number])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const silences = spans('silence');
  return {
    ctx,
    n: ctx.filmSamples,
    grid,
    beatSamples,
    beat: (bar, b = 1) => frame(need().offsetFrames) + Math.round(beatsAt(bar, b) * beatSamples),
    beatFrame: (bar, b = 1) => need().offsetFrames + Math.round(beatsAt(bar, b) * framesPerBeat),
    beats: (count) => (need(), Math.round(count * beatSamples)),
    position: (sample) => {
      const g = need();
      const beats = (sample - frame(g.offsetFrames)) / beatSamples;
      const bar = Math.floor(beats / g.beatsPerBar);
      return { bar: bar + 1, beat: beats - bar * g.beatsPerBar + 1 };
    },
    frame,
    s: (t) => Math.round(t * SR),
    event: find,
    cue: (id) => frame(find(id).frame),
    span: (id) => {
      const e = find(id);
      return [frame(e.frame), frame(e.end ?? e.frame)];
    },
    spans,
    silences,
    cuts: (...extra) => [...new Set([...silences.map((s) => s[0]), ...extra])].sort((a, b) => a - b),
  };
}
