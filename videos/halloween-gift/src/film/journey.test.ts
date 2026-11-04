import { describe, expect, it } from 'vitest';
import { at, FILM_FRAMES } from '../cues.ts';
import { ghostMarks } from '../world/Ghosts.tsx';
import { BOOK, FLOOR, groundHeight, LAND, STONES } from '../world/layout.ts';
import { coverAt, ghostLowerAt } from './beats.ts';
import { clawdAt } from './blocking.ts';
import { CAMERA_OBSTACLES, COVER_CLOSE, journeyAt, obstacleAt, OUT_OF_BOOK } from './journey.ts';

describe('the V2 camera journey', () => {
  it('keeps out of the hanging ghosts as built, over the whole film', () => {
    // each ghost's cloth inside one of its obstacles active at the frame (the peek ghost's let-down one while it peeks)
    const covers = (i: number, f: number, m: ReturnType<typeof ghostMarks>[number]) =>
      CAMERA_OBSTACLES.filter((o) => o.name.startsWith(`ghost ${i}`) && obstacleAt(o, f)).some((o) => {
        const g = FLOOR + groundHeight(o.x, o.z);
        const inPlan = [m.tie, m.bottom].every((p) => Math.hypot(p[0] - o.x, p[2] - o.z) + m.hem < o.r);
        return inPlan && m.bottom[1] > g + (o.y0 ?? 0) && m.tie[1] < g + o.h;
      });
    for (let f = 0; f < FILM_FRAMES; f += 2) ghostMarks(f, [0, 0, ghostLowerAt(f)]).forEach((m, i) => expect(covers(i, f, m), `frame ${f}: ghost ${i}`).toBe(true));
  });

  it('never passes through a prop or under the ground inside the world', () => {
    for (let f = at(5); f < OUT_OF_BOOK[1]; f++) {
      const [x, y, z] = journeyAt(f).pos;
      // V1's door cameras (bars 17 on) sit at Clawd's eye height, 0.275 above the levelled yard at
      // DOOR_SCALE; the camera settles to it over the yard from the end of the lane walk (at(16, 3))
      expect(y - (FLOOR + groundHeight(x, z)), `frame ${f}: height above the ground`).toBeGreaterThan(f >= at(16, 3) ? 0.2 : 0.3);
      for (const o of CAMERA_OBSTACLES) {
        if (!obstacleAt(o, f)) continue;
        if (y > FLOOR + groundHeight(o.x, o.z) + o.h + 0.15) continue;
        if (o.y0 !== undefined && y < FLOOR + groundHeight(o.x, o.z) + o.y0 - 0.15) continue;
        expect(Math.hypot(x - o.x, z - o.z) - o.r, `frame ${f}: ${o.name}`).toBeGreaterThan(0.1);
      }
    }
  });

  it('moves smoothly: the push into the opening book and the crane out of it stay gentle, the world moves slower still', () => {
    let prev = journeyAt(0);
    for (let f = 1; f < FILM_FRAMES; f++) {
      const p = journeyAt(f);
      const step = Math.hypot(p.pos[0] - prev.pos[0], p.pos[1] - prev.pos[1], p.pos[2] - prev.pos[2]);
      expect(step, `frame ${f}`).toBeLessThan(f < at(5, 2) || f >= OUT_OF_BOOK[0] ? 0.48 : 0.35);
      prev = p;
    }
  });

  it('is never swept by the closing cover: out of its way before it comes down', () => {
    // world/Book2.tsx: the cover hinges along the back edge (y FLOOR, z -BOOK.d/2), BOOK.d long,
    // BOOK.w wide (plus the boards' squares), standing at coverAt 1 (90 deg)
    const hinge = { y: FLOOR, z: -BOOK.d / 2 };
    const half = BOOK.w / 2 + 0.3;
    for (let f = COVER_CLOSE[0]; f <= COVER_CLOSE[1] + 2; f++) {
      const [x, y, z] = journeyAt(f).pos;
      const r = Math.hypot(y - hinge.y, z - hinge.z);
      const phi = Math.atan2(y - hinge.y, z - hinge.z);
      const theta = (coverAt(f) * Math.PI) / 2;
      const clear = r > BOOK.d + 0.4 || Math.abs(x) > half || phi < theta - 0.05;
      expect(clear, `frame ${f}: r ${r.toFixed(2)}, ${((phi * 180) / Math.PI).toFixed(1)} deg against the cover's ${((theta * 180) / Math.PI).toFixed(1)}`).toBe(true);
    }
    // and outside the shut book at the slam
    const [, y, z] = journeyAt(COVER_CLOSE[1]).pos;
    expect(Math.hypot(y - hinge.y, z - hinge.z)).toBeGreaterThan(BOOK.d + 0.4);
  });

  it('holds the hero view while the first caption is read', () => {
    const a = journeyAt(at(5, 2)).pos;
    const b = journeyAt(at(6, 3)).pos;
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(0.4);
  });
  it('never lets a stone cross between the camera and Clawd, from the pop-up to the gates', () => {
    // V1's graveyard truck passed a foreground stone over his face
    const items = [...STONES.map((st, i) => ({ name: `stone ${i}`, x: st.x, z: st.z, r: 0.2, h: st.h })), { name: 'RIP stone', x: LAND.ripStone.x, z: LAND.ripStone.z, r: 0.32, h: 0.92 }];
    for (let f = at(7) + 8; f < at(14, 2); f++) {
      const cam = journeyAt(f).pos;
      const c = clawdAt(f).pose.pos;
      const dx = c[0] - cam[0];
      const dz = c[2] - cam[2];
      const l2 = dx * dx + dz * dz;
      for (const it of items) {
        const t = Math.max(0, Math.min(1, ((it.x - cam[0]) * dx + (it.z - cam[2]) * dz) / l2));
        if (t > 0.92) continue;
        const d = Math.hypot(cam[0] + dx * t - it.x, cam[2] + dz * t - it.z);
        const y = cam[1] + (c[1] + 0.12 - cam[1]) * t;
        const over = d < it.r + 0.08 && y < FLOOR + groundHeight(it.x, it.z) + it.h;
        expect(over, `frame ${f}: ${it.name}`).toBe(false);
      }
    }
  });
});
