/**
 * The objects of beat 10 (desk/beat10.ts), drawn in act two's world (objects/World.tsx; the summary's world mounts World too, so it draws there as well from summary.ts SEAM_D), and its DOM text over the world (`Beat10Text`, in the frame's
 * overlay slot: desk/DeskFrame.tsx `overlay`, posed by the same camera). A stub until the beats 9-10 lane builds it.
 * Objects draw with the kit's materials (`useDeskMats`, `useDeskSets`): a new transparent, side or map combination is
 * its own program (a cold compile), so build from the kit's where you can.
 */
import type { CamPose } from '@aiv/remotion-kit';
import type { DeskState } from '../state.ts';

export function Beat10(_props: { s: DeskState }) {
  return null;
}

export function Beat10Text(_props: { f: number; pose: CamPose }) {
  return null;
}
