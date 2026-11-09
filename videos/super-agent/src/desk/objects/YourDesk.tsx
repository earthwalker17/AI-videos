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
import { useLayoutEffect, useMemo } from 'react';
import { Path, Quaternion, Shape, Vector3, type BufferGeometry } from 'three';
import { youPoseAt } from '../actOne.ts';
import { cylinderZ, disc, dome, extrude, frame, latheZ, merge, plane, planeOn, rectShape, ringFlat, roundRect, slab, tube } from '../geom.ts';
import { EMIT, useDeskMats } from '../kit.tsx';
import { LAMP, YOU, rectC, type P3 } from '../layout.ts';
import { LIGHT_HEX } from '../pools.ts';
import type { DeskState } from '../state.ts';
import { CHORES, LAMP_FOOT_Z, RECESS_GAP, TRAY_Z, strutOnLid, type LampPose, type YouPose } from '../you.ts';

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

/** The lid strut: a telescoping prop along +y from 0 to `len`, an outer tube, the inner rod, an enamel collar and a clevis at each end. */
function strutParts(len: number) {
  const outer = Math.min(44, len * 0.6);
  return {
    tube: tube(
      [
        [0, 6, 0],
        [0, outer, 0],
      ],
      3.4,
      4,
      14,
    ),
    rod: tube(
      [
        [0, outer - 2, 0],
        [0, len - 6, 0],
      ],
      2.1,
      4,
      12,
    ),
    collar: (() => {
      const g = cylinderZ(4.4, -2.5, 2.5, 0, 0, 20);
      g.rotateX(Math.PI / 2);
      g.translate(0, outer, 0);
      return g;
    })(),
    clevis: merge(
      [0, len].map((y) => {
        const s = y === 0 ? 1 : -1;
        const g = slab({ x0: -5.5, x1: 5.5, y0: Math.min(y, y + s * 9), y1: Math.max(y, y + s * 9) }, -4.5, 4.5, 2, 1);
        return g;
      }),
    ),
    pins: merge(
      [3, len - 3].map((y) =>
        tube(
          [
            [-7.5, y, 0],
            [7.5, y, 0],
          ],
          1.6,
          2,
          10,
        ),
      ),
    ),
  };
}

/** The starter key lying north-south (desk coordinates): a ring bow north, a collar, the shank, a toothed bit south-east. */
function keyGeometry(): { body: BufferGeometry; bow: BufferGeometry } {
  const { c, bowY, bowR, shank, bit } = CHORES.key;
  const [kx, ky] = c;
  const z0 = TRAY_Z.floor;
  const z1 = TRAY_Z.floor + 4.6;
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
  const gl = CHORES.glass;
  shape.holes.push(roundRect(2 * (gl.half[0] + g), 2 * (gl.half[1] + g), 9, gl.c[0], gl.c[1], new Path()) as Path);
  const st = CHORES.strut;
  shape.holes.push(roundRect(2 * (st.half[0] + g), 2 * (st.half[1] + g), st.half[0] + g - 0.5, st.c[0], st.c[1], new Path()) as Path);
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
    const gz = TRAY_Z.floor + 13.5;
    const glass = (() => {
      const g = latheZ(
        [
          [0.01, -26],
          [10, -24],
          [11.5, -14],
          [2.4, -1.5],
          [2.4, 1.5],
          [11.5, 14],
          [10, 24],
          [0.01, 26],
        ],
        28,
      );
      g.rotateX(Math.PI / 2);
      g.translate(gx, gy, gz);
      return g;
    })();
    const glassEnds = merge(
      [-1, 1].map((k) => {
        const g = cylinderZ(13.5, -2, 2, 0, 0, 24);
        g.rotateX(Math.PI / 2);
        g.translate(gx, gy + k * 28, gz);
        return g;
      }),
    );
    const glassPosts = merge(
      [-1, 1].map((k) =>
        tube(
          [
            [gx + k * 10.5, gy - 28, gz + 10],
            [gx + k * 10.5, gy + 28, gz + 10],
          ],
          1.5,
          4,
          6,
        ),
      ),
    );

    // the in-tray: a graphite tray with the replies already in it
    const I = YOU.inTray;
    const inTray = merge([slab(I, YOU.top, YOU.top + 3, 4, 1), frame(I, 3.5, YOU.top, YOU.top + 18, 4, 1)]);
    const slip1 = (() => {
      const g = plane(80, 52, 0, 0, 0);
      g.rotateZ(-0.1);
      g.translate(rectC(I)[0] + 2, rectC(I)[1] - 14, YOU.top + 4.2);
      return g;
    })();
    return { slabG, slabEdge, blotter, corners, base, hood, hoodInner, bulb, capRing, lapBase, keys: merge(keys), pad, lid, screen, tray, key, glass, glassEnds, glassPosts, inTray, slip1 };
  }, []);
}

/** The strut's geometry for a length (the tray's, or extended under the lid). */
function useStrutGeometry(len: number) {
  return useMemo(() => strutParts(len), [len]);
}

/** The strut's placement: from a to b, its local +y along the segment. */
function strutPlacement(pose: YouPose): { p: P3; q: Quaternion; len: number } {
  const s = CHORES.strut;
  const [a, b]: [P3, P3] = pose.strut === 'lid' ? [strutOnLid().a, strutOnLid().b] : [[s.c[0], s.c[1] - s.half[1] + 2, TRAY_Z.floor + 4.4], [s.c[0], s.c[1] + s.half[1] - 2, TRAY_Z.floor + 4.4]];
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  return { p: a, q: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()), len: Math.round(len * 4) / 4 };
}

export function YourDesk({ s, pose: given }: { s: DeskState; pose?: YouPose }) {
  const m = useDeskMats();
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
  const drop = (held: number) => (1 - held) * 40;
  return (
    <group position={[pose.shift[0], pose.shift[1], 0]}>
      <mesh geometry={g.slabG} material={m.rubber} />
      <mesh geometry={g.slabEdge} material={m.enamelShade} />
      <mesh geometry={g.blotter} material={m.paperShade} />
      <mesh geometry={g.corners} material={m.enamelShade} />
      {/* the lamp */}
      <mesh geometry={baseG} material={m.enamel} />
      <mesh geometry={lampG.arms} material={m.graphite} />
      <mesh geometry={lampG.springG} material={m.steel} />
      <mesh geometry={lampG.joints} material={m.enamelShade} />
      <group position={[head[0], head[1], head[2]]} quaternion={hoodQ}>
        <mesh geometry={g.hood} material={m.enamel} />
        <mesh geometry={g.hoodInner} material={m.paperLit} />
        <mesh geometry={g.bulb} material={m.bulb} position={[0, 0, -pose.bulbOut]} />
        <mesh geometry={g.capRing} material={m.steel} />
      </group>
      {/* the laptop */}
      <mesh geometry={g.lapBase} material={m.graphiteDark} />
      <mesh geometry={g.keys} material={m.rubber} />
      <mesh geometry={g.pad} material={m.graphite} />
      <group position={[(L.x0 + L.x1) / 2, L.y1, YOU.top + 8]} rotation={[Math.PI / 2 - YOU.lidLean, 0, 0]}>
        <mesh geometry={g.lid} material={m.graphiteDark} />
        <mesh geometry={g.screen} material={m.screen} />
      </group>
      {/* the chore tray, a shadow board, and the chores in it (or the strut propping the lid) */}
      <mesh geometry={g.tray.floor} material={m.graphiteDark} />
      <mesh geometry={g.tray.plate} material={m.enamel} />
      {pose.held.key > 0.01 && (
        <group position={[0, 0, drop(pose.held.key)]}>
          <mesh geometry={g.key.body} material={m.steel} />
          <mesh geometry={g.key.bow} material={m.steel} />
        </group>
      )}
      {pose.held.glass > 0.01 && (
        <group position={[0, 0, drop(pose.held.glass)]}>
          <mesh geometry={g.glass} material={m.paperLit} />
          <mesh geometry={g.glassEnds} material={m.graphite} />
          <mesh geometry={g.glassPosts} material={m.graphite} />
        </group>
      )}
      {pose.held.strut > 0.01 && (
        <group position={[strut.p[0], strut.p[1], strut.p[2] + drop(pose.held.strut)]} quaternion={strut.q}>
          <mesh geometry={strutG.tube} material={m.steel} />
          <mesh geometry={strutG.rod} material={m.steel} />
          <mesh geometry={strutG.collar} material={m.enamel} />
          <mesh geometry={strutG.clevis} material={m.enamelShade} />
          <mesh geometry={strutG.pins} material={m.graphiteDark} />
        </group>
      )}
      {/* the in-tray, where the Router's replies land: not on the desk in act one */}
      {pose.inTray && (
        <>
          <mesh geometry={g.inTray} material={m.enamelShade} />
          {pose.inTraySlip !== false && <mesh geometry={g.slip1} material={m.printed.inTray[0]} />}
        </>
      )}
    </group>
  );
}
