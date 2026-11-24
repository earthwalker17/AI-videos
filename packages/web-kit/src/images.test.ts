// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { MAX_RESIDENT, mipLevels, planResidency, textureBytes } from './images.ts';

describe('planResidency', () => {
  it('loads what is missing while there is room', () => {
    expect(planResidency([], ['a'], 4)).toEqual({ evict: [], load: ['a'], order: ['a'] });
    expect(planResidency(['a'], ['a', 'b'], 4)).toEqual({ evict: [], load: ['b'], order: ['a', 'b'] });
  });

  it('evicts the least recently needed texture the frame does not need', () => {
    // a is the oldest, but the frame needs it: b goes
    expect(planResidency(['a', 'b', 'c'], ['a', 'd'], 3)).toEqual({ evict: ['b'], load: ['d'], order: ['c', 'a', 'd'] });
  });

  it('evicts nothing when everything needed is resident', () => {
    expect(planResidency(['a', 'b'], ['b'], 2)).toEqual({ evict: [], load: [], order: ['a', 'b'] });
  });

  it('with a cap of one, swaps on every change', () => {
    expect(planResidency(['web'], ['approval'], 1)).toEqual({ evict: ['web'], load: ['approval'], order: ['approval'] });
    expect(planResidency(['approval'], ['web'], 1)).toEqual({ evict: ['approval'], load: ['web'], order: ['web'] });
  });

  it('refuses a frame that needs more than the cap', () => {
    expect(() => planResidency([], ['a', 'b'], 1)).toThrow(/at most 1/);
  });

  it('ignores a key named twice', () => {
    expect(planResidency([], ['a', 'a'], 1)).toEqual({ evict: [], load: ['a'], order: ['a'] });
  });

  it('never holds more than the cap, over any sequence', () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f'];
    let resident: string[] = [];
    for (let i = 0; i < 200; i++) {
      // a deterministic walk over frames that need one to three images
      const need = keys.filter((_, k) => (i * 7 + k * 3) % 5 < 2).slice(0, 3);
      const plan = planResidency(resident, need, MAX_RESIDENT);
      for (const k of need) expect(plan.order).toContain(k);
      expect(plan.order.length).toBeLessThanOrEqual(MAX_RESIDENT);
      for (const k of plan.evict) expect(need).not.toContain(k);
      resident = plan.order;
    }
  });
});

describe('texture memory', () => {
  it('counts a full mip chain', () => {
    expect(mipLevels(2560, 1600)).toBe(12);
    expect(mipLevels(3840, 2400)).toBe(12);
    expect(mipLevels(1, 1)).toBe(1);
    expect(textureBytes(1, 1)).toBe(4);
    expect(textureBytes(2, 2)).toBe(20);
    // about four thirds of level 0
    expect(textureBytes(2560, 1600) / (2560 * 1600 * 4)).toBeCloseTo(4 / 3, 2);
    expect(Math.round(textureBytes(3840, 2400) / 1e5) / 10).toBe(49.2);
  });
});
