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
import { BAYS, CHUTE, FEEDERS, GATE, GROOVES, MOUTH, REEL, SPIKE, THROAT, YOU, rectC, type P2, type P3, type Rect } from './layout.ts';
import { deskStateAt, type DeskState } from './state.ts';

/** The frames the summary's world is posed for (the sign-off, the rest, the idea labels). */
export const SPAN_D: readonly [number, number] = [5400, 5720];
/** The whole desk at 0.5×, settled by f5520 (the bar 69 ease-out), the vellum parts east of the system in view. */
export const FRAMING_D: Framing = { x: 120, y: 90, zoom: 0.5 };
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
  return { ...s, testsLight: 0, testsStep: 1, bugLight: 0, next: { ...s.next, light: 0 }, step: { amount: 1, ids: ['docsBay', 'bugBay'] } };
}

// ------------------------------------------------------------------------------------------------
// The route, as the request took it (world points, just above what it passes over)

const doorOf = (b: { door: readonly [number, number]; box: Rect }): P2 => [(b.door[0] + b.door[1]) / 2, b.box.y1 + 4];
const spout: P3 = [rectC(FEEDERS.chat)[0] + 90, rectC(FEEDERS.chat)[1] - 4, 18];
const req = BAYS.bug;
export const ROUTE_OUT: readonly P3[] = [
  spout,
  [-760, 390, 8],
  [-640, 330, 10],
  [GATE.bar.x0 - 6, (GATE.bar.y0 + GATE.bar.y1) / 2 - 20, GATE.h + 6],
  [-470, 258, 68],
  [THROAT.box.x0 + 10, rectC(THROAT.box)[1], THROAT.z[1] + 6],
  [-250, 226, 136],
  [40, 230, 136],
  [250, 212, 116],
  [GROOVES.bug[0][0], GROOVES.bug[0][1], 8],
  [GROOVES.bug[1][0], GROOVES.bug[1][1], 6],
  [GROOVES.bug[2][0], GROOVES.bug[2][1], 6],
  [doorOf(req)[0], doorOf(req)[1], 10],
  [rectC(req.box)[0] + 10, rectC(req.box)[1] + 20, 70],
];
export const ROUTE_HOME: readonly P3[] = [
  ROUTE_OUT[ROUTE_OUT.length - 1],
  [300, 60, 112],
  [40, 80, 134],
  [MOUTH.land[0], MOUTH.land[1], MOUTH.land[2] + 10],
  [CHUTE[0][0] + 6, CHUTE[0][1] + 8, CHUTE[0][2] + 10],
  ...CHUTE.slice(1).map((p): P3 => [p[0], p[1], p[2] + 8]),
  [rectC(YOU.inTray)[0], rectC(YOU.inTray)[1] + 6, YOU.top + 12],
];

// ------------------------------------------------------------------------------------------------
// East of the system, in vellum (proposed: STORYBOARD 9.1, 9.2) beside built graphite machines

/** The graphite machines a cloud loop would keep running (built), north to south, each with its daemon clip (vellum) beside it, on the loop's side. */
export const MACHINES: readonly { kind: 'server' | 'workstation' | 'laptop'; c: P2; w: number; d: number; h: number }[] = [
  { kind: 'server', c: [1250, 290], w: 130, d: 96, h: 46 },
  { kind: 'workstation', c: [1250, 70], w: 110, d: 120, h: 70 },
  { kind: 'laptop', c: [1250, -150], w: 140, d: 96, h: 10 },
];
export const CLIP_DX = -98;
/** The vellum sheets laid flat: the plan of the deck, the state cabinet, the cloud loop with its tethers to each clip. */
export const VELLUM = {
  plan: { c: [960, 500] as P2, w: 260, d: 170 },
  cabinet: { c: [930, -210] as P2, w: 190, d: 150 },
  loop: { c: [820, 70] as P2, a: 100, b: 100 },
} as const;
/** The Watchdog: a vellum inspection station outside the engraved system boundary, its sightline on the bays. */
export const WATCHDOG = { c: [660, -440] as P2, r: 70, look: [360, -60] as P2 } as const;
/** The engraved boundary: an arc round the system's south-east corner, the Watchdog outside it. */
export const BOUNDARY: readonly P2[] = [
  [-160, -370],
  [240, -340],
  [520, -280],
  [640, -170],
  [680, -40],
];
/** Pencil "?" marks (open problems: STORYBOARD 10.1–10.3), at least 64 px at 1× (so 80 u: 40 px at 0.5×). */
export const QUERIES: readonly { at: P3; size: number }[] = [
  // beside the vellum tethers (a hijacked loop could reach every machine)
  { at: [1100, 190, 1], size: 84 },
  // on the reel's outer windings (memory over months)
  { at: [REEL.x + REEL.r - 18, REEL.y + 40, 152], size: 72 },
  // on the split reel (shard the Router)
  { at: [REEL.x - 40, REEL.y + 130, 152], size: 72 },
  // on the docs bay's door, where a handle would be (stepping in mid-task)
  { at: [rectC(BAYS.docs.box)[0] + 20, BAYS.docs.box.y0 + 20, 32], size: 72 },
];
/** Where the chores docked as they were handed over: the key on the intake's gate, the sand-glass on the bug bay's job rail, the strut on the vellum loop. */
export const DOCKED = {
  key: [GATE.bar.x1 + 8, GATE.bar.y1 + 30, 2] as P3,
  glass: [rectC(req.box)[0] - 40, req.box.y0 - 52, 2] as P3,
  strut: [VELLUM.loop.c[0], VELLUM.loop.c[1] - VELLUM.loop.b, 1] as P3,
  spike: [SPIKE.x, SPIKE.y] as P2,
} as const;
