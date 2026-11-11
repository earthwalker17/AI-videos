/**
 * Beat 6, how one Router keeps up (STORYBOARD 6.1-6.4, film f2720-3439): what the Register does at a film frame. Pure:
 * every value is a sum over the cue sheet's beat-6 events (cues.ts BEAT_6 and its cue events), which the score sounds
 * on the same frames (audio/keepUp.ts), so each contact frame below is the frame the picture's event lands on.
 *
 * - 6.1-6.2 batching (the gulp). Each waiting event of BEAT_6.batches (a chat ask out of the spout, or a CI event, the
 *   card feeder's punched card: STRIP_KINDS) is posted over the gate onto the belt, rides up to its crest and hops into
 *   the throat (beat 4's and beat 5's ride), is fed under the print head and passes under the deck plate (out of sight
 *   for HIDDEN frames) to the gather tray (a shallow channel on the deck plate along the reading window's south edge, a
 *   hood at each end): it comes out from under the west hood, the head's end, as a strip slip with its kind at its nose,
 *   and slides east until it butts into the strip, landing on its frame (a held tick). The first stops against the east
 *   hood's lip, each later one shingles onto the one before, its nose a pitch behind, so the strip is the queue
 *   (TREATMENT Gulp: p_i = min(v (f - t_i), p_(i-1) - gap)), growing back toward the head. On the batch's downbeat
 *   (`batch`, `batch-2`) the reading bar, parked over the strip's front, sweeps the whole strip west (6 f: every cell
 *   lights as it passes, so all are lit within 6 f: the prefill), and the strip is drawn in under the west hood together,
 *   into the head, as the bar runs back to its park: the sweep takes sweepBase + sweepPerSlip per slip frames, so the
 *   longer strip is swept barely longer, and the tray is clear before the next slip comes in. Then the decode: a short
 *   slip comes out of the slot in the head's south face one cell per decodeCell frames, a hole punched in each, is torn
 *   off and drops into the dispatch slot under it (it leaves as dispatches). The neck collar's needle rises a hair with
 *   each slip and eases back down with the gulp.
 * - 6.2 the stress plate: it flies in from the east and is pressed onto the deck's south rail on `plate-detent`
 *   (f2880, a contact frame), its header and endpoints engraved (gl/plate.ts stressTexture), never rolled.
 * - 6.4 recall: a review comment, a punched card from the card feeder, is posted over the gate, rides the belt and
 *   hops into the throat on `review-card`; nothing subscribes to it, so it feeds into the head and is stamped in on
 *   `review-in` as a new row: the tape advances one stub and the new stub comes out from under the inline record. On
 *   `recall` (bar 42) the reel rewinds over rewindFrames: it spins back and an older row, the request's Thread's row,
 *   comes back out from under the tape's rise onto the run. A graphite reading thread hops from the new row to the
 *   request's stub, its Thread's row and, following the record's pointer, down to its bay's last report (the #0405
 *   pointer tab in the spill drawer), landing on each hop's frame (10 f a hop, 4 f dwell, a shuttle at its head), each
 *   landing opening a "№" tab; on `recall-answer` a short answer leaves the head's slot under the transit light, back
 *   west into the card feeder's mouth (out of the close's frame long before it gets there).
 *
 * The world from the summary on (SPAN_D, f5400) is still (d)'s, which draws none of this (`E6.until`).
 */
import { clamp, easings } from '@aiv/core';
import { BEAT_6, cue } from '../cues.ts';
import { CACHE_WINDOW, CARD_C, DECK, DRAWER, DRAWER_OPEN_C, FEEDERS, NEXT_SLIP, PRINT_HEAD, TAPE, THROAT, rectC, type P3 } from './layout.ts';

/** In and out (never -0, so a hold compares equal). */
const sine = (t: number): number => easings.inOutSine(clamp(t)) + 0;
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ------------------------------------------------------------------------------------------------
// Beat 6's own frames, hung off the cue sheet's

const R = BEAT_6.recall;
export const E6 = {
  /** a carrier leaves its feeder this long before it is posted, and is posted over `post` frames onto the belt (never 55 u a frame, off the close's frame) */
  outFrames: 4,
  post: 12,
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
 * The batches' events by kind (C15, "waiting events go in together": several channels merged). Chat asks come out of the
 * spout as chat slips (one of three prints), CI events out of the card feeder as its punched cards; under the head each is
 * queued onto the strip as a strip slip with its kind at its nose (gl/print6.ts: a chat slip's square nose and chat mark,
 * a CI event's clipped nose corner and the CI mark). The mail and calendar feeders are vellum (proposed) from
 * the turn on, so they send nothing.
 */
export type StripKind = { kind: 'chat'; v: number } | { kind: 'ci' };
const chat = (v: number): StripKind => ({ kind: 'chat', v });
const CI: StripKind = { kind: 'ci' };
export const STRIP_KINDS: readonly (readonly StripKind[])[] = [
  [chat(0), CI, chat(1), chat(2), CI],
  [CI, chat(1), chat(0), CI, chat(2), CI, chat(1), CI],
];

/**
 * The intake's belt (beat5.ts, state.ts SLIP_BELT's first two points): a carrier lands on it in its pose at KEEP_LAND,
 * rides up to the crest short of the throat's cheeks, then hops over them into the throat (beat 4's and beat 5's
 * grammar), turning to lie along the throat over the whole hop, so it never turns faster than 0.15 rad a frame.
 */
const BELT_A: P3 = NEXT_SLIP.gate;
const BELT_B: P3 = [-394, 210, 112];
const BELT_L = Math.hypot(BELT_B[0] - BELT_A[0], BELT_B[1] - BELT_A[1], BELT_B[2] - BELT_A[2]);
/** The belt's heading and slope, and where a carrier lands on it (beat5.ts BELT_HEADING, BELT_SLOPE, KEEP_LAND: 56 u up from MT1's landing; the same values, beat6.test.ts, kept here as beat 5 reads state.ts at load). */
export const BELT_HEADING = Math.atan2(BELT_B[1] - BELT_A[1], BELT_B[0] - BELT_A[0]);
export const BELT_SLOPE = Math.atan2(BELT_B[2] - BELT_A[2], Math.hypot(BELT_B[0] - BELT_A[0], BELT_B[1] - BELT_A[1]));
export const KEEP_LAND: P3 = lerp3(BELT_A, BELT_B, 56 / BELT_L);
const beltAtX = (x: number): P3 => lerp3(BELT_A, BELT_B, (x - BELT_A[0]) / (BELT_B[0] - BELT_A[0]));
/** The crest for a carrier of half length hl and half width hw: its nose's leading corner 16 u short of the cheeks' west end (beat5.ts CREST for a chat slip). */
export const crestFor = (hl: number, hw: number): P3 => beltAtX(THROAT.box.x0 - 16 - hl * Math.cos(BELT_SLOPE) * Math.cos(BELT_HEADING) - hw * Math.abs(Math.sin(BELT_HEADING)));
/** The ride's frames: up the belt, the hop (its apex over the chord), the dwell in the throat, the feed under the head (in-quad). */
export const RIDE6 = { belt: 3, hop: 6, apex: 40, dwell: 1, feed: 4 } as const;

/** A carrier on the intake: its size, where it starts (inside its feeder), its feeder's mouth, its post's apex, its crest, its place in the throat (nose 2 u short of the head) and wholly under the head. */
export interface Carrier {
  l: number;
  w: number;
  inside: P3;
  mouth: P3;
  apex: number;
  crest: P3;
  throat: P3;
  under: P3;
}
const THROAT_Y = NEXT_SLIP.throat[1];
const THROAT_Z = NEXT_SLIP.throat[2];
const throatFor = (hl: number): P3 => [PRINT_HEAD.box.x0 - 2 - hl, THROAT_Y, THROAT_Z];
const underFor = (hl: number): P3 => [PRINT_HEAD.box.x0 + 2 + hl, THROAT_Y, THROAT_Z];
/** The card feeder's mouth (beat4.ts CI_OUT): a card is pushed out from under the one lying in it. */
export const CI_MOUTH = { from: [FEEDERS.ci.x1 - 30, rectC(FEEDERS.ci)[1] - 2, 5.2] as P3, to: [FEEDERS.ci.x1 + 30, rectC(FEEDERS.ci)[1] - 2, 5.2] as P3 } as const;
/** The review card and a CI event (the card feeder's punched card, layout as Intake's ciCard, 84 x 50). */
export const REVIEW = { l: 84, w: 50, apex: 64 } as const;
export const CARRIERS: Record<StripKind['kind'], Carrier> = {
  chat: {
    l: NEXT_SLIP.l,
    w: NEXT_SLIP.w,
    inside: [NEXT_SLIP.spout[0] - 60, NEXT_SLIP.spout[1], NEXT_SLIP.spout[2] + 2],
    mouth: NEXT_SLIP.spout,
    apex: NEXT_SLIP.apex,
    crest: crestFor(NEXT_SLIP.l / 2, NEXT_SLIP.w / 2),
    throat: throatFor(NEXT_SLIP.l / 2),
    under: underFor(NEXT_SLIP.l / 2),
  },
  ci: { l: REVIEW.l, w: REVIEW.w, inside: CI_MOUTH.from, mouth: CI_MOUTH.to, apex: REVIEW.apex, crest: crestFor(REVIEW.l / 2, REVIEW.w / 2), throat: throatFor(REVIEW.l / 2), under: underFor(REVIEW.l / 2) },
};

export interface PathPose {
  p: P3;
  heading: number;
  slope: number;
}
export interface RidePose extends PathPose {
  squash: number;
  flying: boolean;
}

/**
 * A carrier's ride at film frame `now`: out of its feeder (outFrames), posted in an arc onto the belt, landing in the
 * belt's pose on `land` (a contact), up the belt to the crest, the hop into the throat, waiting there until `feed`, then
 * fed under the head over RIDE6.feed frames (in-quad); null before it comes out and once it is wholly under the head.
 */
export function rideAt(now: number, c: Carrier, land: number, feed: number): RidePose | null {
  const R = RIDE6;
  const post = land - E6.post;
  if (now < post - E6.outFrames || now > feed + R.feed) return null;
  if (now < post) return { p: lerp3(c.inside, c.mouth, easings.outCubic(clamp((now - (post - E6.outFrames)) / E6.outFrames))), heading: 0, slope: 0, squash: 0, flying: true };
  if (now < land) {
    const t = (now - post) / E6.post;
    // fast off the mouth and slower onto the belt (half linear, half out-quad); level, then nosing up into the belt's pose, in it on the landing
    const u = 0.5 * t + 0.5 * easings.outQuad(t);
    const e = sine((t - 0.3) / 0.7);
    const p: P3 = [c.mouth[0] + (KEEP_LAND[0] - c.mouth[0]) * u, c.mouth[1] + (KEEP_LAND[1] - c.mouth[1]) * u, c.mouth[2] + (KEEP_LAND[2] - c.mouth[2]) * t + 4 * c.apex * t * (1 - t)];
    return { p, heading: BELT_HEADING * sine(t), slope: -0.2 * (u - 0.5) * (1 - e) + BELT_SLOPE * e, squash: 0, flying: true };
  }
  const hop = land + R.belt;
  if (now < hop) return { p: lerp3(KEEP_LAND, c.crest, (now - land) / R.belt), heading: BELT_HEADING, slope: BELT_SLOPE, squash: Math.max(0, 1 - (now - land) / 3), flying: false };
  const th = hop + R.hop;
  if (now < th) {
    // up off the belt's top, over the cheeks, down between them; turning to lie along the throat over the whole hop
    const u = (now - hop) / R.hop;
    const xy = sine(u);
    const k = 1 - sine(u);
    return { p: [c.crest[0] + (c.throat[0] - c.crest[0]) * xy, c.crest[1] + (c.throat[1] - c.crest[1]) * xy, c.crest[2] + (c.throat[2] - c.crest[2]) * u + 4 * R.apex * u * (1 - u)], heading: BELT_HEADING * k, slope: BELT_SLOPE * k, squash: 0, flying: true };
  }
  const squash = Math.max(0, 1 - (now - th) / 3);
  if (now < feed) return { p: c.throat, heading: 0, slope: 0, squash, flying: false };
  return { p: lerp3(c.throat, c.under, easings.inQuad(clamp((now - feed) / R.feed))), heading: 0, slope: 0, squash, flying: false };
}
/** A ride's landing on the belt for a carrier that lands in the throat on `th`. */
export const landFor = (th: number): number => th - RIDE6.hop - RIDE6.belt;

/**
 * The gather tray (6.1): a shallow channel on the deck plate between the reading window's south edge and the south rail,
 * east of the index arm's plate, with a low hood at each end. The slips come out from under the west hood (the head's
 * end: they pass under the head and the deck plate on their way), slide east and wait as the strip, its front against
 * the east hood's lip; on the sweep the whole strip is drawn back west under the west hood, into the head. The strip's
 * slips lie east-west, nose east, so their print reads upright from the camera.
 */
export const TRAY = { x0: -252, x1: -12, y0: 143, y1: 183, floor: DECK.top, rim: 2.4, hood: 16 } as const;
export const TRAY_Y = (TRAY.y0 + TRAY.y1) / 2;
/** Where a slip is cut off from view inside each hood (its part beyond is under the hood). */
export const CROP = { west: TRAY.x0 + TRAY.hood / 2, east: TRAY.x1 - TRAY.hood / 2 } as const;
/** One slip's step along the strip: each later slip lies on the one before, its nose a pitch behind (west of) that one's nose, so each shows a nose band with its kind. */
export const PITCH = 16.8;
/** The front slip's centre (x): its nose a hair short of the east hood's lip. */
export const FRONT_X = TRAY.x1 - TRAY.hood - 1 - NEXT_SLIP.l / 2;
/** Where a slip comes in (its centre: its nose at the west crop, the rest under the hood) and how fast it slides along the tray. */
export const ENTRY_X = CROP.west - NEXT_SLIP.l / 2;
export const TRAY_V = 40;
/** Frames a slip spends out of sight between wholly under the head and its nose at the west hood's crop (under the deck plate). */
export const HIDDEN = 8;
/** The slips lie a sheet above the one before in the strip (the follower on top), on the tray's floor. */
const SHINGLE = 0.7;
const ON_FLOOR = TRAY.floor + 0.6;
/** The tray and its hoods (and the reading bar on its park) come up out of the deck plate with the close (the bar-34 dolly), before the first slip. */
export const TRAY_UP = 2648;
export const TRAY_UP_FRAMES = 8;

export interface StripSlip {
  /** the batch and the slip's index in it (its pitch behind the front), its kind */
  b: number;
  i: number;
  kind: StripKind;
  pose: PathPose;
  /** its landing squash on the belt or in the throat, and as it butts into the strip (0..1 of 3%) */
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

/** Each batch's frames: its slips' landings (butting into the strip), the sweep's downbeat and its length, its slips' kinds. */
export const BATCHES = BEAT_6.batches.map((b, k) => {
  const n = b.slips.length;
  const sweepFrames = BEAT_6.sweepBase + BEAT_6.sweepPerSlip * n;
  return { k, slips: b.slips as readonly number[], n, sweep: b.sweep, sweepFrames, end: b.sweep + sweepFrames, kinds: STRIP_KINDS[k]! };
});

/** One slip's frames: its ride (landing on the belt, in the throat, fed under the head), out of the west hood, butting into the strip on its cue frame. */
export function stripFrames(b: (typeof BATCHES)[number], i: number) {
  const L = b.slips[i]!;
  const place = FRONT_X - i * PITCH;
  const inTray = L - (place - ENTRY_X) / TRAY_V;
  const under = inTray - HIDDEN;
  const feed = under - RIDE6.feed;
  const th = feed - RIDE6.dwell;
  return { L, place, inTray, under, feed, th, land: landFor(th) };
}

/** The reading bar's park (x): over the front slip's nose, by the east hood's lip; the far end of its sweep, by the west hood's lip. */
export const BAR_PARK = TRAY.x1 - TRAY.hood - 3.5;
export const BAR_FAR = TRAY.x0 + TRAY.hood + 3.5;
/** The strip is drawn in under the west hood over `frames`, from `at` frames after the downbeat (as the bar starts back). */
export const GULP = { at: E6_READ, frames: 7 } as const;

/** How far the batch's sweep has gone at f: the bar's run west down the strip (0..1, the read), then its run back to its park (0..1). */
function sweepAt(f: number, b: (typeof BATCHES)[number]): { read: number; back: number } {
  const x = f - b.sweep + 1;
  // on the downbeat (a contact frame) the bar is already off its park: it starts the frame before; a swish down the
  // strip that starts at speed (half linear) and eases into its far end, never more than about 50 u a frame
  const read = x <= 0 ? 0 : Math.min(1, 0.5 * clamp(x / E6_READ) + 0.5 * sine(x / E6_READ));
  const back = sine((f - b.sweep - E6_READ + 1) / (b.sweepFrames - E6_READ));
  return { read, back };
}

/** How far the gulp has drawn the batch's strip in (0..1). */
const gulpK = (f: number, b: (typeof BATCHES)[number]): number => sine((f - b.sweep - GULP.at + 1) / GULP.frames);
/** How far the batch's strip has been drawn in west at f (u): its front's nose under the west crop by the end. */
const gulpOf = (f: number, b: (typeof BATCHES)[number]): number => (FRONT_X + NEXT_SLIP.l / 2 - CROP.west) * gulpK(f, b);

/** One slip of a batch at film frame f, or null before it comes out of its feeder and once it has been drawn in under the west hood. */
export function stripSlipAt(f: number, b: (typeof BATCHES)[number], i: number): StripSlip | null {
  if (f >= E6.until) return null;
  const F = stripFrames(b, i);
  const kind = b.kinds[i]!;
  const base = { b: b.k, i, kind, inTray: false, view: null, inStrip: false };
  if (f <= F.under) {
    const c = CARRIERS[kind.kind];
    const r = rideAt(f, c, F.land, F.feed);
    if (!r) return null;
    // wholly under the head (and the deck plate east of it) once its west end is past the head's west face
    return { ...base, pose: r, squash: r.squash, lit: 0, flying: r.flying, hidden: r.p[0] - c.l / 2 >= PRINT_HEAD.box.x0 };
  }
  const z = ON_FLOOR + SHINGLE * i;
  const at = (x: number): StripSlip => {
    const view: [number, number] = [Math.max(CROP.west, x - NEXT_SLIP.l / 2), Math.min(CROP.east, x + NEXT_SLIP.l / 2)];
    const open = view[1] - view[0] > 0.01;
    return { ...base, inTray: true, view: open ? view : null, pose: { p: [x, TRAY_Y, z], heading: 0, slope: 0 }, squash: 0, lit: 0, flying: false, hidden: !open };
  };
  // under the head and the deck plate on its way to the tray's west hood
  if (f < F.inTray) return { ...at(ENTRY_X), hidden: true, view: null };
  // out from under the west hood, sliding east to its place (linear transport), butting on its frame
  if (f < F.L) return at(Math.min(F.place, ENTRY_X + (f - F.inTray) * TRAY_V));
  const x = F.place - gulpOf(f, b);
  if (x + NEXT_SLIP.l / 2 <= CROP.west) return null;
  // in the strip: still until the sweep; read as the bar passes its nose band; drawn in under the west hood with the strip
  const sw = sweepAt(f, b);
  const barX = BAR_PARK + (BAR_FAR - BAR_PARK) * sw.read;
  const nose = F.place + NEXT_SLIP.l / 2;
  const lit = sw.back > 0 || f >= b.sweep + E6_READ ? 1 : clamp((Math.min(nose, BAR_PARK) - barX) / (PITCH + 6)) + 0;
  return { ...at(x), inStrip: true, lit, squash: f - F.L < 4 ? 0.6 * (1 - (f - F.L) / 4) : 0 };
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

/**
 * The dispatch slot's cover (objects/Batch.tsx): it slides aside (4 f) before the first decision drops in, and back once
 * the last has gone through it; then the tray sinks back into the deck plate with its bar (the queue is clear, and the
 * window and the drawer have the close to themselves for the cache: still (c)).
 */
export const SLOT_OPEN = BATCHES[0]!.end + E6.decodeCells * BEAT_6.decodeCell + 1;
export const SLOT_CLOSE = BATCHES[1]!.end + E6.decodeCells * BEAT_6.decodeCell + E6.tear + E6.dispatch;
export const TRAY_DOWN = SLOT_CLOSE + 4;
/** How far the dispatch slot's cover has slid aside (0..1, in and out). */
export const slotOpenAt = (f: number): number => easings.inOutSine(clamp((f - SLOT_OPEN) / 4)) * (1 - easings.inOutSine(clamp((f - SLOT_CLOSE) / 4))) + 0;
/** The tray's rise out of the deck plate (0..1, in and out), from TRAY_UP, and its sink back into it from TRAY_DOWN. */
export const trayUp = (f: number): number => (f >= E6.until ? 0 : easings.inOutCubic(clamp((f - TRAY_UP) / TRAY_UP_FRAMES)) * (1 - easings.inOutCubic(clamp((f - TRAY_DOWN) / TRAY_UP_FRAMES))) + 0);

/** The reading bar at f: its x along the tray, and how far it has come up out of the deck plate with the tray (0..1); null before the tray rises and once it has sunk again. */
export function barAt(f: number): { x: number; up: number } | null {
  if (f < TRAY_UP || f >= TRAY_DOWN + TRAY_UP_FRAMES || f >= E6.until) return null;
  let x = BAR_PARK;
  for (const b of BATCHES) {
    if (f < b.sweep - 1 || f >= b.end + 1) continue;
    const sw = sweepAt(f, b);
    x = sw.back > 0 ? BAR_FAR + (BAR_PARK - BAR_FAR) * sw.back : BAR_PARK + (BAR_FAR - BAR_PARK) * sw.read;
  }
  return { x, up: trayUp(f) };
}
/** The bar rides this far over the tray's floor (clear of the shingled strip, its shoes on the tray's rims). */
export const BAR_RIDE = 9;

/** The neck collar's needle, radians added to beat 4's low reading: a hair up as each slip butts into the strip (never past a fifth of its arc), easing back down with the gulp. */
export function needleAt(f: number): number {
  let n = 0;
  for (const b of BATCHES) {
    const k = 1 - gulpK(f, b);
    for (let i = 0; i < b.n; i++) if (f >= b.slips[i]!) n += k;
  }
  return -0.035 * n;
}

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

/** The review card at f: posted from the card feeder over the gate, up the belt and hopping into the throat (landing on review-card), waiting, fed under the head before review-in (the CI events' ride); null otherwise. */
export function reviewAt(f: number): RidePose | null {
  if (f >= E6.reviewIn || f >= E6.until) return null;
  // wholly under the head the frame before the stamp
  return rideAt(f, CARRIERS.ci, landFor(E6.reviewCard), E6.reviewIn - 1 - RIDE6.feed);
}

/** The stamp-in's hammer (beat4.ts hammerStroke's motion), down on review-in. */
export const reviewHammer = (f: number): number => clamp((f - (E6.reviewIn - 2)) / 2) * (1 - clamp((f - E6.reviewIn - 2) / 2));

/** The tape's advance after review-in (0..1, the reel's detent drives it one stub): the window's stubs pack east, the new stub comes out from under the record. */
export const advanceAt = (f: number): number => (f >= E6.until ? 0 : sine((f - E6.reviewIn - E6.advance) / E6.advanceFrames));

/** One stub's step along the window (u). */
export const STUB_STEP = CACHE_WINDOW.stub + CACHE_WINDOW.bar;

/** The rewind (0..1 over rewindFrames from recall), and the reel's turn back (radians, added to its angle). */
export const rewindAt = (f: number): number => (f >= E6.until ? 0 : sine((f - E6.rewind) / E6.rewindFrames));
/** The reel spins back half a turn (at most about 0.21 rad a frame, so its three spokes never strobe; the code review's 1.17 turns ran 0.48 rad a frame). */
export const REWIND_TURN = Math.PI;

/**
 * The request's Thread's row, the older row the rewind brings back onto the run (its west edge, width): it starts wholly
 * under the tape's rise onto the reel (layout.ts TAPE_FLAT_X1) and comes out with the tape as it runs back (the bare
 * tape's print moves the same distance: objects/Register.tsx REWIND_U).
 */
export const THREAD_ROW = { x0: 74, w: 30, from: 114 } as const;
export const threadRowX = (f: number): number => THREAD_ROW.from + (THREAD_ROW.x0 - THREAD_ROW.from) * rewindAt(f);

/** The stub row's middle across the tape. */
const STUB_Y = (TAPE.y0 + TAPE.y1) / 2;

/**
 * The thread's hop targets (world points on each body's face): the new row, the request's stub, its Thread's row, its
 * bay's last report (the #0405 pointer tab in the drawer: on its face east of its ID and its vermilion mark).
 */
export function hopTargets(): readonly P3[] {
  const z = TAPE.z + 1.2;
  const reqStub = CACHE_WINDOW.stubX0[4] + STUB_STEP + CACHE_WINDOW.stub / 2;
  const [dx] = rectC(DRAWER.box);
  return [
    [CACHE_WINDOW.stubX0[0] + CACHE_WINDOW.stub / 2, STUB_Y - 6, z],
    [reqStub, STUB_Y - 18, z],
    [THREAD_ROW.x0 + THREAD_ROW.w / 2, TAPE.y0 + 12, z],
    // the pointer tab #0405, leaning in the open drawer (state.ts TAB_REST_C: its face's middle, then east past its ID)
    [dx - 3 + 25, DRAWER.box.y0 + 5.5 - DRAWER_OPEN_C + 10, DRAWER.z[0] + 4 + 6],
  ];
}
/**
 * The last hop follows the record's pointer: back along the tape to the pointer printed on the inline record, then down
 * from it into the drawer to the tab it names (west of the cache tag's leader, never across the tag's words).
 */
export const HOP3_VIA: P3 = [-128, TAPE.y0 + 10, TAPE.z + 1.2];

/** Each hop's legs (chords) and their arcs' heights over them (u). */
function hopLegs(k: number): { a: P3; b: P3; arc: number }[] {
  const T = hopTargets();
  if (k === 0) return [{ a: T[0], b: T[1], arc: 20 }];
  if (k === 1) return [{ a: T[1], b: T[2], arc: 12 }];
  return [
    { a: T[2], b: HOP3_VIA, arc: 18 },
    { a: HOP3_VIA, b: T[3], arc: 40 },
  ];
}
const chord = (l: { a: P3; b: P3 }): number => Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1], l.b[2] - l.a[2]);
const legPoint = (l: { a: P3; b: P3; arc: number }, u: number): P3 => [l.a[0] + (l.b[0] - l.a[0]) * u, l.a[1] + (l.b[1] - l.a[1]) * u, l.a[2] + (l.b[2] - l.a[2]) * u + 4 * l.arc * u * (1 - u)];

/** The № tabs' seats: a hair south of where each hop lands, the last beside the pointer tab's ID (on its east end). */
export function tabSeats(): readonly P3[] {
  const T = hopTargets();
  return [
    [T[1][0], T[1][1] - 4, T[1][2] + 0.3],
    [T[2][0], T[2][1] - 4, T[2][2] + 0.3],
    [T[3][0] + 11, T[3][1] - 2, T[3][2] + 1],
  ];
}

export interface ThreadState {
  /** the laid thread: the points it has reached (its arcs, sampled), its head the last */
  pts: P3[];
  /** the shuttle at its head while a hop runs (null at rest) */
  shuttle: P3 | null;
  /** each hop's № tab: how far it has opened (0..1, spring-dock), at its seat */
  tabs: number[];
}

/** A point on hop k's path at t (0..1 of its length). */
export function hopPoint(k: number, t: number): P3 {
  const legs = hopLegs(k);
  const L = legs.map(chord);
  let d = clamp(t) * L.reduce((a, b) => a + b, 0);
  for (let i = 0; i < legs.length; i++) {
    if (d <= L[i]! || i === legs.length - 1) return legPoint(legs[i]!, clamp(d / L[i]!));
    d -= L[i]!;
  }
  return legs[legs.length - 1]!.b;
}
/** Where hop k's path passes each of its legs' ends (0..1 of its length). */
function hopBreaks(k: number): number[] {
  const L = hopLegs(k).map(chord);
  const total = L.reduce((a, b) => a + b, 0);
  let s = 0;
  return L.map((l) => (s += l) / total);
}

/** The reading thread at f: null before its first hop leaves the new row. */
export function threadAt(f: number, springDock: (f: number, start: number) => number): ThreadState | null {
  const H = E6.hops;
  if (f < H[0] - E6.hopFrames || f >= E6.until) return null;
  const pts: P3[] = [hopTargets()[0]];
  let shuttle: P3 | null = null;
  for (let k = 0; k < H.length; k++) {
    const t = (f - (H[k]! - E6.hopFrames)) / E6.hopFrames;
    if (t <= 0) break;
    const e = sine(t);
    // samples along the path (every leg's end among them, so the thread turns sharp at the pointer), up to its head
    const vs = [...Array.from({ length: 16 }, (_, j) => (j + 1) / 16), ...hopBreaks(k)].sort((a, b) => a - b);
    for (const v of vs) {
      if (v >= e) break;
      pts.push(hopPoint(k, v));
    }
    pts.push(hopPoint(k, e));
    if (t < 1) {
      shuttle = pts[pts.length - 1]!;
      break;
    }
  }
  const tabs = H.map((h) => springDock(f, h));
  return { pts, shuttle, tabs };
}

/** The answer: out of the head's slot (two cells), torn off on recall-answer and flown back west to the card feeder's mouth, then pushed in under the card lying there. */
export const ANSWER_TO: P3 = [CI_MOUTH.to[0], CI_MOUTH.to[1], CI_MOUTH.to[2] + 8];
const ANSWER_IN = 5;
export function answerAt(f: number): (DecodeSlip & { transit: number }) | null {
  const from = E6.answer - E6.answerCells * BEAT_6.decodeCell - E6.tear;
  if (f < from || f >= E6.until) return null;
  if (f < E6.answer) {
    const x = printedSlip(f, from, E6.answerCells, null, 1);
    return x ? { ...x, transit: 0 } : null;
  }
  const flown = f - E6.answer;
  if (flown >= E6.answerFly) return null;
  const transit = clamp(flown / 4) * clamp((E6.answerFly - ANSWER_IN - flown) / 6) ** 2;
  const fly = E6.answerFly - ANSWER_IN;
  const base = { out: E6.answerCells, punched: E6.answerCells, cells: E6.answerCells, pitch: 0, yaw: -Math.PI / 2, free: true, transit };
  if (flown >= fly) {
    // into the mouth, under the card lying in it
    const u = easings.inQuad((flown - fly + 1) / ANSWER_IN);
    return { ...base, p: [ANSWER_TO[0] + (CI_MOUTH.from[0] - ANSWER_TO[0]) * u, ANSWER_TO[1], ANSWER_TO[2] + (CI_MOUTH.from[2] - 1 - ANSWER_TO[2]) * u] };
  }
  const t = flown / fly;
  const a: P3 = [HEAD_SLOT.x, HEAD_SLOT.y, HEAD_SLOT.z];
  const u = sine(t);
  // up and back west in a long arc, turning to fly nose first, sinking onto the feeder's mouth
  const p: P3 = [a[0] + (ANSWER_TO[0] - a[0]) * u, a[1] + (ANSWER_TO[1] - a[1]) * u, a[2] + (ANSWER_TO[2] - a[2]) * u + 90 * Math.sin(Math.PI * u)];
  return { ...base, p, yaw: -(Math.PI / 2) * sine(t / 0.5) };
}

// ------------------------------------------------------------------------------------------------

export interface Beat6State {
  strip: StripSlip[];
  /** the reading bar: its x along the tray, its rise with the tray (0..1) */
  bar: { x: number; up: number } | null;

  /** the neck collar's needle, radians added to beat 4's */
  needle: number;
  decode: DecodeSlip | null;
  plate: PlatePose | null;
  review: RidePose | null;
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

