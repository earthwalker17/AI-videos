/**
 * The Register Desk's camera (synthesis §2, Depth and Camera): one long lens for the whole film,
 * fov 20°, at a distance where one world unit is one screen pixel on the desk plane at zoom 1.0,
 * pitched 15° (the user's choice between 15° and the 0° plan view is open: lookdev round 2).
 *
 * Both layers use this one pure function: the WebGL world poses its camera from `deskCamera`, and
 * the DOM layer projects world points through the same pose (`project`, the kit's `screenBoxAt`),
 * so a label lands on its object at every zoom (docs/ARCHITECTURE.md decision 30, "One camera").
 */
import { CamPath, screenBoxAt, type CamKey, type CamPose } from '@aiv/remotion-kit';
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

/** Style frame (b), "Two levels": camera 0.85×, trucked 200 u west and 40 u north of the world's origin (layout.ts) so the content is centred and fills the band above the notes. */
export const FRAMING_B: Framing = { x: -200, y: 40, zoom: 0.85 };
/**
 * Still (a) and act one, "You've quietly become their router": camera 1.2×, aimed so the feeders sit
 * at the west edge, your desk and its notes loop above the notes band and the folders' arc under the
 * top of the frame (desk/actOne.ts). The turn (MT2) eases from here to FRAMING_B.
 */
export const FRAMING_A: Framing = { x: -296, y: 94, zoom: 1.2 };

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

/**
 * The close on the Register's throat and reading window (STORYBOARD 5.3-6.4, still (c) at f3150):
 * 2.4x, so the record, the stub row, the mouth and the spill drawer fill the upper-left two-thirds
 * above the notes band and the bug bay leaves the frame (its pins and folder are past the east
 * edge). 2.4x is past TREATMENT's 1.6-2.2x close range: a framing decision for the user (lookdev
 * round 2, the (c) and (d) polish).
 */
export const FRAMING_C: Framing = { x: -90, y: 165, zoom: 2.4 };

/**
 * The camera's moves from the turn on (film frames >= 1400; act one's keys, before 1400, are act
 * one's own). Each move starts on a downbeat and runs between two held framings through a
 * pass-through key at the geometric mean of their zooms, so the zoom reads evenly (perceptual
 * scale); between moves the framing holds exactly (`deskCamera`), so a still at a hold is the
 * static pose. The DOM layer projects through the same pose (`project`).
 */
export const CAMERA_MOVES: readonly { from: number; to: number; a: Framing; b: Framing }[] = [
  // the turn (MT2, STORYBOARD 4.1): bar 19's downbeat, 1.2x to 0.85x with a truck north, two bars
  { from: 1440, to: 1600, a: FRAMING_A, b: FRAMING_B },
  // bar 34's downbeat (5.3): in on the throat and the reading window, one bar
  { from: 2640, to: 2720, a: FRAMING_B, b: FRAMING_C },
  // bar 42's downbeat (6.4): out to the bay floor, two bars
  { from: 3280, to: 3440, a: FRAMING_C, b: FRAMING_B },
];

const movePaths = new Map<string, CamPath>();
function movePath(m: (typeof CAMERA_MOVES)[number], angle: Angle): CamPath {
  const key = `${m.from}:${angle}`;
  let p = movePaths.get(key);
  if (!p) {
    const mid: Framing = { x: (m.a.x + m.b.x) / 2, y: (m.a.y + m.b.y) / 2, zoom: Math.sqrt(m.a.zoom * m.b.zoom) };
    const k = (f: number, fr: Framing, hold: boolean): CamKey => ({ f, ...deskCamera(fr, angle), hold });
    p = new CamPath([k(m.from, m.a, true), k((m.from + m.to) / 2, mid, false), k(m.to, m.b, true)]);
    movePaths.set(key, p);
  }
  return p;
}

/** The framing held at film frame f (>= 1400) outside a move. */
export function framingAt(f: number): Framing {
  let fr = FRAMING_A;
  for (const m of CAMERA_MOVES) if (f >= m.to) fr = m.b;
  return fr;
}

/** The camera at film frame f (>= 1400): a move's path while it runs, else the held framing's exact pose. */
export function cameraAt(f: number, angle: Angle): CamPose {
  for (const m of CAMERA_MOVES) if (f > m.from && f < m.to) return movePath(m, angle).at(f);
  return deskCamera(framingAt(f), angle);
}
