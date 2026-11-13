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
 * Part 1 (beats 1-6, to f3440) is built and signed off. Part 2 is built beat by beat, each beat in its own module
 * (desk/beat7.ts ... end.ts) whose BUILT flag says whether it is built yet; a beat that is not is the animatic: the
 * act-two world runs with its working parts and no story events, the summary plays as still (d) was built (its
 * sign-off, to SUMMARY_BUILT_TO), and the words of every cue of an unbuilt beat sit on a slate (FilmFrame AnimaticSlate)
 * so their timing can be judged against the score.
 */
import { clamp } from '@aiv/core';
import { BEAT_4, BEAT_6, BEAT_10, BEAT_11, END, FILM_FRAMES, WORDS, at } from '../cues.ts';
import { ACT_ONE_END } from './actOne.ts';
import { BUILT as BUILT_7, TAGS_7 } from './beat7.ts';
import { BUILT as BUILT_8, TAGS_8 } from './beat8.ts';
import { BUILT as BUILT_9, TAGS_9 } from './beat9.ts';
import { BUILT as BUILT_10, TAGS_10 } from './beat10.ts';
import { BUILT as BUILT_11, TAGS_11 } from './beat11.ts';
import { BUILT as BUILT_END, TAGS_END } from './end.ts';
import { DOLLY_IN, EASE_OUT, EASE_OUT_D, TO_BOOKEND, TO_REGISTER, TO_SHEET, TO_VELLUM, type CameraMove } from './camera.ts';
import { BAYS, DECK, GATE, REEL_FRAME, REEL_FRAME_Z } from './layout.ts';
import { REPORT_C } from '../print.ts';
import type { PrintMode } from './marks.ts';
import { ROLE_LABELS, type RoleLabel, type TagSpec } from './Overlay.tsx';
import { SAFE } from '../look/tokens.ts';
import { SEAM_D, summaryLabelAt } from './summary.ts';
import { TURN_SPAN } from './turn.ts';
import { E6 } from './beat6.ts';

export type SegmentKind = 'actOne' | 'turn' | 'act2' | 'summary' | 'end';

/** Where the summary's world takes over from act two's: inside bar 68's stillness (summary.ts). */
export { SEAM_D };

/** Where the end's own world takes over from the summary's: the end card's landing (cues.ts END.card.land), the world dissolved to the bare desk on the frame before. */
export const END_FROM = END.card.land;
/** The segments in film order: [from, to) film frames. */
export const SEGMENTS: readonly { kind: SegmentKind; from: number; to: number }[] = [
  { kind: 'actOne', from: 0, to: ACT_ONE_END },
  { kind: 'turn', from: TURN_SPAN[0], to: TURN_SPAN[1] + 1 },
  { kind: 'act2', from: TURN_SPAN[1] + 1, to: SEAM_D },
  { kind: 'summary', from: SEAM_D, to: END_FROM },
  // the end's own world from the end card's landing, the dissolve to the bare desk complete (desk/EndFrame.tsx)
  { kind: 'end', from: END_FROM, to: FILM_FRAMES },
];

/** Part 1 (beats 1-6) ends here: everything before it is built. */
export const PART1_TO = at(44);
/** The summary's sign-off (still (d)) is built from the seam up to here (session 4); the trait plates' retirement (f5540-5570) and 11.2 on are beat 11's. */
export const SUMMARY_BUILT_TO = 5570;
/** Part 2's beats: each module's film frames and its BUILT flag (a lane flips its own once its beat is built). */
export const PART2_BEATS: readonly { id: string; from: number; to: number; built: boolean }[] = [
  { id: 'beat-7', from: at(44), to: at(50), built: BUILT_7 },
  { id: 'beat-8', from: at(50), to: at(58), built: BUILT_8 },
  { id: 'beat-9', from: at(58), to: at(63), built: BUILT_9 },
  { id: 'beat-10', from: at(63), to: at(69), built: BUILT_10 },
  { id: 'beat-11', from: at(69), to: at(76), built: BUILT_11 },
  { id: 'beats-12-13', from: at(76), to: FILM_FRAMES, built: BUILT_END },
];
/** Whether film frame f is built: part 1, the summary's sign-off, or a built beat's frames (else the animatic's slate and mark show). */
export function builtAt(f: number): boolean {
  if (f < PART1_TO) return true;
  if (f >= SEAM_D && f < SUMMARY_BUILT_TO) return true;
  return PART2_BEATS.some((b) => b.built && f >= b.from && f < b.to);
}

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
// The role labels round the camera's moves (TREATMENT Camera: a label that would move more than 40 px exits and
// re-enters): over the first 6 f of a move the labels in view fade out; they stay away while the camera travels, and
// once the move they wait for has landed each re-enters, 2 f apart: its leader draws (6 f), then it wipes in (8 f)

/** A label entering from film frame `from`: its 6 f leader, then its 8 f wipe; landed afterwards. */
function entering(f: number, from: number): Partial<RoleLabel> | null {
  if (f < from) return null;
  const leader = clamp((f - from) / 6);
  const wipe = clamp((f - from - 6) / 8);
  return wipe >= 1 ? {} : { leader, wipe };
}

/**
 * Still (d)'s labels. "Router" names the whole machine from the deck's west rail and sits west of it, in the clear
 * band under the Thread cord (its leader never crosses the cord); "Worker" names the request's bay, where the route
 * ends, from the bay's west wall (its foot on the wall's top, south of the bay's middle): a short leader down and west to
 * the label (the foot level with the dossier's north end), set in the clear slate west of the bay, under W-09's bay and
 * over act two's worded Productive plate (beats 9-10), about 40 px under the one and 65 px over the other, so it is never
 * read as one caption with the plate (wave 4's critic P2-c) nor as W-09's (its leader ends on W-07); far west of the Watchdog's
 * station (summary.ts WATCHDOG, south-east of the bay), which it can no longer seem to name (wave 4); "you" as in the film.
 * Placed for FRAMING_D: beats 9-10 show them from bar 58's ease-out to bar 65's dolly, the summary from its ease-out on.
 */
export const LABELS_D: readonly RoleLabel[] = ROLE_LABELS.map((l) =>
  l.text === WORDS.worker.en
    ? { ...l, foot: [BAYS.bug.box.x0 + BAYS.bug.wall / 2, BAYS.bug.dossier.y1 - 12, BAYS.bug.wallH + 0.4], dx: -34, dy: 45, anchor: 'end' }
    : l.text === WORDS.router.en
      ? { ...l, foot: [DECK.x0 + DECK.rail / 2, 300, DECK.top], dx: -36, dy: -54, anchor: 'end' }
      : l,
);

/**
 * Beat 7's labels (from their re-entry after bar 43's ease-out, f3442, to bar 50's truck): ROLE_LABELS but "Router", whose
 * text would lie on the Thread cord's descent once the cord pays out (map-beat7 conflict 6) and which the follow-ups
 * riding the cord's crest would pass over: it names the deck from its north-west corner, set in the clear ground west of
 * the deck under the cord (renders: clear of the cord, of the riders hung under it and of the gate's key below); and
 * "Worker", which names the request's bay (C17: "go straight to its Worker") from its south-east corner, set in the clear
 * ground east of the job rail (its leader never meets the cord coming down to the bay's north-east corner).
 */
export const LABELS_7: readonly RoleLabel[] = ROLE_LABELS.map((l) =>
  l.text === WORDS.router.en
    ? { ...l, foot: [DECK.x0 + 6, DECK.y1 - DECK.rail / 2, DECK.top], dx: -36, dy: 38, anchor: 'end' }
    : l.text === WORDS.worker.en
      ? { ...l, foot: [BAYS.bug.box.x1 - 4, BAYS.bug.box.y0 + 26, BAYS.bug.wallH + 0.4], dx: 40, dy: 46, anchor: 'start' }
      : l,
);

/**
 * 10.2-10.3's labels (after bar 65's dolly, back at FRAMING_B): ROLE_LABELS but "Router", which there would lie on the Thread
 * cord's descent (the cord pays out in beat 7 and stays): it names the deck from its north-west corner as beat 7's does
 * (LABELS_7), clear of the cord.
 */
export const LABELS_10: readonly RoleLabel[] = ROLE_LABELS.map((l) => (l.text === WORDS.router.en ? LABELS_7.find((x) => x.text === WORDS.router.en)! : l));
/**
 * After bar 65's dolly the role labels wait for 10.2's Fix cards (up from at(66), sliding away from BEAT_10.cards.exit over
 * 8 f) and their step ('b10-fix', ramping back over the 14 f after the exit) to be gone, and for the windings' "?" (drawn
 * over the 9 f after BEAT_10.windings): they never re-enter under the cards or a stepped scene.
 */
export const LABELS_AFTER_CARDS = BEAT_10.windings + 10;
/**
 * Act two's away windows: the labels in view fade out over the first 6 f of `leave` and re-enter as `labels` (placed for
 * the framing `back` lands on) once `back` has landed (2 f after it, or from `enter`). Bar 34's dolly onto the throat to
 * bar 43's ease-out (the close; they re-enter as beat 7's, LABELS_7); bar 50's truck to the sheet to bar 58's ease-out
 * (still (d)'s framing: LABELS_D); bar 65's dolly onto the Register (LABELS_10, once 10.2's cards are gone:
 * LABELS_AFTER_CARDS).
 */
export const ACT2_AWAY: readonly { leave: CameraMove; back: CameraMove; labels: readonly RoleLabel[]; enter?: number }[] = [
  { leave: DOLLY_IN, back: EASE_OUT, labels: LABELS_7 },
  { leave: TO_SHEET, back: TO_VELLUM, labels: LABELS_D },
  { leave: TO_REGISTER, back: TO_REGISTER, labels: LABELS_10, enter: LABELS_AFTER_CARDS },
];

/** The labels of an away window at film frame f (it has begun): fading out of `before`, away, or re-entering. */
function awayAt(f: number, w: (typeof ACT2_AWAY)[number], before: readonly RoleLabel[], keep: (l: RoleLabel) => boolean = () => true): RoleLabel[] {
  if (f < w.leave.from + 6) return before.filter(keep).map((l) => ({ ...l, opacity: 1 - (f - w.leave.from) / 6 }));
  return w.labels.flatMap((l, i) => {
    const a = entering(f, (w.enter ?? w.back.to + 2) + 2 * i);
    return a ? [{ ...l, ...a }] : [];
  });
}

/**
 * The role labels of act two (from the turn's end): "Router" and "you · 你" landed (the turn drew them in), "Worker"
 * entering on its cue once the first bays have risen; then each away window (ACT2_AWAY) in turn.
 */
export function act2LabelsAt(f: number): RoleLabel[] {
  let w = -1;
  ACT2_AWAY.forEach((x, i) => {
    if (f >= x.leave.from) w = i;
  });
  if (w < 0)
    return ROLE_LABELS.flatMap((l) => {
      const a = l.text === WORDS.worker.en ? entering(f, BEAT_4.workerLabel) : {};
      return a ? [{ ...l, ...a }] : [];
    });
  if (w === 0) return awayAt(f, ACT2_AWAY[0]!, ROLE_LABELS, (l) => !(l.text === WORDS.worker.en && f < BEAT_4.workerLabel));
  return awayAt(f, ACT2_AWAY[w]!, ACT2_AWAY[w - 1]!.labels);
}

/**
 * The summary's labels at film frame f (from SEAM_D): act two's as bar 65 left them (so the seam changes none of them),
 * fading over the stamp's 6 f; LABELS_D re-entering once the ease-out has settled (summary.ts summaryLabelAt), landed for
 * still (d); on 11.4's step-down (BEAT_11.stepDown) "Router" and "Worker" fade out over 6 f with the system they name (the
 * world steps down by contrast; a label is never dimmed by alpha: it leaves), "you · 你" stays; fading over the first 6 f of
 * bar 76's move back to the hook, and away from then on.
 */
export function summaryLabelsAt(f: number): RoleLabel[] {
  const g = Math.max(f, SEAM_D);
  if (g < EASE_OUT_D.from + 6) {
    const before = ACT2_AWAY[ACT2_AWAY.length - 1]!.labels;
    return before.flatMap((l, i) => {
      const a = summaryLabelAt(g, i);
      return a ? [{ ...l, ...a }] : [];
    });
  }
  if (g >= TO_BOOKEND.from) return g < TO_BOOKEND.from + 6 ? LABELS_D.filter((l) => !SYSTEM_LABELS.has(l.text)).map((l) => ({ ...l, opacity: 1 - (g - TO_BOOKEND.from) / 6 })) : [];
  if (g >= BEAT_11.stepDown) return labelsDAt(g).flatMap((l) => (!SYSTEM_LABELS.has(l.text) ? [l] : g < BEAT_11.stepDown + 6 ? [{ ...l, opacity: 1 - (g - BEAT_11.stepDown) / 6 }] : []));
  return labelsDAt(g);
}
/** The labels that name the system (they leave on 11.4's step-down; yours stays). */
const SYSTEM_LABELS = new Set<string>([WORDS.router.en, WORDS.worker.en]);

/** Still (d)'s labels after the stamp: LABELS_D re-entering once the ease-out has settled (summary.ts summaryLabelAt). */
export const labelsDAt = (f: number): RoleLabel[] =>
  LABELS_D.flatMap((l, i) => {
    const a = summaryLabelAt(f, i);
    return a ? [{ ...l, ...a }] : [];
  });

// ------------------------------------------------------------------------------------------------
// The tags

/** The built tag's lines: its EN broken where its phrases break (film.test.ts holds them equal to the cue's words); its zh is not drawn (look/zhInPicture.ts). */
export const TAG_BUILT_LINES = { en: ['two levels: built', 'in the public', 'research prototype'] } as const;

/**
 * Act two's tags, each on its cue's window, its leader ending on the body it qualifies (design D3), its EN alone (the zh
 * policy, look/zhInPicture.ts: the user, 2026-11-14). Placements are set against the act-two framings and checked on
 * renders (sessions 4 and 6):
 * - the built tag (C11) on the clear ground north-east of the deck, inside title-safe, set on three short lines (its
 *   50-character EN line would run off the frame there; every line ends clear of the lock and its key on the frame's
 *   corner), its short leader level from the middle of the block's last line to the reel frame's east post under the
 *   lock (the upper level's own body, never along the key; the lower level is in plain view under it), clear of the
 *   notes band and well apart from the Router label under it (three times its own lines' air: the two never read as one
 *   four-line block, the review's T-rv-02), so the frame's foot never becomes a wall of text (the C11 critic);
 * - the gate tag (N3, C14) over the intake, its text inside title-safe (its ascenders 54 px from the top, its left edge on
 *   SAFE.x), its leader down from under its line (it runs over the gate) to the north end of the gate's bar along its
 *   west edge: clear west of the starter key docked beside it, east of the spike and its pile (desk/beat5.ts);
 * - the cache tag (N5, N6) in the close as in still (c), on the deck's dark rail; its window ends on bar 43's downbeat,
 *   before the ease-out, so nothing of it rides the move.
 * Then part 2's, each beat module's own (beat7.ts TAGS_7 ... beat10.ts TAGS_10).
 */
/**
 * The cache tag's leader, whole, fades out from here (6 f, Overlay.tsx TAG_LEADER_FADE), gone as the reading thread's last hop
 * leaves its foot (beat6.ts E6.hops, E6.hopFrames a hop), so the thread never starts on the tag's dot (A17); it is never cut
 * short into a hairline ending in mid-air (R2-L2-09).
 */
export const CACHE_LEADER_UNTIL = BEAT_6.recall.hops[2] - E6.hopFrames - 6;
/** ... and fades back in from here (6 f), the hop landed 2 f before, so the tag ends its window attached (wave 4's critic P2-e). */
export const CACHE_LEADER_BACK = BEAT_6.recall.hops[2] + 2;
/**
 * The built tag's first baseline: high enough for 75 px of air from its last baseline to the Router label's caps
 * (film.test.ts), its leader's foot up the reel frame's east post (`BUILT_FOOT_Y`, world y: still under the lock, by the
 * reel's east edge) so the leader runs level from its last line's middle.
 */
export const BUILT_TAG_Y = 150;
export const BUILT_FOOT_Y = 363;
export const ACT2_TAGS: readonly TagSpec[] = [
  { cue: 'tag-built', words: WORDS.tagBuilt, at: [1800, BUILT_TAG_Y], anchor: 'end', foot: [REEL_FRAME[2].x0 + 8, BUILT_FOOT_Y, REEL_FRAME_Z[1] + 4], lines: TAG_BUILT_LINES },
  { cue: 'tag-gate', words: WORDS.tagGate, at: [SAFE.x, 84], anchor: 'start', foot: [GATE.bar.x0 + 2, GATE.bar.y1 - 8, GATE.h] },
  // its foot is on the inline record's printed pointer, which beat 6.4's reading thread follows on its last hop (beat6.ts
  // HOP3_VIA): the leader, whole, fades out over the 6 f before that hop leaves, so the thread never starts on the tag's
  // dot (A17), and fades back in once the hop has landed; still (c) is long before it
  { cue: 'tag-cache', words: WORDS.tagCache, at: [1050, 432], anchor: 'start', foot: [-112, 196, 123], leaderUntil: CACHE_LEADER_UNTIL, leaderBack: CACHE_LEADER_BACK },
  ...TAGS_7,
  ...TAGS_8,
  ...TAGS_9,
  ...TAGS_10,
];
/** The summary's tags: beat 11's and the end's (beat11.ts TAGS_11, end.ts TAGS_END). */
export const SUMMARY_TAGS: readonly TagSpec[] = [...TAGS_11, ...TAGS_END];

/**
 * What act two and the summary print (gl/text.ts makePrintTextures `keep`), one mode across the seam so no print swaps there; its printed textures are
 * built once: every teaching ID chain (#...) and the cache's record as set; everything else as faint texture, never
 * a blank tile (marks.ts). At 0.85x this is still (b)'s keepTeaching; in the close it also gives the bays' nameplates
 * and the galley their faint print (still (c)'s critic, item 7).
 */
const REPORT_STRINGS = new Set<string>([REPORT_C.id, ...REPORT_C.summary, ...REPORT_C.body]);
export const keepFilm = (text: string): PrintMode => (text.includes('#') || REPORT_STRINGS.has(text) ? true : 'texture');

