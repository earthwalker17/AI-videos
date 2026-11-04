import { describe, expect, it } from 'vitest';
import { footfalls, WALKS } from '../../audio/timeline.ts';
import { at } from '../cues.ts';
import { FLOOR, groundHeight } from '../world/layout.ts';
import { clawdAt, KNOCK_SPOT, ROUTE, ROUTE_STOPS, userAt, WAIT_SPOT, WALK_FRAMES, WALK_TABLE } from './blocking.ts';
import { footfallsOf, hopsOf } from './gait.ts';

const angle = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('the V2 blocking', () => {
  it('walks exactly the score’s footfalls', () => {
    expect(WALK_FRAMES).toEqual(WALKS);
    expect(WALK_TABLE.flatMap((w) => footfallsOf(w))).toEqual(footfalls().map((x) => x.frame));
  });

  it('starts each walk where the last one ended, along one route', () => {
    for (let i = 1; i < 4; i++) expect(WALK_TABLE[i].s0).toBeCloseTo(WALK_TABLE[i - 1].s1, 9);
    expect(ROUTE_STOPS.knock).toBeCloseTo(ROUTE.length, 9);
    expect(ROUTE_STOPS.pop).toBe(0);
    expect(ROUTE_STOPS.valleyEnd).toBeLessThan(ROUTE_STOPS.shoo);
    expect(ROUTE_STOPS.shoo).toBeLessThan(ROUTE_STOPS.gates);
  });

  it('keeps every hop within the budget (≤ 0.55 units)', () => {
    for (const w of WALK_TABLE) for (const h of hopsOf(w)) expect(h.s1 - h.s0).toBeLessThanOrEqual(0.55);
  });

  it('never teleports or snaps round, from the pop-up to the exit', () => {
    let prev = clawdAt(at(7));
    for (let f = at(7) + 1; f < at(35); f++) {
      const c = clawdAt(f);
      expect(c.pose.visible).toBe(true);
      // a teleport shows across the ground; a hop down the lane's slope lands a little faster
      const [a, b] = [c.pose.pos, prev.pose.pos];
      expect(Math.hypot(a[0] - b[0], a[2] - b[2]), `frame ${f}`).toBeLessThan(0.1);
      expect(Math.abs(a[1] - b[1]), `frame ${f}`).toBeLessThan(0.12);
      expect(angle(c.pose.heading, prev.pose.heading), `frame ${f}`).toBeLessThan(0.32);
      prev = c;
    }
  });

  it('stands on the ground unless a hop lifts him', () => {
    for (let f = at(7) + 14; f < at(35); f++) {
      const { pose, hop } = clawdAt(f);
      const g = FLOOR + groundHeight(pose.pos[0], pose.pos[2]);
      expect(pose.pos[1] - g, `frame ${f}`).toBeCloseTo(hop ? hop.lift : 0, 6);
    }
  });

  it('knocks at V1’s knock spot and waits at V1’s wait spot', () => {
    const k = clawdAt(at(17, 2)).pose.pos;
    expect(Math.hypot(k[0] - KNOCK_SPOT[0], k[2] - KNOCK_SPOT[2])).toBeLessThan(1e-6);
    const w = clawdAt(at(21)).pose.pos;
    expect(Math.hypot(w[0] - WAIT_SPOT[0], w[2] - WAIT_SPOT[2])).toBeLessThan(1e-6);
  });

  it('brings the neighbour out of the door and back', () => {
    expect(userAt(at(19)).visible).toBe(false);
    expect(userAt(at(22)).visible).toBe(true);
    const a = userAt(at(20)).pos;
    const b = userAt(at(22)).pos;
    expect(dist(a, b)).toBeGreaterThan(0.2);
  });
});
