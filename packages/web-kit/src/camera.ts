// SPDX-License-Identifier: MIT
// Promoted from videos/super-agent/src/kit (tag video/super-agent/v2); only the comments changed.
/**
 * The camera rig: one perspective camera that looks at a point from a tilt. It is a pure function
 * of its pose, so a frame's picture depends on the frame alone.
 *
 * World: x to the right, y up (planes are horizontal, y = const), z towards the viewer. Lengths are
 * reference pixels: at the reference distance one world unit on the focus plane is one pixel of a
 * 1920x1080 frame.
 *
 * Screen: reference pixels, origin top left, 1920x1080.
 */

export type Vec3 = readonly [number, number, number];
export type Vec2 = readonly [number, number];

export const REF_W = 1920;
export const REF_H = 1080;

export interface Pose {
  /** the point the camera looks at */
  target: Vec3;
  /** degrees above the planes: 90 looks straight down (plan), near 0 looks edge-on (section) */
  tilt: number;
  /** degrees around the vertical axis */
  yaw: number;
  /** distance as a multiple of the reference distance (1 = one unit is one pixel at the target) */
  dist: number;
  /** where the target sits in the frame, in reference px (default: the centre) */
  centre?: Vec2;
}

export interface Projected {
  x: number;
  y: number;
  /** reference px per world unit at this depth */
  s: number;
  /** view depth in world units (positive in front of the camera) */
  depth: number;
}

const FOV_Y = 28;
const FOCAL = REF_H / 2 / Math.tan((FOV_Y * Math.PI) / 360);
const NEAR = 40;
const FAR = 40000;

const rad = (deg: number): number => (deg * Math.PI) / 180;

export class Camera {
  readonly eye: Vec3;
  /** camera basis in world space: right, up, and `back` (from the target to the eye) */
  readonly right: Vec3;
  readonly up: Vec3;
  readonly back: Vec3;
  /** column-major view-projection, clip space, for world-space shapes */
  readonly viewProj: Float32Array;
  private readonly cx: number;
  private readonly cy: number;

  constructor(readonly pose: Pose) {
    const t = rad(pose.tilt);
    const y = rad(pose.yaw);
    const back: Vec3 = [Math.sin(y) * Math.cos(t), Math.sin(t), Math.cos(y) * Math.cos(t)];
    const right: Vec3 = [Math.cos(y), 0, -Math.sin(y)];
    // up = right x forward, forward = -back
    const up: Vec3 = [right[1] * -back[2] - right[2] * -back[1], right[2] * -back[0] - right[0] * -back[2], right[0] * -back[1] - right[1] * -back[0]];
    const d = pose.dist * FOCAL;
    this.eye = [pose.target[0] + back[0] * d, pose.target[1] + back[1] * d, pose.target[2] + back[2] * d];
    this.right = right;
    this.up = up;
    this.back = back;
    this.cx = pose.centre?.[0] ?? REF_W / 2;
    this.cy = pose.centre?.[1] ?? REF_H / 2;

    // view: rows right, up, back; projection: perspective with a lens shift to put the target at `centre`
    const e = this.eye;
    const tx = -(right[0] * e[0] + right[1] * e[1] + right[2] * e[2]);
    const ty = -(up[0] * e[0] + up[1] * e[1] + up[2] * e[2]);
    const tz = -(back[0] * e[0] + back[1] * e[1] + back[2] * e[2]);
    const px = (2 * FOCAL) / REF_W;
    const py = (2 * FOCAL) / REF_H;
    const sx = (2 * this.cx) / REF_W - 1;
    const sy = 1 - (2 * this.cy) / REF_H;
    const a = -(FAR + NEAR) / (FAR - NEAR);
    const b = (-2 * FAR * NEAR) / (FAR - NEAR);
    // clip = P * V * p, with view z negative in front of the camera (zv = back . (p - eye))
    // x_clip = px * xv - sx * zv ; y_clip = py * yv - sy * zv ; z_clip = a * zv + b ; w = -zv
    const m = new Float32Array(16);
    const row = (r: number, c0: number, c1: number, c2: number, c3: number) => {
      m[r] = c0;
      m[4 + r] = c1;
      m[8 + r] = c2;
      m[12 + r] = c3;
    };
    row(0, px * right[0] - sx * back[0], px * right[1] - sx * back[1], px * right[2] - sx * back[2], px * tx - sx * tz);
    row(1, py * up[0] - sy * back[0], py * up[1] - sy * back[1], py * up[2] - sy * back[2], py * ty - sy * tz);
    row(2, a * back[0], a * back[1], a * back[2], a * tz + b);
    row(3, -back[0], -back[1], -back[2], -tz);
    this.viewProj = m;
  }

  /** A world point in reference px, with the local scale and the depth. */
  project(p: Vec3): Projected {
    const e = this.eye;
    const dx = p[0] - e[0];
    const dy = p[1] - e[1];
    const dz = p[2] - e[2];
    const xv = this.right[0] * dx + this.right[1] * dy + this.right[2] * dz;
    const yv = this.up[0] * dx + this.up[1] * dy + this.up[2] * dz;
    const depth = -(this.back[0] * dx + this.back[1] * dy + this.back[2] * dz);
    const s = FOCAL / Math.max(depth, NEAR);
    return { x: this.cx + xv * s, y: this.cy - yv * s, s, depth };
  }

  /** Reference px per world unit at a world point. */
  pxPerUnit(p: Vec3): number {
    return this.project(p).s;
  }
}

/** Blend two poses (angles and distance linearly, the target and centre linearly). */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t;
  const ca = a.centre ?? [REF_W / 2, REF_H / 2];
  const cb = b.centre ?? [REF_W / 2, REF_H / 2];
  return {
    target: [l(a.target[0], b.target[0]), l(a.target[1], b.target[1]), l(a.target[2], b.target[2])],
    tilt: l(a.tilt, b.tilt),
    yaw: l(a.yaw, b.yaw),
    // distance blends in log space, so a pull-out feels even
    dist: Math.exp(l(Math.log(a.dist), Math.log(b.dist))),
    centre: [l(ca[0], cb[0]), l(ca[1], cb[1])],
  };
}
