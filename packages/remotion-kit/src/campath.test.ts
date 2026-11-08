import { describe, expect, it } from 'vitest';
import { CamPath, type CamKey } from './campath.ts';

// the first two cases are the frozen film's (videos/halloween-gift/src/film/motion.test.ts, at
// video/halloween-gift/v1), unchanged
describe('CamPath', () => {
  const keys: CamKey[] = [
    { f: 0, pos: [0, 1, 10], look: [0, 1, 0], fov: 30, focus: 10 },
    { f: 40, pos: [3, 2, 6], look: [0, 1, 0], fov: 34, focus: 6 },
    { f: 70, pos: [4, 1.5, 3], look: [1, 1, -1], fov: 34, focus: 4, hold: true },
    { f: 120, pos: [-2, 1, 2], look: [-1, 1, -2], fov: 30, focus: 3 },
  ];
  const path = new CamPath(keys);
  const v = (f: number) => {
    const a = path.at(f - 0.5).pos;
    const b = path.at(f + 0.5).pos;
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  };

  it('passes through every key at its frame', () => {
    for (const k of keys) {
      const p = path.at(k.f);
      for (let d = 0; d < 3; d++) {
        expect(p.pos[d]).toBeCloseTo(k.pos[d], 6);
        expect(p.look[d]).toBeCloseTo(k.look[d], 6);
      }
      expect(p.fov).toBeCloseTo(k.fov, 6);
    }
  });

  it('keeps moving through a pass-through key, stops at a hold', () => {
    expect(v(40)).toBeGreaterThan(0.02);
    // continuous speed across the key: no jump between just before and just after
    expect(Math.abs(v(39) - v(41)) / v(40)).toBeLessThan(0.2);
    expect(v(70) / v(40)).toBeLessThan(0.05);
  });

  // the distance moved in h frames from frame f: linear in h through a key passed at speed,
  // quadratic (twice h, four times the distance) out of a key the path eases out of
  const moved = (p: CamPath, f: number, h: number) => {
    const a = p.at(f).pos;
    const b = p.at(f + h).pos;
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  };

  it('holds at its first and last keys and clamps outside them', () => {
    for (const [f, h] of [
      [0, 0.25],
      [120, -0.25],
      [70, 0.25],
      [70, -0.25],
    ]) {
      expect(moved(path, f, 2 * h) / moved(path, f, h)).toBeGreaterThan(3.5);
      expect(moved(path, f, 2 * h) / moved(path, f, h)).toBeLessThan(4.5);
    }
    expect(moved(path, 40, 0.5) / moved(path, 40, 0.25)).toBeLessThan(2.5);
    expect(path.at(-10)).toEqual(path.at(0));
    expect(path.at(500)).toEqual(path.at(120));
    expect(path.at(-10).focus).toBe(10);
  });

  it('never runs backward: along a dolly with uneven keys the move is monotone, and eases into a hold', () => {
    const dolly = new CamPath([
      { f: 0, pos: [0, 1, 0], look: [0, 1, -10], fov: 40, focus: 5 },
      { f: 10, pos: [4, 1, 0], look: [4, 1, -10], fov: 40, focus: 5 },
      { f: 50, pos: [4.3, 1, 0], look: [4.3, 1, -10], fov: 36, focus: 4, hold: true },
      { f: 60, pos: [9, 1, 0], look: [9, 1, -10], fov: 30, focus: 3 },
    ]);
    let prev = dolly.at(0);
    for (let f = 0.25; f <= 60; f += 0.25) {
      const p = dolly.at(f);
      expect(p.pos[0]).toBeGreaterThanOrEqual(prev.pos[0] - 1e-9);
      // fov and focus follow the same monotone warp: no overshoot past their keys
      expect(p.fov).toBeLessThanOrEqual(prev.fov + 1e-9);
      expect(p.fov).toBeGreaterThanOrEqual(30 - 1e-9);
      prev = p;
    }
    // eased out of the hold at 50 on both sides, passed at speed through the key at 10
    for (const h of [0.25, -0.25]) expect(moved(dolly, 50, 2 * h) / moved(dolly, 50, h)).toBeGreaterThan(3.5);
    expect(moved(dolly, 10, 0.5) / moved(dolly, 10, 0.25)).toBeLessThan(2.5);
  });

  it('refuses fewer than two keys and keys out of order', () => {
    expect(() => new CamPath(keys.slice(0, 1))).toThrow(/two keys/);
    expect(() => new CamPath([keys[1], keys[0]])).toThrow(/out of order at 0/);
  });
});
