/**
 * Time on the film's grid: progress windows in frames, and the entrance and exit state of a line
 * of type from the cue sheet. Everything takes the (fractional) film frame and returns a value:
 * nothing here keeps state.
 */
import { clamp, easings, type Easing } from '@aiv/core';
import { line, type Line } from '../cues.ts';

/** Eased progress of `f` from frame `from` (0) to frame `to` (1), held at both ends. */
export const prog = (f: number, from: number, to: number, ease: Easing = easings.inOutCubic): number => ease(clamp((f - from) / (to - from)));

/** 0 outside [from, to], 1 inside, with soft edges of `rise` and `fall` frames. */
export const gate = (f: number, from: number, to: number, rise = 12, fall = rise): number => clamp((f - from) / rise) * clamp((to - f) / fall);

/** A smooth bump: 0 at `from`, 1 at `peak`, 0 at `to`. */
export const bump = (f: number, from: number, peak: number, to: number): number => (f <= peak ? easings.outCubic(clamp((f - from) / (peak - from))) : 1 - easings.inOutCubic(clamp((f - peak) / (to - peak))));

/** Frames a line takes to arrive and to leave. Entrances END on the cue's frame. */
export const TEXT_IN = 20;
export const TEXT_OUT = 12;

export interface LineState {
  l: Line;
  /** 0..1 entrance and exit progress */
  enter: number;
  exit: number;
  /** true while any part of the line is on screen */
  on: boolean;
}

export function lineState(id: string, f: number): LineState {
  const l = line(id);
  const enter = clamp((f - (l.frame - TEXT_IN)) / TEXT_IN);
  const exit = clamp((f - l.end) / TEXT_OUT);
  return { l, enter, exit, on: enter > 0 && exit < 1 };
}

/** Critically damped approach to 1: fast start, no overshoot. `t` in frames, `tau` its time constant. */
export const settle = (t: number, tau: number): number => (t <= 0 ? 0 : 1 - (1 + t / tau) * Math.exp(-t / tau));
