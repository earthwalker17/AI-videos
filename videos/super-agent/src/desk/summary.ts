/**
 * The summary at the sign-off rest (film frames from f5400; STORYBOARD 11.1, still (d) at f5520):
 * the whole system at 0.5×, the request's route traced once (vermilion out, green home), the
 * proposed parts east in vellum, the open problems in pencil. Pure: layout and state of what the
 * summary adds, as a function of the film frame and the cue sheet's events.
 */
import { clamp, easings } from '@aiv/core';
import type { CamPose } from '@aiv/remotion-kit';
import { cue } from '../cues.ts';
import { deskCamera, type Angle, type Framing } from './camera.ts';
import { BAYS, BELT, BENCH, CARD_C, CHUTE, DECK, FEEDERS, GATE, GROOVES, MOUTH, RAMP, SPIKE, THROAT, WINDOW, YOU, rectC, type P2, type P3 } from './layout.ts';
import { deskStateAt, type DeskState } from './state.ts';

/** The frames the summary's world is posed for (the sign-off, the rest, the idea labels). */
export const SPAN_D: readonly [number, number] = [5400, 5720];
/**
 * The whole desk, settled by f5520 (the bar 69 ease-out), the vellum parts east of the system in view.
 * Tightened from the storyboard's 0.5× to 0.64× so the system fills the frame (a framing decision the
 * brief accepts): every part, the Watchdog and "you · 你" included, inside title-safe.
 */
export const FRAMING_D: Framing = { x: 85, y: 20, zoom: 0.64 };
export const poseD = (_f: number, angle: Angle): CamPose => deskCamera(FRAMING_D, angle);

// ------------------------------------------------------------------------------------------------
// State: at the sign-off every bay has capped (its work light out) and steps down; the trace is the
// one thing that moves (STORYBOARD 11.1)


/** The stamp lands (cues.ts 'stamp', f5440); the route draws out, then home, one bar in all. */
export const STAMP_F = cue('stamp').frame;
export const TRACE_F = { out: [STAMP_F + 6, STAMP_F + 44] as const, home: [STAMP_F + 44, STAMP_F + 78] as const } as const;

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

/** The desk's state at the sign-off: every bay capped and stepped down, their work lights out. */
export function summaryDeskState(f: number): DeskState {
  const s = deskStateAt(f);
  return {
    ...s,
    testsLight: 0,
    testsStep: 1,
    bugLight: 0,
    // the request's bay finished in bar 68: every pin passed, dead still
    pins: s.pins.map(() => 1),
    next: { ...s.next, light: 0 },
    // every bay stepped down (W-10 too), and the Thread cord with them, so the route reads first
    step: { amount: 1, ids: ['docsBay', 'bugBay', 'freshBay', 'cord'] },
    // the Register's hooded lamp no longer lights the window: the one lit paper is the slip your stamp signed
    cache: s.cache ? { ...s.cache, lamp: 0.25 } : null,
  };
}

// ------------------------------------------------------------------------------------------------
// The route, as the request took it: inked into the beds of the channels it used (world points just
// above each bed), never across print, and the two flights it made as arcs

const along = (a: P3, b: P3, n: number, lift = 0): P3[] => Array.from({ length: n }, (_, i) => {
  const t = (i + 1) / n;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + lift];
});
const arc = (a: P3, b: P3, apex: number, n: number): P3[] => Array.from({ length: n }, (_, i) => {
  const t = (i + 1) / n;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + 4 * apex * t * (1 - t)];
});
const spout: P3 = [rectC(FEEDERS.chat)[0] + 70, rectC(FEEDERS.chat)[1] - 6, 4];
const req = BAYS.bug;
/** The bug bay's bench: its north edge (layout.ts BENCH). */
const BENCH_N = BENCH.top.y1;
/** The stub row's south edge: the top of the window frame's south bar, clear of every cell's print. */
const ROW_EDGE_Y = WINDOW.frame.y0 + WINDOW.bar / 2;
const RAIL_Y = DECK.y0 + 9;
const gate: P3 = [GATE.bar.x0 - 4, (GATE.bar.y0 + GATE.bar.y1) / 2 - 12, 2];
const beltIn: P3 = [BELT.from[0], BELT.from[1], BELT.from[2] + 2];
const beltOut: P3 = [BELT.to[0], BELT.to[1], BELT.to[2] + 2];
const head: P3 = [THROAT.box.x1 + 4, ROW_EDGE_Y + 4, WINDOW.z[1] + 1];
const rowEnd: P3 = [WINDOW.frame.x1 - 4, ROW_EDGE_Y, WINDOW.z[1] + 1];
const railW: P3 = [WINDOW.frame.x1 + 16, RAIL_Y, DECK.top + 1.5];
const railE: P3 = [RAMP.x - 9, RAIL_Y, DECK.top + 1.5];
/** Down the ramp's quarter pipe near its south cheek (centre (lip, lip), radius lip: surface z at u out from the rail). */
const RAMP_Y = (RAMP.y0 + RAMP.y1) / 2;
const rampAt = (u: number): P3 => [RAMP.x + u, RAMP_Y, RAMP.lip - Math.sqrt(Math.max(0, RAMP.lip ** 2 - (u - RAMP.lip) ** 2)) + 1.5];
const groove = GROOVES.bug.map((p): P3 => [p[0], p[1], 1.2]);
export const ROUTE_OUT: readonly P3[] = [
  spout,
  // along the feed, then over the gate's fingers and up the intake conveyor's bed
  [-760, 384, 3],
  [-650, 334, 3],
  gate,
  beltIn,
  ...along(beltIn, beltOut, 4),
  // through the throat, then east along the stub row's edge, never through its print
  [THROAT.box.x0 + 10, rectC(THROAT.box)[1] - 20, THROAT.z[1] + 2],
  head,
  ...along(head, rowEnd, 3),
  // down to the deck's south rail, east along its top to the dispatch ramp
  railW,
  ...along(railW, railE, 2),
  // round the corner along the east rail's top to the ramp's lip, down its quarter pipe's middle, along the bug bay's groove to its door
  [RAMP.x - 9, RAMP_Y, DECK.top + 1.5],
  [RAMP.x + 1, RAMP_Y, DECK.top + 1],
  ...[0.5, 6, 14, 24, 36, 50, 64].map(rampAt),
  ...groove,
  // in along the bay's west side, onto the bench west of its pins and onto the request's folder
  [req.box.x0 + 40, req.box.y1 - 40, BENCH.z[1] - 2],
  [BENCH.top.x0 + 6, BENCH_N - 18, BENCH.z[1] + 1.5],
  [BENCH.top.x0 + 34, BENCH_N - 52, BENCH.z[1] + 8.5],
];
/** The report port: the bay's work slot, where its report card leaves (state.ts CARD_C.from). */
export const REPORT_PORT: P3 = [CARD_C.from[0], CARD_C.from[1], 32];
const mouth: P3 = [MOUTH.land[0], MOUTH.land[1], MOUTH.land[2] + 6];
const chuteIn: P3 = [CHUTE[0][0] + 6, CHUTE[0][1] + 4, CHUTE[0][2] + 3];
const tray = YOU.inTray;
export const ROUTE_HOME: readonly P3[] = [
  REPORT_PORT,
  // the report's flight up to the mouth (an arc), then to the chute's head under the index arm
  ...arc(REPORT_PORT, mouth, 140, 16),
  [-290, 104, 116],
  chuteIn,
  // down the reply chute's bed and into your in-tray, stopping at its north edge beside the slip, never across its ID
  ...CHUTE.slice(1).map((p): P3 => [p[0], p[1], p[2] + 7]),
  [tray.x0 + 22, tray.y1 + 2, YOU.top + 9],
];

// ------------------------------------------------------------------------------------------------
// East of the system, in vellum (proposed: STORYBOARD 9.1, 9.2) beside built graphite machines

/**
 * The graphite machines a cloud loop would keep running (built), north to south, each its own
 * silhouette: a rack server (slot lines), a tower workstation (its vent column), a closed laptop (its
 * hinge). Each has its daemon clip (vellum) beside it on the loop's side; they stand at unequal
 * distances from the loop, so no two tethers are alike.
 */
export const MACHINES: readonly { kind: 'server' | 'workstation' | 'laptop'; c: P2; w: number; d: number; h: number }[] = [
  { kind: 'server', c: [1180, 300], w: 150, d: 92, h: 44 },
  { kind: 'workstation', c: [1290, 86], w: 64, d: 118, h: 112 },
  { kind: 'laptop', c: [1150, -150], w: 150, d: 100, h: 13 },
];
export const CLIP_DX = -110;
/** The vellum sheets laid flat: the plan of the deck, the state cabinet, the cloud loop (an open ring track) with its tethers to each clip. */
export const VELLUM = {
  plan: { c: [930, 470] as P2, w: 240, d: 160 },
  cabinet: { c: [900, -230] as P2, w: 180, d: 140 },
  loop: { c: [800, 90] as P2, a: 92, b: 92 },
} as const;
/** The Watchdog: a vellum inspection station outside the system, south-east of the bays, its sightline reaching in to them. */
export const WATCHDOG = { c: [700, -430] as P2, r: 66, look: [380, -70] as P2 } as const;
/** Pencil "?" marks (open problems: STORYBOARD 10.1–10.3), at least 64 px on screen (104 u at 0.64×). */
export const QUERIES: readonly { at: P3; size: number }[] = [
  // beside the vellum tethers (a hijacked loop could reach every machine)
  { at: [1020, 210, 1], size: 104 },
  // beside the handle outline on the docs bay (stepping in mid-task), off its nameplate
  { at: [BAYS.docs.box.x0 + 150, BAYS.docs.box.y0 + 64, 34], size: 104 },
];
/** The pencil handle outline a running bay lacks (stepping in), on the docs bay's south wall, west of its nameplate's centre. */
export const HANDLE = { c: [BAYS.docs.box.x0 + 74, BAYS.docs.box.y0 + 17] as P2, w: 66, d: 28 } as const;
/** Where the chores docked as they were handed over: the key on the intake's gate, the sand-glass on the bug bay's job rail, the strut on the vellum loop. */
export const DOCKED = {
  key: [GATE.bar.x1 + 8, GATE.bar.y1 + 30, 2] as P3,
  glass: [rectC(req.box)[0] - 40, req.box.y0 - 52, 2] as P3,
  strut: [VELLUM.loop.c[0], VELLUM.loop.c[1] - VELLUM.loop.b, 1] as P3,
  spike: [SPIKE.x, SPIKE.y] as P2,
} as const;
