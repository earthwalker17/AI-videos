/**
 * You (synthesis §2, element sheet): no figure, a small desk with a bent-arm lamp (the film's only
 * Λ: its aim and pool are your attention, the bulb the only warm light), a laptop with its lid
 * open on its hinge (a dim screen: no transcript), the chore tray (the starter key, the sand-glass and the
 * lid strut still yours; the notes loop has gone: handed over at the turn), and the in-tray
 * where the Router's replies land: the only path to you.
 */
import { useLayoutEffect, useMemo } from 'react';
import { Quaternion, Shape, Vector3, type BufferGeometry } from 'three';
import { cylinderZ, disc, extrude, frame, latheZ, merge, plane, planeOn, ringFlat, slab, tube } from '../geom.ts';
import { EMIT, useDeskMats } from '../kit.tsx';
import { LAMP, YOU, rectC, type P3 } from '../layout.ts';
import { LIGHT_HEX } from '../pools.ts';
import type { DeskState } from '../state.ts';

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

    // the lamp: base, two arms of twin rods, the counterbalance spring, joints, the hooded head
    const base = merge([disc(LAMP.baseR, YOU.top, YOU.top + 7, { cx: LAMP.base[0], cy: LAMP.base[1], bevel: 2.5 }), cylinderZ(9, YOU.top + 7, YOU.top + 18, LAMP.base[0], LAMP.base[1], 20)]);
    const foot: P3 = [LAMP.base[0], LAMP.base[1], YOU.top + 16];
    const arms = merge([...rods(foot, LAMP.elbow, 9, 2.6), ...rods(LAMP.elbow, LAMP.head, 8, 2.4)]);
    const springG = spring(lerp3(foot, LAMP.elbow, 0.18), lerp3(foot, LAMP.elbow, 0.62), 3.2, 11);
    const joint = (p: P3, r: number) => {
      const d = new Vector3(LAMP.elbow[0] - LAMP.base[0], LAMP.elbow[1] - LAMP.base[1], 0).normalize();
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
    const joints = merge([joint(foot, 6), joint(LAMP.elbow, 6.5), joint(LAMP.head, 5)]);
    // the hood, a lathe opening along -z (posed by the head's aim)
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
    const bulb = (() => {
      const g = latheZ(
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
      return g;
    })();
    const capRing = ringFlat(7.5, 1.6, 0, 0, 15);

    // the laptop: base, keys, the lid (posed about its hinge), the strut propping it
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

    // the chore tray: enamel, three places, each item lying along y, at least 66 u long (56 px): the
    // starter key, the sand-glass, the lid strut (the notes loop has gone: handed over at the turn)
    const T = YOU.tray;
    const tw = T.x1 - T.x0;
    const ky = rectC(T)[1];
    const cell = (k: number) => T.x0 + tw * (1 / 6 + k / 3);
    const tray = merge([slab(T, YOU.top, YOU.top + 3, 5, 1), frame(T, 4, YOU.top, YOU.top + 12, 5, 1.2)]);
    const dividers = merge([1 / 3, 2 / 3].map((k) => slab({ x0: T.x0 + tw * k - 1.2, x1: T.x0 + tw * k + 1.2, y0: T.y0 + 4, y1: T.y1 - 4 }, YOU.top + 3, YOU.top + 8, 0.6, 0.3)));
    // the starter key: a wind-up key, its butterfly bow and a long shaft
    const kx = cell(0);
    const starter = (() => {
      const wing = (dx: number) => {
        const s = new Shape();
        s.absarc(kx + dx, ky + 22, 9, 0, Math.PI * 2, false);
        return extrude(s, YOU.top + 3, YOU.top + 6.5, 0.9);
      };
      return merge([
        wing(-10),
        wing(10),
        slab({ x0: kx - 7, x1: kx + 7, y0: ky + 14, y1: ky + 22 }, YOU.top + 3, YOU.top + 6.5, 1, 0.5),
        tube(
          [
            [kx, ky + 14, YOU.top + 5],
            [kx, ky - 40, YOU.top + 5],
          ],
          2.8,
          6,
          8,
        ),
        slab({ x0: kx, x1: kx + 8, y0: ky - 40, y1: ky - 32 }, YOU.top + 3, YOU.top + 7, 1, 0.4),
      ]);
    })();
    // the sand-glass, lying along y
    const gx = cell(1);
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
      g.translate(gx, ky, YOU.top + 15);
      return g;
    })();
    const glassEnds = merge(
      [-1, 1].map((k) => {
        const g = cylinderZ(13.5, -2, 2, 0, 0, 24);
        g.rotateX(Math.PI / 2);
        g.translate(gx, ky + k * 28, YOU.top + 15);
        return g;
      }),
    );
    const glassPosts = merge(
      [-1, 1].map((k) =>
        tube(
          [
            [gx + k * 10.5, ky - 28, YOU.top + 25],
            [gx + k * 10.5, ky + 28, YOU.top + 25],
          ],
          1.5,
          4,
          6,
        ),
      ),
    );
    // the lid strut: a rod with a clip at each end
    const sx = cell(2);
    const strut = merge([
      tube(
        [
          [sx, ky - 34, YOU.top + 5],
          [sx, ky + 34, YOU.top + 5],
        ],
        2.6,
        6,
        8,
      ),
      slab({ x0: sx - 7, x1: sx + 7, y0: ky + 30, y1: ky + 38 }, YOU.top + 3, YOU.top + 8, 1, 0.5),
      slab({ x0: sx - 7, x1: sx + 7, y0: ky - 38, y1: ky - 30 }, YOU.top + 3, YOU.top + 8, 1, 0.5),
    ]);

    // the in-tray: a graphite tray with the replies already in it
    const I = YOU.inTray;
    const inTray = merge([slab(I, YOU.top, YOU.top + 3, 4, 1), frame(I, 3.5, YOU.top, YOU.top + 18, 4, 1)]);
    const slip0 = (() => {
      const g = plane(80, 52, 0, 0, 0);
      g.rotateZ(0.06);
      g.translate(rectC(I)[0] - 2, rectC(I)[1] - 10, YOU.top + 3.4);
      return g;
    })();
    const slip1 = (() => {
      const g = plane(80, 52, 0, 0, 0);
      g.rotateZ(-0.1);
      g.translate(rectC(I)[0] + 2, rectC(I)[1] - 14, YOU.top + 4.2);
      return g;
    })();
    return {
      slabG,
      slabEdge,
      blotter,
      corners,
      base,
      arms,
      springG,
      joints,
      hood,
      hoodInner,
      bulb,
      capRing,
      lapBase,
      keys: merge(keys),
      pad,
      lid,
      screen,
      tray,
      dividers,
      starter,
      glass,
      glassEnds,
      glassPosts,
      strut,
      inTray,
      slip0,
      slip1,
    };
  }, []);
}

/** The hood's orientation: its opening (local -z) aimed from the head at the aim point. */
const HOOD_Q = (() => {
  const d = new Vector3(LAMP.aim[0] - LAMP.head[0], LAMP.aim[1] - LAMP.head[1], LAMP.aim[2] - LAMP.head[2]).normalize();
  return new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), d);
})();

export function YourDesk({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const g = useYouGeometry();
  useLayoutEffect(() => {
    // the bulb follows your attention: one step dimmer until the reply lands (below the bloom threshold here)
    m.bulb.color.set(LIGHT_HEX.yours).multiplyScalar(EMIT.bulbMax * s.lamp);
  }, [m, s.lamp]);
  const L = YOU.laptop;
  return (
    <group>
      <mesh geometry={g.slabG} material={m.rubber} />
      <mesh geometry={g.slabEdge} material={m.enamelShade} />
      <mesh geometry={g.blotter} material={m.paperShade} />
      <mesh geometry={g.corners} material={m.enamelShade} />
      {/* the lamp */}
      <mesh geometry={g.base} material={m.enamel} />
      <mesh geometry={g.arms} material={m.graphite} />
      <mesh geometry={g.springG} material={m.steel} />
      <mesh geometry={g.joints} material={m.enamelShade} />
      <group position={[LAMP.head[0], LAMP.head[1], LAMP.head[2]]} quaternion={HOOD_Q}>
        <mesh geometry={g.hood} material={m.enamel} />
        <mesh geometry={g.hoodInner} material={m.paperLit} />
        <mesh geometry={g.bulb} material={m.bulb} />
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
      {/* the chore tray */}
      <mesh geometry={g.tray} material={m.enamel} />
      <mesh geometry={g.dividers} material={m.enamelShade} />
      <mesh geometry={g.strut} material={m.steel} />
      <mesh geometry={g.starter} material={m.steel} />
      <mesh geometry={g.glass} material={m.paperLit} />
      <mesh geometry={g.glassEnds} material={m.graphite} />
      <mesh geometry={g.glassPosts} material={m.graphite} />
      {/* the in-tray */}
      <mesh geometry={g.inTray} material={m.enamelShade} />
      <mesh geometry={g.slip1} material={m.printed.inTray[0]} />
    </group>
  );
}
