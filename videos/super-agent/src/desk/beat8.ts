/**
 * Beat 8 (STORYBOARD 8.1-8.5, film f3920-4559; cues.ts BEAT_8): many runs, the evidence (the test sheet east of the
 * bays, camera.ts FRAMING_SHEET, TO_SHEET). The beat-8 lane's module: its state and the hooks the shared files compose
 * from it, as beat7.ts describes them (objects/Beat8.tsx draws it). A stub until the lane builds it: every hook adds
 * nothing. Import rule as beat7.ts's: module-level tables from leaf modules only.
 */
import type { CardUp } from './beat4.ts';
import type { Footprint } from './fpKit.ts';
import type { Pool } from './layout.ts';
import type { TagSpec } from './Overlay.tsx';
import type { ArmStep, DeskState, FocusEntry, LampStep, ReplyState } from './state.ts';
import type { YouPose } from './you.ts';

/** Whether beat 8 is built (false: the animatic's slate shows its cues' words and the "animatic" mark over its frames). */
export const BUILT = false;

/** Beat 8's state at a film frame (the lane defines it). */
export interface Beat8State {
  f: number;
}
/** DeskState.e8: null outside the beat's life. */
export function beat8At(_f: number): Beat8State | null {
  return null;
}

export const FOCUS_8: readonly FocusEntry[] = [];
export const LAMP_8: readonly LampStep[] = [];
export const ARM_8: readonly ArmStep[] = [];
export function replies8(_e: Beat8State | null): ReplyState[] {
  return [];
}
export function cards8(_s: DeskState): CardUp[] {
  return [];
}
export function footprints8(_s: DeskState): Footprint[] {
  return [];
}
export function pools8(_s: DeskState): Pool[] {
  return [];
}
export const TAGS_8: readonly TagSpec[] = [];
export function you8(_f: number, pose: YouPose): YouPose {
  return pose;
}
