/**
 * The camera pose the film uses at a frame: the keyed shots of timeline.ts, except where a shot
 * follows an actor (Clawd's exit, bars 33-34), which needs the blocking table. Kept apart from
 * timeline.ts so the actors can import the timeline without a cycle.
 */
import { lerp, progress } from '@aiv/core';
import { at } from '../cues.ts';
import { clawdAt } from './actors.ts';
import { cameraAt, FLOOR, type Pose } from './timeline.ts';

export function shotPose(f: number): Pose {
  const keyed = cameraAt(f);
  // Clawd trots off toward the far window: the camera pans and trucks with him (on ones)
  if (f >= at(33, 2) && f < at(35)) {
    const c = clawdAt(f).pos;
    // look past him into the set, toward the far house whose window flips cold (the last laugh)
    const look: [number, number, number] = [c[0] + 0.9, FLOOR + 0.85, c[2] - 2.0];
    const pos: [number, number, number] = [c[0] - 1.1, FLOOR + 0.8, c[2] + 2.8];
    const k = progress(f, at(33, 2), at(33, 2) + 10, 'inOutSine');
    return {
      pos: [lerp(keyed.pos[0], pos[0], k), lerp(keyed.pos[1], pos[1], k), lerp(keyed.pos[2], pos[2], k)],
      look: [lerp(keyed.look[0], look[0], k), lerp(keyed.look[1], look[1], k), lerp(keyed.look[2], look[2], k)],
      fov: lerp(keyed.fov, 34, k),
      focus: lerp(keyed.focus, 3.0, k),
    };
  }
  return keyed;
}
