/**
 * The film's drawing choices that are not palette or type tokens (look/tokens.ts): the sketch
 * pen, the seed, and the looks of labels and notes from the tokens and the loaded fonts. Pure.
 */
import { smoothstep } from '@aiv/core';
import type { SketchOptions } from '../kit/sketch.ts';
import type { TextLook } from '../kit/text.tsx';
import type { FilmFonts } from '../look/fonts.ts';
import { C, DETAIL, STROKE, TYPE } from '../look/tokens.ts';

/** The film's one seed: every seeded shape takes it with its own id. */
export const SEED = 2202;

/** The sketch pen of act one, in world units (it zooms with the world, as drawn lines do). */
export const PEN = {
  /** a tile's outline */
  outline: { width: 3.2, taper: 0.03, pressure: 0.36, pressureScale: 70, wobble: 1.2, wobbleScale: 140, scribble: 0 },
  /** the faint lines inside a tile */
  inner: { width: 2.6, taper: 0.1, pressure: 0.3, wobble: 0.4, scribble: 0 },
  /** your switching trail */
  trail: { width: 3.4, taper: 0.16, pressure: 0.45, pressureScale: 70, wobble: 1.6, wobbleScale: 100, scribble: 0.3 },
  /** a tally notch on a waiting tile */
  notch: { width: 2.8, taper: 0.22, pressure: 0.15, wobble: 0.3, scribble: 0 },
  /** the open "?": the trail's hand, heavier (it is read at the map's far framings) */
  question: { width: 9, taper: 0.18, pressure: 0.5, pressureScale: 40, wobble: 1.8, wobbleScale: 90, scribble: 0.8 },
} as const satisfies Record<string, Omit<SketchOptions, 'seed' | 'id'>>;

/**
 * How much of the small glyphs (a Worker's tool row and step marker, your laptop) shows at a
 * camera scale: all of it from DETAIL.hideBelow up, none once the camera is a fade range further
 * out (look/tokens.ts DETAIL). Pure.
 */
export const detailOpacity = (scale: number): number => smoothstep(DETAIL.hideBelow - DETAIL.fadeRange, DETAIL.hideBelow, scale);

/** A label: Plex SemiBold 40 (Noto Medium for Han), ink, over a ground-colour knockout. */
export function labelLook(fonts: FilmFonts, knockout: string = C.ground) {
  return {
    family: fonts.sans,
    size: TYPE.label.size,
    weight: TYPE.label.weight,
    cjkWeight: TYPE.label.cjkWeight,
    color: C.ink,
    knockout: { color: knockout, width: STROKE.knockout },
  };
}

/** The notes block's two lines. */
export function notesLook(fonts: FilmFonts): { en: TextLook; zh: TextLook; tick: string } {
  return {
    en: { family: fonts.sans, weight: TYPE.notesEn.weight, size: TYPE.notesEn.size, color: C.ink, numeric: 'tabular-nums' },
    zh: { family: fonts.sans, weight: TYPE.notesZh.weight, size: TYPE.notesZh.size, color: C.zh },
    tick: C.ink,
  };
}
