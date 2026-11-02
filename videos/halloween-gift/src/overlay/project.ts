/**
 * Where a world-space rectangle lands on screen at a film frame, using the same camera pose the
 * 3D layer uses (film/timeline.ts cameraAt). The DOM layer uses it to sit exactly on top of a
 * 3D prop (the letter's face B), so the crossfade from 3D to DOM does not jump.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { shotPose } from '../film/camera.ts';
import type { V3 } from '../film/timeline.ts';

const cam = new PerspectiveCamera();
const v = new Vector3();

/** Screen box (CSS px of the composition) of the points, at film frame f. */
export function screenBox(f: number, points: V3[], width: number, height: number): { left: number; top: number; width: number; height: number } {
  const p = shotPose(f);
  cam.fov = p.fov;
  cam.aspect = width / height;
  cam.near = 0.05;
  cam.far = 80;
  cam.position.set(...p.pos);
  cam.lookAt(...p.look);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of points) {
    v.set(...q).project(cam);
    const x = ((v.x + 1) / 2) * width;
    const y = ((1 - v.y) / 2) * height;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
}
