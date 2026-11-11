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
import { BEAT_11, END, at } from '../cues.ts';
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
 * Beat 8's test sheet (STORYBOARD 8.1-8.5), east of the bays at 0.7x (the director's pick, map-beat8 option C: 1.0x would
 * break the 700 px/s cap on bar 50's one-bar truck). Provisional: the beat-8 lane may ask for it to be tuned (camera.test
 * holds every move under the cap).
 */
export const FRAMING_SHEET: Framing = { x: 650, y: 40, zoom: 0.7 };
/**
 * The whole desk at 0.64× (tightened from the storyboard's 0.5× so the system fills the frame, a framing
 * the director accepts): every part, the Watchdog and "you · 你" included, inside title-safe; the
 * target 48 u north of the first pass, so the content sits 30 px lower and the reel on the upper third.
 * Still (d)'s framing (desk/summary.ts), and beats 9-10's from bar 58's ease-out to bar 65's dolly.
 */
export const FRAMING_D: Framing = { x: 85, y: 68, zoom: 0.64 };
/** The bookend (STORYBOARD 12.1, bar 76): back to the hook's framing for now; the beats 11-13 lane may ask for it to be tuned. */
export const FRAMING_BOOKEND: Framing = FRAMING_HOOK;

/**
 * The camera's moves from the turn on (film frames >= 1400; act one's, before 1400, is ACT_ONE_MOVE). Each move starts
 * on a downbeat and runs between two held framings on the camera token, its zoom even in log scale (perceptual scale)
 * and its truck even on screen (`moveFraming`); between moves the framing holds exactly (`deskCamera`), so a still at a
 * hold is the static pose. The DOM layer projects through the same pose (`project`). One list drives every segment
 * (act two and the summary alike pose through `cameraAt`); each move starts where the one before it landed, and the aim
 * point never runs faster than 700 px/s on screen (TREATMENT Camera; camera.test).
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
  // bar 43's downbeat (6.4): out to the bay floor, one bar, the mirror of bar 34's dolly; the close holds through the
  // recall's rewind, hops and answer (bar 42), and N6 ends 10 f in, while the frame has barely moved
  { from: 3360, to: 3440, a: FRAMING_C, b: FRAMING_B },
  // bar 50's downbeat (8.1): the truck east to the test sheet, one bar (the step-down leads it: cues.ts BEAT_8.stepDown)
  { from: at(50), to: at(51), a: FRAMING_B, b: FRAMING_SHEET },
  // bar 58's downbeat (9.1): out from the sheet to still (d)'s framing as the vellum is laid east of the system, one bar
  { from: at(58), to: at(59), a: FRAMING_SHEET, b: FRAMING_D },
  // bar 65's downbeat (10.2, N9: the move is the line): in on the Register, one bar, landing exactly on the summary's start
  { from: at(65), to: at(66), a: FRAMING_D, b: FRAMING_B },
  // bar 69's downbeat (the stamp, 11.1): out from the Register to the whole desk, settled three beats later so the labels
  // land on a still frame before still (d) (the storyboard's one bar; the labels' 6 f leader and 8 f wipe need the last beat)
  { from: BEAT_11.stamp, to: BEAT_11.stamp + 60, a: FRAMING_B, b: FRAMING_D },
  // bar 76's downbeat (12.1, C28: the move is the line): back to the hook's framing, one bar
  { from: END.move[0], to: END.move[1], a: FRAMING_D, b: FRAMING_BOOKEND },
];
/** Bar 34's dolly into the close (B to C) and bar 43's ease-out of it (C to B): the DOM layer and the close's print swap key off them. */
export const DOLLY_IN = CAMERA_MOVES[1]!;
export const EASE_OUT = CAMERA_MOVES[2]!;
/** Part 2's moves, by name (the labels' away windows, desk/film.ts, key off them). */
export const TO_SHEET = CAMERA_MOVES[3]!;
export const TO_VELLUM = CAMERA_MOVES[4]!;
export const TO_REGISTER = CAMERA_MOVES[5]!;
/** Bar 69's ease-out to still (d) (desk/summary.ts re-exports it under this name). */
export const EASE_OUT_D = CAMERA_MOVES[6]!;
export const TO_BOOKEND = CAMERA_MOVES[7]!;

/** The camera token (TREATMENT Motion grammar): cubic-bezier(.65, 0, .35, 1), one bell of speed peaking mid-move. */
export const CAMERA_EASE = Easing.bezier(0.65, 0, 0.35, 1);

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
