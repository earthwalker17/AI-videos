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
 * the request's bay capped, its work light out. (From wave 2 the chores where they were handed over,
 * the spike with the noise it dropped and the job rail are act two's own bodies, lasting into the
 * summary; the pictogram trait plates are objects/Beat11.tsx's.) The route's inks and the cap step
 * down with 11.4's step-down ('b11-trace': toward the desk, as everything else steps, never only losing its colour); the
 * stamp and its green on the reply never do. Your stamp waits in a pit in your desk under a hatch of your desk's own top
 * (summary.ts STAMP_SLOT), which opens for it before the sign-off.
 */
import { clamp, easings } from '@aiv/core';
import type { Curve } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { AlwaysDepth, BufferAttribute, DoubleSide, BufferGeometry, CircleGeometry, Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, ShaderMaterial, type MeshStandardMaterial } from 'three';
import { LIGHTS } from '../DeskWorld.tsx';
import { cylinderZ, disc, merge, plane, slab } from '../geom.ts';
import { HEX, graphite, matte, paper } from '../gl/materials.ts';
import { isStepped, useDeskMats, useDeskSets } from '../kit.tsx';
import { BAYS, KEY, YOU, rectC, type P3 } from '../layout.ts';
import { poolsAt } from '../pools.ts';
import { SignedReply } from './Replies.tsx';
import { LEGS, STAMP, STAMP_SLOT, TRACE_INK, inkHold, inkLight, legAt, rampEdgeZ, stampSlotAt, summaryDeskState, traceWidthAt, type SummaryState } from '../summary.ts';

/** The desk state's step (kit.tsx isStepped's argument). */
type SummaryStepArg = Parameters<typeof isStepped>[0];
/** Quads per leg, by arc length (about 1.6 u each: shorter than the nib's radius, so the ribbon's end hides under it). */
const SEG = 1040;
/** The light the ink takes from the key and the fill alone, against which a light pool's lift is held (summary.ts inkHold). */
const INK_K = inkLight(LIGHTS.key, LIGHTS.fill, KEY);

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

export function Trace({ a, printFamily, step }: { a: SummaryState; printFamily: string; step: SummaryStepArg }) {
  const m = useDeskMats();
  const sets = useDeskSets();
  const gl = useThree((s) => s.gl);
  const inks = useMemo(() => {
    // each leg its own meniscus map (its hold along the run is its own), one program for both
    const men = { out: meniscus(), home: meniscus() };
    // ink on the beds: a lit, slightly glossy film (paper's program), never an emitter; drawn over the bed it lies in
    const offset = <M extends MeshStandardMaterial>(x: M): M => {
      x.polygonOffset = true;
      x.polygonOffsetFactor = -2;
      x.polygonOffsetUnits = -2;
      return x;
    };
    const ink = (hex: string, map: DataTexture) => offset(paper(map, hex, { roughness: 0.55, fibre: 0 }));
    // stepped (11.4): the same lit film, stepped down toward the desk as every built part is (55% contrast and 30% chroma:
    // gl/materials.ts), never toward paper grey (which would only take its colour); one pair per step mode
    const stepped = (hex: string, map: DataTexture, mode: true | 'late' | 'own') => {
      const x = matte(hex, 0.55, 0, mode);
      x.map = map;
      return offset(x);
    };
    const modes = (mode: true | 'late' | 'own') => ({ out: stepped(TRACE_INK.out, men.out, mode), home: stepped(TRACE_INK.home, men.home, mode) });
    return { out: ink(TRACE_INK.out, men.out), home: ink(TRACE_INK.home, men.home), stepped: { main: modes(true), late: modes('late'), own: modes('own') }, men };
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
    // the stamp: a rubber pad (its face a little wider than the mark it prints), a graphite stem, an enamel knob; built
    // about its pad's underside, posed each frame (summary.ts stampAt: at rest beside the in-tray, or pressing the reply)
    const stamp = { pad: slab({ x0: -18, x1: 18, y0: -16, y1: 16 }, 0, 8, 3, 1.2), stem: cylinderZ(5, 8, 34, 0, 0, 16), knob: disc(11, 34, 42, { cx: 0, cy: 0, bevel: 3 }) };
    // the request's reply (#0405: objects/Replies.tsx SignedReply), on top in the tray, and its green: a ring and a tick at its east end
    const mark = plane(34, 34, STAMP.mark[0], STAMP.mark[1], STAMP.paperZ + 0.35, 0.06);
    // the hatch it comes up out of (built about the hole's centre): two leaves of your desk's top (a unit wide, west of x 0,
    // posed to what of each is still over the hole: the rest has slid under the desk's top), a steel lip along each inner
    // edge (seen as they part); the pit under them (its walls and its floor, never darker than the slate's floor tone); the
    // punch that opens the desk's top over the hole while it is open
    const hw = STAMP_SLOT.w / 2;
    const leaf = new PlaneGeometry(1, STAMP_SLOT.d);
    leaf.translate(-0.5, 0, 0);
    const box = { x0: -hw, x1: hw, y0: -STAMP_SLOT.d / 2, y1: STAMP_SLOT.d / 2 };
    const hatch = {
      leaf,
      lip: slab({ x0: -1.6, x1: 0, y0: box.y0, y1: box.y1 }, 0, 0.5, 0.3, 0.2),
      // its four walls: upright planes on the hole's edges, from the floor up to the desk's top (no top face to show a seam)
      walls: (() => {
        const h = STAMP_SLOT.depth + 2;
        const side = (w: number, x: number, y: number, rot: number) => {
          const q = new PlaneGeometry(w, h);
          q.rotateX(Math.PI / 2);
          q.rotateZ(rot);
          q.translate(x, y, -h / 2);
          return q;
        };
        return merge([side(STAMP_SLOT.w, 0, box.y1, 0), side(STAMP_SLOT.w, 0, box.y0, 0), side(STAMP_SLOT.d, box.x0, 0, Math.PI / 2), side(STAMP_SLOT.d, box.x1, 0, Math.PI / 2)]);
      })(),
      floor: slab({ x0: box.x0 - 1, x1: box.x1 + 1, y0: box.y0 - 1, y1: box.y1 + 1 }, -STAMP_SLOT.depth - 2, -STAMP_SLOT.depth, 1, 0.5),
      punch: plane(STAMP_SLOT.w, STAMP_SLOT.d, 0, 0, 0.02),
    };
    return {
      hatch,
      out: route(LEGS.out),
      home: route(LEGS.home),
      stamp,
      mark,
      // the round tail of each leg and its nib (posed at the drawing head), each sampling its leg's map where it sits
      dots: { out: [new CircleGeometry(0.5, 28), new CircleGeometry(0.5, 28)], home: [new CircleGeometry(0.5, 28), new CircleGeometry(0.5, 28)] },
      // the request's bay has capped: an enamel cap over its work slot's slit
      cap: slab({ x0: BAYS.bug.slot.x0 + 3, x1: BAYS.bug.slot.x1 - 3, y0: rectC(BAYS.bug.slot)[1] - 11, y1: rectC(BAYS.bug.slot)[1] + 11 }, 30, 34, 2, 1),
    };
  }, []);
  const tex = useMemo(() => {
    const an = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const mark = markTexture();
    mark.anisotropy = an;
    return { mark };
  }, [gl, printFamily]);
  const mats = useMemo(() => {
    const markMat = matte(HEX.green, 0.8);
    markMat.map = tex.mark;
    markMat.transparent = true;
    markMat.depthWrite = false;
    // the pit's floor: unlit dark, never darker than the slate's floor tone (objects/Dispatch.tsx PIT_FLOOR)
    const pitFloor = new MeshBasicMaterial({ color: new Color('#2B2D2C') });
    // its walls a step lighter than its floor (unlit too: under your desk's top the desk's own footprint would shade a lit wall below the floor tone)
    const pitWall = new MeshBasicMaterial({ color: new Color('#353837'), side: DoubleSide });
    // the hatch's leaves: your desk's own top (objects/YourDesk.tsx's slab: its brushing is world-locked, so a shut leaf is the desk)
    const leaf = graphite('#2C2F2E', { roughness: 0.62, metalness: 0.35, brush: 0.07 });
    // the punch: it opens your desk's top over the hole while the hatch is open (writes the far depth there and no colour,
    // drawn after the desk and before the pit, the leaves and the stamp, which then show through the hole as through a cut)
    const punch = new ShaderMaterial({
      vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'void main() { gl_FragColor = vec4(0.0); gl_FragDepth = 1.0; }',
      colorWrite: false,
      depthWrite: true,
      depthFunc: AlwaysDepth,
    });
    return { mark: markMat, pitFloor, pitWall, leaf, punch };
  }, [tex]);
  useLayoutEffect(
    () => () => {
      inks.out.dispose();
      inks.home.dispose();
      for (const set of Object.values(inks.stepped)) for (const x of Object.values(set)) x.dispose();
      inks.men.out.dispose();
      inks.men.home.dispose();
      for (const x of Object.values(mats)) x.dispose();
      for (const t of Object.values(tex)) t.dispose();
    },
    [inks, mats, tex],
  );
  useLayoutEffect(
    () => () => {
      for (const x of [g.out, g.home, ...Object.values(g.hatch), ...g.dots.out, ...g.dots.home]) x.dispose();
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
  // the stuck bay's work slot, held on the late set after still (d) (summary.ts summaryStep): its unlit level as the stepped set
  // has it (objects/Bay.tsx FreshBay colours only the full and stepped sets' slots), every frame, after the bays have drawn
  useLayoutEffect(() => {
    sets.late.slotFresh.color.copy(sets.stepped.slotFresh.color);
  });
  // the green's spread on the reply: its radial front refills the mark's texels only while it moves
  useLayoutEffect(() => fillMark(tex.mark, a.ink), [tex, a.ink]);
  // the tail where each leg set out, and its nib at the drawing head: both grow from the pen's first blot as the leg sets
  // out, and the nib is a hair wider while it draws (the ink's bead), sinking to the run's width over 2 f once it stops
  // 11.4: the route steps down with the system it ran through (its inks' stepped pair, on the main set's ramp)
  const traceOn = isStepped(step, 'b11-trace');
  const ink = traceOn === 'late' ? inks.stepped.late : traceOn === 'own' ? inks.stepped.own : traceOn ? inks.stepped.main : inks;
  const legs = (['out', 'home'] as const).map((k) => ({ k, on: a[k], grow: touchDown(LEGS[k], a[k]), bead: 1 + 0.12 * a.bead[k], tail: headOf(LEGS[k], 0), head: headOf(LEGS[k], a[k]), mat: ink[k], dots: g.dots[k] }));
  useLayoutEffect(() => {
    for (const l of legs) {
      dotAt(l.dots[0], l.tail.t);
      dotAt(l.dots[1], l.head.t);
    }
  });
  const sp = a.stamp;
  const open = stampSlotAt(a.f);
  // each leaf slides out under the desk's top beyond the hole's edge (the west one west, the east one east): what of it is
  // still over the hole, its top a hair over the desk's (as the desk's own top lies, so a leaf is lit as the desk is)
  const gap = (STAMP_SLOT.w / 2) * open;
  const leafW = STAMP_SLOT.w / 2 - gap;
  const [hx, hy] = [STAMP.rest[0], STAMP.rest[1]];
  return (
    <group>
      {a.out > 0 && <mesh geometry={g.out} material={ink.out} renderOrder={1} />}
      {a.home > 0 && <mesh geometry={g.home} material={ink.home} renderOrder={1} />}
      {legs.map((l) => {
        if (l.on <= 0) return null;
        return (
          <group key={l.k}>
            <mesh geometry={l.dots[0]} material={l.mat} position={[l.tail.p[0], l.tail.p[1], l.tail.p[2] + 0.02]} scale={[l.tail.w * l.grow, l.tail.w * l.grow, 1]} renderOrder={1} />
            <mesh geometry={l.dots[1]} material={l.mat} position={[l.head.p[0], l.head.p[1], l.head.p[2] + 0.03]} scale={[l.head.w * l.bead * l.grow, l.head.w * l.bead * l.grow, 1]} renderOrder={1} />
          </group>
        );
      })}
      {/* stepped down whole from the seam on: the late set's (exactly 1 in the summary), so it never follows the main set's beat 11 ramps */}
      <mesh geometry={g.cap} material={sets.late.enamelShade} />
      {/* the hatch, while it is open: the punch first (after the desk), then the pit and the leaves, under the desk's top */}
      {open > 0 && (
        <group position={[hx, hy, YOU.top]}>
          <mesh geometry={g.hatch.punch} material={mats.punch} renderOrder={10} />
          <mesh geometry={g.hatch.walls} material={mats.pitWall} renderOrder={11} />
          <mesh geometry={g.hatch.floor} material={mats.pitFloor} renderOrder={11} />
          {leafW > 0.05 &&
            ([-1, 1] as const).map((side) => (
              <group key={side} position={[side * gap, 0, 0.01]} scale={[-side, 1, 1]}>
                <mesh geometry={g.hatch.leaf} material={mats.leaf} scale={[leafW, 1, 1]} renderOrder={12} />
                <mesh geometry={g.hatch.lip} material={m.steel} scale={[Math.min(1, leafW / 1.6), 1, 1]} renderOrder={12} />
              </group>
            ))}
        </group>
      )}
      {/* the stamp, squashed about its pad's underside as its rubber takes the press (its volume kept); drawn after the punch, so it shows in the open pit */}
      <group position={sp.p} rotation={[0, 0, sp.turn]} scale={[1 + sp.squash / 2, 1 + sp.squash / 2, 1 - sp.squash]}>
        <mesh geometry={g.stamp.pad} material={m.rubber} renderOrder={12} />
        <mesh geometry={g.stamp.stem} material={m.graphite} renderOrder={12} />
        <mesh geometry={g.stamp.knob} material={m.enamel} renderOrder={12} />
      </group>
      <SignedReply printFamily={printFamily} />
      <mesh geometry={g.mark} material={mats.mark} renderOrder={2} />
    </group>
  );
}
