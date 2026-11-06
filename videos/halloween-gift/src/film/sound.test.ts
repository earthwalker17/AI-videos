import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { footfalls, stepPlace } from '../../audio/timeline.ts';
import { clawdAt } from './blocking.ts';
import { journeyAt } from './journey.ts';

describe("the score's footsteps sit where Clawd is in the picture", () => {
  it('pans and distances every footfall as the V2 camera sees him (audio/timeline.ts STEP_PLACES)', () => {
    const cam = new PerspectiveCamera(30, 16 / 9, 0.05, 200);
    for (const { frame, walk, u } of footfalls()) {
      const p = journeyAt(frame);
      cam.position.set(...p.pos);
      cam.fov = p.fov;
      cam.updateProjectionMatrix();
      cam.lookAt(...p.look);
      cam.updateMatrixWorld();
      const c = clawdAt(frame).pose.pos;
      const v = new Vector3(c[0], c[1] + 0.1, c[2]).project(cam);
      const dist = Math.hypot(c[0] - p.pos[0], c[1] - p.pos[1], c[2] - p.pos[2]);
      const pan = Math.max(-0.8, Math.min(0.8, 0.8 * v.x));
      const gainDb = -20 * Math.log10(Math.max(1, dist / 2));
      const placed = stepPlace(walk, u);
      expect(Math.abs(placed.pan - pan), `frame ${frame}: pan ${placed.pan.toFixed(2)}, the camera sees ${pan.toFixed(2)}`).toBeLessThan(0.1);
      expect(Math.abs(placed.gainDb - gainDb), `frame ${frame}: gain ${placed.gainDb.toFixed(1)} dB, the camera's distance gives ${gainDb.toFixed(1)}`).toBeLessThan(1.5);
    }
  });
});
