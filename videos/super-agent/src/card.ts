/**
 * The test card (frames [0, LEADER), the swatch strip QA measures), drawn on the page's 2D output
 * canvas. From templates/web; it leaves with the leader for the final.
 */
import { swatchCss, swatchLayout } from '@aiv/core';

/** The family the page registers with FontFace (a name no system font has, so a fallback cannot pass as it). */
export const FONT_FAMILY = 'AIV Plex';

export interface Frame {
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
}

const font = (weight: number, px: number) => `${weight} ${Math.round(px)}px "${FONT_FAMILY}"`;

export function drawTestCard(ctx: CanvasRenderingContext2D, i: number, f: Frame): void {
  const { width: w, height: h } = f;
  const u = h / 1080;
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
  ctx.fillText(`Who Routes the Agents? · ${w}×${h} · ${f.fps} fps · frame ${i}`, w * 0.0625, h * 0.235);

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
