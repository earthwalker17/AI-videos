/**
 * Beat 5, prompting each run, handed over (STORYBOARD 5.1-5.3, film f2320-2719): what the intake does at a film frame.
 * Pure: every value is a sum over the cue sheet's beat-5 events (cues.ts BEAT_5 and its cue events), which the score
 * sounds on the same frames (audio/keepUp.ts), so each contact frame below is the frame the picture's event lands on.
 *
 * - 5.1 the hand-over: on `trait-proactive` (f2340) the starter key lifts off your chore tray (4 f of anticipation: it
 *   lifts a hair and draws back), rises over 10 f in an arc toward the intake and drops into its dock beside the gate's
 *   bar on `key-dock` (f2356, a contact frame), lying flat where the summary keeps it (still (d)). The gate answers 2 f
 *   later (its fingers lift a hair and settle: it is armed) and your lamp dims a step with it (state.ts LAMP_DIMS). The
 *   Proactive plate goes with its chore: it slides out of your desk's north face like a drawer, across the slate to the
 *   gate, and docks on `plate-proactive` (f2360) under the gate's fingers. From here events trip the intake by themselves:
 *   on each of BEAT_5.trips (under N3) an ask leaves the chat spout with no one prompting it and strikes the docked key on
 *   that frame (it lands across the key's shank); the key kicks a quarter turn about its bow and springs back (the
 *   score's dry tick), and the ask glances off it onto the belt (the gate is open: no filter yet), rides up into the
 *   throat and is fed under the print head (no tape row: the tape's history is beat 6's).
 * - 5.2 the two-stage filter: on `spike-in` (f2470) the spike stands up beside the gate out of its hatch, seating with
 *   a detent. Every slip of BEAT_5.slips reaches the gate on its frame `f`. Noise (each dropped slip carries the ink
 *   stamp a rule matches: a bot's post, a reaction alone, a duplicate, a CI ping) lands across the gate's fingers on `f`;
 *   the fingers flip it (4 f, carried up on the leading finger), it flies over onto the spike and down its shaft, landing
 *   impaled on the pile on f + impale (12) as the pile grows (+13). It never reaches the key: noise starts no run. An
 *   ask (a plain chat slip) passes the gate as the trips did: it strikes the key KICK_FLY frames before `f` (the key
 *   kicks again) and lands on the belt on `f`, rides into the throat, where the loupe swings over the policy card (f+8,
 *   4 f), scans it (12 f) and the punch notches the slip on f + notchAfter (26); it then feeds wholly under the print head (4 f).
 * - 5.3 (f2640-2719, no text): the filter goes on under bar 34's dolly; the last spiked slip lands at f2702.
 *
 * The world from the summary on (summary.ts SEAM_D, f5424) draws the hand-over's end state itself (objects/Trace.tsx: the key at
 * the gate, the plate, the spike and its pile), so the state here ends there (`E5.until`).
 */
import { clamp, easings } from '@aiv/core';
import { BEAT_5, cue } from '../cues.ts';
import { BAYS, FINGER_ROOT, FINGER_Y, GALLEY_TRAY, GATE, KEY_DOCK, NEXT_SLIP, PRINT_HEAD, PROACTIVE_PLATE, PUNCH, SHEET, SPIKE, THROAT, YOU, rectC, type P3, type Rect } from './layout.ts';
import { LOUPE_READ, SPRING, springAt } from './state.ts';
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
  /** the Proactive plate slides out of your desk (once the key is in the air) and docks on plate-proactive under the gate */
  plateOut: BEAT_5.plateDock - 15,
  plateDock: BEAT_5.plateDock,
  /** the spike's hatch: its leaves part (4 f), the spike rises (6 f) and seats with a detent on spike-in; the leaves close (4 f) */
  spikeOpen: BEAT_5.spikeIn - 10,
  spikeRise: BEAT_5.spikeIn - 6,
  spikeIn: BEAT_5.spikeIn,
  spikeClose: BEAT_5.spikeIn + 1,
  hatchFrames: 4,
  /** a slip leaves the spout this many frames before its first contact (the key, or the fingers); it is posted over the last `post` of them (MT1's timing) */
  out: 14,
  outFrames: 4,
  post: 11,
  /** the summary (from summary.ts SEAM_D, f5424; film.test holds them equal) draws the hand-over's end state itself */
  until: 5424,
} as const;

/** The key's 10 f rise of its 12 f flight (STORYBOARD 5.1: 4 f anticipation, 10 f rise, the arc, the dock). */
const RISE = 10;
const FLY = BEAT_5.keyDock - (cue('trait-proactive').frame + 4);

// ------------------------------------------------------------------------------------------------
// The filter's slips: the trips (5.1), then BEAT_5.slips (5.2)

/** How a slip goes: a trip (5.1, before the filter), an ask the gate keeps, or noise the gate drops onto the spike. */
export type SlipRole = 'trip' | 'keep' | 'drop';
/** Noise's kinds, each a stamp a rule can match (gl/print5.ts): a bot's post, a reaction alone, a duplicate, a CI status ping. */
export type NoiseKind = 'bot' | 'react' | 'dup' | 'ci';
const NOISE_ORDER: readonly NoiseKind[] = ['bot', 'react', 'dup', 'ci', 'react', 'bot', 'ci', 'dup', 'bot', 'dup', 'react', 'ci'];
/** How many print variants the asks cycle through (gl/print5.ts). */
export const ASK_PRINTS = 3;

export interface Slip5 {
  i: number;
  role: SlipRole;
  /** its cue frame: a trip's strike on the key; a kept slip's landing on the belt; a dropped slip's landing on the fingers */
  f: number;
  /** the frame it strikes the docked key (trips and kept slips), else null */
  strike: number | null;
  /** the frame it lands on the belt (trips and kept slips), else null */
  land: number | null;
  /** a dropped slip's place on the pile (0 first), else -1 */
  k: number;
  /** its print: an ask (one of ASK_PRINTS variants) or noise (its kind, and its own variant: no two alike) */
  print: { kind: 'ask'; v: number } | { kind: 'noise'; noise: NoiseKind; v: number };
}

/** An ask glances off the key and lands on the belt this many frames after it strikes it. */
export const KICK_FLY = 6;

/** The slips in film order (the trips, then the filter's), with each dropped slip's place on the pile and its print. */
export const SLIPS_5: readonly Slip5[] = (() => {
  const out: Slip5[] = [];
  let ask = 0;
  BEAT_5.trips.forEach((t) => out.push({ i: out.length, role: 'trip', f: t, strike: t, land: t + KICK_FLY, k: -1, print: { kind: 'ask', v: ask++ % ASK_PRINTS } }));
  let k = 0;
  for (const s of BEAT_5.slips) {
    if (s.keep) out.push({ i: out.length, role: 'keep', f: s.f, strike: s.f - KICK_FLY, land: s.f, k: -1, print: { kind: 'ask', v: ask++ % ASK_PRINTS } });
    else {
      out.push({ i: out.length, role: 'drop', f: s.f, strike: null, land: null, k, print: { kind: 'noise', noise: NOISE_ORDER[k % NOISE_ORDER.length]!, v: k } });
      k++;
    }
  }
  return out;
})();
/** Every frame a slip strikes the docked key on (the trips, then each kept slip's), in order. */
export const STRIKES: readonly number[] = SLIPS_5.flatMap((s) => (s.strike === null ? [] : [s.strike]));

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
/**
 * The docked key's kick when a slip strikes it: a quarter turn on the slate about its bow (the ring it hangs by in its
 * dock), its shank and bit swinging east, away from the gate's bar and from the slip glancing off south; out fast over
 * `out` frames and back on spring-effects (critically damped: home in about 4 f, never past it).
 */
export const KICK = { a: Math.PI / 2, out: 3 } as const;
/** The key's pivot for its kick: its bow's centre, relative to its rest point (on the slate). */
export const KEY_PIVOT: P3 = [0, CHORES.key.bowY, 0];

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

/** The docked key's kick (its yaw about its bow, radians) at film frame f: a quarter turn out from each strike and back. */
export function kickAt(f: number): number {
  let a = 0;
  for (const s of STRIKES) {
    const x = f - s;
    if (x <= 0 || x > 24) continue;
    a += x < KICK.out ? KICK.a * easings.outCubic(x / KICK.out) : KICK.a * (1 - springAt(f, s + KICK.out, SPRING.effects));
  }
  return a;
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
  // docked (a contact frame): its 3% squash, gone over 4 f; turned about its bow by each kick (the rest point swings round it)
  const yaw = kickAt(f);
  const [tx, ty] = KEY_PIVOT;
  const p: P3 = [KEY_SEAT[0] + tx - (tx * Math.cos(yaw) - ty * Math.sin(yaw)), KEY_SEAT[1] + ty - (tx * Math.sin(yaw) + ty * Math.cos(yaw)), KEY_SEAT[2]];
  return { p, yaw, tilt: 0, squash: 0.03 * Math.max(0, 1 - (f - E.keyDock) / 4), lift: 0 };
}

// ------------------------------------------------------------------------------------------------
// 5.1 the Proactive plate, out of your desk; 5.2 the spike's hatch (objects/Dispatch.tsx Hatch 'slate')

/**
 * The Proactive plate waits inside your desk's slab (its north edge 2 u in from the slab's north face, under the slab's top:
 * nothing of it shows) and slides out north, a drawer pushed out, to where it docks under the gate (layout.ts PROACTIVE_PLATE).
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

/** One finger's flip, `x` frames after its slip landed: up 4 f, a 1 f hold, back down by +8.5 (the next slip lands at +10 at the soonest). */
export function flipCurve(x: number): number {
  const F = FLIP;
  if (x <= 0) return 0;
  if (x < F.up) return sine(x / F.up);
  if (x < F.up + F.hold) return 1;
  return 1 - sine((x - F.up - F.hold) / F.down);
}

/**
 * Where a dropped slip lands across the gate's fingers: lying north-south, its centre 23 u west of their roots, tilted
 * with their slope (east edge up), resting on their tops (beat5.test.ts: every finger's centreline under the slip is at
 * least its radius and the paper's half thickness below the slip's mid-plane, at rest and all through the flip).
 */
export const RACK: P3 = [FINGER_ROOT.x - 23, (FINGER_Y[0] + FINGER_Y[FINGER_Y.length - 1]) / 2, 28.6];
export const RACK_ROLL = 0.17;
export const RACK_HEADING = -Math.PI / 2;
/** A dropped slip over the spike's tip (it comes down the shaft from here) and the arc's height on the way (high enough to pass over the next slip coming in). */
const OVER_TIP = SPIKE.h + 16;
const DROP_ARC = 62;
/** The share of its flight to over the tip; the rest is the fall down the shaft onto the pile. */
const OVER = 0.62;

/**
 * The belt's line as a slip rides it (state.ts SLIP_BELT's first two points: MT1's next slip and beat 6's strips ride it;
 * its own top-level array is read only inside functions, as state.ts imports this module): its heading and slope.
 */
const BELT_A = NEXT_SLIP.gate;
const BELT_B: P3 = [-394, 210, 112];
const BELT_L = Math.hypot(BELT_B[0] - BELT_A[0], BELT_B[1] - BELT_A[1], BELT_B[2] - BELT_A[2]);
export const BELT_HEADING = Math.atan2(BELT_B[1] - BELT_A[1], BELT_B[0] - BELT_A[0]);
export const BELT_SLOPE = Math.atan2(BELT_B[2] - BELT_A[2], Math.hypot(BELT_B[0] - BELT_A[0], BELT_B[1] - BELT_A[1]));
const beltAt = (s: number): P3 => lerp3(BELT_A, BELT_B, s / BELT_L);

/** The k-th dropped slip's seat on the pile (its centre: on the base, a sheet a slip) and its turn. */
export function pileSeat(k: number): { p: P3; heading: number } {
  // turned by the golden angle from the one under it, within a quarter turn either way of how it lay across the fingers
  return { p: [SPIKE.x, SPIKE.y, SPIKE_BASE + 0.5 + k * SHEET], heading: ((k * 2.39996 + 0.35) % Math.PI) - Math.PI };
}

export interface FilterSlip {
  i: number;
  role: SlipRole;
  print: Slip5['print'];
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
type Pose = Pick<FilterSlip, 'p' | 'heading' | 'slope' | 'roll' | 'squash' | 'flying'>;

/** Rotate a point about the fingers' root axis (N-S, through FINGER_ROOT), tips up by `a`. */
function aboutRoot(p: P3, a: number): P3 {
  const x = p[0] - FINGER_ROOT.x;
  const z = p[2] - FINGER_ROOT.z;
  return [FINGER_ROOT.x + x * Math.cos(a) + z * Math.sin(a), p[1], FINGER_ROOT.z - x * Math.sin(a) + z * Math.cos(a)];
}

/** Out of the spout and posted toward its first contact (MT1's motion, state.ts nextAt, a little less abrupt off the spout), landing on `to` at `f`. */
function postAt(now: number, f: number, to: P3, heading: number, roll: number, apex: number = NEXT_SLIP.apex): Pose {
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
  const p: P3 = [a[0] + (to[0] - a[0]) * u, a[1] + (to[1] - a[1]) * u, a[2] + (to[2] - a[2]) * t + 4 * apex * t * (1 - t)];
  const landed = now - f;
  return { p, heading: heading * u, slope: -0.3 * (u - 0.5) * (u < 1 ? 1 : 0), roll: roll * u, squash: landed < 0 ? 0 : Math.max(0, 1 - landed / 3), flying: now < f };
}

// --- an ask: strikes the key, glances off onto the belt, rides up, hops into the throat ---

/**
 * Where an ask strikes the docked key: lying east-west with its tail on the bow's east rim (the key's highest point, 6 u),
 * the rest of the key showing beside it, its tail east of the gate bar's east face (so its glance south onto the belt
 * never crosses the bar).
 */
export const KEY_HIT: P3 = [GATE.bar.x1 + NEXT_SLIP.l / 2 + 14, KEY_SEAT[1] + 30, 6.45];
/** An ask's post (its apex over the chord: MT1's), north of the spike's rod and over its pile. */
const ASK_APEX = NEXT_SLIP.apex;
const KEY_HIT_HEADING = Math.atan2(KEY_HIT[1] - NEXT_SLIP.spout[1], KEY_HIT[0] - NEXT_SLIP.spout[0]);
/** How high its glance off the key arcs over the chord to the belt (it clears the gate bar's cap, 42 u, as it passes). */
const GLANCE_ARC = 34;
/** Where it lands on the belt: this far up it from MT1's landing, so the whole slip is past the gate's bar, lying in the belt's pose. */
const KEEP_RUN = 56;
export const KEEP_LAND: P3 = beltAt(KEEP_RUN);
/**
 * Where it leaves the belt (beat 4's crest, objects intakeStations): its nose's leading corner short of the throat's cheeks
 * (their west end, x -400); then it hops over them into the throat (beat 4's hop), turning to lie along the throat.
 */
const CREST_X = THROAT.box.x0 - 16 - (NEXT_SLIP.l / 2) * Math.cos(BELT_SLOPE) * Math.cos(BELT_HEADING) - (NEXT_SLIP.w / 2) * Math.abs(Math.sin(BELT_HEADING));
const CREST_RUN = ((CREST_X - BELT_A[0]) / (BELT_B[0] - BELT_A[0])) * BELT_L;
export const CREST: P3 = beltAt(CREST_RUN);
/** The ride: up the belt to the crest, then the hop into the throat (its apex over the chord), from the landing. */
export const RIDE5 = { belt: 3, hop: 5, apex: 40 } as const;
/** A trip waits in the throat this long, then is fed under the head (FEED frames, in-quad) and is gone. */
const TRIP_DWELL = 1;
const FEED = 4;
/**
 * Where an ask is fed to: wholly under the print head (its west end 2 u past the head's west face: beat6.ts underFor), so
 * it leaves the picture there and never with its tail still in the throat; 4 f in-quad keeps the last step under 50 u.
 */
export const UNDER_HEAD: P3 = [PRINT_HEAD.box.x0 + 2 + NEXT_SLIP.l / 2, NEXT_SLIP.throat[1], NEXT_SLIP.throat[2]];
const feedAt = (now: number, feed: number): P3 => lerp3(NEXT_SLIP.throat, UNDER_HEAD, easings.inQuad(clamp((now - feed) / FEED)));

/** An ask from its strike on the key to the throat (null past it): posted onto the key, glancing off it onto the belt, the belt, the hop. */
function askAt(now: number, strike: number, land: number): Pose | null {
  if (now <= strike) return postAt(now, strike, KEY_HIT, KEY_HIT_HEADING, 0, ASK_APEX);
  if (now < land) {
    // off the key in an arc over the gate bar's north end, turning into the belt's pose as it goes (a little roll in the air), landing in it
    const s = (now - strike) / (land - strike);
    const e = sine(s);
    const xy = s;
    const z = KEY_HIT[2] + (KEEP_LAND[2] - KEY_HIT[2]) * s + 4 * GLANCE_ARC * s * (1 - s);
    return {
      p: [KEY_HIT[0] + (KEEP_LAND[0] - KEY_HIT[0]) * xy, KEY_HIT[1] + (KEEP_LAND[1] - KEY_HIT[1]) * xy, z],
      heading: KEY_HIT_HEADING + (BELT_HEADING - KEY_HIT_HEADING) * e,
      slope: BELT_SLOPE * e,
      roll: 0.22 * Math.sin(Math.PI * s),
      squash: 0,
      flying: true,
    };
  }
  const R = RIDE5;
  if (now < land + R.belt) {
    // landed in the belt's pose (a contact frame: its pose on `land` is its pose riding on), up the belt at its pace
    return { p: lerp3(KEEP_LAND, CREST, (now - land) / R.belt), heading: BELT_HEADING, slope: BELT_SLOPE, roll: 0, squash: Math.max(0, 1 - (now - land) / 3), flying: false };
  }
  if (now < land + R.belt + R.hop) {
    // the hop: up off the belt's top first (its nose over the throat's west face before it crosses it), across, then down
    // between the cheeks; it turns to lie along the throat in the first 70% of it
    const u = clamp((now - land - R.belt) / R.hop);
    const xy = sine(u);
    const e = sine(u / 0.7);
    const T = NEXT_SLIP.throat;
    const z = CREST[2] + (T[2] - CREST[2]) * u + 4 * R.apex * u * (1 - u);
    return { p: [CREST[0] + (T[0] - CREST[0]) * xy, CREST[1] + (T[1] - CREST[1]) * xy, z], heading: BELT_HEADING * (1 - e), slope: BELT_SLOPE * (1 - e), roll: 0, squash: 0, flying: true };
  }
  return null;
}
/** When an ask lies in the throat (landed from its hop). */
const inThroat = (land: number): number => land + RIDE5.belt + RIDE5.hop;

/** A trip (5.1): an ask with no filter yet; it waits in the throat a beat's fraction and is fed under the head. Null once there. */
function tripAt(now: number, s: Slip5): FilterSlip | null {
  const base = { i: s.i, role: s.role, print: s.print, notched: false, onPile: false };
  const a = askAt(now, s.strike!, s.land!);
  if (a) return { ...base, ...a };
  const th = inThroat(s.land!);
  const feed = th + TRIP_DWELL;
  if (now >= feed + FEED + 1) return null;
  return { ...base, p: feedAt(now, feed), heading: 0, slope: 0, roll: 0, squash: Math.max(0, 1 - (now - th) / 3), flying: false };
}

/** A kept slip (the Slow Path) at film frame `now`, or null once it is under the print head: the loupe reads it in the throat and the punch notches it. */
function keptAt(now: number, s: Slip5): FilterSlip | null {
  const f = s.f;
  const notched = now >= f + BEAT_5.notchAfter;
  const feed = f + BEAT_5.notchAfter + 2;
  if (now >= feed + FEED + 1) return null;
  const base = { i: s.i, role: s.role, print: s.print, notched, onPile: false };
  const a = askAt(now, s.strike!, s.land!);
  if (a) return { ...base, ...a };
  const th = inThroat(s.land!);
  return { ...base, p: feedAt(now, feed), heading: 0, slope: 0, roll: 0, squash: Math.max(0, 1 - (now - th) / 3), flying: false };
}

/** A dropped slip (the Fast Path) at film frame `now`: posted onto the fingers, flipped (riding the leading finger), over onto the spike, impaled on the pile. */
function droppedAt(now: number, s: Slip5): FilterSlip {
  const f = s.f;
  const base = { i: s.i, role: s.role, print: s.print, notched: false };
  const seat = pileSeat(s.k);
  if (now <= f) return { ...base, onPile: false, ...postAt(now, f, RACK, RACK_HEADING, RACK_ROLL) };
  const impale = f + BEAT_5.impale;
  if (now >= impale) return { ...base, onPile: true, p: seat.p, heading: seat.heading, slope: 0, roll: 0, squash: Math.max(0, 1 - (now - impale) / 4), flying: false };
  const flipEnd = f + BEAT_5.flip;
  if (now < flipEnd) {
    // carried up on the leading (south) finger as they flip: the others lag under it
    const a = FLIP.a * flipCurve(now - f);
    return { ...base, onPile: false, p: aboutRoot(RACK, a), heading: RACK_HEADING, slope: 0, roll: RACK_ROLL - a, squash: 0, flying: false };
  }
  // thrown: an arc to over the spike's tip, then down its shaft onto the pile, gathering speed (turning to its seat's heading, levelling)
  const top = FLIP.a * flipCurve(BEAT_5.flip);
  const r = aboutRoot(RACK, top);
  const t = (now - flipEnd) / (impale - flipEnd);
  const rollFrom = RACK_ROLL - top;
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
    const first = s.strike ?? s.f;
    if (now < first - E5.out) continue;
    const x = s.role === 'drop' ? droppedAt(now, s) : s.role === 'keep' ? keptAt(now, s) : tripAt(now, s);
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
    for (const s of SLIPS_5) if (s.role === 'drop') a += FLIP.a * flipCurve(f - s.f - j * FLIP.stagger);
    return a;
  });
}

/** How many dropped slips the pile counts at f: each lands impaled on it on its impale frame and the pile has grown by it the frame after (STORYBOARD 5.2: +12, +13). */
export const pileAt = (f: number): number => SLIPS_5.filter((s) => s.role === 'drop' && f >= s.f + BEAT_5.impale + 1).length;

/** The loupe's swing for the kept slips (radians added to MT1's: they never overlap): onto the card (4 f), across its rules (12 f), home once the slip is notched. */
export function loupeAt5(f: number): number {
  const [a0, a1] = LOUPE_READ;
  let a = 0;
  for (const s of SLIPS_5) {
    if (s.role !== 'keep') continue;
    const loupe = s.f + 8;
    const scan = s.f + 12;
    const home = s.f + BEAT_5.notchAfter + 1;
    if (f >= loupe && f < scan) a += a0 * sine((f - loupe) / 4);
    else if (f >= scan && f < home) a += a0 + (a1 - a0) * sine((f - scan) / 12);
    else if (f >= home && f < home + 6) a += a1 * (1 - sine((f - home) / 6));
  }
  return a;
}

/**
 * The punch for the kept slips: its die's height (z) and how far it is out of the throat's north cheek (0..1: objects/
 * Filter.tsx grows the V-die out of the cheek's south face by it, and draws it back in), out a beat before its notch, down
 * on the slip's edge on it, back in (Dispatch.tsx punchZ's motion); null while it is wholly inside the cheek.
 */
export function punchAt5(f: number): { z: number; out: number } | null {
  for (const s of SLIPS_5) {
    if (s.role !== 'keep') continue;
    const n = s.f + BEAT_5.notchAfter;
    const out = sine((f - (n - 4)) / 3) * (1 - sine((f - (n + 1)) / 3));
    if (out <= 0) continue;
    const drop = Math.max(0, 1 - Math.abs(f - n) / 1.5);
    return { z: PUNCH.hidden + PUNCH.out * out - PUNCH.drop * drop, out };
  }
  return null;
}

// ------------------------------------------------------------------------------------------------
// 5.2 W-09 takes its ask in

/**
 * W-09 (the docs Worker) takes in the ask beat 4 dispatched to it: the chat slip has lain on its galley's type since its
 * dock (beat4.ts RIDES.docs, GALLEY_DOCK); in 5.2, with the docs bay stepped down, it lifts out of the galley's shade,
 * hops over to the bay's lit work slot turning to stand on its short edge (nose down, its width along the slit), and
 * sinks into the slit, a card into a slot, wholly in on DOCS.in. From then on the galley shows its own print, as in
 * still (c) and still (d) (r2-final c, d): the bay's work goes on in its slot.
 */
export const DOCS = { in: 2600, hop: 11, feed: 6, shadeRamp: 4 } as const;
/** Where the slip lies on the galley (beat4.ts GALLEY_DOCK: the same point, beat5.test.ts) and its dock's heading. */
export const DOCS_DOCK: P3 = [0, 68, GALLEY_TRAY.z[0] + 5.3 + 0.5];
/** The work slot's slit (objects/Bay.tsx BayBase: on the slot block's top, 42 x 12 along x) and the slip's centre over it, its nose 3 u over the slit's lip. */
export const DOCS_SLIT: P3 = [rectC(BAYS.docs.slot)[0], rectC(BAYS.docs.slot)[1], 30.3];
const DOCS_OVER: P3 = [DOCS_SLIT[0], DOCS_SLIT[1], DOCS_SLIT[2] + NEXT_SLIP.l / 2 + 3];
export interface DocsTake {
  p: P3;
  heading: number;
  slope: number;
  /** its own darkening (beat4.ts Carry.shade): at the galley's shade's tone as it lifts out of it, gone over shadeRamp frames */
  shade: number;
}
/** The docs slip at f: null while it lies on the galley (beat 4's docked carrier draws it), its pose while it is taken in, 'gone' once it is in the slot (also in the summary's world). */
export function docsTakeAt(f: number): DocsTake | 'gone' | null {
  const from = DOCS.in - DOCS.feed - DOCS.hop;
  if (f <= from) return null;
  if (f >= DOCS.in) return 'gone';
  const shade = 1 - sine((f - from - 1) / DOCS.shadeRamp);
  if (f <= from + DOCS.hop) {
    // up off the type first (out of the galley's rails and its shade on the first frame), across to over the slot,
    // turning a quarter (its width along the slit) and, once high, standing up nose down
    const u = (f - from) / DOCS.hop;
    const xy = sine(u);
    const z = DOCS_DOCK[2] + (DOCS_OVER[2] - DOCS_DOCK[2]) * easings.outCubic(u);
    return { p: [DOCS_DOCK[0] + (DOCS_OVER[0] - DOCS_DOCK[0]) * xy, DOCS_DOCK[1] + (DOCS_OVER[1] - DOCS_DOCK[1]) * xy, z], heading: (Math.PI / 2) * xy, slope: -(Math.PI / 2) * sine((u - 0.2) / 0.8), shade };
  }
  // down into the slit, gathering speed: its top edge goes under the slit's lip on DOCS.in
  const t = (f - from - DOCS.hop) / DOCS.feed;
  const z = DOCS_OVER[2] - (DOCS_OVER[2] - (DOCS_SLIT[2] - NEXT_SLIP.l / 2 - 1)) * easings.inQuad(t);
  return { p: [DOCS_OVER[0], DOCS_OVER[1], z], heading: Math.PI / 2, slope: -Math.PI / 2, shade };
}

export interface Beat5State {
  key: KeyPose | null;
  plate: { dy: number } | null;
  spike: HatchState | null;
  slips: FilterSlip[];
  fingers: number[];
  pile: number;
  loupe: number;
  punch: { z: number; out: number } | null;
  docs: DocsTake | 'gone' | null;
}

/** Beat 5 at film frame f (pure). */
export function beat5At(f: number): Beat5State {
  return { key: keyAt(f), plate: plateAt(f), spike: spikeAt(f), slips: slipsAt(f), fingers: fingersAt(f), pile: pileAt(f), loupe: loupeAt5(f), punch: punchAt5(f), docs: docsTakeAt(f) };
}
