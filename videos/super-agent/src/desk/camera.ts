/**
 * The Register Desk's camera (synthesis §2, Depth and Camera): one long lens for the whole film,
 * fov 20°, at a distance where one world unit is one screen pixel on the desk plane at zoom 1.0,
 * pitched 15° (the user's choice between 15° and the 0° plan view is open: lookdev round 2).
 *
 * Both layers use this one pure function: the WebGL world poses its camera from `deskCamera`, and
 * the DOM layer projects world points through the same pose (`project`, the kit's `screenBoxAt`),
 * so a label lands on its object at every zoom (docs/ARCHITECTURE.md decision 30, "One camera").
 */
import { screenBoxAt, type CamPose } from '@aiv/remotion-kit';
import type { P3 } from './layout.ts';

/** The composition's CSS size. */
export const VIEW = { width: 1920, height: 1080 } as const;
/** Vertical field of view, degrees. */
export const FOV = 20;
/** Camera distance at zoom 1.0: half the frame height over tan(fov / 2), so 1 u = 1 px at z = 0. */
export const D1 = VIEW.height / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
/** Clip planes for the GL camera (the world spans a few hundred units round the aim point). */
export const NEAR = 800;
export const FAR = 9000;

/** Where the camera looks (a point on the desk) and how far in it is. */
export interface Framing {
  x: number;
  y: number;
  zoom: number;
}

/** The pitches the user chooses between: 15° (recommended) and the 0° plan view. */
export type Angle = 0 | 15;

/** Style frame (b), "Two levels": camera 0.85×, aimed 40 u north of the world's origin (layout.ts) so the diagram fills the band above the notes. */
export const FRAMING_B: Framing = { x: 0, y: 40, zoom: 0.85 };

/**
 * The pose for a framing at a pitch: the camera sits south of its aim point, tilted `angle`
 * degrees from straight down, at D1 / zoom. Screen-up is north (three's default camera up, +y).
 */
export function deskCamera(fr: Framing, angle: Angle): CamPose {
  const d = D1 / fr.zoom;
  const a = (angle * Math.PI) / 180;
  return { pos: [fr.x, fr.y - d * Math.sin(a), d * Math.cos(a)], look: [fr.x, fr.y, 0], fov: FOV, focus: d };
}

/** Where a world point lands on the composition (CSS px from the top left), through a pose. */
export function project(pose: CamPose, p: P3): [number, number] {
  const b = screenBoxAt(pose, [p], VIEW.width, VIEW.height);
  return [b.left, b.top];
}

/** The screen box of several world points through a pose. */
export function projectBox(pose: CamPose, pts: readonly P3[]): { x0: number; y0: number; x1: number; y1: number } {
  const b = screenBoxAt(pose, pts, VIEW.width, VIEW.height);
  return { x0: b.left, y0: b.top, x1: b.left + b.width, y1: b.top + b.height };
}
