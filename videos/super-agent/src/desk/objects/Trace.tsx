/**
 * The sign-off (desk/summary.ts; STORYBOARD 11.1): the request's route drawn once, inked into the
 * beds of the channels it used (the feed, the intake conveyor, the stub row's edge, the rail and the
 * ramp's groove, the bay's groove; the report's flight up to the mouth, the reply chute's bed), a
 * flat ink line that tapers thick to thin the way it went: vermilion going out, green coming home
 * from the bay's report port. It is the only thing that moves; the stamp on your desk and its green on
 * the reply in your in-tray (green means sign-off only); the chores where they were handed over (the
 * starter key on the intake's gate with the Proactive plate, the sand-glass on the bug bay's job
 * rail with the Productive plate); the fast gate's spike with the noise it dropped; the request's bay
 * capped, its work light out.
 */
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Shape } from 'three';
import { cylinderZ, disc, extrude, latheZ, merge, plane, slab, tube } from '../geom.ts';
import { HEX, matte } from '../gl/materials.ts';
import { ID_EM, INK, print, texture } from '../gl/text.ts';
import { useDeskMats, useDeskSets } from '../kit.tsx';
import { BAYS, YOU, rectC, type P3 } from '../layout.ts';
import { polylineAt } from '../state.ts';
import { DOCKED, ROUTE_HOME, ROUTE_OUT, type SummaryState } from '../summary.ts';

/** The reply the stamp signs off: the request's (the teaching chain's ID, as a mark at 0.5×). */
const SLIPS_D = { reply: '#0405' } as const;
const SEG = 200;
/** The trace's width, thick where the leg set out to thin where it arrived (u; about 6 to 2 px at 0.64×). */
const TRACE_W = [9.5, 3] as const;
/** The lamp-lit slip's albedo: under your lamp's warm white it lands on lit paper (#E4DFD3), never amber. */
const SLIP_HEX = '#9FA1A0';
/** The signed reply in your in-tray: its ID along the top, the green stamp below it (never over the ID). */
const REPLY_D = { l: 104, w: 72 } as const;

/**
 * A flat ink ribbon along a route (normal up), `n` quads by arc length, its width tapering from w0 to
 * w1; drawn progressively by its draw range (6 indices a quad).
 */
function ribbon(pts: readonly P3[], n: number, w0: number, w1: number): BufferGeometry {
  const pos = new Float32Array((n + 1) * 2 * 3);
  const nor = new Float32Array((n + 1) * 2 * 3);
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const { p } = polylineAt(pts, t);
    const a = polylineAt(pts, Math.max(0, t - 0.004)).p;
    const b = polylineAt(pts, Math.min(1, t + 0.004)).p;
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const w = (w0 + (w1 - w0) * t) / 2;
    for (const [k, sgn] of [
      [0, 1],
      [1, -1],
    ] as const) {
      const o = (i * 2 + k) * 3;
      pos[o] = p[0] - dy * w * sgn;
      pos[o + 1] = p[1] + dx * w * sgn;
      pos[o + 2] = p[2];
      nor[o + 2] = 1;
    }
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** A key lying flat (ring bow, shank, toothed bit), long along +y, at a point. */
function keyAt(p: P3, len = 70): BufferGeometry {
  const [x, y, z] = p;
  const bit = new Shape();
  bit.moveTo(x + 2, y - len / 2);
  bit.lineTo(x + 15, y - len / 2);
  bit.lineTo(x + 15, y - len / 2 + 5);
  bit.lineTo(x + 10, y - len / 2 + 5);
  bit.lineTo(x + 10, y - len / 2 + 10);
  bit.lineTo(x + 15, y - len / 2 + 10);
  bit.lineTo(x + 15, y - len / 2 + 17);
  bit.lineTo(x + 2, y - len / 2 + 17);
  bit.closePath();
  return merge([
    disc(13, z, z + 4.5, { inner: 6, cx: x, cy: y + len / 2 - 13, bevel: 1.2 }),
    tube(
      [
        [x, y + len / 2 - 26, z + 2.3],
        [x, y - len / 2, z + 2.3],
      ],
      2.3,
      4,
      10,
    ),
    extrude(bit, z, z + 4, 0.6),
  ]);
}

/** A sand-glass lying along y. */
function glassAt(p: P3): { glass: BufferGeometry; ends: BufferGeometry } {
  const [x, y, z] = p;
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
    24,
  );
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z + 13.5);
  const ends = merge(
    [-1, 1].map((k) => {
      const e = cylinderZ(13.5, -2, 2, 0, 0, 24);
      e.rotateX(Math.PI / 2);
      e.translate(x, y + k * 28, z + 13.5);
      return e;
    }),
  );
  return { glass: g, ends };
}

export function Trace({ a, printFamily }: { a: SummaryState; printFamily: string }) {
  const m = useDeskMats();
  const sets = useDeskSets();
  const gl = useThree((s) => s.gl);
  const inks = useMemo(() => {
    const ink = (hex: string) => {
      const x = matte(hex, 0.85);
      x.polygonOffset = true;
      x.polygonOffsetFactor = -2;
      x.polygonOffsetUnits = -2;
      return x;
    };
    return { out: ink(HEX.vermilion), home: ink(HEX.green) };
  }, []);
  const g = useMemo(() => {
    const route = (pts: readonly P3[]) => ribbon(pts, SEG, TRACE_W[0], TRACE_W[1]);
    const I = YOU.inTray;
    const sx = I.x0 - 34;
    const sy = rectC(I)[1] + 6;
    // the stamp: a rubber pad, a graphite stem, an enamel knob (it rests beside the in-tray)
    const stamp = { pad: slab({ x0: sx - 18, x1: sx + 18, y0: sy - 14, y1: sy + 14 }, YOU.top, YOU.top + 8, 3, 1.2), stem: cylinderZ(5, YOU.top + 8, YOU.top + 34, sx, sy, 16), knob: disc(11, YOU.top + 34, YOU.top + 42, { cx: sx, cy: sy, bevel: 3 }) };
    // the request's reply (#0405), on top in the tray, and its green: a ring and a tick at its east end
    const reply = plane(REPLY_D.l, REPLY_D.w, rectC(I)[0], I.y1 - 44, YOU.top + 7.2, 0.06);
    const mark = plane(34, 34, rectC(I)[0] + 28, I.y1 - 62, YOU.top + 7.6, 0.06);
    // the fast gate's spike and the noise it dropped
    const [kx, ky] = DOCKED.spike;
    const spike = merge([disc(20, 0, 4, { cx: kx, cy: ky, bevel: 1.2 }), cylinderZ(2.6, 4, 84, kx, ky, 12, 0.4)]);
    const impaled = merge(
      Array.from({ length: 7 }, (_, i) => {
        const p = plane(52, 24, 0, 0, 0);
        p.rotateZ(i * 0.9 + 0.3);
        p.translate(kx + Math.cos(i * 2.1) * 4, ky + Math.sin(i * 2.1) * 4, 8 + i * 3.2);
        return p;
      }),
    );
    const key = keyAt(DOCKED.key);
    const glass = glassAt(DOCKED.glass);
    const plateAt = (p: P3, dx: number) => slab({ x0: p[0] + dx - 48, x1: p[0] + dx + 48, y0: p[1] - 15, y1: p[1] + 15 }, 0, 5, 3, 1.4);
    const plateFace = (p: P3, dx: number) => plane(92, 26, p[0] + dx, p[1], 5.1);
    return {
      out: route(ROUTE_OUT),
      home: route(ROUTE_HOME),
      stamp,
      reply,
      mark,
      spike,
      impaled,
      key,
      glass,
      plates: merge([plateAt(DOCKED.key, 62), plateAt(DOCKED.glass, 64)]),
      faces: [plateFace(DOCKED.key, 62), plateFace(DOCKED.glass, 64)],
      // the request's bay has capped: an enamel cap over its work slot's slit
      cap: slab({ x0: BAYS.bug.slot.x0 + 3, x1: BAYS.bug.slot.x1 - 3, y0: rectC(BAYS.bug.slot)[1] - 11, y1: rectC(BAYS.bug.slot)[1] + 11 }, 30, 34, 2, 1),
    };
  }, []);
  const tex = useMemo(() => {
    const an = Math.min(8, gl.capabilities.getMaxAnisotropy());
    // the trait plates engrave their chore's outline (no word at this distance): the starter key, the sand-glass
    const plate = (kind: 'key' | 'glass') =>
      texture(
        92,
        26,
        (c) => {
          c.strokeStyle = INK;
          c.lineWidth = 2.4;
          c.lineCap = 'round';
          c.beginPath();
          if (kind === 'key') {
            c.arc(30, 13, 6.5, 0, Math.PI * 2);
            c.moveTo(36.5, 13);
            c.lineTo(66, 13);
            c.lineTo(66, 19);
            c.moveTo(58, 13);
            c.lineTo(58, 18);
          } else {
            c.moveTo(34, 6);
            c.lineTo(58, 6);
            c.lineTo(46, 13);
            c.lineTo(58, 20);
            c.lineTo(34, 20);
            c.lineTo(46, 13);
            c.closePath();
          }
          c.stroke();
        },
        an,
      );
    return {
      mark: texture(
        40,
        40,
        (c) => {
          c.strokeStyle = HEX.green;
          c.lineWidth = 3.4;
          c.beginPath();
          c.arc(20, 20, 16, 0, Math.PI * 2);
          c.stroke();
          c.beginPath();
          c.moveTo(11, 21);
          c.lineTo(17, 27);
          c.lineTo(29, 13);
          c.stroke();
        },
        an,
        'transparent',
      ),
      reply: texture(REPLY_D.l, REPLY_D.w, (c) => print(c, printFamily, SLIPS_D.reply, 7, 32, ID_EM, 700, INK), an),
      proactive: plate('key'),
      productive: plate('glass'),
    };
  }, [gl, printFamily]);
  const mats = useMemo(() => {
    const markMat = matte(HEX.green, 0.8);
    markMat.map = tex.mark;
    markMat.transparent = true;
    markMat.depthWrite = false;
    const face = (t: typeof tex.proactive) => {
      const f = matte('#FFFFFF', 0.4);
      f.map = t;
      f.color.set(HEX.enamel);
      return f;
    };
    const reply = matte('#FFFFFF', 0.9);
    reply.map = tex.reply;
    reply.color.set(SLIP_HEX);
    return { mark: markMat, reply, proactive: face(tex.proactive), productive: face(tex.productive) };
  }, [tex]);
  useLayoutEffect(
    () => () => {
      inks.out.dispose();
      inks.home.dispose();
      for (const x of Object.values(mats)) x.dispose();
      for (const t of Object.values(tex)) t.dispose();
    },
    [inks, mats, tex],
  );
  // the drawn part of each leg, by arc length along its tube
  useLayoutEffect(() => {
    g.out.setDrawRange(0, Math.round(a.out * SEG) * 6);
    g.home.setDrawRange(0, Math.round(a.home * SEG) * 6);
  }, [g, a.out, a.home]);
  // the request's bay has capped: its work light is out (the slot keeps its glass, unlit)
  useLayoutEffect(() => {
    for (const set of [sets.full, sets.stepped]) set.slotBug.color.set('#2A2D2C');
  }, [sets]);
  return (
    <group>
      {a.out > 0 && <mesh geometry={g.out} material={inks.out} renderOrder={1} />}
      {a.home > 0 && <mesh geometry={g.home} material={inks.home} renderOrder={1} />}
      <mesh geometry={g.cap} material={sets.stepped.enamelShade} />
      <group position={[0, 0, a.stamp * -6]}>
        <mesh geometry={g.stamp.pad} material={m.rubber} />
        <mesh geometry={g.stamp.stem} material={m.graphite} />
        <mesh geometry={g.stamp.knob} material={m.enamel} />
      </group>
      <mesh geometry={g.reply} material={mats.reply} />
      {a.ink > 0 && <mesh geometry={g.mark} material={mats.mark} renderOrder={2} />}
      <mesh geometry={g.spike} material={m.steel} />
      <mesh geometry={g.impaled} material={m.paperShade} />
      <mesh geometry={g.key} material={m.steel} />
      <mesh geometry={g.glass.glass} material={m.paper} />
      <mesh geometry={g.glass.ends} material={m.graphite} />
      <mesh geometry={g.plates} material={m.enamelShade} />
      <mesh geometry={g.faces[0]} material={mats.proactive} />
      <mesh geometry={g.faces[1]} material={mats.productive} />
    </group>
  );
}
