/**
 * Beat 5, prompting each run, handed over (STORYBOARD 5.1-5.3, film f2320-2719): what the intake does at a film frame.
 * Pure: every value is a sum over the cue sheet's beat-5 events (cues.ts BEAT_5 and its cue events), which the score
 * sounds on the same frames (audio/keepUp.ts), so each contact frame below is the frame the picture's event lands on.
 *
 * - 5.1 the hand-over: on `trait-proactive` (f2340) the starter key lifts off your chore tray (4 f of anticipation: it
 *   lifts a hair and draws back), rises over 10 f in an arc toward the intake and drops into its dock beside the gate's
 *   bar on `key-dock` (f2356, a contact frame), lying flat where the summary keeps it (still (d)). The gate answers 2 f
 *   later (its fingers lift a hair and settle: it is armed) and your lamp dims a step with it (state.ts LAMP_DIMS). The
 *   Proactive plate goes with its chore: it slides out of your desk's north face like a drawer, across the slate toward
 *   the intake, and docks on `plate-proactive` (f2360). From here events trip the intake by themselves: each slip comes
 *   out of the chat spout on its own.
 * - 5.2 the two-stage filter: on `spike-in` (f2470) the spike stands up beside the gate out of its hatch, seating with
 *   a detent. Every slip of BEAT_5.slips leaves the spout 14 f before its frame `f` and is posted toward the gate,
 *   reaching it on `f`. Code (the Fast Path) drops most: such a slip lands across the gate's fingers on `f`, the fingers
 *   flip it (4 f, carried up on them), it flies over onto the spike and down its shaft, landing impaled on the pile on
 *   f + impale (12) as the pile grows (+13). A kept slip sails over the fingers onto the belt's foot on `f` (as MT1's
 *   did), rides the belt into the throat, where the loupe swings over the policy card (f+8, 4 f), scans it (12 f) and
 *   the punch notches the slip on f + notchAfter (26); it then feeds into the print head (3 f) and is gone under it.
 * - 5.3 (f2640-2719, no text): the filter goes on under bar 34's dolly; the last spiked slip lands at f2702.
 *
 * The world from the summary on (SPAN_D, f5400) draws the hand-over's end state itself (objects/Trace.tsx: the key at
 * the gate, the plate, the spike and its pile), so the state here ends there (`E5.until`).
 */
import { clamp, easings } from '@aiv/core';
import { BEAT_5, cue } from '../cues.ts';
import { FINGER_ROOT, FINGER_Y, KEY_DOCK, NEXT_SLIP, PROACTIVE_PLATE, PUNCH, SHEET, SPIKE, YOU, type P3, type Rect } from './layout.ts';
import { LOUPE_READ, polylineAt } from './state.ts';
import { CHORES, TRAY_Z } from './you.ts';

const sine = (t: number): number => easings.inOutSine(clamp(t));
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Beat 5's own frames (film frames), hung off the cue sheet's. */
export const E5 = {
  /** the key lifts off your tray (cue trait-proactive), anticipates 4 f, then flies and docks on key-dock */
  lift: cue('trait-proactive').frame,
  anticipate: 4,
  keyDock: BEAT_5.keyDock,
  /** the receiving part answers 2 f after the dock: the gate's fingers lift a hair; your lamp dims a step */
  answer: BEAT_5.keyDock + 2,
  /** the Proactive plate slides out of your desk (once the key is in the air) and docks on plate-proactive */
  plateOut: BEAT_5.plateDock - 14,
  plateDock: BEAT_5.plateDock,
  /** the spike's hatch: its leaves part (4 f), the spike rises (6 f) and seats with a detent on spike-in; the leaves close (4 f) */
  spikeOpen: BEAT_5.spikeIn - 10,
  spikeRise: BEAT_5.spikeIn - 6,
  spikeIn: BEAT_5.spikeIn,
  spikeClose: BEAT_5.spikeIn + 1,
  hatchFrames: 4,
  /** a slip leaves the spout this many frames before it reaches the gate; it is posted over the last `post` of them (MT1's timing) */
  out: 14,
  outFrames: 4,
  post: 11,
  /** the summary (f5400, summary.ts SPAN_D) draws the hand-over's end state itself */
  until: 5400,
} as const;

/** The key's 10 f rise of its 12 f flight (STORYBOARD 5.1: 4 f anticipation, 10 f rise, the arc, the dock). */
const RISE = 10;
const FLY = BEAT_5.keyDock - (cue('trait-proactive').frame + 4);

// ------------------------------------------------------------------------------------------------
// 5.1 the starter key

/** Where the key rests in your tray (YourDesk.tsx keyRest: its geometry is built there) and where it lies docked: its bow over the summary's (keyAt's bow 2 u south of its centre's line), on the slate. */
export const KEY_REST: P3 = [CHORES.key.c[0], CHORES.key.c[1], TRAY_Z.floor];
export const KEY_SEAT: P3 = [KEY_DOCK[0], KEY_DOCK[1] - 2, 0];
/** Its anticipation: it lifts a hair and draws back south, away from where it goes. */
const KEY_BACK: P3 = [0, -3, 2.5];
/** How high it hovers over its dock before the last drop, and the arc's height over its chord. */
const KEY_HOVER = 30;
const KEY_ARC = 54;

export interface KeyPose {
  /** where its rest point is (the tray's key geometry is drawn about KEY_REST) */
  p: P3;
  yaw: number;
  /** about x: its bow end up */
  tilt: number;
  /** its landing squash (0..0.03) */
  squash: number;
  /** how far above where it lies (its tray floor, then the slate) it is: its contact shadow opens as it lifts */
  lift: number;
}

/** The starter key's hand-over at film frame f: null before it lifts (your tray draws it) and from the summary on. */
export function keyAt(f: number): KeyPose | null {
  const E = E5;
  if (f < E.lift || f >= E.until) return null;
  if (f < E.lift + E.anticipate) {
    const t = sine((f - E.lift) / E.anticipate);
    const p = lerp3(KEY_REST, [KEY_REST[0] + KEY_BACK[0], KEY_REST[1] + KEY_BACK[1], KEY_REST[2] + KEY_BACK[2]], t);
    return { p, yaw: 0, tilt: -0.12 * t, squash: 0, lift: p[2] - KEY_REST[2] };
  }
  if (f < E.keyDock) {
    const a: P3 = [KEY_REST[0] + KEY_BACK[0], KEY_REST[1] + KEY_BACK[1], KEY_REST[2] + KEY_BACK[2]];
    const u = (f - E.lift - E.anticipate) / FLY;
    const h = RISE / FLY;
    if (u < h) {
      // the rise: across and up in an arc to hover over its dock
      const t = u / h;
      const s = sine(t);
      const z = a[2] + (KEY_SEAT[2] + KEY_HOVER - a[2]) * s + 4 * KEY_ARC * t * (1 - t);
      const p: P3 = [a[0] + (KEY_SEAT[0] - a[0]) * s, a[1] + (KEY_SEAT[1] - a[1]) * s, z];
      return { p, yaw: 0.3 * Math.sin(Math.PI * t), tilt: -0.12 * (1 - t) + 0.45 * Math.sin(Math.PI * t), squash: 0, lift: z - KEY_SEAT[2] };
    }
    // the drop into its dock, gathering speed
    const w = (u - h) / (1 - h);
    const z = KEY_SEAT[2] + KEY_HOVER * (1 - w * w);
    return { p: [KEY_SEAT[0], KEY_SEAT[1], z], yaw: 0, tilt: 0, squash: 0, lift: z - KEY_SEAT[2] };
  }
  // docked (a contact frame): its 3% squash, gone over 4 f
  return { p: KEY_SEAT, yaw: 0, tilt: 0, squash: 0.03 * Math.max(0, 1 - (f - E.keyDock) / 4), lift: 0 };
}

// ------------------------------------------------------------------------------------------------
// 5.1 the Proactive plate, out of your desk; 5.2 the spike's hatch (objects/Dispatch.tsx Hatch 'slate')

/**
 * The Proactive plate waits inside your desk's slab (its north edge 2 u in from the slab's north face, under the slab's top:
 * nothing of it shows) and slides out north, a drawer pushed out, to where it docks (layout.ts PROACTIVE_PLATE).
 */
export const PLATE_FROM_DY = YOU.slab.y1 - 2 - PROACTIVE_PLATE.box.y1;

/** The plate's offset north of its dock (u, <= 0) at f, and its settle; null before it moves and from the summary on. */
export function plateAt(f: number): { dy: number } | null {
  if (f < E5.plateOut || f >= E5.until) return null;
  return { dy: f >= E5.plateDock ? 0 : PLATE_FROM_DY * (1 - sine((f - E5.plateOut) / (E5.plateDock - E5.plateOut))) };
}

/** The spike's hatch: a little larger than its base (r 22), so the base rises through it and covers the hole once seated. */
export const SPIKE_HATCH: Rect = { x0: SPIKE.x - 23, x1: SPIKE.x + 23, y0: SPIKE.y - 23, y1: SPIKE.y + 23 };
/** How deep the spike waits under its hatch (nothing of it shows before the leaves part). */
export const SPIKE_DEPTH = 92;
/** The spike's base disc (r SPIKE.baseR, 4 u) and its tapered rod to SPIKE.h. */
export const SPIKE_BASE = 4;

export interface HatchState {
  /** the leaves parted (0 shut .. 1 open) */
  leaves: number;
  /** the hole in the slate is open (the hatch is drawn) */
  hole: boolean;
  /** how far below its seat the risen part is (u, <= 0) */
  dz: number;
  /** its landing squash (0..0.03) */
  squash: number;
}

function hatchAt(f: number, o: { open: number; rise: number; seat: number; close: number; depth: number; curve: (t: number) => number }): HatchState | null {
  if (f < o.open || f >= E5.until) return null;
  const H = E5.hatchFrames;
  const leaves = sine((f - o.open) / H) * (1 - sine((f - o.close) / H));
  const hole = f < o.close + H;
  const dz = f >= o.seat ? 0 : f < o.rise ? -o.depth : -o.depth * (1 - o.curve((f - o.rise) / (o.seat - o.rise)));
  const squash = f < o.seat ? 0 : 0.03 * Math.max(0, 1 - (f - o.seat) / 4);
  return { leaves, hole, dz, squash };
}

/** The spike: standing up out of its hatch, gathering speed, stopped dead by its detent on spike-in. */
export const spikeAt = (f: number): HatchState | null => hatchAt(f, { open: E5.spikeOpen, rise: E5.spikeRise, seat: E5.spikeIn, close: E5.spikeClose, depth: SPIKE_DEPTH, curve: (t) => clamp(t) ** 2 });

/** The spike's hole in the slate at f (gl/desk.ts DESK_HOLES' third slot, the docs bay's, shut long before). */
export const hatchHoleAt = (f: number): Rect | null => (spikeAt(f)?.hole ? SPIKE_HATCH : null);

// ------------------------------------------------------------------------------------------------
// 5.2 the slips, the fingers, the spike's pile, the loupe and the punch

/** How far the fingers flip (radians about their roots' N-S axis, tips up) and their stagger (south to north, frames). */
export const FLIP = { a: 1.0, up: 4, hold: 1, down: 3.5, stagger: 0.25 } as const;
/** The gate's answer to the key: each finger lifts a hair and settles (2 f up, 5 f down). */
const ANSWER = { a: 0.2, up: 2, down: 5 } as const;

/** The fingers' mean lag behind the first (the slip on them rides their mean angle). */
const MEAN_LAG = ((FINGER_Y.length - 1) / 2) * FLIP.stagger;

/** One finger's flip, `x` frames after its slip landed: up 4 f, a 1 f hold, back down by +8.5 (the next slip lands at +10 at the soonest). */
function flipCurve(x: number): number {
  const F = FLIP;
  if (x <= 0) return 0;
  if (x < F.up) return sine(x / F.up);
  if (x < F.up + F.hold) return 1;
  return 1 - sine((x - F.up - F.hold) / F.down);
}

/** Where a dropped slip lands across the gate's fingers: lying north-south, its centre 23 u west of their roots, tilted with their slope (east edge up). */
export const RACK: P3 = [FINGER_ROOT.x - 23, (FINGER_Y[0] + FINGER_Y[FINGER_Y.length - 1]) / 2, 25];
const RACK_ROLL = 0.17;
const RACK_HEADING = -Math.PI / 2;
/** A dropped slip over the spike's tip (it comes down the shaft from here) and the arc's height on the way. */
const OVER_TIP = SPIKE.h + 16;
const DROP_ARC = 38;
/** The share of its flight to over the tip; the rest is the fall down the shaft onto the pile. */
const OVER = 0.62;

/** state.ts SLIP_BELT's first two points (its own top-level array is read only inside functions: state.ts imports this module). */
const SLIP_BELT_A = NEXT_SLIP.gate;
const SLIP_BELT_B: P3 = [-394, 210, 112];

/** The k-th dropped slip's seat on the pile (its centre: on the base, a sheet a slip) and its turn. */
export function pileSeat(k: number): { p: P3; heading: number } {
  // turned by the golden angle from the one under it, within a quarter turn either way of how it lay across the fingers
  return { p: [SPIKE.x, SPIKE.y, SPIKE_BASE + 0.5 + k * SHEET], heading: ((k * 2.39996 + 0.35) % Math.PI) - Math.PI };
}

/** The slips in film order, with each dropped slip's place on the pile. */
export const SLIPS_5 = (() => {
  let k = 0;
  return BEAT_5.slips.map((s, i) => ({ i, f: s.f, keep: s.keep, k: s.keep ? -1 : k++ }));
})();

export interface FilterSlip {
  i: number;
  keep: boolean;
  p: P3;
  heading: number;
  /** nose up about its local y (radians) */
  slope: number;
  /** about its long axis (radians): its east edge up across the fingers */
  roll: number;
  /** its landing squash (0..1 of 3%) */
  squash: number;
  /** a kept slip, once the punch has notched it */
  notched: boolean;
  /** a dropped slip lying impaled on the pile */
  onPile: boolean;
  /** in the air (no contact shadow) */
  flying: boolean;
}

/** Rotate a point about the fingers' root axis (N-S, through FINGER_ROOT), tips up by `a`. */
function aboutRoot(p: P3, a: number): P3 {
  const x = p[0] - FINGER_ROOT.x;
  const z = p[2] - FINGER_ROOT.z;
  return [FINGER_ROOT.x + x * Math.cos(a) + z * Math.sin(a), p[1], FINGER_ROOT.z - x * Math.sin(a) + z * Math.cos(a)];
}

/** Out of the spout and posted toward the gate (MT1's motion, state.ts nextAt, a little less abrupt off the spout), landing on `to` at `f`. */
function postAt(now: number, f: number, to: P3, heading: number, roll: number): Omit<FilterSlip, 'i' | 'keep' | 'notched' | 'onPile'> {
  const E = E5;
  const t0 = f - E.out;
  if (now < f - E.post) {
    // inside the drum (its west end never shows past the drum's far wall), out of the spout's mouth
    const inSpout: P3 = [NEXT_SLIP.spout[0] - 60, NEXT_SLIP.spout[1], NEXT_SLIP.spout[2] + 2];
    return { p: lerp3(inSpout, NEXT_SLIP.spout, easings.outCubic(clamp((now - t0) / E.outFrames))), heading: 0, slope: 0, roll: 0, squash: 0, flying: true };
  }
  const t = clamp((now - (f - E.post)) / E.post);
  const u = easings.outQuad(t);
  const a = NEXT_SLIP.spout;
  const p: P3 = [a[0] + (to[0] - a[0]) * u, a[1] + (to[1] - a[1]) * u, a[2] + (to[2] - a[2]) * t + 4 * NEXT_SLIP.apex * t * (1 - t)];
  const landed = now - f;
  return { p, heading: heading * u, slope: -0.3 * (u - 0.5) * (u < 1 ? 1 : 0), roll: roll * u, squash: landed < 0 ? 0 : Math.max(0, 1 - landed / 3), flying: now < f };
}

/** Where a kept slip lands: on the belt 46 u up from MT1's landing, so the whole slip is past the gate's bar (MT1's lands with its tail over the bar). */
const KEEP_RUN = 46;
export const KEEP_LAND: P3 = (() => {
  const [a, b] = [SLIP_BELT_A, SLIP_BELT_B];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return [a[0] + ((b[0] - a[0]) * KEEP_RUN) / l, a[1] + ((b[1] - a[1]) * KEEP_RUN) / l, a[2] + ((b[2] - a[2]) * KEEP_RUN) / l];
})();
/** The rest of the belt from where it lands, into the throat (state.ts SLIP_BELT's points). */
const KEEP_BELT: readonly P3[] = [KEEP_LAND, SLIP_BELT_B, NEXT_SLIP.throat];

/** A kept slip (the Slow Path) at film frame `now`, or null once it is under the print head. MT1's next slip's motion, on its own frames. */
function keptAt(now: number, f: number, i: number): FilterSlip | null {
  const notched = now >= f + BEAT_5.notchAfter;
  const feed = f + BEAT_5.notchAfter + 2;
  if (now >= feed + 4) return null;
  const base = { i, keep: true, notched, onPile: false };
  if (now < f + 1) {
    return { ...base, ...postAt(now, f, KEEP_LAND, Math.atan2(KEEP_LAND[1] - NEXT_SLIP.spout[1], KEEP_LAND[0] - NEXT_SLIP.spout[0]), 0) };
  }
  if (now < feed) {
    // up the belt (linear transport) into the throat, where it waits on the throat's floor
    const { p, dir } = polylineAt(KEEP_BELT, clamp((now - f - 1) / 6));
    const h = Math.hypot(dir[0], dir[1]);
    const atThroat = now >= f + 7;
    return { ...base, p, heading: atThroat ? 0 : Math.atan2(dir[1], dir[0]), slope: atThroat ? 0 : Math.atan2(dir[2], h), roll: 0, squash: Math.max(0, 1 - (now - f) / 3), flying: false };
  }
  return { ...base, p: lerp3(NEXT_SLIP.throat, NEXT_SLIP.head, easings.inCubic(clamp((now - feed) / 3))), heading: 0, slope: 0, roll: 0, squash: 0, flying: false };
}

/** A dropped slip (the Fast Path) at film frame `now`: posted onto the fingers, flipped, over onto the spike, impaled on the pile. */
function droppedAt(now: number, f: number, i: number, k: number): FilterSlip {
  const base = { i, keep: false, notched: false };
  const seat = pileSeat(k);
  if (now <= f) return { ...base, onPile: false, ...postAt(now, f, RACK, RACK_HEADING, RACK_ROLL) };
  const impale = f + BEAT_5.impale;
  if (now >= impale) return { ...base, onPile: true, p: seat.p, heading: seat.heading, slope: 0, roll: 0, squash: Math.max(0, 1 - (now - impale) / 4), flying: false };
  const flipEnd = f + BEAT_5.flip;
  if (now < flipEnd) {
    // carried up on the fingers as they flip (the mean of their staggered angles)
    const a = FLIP.a * flipCurve(now - f - MEAN_LAG);
    return { ...base, onPile: false, p: aboutRoot(RACK, a), heading: RACK_HEADING, slope: 0, roll: RACK_ROLL - a, squash: 0, flying: false };
  }
  // thrown: an arc to over the spike's tip, then down its shaft onto the pile, gathering speed (turning to its seat's heading, levelling)
  const r = aboutRoot(RACK, FLIP.a * flipCurve(BEAT_5.flip - MEAN_LAG));
  const t = (now - flipEnd) / (impale - flipEnd);
  const rollFrom = RACK_ROLL - FLIP.a * flipCurve(BEAT_5.flip - MEAN_LAG);
  if (t < OVER) {
    const s = t / OVER;
    const e = easings.outQuad(s);
    const z = r[2] + (OVER_TIP - r[2]) * s + 4 * DROP_ARC * s * (1 - s);
    return { ...base, onPile: false, p: [r[0] + (SPIKE.x - r[0]) * e, r[1] + (SPIKE.y - r[1]) * e, z], heading: RACK_HEADING + (seat.heading - RACK_HEADING) * sine(s), slope: 0, roll: rollFrom * (1 - sine(s)), squash: 0, flying: true };
  }
  const w = (t - OVER) / (1 - OVER);
  return { ...base, onPile: false, p: [SPIKE.x, SPIKE.y, OVER_TIP - (OVER_TIP - seat.p[2]) * w * w], heading: seat.heading, slope: 0, roll: 0, squash: 0, flying: true };
}

/** Every slip of the filter at film frame `now` (in film order), those not yet out of the spout and those under the head left out. */
export function slipsAt(now: number): FilterSlip[] {
  if (now >= E5.until) return [];
  const out: FilterSlip[] = [];
  for (const s of SLIPS_5) {
    if (now < s.f - E5.out) continue;
    const x = s.keep ? keptAt(now, s.f, s.i) : droppedAt(now, s.f, s.i, s.k);
    if (x) out.push(x);
  }
  return out;
}

/** Each finger's angle (radians, tips up), south to north: the answer to the key, then a flip per dropped slip. */
export function fingersAt(f: number): number[] {
  return FINGER_Y.map((_, j) => {
    let a = 0;
    const x = f - E5.answer - j * FLIP.stagger;
    if (x > 0 && x < ANSWER.up + ANSWER.down) a += ANSWER.a * (x < ANSWER.up ? sine(x / ANSWER.up) : 1 - sine((x - ANSWER.up) / ANSWER.down));
    for (const s of SLIPS_5) if (!s.keep) a += FLIP.a * flipCurve(f - s.f - j * FLIP.stagger);
    return a;
  });
}

/** How many dropped slips the pile counts at f: each lands impaled on it on its impale frame and the pile has grown by it the frame after (STORYBOARD 5.2: +12, +13). */
export const pileAt = (f: number): number => SLIPS_5.filter((s) => !s.keep && f >= s.f + BEAT_5.impale + 1).length;

/** The loupe's swing for the kept slips (radians added to MT1's: they never overlap): onto the card (4 f), across its rules (12 f), home once the slip is notched. */
export function loupeAt5(f: number): number {
  const [a0, a1] = LOUPE_READ;
  let a = 0;
  for (const s of SLIPS_5) {
    if (!s.keep) continue;
    const loupe = s.f + 8;
    const scan = s.f + 12;
    const home = s.f + BEAT_5.notchAfter + 1;
    if (f >= loupe && f < scan) a += a0 * sine((f - loupe) / 4);
    else if (f >= scan && f < home) a += a0 + (a1 - a0) * sine((f - scan) / 12);
    else if (f >= home && f < home + 6) a += a1 * (1 - sine((f - home) / 6));
  }
  return a;
}

/** The punch's top (z) for the kept slips: out of the throat's cheek a beat before its notch, down on the slip's edge on it, back in (Dispatch.tsx punchZ's motion); null while hidden. */
export function punchAt5(f: number): number | null {
  for (const s of SLIPS_5) {
    if (!s.keep) continue;
    const n = s.f + BEAT_5.notchAfter;
    const out = sine((f - (n - 4)) / 3) * (1 - sine((f - (n + 1)) / 3));
    if (out <= 0) continue;
    const drop = Math.max(0, 1 - Math.abs(f - n) / 1.5);
    return PUNCH.hidden + PUNCH.out * out - PUNCH.drop * drop;
  }
  return null;
}

export interface Beat5State {
  key: KeyPose | null;
  plate: { dy: number } | null;
  spike: HatchState | null;
  slips: FilterSlip[];
  fingers: number[];
  pile: number;
  loupe: number;
  punch: number | null;
}

/** Beat 5 at film frame f (pure). */
export function beat5At(f: number): Beat5State {
  return { key: keyAt(f), plate: plateAt(f), spike: spikeAt(f), slips: slipsAt(f), fingers: fingersAt(f), pile: pileAt(f), loupe: loupeAt5(f), punch: punchAt5(f) };
}
