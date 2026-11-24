/**
 * The look of "MiniDSH 2.0: One Runtime, Every Surface": paper on ink. MiniDSH's own dark ink,
 * lit, as the stage; the product's real UI panes are the brightest things on screen. Teal (the
 * mark's dot) and amber (the product's approval colour) are rationed. Type is IBM Plex Sans for
 * titles and Plex Mono for commands and receipts.
 */
import { CHARS, hex, type Finish, type GroundOptions, type ImageShadow, type Pose, type StyleTable } from '@aiv/web-kit';

export const SANS = 'AIV Plex Sans';
export const MONO = 'AIV Plex Mono';

/** Text a viewer must read is at least 36 px (font size) at 1080p: the creator's choice, 2026-11-24. */
export const STYLES = {
  title: { family: SANS, weight: 600, px: 88, tracking: -0.018, leading: 1.14, chars: CHARS.ascii },
  sub: { family: SANS, weight: 500, px: 46, tracking: -0.006, leading: 1.25, chars: CHARS.ascii },
  name: { family: SANS, weight: 600, px: 128, tracking: -0.022, leading: 1.0, chars: CHARS.ascii },
  mono: { family: MONO, weight: 500, px: 40, tracking: 0, leading: 1.3, chars: CHARS.ascii },
  small: { family: SANS, weight: 400, px: 36, tracking: 0, leading: 1.32, chars: CHARS.ascii },
  /** print used as texture (module names on the runtime strips): at least 18 px */
  label: { family: MONO, weight: 500, px: 26, tracking: 0.01, leading: 1.25, chars: CHARS.ascii },
  url: { family: SANS, weight: 500, px: 26, tracking: 0, leading: 1.2, chars: CHARS.ascii },
  /** the payoff table (the test's own data), large */
  table: { family: MONO, weight: 500, px: 66, tracking: 0, leading: 1.36, chars: CHARS.ascii },
} satisfies StyleTable<'title' | 'sub' | 'name' | 'mono' | 'small' | 'label' | 'url' | 'table'>;
export type StyleId = keyof typeof STYLES;

/** Linear colours. */
export const PAL = {
  /** type on ink */
  ink: hex('#eef0f4'),
  dim: hex('#9aa3b2'),
  faint: hex('#5d6573'),
  /** MiniDSH's mark: ground, stroke, dot */
  markGround: hex('#0f1115'),
  markStroke: hex('#ffffff'),
  teal: hex('#3cc2b0'),
  /** the product's approval amber */
  amber: hex('#f59e0b'),
  /** browser frame and pane chrome on ink */
  chrome: hex('#1b1e24'),
  chromeLine: hex('#2a2f38'),
  /** the terminal pane */
  term: hex('#15181d'),
  /** receipt stock (the runtime strips) */
  paper: hex('#f1eee6'),
  paperInk: hex('#1a1c20'),
};
export type Pal = typeof PAL;

/** Lit ink: a soft key pool behind the hero, falling to the corners; kept above QA's black level. */
export const GROUND: GroundOptions = { colours: [hex('#0b0d10'), hex('#272c35')], centre: [1180, 600], radius: [1300, 820] };

/** The finish: a light hand. Panes bypass the shoulder and the vignette (display-referred). */
export const FINISH: Finish = { bloomThreshold: 1.0, bloomStrength: 0.22, shoulder: 0.86, vignette: 0.3, grain: 1.1, displayGrain: 0 };

/** Looking straight at the origin: one world unit is one reference px at z = 0 (x right, y up). */
export const POSE: Pose = { target: [0, 0, 0], tilt: 0, yaw: 0, dist: 1 };

/** A pane's shadow on the ink: long and soft, tinted by the ground rather than black. */
export const SHADOW: ImageShadow = { offset: [0, 30], blur: 42, alpha: 0.62, spread: -8 };
export const SHADOW_NEAR: ImageShadow = { offset: [0, 14], blur: 22, alpha: 0.5, spread: -4 };

/** The title zone: upper left, panes biased right and low. */
export const TITLE_X = 128;
export const TITLE_Y = 190;

/**
 * The web UI's theme in the panes: light ("paper on ink", the default) or dark. A lookdev entry
 * (src/lookdev/dark.html) sets it before the film loads, so it is a constant of the render.
 */
export const THEME: 'light' | 'dark' = (globalThis as { AIV_THEME?: string }).AIV_THEME === 'dark' ? 'dark' : 'light';
