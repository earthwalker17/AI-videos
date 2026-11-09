/**
 * The summary at the sign-off rest (film frames from f5400; STORYBOARD 11.1, still (d) at f5520):
 * the whole system at 0.64×, the request's route traced once (vermilion out, green home through the
 * Register), the proposed parts east in vellum, the open problems in pencil. Pure: layout and state of
 * what the summary adds, as a function of the film frame and the cue sheet's events.
 */
import { clamp, easings } from '@aiv/core';
import { Curve, type CamPose } from '@aiv/remotion-kit';
import { cue } from '../cues.ts';
import { FRAMING_B, moveCameraAt, type Angle, type CameraMove, type Framing } from './camera.ts';
import { BAYS, BELT, BENCH, CHUTE, DECK, FEEDERS, FOLDER, FRESH, GATE, GROOVES, INDEX, RAMP, REEL, SPIKE, TAPE, TAPE_FLAT_X1, THROAT, WINDOW, YOU, rectC, type P2, type P3, type Pool } from './layout.ts';
import { DETENT, STEP_FRAMES, deskStateAt, type DeskState, type FocusId } from './state.ts';

/** The frames the summary's world is posed for (the sign-off, the rest, the idea labels). */
export const SPAN_D: readonly [number, number] = [5400, 5720];

/** The stamp lands (cues.ts 'stamp', f5440); the route draws out, then home, one bar in all. */
export const STAMP_F = cue('stamp').frame;
export const TRACE_F = { out: [STAMP_F + 6, STAMP_F + 44] as const, home: [STAMP_F + 44, STAMP_F + 78] as const } as const;

/**
 * The whole desk at 0.64× (tightened from the storyboard's 0.5× so the system fills the frame, a framing
 * the director accepts): every part, the Watchdog and "you · 你" included, inside title-safe; the
 * target 48 u north of the first pass, so the content sits 30 px lower and the reel on the upper third.
 */
export const FRAMING_D: Framing = { x: 85, y: 68, zoom: 0.64 };
/**
 * Bar 69's downbeat (the stamp): the camera eases out from the Register at 0.85× (FRAMING_B, where bar 65
 * left it) to the whole desk, settled three beats later so the labels can land on a still frame before
 * still (d) (STORYBOARD 11.1 asks for one bar; the labels' 6 f leader and 8 f wipe need the last beat).
 */
export const EASE_OUT_D: CameraMove = { from: STAMP_F, to: STAMP_F + 60, a: FRAMING_B, b: FRAMING_D };
export const poseD = (f: number, angle: Angle): CamPose => moveCameraAt(EASE_OUT_D, f, angle);
/**
 * The role labels round the move (TREATMENT Camera: labels that would move more than 40 px exit and re-enter):
 * they fade out over the stamp's 6 f, and once the camera has settled each leader draws (6 f) and its label
 * wipes in (8 f), 2 f apart.
 */
export function summaryLabelAt(f: number, i: number): { opacity?: number; leader?: number; wipe?: number } | null {
  if (f < STAMP_F) return {};
  if (f < STAMP_F + 6) return { opacity: 1 - (f - STAMP_F) / 6 };
  const enter = EASE_OUT_D.to + 2 + 2 * i;
  if (f < enter) return null;
  const leader = clamp((f - enter) / 6);
  const wipe = clamp((f - enter - 6) / 8);
  return wipe >= 1 ? {} : { leader, wipe };
}

// ------------------------------------------------------------------------------------------------
// State: at the sign-off every bay has capped (its work light out) and steps down; the trace is the
// one thing that moves (STORYBOARD 11.1), and what it does not run through steps down with it

/** What steps down as the trace draws (from the stamp, over the step ramp): the reel's face, the lock, the Slow Path, the log, the plate, the feeders. */
export const TRACE_STEP: readonly FocusId[] = ['reel', 'lock', 'policy', 'gauge', 'plate', 'fanfold', 'intake'];

export interface SummaryState {
  f: number;
  /** how much of each leg of the route is drawn (0..1) */
  out: number;
  home: number;
  /** the stamp: 0 lifted … 1 pressed; the green ink spread on the reply (0..1) */
  stamp: number;
  ink: number;
}

export function summaryAt(f: number): SummaryState {
  const ramp = (r: readonly [number, number]) => easings.inOutSine(clamp((f - r[0]) / (r[1] - r[0])));
  const press = clamp((f - STAMP_F) / 3) * (1 - clamp((f - STAMP_F - 5) / 5));
  return { f, out: ramp(TRACE_F.out), home: ramp(TRACE_F.home), stamp: press, ink: clamp((f - STAMP_F - 1) / 6) };
}

/** The desk's state at the sign-off: every bay capped and stepped down, their work lights out, the index arm at your detent. */
export function summaryDeskState(f: number): DeskState {
  const s = deskStateAt(f);
  const own = easings.inOutSine(clamp((f - TRACE_F.out[0]) / STEP_FRAMES));
  return {
    ...s,
    // bar 68's reply came down the chute to you: the arm rests at your detent
    arm: DETENT.you,
    testsLight: 0,
    testsStep: 1,
    bugLight: 0,
    // the request's bay finished in bar 68: every pin passed, dead still
    pins: s.pins.map(() => 1),
    next: { ...s.next, light: 0 },
    // every bay stepped down (W-10 too), and the Thread cord with them; the rest of what the route skips steps down as it draws
    step: { amount: 1, ids: ['docsBay', 'bugBay', 'freshBay', 'cord'], own: { amount: own, ids: TRACE_STEP } },
    // the Register's hooded lamp no longer lights the window: the one lit paper is the slip your stamp signed
    cache: s.cache ? { ...s.cache, lamp: 0.25 } : null,
  };
}

// ------------------------------------------------------------------------------------------------
// The route, as the request took it: inked into the beds of the channels it used (world points just
// above each bed), never across print, each leg one continuous path. Out (vermilion): the feed, under
// the gate's fingers and up the intake belt, across the throat's floor into the print head (hidden in
// it), out along the window's north bar, round the reel's rim where the tape winds on, over the dispatch
// housing, down the ramp's north lane and the groove's east lane, over the bay's door and the bench to
// the request's folder. Home (green): from the folder over the bench and the door, up the groove's west
// lane and the ramp's south lane, along the deck's east and south rails, across the deck plate onto the
// window's south bar, through the print head, over the index arm's boss and out along the arm into the
// reply chute, down onto the slip your stamp signed. The two run side by side down the ramp, the groove
// and through the door, red on the outside of every turn they share, so they never cross.
//
// Each leg is one kit Curve (centripetal Catmull-Rom: no overshoot between unevenly spaced points)
// through its waypoints, drawn by arc length (objects/Trace.tsx). No two consecutive 16 u steps of it turn
// more than 60° (in plan, and on screen as still (d) sees it), every drop off a wall or an edge is ramped
// (DROP_SLOPE), and it never runs under a leg strut, so it has no right-angle steps, Z-jogs or dark wedges
// (summary.test.ts).

/** Every drop (or climb) off a wall or an edge is ramped: at least 12 u of plan per 35 u of fall. */
export const DROP_SLOPE = 35 / 12;
/** The trace's width, thick where the leg set out to thin where it arrived (u; about 7.5 to 3 px at 0.64×). */
export const TRACE_W = [12, 4.6] as const;
/** The width at arc fraction t of a leg. */
export const traceWidthAt = (t: number): number => TRACE_W[0] + (TRACE_W[1] - TRACE_W[0]) * t;

const along = (a: P3, b: P3, n: number, lift = 0): P3[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + lift];
  });
/** A point on a circle round c at radius r and angle deg (degrees from +x), at height z. */
const onArc = (c: P2, r: number, deg: number, z: number): P3 => [c[0] + r * Math.cos((deg * Math.PI) / 180), c[1] + r * Math.sin((deg * Math.PI) / 180), z];
const req = BAYS.bug;
/** The window's north and south bars (their tops). */
const BAR_N_Y = WINDOW.frame.y1 - WINDOW.bar / 2;
const BAR_S_Y = WINDOW.frame.y0 + WINDOW.bar / 2;
const BAR_Z = WINDOW.z[1] + 1;
const RAIL_Z = DECK.top + 1.5;
/** The east rail's middle and the south rail's. */
const RAIL_E_X = DECK.x1 - DECK.rail / 2;
const RAIL_S_Y = DECK.y0 + DECK.rail / 2;
/** Down the ramp's quarter pipe at lane y (centre (lip, lip), radius lip: surface z at u out from the rail). */
const rampAt = (u: number, y: number): P3 => [RAMP.x + u, y, RAMP.lip - Math.sqrt(Math.max(0, RAMP.lip ** 2 - (u - RAMP.lip) ** 2)) + 1.5];
/**
 * The ramp's two lanes, 24 u apart: red down its north part (clear of the reel frame's corner boss),
 * green up its south part, then climbing it diagonally south-west so that it meets the east rail already
 * turning south. And the groove's (offsets from its engraved line, + east of the way down): red outside.
 */
const LANE = { out: (RAMP.y0 + RAMP.y1) / 2 + 22, home: (RAMP.y0 + RAMP.y1) / 2 - 2, grooveOut: 6, grooveHome: -5.5 } as const;
/**
 * Where a lane leaves the ramp's top: its rail's outer edge, over a 50 u face and then the quarter pipe
 * (vertical at its top), so the drop is one straight ramped run between the edge and the pipe where it is
 * gentle (`chord`: points along it, so the curve stays straight and never steeper than the run).
 */
const RAMP_EDGE_X = RAMP.x + 1;
const chord = (a: P3, b: P3): P3[] => along(a, b, 3).slice(0, 2);
/** The bug bay's groove (as the desk engraves it, ramp foot to door) offset to one side: + is east of the way down. */
function grooveLane(off: number): P3[] {
  const line = new Curve(GROOVES.bug.map((p) => [p[0], p[1]])).polyline(12);
  return line.map((p, i) => {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    // the left normal of the way down (south, then south-west): east of it
    const nx = -(b[1] - a[1]) / l;
    const ny = (b[0] - a[0]) / l;
    return [p[0] + nx * off, p[1] + ny * off, 1.4] as P3;
  });
}
/**
 * Over the bay's shut door. The deck's south-east leg strut lands on the door (layout.ts LEG_STRUTS: its
 * foot at (320, 86)), so the groove's last stretch passes under its slanted run: a lane low there is
 * hidden by it (the dark wedge the critic saw on (d)). Both lanes climb over it instead, cross the door at
 * that height (well above its wall) and ease down from there to the bench, never dipping.
 */
const OVER_DOOR_Z = 64;
/** A groove lane from below y `from` to its door end, ramped up over its last 50 u (in plan) to OVER_DOOR_Z, held over its last 10. */
function laneToDoor(off: number, from: number): P3[] {
  const pts = grooveLane(off).filter((p) => p[1] < from);
  const CLIMB = 40;
  const HOLD = 10;
  let d = 0;
  const left = pts.map((_, i) => {
    if (i > 0) d += Math.hypot(pts[pts.length - i][0] - pts[pts.length - 1 - i][0], pts[pts.length - i][1] - pts[pts.length - 1 - i][1]);
    return d;
  });
  return pts.map((p, i) => {
    const k = clamp(1 - (left[pts.length - 1 - i] - HOLD) / CLIMB);
    return [p[0], p[1], p[2] + (OVER_DOOR_Z - p[2]) * k * k * (3 - 2 * k)];
  });
}
/** The bench's top and the folder's, where the trace lies on them. */
const BENCH_Z = BENCH.z[1] + 0.9;
const FOLDER_Z = FOLDER.z[1] + 0.9;

/** The belt's line 8 u north of its middle: between the gate's fingers, and into the throat clear of its south cheek. */
const BELT_L = Math.hypot(BELT.to[0] - BELT.from[0], BELT.to[1] - BELT.from[1]);
const BELT_D: P2 = [(BELT.to[0] - BELT.from[0]) / BELT_L, (BELT.to[1] - BELT.from[1]) / BELT_L];
const beltLine = (s: number, z: number): P3 => [BELT.from[0] + BELT_D[0] * s - BELT_D[1] * 8, BELT.from[1] + BELT_D[1] * s + BELT_D[0] * 8, z];
/** The throat's floor between its cheeks (objects/Register.tsx: its block's top, 8 under the throat's top), a hair above. */
const THROAT_FLOOR_Z = THROAT.z[1] - 8 + 1.2;
/**
 * The reel's rim (its flange outside the pack, r 112 to 125) at radius 118, and the tape's rise onto the
 * pack across it (objects/Register.tsx tapeRise: the trace rides over the rise where it covers the rim).
 */
const RIM_R = 118;
const RIM_Z = REEL.flangeZ[1] + 0.6;
const TAPE_RISE = new Curve<P3>([
  [TAPE_FLAT_X1 - 2, (TAPE.y0 + TAPE.y1) / 2, TAPE.z],
  [TAPE.x1 - 6, (TAPE.y0 + TAPE.y1) / 2, TAPE.z + 6],
  [TAPE.x1 + 8, (TAPE.y0 + TAPE.y1) / 2 + 3, REEL.packZ[1] - 8],
]).polyline(24);
const rimAt = (deg: number): P3 => {
  const p = onArc([REEL.x, REEL.y], RIM_R, deg, RIM_Z);
  const x0 = TAPE_RISE[0][0];
  const x1 = TAPE_RISE[TAPE_RISE.length - 1][0];
  if (p[0] < x0 || p[0] > x1) return p;
  const i = TAPE_RISE.findIndex((q) => q[0] >= p[0]);
  const a = TAPE_RISE[Math.max(0, i - 1)];
  const b = TAPE_RISE[i];
  const z = a[2] + ((b[2] - a[2]) * (p[0] - a[0])) / Math.max(1e-6, b[0] - a[0]);
  // (the rise is swept in 8 straight steps: its chords sit a hair above the curve)
  return [p[0], p[1], Math.max(RIM_Z, z + 1.5)];
};
/** Off the north bar onto the rim: a right-hand arc of radius 30 tangent to the bar and to the rim. */
const BAR_TO_RIM = (() => {
  const r = 30;
  const c: P2 = [REEL.x - Math.sqrt((RIM_R + r) ** 2 - (REEL.y - (BAR_N_Y - r)) ** 2), BAR_N_Y - r];
  const meet = (Math.atan2(REEL.y - c[1], REEL.x - c[0]) * 180) / Math.PI;
  return { c, r, meet, rim: meet - 180 };
})();
/** Where the red's nib comes to rest: on the folder's north margin, just north of the request (never across its print). */
const NIB_OUT: P3 = [336, 1.5, FOLDER_Z];

export const ROUTE_OUT: readonly P3[] = [
  // from the chat spout along the feed, south of the spike's dropped noise, onto the belt's line
  [rectC(FEEDERS.chat)[0] + 70, rectC(FEEDERS.chat)[1] - 6, 4],
  [-795, 395, 3],
  [-712, 368, 3],
  [-645, 343, 3],
  // under the gate's fingers, through its bar, up the belt's bed
  beltLine(-36, 3),
  beltLine(0, BELT.from[2] + 2),
  beltLine(BELT_L / 2, (BELT.from[2] + BELT.to[2]) / 2 + 4),
  beltLine(BELT_L - 16, BELT.to[2] + 2 - (16 * (BELT.to[2] - BELT.from[2])) / BELT_L),
  // lifting off the belt's top into the throat's mouth at its floor's height (the belt runs on under it), across the
  // floor (under the neck collar), into the print head (hidden in it), out onto the north bar
  beltLine(BELT_L, THROAT_FLOOR_Z),
  [-374, 212.5, THROAT_FLOOR_Z + 0.4],
  [-358, 213, THROAT_FLOOR_Z + 1],
  [-343, 218, 121.8],
  [-330, 228, 126],
  [-319, 242, 130],
  [-309, 254, 133],
  [-299, 261, 134],
  [-285, BAR_N_Y + 0.2, BAR_Z],
  [-262, BAR_N_Y, BAR_Z],
  [-150, BAR_N_Y, BAR_Z],
  [-40, BAR_N_Y, BAR_Z],
  // off the window's corner onto the reel's rim (north of the stub on the tape), round it where the tape winds on
  onArc(BAR_TO_RIM.c, BAR_TO_RIM.r, 90, BAR_Z - 1),
  onArc(BAR_TO_RIM.c, BAR_TO_RIM.r, 67.5, (BAR_Z - 1 + RIM_Z) / 2),
  rimAt(BAR_TO_RIM.rim),
  ...[-120, -105, -97, -90, -87, -75].map(rimAt),
  // off the rim onto the dispatch housing's top (south of the flange, then north once the flange has curved away), over the east rail
  [185, 225.5, RIM_Z],
  [205, 226, 120.8],
  [230, 228.5, 120.8],
  [256, LANE.out - 0.5, 121],
  [RAIL_E_X, LANE.out, RAIL_Z],
  // down the ramp's face and its pipe in one straight run onto its north lane near the foot, then right off
  // the foot into the groove's east lane (the outside of the turn)
  [RAMP_EDGE_X, LANE.out, RAIL_Z - 2],
  ...chord([RAMP_EDGE_X, LANE.out, RAIL_Z - 2], rampAt(RAMP.lip - 15.7, LANE.out)),
  ...[90, 60, 30, 0].map((a) => {
    const p = onArc([RAMP.foot - 15.7, LANE.out - 25], 25, a, 0);
    return [p[0], p[1], p[0] < RAMP.foot ? rampAt(p[0] - RAMP.x, 0)[2] : 1.4] as P3;
  }),
  // down the groove's east lane, up over the leg strut's foot, bearing left over the door's east half, easing
  // down over the floor to the bench, between pins 2 and 3, onto the folder
  ...laneToDoor(LANE.grooveOut, 200).slice(0, -1),
  [305.5, 90, OVER_DOOR_Z],
  [307.5, 82, OVER_DOOR_Z - 0.2],
  [311, 72, OVER_DOOR_Z - 1],
  [316, 58, OVER_DOOR_Z - 2.4],
  [322.5, 38, BENCH_Z + 1.2],
  [325.5, 30, BENCH_Z],
  [329, 20, BENCH_Z],
  [332, 10.5, BENCH_Z + 0.3],
  [334, 5, FOLDER_Z],
  NIB_OUT,
];
/**
 * Where the report sets out home (the green's tail): the request's folder, on its north margin west of
 * the red's nib and clear of the request's print. (Not the work slot: it is east of the door, so a green
 * from there would have to cross the red to leave through the door's west half.)
 */
export const REPORT_PORT: P3 = [FOLDER.box.x0 + 7.5, FOLDER.box.y1 - 4.5, FOLDER_Z];
/** The index arm's tip at your detent (the arm's top). */
const ARM_TIP: P3 = [INDEX.pivot[0] + (INDEX.length - 6) * Math.cos(DETENT.you), INDEX.pivot[1] + (INDEX.length - 6) * Math.sin(DETENT.you), INDEX.z + 6.5];
/** A point on the index arm's axis at your detent, t out from the pivot, on its top. */
const onArm = (t: number, z = INDEX.z + 6.6): P3 => [INDEX.pivot[0] + t * Math.cos(DETENT.you), INDEX.pivot[1] + t * Math.sin(DETENT.you), z];
/** The reply chute's bed under the trace (its trough's floor is 3 u above the path). */
const CHUTE_BED = 7;
/**
 * The signed slip in your in-tray (objects/Trace.tsx: 104 x 72 at (-520, -64)): the reply ends on its north
 * margin (between the slip's edge at y about -28 and its ID's cap line at about -39), clear of the ID.
 */
export const REPLY_END: P3 = [-522, -32, YOU.top + 7.95];
export const ROUTE_HOME: readonly P3[] = [
  REPORT_PORT,
  // north off the folder and the bench between pins 1 and 2, rising gently over the floor and the door's west half
  [299.3, 8.5, (FOLDER_Z + BENCH_Z) / 2],
  [299, 15, BENCH_Z],
  [299, 24, BENCH_Z],
  [298.5, 33, BENCH_Z],
  [297, 52, BENCH_Z + 1.5],
  [295, 72, OVER_DOOR_Z - 1],
  [293.6, 80, OVER_DOOR_Z - 0.2],
  [293, 88, OVER_DOOR_Z],
  // over the leg strut's foot, down into the groove's west lane, up it, then left off its top onto the ramp (the inside of the turn)
  ...laneToDoor(LANE.grooveHome, 178).reverse(),
  ...[-9, 25, 60, 90].map((a) => {
    const p = onArc([RAMP.foot - 24.5, LANE.home - 20], 20, a, 0);
    return [p[0], p[1], rampAt(p[0] - RAMP.x, 0)[2]] as P3;
  }),
  // up the ramp's pipe and its face, bearing south as it climbs (the climb reads as up the screen, the
  // rail as down it: the turn is spread over the whole climb), onto the east rail and south along it
  [308, LANE.home - 5, 30],
  [294, LANE.home - 13, 68],
  [283.5, LANE.home - 22, 104],
  [RAIL_E_X + 6.5, LANE.home - 31, RAIL_Z - 1.5],
  [RAIL_E_X + 2, LANE.home - 41.5, RAIL_Z],
  [RAIL_E_X, LANE.home - 54, RAIL_Z],
  // round the deck's south-east corner (an arc of r 20 that stays on the rails) and west along the south rail
  ...[0, -30, -60, -90].map((a) => onArc([RAIL_E_X - 20, RAIL_S_Y + 20], 20, a, RAIL_Z)),
  [150, RAIL_S_Y, RAIL_Z],
  [40, RAIL_S_Y, RAIL_Z],
  // one shallow S across the deck plate, up onto the window's south bar
  [-12, RAIL_S_Y + 2.5, RAIL_Z],
  [-45, 150, DECK.top + 2],
  [-82, 176, BAR_Z - 3.5],
  [-118, BAR_S_Y, BAR_Z],
  // west along the south bar into the print head (hidden in it), out of its south face over the index arm's boss
  [-200, BAR_S_Y, BAR_Z],
  [-282, BAR_S_Y, BAR_Z],
  [-298, BAR_S_Y - 0.5, BAR_Z],
  [-307, BAR_S_Y - 3.5, BAR_Z + 0.5],
  [-313.5, 176, BAR_Z + 2],
  [-325, 158, INDEX.z + 11.5],
  // out along the arm to its tip, off it over the chute's north lip into its bed
  onArm(18.2, INDEX.z + 7),
  onArm(33),
  onArm(48.5),
  ARM_TIP,
  [-403, 120, 122],
  [-427, 95, 108],
  // down the chute's bed, off its mouth onto the signed slip's north margin
  ...CHUTE.slice(2).map((p): P3 => [p[0], p[1], p[2] + CHUTE_BED]),
  REPLY_END,
];

/** Each leg as one curve, drawn by arc length (objects/Trace.tsx). */
export const LEGS = { out: new Curve<P3>(ROUTE_OUT), home: new Curve<P3>(ROUTE_HOME) } as const;
/** The point of a leg at arc fraction t (0..1). */
export const legAt = (leg: Curve<P3>, t: number): P3 => {
  const p = leg.pointAt(clamp(t) * leg.length);
  return [p[0], p[1], p[2]];
};

/** The inks' albedos: lit on the desk they land on the palette's vermilion base (Y 121) and between the green's base and light (Y 182-205). */
export const TRACE_INK = { out: '#F26D4D', home: '#B6ECCB' } as const;
/**
 * The light an up-facing bed takes from the key (intensity `key` along `dir`) and the hemisphere fill
 * alone, as three's Lambert lights it (irradiance over π): about 0.74 with DeskWorld's LIGHTS.
 */
export const inkLight = (key: number, fill: number, dir: P3): number => ((key * dir[2]) / Math.hypot(dir[0], dir[1], dir[2]) + fill) / Math.PI;
/**
 * How much of its albedo the ink keeps at a point, so that a light pool lifts it at most INK_HOLD over its
 * value lit by the key and fill alone (your lamp would otherwise wash the green home to white where it
 * lands). `k`: that key-and-fill light (inkLight); the pools add on top, as the lit materials add them
 * (gl/light.ts dskPool, gl/materials.ts), by luminance.
 */
export const INK_HOLD = 1.2;
export function poolLift(p: P3, pools: readonly Pool[]): number {
  let s = 0;
  for (const q of pools) {
    if (p[2] < q.z[0] || p[2] > q.z[1]) continue;
    const dx = (p[0] - q.c[0]) / q.sigma[0];
    const dy = (p[1] - q.c[1]) / q.sigma[1];
    s += (0.2126 * q.rgb[0] + 0.7152 * q.rgb[1] + 0.0722 * q.rgb[2]) * Math.exp(-0.5 * (dx * dx + dy * dy));
  }
  return s;
}
export const inkHold = (p: P3, pools: readonly Pool[], k: number): number => Math.min(1, (INK_HOLD * k) / (k + poolLift(p, pools)));

// ------------------------------------------------------------------------------------------------
// East of the system, in vellum (proposed: STORYBOARD 9.1, 9.2) beside built graphite machines

/**
 * The graphite machines a cloud loop would keep running (built), north to south in one column, each its
 * own silhouette and at its own distance: a rack server (slot lines), a tower workstation (its vent
 * column), a closed laptop (its hinge). Each has its own daemon clip (vellum) on its west side.
 */
export const MACHINES: readonly { kind: 'server' | 'workstation' | 'laptop'; c: P2; w: number; d: number; h: number }[] = [
  { kind: 'server', c: [1250, 222], w: 150, d: 92, h: 44 },
  { kind: 'workstation', c: [1280, 92], w: 64, d: 118, h: 112 },
  { kind: 'laptop', c: [1240, -44], w: 150, d: 100, h: 13 },
];
/** Each clip's centre: 36 u west of its machine's west face. */
export const CLIP_GAP = 36;
export const clipC = (m: (typeof MACHINES)[number]): P2 => [m.c[0] - m.w / 2 - CLIP_GAP, m.c[1]];
/**
 * The vellum sheets laid flat: the plan of the deck, the state cabinet, and the cloud loop's sheet (its
 * loop and the docked lid strut drawn inside it), from whose east edge the tethers run as parallel strips,
 * one to each clip.
 */
export const VELLUM = {
  plan: { c: [930, 470] as P2, w: 240, d: 160 },
  cabinet: { c: [900, -230] as P2, w: 180, d: 140 },
  loop: { x0: 760, x1: 990, y0: -86, y1: 286 },
} as const;
/** A tether strip's width. */
export const TETHER_W = 16;
/**
 * The Watchdog: a vellum plan of an inspection station outside the system, south-east of the bays, its
 * scope and sightline aimed at the stuck bay (the fresh bay, W-10) and the pencil flag pinned on it.
 */
export const FLAG: P3 = [FRESH.box.x1 - 24, FRESH.box.y0 + 12, FRESH.wallH + 0.6];
export const WATCHDOG = { c: [790, -470] as P2, w: 190, d: 150, look: [FLAG[0], FLAG[1]] as P2 } as const;
/** Pencil "?" marks (open problems: STORYBOARD 10.1–10.3), at least 64 px on screen (about 100 u of glyph at 0.64×). */
export const QUERY_SIZE = 136;
export const QUERIES: readonly { at: P3; size: number }[] = [
  // beside the vellum tethers (a hijacked loop could reach every machine)
  { at: [1078, 318, 1], size: QUERY_SIZE },
  // beside the handle outline on the docs bay (stepping in mid-task), off its nameplate
  { at: [BAYS.docs.box.x0 + 150, BAYS.docs.box.y0 + 76, 34], size: QUERY_SIZE },
];
/** The pencil handle outline a running bay lacks (stepping in), on the docs bay's south wall, west of its nameplate's centre. */
export const HANDLE = { c: [BAYS.docs.box.x0 + 74, BAYS.docs.box.y0 + 17] as P2, w: 66, d: 28 } as const;
/** Where the chores docked as they were handed over: the key on the intake's gate, the sand-glass on the bug bay's job rail, the strut on the loop's sheet. */
export const DOCKED = {
  key: [GATE.bar.x1 + 8, GATE.bar.y1 + 30, 2] as P3,
  glass: [rectC(req.box)[0] + 54, req.box.y0 - 52, 5] as P3,
  spike: [SPIKE.x, SPIKE.y] as P2,
} as const;
/** The bug bay's job rail: a low graphite shelf along its south wall, with a back lip, that the sand-glass and its plate rest on. */
export const JOB_RAIL = { x0: req.box.x0 + 14, x1: req.box.x1 - 14, y0: DOCKED.glass[1] - 34, y1: DOCKED.glass[1] + 38, z: 5, lip: 11 } as const;
