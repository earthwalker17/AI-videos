/**
 * The objects of beat 7 (desk/beat7.ts), drawn in act two's world (objects/World.tsx; the summary's world mounts World too, so it draws there as well from summary.ts SEAM_D), and its DOM text over the world (`Beat7Text`, in the frame's
 * overlay slot: desk/DeskFrame.tsx `overlay`, posed by the same camera). A stub until the beat-7 lane builds it.
 * Objects draw with the kit's materials (`useDeskMats`, `useDeskSets`): a new transparent, side or map combination is
 * its own program (a cold compile), so build from the kit's where you can.
 */
import type { CamPose } from '@aiv/remotion-kit';
import type { DeskState } from '../state.ts';

export function Beat7(_props: { s: DeskState }) {
  return null;
}

export function Beat7Text(_props: { f: number; pose: CamPose }) {
  return null;
}
