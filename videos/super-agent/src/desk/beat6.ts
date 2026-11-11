/**
 * Beat 6, how one Router keeps up (STORYBOARD 6.1-6.4, film f2720-3439): what the Register does at a film frame. Pure:
 * every value is a sum over the cue sheet's beat-6 events (cues.ts BEAT_6 and its cue events), which the score sounds
 * on the same frames (audio/keepUp.ts), so each contact frame below is the frame the picture's event lands on.
 *
 * - 6.1-6.2 batching (the gulp). Each waiting slip of BEAT_6.batches is posted over the gate onto the belt, rides up into
 *   the throat and under the print head, and is carried under the deck plate to the gather tray (a shallow channel on
 *   the deck plate along the reading window's south edge, a hood at each end): it comes out from under the east hood
 *   sliding west until it butts into the strip, landing on its frame (a held tick). The first stops against the west
 *   hood's lip, each later one shingles onto the one before, its nose a pitch behind, so the strip is the queue
 *   (TREATMENT Gulp: p_i = min(v (f - t_i), p_(i-1) - gap)). On the batch's downbeat (`batch`, `batch-2`) the reading bar,
 *   parked over the strip's front, sweeps the whole strip east (6 f: every cell lights as it passes, so all are lit within
 *   6 f: the prefill), and the strip is drawn in under the west hood together as the bar runs back to its park: the sweep
 *   takes sweepBase + sweepPerSlip per slip frames, so the longer strip is swept barely longer, and the tray is clear
 *   before the next slip comes in. Then the decode: a short slip comes out of the slot in the head's south face one cell
 *   per decodeCell frames, a hole punched in each, is torn off and drops into the dispatch slot under it (it leaves as
 *   dispatches). The neck collar's needle rises a hair with the queue and falls with the gulp.
 * - 6.2 the stress plate: it flies in from the east and is pressed onto the deck's south rail on `plate-detent`
 *   (f2880, a contact frame), its header and endpoints engraved (gl/plate.ts stressTexture), never rolled.
 * - 6.4 recall: a review comment, a punched card from the card feeder, is posted over the gate, rides the belt and
 *   enters the throat on `review-card`; nothing subscribes to it, so it feeds into the head and is stamped in on
 *   `review-in` as a new row: the tape advances one stub and the new stub comes out from under the inline record. On
 *   `recall` (bar 42) the reel rewinds over rewindFrames: it spins back and an older row, the request's Thread's row,
 *   comes back out from under the reel's flange onto the run. A graphite reading thread hops from the new row to the
 *   request's stub, its Thread's row and down to its bay's last report (the #0405 pointer tab in the spill drawer),
 *   landing on each hop's frame (10 f a hop, 4 f dwell), each landing opening a "№" tab; on `recall-answer` a short
 *   answer leaves the head's slot under the transit light, back west to the card feeder.
 *
 * The world from the summary on (SPAN_D, f5400) is still (d)'s, which draws none of this (`E6.until`).
 */
import { clamp, easings } from '@aiv/core';
import { Easing } from 'remotion';
import { BEAT_6, cue } from '../cues.ts';
import { CACHE_WINDOW, CARD_C, DECK, DRAWER, DRAWER_OPEN_C, NEXT_SLIP, PRINT_HEAD, TAPE, rectC, type P3 } from './layout.ts';

/** In and out (never -0, so a hold compares equal). */
const sine = (t: number): number => easings.inOutSine(clamp(t)) + 0;
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** The film's move curve (TREATMENT Motion grammar), clamped. */
const MOVE = Easing.bezier(0.2, 0, 0, 1);
const move = (t: number): number => MOVE(clamp(t));

// ------------------------------------------------------------------------------------------------
// Beat 6's own frames, hung off the cue sheet's

const R = BEAT_6.recall;
export const E6 = {
  /** a slip leaves the spout this long before it lands on the belt; it is posted over the last `post` of them (beat 5's kept slips' timing) */
  outFrames: 4,
  post: 11,
  /** the read: the bar runs down the whole strip in this many frames from the downbeat; the rest of the sweep is its run back */
  read: 6,
  /** the decode slip's cells, and the frames from its last punch to its tear-off; its drop into the dispatch slot */
  decodeCells: 3,
  tear: 1,
  dispatch: 9,
  /** the stress plate: in from the east over `plateFly` frames, pressed onto the rail over the last `platePress` (on plate-detent) */
  plateDetent: cue('plate-detent').frame,
  plateFly: 20,
  platePress: 4,
  /** 6.4: the review card enters the throat, waits, feeds into the head (4 f) and is stamped in on review-in */
  reviewCard: R.card,
  reviewIn: R.stampIn,
  feed: 4,
  /** after the stamp the reel detents and the tape advances one stub (8 f) */
  advance: 2,
  advanceFrames: 8,
  rewind: R.rewind,
  rewindFrames: R.rewindFrames,
  hops: R.hops,
  hopFrames: 10,
  answer: R.answer,
  /** the answer comes out of the head's slot one cell per decodeCell frames before it leaves on recall-answer; its flight to the card feeder */
  answerCells: 2,
  answerFly: 24,
  /** the summary (f5400, summary.ts SPAN_D) is still (d)'s world */
  until: 5400,
} as const;

/**
 * The window's cards from the close on (STORYBOARD 6.1, still (c)): the cells the tape held after MT1 (print.ts CELLS_NEXT,
 * newest first: MT1's accepted chat slip, the test report #0408, the docs, the CI, the request), each laid where its
 * print lay on the tape and in still (c)'s card style (gl/print6.ts), its east edge on a window bar (the fourth's under
 * the frame's east member; the request's out on the run). From the bar-34 dolly they replace the printed tape by the
 * close shot's 8 f print swap (state.ts closeAt), so the cache's shrink later tears their bodies away.
 */
export const WINDOW_CARDS = [
  { kind: 'chat', request: false, x0: -292, x1: -194 },
  { kind: 'test', request: false, x0: -190, x1: -88 },
  { kind: 'docs', request: false, x0: -84, x1: -35 },
  { kind: 'ci', request: false, x0: -31, x1: 18 },
  { kind: 'chat', request: true, x0: 22, x1: 71 },
] as const;

/**
 * The test report's tab #0408 filed (objects/Cache.tsx TestTab): as the drawer pulls open it settles back to lie nearly
 * flat on the drawer's floor, a hair forward, under the older tabs' feet, so the request's tab lands on top of it with its
 * ID clear (standing, it would hide the request's).
 */
export const TAB_FILE = { lean: 0.12, dy: -3, dz: -1.6 } as const;

/** The read: the bar runs down the whole strip in this many frames from the downbeat. */
const E6_READ = 6;

// ------------------------------------------------------------------------------------------------
// 6.1-6.2 the strip

/**
 * The intake's path for a slip centre (arc length s from the throat, its nose toward the head): the throat's floor, the
 * belt's top, down the belt to the gate. s < 0 runs on east under the print head, where a slip fed in is hidden.
 */
export const QUEUE: readonly P3[] = [[NEXT_SLIP.throat[0], NEXT_SLIP.throat[1], NEXT_SLIP.throat[2]], [-394, 210, 112], [NEXT_SLIP.gate[0], NEXT_SLIP.gate[1], NEXT_SLIP.gate[2]]];
const SEG = QUEUE.slice(1).map((q, i) => Math.hypot(q[0] - QUEUE[i][0], q[1] - QUEUE[i][1], q[2] - QUEUE[i][2]));
/** The intake path's length (to the gate's landing). */
export const QUEUE_LEN = SEG.reduce((a, b) => a + b, 0);
/** Where a posted slip lands on the belt (beat5.ts KEEP_LAND: 46 u up the belt from the gate), as arc length. */
export const LAND_S = QUEUE_LEN - 46;
/** How fast a slip rides up the belt (u/f, linear transport), and how far in under the head it goes before it is wholly hidden there. */
export const BELT_V = 24;
const UNDER_HEAD = -NEXT_SLIP.l - 2;

export interface PathPose {
  p: P3;
  heading: number;
  slope: number;
}

/** A slip centre at arc length s along the intake (nose toward the head): position, heading (nose's direction) and nose-up slope. */
export function queueAt(s: number): PathPose {
  if (s <= 0) return { p: [QUEUE[0][0] - s, QUEUE[0][1], QUEUE[0][2]], heading: 0, slope: 0 };
  let d = s;
  for (let i = 0; i < SEG.length; i++) {
    if (d <= SEG[i] || i === SEG.length - 1) {
      const a = QUEUE[i];
      const b = QUEUE[i + 1];
      const t = Math.min(d / SEG[i], 1.4);
      const p: P3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      // the nose points back along the path, toward the head
      const dir: P3 = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const h = Math.hypot(dir[0], dir[1]);
      // the throat's short kink onto the belt's top: blended over its length, so the slip turns as it rides through
      const belt = beltDir();
      const heading = i === 0 ? belt.heading * t : Math.atan2(dir[1], dir[0]);
      const slope = i === 0 ? belt.slope * t : Math.atan2(dir[2], h);
      return { p, heading, slope };
    }
    d -= SEG[i];
  }
  return { p: QUEUE[QUEUE.length - 1], heading: 0, slope: 0 };
}
function beltDir(): { heading: number; slope: number } {
  const a = QUEUE[1];
  const b = QUEUE[2];
  const dir: P3 = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  return { heading: Math.atan2(dir[1], dir[0]), slope: Math.atan2(dir[2], Math.hypot(dir[0], dir[1])) };
}

/** The chat spout's mouth, where every slip of the beat comes out (layout.ts NEXT_SLIP.spout), and the post's apex. */
const SPOUT = NEXT_SLIP.spout;

/** A slip posted from `from` (out of its feeder's mouth over `outFrames`, then an arc over `post` frames) landing on the belt at `land` on frame `at`. */
function postAt(now: number, at: number, from: P3, apex: number): PathPose & { flying: boolean } {
  const land = queueAt(LAND_S);
  const t0 = at - E6.post;
  if (now < t0) {
    const inside: P3 = [from[0] - 60, from[1], from[2] + 2];
    return { p: lerp3(inside, from, easings.outCubic(clamp((now - (t0 - E6.outFrames)) / E6.outFrames))), heading: 0, slope: 0, flying: true };
  }
  const t = clamp((now - t0) / E6.post);
  // fast off the spout and slower onto the belt, but never more than about 55 u a frame (half linear, half out-quad)
  const u = 0.5 * t + 0.5 * easings.outQuad(t);
  const p: P3 = [from[0] + (land.p[0] - from[0]) * u, from[1] + (land.p[1] - from[1]) * u, from[2] + (land.p[2] - from[2]) * t + 4 * apex * t * (1 - t)];
  // turning from the feeder's line onto the belt's, levelling then nosing up onto it
  return { p, heading: land.heading * sine(t), slope: -0.3 * (u - 0.5) * (u < 1 ? 1 : 0) + land.slope * sine((t - 0.6) / 0.4), flying: now < at };
}

/**
 * The gather tray (6.1): a shallow channel on the deck plate between the reading window's south edge and the south rail,
 * east of the index arm's plate, with a low hood at each end: the slips come out from under the east hood, wait in the
 * strip and are drawn in under the west hood (toward the print head). The strip's slips lie east-west, nose west.
 */
export const TRAY = { x0: -262, x1: -12, y0: 143, y1: 183, floor: DECK.top, rim: 2.4, hood: 16 } as const;
export const TRAY_Y = (TRAY.y0 + TRAY.y1) / 2;
/** Where a slip is cut off from view inside each hood (its part beyond is under the hood). */
export const CROP = { west: TRAY.x0 + TRAY.hood / 2, east: TRAY.x1 - TRAY.hood / 2 } as const;
/** One slip's step along the strip: each later slip's nose rides onto the one before, a pitch behind its nose (the band of each slip the strip shows, its kind marked at its nose). */
export const PITCH = 17;
/** The front slip's centre (x): its nose against the west hood's lip. */
export const FRONT_X = TRAY.x0 + TRAY.hood + 2 + NEXT_SLIP.l / 2;
/** Where a slip comes in (its centre: its nose at the east crop, the rest under the hood) and how fast it slides along the tray. */
export const ENTRY_X = CROP.east + NEXT_SLIP.l / 2;
export const TRAY_V = 40;
/** Frames a slip takes under the head and the deck plate, from the throat to the east hood. */
const UNDER = 8;
/** The slips lie a sheet above the one before in the strip (the follower on top), on the tray's floor. */
const SHINGLE = 0.7;
const ON_FLOOR = TRAY.floor + 0.6;

export interface StripSlip {
  /** the batch and the slip's index in it (its pitch behind the front) */
  b: number;
  i: number;
  pose: PathPose;
  /** its landing squash on the belt, and as it butts into the strip (0..1 of 3%) */
  squash: number;
  /** read: its paper lit by the bar's sweep (0..1) */
  lit: number;
  /** in the air (no contact shadow); lying in the tray (cropped at the hoods, drawn flat); hidden (under the head or the deck plate) */
  flying: boolean;
  inTray: boolean;
  /** the part of it in view along the tray (world x), when in the tray */
  view: readonly [number, number] | null;
  inStrip: boolean;
  hidden: boolean;
}

/** Each batch's frames: its slips' landings (butting into the strip), the sweep's downbeat and its length; the strip's east end. */
export const BATCHES = BEAT_6.batches.map((b, k) => {
  const n = b.slips.length;
  const sweepFrames = BEAT_6.sweepBase + BEAT_6.sweepPerSlip * n;
  const tail = FRONT_X + (n - 1) * PITCH + NEXT_SLIP.l / 2;
  return { k, slips: b.slips as readonly number[], n, sweep: b.sweep, sweepFrames, end: b.sweep + sweepFrames, tail };
});

/** The reading bar's park (x): over the strip's front, by the west hood; it first comes out from under that hood as the beat starts. */
export const BAR_PARK = TRAY.x0 + TRAY.hood + 8;
export const BAR_HOME = TRAY.x0 + 4;
export const BAR_OUT = 2722;
/** The strip is drawn in under the west hood over `frames`, from `at` frames after the downbeat (as the bar starts back). */
export const GULP = { at: E6_READ, frames: 7 } as const;

/** How far the batch's sweep has gone at f: the bar's run east down the strip (0..1, the read), then its run back to its park (0..1). */
function sweepAt(f: number, b: (typeof BATCHES)[number]): { read: number; back: number } {
  const x = f - b.sweep + 1;
  // on the downbeat (a contact frame) the bar is already off its park: it starts the frame before; a swish down the
  // strip that starts at speed (half linear) and eases into its far end, never more than about 45 u a frame
  const read = x <= 0 ? 0 : Math.min(1, 0.5 * clamp(x / E6_READ) + 0.5 * sine(x / E6_READ));
  const back = sine((f - b.sweep - E6_READ + 1) / (b.sweepFrames - E6_READ));
  return { read, back };
}
/** The bar's far end: over the strip's east end. */
const BAR_FAR = CROP.east - 6;

/** How far the batch's strip has been drawn in west at f (u). */
function gulpOf(f: number, b: (typeof BATCHES)[number]): number {
  return (b.tail - CROP.west) * sine((f - b.sweep - GULP.at + 1) / GULP.frames);
}

/** One slip of a batch at film frame f, or null before it leaves the spout and once it has been drawn in under the west hood. */
export function stripSlipAt(f: number, b: (typeof BATCHES)[number], i: number): StripSlip | null {
  const L = b.slips[i];
  const place = FRONT_X + i * PITCH;
  const inTray = L - (ENTRY_X - place) / TRAY_V;
  const under = inTray - UNDER;
  const onBelt = under - (LAND_S - UNDER_HEAD) / BELT_V;
  const t0 = onBelt - E6.post - E6.outFrames;
  if (f < t0 || f >= E6.until) return null;
  const base = { b: b.k, i, inTray: false, view: null, inStrip: false };
  if (f < onBelt) {
    const post = postAt(f, onBelt, SPOUT, NEXT_SLIP.apex);
    return { ...base, pose: post, squash: 0, lit: 0, flying: post.flying, hidden: false };
  }
  if (f < under) {
    const s = LAND_S - (f - onBelt) * BELT_V;
    return { ...base, pose: queueAt(s), squash: Math.max(0, 1 - (f - onBelt) / 3), lit: 0, flying: false, hidden: s < UNDER_HEAD + 2 };
  }
  const z = ON_FLOOR + SHINGLE * i;
  const at = (x: number): StripSlip => {
    const view: [number, number] = [Math.max(CROP.west, x - NEXT_SLIP.l / 2), Math.min(CROP.east, x + NEXT_SLIP.l / 2)];
    return { ...base, inTray: true, view: view[1] - view[0] > 0.01 ? view : null, pose: { p: [x, TRAY_Y, z], heading: Math.PI, slope: 0 }, squash: 0, lit: 0, flying: false, hidden: view[1] - view[0] <= 0.01 };
  };
  if (f < inTray) return { ...at(ENTRY_X), hidden: true, view: null };
  // out from under the east hood, sliding west to its place (linear transport), butting on its frame
  if (f < L) return at(Math.max(place, ENTRY_X - (f - inTray) * TRAY_V));
  const g = gulpOf(f, b);
  const x = place - g;
  if (x + NEXT_SLIP.l / 2 <= CROP.west) return null;
  // in the strip: still until the sweep; read as the bar passes its nose band; drawn in under the west hood with the strip
  const sw = sweepAt(f, b);
  const barX = BAR_PARK + (BAR_FAR - BAR_PARK) * sw.read;
  const nose = place - NEXT_SLIP.l / 2;
  const lit = sw.back > 0 || f >= b.sweep + E6_READ ? 1 : clamp((barX - Math.max(nose, BAR_PARK)) / (PITCH + 6)) + 0;
  return { ...at(x), inStrip: true, lit, squash: f - L < 4 ? 0.6 * (1 - (f - L) / 4) : 0 };
}

/** Every slip of beat 6's batches at f (in film order). */
export function stripAt(f: number): StripSlip[] {
  const out: StripSlip[] = [];
  for (const b of BATCHES)
    for (let i = 0; i < b.n; i++) {
      const x = stripSlipAt(f, b, i);
      if (x) out.push(x);
    }
  return out;
}

/** The reading bar's x along the tray at f: out from under the west hood onto its park (6 f), its sweeps; null before and from the summary on. */
export function barAt(f: number): { x: number } | null {
  if (f < BAR_OUT || f >= E6.until) return null;
  let x = BAR_HOME + (BAR_PARK - BAR_HOME) * move((f - BAR_OUT) / 6);
  for (const b of BATCHES) {
    if (f < b.sweep - 1 || f >= b.end + 1) continue;
    const sw = sweepAt(f, b);
    x = sw.back > 0 ? BAR_FAR + (BAR_PARK - BAR_FAR) * sw.back : BAR_PARK + (BAR_FAR - BAR_PARK) * sw.read;
  }
  return { x };
}
/** The bar rides this far over the tray's floor (clear of the shingled strip, its shoes on the tray's rims). */
export const BAR_RIDE = 9;

/** How many slips wait in the strip at f (for the neck collar's needle): each counts from its landing until the strip is drawn in. */
export function queuedAt(f: number): number {
  let n = 0;
  for (const b of BATCHES) for (let i = 0; i < b.n; i++) if (f >= b.slips[i] && f < b.sweep + GULP.at + GULP.frames) n += 1;
  return n;
}
/** The neck collar's needle, radians added to beat 4's low reading: a hair up with each slip waiting (never past a fifth of its arc). */
export const needleAt = (f: number): number => -0.035 * queuedAt(f);

// ------------------------------------------------------------------------------------------------
// The decode slip and the dispatch slot

/** The slot in the print head's south face (objects/Cache.tsx draws it): where the decode slip and the answer come out. */
export const HEAD_SLOT = { x: rectC(PRINT_HEAD.box)[0], y: PRINT_HEAD.box.y0 - 0.2, z: 150, w: CARD_C.d * CARD_C.header + 4 } as const;
/** A decode cell along the slip (u), and the slip's width. */
export const DECODE = { cell: 12, w: 32 } as const;
/** The dispatch slot in the deck plate right under the head's slot, north of the index arm's boss: the decision drops straight down through it. */
export const DISPATCH_SLOT = { x: rectC(PRINT_HEAD.box)[0], y: PRINT_HEAD.box.y0 - 5, z: DECK.top, w: 38, d: 6 } as const;

export interface DecodeSlip {
  /** how many of its cells are out of the slot (fractional while one comes out), how many are punched */
  out: number;
  punched: number;
  cells: number;
  /** its pose: the middle of its north edge (where it leaves the slot), its pitch about x (0 flat, pointing south; -pi/2 hanging nose down) and its turn about z (0 pointing south) */
  p: P3;
  pitch: number;
  yaw: number;
  /** in the air, torn off */
  free: boolean;
}

/** A slip printed out of the head's slot from `from`, one cell per decodeCell frames, torn off and dropped into its slot at `to` over `fly` frames. */
function printedSlip(f: number, from: number, cells: number, to: P3 | null, fly: number): DecodeSlip | null {
  const dc = BEAT_6.decodeCell;
  if (f < from) return null;
  const x = f - from;
  // each cell: out over its first frame (a continuous feed, one cell per decodeCell frames), punched on its second
  const out = Math.min(cells, (x + 1) / dc);
  const punched = Math.min(cells, Math.floor(x / dc + 0.5));
  const done = from + cells * dc + E6.tear;
  const len = DECODE.cell * cells;
  const atSlot: P3 = [HEAD_SLOT.x, HEAD_SLOT.y, HEAD_SLOT.z];
  if (f < done || !to) return { out, punched, cells, p: atSlot, pitch: 0, yaw: 0, free: false };
  if (f >= done + fly) return null;
  const t = (f - done) / (fly - 1);
  // torn off: it swings nose down as it is carried over its slot, then drops straight in, gathering speed, wholly under the deck plate by its last frame
  const over: P3 = [to[0], to[1], to[2] + len + 4];
  if (t < 0.6) {
    const u = sine(t / 0.6);
    return { out: cells, punched: cells, cells, p: [atSlot[0] + (over[0] - atSlot[0]) * u, atSlot[1] + (over[1] - atSlot[1]) * u, atSlot[2] + (over[2] - atSlot[2]) * u + 10 * Math.sin(Math.PI * u)], pitch: -(Math.PI / 2) * u, yaw: 0, free: true };
  }
  const w = (t - 0.6) / 0.4;
  return { out: cells, punched: cells, cells, p: [over[0], over[1], over[2] - (len + 6) * w * w], pitch: -Math.PI / 2, yaw: 0, free: true };
}

/** The decode slip at f (6.1-6.2), or null. */
export function decodeAt(f: number): DecodeSlip | null {
  if (f >= E6.until) return null;
  for (const b of BATCHES) {
    const x = printedSlip(f, b.end, E6.decodeCells, [DISPATCH_SLOT.x, DISPATCH_SLOT.y, DISPATCH_SLOT.z], E6.dispatch);
    if (x) return x;
  }
  return null;
}

// ------------------------------------------------------------------------------------------------
// 6.2 the stress plate

/** The stress plate, cantilevered south off the deck's south rail on two hooks, east of the spill drawer, over the docs bay's north-east part (in the close, under where the cache tag later stands). */
export const STRESS_PLATE = { box: { x0: 36, x1: 244, y0: 22, y1: 116 }, z: [120, 124] as const, hooks: [70, 210] as const } as const;
/** Where it comes from: off the frame's east edge, high. */
const PLATE_FROM: P3 = [560, 30, 250];

export interface PlatePose {
  /** offset of the plate from its seat, its tilt about x (its north edge up) and its turn about z */
  d: P3;
  tilt: number;
  turn: number;
  squash: number;
  /** above its seat (no contact shadow while it flies) */
  flying: boolean;
}

/** The stress plate at f: null before it enters, then its flight, its press onto the rail on plate-detent, seated. */
export function plateAt(f: number): PlatePose | null {
  const at = E6.plateDetent;
  const start = at - E6.plateFly;
  if (f < start || f >= E6.until) return null;
  if (f >= at) return { d: [0, 0, 0], tilt: 0, turn: 0, squash: 0.03 * Math.max(0, 1 - (f - at) / 4), flying: false };
  const c: P3 = [(STRESS_PLATE.box.x0 + STRESS_PLATE.box.x1) / 2, (STRESS_PLATE.box.y0 + STRESS_PLATE.box.y1) / 2, 0];
  const pressFrom = at - E6.platePress;
  const HOVER = 12;
  if (f < pressFrom) {
    // the flight: in from the east in an arc, levelling and squaring up over its seat
    const t = (f - start) / (pressFrom - start);
    const u = sine(t);
    const from: P3 = [PLATE_FROM[0] - c[0], PLATE_FROM[1] - c[1], PLATE_FROM[2]];
    const d: P3 = [from[0] * (1 - u), from[1] * (1 - u), HOVER + (from[2] - HOVER) * (1 - u) + 30 * Math.sin(Math.PI * u) * (1 - u)];
    return { d, tilt: 0.35 * (1 - u), turn: 0.22 * (1 - u), squash: 0, flying: true };
  }
  // the press: a hair up (anticipation), then down onto the rail, seating on the detent
  const t = (f - pressFrom) / E6.platePress;
  const z = t < 0.35 ? HOVER + 4 * Math.sin((Math.PI * t) / 0.35) : HOVER * (1 - ((t - 0.35) / 0.65) ** 2);
  return { d: [0, 0, z], tilt: 0, turn: 0, squash: 0, flying: true };
}

// ------------------------------------------------------------------------------------------------
// 6.4 recall

/** The review card (the CI feeder's punched card: layout as Intake's ciCard, 84 x 50): out of the card feeder's mouth. */
export const REVIEW = { l: 84, w: 50, from: [-886, 263, 40] as P3, apex: 64 } as const;
/** In the throat, its nose at the head. */
const REVIEW_S = REVIEW.l / 2 - NEXT_SLIP.l / 2;

/** The review card at f: posted over the gate, up the belt into the throat (arriving on review-card), waiting, fed into the head; null otherwise. */
export function reviewAt(f: number): (PathPose & { squash: number; flying: boolean }) | null {
  const arrive = E6.reviewCard;
  const ride = (LAND_S - REVIEW_S) / BELT_V;
  const onBelt = arrive - ride;
  const feed = E6.reviewIn - E6.feed;
  if (f < onBelt - E6.post - E6.outFrames || f >= E6.reviewIn || f >= E6.until) return null;
  if (f < onBelt) return { ...postAt(f, onBelt, REVIEW.from, REVIEW.apex), squash: 0 };
  if (f < arrive) return { ...queueAt(LAND_S - (f - onBelt) * BELT_V), squash: Math.max(0, 1 - (f - onBelt) / 3), flying: false };
  if (f < feed) return { ...queueAt(REVIEW_S), squash: Math.max(0, 0.6 * (1 - (f - arrive) / 4)), flying: false };
  // fed into the head, gathering speed, gone under it on review-in
  const t = (f - feed) / E6.feed;
  return { ...queueAt(REVIEW_S - (REVIEW.l + 6) * t * t), squash: 0, flying: false };
}

/** The stamp-in's hammer (beat4.ts hammerStroke's motion), down on review-in. */
export const reviewHammer = (f: number): number => clamp((f - (E6.reviewIn - 2)) / 2) * (1 - clamp((f - E6.reviewIn - 2) / 2));

/** The tape's advance after review-in (0..1, the reel's detent drives it one stub): the window's stubs pack east, the new stub comes out from under the record. */
export const advanceAt = (f: number): number => (f >= E6.until ? 0 : sine((f - E6.reviewIn - E6.advance) / E6.advanceFrames));

/** One stub's step along the window (u). */
export const STUB_STEP = CACHE_WINDOW.stub + CACHE_WINDOW.bar;

/** The rewind (0..1 over rewindFrames from recall), and the reel's turn back (radians, added to its angle). */
export const rewindAt = (f: number): number => (f >= E6.until ? 0 : sine((f - E6.rewind) / E6.rewindFrames));
/** The reel spins back nearly a whole turn and a half: the request's own stub on its top comes round toward the window. */
export const REWIND_TURN = 2 * Math.PI + 1.05;

/** The request's Thread's row, the older row the rewind brings back out from under the reel's flange onto the run (its west edge, width). */
export const THREAD_ROW = { x0: 74, w: 30, from: 104 } as const;
export const threadRowX = (f: number): number => THREAD_ROW.from + (THREAD_ROW.x0 - THREAD_ROW.from) * sine((f - E6.rewind - 4) / (E6.rewindFrames - 4));

/** The stub row's middle across the tape. */
const STUB_Y = (TAPE.y0 + TAPE.y1) / 2;

/** The thread's hop targets (world points on each body's face): the new row, the request's stub, its Thread's row, its bay's last report (the #0405 pointer tab in the drawer). */
export function hopTargets(): readonly P3[] {
  const z = TAPE.z + 1.2;
  const reqStub = CACHE_WINDOW.stubX0[4] + STUB_STEP + CACHE_WINDOW.stub / 2;
  const [dx] = rectC(DRAWER.box);
  return [
    [CACHE_WINDOW.stubX0[0] + CACHE_WINDOW.stub / 2, STUB_Y - 6, z],
    [reqStub, STUB_Y - 18, z],
    [THREAD_ROW.x0 + THREAD_ROW.w / 2, TAPE.y0 + 12, z],
    // the pointer tab #0405, leaning in the open drawer (state.ts TAB_REST_C: its face's middle)
    [dx - 3, DRAWER.box.y0 + 5.5 - DRAWER_OPEN_C + 10, DRAWER.z[0] + 4 + 6],
  ];
}

/** A hop's arc height over its chord (u). */
const HOP_ARC = [20, 12, 36] as const;

export interface ThreadState {
  /** the laid thread: the points it has reached (its arcs, sampled), its head the last */
  pts: P3[];
  /** each hop's № tab: how far it has opened (0..1, spring-dock), at its target */
  tabs: number[];
}

/** A point on hop k's arc at t (0..1). */
export function hopPoint(k: number, t: number): P3 {
  const T = hopTargets();
  const a = T[k];
  const b = T[k + 1];
  const u = clamp(t);
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u + 4 * HOP_ARC[k] * u * (1 - u)];
}

/** The reading thread at f: null before its first hop leaves the new row. */
export function threadAt(f: number, springDock: (f: number, start: number) => number): ThreadState | null {
  const H = E6.hops;
  if (f < H[0] - E6.hopFrames || f >= E6.until) return null;
  const pts: P3[] = [hopTargets()[0]];
  const N = 12;
  for (let k = 0; k < H.length; k++) {
    const t = (f - (H[k] - E6.hopFrames)) / E6.hopFrames;
    if (t <= 0) break;
    const e = sine(t);
    for (let j = 1; j <= N; j++) {
      const v = j / N;
      if (v > e) {
        pts.push(hopPoint(k, e));
        break;
      }
      pts.push(hopPoint(k, v));
    }
    if (t < 1) break;
  }
  const tabs = H.map((h) => springDock(f, h));
  return { pts, tabs };
}

/** The answer: out of the head's slot (two cells), torn off on recall-answer and flown back west into the card feeder's mouth. */
export const ANSWER_TO: P3 = [REVIEW.from[0] + 30, REVIEW.from[1], REVIEW.from[2] + 4];
export function answerAt(f: number): (DecodeSlip & { transit: number }) | null {
  const from = E6.answer - E6.answerCells * BEAT_6.decodeCell - E6.tear;
  if (f < from || f >= E6.until) return null;
  if (f < E6.answer) {
    const x = printedSlip(f, from, E6.answerCells, null, 1);
    return x ? { ...x, transit: 0 } : null;
  }
  const t = (f - E6.answer) / E6.answerFly;
  if (t >= 1) return null;
  const a: P3 = [HEAD_SLOT.x, HEAD_SLOT.y, HEAD_SLOT.z];
  const u = sine(t);
  // up and back west in a long arc, turning to fly nose first, sinking into the feeder's mouth
  const p: P3 = [a[0] + (ANSWER_TO[0] - a[0]) * u, a[1] + (ANSWER_TO[1] - a[1]) * u, a[2] + (ANSWER_TO[2] - a[2]) * u + 90 * Math.sin(Math.PI * u)];
  const flown = f - E6.answer;
  const transit = clamp(flown / 4) * clamp((E6.answerFly - flown) / 6) ** 2;
  return { out: E6.answerCells, punched: E6.answerCells, cells: E6.answerCells, p, pitch: 0, yaw: -(Math.PI / 2) * sine(t / 0.5), free: true, transit };
}

// ------------------------------------------------------------------------------------------------

export interface Beat6State {
  strip: StripSlip[];
  bar: { x: number } | null;

  /** the neck collar's needle, radians added to beat 4's */
  needle: number;
  decode: DecodeSlip | null;
  plate: PlatePose | null;
  review: (PathPose & { squash: number; flying: boolean }) | null;
  /** the head's hammer for the review's stamp-in */
  hammer: number;
  /** the tape's advance after the review's stamp-in (0..1) and the rewind (0..1) */
  advance: number;
  rewind: number;
  /** the Thread's row's west edge on the run */
  threadRow: number;
  thread: ThreadState | null;
  answer: (DecodeSlip & { transit: number }) | null;
  /** the one transit light (on the answer in flight) */
  transit: number;
}

/** Beat 6 at film frame f (pure); `springDock` is state.ts springAt on spring-dock (passed in: state.ts imports this module). */
export function beat6At(f: number, springDock: (f: number, start: number) => number): Beat6State {
  const answer = answerAt(f);
  return {
    strip: stripAt(f),
    bar: barAt(f),
    needle: f >= E6.until ? 0 : needleAt(f),
    decode: decodeAt(f),
    plate: plateAt(f),
    review: reviewAt(f),
    hammer: reviewHammer(f),
    advance: advanceAt(f),
    rewind: rewindAt(f),
    threadRow: threadRowX(f),
    thread: threadAt(f, springDock),
    answer,
    transit: answer?.transit ?? 0,
  };
}

