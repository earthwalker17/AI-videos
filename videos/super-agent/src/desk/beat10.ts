/**
 * Beat 10 (STORYBOARD 10.1-10.3, film f4960-5439; cues.ts BEAT_10): still open, and bar 68's handshake, whose stillness
 * holds the seam into the summary's world (summary.ts SEAM_D). The beats 9-10 lane's module: its state and the hooks the
 * shared files compose from it, as beat7.ts describes them, plus `pins10` (objects/Beat10.tsx draws it). A stub until
 * the lane builds it: every hook adds nothing. Import rule as beat7.ts's: module-level tables from leaf modules only.
 */
import type { CardUp } from './beat4.ts';
import type { Footprint } from './fpKit.ts';
import type { Pool } from './layout.ts';
import type { TagSpec } from './Overlay.tsx';
import type { ArmStep, DeskState, FocusEntry, LampStep, ReplyState } from './state.ts';
import type { YouPose } from './you.ts';

/** Whether beat 10 is built (false: the animatic's slate shows its cues' words and the "animatic" mark over its frames). */
export const BUILT = false;

/** Beat 10's state at a film frame (the lane defines it). */
export interface Beat10State {
  f: number;
}
/** DeskState.e10: null outside the beat's life. */
export function beat10At(_f: number): Beat10State | null {
  return null;
}

export const FOCUS_10: readonly FocusEntry[] = [];
export const LAMP_10: readonly LampStep[] = [];
export const ARM_10: readonly ArmStep[] = [];
export function replies10(_e: Beat10State | null): ReplyState[] {
  return [];
}
/**
 * The bug bay's six pins (0 graphite face up .. 1 enamel face up): state.ts gives the cycling ones (one flips per beat
 * from f2120); from where bar 68 says, this gives them instead (they stop cycling, rise through all six, hold).
 */
export function pins10(_f: number, pins: number[]): number[] {
  return pins;
}
export function cards10(_s: DeskState): CardUp[] {
  return [];
}
export function footprints10(_s: DeskState): Footprint[] {
  return [];
}
export function pools10(_s: DeskState): Pool[] {
  return [];
}
export const TAGS_10: readonly TagSpec[] = [];
export function you10(_f: number, pose: YouPose): YouPose {
  return pose;
}
