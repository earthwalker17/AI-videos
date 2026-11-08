import { describe, expect, it } from 'vitest';
import { CamPath } from './campath.ts';
import { screenBoxAt } from './project.ts';

describe('screenBoxAt', () => {
  it('matches a projection worked by hand', () => {
    // camera 10 units in front of the origin, vertical fov 90°: the half-height at the origin's
    // depth is 10 · tan 45° = 10 units over 540 px, so 54 px per unit, square pixels at 16:9
    const pose = { pos: [0, 0, 10] as const, look: [0, 0, 0] as const, fov: 90, focus: 10 };
    const box = screenBoxAt(
      pose,
      [
        [0, 0, 0],
        [1, 1, 0],
      ],
      1920,
      1080,
    );
    expect(box.left).toBeCloseTo(960, 9);
    expect(box.top).toBeCloseTo(486, 9);
    expect(box.width).toBeCloseTo(54, 9);
    expect(box.height).toBeCloseTo(54, 9);
    // a point twice as far is half as big (perspective), and below the axis is lower on screen
    const far = screenBoxAt(
      pose,
      [
        [0, 0, -10],
        [2, -2, -10],
      ],
      1920,
      1080,
    );
    expect(far).toEqual({ left: expect.closeTo(960, 9), top: expect.closeTo(540, 9), width: expect.closeTo(54, 9), height: expect.closeTo(54, 9) });
  });

  it('pins a box to the point it is given at every pose of a path (the aim lands at the centre)', () => {
    const path = new CamPath([
      { f: 0, pos: [0, 2, 12], look: [1, 1, 0], fov: 35, focus: 12 },
      { f: 48, pos: [6, 3, 6], look: [-1, 0.5, 0], fov: 25, focus: 7, hold: true },
    ]);
    for (const f of [0, 13, 30, 48]) {
      const p = path.at(f);
      const b = screenBoxAt(p, [p.look], 1280, 720);
      expect(b.left).toBeCloseTo(640, 6);
      expect(b.top).toBeCloseTo(360, 6);
      expect([b.width, b.height]).toEqual([0, 0]);
    }
  });
});
