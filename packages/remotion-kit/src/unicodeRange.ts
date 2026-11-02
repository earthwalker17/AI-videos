/**
 * CSS unicode-range maths for the font loader (fonts.ts): pure, so the coverage rule that fails a
 * render is pinned by tests. A range list is what an @font-face rule carries
 * ("U+0000-00FF, U+0131, U+4??"); fontsource packages list one per subset file in unicode.json.
 */

/** An inclusive code point interval [first, last]. */
export type CodeRange = readonly [number, number];

const MAX_CODE_POINT = 0x10ffff;

/** Everything: what a font source without a unicode-range is trusted to cover. */
export const ALL_CODE_POINTS: readonly CodeRange[] = [[0, MAX_CODE_POINT]];

/**
 * Parse a CSS unicode-range value: comma-separated `U+hex`, `U+hex-hex` or `U+hex??` (wildcards).
 * Throws on anything else: a mistyped range would silently cover nothing, and the loader would
 * then fail with a misleading coverage error (or, worse, skip the file).
 */
export function parseUnicodeRange(range: string): CodeRange[] {
  const tokens = range.split(',').map((t) => t.trim());
  if (tokens.length === 0 || tokens.some((t) => t === '')) throw new Error(`unicode-range '${range}': empty entry`);
  return tokens.map((token) => {
    const m = /^[uU]\+([0-9a-fA-F?]{1,6})(?:-([0-9a-fA-F]{1,6}))?$/.exec(token);
    if (!m) throw new Error(`unicode-range '${range}': cannot read '${token}' (expected U+hex, U+hex-hex or U+hex??)`);
    const [, head, tail] = m;
    let first: number;
    let last: number;
    if (head.includes('?')) {
      // wildcards only at the end, and never together with an explicit end
      if (tail !== undefined || !/^[0-9a-fA-F]*\?+$/.test(head)) throw new Error(`unicode-range '${range}': bad wildcard in '${token}'`);
      first = parseInt(head.replace(/\?/g, '0'), 16);
      last = parseInt(head.replace(/\?/g, 'f'), 16);
    } else {
      first = parseInt(head, 16);
      last = tail === undefined ? first : parseInt(tail, 16);
    }
    if (last < first || last > MAX_CODE_POINT) throw new Error(`unicode-range '${range}': '${token}' is not a range of code points`);
    return [first, last] as const;
  });
}

/** Whether `cp` lies in any of `ranges`. */
export function coversCodePoint(ranges: readonly CodeRange[], cp: number): boolean {
  return ranges.some(([a, b]) => cp >= a && cp <= b);
}

/** The distinct code points of `text`, whitespace included, in first-seen order. */
export function textCodePoints(text: string): number[] {
  const seen = new Set<number>();
  // iterating a string yields code points, so astral characters stay whole
  for (const ch of text) seen.add(ch.codePointAt(0)!);
  return [...seen];
}

/** The distinct code points of `text` that need a glyph (whitespace is skipped), in first-seen order. */
export const sampleCodePoints = (text: string): number[] => textCodePoints(text).filter((cp) => !/\s/u.test(String.fromCodePoint(cp)));

/** "U+4E07 '万'": how a missing code point is named in an error. */
export const describeCodePoint = (cp: number): string => `U+${cp.toString(16).toUpperCase().padStart(4, '0')} '${String.fromCodePoint(cp)}'`;

export interface FontPlan {
  /** indices of the sources whose range holds at least one code point of the sample, whitespace included */
  load: number[];
  /** sample code points that need a glyph (not whitespace) and that no source covers */
  missing: number[];
}

/**
 * Which sources a sample needs, and what none of them covers. `ranges[i]` is source i's parsed
 * unicode-range, or ALL_CODE_POINTS for a source without one.
 *
 * Whitespace is not required to be covered (a space without a face falls back to the same
 * system face on every frame), but a source that holds the sample's spaces IS loaded: the
 * browser draws a space with the face whose range holds it, so that file would otherwise load
 * lazily during the render (early frames laid out with fallback advance widths, so frames would
 * depend on render order), and document.fonts.check() counts every unloaded face whose range
 * meets the text, spaces included, so the loader's own check would fail. In fontsource's Noto
 * Serif SC, U+0020 lies only in subset [119] and the latin file, U+3000 in [116].
 */
export function planFont(ranges: readonly (readonly CodeRange[])[], sample: string): FontPlan {
  const all = textCodePoints(sample);
  const load = ranges.flatMap((r, i) => (all.some((cp) => coversCodePoint(r, cp)) ? [i] : []));
  const missing = sampleCodePoints(sample).filter((cp) => !ranges.some((r) => coversCodePoint(r, cp)));
  return { load, missing };
}
