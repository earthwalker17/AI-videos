/**
 * Micro-print: the real, small print on the Register Desk's paper and plates (TREATMENT.md, Art
 * direction v2: "dense real micro-print as texture, at least 18 px"). It is texture, never a line
 * meant to be read: every line the viewer must read is DOM text of 36 px or more (WORDS, cues.ts).
 *
 * Rules for these strings:
 * - original and generic: made-up ticket numbers, clock times, test counts and short commit-like
 *   lines; never the article's IDs, names, prompts or dialogues;
 * - one consistent clock: the session runs 13:51 (oldest fanfold row) to 14:02 (the newest slip);
 * - Latin letters, digits and ASCII punctuation only (IBM Plex Mono's latin file), so the face
 *   that draws them is loaded and proven (desk/gl/text.ts);
 * - short: at 18 px on screen a mono glyph is about 11 px wide, so each line fits its paper;
 *   nothing here carries information the picture needs. No chat or product transcript anywhere.
 *
 * Pure data: the font plan can read PRINT_STRINGS beside WORDS.
 */

/**
 * The five inline cells in the reading window, newest first (it sits west, by the print head): the
 * test tower's report just stamped in, then older events. At 0.85× they print as marks of their
 * kind; codes and clocks are kept for close shots. The request's own row carries its vermilion stub.
 */
export const CELLS = [
  { code: '#0408', kind: 'test', clock: '14:01', request: false },
  { code: '0407', kind: 'docs', clock: '14:00', request: false },
  { code: '0406', kind: 'ci', clock: '13:59', request: false },
  { code: '0405', kind: 'chat', clock: '13:58', request: true },
  { code: '0404', kind: 'chat', clock: '13:57', request: false },
] as const;
/** The cells before the stamp-in: the newest was #0407, and #0403 was still in view. */
export const CELLS_BEFORE = [
  { code: '0407', kind: 'docs', clock: '14:00', request: false },
  { code: '0406', kind: 'ci', clock: '13:59', request: false },
  { code: '0405', kind: 'chat', clock: '13:58', request: true },
  { code: '0404', kind: 'chat', clock: '13:57', request: false },
  { code: '0403', kind: 'chat', clock: '13:56', request: false },
] as const;

/** A Worker's dossier: the top sheet of its context (one per bay). */
export const DOSSIER = {
  bug: ['lock', '3/20'],
  tests: ['run 2', '41 ok'],
  docs: ['guide', '6/9'],
  fresh: ['ask', 'find'],
} as const;

/** The nameplate band on each bay's front wall. */
export const NAMEPLATE = {
  bug: 'W-07',
  tests: 'W-08 #0408',
  docs: 'W-09',
  fresh: 'W-10',
} as const;

/** The policy card pinned under the loupe at the Register's throat. */
export const POLICY = ['rule', 'drop'] as const;

/** The fanfold under the deck: older rows, folded away. */
export const FANFOLD = ['13:53 ack', '13:54 route', '13:55 skip'] as const;

/** The test tower's report card (it flies up into the Register's mouth). */
export const REPORT = ['#0408', '41 ok'] as const;

/**
 * The close shot's fine print (still (c), 2.0x): at that distance the micro-print above would read at
 * about 50 px, so the fanfold, the galley and the dossiers cross-fade to finer print of the same kind
 * (desk/state.ts closeAt), about 20 px there: texture again, never information.
 */
export const FANFOLD_FINE = ['13:46 ack', '13:47 route', '13:48 ack', '13:49 skip', '13:50 route', '13:51 ack', '13:52 route', '13:53 ack', '13:54 route', '13:55 skip'] as const;
export const GALLEY_FINE = ['guide', 'setup', 'usage', 'options', 'index', 'examples', 'notes', 'changes'] as const;
export const DOSSIER_FINE = ['notes', 'steps', 'files', 'checks', 'state', 'next'] as const;


/** The reply slip: it cites the report it answers. */
export const REPLY = ['#0408'] as const;
/** The replies already in your in-tray: code and clock. */
export const IN_TRAY = [
  ['14:00', 'ok'],
  ['13:57', 'ok'],
] as const;

/** The chat slip leaving the spout, the punched CI card in its feeder's mouth, and the request's own code. */
export const SLIPS = { chat: '14:02' } as const;

/**
 * MT1's next dispatch: the window's cells after the chat slip is stamped in (newest first; the
 * accepted slip prints as its mark with the loupe's notch, no number), and the chat slip's word.
 */
export const CELLS_NEXT = [
  { code: '', kind: 'chat', clock: '14:02', request: false },
  { code: '0408', kind: 'test', clock: '14:01', request: false },
  { code: '0407', kind: 'docs', clock: '14:00', request: false },
  { code: '0406', kind: 'ci', clock: '13:59', request: false },
  { code: '0405', kind: 'chat', clock: '13:58', request: true },
] as const;
export const NEXT_WORD = 'ask';

/**
 * Still (c), context as a cache: the request's progress report. Its header carries the teaching ID
 * (#0405, the request's own), its three-line summary is generic texture, never the article's IDs or
 * dialogue; the body's lines stand for the full record that goes behind the pointer. The older cards
 * in the window, newest first, shrink to stubs (the request's own chat stub among them).
 */
export const REPORT_C = {
  id: '#0405',
  summary: ['lock race', 'patch ready', 'pins pass'],
  body: ['trace', 'diff', 'log', 'repro'],
} as const;
export const CACHE_CELLS = [
  { kind: 'ci', request: false },
  { kind: 'chat', request: false },
  { kind: 'test', request: false },
  { kind: 'chat', request: true },
  { kind: 'docs', request: false },
] as const;

/**
 * Act one (desk/actOne.ts): each folder's top sheet, its working notes (at most 9 characters a
 * line, so a line fits its sheet at 16 u) and, on a chat task card, the clock it came in at. No IDs:
 * only the teaching chain's IDs are printed as numbers (design D2).
 */
export const FOLDER_PRINT = [
  { lines: ['reply', 'redraft', 'send ok?'], clock: '13:38' },
  { lines: ['lint', 'imports', 'wait: CI'], clock: '' },
  { lines: ['flaky', 'rerun it', 'pin seed'], clock: '' },
  { lines: ['scope', 'ask again', 'no reply'], clock: '13:31' },
  { lines: ['deps', 'bump all', 'build ok'], clock: '' },
  { lines: ['notes', 'rough cut', 'review?'], clock: '13:35' },
  { lines: ['config', 'staging', 'then prod'], clock: '13:40' },
  { lines: ['review', 'two notes', 'your call'], clock: '' },
] as const;
/** The notes loop: your one note on each session, along the tape at its tab (at most 8 characters: the tabs stand 81 u apart). */
export const LOOP_NOTES = ['reply ok', 'lint: CI', 'seed?', 'scope?', 'deps: ok', 'eyes on', 'prod?', 'you: ok?'] as const;
/** The chat slips in act one's heap: the clocks they came in at. */
export const HEAP_CLOCKS = ['13:41', '13:43', '13:44', '13:46', '13:47', '13:49'] as const;

/** Every micro-print string (the print face's coverage sample). */
export const PRINT_STRINGS: readonly string[] = [
  ...[...CELLS, ...CELLS_BEFORE].flatMap((c) => [c.code, c.kind, c.clock]),
  ...Object.values(DOSSIER).flat(),
  ...Object.values(NAMEPLATE),
  ...POLICY,
  ...FANFOLD,
  ...REPORT,
  ...REPLY,
  ...IN_TRAY.flat(),
  ...Object.values(SLIPS),
  ...FOLDER_PRINT.flatMap((p) => [...p.lines, p.clock]).filter(Boolean),
  ...LOOP_NOTES,
  ...HEAP_CLOCKS,
  NEXT_WORD,
  ...FANFOLD_FINE,
  ...GALLEY_FINE,
  ...DOSSIER_FINE,
  REPORT_C.id,
  ...REPORT_C.summary,
  ...REPORT_C.body,
];
