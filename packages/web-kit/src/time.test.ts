// SPDX-License-Identifier: MIT
import { easings } from '@aiv/core';
import { describe, expect, it } from 'vitest';
import { bump, gate, prog, settle, subframes } from './time.ts';

describe('time helpers', () => {
  it('prog holds at both ends and eases between', () => {
    expect(prog(-5, 0, 10)).toBe(0);
    expect(prog(15, 0, 10)).toBe(1);
    expect(prog(5, 0, 10)).toBeCloseTo(0.5, 12);
    expect(prog(2, 0, 10, easings.linear)).toBeCloseTo(0.2, 12);
  });

  it('gate is 0 outside, 1 inside, with soft edges', () => {
    expect(gate(-1, 0, 100)).toBe(0);
    expect(gate(50, 0, 100)).toBe(1);
    expect(gate(6, 0, 100, 12)).toBeCloseTo(0.5, 12);
    expect(gate(94, 0, 100, 12, 24)).toBeCloseTo(0.25, 12);
    expect(gate(101, 0, 100)).toBe(0);
  });

  it('bump rises to 1 at its peak and returns to 0', () => {
    expect(bump(0, 0, 10, 30)).toBe(0);
    expect(bump(10, 0, 10, 30)).toBe(1);
    expect(bump(30, 0, 10, 30)).toBe(0);
    expect(bump(20, 0, 10, 30)).toBeGreaterThan(0);
  });

  it('settle approaches 1 from 0 without overshoot', () => {
    expect(settle(0, 5)).toBe(0);
    expect(settle(-3, 5)).toBe(0);
    let prev = 0;
    for (let t = 1; t < 100; t++) {
      const v = settle(t, 5);
      expect(v).toBeGreaterThan(prev);
      expect(v).toBeLessThan(1);
      prev = v;
    }
  });

  it('subframes spread over the shutter, centred on the frame', () => {
    expect(subframes(10, 1, 0.5)).toEqual([10]);
    const s = subframes(10, 4, 0.5);
    expect(s).toHaveLength(4);
    expect(s.reduce((a, b) => a + b, 0) / 4).toBeCloseTo(10, 12);
    expect(s[0]).toBeCloseTo(10 - 0.1875, 12);
    expect(s[3]).toBeCloseTo(10 + 0.1875, 12);
  });
});
