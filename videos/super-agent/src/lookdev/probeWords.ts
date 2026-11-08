/**
 * The lookdev compositions' own strings, beyond the film's WORDS (src/cues.ts) they also show.
 * They are in the fonts' samples (look/fontPlan.ts) as long as the probe is part of the Main
 * composition.
 */
import { WORDS } from '../cues.ts';

/** the 200 px English line: large DOM text in Plex */
export const PROBE_BIG_EN = 'Router · Worker';
/** the 160 px zh line: large DOM text in Noto Sans SC */
export const PROBE_BIG_ZH = WORDS.title['zh-Hans'];
/** a label that mixes both scripts, as the film's "you" label does */
export const PROBE_YOU = `${WORDS.you.en} · ${WORDS.you['zh-Hans']}`;
/** the notes sheet's width readout ("c25 · 1548 / 1032 px"), in mono */
export const SHEET_READOUT = 'c0123456789 · / px';

export const PROBE_STRINGS: readonly string[] = [PROBE_BIG_EN, PROBE_BIG_ZH, PROBE_YOU, SHEET_READOUT];
