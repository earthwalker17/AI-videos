// SPDX-License-Identifier: MIT
// Promoted from videos/super-agent/src/kit (tag video/super-agent/v2): the generic helpers of time.ts
// (a line's entrance state stays with the film, beside its cue sheet).
/**
 * Time on a frame grid: progress windows in frames. Everything takes the (fractional) frame and
 * returns a value: nothing here keeps state.
 */
import { clamp, easings, type Easing } from '@aiv/core';

/** Eased progress of `f` from frame `from` (0) to frame `to` (1), held at both ends. */
export const prog = (f: number, from: number, to: number, ease: Easing = easings.inOutCubic): number => ease(clamp((f - from) / (to - from)));

/** 0 outside [from, to], 1 inside, with soft edges of `rise` and `fall` frames. */
export const gate = (f: number, from: number, to: number, rise = 12, fall = rise): number => clamp((f - from) / rise) * clamp((to - f) / fall);

/** A smooth bump: 0 at `from`, 1 at `peak`, 0 at `to`. */
export const bump = (f: number, from: number, peak: number, to: number): number => (f <= peak ? easings.outCubic(clamp((f - from) / (peak - from))) : 1 - easings.inOutCubic(clamp((f - peak) / (to - peak))));

/** Critically damped approach to 1: fast start, no overshoot. `t` in frames, `tau` its time constant. */
export const settle = (t: number, tau: number): number => (t <= 0 ? 0 : 1 - (1 + t / tau) * Math.exp(-t / tau));

/**
 * Sub-frame instants for a frame: `n` instants spread over the open shutter, centred on frame `i`
 * (`shutter` is a fraction of a frame: 0.5 is a 180-degree shutter). One sub-frame is the frame's
 * own instant. The stage averages what is drawn at each (motion blur).
 */
export function subframes(i: number, n: number, shutter: number): number[] {
  const k = Math.max(1, Math.floor(n));
  if (k === 1) return [i];
  return Array.from({ length: k }, (_, s) => i + ((s + 0.5) / k - 0.5) * shutter);
}
