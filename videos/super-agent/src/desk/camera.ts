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
import { Easing } from 'remotion';
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
 * The hook (STORYBOARD 1.1, f0–159) at 1.6x: close on the west end of the desk, the four feeders and the heap
 * running east toward your desk, your bent-arm lamp at frame right and the nearest folders fanned north. The chat
 * drum's top clears the frame's top edge and the calendar pad stays above the notes band (C1). Bar 3's downbeat eases
 * out to FRAMING_A; the bookend (STORYBOARD 12.1, f6000) returns here.
 */
export const FRAMING_HOOK: Framing = { x: -600, y: 160, zoom: 1.6 };

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
 * edge). 2.4x is past TREATMENT's 1.6-2.2x close range: the director kept it (polish pass 2), trucked
 * 15 u (about 35 px) south so the reel's hub leaves the top edge cleanly instead of sitting tangent to it.
 */
export const FRAMING_C: Framing = { x: -90, y: 150, zoom: 2.4 };

/**
 * The camera's moves from the turn on (film frames >= 1400; act one's, before 1400, is ACT_ONE_MOVE). Each move starts
 * on a downbeat and runs between two held framings on the camera token, its zoom even in log scale (perceptual scale)
 * and its truck even on screen (`moveFraming`); between moves the framing holds exactly (`deskCamera`), so a still at a
 * hold is the static pose. The DOM layer projects through the same pose (`project`).
 */
export interface CameraMove {
  from: number;
  to: number;
  a: Framing;
  b: Framing;
}
export const CAMERA_MOVES: readonly CameraMove[] = [
  // the turn (MT2, STORYBOARD 4.1): bar 19's downbeat, 1.2x to 0.85x with a truck north, two bars
  { from: 1440, to: 1600, a: FRAMING_A, b: FRAMING_B },
  // bar 34's downbeat (5.3): in on the throat and the reading window, one bar
  { from: 2640, to: 2720, a: FRAMING_B, b: FRAMING_C },
  // bar 42's downbeat (6.4): out to the bay floor, two bars
  { from: 3280, to: 3440, a: FRAMING_C, b: FRAMING_B },
];

/** The camera token (TREATMENT Motion grammar): cubic-bezier(.65, 0, .35, 1), one bell of speed peaking mid-move. */
const CAMERA_EASE = Easing.bezier(0.65, 0, 0.35, 1);

/**
 * A move's framing at progress u (0..1, already eased): the zoom changes evenly in log scale (perceptual scale), and
 * the aim point trucks in proportion to 1/zoom along the way, so its speed on screen stays even while the zoom
 * changes (a truck at 2.4x covers less world per frame than the same truck at 0.85x).
 */
export function moveFraming(m: CameraMove, u: number): Framing {
  const r = m.b.zoom / m.a.zoom;
  const zoom = m.a.zoom * r ** u;
  const w = Math.abs(r - 1) < 1e-6 ? u : (1 - r ** -u) / (1 - 1 / r);
  return { x: m.a.x + (m.b.x - m.a.x) * w, y: m.a.y + (m.b.y - m.a.y) * w, zoom };
}

/** One move's pose at film frame f: its first framing held before it, the eased path while it runs, its last after. */
export function moveCameraAt(m: CameraMove, f: number, angle: Angle): CamPose {
  if (f <= m.from) return deskCamera(m.a, angle);
  if (f >= m.to) return deskCamera(m.b, angle);
  return deskCamera(moveFraming(m, CAMERA_EASE((f - m.from) / (m.to - m.from))), angle);
}

/** Act one's one move (STORYBOARD 1.2): bar 3's downbeat (`title-thump`), out of the hook onto your desk, 1.6x to 1.2x over two bars. */
export const ACT_ONE_MOVE: CameraMove = { from: 160, to: 320, a: FRAMING_HOOK, b: FRAMING_A };
/** Every move of the film in order: act one's, then CAMERA_MOVES (from the turn on). */
const ALL_MOVES: readonly CameraMove[] = [ACT_ONE_MOVE, ...CAMERA_MOVES];

/** The framing held at film frame f outside a move: the hook until bar 3, then each move's last framing. */
export function framingAt(f: number): Framing {
  let fr = ALL_MOVES[0].a;
  for (const m of ALL_MOVES) if (f >= m.to) fr = m.b;
  return fr;
}

/** The camera at film frame f: a move's path while it runs, else the held framing's exact pose. */
export function cameraAt(f: number, angle: Angle): CamPose {
  for (const m of ALL_MOVES) if (f > m.from && f < m.to) return moveCameraAt(m, f, angle);
  return deskCamera(framingAt(f), angle);
}

/**
 * The point on the horizontal plane at height z that a screen point (CSS px from the top left) sees through a pose:
 * the inverse of `project` for one plane (the title card is placed from a fixed screen rectangle every frame, so it
 * holds still on screen through a camera move).
 */
export function screenToDesk(pose: CamPose, s: readonly [number, number], z: number): P3 {
  const [px, py, pz] = pose.pos;
  const fw: P3 = [pose.look[0] - px, pose.look[1] - py, pose.look[2] - pz];
  const fl = Math.hypot(...fw);
  const f3: P3 = [fw[0] / fl, fw[1] / fl, fw[2] / fl];
  // right = forward × up (three's camera up is +y), then the true up = right × forward
  const r0: P3 = [-f3[2], 0, f3[0]];
  const rl = Math.hypot(...r0);
  const r: P3 = [r0[0] / rl, r0[1] / rl, r0[2] / rl];
  const u: P3 = [r[1] * f3[2] - r[2] * f3[1], r[2] * f3[0] - r[0] * f3[2], r[0] * f3[1] - r[1] * f3[0]];
  const th = Math.tan(((pose.fov / 2) * Math.PI) / 180);
  const nx = ((s[0] / VIEW.width) * 2 - 1) * th * (VIEW.width / VIEW.height);
  const ny = (1 - (s[1] / VIEW.height) * 2) * th;
  const d: P3 = [f3[0] + nx * r[0] + ny * u[0], f3[1] + nx * r[1] + ny * u[1], f3[2] + nx * r[2] + ny * u[2]];
  const t = (z - pz) / d[2];
  return [px + d[0] * t, py + d[1] * t, z];
}
