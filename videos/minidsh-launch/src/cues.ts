/**
 * The one timeline of "MiniDSH 2.0: One Runtime, Every Surface": the grid, the acts, every word a
 * viewer reads and when, and the points the score must hit. The picture, the score, the captions
 * and QA's hold checks all read this file. It imports @aiv/core only: the audio stage hashes it alone.
 *
 * Time is counted in film frames from the end of the test-card leader. 120 bpm at 60 fps: a beat
 * is 30 frames, a bar 120 (2 s). A title's `frame` is the frame from which it is fully readable
 * (its entrance ends there) and `end` the frame at which it starts to leave.
 */
import { CueSheet, type CueEvent } from '@aiv/core';

export const FPS = 60;
export const BPM = 120;
export const BEATS_PER_BAR = 4;
export const BEAT = (FPS * 60) / BPM;
export const BAR = BEAT * BEATS_PER_BAR;
export const BARS = 42;
export const FILM_FRAMES = BARS * BAR;
/** test-card frames before the film: 30 for drafts and the review cut (colour evidence), 0 for the final */
export const LEADER = 30;

/** Frames a title takes to arrive and to leave (exits shorter than entrances). */
export const TEXT_IN = 12;
export const TEXT_OUT = 8;

/** Film frame of bar `bar` (from 1) and beat `beat` (from 1; fractions allowed). */
export const at = (bar: number, beat = 1): number => Math.round((bar - 1) * BAR + (beat - 1) * BEAT);

export type Act = 'hook' | 'terminal' | 'handoff' | 'record' | 'permission' | 'desktop' | 'runtime' | 'close';
/** Act starts in film frames; each runs to the next one's start. */
export const ACTS: Record<Act, number> = {
  hook: at(1),
  terminal: at(3),
  handoff: at(10),
  record: at(12),
  permission: at(15),
  desktop: at(21),
  runtime: at(27),
  close: at(35),
};
const ORDER = Object.keys(ACTS) as Act[];
export function actSpan(a: Act): [number, number] {
  const k = ORDER.indexOf(a);
  return [ACTS[a], k + 1 < ORDER.length ? ACTS[ORDER[k + 1]!] : FILM_FRAMES];
}
/** The act a film frame belongs to. */
export function actAt(f: number): Act {
  let cur: Act = 'hook';
  for (const a of ORDER) if (f >= ACTS[a]) cur = a;
  return cur;
}

/** Title tiers: `title` the scene's statement, `sub` its second line, `mono` a command or URL, `small` legal print. */
export type Tier = 'title' | 'sub' | 'mono' | 'small' | 'name';

export interface Title {
  id: string;
  act: Act;
  tier: Tier;
  /** the words; '\n' is a line break */
  text: string;
  /** fully readable from this frame */
  frame: number;
  /** starts to leave at this frame */
  end: number;
}

/**
 * Every line a viewer reads, in order. Words are checked against FACTS.md (MiniDSH 2.0.0 sources).
 * The product's own on-screen strings (inside the captured UI) are not listed: they are pictures.
 */
export const TITLES: Title[] = [
  { id: 't-hook', act: 'hook', tier: 'sub', text: 'A coding agent for your terminal, browser and desktop.', frame: 0, end: at(2, 3) - 8 - TEXT_OUT },
  { id: 't-read', act: 'terminal', tier: 'title', text: 'No edit before a read.', frame: at(5, 2), end: at(7, 1) },
  { id: 't-session', act: 'handoff', tier: 'title', text: 'Same session. In your browser.', frame: at(10, 2), end: at(12, 1) },
  { id: 't-record', act: 'record', tier: 'title', text: "The runtime's record, not the model's word.", frame: at(12, 3), end: at(15, 1) },
  { id: 't-perm', act: 'permission', tier: 'title', text: 'Write inside the workspace.\nAnything wider needs approval.', frame: at(15, 3), end: at(19, 1) - TEXT_OUT },
  { id: 't-window', act: 'desktop', tier: 'title', text: 'Its own window. Its own Node.', frame: at(21, 3), end: at(23, 3) },
  { id: 't-kept', act: 'desktop', tier: 'title', text: 'Quit mid-turn. The session is kept.', frame: at(24, 1), end: at(26, 3) },
  { id: 't-ways', act: 'runtime', tier: 'title', text: 'Four ways in.', frame: at(28, 1), end: at(29, 3) },
  { id: 't-providers', act: 'runtime', tier: 'title', text: 'DeepSeek, Anthropic or OpenAI.', frame: at(32, 1) - 10, end: at(33, 1) - TEXT_OUT },
  { id: 't-runtime', act: 'runtime', tier: 'title', text: 'One runtime.', frame: at(33, 1), end: at(35, 1) },
  { id: 'c-name', act: 'close', tier: 'name', text: 'MiniDSH 2.0', frame: at(36, 3), end: FILM_FRAMES },
  { id: 'c-tag', act: 'close', tier: 'sub', text: 'An architecture-first, local-first agent harness.', frame: at(37, 1), end: FILM_FRAMES },
  { id: 'c-install', act: 'close', tier: 'mono', text: 'npm install -g minidsh', frame: at(38, 1), end: FILM_FRAMES },
  { id: 'c-dep', act: 'close', tier: 'small', text: 'One package. One runtime dependency. Node 24+.', frame: at(38, 3), end: FILM_FRAMES },
  { id: 'c-url', act: 'close', tier: 'mono', text: 'github.com/earthwalker17/MiniDSH', frame: at(39, 1), end: FILM_FRAMES },
  { id: 'c-legal', act: 'close', tier: 'small', text: 'An independent project inspired by DeepSeek Harness.\nNot affiliated with or endorsed by DeepSeek.', frame: at(39, 3), end: FILM_FRAMES },
  { id: 'c-real', act: 'close', tier: 'small', text: 'Real sessions, recorded live; waits shortened.', frame: at(40, 1), end: FILM_FRAMES },
];

const BY_ID = new Map(TITLES.map((t) => [t.id, t]));
/** A title by id; throws on an unknown id, so a typo fails the page and the tests. */
export function title(id: string): Title {
  const t = BY_ID.get(id);
  if (!t) throw new Error(`no title '${id}'`);
  return t;
}

/** Points the score lands on, and the moments the picture is built around. */
export const HITS = {
  dotDrop: at(2, 3),
  enter: at(3, 1),
  refused: at(5, 1),
  read: at(6, 1),
  edited: at(6, 3),
  pass: at(8, 1),
  table: at(9, 1),
  handoff: at(10, 1),
  receipt: at(13, 3),
  sandbox: at(16, 3),
  approval: at(17, 1),
  allow: at(19, 1),
  desktop: at(21, 1),
  quit: at(24, 1),
  collapse: at(25, 1),
  reopen: at(26, 1),
  runtime: at(27, 1),
  cbRead: at(30, 1),
  cbAllow: at(31, 1),
  cbKept: at(31, 3),
  cbModels: at(32, 1),
  lit: at(33, 1),
  mark: at(36, 1),
} as const;
export type Hit = keyof typeof HITS;

/** Deliberate quiet: after Allow once (half a bar), and the last half bar under the end card. */
export const RESTS = {
  allow: [at(20, 1), at(20, 3)],
  end: [at(42, 3), FILM_FRAMES],
} as const;

const events: CueEvent[] = [
  ...TITLES.map((t): CueEvent => ({ id: t.id, kind: t.act === 'close' ? 'card' : 'text', frame: t.frame, end: t.end, text: { en: t.text } })),
  ...Object.entries(HITS).map(([id, frame]): CueEvent => ({ id: `hit-${id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, kind: 'hit', frame })),
  { id: 'rest-allow', kind: 'rest', frame: RESTS.allow[0], end: RESTS.allow[1] },
  { id: 'rest-end', kind: 'rest', frame: RESTS.end[0], end: RESTS.end[1] },
  // the end card stands still while it is read
  { id: 'hold-close', kind: 'hold', frame: at(40, 1), end: FILM_FRAMES },
];
events.sort((a, b) => a.frame - b.frame || a.id.localeCompare(b.id));

export const cues: CueSheet = CueSheet.parse({
  schemaVersion: 1,
  fps: FPS,
  filmFrames: FILM_FRAMES,
  leaderFrames: LEADER,
  grid: { bpm: BPM, beatsPerBar: BEATS_PER_BAR, offsetFrames: 0 },
  events,
});
export default cues;
