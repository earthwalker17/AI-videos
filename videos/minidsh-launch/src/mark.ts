/**
 * MiniDSH's mark, redrawn from its own geometry (MiniDSH docs/images/logo/minidsh-mark.svg, MIT):
 * a rounded ink tile, two white arches (the "m"), and a teal dot. The tile and the arches are a
 * canvas texture; the dot is drawn by the film itself so it can travel (the teal dot device).
 */
import type { Vec2 } from '@aiv/web-kit';

/** The mark's 24-unit viewBox: the tile is 22 units with radius 7; the dot sits at (17.75, 6.25), r 1.6. */
export const MARK_UNITS = 24;
export const DOT_AT: Vec2 = [17.75, 6.25];
export const DOT_R = 1.6;
const ARCHES = 'M6.5 16.5V9.5a2.5 2.5 0 0 1 5 0v7M11.5 9.5a2.5 2.5 0 0 1 5 0v7';

/** The tile and its arches, without the dot, at `px` pixels for the 24-unit box. */
export function drawMark(px = 512, withTile = true): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const u = px / MARK_UNITS;
  g.scale(u, u);
  if (withTile) {
    g.fillStyle = '#0f1115';
    g.beginPath();
    g.roundRect(1, 1, 22, 22, 7);
    g.fill();
    // a hairline lift on the tile's edge, so the ink tile reads on the ink ground
    g.strokeStyle = 'rgba(255,255,255,0.14)';
    g.lineWidth = 0.12;
    g.beginPath();
    g.roundRect(1.06, 1.06, 21.88, 21.88, 6.94);
    g.stroke();
  }
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke(new Path2D(ARCHES));
  return c;
}

/** Where the dot of a mark drawn at centre `c` with box size `size` (reference px) sits on screen. */
export function dotOf(c: Vec2, size: number): Vec2 {
  const u = size / MARK_UNITS;
  return [c[0] + (DOT_AT[0] - 12) * u, c[1] + (DOT_AT[1] - 12) * u];
}
