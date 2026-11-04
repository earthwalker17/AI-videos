import { describe, expect, it } from 'vitest';
import { at } from '../cues.ts';
import { FLOOR, groundHeight } from '../world/layout.ts';
import { CAMERA_OBSTACLES, HIDDEN_CUT, journeyAt } from './journey.ts';

describe('the V2 camera journey', () => {
  it('never passes through a prop or under the ground inside the world', () => {
    for (let f = at(5); f < HIDDEN_CUT; f++) {
      const [x, y, z] = journeyAt(f).pos;
      expect(y - (FLOOR + groundHeight(x, z)), `frame ${f}: height above the ground`).toBeGreaterThan(0.3);
      for (const o of CAMERA_OBSTACLES) {
        if (y > FLOOR + groundHeight(o.x, o.z) + o.h + 0.15) continue;
        expect(Math.hypot(x - o.x, z - o.z) - o.r, `frame ${f}: ${o.name}`).toBeGreaterThan(0.1);
      }
    }
  });

  it('moves smoothly: the push into the opening book stays gentle, the world moves slower still', () => {
    let prev = journeyAt(0);
    for (let f = 1; f < HIDDEN_CUT; f++) {
      const p = journeyAt(f);
      const step = Math.hypot(p.pos[0] - prev.pos[0], p.pos[1] - prev.pos[1], p.pos[2] - prev.pos[2]);
      expect(step, `frame ${f}`).toBeLessThan(f < at(5, 2) ? 0.48 : 0.35);
      prev = p;
    }
  });

  it('holds the hero view while the first caption is read', () => {
    const a = journeyAt(at(5, 2)).pos;
    const b = journeyAt(at(6, 3)).pos;
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(0.4);
  });
});
