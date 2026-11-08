/**
 * The film's three fonts, all OFL from pinned packages (CREDITS.md), loaded through the kit's
 * useFont: each frame is held until the faces are in, and the render fails if a face lacks a
 * character the film shows in it. Which files each font registers, and what it must cover, is
 * planned from the film's strings in look/fontPlan.ts:
 * - IBM Plex Sans (variable, wght 100-700): EN text, labels, the Latin of zh lines;
 * - Noto Sans SC (variable, wght 100-900): Han, CJK punctuation and what the Latin files lack;
 *   only the unicode-range slices the strings touch are registered;
 * - JetBrains Mono (variable, wght 100-800): numbers.
 * The families are listed without a generic fallback: a character no registered file covers would
 * render in the browser's default serif, which no frame can mistake for the film's type.
 */
import monoLatinExt from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-ext-wght-normal.woff2';
import monoLatin from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2';
import plexLatinExt from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-ext-wght-normal.woff2';
import plexLatin from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2';
import { useFont, type FontSource, type FontSpec } from '@aiv/remotion-kit';
import { useMemo } from 'react';
import { describeCodePoints, FILM_TYPE, MONO_UNICODE, NOTO_UNICODE, PLEX_UNICODE, type FacePlan, type LatinSubset } from './fontPlan.ts';
import { NOTO_SC_FILES } from './notoSlices.ts';

const PLEX_FILES: Record<LatinSubset, string> = { latin: plexLatin, 'latin-ext': plexLatinExt };
const MONO_FILES: Record<LatinSubset, string> = { latin: monoLatin, 'latin-ext': monoLatinExt };

function sources(plan: FacePlan, files: Readonly<Record<string, string>>, unicode: Readonly<Record<string, string>>, weight: string): FontSource[] {
  return plan.subsets.map((k) => {
    const url = files[k];
    if (url === undefined) throw new Error(`no font file for subset '${k}'`);
    return { url, unicodeRange: unicode[k], weight };
  });
}

if (FILM_TYPE.noto.missing.length > 0) throw new Error(`Noto Sans SC has no file for ${describeCodePoints(FILM_TYPE.noto.missing)}`);

export const PLEX: FontSpec = { family: 'IBM Plex Sans', sources: sources(FILM_TYPE.plex, PLEX_FILES, PLEX_UNICODE, '100 700'), sample: FILM_TYPE.plex.sample };
export const MONO: FontSpec = { family: 'JetBrains Mono', sources: sources(FILM_TYPE.mono, MONO_FILES, MONO_UNICODE, '100 800'), sample: FILM_TYPE.mono.sample };
export const NOTO_SC: FontSpec = { family: 'Noto Sans SC', sources: sources(FILM_TYPE.noto, NOTO_SC_FILES, NOTO_UNICODE, '100 900'), sample: FILM_TYPE.noto.sample };

/** CSS font-family values: the sans stack (EN, zh, labels) and the mono stack (numbers). */
export interface FilmFonts {
  sans: string;
  mono: string;
}

/**
 * Load every face the film uses; `ready` (React state) is true once all are in, and the frame is
 * held until then. Measure text (the notes block's width check) only once it is true.
 */
export function useFilmFonts(): { fonts: FilmFonts; ready: boolean } {
  const plex = useFont(PLEX);
  const mono = useFont(MONO);
  const noto = useFont(NOTO_SC);
  const fonts = useMemo(() => ({ sans: `${plex.family}, ${noto.family}`, mono: `${mono.family}, ${noto.family}` }), [plex.family, mono.family, noto.family]);
  return { fonts, ready: plex.ready && mono.ready && noto.ready };
}
