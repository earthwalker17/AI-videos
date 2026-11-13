/**
 * The look of "dark ink map" (TREATMENT.md, Art direction) as numbers: the palette with each
 * colour's one role, the type scale, stroke weights, the safe areas and the notes block. Sizes are
 * px at 1080p (composition px: the draft profile renders them at half size). These are the
 * treatment's starting values; the lookdev stills prove or change them, here and only here.
 */

/** One palette entry: the colour and the single thing it means. */
export interface Swatch {
  hex: string;
  role: string;
}

/** Nothing else is used. Contrast ratios are against the ground (TREATMENT.md). */
export const PALETTE = {
  ground: { hex: '#202226', role: 'the flat ground; the centre may lift, the corners never darken (BT.709 limited luma 45.1, above QA black 37.9)' },
  panel: { hex: '#282A2F', role: 'panels: the title cartouche, the timetable' },
  dot: { hex: '#2E3035', role: 'the dot grid: 2.5 px dots at a 96 world-unit pitch, faded out below 0.7x' },
  ink: { hex: '#E8E6E0', role: 'ink: built structure and EN text (12.8:1)' },
  zh: { hex: '#B9B7B1', role: 'the zh line (7.9:1)' },
  sketch: { hex: '#75736D', role: 'sketch: act one, chart rails, open items; ghosts at 12% (3.4:1)' },
  pill: { hex: '#3B3D42', role: 'message pill fill (outline and dashes in the sketch tone)' },
  receded: { hex: '#55575C', role: 'Workers once stepped down to "implementation detail"' },
  vermilion: { hex: '#E8603F', role: 'only the one request, its route, its thread and its follow-up; never text (L* 58)' },
  green: { hex: '#8FD3A8', role: 'only your sign-off and the return route, a cased line (L* 79)' },
} as const satisfies Record<string, Swatch>;

export type PaletteName = keyof typeof PALETTE;

/** The hex of every palette entry, for style props. */
export const C = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, v.hex])) as { readonly [K in PaletteName]: string };

/** Opacity of an erased sketch line's ghost. */
export const GHOST_OPACITY = 0.12;
/**
 * The rest's step-down (TREATMENT.md beat 8): everything on the map but your ring and the replies
 * you stamped steps down to this opacity, so the one bright thing left is you and your sign-off.
 */
export const STEP_DOWN = 0.7;

/** One text style: the face (resolved by look/fonts.ts), weight and size in px at 1080p. */
export interface TypeStyle {
  face: 'sans' | 'mono';
  weight: number;
  size: number;
  /** a second weight for the Han runs of a mixed line (the Latin runs take `weight`) */
  cjkWeight?: number;
}

/** The type scale (TREATMENT.md, Type). The sans stack is Plex Sans, then Noto Sans SC for Han. */
export const TYPE = {
  notesEn: { face: 'sans', weight: 500, size: 48 },
  notesZh: { face: 'sans', weight: 400, size: 40 },
  label: { face: 'sans', weight: 600, size: 40, cjkWeight: 500 },
  numbers: { face: 'mono', weight: 500, size: 44 },
  titleEn: { face: 'sans', weight: 600, size: 88 },
  titleZh: { face: 'sans', weight: 500, size: 64 },
  sublineEn: { face: 'sans', weight: 500, size: 40 },
  sublineZh: { face: 'sans', weight: 400, size: 40 },
  endEn: { face: 'sans', weight: 400, size: 40 },
  endZh: { face: 'sans', weight: 400, size: 38 },
} as const satisfies Record<string, TypeStyle>;

/** Text is never smaller than this (1/30 of the frame height, docs/PRODUCTION.md). */
export const MIN_TEXT_PX = 36;
/**
 * Nor larger than this. At 1080p the probe's 200 px Plex SemiBold DOM line differed by up to 2 code
 * values on a few hundred pixels between a fresh page and one 30 frames into a chunk, while its
 * 160 px Noto Sans SC Medium line and everything else stayed bit-exact. The kit's canvas tests
 * (packages/remotion-kit README.md, Canvas text) found GPU-rastered glyphs varying from page to page
 * from 166 px at weight 600, and never up to 136 px; no other DOM size or weight above 136 px has
 * been measured. The film's largest type is 88 px.
 */
export const MAX_TEXT_PX = 136;

/** Stroke weights in screen px at 1080p (non-scaling strokes keep them at every zoom). */
export const STROKE = {
  /** the trunk: 6 px ink, 24 px corner radii, round caps */
  trunk: 6,
  trunkRadius: 24,
  /** branch lines: 4 px, never thinner than 3 px on screen */
  branch: 4,
  branchMin: 3,
  /** your ring: 40 px across, 3 px stroke (lookdev: 2.5 rastered as 2 px in one still and 3 px in another) */
  you: 3,
  youRadius: 20,
  /**
   * the Router: a 160 px interchange ring with an 8 px stroke (the heaviest line, the one focal
   * node: lookdev showed a 6 px ring weighing the same as the trunk) and a 2 px thinking arc
   */
  router: 8,
  routerRadius: 80,
  thinkingArc: 2,
  /** the vermilion subscription hairline, the emphasis ring */
  hairline: 2,
  /** a Worker platform's outline: lighter than its branch, so the Router outweighs the Workers */
  platform: 3,
  /**
   * a cased line (the return route): two rails of this width with a ground-colour gap between. The
   * rails are 3 px, as thin as any line may be on screen (lookdev: 2 px rails failed the 3 px test,
   * and under deuteranopia only the casing tells the return from the ink); their ink, 6 px, is the
   * trunk's
   */
  casedRail: 3,
  casedGap: 2,
  /** proposed parts: 3 px dashed ink, 14 on / 10 off */
  proposed: 3,
  proposedDash: [14, 10] as const,
  /** risk: 45 degree hatching, 2 px strokes at an 8 px pitch */
  hatch: 2,
  hatchPitch: 8,
  /** the ground-colour knockout under a label, drawn as a stroke this wide on each side */
  knockout: 4,
  /** nothing finer than this at 1080p: the draft profile halves it */
  min: 2,
} as const;

/** The frame and its safe areas (SMPTE ST 2046-1 title-safe at 90%: an inset of 96 x 54 px). */
export const FRAME = { width: 1920, height: 1080 } as const;
export const SAFE = { x: 96, y: 54, right: 1920 - 96, bottom: 1080 - 54 } as const;
/** While a note is up, diagram action stays in this band; rests may use the full frame. */
export const DIAGRAM_BAND = { top: 72, bottom: 868 } as const;
/** Composition sits on a 48 px base grid; the active node on a third. */
export const BASE_GRID = 48;
export const THIRDS = [640, 1280] as const;

/**
 * The lower-left notes block: one EN line behind an ink station tick. It was EN over zh until the
 * zh captions were dropped on 2026-11-13 (desk/Overlay.tsx); the EN line kept its baseline, and the
 * tick, which spanned both lines (96 px), now spans the EN line's ink, cap top to descender.
 */
export const NOTES = {
  /** the ink tick: 4 x 46 px at x 100, spanning the EN line */
  tick: { x: 100, width: 4, top: 903, height: 46 },
  /** where the lines start */
  x: 124,
  enBaseline: 938,
  /** the zh line's baseline in a bilingual block (the retired round-1 lookdev scenes still draw one) */
  zhBaseline: 992,
  /** the widest a line may be; a wider line fails the render */
  maxWidth: 1560,
} as const;

/** The route-map world under the camera, in world units (TREATMENT.md, World layout). */
export const WORLD = { width: 3840, height: 2160 } as const;
export const ZOOM = { min: 0.5, max: 1.7 } as const;
export const DOT_GRID = { pitch: 96, diameter: 2.5, fadeBelow: 0.7 } as const;
/**
 * Level of detail: glyphs too small to read when the camera is far out (a Worker's tool row and
 * step marker, your laptop, the beetle's legs) fade out between these scales, as the dot grid
 * does; nothing else does. The map's far framings (beat 7 and the rest, 0.6x) keep them.
 */
export const DETAIL = { hideBelow: 0.6, fadeRange: 0.04 } as const;

/** Motion grammar (TREATMENT.md): speeds in screen px per second, durations in frames. */
export const MOTION = {
  /** ink travels along its path at about this speed, with a 4-frame ease in and a 6-frame ease out */
  inkSpeed: 1000,
  inkEaseIn: 4,
  inkEaseOut: 6,
  /** camera moves stay under about this speed on screen */
  cameraMaxSpeed: 600,
  /** the emphasis ring expands and fades over this many frames */
  emphasis: 16,
} as const;
