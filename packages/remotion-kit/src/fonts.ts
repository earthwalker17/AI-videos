/**
 * Fonts registered with FontFace under family names no system font has ('AIV …'): if a file
 * failed to load, a fallback could not pass for it. Each hook holds the frame (delayRender) until
 * its faces are loaded and in document.fonts, so no frame is ever captured with a fallback face.
 *
 * Inter, from the pinned @fontsource-variable/inter package (SIL OFL 1.1), has its own loader
 * (useInter), kept exactly as the templates' frame hashes were made with. Any other font goes
 * through loadFont(spec) / useFont(spec), which also proves that the font covers every character
 * the film shows in it (fonts with unicode-range subsets, such as a CJK font, included).
 */
import interUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2';
import { useLayoutEffect, useRef, useState } from 'react';
import { useDelayRender } from 'remotion';
import { ALL_CODE_POINTS, describeCodePoint, parseUnicodeRange, planFont, sampleCodePoints } from './unicodeRange.ts';

export const INTER_FAMILY = 'AIV Inter';

/** CSS font-family value for Inter. */
export const INTER = `"${INTER_FAMILY}", sans-serif`;

let loading: Promise<void> | null = null;
let ready = false;

/** Load and register Inter once per page (every caller shares the promise). */
export function loadInter(): Promise<void> {
  loading ??= new FontFace(INTER_FAMILY, `url(${interUrl})`, { weight: '100 900', style: 'normal' })
    .load()
    .then((face) => {
      document.fonts.add(face);
      if (!document.fonts.check(`400 32px "${INTER_FAMILY}"`)) throw new Error(`${INTER_FAMILY} loaded but is not usable`);
      ready = true;
    });
  return loading;
}

/** Hold the current frame until Inter is ready; returns the font-family value. */
export function useInter(): string {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => (ready ? null : delayRender(`Loading ${INTER_FAMILY}`)));
  useLayoutEffect(() => {
    if (handle === null) return;
    loadInter().then(
      () => continueRender(handle),
      (e: unknown) => cancelRender(e instanceof Error ? e : new Error(String(e))),
    );
  }, [handle, continueRender, cancelRender]);
  return INTER;
}

/** One font file: the bundler URL of a pinned package file (Remotion: `import url from '…/x.woff2'`). */
export interface FontSource {
  url: string;
  /**
   * The CSS unicode-range the file covers (fontsource: the subset's entry in unicode.json). A
   * source WITHOUT one is trusted to cover every code point: the loader cannot look inside a font
   * file. So give each subset file its range, or a missing glyph passes the coverage check.
   */
  unicodeRange?: string;
  /** CSS font-weight descriptor, e.g. '400', or '200 900' for a variable font (default 'normal') */
  weight?: string;
  /** CSS font-style descriptor (default 'normal') */
  style?: string;
}

export interface FontSpec {
  /** registered as the FontFace family `AIV <family>` (letters, digits, spaces, '-' and '_') */
  family: string;
  sources: readonly FontSource[];
  /**
   * Every string the film shows in this font (titles, cards, captions, in every language). The
   * files whose range holds one of its characters are loaded, and the render fails unless each
   * non-whitespace character is covered by a source. Define the spec once, at module scope.
   */
  sample: string;
}

export interface FontState {
  /** CSS font-family value (`"AIV <family>"`), for style.fontFamily and canvas `ctx.font` */
  family: string;
  /** React state: false until the faces are loaded; a CanvasTexture redraws when it flips */
  ready: boolean;
}

function fontFamilyName(family: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(family)) throw new Error(`font family '${family}': use letters, digits, spaces, '-' or '_'`);
  return `AIV ${family}`;
}

const sourceKey = (s: FontSource) => [s.url, s.unicodeRange ?? null, s.weight ?? null, s.style ?? null];
const fontKey = (spec: FontSpec): string => JSON.stringify([spec.family, spec.sources.map(sourceKey), spec.sample]);

/** One FontFace per family and source, shared by every spec that names it (no duplicate faces). */
const fontFaces = new Map<string, FontFace>();
const fontLoads = new Map<string, Promise<string>>();
const fontsReady = new Set<string>();

function fontFace(name: string, s: FontSource): FontFace {
  const key = JSON.stringify([name, ...sourceKey(s)]);
  let face = fontFaces.get(key);
  if (!face) {
    face = new FontFace(name, `url(${JSON.stringify(s.url)})`, {
      ...(s.unicodeRange !== undefined ? { unicodeRange: s.unicodeRange } : {}),
      ...(s.weight !== undefined ? { weight: s.weight } : {}),
      ...(s.style !== undefined ? { style: s.style } : {}),
    });
    fontFaces.set(key, face);
    document.fonts.add(face);
  }
  return face;
}

async function loadFontOnce(spec: FontSpec): Promise<string> {
  const name = fontFamilyName(spec.family);
  const css = JSON.stringify(name);
  if (spec.sources.length === 0) throw new Error(`${name}: no font sources`);
  if (sampleCodePoints(spec.sample).length === 0) throw new Error(`${name}: the sample is empty; give it the film's on-screen strings`);
  const ranges = spec.sources.map((s) => (s.unicodeRange === undefined ? ALL_CODE_POINTS : parseUnicodeRange(s.unicodeRange)));
  const plan = planFont(ranges, spec.sample);
  if (plan.missing.length > 0) {
    const shown = plan.missing.slice(0, 12).map(describeCodePoint).join(', ');
    throw new Error(`${name} does not cover ${plan.missing.length} character(s) of its sample: ${shown}${plan.missing.length > 12 ? ', …' : ''}`);
  }
  // every source is registered with its range, so the browser picks the face per character; the
  // ones the sample needs are loaded now, before any frame is released
  const faces = spec.sources.map((s) => fontFace(name, s));
  await Promise.all(plan.load.map((i) => faces[i].load()));
  if (!document.fonts.check(`32px ${css}`, spec.sample)) throw new Error(`${name} loaded but is not usable for its sample`);
  return css;
}

/**
 * Register a font and load the files its sample needs, once per page (every caller of the same
 * spec shares the promise). Resolves to the CSS font-family value; rejects when a file fails to
 * load or the sample holds a character that no source covers.
 */
export function loadFont(spec: FontSpec): Promise<string> {
  const key = fontKey(spec);
  let p = fontLoads.get(key);
  if (!p) {
    p = loadFontOnce(spec).then((css) => {
      fontsReady.add(key);
      return css;
    });
    fontLoads.set(key, p);
  }
  return p;
}

/**
 * Hold the current frame until the font is loaded (a failed load cancels the render), like
 * useInter. `ready` is React state, and the hold is released only in the commit in which it
 * became true: a component that draws text into a CanvasTexture redraws in that same commit, so
 * the released frame never holds a fallback face. The spec may not change after the first render.
 *
 * The hold is taken at commit (a layout effect) and released on unmount, as @remotion/three's
 * ThreeCanvas does: a render React throws away (a Suspense sibling suspending on mount) runs no
 * effects, so it cannot leave a hold open that would fail the render on the delayRender timeout.
 * Layout effects run before Remotion captures the frame, so the hold is in place in time.
 */
export function useFont(spec: FontSpec): FontState {
  const key = fontKey(spec);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [first] = useState(() => ({ key, spec }));
  if (key !== first.key) throw new Error(`useFont(${spec.family}): the spec changed after the first render; define it once, at module scope`);
  const [ready, setReady] = useState(() => fontsReady.has(key));
  const hold = useRef<number | null>(null);
  useLayoutEffect(() => {
    // loaded between this render and its commit: nothing to wait for
    if (fontsReady.has(first.key)) {
      setReady(true);
      return;
    }
    hold.current = delayRender(`Loading ${fontFamilyName(first.spec.family)}`);
    loadFont(first.spec).then(
      () => setReady(true),
      (e: unknown) => cancelRender(e instanceof Error ? e : new Error(String(e))),
    );
    return () => {
      if (hold.current !== null) continueRender(hold.current);
      hold.current = null;
    };
  }, [first, delayRender, continueRender, cancelRender]);
  useLayoutEffect(() => {
    if (!ready || hold.current === null) return;
    continueRender(hold.current);
    hold.current = null;
  }, [ready, continueRender]);
  return { family: JSON.stringify(fontFamilyName(spec.family)), ready };
}
