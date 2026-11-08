/**
 * Reading time of on-screen text: the readable-text bar of docs/PRODUCTION.md (Quality bars).
 * A line must stay fully visible and unchanged for at least max(1.8 s, reading time + 0.6 s).
 * One definition for every user: the audio stage's intent check (`text.hold`), a video's cue
 * tests and, later, the caption linter. Pure functions of the string.
 */

/** Text must stay up at least this long, however short (s). */
export const MIN_TEXT_S = 1.8;
/** Seconds added to the reading time: the eye has to find the text first. */
export const FIND_TEXT_S = 0.6;
/** Reading speeds: CJK characters and other (Latin…) characters per second. */
export const CJK_PER_S = 4.5;
export const OTHER_PER_S = 15;

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const SPACE = /\s/u;

/**
 * Seconds to read `text`: CJK code points / 4.5 + other non-space characters / 15. Full-width
 * punctuation (：？《》) is not a CJK script character, so it counts at the Latin rate.
 */
export function readingSeconds(text: string): number {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (CJK.test(ch)) cjk++;
    else if (!SPACE.test(ch)) other++;
  }
  return cjk / CJK_PER_S + other / OTHER_PER_S;
}

/** How long a text must be held, in seconds: max(1.8 s, reading time + 0.6 s). */
export const requiredHoldS = (text: string): number => Math.max(MIN_TEXT_S, readingSeconds(text) + FIND_TEXT_S);
