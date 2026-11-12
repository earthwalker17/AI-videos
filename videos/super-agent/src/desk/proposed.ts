/**
 * Beats 9-10's shared tables (a leaf module: it imports only the cue sheet and the core), so beat9.ts and beat10.ts, which
 * state.ts imports, can each build their module-level tables from it without meeting each other in an import cycle.
 * Still (d)'s layout (summary.ts) is restated here where a table needs it; beat9.test.ts holds the copies equal.
 */
import { clamp, easings } from '@aiv/core';
import { BEAT_10 } from '../cues.ts';
import type { P2 } from './layout.ts';

export const sine = (t: number): number => easings.inOutSine(clamp(t)) + 0;
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** A run 0..1 over t 0..1 at a trapezoid of speed: up over `a`, even, down over `d` (beat7.ts's). */
export function trapezoid(t: number, a: number, d: number): number {
  const x = clamp(t);
  const v = 1 / (1 - a / 2 - d / 2);
  if (x < a) return (v * x * x) / (2 * a);
  if (x <= 1 - d) return v * (a / 2 + (x - a));
  const r = 1 - x;
  return 1 - (v * r * r) / (2 * d);
}

/** Where the summary's world takes over (summary.ts SEAM_D): act two draws beats 9-10 up to the frame before it. */
export const SEAM = 5424;
/** Bar 65's dolly onto the Register sets out on at(65) (camera.ts TO_REGISTER): beat 9's hold on the system ramps out 14 f before it. */
export const RELEASE = 5106;
/** Still (d)'s machines (summary.ts MACHINES), north to south: their bases and heights. */
export const MACHINES_9: readonly { kind: 'server' | 'workstation' | 'laptop'; c: P2; w: number; d: number; h: number }[] = [
  { kind: 'server', c: [1250, 222], w: 150, d: 92, h: 44 },
  { kind: 'workstation', c: [1280, 92], w: 64, d: 118, h: 112 },
  { kind: 'laptop', c: [1240, -44], w: 150, d: 100, h: 13 },
];
/** Still (d)'s loop sheet (summary.ts VELLUM.loop). */
export const LOOP_SHEET = { x0: 760, x1: 990, y0: -86, y1: 286 } as const;
/** Each clip's centre x (summary.ts clipC: 36 u west of its machine's west face). */
export const clipX = (i: number): number => MACHINES_9[i]!.c[0] - MACHINES_9[i]!.w / 2 - 36;

/**
 * The etch (10.1, beat10.ts): along each tether from the loop's port to its machine, arriving on BEAT_10.etch[i] (one
 * machine per beat), each run `run` frames; the loop's sheet and the plan of the deck are etched from the intrusion; it
 * recedes from `recede` (the sheets first, then each tether from its port out), all of it gone by `gone`.
 */
export const ETCH = { run: 16, sheets: [BEAT_10.hatch.register, BEAT_10.hatch.register + 18] as const, recede: BEAT_10.etch[2] + 4, recedeRun: 14, gone: BEAT_10.query + 12 } as const;
