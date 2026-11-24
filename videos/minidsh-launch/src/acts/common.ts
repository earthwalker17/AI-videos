/**
 * What every act draws with: the context a frame is drawn in, the titles, and small helpers.
 */
import { clamp } from '@aiv/core';
import type { Draw, StageTexture, Vec2 } from '@aiv/web-kit';
import type { CaptureKey } from '../captures.ts';
import { TEXT_IN, TEXT_OUT, TITLES, type Act, type Tier } from '../cues.ts';
import { TITLE_X, TITLE_Y, type Pal, type StyleId } from '../look.ts';

export interface Ctx {
  d: Draw<StyleId, Pal>;
  /** a capture this frame named in `needs` */
  tex: (k: CaptureKey) => StageTexture;
  /** the pointer (an arrow, 18 x 25 units, its tip 2 units in) */
  cursor: StageTexture;
  /** the terminal pane showing paint `k` (TUI_W x TUI_H canvas px) */
  term: (k: number) => StageTexture;
  /** MiniDSH's mark (tile and arches, no dot), 24 units square */
  mark: StageTexture;
}

/** One act: the captures a film frame needs, and how it draws. */
export interface ActModule {
  needs(f: number): CaptureKey[];
  draw(f: number, c: Ctx): void;
  /** film frames where the act cuts hard inside itself (motion blur never crosses them) */
  cuts?: readonly number[];
}

const TIER_STYLE: Record<Tier, StyleId> = { title: 'title', sub: 'sub', name: 'name', mono: 'mono', small: 'small' };

/** The act's scene titles (not the hook's line or the close card): upper-left zone, rising through their baseline. */
export function titles(f: number, d: Draw<StyleId, Pal>, act: Act): void {
  for (const t of TITLES) {
    if (t.act !== act || t.act === 'close' || t.id === 't-hook') continue;
    const enter = clamp((f - (t.frame - TEXT_IN)) / TEXT_IN);
    const exit = clamp((f - t.end) / TEXT_OUT);
    if (enter <= 0 || exit >= 1) continue;
    d.text(TIER_STYLE[t.tier], t.text, TITLE_X, TITLE_Y, { enter, exit });
  }
}

/** The pointer with its tip at `tip` (reference px), `scale` 1 = 58 px tall; `press` 0..1 shrinks it on a click. */
export function pointer(c: Ctx, tip: Vec2, press = 0, scale = 1): void {
  const unit = (58 / 25) * scale * (1 - 0.16 * clamp(press));
  const half: Vec2 = [9 * unit, 12.5 * unit];
  c.d.screenPane([tip[0] + half[0] - 2 * unit, tip[1] + half[1] - 2 * unit], half, c.cursor, { shadow: { offset: [0, 4], blur: 6, alpha: 0.35 } });
}

/** Screen point (reference px, y down) to world point at z = 0 for the film's straight-on camera. */
export const world = (p: Vec2): [number, number, number] => [p[0] - 960, 540 - p[1], 0];
