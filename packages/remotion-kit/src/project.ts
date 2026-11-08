/**
 * Where world-space points land on screen through a camera pose, the same pose the 3D layer
 * uses. The DOM layer uses it to sit exactly on top of a 3D object (a label on its node, a DOM
 * card over its 3D twin), so a label stays on its object at every zoom and a crossfade from 3D
 * to DOM does not jump (docs/ARCHITECTURE.md decision 30, "One camera").
 *
 * Copied from the frozen film *A Halloween Gift* at its release tag `video/halloween-gift/v1`
 * (`videos/halloween-gift/src/overlay/project.ts`: `screenBoxAt`), for its second use (video #4).
 * The film keeps its own copy, and its `screenBox(f, …)`, which reads the film's own camera, stays
 * in it. Pure: the scratch camera and vector below are overwritten on every call.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import type { CamPose } from './campath.ts';

/** A box in CSS px of the composition, from its top left. */
export interface ScreenBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const cam = new PerspectiveCamera();
const v = new Vector3();

/**
 * The screen box (CSS px of a `width` x `height` composition) of the points, seen through the
 * pose: fov is vertical, in degrees, as three's. Pass the composition's CSS size, not the render
 * size: the DOM layer is laid out in CSS px at every render scale. Keep the points in front of
 * the camera: a point behind it projects mirrored through the centre.
 */
export function screenBoxAt(p: CamPose, points: readonly (readonly number[])[], width: number, height: number): ScreenBox {
  cam.fov = p.fov;
  cam.aspect = width / height;
  cam.near = 0.05;
  cam.far = 120;
  cam.position.set(p.pos[0], p.pos[1], p.pos[2]);
  cam.lookAt(p.look[0], p.look[1], p.look[2]);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of points) {
    v.set(q[0], q[1], q[2]).project(cam);
    const x = ((v.x + 1) / 2) * width;
    const y = ((1 - v.y) / 2) * height;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
}
