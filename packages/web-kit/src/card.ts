// SPDX-License-Identifier: MIT
// Promoted from videos/super-agent/src/kit (tag video/super-agent/v2), with that film's page card (src/card.ts, itself
// templates/web/src/card.ts's test card); the font family and the title are options.
/**
 * The test card: the leader's frames, drawn on the page's 2D output canvas, with the swatch strip
 * QA decodes from the delivered file (@aiv/core TEST_SWATCHES at swatchLayout). Sizes are fractions
 * of the frame height, so every profile draws the same picture.
 */
import { swatchCss, swatchLayout } from '@aiv/core';

export interface Frame {
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
}

export interface CardOptions {
  /** a family the page registered with FontFace (a name no system font has) */
  family: string;
  /** the subtitle's first part, before the size, the rate and the frame number */
  title: string;
}

/** The font shorthands the card draws with at 1080p: give them to the page contract's `fonts`. */
export const cardFonts = (family: string): string[] => [`650 72px "${family}"`, `400 34px "${family}"`];

export function drawTestCard(ctx: CanvasRenderingContext2D, i: number, f: Frame, o: CardOptions): void {
  const { width: w, height: h } = f;
  const u = h / 1080;
  const font = (weight: number, px: number) => `${weight} ${Math.round(px)}px "${o.family}"`;
  ctx.fillStyle = '#23272f';
  ctx.fillRect(0, 0, w, h);

  // crop marks: every corner must be visible in the delivered file
  ctx.strokeStyle = '#d8dce4';
  ctx.lineWidth = Math.max(1, Math.round(3 * u));
  const m = Math.round(24 * u);
  const l = Math.round(64 * u);
  for (const [x, y, dx, dy] of [
    [m, m, 1, 1],
    [w - m, m, -1, 1],
    [m, h - m, 1, -1],
    [w - m, h - m, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * l, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * l);
    ctx.stroke();
  }

  // a circle shows a wrong aspect ratio at a glance
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.3, h * 0.17, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#f2f4f8';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(650, 72 * u);
  ctx.fillText('Test card', w * 0.0625, h * 0.17);
  ctx.font = font(400, 34 * u);
  ctx.fillStyle = '#b9c0cc';
  ctx.fillText(`${o.title} · ${w}×${h} · ${f.fps} fps · frame ${i}`, w * 0.0625, h * 0.235);

  // grey ramp, 0 to 255 in 17 steps: banding or clipped ends show up here
  const steps = 17;
  const rx = Math.round(w * 0.0625);
  const rw = Math.floor((w * 0.6) / steps);
  for (let k = 0; k < steps; k++) {
    const v = Math.min(255, k * 16);
    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
    ctx.fillRect(rx + k * rw, Math.round(h * 0.42), rw, Math.round(h * 0.16));
  }

  // the swatch strip QA decodes from the final file (@aiv/core TEST_SWATCHES at swatchLayout)
  const strip = swatchLayout(w, h);
  ctx.font = font(500, 22 * u);
  ctx.fillStyle = '#d8dce4';
  for (const s of strip) {
    ctx.fillText(s.id, s.x, s.y - Math.round(12 * u));
    ctx.fillStyle = swatchCss(s.rgb);
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#d8dce4';
  }
}
