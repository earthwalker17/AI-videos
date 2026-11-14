/**
 * Line wrapping for captions, per language profile. A text's '\n' is a kept break: each line
 * between two of them (a paragraph) is wrapped on its own, into the fewest lines that fit the
 * profile's line length, balanced. Balanced means the smallest sum of squared slack, so the lines
 * come out about equal; a tie goes to the shorter top line. A break after clause punctuation
 * (, ; : . ? ! · – —), or at a space in CJK text (a pause), is preferred while it leaves each of two
 * lines up to 11 characters off their mean length (GOOD_BREAK_BONUS): "Your AI agents work in
 * parallel. / You can’t." rather than "… work in / parallel. You can’t.", but not "Above: / one
 * long-lived Router hears every channel.". Latin text breaks only at spaces (a word longer than a
 * line is cut); CJK text also breaks between characters, never before closing punctuation, after
 * opening punctuation or inside a run of Latin letters and digits.
 */
import { lineChars, type SubtitleProfile } from './profiles.ts';

/**
 * Squared-slack credit for a preferred break. Moving a two-line break d characters off balance
 * costs 2d², so the credit 2 × 11² accepts d ≤ 11. Our choice, tuned on video #4's 39 captions.
 */
export const GOOD_BREAK_BONUS = 2 * 11 ** 2;

interface Atom {
  text: string;
  /** a space stands before it: shown inside a line, dropped at a break */
  space: boolean;
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const OPEN = /[（「『《〈【〔“‘([{]/u;
const CLOSE = /[，。、；：？！）」』》〉】〕”’％…)\]},.;:?!%]/u;
/** a line may end after these with a preferred break */
const CLAUSE_END = /[,;:.?!·–—，。、；：？！…]$/u;

/** Words, with a word longer than a line cut into line-long pieces. */
function latinAtoms(text: string, max: number): Atom[] {
  const out: Atom[] = [];
  for (const word of text.split(/\s+/u).filter(Boolean)) {
    const cps = [...word];
    for (let k = 0; k < cps.length; k += max) out.push({ text: cps.slice(k, k + max).join(''), space: k === 0 && out.length > 0 });
  }
  return out;
}

/** CJK characters one by one, Latin runs whole, punctuation held to the character it belongs to. */
function cjkAtoms(text: string, max: number): Atom[] {
  const out: Atom[] = [];
  let space = false;
  // the last atom takes the next character (after opening punctuation), or continues a Latin run
  let glue = false;
  let run = false;
  for (const ch of text.trim()) {
    const last = out.at(-1);
    if (/\s/u.test(ch)) {
      space = out.length > 0;
      glue = run = false;
    } else if (last && !space && (glue || CLOSE.test(ch) || (run && !CJK.test(ch) && !OPEN.test(ch)))) {
      last.text += ch;
      if (glue) run = !CJK.test(ch);
      glue = OPEN.test(ch);
    } else {
      out.push({ text: ch, space });
      space = false;
      glue = OPEN.test(ch);
      run = !CJK.test(ch) && !glue;
    }
  }
  // a Latin run longer than a line is cut into line-long pieces
  return out.flatMap((a) => {
    const cps = [...a.text];
    if (cps.length <= max) return [a];
    const pieces: Atom[] = [];
    for (let k = 0; k < cps.length; k += max) pieces.push({ text: cps.slice(k, k + max).join(''), space: k === 0 && a.space });
    return pieces;
  });
}

/** One paragraph (no '\n') in the fewest lines of at most `profile.maxLineChars`, balanced. */
export function wrapParagraph(text: string, profile: Pick<SubtitleProfile, 'maxLineChars' | 'script'>): string[] {
  const W = profile.maxLineChars;
  const atoms = profile.script === 'cjk' ? cjkAtoms(text, W) : latinAtoms(text, W);
  const N = atoms.length;
  if (!N) return [];
  const len = atoms.map((a) => lineChars(a.text));
  const width = (i: number, j: number) => {
    let w = 0;
    for (let k = i; k < j; k++) w += len[k] + (k > i && atoms[k].space ? 1 : 0);
    return w;
  };
  // a preferred break before atom i: after clause punctuation, or at a pause (a space) in CJK text
  const good = (i: number) => i > 0 && i < N && ((profile.script === 'cjk' && atoms[i].space) || CLAUSE_END.test(atoms[i - 1].text));
  // the fewest lines: greedy filling is optimal when every atom fits on a line
  let n = 1;
  for (let i = 0, start = 0; i < N; i++) if (width(start, i + 1) > W) [n, start] = [n + 1, i];
  // dp[k][j]: the least cost of atoms [0, j) on k lines, from[k][j] the start of the k-th line
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(N + 1).fill(Infinity));
  const from = Array.from({ length: n + 1 }, () => new Array<number>(N + 1).fill(-1));
  dp[0][0] = 0;
  for (let k = 1; k <= n; k++)
    for (let j = 1; j <= N; j++)
      for (let i = k - 1; i < j; i++) {
        if (dp[k - 1][i] === Infinity) continue;
        const w = width(i, j);
        if (w > W) continue;
        const c = dp[k - 1][i] + (W - w) ** 2 - (good(i) ? GOOD_BREAK_BONUS : 0);
        if (c < dp[k][j]) [dp[k][j], from[k][j]] = [c, i];
      }
  const lines: string[] = [];
  for (let k = n, j = N; k > 0; k--) {
    const i = from[k][j];
    lines.unshift(atoms.slice(i, j).map((a, m) => (m > 0 && a.space ? ' ' : '') + a.text).join(''));
    j = i;
  }
  return lines;
}

/** Each kept paragraph of a text ('\n' breaks; blank ones dropped) as its wrapped lines. */
export function wrapText(text: string, profile: Pick<SubtitleProfile, 'maxLineChars' | 'script'>): string[][] {
  return text
    .split('\n')
    .map((p) => wrapParagraph(p, profile))
    .filter((l) => l.length > 0);
}

/**
 * Wrapped paragraphs on pages of at most `maxLines` lines, in order: a paragraph goes on the page
 * it fits on whole, else on a new page; one with more lines than a page fills pages of its own.
 */
export function paginate(paragraphs: readonly (readonly string[])[], maxLines: number): string[][] {
  const pages: string[][] = [];
  let page: string[] = [];
  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
  };
  for (const p of paragraphs) {
    if (page.length + p.length > maxLines) flush();
    if (p.length <= maxLines) page.push(...p);
    else
      for (let k = 0; k < p.length; k += maxLines) {
        page.push(...p.slice(k, k + maxLines));
        if (page.length === maxLines) flush();
      }
  }
  flush();
  return pages;
}
