/**
 * The sign-off (desk/summary.ts; STORYBOARD 11.1): the request's route drawn once, inked into the
 * beds of the channels it used, one continuous run per leg (a curve drawn by arc length, no steps or
 * jogs) that tapers thick to thin the way it went, with a meniscus at its edges, a round tail and a
 * round nib at its drawing head: vermilion going out (the feed, the belt, across the throat into the
 * print head, along the window, round the reel's rim where the tape winds on, over the dispatch housing,
 * down the ramp's north lane and the groove into the bug bay), green coming home through the Register
 * (up the groove beside it and the ramp, along the rails to the window, through the print head, out
 * along the index arm into the reply chute, down onto the slip your stamp signed), held to one value
 * under your lamp instead of washing out. It is the only thing that
 * moves; the stamp on your desk and its green on the reply in your in-tray (green means sign-off only);
 * the chores where they were handed over (the starter key on the intake's gate with the Proactive
 * plate, the sand-glass on the bug bay's job rail with the Productive plate); the fast gate's spike with
 * the noise it dropped; the request's bay capped, its work light out.
 */
import { clamp, easings } from '@aiv/core';
import type { Curve } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, CircleGeometry, DataTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Shape } from 'three';
import { LIGHTS } from '../DeskWorld.tsx';
import { cylinderZ, disc, extrude, latheZ, merge, plane, slab, tube } from '../geom.ts';
import { HEX, matte, paper } from '../gl/materials.ts';
import { ID_EM, INK, print, texture } from '../gl/text.ts';
import { useDeskMats, useDeskSets } from '../kit.tsx';
import { BAYS, KEY, YOU, rectC, type P3 } from '../layout.ts';
import { poolsAt } from '../pools.ts';
import { DOCKED, JOB_RAIL, LEGS, STAMP, TRACE_INK, inkHold, inkLight, legAt, rampEdgeZ, summaryDeskState, traceWidthAt, type SummaryState } from '../summary.ts';

/** The reply the stamp signs off: the request's (the teaching chain's ID, as a mark at 0.5×). */
const SLIPS_D = { reply: '#0405' } as const;
/** Quads per leg, by arc length (about 1.6 u each: shorter than the nib's radius, so the ribbon's end hides under it). */
const SEG = 1040;
/** The light the ink takes from the key and the fill alone, against which a light pool's lift is held (summary.ts inkHold). */
const INK_K = inkLight(LIGHTS.key, LIGHTS.fill, KEY);
/** The lamp-lit slip's albedo: under your lamp's warm white it lands on lit paper (#E4DFD3), never amber. */
const SLIP_HEX = '#9FA1A0';
/** The signed reply in your in-tray: its ID along the top, the green stamp below it (never over the ID). */
const REPLY_D = { l: 104, w: 72 } as const;

/**
 * A flat ink ribbon along a leg (normal up), `n` quads evenly spaced in arc length, its width tapering
 * from the leg's start to its end; drawn progressively by its draw range (6 indices a quad). Its width
 * runs across the leg's way in plan, and where the leg drops steeply (off the ramp's top, a door) it
 * keeps the side it had, so it never twists. u runs along it (its arc fraction), v across it (0..1).
 */
function ribbon(leg: Curve<P3>, n: number): BufferGeometry {
  const pos = new Float32Array((n + 1) * 2 * 3);
  const nor = new Float32Array((n + 1) * 2 * 3);
  const uv = new Float32Array((n + 1) * 2 * 2);
  const idx: number[] = [];
  let side: [number, number] = [0, 1];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = legAt(leg, t);
    const a = legAt(leg, Math.max(0, t - 0.5 / n));
    const b = legAt(leg, Math.min(1, t + 0.5 / n));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const l = Math.hypot(dx, dy);
    // a mostly vertical stretch keeps the previous side
    if (l > 0.35 * Math.hypot(dx, dy, dz) && l > 1e-6) side = [-dy / l, dx / l];
    const w = traceWidthAt(t) / 2;
    for (const [k, sgn] of [
      [0, 1],
      [1, -1],
    ] as const) {
      const o = (i * 2 + k) * 3;
      pos[o] = p[0] + side[0] * w * sgn;
      pos[o + 1] = p[1] + side[1] * w * sgn;
      // on the ramp's curved bed each edge lies on the bed itself (a flat ribbon across its slope would half sink into it)
      pos[o + 2] = rampEdgeZ(p, pos[o]) ?? p[2];
      nor[o + 2] = 1;
      uv[(i * 2 + k) * 2] = t;
      uv[(i * 2 + k) * 2 + 1] = k;
    }
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** The meniscus map's texels along a leg (u) and across it (v). */
const MEN = { w: 512, h: 16 } as const;
const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/**
 * The ink's meniscus across the run (v): a hair darker at its edges where the ink pooled and a soft
 * lighter core, with a faint drag of the nib along it (u, in 64 steps along the leg); deterministic, no
 * randomness. Along the run each texel also carries how much of its albedo the ink keeps there under the
 * frame's light pools (`hold`, linear), so the ink holds one value along its run (summary.ts inkHold).
 */
function meniscus(): DataTexture {
  const t = new DataTexture(new Uint8Array(MEN.w * MEN.h * 4), MEN.w, MEN.h);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = LinearFilter;
  t.minFilter = LinearFilter;
  return t;
}
function fillMeniscus(t: DataTexture, hold: Float32Array): void {
  const data = t.image.data as Uint8Array;
  for (let y = 0; y < MEN.h; y++) {
    const v = (y + 0.5) / MEN.h;
    const edge = Math.min(v, 1 - v);
    const k = edge < 0.14 ? 0.8 + (0.2 * edge) / 0.14 : 1;
    for (let x = 0; x < MEN.w; x++) {
      const drag = 1 - 0.035 * (((Math.imul((x >> 3) * 7 + y * 13 + 3, 2654435761) >>> 24) & 255) / 255);
      const val = Math.round(255 * toSrgb(toLinear(k * drag) * hold[x]));
      const o = (y * MEN.w + x) * 4;
      data[o] = val;
      data[o + 1] = val;
      data[o + 2] = val;
      data[o + 3] = 255;
    }
  }
  t.needsUpdate = true;
}

/** The point, width and arc fraction of a leg drawn to `a` (the head's exact point: the ribbon's whole quads end under its nib). */
function headOf(leg: Curve<P3>, a: number): { p: P3; w: number; t: number } {
  return { p: legAt(leg, a), w: traceWidthAt(a), t: a };
}
/** How far the pen's first blot has spread as a leg sets out: its tail and nib grow with the first 1.5 widths drawn. */
const touchDown = (leg: Curve<P3>, a: number): number => easings.inOutSine(clamp((a * leg.length) / (1.5 * traceWidthAt(0))));

/**
 * Your stamp's green on the reply: a ring and a tick (MARK texels, the mark 34 u square), inked by a radial front
 * from its centre as the ink spreads from the contact (summary.ts inkAt): a mask, never a fade. Its texels are the
 * film's green, which the material's green tints again (as the signed-off canvas mark was drawn); the ink's own
 * edges are antialiased over one texel.
 */
const MARK_RGB = [1, 3, 5].map((i) => parseInt(HEX.green.slice(i, i + 2), 16));
const MARK = 64;
const MARK_COVER = (() => {
  const c = new Float32Array(MARK * MARK);
  const k = MARK / 40;
  const ring = { r: 16 * k, w: 1.7 * k };
  const tick: [number, number][] = [
    [11 * k, 21 * k],
    [17 * k, 27 * k],
    [29 * k, 13 * k],
  ];
  const seg = (px: number, py: number, a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy));
    return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
  };
  for (let r = 0; r < MARK; r++) {
    // row 0 is the texture's bottom (v = 0): the canvas the mark was drawn on ran y down from its top
    const y = MARK - (r + 0.5);
    for (let x = 0; x < MARK; x++) {
      const px = x + 0.5;
      const ringD = Math.abs(Math.hypot(px - MARK / 2, y - MARK / 2) - ring.r) - ring.w;
      const tickD = Math.min(seg(px, y, tick[0], tick[1]), seg(px, y, tick[1], tick[2])) - ring.w;
      c[r * MARK + x] = clamp(0.5 - Math.min(ringD, tickD));
    }
  }
  return c;
})();
/** The farthest inked texel from the mark's centre: the front's reach at a full spread. */
const MARK_REACH = 16 * (MARK / 40) + 1.7 * (MARK / 40) + 1;
function markTexture(): DataTexture {
  const t = new DataTexture(new Uint8Array(MARK * MARK * 4), MARK, MARK);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}
function fillMark(t: DataTexture, ink: number): void {
  const data = t.image.data as Uint8Array;
  const front = ink * MARK_REACH;
  for (let r = 0; r < MARK; r++) {
    for (let x = 0; x < MARK; x++) {
      const d = Math.hypot(x + 0.5 - MARK / 2, r + 0.5 - MARK / 2);
      const o = (r * MARK + x) * 4;
      data[o] = MARK_RGB[0];
      data[o + 1] = MARK_RGB[1];
      data[o + 2] = MARK_RGB[2];
      data[o + 3] = Math.round(255 * MARK_COVER[r * MARK + x] * clamp(front - d + 0.5));
    }
  }
  t.needsUpdate = true;
}
/** A round dot (a leg's tail or its nib) that samples its leg's map at one arc fraction (its meniscus across it). */
const dotAt = (g: BufferGeometry, t: number): void => {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, t);
  uv.needsUpdate = true;
};

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
    // each leg its own meniscus map (its hold along the run is its own), one program for both
    const men = { out: meniscus(), home: meniscus() };
    // ink on the beds: a lit, slightly glossy film (paper's program), never an emitter; drawn over the bed it lies in
    const ink = (hex: string, map: DataTexture) => {
      const x = paper(map, hex, { roughness: 0.55, fibre: 0 });
      x.polygonOffset = true;
      x.polygonOffsetFactor = -2;
      x.polygonOffsetUnits = -2;
      return x;
    };
    return { out: ink(TRACE_INK.out, men.out), home: ink(TRACE_INK.home, men.home), men };
  }, []);
  // the frame's light pools (as DeskWorld lights the summary), and how much of its albedo each leg's ink keeps under them
  const pools = useMemo(() => poolsAt(summaryDeskState(a.f)), [a.f]);
  const holdKey = JSON.stringify(pools);
  useLayoutEffect(() => {
    for (const k of ['out', 'home'] as const) {
      const hold = new Float32Array(MEN.w);
      for (let x = 0; x < MEN.w; x++) hold[x] = inkHold(legAt(LEGS[k], (x + 0.5) / MEN.w), pools, INK_K);
      fillMeniscus(inks.men[k], hold);
    }
    // keyed by the pools' values: the maps refill only when the light changes
  }, [inks, holdKey]);
  const g = useMemo(() => {
    const route = (leg: Curve<P3>) => ribbon(leg, SEG);
    const I = YOU.inTray;
    // the stamp: a rubber pad (its face a little wider than the mark it prints), a graphite stem, an enamel knob; built
    // about its pad's underside, posed each frame (summary.ts stampAt: at rest beside the in-tray, or pressing the reply)
    const stamp = { pad: slab({ x0: -18, x1: 18, y0: -16, y1: 16 }, 0, 8, 3, 1.2), stem: cylinderZ(5, 8, 34, 0, 0, 16), knob: disc(11, 34, 42, { cx: 0, cy: 0, bevel: 3 }) };
    // the request's reply (#0405), on top in the tray, and its green: a ring and a tick at its east end
    const reply = plane(REPLY_D.l, REPLY_D.w, rectC(I)[0], I.y1 - 44, YOU.top + 7.2, 0.06);
    const mark = plane(34, 34, STAMP.mark[0], STAMP.mark[1], YOU.top + 7.6, 0.06);
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
    // the bug bay's job rail: a low shelf with a back lip along the bay's south wall, the sand-glass and its plate on it
    const R = JOB_RAIL;
    const jobRail = merge([slab(R, 0, R.z, 3, 1.2), slab({ ...R, y0: R.y1 - 6 }, R.z, R.lip, 2, 1)]);
    const plateAt = (p: P3, dx: number, z = 0) => slab({ x0: p[0] + dx - 48, x1: p[0] + dx + 48, y0: p[1] - 15, y1: p[1] + 15 }, z, z + 5, 3, 1.4);
    const plateFace = (p: P3, dx: number, z = 0) => plane(92, 26, p[0] + dx, p[1], z + 5.1);
    return {
      out: route(LEGS.out),
      home: route(LEGS.home),
      stamp,
      reply,
      mark,
      spike,
      impaled,
      key,
      glass,
      jobRail,
      // the round tail of each leg and its nib (posed at the drawing head), each sampling its leg's map where it sits
      dots: { out: [new CircleGeometry(0.5, 28), new CircleGeometry(0.5, 28)], home: [new CircleGeometry(0.5, 28), new CircleGeometry(0.5, 28)] },
      plates: merge([plateAt(DOCKED.key, 62), plateAt(DOCKED.glass, -112, JOB_RAIL.z)]),
      faces: [plateFace(DOCKED.key, 62), plateFace(DOCKED.glass, -112, JOB_RAIL.z)],
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
    const mark = markTexture();
    mark.anisotropy = an;
    return {
      mark,
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
      inks.men.out.dispose();
      inks.men.home.dispose();
      for (const x of Object.values(mats)) x.dispose();
      for (const t of Object.values(tex)) t.dispose();
    },
    [inks, mats, tex],
  );
  useLayoutEffect(
    () => () => {
      for (const x of [g.out, g.home, ...g.dots.out, ...g.dots.home]) x.dispose();
    },
    [g],
  );
  // the drawn part of each leg, by arc length along its curve
  useLayoutEffect(() => {
    g.out.setDrawRange(0, Math.round(a.out * SEG) * 6);
    g.home.setDrawRange(0, Math.round(a.home * SEG) * 6);
  }, [g, a.out, a.home]);
  // the request's bay has capped: its work light is out (the slot keeps its glass, unlit)
  useLayoutEffect(() => {
    for (const set of [sets.full, sets.stepped]) set.slotBug.color.set('#2A2D2C');
  }, [sets]);
  // the green's spread on the reply: its radial front refills the mark's texels only while it moves
  useLayoutEffect(() => fillMark(tex.mark, a.ink), [tex, a.ink]);
  // the tail where each leg set out, and its nib at the drawing head: both grow from the pen's first blot as the leg sets
  // out, and the nib is a hair wider while it draws (the ink's bead), sinking to the run's width over 2 f once it stops
  const legs = (['out', 'home'] as const).map((k) => ({ k, on: a[k], grow: touchDown(LEGS[k], a[k]), bead: 1 + 0.12 * a.bead[k], tail: headOf(LEGS[k], 0), head: headOf(LEGS[k], a[k]), mat: inks[k], dots: g.dots[k] }));
  useLayoutEffect(() => {
    for (const l of legs) {
      dotAt(l.dots[0], l.tail.t);
      dotAt(l.dots[1], l.head.t);
    }
  });
  const sp = a.stamp;
  return (
    <group>
      {a.out > 0 && <mesh geometry={g.out} material={inks.out} renderOrder={1} />}
      {a.home > 0 && <mesh geometry={g.home} material={inks.home} renderOrder={1} />}
      {legs.map((l) => {
        if (l.on <= 0) return null;
        return (
          <group key={l.k}>
            <mesh geometry={l.dots[0]} material={l.mat} position={[l.tail.p[0], l.tail.p[1], l.tail.p[2] + 0.02]} scale={[l.tail.w * l.grow, l.tail.w * l.grow, 1]} renderOrder={1} />
            <mesh geometry={l.dots[1]} material={l.mat} position={[l.head.p[0], l.head.p[1], l.head.p[2] + 0.03]} scale={[l.head.w * l.bead * l.grow, l.head.w * l.bead * l.grow, 1]} renderOrder={1} />
          </group>
        );
      })}
      <mesh geometry={g.cap} material={sets.stepped.enamelShade} />
      {/* the stamp, squashed about its pad's underside as its rubber takes the press (its volume kept) */}
      <group position={sp.p} rotation={[0, 0, sp.turn]} scale={[1 + sp.squash / 2, 1 + sp.squash / 2, 1 - sp.squash]}>
        <mesh geometry={g.stamp.pad} material={m.rubber} />
        <mesh geometry={g.stamp.stem} material={m.graphite} />
        <mesh geometry={g.stamp.knob} material={m.enamel} />
      </group>
      <mesh geometry={g.reply} material={mats.reply} />
      <mesh geometry={g.mark} material={mats.mark} renderOrder={2} />
      <mesh geometry={g.spike} material={m.steel} />
      <mesh geometry={g.impaled} material={m.paperShade} />
      <mesh geometry={g.key} material={m.steel} />
      <mesh geometry={g.jobRail} material={m.graphiteDark} />
      <mesh geometry={g.glass.glass} material={m.paper} />
      <mesh geometry={g.glass.ends} material={m.graphite} />
      <mesh geometry={g.plates} material={m.enamelShade} />
      <mesh geometry={g.faces[0]} material={mats.proactive} />
      <mesh geometry={g.faces[1]} material={mats.productive} />
    </group>
  );
}
