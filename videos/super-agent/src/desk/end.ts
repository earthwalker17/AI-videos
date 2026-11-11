/**
 * Beats 12 and 13 (STORYBOARD 12.1-13.3, film f6000-6719; cues.ts END): the bookend (camera.ts TO_BOOKEND to
 * FRAMING_BOOKEND) and the end card, in the summary's world. The beats 11-13 lane's module: its state and the hooks the
 * shared files compose from it, as beat11.ts describes them (objects/End.tsx draws it, mounted in the summary's world
 * only). A stub until the lane builds it: every hook adds nothing. Import rule as beat7.ts's: module-level tables from
 * leaf modules only.
 */
import type { CardUp } from './beat4.ts';
import type { Footprint } from './fpKit.ts';
import type { Pool } from './layout.ts';
import type { TagSpec } from './Overlay.tsx';
import type { DeskState, LampStep } from './state.ts';
import type { YouPose } from './you.ts';

/** Whether beats 12-13 are built (false: the animatic's slate shows their cues' words and the "animatic" mark over their frames). */
export const BUILT = false;

/** The end's state at a film frame (the lane defines it). */
export interface EndState {
  f: number;
}
/** DeskState.end: null outside its life. */
export function endAt(_f: number): EndState | null {
  return null;
}

export const LAMP_END: readonly LampStep[] = [];
export function cardsEnd(_s: DeskState): CardUp[] {
  return [];
}
export function footprintsEnd(_s: DeskState): Footprint[] {
  return [];
}
export function poolsEnd(_s: DeskState): Pool[] {
  return [];
}
export const TAGS_END: readonly TagSpec[] = [];
export function youEnd(_f: number, pose: YouPose): YouPose {
  return pose;
}
