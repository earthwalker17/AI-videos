/**
 * Beat 7 (STORYBOARD 7.1-7.4, film f3440-3919; cues.ts BEAT_7): waiting, handed over. The beat-7 lane's module: its
 * state and the hooks the shared files compose from it. A stub until the lane builds it: every hook adds nothing, except
 * the Thread cord's footprints, which footprints.ts cast before this module existed (the lane owns them from here).
 *
 * Where each hook lands (the lane edits none of those files):
 * - `beat7At` is DeskState.e7 (state.ts deskStateAt); objects/Beat7.tsx draws it in act two's world (and in the
 *   summary's, which mounts World too);
 * - FOCUS_7, LAMP_7, ARM_7 join state.ts's focus entries, lamp steps and arm detents; `replies7` joins
 *   DeskState.replies; `you7` refines your desk's pose (actOne.ts youPoseAt);
 * - `footprints7`, `cards7` and `pools7` join footprints.ts footprintsAt and pools.ts poolsAt (a card in `cards7` gets
 *   its shadow and its light from there);
 * - TAGS_7 joins film.ts ACT2_TAGS; BUILT takes the animatic's slate and mark off the beat's frames (film.ts builtAt).
 *
 * Import rule: state.ts, footprints.ts and pools.ts import this module, so its module-level tables take values only from
 * leaf modules (cues.ts, layout.ts, springs.ts, fpKit.ts, you.ts, camera.ts); values from state.ts, beat4.ts,
 * footprints.ts or pools.ts are used inside functions only (types from anywhere).
 */
import { BEAT_7 } from '../cues.ts';
import type { CardUp } from './beat4.ts';
import { polySegs, segFp, type Footprint } from './fpKit.ts';
import { CORDS, DECK, MAST, type Pool } from './layout.ts';
import type { TagSpec } from './Overlay.tsx';
import type { ArmStep, DeskState, FocusEntry, LampStep, ReplyState } from './state.ts';
import type { YouPose } from './you.ts';

/** Whether beat 7 is built (false: the animatic's slate shows its cues' words and the "animatic" mark over its frames). */
export const BUILT = false;

/** Beat 7's state at a film frame (the lane defines it). */
export interface Beat7State {
  f: number;
}
/** DeskState.e7: null outside the beat's life. */
export function beat7At(_f: number): Beat7State | null {
  return null;
}

/** Focus entries (state.ts FocusEntry: higher `priority` wins where entries overlap). */
export const FOCUS_7: readonly FocusEntry[] = [];
/** Your lamp's steps (state.ts LampStep). */
export const LAMP_7: readonly LampStep[] = [];
/** The index arm's detents (state.ts ArmStep). */
export const ARM_7: readonly ArmStep[] = [];
/** Replies riding the chute into your in-tray (state.ts ReplyState, replyRideAt). */
export function replies7(_e: Beat7State | null): ReplyState[] {
  return [];
}
/** Counterfactual cards up at this state (beat4.ts CardUp: footprints.ts and pools.ts give each its shadow and its light). */
export function cards7(_s: DeskState): CardUp[] {
  return [];
}

/**
 * Beat 7's footprints. The stub casts the Thread cord and its guide as footprints.ts did from 7.1 on (design D1): the
 * guide's bracket and mast, and the cord's segments; the lane replaces them with the payout's.
 */
export function footprints7(s: DeskState): Footprint[] {
  if (s.f < BEAT_7.cordOut) return [];
  return [segFp([MAST.arm[0], MAST.arm[1], DECK.top - 4], [MAST.x, MAST.y, DECK.top - 4], 4), segFp([MAST.x, MAST.y, DECK.top - 4], [MAST.x, MAST.y, MAST.h], 5), ...polySegs(CORDS.vermilion, 4)];
}
/** Beat 7's pools (fpKit.ts tint, LIGHT_HEX); at most MAX_POOLS in all. */
export function pools7(_s: DeskState): Pool[] {
  return [];
}
/** Beat 7's tags (Overlay.tsx TagSpec; `id` when one cue places several). */
export const TAGS_7: readonly TagSpec[] = [];
/** Your desk's pose refined by beat 7 (actOne.ts youPoseAt; identity outside the beat). */
export function you7(_f: number, pose: YouPose): YouPose {
  return pose;
}
