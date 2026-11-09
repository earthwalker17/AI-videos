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
import { BAYS, BELT, BENCH, CARD_C, CHUTE, DECK, FEEDERS, FRESH, GATE, GROOVES, INDEX, PRINT_HEAD, RAMP, REEL, REEL_FRAME, REEL_FRAME_Z, SPIKE, TAPE, TAPE_FLAT_X1, THROAT, WINDOW, YOU, rectC, type P2, type P3 } from './layout.ts';
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
// above each bed), never across print. Out (vermilion): the feed, the gate, the intake conveyor, through
// the print head, along the window's north bar and the tape onto the reel to the request's stub, over
// the frame and down the ramp's north lane and the groove's east lane into the bug bay. Home (green):
// from the bay's report port up the groove's west lane and the ramp's south lane, along the deck's
// rails to the window's south bar, through the print head, over the index arm's boss and out along the
// arm into the reply chute, down to your in-tray. The two share the groove and the ramp as two lanes.

const along = (a: P3, b: P3, n: number, lift = 0): P3[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + lift];
  });
const spout: P3 = [rectC(FEEDERS.chat)[0] + 70, rectC(FEEDERS.chat)[1] - 6, 4];
const req = BAYS.bug;
/** The window's north and south bars (their tops) and where the print head's faces are. */
const BAR_N_Y = WINDOW.frame.y1 - WINDOW.bar / 2;
const BAR_S_Y = WINDOW.frame.y0 + WINDOW.bar / 2;
const BAR_Z = WINDOW.z[1] + 1;
const HEAD = PRINT_HEAD.box;
const RAIL_Z = DECK.top + 1.5;
/** The east rail's middle and the south rail's. */
const RAIL_E_X = DECK.x1 - DECK.rail / 2;
const RAIL_S_Y = DECK.y0 + DECK.rail / 2;
/** The ramp's two lanes (north: out, south: home) and the groove's half-spacing between them. */
const LANE = { out: (RAMP.y0 + RAMP.y1) / 2 + 13, home: (RAMP.y0 + RAMP.y1) / 2 - 13, groove: 5 } as const;
/** Down the ramp's quarter pipe at lane y (centre (lip, lip), radius lip: surface z at u out from the rail). */
const rampAt = (u: number, y: number): P3 => [RAMP.x + u, y, RAMP.lip - Math.sqrt(Math.max(0, RAMP.lip ** 2 - (u - RAMP.lip) ** 2)) + 1.5];
const RAMP_U = [0.5, 6, 14, 24, 36, 50, 64] as const;
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
/** The reel's pack top, a point at radius r and angle a (world, from +x). */
const onPack = (r: number, a: number): P3 => [REEL.x + r * Math.cos(a), REEL.y + r * Math.sin(a), REEL.packZ[1] + 0.9];
/** The request's stub on the reel's outer turns, where the reel has turned it to by the sign-off (gl/text.ts reelTop: canvas -0.45 rad, two detents of 0.26). */
export const STUB_A = 0.45 - 2 * 0.26;
const FRAME_E_X = (REEL_FRAME[2].x0 + REEL_FRAME[2].x1) / 2;
const FRAME_Z = REEL_FRAME_Z[1] + 2;

const beltIn: P3 = [BELT.from[0], BELT.from[1], BELT.from[2] + 2];
const beltOut: P3 = [BELT.to[0], BELT.to[1], BELT.to[2] + 2];
const groove = grooveLane(LANE.groove);

export const ROUTE_OUT: readonly P3[] = [
  spout,
  // along the feed, over the gate's fingers and up the intake conveyor's bed
  [-760, 384, 3],
  [-650, 334, 3],
  [GATE.bar.x0 - 4, (GATE.bar.y0 + GATE.bar.y1) / 2 - 12, 2],
  beltIn,
  ...along(beltIn, beltOut, 4),
  // through the throat into the print head (hidden in it), out of its east face onto the window's north bar
  [THROAT.box.x0 + 10, rectC(THROAT.box)[1], THROAT.z[1] + 2],
  [HEAD.x0 + 2, rectC(THROAT.box)[1] + 8, THROAT.z[1] + 2],
  [HEAD.x1 - 6, BAR_N_Y, BAR_Z],
  [HEAD.x1 + 4, BAR_N_Y, BAR_Z],
  ...along([HEAD.x1 + 4, BAR_N_Y, BAR_Z], [WINDOW.frame.x1 - 4, BAR_N_Y, BAR_Z], 4),
  // down onto the bare tape east of the window, along it to the reel, up its rise onto the pack
  [WINDOW.frame.x1 + 10, TAPE.y1 - 12, TAPE.z + 1],
  [TAPE_FLAT_X1 - 30, (TAPE.y0 + TAPE.y1) / 2 + 2, TAPE.z + 1],
  [TAPE_FLAT_X1 - 2, (TAPE.y0 + TAPE.y1) / 2, TAPE.z + 1.2],
  [REEL.x - 4, REEL.y - REEL.packR + 2, REEL.packZ[1] - 6],
  // along the pack's outer turn to the request's stub
  ...[-1.5, -1.2, -0.9, -0.6, -0.35].map((a) => onPack(REEL.packR - 4, a)),
  onPack(REEL.packR - 6, STUB_A),
  // over the flange onto the frame's east member, south along its cap, down onto the east rail and the ramp's lip
  [REEL.x + REEL.r + 2, REEL.y + (REEL.r + 2) * Math.sin(STUB_A) - 4, REEL.flangeZ[1] + 2],
  [FRAME_E_X, REEL.y - 18, FRAME_Z],
  [FRAME_E_X, REEL_FRAME[2].y0 + 6, FRAME_Z],
  [RAIL_E_X, LANE.out + 6, RAIL_Z],
  [RAMP.x + 0.2, LANE.out, RAIL_Z - 0.5],
  // down the ramp's north lane, into the groove's east lane, through the bay's door onto the bench and the request's folder
  ...RAMP_U.map((u) => rampAt(u, LANE.out)),
  ...groove,
  [req.door[0] + 22, req.box.y1 - 4, req.wallH + 1],
  [req.box.x0 + 40, req.box.y1 - 40, BENCH.z[1] - 2],
  [BENCH.top.x0 + 6, BENCH.top.y1 - 18, BENCH.z[1] + 1.5],
  [BENCH.top.x0 + 34, BENCH.top.y1 - 52, BENCH.z[1] + 8.5],
];
/** The report port: the bay's work slot, where its report card leaves (state.ts CARD_C.from). */
export const REPORT_PORT: P3 = [CARD_C.from[0], CARD_C.from[1], 32];
/** The index arm's tip at your detent (the arm's top). */
const ARM_TIP: P3 = [INDEX.pivot[0] + (INDEX.length - 6) * Math.cos(DETENT.you), INDEX.pivot[1] + (INDEX.length - 6) * Math.sin(DETENT.you), INDEX.z + 6.5];
const tray = YOU.inTray;
export const ROUTE_HOME: readonly P3[] = [
  REPORT_PORT,
  // west along the slot block's top, over the door, into the groove's west lane
  [req.slot.x0 + 2, REPORT_PORT[1], 31],
  [req.door[1] - 14, req.box.y1 - 4, req.wallH + 1],
  ...grooveLane(-LANE.groove).reverse(),
  // up the ramp's south lane onto the east rail
  ...[...RAMP_U].reverse().map((u) => rampAt(u, LANE.home)),
  [RAMP.x + 0.2, LANE.home, RAIL_Z - 0.5],
  [RAIL_E_X, LANE.home - 4, RAIL_Z],
  // south along the east rail, west along the south rail
  [RAIL_E_X, RAIL_S_Y + 8, RAIL_Z],
  [RAIL_E_X - 10, RAIL_S_Y, RAIL_Z],
  ...along([RAIL_E_X - 10, RAIL_S_Y, RAIL_Z], [-104, RAIL_S_Y, RAIL_Z], 6),
  // north across the deck plate, east of the Continuous plate, up onto the window's south bar
  [-112, RAIL_S_Y + 14, DECK.top + 0.8],
  [-112, WINDOW.frame.y0 - 6, DECK.top + 0.8],
  [-120, BAR_S_Y, BAR_Z],
  // west along the south bar into the print head (hidden in it), out of its south face to the index arm's boss
  ...along([-120, BAR_S_Y, BAR_Z], [HEAD.x1 + 4, BAR_S_Y, BAR_Z], 4),
  [HEAD.x1 - 8, BAR_S_Y - 2, BAR_Z - 3],
  [INDEX.pivot[0], HEAD.y0 - 4, DECK.top + 1],
  [INDEX.pivot[0], INDEX.pivot[1] + 8, INDEX.z + 16],
  [INDEX.pivot[0] + 6 * Math.cos(DETENT.you), INDEX.pivot[1] + 6 * Math.sin(DETENT.you), INDEX.z + 16],
  // out along the arm to its tip, off it into the reply chute
  [INDEX.pivot[0] + 18 * Math.cos(DETENT.you), INDEX.pivot[1] + 18 * Math.sin(DETENT.you), INDEX.z + 7],
  ARM_TIP,
  [ARM_TIP[0] - 8, ARM_TIP[1] - 18, CHUTE[1][2] + 18],
  // down the reply chute's bed and into your in-tray, stopping at its north edge beside the slip, never across its ID
  ...CHUTE.slice(1).map((p): P3 => [p[0], p[1], p[2] + 7]),
  [tray.x0 + 22, tray.y1 + 2, YOU.top + 9],
];

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
