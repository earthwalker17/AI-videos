import { describe, expect, it } from 'vitest';
import { ROUND2 } from '../lookdev/frames.ts';
import { FOLDER_PRINT } from '../print.ts';
import { ACT_ONE_END, FLAG, FLAG_UP, FOLDERS, flagTop, HEAP, LOOP_A, PEN_ON, REQUEST_A, YOU_SHIFT_A, actOneAt, actOneFootprints, actOnePools, aimOf, loopNormal, loopPoint, stackTop, tabAt, youPoseA, youPoseAt } from './actOne.ts';
import { FRAMING_A, deskCamera, project } from './camera.ts';
import { MAX_FOOTPRINTS } from './footprints.ts';
import { YOU, type P3 } from './layout.ts';
import { LAMP_ARMS, LAMP_FOOT_Z, YOU_POSE_B } from './you.ts';

const A = actOneAt(ROUND2.stillA);
const pose = deskCamera(FRAMING_A, 15);
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

describe('act one at still A (f915, C4)', () => {
  it('is act one, inside C4, with the loop clipped shut since f880 and every chore on the desk', () => {
    expect(ROUND2.stillA).toBeLessThan(ACT_ONE_END);
    expect(A.loop.closed).toBeGreaterThan(0.99);
    expect(actOneAt(879).loop.closed).toBe(0);
    for (const c of Object.values(A.chores)) expect(c).toBeGreaterThan(0.99);
    expect(A.step.amount).toBe(1);
    expect(A.step.ids).toContain('intake');
  });
  it('keeps the lamp settled on F3, blooming: one light against eight folders', () => {
    expect(A.lamp.n).toBe(3);
    expect(dist(A.lamp.aim, aimOf(3))).toBeLessThan(1);
    expect(A.lamp.bulb).toBeGreaterThan(1);
    const pools = actOnePools(A);
    expect(pools).toHaveLength(1);
    // centred a little toward the lamp, so F3 falls off to its far edge
    expect(dist(pools[0].c, [FOLDERS[2].c[0], FOLDERS[2].c[1]])).toBeLessThan(60);
    expect(pools[0].c[1]).toBeLessThan(FOLDERS[2].c[1]);
  });
  it('has about four warm folders working and four cold ones waiting (no number on screen)', () => {
    for (const [i, s] of A.folders.entries()) {
      expect(s.present).toBe(1);
      if ([0, 2, 4, 6].includes(i)) {
        expect(s.warmth).toBeGreaterThan(PEN_ON);
        expect(s.pen).toBe(0);
        expect(s.flag).toBe(0);
      } else {
        expect(s.warmth).toBeLessThan(FLAG_UP);
        expect(s.pen).toBe(1);
        expect(s.flag).toBe(1);
      }
    }
  });
  it('has one chat slip in mid-arc, at about h 40–60', () => {
    expect(A.flight).not.toBeNull();
    expect(A.flight!.pos[2]).toBeGreaterThan(35);
    expect(A.flight!.pos[2]).toBeLessThan(65);
  });
  it('is a pure function of the frame', () => {
    expect(actOneAt(ROUND2.stillA)).toEqual(A);
    expect(actOneAt(700)).toEqual(actOneAt(700));
  });
});

describe('act one layout (FRAMING_A, 15°)', () => {
  it('fans eight folders north of the desk, never round it, each 150–210 px and none overlapping', () => {
    expect(FOLDERS).toHaveLength(8);
    for (const fl of FOLDERS) {
      expect(fl.c[1]).toBeGreaterThan(LOOP_A.c[1] + LOOP_A.b);
      expect(Math.max(fl.w, fl.d) * FRAMING_A.zoom).toBeGreaterThanOrEqual(150);
      expect(Math.max(fl.w, fl.d) * FRAMING_A.zoom).toBeLessThanOrEqual(210);
    }
    for (let i = 1; i < FOLDERS.length; i++) {
      const a = FOLDERS[i - 1];
      const b = FOLDERS[i];
      expect(dist(a.c, b.c)).toBeGreaterThan((a.w + b.w) / 2);
    }
  });
  it('keeps the diagram in the band y 72–868 and the stacks different (context is paper)', () => {
    for (const [i, fl] of FOLDERS.entries()) {
      // the highest point: a raised flag's pennant tip, else the tab
      const top = A.folders[i].flag > 0 ? flagTop(fl, A.folders[i].flag) : ([fl.c[0], fl.c[1] + fl.d / 2 + 13, stackTop(fl)] as const);
      const tip: P3 = [top[0], top[1] + (A.folders[i].flag > 0 ? FLAG.plate[0] : 0), top[2]];
      expect(project(pose, tip)[1]).toBeGreaterThan(72);
    }
    for (let k = 0; k < 64; k++) {
      const p = loopPoint(LOOP_A, (k / 64) * Math.PI * 2);
      expect(project(pose, [p[0], p[1] - LOOP_A.w / 2, 0])[1]).toBeLessThan(868);
    }
    expect(new Set(FOLDERS.map((f) => f.sheets)).size).toBe(8);
  });
  it('rings your desk with the loop: the tape clears the slab, and each tab faces its folder', () => {
    const s = { x0: YOU.slab.x0 + YOU_SHIFT_A[0], x1: YOU.slab.x1 + YOU_SHIFT_A[0], y0: YOU.slab.y0 + YOU_SHIFT_A[1], y1: YOU.slab.y1 + YOU_SHIFT_A[1] };
    for (let k = 0; k < 360; k++) {
      const t = (k / 360) * Math.PI * 2;
      const p = loopPoint(LOOP_A, t);
      const n = loopNormal(LOOP_A, t);
      const inner = [p[0] - (n[0] * LOOP_A.w) / 2, p[1] - (n[1] * LOOP_A.w) / 2];
      const inside = inner[0] > s.x0 + 2 && inner[0] < s.x1 - 2 && inner[1] > s.y0 + 2 && inner[1] < s.y1 - 2;
      expect(inside).toBe(false);
    }
    for (const fl of FOLDERS) {
      const t = tabAt(LOOP_A, fl);
      const p = loopPoint(LOOP_A, t);
      const n = loopNormal(LOOP_A, t);
      const toward = Math.atan2(fl.c[1] - p[1], fl.c[0] - p[0]);
      // the tab leaves the tape outward and turns to its folder
      expect(n[0] * Math.cos(toward) + n[1] * Math.sin(toward)).toBeGreaterThan(0.3);
    }
  });
  it('leaves the request a creased corner clear of every later piece of the heap', () => {
    const flap = [REQUEST_A.c[0] + Math.cos(REQUEST_A.rot) * (REQUEST_A.l / 2 - REQUEST_A.crease / 2), REQUEST_A.c[1] + Math.sin(REQUEST_A.rot) * (REQUEST_A.l / 2 - REQUEST_A.crease / 2)];
    const over = HEAP.filter((p) => p.z > REQUEST_A.z);
    expect(over.length).toBeGreaterThanOrEqual(3);
    for (const p of over) expect(dist(p.c, flap)).toBeGreaterThan(55);
  });
  it('prints whole lines that fit their sheets (16 u mono, 0.6 em advance)', () => {
    for (const fl of FOLDERS) for (const l of FOLDER_PRINT[fl.n - 1].lines) expect(8 + l.length * 9.6).toBeLessThan(fl.w - 10);
  });
});

describe('your desk in act one', () => {
  it('stands north-east of its act-two place, its in-tray empty, the strut on the lid and the bulb out of the hood', () => {
    const y = youPoseA(A);
    expect(y.shift[0]).toBeGreaterThan(0);
    expect(y.shift[1]).toBeGreaterThan(0);
    expect(y.inTray).toBe(true);
    expect(y.inTraySlip).toBe(false);
    expect(y.strut).toBe('lid');
    expect(y.bulbOut).toBeGreaterThan(0);
    expect(youPoseAt(ACT_ONE_END)).toBe(YOU_POSE_B);
    expect(youPoseAt(2225)).toBe(YOU_POSE_B);
  });
  it('bends one lamp inside the loop: the arms keep their lengths, the elbow up (the Λ), only the light crosses the tape to F3', () => {
    const y = youPoseA(A);
    const { base, elbow, head, aim } = y.lamp;
    const foot: P3 = [base[0], base[1], base[2] + LAMP_FOOT_Z];
    expect(dist(foot, elbow)).toBeCloseTo(LAMP_ARMS.lower, 3);
    expect(dist(elbow, head)).toBeCloseTo(LAMP_ARMS.upper, 3);
    expect(elbow[2]).toBeGreaterThan(head[2]);
    expect(aim[2]).toBeLessThan(head[2]);
    // the hood aims north at F3
    expect(aim[1]).toBeGreaterThan(head[1]);
    // every joint, seen through the camera, lies inside the loop's tape (no arm reaches toward a folder)
    const L = LOOP_A;
    for (const p of [foot, elbow, head]) {
      const w: P3 = [p[0] + y.shift[0], p[1] + y.shift[1], p[2]];
      // the point on the desk the camera sees it over (its height pushes it north on screen by z·tan 15°)
      const seen: [number, number] = [w[0], w[1] + w[2] * Math.tan((15 * Math.PI) / 180)];
      const q = ((seen[0] - L.c[0]) / (L.a - L.w)) ** 2 + ((seen[1] - L.c[1]) / (L.b - L.w)) ** 2;
      expect(q).toBeLessThan(1);
    }
  });
  it('fits its footprints in the shaders', () => {
    expect(actOneFootprints(A).length).toBeLessThanOrEqual(MAX_FOOTPRINTS);
  });
});
