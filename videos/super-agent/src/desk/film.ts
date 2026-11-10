/**
 * The film as one continuous world (src/Main.tsx): which posed segment of the Register Desk draws
 * each film frame, and what the DOM layer shows over it (the role labels' exits and entries round the
 * camera's moves, the tags on their cues). Pure: tested in film.test.ts.
 *
 * A segment is one of the frame components the lookdev stills were signed off through (act one, the
 * turn, act two, the summary), so a film frame and the lookdev still at the same frame are drawn by the
 * same code. FilmFrame mounts a fresh world per segment (its WebGL tree is keyed by the segment), so a
 * page that crosses a boundary draws what a fresh page starting there does (DeskWorld ResetShared).
 *
 * Session 4 builds beats 1-6 (to f3440). The frames after them are the animatic: the act-two world runs
 * with its working parts and no story events until the summary (f5400-5720, still (d)), whose world then
 * holds, and the words of every cue not built yet sit on a slate (AnimaticSlate) so their timing can be
 * judged against the score.
 */
import { clamp } from '@aiv/core';
import { BEAT_4, FILM_FRAMES, WORDS } from '../cues.ts';
import { ACT_ONE_END } from './actOne.ts';
import { CAMERA_MOVES } from './camera.ts';
import { BAYS, DECK, GATE, REEL_FRAME, REEL_FRAME_Z, rectC } from './layout.ts';
import { REPORT_C } from '../print.ts';
import type { PrintMode } from './marks.ts';
import { ROLE_LABELS, type RoleLabel, type TagSpec } from './Overlay.tsx';
import { SPAN_D, summaryLabelAt } from './summary.ts';
import { TURN_SPAN } from './turn.ts';

export type SegmentKind = 'actOne' | 'turn' | 'act2' | 'summary';

/** The segments in film order: [from, to) film frames. */
export const SEGMENTS: readonly { kind: SegmentKind; from: number; to: number }[] = [
  { kind: 'actOne', from: 0, to: ACT_ONE_END },
  { kind: 'turn', from: TURN_SPAN[0], to: TURN_SPAN[1] + 1 },
  { kind: 'act2', from: TURN_SPAN[1] + 1, to: SPAN_D[0] },
  { kind: 'summary', from: SPAN_D[0], to: FILM_FRAMES },
];

/** The last film frame (exclusive) that is built; from here on the film is the animatic. */
export const BUILT_TO = 3440;

/** The segment that draws film frame f. */
export function segmentAt(f: number): SegmentKind {
  for (const s of SEGMENTS) if (f < s.to) return s.kind;
  return SEGMENTS[SEGMENTS.length - 1]!.kind;
}

/** The span a segment's world is posed for (a frame outside it holds the nearest). */
export function segmentSpan(kind: SegmentKind): readonly [number, number] {
  const s = SEGMENTS.find((x) => x.kind === kind)!;
  return [s.from, s.to - 1];
}

// ------------------------------------------------------------------------------------------------
// Act two's DOM layer

/** The camera moves of act two the role labels leave for (more than 40 px of travel: TREATMENT Camera). */
const DOLLY_IN = CAMERA_MOVES.find((m) => m.from === 2640)!;
const EASE_OUT = CAMERA_MOVES.find((m) => m.from === 3280)!;

/** A label entering from film frame `from`: its 6 f leader, then its 8 f wipe; landed afterwards. */
function entering(f: number, from: number): Partial<RoleLabel> | null {
  if (f < from) return null;
  const leader = clamp((f - from) / 6);
  const wipe = clamp((f - from - 6) / 8);
  return wipe >= 1 ? {} : { leader, wipe };
}

/**
 * The role labels of act two (from the turn's end): "Router" and "you · 你" landed (the turn drew them in),
 * "Worker" entering on its cue once the first bays have risen. All three fade out over the first 6 f of the bar-34
 * dolly onto the throat, stay away through the close, and re-enter 2 f apart once the bar-42 ease-out has settled.
 */
export function act2LabelsAt(f: number): RoleLabel[] {
  const out: RoleLabel[] = [];
  ROLE_LABELS.forEach((l, i) => {
    const isWorker = l.text === WORDS.worker.en;
    let a: Partial<RoleLabel> | null;
    if (f < DOLLY_IN.from) a = isWorker ? entering(f, BEAT_4.workerLabel) : {};
    else if (f < DOLLY_IN.from + 6) a = isWorker && f < BEAT_4.workerLabel ? null : { opacity: 1 - (f - DOLLY_IN.from) / 6 };
    else a = entering(f, EASE_OUT.to + 2 + 2 * i);
    if (a) out.push({ ...l, ...a });
  });
  return out;
}

/** The built tag's lines: its EN and zh broken where their own phrases break (film.test.ts holds them equal to the cue's words). */
export const TAG_BUILT_LINES = { en: ['two levels: built', 'in the public', 'research prototype'], zh: ['双层架构：', '公开研究原型已实现'] } as const;

/**
 * Act two's tags, each on its cue's window, its leader ending on the body it qualifies (design D3). Placements are
 * set against the act-two framings and checked on renders (session 4):
 * - the built tag (C11) on the clear ground north-east of the deck, inside title-safe, set on three short lines and two
 *   (its 50-character EN line would run off the frame there; every line ends clear of the lock and its key on the frame's
 *   corner), its short leader level from the block to the reel frame's east post under the lock (the upper level's own
 *   body, never along the key; the lower level is in plain view under it), clear of the notes band, so the frame's foot
 *   never becomes a wall of text (the C11 critic);
 * - the gate tag (N3, C14) over the feeders, its leader down to the gate's bar;
 * - the cache tag (N5, N6) in the close as in still (c); its text stays put through the bar-42 ease-out while its
 *   leader retracts.
 */
export const ACT2_TAGS: readonly TagSpec[] = [
  { cue: 'tag-built', words: WORDS.tagBuilt, at: [1824, 96], anchor: 'end', foot: [REEL_FRAME[2].x0 + 8, 330, REEL_FRAME_Z[1] + 4], lines: TAG_BUILT_LINES },
  { cue: 'tag-gate', words: WORDS.tagGate, at: [112, 70], anchor: 'start', foot: [rectC(GATE.bar)[0], GATE.bar.y1 - 8, GATE.h] },
  { cue: 'tag-cache', words: WORDS.tagCache, at: [1050, 432], anchor: 'start', foot: [-112, 196, 123], leaderUntil: EASE_OUT.from },
];

/**
 * What act two prints (gl/text.ts makePrintTextures `keep`), one mode for the whole act so its printed textures are
 * built once: every teaching ID chain (#...) and the cache's record as set; everything else as faint texture, never
 * a blank tile (marks.ts). At 0.85x this is still (b)'s keepTeaching; in the close it also gives the bays' nameplates
 * and the mirrored galley their faint print (still (c)'s critic, item 7).
 */
const REPORT_STRINGS = new Set<string>([REPORT_C.id, ...REPORT_C.summary, ...REPORT_C.body]);
export const keepFilm = (text: string): PrintMode => (text.includes('#') || REPORT_STRINGS.has(text) ? true : 'texture');

// ------------------------------------------------------------------------------------------------
// The summary's DOM layer (still (d), from lookdev round 2)

/**
 * Still (d)'s labels. "Router" names the whole machine from the deck's west rail and sits west of it, in the clear
 * band under the Thread cord (its leader never crosses the cord); "Worker" names the request's bay, where the route
 * ends, its foot inside W-07's nameplate band and the label straight under the bay; "you" as in the film. Round the
 * camera's ease-out they leave and re-enter (summary.ts summaryLabelAt).
 */
export const LABELS_D: readonly RoleLabel[] = ROLE_LABELS.map((l) =>
  l.text === WORDS.worker.en
    ? { ...l, foot: [rectC(BAYS.bug.box)[0] + 5, BAYS.bug.box.y0 + BAYS.bug.southWall / 2, BAYS.bug.wallH + 0.4], dx: 6, dy: 104, anchor: 'start' }
    : l.text === WORDS.router.en
      ? { ...l, foot: [DECK.x0 + DECK.rail / 2, 300, DECK.top], dx: -36, dy: -54, anchor: 'end' }
      : l,
);
export const labelsDAt = (f: number): RoleLabel[] =>
  LABELS_D.flatMap((l, i) => {
    const a = summaryLabelAt(f, i);
    return a ? [{ ...l, ...a }] : [];
  });
/** The summary's labels at film frame f (posed on its span). */
export const summaryLabelsAt = (f: number): RoleLabel[] => labelsDAt(Math.min(Math.max(f, SPAN_D[0]), SPAN_D[1]));
