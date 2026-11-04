import { describe, expect, it } from 'vitest';
import { distanceToPolyline } from '../kit/spline.ts';
import { FENCE_LINE, FENCE_LINE_RIGHT, fromHouse, DOOR_FRONT, GATE_POSTS, LAMPS, LAND, PATH, pathDistance, pathHalfWidth, STONES, STOPS } from './layout.ts';
import { GHOST_HOOKS } from './Trees.tsx';

const segmentsCross = (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[]) => {
  const o = (p: readonly number[], q: readonly number[], r: readonly number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
};

describe('the world map', () => {
  it('hangs the peeking ghost under the ghost tree’s hook nearest the shoo stop', () => {
    const [sx, sz] = PATH.pointAt(STOPS.shoo);
    const hook = [...GHOST_HOOKS].sort((a, b) => Math.hypot(a[0] - sx, a[2] - sz) - Math.hypot(b[0] - sx, b[2] - sz))[0];
    expect(Math.hypot(hook[0] - LAND.peek.x, hook[2] - LAND.peek.z)).toBeLessThan(0.05);
    // close enough that he looks up at it, not across the graveyard
    expect(Math.hypot(sx - LAND.peek.x, sz - LAND.peek.z)).toBeLessThan(0.6);
  });

  it('keeps the path clear: no stone, lamp or landmark on it', () => {
    for (const st of STONES) {
      const { d, s } = pathDistance(st.x, st.z);
      expect(d, `${st.kind} at ${st.x}, ${st.z}`).toBeGreaterThan(pathHalfWidth(s) + 0.12);
    }
    for (const l of LAMPS) expect(pathDistance(l.x, l.z).d).toBeGreaterThan(0.4);
    for (const k of ['cauldron', 'ripStone', 'oldTree', 'bigPumpkin', 'bigCross'] as const) expect(pathDistance(LAND[k].x, LAND[k].z).d, k).toBeGreaterThan(0.45);
  });

  it('crosses the fence only at the gates', () => {
    const line = PATH.polyline(400);
    for (const fence of [FENCE_LINE, FENCE_LINE_RIGHT])
      for (let i = 1; i < fence.length; i++) for (let j = 1; j < line.length; j++) expect(segmentsCross(fence[i - 1], fence[i], line[j - 1], line[j]), `fence ${i} × path ${j}`).toBe(false);
    // the gateway spans the path where the gates stand
    const g = PATH.pointAt(STOPS.gates + 0.32);
    for (const p of GATE_POSTS) expect(Math.hypot(p[0] - g[0], p[1] - g[1])).toBeCloseTo(0.42, 6);
  });

  it('keeps the fence out of the door yard', () => {
    const [x0, x1] = DOOR_FRONT.yard.x;
    const [z0, z1] = DOOR_FRONT.yard.z;
    const corners = [fromHouse([x0, 0, z0]), fromHouse([x1, 0, z0]), fromHouse([x1, 0, z1]), fromHouse([x0, 0, z1])].map((p) => [p[0], p[2]] as const);
    const yard = [...corners, corners[0]];
    const inside = (x: number, z: number) => {
      let c = false;
      for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
        const [xi, zi] = corners[i];
        const [xj, zj] = corners[j];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
      }
      return c;
    };
    for (const fence of [FENCE_LINE, FENCE_LINE_RIGHT])
      for (const p of fence) {
        expect(inside(p[0], p[1]), `fence point ${p[0]}, ${p[1]}`).toBe(false);
        expect(distanceToPolyline(p[0], p[1], yard).d, `fence point ${p[0]}, ${p[1]}`).toBeGreaterThan(0.3);
      }
  });
});
