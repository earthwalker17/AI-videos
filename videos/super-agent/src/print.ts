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
  { code: '#0407', kind: 'docs', clock: '14:00', request: false },
  { code: '0406', kind: 'ci', clock: '13:59', request: false },
  { code: '0405', kind: 'chat', clock: '13:58', request: true },
  { code: '0404', kind: 'chat', clock: '13:57', request: false },
  { code: '0403', kind: 'chat', clock: '13:56', request: false },
] as const;

/** A Worker's dossier: the top sheet of its context (one per bay). */
export const DOSSIER = {
  bug: ['#0405', '3/20'],
  tests: ['#0408', 'run 2'],
  docs: ['#0407', '6/9'],
} as const;

/** The nameplate band on each bay's front wall. */
export const NAMEPLATE = {
  bug: 'W-07 #0405',
  tests: 'W-08 #0408',
  docs: 'W-09 #0407',
} as const;

/** The policy card pinned under the loupe at the Register's throat. */
export const POLICY = ['POL3', 'rule', 'drop'] as const;

/** The fanfold under the deck: older rows, folded away. */
export const FANFOLD = ['#0400 13:53', '#0401 13:54', '#0402 13:55'] as const;

/** The test tower's report card (it flies up into the Register's mouth). */
export const REPORT = ['#0408', '41 ok'] as const;

/** Type lines set in the docs galley. */
export const GALLEY = ['Intake', 'Read once,', 'route it'] as const;

/** The reply slip: it cites the report it answers. */
export const REPLY = ['#0408'] as const;
/** The replies already in your in-tray: code and clock. */
export const IN_TRAY = [
  ['#0403', '14:00'],
  ['#0400', '13:57'],
] as const;

/** The chat slip leaving the spout, the punched CI card in its feeder's mouth, and the request's own code. */
export const SLIPS = { chat: '14:02', card: '0410', request: '#0405' } as const;

/** Every micro-print string (the print face's coverage sample). */
export const PRINT_STRINGS: readonly string[] = [
  ...[...CELLS, ...CELLS_BEFORE].flatMap((c) => [c.code, c.kind, c.clock]),
  ...Object.values(DOSSIER).flat(),
  ...Object.values(NAMEPLATE),
  ...POLICY,
  ...FANFOLD,
  ...REPORT,
  ...GALLEY,
  ...REPLY,
  ...IN_TRAY.flat(),
  ...Object.values(SLIPS),
];
