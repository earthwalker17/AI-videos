/**
 * Micro-print: the real, small print on the Register Desk's paper and plates (TREATMENT.md, Art
 * direction v2: "dense real micro-print as texture, at least 18 px"). It is texture, never a line
 * meant to be read: every line the viewer must read is DOM text of 36 px or more (WORDS, cues.ts).
 *
 * Rules for these strings:
 * - original and generic: made-up ticket numbers, clock times, test counts and short commit-like
 *   lines; never the article's IDs, names, prompts or dialogues;
 * - Latin letters, digits and ASCII punctuation only (JetBrains Mono's latin file until IBM Plex
 *   Mono replaces it), so the face that draws them is loaded and proven (desk/gl/text.ts);
 * - short: at 18 px on screen a mono glyph is about 11 px wide, so each line fits its paper;
 *   nothing here carries information the picture needs.
 *
 * Pure data: the font plan can read PRINT_STRINGS beside WORDS.
 */

/** The Register's tape: one row per event it logged (code, clock). */
export const TAPE_ROWS = ['#0398', '#0399', '#0400', '#0401', '#0402', '#0403', '#0404'] as const;

/** The five inline cells in the reading window (oldest first): a code, a kind, a clock. */
export const CELLS = [
  { code: '0405', kind: 'chat', clock: '13:58' },
  { code: '0406', kind: 'ci', clock: '13:59' },
  { code: '0407', kind: 'docs', clock: '14:00' },
  { code: '0408', kind: 'test', clock: '14:01' },
  { code: '0409', kind: 'rply', clock: '14:02' },
] as const;

/** A Worker's dossier: the top sheet of its context (one per bay). */
export const DOSSIER = {
  bug: ['#0405', 'lock', '3/20'],
  tests: ['#0408', 'suite', 'run 2'],
  docs: ['#0407', 'guide', 'v3 6/9'],
} as const;

/** The nameplate band on each bay's front wall. */
export const NAMEPLATE = {
  bug: 'W-07 BUG #0405',
  tests: 'W-08 TEST #0408',
  docs: 'W-09 DOCS #0407',
} as const;

/** The policy card pinned under the loupe at the Register's throat. */
export const POLICY = ['POL3', 'rule', 'drop', 'pass'] as const;

/** The fanfold under the deck: older rows, folded away. */
export const FANFOLD = ['#0311 11:02', '#0312 11:02', '#0313 11:03', '#0314 11:03', '#0315 11:04'] as const;

/** The test tower's report card (it flies up to the Register). */
export const REPORT = ['#0408', '41 ok'] as const;

/** Type lines set in the docs galley. */
export const GALLEY = ['## Intake', 'Each event is read', 'once, then routed', 'whole to one'] as const;

/** Noise slips on the gate's spike (dropped by rule, never read). */
export const SPIKE = ['+1', 'ok', 'thx', 'nvm', 'bump', 'lgtm'] as const;

/** Your laptop's screen: a chat thread with clock times. */
export const LAPTOP = ['14:01 R', 'race fix', 'PR ready', '14:02 you'] as const;

/** The reply slip on its way down the chute to you, and the slips already in your in-tray. */
export const REPLY = ['#0409', 'done'] as const;
export const IN_TRAY = ['#0403', '#0400'] as const;

/** The chat slip at the gate, the punched CI card in its feeder, and the request's own code. */
export const SLIPS = { chat: '14:02', card: '2212', request: '#0405' } as const;

/** Every micro-print string (the print face's coverage sample). */
export const PRINT_STRINGS: readonly string[] = [
  ...TAPE_ROWS,
  ...CELLS.flatMap((c) => [c.code, c.kind, c.clock]),
  ...Object.values(DOSSIER).flat(),
  ...Object.values(NAMEPLATE),
  ...POLICY,
  ...FANFOLD,
  ...REPORT,
  ...GALLEY,
  ...SPIKE,
  ...LAPTOP,
  ...REPLY,
  ...IN_TRAY,
  ...Object.values(SLIPS),
];
