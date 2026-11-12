/**
 * The objects of beat 8 (desk/beat8.ts), drawn in act two's world (objects/World.tsx; the summary's world mounts World
 * too, where beat 8 is long over: DeskState.e8 is null there): the test sheet (objects/Evidence.tsx) while it is in the
 * world, from bar 50's truck until it has slid away east on bar 58. Its one DOM text, the load tag, is a tag of the
 * film's (beat8.ts TAGS_8, drawn by the Overlay on its cue); every other word is the sheet's own ink, so `Beat8Text`
 * draws nothing.
 */
import type { CamPose } from '@aiv/remotion-kit';
import type { DeskState } from '../state.ts';
import { Evidence } from './Evidence.tsx';

export function Beat8({ s }: { s: DeskState }) {
  return s.e8 ? <Evidence e={s.e8} /> : null;
}

export function Beat8Text(_props: { f: number; pose: CamPose }) {
  return null;
}
