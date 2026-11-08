/**
 * Which unicode-range files ("slices") of a fontsource font a set of characters needs.
 * fontsource splits a CJK font into many files, one per unicode-range, listed in the package's
 * unicode.json (`[4]` … `[119]`, `latin`, …). The kit's useFont loads only the sources whose range
 * holds a sample character, and fails when a character has none; this picks the sources to give
 * it, so only the slices the film's strings touch are registered (a character outside them then
 * renders in a visibly wrong face, every time, instead of loading a file mid-render).
 */
import { coversCodePoint, parseUnicodeRange, type CodeRange } from '@aiv/remotion-kit';

export interface SlicePlan {
  /** the slice keys, in unicode.json order */
  slices: string[];
  /** code points no slice covers */
  missing: number[];
}

/**
 * Pick slices that together cover every code point of `codePoints`: greedily the slice that
 * covers the most of what is still uncovered, ties to the earlier key in unicode.json. Pure and
 * deterministic: the same strings give the same files.
 */
export function planSlices(unicode: Readonly<Record<string, string>>, codePoints: readonly number[]): SlicePlan {
  const order = Object.keys(unicode);
  const ranges = new Map<string, CodeRange[]>(order.map((k) => [k, parseUnicodeRange(unicode[k])]));
  let need = [...new Set(codePoints)];
  const chosen = new Set<string>();
  while (need.length > 0) {
    let best: string | null = null;
    let bestCount = 0;
    for (const k of order) {
      if (chosen.has(k)) continue;
      const r = ranges.get(k)!;
      const n = need.reduce((acc, cp) => acc + (coversCodePoint(r, cp) ? 1 : 0), 0);
      if (n > bestCount) {
        best = k;
        bestCount = n;
      }
    }
    if (best === null) break;
    chosen.add(best);
    const r = ranges.get(best)!;
    need = need.filter((cp) => !coversCodePoint(r, cp));
  }
  return { slices: order.filter((k) => chosen.has(k)), missing: need };
}
