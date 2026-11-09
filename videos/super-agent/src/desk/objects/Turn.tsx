/**
 * The turn's own objects (desk/turn.ts, MT2): what exists only while one thing becomes another.
 * - the notes loop as it lifts, folds its tabs, turns on edge and coils; then the coil (the reel's
 *   pack, hub and spokes) as Fix A's tape winds on, glides, descends and locks;
 * - Fix A: its folder (sinking into the desk), its tape on the desk (grey stock) and up to the coil
 *   (paper), the queue riding it;
 * - Fix B: the trays growing walls and nameplate bands, the replies going home;
 * - the deck's legs as they telescope, the tape's leader out of the print head, the first chat slip.
 *
 * Everything else (your desk, the feeders, the act-one folders and heap, the Register) is drawn by
 * its own component, posed by the turn.
 */
import { useLayoutEffect, useMemo } from 'react';
import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Matrix4, RepeatWrapping, RingGeometry, Shape, type MeshStandardMaterial, type Texture } from 'three';
import { LOOP_A, FOLDERS, loopNormal, loopPoint, tabAt, type LoopPose } from '../actOne.ts';
import { A_ITEMS, A_SIZE, A_TAPE_W, BREAK, B_SLIP, FIX_A_FOLDER, TRAYS, TRAY_CARD, TRAY_Z, aPathAt, type AItemKind } from '../beat3.ts';
import { cylinderZ, disc, extrude, merge, slab, tube } from '../geom.ts';
import { HEX, matte, paper, whiteTexture } from '../gl/materials.ts';
import { cargoMark, texture, tooth } from '../gl/text.ts';
import { useDeskMats } from '../kit.tsx';
import { LEG_R, NEXT_SLIP, REEL, TAPE, TAPE_FLAT_X1, type P2, type P3 } from '../layout.ts';
import { PRESS_DEPTH, legsAt, type TurnState } from '../turn.ts';
import { TAPE_HEX, clipGeometry, fitUv, loopArc, loopNotes, makeActOnePrint, piece, slipShape } from './ActOne.tsx';

/** Grey stock: the road not taken (STORYBOARD's palette). */
const GREY = '#77756F';
const GREY_LIGHT = '#8A8781';
/** Fix B's replies: a paler grey stock, so the jostling pile reads slip by slip on the in-tray. */
const GREY_PALE = '#9B9891';
const BAY_FLOOR_HEX = '#3F4241';
const BAY_WALL_HEX = '#626764';

const lerpHex = (a: string, b: string, t: number): Color => (t >= 1 ? new Color(b) : t <= 0 ? new Color(a) : new Color(a).lerp(new Color(b), t));

/** Geometry rebuilt from a key, disposed when replaced. */
function useGeo<T extends BufferGeometry | null>(make: () => T, deps: readonly unknown[]): T {
  const g = useMemo(make, deps);
  useLayoutEffect(() => () => g?.dispose(), [g]);
  return g;
}
function useMats<T extends Record<string, MeshStandardMaterial>>(make: () => T, deps: readonly unknown[]): T {
  const m = useMemo(make, deps);
  useLayoutEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  return m;
}

/** A matrix from an origin and three axes. */
const basis = (o: P3, x: P3, y: P3, z: P3): Matrix4 => new Matrix4().set(x[0], y[0], z[0], o[0], x[1], y[1], z[1], o[1], x[2], y[2], z[2], o[2], 0, 0, 0, 1);
const crossP = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: P3): P3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// ------------------------------------------------------------------------------------------------
// The loop: a ribbon turning on edge (the act-one ribbon at edge 0), its tabs folding flat, its clip

/** The ribbon's frame at parameter t: the centreline point, the tangent, the outer-edge direction and the face normal. */
function ribbonFrame(L: LoopPose, t: number, edge: number): { c: P3; tan: P3; out: P3; nrm: P3 } {
  const p = loopPoint(L, t);
  const n = loopNormal(L, t);
  const th = (edge * Math.PI) / 2;
  const tan: P3 = [-n[1], n[0], 0];
  return { c: [p[0], p[1], L.z + (L.w / 2) * Math.sin(th)], tan, out: [n[0] * Math.cos(th), n[1] * Math.cos(th), -Math.sin(th)], nrm: [n[0] * Math.sin(th), n[1] * Math.sin(th), Math.cos(th)] };
}

function ribbonGeometry(L: LoopPose, edge: number): BufferGeometry {
  const { t, s, len } = loopArc(L);
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const end = t[t.length - 1];
  t.forEach((ti, i) => {
    const F = ribbonFrame(L, ti, edge);
    // the overlapping end rises onto the start under the clip (as act one's)
    const rise = 0.9 * Math.min(Math.max((ti - (end - 0.22)) / 0.12, 0), 1);
    for (const k of [-1, 1]) {
      pos.push(F.c[0] + (F.out[0] * k * L.w) / 2 + F.nrm[0] * rise, F.c[1] + (F.out[1] * k * L.w) / 2 + F.nrm[1] * rise, F.c[2] + (F.out[2] * k * L.w) / 2 + F.nrm[2] * rise);
      uv.push(s[i] / len, k < 0 ? 1 : 0);
      nrm.push(...F.nrm);
    }
    if (i > 0) {
      const a = 2 * (i - 1);
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** One tab in its own frame (as act one's: x across its base, y outward, its thickness in z). */
function tabLocal(): BufferGeometry {
  const s = new Shape();
  const hw = 13;
  const l = 30;
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, l - 5);
  s.quadraticCurveTo(hw, l, hw - 5, l);
  s.lineTo(-hw + 5, l);
  s.quadraticCurveTo(-hw, l, -hw, l - 5);
  s.closePath();
  return extrude(s, -0.2, 0.5, 0.2);
}

/** Each tab's parameter on the loop and its turn toward its folder, as act one placed it (LOOP_A). */
const TABS = FOLDERS.map((fl) => {
  const t = tabAt(LOOP_A, fl);
  const p = loopPoint(LOOP_A, t);
  const n = loopNormal(LOOP_A, t);
  const base: P2 = [p[0] + n[0] * (LOOP_A.w / 2 - 3), p[1] + n[1] * (LOOP_A.w / 2 - 3)];
  const d0: P2 = [fl.c[0] - base[0], fl.c[1] - base[1]];
  const l = Math.hypot(d0[0], d0[1]);
  const d: P2 = [d0[0] / l, d0[1] / l];
  const tan: P2 = [-n[1], n[0]];
  return { t, a: d[0] * n[0] + d[1] * n[1], b: d[0] * tan[0] + d[1] * tan[1] };
});

function tabMatrix(L: LoopPose, edge: number, fold: number, k: number): Matrix4 {
  const T = TABS[k];
  const F = ribbonFrame(L, T.t, edge);
  const y0: P3 = unit([T.a * F.out[0] + T.b * F.tan[0], T.a * F.out[1] + T.b * F.tan[1], T.a * F.out[2] + T.b * F.tan[2]]);
  const x: P3 = unit([T.b * F.out[0] - T.a * F.tan[0], T.b * F.out[1] - T.a * F.tan[1], T.b * F.out[2] - T.a * F.tan[2]]);
  const z0 = F.nrm;
  const ph = fold * Math.PI;
  const y: P3 = [Math.cos(ph) * y0[0] + Math.sin(ph) * z0[0], Math.cos(ph) * y0[1] + Math.sin(ph) * z0[1], Math.cos(ph) * y0[2] + Math.sin(ph) * z0[2]];
  const z: P3 = [-Math.sin(ph) * y0[0] + Math.cos(ph) * z0[0], -Math.sin(ph) * y0[1] + Math.cos(ph) * z0[1], -Math.sin(ph) * y0[2] + Math.cos(ph) * z0[2]];
  const lift = 1.2 * Math.sin(ph / 2);
  const o: P3 = [F.c[0] + F.out[0] * (L.w / 2 - 3) + z0[0] * lift, F.c[1] + F.out[1] * (L.w / 2 - 3) + z0[1] * lift, F.c[2] + F.out[2] * (L.w / 2 - 3) + z0[2] * lift];
  return basis(o, x, y, z);
}

/** The clip, built where act one put it and carried by the ribbon's frame at its place. */
const CLIP_T = LOOP_A.clipAt + 0.05;
function clipMatrix(L: LoopPose, edge: number): Matrix4 {
  const A = ribbonFrame(LOOP_A, CLIP_T, 0);
  const F = ribbonFrame(L, CLIP_T, edge);
  const from = basis([A.c[0], A.c[1], 0], A.out, A.tan, A.nrm);
  const to = basis([F.c[0], F.c[1], F.c[2] - LOOP_A.z], F.out, F.tan, F.nrm);
  return to.multiply(from.invert());
}

function Placed({ matrix, geometry, material }: { matrix: Matrix4; geometry: BufferGeometry; material: MeshStandardMaterial }) {
  return <mesh geometry={geometry} material={material} matrix={matrix} matrixAutoUpdate={false} />;
}

/** The loop's print and tab stock, made once for act one's loop (the print rides the tape as it turns and coils). */
function useLoopMats(printFamily: string) {
  const len = useMemo(() => loopArc(LOOP_A).len, []);
  const print = useMemo(() => makeActOnePrint(printFamily, 4, Math.ceil(len), loopNotes(len)), [printFamily, len]);
  const mats = useMats(() => {
    const tape = paper(print.tape, TAPE_HEX.tape);
    tape.side = DoubleSide;
    return { tape, tab: paper(whiteTexture(), TAPE_HEX.tab), pack: paper(whiteTexture(), TAPE_HEX.tape) };
  }, [print]);
  useLayoutEffect(() => () => [...print.top, ...print.card, print.tape, ...print.chat, ...print.ci].forEach((x) => x.dispose()), [print]);
  return mats;
}

function Ribbon({ r, mats }: { r: NonNullable<TurnState['loop']['ribbon']>; mats: ReturnType<typeof useLoopMats> }) {
  const m = useDeskMats();
  const g = useGeo(() => ribbonGeometry(r.L, r.edge), [r.L, r.edge]);
  const tab = useGeo(() => tabLocal(), []);
  const clip = useMemo(() => clipGeometry(LOOP_A), []);
  useLayoutEffect(() => () => Object.values(clip).forEach((x) => x.dispose()), [clip]);
  const cm = clipMatrix(r.L, r.edge);
  return (
    <group>
      <mesh geometry={g} material={mats.tape} />
      {TABS.map((_, k) => (
        <Placed key={k} matrix={tabMatrix(r.L, r.edge, r.fold, k)} geometry={tab} material={mats.tab} />
      ))}
      <Placed matrix={cm} geometry={clip.body} material={m.enamel} />
      <Placed matrix={cm} geometry={clip.spine} material={m.graphiteDark} />
      <Placed matrix={cm} geometry={clip.wire} material={m.steel} />
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// The coil: the reel's pack as it winds, with its hub and spokes (the Register's own at rest)

function coilTop(rIn: number, rOut: number): BufferGeometry {
  const g = new RingGeometry(rIn, rOut, 72, 1);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * REEL.packR) + 0.5, pos.getY(i) / (2 * REEL.packR) + 0.5);
  return g;
}
function wall(r: number, t: number): BufferGeometry {
  const g = new CylinderGeometry(r, r, t, 72, 1, true);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, t / 2);
  return g;
}
const HUB_H = REEL.hubZ[1] - REEL.packZ[0];
function spokes(len: number): BufferGeometry {
  return merge(
    [0, 1, 2].map((k) => {
      const s = new Shape();
      s.moveTo(0, -5);
      s.lineTo(len, -3);
      s.lineTo(len, 3);
      s.lineTo(0, 5);
      s.closePath();
      const g = extrude(s, 0.4, 4, 1);
      g.rotateZ((k * 2 * Math.PI) / 3 + 0.35);
      return g;
    }),
  );
}

function Coil({ c, mats }: { c: NonNullable<TurnState['loop']['coil']>; mats: ReturnType<typeof useLoopMats> }) {
  const m = useDeskMats();
  const top = useGeo(() => coilTop(c.rIn, c.rOut), [c.rIn, c.rOut]);
  const outer = useGeo(() => wall(c.rOut, c.t), [c.rOut, c.t]);
  const inner = useGeo(() => (c.rIn > REEL.hubR + 0.5 ? wall(c.rIn, c.t) : null), [c.rIn, c.t]);
  // the spokes telescope out from the hub over the pack (as long as the Register's at rest)
  const spokeLen = REEL.hubR + 2 + (Math.max(c.rOut - 6, REEL.hubR + 2) - REEL.hubR - 2) * c.spokes;
  const sp = useGeo(() => spokes(spokeLen), [spokeLen]);
  const hub = useMemo(() => ({ body: merge([cylinderZ(REEL.hubR, 0, HUB_H - 3), disc(REEL.hubR + 2, HUB_H - 3, HUB_H, { bevel: 1.2 })]), slot: slab({ x0: -13, x1: 13, y0: -2.5, y1: 2.5 }, HUB_H, HUB_H + 1.2, 1, 0.4) }), []);
  useLayoutEffect(() => () => Object.values(hub).forEach((x) => x.dispose()), [hub]);
  // the pack takes the reel's paper as it coils; at rest it is the Register's own
  const settled = c.stock >= 0.999;
  useLayoutEffect(() => {
    mats.pack.color.copy(lerpHex(TAPE_HEX.tape, HEX.paperShade, c.stock));
  }, [mats, c.stock]);
  const packMat = settled ? m.paperShade : mats.pack;
  return (
    <group position={[c.c[0], c.c[1], c.h]}>
      <mesh geometry={outer} material={packMat} />
      {inner && <mesh geometry={inner} material={mats.tape} />}
      <group rotation={[0, 0, c.spin]}>
        <mesh geometry={top} material={m.printed.reelTopBare} position={[0, 0, c.t + 0.25]} />
        {c.hub > 0.02 && (
          <group scale={[1, 1, c.hub]}>
            <mesh geometry={hub.body} material={m.enamel} />
            <mesh geometry={hub.slot} material={m.graphiteDark} />
          </group>
        )}
        {c.spokes > 0 && <mesh geometry={sp} material={m.enamel} position={[0, 0, c.t]} />}
      </group>
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// Fix A: the folder, the tape (desk part and span), the queue

/** A ribbon along a list of centre points with width vectors, its u by material distance. */
function stripGeometry(pts: readonly { p: P3; w: P3; u: number }[], half: number): BufferGeometry | null {
  if (pts.length < 2) return null;
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  pts.forEach((q, i) => {
    const nx = i < pts.length - 1 ? pts[i + 1] : q;
    const pv = i > 0 ? pts[i - 1] : q;
    const along = unit([nx.p[0] - pv.p[0], nx.p[1] - pv.p[1], nx.p[2] - pv.p[2]]);
    let n = unit(crossP(along, q.w));
    if (n[2] < 0) n = [-n[0], -n[1], -n[2]];
    for (const k of [-1, 1]) {
      pos.push(q.p[0] + q.w[0] * k * half, q.p[1] + q.w[1] * k * half, q.p[2] + q.w[2] * k * half);
      uv.push(q.u, k < 0 ? 0 : 1);
      nrm.push(...n);
    }
    if (i > 0) {
      const a = 2 * (i - 1);
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** The tape's print: sprocket ticks along both edges and its tooth, 120 u a repeat. */
const A_TEX_LEN = 120;
function tapeTexture(): Texture {
  const t = texture(
    A_TEX_LEN,
    A_TAPE_W,
    (g) => {
      tooth(g, A_TEX_LEN, A_TAPE_W);
      for (let x = 3; x < A_TEX_LEN; x += 10) {
        g.fillStyle = '#5E5C57';
        g.fillRect(x, 1.2, 3.4, 1.8);
        g.fillRect(x, A_TAPE_W - 3, 3.4, 1.8);
      }
    },
    4,
  );
  t.wrapS = RepeatWrapping;
  return t;
}

/** Prints for the queue's stock: a chat slip's mark, a CI card's punches, a task card's pictogram. */
function itemTexture(kind: AItemKind, v: number): Texture {
  const [l, w] = A_SIZE[kind];
  return texture(
    l,
    w,
    (g) => {
      tooth(g, l, w);
      g.save();
      const ink = '#3E3D3A';
      if (kind === 'ci') {
        g.fillStyle = ink;
        for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) if ((i * 7 + r * 3 + v) % 5 !== 0) g.fillRect(8 + i * 4.2, 6 + r * 7, 2.2, 4.4);
      } else if (kind === 'task') {
        g.translate(6, 3);
        g.scale(0.9, 0.9);
        cargoMark(g, v % 2 ? 'ci' : 'docs', 0, 0, ink);
      } else if (kind === 'chat') {
        g.translate(5, 4);
        g.scale(0.62, 0.62);
        cargoMark(g, 'chat', 0, 0, ink);
      }
      g.restore();
    },
    4,
  );
}

/** The request's grey copy: 1.3× a chat slip, its beetle cut out (as act one's request, never vermilion here). */
function requestCopy(): BufferGeometry {
  const [l, w] = A_SIZE.request;
  const s = slipShape('chat', l, w);
  const bx = -l / 2 + 12;
  const add = (x: number, y: number, rx: number, ry: number) => {
    const h = new Shape();
    h.absellipse(x, y, rx, ry, 0, Math.PI * 2, true);
    s.holes.push(h);
  };
  add(bx, 0, 5, 4);
  add(bx - 7.5, 0, 2, 2.3);
  for (const side of [-1, 1]) for (const k of [-1, 0, 1]) add(bx + k * 3.2, side * 6, 0.8, 1.9);
  return fitUv(extrude(s, 0, 0.8, 0.2), l, w);
}

function FixA({ t }: { t: TurnState }) {
  const m = useDeskMats();
  const A = t.fixA;
  const tex = useMemo(() => tapeTexture(), []);
  const itemTex = useMemo(() => A_ITEMS.map((it) => itemTexture(it.kind, it.v)), []);
  const geo = useMemo(() => ({ chat: piece('chat', ...A_SIZE.chat), ci: piece('ci', ...A_SIZE.ci), task: piece('ci', ...A_SIZE.task), request: requestCopy() }), []);
  useLayoutEffect(
    () => () => {
      tex.dispose();
      itemTex.forEach((x) => x.dispose());
      Object.values(geo).forEach((x) => x.dispose());
    },
    [tex, itemTex, geo],
  );
  const mats = useMats(() => {
    const grey = paper(tex, GREY);
    const span = paper(tex, TAPE_HEX.tape);
    span.side = DoubleSide;
    const folder = paper(whiteTexture(), GREY);
    const stack = paper(whiteTexture(), GREY_LIGHT);
    const sheet = paper(itemTex[3], '#9C998F');
    const out: Record<string, MeshStandardMaterial> = { grey, span, folder, stack, sheet };
    A_ITEMS.forEach((_, i) => {
      out[`i${i}`] = paper(itemTex[i], GREY_LIGHT);
      out[`i${i}`].side = DoubleSide;
    });
    return out;
  }, [tex, itemTex]);
  // the queue's stock turns to paper as it leaves the desk
  useLayoutEffect(() => {
    A.items.forEach((it, i) => {
      if (it) mats[`i${i}`].color.copy(lerpHex(GREY_LIGHT, HEX.paper, it.paper));
    });
  }, [A.items, mats]);
  // the tape on the desk, from the lift-off back to its tail; u by material place (the print travels with it)
  const desk = useGeo(() => {
    if (A.deskLen <= 0.5) return null;
    const n = Math.max(2, Math.ceil(A.deskLen / 6));
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const d = (A.deskLen * i) / n;
      const { p, dir } = aPathAt(d);
      return { p: [p[0], p[1], 0.5] as P3, w: [dir[1], -dir[0], 0] as P3, u: (d + A.span.len + A.wound) / A_TEX_LEN };
    });
    return stripGeometry(pts, A_TAPE_W / 2);
  }, [A.deskLen, A.span.len, A.wound]);
  const span = useGeo(() => {
    if (A.spanLen <= 0.5) return null;
    const S = A.span;
    const n = 24;
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const k = ((A.spanLen / S.len) * i) / n;
      const p: P3 = [S.b[0] + (S.a[0] - S.b[0]) * k, S.b[1] + (S.a[1] - S.b[1]) * k, S.b[2] + (S.a[2] - S.b[2]) * k];
      const w = unit([S.wb[0] + (S.wa[0] - S.wb[0]) * k, S.wb[1] + (S.wa[1] - S.wb[1]) * k, S.wb[2] + (S.wa[2] - S.wb[2]) * k]);
      return { p, w, u: (k * S.len + A.wound) / A_TEX_LEN };
    });
    return stripGeometry(pts, A_TAPE_W / 2);
  }, [A.span, A.spanLen, A.wound]);
  const F = FIX_A_FOLDER;
  const folder = useMemo(() => {
    const r = { x0: -F.w / 2, x1: F.w / 2, y0: -F.d / 2, y1: F.d / 2 };
    const top = 1.2 + F.sheets * 0.8;
    // a folder of act one's family in grey stock: cover and tab, a stack, a top sheet, a clip at its north edge
    return {
      cover: merge([slab(r, 0, 1.2, 3, 0.4), slab({ x0: -14, x1: 18, y0: r.y1 - 2, y1: r.y1 + 9 }, 0, 1.2, 3, 0.3)]),
      stack: slab({ x0: r.x0 + 5, x1: r.x1 - 5, y0: r.y0 + 5, y1: r.y1 - 5 }, 1.2, top - 0.4, 2, 0.3),
      sheet: slab({ x0: r.x0 + 6, x1: r.x1 - 6, y0: r.y0 + 6, y1: r.y1 - 6 }, top - 0.4, top, 2, 0.1),
      clip: slab({ x0: -12, x1: 12, y0: r.y1 - 15, y1: r.y1 - 3 }, top, top + 4, 2, 0.8),
    };
  }, [F]);
  useLayoutEffect(() => () => Object.values(folder).forEach((x) => x.dispose()), [folder]);
  return (
    <group>
      {desk && <mesh geometry={desk} material={mats.grey} />}
      {span && <mesh geometry={span} material={mats.span} />}
      {t.pressA < 1 && (
        <group position={[F.c[0], F.c[1], -PRESS_DEPTH * t.pressA]} rotation={[0, 0, F.rot]}>
          <mesh geometry={folder.cover} material={mats.folder} />
          <mesh geometry={folder.stack} material={mats.stack} />
          <mesh geometry={folder.sheet} material={mats.sheet} />
          <mesh geometry={folder.clip} material={m.graphiteDark} />
        </group>
      )}
      {A.items.map((it, i) => {
        if (!it) return null;
        const z = crossP(it.x, it.y);
        const zz: P3 = z[2] < 0 ? [-z[0], -z[1], -z[2]] : z;
        const y: P3 = z[2] < 0 ? [-it.y[0], -it.y[1], -it.y[2]] : it.y;
        return <Placed key={i} matrix={basis(it.p, it.x, y, zz)} geometry={geo[A_ITEMS[i].kind]} material={mats[`i${i}`]} />;
      })}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// Fix B: trays growing walls and bands; the replies

function trayGeometry(w: number, d: number, doorAt: number) {
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -d / 2;
  const y1 = d / 2;
  const T = TRAY_Z.wallT;
  const door = 30;
  // walls at unit height (scaled by the wall's rise); the north wall has its door gap facing the deck
  const walls = merge([
    slab({ x0, x1, y0, y1: y0 + T + 2 }, 0, 1, 1.5, 0.1),
    slab({ x0, x1: x0 + T, y0, y1 }, 0, 1, 1.5, 0.1),
    slab({ x0: x1 - T, x1, y0, y1 }, 0, 1, 1.5, 0.1),
    slab({ x0, x1: doorAt - door / 2, y0: y1 - T, y1 }, 0, 1, 1.5, 0.1),
    slab({ x0: doorAt + door / 2, x1, y0: y1 - T, y1 }, 0, 1, 1.5, 0.1),
  ]);
  const floor = slab({ x0: x0 + 1, x1: x1 - 1, y0: y0 + 1, y1: y1 - 1 }, 0, TRAY_Z.floor, 2, 0.4);
  const band = slab({ x0: x0 + 3, x1: x1 - 3, y0: y0 + 0.8, y1: y0 + T + 1.2 }, 0, 2.4, 1, 0.4);
  const card = slab({ x0: -TRAY_CARD.w / 2, x1: TRAY_CARD.w / 2, y0: -TRAY_CARD.d / 2, y1: TRAY_CARD.d / 2 }, 0, 0.7, 1.5, 0.2);
  return { walls, floor, band, card };
}

function FixB({ t }: { t: TurnState }) {
  const m = useDeskMats();
  const B = t.fixB;
  const gs = useMemo(() => TRAYS.map((tr) => trayGeometry(tr.w, tr.d, tr.door)), []);
  const slipG = useMemo(() => piece('chat', B_SLIP.l, B_SLIP.w), []);
  // a reply's print: a mark at its west end (a reply, as the chute's slips), never a number
  const slipTex = useMemo(
    () =>
      texture(
        B_SLIP.l,
        B_SLIP.w,
        (c) => {
          tooth(c, B_SLIP.l, B_SLIP.w);
          c.save();
          c.translate(6, 6);
          c.scale(0.55, 0.55);
          cargoMark(c, 'chat', 0, 0, '#3E3D3A');
          c.restore();
        },
        4,
      ),
    [],
  );
  useLayoutEffect(() => () => slipTex.dispose(), [slipTex]);
  const brk = useMemo(() => {
    const a = TRAYS[BREAK.from];
    const b = TRAYS[BREAK.to];
    const xs = a.c[0];
    const ya = a.c[1] - a.d / 2 - 3;
    const yb = b.c[1] + b.d / 2 + 3;
    const mid = (ya + yb) / 2;
    return merge([
      slab({ x0: xs - 2, x1: xs + 2, y0: mid + 5, y1: ya }, 0, 0.8, 1, 0.2),
      slab({ x0: xs - 2, x1: xs + 2, y0: yb, y1: mid - 5 }, 0, 0.8, 1, 0.2),
      slab({ x0: xs - 7, x1: xs + 7, y0: mid + 4, y1: mid + 6 }, 0, 0.8, 1, 0.2),
      slab({ x0: xs - 7, x1: xs + 7, y0: mid - 6, y1: mid - 4 }, 0, 0.8, 1, 0.2),
    ]);
  }, []);
  useLayoutEffect(
    () => () => {
      gs.forEach((g) => Object.values(g).forEach((x) => x.dispose()));
      slipG.dispose();
      brk.dispose();
    },
    [gs, slipG, brk],
  );
  const mats = useMats(() => {
    const out: Record<string, MeshStandardMaterial> = { brk: paper(whiteTexture(), GREY) };
    TRAYS.forEach((_, k) => {
      out[`w${k}`] = matte(GREY, 0.7);
      out[`f${k}`] = matte(GREY, 0.8);
      out[`b${k}`] = paper(whiteTexture(), GREY);
      out[`c${k}`] = paper(whiteTexture(), GREY_LIGHT);
      out[`s${k}`] = paper(slipTex, GREY_PALE);
    });
    return out;
  }, [slipTex]);
  useLayoutEffect(() => {
    TRAYS.forEach((_, k) => {
      const b = B.built[k];
      mats[`w${k}`].color.copy(lerpHex(GREY, BAY_WALL_HEX, b));
      mats[`f${k}`].color.copy(lerpHex(GREY, BAY_FLOOR_HEX, b));
      mats[`b${k}`].color.copy(lerpHex(GREY, HEX.enamel, b));
      mats[`c${k}`].color.copy(lerpHex(GREY_LIGHT, HEX.paper, b));
      mats[`s${k}`].color.copy(lerpHex(GREY_PALE, HEX.paper, B.slips[k].paper));
    });
    // the break mark steps down into the slate once the bays are built (contrast, never alpha)
    mats.brk.color.copy(lerpHex(GREY, '#2B2D2C', B.built[BREAK.from]));
  }, [B, mats]);
  return (
    <group>
      {TRAYS.map((tr, k) => {
        const h = TRAY_Z.rim + (tr.wall - TRAY_Z.rim) * B.walls[k];
        const g = gs[k];
        return (
          <group key={k} position={[tr.c[0], tr.c[1], 0]}>
            <mesh geometry={g.floor} material={mats[`f${k}`]} />
            <mesh geometry={g.walls} material={mats[`w${k}`]} scale={[1, 1, h]} />
            {B.built[k] > 0 && <mesh geometry={g.band} material={B.built[k] >= 1 ? m.enamel : mats[`b${k}`]} position={[0, 0, h]} />}
            <mesh geometry={g.card} material={mats[`c${k}`]} position={[TRAY_CARD.dx, TRAY_CARD.dy, TRAY_Z.floor + 0.1]} rotation={[0, 0, 0.06 * (k % 3) - 0.06]} />
          </group>
        );
      })}
      {B.built[BREAK.from] < 1 && <mesh geometry={brk} material={mats.brk} />}
      {B.slips.map((s, k) => (
        <mesh key={k} geometry={slipG} material={mats[`s${k}`]} position={s.p} rotation={[s.tilt, 0, s.rot]} />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// The deck's legs, telescoping; the leader; the first slip

const SLEEVE = 58;
function Legs({ t }: { t: TurnState }) {
  const m = useDeskMats();
  const legs = legsAt(t.deck);
  const geo = useMemo(() => {
    const sleeves: BufferGeometry[] = [];
    const rods: BufferGeometry[] = [];
    const feet: BufferGeometry[] = [];
    for (const l of legs) {
      const d = unit([l.top[0] - l.foot[0], l.top[1] - l.foot[1], l.top[2] - l.foot[2]]);
      const mid: P3 = [l.foot[0] + d[0] * SLEEVE, l.foot[1] + d[1] * SLEEVE, l.foot[2] + d[2] * SLEEVE];
      sleeves.push(tube([l.foot, mid], LEG_R + 1.6, 2, 14));
      rods.push(tube([[mid[0] - d[0] * 4, mid[1] - d[1] * 4, mid[2] - d[2] * 4], l.top], LEG_R, 2, 14));
      feet.push(disc(16, 0, 4, { cx: l.foot[0], cy: l.foot[1], bevel: 1.4 }));
    }
    return { sleeves: merge(sleeves), rods: merge(rods), feet: merge(feet), collars: merge(legs.map((l) => {
      const d = unit([l.top[0] - l.foot[0], l.top[1] - l.foot[1], l.top[2] - l.foot[2]]);
      const a: P3 = [l.foot[0] + d[0] * (SLEEVE - 3), l.foot[1] + d[1] * (SLEEVE - 3), l.foot[2] + d[2] * (SLEEVE - 3)];
      const b: P3 = [l.foot[0] + d[0] * (SLEEVE + 1), l.foot[1] + d[1] * (SLEEVE + 1), l.foot[2] + d[2] * (SLEEVE + 1)];
      return tube([a, b], LEG_R + 3, 2, 14);
    })) };
  }, [t.deck]);
  useLayoutEffect(() => () => Object.values(geo).forEach((x) => x.dispose()), [geo]);
  return (
    <group>
      <mesh geometry={geo.feet} material={m.graphiteDark} />
      <mesh geometry={geo.sleeves} material={m.graphite} />
      <mesh geometry={geo.rods} material={m.graphite} />
      <mesh geometry={geo.collars} material={m.enamelShade} />
    </group>
  );
}

/** The leader: the flat run out of the print head as far as it has been laid (its print anchored to its moving end). */
function Leader({ k }: { k: number }) {
  const m = useDeskMats();
  const full = TAPE_FLAT_X1 - TAPE.x0;
  const g = useGeo(() => {
    if (k <= 0.002) return null;
    const x1 = TAPE.x0 + full * k;
    const pos = [TAPE.x0, TAPE.y0, TAPE.z, x1, TAPE.y0, TAPE.z, TAPE.x0, TAPE.y1, TAPE.z, x1, TAPE.y1, TAPE.z];
    const u0 = 1 - k;
    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geom.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    geom.setAttribute('uv', new Float32BufferAttribute([u0, 0, 1, 0, u0, 1, 1, 1], 2));
    geom.setIndex([0, 1, 2, 1, 3, 2]);
    return geom;
  }, [k]);
  return g ? <mesh geometry={g} material={m.printed.tapeBlank} /> : null;
}

function FirstSlip({ s }: { s: NonNullable<TurnState['slip']> }) {
  const m = useDeskMats();
  const g = useMemo(() => piece('chat', NEXT_SLIP.l, NEXT_SLIP.w), []);
  useLayoutEffect(() => () => g.dispose(), [g]);
  return (
    <group position={s.p} rotation={[0, 0, s.heading]}>
      <mesh geometry={g} material={m.printed.chatNext} rotation={[0, -s.slope, 0]} />
    </group>
  );
}

/** The turn's own objects at a state. */
export function TurnObjects({ t, printFamily }: { t: TurnState; printFamily: string }) {
  const loopMats = useLoopMats(printFamily);
  return (
    <>
      {t.loop.ribbon && <Ribbon r={t.loop.ribbon} mats={loopMats} />}
      {t.loop.coil && <Coil c={t.loop.coil} mats={loopMats} />}
      <FixA t={t} />
      <FixB t={t} />
      {t.f >= 1452 && <Legs t={t} />}
      {t.tape.leader < 1 && <Leader k={t.tape.leader} />}
      {t.slip && <FirstSlip s={t.slip} />}
    </>
  );
}

