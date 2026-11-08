/**
 * Which files of the three fonts the film's strings need, and what each font must prove it covers
 * (pure: tested in fontPlan.test.ts, used by look/fonts.ts).
 *
 * Text is set in two stacks: sans = IBM Plex Sans, then Noto Sans SC; mono = JetBrains Mono, then
 * Noto Sans SC. The browser picks the face per character: a character whose code point lies in a
 * registered Plex (or Mono) file's unicode-range is drawn by Plex (Mono), everything else by Noto.
 * So the Latin of a zh line ("Router", "3–5", "23%") is drawn in Plex like the EN line, and an arrow
 * the Latin files lack (U+2192) in Noto. Each font's sample is exactly the characters it draws,
 * which is what the kit's useFont proves coverage of and loads before frame 0.
 *
 * Which strings are set in mono is the picture's choice, so every Latin character goes into both
 * the Plex and the Mono sample, and Noto takes every character that either of them lacks.
 */
import monoUnicode from '@fontsource-variable/jetbrains-mono/unicode.json';
import plexUnicode from '@fontsource-variable/ibm-plex-sans/unicode.json';
import notoUnicode from '@fontsource-variable/noto-sans-sc/unicode.json';
import { coversCodePoint, parseUnicodeRange, type CodeRange } from '@aiv/remotion-kit';
import { WORDS } from '../cues.ts';
import { PROBE_STRINGS } from '../lookdev/probeWords.ts';
import { planSlices } from './slices.ts';

/** The fontsource subsets the Latin faces may use (the wght-normal file of each). */
export const LATIN_SUBSETS = ['latin', 'latin-ext'] as const;
export type LatinSubset = (typeof LATIN_SUBSETS)[number];

export const PLEX_UNICODE: Readonly<Record<string, string>> = plexUnicode;
export const MONO_UNICODE: Readonly<Record<string, string>> = monoUnicode;
export const NOTO_UNICODE: Readonly<Record<string, string>> = notoUnicode;

/** Every string the film shows (each line of a multi-line string on its own), plus the probe's. */
export const FILM_STRINGS: readonly string[] = [
  ...Object.values(WORDS).flatMap((w: Readonly<Record<string, string>>) => Object.values(w)),
  ...PROBE_STRINGS,
].flatMap((s) => s.split('\n'));

export interface FacePlan {
  /** the fontsource subset keys to register, in unicode.json order */
  subsets: string[];
  /** every character this face draws (its useFont sample), spaces included */
  sample: string;
}

export interface TypePlan {
  plex: FacePlan;
  mono: FacePlan;
  noto: FacePlan & { missing: number[] };
}

const isSpace = (cp: number) => /\s/u.test(String.fromCodePoint(cp));
const sampleOf = (cps: readonly number[]) => String.fromCodePoint(...cps);

/** "U+2192 '→', …": code points as an error names them (at most 12). */
export const describeCodePoints = (cps: readonly number[]): string =>
  cps
    .slice(0, 12)
    .map((cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')} '${String.fromCodePoint(cp)}'`)
    .join(', ') + (cps.length > 12 ? ', …' : '');

function latinFace(unicode: Readonly<Record<string, string>>, cps: readonly number[]): { plan: FacePlan; covers: (cp: number) => boolean } {
  const ranges = new Map<LatinSubset, CodeRange[]>(LATIN_SUBSETS.map((k) => [k, parseUnicodeRange(unicode[k])]));
  const covers = (cp: number) => [...ranges.values()].some((r) => coversCodePoint(r, cp));
  const drawn = cps.filter(covers);
  const subsets = LATIN_SUBSETS.filter((k) => drawn.some((cp) => coversCodePoint(ranges.get(k)!, cp)));
  return { plan: { subsets, sample: sampleOf(drawn) }, covers };
}

/** The files and samples for a set of strings (line breaks are not characters). */
export function planType(strings: readonly string[]): TypePlan {
  const cps = [...new Set(strings.flatMap((s) => [...s.replace(/[\r\n]/g, '')].map((ch) => ch.codePointAt(0)!)))];
  const plex = latinFace(PLEX_UNICODE, cps);
  const mono = latinFace(MONO_UNICODE, cps);
  // Noto draws what a Latin face lacks; a space the Latin faces hold is theirs (they come first)
  const noto = cps.filter((cp) => !plex.covers(cp) || !mono.covers(cp));
  const slices = planSlices(NOTO_UNICODE, noto);
  return {
    plex: plex.plan,
    mono: mono.plan,
    noto: { subsets: slices.slices, sample: sampleOf(noto), missing: slices.missing.filter((cp) => !isSpace(cp)) },
  };
}

/** The plan for the film's strings (computed once, at module load). */
export const FILM_TYPE: TypePlan = planType(FILM_STRINGS);
