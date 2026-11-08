import { describe, expect, it } from 'vitest';
import type { Pt } from '../kit/camera.tsx';
import { NOTCH_EDGE, TILE_NOTCHES, TRAIL_RECENCY, trailRoutes, trailStrokes } from './trail.ts';
import { HUB, ROUTER_R, SPRING, TILES, tileBox } from './world.ts';

/** Distance from a point to a segment. */
function toSegment(p: Pt, a: Pt, b: Pt): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Points every `step` along a polyline. */
function along(points: readonly Pt[], step = 4): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** How far a point is inside a tile's box (negative: outside). */
function inside(p: Pt, i: number): number {
  const b = tileBox(TILES[i]);
  return Math.min(p[0] - b.x, b.x + b.w - p[0], p[1] - b.y, b.y + b.h - p[1]);
}

/** Whether a point lies on a tile's outline (within a unit). */
const onEdge = (p: Pt, i: number) => Math.abs(inside(p, i)) < 1 + 1e-9;

describe('the switching trail', () => {
  const routes = trailRoutes();

  it('runs every path at 0, 45 or 90 degrees', () => {
    for (const r of routes)
      for (let i = 1; i < r.points.length; i++) {
        const h = (Math.atan2(r.points[i][1] - r.points[i - 1][1], r.points[i][0] - r.points[i - 1][0]) * 180) / Math.PI;
        expect(Math.abs(h % 45), `${r.id} run ${i}`).toBeLessThan(1e-9);
      }
  });

  it('joins tile to tile (and the spring to its nearest tiles), edge to edge, through no other tile', () => {
    for (const r of routes) {
      const ends = [r.points[0], r.points[r.points.length - 1]];
      if (r.kind === 'link') {
        expect(ends[0][0]).toBeGreaterThan(SPRING.x);
        expect(onEdge(ends[1], r.tiles[0])).toBe(true);
      } else {
        expect(onEdge(ends[0], r.tiles[0]), r.id).toBe(true);
        expect(onEdge(ends[1], r.tiles[1]), r.id).toBe(true);
      }
      for (const p of along(r.points))
        TILES.forEach((_, i) => {
          if (!r.tiles.includes(i)) expect(inside(p, i), `${r.id} enters tile ${i}`).toBeLessThan(-12);
        });
    }
  });

  it('crosses the middle without ending there: no path ends under the interchange ring, four pass beneath it', () => {
    let under = 0;
    for (const r of routes) {
      for (const end of [r.points[0], r.points[r.points.length - 1]]) expect(Math.hypot(end[0] - HUB[0], end[1] - HUB[1])).toBeGreaterThan(ROUTER_R + 20);
      const near = Math.min(...r.points.slice(1).map((p, i) => toSegment(HUB, r.points[i], p)));
      if (near < ROUTER_R) under++;
    }
    expect(under).toBe(4);
  });

  it('leaves the band under the ring free for your label (with the spread of a pass)', () => {
    // your label at 1.3x: about 137 px wide, set 30 px west of the hub, its ink and knockout 40 px over and 14 px under its baseline 162 px down
    const s = 1.3;
    const box = { x0: HUB[0] + (-30 - 74) / s, x1: HUB[0] + (-30 + 74) / s, y0: HUB[1] + (162 - 40) / s, y1: HUB[1] + (162 + 14) / s };
    for (const r of routes)
      for (const [x, y] of along(r.points)) {
        // a pass strays up to 12 units off its path
        const clear = x < box.x0 - 12 || x > box.x1 + 12 || y < box.y0 - 12 || y > box.y1 + 12;
        expect(clear, `${r.id} at ${x.toFixed(0)},${y.toFixed(0)}`).toBe(true);
      }
  });

  it('draws more and darker passes where you went more recently, the same every time', () => {
    const a = trailStrokes();
    expect(trailStrokes()).toEqual(a);
    for (const s of a) {
      expect(s.opacity).toBeGreaterThan(0);
      expect(s.opacity).toBeLessThanOrEqual(1);
      expect(s.points.length).toBeGreaterThan(2);
    }
    const passes = (recency: number[]) => trailStrokes(recency).length;
    expect(passes(TILES.map(() => 1))).toBeGreaterThan(passes(TILES.map(() => 0)));
    const dark = (id: string) => Math.max(...a.filter((s) => s.key.startsWith(`${id}-`)).map((s) => s.opacity));
    // the lit left-right cord reads darker than the fading top-bottom one
    expect(dark('cord-0')).toBeGreaterThan(dark('cord-2'));
  });

  it('cuts the waiting tally only on tiles you left, on the edge facing away from the hub', () => {
    TILES.forEach((t, i) => {
      if (TRAIL_RECENCY[i] >= 0.8) expect(TILE_NOTCHES[i]).toBe(0);
      const [dx, dy] = [t.at[0] - HUB[0], t.at[1] - HUB[1]];
      const away = { top: dy < 0, bottom: dy > 0, left: dx < 0, right: dx > 0 }[NOTCH_EDGE[i]];
      expect(away, `tile ${i}`).toBe(true);
    });
  });
});
