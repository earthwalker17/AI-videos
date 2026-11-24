// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { Camera, type Vec3 } from './camera.ts';
import { paneAxes } from './draw.ts';

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('paneAxes', () => {
  it('faces the viewer upright by default: image x right, image y down', () => {
    const { u, v } = paneAxes();
    expect(u).toEqual([1, 0, -0]);
    expect(v[1]).toBe(-1);
  });

  it('stays orthonormal when turned and leaned', () => {
    const { u, v } = paneAxes(7, 4);
    expect(dot(u, u)).toBeCloseTo(1, 12);
    expect(dot(v, v)).toBeCloseTo(1, 12);
    expect(dot(u, v)).toBeCloseTo(0, 12);
  });

  it('turns the right edge away for a positive yaw and leans the top away for a positive pitch', () => {
    const cam = new Camera({ target: [0, 0, 0], tilt: 0, yaw: 0, dist: 1 });
    const { u, v } = paneAxes(7, 0);
    const right = cam.project([u[0] * 500, u[1] * 500, u[2] * 500]);
    const left = cam.project([-u[0] * 500, -u[1] * 500, -u[2] * 500]);
    // the far edge is smaller
    expect(right.s).toBeLessThan(left.s);
    expect(right.depth).toBeGreaterThan(left.depth);
    const lean = paneAxes(0, 5).v;
    const top = cam.project([-lean[0] * 300, -lean[1] * 300, -lean[2] * 300]);
    expect(top.depth).toBeGreaterThan(cam.project([0, 0, 0]).depth);
    expect(v[1]).toBeCloseTo(-1, 12);
  });
});
