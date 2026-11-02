import { describe, expect, it } from 'vitest';
import { ALL_CODE_POINTS, coversCodePoint, parseUnicodeRange, planFont, sampleCodePoints, textCodePoints } from './unicodeRange.ts';

describe('parseUnicodeRange', () => {
  it('reads single code points, ranges and wildcards, in any case and spacing', () => {
    expect(parseUnicodeRange('U+0131')).toEqual([[0x131, 0x131]]);
    expect(parseUnicodeRange('U+0000-00FF, u+0152-0153 ,U+4??')).toEqual([
      [0, 0xff],
      [0x152, 0x153],
      [0x400, 0x4ff],
    ]);
    // astral planes (fontsource's emoji subsets of Noto Serif SC)
    expect(parseUnicodeRange('U+1f1e9-1f1f5')).toEqual([[0x1f1e9, 0x1f1f5]]);
  });

  it('refuses what a browser would drop silently', () => {
    for (const bad of ['', '0041', 'U+', 'U+00FF-0041', 'U+4?1', 'U+4??-4FF', 'U+110000', 'U+0041,,U+0042', 'U+GG'])
      expect(() => parseUnicodeRange(bad), bad).toThrow(/unicode-range/);
  });
});

describe('coverage', () => {
  it('finds a code point in any of the ranges', () => {
    const r = parseUnicodeRange('U+0041-005A,U+4E00');
    expect([0x41, 0x5a, 0x4e00].map((cp) => coversCodePoint(r, cp))).toEqual([true, true, true]);
    expect([0x40, 0x5b, 0x4e01].map((cp) => coversCodePoint(r, cp))).toEqual([false, false, false]);
  });

  it('takes the sample by code point, skipping whitespace (ideographic space too)', () => {
    expect(sampleCodePoints('Ab A\n\t万　圣😀')).toEqual([0x41, 0x62, 0x4e07, 0x5723, 0x1f600]);
    expect(sampleCodePoints(' \n ')).toEqual([]);
  });

  it('loads only the subsets the sample touches and names what nothing covers', () => {
    const latin = parseUnicodeRange('U+0000-00FF');
    const cjkA = parseUnicodeRange('U+4E00-4FFF');
    const cjkB = parseUnicodeRange('U+5000-5FFF');
    expect(planFont([latin, cjkA, cjkB], 'Happy 万圣节')).toEqual({ load: [0, 1, 2], missing: [0x8282] });
    expect(planFont([latin, cjkA, cjkB], 'Boo 万')).toEqual({ load: [0, 1], missing: [] });
    // a source without a range is trusted for everything
    expect(planFont([cjkA, ALL_CODE_POINTS], 'Boo')).toEqual({ load: [1], missing: [] });
  });

  it('loads the subset that holds the sample spaces, without requiring spaces to be covered', () => {
    // the shape of Noto Serif SC 5.3.1: 万 in [117], U+0020 only in [119] and latin, U+3000 in [116]
    const s116 = parseUnicodeRange('U+2b,U+40,U+3000,U+4e16');
    const s117 = parseUnicodeRange('U+4e,U+3010-3011,U+4e07');
    const s119 = parseUnicodeRange('U+20-22,U+41-4d');
    const latin = parseUnicodeRange('U+0000-00FF');
    expect(planFont([s116, s117, s119, latin], '万 万')).toEqual({ load: [1, 2, 3], missing: [] });
    expect(planFont([s116, s117], '万　万')).toEqual({ load: [0, 1], missing: [] });
    // nothing holds the space: still no error, the space falls back like any whitespace
    expect(planFont([s117], '万 万')).toEqual({ load: [0], missing: [] });
    expect(textCodePoints('a a\n')).toEqual([0x61, 0x20, 0x0a]);
  });
});
