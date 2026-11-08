/**
 * Your switching trail at the act-one hub (TREATMENT.md beat 2, Still 1): the paths your ring wore
 * between the session tiles, like a switchboard's patch cords. Each path runs from one tile to
 * another along transit-map runs (0/45/90 degrees, bends rounded), most of them across the middle
 * where you sit, a little off its centre, so that once the interchange ring closes over the middle
 * they pass under it from every side without pointing at one spot (no starburst). A few hops join
 * neighbours directly, and two paths carry events from the chat spring to the nearest tiles. The
 * paths are placed by hand with the tiles; the strokes along them are seeded, each one a pass of
 * the pen that starts and ends a little off the last. Pure: tested in trail.test.ts.
 */
import { clamp, rand } from '@aiv/core';
import type { Pt } from '../kit/camera.tsx';
import { octilinear, offsetRoute } from '../kit/diagram.tsx';
import { roundedPolyline } from '../kit/sketch.ts';
import { PEN, SEED } from './style.ts';
import { TILES } from './world.ts';

/** How recently you visited each tile at bar 10 (0..1): about four lit, the rest fading (Still 1). */
export const TRAIL_RECENCY: readonly number[] = [0.92, 0.3, 1, 0.38, 0.95, 0.88, 0.22, 0.3];
/** Waiting notches on each tile at f750: none on the lit ones, a tally on the ones you left waiting. */
export const TILE_NOTCHES: readonly number[] = [0, 3, 0, 4, 0, 0, 4, 3];
/** Which edge of each tile its notches are cut across: the one facing away from the hub, clear of every path. */
export const NOTCH_EDGE: readonly ('top' | 'bottom' | 'left' | 'right')[] = ['top', 'top', 'top', 'left', 'right', 'bottom', 'bottom', 'bottom'];

/** One worn path: what it joins and its runs. */
export interface TrailRoute {
  id: string;
  /** a cord across the middle, a hop between neighbours, or a link from the spring */
  kind: 'cord' | 'hop' | 'link';
  /** the tiles it joins (a link joins the spring to one tile) */
  tiles: readonly number[];
  /** the runs, at 0/45/90 degrees, from one tile's edge to another's (or from the spring) */
  points: readonly Pt[];
}

/**
 * The cords: tile to tile, from a point on one tile's edge to a point on another's. The first
 * four cross the middle up to 64 units off its centre (under the interchange ring), the last two
 * skirt it. None crosses the band under the ring where your label stands.
 */
const CORDS: readonly { tiles: [number, number]; from: Pt; to: Pt; diagonalFirst: boolean }[] = [
  { tiles: [3, 4], from: [709, 818], to: [1141, 818], diagonalFirst: false },
  { tiles: [0, 7], from: [742, 552], to: [1142, 952], diagonalFirst: false },
  { tiles: [1, 6], from: [976, 601], to: [976, 965], diagonalFirst: false },
  { tiles: [2, 5], from: [1104, 556], to: [707, 953], diagonalFirst: false },
  { tiles: [1, 3], from: [890, 590], to: [680, 761], diagonalFirst: false },
  { tiles: [4, 6], from: [1160, 872], to: [1043, 1000], diagonalFirst: false },
];

/** Hops from tile to tile that skip the middle: straight across the gap between two neighbours. */
const HOPS: readonly { tiles: [number, number]; points: [Pt, Pt] }[] = [
  { tiles: [0, 1], points: [[742, 562], [890, 562]] },
  { tiles: [3, 5], points: [[690, 855], [690, 953]] },
  { tiles: [4, 7], points: [[1210, 872], [1210, 952]] },
];

/** The spring's paths to the two tiles nearest it: you carrying events into sessions. */
const LINKS: readonly { tile: number; points: [Pt, Pt] }[] = [
  { tile: 0, points: [[494, 600], [610, 600]] },
  { tile: 3, points: [[442, 818], [591, 818]] },
];

/** Every worn path at the hub. */
export function trailRoutes(): TrailRoute[] {
  return [
    ...CORDS.map((c, k) => ({ id: `cord-${k}`, kind: 'cord' as const, tiles: c.tiles, points: octilinear(c.from, c.to, c.diagonalFirst) })),
    ...HOPS.map((h, k) => ({ id: `hop-${k}`, kind: 'hop' as const, tiles: h.tiles, points: h.points })),
    ...LINKS.map((l, k) => ({ id: `link-${k}`, kind: 'link' as const, tiles: [l.tile], points: l.points })),
  ];
}

/** One sketch stroke of the trail, ready for sketchPasses. */
export interface TrailStroke {
  key: string;
  /** dense points along the route (bends rounded) */
  points: Pt[];
  width: number;
  opacity: number;
}

/** A point `d` along the run from `a` towards `b`. */
const towards = (a: Pt, b: Pt, d: number): Pt => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [a[0] + ((b[0] - a[0]) * d) / len, a[1] + ((b[1] - a[1]) * d) / len];
};

/**
 * The strokes along every path: one to three passes per path, more and darker where you went more
 * recently. Each pass runs a few units off the path, setting down and lifting a little off the
 * tiles' edges, and rounds the bends with its own radius. Where a cord crosses the middle, the
 * interchange ring's clear zone hides it.
 */
export function trailStrokes(recency: readonly number[] = TRAIL_RECENCY): TrailStroke[] {
  const out: TrailStroke[] = [];
  for (const route of trailRoutes()) {
    const s = Math.max(...route.tiles.map((t) => clamp(recency[t] ?? 0)));
    const count = route.kind === 'cord' ? 2 + Math.round(2.4 * s) : route.kind === 'hop' ? 1 + Math.round(s) : 2;
    const spread = route.kind === 'cord' ? 12 : 8;
    for (let k = 0; k < count; k++) {
      const r = (n: number) => rand(SEED, `${route.id}-${k}`, n);
      // each pass sets down and lifts a few units to one side of the path, its own sides at each end,
      // so the passes of one path cross and part as a hand's do
      const o0 = Math.round((r(0) - 0.5) * 2 * spread);
      const o1 = Math.round((r(6) - 0.5) * 2 * spread);
      const a = offsetRoute(route.points, o0, 0).points;
      const b = offsetRoute(route.points, o1, 0).points;
      const n = route.points.length - 1;
      const pts = a.map((p, i) => [p[0] + ((b[i][0] - p[0]) * i) / n, p[1] + ((b[i][1] - p[1]) * i) / n] as Pt);
      // the pen sets down 4-14 units off the first tile's edge and lifts as far before the other
      pts[0] = towards(pts[0], pts[1], 4 + 10 * r(1));
      pts[n] = towards(pts[n], pts[n - 1], 4 + 10 * r(2));
      // a long run bows a little, as a hand's line does: its middle pushed up to 1.5% of its length aside
      for (let i = n; i >= 1; i--) {
        const [p, q] = [pts[i - 1], pts[i]];
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (len < 160) continue;
        const bow = (r(10 + i) - 0.5) * 0.03 * len;
        pts.splice(i, 0, [(p[0] + q[0]) / 2 + ((q[1] - p[1]) / len) * bow, (p[1] + q[1]) / 2 - ((q[0] - p[0]) / len) * bow]);
      }
      const dense = roundedPolyline(pts, 18 + 22 * r(3), 16);
      const width = PEN.trail.width * (0.7 + 0.5 * r(4));
      const base = route.kind === 'link' ? 0.55 : 0.34 + 0.6 * s;
      out.push({ key: `${route.id}-${k}`, points: dense, width, opacity: base * (0.8 + 0.2 * r(5)) });
    }
  }
  return out;
}

/** The tile boxes the trail must not enter (each outline and a little round it). */
export function tileKeepOut(pad = 2): { x: number; y: number; w: number; h: number }[] {
  return TILES.map((t) => ({ x: t.at[0] - t.w / 2 - pad, y: t.at[1] - t.h / 2 - pad, w: t.w + 2 * pad, h: t.h + 2 * pad }));
}
