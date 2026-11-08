import { coversCodePoint, parseUnicodeRange, planFont } from '@aiv/remotion-kit';
import { describe, expect, it } from 'vitest';
import { WORDS } from '../cues.ts';
import { PROBE_STRINGS } from '../lookdev/probeWords.ts';
import { FILM_STRINGS, FILM_TYPE, MONO_UNICODE, NOTO_UNICODE, PLEX_UNICODE, planType, type FacePlan } from './fontPlan.ts';
import { planSlices } from './slices.ts';

const rangesOf = (plan: FacePlan, unicode: Readonly<Record<string, string>>) => plan.subsets.map((k) => parseUnicodeRange(unicode[k]));
const cp = (ch: string) => ch.codePointAt(0)!;

describe('planSlices', () => {
  const unicode = { a: 'U+41-43', b: 'U+42-45,U+4E00', c: 'U+4E00-4E01' };
  it('covers every code point with as few slices as it finds, in unicode.json order', () => {
    expect(planSlices(unicode, [cp('A')])).toEqual({ slices: ['a'], missing: [] });
    // b covers B, D and 一 at once; then c for 丁
    expect(planSlices(unicode, [cp('B'), cp('D'), cp('一'), cp('丁')])).toEqual({ slices: ['b', 'c'], missing: [] });
    expect(planSlices(unicode, [cp('A'), cp('E')]).slices).toEqual(['a', 'b']);
  });
  it('reports what no slice covers', () => {
    expect(planSlices(unicode, [cp('A'), cp('Z')])).toEqual({ slices: ['a'], missing: [cp('Z')] });
    expect(planSlices(unicode, [])).toEqual({ slices: [], missing: [] });
  });
});

describe('planType', () => {
  it('draws Latin in Plex and Mono, Han and what they lack in Noto', () => {
    const p = planType(['Router 路由', '1 → 40', 'Line one\nline two']);
    expect(p.plex.subsets).toEqual(['latin']);
    expect(p.plex.sample).toContain(' ');
    expect(p.plex.sample).not.toContain('\n');
    expect(p.plex.sample).not.toContain('路');
    expect(p.mono.sample).toBe(p.plex.sample);
    // U+2192 is in neither Latin file's range
    expect([...p.noto.sample].sort()).toEqual(['→', '由', '路'].sort());
    expect(p.noto.missing).toEqual([]);
  });
  it('names a character no file covers', () => {
    expect(planType(['😀']).noto.missing).toEqual([0x1f600]);
  });
});

describe('the film type plan', () => {
  it('reads every string of WORDS, line by line, and the probe', () => {
    for (const w of Object.values(WORDS)) for (const s of Object.values(w)) for (const line of s.split('\n')) expect(FILM_STRINGS).toContain(line);
    for (const s of PROBE_STRINGS) expect(FILM_STRINGS).toContain(s);
  });

  it('covers every character of every string, by the kit rule', () => {
    expect(FILM_TYPE.noto.missing).toEqual([]);
    const faces = [
      [FILM_TYPE.plex, PLEX_UNICODE],
      [FILM_TYPE.mono, MONO_UNICODE],
      [FILM_TYPE.noto, NOTO_UNICODE],
    ] as const;
    // each face covers its own sample (what useFont proves before frame 0)
    for (const [plan, unicode] of faces) expect(planFont(rangesOf(plan, unicode), plan.sample).missing).toEqual([]);
    // and every character is drawn by a loaded face: in the sans stack by Plex or else Noto
    const plex = rangesOf(FILM_TYPE.plex, PLEX_UNICODE).flat();
    const noto = new Set([...FILM_TYPE.noto.sample]);
    for (const s of FILM_STRINGS) for (const ch of s) if (!/\s/u.test(ch)) expect(coversCodePoint(plex, cp(ch)) || noto.has(ch), `'${ch}' in "${s}"`).toBe(true);
  });

  it('registers only the slices the strings touch', () => {
    const touched = (plan: FacePlan, unicode: Readonly<Record<string, string>>) =>
      plan.subsets.every((k) => [...plan.sample].some((ch) => coversCodePoint(parseUnicodeRange(unicode[k]), cp(ch))));
    expect(touched(FILM_TYPE.plex, PLEX_UNICODE)).toBe(true);
    expect(touched(FILM_TYPE.mono, MONO_UNICODE)).toBe(true);
    expect(touched(FILM_TYPE.noto, NOTO_UNICODE)).toBe(true);
    // a CJK font is many files: the film's few hundred Han characters need a small share of them
    expect(FILM_TYPE.noto.subsets.length).toBeLessThan(30);
  });
});
