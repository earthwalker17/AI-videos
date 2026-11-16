/**
 * The one timeline of "Who Routes the Agents?" (V2): the grid, every word a viewer reads and when,
 * and the points the score must hit. The picture, the score, the captions and the hold checks all
 * read this file, so they cannot drift. It imports @aiv/core only: the audio stage hashes it alone.
 *
 * Time is counted in film frames from the end of the test-card leader. The grid is 120 bpm at
 * 60 fps: a beat is 30 frames and a bar 120. A line's `frame` is the frame from which it is fully
 * readable (its entrance ENDS there, on a beat) and `end` the frame at which it starts to leave.
 */
import { CueSheet, type CueEvent } from '@aiv/core';

export const FPS = 60;
export const BPM = 120;
export const BEATS_PER_BAR = 4;
/** frames per beat and per bar */
export const BEAT = 30;
export const BAR = BEAT * BEATS_PER_BAR;
export const BARS = 80;
export const FILM_FRAMES = BARS * BAR;
/** test-card frames before the film (the review cut's colour evidence); 0 for the final */
export const LEADER = 30;

/** Film frame of bar `bar` (from 1) and beat `beat` (from 1; halves allowed). */
export const at = (bar: number, beat = 1): number => Math.round((bar - 1) * BAR + (beat - 1) * BEAT);

/**
 * Type tiers. h1-h3 are caps headlines (display face), `sup` a sentence-case support line, `stamp`
 * a mono status tag, `num` a hollow numeral (a figure from the authors' synthetic tests), `verdict`
 * a counted one-bar answer, `label` a short name on a mark.
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
  status: at(65, 3),
  close: at(69, 4),
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
  /** starts to leave at this frame */
  end: number;
}

const lines: Line[] = [];
/** `beats` is how long the line stays fully readable. */
function ln(sec: Sec, block: string, id: string, tier: Tier, bar: number, beat: number, beats: number, text: string): void {
  const frame = at(bar, beat);
  lines.push({ id, sec, block, tier, text, frame, end: frame + Math.round(beats * BEAT) });
}

// ── 1. Flat: you are the router (bars 1-8) ───────────────────────────────────────────────────
ln('flat', 'q', 'q', 'h1', 1, 2, 7, 'WHO ROUTES\nYOUR AGENTS?');
ln('flat', 'sess', 'sess', 'label', 3, 1, 4, 'SESSION');
ln('flat', 'few', 'few', 'sup', 5, 1, 9, 'One team finds a person can usually follow 3 to 5.');
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
ln('levels', 'proto1', 'proto1', 'stamp', 18, 1, 7, 'PROTOTYPE: A RESTRICTED SHELL, NO WRITE TOOLS');
ln('levels', 'worker', 'worker', 'h2', 21, 1, 8, 'A WORKER:\nITS OWN CONTEXT');
ln('levels', 'worker', 'worker.one', 'sup', 21, 3, 6, 'One task. Full tools.');
ln('levels', 'answers', 'answers', 'sup', 23, 1, 6, 'By design, only the Router answers you.');

// ── 4. One Router for all this? Four answers (bars 25-55) ────────────────────────────────────
ln('spine', 'spine', 'spine', 'h1', 25, 1, 6, 'ONE ROUTER\nFOR ALL THIS?');

ln('gates', 'events', 'events', 'h3', 27, 1, 5, 'EVENTS, NOT JUST PROMPTS');
ln('gates', 'gate1', 'gate1', 'h3', 28, 3, 7, 'GATE ONE: PLAIN CODE');
ln('gates', 'gate1', 'gate1.no', 'sup', 29, 1, 5, 'No model runs.');
ln('gates', 'gate2', 'gate2', 'h3', 30, 3, 4, 'THEN A MODEL JUDGES.');
ln('gates', 'proto2', 'proto2', 'stamp', 31, 3, 7, 'PROTOTYPE DEFAULT: UNASKED WORK IS ONLY RECORDED');
ln('gates', 'v1', 'v1', 'verdict', 33, 3, 4, '1  MOST NEVER REACH IT.');

ln('threads', 'follow', 'follow', 'h3', 35, 3, 8, 'FOLLOW-UPS GO STRAIGHT IN');
ln('threads', 'follow', 'follow.seen', 'sup', 36, 1, 6, 'Seen by the Router. Not decided.');
ln('threads', 'cheaper', 'cheaper', 'h3', 37, 3, 9, 'CHEAPER, NOT FASTER');
ln('threads', 'cheaper', 'cheaper.n', 'num', 38, 1, 7, '~27%');
ln('threads', 'cheaper', 'cheaper.of', 'sup', 38, 1, 7, 'fewer tokens than without it');
ln('threads', 'cheaper', 'cheaper.by', 'stamp', 38, 1, 7, "AUTHORS' TEST");
ln('threads', 'v2', 'v2', 'verdict', 39, 4, 5, '2  FOLLOW-UPS SKIP ITS DECISION.');

ln('batch', 'wait', 'wait', 'h3', 43, 1, 6, 'ARRIVALS WAIT,\nTHEN ENTER TOGETHER');
ln('batch', 'cost', 'cost.n', 'num', 44, 3, 13, '6.4 s → 1.6 s');
ln('batch', 'cost', 'cost.of', 'sup', 44, 3, 13, 'model time per decision');
ln('batch', 'cost', 'cost.by', 'stamp', 45, 1, 11, "AUTHORS' STRESS TEST · MOCK WORKERS");
ln('batch', 'cost', 'cost.rate', 'stamp', 45, 3, 9, '~1 → ~40 DECISIONS NEEDED A MINUTE');
ln('batch', 'limit', 'limit', 'h3', 47, 4, 4, 'UP TO A LIMIT PER CALL.');
ln('batch', 'v3', 'v3', 'verdict', 48, 4, 5, '3  THE REST ARRIVE TOGETHER.');

ln('cache', 'cache', 'cache', 'h3', 51, 1, 8, 'ITS CONTEXT IS A CACHE');
ln('cache', 'cache', 'cache.how', 'sup', 51, 3, 6, 'What it needs soon stays in view.');
ln('cache', 'recall', 'recall', 'h3', 53, 1, 7, 'BY DESIGN: RECALL BY ID');
ln('cache', 'recall', 'recall.loss', 'sup', 53, 3, 5, 'It loses less. Not nothing.');
ln('cache', 'v4', 'v4', 'verdict', 54, 4, 5, '4  THE REST WAITS BEHIND IDS.');

// ── 5. Evidence (bars 56-65) ─────────────────────────────────────────────────────────────────
ln('evidence', 'test', 'test', 'h3', 56, 1, 8, "THE AUTHORS' TEST");
ln('evidence', 'test', 'test.caveat', 'sup', 56, 2, 7, 'Synthetic. 5 runs. Indicative only.');
ln('evidence', 'who', 'who.sa', 'label', 58, 1, 9, 'SUPER-AGENT');
ln('evidence', 'who', 'who.base', 'label', 58, 1, 9, 'ONE SESSION + SUBAGENT TOOL');
ln('evidence', 'who', 'who.told', 'sup', 58, 3, 7, 'told to delegate first');
ln('evidence', 'slow', 'slow', 'h3', 60, 2, 7, 'SLOWEST TASKS:\nABOUT HALF THE TIME');
ln('evidence', 'slow', 'slow.tag', 'stamp', 60, 4, 5, 'P95 · RE-PLOTTED');
ln('evidence', 'typ', 'typ', 'h3', 62, 1, 6, 'TYPICAL TASKS:\nABOUT 10% FASTER');
ln('evidence', 'typ', 'typ.tag', 'stamp', 62, 3, 4, 'P50');
ln('evidence', 'price', 'price', 'h3', 63, 3, 8, 'THE PRICE:\n2–4× THE TOKENS');
ln('evidence', 'price', 'price.vs', 'sup', 64, 1, 6, '2× this one, 4× one left to choose');

// ── 6. Proposed, open (bars 65-69) ───────────────────────────────────────────────────────────
ln('status', 'proposed', 'proposed', 'h3', 65, 3, 8, 'PROPOSED');
ln('status', 'proposed', 'proposed.t', 'sup', 65, 3, 8, 'Running in the cloud. A check for stuck Workers.');
ln('status', 'open', 'open', 'h3', 67, 3, 9, 'OPEN');
ln('status', 'open', 'open.t', 'sup', 67, 3, 9, 'Long memory. Security. Stepping in mid-task. More Routers.');

// ── 7. Close (bars 69-80) ────────────────────────────────────────────────────────────────────
ln('close', 'q2', 'q2', 'h1', 71, 1, 4, 'WHO ROUTES\nYOUR AGENTS?');
ln('close', 'notyou', 'notyou', 'h1', 72, 1, 4, 'NOT YOU.');
ln('close', 'notyou', 'bydesign', 'stamp', 72, 1, 10, 'BY DESIGN');
ln('close', 'decide', 'decide', 'h1', 73, 1, 6, 'YOU DECIDE.\nYOU SIGN OFF.');
ln('close', 'end', 'end.t', 'h2', 76, 1, 19, 'WHO ROUTES THE AGENTS?');
ln('close', 'end', 'end.src', 'sup', 76, 3, 17, 'After “Exploring Super-agent Design”');
ln('close', 'end', 'end.by', 'sup', 76, 3, 17, 'by the DeepSeek Harness team, 2026');
ln('close', 'end', 'end.ind', 'sup', 77, 1, 15, 'An independent explainer. Not affiliated with DeepSeek.');

export const LINES: readonly Line[] = lines;
const byId = new Map(lines.map((l) => [l.id, l]));
/** A line by id; throws on an unknown id, so a typo fails the page and the tests. */
export function line(id: string): Line {
  const l = byId.get(id);
  if (!l) throw new Error(`cues: no line '${id}'`);
  return l;
}

/** Names on the stack's spine and other standing marks: drawn for as long as their mark is. */
export const LABELS = {
  you: 'YOU',
  router: 'ROUTER',
  workers: 'WORKERS',
  world: 'EVENTS',
  code: 'CODE',
  model: 'MODEL',
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
  ['hit.v4', 54, 4, 'verdict 4'],
  ['hit.test', 56, 1, 'evidence begins'],
  ['hit.sign', 70, 3, 'the sign-off: one coral touch'],
  ['hit.decide', 73, 1, 'YOU DECIDE. YOU SIGN OFF.'],
  ['hit.end', 76, 1, 'the end card'],
];

const events: CueEvent[] = [];
for (const s of ORDER) events.push({ id: `sec.${s}`, kind: 'mark', frame: SECTIONS[s], label: s });
for (const [id, bar, beat, label] of HITS) events.push({ id, kind: 'hit', frame: at(bar, beat), label });
for (const l of lines) {
  events.push({ id: l.id, kind: CARD_BLOCKS.includes(l.block) && l.id === (l.block === 'title' ? 'title' : 'end.t') ? 'card' : 'text', frame: l.frame, end: l.end, text: { en: l.text.replace(/\n/g, ' ') } });
}
// the end card stands still while it is read
events.push({ id: 'hold.end', kind: 'hold', frame: at(77, 3), end: at(80, 4), label: 'the end card' });

export const cues = CueSheet.parse({
  schemaVersion: 1,
  fps: FPS,
  filmFrames: FILM_FRAMES,
  leaderFrames: LEADER,
  grid: { bpm: BPM, beatsPerBar: BEATS_PER_BAR, offsetFrames: 0 },
  events,
});
