/**
 * You (synthesis §2, element sheet): no figure, a small desk with a bent-arm lamp (the film's only
 * Λ: its aim and pool are your attention, the bulb the only warm light), a laptop with its lid open
 * on its hinge (a dim screen: no transcript), the chore tray and the in-tray where the Router's
 * replies land: the only path to you.
 *
 * The chore tray is a shadow board (you.ts CHORES): an enamel plate with a recess cut to each
 * chore's outline, at unequal widths and with no dividers, over a dark floor, so an empty recess
 * still says what it held. The chores are made objects, each its own shape family: the starter key
 * (a ring bow, a collar, a shank and a toothed bit), the sand-glass, and the lid strut (a
 * telescoping prop with a clevis at each end).
 *
 * Everything is posed by `youPoseAt` (the frame): in act one the desk stands north-east of its
 * later place, its lamp reaching up to the folder it attends with the bulb standing out of the hood
 * (it blooms), and the lid strut props the laptop open; after the turn the pose is `YOU_POSE_B`.
 */
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { at } from '../../cues.ts';
import { Path, Quaternion, Shape, Vector3, type BufferGeometry, type Texture } from 'three';
import { graphite, matte, paper } from '../gl/materials.ts';
import { texture } from '../gl/text.ts';
import { youPoseAt } from '../actOne.ts';
import { cylinderZ, disc, dome, extrude, fitUv, frame, latheZ, merge, plane, planeOn, rectShape, ringFlat, slab, tube } from '../geom.ts';
import { EMIT, Step, isStepped, useDeskMats } from '../kit.tsx';
import { LAMP, YOU, rectC, type P3 } from '../layout.ts';
import { LIGHT_HEX } from '../pools.ts';
import type { DeskState } from '../state.ts';
import { CHORES, LAMP_FOOT_Z, RECESS_GAP, TRAY_Z, strutEnds, type ChoreFlight, type LampPose, type YouPose } from '../you.ts';

const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Two parallel rods from a to b (an arm of the lamp), `gap` apart across the arm. */
function rods(a: P3, b: P3, gap: number, r: number): BufferGeometry[] {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  const side = new Vector3().crossVectors(d, new Vector3(0, 0, 1)).normalize().multiplyScalar(gap / 2);
  return [-1, 1].map((k) =>
    tube(
      [
        [a[0] + side.x * k, a[1] + side.y * k, a[2] + side.z * k],
        [b[0] + side.x * k, b[1] + side.y * k, b[2] + side.z * k],
      ],
      r,
      8,
      8,
    ),
  );
}

/** A coil spring along a segment (the lamp's counterbalance). */
function spring(a: P3, b: P3, radius: number, turns: number): BufferGeometry {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  d.normalize();
  const u = new Vector3().crossVectors(d, new Vector3(0, 0, 1)).normalize();
  const v = new Vector3().crossVectors(u, d).normalize();
  const n = turns * 14;
  const pts: P3[] = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const ang = t * turns * Math.PI * 2;
    const c = new Vector3(a[0], a[1], a[2]).addScaledVector(d, t * len).addScaledVector(u, Math.cos(ang) * radius).addScaledVector(v, Math.sin(ang) * radius);
    return [c.x, c.y, c.z];
  });
  return tube(pts, 0.9, n, 5);
}

/** The lamp's arms, counterbalance and joints for a pose (desk coordinates). */
function useLampGeometry(lamp: LampPose) {
  const { base, elbow, head } = lamp;
  return useMemo(() => {
    const foot: P3 = [base[0], base[1], YOU.top + LAMP_FOOT_Z];
    const arms = merge([...rods(foot, elbow, 9, 2.6), ...rods(elbow, head, 8, 2.4)]);
    const springG = spring(lerp3(foot, elbow, 0.18), lerp3(foot, elbow, 0.62), 3.2, 11);
    const joint = (p: P3, r: number) => {
      const d = new Vector3(elbow[0] - base[0], elbow[1] - base[1], 0).normalize();
      const axis = new Vector3().crossVectors(d, new Vector3(0, 0, 1)).normalize();
      return tube(
        [
          [p[0] - axis.x * 8, p[1] - axis.y * 8, p[2]],
          [p[0] + axis.x * 8, p[1] + axis.y * 8, p[2]],
        ],
        r,
        4,
        16,
      );
    };
    const joints = merge([joint(foot, 6), joint(elbow, 6.5), joint(head, 5)]);
    return { arms, springG, joints };
  }, [base, elbow, head]);
}

/** The lid strut's sizes: an outer tube, its rod, the enamel collar between, a clevis at each end (each at least 24 px at 1.2x across). */
export const STRUT = { tube: 4.6, rod: 2.8, collar: 7.6, collarL: 7, clevis: [18, 11] as const } as const;
/** Where the collar sits along a strut of length `len` (the outer tube's end). */
const strutOuter = (len: number) => Math.min(46, len * 0.6);

/** The lid strut: a telescoping prop along +y from 0 to `len`, an outer tube, the inner rod, an enamel collar and a clevis at each end. */
function strutParts(len: number) {
  const outer = strutOuter(len);
  const [cw, cl] = STRUT.clevis;
  return {
    tube: tube(
      [
        [0, cl - 2, 0],
        [0, outer, 0],
      ],
      STRUT.tube,
      4,
      16,
    ),
    rod: tube(
      [
        [0, outer - 2, 0],
        [0, len - cl + 2, 0],
      ],
      STRUT.rod,
      4,
      12,
    ),
    collar: (() => {
      const g = merge([cylinderZ(STRUT.collar, -STRUT.collarL / 2, STRUT.collarL / 2, 0, 0, 24), cylinderZ(STRUT.collar + 1, -1, 1, 0, 0, 24)]);
      g.rotateX(Math.PI / 2);
      g.translate(0, outer, 0);
      return g;
    })(),
    clevis: merge(
      [0, len].map((y) => {
        const s = y === 0 ? 1 : -1;
        const a = Math.min(y, y + s * cl);
        const b = Math.max(y, y + s * cl);
        // a forked block: two cheeks and the bridge between them
        return merge([
          slab({ x0: -cw / 2, x1: -cw / 2 + 5, y0: a, y1: b }, -5.5, 5.5, 1.6, 1),
          slab({ x0: cw / 2 - 5, x1: cw / 2, y0: a, y1: b }, -5.5, 5.5, 1.6, 1),
          slab({ x0: -cw / 2, x1: cw / 2, y0: Math.min(y + s * (cl - 4), y + s * cl), y1: Math.max(y + s * (cl - 4), y + s * cl) }, -5.5, 5.5, 1.6, 1),
        ]);
      }),
    ),
    pins: merge(
      [4, len - 4].map((y) =>
        tube(
          [
            [-cw / 2 - 2, y, 0],
            [cw / 2 + 2, y, 0],
          ],
          1.9,
          2,
          10,
        ),
      ),
    ),
  };
}

/** The starter key lying north-south (desk coordinates, in its tray): a ring bow north, a collar, the shank, a toothed bit south-east. Its hand-over to the intake draws the same key (objects/Filter.tsx). */
export function keyGeometry(): { body: BufferGeometry; bow: BufferGeometry } {
  const { c, bowY, bowR, shank, bit } = CHORES.key;
  const [kx, ky] = c;
  const z0 = TRAY_Z.floor;
  const z1 = TRAY_Z.floor + 6;
  const bow = disc(bowR, z0, z1, { inner: 6.5, cx: kx, cy: ky + bowY, bevel: 1.4 });
  const collar = slab({ x0: kx - 5.5, x1: kx + 5.5, y0: ky + shank[1] - 1, y1: ky + shank[1] + 4 }, z0 + 0.3, z1 - 0.2, 1.5, 0.8);
  const shaft = tube(
    [
      [kx, ky + shank[1], z0 + 2.4],
      [kx, ky + shank[0], z0 + 2.4],
    ],
    2.4,
    6,
    12,
  );
  const tip = dome(2.4, kx, ky + shank[0], z0 + 2.4);
  // the bit: a plate off the shank's east side with two notches cut in from its east edge
  const s = new Shape();
  const [bx0, bx1] = bit.x;
  const [by0, by1] = bit.y;
  s.moveTo(kx + bx0 - 2, ky + by0);
  s.lineTo(kx + bx1, ky + by0);
  s.lineTo(kx + bx1, ky + by0 + 4);
  s.lineTo(kx + bx1 - 5, ky + by0 + 4);
  s.lineTo(kx + bx1 - 5, ky + by0 + 8);
  s.lineTo(kx + bx1, ky + by0 + 8);
  s.lineTo(kx + bx1, ky + by1 - 4);
  s.lineTo(kx + bx1 - 7, ky + by1 - 4);
  s.lineTo(kx + bx1 - 7, ky + by1);
  s.lineTo(kx + bx0 - 2, ky + by1);
  s.closePath();
  const bitG = extrude(s, z0 + 0.4, z1 - 0.6, 0.7);
  return { body: merge([collar, shaft, tip, bitG]), bow };
}

/** The sand-glass lying on its side: its end plates (wider than its waist), the posts at its sides, the bulbs and their waist. */
const GLASS = { plateR: 20, plateT: 5, plateY: 31, postX: 14, postR: 2.2, bulbR: 11.5, bulbL: 29, waist: 2.6 } as const;

/** The shadow board: the enamel plate with a recess cut to each chore's outline, over its dark floor. */
function trayGeometry(): { plate: BufferGeometry; floor: BufferGeometry } {
  const T = YOU.tray;
  const g = RECESS_GAP;
  const shape = rectShape(T, 6);
  // the key's recess: its bow's circle, the shank's slot and the bit's notch, as one outline
  const { c, bowY, bowR, shank, bit } = CHORES.key;
  const [kx, ky] = c;
  const r = bowR + g;
  const half = 3 + g;
  const yJoin = ky + bowY - Math.sqrt(r * r - half * half);
  const key = new Path();
  key.moveTo(kx - half, ky + shank[0] - g);
  key.lineTo(kx + bit.x[1] + g, ky + shank[0] - g);
  key.lineTo(kx + bit.x[1] + g, ky + bit.y[1] + g);
  key.lineTo(kx + half, ky + bit.y[1] + g);
  key.lineTo(kx + half, yJoin);
  key.absarc(kx, ky + bowY, r, Math.atan2(yJoin - ky - bowY, half), Math.atan2(yJoin - ky - bowY, -half) + Math.PI * 2, false);
  key.lineTo(kx - half, ky + shank[0] - g);
  shape.holes.push(key);
  // the sand-glass's own outline: its end plates wider than the posts' waist between them (a dog-bone)
  const gl = CHORES.glass;
  const [gx, gy] = gl.c;
  const pw = GLASS.plateR + g;
  const ww = GLASS.postX + GLASS.postR + g;
  const py = gl.half[1] + g;
  const pin = GLASS.plateY - GLASS.plateT / 2 - g;
  const glass = new Path();
  glass.moveTo(gx - pw, gy - py);
  glass.lineTo(gx + pw, gy - py);
  glass.lineTo(gx + pw, gy - pin);
  glass.lineTo(gx + ww, gy - pin);
  glass.lineTo(gx + ww, gy + pin);
  glass.lineTo(gx + pw, gy + pin);
  glass.lineTo(gx + pw, gy + py);
  glass.lineTo(gx - pw, gy + py);
  glass.lineTo(gx - pw, gy + pin);
  glass.lineTo(gx - ww, gy + pin);
  glass.lineTo(gx - ww, gy - pin);
  glass.lineTo(gx - pw, gy - pin);
  glass.closePath();
  shape.holes.push(glass);
  // the strut's own outline: a clevis at each end, the tube, the collar's bulge, the rod
  const st = CHORES.strut;
  const len = 2 * st.half[1] - 4;
  const y0 = st.c[1] - st.half[1] + 2;
  const sx = st.c[0];
  const [cw, cl] = STRUT.clevis;
  const outer = strutOuter(len);
  const steps: [number, number][] = [
    [cw / 2, 0],
    [cw / 2, cl],
    [STRUT.tube, cl],
    [STRUT.tube, outer - STRUT.collarL / 2],
    [STRUT.collar, outer - STRUT.collarL / 2],
    [STRUT.collar, outer + STRUT.collarL / 2],
    [STRUT.rod, outer + STRUT.collarL / 2],
    [STRUT.rod, len - cl],
    [cw / 2, len - cl],
    [cw / 2, len],
  ];
  const strut = new Path();
  const yy = (y: number) => y0 + y + (y === 0 ? -g : y === len ? g : 0);
  strut.moveTo(sx - steps[0][0] - g, yy(0));
  for (const [w, y] of steps) strut.lineTo(sx + w + g, yy(y));
  for (const [w, y] of [...steps].reverse()) strut.lineTo(sx - w - g, yy(y));
  strut.closePath();
  shape.holes.push(strut);
  return { plate: extrude(shape, TRAY_Z.floor - 0.5, TRAY_Z.plate, 1.2), floor: slab(T, YOU.top, TRAY_Z.floor, 6, 1) };
}

function useYouGeometry() {
  return useMemo(() => {
    const slabG = slab(YOU.slab, 0, YOU.top, 10, 3);
    const slabEdge = slab({ x0: YOU.slab.x0 + 2, x1: YOU.slab.x1 - 2, y0: YOU.slab.y0 - 0.5, y1: YOU.slab.y0 + 5 }, YOU.top - 6, YOU.top + 1, 2, 0.8);
    // the blotter: a paper pad with enamel corners
    const B = YOU.blotter;
    const blotter = slab(B, YOU.top, YOU.top + 2, 2, 0.5);
    const corners = merge(
      [
        [B.x0, B.y0, 1, 1],
        [B.x1, B.y0, -1, 1],
        [B.x0, B.y1, 1, -1],
        [B.x1, B.y1, -1, -1],
      ].map(([x, y, sx, sy]) => {
        const s = new Shape();
        s.moveTo(x, y);
        s.lineTo(x + 26 * sx, y);
        s.lineTo(x, y + 26 * sy);
        s.closePath();
        return extrude(s, YOU.top + 1, YOU.top + 3.2, 0.6);
      }),
    );

    // the lamp's base and its hooded head (posed by the head's aim)
    const base = (b: P3) => merge([disc(LAMP.baseR, YOU.top, YOU.top + 7, { cx: b[0], cy: b[1], bevel: 2.5 }), cylinderZ(9, YOU.top + 7, YOU.top + 18, b[0], b[1], 20)]);
    const hood = latheZ(
      [
        [0.01, 16],
        [7, 16],
        [9, 12],
        [12, 4],
        [20, -10],
        [LAMP.hoodR - 2, -26],
        [LAMP.hoodR, -30],
      ],
      40,
    );
    const hoodInner = latheZ(
      [
        [LAMP.hoodR - 1.5, -29.5],
        [LAMP.hoodR - 3.5, -26],
        [18.5, -10],
        [10.5, 4],
        [0.01, 6],
      ],
      40,
    );
    const bulb = latheZ(
      [
        [0.01, -2],
        [6, -4],
        [9, -10],
        [8.5, -16],
        [4.5, -20],
        [0.01, -21],
      ],
      24,
    );
    const capRing = ringFlat(7.5, 1.6, 0, 0, 15);

    // the laptop: base, keys, the lid (posed about its hinge)
    const L = YOU.laptop;
    const lapBase = slab(L, YOU.top, YOU.top + 8, 5, 2);
    const keys: BufferGeometry[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 11; c++) {
        const x = L.x0 + 12 + c * 10 + (r % 2) * 3;
        const y = L.y1 - 14 - r * 10;
        if (x + 8 > L.x1 - 10) continue;
        keys.push(slab({ x0: x, x1: x + 8, y0: y - 8, y1: y }, YOU.top + 8, YOU.top + 9.6, 1.2, 0.4));
      }
    }
    keys.push(slab({ x0: L.x0 + 34, x1: L.x0 + 90, y0: L.y1 - 58, y1: L.y1 - 50 }, YOU.top + 8, YOU.top + 9.6, 1.2, 0.4));
    const pad = planeOn({ x0: (L.x0 + L.x1) / 2 - 20, x1: (L.x0 + L.x1) / 2 + 20, y0: L.y0 + 5, y1: L.y0 + 25 }, YOU.top + 8.15);
    const lidW = L.x1 - L.x0;
    const lid = slab({ x0: -lidW / 2, x1: lidW / 2, y0: 0, y1: YOU.lidH }, -4, 0, 5, 1.2);
    const screen = plane(lidW - 10, YOU.lidH - 12, 0, YOU.lidH / 2 + 2, 0.25);

    // the chore tray (a shadow board) and its chores
    const tray = trayGeometry();
    const key = keyGeometry();
    const gx = CHORES.glass.c[0];
    const gy = CHORES.glass.c[1];
    // lying on its side across its end plates: the axis along y at the plates' radius over the recess floor
    const gz = TRAY_Z.floor + GLASS.plateR;
    const lathe = (profile: [number, number][]) => {
      const g = latheZ(profile, 32);
      g.rotateX(Math.PI / 2);
      g.translate(gx, gy, gz);
      return g;
    };
    const glass = lathe([
      [0.01, -GLASS.bulbL],
      [GLASS.bulbR - 2, -GLASS.bulbL + 2],
      [GLASS.bulbR, -GLASS.bulbL * 0.55],
      [GLASS.waist, -1.6],
      [GLASS.waist, 1.6],
      [GLASS.bulbR, GLASS.bulbL * 0.55],
      [GLASS.bulbR - 2, GLASS.bulbL - 2],
      [0.01, GLASS.bulbL],
    ]);
    // the sand in the lower bulb: the waiting, as tone inside the glass
    const sand = lathe([
      [0.01, -GLASS.bulbL + 1.4],
      [GLASS.bulbR - 3, -GLASS.bulbL + 3.4],
      [GLASS.bulbR - 2.6, -GLASS.bulbL * 0.6],
      [0.01, -GLASS.bulbL * 0.42],
    ]);
    const glassEnds = merge(
      [-1, 1].map((k) => {
        const g = cylinderZ(GLASS.plateR, -GLASS.plateT / 2, GLASS.plateT / 2, 0, 0, 32);
        g.rotateX(Math.PI / 2);
        g.translate(gx, gy + k * GLASS.plateY, gz);
        return g;
      }),
    );
    const glassPosts = merge(
      [-1, 1].map((k) =>
        tube(
          [
            [gx + k * GLASS.postX, gy - GLASS.plateY, gz],
            [gx + k * GLASS.postX, gy + GLASS.plateY, gz],
          ],
          GLASS.postR,
          4,
          8,
        ),
      ),
    );

    // the in-tray: a graphite tray with the replies already in it
    const I = YOU.inTray;
    // a dark floor inside an enamel rim: empty, it is a hollow; a reply lands on it as the only light paper
    // its floor is the desk's own graphite under a gradient (lighter at the open south lip, darker under the north rim),
    // so the empty tray reads as a recess in the desk, never as a second dark screen beside the laptop (still (a)'s critic)
    const inTrayFloor = fitUv(slab({ x0: -(I.x1 - I.x0) / 2, x1: (I.x1 - I.x0) / 2, y0: -(I.y1 - I.y0) / 2, y1: (I.y1 - I.y0) / 2 }, YOU.top, YOU.top + 3, 4, 1), I.x1 - I.x0, I.y1 - I.y0);
    inTrayFloor.translate(rectC(I)[0], rectC(I)[1], 0);
    const inTray = frame(I, 3.5, YOU.top, YOU.top + 18, 4, 1);
    const slip1 = (() => {
      const g = plane(80, 52, 0, 0, 0);
      g.rotateZ(-0.1);
      g.translate(rectC(I)[0] + 2, rectC(I)[1] - 14, YOU.top + 4.2);
      return g;
    })();
    return { slabG, slabEdge, blotter, corners, base, hood, hoodInner, bulb, capRing, lapBase, keys: merge(keys), pad, lid, screen, tray, key, glass, sand, glassEnds, glassPosts, inTray, inTrayFloor, slip1 };
  }, []);
}

/** The strut's geometry for a length (the tray's, or extended under the lid). */
function useStrutGeometry(len: number) {
  return useMemo(() => strutParts(len), [len]);
}

/** The strut's placement: from a to b, its local +y along the segment. */
function strutPlacement(pose: YouPose): { p: P3; q: Quaternion; len: number } {
  const { a, b } = strutEnds(pose);
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  return { p: a, q: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()), len: Math.round(len * 4) / 4 };
}

/** The in-tray floor's gradient (a map over the desk's graphite): the north rim's shade falling to the south lip, the side walls' a little. */
function inTrayGradient(): Texture {
  const w = YOU.inTray.x1 - YOU.inTray.x0;
  const h = YOU.inTray.y1 - YOU.inTray.y0;
  return texture(
    w,
    h,
    (g) => {
      const v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, '#9C9C9C');
      v.addColorStop(0.55, '#E2E2E2');
      v.addColorStop(1, '#FFFFFF');
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
      const s = g.createLinearGradient(0, 0, w, 0);
      s.addColorStop(0, 'rgba(0,0,0,0.16)');
      s.addColorStop(0.18, 'rgba(0,0,0,0)');
      s.addColorStop(0.82, 'rgba(0,0,0,0)');
      s.addColorStop(1, 'rgba(0,0,0,0.16)');
      g.fillStyle = s;
      g.fillRect(0, 0, w, h);
    },
    4,
  );
}

/**
 * Your desk's own surfaces: the slab's brushed graphite top, the laptop's dark glass (dim, a key-light sheen, no
 * transcript), the sand, the in-tray's floor. A set per mode the kit steps: full, on the kit's `own` ramp (beat 3 steps your
 * desk down with the folders while a fix is in focus: actOne.ts FOCUS_A), the beat's set and the late one (part 2: under
 * beat 7's and 10.2's cards, YOU_MODES_FROM).
 */
function useYouMats() {
  const grad = useMemo(() => inTrayGradient(), []);
  const mats = useMemo(() => {
    const make = (stepped: boolean | 'own' | 'late') => {
      const floor = paper(grad, '#3A3D3C', { roughness: 0.66, fibre: 0, stepped });
      floor.metalness = 0.3;
      return { slab: graphite('#2C2F2E', { roughness: 0.62, metalness: 0.35, brush: 0.07, stepped }), screen: matte('#4B5250', 0.34, 0, stepped), sand: matte('#8E8676', 0.85, 0, stepped), floor };
    };
    return { full: make(false), own: make('own'), stepped: make(true), late: make('late') };
  }, [grad]);
  useLayoutEffect(
    () => () => {
      for (const set of Object.values(mats)) Object.values(set).forEach((x) => x.dispose());
      grad.dispose();
    },
    [mats, grad],
  );
  return mats;
}

/** A chore resting at `rest` (desk coordinates), or on its post (act one): offset, turned and tilted about its own centre, squashed as it lands. */
function Chore({ rest, held, flight, quaternion, children }: { rest: P3; held: number; flight?: ChoreFlight | null; quaternion?: Quaternion; children: ReactNode }) {
  if (held <= 0.01 && !flight) return null;
  const off = flight?.off ?? [0, 0, (1 - held) * 40];
  const sq = flight?.squash ?? 0;
  return (
    <group position={[rest[0] + off[0], rest[1] + off[1], rest[2] + off[2]]} quaternion={quaternion}>
      <group rotation={[flight?.tilt ?? 0, 0, flight?.yaw ?? 0]} scale={[1 + sq / 2, 1 + sq / 2, 1 - sq]}>
        {quaternion ? children : <group position={[-rest[0], -rest[1], -rest[2]]}>{children}</group>}
      </group>
    </group>
  );
}

/**
 * From part 2 (bar 44) your desk's own surfaces step on whichever set your desk rides (the cards of beat 7 and 10.2 put it on
 * the beat's set); part 1, signed off, stepped them only on the own ramp (its counterfactual cards left them full).
 */
export const YOU_MODES_FROM = at(44);
/** Your desk: on the set its focus id rides (state.ts FocusId 'you'; kit.tsx isStepped), else the full set. */
/** The lamp's opaque parts draw after every hatch pass (Trace.tsx draws its punch at 10, the pit and the stamp at 11-12). */
const LAMP_ORDER = 13;

export function YourDesk({ s, pose }: { s: DeskState; pose?: YouPose }) {
  const on = isStepped(s.step, 'you');
  return (
    <Step on={on}>
      <YourDeskBody s={s} given={pose} mode={s.f >= YOU_MODES_FROM ? on : on === 'own' ? 'own' : false} />
    </Step>
  );
}

function YourDeskBody({ s, given, mode }: { s: DeskState; given?: YouPose; mode: boolean | 'own' | 'late' }) {
  const m = useDeskMats();
  const sets = useYouMats();
  const own = mode === 'own' ? sets.own : mode === 'late' ? sets.late : mode ? sets.stepped : sets.full;
  const g = useYouGeometry();
  const pose = useMemo(() => given ?? youPoseAt(s.f), [given, s.f]);
  const lampG = useLampGeometry(pose.lamp);
  const strut = strutPlacement(pose);
  const strutG = useStrutGeometry(strut.len);
  const baseG = useMemo(() => g.base(pose.lamp.base), [g, pose.lamp.base]);
  const { head, aim } = pose.lamp;
  // the hood's orientation: its opening (local -z) aimed from the head at the aim point
  const hoodQ = useMemo(() => {
    const d = new Vector3(aim[0] - head[0], aim[1] - head[1], aim[2] - head[2]).normalize();
    return new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), d);
  }, [head, aim]);
  const bulb = pose.bulb ?? EMIT.bulbMax * s.lamp;
  useLayoutEffect(() => {
    // the bulb follows your attention: it blooms while it attends in act one; after the turn one step dimmer until the reply lands
    m.bulb.color.set(LIGHT_HEX.yours).multiplyScalar(bulb);
  }, [m, bulb]);
  const L = YOU.laptop;
  // shut: the lid swings on past upright and down over the keys, its screen face down on the base
  const shut = pose.lidShut ?? 0;
  const nudge = pose.trayNudge ?? 0;
  const keyRest: P3 = [CHORES.key.c[0], CHORES.key.c[1], TRAY_Z.floor];
  const glassRest: P3 = [CHORES.glass.c[0], CHORES.glass.c[1], TRAY_Z.floor];
  return (
    <group position={[pose.shift[0], pose.shift[1], 0]}>
      <mesh geometry={g.slabG} material={own.slab} />
      <mesh geometry={g.slabEdge} material={m.enamelShade} />
      <mesh geometry={g.blotter} material={m.paperShade} />
      <mesh geometry={g.corners} material={m.enamelShade} />
      {/* the lamp: its opaque parts drawn after the sign-off stamp's hatch (objects/Trace.tsx: its punch clears the depth
          over the hole, so a part drawn before it, the arm standing over the hole, was painted over by the pit; session 6,
          R2-L4-01); depth-tested as ever, so it still hides and is hidden as it stands */}
      <mesh geometry={baseG} material={m.enamel} renderOrder={LAMP_ORDER} />
      <mesh geometry={lampG.arms} material={m.graphite} renderOrder={LAMP_ORDER} />
      <mesh geometry={lampG.springG} material={m.steel} renderOrder={LAMP_ORDER} />
      <mesh geometry={lampG.joints} material={m.enamelShade} renderOrder={LAMP_ORDER} />
      <group position={[head[0], head[1], head[2]]} quaternion={hoodQ}>
        <mesh geometry={g.hood} material={m.enamel} renderOrder={LAMP_ORDER} />
        <mesh geometry={g.hoodInner} material={m.paperLit} renderOrder={LAMP_ORDER} />
        <mesh geometry={g.bulb} material={m.bulb} position={[0, 0, -pose.bulbOut]} />
        <mesh geometry={g.capRing} material={m.steel} renderOrder={LAMP_ORDER} />
      </group>
      {/* the laptop */}
      <mesh geometry={g.lapBase} material={m.graphiteDark} />
      <mesh geometry={g.keys} material={m.rubber} />
      <mesh geometry={g.pad} material={m.graphite} />
      <group position={[(L.x0 + L.x1) / 2, L.y1, YOU.top + 8]} rotation={[Math.PI / 2 - YOU.lidLean + (Math.PI / 2 + YOU.lidLean - 0.02) * shut, 0, 0]}>
        <mesh geometry={g.lid} material={m.graphiteDark} />
        <mesh geometry={g.screen} material={own.screen} />
      </group>
      {/* the chore tray, a shadow board, and the chores in it (or the strut propping the lid) */}
      {/* the tray nudges south 2 f after a chore lands in it (act one); a chore in the air flies on its own */}
      <group position={[0, -nudge, 0]}>
        <mesh geometry={g.tray.floor} material={m.graphiteDark} />
        <mesh geometry={g.tray.plate} material={m.enamelShade} />
      </group>
      <Chore rest={keyRest} held={pose.held.key} flight={pose.post?.key}>
        <group position={[0, pose.post?.key ? 0 : -nudge, 0]}>
          <mesh geometry={g.key.body} material={m.steel} />
          <mesh geometry={g.key.bow} material={m.steel} />
        </group>
      </Chore>
      <Chore rest={glassRest} held={pose.held.glass} flight={pose.post?.glass}>
        <group position={[0, pose.post?.glass ? 0 : -nudge, 0]}>
          <mesh geometry={g.glass} material={m.paper} />
          <mesh geometry={g.sand} material={own.sand} />
          <mesh geometry={g.glassEnds} material={m.graphite} />
          <mesh geometry={g.glassPosts} material={m.steel} />
        </group>
      </Chore>
      <Chore rest={strut.p} held={pose.held.strut} flight={pose.post?.strut} quaternion={strut.q}>
        <mesh geometry={strutG.tube} material={m.steel} />
        <mesh geometry={strutG.rod} material={m.steel} />
        <mesh geometry={strutG.collar} material={m.enamel} />
        <mesh geometry={strutG.clevis} material={m.enamelShade} />
        <mesh geometry={strutG.pins} material={m.graphiteDark} />
      </Chore>
      {/* the in-tray, where the Router's replies land: not on the desk in act one */}
      {pose.inTray && (
        <>
          <mesh geometry={g.inTrayFloor} material={own.floor} />
          <mesh geometry={g.inTray} material={m.enamelShade} />
          {pose.inTraySlip !== false && <mesh geometry={g.slip1} material={m.printed.inTray[0]} />}
        </>
      )}
    </group>
  );
}
