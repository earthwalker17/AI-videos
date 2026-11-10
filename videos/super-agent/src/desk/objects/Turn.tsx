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
import { useFont } from '@aiv/remotion-kit';
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Matrix4, Path, RepeatWrapping, RingGeometry, Shape, type Material, type MeshStandardMaterial, type Texture } from 'three';
import { HEAP, LOOP_A, FOLDERS, PIECE, REQUEST_A, loopNormal, loopPoint, requestZ, tabAt, TAB, type ActOneState, type LoopPose, type PieceKind } from '../actOne.ts';
import { A_CHUTES, A_FOLDER_TOP, A_ITEMS, A_PILE, A_PITCH, A_SIZE, A_TAPE_W, BAY_TRAYS, BREAK, B_SLIP, EVENT_SIZE, FIX_A_FOLDER, FOLLOW_UP, STUB, TEAR, TRAYS, TRAY_CARD, TRAY_STUFF, TRAY_Z, aPathAt, followUpAt, tearAt, type AItemKind, type AItemPose, type EventKind, type FixAView } from '../beat3.ts';
import { ON_REQUEST, RIDE, WORK_DEPTH, heapPieceAt, type HeapState, type RequestState } from '../beat4.ts';
import { bayDoor } from '../footprints.ts';
import { cylinderZ, disc, extrude, merge, slab, tornShape, tube } from '../geom.ts';
import { HEX, graphite, paper, stepColour, whiteTexture } from '../gl/materials.ts';
import { PRINT_FONT, cargoMark, texture, tooth } from '../gl/text.ts';
import { useDeskMats, useDeskSets, useStepMode } from '../kit.tsx';
import { BAYS, BAY_FLOOR, LEG_R, NEXT_SLIP, REEL, TAPE, TAPE_FLAT_X1, type BayId, type P2, type P3, type Rect } from '../layout.ts';
import { CLIP_T, TRAY_REST, TURN, bayShapeAt, coilRim, legsAt, replyLands, shapeWalls, turnDeskState, type BayTurn, type CoilState, type Press, type TurnState } from '../turn.ts';
import { BeetleLight, BugBay, DocsBay, SLOT_IDLE, TestsBay } from './Bay.tsx';
import { Hatch } from './Dispatch.tsx';
import { bubbleMark } from './Intake.tsx';
import { TAPE_HEX, clipGeometry, fitUv, loopArc, loopNoteFlips, loopNotes, makeActOnePrint, piece, requestGeometry, slipShape } from './ActOne.tsx';

/** Grey stock: the road not taken (STORYBOARD's palette). */
export const GREY = '#77756F';
export const GREY_LIGHT = '#8A8781';
/** Fix B's replies: a paler grey stock, so the jostling pile reads slip by slip on the in-tray. */
export const GREY_PALE = '#9B9891';
/** A bay's wall at rest (the kit's graphite) and its nameplate band's enamel. */
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
function Riders({ L, edge, fold, spin, tabMat }: { L: LoopPose; edge: number; fold: number; spin: number; tabMat: Material }) {
  const m = useDeskMats();
  const tab = useGeo(() => tabLocal(), []);
  const clip = useMemo(() => clipGeometry(LOOP_A), []);
  useLayoutEffect(() => () => Object.values(clip).forEach((x) => x.dispose()), [clip]);
  const cm = clipMatrix(L, edge, spin);
  return (
    <group>
      {TABS.map((_, k) => (
        <Placed key={k} matrix={tabMatrix(L, edge, fold, k, spin)} geometry={tab} material={tabMat} />
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
      <Riders L={r.L} edge={r.edge} fold={r.fold} spin={0} tabMat={mats.tab} />
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
      <Riders L={rim} edge={edge} fold={fold} spin={c.spin} tabMat={mats.tab} />
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// Fix A: the folder and its pile, the tape (on the desk and raised along the feeders), the chutes, the queue

/**
 * Grey stock, the road not taken (fixes A and B): an albedo that lights to luma 117 and up where it leads, its shade (a
 * stack's sides, a tray's floor), its light (a top sheet, an event card), the tape's stock, and the holes punched in it.
 */
export const FIX_HEX = { stock: '#A8A59D', shade: '#86837C', light: '#BFBBB2', tape: '#ADA9A1', item: '#C3BFB6', reply: '#B9B5AC', request: '#74716A', ink: '#3E3D3A', hole: '#232524', band: '#4C4F4D' } as const;

/** A ribbon along a list of centre points with width vectors, its u by material distance. */
export function stripGeometry(pts: readonly { p: P3; w: P3; u: number }[], half: number): BufferGeometry | null {
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

/** The tape's print: its tooth and round sprocket holes punched along both edges (the slate shows through), two a station; 128 u a repeat. */
const A_TEX_LEN = 128;
export function tapeTexture(): Texture {
  const t = texture(
    A_TEX_LEN,
    A_TAPE_W,
    (g) => {
      tooth(g, A_TEX_LEN, A_TAPE_W);
      g.fillStyle = FIX_HEX.hole;
      for (let x = 4; x < A_TEX_LEN; x += A_PITCH / 2) {
        for (const y of [3.4, A_TAPE_W - 3.4]) {
          g.beginPath();
          g.arc(x, y, 1.7, 0, Math.PI * 2);
          g.fill();
        }
      }
    },
    4,
  );
  t.wrapS = RepeatWrapping;
  return t;
}

/** Prints for the queue's stock: a chat slip's speech bubble (one filled shape, no rules), a CI card's punches, a task card's pictogram; the request's copy is bare (its beetle is cut out). */
export function itemTexture(kind: AItemKind, v: number): Texture {
  const [l, w] = A_SIZE[kind];
  return texture(
    l,
    w,
    (g) => {
      tooth(g, l, w);
      g.save();
      const ink = FIX_HEX.ink;
      if (kind === 'ci') {
        g.fillStyle = ink;
        for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) if ((i * 7 + r * 3 + v) % 5 !== 0) g.fillRect(8 + i * 4.2, 6 + r * 8, 2.2, 4.6);
      } else if (kind === 'task') {
        // the task's pictogram, a little under two-thirds of the card (a mark on a card, never a black slab)
        g.translate(l / 2 - 11, w / 2 - 7);
        g.scale(0.64, 0.64);
        cargoMark(g, v % 2 ? 'ci' : 'docs', 0, 0, ink);
      } else if (kind === 'chat') {
        bubbleMark(g, 4, w * 0.18, w * 0.56, ink);
      }
      g.restore();
    },
    4,
  );
}

/** The request's grey copy: 1.3x a chat slip, its beetle cut out (as act one's request, never vermilion here). */
export function requestCopy(): BufferGeometry {
  const [l, w] = A_SIZE.request;
  const s = slipShape('chat', l, w);
  // the beetle as large as the slip allows (its body about 23 px long at 1.2x), so the cut-out reads at the tape's scale
  const bx = -l / 2 + 21;
  const hole = (x: number, y: number, rx: number, ry: number) => {
    const h = new Shape();
    h.absellipse(x, y, rx, ry, 0, Math.PI * 2, true);
    s.holes.push(h);
  };
  // (each hole clear of the next by 2 u or more: holes that touch are dropped by the triangulator, as the body was)
  hole(bx, 0, 9.5, 6.2);
  hole(bx - 15, 0, 3.2, 3.4);
  for (const side of [-1, 1]) for (const k of [-1, 0, 1]) hole(bx + k * 5.6, side * 11.4, 1.3, 2.4);
  return fitUv(extrude(s, 0, 0.8, 0.2), l, w);
}

/** An item lying on its axes (the basis keeps its top face up). */
function ItemMesh({ it, geometry, material }: { it: { p: P3; x: P3; y: P3 }; geometry: BufferGeometry; material: Material }) {
  const z = crossP(it.x, it.y);
  const zz: P3 = z[2] < 0 ? [-z[0], -z[1], -z[2]] : z;
  const y: P3 = z[2] < 0 ? [-it.y[0], -it.y[1], -it.y[2]] : it.y;
  return <Placed matrix={basis(it.p, it.x, y, zz)} geometry={geometry} material={material} />;
}

/** A chute: a grey-stock trough out of a feeder's mouth onto the tape, slid out by e (0..1): its floor and two low lips, sloped to the tape. */
function chuteGeometry(c: (typeof A_CHUTES)[number], e: number): BufferGeometry {
  const L = (c.x1 - c.x0) * e;
  const h = c.w / 2;
  const g = merge([slab({ x0: 0, x1: L, y0: -h, y1: h }, -1.2, 0, 1.5, 0.3), slab({ x0: 0, x1: L, y0: -h, y1: -h + 2.2 }, 0, 3, 1, 0.3), slab({ x0: 0, x1: L, y0: h - 2.2, y1: h }, 0, 3, 1, 0.3)]);
  const z1 = c.z0 + (c.z1 - c.z0) * e;
  g.rotateY(Math.atan2(c.z0 - z1, Math.max(L, 1e-3)));
  g.translate(c.x0, c.y, c.z0);
  return g;
}

/**
 * Fix A in grey stock (beat 3, then the turn winds its tape onto the reel): its fat folder with the pile it has taken in,
 * its one tape (down the feeders, raised clear of the heap, then along the desk into the folder), the chutes, and the
 * queue riding it; posed by beat3.ts fixAAt in beat 3 and turn.ts fixATurnAt from f1400 (whose items carry no kind: they
 * are A_ITEMS by index). Its materials step down with the enclosing `<Step>` (beat 3.2: the focus moves to Fix B).
 */
export function FixA({ fixA, pressA }: { fixA: FixAView | TurnState['fixA']; pressA: TurnState['pressA'] }) {
  const m = useDeskMats();
  const mode = useStepMode();
  const A = fixA as FixAView;
  const tex = useMemo(() => tapeTexture(), []);
  const kindTex = useMemo(() => Object.fromEntries((['chat', 'ci', 'task', 'request'] as const).flatMap((k) => [0, 1, 2, 3].map((v) => [`${k}${v}`, itemTexture(k, v)]))) as Record<string, Texture>, []);
  const geo = useMemo(() => ({ chat: piece('chat', ...A_SIZE.chat), ci: piece('ci', ...A_SIZE.ci), task: piece('ci', ...A_SIZE.task), request: requestCopy() }), []);
  const F = FIX_A_FOLDER;
  const folder = useMemo(() => {
    const r = { x0: -F.w / 2, x1: F.w / 2, y0: -F.d / 2, y1: F.d / 2 };
    // grey stock: a torn-edged cover, a fat stack (its sides in shade), a top sheet, a clip and a tab on its north edge
    return {
      cover: extrude(tornShape(F.w, F.d, 3, 'nesw', 1.8, 6), 0, 1.4, 0.4),
      tab: slab({ x0: -16, x1: 20, y0: r.y1 - 2, y1: r.y1 + 10 }, 0, 1.4, 3, 0.3),
      stack: slab({ x0: r.x0 + 5, x1: r.x1 - 5, y0: r.y0 + 5, y1: r.y1 - 5 }, 1.4, A_FOLDER_TOP - 0.5, 2, 0.4),
      sheet: extrude(tornShape(F.w - 14, F.d - 14, 5, 'se', 1.4, 5), A_FOLDER_TOP - 0.5, A_FOLDER_TOP, 0.2),
      clip: slab({ x0: -14, x1: 14, y0: r.y1 - 16, y1: r.y1 - 3 }, A_FOLDER_TOP, A_FOLDER_TOP + 4.5, 2, 0.8),
    };
  }, [F]);
  useLayoutEffect(
    () => () => {
      tex.dispose();
      Object.values(kindTex).forEach((x) => x.dispose());
      Object.values(geo).forEach((x) => x.dispose());
      Object.values(folder).forEach((x) => x.dispose());
    },
    [tex, kindTex, geo, folder],
  );
  const mats = useMats(() => {
    const o = { stepped: mode };
    const out: Record<string, MeshStandardMaterial> = {
      tape: paper(tex, FIX_HEX.tape, o),
      span: paper(tex, TAPE_HEX.tape, o),
      cover: paper(whiteTexture(), FIX_HEX.stock, o),
      stack: paper(whiteTexture(), FIX_HEX.shade, o),
      sheet: paper(whiteTexture(), FIX_HEX.light, o),
      chute: paper(whiteTexture(), FIX_HEX.stock, o),
    };
    out.span.side = DoubleSide;
    out.tape.side = DoubleSide;
    for (const [key, t] of Object.entries(kindTex)) {
      // the request's copy a shade darker than the tape it rides, so its beetle cut-out shows the tape through it
      out[`k${key}`] = paper(t, key.startsWith('request') ? FIX_HEX.request : FIX_HEX.item, o);
      out[`k${key}`].side = DoubleSide;
    }
    A_ITEMS.forEach((it, i) => {
      out[`i${i}`] = paper(kindTex[`${it.kind}${it.v % 4}`], FIX_HEX.item, o);
      out[`i${i}`].side = DoubleSide;
    });
    return out;
  }, [tex, kindTex, mode]);
  // the turn's queue (A_ITEMS by index) turns to paper as it leaves the desk
  useLayoutEffect(() => {
    A.items.forEach((it, i) => {
      if (it && it.kind === undefined && mats[`i${i}`]) mats[`i${i}`].color.copy(lerpHex(FIX_HEX.item, HEX.paper, it.paper));
    });
  }, [A.items, mats]);
  // the tape along its path: beat 3's stretch (A.tape), or the turn's from the folder back; u by material place (the print travels with it)
  const t0 = A.tape?.d0 ?? 0;
  const t1 = A.tape?.d1 ?? A.deskLen;
  const tu = A.tape?.u0 ?? A.span.len + A.wound;
  const desk = useGeo(() => {
    if (t1 - t0 <= 0.5) return null;
    const n = Math.max(2, Math.ceil((t1 - t0) / 6));
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const d = t0 + ((t1 - t0) * i) / n;
      const { p, dir, z } = aPathAt(d);
      return { p: [p[0], p[1], z - 0.1] as P3, w: [dir[1], -dir[0], 0] as P3, u: (tu + d - t0) / A_TEX_LEN };
    });
    return stripGeometry(pts, A_TAPE_W / 2);
  }, [t0, t1, tu]);
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
  // the chutes as far as they have slid out (quantised: each is rebuilt only while it moves)
  const chuteKey = (A.chutes ?? A_CHUTES.map(() => 1)).map((e) => Math.round(e * 48) / 48).join(',');
  const chutes = useGeo(() => {
    const ks = chuteKey.split(',').map(Number);
    const list = A_CHUTES.flatMap((c, k) => (ks[k] > 0.02 ? [chuteGeometry(c, ks[k])] : []));
    return list.length ? merge(list) : null;
  }, [chuteKey]);
  const dy = A.folderDy ?? 0;
  // the pile on the folder: beat 3's (pieces on their way up from the mouth too), or the whole pile at rest (the turn)
  const pile: AItemPose[] = A.pile ?? A_PILE.map((P) => ({ p: [F.c[0] + P.o[0], F.c[1] + P.o[1], P.z] as P3, x: [Math.cos(P.rot), Math.sin(P.rot), 0] as P3, y: [-Math.sin(P.rot), Math.cos(P.rot), 0] as P3, paper: 0, kind: P.kind, v: P.v }));
  const local = (it: AItemPose): AItemPose => ({ ...it, p: [it.p[0] - F.c[0], it.p[1] - (F.c[1] - dy), it.p[2]] });
  const matOf = (it: AItemPose, i: number): MeshStandardMaterial => (it.kind !== undefined ? mats[`k${it.kind}${(it.v ?? 0) % 4}`] : mats[`i${i}`]);
  return (
    <group>
      {desk && <mesh geometry={desk} material={mats.tape} />}
      {span && <mesh geometry={span} material={mats.span} />}
      {chutes && <mesh geometry={chutes} material={mats.chute} />}
      {pressA.k < 1 && (
        <group position={[F.c[0], F.c[1] - dy, 0]} rotation={[0, 0, F.rot]}>
          <Pressed p={pressA}>
            <mesh geometry={folder.cover} material={mats.cover} />
            <mesh geometry={folder.tab} material={mats.cover} />
            <mesh geometry={folder.stack} material={mats.stack} />
            <mesh geometry={folder.sheet} material={mats.sheet} />
            <mesh geometry={folder.clip} material={m.graphiteDark} />
            {pile.map((it, k) => (
              <ItemMesh key={k} it={local(it)} geometry={geo[it.kind ?? 'chat']} material={matOf(it, -1)} />
            ))}
          </Pressed>
        </group>
      )}
      {A.items.map((it, i) => (it ? <ItemMesh key={i} it={it} geometry={geo[it.kind ?? A_ITEMS[i]?.kind ?? 'chat']} material={matOf(it, i)} /> : null))}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// Fix B: the trays (pressed flat, or walled up into the bays), what lies in each, the replies, the follow-up and its torn stub

/** A tray at rest (tray-local): its torn-edged floor, its low walls (the north wall with its door gap), and the turn's single event card. */
export function trayGeometry(w: number, d: number, doorAt: number, seed = 0) {
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -d / 2;
  const y1 = d / 2;
  const T = TRAY_Z.wallT;
  const door = 26;
  const walls = merge([
    slab({ x0, x1, y0, y1: y0 + T + 1 }, 0, TRAY_Z.rim, 1.5, 0.6),
    slab({ x0, x1: x0 + T, y0, y1 }, 0, TRAY_Z.rim, 1.5, 0.6),
    slab({ x0: x1 - T, x1, y0, y1 }, 0, TRAY_Z.rim, 1.5, 0.6),
    slab({ x0, x1: doorAt - door / 2, y0: y1 - T, y1 }, 0, TRAY_Z.rim, 1.5, 0.6),
    slab({ x0: doorAt + door / 2, x1, y0: y1 - T, y1 }, 0, TRAY_Z.rim, 1.5, 0.6),
  ]);
  const floor = extrude(tornShape(w - 2, d - 2, 11 + seed, 'nesw', 1.2, 5), 0, TRAY_Z.floor, 0.3);
  const card = slab({ x0: -TRAY_CARD.w / 2, x1: TRAY_CARD.w / 2, y0: -TRAY_CARD.d / 2, y1: TRAY_CARD.d / 2 }, 0, 0.7, 1.5, 0.2);
  return { walls, floor, card };
}

/** A reply's print: a speech bubble at its west end (a reply, as the chute's slips), never a number. */
export function useReplyTexture(): Texture {
  const t = useMemo(
    () =>
      texture(
        B_SLIP.l,
        B_SLIP.w,
        (c) => {
          tooth(c, B_SLIP.l, B_SLIP.w);
          bubbleMark(c, 4, B_SLIP.w * 0.2, B_SLIP.w * 0.52, FIX_HEX.ink);
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

/** The bay at rest for an id (objects/Bay.tsx), closed and idle (desk/beat4.ts: nothing dispatched yet), as act two draws it. */
function ClosedBay({ id, f }: { id: BayId; f: number }) {
  const s = useMemo(() => turnDeskState(f), [f]);
  return id === 'tests' ? <TestsBay s={s} /> : id === 'docs' ? <DocsBay s={s} /> : <BugBay s={s} noRequest />;
}

/**
 * One of the three trays that wall up into a bay: its walls grow to the bay's (and its door plate with them), its
 * nameplate prints, its floor drops and slides away under the slate over the open hatch, whose leaves then shut over
 * the pit. Closed, it is the bay's own shell (act two's: objects/Bay.tsx), idle until it is dispatched (desk/beat4.ts).
 */
function BayTray({ k, b, f, slip, slipMat, mats, card }: { k: number; b: BayTurn; f: number; slip: { rot: number } | null; slipMat: MeshStandardMaterial; mats: { wall: MeshStandardMaterial; floor: MeshStandardMaterial; band: MeshStandardMaterial; card: MeshStandardMaterial }; card: BufferGeometry }) {
  const m = useDeskMats();
  const L = BAYS[b.id];
  const s = bayShapeAt(k, L, b.grow);
  const wallH = TRAY_Z.rim + (s.wallH - TRAY_Z.rim) * b.grow;
  const walls = useGeo(() => merge(shapeWalls(s).map((w) => slab(w, 0, wallH, 3 * b.grow + 1.5 * (1 - b.grow), 3 * b.grow + 0.1 * (1 - b.grow)))), [s.box.x0, s.box.x1, s.box.y0, s.box.y1, s.wall, s.southWall, s.door[0], s.door[1], wallH]);
  // the door plate grows in its gap with the walls (as the bay's at rest: Bay.tsx BayBase)
  const door = useGeo(() => merge([slab(bayDoor(L), BAY_FLOOR, L.wallH - 6, 2, 1.5)]), [L]);
  const doorBar = useGeo(() => merge([slab({ x0: L.door[0] + 10, x1: L.door[1] - 10, y0: L.box.y1 - L.wall / 2 - 2, y1: L.box.y1 - L.wall / 2 + 2 }, L.wallH - 6, L.wallH - 2, 1, 0.6)]), [L]);
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
  if (b.done) return <ClosedBay id={b.id} f={f} />;
  // built: the walls are the kit's graphite (as the bay's at rest), so the hand-over to the closed bay never jumps
  const wallMat = b.built >= 0.999 ? m.graphite : mats.wall;
  return (
    <group>
      <mesh geometry={walls} material={wallMat} />
      {b.grow > 0.02 && (
        <group scale={[1, 1, b.grow]}>
          <mesh geometry={door} material={m.enamelShade} />
          <mesh geometry={doorBar} material={m.steel} />
        </group>
      )}
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
      {b.hole && <Hatch box={L.box} open={b.leaves} depth={WORK_DEPTH[b.id]} />}
    </group>
  );
}

/** The event families' prints: a chat slip's bubble, a punched card's holes, an envelope's flap, a calendar leaf's grid; `band`: the stripe printed across tray 2's card and its stub, which the follow-up carries too. */
function eventTexture(kind: EventKind | 'stub' | 'followUp', w: number, d: number, band: boolean): Texture {
  return texture(
    w,
    d,
    (g) => {
      tooth(g, w, d);
      const ink = FIX_HEX.ink;
      g.fillStyle = ink;
      if (kind === 'chat') bubbleMark(g, 4, d * 0.18, d * 0.6, ink);
      else if (kind === 'ci' || kind === 'followUp') {
        for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) if ((i + r * 2) % 3 !== 1) g.fillRect(6 + i * 5, 5 + r * 8, 2.4, 5);
      } else if (kind === 'mail') {
        g.strokeStyle = ink;
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(2, 2);
        g.lineTo(w / 2, d * 0.55);
        g.lineTo(w - 2, 2);
        g.stroke();
      } else if (kind === 'leaf') {
        g.fillRect(0, 0, w, 5);
        for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) g.fillRect(4 + i * 7, 9 + r * 6, 4, 3.4);
      }
      if (band) {
        g.fillStyle = FIX_HEX.band;
        g.beginPath();
        const x = kind === 'stub' ? 0 : w - 14;
        g.moveTo(x, d);
        g.lineTo(x + 8, d);
        g.lineTo(x + 8 + d * 0.5, 0);
        g.lineTo(x + d * 0.5, 0);
        g.closePath();
        g.fill();
      }
    },
    4,
  );
}

export function SlipMesh({ p, rot, tilt, material }: { p: P3; rot: number; tilt: number; material: Material }) {
  const g = useGeo(() => piece('chat', B_SLIP.l, B_SLIP.w), []);
  return <mesh geometry={g} material={material} position={p} rotation={[tilt, 0, rot]} />;
}

function useStuffGeometry() {
  const g = useMemo(() => {
    const event = Object.fromEntries(
      (['chat', 'ci', 'mail', 'leaf'] as const).map((kind) => [kind, kind === 'chat' ? piece('chat', ...EVENT_SIZE.chat) : kind === 'ci' ? piece('ci', ...EVENT_SIZE.ci) : fitUv(extrude(tornShape(...EVENT_SIZE[kind], kind === 'leaf' ? 7 : 9, kind === 'leaf' ? 'n' : '', 1, 4), 0, 0.8, 0.25), ...EVENT_SIZE[kind])]),
    ) as Record<EventKind, BufferGeometry>;
    const stub = fitUv(extrude(tornShape(STUB.w, STUB.d, 21, 'w', 1.6, 3), 0, 0.8, 0.2), STUB.w, STUB.d);
    const followUp = fitUv(extrude(tornShape(FOLLOW_UP.w, FOLLOW_UP.d, 21, 'e', 1.6, 3), 0, 0.8, 0.2), FOLLOW_UP.w, FOLLOW_UP.d);
    const dossier = TRAY_STUFF.map((S) => {
      const { w, d, sheets } = S.dossier;
      const h = 0.4 + 0.8 * sheets;
      return { stack: slab({ x0: -w / 2, x1: w / 2, y0: -d / 2, y1: d / 2 }, 0, h - 0.3, 1.5, 0.3), top: fitUv(extrude(tornShape(w - 1, d - 1, sheets, 's', 1, 4), h - 0.3, h, 0.15), w, d) };
    });
    return { event, stub, followUp, dossier };
  }, []);
  useLayoutEffect(
    () => () => {
      Object.values(g.event).forEach((x) => x.dispose());
      g.stub.dispose();
      g.followUp.dispose();
      g.dossier.forEach((x) => {
        x.stack.dispose();
        x.top.dispose();
      });
    },
    [g],
  );
  return g;
}

/** What lies in tray k (tray-local): its event, its dossier, and on tray 2's card the stub that tears off. */
function TrayStuffMesh({ k, g, mats, tear }: { k: number; g: ReturnType<typeof useStuffGeometry>; mats: Record<string, MeshStandardMaterial>; tear: number }) {
  const S = TRAY_STUFF[k];
  const z = TRAY_Z.floor;
  const ev = S.event;
  const [ew] = EVENT_SIZE[ev.kind];
  const stubAt: P2 = [ew / 2 + STUB.gap + STUB.w / 2 + TEAR.slide[0] * tear, TEAR.slide[1] * tear];
  return (
    <>
      <group position={[ev.o[0], ev.o[1], z]} rotation={[0, 0, ev.rot]}>
        <mesh geometry={g.event[ev.kind]} material={mats[k === BREAK.from ? 'evBand' : `ev${ev.kind}`]} />
        {k === BREAK.from && <mesh geometry={g.stub} material={mats.stub} position={[stubAt[0], stubAt[1], 0.05 * tear]} rotation={[0, 0, TEAR.rot * tear]} />}
      </group>
      <group position={[S.dossier.o[0], S.dossier.o[1], z]} rotation={[0, 0, S.dossier.rot]}>
        <mesh geometry={g.dossier[k].stack} material={mats.dossierSide} />
        <mesh geometry={g.dossier[k].top} material={mats.dossierTop} />
      </group>
    </>
  );
}

/**
 * Fix B in grey stock (beat 3's eight trays; at the turn three of them grow walls into bays), posed by beat3.ts fixBAt in
 * beat 3 and turn.ts fixBTurnAt from f1400. Each tray holds its own event and dossier; the follow-up (beat3.ts
 * followUpAt) lies in tray 6, and tray 2's stub tears off on the break (tearAt), both pure functions of f unless given.
 */
export function FixB({ fixB, f, tear, followUp }: { fixB: TurnState['fixB']; f: number; tear?: number; followUp?: { p: P3; rot: number; tilt: number } | null }) {
  const sets = useDeskSets();
  const mode = useStepMode();
  const B = fixB;
  const tk = tear ?? tearAt(f);
  const fu = followUp === undefined ? followUpAt(f) : followUp;
  const gs = useMemo(() => TRAYS.map((tr, k) => trayGeometry(tr.w, tr.d, tr.door, k)), []);
  const stuff = useStuffGeometry();
  const slipTex = useReplyTexture();
  const evTex = useMemo(
    () => ({
      chat: eventTexture('chat', ...EVENT_SIZE.chat, false),
      ci: eventTexture('ci', ...EVENT_SIZE.ci, false),
      mail: eventTexture('mail', ...EVENT_SIZE.mail, false),
      leaf: eventTexture('leaf', ...EVENT_SIZE.leaf, false),
      band: eventTexture('ci', ...EVENT_SIZE.ci, true),
      stub: eventTexture('stub', STUB.w, STUB.d, true),
      followUp: eventTexture('followUp', FOLLOW_UP.w, FOLLOW_UP.d, true),
    }),
    [],
  );
  useLayoutEffect(
    () => () => {
      gs.forEach((g) => Object.values(g).forEach((x) => x.dispose()));
      Object.values(evTex).forEach((x) => x.dispose());
    },
    [gs, evTex],
  );
  const mats = useMats(() => {
    const o = { stepped: mode };
    const white = whiteTexture();
    const out: Record<string, MeshStandardMaterial> = {
      tray: paper(white, FIX_HEX.stock, o),
      floor: paper(white, FIX_HEX.shade, o),
      card: paper(white, FIX_HEX.item, o),
      evchat: paper(evTex.chat, FIX_HEX.item, o),
      evci: paper(evTex.ci, FIX_HEX.item, o),
      evmail: paper(evTex.mail, FIX_HEX.item, o),
      evleaf: paper(evTex.leaf, FIX_HEX.item, o),
      evBand: paper(evTex.band, FIX_HEX.item, o),
      stub: paper(evTex.stub, FIX_HEX.item, o),
      followUp: paper(evTex.followUp, FIX_HEX.item, o),
      dossierSide: paper(white, FIX_HEX.shade, o),
      dossierTop: paper(white, FIX_HEX.light, o),
    };
    TRAYS.forEach((_, k) => (out[`s${k}`] = paper(slipTex, FIX_HEX.reply, o)));
    BAY_TRAYS.forEach(({ k }) => {
      out[`w${k}`] = graphite(FIX_HEX.stock, { metalness: 0, roughness: 0.7, stepped: mode });
      out[`b${k}`] = paper(white, FIX_HEX.stock, o);
    });
    return out;
  }, [slipTex, evTex, mode]);
  useLayoutEffect(() => {
    // a walled-up tray turns from grey stock to the bay's graphite, its band to enamel (contrast, never alpha)
    BAY_TRAYS.forEach(({ k }, i) => {
      const b = B.bays[i].built;
      const w = mats[`w${k}`];
      w.color.copy(lerpHex(FIX_HEX.stock, BAY_WALL_HEX, b));
      w.metalness = 0.55 * b;
      w.roughness = 0.7 + (0.42 - 0.7) * b;
      mats[`b${k}`].color.copy(lerpHex(FIX_HEX.stock, HEX.enamel, b));
    });
    // no Worker computes yet: every work slot is dark (they light when a task is dispatched, 4.3 on)
    for (const set of [sets.full, sets.stepped]) for (const s of [set.slotBug, set.slotTests, set.slotDocs]) s.color.set(SLOT_IDLE);
  });
  const landed = (k: number) => f >= replyLands(k);
  const trayBody = (k: number) => (
    <>
      <mesh geometry={gs[k].floor} material={mats.floor} />
      <mesh geometry={gs[k].walls} material={mats.tray} />
      <TrayStuffMesh k={k} g={stuff} mats={mats} tear={tk} />
      {landed(k) && <SlipMesh p={TRAY_REST} rot={B.slips[k].rot} tilt={0} material={mats[`s${k}`]} />}
    </>
  );
  return (
    <group>
      {TRAYS.map((tr, k) => {
        const p = B.press[k];
        if (!p || p.k >= 1) return null;
        return (
          <group key={k} position={[tr.c[0], tr.c[1], 0]}>
            <Pressed p={p}>{trayBody(k)}</Pressed>
          </group>
        );
      })}
      {BAY_TRAYS.map(({ k }, i) => {
        const b = B.bays[i];
        if (b.grow <= 0 && b.drop <= 0) {
          const tr = TRAYS[k];
          return (
            <group key={k} position={[tr.c[0], tr.c[1], 0]}>
              {trayBody(k)}
            </group>
          );
        }
        return <BayTray key={k} k={k} b={b} f={f} slip={landed(k) ? { rot: B.slips[k].rot } : null} slipMat={mats[`s${k}`]} mats={{ wall: mats[`w${k}`], floor: mats.floor, band: mats[`b${k}`], card: mats.card }} card={gs[k].card} />;
      })}
      {fu && <mesh geometry={stuff.followUp} material={mats.followUp} position={fu.p} rotation={[fu.tilt, 0, fu.rot]} />}
      {/* the replies in their trays, in flight and in your in-tray (until the turn brings them home) */}
      {B.slips.map((s, k) => (landed(k) ? null : <SlipMesh key={k} p={s.p} rot={s.rot} tilt={s.tilt} material={mats[`s${k}`]} />))}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// After the turn (act two, desk/beat4.ts): the riders wound into the reel; the old heap and the request rising out of it

/** The coil at rest on the reel, as the turn locks it: the rim its clip and tabs ride. */
const LOCKED: CoilState = { c: [REEL.x, REEL.y], h: REEL.packZ[0], rIn: REEL.hubR, rOut: REEL.packR, t: REEL.packZ[1] - REEL.packZ[0], spin: 0, hub: 1, spokes: 1, stock: 1 };

/**
 * The notes loop's clip and tabs riding the Register's reel as the coil left them at the lock, turned with the reel
 * (`angle`, as the coil's spin), until the request's detent winds them in (`sink`, 0..1): drawn in over the pack's top
 * to the hub, under whose cap they go (inside its radius, below its top), then down under the pack's top, so they are
 * already hidden by the hub when they leave (desk/beat4.ts ridersAt).
 */
export function ReelRiders({ angle, sink }: { angle: number; sink: number }) {
  const tabMat = useMemo(() => paper(whiteTexture(), TAPE_HEX.tab), []);
  useLayoutEffect(() => () => tabMat.dispose(), [tabMat]);
  const top = REEL.packZ[1];
  // drawn in over the pack's top to the hub first (at 15% of their radius they are inside the hub's, under its cap), then
  // down under the pack's top
  const inward = Math.min(1, sink / 0.7);
  const down = Math.max(0, (sink - 0.75) / 0.25);
  const k = 1 - 0.85 * inward * inward * (3 - 2 * inward);
  return (
    <group position={[REEL.x, REEL.y, top - 14 * down]} scale={[k, k, 1 - 0.7 * down]}>
      <group position={[-REEL.x, -REEL.y, -top]}>
        <Riders L={coilRim({ ...LOCKED, spin: angle })} edge={1} fold={1} spin={angle} tabMat={tabMat} />
      </group>
    </group>
  );
}

/** The heap's stock (as objects/ActOne.tsx Heap draws it): two tones a kind, variants per kind. */
const HEAP_HEX: Readonly<Record<PieceKind, readonly [string, string]>> = { chat: ['#8E897F', '#9C968A'], ci: ['#8B877E', '#98938A'], mail: ['#948F85', '#A29D92'], leaf: ['#918C82', '#9F9A8F'] };
const HEAP_VARIANTS: Readonly<Record<PieceKind, number>> = { chat: 6, ci: 6, mail: 2, leaf: 2 };

/** A heap piece's geometry per kind (as objects/ActOne.tsx heapGeometry). */
function heapPieces(): Record<PieceKind, BufferGeometry> & { mailFlap: BufferGeometry } {
  const [mw, md] = PIECE.mail;
  const flapS = new Shape();
  flapS.moveTo(-mw / 2 + 2, md / 2 - 2);
  flapS.lineTo(mw / 2 - 2, md / 2 - 2);
  flapS.lineTo(0, -md * 0.08);
  flapS.closePath();
  const [lw, ld] = PIECE.leaf;
  const leafS = new Shape();
  leafS.moveTo(-lw / 2, -ld / 2);
  leafS.lineTo(lw / 2, -ld / 2);
  leafS.lineTo(lw / 2, ld / 2 - 4);
  for (let i = 1; i <= 8; i++) leafS.lineTo(lw / 2 - (lw * i) / 8, ld / 2 - (i % 2 ? 0 : 4));
  leafS.closePath();
  return {
    chat: piece('chat', ...PIECE.chat),
    ci: piece('ci', ...PIECE.ci),
    mail: fitUv(slab({ x0: -mw / 2, x1: mw / 2, y0: -md / 2, y1: md / 2 }, 0, 0.7, 1.5, 0.2), mw, md),
    mailFlap: extrude(flapS, 0.7, 1.2, 0.15),
    leaf: fitUv(extrude(leafS, 0, 0.7, 0.15), lw, ld),
  };
}

/** How far the pressed heap steps down as history (the film's step-down, a little past the focus's: it recedes for good). */
const HEAP_HISTORY = 1.7;

/**
 * The old heap after the turn, and the request rising out of it (desk/beat4.ts, STORYBOARD 4.2). The heap is act one's
 * (objects/ActOne.tsx Heap draws it until the request starts to gather, beat4.ts REQUEST_FROM; this draws the same
 * pieces, the same print, from there). The request gathers (its crease flattening to a slight curl), slides out from
 * under the pieces on it, which settle onto what lay under it, is posted over the gate onto the belt, rides up it and
 * hops into the throat, and is pulled under the print head, which hides it; the transit light shows through its beetle
 * while it moves (its own light, shaped by the cut-out). Once it is in, the heap presses flat into the slate and steps
 * down: it stays as pressed history, as the folders do.
 */
export function Backlog({ a, heap, request, f, stepRequest = false }: { a: ActOneState; heap: HeapState; request: RequestState; f: number; stepRequest?: boolean }) {
  const sets = useDeskSets();
  const font = useFont(PRINT_FONT);
  const tex = useMemo(() => {
    const L = a.loop;
    const len = loopArc(L).len;
    // act one's print, at act one's anisotropy (4), so the hand-over from its heap changes nothing
    return makeActOnePrint(font.family, 4, Math.ceil(len), loopNotes(len), loopNoteFlips(L, loopNotes(len)));
  }, [font.family, a.loop]);
  useLayoutEffect(() => () => [...tex.top, ...tex.card, tex.tape, ...tex.chat, ...tex.ci, ...tex.mail, ...tex.leaf].forEach((x) => x.dispose()), [tex]);
  const geo = useMemo(() => heapPieces(), []);
  useLayoutEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const mats = useMemo(() => {
    const out: Record<string, { mat: MeshStandardMaterial; hex: string }> = {};
    for (const kind of ['chat', 'ci', 'mail', 'leaf'] as const)
      tex[kind].forEach((t, v) => {
        for (const tone of [0, 1]) out[`${kind}${v}${tone}`] = { mat: paper(t, HEAP_HEX[kind][tone]), hex: HEAP_HEX[kind][tone] };
      });
    out.flap0 = { mat: paper(whiteTexture(), '#86817A'), hex: '#86817A' };
    out.flap1 = { mat: paper(whiteTexture(), '#938E85'), hex: '#938E85' };
    return out;
  }, [tex]);
  useLayoutEffect(() => () => Object.values(mats).forEach((x) => x.mat.dispose()), [mats]);
  // pressed, the heap steps down as history (by contrast and chroma, never alpha), on its own ramp only: its stock is in the
  // full set, so a focus step-down (which lifts paper toward a mid paper grey) never brightens the pressed history again
  const k = HEAP_HISTORY * heap.step;
  useLayoutEffect(() => {
    for (const x of Object.values(mats)) x.mat.color.copy(stepColour(new Color(x.hex), k));
  }, [mats, k]);
  const lift = Math.round(a.request.lift * request.crease * 400) / 400;
  const req = useMemo(() => requestGeometry(lift), [lift]);
  useLayoutEffect(() => () => Object.values(req).forEach((g) => g.dispose()), [req]);
  const keyOf = (kind: PieceKind, v: number, tone: number) => `${kind}${v % HEAP_VARIANTS[kind]}${tone > 0.45 ? 1 : 0}`;
  const full = stepRequest ? sets.stepped : sets.full;
  // the request, wherever it is on its way (in the heap its pose is act one's: the same transform as act one draws it)
  const r = request.pose;
  const z0 = requestZ();
  const onReq = z0 + ON_REQUEST;
  return (
    <group>
      {HEAP.slice(0, a.landed).map((p, i) => {
        const q = heapPieceAt(p.z, Math.abs(p.z - onReq) < 1e-6, heap);
        return (
          <group key={i} position={[p.c[0], p.c[1], q.z]} rotation={[0, 0, p.rot]} scale={[1, 1, q.k]}>
            <mesh geometry={geo[p.kind]} material={mats[keyOf(p.kind, p.v, p.tone)].mat} />
            {p.kind === 'mail' && <mesh geometry={geo.mailFlap} material={mats[`flap${p.tone > 0.45 ? 1 : 0}`].mat} />}
          </group>
        );
      })}
      {r && f < RIDE.out && (
        <group position={r.p} rotation={[0, -r.slope, r.heading, 'ZYX']} scale={[1 + 0.015 * r.squash, 1, 1 - 0.03 * r.squash]}>
          <group rotation={[0, 0, -REQUEST_A.rot]}>
            <group position={[-REQUEST_A.c[0], -REQUEST_A.c[1], -z0]}>
              <mesh geometry={req.body} material={full.vermilionPaper} />
              <mesh geometry={req.flap} material={full.vermilionPaper} />
              <mesh geometry={req.crease} material={full.vermilionShade} />
            </group>
          </group>
          {r.transit > 0 && <BeetleLight x={-REQUEST_A.l / 2 + 19} y={1} dir={-1} z={-0.3} transit={r.transit} />}
        </group>
      )}
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
      <FixA fixA={t.fixA} pressA={t.pressA} />
      <FixB fixB={t.fixB} f={t.f} />
      {t.f >= TURN.deckIn && <Legs t={t} />}
      {t.tape.leader < 1 && <Leader k={t.tape.leader} />}
      {t.slip && <FirstSlip s={t.slip} />}
    </>
  );
}
