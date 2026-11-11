/**
 * The objects of beats 12 and 13 (desk/end.ts), drawn in the summary's world only (FilmFrame.tsx SummaryFrame), and its DOM text over the world (`EndText`, in the frame's
 * overlay slot: desk/DeskFrame.tsx `overlay`, posed by the same camera). A stub until the beats 11-13 lane builds it.
 * Objects draw with the kit's materials (`useDeskMats`, `useDeskSets`): a new transparent, side or map combination is
 * its own program (a cold compile), so build from the kit's where you can.
 */
import type { CamPose } from '@aiv/remotion-kit';
import type { DeskState } from '../state.ts';

export function End(_props: { s: DeskState }) {
  return null;
}

export function EndText(_props: { f: number; pose: CamPose }) {
  return null;
}
