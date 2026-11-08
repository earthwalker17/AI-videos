/**
 * Frame arithmetic on a musical grid, progress windows and their combinators, and the named
 * easings of the motion grammar. Every function is pure: a value at frame f depends on f alone, so
 * any frame renders the same whichever frame its page started on. The kit imports nothing from a
 * film: the grid is an argument.
 */
import { clamp, easings, progress, type Easing, type EasingName } from '@aiv/core';
import { spring } from 'remotion';

/** A tempo grid: frames per second, beats per minute, beats per bar, and where bar 1 starts. */
export interface Grid {
  fps: number;
  bpm: number;
  beatsPerBar: number;
  /** the frame where bar 1 starts (default 0) */
  offsetFrames?: number;
}

/** Frames per beat (20 at 30 fps and 90 bpm). */
export const beatFrames = (g: Grid): number => (g.fps * 60) / g.bpm;
/** Frames per bar (80 at 30 fps, 90 bpm, 4/4). */
export const barFrames = (g: Grid): number => beatFrames(g) * g.beatsPerBar;

/** The frame where bar `n` (1-based) beat `b` (1-based, fractions allowed) starts, rounded to a whole frame. */
export const barBeat = (g: Grid, n: number, b = 1): number => Math.round((g.offsetFrames ?? 0) + (n - 1) * barFrames(g) + (b - 1) * beatFrames(g));

/** Where frame `f` sits on the grid: 1-based bar and beat, and how far into that beat (0..1). */
export function gridPosition(g: Grid, f: number): { bar: number; beat: number; phase: number } {
  const t = (f - (g.offsetFrames ?? 0)) / beatFrames(g);
  const i = Math.floor(t);
  const beat = ((i % g.beatsPerBar) + g.beatsPerBar) % g.beatsPerBar;
  return { bar: Math.floor(i / g.beatsPerBar) + 1, beat: beat + 1, phase: t - i };
}

/** The first frame at or after `f` that starts a step of `division` per beat (1 beats, 2 eighths, 4 sixteenths). */
export function nextOnGrid(g: Grid, f: number, division = 2): number {
  const step = beatFrames(g) / division;
  const off = g.offsetFrames ?? 0;
  return Math.round(off + Math.ceil((f - off) / step - 1e-9) * step);
}

/** A window of the timeline: it runs from `start` for `dur` frames, shaped by `ease`. */
export interface Window {
  start: number;
  dur: number;
  ease?: Easing | EasingName;
}

export const win = (start: number, dur: number, ease?: Easing | EasingName): Window => (ease === undefined ? { start, dur } : { start, dur, ease });

/** The frame a window ends on (exclusive of nothing: progress is 1 from here). */
export const endOf = (w: Window): number => w.start + w.dur;

/** The eased progress of frame `f` through `w`: 0 before it, 1 after it. A zero-length window is a step. */
export function prog(f: number, w: Window): number {
  if (w.dur <= 0) return f >= w.start ? 1 : 0;
  return progress(f, w.start, w.start + w.dur, w.ease ?? 'linear');
}

/** The same window, `frames` later. */
export const delay = (w: Window, frames: number): Window => ({ ...w, start: w.start + frames });

/** A window that starts when `w` ends (plus a gap). */
export const after = (w: Window, dur: number, ease?: Easing | EasingName, gap = 0): Window => win(endOf(w) + gap, dur, ease);

/** Windows laid end to end from `start`: each part is a duration, or a duration and an easing. */
export function seq(start: number, parts: readonly (number | readonly [number, Easing | EasingName])[], gap = 0): Window[] {
  const out: Window[] = [];
  let t = start;
  for (const p of parts) {
    const [dur, ease] = typeof p === 'number' ? [p, undefined] : p;
    out.push(win(t, dur, ease));
    t += dur + gap;
  }
  return out;
}

/** `n` windows that run together. */
export const all = (start: number, dur: number, n: number, ease?: Easing | EasingName): Window[] => Array.from({ length: n }, () => win(start, dur, ease));

/** `n` windows of the same length, each starting `lag` frames after the one before. */
export const lagged = (start: number, dur: number, n: number, lag: number, ease?: Easing | EasingName): Window[] =>
  Array.from({ length: n }, (_, i) => win(start + i * lag, dur, ease));

/** The window that spans a group (from the earliest start to the latest end). */
export function spanOf(ws: readonly Window[]): Window {
  if (ws.length === 0) throw new Error('spanOf: no windows');
  const start = Math.min(...ws.map((w) => w.start));
  return win(start, Math.max(...ws.map(endOf)) - start);
}

/** Rises through `inW`, holds at 1, falls through `outW`: an envelope for something shown for a while. */
export const envelope = (f: number, inW: Window, outW: Window): number => Math.min(prog(f, inW), 1 - prog(f, outW));

/** The motion grammar's named easings (all with f(0) = 0 and f(1) = 1). */
export const EASE = {
  /** camera moves and structural changes */
  cubicInOut: easings.inOutCubic,
  /** arrivals that settle: fast, then gently home */
  expoOut: easings.outExpo,
  /** token hops, station to station */
  sineInOut: easings.inOutSine,
  outCubic: easings.outCubic,
  linear: easings.linear,
} as const satisfies Record<string, Easing>;

/**
 * A critically damped spring (damping = 2·sqrt(stiffness·mass): no overshoot, no bounce) that
 * settles in `frames` frames, as an easing on [0, 1]. Remotion's spring is a pure function of the
 * frame; stretched to `frames` it ends within its rest threshold of 1, and the easing returns
 * exactly 1 from t = 1 on.
 */
export function criticalSpring(fps: number, frames: number, stiffness = 100, mass = 1): Easing {
  const config = { stiffness, mass, damping: 2 * Math.sqrt(stiffness * mass), overshootClamping: true };
  return (t: number) => {
    const x = clamp(t);
    if (x >= 1) return 1;
    return spring({ frame: x * frames, fps, durationInFrames: frames, config });
  };
}
