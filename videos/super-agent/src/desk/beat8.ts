/**
 * Beat 8 (STORYBOARD 8.1-8.5, film f3920-4559; cues.ts BEAT_8): many runs, the evidence. The film's one chart, made as a
 * physical printed test sheet lying on the desk east of the bays (camera.ts FRAMING_SHEET, TO_SHEET). Pure: every value
 * is a function of the film frame, hung off BEAT_8's contact frames and the stamps' text windows, which the score sounds
 * on the same frames (audio/evidence.ts).
 *
 * - 8.1 (bar 50, the truck east): the sheet slides in from beyond the frame's east edge as the camera starts to move
 *   (`sheetDx`), with its furniture on it: a steel rail along its head carrying the print carriage, a clamp bar along its
 *   west margin (the strips' feed, the die parked on it) and a smaller one at the token chart's west end (the stacks').
 *   From `ticks.from` the carriage runs east along the rail at a constant pace and prints the load line under its head:
 *   exactly `ticks.n` ticks in two staggered rows, `inked` of them bold in full ink (the work requests), the rest a faint
 *   rain, each landing on its frame of the score's rain; it parks at the rail's east end. No text while the camera moves.
 * - 8.2 (bar 51): the form's print inks in staggered, each over 3 f: the caveat stamp with C20 (the tag-chart window's
 *   first frame), each lane's name 2 f before its strip, the load tag (DOM) once those are down, the legend once the
 *   strips are nearly out. Each lane's paper strip slides out from under the clamp bar at a constant pace for exactly
 *   `stripFrames` x its p95 frames (the score holds its tone that long), so its length is its slowest run on one unitless
 *   scale (K u a unit): the cut is its leading end, the typical run (p50) a hole punched through it. "~½" on its window.
 * - 8.3: on `bracket` both holes are ringed in full ink and the bracket between them springs open (its serifs, bar and
 *   arrows on the settle spring, about 9 f); "~10%" on its window, and "~½" steps to the light print.
 * - 8.4: the die hops off the clamp and punches the told-to-delegate strip's notches on `notches`, a 2 f press landing on
 *   each contact frame (the notch is cut under its face; the chad slides out from under it as it lifts); over the run
 *   without a notch it hovers through the eighth and never comes down. Then, still under C22, it goes round by the clamp
 *   to the single session's strip and walks its five run places on the eighths, coming down short of it on each and
 *   cutting nothing (ONE_PASS), and comes to rest on the clamp at that strip's row. The single session's strip stays
 *   blank (it never delegated); the two-level strip's five notches were cut before it slid out (delegation is
 *   structural). From `longRun.from` the band of the run the model did itself slides out of its uncut place, east along
 *   the strip's north edge to its cut, over `longRun.frames` (the long tail).
 * - 8.5: the token header inks on its window; each lane's stack, in its lane's stock, is fed east out of the token clamp
 *   at a constant pace from `stacks[i].from`, its sheets peeling off the pack as it passes their places (shingled), its
 *   last sheet landing on `stacks[i].done`; the stacks' reaches are in the ratio of the lanes' cache-read tokens. "2–4×"
 *   inks on its window, on the last stack's completion, and "~10%" steps to the light print.
 * - 9.1 (bar 58): the sheet slides away east with everything on it (`sheetDx`, an ease-in held to a pace), off the frame
 *   during bar 58's ease-out and gone from the world the frame after; nothing of it is in still (d).
 *
 * Focus: from bar 50 everything of the desk steps down while the sheet is the action (FOCUS_8, one entry, 'b8-away', at a
 * full step through 4560 so beat 9 can take over from it); your desk steps on the own set (YourDesk honours only that).
 * Labels are away 3920-4642 (film.ts). The load tag is the beat's one DOM text (TAGS_8): every other word is canvas ink
 * on the sheet (gl/print8.ts), drawn by objects/Evidence.tsx.
 *
 * Import rule (as beat7.ts): module-level tables from leaf modules only (cues.ts, layout.ts, springs.ts, fpKit.ts,
 * camera.ts); types from anywhere.
 */
import { clamp, easings } from '@aiv/core';
import { Easing } from 'remotion';
import { BEAT_8, WORDS, at, cue, textWindow } from '../cues.ts';
import type { CardUp } from './beat4.ts';
import { TO_SHEET } from './camera.ts';
import { rectFp, segFp, type Footprint } from './fpKit.ts';
import type { P2, P3, Pool, Rect } from './layout.ts';
import type { TagSpec } from './Overlay.tsx';
import { SPRING, springAt } from './springs.ts';
import type { ArmStep, DeskState, FocusEntry, LampStep, ReplyState } from './state.ts';
import type { YouPose } from './you.ts';

/** Whether beat 8 is built (false: the animatic's slate shows its cues' words and the "animatic" mark over its frames). */
export const BUILT = true;

const B = BEAT_8;

/**
 * The worded Proactive plate at beat 8's framing: FRAMING_SHEET cuts its west end off the frame (its words would read
 * "active · 主动"), so its face cross-fades (8 f, TREATMENT Type, printed fields: a mark swapped under a camera move, on that
 * object only) to its pictogram, still (d)'s starter key, as bar 50's truck sets out, and back to its words under bar 58's
 * ease-out once its west end is in the frame again (beat8.test.ts holds both against the camera). objects/Filter.tsx.
 */
export const PROACTIVE_MARK = { out: TO_SHEET.from, back: 4586, frames: 8 } as const;
/** How far the Proactive plate's face is its pictogram (0 its words .. 1 the key). */
export const proactiveMarkAt = (f: number): number =>
  easings.inOutSine(clamp((f - PROACTIVE_MARK.out) / PROACTIVE_MARK.frames)) - easings.inOutSine(clamp((f - PROACTIVE_MARK.back) / PROACTIVE_MARK.frames));

// ------------------------------------------------------------------------------------------------
// The sheet and its furniture (world units). Sheet-local coordinates: u east from the sheet's west edge, v south from its
// north edge (the print's own axes: a canvas drawn in u, v lies on the sheet the right way up).
//
// The layout, north to south: the rail and the load line; the caveat stamp; the legend (the key: a hole for typical, a
// cut for slowest); the lanes (each name over its strip, the told-to-delegate strip with its long run's band north of
// it, the bracket in the gap between the told-to-delegate and two-level strips, "two levels" under its strip); the
// token chart (its header over the stacks, each lane's stack in its lane's stock, in the lanes' order). The hero stamps
// stand in a column on the east, each in the rows of what it reads: "~½" by the lanes' heads, "~10%" by the told and
// two-level strips, "2–4×" by the stacks.

/** The sheet at rest, east of the bays (the fresh bay ends at x 700), inside y 72-868 at FRAMING_SHEET; z its top. */
export const SHEET8 = { x0: 735, x1: 1925, y0: -430, y1: 752, z: 0.8 } as const;
export const SHEET_W = SHEET8.x1 - SHEET8.x0;
export const SHEET_H = SHEET8.y1 - SHEET8.y0;
/** A sheet-local point (u, v) in world x, y at the sheet's rest, `dx` east of it. */
export const onSheet = (u: number, v: number, dx = 0): P2 => [SHEET8.x0 + u + dx, SHEET8.y1 - v];
/** A sheet-local box (u0..u1, v0..v1) as a world rect at the sheet's rest, `dx` east of it. */
export const sheetRect = (u0: number, u1: number, v0: number, v1: number, dx = 0): Rect => ({ x0: SHEET8.x0 + u0 + dx, x1: SHEET8.x0 + u1 + dx, y0: SHEET8.y1 - v1, y1: SHEET8.y1 - v0 });

/**
 * Heights over the desk: the sheet's top, its print (decals), a punched chad lying on the sheet, the long run's band
 * (its south edge tucked under the told-to-delegate strip), a strip, a stack's first sheet (each sheet over the ones
 * before it by STACK_DZ), the bracket's ink (stamped across the strips).
 */
export const Z8 = { sheet: SHEET8.z, print: SHEET8.z + 0.15, chad: SHEET8.z + 0.3, band: SHEET8.z + 0.5, strip: SHEET8.z + 0.8, stack: SHEET8.z + 0.4, mark: SHEET8.z + 1.0 } as const;
/** A stack sheet's rise over the one before it (shingled sheets lie nearly flat): the drawn sheets and their footprint both use it. */
export const STACK_DZ = 0.15;

/** The rail along the sheet's head (a steel rod on two posts) and the print carriage riding it. */
export const RAIL = { u0: 26, u1: 1170, v: 18, r: 3, z: SHEET8.z + 3.4, posts: [[10, 28], [1168, 1186]] as const, postV: [8, 28] as const, postZ: 9 } as const;
export const CARRIAGE = { w: 44, v0: 4, v1: 36, z: [SHEET8.z + 0.8, SHEET8.z + 13] as const, head: { w: 10, v0: 36, v1: 46, z: [SHEET8.z + 0.6, SHEET8.z + 6] as const } } as const;

/**
 * The load line: `ticks.n` ticks along the head, tick i at u0 + pitch i, the even ones in the north row and the odd ones
 * in the south row (each row's own pitch 2 x pitch, 6.8 u: never finer than 4 u), the faint ones each its own length
 * (an index hash: rain, never a ruler's graduations), the inked ones bold and full height across both rows.
 */
export const TICKS = { u0: 56, pitch: 3.4, rows: [[50, 63], [66, 79]] as const, inked: [47, 82] as const, w: 1.6, inkedW: 4.4 } as const;
export const tickU = (i: number): number => TICKS.u0 + TICKS.pitch * i;

/** The caveat stamp (the chart tag) across the sheet under the load line: its box, its two lines' baselines, its em (u). */
export const CAVEAT = { u0: 28, u1: 1162, v0: 90, v1: 228, en: 150, zh: 206, em: 56 } as const;
/** The legend (the key): a hole for typical, a cut for slowest, one line under the caveat; its samples are a strip's. */
export const LEGEND = { u: 40, v: 280, em: 53 } as const;

/** The lanes' scale: u of strip per unit of the article's table (one unitless scale for all three; no time axis). */
export const K = 15;
/** The strips' clamp bar along the west margin (the feed they slide out from under), and where every strip's run starts. */
export const CLAMP = { u0: 34, u1: 92, v0: 356, v1: 804, z: SHEET8.z + 8.5 } as const;
export const ORIGIN_U = 96;
export const STRIP_W = 64;
/** Where every lane name starts (indented off the clamp, so no name abuts it). */
export const NAME_U = 122;
/**
 * Each lane's paper strip (v0..v1), its typical run's hole (v from the strip's north edge), the edge its delegation
 * notches are cut in (none for the single session; the told-to-delegate strip's north edge, under the die's path; the
 * two-level strip's south edge, so both holes face the bracket between them), and its name lines: EN (and zh) baselines.
 * Every name sits on its own strip and well clear of the strip above (beat8.test).
 */
export const LANES8 = [
  { strip: [372, 436] as const, hole: 32, notches: 'none' as const, names: [{ v: 360, text: 'line' as const }] },
  { strip: [622, 686] as const, hole: 44, notches: 'north' as const, names: [{ v: 521, text: 'en' as const }, { v: 579, text: 'zh' as const }] },
  { strip: [730, 794] as const, hole: 21, notches: 'south' as const, names: [{ v: 840, text: 'line' as const }] },
] as const;
/** The lanes' em (u): at least 36 px on screen at FRAMING_SHEET (beat8.test). */
export const LANE_EM = 56;
/** A strip's full length (its cut), its typical run's hole (u from its origin). */
export const stripLength = (i: number): number => K * B.lanes[i]!.p95;
export const holeAt = (i: number): number => K * B.lanes[i]!.p50;
export const HOLE_R = 9.5;
/** Five runs a design (FACTS: each design ran 5 times): a delegation notch's place for each (s from the strip's origin), its width and depth (about 28 x 18 px on screen). */
export const NOTCH = { s: [21, 64, 107, 150, 193] as const, w: 38, d: 26 } as const;
/** Which notches the told-to-delegate strip punches, in order (BEAT_8.notches' punched ones), by run: the fourth run has none. */
export const TOLD_PUNCH: readonly number[] = B.notches.map((n, i) => (n.punched ? i : -1)).filter((i) => i >= 0);
/** The run the model did itself: its notch place, and the band of that run, sliding out of that place east along the strip's north edge to its cut. */
export const LONG_RUN = B.notches.findIndex((n) => !n.punched);
export const BAND = { v0: 590, v1: LANES8[1].strip[0] + 4, u0: ORIGIN_U + NOTCH.s[LONG_RUN]! - NOTCH.w / 2, u1: ORIGIN_U + stripLength(1) } as const;

/**
 * The bracket between the told-to-delegate hole (lane 2) and the two-level hole (lane 3), drawn as a drawing dimensions a
 * small offset (session 6's critics read the old symmetric serifs and bar as a letter H): its bar in the gap between the
 * strips; each serif an extension line `serif` u from the bar toward its own hole (where the ring's leader meets it) and
 * `over` u past the bar; and the dimension arrows outside the serifs, each pointing in at one (an arrow's shaft and its
 * head's length and width).
 */
export const BRACKET = {
  a: [ORIGIN_U + holeAt(1), LANES8[1].strip[0] + LANES8[1].hole] as P2,
  b: [ORIGIN_U + holeAt(2), LANES8[2].strip[0] + LANES8[2].hole] as P2,
  bar: (LANES8[1].strip[1] + LANES8[2].strip[0]) / 2,
  serif: 22,
  over: 6,
  arrow: { shaft: 12, head: 9, w: 10 },
} as const;

/**
 * The hero stamps: where each is set (its box's west edge, its baseline, its em: 160-220 px on screen, beat8.test), its
 * skew (rad), its advance in ems ("~½" is set as a tilde and a built fraction, never the face's broken ½ glyph).
 */
export const STAMPS8 = {
  half: { cue: 'stamp-half', u: 862, v: 478, em: 236, rot: -0.03, adv: 1.23 },
  ten: { cue: 'stamp-ten', u: 560, v: 792, em: 232, rot: 0.02, adv: 2.4 },
  tokens: { cue: 'stamp-tokens', u: 562, v: 1166, em: 228, rot: -0.015, adv: 2.4 },
} as const;
/** The rule between the lanes and the token chart (printed with the form: its v, its u span). */
export const SECTION_RULE = { v: 870, u0: 34, u1: SHEET_W - 34 } as const;
/** The token chart: its header (two lines over the stacks), its clamp, each lane's stack row (v), a sheet's width, the longest stack's reach. */
export const TOKENS = {
  head: { u: 40, v: [926, 980] as const, em: 53 },
  clamp: { u0: 34, u1: 92, v0: 994, v1: 1142, z: SHEET8.z + 7 },
  rows: [[1002, 1042], [1048, 1088], [1094, 1134]] as const,
  sheetW: 56,
  extentMax: 424,
} as const;
/** Each lane's stack: its sheets (one per million cache-read tokens, rounded) and its reach east of the clamp (in the tokens' ratio). */
export const STACKS8 = B.lanes.map((l) => ({ n: Math.round(l.tokens), extent: (TOKENS.extentMax * l.tokens) / Math.max(...B.lanes.map((x) => x.tokens)) }));

/** The die that punches the notches: its size, its home on the clamp bar at the told-to-delegate row, its hover over a strip and its contact. */
export const DIE = { w: 50, d: 46, h: 12, v: LANES8[1].strip[0] + NOTCH.d / 2, home: { u: (CLAMP.u0 + CLAMP.u1) / 2, z: CLAMP.z }, hover: Z8.strip + 10, contact: Z8.strip } as const;
/**
 * The single session's pass (C22: "Left to choose, the single session never delegated"; session 6's critics: every mark
 * that moved was on the told-to-delegate lane, so a viewer read "never delegated" onto the lane being punched). After the
 * told-to-delegate strip's run, still under C22 (it holds to f4410), the die goes back along that strip to the clamp bar,
 * north along it and onto the single session's strip, and walks its five run places (NOTCH.s) west to east on the eighths
 * `ONE_PASS.at` (10 f apart, the first `after` f past the last notch), coming down on each until it hangs `miss` over the
 * strip's face (its shadow all but closed under it) and lifting off again: nothing is cut, the strip stays whole. It goes
 * along the strip's south edge (its face clear of the lane's name over the north edge), it comes and goes along the clamp
 * bar (never over the told-to-delegate lane's name), and it comes to rest on the clamp bar at the single session's row.
 */
export const ONE_PASS = {
  v: LANES8[0].strip[1] - NOTCH.d / 2,
  after: 30,
  at: [0, 1, 2, 3, 4].map((k, i) => ({ k, f: B.notches[B.notches.length - 1]!.f + 30 + 10 * i })),
  /** it walks higher than the told-to-delegate run's hover, so each dip is a longer fall that stops short of the strip */
  hover: Z8.strip + 14,
  miss: Z8.strip + 2.5,
  /** the corner radius of its way round the clamp bar (u) */
  turn: 30,
} as const;

// ------------------------------------------------------------------------------------------------
// Beat 8's frames, hung off the cue sheet's

/** The move token (TREATMENT Motion grammar). */
const MOVE = Easing.bezier(0.2, 0, 0, 1);

export const E8 = {
  /** the beat's life: in from bar 50's downbeat; the sheet off the frame and gone during bar 58's ease-out */
  from: at(50),
  /** the sheet slides in from beyond the frame's east edge (u east of its rest) over `inFrames` (the move curve) */
  inDx: 330,
  inFrames: 30,
  /** the carriage: at rest at the rail's west end, it gathers speed over `rampIn` frames to the load line's pace as it reaches tick 0, and stops at the east end over `rampOut` */
  rampIn: 3,
  rampOut: 3,
  /** the form's print, staggered (8.2): the caveat stamp with C20 on the tag-chart window's first frame, each lane's name 2 f before its strip slides, the legend once the strips are nearly out and before "~½" */
  form: textWindow(cue('tag-chart'))[0],
  names: B.lanes.map((l) => l.slide - 2),
  legend: at(51) + 30,
  /** the load tag's wipe (TAGS_8): once the caveat and the first names are down */
  tag: at(51) + 10,
  bracket: B.bracket,
  /** the token header's print: from its window's first frame */
  head: textWindow(cue('chart-tokens'))[0],
  /** a stamp, once the next one lands, steps to the light print over `stampStep` frames (the claim being read is the dark one) */
  stampStep: 6,
  /**
   * away: on bar 58's downbeat the sheet slides east, gathering speed over `outRamp` frames to `outPace` u a frame and
   * holding it until it is off the frame (an ease-in, as the exit token, held to a pace whose on-screen speed with bar
   * 58's move under it stays near 830 px/s, never a snap); off the frame (with its shadow's reach) from `offFrame`
   */
  away: B.away,
  outRamp: 8,
  outPace: 24,
  offFrame: B.away + 49,
  /** the beat's life ends the frame after it is off the frame (its footprints leave the budget to beat 9) */
  until: B.away + 50,
} as const;

/** A stamp's (or print's) 3 f ink spread from its contact frame: -1 before it, then stages 0, 1, 2 (2: the whole print). */
export const inkStage = (f: number, at: number): number => (f < at ? -1 : Math.min(2, f - at));
/** A hero stamp's contact: the first frame of its text window (the score's print tap). */
export const stampAt = (id: 'half' | 'ten' | 'tokens'): number => textWindow(cue(STAMPS8[id].cue))[0];
/** How far a hero stamp has stepped to the light print (0..1): from the next stamp's contact over stampStep frames. */
export function stampStepAt(id: 'half' | 'ten' | 'tokens', f: number): number {
  const next = id === 'half' ? stampAt('ten') : id === 'ten' ? stampAt('tokens') : Infinity;
  return easings.inOutSine(clamp((f - next) / E8.stampStep)) + 0;
}

/** The load line's pace (u a frame) and the ticks printed by film frame f (tick i lands on from + span i / n, the score's rain). */
const SPAN = B.ticks.to - B.ticks.from;
const PACE = (TICKS.pitch * B.ticks.n) / SPAN;
export const ticksPrinted = (f: number): number => (f < B.ticks.from ? 0 : Math.min(B.ticks.n, Math.floor(((f - B.ticks.from) * B.ticks.n) / SPAN) + 1));
/** The frame tick i is printed on (the first frame at or after the score's). */
export const tickFrame = (i: number): number => Math.ceil(B.ticks.from + (SPAN * i) / B.ticks.n);
/** A faint tick's length in its row (an index hash: 45-100% of the row, from its row's outer edge). */
export const tickFrac = (i: number): number => 0.45 + 0.55 * (((Math.imul(i + 31, 2654435761) >>> 0) % 1009) / 1008);

/**
 * The carriage's head (sheet u) at f: at rest at the rail's west end, it gathers speed (constant acceleration over rampIn)
 * so it passes tick 0 at the load line's pace on ticks.from, runs at that pace (tick i under it as the score sounds it),
 * then slows to a stop over rampOut past the last tick and stays parked.
 */
export function carriageAt(f: number): number {
  const u0 = tickU(0);
  const a = PACE / E8.rampIn;
  const t0 = B.ticks.from;
  if (f <= t0 - E8.rampIn) return u0 - (PACE * E8.rampIn) / 2;
  if (f <= t0) return u0 - PACE * (t0 - f) + (a / 2) * (t0 - f) ** 2;
  const t1 = B.ticks.from + SPAN * ((B.ticks.n - 1) / B.ticks.n);
  const u1 = tickU(B.ticks.n - 1);
  if (f <= t1) return u0 + PACE * (f - t0);
  const b = PACE / E8.rampOut;
  const t = Math.min(f - t1, E8.rampOut);
  return u1 + PACE * t - (b / 2) * t * t;
}
/** Where the carriage parks (its head's u): past the last tick. */
export const CARRIAGE_PARK = carriageAt(10_000);

/** A strip's fed length (u) at f: out from under the clamp at K u a frame from its slide frame, for stripFrames x p95 frames. */
export const stripFed = (i: number, f: number): number => {
  const l = B.lanes[i]!;
  return (K / B.stripFrames) * clamp(f - l.slide, 0, l.p95 * B.stripFrames);
};
/** The long run's band's fed length (u): out of its notch place east along the told-to-delegate strip to its cut over longRun.frames, at a constant pace. */
export const bandFed = (f: number): number => (BAND.u1 - BAND.u0) * clamp((f - B.longRun.from) / B.longRun.frames);
/** How many of the told-to-delegate strip's notches are cut at f (TOLD_PUNCH's first n), each on its contact frame (under the die's face). */
export const notchesPunched = (f: number): number => B.notches.filter((n) => n.punched && f >= n.f).length;

/** A segment of the die's path: from f0 to f1 (inOutSine), u, v and z from a to b, an arc of `arc` u over the travel; `way`: along the pass's way round the clamp bar instead (PASS_WAY, at an even pace with eased ends). */
interface DieLeg {
  f0: number;
  f1: number;
  u: readonly [number, number];
  v: readonly [number, number];
  z: readonly [number, number];
  arc: number;
  way?: true;
}
/** The told-to-delegate strip's notch place k (sheet u of its centre). */
export const notchU = (k: number): number => ORIGIN_U + NOTCH.s[k]!;
/** A run 0..1 over t 0..1 at an even pace with eased ends (up over `a`, down over `a`: C1). */
function evenRun(t: number, a: number): number {
  const x = clamp(t);
  const v = 1 / (1 - a);
  if (x < a) return (v * x * x) / (2 * a);
  if (x <= 1 - a) return v * (x - a / 2);
  const y = 1 - x;
  return 1 - (v * y * y) / (2 * a);
}
/**
 * The pass's way from the told-to-delegate strip's last place to the single session's first: west along that strip to the
 * clamp bar, north along it, east onto the single session's strip, its two corners rounded (ONE_PASS.turn): its length and
 * the point at s (0..1 of its length).
 */
export const PASS_WAY = (() => {
  const R = ONE_PASS.turn;
  const u0 = notchU(NOTCH.s.length - 1);
  const v2 = DIE.v;
  const uc = DIE.home.u;
  const v1 = ONE_PASS.v;
  const u1 = notchU(0);
  const parts = [
    { l: u0 - (uc + R), at: (x: number): P2 => [u0 - x, v2] },
    { l: (Math.PI * R) / 2, at: (x: number): P2 => [uc + R - R * Math.sin(x / R), v2 - R + R * Math.cos(x / R)] },
    { l: v2 - R - (v1 + R), at: (x: number): P2 => [uc, v2 - R - x] },
    { l: (Math.PI * R) / 2, at: (x: number): P2 => [uc + R - R * Math.cos(x / R), v1 + R - R * Math.sin(x / R)] },
    { l: u1 - (uc + R), at: (x: number): P2 => [uc + R + x, v1] },
  ];
  const L = parts.reduce((a, p) => a + p.l, 0);
  return {
    L,
    at(s: number): P2 {
      let x = clamp(s) * L;
      for (const p of parts) {
        if (x <= p.l) return p.at(x);
        x -= p.l;
      }
      return [u1, v1];
    },
  };
})();
/**
 * The die's path: off the clamp onto the told-to-delegate strip's first place, then on each eighth of `notches` a 2 f press
 * landing on the contact frame (held a frame, lifted over 2 f) and a hop to the next place; over the run without a notch it
 * hovers through its eighth and never comes down. Then the single session's pass (ONE_PASS): round by the clamp bar onto
 * that strip, a dip short of it on each of its five places, and back west onto the clamp bar, where it comes to rest at
 * that strip's row.
 */
export const DIE_LEGS: readonly DieLeg[] = (() => {
  const legs: DieLeg[] = [];
  const { home, hover, contact } = DIE;
  const V2 = DIE.v;
  const V1 = ONE_PASS.v;
  const first = B.notches[0]!.f;
  legs.push({ f0: first - 13, f1: first - 9, u: [home.u, home.u], v: [V2, V2], z: [home.z, home.z + 6], arc: 0 });
  legs.push({ f0: first - 9, f1: first - 3, u: [home.u, notchU(0)], v: [V2, V2], z: [home.z + 6, hover], arc: 6 });
  B.notches.forEach((n, k) => {
    if (n.punched) {
      legs.push({ f0: n.f - 2, f1: n.f, u: [notchU(k), notchU(k)], v: [V2, V2], z: [hover, contact], arc: 0 });
      legs.push({ f0: n.f + 1, f1: n.f + 3, u: [notchU(k), notchU(k)], v: [V2, V2], z: [contact, hover], arc: 0 });
    }
    const next = B.notches[k + 1];
    if (next) legs.push({ f0: n.f + 3, f1: next.f - 2, u: [notchU(k), notchU(k + 1)], v: [V2, V2], z: [hover, hover], arc: 4 });
  });
  const last = B.notches[B.notches.length - 1]!.f;
  const one = ONE_PASS.at;
  const H = ONE_PASS.hover;
  // round by the clamp bar onto the single session's strip, over its first place 2 f before its eighth
  legs.push({ f0: last + 3, f1: one[0]!.f - 2, u: [notchU(NOTCH.s.length - 1), notchU(0)], v: [V2, V1], z: [hover, H], arc: 5, way: true });
  one.forEach((x, i) => {
    // the dip: down over 2 f to `miss` on its eighth, back up over 2 f (never on the strip)
    legs.push({ f0: x.f - 2, f1: x.f, u: [notchU(x.k), notchU(x.k)], v: [V1, V1], z: [H, ONE_PASS.miss], arc: 0 });
    legs.push({ f0: x.f + 1, f1: x.f + 3, u: [notchU(x.k), notchU(x.k)], v: [V1, V1], z: [ONE_PASS.miss, H], arc: 0 });
    const next = one[i + 1];
    if (next) legs.push({ f0: x.f + 3, f1: next.f - 2, u: [notchU(x.k), notchU(next.k)], v: [V1, V1], z: [H, H], arc: 4 });
  });
  // back west along the strip's south edge onto the clamp bar, and down onto it at this row
  const end = one[one.length - 1]!;
  legs.push({ f0: end.f + 3, f1: end.f + 15, u: [notchU(end.k), home.u], v: [V1, V1], z: [H, home.z + 6], arc: 4 });
  legs.push({ f0: end.f + 15, f1: end.f + 18, u: [home.u, home.u], v: [V1, V1], z: [home.z + 6, home.z], arc: 0 });
  return legs;
})();
/** The frame the die is at rest on the clamp bar again, at the single session's row. */
export const DIE_REST = ONE_PASS.at[ONE_PASS.at.length - 1]!.f + 18;
/** The die's pose at f: its centre's sheet u and v and its face's z. */
export function dieAt(f: number): { u: number; v: number; z: number } {
  let u: number = DIE.home.u;
  let v: number = DIE.v;
  let z: number = DIE.home.z;
  for (const l of DIE_LEGS) {
    if (f < l.f0) break;
    const t = clamp((f - l.f0) / (l.f1 - l.f0));
    const e = l.way ? evenRun(t, 0.2) : easings.inOutSine(t);
    if (l.way) [u, v] = PASS_WAY.at(e);
    else {
      u = l.u[0] + (l.u[1] - l.u[0]) * e;
      v = l.v[0] + (l.v[1] - l.v[0]) * e;
    }
    z = l.z[0] + (l.z[1] - l.z[0]) * e + l.arc * Math.sin(Math.PI * e);
  }
  return { u, v, z };
}

/** Where each punched notch's chad comes to rest: pushed out north by the die's face, clear of the strip, a little askew. */
const CHAD_REST = [
  { du: -5, v: 609, rot: 0.2 },
  { du: 3, v: 608, rot: -0.15 },
  { du: -8, v: 610, rot: 0.24 },
  { du: 0, v: 609, rot: 0 },
  { du: 2, v: 609, rot: -0.19 },
] as const;
export interface ChadPose {
  u: number;
  v: number;
  z: number;
  rot: number;
}
/** The punched chads at f: each from the frame after its contact (still under the die's face), sliding clear over 6 f (the move curve), then lying on the sheet. */
export function chadsAt(f: number): ChadPose[] {
  const out: ChadPose[] = [];
  const v0 = LANES8[1].strip[0] + NOTCH.d / 2;
  B.notches.forEach((n, k) => {
    if (!n.punched || f < n.f + 1) return;
    const e = MOVE(clamp((f - n.f - 1) / 6));
    const r = CHAD_REST[k]!;
    out.push({ u: notchU(k) + r.du * e, v: v0 + (r.v - v0) * e, z: Z8.strip + (Z8.chad - Z8.strip) * e, rot: r.rot * e });
  });
  return out;
}

/**
 * Each lane's stack front: how far its pack of sheets has come east out of the token clamp (the reach of its leading
 * edge east of ORIGIN_U; -4 under the clamp), at a constant pace from stacks[i].from, reaching the last sheet's place on
 * its done. Sheet k lies at min(its own reach, the front): the sheets peel off the pack as it passes their places.
 */
export const stackFront = (i: number, f: number): number => {
  const st = B.stacks[i]!;
  return -4 + (STACKS8[i]!.extent + 4) * clamp((f - st.from) / (st.done - st.from));
};
/** Sheet k of lane i at its place: its leading edge's reach east of ORIGIN_U (the first one sheet's width, the last the stack's extent). */
export const stackSheetReach = (i: number, k: number): number => {
  const { n, extent } = STACKS8[i]!;
  return TOKENS.sheetW + ((extent - TOKENS.sheetW) * k) / Math.max(1, n - 1);
};

/** The sheet's slide (u east of its rest) at f: in from the east over inFrames, at rest, away east from bar 58. */
export function sheetDx(f: number): number {
  if (f >= E8.away) {
    const t = f - E8.away;
    const { outRamp: R, outPace: v } = E8;
    // (+ 0: never -0, so a hold compares equal)
    return (t <= R ? (v * t * t) / (2 * R) : (v * R) / 2 + v * (t - R)) + 0;
  }
  return E8.inDx * (1 - MOVE(clamp((f - E8.from) / E8.inFrames))) + 0;
}

export interface Beat8State {
  f: number;
  /** the sheet's slide: u east of its rest (everything on it rides with it) */
  dx: number;
  /** the carriage's head along the rail (sheet u) */
  carriage: number;
  /** ticks of the load line printed so far (0..n), and the u the print has reached */
  ticks: number;
  tickEdge: number;
  /** each print's ink stage (-1 none, 0 and 1 the spread, 2 whole): the caveat, each lane's name, the legend, the bracket's rings, the token header, the hero stamps */
  ink: { form: number; names: [number, number, number]; legend: number; bracket: number; head: number; half: number; ten: number; tokens: number };
  /** each hero stamp's step to the light print (0..1), as the next one lands */
  stampStep: { half: number; ten: number };
  /** the bracket's serifs and bar: their spring (0 before, 1 settled; it overshoots) */
  bracketSpring: number;
  /** each lane's strip: fed out of the clamp so far (u) */
  strips: [number, number, number];
  /** the told-to-delegate strip's cut notches (0..4) */
  notches: number;
  /** the die: its centre's u and v and its face's z */
  die: { u: number; v: number; z: number };
  /** the punched chads sliding out or lying on the sheet */
  chads: ChadPose[];
  /** the long run's band: fed so far (u) */
  band: number;
  /** each lane's stack: its pack's front (reach east of the origin) */
  stacks: [number, number, number];
}

/** DeskState.e8: null outside the beat's life (bar 50 to the frame after the sheet is off the frame on its way away). */
export function beat8At(f: number): Beat8State | null {
  if (f < E8.from || f >= E8.until) return null;
  const ticks = ticksPrinted(f);
  return {
    f,
    dx: sheetDx(f),
    carriage: carriageAt(f),
    ticks,
    tickEdge: ticks === 0 ? tickU(0) - 3 : tickU(ticks - 1) + TICKS.pitch / 2 + 1.2,
    ink: {
      form: inkStage(f, E8.form),
      names: [inkStage(f, E8.names[0]!), inkStage(f, E8.names[1]!), inkStage(f, E8.names[2]!)],
      legend: inkStage(f, E8.legend),
      bracket: inkStage(f, E8.bracket),
      head: inkStage(f, E8.head),
      half: inkStage(f, stampAt('half')),
      ten: inkStage(f, stampAt('ten')),
      tokens: inkStage(f, stampAt('tokens')),
    },
    stampStep: { half: stampStepAt('half', f), ten: stampStepAt('ten', f) },
    bracketSpring: springAt(f, E8.bracket, SPRING.settle),
    strips: [stripFed(0, f), stripFed(1, f), stripFed(2, f)],
    notches: notchesPunched(f),
    die: dieAt(f),
    chads: chadsAt(f),
    band: bandFed(f),
    stacks: [stackFront(0, f), stackFront(1, f), stackFront(2, f)],
  };
}

// ------------------------------------------------------------------------------------------------
// The hooks

/**
 * Bar 50 on: everything of the desk steps down while the sheet is the action (the sheet itself never steps; beat 7's job
 * rail and Productive plate by their own ids, objects/Beat7.tsx and Jobs.tsx), your desk on
 * the own set (objects/YourDesk.tsx steps its own surfaces only there), up again a beat and a half before bar 58 so the
 * lid can shut at full contrast. One entry, at a full step from 3934 through 4560: beat 9 takes over from it on bar 58
 * (its entry's handFrom 'b8-away'). Beat 7 releases its focus by 3920, so this one ramps in from nothing.
 */
export const B8_STEP = ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'freshBay', 'cord', 'reel', 'lock', 'gauge', 'head', 'index', 'mouth', 'deck', 'chute', 'proactive', 'spike', 'stress', 'jaws', 'bosses', 'b7-rail', 'b7-plate'] as const;
export const FOCUS_8: readonly FocusEntry[] = [{ id: 'b8-away', from: at(50), to: B.away, step: B8_STEP, own: { from: at(50), to: B.away - 30, step: ['you'] } }];
export const LAMP_8: readonly LampStep[] = [];
export const ARM_8: readonly ArmStep[] = [];
export function replies8(_e: Beat8State | null): ReplyState[] {
  return [];
}
export function cards8(_s: DeskState): CardUp[] {
  return [];
}

/**
 * The sheet's shadows: its own contact on the desk (a soft footprint round its edge), the furniture's and the die's on
 * the sheet, each strip's, the band's and each stack's contact on the sheet (a strip's footprint covers its hole and its
 * notches too, so the sheet seen through them lies in the strip's shade: a hole reads as a hole). Each footprint's top a
 * hair under the lowest receiver it must not shade (the stacks' at their first sheet, so the shingled sheets stay lit).
 */
export function footprints8(s: DeskState): Footprint[] {
  const e = s.e8;
  if (!e) return [];
  const dx = e.dx;
  const R = (u0: number, u1: number, v0: number, v1: number) => sheetRect(u0, u1, v0, v1, dx);
  const fp: Footprint[] = [];
  // the sheet on the desk (its top at z 0.8: a footprint ending under it shades only the desk round it)
  fp.push(rectFp(R(0, SHEET_W, 0, SHEET_H), 0, SHEET8.z - 0.05, 0.85, 2));
  // the rail (a rod over the head) and the carriage on it
  const [r0, r1] = [onSheet(RAIL.u0, RAIL.v, dx), onSheet(RAIL.u1, RAIL.v, dx)];
  fp.push(segFp([r0[0], r0[1], RAIL.z + RAIL.r - 0.3], [r1[0], r1[1], RAIL.z + RAIL.r - 0.3], RAIL.r));
  fp.push(rectFp(R(e.carriage - CARRIAGE.w / 2, e.carriage + CARRIAGE.w / 2, CARRIAGE.v0, CARRIAGE.v1), SHEET8.z, CARRIAGE.z[1] - 0.25, 0.5, 4));
  // the clamp bars
  fp.push(rectFp(R(CLAMP.u0, CLAMP.u1, CLAMP.v0, CLAMP.v1), SHEET8.z, CLAMP.z - 0.25, 0.6, 4));
  fp.push(rectFp(R(TOKENS.clamp.u0, TOKENS.clamp.u1, TOKENS.clamp.v0, TOKENS.clamp.v1), SHEET8.z, TOKENS.clamp.z - 0.25, 0.6, 4));
  // the die, wherever it is (on the clamp, hovering, pressing)
  fp.push(rectFp(R(e.die.u - DIE.w / 2, e.die.u + DIE.w / 2, e.die.v - DIE.d / 2, e.die.v + DIE.d / 2), e.die.z, e.die.z + DIE.h, 0.5, 5));
  // the strips as far as they are out, the long run's band, the stacks' packs
  e.strips.forEach((len, i) => {
    if (len > 0.5) fp.push(rectFp(R(CLAMP.u1 - 2, ORIGIN_U + len, LANES8[i]!.strip[0], LANES8[i]!.strip[1]), SHEET8.z, Z8.strip - 0.05, 0.3, 1));
  });
  if (e.band > 0.5) fp.push(rectFp(R(BAND.u0, BAND.u0 + e.band, BAND.v0, BAND.v1), SHEET8.z, Z8.band - 0.05, 0.3, 1));
  e.stacks.forEach((front, i) => {
    if (front <= -3.5) return;
    const [v0, v1] = TOKENS.rows[i]!;
    fp.push(rectFp(R(TOKENS.clamp.u1 - 2, ORIGIN_U + Math.min(front, STACKS8[i]!.extent), v0, v1), SHEET8.z, Z8.stack - 0.05, 0.3, 1));
  });
  return fp;
}
export function pools8(_s: DeskState): Pool[] {
  return [];
}

/**
 * The load tag (the beat's one DOM text: light text reads only on the dark desk): on the clear desk north of the stepped
 * system, west of the sheet, its leader to the load line's west end, wiped in once the caveat and the first lane names
 * are down (E8.tag), so the form never lands as one block.
 */
export const TAG_LOAD_FOOT: P3 = [...onSheet(tickU(0) - 6, (TICKS.rows[0][0] + TICKS.rows[1][1]) / 2), Z8.print];
export const TAGS_8: readonly TagSpec[] = [{ cue: 'tag-load', from: E8.tag, words: WORDS.tagLoad, at: [988, 104], anchor: 'end', foot: TAG_LOAD_FOOT }];
export function you8(_f: number, pose: YouPose): YouPose {
  return pose;
}
