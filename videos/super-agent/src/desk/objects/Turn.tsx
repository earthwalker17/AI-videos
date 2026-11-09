/**
 * The turn's own objects (desk/turn.ts, MT2): what exists only while one thing becomes another.
 * - the notes loop as it lifts, turns on edge (its outer edge up) and coils, its clip and its tabs
 *   riding the outer turn all the way to the lock (the tabs folded in over the rim, the clip clamped on
 *   it); then the coil (the reel's pack, hub and spokes) as Fix A's tape winds in, glides, descends and
 *   locks;
 * - Fix A: its folder (pressed into the desk as one body), its tape on the desk (grey stock) and up to
 *   the coil (paper), the queue riding it;
 * - Fix B: the replies going home; five trays pressed flat into the desk; three walled up into the bays
 *   of (b): their walls grow to the bay's, the nameplate prints, the floor drops and slides away under
 *   the slate and the bay's work (objects/Bay.tsx) rises out of its hatch inside the walls;
 * - the deck's legs as they telescope, the tape's leader out of the print head, the first chat slip.
 *
 * Everything else (your desk, the feeders, the act-one folders and heap, the Register) is drawn by
 * its own component, posed by the turn.
 */
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Matrix4, Path, RepeatWrapping, RingGeometry, Shape, type Material, type MeshStandardMaterial, type Texture } from 'three';
import { LOOP_A, FOLDERS, loopNormal, loopPoint, tabAt, TAB, type LoopPose } from '../actOne.ts';
import { A_ITEMS, A_SIZE, A_TAPE_W, BAY_TRAYS, BREAK, B_SLIP, FIX_A_FOLDER, TRAYS, TRAY_CARD, TRAY_Z, aPathAt, type AItemKind } from '../beat3.ts';
import { cylinderZ, disc, extrude, merge, slab, tube } from '../geom.ts';
import { HEX, graphite, matte, paper, whiteTexture } from '../gl/materials.ts';
import { cargoMark, texture, tooth } from '../gl/text.ts';
import { useDeskMats, useDeskSets } from '../kit.tsx';
import { BAYS, LEG_R, NEXT_SLIP, REEL, TAPE, TAPE_FLAT_X1, type BayId, type P2, type P3, type Rect } from '../layout.ts';
import { BAY_DEPTH, CLIP_T, TRAY_REST, TURN, bayShapeAt, coilRim, legsAt, replyLands, shapeWalls, turnDeskState, type BayTurn, type Press, type TurnState } from '../turn.ts';
import { BugBay, DocsBay, TestsBay } from './Bay.tsx';
import { TAPE_HEX, clipGeometry, fitUv, loopArc, loopNoteFlips, loopNotes, makeActOnePrint, piece, slipShape } from './ActOne.tsx';

/** Grey stock: the road not taken (STORYBOARD's palette). */
const GREY = '#77756F';
const GREY_LIGHT = '#8A8781';
/** Fix B's replies: a paler grey stock, so the jostling pile reads slip by slip on the in-tray. */
const GREY_PALE = '#9B9891';
/** A bay's wall at rest (the kit's graphite) and its nameplate band's enamel. */
const BAY_WALL_HEX = '#626764';
/** A dark work slot: no task has been dispatched yet, so nothing computes. */
const SLOT_IDLE = '#1E2120';

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
const add = (a: P3, b: P3, k = 1): P3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** A pressed body: squashed flat on the desk, tilted north edge down and sunk (the press's one transform). */
function Pressed({ p, children }: { p?: Press | null; children: ReactNode }) {
  if (!p || p.k <= 0) return <>{children}</>;
  return (
    <group position={[0, 0, -p.sink]} rotation={[-p.tilt, 0, 0]} scale={[1, 1, p.scaleZ]}>
      {children}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// The loop: a ribbon turning on edge, outer edge up (the act-one ribbon at edge 0); its tabs fold in over the rim; its clip

/** The ribbon's frame at parameter t: the centreline point, the tangent, the outer-edge direction and the face normal. */
function ribbonFrame(L: LoopPose, t: number, edge: number): { c: P3; tan: P3; out: P3; nrm: P3; n: P2 } {
  const p = loopPoint(L, t);
  const n = loopNormal(L, t);
  const th = (edge * Math.PI) / 2;
  const tan: P3 = [-n[1], n[0], 0];
  return { c: [p[0], p[1], L.z + (L.w / 2) * Math.sin(th)], tan, out: [n[0] * Math.cos(th), n[1] * Math.cos(th), Math.sin(th)], nrm: [-n[0] * Math.sin(th), -n[1] * Math.sin(th), Math.cos(th)], n };
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

/** One tab in its own frame (as act one's, its punched hole too: x across its base, y outward, its thickness in z). */
function tabLocal(): BufferGeometry {
  const s = new Shape();
  const hw = TAB.w / 2;
  const l = TAB.l;
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, l - 5);
  s.quadraticCurveTo(hw, l, hw - 5, l);
  s.lineTo(-hw + 5, l);
  s.quadraticCurveTo(-hw, l, -hw, l - 5);
  s.closePath();
  const hole = new Path();
  hole.absarc(0, l - 8, 2.6, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return extrude(s, -0.2, 0.5, 0.2);
}

/** Each tab's parameter on the loop and its turn toward its folder (the angle from the loop's normal), as act one placed it. */
const TABS = FOLDERS.map((fl) => {
  const t = tabAt(LOOP_A, fl);
  const p = loopPoint(LOOP_A, t);
  const n = loopNormal(LOOP_A, t);
  const base: P2 = [p[0] + n[0] * (LOOP_A.w / 2 - 3), p[1] + n[1] * (LOOP_A.w / 2 - 3)];
  const d0: P2 = [fl.c[0] - base[0], fl.c[1] - base[1]];
  const l = Math.hypot(d0[0], d0[1]);
  const d: P2 = [d0[0] / l, d0[1] / l];
  const tan: P2 = [-n[1], n[0]];
  return { t, phi: Math.atan2(d[0] * tan[0] + d[1] * tan[1], d[0] * n[0] + d[1] * n[1]) };
});

/**
 * A tab's pose: off the tape's outer edge, turned toward its folder (act one); as the tape turns on edge it
 * straightens and, folded in over the rim (`fold`), lies on the coil's top pointing to its centre.
 */
function tabMatrix(L: LoopPose, edge: number, fold: number, k: number, spin = 0): Matrix4 {
  const T = TABS[k];
  const F = ribbonFrame(L, T.t + spin, edge);
  const psi = T.phi * (1 - fold);
  const y0: P3 = unit(add([F.out[0] * Math.cos(psi), F.out[1] * Math.cos(psi), F.out[2] * Math.cos(psi)], F.tan, Math.sin(psi)));
  const x: P3 = unit(add([F.out[0] * Math.sin(psi), F.out[1] * Math.sin(psi), F.out[2] * Math.sin(psi)], F.tan, -Math.cos(psi)));
  const z0 = F.nrm;
  const ph = (fold * Math.PI) / 2;
  const y: P3 = [Math.cos(ph) * y0[0] + Math.sin(ph) * z0[0], Math.cos(ph) * y0[1] + Math.sin(ph) * z0[1], Math.cos(ph) * y0[2] + Math.sin(ph) * z0[2]];
  const z: P3 = [-Math.sin(ph) * y0[0] + Math.cos(ph) * z0[0], -Math.sin(ph) * y0[1] + Math.cos(ph) * z0[1], -Math.sin(ph) * y0[2] + Math.cos(ph) * z0[2]];
  const o = add(add(F.c, F.out, L.w / 2 - 3 * (1 - fold)), [0, 0, 1], 0.9 * fold);
  return basis(o, x, y, z);
}

/**
 * The clip: built where act one put it (objects/ActOne.tsx clipGeometry), level, carried by the tape at its place and
 * riding up to the outer edge as the tape turns on edge, so on the coil it is clamped over the rim.
 */
const CLIP_FROM = (() => {
  const p = loopPoint(LOOP_A, CLIP_T);
  const n = loopNormal(LOOP_A, CLIP_T);
  return basis([p[0], p[1], 0], [n[0], n[1], 0], [-n[1], n[0], 0], [0, 0, 1]).invert();
})();
function clipMatrix(L: LoopPose, edge: number, spin = 0): Matrix4 {
  const F = ribbonFrame(L, CLIP_T + spin, edge);
  const o = add(F.c, F.out, (L.w / 2) * edge);
  return basis([o[0], o[1], o[2] - LOOP_A.z], [F.n[0], F.n[1], 0], [-F.n[1], F.n[0], 0], [0, 0, 1]).multiply(CLIP_FROM);
}

function Placed({ matrix, geometry, material }: { matrix: Matrix4; geometry: BufferGeometry; material: Material }) {
  return <mesh geometry={geometry} material={material} matrix={matrix} matrixAutoUpdate={false} />;
}

/** The loop's print and tab stock, made once for act one's loop (the print rides the tape as it turns and coils). */
function useLoopMats(printFamily: string) {
  const len = useMemo(() => loopArc(LOOP_A).len, []);
  const print = useMemo(() => makeActOnePrint(printFamily, 4, Math.ceil(len), loopNotes(len), loopNoteFlips(LOOP_A, loopNotes(len))), [printFamily, len]);
  const mats = useMats(() => {
    const tape = paper(print.tape, TAPE_HEX.tape);
    tape.side = DoubleSide;
    return { tape, tab: paper(whiteTexture(), TAPE_HEX.tab), pack: paper(whiteTexture(), TAPE_HEX.tape) };
  }, [print]);
  useLayoutEffect(() => () => [...print.top, ...print.card, print.tape, ...print.chat, ...print.ci].forEach((x) => x.dispose()), [print]);
  return mats;
}

/** The clip and the tabs on the loop's outer turn (the ribbon's, or the coil's rim). */
function Riders({ L, edge, fold, spin, mats }: { L: LoopPose; edge: number; fold: number; spin: number; mats: ReturnType<typeof useLoopMats> }) {
  const m = useDeskMats();
  const tab = useGeo(() => tabLocal(), []);
  const clip = useMemo(() => clipGeometry(LOOP_A), []);
  useLayoutEffect(() => () => Object.values(clip).forEach((x) => x.dispose()), [clip]);
  const cm = clipMatrix(L, edge, spin);
  return (
    <group>
      {TABS.map((_, k) => (
        <Placed key={k} matrix={tabMatrix(L, edge, fold, k, spin)} geometry={tab} material={mats.tab} />
      ))}
      <Placed matrix={cm} geometry={clip.body} material={m.enamel} />
      <Placed matrix={cm} geometry={clip.spine} material={m.graphiteDark} />
      <Placed matrix={cm} geometry={clip.wire} material={m.steel} />
    </group>
  );
}

function Ribbon({ r, mats }: { r: NonNullable<TurnState['loop']['ribbon']>; mats: ReturnType<typeof useLoopMats> }) {
  const g = useGeo(() => ribbonGeometry(r.L, r.edge), [r.L, r.edge]);
  return (
    <group>
      <mesh geometry={g} material={mats.tape} />
      <Riders L={r.L} edge={r.edge} fold={r.fold} spin={0} mats={mats} />
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

function Coil({ c, edge, fold, mats }: { c: NonNullable<TurnState['loop']['coil']>; edge: number; fold: number; mats: ReturnType<typeof useLoopMats> }) {
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
  const rim = coilRim(c);
  return (
    <group>
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
      {/* the loop's clip and its tabs on the outer turn: the reel was your notes */}
      <Riders L={rim} edge={edge} fold={fold} spin={c.spin} mats={mats} />
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
  const hole = (x: number, y: number, rx: number, ry: number) => {
    const h = new Shape();
    h.absellipse(x, y, rx, ry, 0, Math.PI * 2, true);
    s.holes.push(h);
  };
  hole(bx, 0, 5, 4);
  hole(bx - 7.5, 0, 2, 2.3);
  for (const side of [-1, 1]) for (const k of [-1, 0, 1]) hole(bx + k * 3.2, side * 6, 0.8, 1.9);
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
      {t.pressA.k < 1 && (
        <group position={[F.c[0], F.c[1], 0]} rotation={[0, 0, F.rot]}>
          <Pressed p={t.pressA}>
            <mesh geometry={folder.cover} material={mats.folder} />
            <mesh geometry={folder.stack} material={mats.stack} />
            <mesh geometry={folder.sheet} material={mats.sheet} />
            <mesh geometry={folder.clip} material={m.graphiteDark} />
          </Pressed>
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
// Fix B: the trays (pressed flat, or walled up into the bays), the replies

/** A tray at rest (tray-local): its floor, its low walls (the north wall with its door gap), its event card. */
function trayGeometry(w: number, d: number, doorAt: number) {
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -d / 2;
  const y1 = d / 2;
  const T = TRAY_Z.wallT;
  const door = 30;
  const walls = merge([
    slab({ x0, x1, y0, y1: y0 + T + 2 }, 0, TRAY_Z.rim, 1.5, 0.1),
    slab({ x0, x1: x0 + T, y0, y1 }, 0, TRAY_Z.rim, 1.5, 0.1),
    slab({ x0: x1 - T, x1, y0, y1 }, 0, TRAY_Z.rim, 1.5, 0.1),
    slab({ x0, x1: doorAt - door / 2, y0: y1 - T, y1 }, 0, TRAY_Z.rim, 1.5, 0.1),
    slab({ x0: doorAt + door / 2, x1, y0: y1 - T, y1 }, 0, TRAY_Z.rim, 1.5, 0.1),
  ]);
  const floor = slab({ x0: x0 + 1, x1: x1 - 1, y0: y0 + 1, y1: y1 - 1 }, 0, TRAY_Z.floor, 2, 0.4);
  const card = slab({ x0: -TRAY_CARD.w / 2, x1: TRAY_CARD.w / 2, y0: -TRAY_CARD.d / 2, y1: TRAY_CARD.d / 2 }, 0, 0.7, 1.5, 0.2);
  return { walls, floor, card };
}

/** A reply's print: a mark at its west end (a reply, as the chute's slips), never a number. */
function useReplyTexture(): Texture {
  const t = useMemo(
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
  useLayoutEffect(() => () => t.dispose(), [t]);
  return t;
}

/** The nameplate band on a growing south wall: its print wiped in from the west (u 0..k of the band's texture), the rest blank enamel. */
function bandGeometry(r: Rect, z: number, k: number): { printed: BufferGeometry | null; blank: BufferGeometry | null } {
  const w = r.x1 - r.x0;
  const xk = r.x0 + w * k;
  const quad = (x0: number, x1: number, u0: number, u1: number) => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([x0, r.y0, z, x1, r.y0, z, x0, r.y1, z, x1, r.y1, z], 3));
    g.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    g.setAttribute('uv', new Float32BufferAttribute([u0, 0, u1, 0, u0, 1, u1, 1], 2));
    g.setIndex([0, 1, 2, 1, 3, 2]);
    return g;
  };
  return { printed: k > 0.002 ? quad(r.x0, xk, 0, k) : null, blank: k < 0.998 ? quad(xk, r.x1, k, 1) : null };
}

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });
/** How far a growing bay's walls stand proud of the risen bay's own (so the two never share a face). */
const PROUD = 0.5;

/** The imported bay at rest (objects/Bay.tsx), for an id; the bug bay without the request (it is still in the heap: it docks there at 4.3). */
function BayWork({ id, f }: { id: BayId; f: number }) {
  const s = useMemo(() => turnDeskState(f), [f]);
  return id === 'tests' ? <TestsBay s={s} /> : id === 'docs' ? <DocsBay s={s} /> : <BugBay s={s} noRequest />;
}

/** One of the three trays that wall up into a bay. */
function BayTray({ k, b, f, slip, slipMat, mats, card }: { k: number; b: BayTurn; f: number; slip: { rot: number } | null; slipMat: MeshStandardMaterial; mats: { wall: MeshStandardMaterial; floor: MeshStandardMaterial; band: MeshStandardMaterial; card: MeshStandardMaterial }; card: BufferGeometry }) {
  const m = useDeskMats();
  const L = BAYS[b.id];
  const s = bayShapeAt(k, L, b.grow);
  const proud = PROUD * b.grow;
  const wallH = TRAY_Z.rim + (s.wallH + 0.3 - TRAY_Z.rim) * b.grow;
  const walls = useGeo(() => merge(shapeWalls(s).map((w) => slab(inset(w, -proud), 0, wallH, 3 * b.grow + 1.5 * (1 - b.grow), 3 * b.grow + 0.1 * (1 - b.grow)))), [s.box.x0, s.box.x1, s.box.y0, s.box.y1, s.wall, s.southWall, s.door[0], s.door[1], wallH, proud]);
  // the floor: the tray's, grown with its walls; it drops under the slate and slides east out of them
  const fr = inset(s.box, s.wall);
  const floor = useGeo(() => slab(fr, 0, TRAY_Z.floor, 2, 0.4), [fr.x0, fr.x1, fr.y0, fr.y1]);
  const south = shapeWalls(s)[2];
  const band = useMemo(() => bandGeometry(inset(south, 2), wallH + 0.25, b.print), [south.x0, south.x1, south.y0, south.y1, wallH, b.print]);
  useLayoutEffect(() => () => Object.values(band).forEach((g) => g?.dispose()), [band]);
  const fx = (fr.x1 - fr.x0 + 40) * b.slide;
  const fz = -3.6 * b.drop;
  // the card and the reply keep their places on the floor as it grows (relative to its centre)
  const fc: P2 = [(fr.x0 + fr.x1) / 2, (fr.y0 + fr.y1) / 2];
  const sc = (fr.x1 - fr.x0) / (TRAYS[k].w - 2);
  const showRise = b.rise > 0 || b.hatch;
  return (
    <group>
      <mesh geometry={walls} material={mats.wall} />
      {b.built > 0.002 && band.blank && <mesh geometry={band.blank} material={mats.band} />}
      {band.printed && <mesh geometry={band.printed} material={m.printed.nameplate[b.id]} />}
      {b.slide < 1 && (
        <group position={[fx, 0, fz]}>
          <mesh geometry={floor} material={mats.floor} />
          <group position={[fc[0], fc[1], 0]}>
            <mesh geometry={card} material={mats.card} position={[TRAY_CARD.dx * sc, TRAY_CARD.dy * sc, TRAY_Z.floor + 0.1]} rotation={[0, 0, 0.06 * (k % 3) - 0.06]} />
            {slip && <SlipMesh p={[TRAY_REST[0] * sc, TRAY_REST[1] * sc, TRAY_REST[2]]} rot={slip.rot} tilt={0} material={slipMat} />}
          </group>
        </group>
      )}
      {showRise && (
        <group position={[0, 0, -BAY_DEPTH[b.id] * (1 - b.rise)]}>
          <BayWork id={b.id} f={f} />
        </group>
      )}
    </group>
  );
}

function SlipMesh({ p, rot, tilt, material }: { p: P3; rot: number; tilt: number; material: Material }) {
  const g = useGeo(() => piece('chat', B_SLIP.l, B_SLIP.w), []);
  return <mesh geometry={g} material={material} position={p} rotation={[tilt, 0, rot]} />;
}

function FixB({ t }: { t: TurnState }) {
  const sets = useDeskSets();
  const B = t.fixB;
  const gs = useMemo(() => TRAYS.map((tr) => trayGeometry(tr.w, tr.d, tr.door)), []);
  const slipTex = useReplyTexture();
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
      brk.dispose();
    },
    [gs, brk],
  );
  const mats = useMats(() => {
    const out: Record<string, MeshStandardMaterial> = { brk: paper(whiteTexture(), GREY), tray: matte(GREY, 0.7), floor: matte(GREY, 0.8), card: paper(whiteTexture(), GREY_LIGHT) };
    TRAYS.forEach((_, k) => (out[`s${k}`] = paper(slipTex, GREY_PALE)));
    BAY_TRAYS.forEach(({ k }) => {
      out[`w${k}`] = graphite(GREY, { metalness: 0, roughness: 0.7 });
      out[`b${k}`] = paper(whiteTexture(), GREY);
    });
    return out;
  }, [slipTex]);
  const breakGone = Math.min(B.press[BREAK.from]?.k ?? 0, 1);
  useLayoutEffect(() => {
    // a walled-up tray turns from grey stock to the bay's graphite, its band to enamel (contrast, never alpha)
    BAY_TRAYS.forEach(({ k }, i) => {
      const b = B.bays[i].built;
      const w = mats[`w${k}`];
      w.color.copy(lerpHex(GREY, BAY_WALL_HEX, b));
      w.metalness = 0.55 * b;
      w.roughness = 0.7 + (0.42 - 0.7) * b;
      mats[`b${k}`].color.copy(lerpHex(GREY, HEX.enamel, b));
    });
    // the break mark steps down into the slate as the tray it starts from is pressed in
    mats.brk.color.copy(lerpHex(GREY, '#2B2D2C', breakGone));
    // no Worker computes yet: every work slot is dark (they light when a task is dispatched, 4.3 on)
    for (const set of [sets.full, sets.stepped]) for (const s of [set.slotBug, set.slotTests, set.slotDocs]) s.color.set(SLOT_IDLE);
  });
  const landed = (k: number) => t.f >= replyLands(k);
  return (
    <group>
      {TRAYS.map((tr, k) => {
        const p = B.press[k];
        if (!p || p.k >= 1) return null;
        const g = gs[k];
        return (
          <group key={k} position={[tr.c[0], tr.c[1], 0]}>
            <Pressed p={p}>
              <mesh geometry={g.floor} material={mats.floor} />
              <mesh geometry={g.walls} material={mats.tray} />
              <mesh geometry={g.card} material={mats.card} position={[TRAY_CARD.dx, TRAY_CARD.dy, TRAY_Z.floor + 0.1]} rotation={[0, 0, 0.06 * (k % 3) - 0.06]} />
              {landed(k) && <SlipMesh p={TRAY_REST} rot={B.slips[k].rot} tilt={0} material={mats[`s${k}`]} />}
            </Pressed>
          </group>
        );
      })}
      {BAY_TRAYS.map(({ k }, i) => {
        const b = B.bays[i];
        const g = gs[k];
        if (b.grow <= 0 && b.drop <= 0) {
          const tr = TRAYS[k];
          return (
            <group key={k} position={[tr.c[0], tr.c[1], 0]}>
              <mesh geometry={g.floor} material={mats.floor} />
              <mesh geometry={g.walls} material={mats.tray} />
              <mesh geometry={g.card} material={mats.card} position={[TRAY_CARD.dx, TRAY_CARD.dy, TRAY_Z.floor + 0.1]} rotation={[0, 0, 0.06 * (k % 3) - 0.06]} />
              {landed(k) && <SlipMesh p={TRAY_REST} rot={B.slips[k].rot} tilt={0} material={mats[`s${k}`]} />}
            </group>
          );
        }
        return <BayTray key={k} k={k} b={b} f={t.f} slip={landed(k) ? { rot: B.slips[k].rot } : null} slipMat={mats[`s${k}`]} mats={{ wall: mats[`w${k}`], floor: mats.floor, band: mats[`b${k}`], card: mats.card }} card={g.card} />;
      })}
      {breakGone < 1 && <mesh geometry={brk} material={mats.brk} />}
      {/* the replies in flight (and in your in-tray before they leave) */}
      {B.slips.map((s, k) => (landed(k) ? null : <SlipMesh key={k} p={s.p} rot={s.rot} tilt={s.tilt} material={mats[`s${k}`]} />))}
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
    const collars: BufferGeometry[] = [];
    for (const l of legs) {
      const d = unit([l.top[0] - l.foot[0], l.top[1] - l.foot[1], l.top[2] - l.foot[2]]);
      // the sleeve the leg telescopes out of: it closes down into the foot as the leg comes up, so a leg at rest is one rod
      const sl = SLEEVE * (1 - l.up);
      const mid: P3 = [l.foot[0] + d[0] * sl, l.foot[1] + d[1] * sl, l.foot[2] + d[2] * sl];
      if (sl > 1) {
        sleeves.push(tube([l.foot, mid], LEG_R + 1.6, 2, 14));
        collars.push(tube([add(l.foot, d, sl - 3), add(l.foot, d, sl + 1)], LEG_R + 3, 2, 14));
      }
      rods.push(tube([sl > 1 ? add(mid, d, -4) : l.foot, l.top], LEG_R, 2, 14));
      feet.push(disc(16, 0, 4, { cx: l.foot[0], cy: l.foot[1], bevel: 1.4 }));
    }
    return { sleeves: sleeves.length ? merge(sleeves) : null, rods: merge(rods), feet: merge(feet), collars: collars.length ? merge(collars) : null };
  }, [legs]);
  useLayoutEffect(() => () => Object.values(geo).forEach((x) => x?.dispose()), [geo]);
  return (
    <group>
      <mesh geometry={geo.feet} material={m.graphiteDark} />
      {geo.sleeves && <mesh geometry={geo.sleeves} material={m.graphite} />}
      <mesh geometry={geo.rods} material={m.graphite} />
      {geo.collars && <mesh geometry={geo.collars} material={m.enamelShade} />}
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
      {t.loop.coil && <Coil c={t.loop.coil} edge={t.loop.edge} fold={t.loop.fold} mats={loopMats} />}
      <FixA t={t} />
      <FixB t={t} />
      {t.f >= TURN.deckIn && <Legs t={t} />}
      {t.tape.leader < 1 && <Leader k={t.tape.leader} />}
      {t.slip && <FirstSlip s={t.slip} />}
    </>
  );
}
