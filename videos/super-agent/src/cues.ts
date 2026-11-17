/**
 * The one timeline of "Who Routes the Agents?" (V2): the grid, every word a viewer reads and when,
 * and the points the score must hit. The picture, the score, the captions and the hold checks all
 * read this file, so they cannot drift. It imports @aiv/core only: the audio stage hashes it alone.
 *
 * Time is counted in film frames from the end of the test-card leader. The grid is 120 bpm at
 * 60 fps: a beat is 30 frames and a bar 120. A line's `frame` is the frame from which it is fully
 * readable (its entrance ENDS there, on a beat) and `end` the frame at which it starts to leave,
 * unless the next block lands first: then it leaves early enough to be gone (`out`).
 */
import { CueSheet, type CueEvent } from '@aiv/core';

export const FPS = 60;
export const BPM = 120;
export const BEATS_PER_BAR = 4;
/** frames per beat and per bar */
export const BEAT = 30;
export const BAR = BEAT * BEATS_PER_BAR;
export const BARS = 84;
export const FILM_FRAMES = BARS * BAR;
/** test-card frames before the film (the review cut's colour evidence); 0 for the final */
export const LEADER = 30;

/** Frames a line of type takes to arrive and to leave. */
export const TEXT_IN = 16;
export const TEXT_OUT = 8;
/** A line starts to leave this many frames before the next block is readable, so the two never sit on each other. */
export const HANDOVER = TEXT_IN + TEXT_OUT - 2;

/** Film frame of bar `bar` (from 1) and beat `beat` (from 1; halves allowed). */
export const at = (bar: number, beat = 1): number => Math.round((bar - 1) * BAR + (beat - 1) * BEAT);

/**
 * Type tiers. h1-h3 are caps headlines (display face), `sup` a sentence-case support line, `stamp`
 * a mono status tag, `num` a hollow numeral (a figure from the authors' synthetic tests), `verdict`
 * a counted one-bar answer (its ordinal, two spaces, the answer), `label` a short name on a mark.
 */
export type Tier = 'h1' | 'h2' | 'h3' | 'sup' | 'stamp' | 'num' | 'verdict' | 'label';

export type Sec = 'flat' | 'lift' | 'levels' | 'spine' | 'gates' | 'threads' | 'batch' | 'cache' | 'evidence' | 'status' | 'close';

/** Section starts, in film frames; each runs to the next one's start. */
export const SECTIONS: Record<Sec, number> = {
  flat: at(1),
  lift: at(9),
  levels: at(13),
  spine: at(25),
  gates: at(27),
  threads: at(34, 3),
  batch: at(41),
  cache: at(50),
  evidence: at(56),
  status: at(66, 2),
  close: at(70, 4),
};
const ORDER = Object.keys(SECTIONS) as Sec[];
export const sectionSpan = (s: Sec): [number, number] => {
  const k = ORDER.indexOf(s);
  return [SECTIONS[s], k + 1 < ORDER.length ? SECTIONS[ORDER[k + 1]!] : FILM_FRAMES];
};

export interface Line {
  id: string;
  sec: Sec;
  /** lines of one block are on screen together and are read as one */
  block: string;
  tier: Tier;
  /** the words; '\n' is a line break */
  text: string;
  /** fully readable from this frame (the entrance ends here) */
  frame: number;
  /** stays until this frame, if nothing replaces it sooner */
  end: number;
  /** starts to leave at this frame: `end`, or earlier when the next block lands right after it */
  out: number;
}

const lines: Line[] = [];
/** A line by id; throws on an unknown id, so a typo fails the page and the tests. */
export function line(id: string): Line {
  const l = lines.find((m) => m.id === id);
  if (!l) throw new Error(`cues: no line '${id}'`);
  return l;
}
/** `beats` is how long the line stays fully readable. */
function ln(sec: Sec, block: string, id: string, tier: Tier, bar: number, beat: number, beats: number, text: string): void {
  const frame = at(bar, beat);
  const end = frame + Math.round(beats * BEAT);
  lines.push({ id, sec, block, tier, text, frame, end, out: end });
}

// ── 1. Flat: you are the router (bars 1-8) ───────────────────────────────────────────────────
ln('flat', 'q', 'q', 'h1', 1, 2, 7, 'WHO ROUTES\nTHE AGENTS?');
ln('flat', 'sess', 'sess', 'label', 3, 1, 4, 'SESSION');
ln('flat', 'few', 'few', 'sup', 5, 2, 8, 'One team finds a person can usually follow 3 to 5 sessions.');
ln('flat', 'youdo', 'youdo', 'h1', 8, 1, 4, 'YOU DO.');

// ── 2. The lift: routing becomes its own layer (bars 9-12) ───────────────────────────────────
ln('lift', 'title', 'title', 'h3', 10, 1, 12, 'THE SUPER-AGENT DESIGN');
ln('lift', 'title', 'title.by', 'sup', 10, 3, 10, "from DeepSeek's Harness team");
ln('lift', 'title', 'title.not', 'stamp', 11, 1, 8, 'TWO LEVELS · A DESIGN, NOT A PRODUCT');

// ── 3. Two levels (bars 13-24) ───────────────────────────────────────────────────────────────
ln('levels', 'router', 'router', 'h2', 14, 1, 8, 'ONE LONG-LIVED\nROUTER');
ln('levels', 'router', 'ch.chat', 'label', 14, 3, 6, 'CHAT');
ln('levels', 'router', 'ch.review', 'label', 14, 3, 6, 'CODE REVIEW');
ln('levels', 'router', 'ch.mail', 'label', 14, 3, 6, 'EMAIL');
ln('levels', 'routes', 'routes', 'h2', 16, 1, 8, 'IT ROUTES.\nIT NEVER EXECUTES.');
ln('levels', 'routes', 'routes.whole', 'sup', 16, 3, 6, 'Whole tasks go down, unsplit.');
ln('levels', 'proto1', 'proto1', 'stamp', 18, 2, 7.5, 'PROTOTYPE ROUTER: KEEPS A SHELL, NO WRITE TOOLS');
// it lets go a beat before the bar: the camera leaves the Worker's plane under no words
ln('levels', 'worker', 'worker', 'h2', 21, 1, 7, 'A WORKER:\nITS OWN CONTEXT');
ln('levels', 'worker', 'worker.one', 'sup', 21, 3, 5, 'One task. Full tools.');
// half a beat into the bar: the camera is back on the stack and at rest before the sentence is read
ln('levels', 'answers', 'answers', 'sup', 23, 1.5, 6, 'By design, only the Router answers you.');

// ── 4. One Router for all this? Four answers (bars 25-55) ────────────────────────────────────
ln('spine', 'spine', 'spine', 'h1', 25, 1, 6, 'ONE ROUTER\nFOR ALL THIS?');

ln('gates', 'events', 'events', 'h3', 27, 1, 5, 'EVENTS, NOT JUST PROMPTS');
ln('gates', 'gate1', 'gate1', 'h3', 28, 3, 7, 'GATE ONE: PLAIN CODE');
ln('gates', 'gate1', 'gate1.no', 'sup', 29, 1, 5, 'No model runs.');
ln('gates', 'gate2', 'gate2', 'h3', 30, 2, 5, 'THEN A MODEL JUDGES.');
ln('gates', 'proto2', 'proto2', 'stamp', 31, 3, 7, 'PROTOTYPE DEFAULT: UNASKED WORK IS ONLY RECORDED');
ln('gates', 'v1', 'v1', 'verdict', 33, 3, 4, '1.  FEW REACH THE ROUTER.');

ln('threads', 'follow', 'follow', 'h3', 35, 1, 8, 'FOLLOW-UPS GO STRAIGHT IN');
ln('threads', 'follow', 'follow.seen', 'sup', 35, 3, 6, 'Seen by the Router. Not decided.');
ln('threads', 'cheaper', 'cheaper', 'h3', 37, 2, 10, 'CHEAPER, NOT FASTER');
ln('threads', 'cheaper', 'cheaper.n', 'num', 37, 4, 8, '~27%');
ln('threads', 'cheaper', 'cheaper.of', 'sup', 37, 4, 8, 'fewer tokens than without it');
ln('threads', 'cheaper', 'cheaper.by', 'stamp', 37, 4, 8, "AUTHORS' TEST");
ln('threads', 'v2', 'v2', 'verdict', 39, 4, 5, '2.  FOLLOW-UPS SKIP ITS DECISION.');

ln('batch', 'wait', 'wait', 'h3', 42, 3, 6, 'ARRIVALS WAIT,\nTHEN ENTER TOGETHER');
ln('batch', 'cost', 'cost.n', 'num', 44, 1, 14, '6.4 s → 1.6 s');
ln('batch', 'cost', 'cost.of', 'sup', 44, 1, 14, 'model time per decision, at ~40× the load');
ln('batch', 'cost', 'cost.by', 'stamp', 44, 1, 14, "AUTHORS' STRESS TEST · MOCK WORKERS");
ln('batch', 'limit', 'limit', 'h3', 47, 3, 5, 'UP TO A LIMIT PER CALL.');
ln('batch', 'v3', 'v3', 'verdict', 48, 4, 5, '3.  THE REST ARRIVE TOGETHER.');

ln('cache', 'cache', 'cache', 'h3', 50, 3, 8, 'ITS CONTEXT IS A CACHE');
ln('cache', 'cache', 'cache.how', 'sup', 51, 1, 6, 'What it needs soon stays in view.');
ln('cache', 'recall', 'recall', 'h3', 52, 3, 8, 'BY DESIGN: RECALL BY ID');
ln('cache', 'recall', 'recall.loss', 'sup', 53, 1, 6, 'It loses less. Not nothing.');
ln('cache', 'v4', 'v4', 'verdict', 54, 3, 5, '4.  DETAILS WAIT BEHIND IDS.');

// ── 5. Evidence (bars 56-66) ─────────────────────────────────────────────────────────────────
// the caveats stay up while the two rows are named and the same events run along both: one block
ln('evidence', 'test', 'test', 'h3', 56, 1, 18, "THE AUTHORS' TEST");
ln('evidence', 'test', 'test.caveat', 'sup', 56, 2, 17, 'Synthetic. 5 runs. Indicative only.');
ln('evidence', 'test', 'who.sa', 'label', 57, 3, 12, 'SUPER-AGENT');
ln('evidence', 'test', 'who.base', 'label', 57, 3, 12, 'ONE SESSION + SUBAGENT TOOL');
ln('evidence', 'test', 'who.told', 'sup', 58, 1, 10, 'told to delegate first');
ln('evidence', 'slow', 'slow', 'h3', 60, 3, 8, 'SLOWEST TASKS:\nABOUT HALF THE TIME');
ln('evidence', 'slow', 'slow.tag', 'stamp', 61, 1, 6, 'P95 · RE-PLOTTED');
ln('evidence', 'typ', 'typ', 'h3', 62, 3, 6, 'TYPICAL TASKS:\nABOUT 10% FASTER');
ln('evidence', 'typ', 'typ.tag', 'stamp', 62, 4, 5, 'P50');
ln('evidence', 'price', 'price', 'h3', 64, 1, 9, 'THE PRICE:\n2–4× THE TOKENS');
// each lower band is named at its tip. The lengths say the rest: a multiple beside a band read as that band's own
ln('evidence', 'price', 'price.free', 'sup', 64, 3, 7, 'left to choose');

// ── 6. Proposed, open (bars 66-70) ───────────────────────────────────────────────────────────
ln('status', 'proposed', 'proposed', 'h3', 66, 2, 9, 'PROPOSED');
ln('status', 'proposed', 'proposed.t', 'sup', 66, 3.5, 7.5, 'Running in the cloud. A check for stuck Workers.');
ln('status', 'open', 'open', 'h3', 68, 3, 9, 'OPEN');
ln('status', 'open', 'open.t', 'sup', 68, 3, 9, 'Long memory. Security. Stepping in mid-task. More Routers.');

// ── 7. Close (bars 70-84) ────────────────────────────────────────────────────────────────────
ln('close', 'q2', 'q2', 'h1', 71, 1, 6, 'WHO ROUTES\nTHE AGENTS?');
ln('close', 'notyou', 'notyou', 'h1', 72, 3, 6, 'NOT YOU.');
ln('close', 'notyou', 'bydesign', 'stamp', 72, 3, 12, 'BY DESIGN');
ln('close', 'decide', 'decide', 'h1', 74, 1, 6, 'YOU DECIDE.\nYOU SIGN OFF.');
// the recap: the four counted answers once more, as one list, a beat apart
// (it has gone before the camera leaves for the end card: nothing crosses it)
ln('close', 'recap', 'recap.1', 'verdict', 76, 1, 14, line('v1').text);
ln('close', 'recap', 'recap.2', 'verdict', 76, 2, 13, line('v2').text);
ln('close', 'recap', 'recap.3', 'verdict', 76, 3, 12, line('v3').text);
ln('close', 'recap', 'recap.4', 'verdict', 76, 4, 11, line('v4').text);
// the end card stays to the last frame: it goes with the picture's own fade
ln('close', 'end', 'end.t', 'h2', 80, 1, 20, 'WHO ROUTES THE AGENTS?');
ln('close', 'end', 'end.src', 'sup', 80, 3, 18, 'After “Exploring Super-agent Design”');
ln('close', 'end', 'end.by', 'sup', 80, 3, 18, 'by the DeepSeek Harness team, 2026');
ln('close', 'end', 'end.ind', 'sup', 81, 1, 16, 'An independent explainer. Not affiliated with DeepSeek.');

// A block leaves as the next one lands: each line is gone before the entrance that follows it.
for (const l of lines) {
  const next = Math.min(...lines.filter((m) => m.block !== l.block && m.frame >= l.end).map((m) => m.frame));
  l.out = Math.min(l.end, next - HANDOVER);
}

export const LINES: readonly Line[] = lines;

/** Names on the stack's spine and other standing marks: drawn for as long as their mark is. */
export const LABELS = {
  you: 'YOU',
  router: 'ROUTER',
  workers: 'WORKERS',
  world: 'EVENTS',
  code: 'CODE',
  model: 'MODEL',
  /** where the model gate's unasked work goes in the prototype's default setting */
  recorded: 'RECORDED',
  /** what a body leaves on the Router's line when it goes to the shelf */
  id: 'ID',
  /** the two designs the authors' test compares: the rows of the re-plot */
  sa: 'SUPER-AGENT',
  base: 'ONE SESSION + SUBAGENT TOOL',
} as const;

/** Blocks shown as cards (a title or end card): at least 4 s, and captioned as one. */
export const CARD_BLOCKS: readonly string[] = ['title', 'end'];

/** Points the score must hit (a sound lands on the frame). */
const HITS: Array<[id: string, bar: number, beat: number, label: string]> = [
  ['hit.q', 1, 2, 'the title question lands'],
  ['hit.youdo', 8, 1, 'YOU DO.'],
  ['hit.drop', 9, 1, 'the drop: the trail lifts off'],
  ['hit.title', 10, 1, 'the title card'],
  ['hit.spine', 25, 1, 'ONE ROUTER FOR ALL THIS?'],
  ['hit.v1', 33, 3, 'verdict 1'],
  ['hit.v2', 39, 4, 'verdict 2'],
  ['hit.v3', 48, 4, 'verdict 3'],
  ['hit.v4', 54, 3, 'verdict 4'],
  ['hit.test', 56, 1, 'evidence begins'],
  ['hit.decide', 74, 1, 'YOU DECIDE. YOU SIGN OFF.'],
  ['hit.sign', 74, 3, 'the sign-off: one coral touch'],
  ['hit.end', 80, 1, 'the end card'],
];

const events: CueEvent[] = [];
for (const s of ORDER) events.push({ id: `sec.${s}`, kind: 'mark', frame: SECTIONS[s], label: s });
for (const [id, bar, beat, label] of HITS) events.push({ id, kind: 'hit', frame: at(bar, beat), label });
for (const l of lines) {
  events.push({ id: l.id, kind: CARD_BLOCKS.includes(l.block) && l.id === (l.block === 'title' ? 'title' : 'end.t') ? 'card' : 'text', frame: l.frame, end: l.end, text: { en: l.text.replace(/\n/g, ' ') } });
}
// the recap stands still while its four lines are read: from the last line's landing until the camera leaves for the end card
events.push({ id: 'hold.recap', kind: 'hold', frame: at(76, 4), end: at(79, 3), label: 'the recap' });
// the end card stands still while it is read, to the last frame: the camera has settled a beat after its last line lands
events.push({ id: 'hold.end', kind: 'hold', frame: at(81, 2), end: FILM_FRAMES, label: 'the end card' });

export const cues = CueSheet.parse({
  schemaVersion: 1,
  fps: FPS,
  filmFrames: FILM_FRAMES,
  leaderFrames: LEADER,
  grid: { bpm: BPM, beatsPerBar: BEATS_PER_BAR, offsetFrames: 0 },
  events,
});
