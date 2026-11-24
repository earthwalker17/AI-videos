// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { Camera, REF_H, REF_W, mixPose, type Pose, type Vec3 } from './camera.ts';

const FRONT: Pose = { target: [0, 0, 0], tilt: 0, yaw: 0, dist: 1 };

/** clip-space transform of a world point by the camera's column-major matrix, to reference px */
function clipToRef(m: Float32Array, p: Vec3): [number, number] {
  const x = m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!;
  const y = m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!;
  const w = m[3]! * p[0] + m[7]! * p[1] + m[11]! * p[2] + m[15]!;
  return [((x / w + 1) / 2) * REF_W, ((1 - y / w) / 2) * REF_H];
}

describe('Camera', () => {
  it('puts the target at the centre of the frame, one unit to one reference pixel at distance 1', () => {
    const cam = new Camera(FRONT);
    const c = cam.project([0, 0, 0]);
    expect(c.x).toBeCloseTo(REF_W / 2, 6);
    expect(c.y).toBeCloseTo(REF_H / 2, 6);
    expect(c.s).toBeCloseTo(1, 9);
    // world y is up, screen y is down
    const p = cam.project([100, 50, 0]);
    expect(p.x).toBeCloseTo(REF_W / 2 + 100, 6);
    expect(p.y).toBeCloseTo(REF_H / 2 - 50, 6);
  });

  it('halves the scale at twice the distance', () => {
    expect(new Camera({ ...FRONT, dist: 2 }).pxPerUnit([0, 0, 0])).toBeCloseTo(0.5, 9);
  });

  it('agrees with its own view-projection matrix (the shader path)', () => {
    for (const pose of [FRONT, { target: [30, -20, 10], tilt: 35, yaw: -12, dist: 1.4, centre: [800, 600] } satisfies Pose]) {
      const cam = new Camera(pose);
      for (const p of [[0, 0, 0], [240, -80, 60], [-500, 300, -200]] as Vec3[]) {
        const a = cam.project(p);
        const [x, y] = clipToRef(cam.viewProj, p);
        expect(x).toBeCloseTo(a.x, 2);
        expect(y).toBeCloseTo(a.y, 2);
      }
    }
  });

  it('keeps an orthonormal basis', () => {
    const cam = new Camera({ target: [0, 0, 0], tilt: 52, yaw: 31, dist: 1 });
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(cam.right, cam.up)).toBeCloseTo(0, 12);
    expect(dot(cam.right, cam.back)).toBeCloseTo(0, 12);
    expect(dot(cam.up, cam.back)).toBeCloseTo(0, 12);
    expect(dot(cam.up, cam.up)).toBeCloseTo(1, 12);
  });

  it('places the target at `centre` (a lens shift, not a turn)', () => {
    const cam = new Camera({ ...FRONT, centre: [600, 400] });
    const c = cam.project([0, 0, 0]);
    expect(c.x).toBeCloseTo(600, 6);
    expect(c.y).toBeCloseTo(400, 6);
  });
});

describe('mixPose', () => {
  it('blends distance in log space and returns the ends at 0 and 1', () => {
    const a: Pose = { target: [0, 0, 0], tilt: 10, yaw: 0, dist: 1 };
    const b: Pose = { target: [100, 0, 0], tilt: 50, yaw: 20, dist: 4, centre: [0, 0] };
    expect(mixPose(a, b, 0).dist).toBeCloseTo(1, 12);
    expect(mixPose(a, b, 1).dist).toBeCloseTo(4, 12);
    expect(mixPose(a, b, 0.5).dist).toBeCloseTo(2, 12);
    const m = mixPose(a, b, 0.5);
    expect(m.tilt).toBe(30);
    expect(m.target[0]).toBe(50);
    expect(m.centre).toEqual([480, 270]);
  });
});
