/**
 * What a section of the film gives the film: when it plays, where the camera is, where its type
 * stands and how to draw its marks. Sections 4 to 7 are each one of these, so a section is one
 * file and the film only assembles them.
 *
 * Between sections the picture is the resting stack (`rest` in lift.ts) under whatever pose the
 * camera has: a section fades its own marks in after its `from` and out before its `to`.
 */
import type { Pose } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';

/** Where a line of type is set: `x` is its left edge, centre or right edge by `align`, `y` its first baseline. */
export interface Anchor {
  x: number;
  y: number;
  align: 'left' | 'centre' | 'right';
}

/** A place set by hand, or a function when it hangs on something in the scene. */
export type Place = Anchor | ((d: Draw) => Anchor);

export interface Section {
  /** the film frames it draws: from `from` up to, not including, `to` */
  from: number;
  to: number;
  /** the camera's keys this section owns: (film frame, pose), in order. The rig eases between keys */
  keys: ReadonlyArray<readonly [number, Pose]>;
  /** where a block of type stands, by block id; a block not named here gets its tier's default place */
  place?: Record<string, Place>;
  /** a line set on its own, away from its block's stack, by line id */
  linePlace?: Record<string, (d: Draw) => Anchor>;
  /** lines the scene sets itself, beside a mark: the typesetter leaves them alone */
  own?: readonly string[];
  /** draw the section's marks for film frame `f` (fractional inside a sub-frame) */
  draw(d: Draw, f: number): void;
}
