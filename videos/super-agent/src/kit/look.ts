/**
 * Look tokens: the palettes, the type scale and the finish. Sizes are in reference pixels (a
 * 1920x1080 frame); the stage scales them to the render size. Colours are written as sRGB hex and
 * used in linear light.
 */

export type Rgb = readonly [number, number, number];

const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** '#rrggbb' to linear RGB in [0, 1]. */
export function hex(h: string): Rgb {
  const n = Number.parseInt(h.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}

export const scale = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * A palette is five meanings, never five decorations:
 * - `bone`: structure and words. It never glows.
 * - `think`: a model inferring right now. The film's only glow besides `you`, so light reads as cost.
 * - `you`: the viewer's attention, and anything a person sent.
 * - `ash`: dropped, idle or finished.
 * - `ground`: the corner and the centre of the lit ground.
 */
export interface Palette {
  name: string;
  ground: readonly [Rgb, Rgb];
  bone: Rgb;
  think: Rgb;
  you: Rgb;
  ash: Rgb;
}

export const PALETTES = {
  /** the film's look: phosphor and coral on pitch */
  phosphor: { name: 'phosphor', ground: [hex('#0b0a0f'), hex('#211d2b')], bone: hex('#ede8dc'), think: hex('#6cf2a0'), you: hex('#ff8674'), ash: hex('#625e6c') },
  /** style-frame alternative: ultraviolet thought, volt attention */
  blacklight: { name: 'blacklight', ground: [hex('#0a0912'), hex('#1e1a33')], bone: hex('#e3e6f2'), think: hex('#9a6bff'), you: hex('#c8ff3e'), ash: hex('#5c5a70') },
  /** style-frame alternative: the classic neon pair */
  neon: { name: 'neon', ground: [hex('#07090f'), hex('#16202e')], bone: hex('#e8eef5'), think: hex('#35e0ff'), you: hex('#ff3d9a'), ash: hex('#56606c') },
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

/** Font families as the page registers them (names no system font has). */
export const FONT = {
  display: 'AIV Shoulders',
  text: 'AIV Plex',
  mono: 'AIV Plex Mono',
} as const;

export type StyleId = 'h1' | 'h2' | 'h3' | 'verdict' | 'sup' | 'stamp' | 'label' | 'num' | 'count';

export interface TypeStyle {
  family: string;
  weight: number;
  /** font size in reference px */
  px: number;
  /** extra advance per glyph, in em */
  tracking: number;
  /** line height as a multiple of px */
  leading: number;
  /** outline only, with this stroke in reference px (hollow numerals) */
  hollow?: number;
  /** the characters the atlas holds for this style */
  chars: string;
}

const CAPS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;?!\'’“”-–+%&×·~/()';
const ASCII = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~’“”–×·→';
const NUMS = '0123456789 .,~%×–-→s+';

/** Nothing meant to be read is under 52 px (docs/PRODUCTION.md's readable-text bar, either reading). */
export const STYLES: Record<StyleId, TypeStyle> = {
  h1: { family: FONT.display, weight: 800, px: 264, tracking: 0.005, leading: 0.86, chars: CAPS },
  h2: { family: FONT.display, weight: 800, px: 184, tracking: 0.008, leading: 0.88, chars: CAPS },
  h3: { family: FONT.display, weight: 700, px: 132, tracking: 0.012, leading: 0.9, chars: CAPS },
  verdict: { family: FONT.display, weight: 700, px: 120, tracking: 0.014, leading: 0.9, chars: CAPS },
  sup: { family: FONT.text, weight: 480, px: 62, tracking: 0, leading: 1.18, chars: ASCII },
  stamp: { family: FONT.mono, weight: 500, px: 52, tracking: 0.02, leading: 1.2, chars: ASCII },
  label: { family: FONT.mono, weight: 500, px: 52, tracking: 0.08, leading: 1.2, chars: ASCII },
  num: { family: FONT.display, weight: 800, px: 250, tracking: 0.012, leading: 0.9, hollow: 5, chars: NUMS },
  count: { family: FONT.display, weight: 700, px: 132, tracking: 0, leading: 0.9, chars: NUMS },
};

/** Finish: the numbers of the post chain, in one place. */
export const FINISH = {
  /** linear values above this bloom */
  bloomThreshold: 1.0,
  bloomStrength: 0.46,
  /** where the tone curve starts to roll off (below it, colours pass unchanged) */
  shoulder: 0.78,
  vignette: 0.42,
  /** static grain, in 8-bit code values at mid grey */
  grain: 1.6,
  /** the shutter as a fraction of a frame (0.5 is a 180° shutter) */
  shutter: 0.5,
} as const;
