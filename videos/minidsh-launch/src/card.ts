/**
 * The 2D layers: the test card (frames [0, cardFrames), the swatch strip QA measures) and the
 * title overlay on top of the 3D frames. Sizes are fractions of the frame height so every
 * profile draws the same picture.
 */
import { progress, swatchCss, swatchLayout } from '@aiv/core';

/** The family the page registers with FontFace (a name no system font has, so a fallback cannot pass as it). */
export const FONT_FAMILY = 'AIV Inter';

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
  ctx.fillText(`AI-videos · web engine template · ${w}×${h} · ${f.fps} fps · frame ${i}`, w * 0.0625, h * 0.235);

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

export function drawOverlay(ctx: CanvasRenderingContext2D, i: number, f: Frame, sceneStart: number): void {
  const { width: w, height: h } = f;
  const u = h / 1080;
  const t = progress(i, sceneStart + 6, sceneStart + 30, 'outCubic');
  ctx.save();
  // a soft shade under the title keeps it legible over bright shapes
  const shade = ctx.createLinearGradient(0, 0, 0, h * 0.42);
  shade.addColorStop(0, `rgba(8, 12, 22, ${(0.62 * t).toFixed(3)})`);
  shade.addColorStop(1, 'rgba(8, 12, 22, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, Math.ceil(h * 0.42));
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 18 * u;
  ctx.globalAlpha = t;
  ctx.fillStyle = '#f6f1e7';
  ctx.font = font(700, 96 * u);
  ctx.fillText('Made with code', w * 0.0625, h * 0.2 + (1 - t) * 24 * u);
  ctx.globalAlpha = progress(i, sceneStart + 18, sceneStart + 42, 'outCubic');
  ctx.fillStyle = '#c9d3e6';
  ctx.font = font(400, 38 * u);
  ctx.fillText('three.js WebGL · Canvas 2D · one frame = one index', w * 0.0625, h * 0.27);
  ctx.restore();

  // time: a hairline progress bar and the frame number (both a pure function of i)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(0, h - Math.round(6 * u), w, Math.round(6 * u));
  ctx.fillStyle = '#ffb547';
  ctx.fillRect(0, h - Math.round(6 * u), Math.round((w * (i + 1)) / f.durationFrames), Math.round(6 * u));
  ctx.font = font(500, 26 * u);
  ctx.textAlign = 'right';
  const label = `frame ${String(i).padStart(3, '0')} · ${(i / f.fps).toFixed(2)} s`;
  const x = w - w * 0.0625;
  const y = h - Math.round(36 * u);
  const pad = Math.round(12 * u);
  const lw = ctx.measureText(label).width;
  // a backing pill: the counter stays readable over any shape that passes behind it
  ctx.fillStyle = 'rgba(8, 12, 22, 0.55)';
  ctx.beginPath();
  ctx.roundRect(x - lw - pad, y - Math.round(26 * u), lw + 2 * pad, Math.round(38 * u), Math.round(19 * u));
  ctx.fill();
  ctx.fillStyle = '#c9d3e6';
  ctx.fillText(label, x, y);
  ctx.textAlign = 'left';
}
