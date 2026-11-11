/**
 * Beat 9 (STORYBOARD 9.1-9.2, film f4560-4959; cues.ts BEAT_9): keeping it running, handed over (proposed: the vellum
 * east of the system, camera.ts TO_VELLUM to still (d)'s framing). The beats 9-10 lane's module: its state and the hooks
 * the shared files compose from it, as beat7.ts describes them (objects/Beat9.tsx draws it, and mounts
 * objects/Proposed.tsx with `proposedAt`'s state). A stub until the lane builds it: every hook adds nothing. Import rule
 * as beat7.ts's: module-level tables from leaf modules only.
 */
import type { CardUp } from './beat4.ts';
import type { Footprint } from './fpKit.ts';
import type { Pool } from './layout.ts';
import type { TagSpec } from './Overlay.tsx';
import type { ArmStep, DeskState, FocusEntry, LampStep, ReplyState } from './state.ts';
import type { YouPose } from './you.ts';

/** Whether beat 9 is built (false: the animatic's slate shows its cues' words and the "animatic" mark over its frames). */
export const BUILT = false;

/** Beat 9's state at a film frame (the lane defines it). */
export interface Beat9State {
  f: number;
}
/** DeskState.e9: null outside the beat's life. */
export function beat9At(_f: number): Beat9State | null {
  return null;
}

/**
 * The proposed parts' pose (objects/Proposed.tsx's `state` prop; the lane defines it). Proposed draws still (d)'s
 * static pose for a null state (the summary's mount), so its end state is the signed-off still.
 */
export interface ProposedState {
  f: number;
}
/** The proposed parts at a film frame in act two's world (from beat 9 on), null where act two draws none of them. */
export function proposedAt(_f: number): ProposedState | null {
  return null;
}

export const FOCUS_9: readonly FocusEntry[] = [];
export const LAMP_9: readonly LampStep[] = [];
export const ARM_9: readonly ArmStep[] = [];
export function replies9(_e: Beat9State | null): ReplyState[] {
  return [];
}
export function cards9(_s: DeskState): CardUp[] {
  return [];
}
export function footprints9(_s: DeskState): Footprint[] {
  return [];
}
export function pools9(_s: DeskState): Pool[] {
  return [];
}
export const TAGS_9: readonly TagSpec[] = [];
export function you9(_f: number, pose: YouPose): YouPose {
  return pose;
}
