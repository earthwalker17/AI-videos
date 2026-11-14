/**
 * Subtitle profiles per language: the limits the caption linter checks and the draft generator
 * wraps to. Numbers from references/subtitles.md (Netflix en-US and zh-Hans timed-text guides,
 * applied as lint thresholds). How characters are counted, the minimum duration and the
 * line-break preference are our own choices, named here.
 */

export interface SubtitleProfile {
  /** the language tag the profile is for */
  lang: string;
  /** characters per line, at most (code points, spaces included) */
  maxLineChars: number;
  /** lines per caption, at most */
  maxLines: number;
  /** reading speed, at most: characters per second, counted by `speedChars` */
  maxCps: number;
  /**
   * What reading speed counts. `all`: every character, spaces included, a line break counted as
   * one space (Netflix en-US). `non-space`: every character but white space (our choice for
   * zh-Hans, where a space is a pause, not something read).
   */
  speedCount: 'all' | 'non-space';
  /** where lines may break: `latin` at spaces only; `cjk` between characters too, preferring a space */
  script: 'latin' | 'cjk';
  /** the zh-Hans punctuation rules: no ，or 。 (a pause is a space), full-width ？！： */
  zhPunctuation: boolean;
}

export const SUBTITLE_PROFILES: Readonly<Record<string, SubtitleProfile>> = {
  en: { lang: 'en', maxLineChars: 42, maxLines: 2, maxCps: 20, speedCount: 'all', script: 'latin', zhPunctuation: false },
  // two lines: the reference did not read the zh-Hans two-line rules, so the en-US count stands in
  'zh-Hans': { lang: 'zh-Hans', maxLineChars: 16, maxLines: 2, maxCps: 9, speedCount: 'non-space', script: 'cjk', zhPunctuation: true },
};

/**
 * A caption shorter than this is a warning (ms). Our choice, not a reference number (the reference
 * did not read Netflix's minimum event duration): one second, so a short line never flashes by.
 */
export const MIN_DURATION_MS = 1000;

/**
 * The profile for a language tag: the exact tag, else the tag with its last subtags removed one by
 * one (en-GB → en, zh-Hans-CN → zh-Hans); null when there is none (zh alone could be either script).
 */
export function subtitleProfile(lang: string): SubtitleProfile | null {
  const parts = lang.split('-');
  for (let n = parts.length; n > 0; n--) {
    const p = SUBTITLE_PROFILES[parts.slice(0, n).join('-')];
    if (p) return p;
  }
  return null;
}

/** Characters on one line, as the line limit counts them: code points, spaces included. */
export const lineChars = (line: string): number => [...line].length;

/** Characters of a caption's lines, as its profile's reading speed counts them. */
export function speedChars(lines: readonly string[], profile: Pick<SubtitleProfile, 'speedCount'>): number {
  if (profile.speedCount === 'all') return lineChars(lines.join(' '));
  return [...lines.join('')].filter((c) => !/\s/u.test(c)).length;
}
