/**
 * Beat 4 after the turn (STORYBOARD 4.2-4.5, film f1644-2140): what the Register Desk does between the
 * reel's lock and MT1, every value a pure function of the film frame and every event one of the cue
 * sheet's (cues.ts BEAT_4) or a sub-step hung off one.
 *
 * The cue sheet is the contract: each cue frame is a CONTACT frame. The picture's event lands on it (the
 * hammer is down on the tape and the first ink shows, the arm seats in its notch, the hatch's leaves hit
 * their stops, the pen of the ink rule touches the card, the gauge lands face up, a card's first move shows),
 * and its anticipation runs in the frames before it. In cause order:
 * - 4.2 the request gathers in the old heap (its crease flattens, 1644-1647), slides out from under the pieces
 *   on it from the cue (1648), is posted over the gate onto the belt, rides up it, hops off its top into the
 *   throat (over the cheeks, turning to lie along the throat), and is pulled under the print head, which
 *   occludes it; the reel detents and the head comes down on the cue (1680): its row inks with the vermilion
 *   stub. The pieces that lay on it settle, and the old heap presses flat into the desk as pressed history,
 *   stepping down (it never drops through a hatch);
 * - 4.3 a grey-stock card slides in over the throat (the request torn three ways), is struck by an ink rule and
 *   slides off; everything else steps down while it is up (state.ts FOCUS_BEATS). The index arm seats toward the
 *   bug bay (1740); its groove is cut, its closed lid's leaves swing down into its pit and hit their stops on the cue
 *   (1760), its bench rises and its nameplate prints. The request rides out of the dispatch housing, down the ramp and
 *   along its groove, the door lifting before it, and hops over the pins onto its folder on the bench, which takes
 *   its vermilion; the work light ramps in. Its Thread subscription inks into its own row (1800);
 * - 4.4 the neck-collar gauge turns face up onto the throat (1826), its needle low; a ghost card (the Register
 *   with a bench bolted on, slips queuing at its throat) is struck (1920); a CI card and a chat slip asking for
 *   docs are stamped in as the next rows (1860, 1900); the index ticks on beats 2 and 4;
 * - 4.5 two more dispatches (arm 1990 / hatch 2000 tests, arm 2030 / hatch 2040 docs), each as the bug's: the
 *   carrier (the CI card, the docs slip) rides the groove, the door lifts before it, and it lands in the bay (the CI
 *   card on the tower's dossier, its context; the docs slip on the galley's type); the work light ramps in once it is in.
 * By f2140 the world is still (b)'s (state.ts deskStateAt reads `beat4At` for every frame).
 */
import { clamp, easings } from '@aiv/core';
import { Curve } from '@aiv/remotion-kit';
import { Easing } from 'remotion';
import { BEAT_4 } from '../cues.ts';
import { BAYS, BAY_FLOOR, BELT, BENCH, FEEDERS, GALLEY_TRAY, GROOVES, NEXT_SLIP, PINS, RAMP, REQUEST, SHEET, THROAT, TOWER, rectC, towerTop, type BayId, type P2, type P3 } from './layout.ts';
import { DETENT, SPRING, springAt } from './state.ts';

// ------------------------------------------------------------------------------------------------
// Curves and contacts

const sine = (t: number): number => easings.inOutSine(clamp(t));
const MOVE = Easing.bezier(0.2, 0, 0, 1);
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * A print head's stroke with its contact on frame `s`: it falls over the 2 f before (its anticipation), is down on
 * the tape on `s` and the frame after, and lifts over 2 f. Every stamp-in of the film from beat 4 on (state.ts MT1's).
 */
export const hammerStroke = (f: number, s: number): number => clamp((f - (s - 2)) / 2) * (1 - clamp((f - s - 2) / 2));
/** A stamp's ink spread (0..1 over 3 f), its first stage showing on the contact frame `s`. */
export const inkSpread = (f: number, s: number): number => clamp((f - s + 1) / 3);
/**
 * How long a detent's spring runs before it seats: spring-detent (zeta 0.9) is within 0.3% of its notch 7 f after it
 * starts and overshoots it by 0.1% the frame after, so a detent started 7 f before its cue clicks home on it.
 */
export const DETENT_LEAD = 7;
export const detentAt = (f: number, at: number): number => springAt(f, at - DETENT_LEAD, SPRING.detent);

// ------------------------------------------------------------------------------------------------
// The schedule

/** A stamp-in (TREATMENT Relationships): the reel detents and drives the tape one cell over the 7 f before the stamp (`detent`), the head comes down on `stamp` and the new print inks over 3 f from it. */
export interface StampIn {
  detent: number | null;
  stamp: number;
}

export const B4 = {
  /** 4.2: the request's rise (the cue: its slide out of the heap shows first on this frame) */
  requestRise: BEAT_4.requestRise,
  /** its stamp-in: the reel detents 7 f before the head comes down on the cue */
  requestIn: { detent: BEAT_4.requestIn - 7, stamp: BEAT_4.requestIn } as StampIn,
  /** the old heap presses flat into the desk once the request is in (spring-heavy), stepping down over 14 f */
  heapPress: BEAT_4.requestIn + 4,
  /** 4.3: the split card (in 12 f from the cue, struck on its cue, off 8 f after the strike) */
  split: { rise: BEAT_4.splitCard, strike: BEAT_4.splitStrike },
  armBug: BEAT_4.armBug,
  /** the bug dispatch: the groove cut (10 f), the leaves (4 f, open on the cue), the bench rising from the cue */
  bug: { cut: BEAT_4.armBug + 4, cutFrames: 10, rise: BEAT_4.dispatchBug },
  /** the Thread's subscription inks into the request's row (the head comes down on the cue; no tape advance) */
  threadRow: { detent: null, stamp: BEAT_4.threadRow } as StampIn,
  /** 4.4: the gauge lands face up on its cue */
  gauge: BEAT_4.gauge,
  ghost: { rise: BEAT_4.ghostCard, strike: BEAT_4.ghostStrike },
  /** the index keeps its detent on beats 2 and 4 under N2 (bar 23 beat 4 to bar 25 beat 2): each tick clicks home on its frame */
  ticks: [1820, ...BEAT_4.rows, 1940] as readonly number[],
  /** the arrivals the Register decides on, each stamped in as the next row (print.ts CELLS_BEFORE: the CI card for the tests, the chat slip asking for docs) */
  rows: [
    { kind: 'ci', stamp: BEAT_4.rows[0] },
    { kind: 'docs', stamp: BEAT_4.rows[1] },
  ] as const,
  /** 4.5 */
  armTests: BEAT_4.armTests,
  tests: { cut: BEAT_4.armTests + 1, cutFrames: 6, rise: BEAT_4.dispatchTests },
  armDocs: BEAT_4.armDocs,
  docs: { cut: BEAT_4.armDocs + 1, cutFrames: 6, rise: BEAT_4.dispatchDocs },
} as const;

/** A counterfactual's beats (TREATMENT element sheet): in 12 f, strike 6 f, off 8 f. */
export const CARD_RISE = 12;
export const CARD_STRIKE = 6;
export const CARD_EXIT = 8;

/** The hatch's leaves part over 4 f and hit their stops on the dispatch's cue; the bay rises only once they are open. */
export const HATCH_FRAMES = 4;
/** A beat-4 bay's lid: its leaves swing down over this many frames (gathering speed), hitting their stops on the dispatch's cue. */
export const LID_FRAMES = 8;
/** Frames after a bay's rise starts at which its hatch hole is closed again (the bay's floor plate covers it). */
export const HATCH_HOLD = 40;
/** One leaf of a beat-4 bay's lid: from its hinge on a wall's inner face to the seam (objects/Dispatch.tsx LidHatch). */
export const lidLeaf = (id: BayId): number => (BAYS[id].box.x1 - BAYS[id].box.x0 - 2 * BAYS[id].wall) / 2 - 1.2;
/**
 * How deep each bay's work waits under its hatch: its tallest part (the test tower capped) below the reach of its lid's
 * leaves as they swing down into the pit (objects/Dispatch.tsx Hatch 'lid': two leaves hinged at the walls' inner faces,
 * meeting at a 2.4 u seam), so nothing of it shows before the leaves part and no leaf ever swings through it.
 */
export const WORK_DEPTH: Record<BayId, number> = { tests: towerTop() + TOWER.dome + 8 + lidLeaf('tests'), docs: BAYS.docs.wallH + 8 + lidLeaf('docs'), bug: BENCH.z[1] + PINS.h + 6 + lidLeaf('bug') };

// ------------------------------------------------------------------------------------------------
// One dispatch move for every Worker

export interface HatchRise {
  /** the groove cut from the ramp's foot to the door (fraction of its length) */
  cut: number;
  /** the hatch's leaves parted (0 shut .. 1 open, on their stops) */
  hatch: number;
  /** the hole in the slate is open (the leaves are drawn in it) */
  hole: boolean;
  /** the bay's work risen out of its pit (0..1, spring-heavy) */
  rise: number;
  /** its contact shadow on the slate, tightening as it settles (0..1) */
  contact: number;
}

/**
 * The hatch and rise of a Worker dispatched on frame `rise` (its cue): the groove is cut over `cutFrames` from
 * `cut`, the leaves part over the 4 f before the cue and hit their stops on it, the work rises on spring-heavy from
 * it; the hole closes once the bay's floor covers it.
 */
export function hatchRiseAt(f: number, o: { cut: number; cutFrames: number; rise: number }): HatchRise {
  const cut = easings.outCubic(clamp((f - o.cut) / o.cutFrames));
  const open = o.rise - HATCH_FRAMES;
  const hatch = sine((f - open) / HATCH_FRAMES);
  const rise = springAt(f, o.rise, SPRING.heavy);
  const hole = f >= open && f < o.rise + HATCH_HOLD;
  // the last part of the rise's travel (it reaches 0.97 of its travel in about 14 f on spring-heavy): the contact closes in
  const contact = clamp((rise - 0.8) / 0.2);
  return { cut, hatch, hole, rise, contact };
}

export interface BayDispatch extends HatchRise {
  /** the door (0 shut .. 1 lifted) */
  door: number;
  /** the work light (0 idle, dark .. 1 computing) */
  light: number;
  /** the nameplate's print: -1 blank (closed, never dispatched), 0 and 1 its ink's first stages, 2 printed (it prints on the dispatch's cue) */
  plate: number;
}

const BAY_PLAN: Record<BayId, { cut: number; cutFrames: number; rise: number }> = { bug: B4.bug, tests: B4.tests, docs: B4.docs };

// ------------------------------------------------------------------------------------------------
// The dispatch rides: out of the housing, down the ramp, along the groove, through the door, onto the bay's work

/** A carrier's pose: centre, heading about z, slope (radians, nose up), its landing squash, its transit light. */
export interface Carry {
  p: P3;
  heading: number;
  slope: number;
  squash: number;
  transit: number;
}

/** A polyline's point and direction at a fraction of its length. */
function polyAt(pts: readonly P3[], s: number): { p: P3; dir: P3 } {
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1], q[2] - pts[i][2]));
  const total = seg.reduce((a, b) => a + b, 0);
  let d = clamp(s) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const t = seg[i] > 0 ? Math.min(d / seg[i], 1) : 0;
      return { p: lerp3(pts[i], pts[i + 1], t), dir: [(pts[i + 1][0] - pts[i][0]) / seg[i], (pts[i + 1][1] - pts[i][1]) / seg[i], (pts[i + 1][2] - pts[i][2]) / seg[i]] };
    }
    d -= seg[i];
  }
  return { p: pts[pts.length - 1], dir: [0, 0, 0] };
}
const polyLength = (pts: readonly P3[]): number => pts.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1], q[2] - pts[i][2]), 0);
/** The heading and slope along a polyline at arc length d, from a central difference over ±w (so they turn smoothly from segment to segment). */
function tangentAt(pts: readonly P3[], L: number, d: number, w = 10): { heading: number; slope: number } {
  const a = polyAt(pts, Math.max(0, d - w) / L).p;
  const b = polyAt(pts, Math.min(L, d + w) / L).p;
  return { heading: Math.atan2(b[1] - a[1], b[0] - a[0]), slope: Math.atan2(b[2] - a[2], Math.hypot(b[0] - a[0], b[1] - a[1])) };
}
/** The shortest turn from a to b (radians). */
const turnTo = (a: number, b: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

const RAMP_Y = (RAMP.y0 + RAMP.y1) / 2;
/** Riding height in a groove (its floor under the slate's surface). */
const GROOVE_Z = 1.4;
const grooveLine = (id: BayId): P3[] => new Curve(GROOVES[id].map((p) => [p[0], p[1]])).polyline(13).map((p): P3 => [p[0], p[1], GROOVE_Z]);

interface RidePlan {
  /** pushed out of the housing's slit from this frame (6 f), off the ramp's lip (6 f), along the groove and on over its path */
  out: number;
  grooveFrames: number;
  /** the carrier's half length along its heading */
  hl: number;
  /** from the ramp's foot along the groove to inside the door, then over the bay's parts onto its dock (riding heights) */
  path: P3[];
  /** where the groove ends on the path (arc length): before it the carrier runs at an even pace, after it it eases into its dock */
  grooveLen: number;
  /** the tail's frames: through the door and over the bay's parts onto its dock, from the groove's pace to rest */
  tailFrames: number;
  dock: P3;
  dockHeading: number;
}

/**
 * How a carrier lies along its groove: tail first (its heading the groove's tangent turned half round). Every groove leaves
 * the ramp's foot back west or south under the deck, so a carrier landing nose east would have to spin half round to run
 * nose first, then spin back to lie on its dock; tail first it turns only by the groove's own bends (and its last turn onto
 * its dock), as a card slid back along a channel does.
 */
const TAIL_FIRST = Math.PI;

/** A uniform Catmull-Rom through points (3D), its first tangent along `dir0`, sampled into `n` segments per span: the tail of a ride, so its tangent (its heading and slope) turns smoothly. */
function smoothTail(pts: readonly P3[], dir0: P3, n = 10): P3[] {
  const first: P3 = [pts[0][0] - dir0[0] * 20, pts[0][1] - dir0[1] * 20, pts[0][2] - dir0[2] * 20];
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const ext: P3[] = [first, ...pts, [2 * last[0] - prev[0], 2 * last[1] - prev[1], 2 * last[2] - prev[2]]];
  const out: P3[] = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1, 2].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)) as unknown as P3);
    }
  }
  out.push(last);
  return out;
}

/** How far along its path a carrier's heading looks either way (u): it turns through a groove's corners over twice this, never in a frame or two. */
const TURN_W = 40;
/** Frames out of the housing, off the ramp. */
const OUT_FRAMES = 6;
const RAMP_FRAMES = 6;

/** A ride's frames: out, ramp, groove, the path's tail into the dock. */
function rideFrames(r: RidePlan): { out: number; ramp: number; groove: number; tail: number; dock: number } {
  const ramp = r.out + OUT_FRAMES;
  const groove = ramp + RAMP_FRAMES;
  const tail = groove + r.grooveFrames;
  return { out: r.out, ramp, groove, tail, dock: tail + r.tailFrames };
}

/** A carrier on its dispatch ride at f (null before it leaves the housing); `light`: whether it carries the transit light. */
function rideAt(f: number, r: RidePlan, light: boolean): Carry | null {
  const F = rideFrames(r);
  if (f < F.out) return null;
  const from: P3 = [RAMP.x - r.hl - 1, RAMP_Y, 73];
  const outAt: P3 = [RAMP.x + 1 + r.hl + 3, RAMP_Y, 72.5];
  const transit = light ? clamp((f - F.out + 1) / 4) * clamp((F.dock - f) / 6) ** 2 : 0;
  if (f < F.ramp) return { p: lerp3(from, outAt, sine((f - F.out) / OUT_FRAMES)), heading: 0, slope: 0, squash: 0, transit };
  const lands = r.path[0];
  if (f < F.groove) {
    // off the lip: a fall down the quarter pipe, nose down (at most 0.2 rad a frame), levelling as it lands on the slate just
    // past the pipe's toe (its tail always over the pipe's sheet, never through it: beat4.test.ts)
    const t = clamp((f - F.ramp) / RAMP_FRAMES);
    return { p: [outAt[0] + (lands[0] - outAt[0]) * t, outAt[1] + (lands[1] - outAt[1]) * t, outAt[2] + (lands[2] - outAt[2]) * t * t], heading: 0, slope: -0.4 * Math.sin(Math.PI * t), squash: 0, transit };
  }
  const L = polyLength(r.path);
  if (f < F.tail) {
    // back from where it landed into the groove's start (tail first, so still heading east: no turn) and along the groove
    // at an even pace (linear transport), tail first (TAIL_FIRST), turning through its corners as the path does; going back
    // under the pipe's toe and the deck it slides under their sheets (hidden by them), as into a tunnel
    const d = (r.grooveLen * (f - F.groove)) / r.grooveFrames;
    const tan = tangentAt(r.path, L, d, TURN_W);
    return { p: polyAt(r.path, d / L).p, heading: turnTo(0, tan.heading + TAIL_FIRST), slope: 0, squash: 0, transit };
  }
  if (f < F.dock) {
    // the tail: on from the groove's pace (a cubic in its distance, so its speed never jumps) through the door and over the
    // bay's parts to rest on its dock; it turns to lie as it will and its leading end (its tail) follows the climb, levelling
    // as it lands
    const v = r.grooveLen / r.grooveFrames;
    const T = r.tailFrames;
    const u = clamp((f - F.tail) / T);
    const Lt = L - r.grooveLen;
    const d = r.grooveLen + (u * u * u - 2 * u * u + u) * v * T + (-2 * u * u * u + 3 * u * u) * Lt;
    const tan = tangentAt(r.path, L, d, 8);
    const hEnd = turnTo(0, tangentAt(r.path, L, r.grooveLen, TURN_W).heading + TAIL_FIRST);
    const settle = sine(u);
    const p = polyAt(r.path, d / L).p;
    // (never under its groove's floor where the curve leaves the groove)
    return { p: [p[0], p[1], Math.max(GROOVE_Z, p[2])], heading: hEnd + turnTo(hEnd, r.dockHeading) * settle, slope: -clamp(tan.slope, -0.6, 0.6) * 0.6 * sine(u / 0.3) * (1 - settle), squash: 0, transit };
  }
  // docked (it arrives at rest, the tail easing it in): its 3% landing squash at its deepest on the dock's frame, gone over 4 f
  const squash = Math.max(0, 1 - (f - F.dock) / 4);
  return { p: r.dock, heading: r.dockHeading, slope: 0, squash, transit: 0 };
}

/** Where the request docks: on its folder on the bench (layout.ts REQUEST), as objects/Bay.tsx draws it at rest. */
export const REQUEST_DOCK: P3 = [REQUEST.c[0], REQUEST.c[1], REQUEST.z - 0.3];
export const REQUEST_DOCK_HEADING = REQUEST.rot - Math.PI / 2;
/** Inside a door: its centre, a little in from the north wall, on the bay's floor. */
const insideDoor = (id: BayId, z = BAY_FLOOR + 1.4): P3 => [(BAYS[id].door[0] + BAYS[id].door[1]) / 2, BAYS[id].box.y1 - BAYS[id].wall - 6, z];
/**
 * Where the docs request lands: on the galley's type, inside its rails (the docs Worker sets its answer from it; on its
 * dossier it would lie under the notes in still (c)'s close).
 */
const GALLEY_DOCK: P3 = [0, 68, GALLEY_TRAY.z[0] + 5.3 + 0.5];
/** A dossier's top (its stack of sheets), where a task's carrier lands: its context. */
const dossierTop = (id: BayId): P3 => [rectC(BAYS[id].dossier)[0], rectC(BAYS[id].dossier)[1], BAY_FLOOR + 2 + BAYS[id].sheets * SHEET + 0.6];

/**
 * The three dispatch rides. The bug bay takes the request itself (its 136 u folder cannot pass the 56 u door: the
 * folder waits on the bench and takes the request's vermilion as it lands): through the door and up over the pins
 * onto its folder. The test tower takes the CI card that asked for its run, the docs galley the chat slip that asked
 * for docs: each through its door at the threshold's height and over its work slot, the CI card onto the tower's dossier (a
 * task is context), the docs slip onto the galley's type.
 */
export const RIDES: Record<BayId, RidePlan> = (() => {
  const plan = (id: BayId, out: number, grooveFrames: number, tailFrames: number, hl: number, over: P3[], dock: P3, dockHeading: number): RidePlan => {
    // it lands on the slate just past the pipe's toe (its tail clear of the sheet), then goes back into the groove's start
    const land: P3 = [RAMP.foot + hl - 2, RAMP_Y, GROOVE_Z];
    const groove = [land, ...grooveLine(id)];
    const end = groove[groove.length - 1];
    const before = groove[groove.length - 2];
    const l = Math.hypot(end[0] - before[0], end[1] - before[1], end[2] - before[2]);
    const tail = smoothTail([end, ...over, dock], [(end[0] - before[0]) / l, (end[1] - before[1]) / l, (end[2] - before[2]) / l]);
    return { out, grooveFrames, tailFrames, hl, path: [...groove, ...tail.slice(1)], grooveLen: polyLength(groove), dock, dockHeading };
  };
  return {
    // (each tail's heights clear what it passes over: the bench's pins at 84, the work slots' lips at 32, the galley at 16)
    bug: plan('bug', B4.bug.rise + 1, 20, 18, REQUEST.l / 2, [insideDoor('bug'), [314, 40, 102], [340, 2, 96]], REQUEST_DOCK, REQUEST_DOCK_HEADING),
    tests: plan('tests', B4.armTests + 2, 24, 18, 42, [[insideDoor('tests')[0], BAYS.tests.box.y1 - 4, 28], [-276, 100, 48], [-290, 20, 44]], dossierTop('tests'), 0),
    docs: plan('docs', B4.armDocs + 2, 20, 18, 48, [[insideDoor('docs')[0], BAYS.docs.box.y1 - 4, 30], [140, 104, 46], [60, 80, 40]], GALLEY_DOCK, 0),
  };
})();
/** Each ride's frames. */
export const RIDE_FRAMES: Record<BayId, ReturnType<typeof rideFrames>> = { bug: rideFrames(RIDES.bug), tests: rideFrames(RIDES.tests), docs: rideFrames(RIDES.docs) };
/** The request's ride (the bug dispatch). */
export const RIDE = { out: RIDE_FRAMES.bug.out, ramp: RIDE_FRAMES.bug.ramp, groove: RIDE_FRAMES.bug.groove, door: RIDE_FRAMES.bug.tail, dock: RIDE_FRAMES.bug.dock };

/** The frame a carrier's leading edge reaches its bay's north wall (scanned once): its door is fully up 4 f before it. */
const DOOR_REACH: Record<BayId, number> = (() => {
  const out = {} as Record<BayId, number>;
  for (const id of ['bug', 'tests', 'docs'] as const) {
    const F = RIDE_FRAMES[id];
    const B = BAYS[id];
    const door: P2 = [(B.door[0] + B.door[1]) / 2, B.box.y1];
    out[id] = F.dock;
    for (let f = F.groove; f < F.dock; f++) {
      // its nose (half its length ahead of its centre) at the door's gap in the north wall
      const c = rideAt(f, RIDES[id], false)!;
      if (Math.hypot(c.p[0] - door[0], c.p[1] - door[1]) < RIDES[id].hl + 12) {
        out[id] = f;
        break;
      }
    }
  }
  return out;
})();
/** When each door lifts (4 f, fully up 4 f before its carrier reaches it) and drops (4 f, from 6 f after it docks). */
export const DOOR_AT: Record<BayId, { up: number; down: number }> = {
  bug: { up: DOOR_REACH.bug - 8, down: RIDE_FRAMES.bug.dock + 6 },
  tests: { up: DOOR_REACH.tests - 8, down: RIDE_FRAMES.tests.dock + 6 },
  docs: { up: DOOR_REACH.docs - 8, down: RIDE_FRAMES.docs.dock + 6 },
};

/** Each bay's dispatch at film frame f. */
export function bayDispatchAt(f: number, id: BayId): BayDispatch {
  const h = hatchRiseAt(f, BAY_PLAN[id]);
  const D = DOOR_AT[id];
  const door = sine((f - D.up) / 4) * (1 - sine((f - D.down) / 4));
  const rise = BAY_PLAN[id].rise;
  // standing closed, its lid lies on the slate inside its shell (objects/Dispatch.tsx Hatch 'lid'): its leaves swing down
  // over the LID_FRAMES before the cue (the hole open from their first move) and hit their stops on it; its work light
  // ramps in once its task is in (spring-effects); its nameplate prints on its dispatch's cue
  const lidFrom = rise - LID_FRAMES;
  return {
    ...h,
    hatch: clamp((f - lidFrom) / LID_FRAMES),
    hole: f > lidFrom && f < rise + HATCH_HOLD,
    door,
    light: springAt(f, RIDE_FRAMES[id].dock + 2, SPRING.effects),
    plate: f < rise ? -1 : Math.min(2, f - rise),
  };
}

/** Whether a beat-4 bay's lid is drawn (objects/Dispatch.tsx Hatch 'lid'): closed, on the slate inside its shell, until its leaves have parted and its hole has closed again. */
export const lidShown = (d: BayDispatch): boolean => d.hole || d.rise <= 0;

/** The tests' and docs' carriers on their rides (and at rest on their dossiers): the CI card, the docs slip. */
export interface Carrier {
  id: 'tests' | 'docs';
  kind: 'ci' | 'chat';
  pose: Carry;
  docked: boolean;
}
export function carriersAt(f: number): Carrier[] {
  const out: Carrier[] = [];
  for (const id of ['tests', 'docs'] as const) {
    const pose = rideAt(f, RIDES[id], false);
    if (pose) out.push({ id, kind: id === 'tests' ? 'ci' : 'chat', pose, docked: f >= RIDE_FRAMES[id].dock + 12 });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// The tape: the rows printed since the turn

export interface TapeCell {
  kind: 'chat' | 'ci' | 'docs' | 'test';
  request?: boolean;
  /** the request's Thread subscription, inked into its row (no cord yet: design D1) */
  thread?: boolean;
}
/** The tape's states, newest cell first: each a stamp-in (the turn's first row at f1624, then beat 4's). */
export const TAPE_ROWS: readonly { cells: readonly TapeCell[]; at: StampIn }[] = [
  { cells: [{ kind: 'chat' }], at: { detent: null, stamp: 1620 } },
  { cells: [{ kind: 'chat', request: true }, { kind: 'chat' }], at: B4.requestIn },
  { cells: [{ kind: 'chat', request: true, thread: true }, { kind: 'chat' }], at: B4.threadRow },
  { cells: [{ kind: 'ci' }, { kind: 'chat', request: true, thread: true }, { kind: 'chat' }], at: { detent: B4.rows[0].stamp - 7, stamp: B4.rows[0].stamp } },
  { cells: [{ kind: 'docs' }, { kind: 'ci' }, { kind: 'chat', request: true, thread: true }, { kind: 'chat' }], at: { detent: B4.rows[1].stamp - 7, stamp: B4.rows[1].stamp } },
];

export interface TapeState {
  /** the state shown (TAPE_ROWS index; -1: the bare leader) */
  row: number;
  /** its ink stage: 0 and 1 the first two frames of the spread, 2 printed */
  stage: number;
  /** the tape driven on toward the reel by the next stamp-in's detent (0..1 of one cell) */
  advance: number;
}

/**
 * The tape at film frame f: the reel detents and the tape slides one cell east over the 7 f before a stamp (the old
 * print on it), the head comes down on the stamp's frame and the new state shows from it, its ink at its first
 * stage, then its second, then printed. (The turn's first row prints from f1624, its head having dropped at f1620.)
 */
export function tapeAt(f: number): TapeState {
  let row = -1;
  let stage = 2;
  for (let i = 0; i < TAPE_ROWS.length; i++) {
    const first = i === 0 ? 1624 : TAPE_ROWS[i].at.stamp;
    if (f >= first) {
      row = i;
      stage = Math.min(2, f - first);
    }
  }
  const next = TAPE_ROWS[row + 1];
  const advance = next && next.at.detent !== null ? sine((f - next.at.detent) / 7) : 0;
  return { row, stage, advance };
}

/** The print head's hammer at f for beat 4's stamp-ins (0 up .. 1 down): down on each stamp's frame. */
export function hammerAt(f: number): number {
  let h = 0;
  for (const r of TAPE_ROWS.slice(1)) h = Math.max(h, hammerStroke(f, r.at.stamp));
  return h;
}

/** The newest cell's light (the reading pool's stamp): lit as each print inks, out when the tape next moves on (the last one at MT1's detent, f2183). */
export function cellLitAt(f: number, nextDetent = 2183): number {
  const moving = TAPE_ROWS.slice(1).filter((r) => r.at.detent !== null);
  // the turn's first row lights from 1625 (its print's stages follow the turn's), beat 4's on their stamps
  const lights = [{ on: 1625, off: moving[0].at.detent! }, ...moving.map((r, i) => ({ on: r.at.stamp, off: i + 1 < moving.length ? moving[i + 1].at.detent! : nextDetent }))];
  let lit = 0;
  for (const l of lights) lit += springAt(f, l.on, SPRING.effects) - springAt(f, l.off, SPRING.effects);
  return clamp(lit);
}

// ------------------------------------------------------------------------------------------------
// The reel

/** Beat 4's detents (each stamp-in that drives the tape on). */
export const REEL_DETENTS: readonly number[] = TAPE_ROWS.slice(1).flatMap((r) => (r.at.detent === null ? [] : [r.at.detent]));
/** One detent's turn (radians, clockwise): as MT1's (objects/Register.tsx turns the reel -0.26 a detent). */
export const DETENT_TURN = 0.26;
/**
 * Where the coil ends its spin at the lock (radians past whole turns, counter-clockwise): beat 4's detents then
 * bring the reel to rest at the Register's own angle (0) by MT1, so still (b)'s reel is the lookdev's.
 */
export const REEL_LOCK = DETENT_TURN * REEL_DETENTS.length;
/** The reel's angle at f (radians, counter-clockwise, 0 at the Register's rest from MT1 on): each detent seats as its stamp comes down. */
export function reelAt(f: number): number {
  return REEL_LOCK - DETENT_TURN * REEL_DETENTS.reduce((a, t) => a + springAt(f, t, SPRING.detent), 0);
}
/** The request's stub on the reel's top inks with its row: its first stage on the stamp's frame, then printed (2); -1 before. */
export function stubAt(f: number): number {
  const s = B4.requestIn.stamp;
  return f < s ? -1 : Math.min(2, f - s);
}
/**
 * The notes loop's clip and tabs, riding the reel since the lock, are wound in as the request's detent turns
 * it: drawn in toward the hub and down under the pack's top (0 riding .. 1 gone); null once gone.
 */
export function ridersAt(f: number): { sink: number } | null {
  const d = B4.requestIn.detent!;
  if (f >= d + 7) return null;
  return { sink: sine((f - d) / 7) };
}

// ------------------------------------------------------------------------------------------------
// The index arm and the gauge

/** The arm's detents in beat 4 (from the turn's, at the test tower's notch): toward each bay as it is dispatched (read lazily: state.ts and this module import each other). */
const armSteps = (): readonly { at: number; to: number }[] => [
  { at: B4.armBug, to: DETENT.bug },
  { at: B4.armTests, to: DETENT.tests },
  { at: B4.armDocs, to: DETENT.docs },
];
/** How far a beat's tick lifts the arm off its notch (radians: about 9 u at its tip, 8 px). */
export const TICK = 0.14;
/**
 * The arm's angle at f (radians): each detent seats on its cue (spring-detent from 7 f before); under N2 a tick on
 * beats 2 and 4: the arm lifts off its notch (4 f) and clicks back into it on the beat.
 */
export function armAt(f: number): number {
  let a = DETENT.tests;
  for (const s of armSteps()) a += (s.to - a) * detentAt(f, s.at);
  const tick = B4.ticks.reduce((t, at) => t + springAt(f, at - DETENT_LEAD - 4, SPRING.detent) - detentAt(f, at), 0);
  return a + TICK * tick;
}
/** Where the arm rests once beat 4 is over (MT1 turns it from here to you). */
export const armRest = (): number => DETENT.docs;

/** The neck-collar gauge (design D5: an arc gauge): its needle low (the queue is short). */
export const GAUGE = { low: Math.PI * 0.86 } as const;
/** The gauge turns face up over the 8 f before its cue (accelerating, as a plate laid down), landing on it; face down (pi, its graphite back up) before. */
export const GAUGE_FLIP = 8;
export const gaugeFlipAt = (f: number): number => Math.PI * (1 - easings.inQuad(clamp((f - (B4.gauge - GAUGE_FLIP)) / GAUGE_FLIP)));

// ------------------------------------------------------------------------------------------------
// Cargo on the intake: the request, the arrivals

/** The belt's surface line, as carriers ride it (8 u over its centreline): from its foot by the gate up to its top at the throat. */
const BELT_A: P3 = [BELT.from[0], BELT.from[1], BELT.from[2] + 8];
const BELT_B: P3 = [BELT.to[0], BELT.to[1], BELT.to[2] + 8];
export const BELT_HEADING = Math.atan2(BELT_B[1] - BELT_A[1], BELT_B[0] - BELT_A[0]);
export const BELT_SLOPE = Math.atan2(BELT_B[2] - BELT_A[2], Math.hypot(BELT_B[0] - BELT_A[0], BELT_B[1] - BELT_A[1]));
const beltAt = (t: number): P3 => lerp3(BELT_A, BELT_B, t);
/** The throat's floor (a carrier lying in it, between its cheeks), and how high a carrier hops off the belt's top into it. */
const THROAT_Y = (THROAT.box.y0 + THROAT.box.y1) / 2;
const THROAT_Z = 118.8;
const HOP_APEX = 36;

/** The intake ride every arrival shares, for a carrier of half sizes [hl, hw]: where it lands on the belt, where it leaves it, where it lies in the throat and where it is hidden under the head. */
function intakeStations(hl: number, hw: number): { land: P3; crest: P3; throat: P3; hidden: P3 } {
  const ch = Math.cos(BELT_HEADING);
  const sh = Math.abs(Math.sin(BELT_HEADING));
  const along = hl * Math.cos(BELT_SLOPE);
  // it lands with its tail clear of the gate's bar (its east face at x -552) ...
  const landX = GATE_EAST + 4 + along * ch + hw * sh;
  // ... and leaves the belt (hops) before its nose reaches the throat's cheeks (x -400)
  const crestX = THROAT.box.x0 - 6 - along * ch - hw * sh;
  const tOf = (x: number) => (x - BELT_A[0]) / (BELT_B[0] - BELT_A[0]);
  return { land: beltAt(tOf(landX)), crest: beltAt(tOf(crestX)), throat: [THROAT.box.x1 - hl - 1, THROAT_Y, THROAT_Z], hidden: [THROAT.box.x1 + hl + 3, THROAT_Y, THROAT_Z] };
}
const GATE_EAST = -552;

interface IntakePlan {
  from: P3;
  fromHeading: number;
  hl: number;
  hw: number;
  /** frames: posted over the gate, up the belt, the hop into the throat, a hold, pulled under the head */
  post: number;
  postFrames: number;
  beltFrames: number;
  hopFrames: number;
  feedFrames: number;
  apex: number;
}
/** Its frames, from the post's start. */
function intakeFrames(o: IntakePlan): { belt: number; hop: number; inThroat: number; feed: number; hidden: number } {
  const belt = o.post + o.postFrames;
  const hop = belt + o.beltFrames;
  const inThroat = hop + o.hopFrames;
  const feed = inThroat + 1;
  return { belt, hop, inThroat, feed, hidden: feed + o.feedFrames };
}

/**
 * Posted over the gate onto the belt (an arc, landing with a 3% squash), up the belt at its pace, off its top in a
 * hop over the throat's cheeks (turning to lie along the throat as it goes, down between them), then pulled east
 * under the print head, which occludes it. One body all the way: its heading and slope are continuous curves.
 * Null before the post and once it is under the head.
 */
function intakeRide(f: number, o: IntakePlan): Omit<Carry, 'transit'> | null {
  const F = intakeFrames(o);
  if (f < o.post || f > F.hidden) return null;
  const S = intakeStations(o.hl, o.hw);
  if (f < F.belt) {
    const u = clamp((f - o.post) / o.postFrames);
    const e = sine(u);
    const p = lerp3(o.from, S.land, e);
    return { p: [p[0], p[1], p[2] + 4 * o.apex * e * (1 - e)], heading: o.fromHeading + turnTo(o.fromHeading, BELT_HEADING) * e, slope: BELT_SLOPE * e, squash: 0 };
  }
  if (f < F.hop) {
    const squash = Math.max(0, 1 - (f - F.belt) / 3);
    return { p: lerp3(S.land, S.crest, (f - F.belt) / o.beltFrames), heading: BELT_HEADING, slope: BELT_SLOPE, squash };
  }
  if (f < F.inThroat) {
    // the hop: across fast, then down between the cheeks; it turns to lie along the throat in the first 70% of it
    const u = clamp((f - F.hop) / o.hopFrames);
    const xy = easings.outCubic(u);
    const e = sine(u / 0.7);
    const z = S.crest[2] + (S.throat[2] - S.crest[2]) * u + 4 * HOP_APEX * u * (1 - u);
    return { p: [S.crest[0] + (S.throat[0] - S.crest[0]) * xy, S.crest[1] + (S.throat[1] - S.crest[1]) * xy, z], heading: BELT_HEADING * (1 - e), slope: BELT_SLOPE * (1 - e), squash: 0 };
  }
  // in the throat (landed with a squash), then pulled under the head
  const squash = Math.max(0, 1 - (f - F.inThroat) / 3);
  const u = clamp((f - F.feed) / o.feedFrames);
  return { p: lerp3(S.throat, S.hidden, easings.inQuad(u)), heading: 0, slope: 0, squash };
}

export interface Arrival {
  kind: 'chat' | 'ci';
  pose: Carry;
}
/** A CI card's mouth: it is pushed out from under the card lying in the feeder's mouth (4 f). */
const CI_OUT: { from: P3; to: P3 } = { from: [FEEDERS.ci.x1 - 30, rectC(FEEDERS.ci)[1] - 2, 5.2], to: [FEEDERS.ci.x1 + 30, rectC(FEEDERS.ci)[1] - 2, 5.2] };
/** A chat slip comes out of the spout from inside its drum (as MT1's next slip). */
const SPOUT_OUT: { from: P3; to: P3 } = { from: [NEXT_SLIP.spout[0] - 60, NEXT_SLIP.spout[1], NEXT_SLIP.spout[2] + 2], to: NEXT_SLIP.spout };
/** An arrival's plan for its stamp on frame `stamp`: under the head 6 f before it (the reel's detent drives the tape on as it goes in). */
function arrivalPlan(kind: 'ci' | 'chat', stamp: number): IntakePlan & { emerge: number } {
  const [hl, hw] = kind === 'ci' ? [42, 25] : [NEXT_SLIP.l / 2, NEXT_SLIP.w / 2];
  const frames = { postFrames: 12, beltFrames: 5, hopFrames: 6, feedFrames: 4 };
  const post = stamp - 6 - frames.feedFrames - 1 - frames.hopFrames - frames.beltFrames - frames.postFrames;
  return { from: (kind === 'ci' ? CI_OUT : SPOUT_OUT).to, fromHeading: 0, hl, hw, post, apex: NEXT_SLIP.apex, emerge: post - 4, ...frames };
}

/** The arrivals in transit at f: each out of its feeder (4 f), posted over the gate, up the belt, into the throat and under the head before its stamp. */
export function arrivalsAt(f: number): Arrival[] {
  const out: Arrival[] = [];
  for (const r of B4.rows) {
    const kind = r.kind === 'ci' ? 'ci' : 'chat';
    const o = arrivalPlan(kind, r.stamp);
    const src = kind === 'ci' ? CI_OUT : SPOUT_OUT;
    if (f >= o.emerge && f < o.post) out.push({ kind, pose: { p: lerp3(src.from, src.to, easings.outCubic(clamp((f - o.emerge) / 4))), heading: 0, slope: 0, squash: 0, transit: 0 } });
    else {
      const p = intakeRide(f, o);
      if (p) out.push({ kind, pose: { ...p, transit: 0 } });
    }
  }
  return out;
}

/** The request in the old heap (actOne.ts REQUEST_A and requestZ, which beat4.test.ts holds this equal to): creased, its east flap lifted; z its underside, on top of the heap. */
export const REQUEST_HEAP = { c: [-762, 150] as P2, rot: 0.38, z: 7.9 } as const;
/** The request's frames: it gathers (its crease flattens) from `from`, slides out from the cue, is posted, rides, hops into the throat and is pulled under the head. */
export const REQUEST_RIDE = (() => {
  const from = B4.requestRise - 4;
  const slide = B4.requestRise - 1;
  const post = slide + 4;
  const plan: IntakePlan = { from: [0, 0, 0], fromHeading: REQUEST_HEAP.rot, hl: REQUEST.l / 2, hw: REQUEST.w / 2, post, postFrames: 9, beltFrames: 6, hopFrames: 6, feedFrames: 5, apex: 60 };
  return { from, slide, post, plan, ...intakeFrames(plan) };
})();
/** The first frame the request differs from act one's pose in the heap (its crease starts to flatten): whoever draws it from here draws it through `requestAt`. */
export const REQUEST_FROM = REQUEST_RIDE.from + 1;

/** The request's crease while it rides the intake: a slight curl of act one's (its flap lifted a little). */
export const CREASE_RIDE = 0.3;

export interface RequestState {
  /** where it is; null while it is inside the Register (under the head, waiting in the housing) or once docked on the bench (objects/Bay.tsx draws it there) */
  pose: Carry | null;
  /** its crease (the east flap's lift, 0 flat .. 1 act one's) */
  crease: number;
}

export function requestAt(f: number): RequestState {
  const R = REQUEST_RIDE;
  const heap: P3 = [REQUEST_HEAP.c[0], REQUEST_HEAP.c[1], REQUEST_HEAP.z];
  const axis: P2 = [Math.cos(REQUEST_HEAP.rot), Math.sin(REQUEST_HEAP.rot)];
  const slid: P3 = [heap[0] + axis[0] * 46, heap[1] + axis[1] * 46, heap[2]];
  // the light through its beetle, while it moves: in over 4 f from the cue, out over the 6 f before it is under the head
  const transit = clamp((f - R.slide) / 4) * clamp((R.hidden - f) / 6) ** 2;
  // it gathers: its crease flattens to a slight curl (paper, never a flat card), which it keeps all the way to the head
  const crease = 1 - (1 - CREASE_RIDE) * sine((f - R.from) / 3);
  if (f < R.slide) return { pose: { p: heap, heading: REQUEST_HEAP.rot, slope: 0, squash: 0, transit: 0 }, crease };
  if (f < R.post) {
    // it slides out from under the pieces on it along its own axis, gathering speed (its first move shows on the cue)
    const u = easings.inQuad(clamp((f - R.slide) / (R.post - R.slide)));
    return { pose: { p: lerp3(heap, slid, u), heading: REQUEST_HEAP.rot, slope: 0, squash: 0, transit }, crease };
  }
  const ride = f <= R.hidden ? intakeRide(f, { ...R.plan, from: slid }) : null;
  if (ride) return { pose: { ...ride, transit }, crease };
  // inside the Register until it is dispatched: then out of the housing's slit, down the ramp, along its groove, onto its folder
  const D = RIDE_FRAMES.bug;
  if (f < D.out || f >= D.dock + 12) return { pose: null, crease: 0 };
  return { pose: rideAt(f, RIDES.bug, true), crease: 0 };
}

/** The folder on the bench takes the request's vermilion as it lands on it (0 its own stock .. 1 vermilion). */
export const folderTakeAt = (f: number): number => springAt(f, RIDE.dock, SPRING.effects);

// ------------------------------------------------------------------------------------------------
// The old heap

export interface HeapState {
  /** the request has left it: the pieces that lay on it settle onto what is under them (0..1) */
  settle: number;
  /** pressed flat into the desk as history (0 as act one left it .. 1 pressed), and stepped down with it (0..1) */
  press: number;
  step: number;
  /** whether its pieces still cast (footprints.ts heapFootprintsAt): once pressed flat their shadows have drawn in under them, and they stop */
  cast: boolean;
}
export function heapAt(f: number): HeapState {
  // its tail clears them on the slide's last frame
  const settle = sine((f - (REQUEST_RIDE.post - 1)) / 3);
  return { settle, press: springAt(f, B4.heapPress, SPRING.heavy), step: sine((f - B4.heapPress) / 14), cast: f < B4.heapPress + HEAP_CAST };
}
/** Frames after the press starts that the pressed pieces stop casting: spring-heavy is within 0.2% of flat by then, their shadows drawn in under them. */
export const HEAP_CAST = 24;

/** How much a pressed heap keeps of its pieces' heights over the slate (their order in the stack kept, 0.12 u a layer). */
const PRESS_KEEP = 0.08;
/** A piece's underside over the slate once pressed, for a piece at the heap's foot. */
const PRESS_FOOT = 0.15;
/** The pieces that lay on the request lay this much higher than its underside (act one's heap build: the request is 1.8 u under them). */
export const ON_REQUEST = 1.8;
/**
 * A heap piece's pose as the heap settles and presses (pure; objects/Turn.tsx Backlog draws it, footprints.ts casts it):
 * `z` its underside as act one laid it, `onRequest` whether it lay on the request (it settles onto what is under it as the
 * request slides out: no floating pieces); returns its underside's height and how thick it still is (0..1).
 */
export function heapPieceAt(z: number, onRequest: boolean, h: HeapState): { z: number; k: number } {
  const z1 = onRequest ? z - ON_REQUEST * h.settle : z;
  const flat = PRESS_FOOT + Math.max(0, z1 - 0.4) * PRESS_KEEP;
  return { z: z1 + (flat - z1) * h.press, k: 1 - 0.6 * Math.min(1, h.press) };
}

// ------------------------------------------------------------------------------------------------
// Counterfactual cards (objects/Counterfactual.tsx)

export interface CardState {
  /** in (0..1, the enter curve over 12 f, its first move on the rise cue), struck (the ink rule 0..1 over 6 f, its pen touching on the strike cue), off (0..1, the exit curve over 8 f) */
  rise: number;
  strike: number;
  exit: number;
  /** frames since it settled (its own play: the split's pieces heading for their bays, the ghost's backlog queuing) */
  play: number;
}
/** A counterfactual in on `rise`, struck on `strike`; null outside its life (off frame). */
export function cardAt(f: number, c: { rise: number; strike: number }): CardState | null {
  const start = c.rise - 1;
  const struck = c.strike - 1;
  const off = struck + CARD_STRIKE;
  if (f <= start || f >= off + CARD_EXIT) return null;
  // in on the move curve (from beyond the frame's edge: easing in, so its first frames show it sliding into the frame,
  // never jumping most of the way in one); off over its 8 f (the strike's last frame, then 7 more), easing in and out (it
  // slides off), its slide ending on the last frame it is drawn: it is wholly beyond the frame's top edge there, so it never
  // vanishes
  return { rise: MOVE(clamp((f - start) / CARD_RISE)), strike: clamp((f - struck) / CARD_STRIKE), exit: sine((f - off) / (CARD_EXIT - 1)), play: f - start - CARD_RISE };
}
/**
 * Where beat 4's cards play, lying back to face the camera (tilt from flat), 240 u up (over the head and the reading
 * lamp's hood): the split card over the throat (STORYBOARD 4.3); the ghost Router north of it, over the policy card, so
 * the arrivals riding the belt into the throat, the head and the window's newest cells stay in sight while the rows
 * stamp in under it (4.4). They come in from beyond the frame's top edge and go back off it: nothing appears or vanishes.
 */
export const CARD_SPOT = { tilt: 0.3, w: 300, h: 184 } as const;
export const CARD_AT: Record<'split' | 'ghost', { at: P3; off: P3 }> = {
  split: { at: [-392, 232, 240], off: [-392, 740, 240] },
  ghost: { at: [-420, 420, 240], off: [-420, 920, 240] },
};
/** A card's pose: its centre and its tilt from flat. */
export function cardPose(c: CardState, which: 'split' | 'ghost'): { c: P3; tilt: number; scale: number } {
  const { at, off } = CARD_AT[which];
  const k = c.rise * (1 - c.exit);
  return { c: lerp3(off, at, k), tilt: CARD_SPOT.tilt, scale: 1 };
}
/** How far a card is in (0 off frame .. 1 at its place): the light on it follows it (pools.ts). */
export const cardIn = (c: CardState | null): number => (c ? c.rise * (1 - c.exit) : 0);

// ------------------------------------------------------------------------------------------------
// The whole state

export interface Beat4State {
  bays: Record<BayId, BayDispatch>;
  tape: TapeState;
  hammer: number;
  cellLit: number;
  reel: number;
  stub: number;
  riders: { sink: number } | null;
  arm: number;
  /** the gauge: turned face up (0) from face down (pi), its needle */
  gauge: { flip: number; needle: number };
  request: RequestState;
  folderTake: number;
  arrivals: Arrival[];
  carriers: Carrier[];
  heap: HeapState;
  cards: { split: CardState | null; ghost: CardState | null };
  /** the test tower's lamps lit as its tests start (bottom up, 2 f apart, 4 f each) */
  lamps: number[];
}

/** Beat 4's state at film frame f (pure): before the turn's end it is the closed, idle world the turn leaves; after f2140 still (b)'s. */
export function beat4At(f: number): Beat4State {
  const bays = { bug: bayDispatchAt(f, 'bug'), tests: bayDispatchAt(f, 'tests'), docs: bayDispatchAt(f, 'docs') };
  const lampsOn = RIDE_FRAMES.tests.dock + 6;
  return {
    bays,
    tape: tapeAt(f),
    hammer: hammerAt(f),
    cellLit: cellLitAt(f),
    reel: reelAt(f),
    stub: stubAt(f),
    riders: ridersAt(f),
    arm: armAt(f),
    gauge: { flip: gaugeFlipAt(f), needle: GAUGE.low },
    request: requestAt(f),
    folderTake: folderTakeAt(f),
    arrivals: arrivalsAt(f),
    carriers: carriersAt(f),
    heap: heapAt(f),
    cards: { split: cardAt(f, B4.split), ghost: cardAt(f, B4.ghost) },
    lamps: [0, 1, 2].map((i) => sine((f - lampsOn - 2 * i) / 4)),
  };
}
