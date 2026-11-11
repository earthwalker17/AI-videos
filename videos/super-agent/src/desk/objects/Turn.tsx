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
import { A_CHUTES, A_FOLDER_TOP, A_ITEMS, A_PILE, A_PITCH, A_SIZE, A_STACK_END, A_TAPE_W, BAY_TRAYS, BREAK, B_SLIP, EVENT_SIZE, FIX_A_FOLDER, FOLLOW_UP, TEAR, TRAYS, TRAY_CARD, TRAY_STUFF, TRAY_Z, aPathAt, followUpAt, replyToneB, tearAt, type AItemKind, type AItemPose, type EventKind, type FixAView, type TrayPost } from '../beat3.ts';
import { ON_REQUEST, RIDE, WORK_DEPTH, heapFloor, heapPieceAt, type HeapState, type RequestState } from '../beat4.ts';
import { cylinderZ, disc, extrude, merge, plane, planeOn, slab, tornShape, tube } from '../geom.ts';
import { DESK_HEX } from '../gl/desk.ts';
import { HEX, enamel, graphite, paper, stepColour, whiteTexture } from '../gl/materials.ts';
import { PRINT_FONT, cargoMark, texture, tooth } from '../gl/text.ts';
import { useDeskMats, useDeskSets, useStepMode } from '../kit.tsx';
import { BAYS, BAY_FLOOR, LEG_R, NEXT_SLIP, REEL, TAPE, TAPE_FLAT_X1, type BayId, type P2, type P3, type Rect } from '../layout.ts';
import { CLIP_T, COIL_R0, OLDER_REPLY_REST, TURN, bayShapeAt, coilRim, legsAt, replyLands, shapeWalls, turnDeskState, type BayShape, type BayTurn, type CoilState, type Press, type TurnState, type olderReplyAt } from '../turn.ts';
import { BeetleLight, BugBay, DocsBay, SLOT_IDLE, TestsBay } from './Bay.tsx';
import { Hatch, shellInside } from './Dispatch.tsx';
import { bubbleMark } from './Intake.tsx';
import { TAPE_HEX, clipGeometry, fitUv, loopArc, loopNoteFlips, loopNotes, loopNotesAt, makeActOnePrint, piece, requestGeometry, slipShape } from './ActOne.tsx';

/** The slate's own tone (linear): what a pressed folder's stock glows to as its own light goes out (desk/turn.ts foldPressAt). */
const SLATE = new Color(DESK_HEX.base);

/** Fix A's clip: the kit's dark graphite (kit.tsx graphiteDark), on its own material so the turn can take it to the slate's tone with the folder. */
const CLIP_HEX = '#4A4E4C';

/** Grey stock: the road not taken (STORYBOARD's palette). */
export const GREY = '#77756F';
export const GREY_LIGHT = '#8A8781';
/** Fix B's replies: a paler grey stock, so the jostling pile reads slip by slip on the in-tray. */
export const GREY_PALE = '#9B9891';
/** A bay's wall at rest (the kit's graphite), and its closed lid's graphite (objects/Dispatch.tsx LidHatch's). */
const BAY_WALL_HEX = '#626764';
const LID_HEX = '#5A5E5C';

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

/** A pressed body: squashed flat on the desk and sunk, drawing in from its outline (w × d) by the press's inset (the press's one transform). */
function Pressed({ p, w, d, children }: { p?: Press | null; w: number; d: number; children: ReactNode }) {
  if (!p || p.k <= 0) return <>{children}</>;
  const inset = p.inset ?? 0;
  return (
    <group position={[0, 0, -p.sink]} rotation={[-p.tilt, 0, 0]} scale={[1 - (2 * inset) / w, 1 - (2 * inset) / d, p.scaleZ]}>
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
  // as act one prints it (objects/ActOne.tsx ActOneObjects: each note at its own tab, every note written by f1399)
  const print = useMemo(() => {
    const notes = loopNotesAt(LOOP_A);
    return makeActOnePrint(printFamily, 4, Math.ceil(len), notes, loopNoteFlips(LOOP_A, notes), FOLDERS.map(() => 1));
  }, [printFamily, len]);
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
/** Part of a wall: radius r, from z 0 to t, over the angles a0 … a1 (counter-clockwise from east), its faces outward. */
function arcWall(r: number, t: number, a0: number, a1: number): BufferGeometry {
  const n = Math.max(2, Math.ceil((72 * (a1 - a0)) / (2 * Math.PI)));
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    pos.push(r * cs, r * sn, 0, r * cs, r * sn, t);
    nrm.push(cs, sn, 0, cs, sn, 0);
    uv.push(i / n, 0, i / n, 1);
    if (i > 0) {
      const k = 2 * (i - 1);
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
/** The loop's ribbon at the coil's take-over (round, on edge, its print as the ribbon carried it), centred on the origin: the coil's outer turn until Fix A's tape has wound over it. */
const loopTurnPose = (t: number): LoopPose => ({ ...LOOP_A, c: [0, 0], a: COIL_R0, b: COIL_R0, n: 2, z: 0, w: t });
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
  const top = useGeo(() => (c.rim - c.rIn > 0.05 ? coilTop(c.rIn, c.rim) : null), [c.rIn, c.rim]);
  // the outside: the loop's own printed turn (the ribbon's geometry and print, carried round by the spin), wound over by
  // Fix A's tape from where it meets the coil (c.wrap); once it is wholly under it, the wound pack all round
  const full = c.wrap >= 2 * Math.PI - 1e-6;
  const loopTurn = useGeo(() => (full ? null : ribbonGeometry(loopTurnPose(c.t), 1)), [full, c.t]);
  // (the partial wrap stands at the outer turn's radius, a tape's thickness proud of the loop's printed turn under it)
  const outer = useGeo(() => (c.wrap <= 1e-6 ? null : full ? wall(c.rOut, c.t) : arcWall(Math.max(c.rim, COIL_R0 + 0.6), c.t, c.wrapLead - c.wrap, c.wrapLead)), [c.rOut, c.rim, c.t, c.wrap, c.wrapLead, full]);
  // (not while it would lie on the loop's printed turn: the take-over's first frame)
  const inner = useGeo(() => (c.rIn > REEL.hubR + 0.5 && c.rIn < COIL_R0 - 0.3 ? wall(c.rIn, c.t) : null), [c.rIn, c.t]);
  // the spokes telescope out from the hub over the pack (as long as the Register's at rest)
  const spokeLen = REEL.hubR + 2 + (Math.max(c.rOut - 6, REEL.hubR + 2) - REEL.hubR - 2) * c.spokes;
  const sp = useGeo(() => spokes(spokeLen), [spokeLen]);
  const hub = useMemo(() => ({ body: merge([cylinderZ(REEL.hubR, 0, HUB_H - 3), disc(REEL.hubR + 2, HUB_H - 3, HUB_H, { bevel: 1.2 })]), slot: slab({ x0: -13, x1: 13, y0: -2.5, y1: 2.5 }, HUB_H, HUB_H + 1.2, 1, 0.4) }), []);
  useLayoutEffect(() => () => Object.values(hub).forEach((x) => x.dispose()), [hub]);
  // the wound pack takes the reel's paper once the loop's turn is under it; at rest it is the Register's own
  const settled = c.stock >= 0.999;
  useLayoutEffect(() => {
    mats.pack.color.copy(lerpHex(TAPE_HEX.tape, HEX.paperShade, c.stock));
  }, [mats, c.stock]);
  const packMat = settled ? m.paperShade : mats.pack;
  const rim = coilRim(c);
  return (
    <group>
      <group position={[c.c[0], c.c[1], c.h]}>
        {outer && full && <mesh geometry={outer} material={packMat} />}
        {inner && <mesh geometry={inner} material={mats.tape} />}
        <group rotation={[0, 0, c.spin]}>
          {loopTurn && <mesh geometry={loopTurn} material={mats.tape} />}
          {outer && !full && <mesh geometry={outer} material={packMat} />}
          {top && <mesh geometry={top} material={m.printed.reelTopBare} position={[0, 0, c.t + 0.25]} />}
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
export const FIX_HEX = { stock: '#A8A59D', shade: '#86837C', light: '#BFBBB2', tape: '#ADA9A1', item: '#C3BFB6', reply: '#B9B5AC', request: '#74716A', ink: '#3E3D3A', hole: '#232524', band: '#4C4F4D', rim: '#8C8982', floor: '#7A7770' } as const;

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
      // the stack from the cover up to the top sheet as Fix A arrives; it thickens with each swallow (scaled in z)
      stack: slab({ x0: r.x0 + 5, x1: r.x1 - 5, y0: r.y0 + 5, y1: r.y1 - 5 }, 0, A_FOLDER_TOP - 0.5 - 1.4, 2, 0.4),
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
      // its clip: the kit's dark graphite (as the enclosing set's), its own so the turn can take it to the slate's tone
      clip: graphite(CLIP_HEX, { roughness: 0.5, stepped: mode }),
    };
    out.span.side = DoubleSide;
    out.tape.side = DoubleSide;
    for (const [key, t] of Object.entries(kindTex)) {
      // the request's copy a shade darker than the tape it rides, so its beetle cut-out shows the tape through it
      out[`k${key}`] = paper(t, key.startsWith('request') ? FIX_HEX.request : FIX_HEX.item, o);
      out[`k${key}`].side = DoubleSide;
    }
    A_ITEMS.forEach((it, i) => {
      out[`i${i}`] = paper(kindTex[`${it.kind}${it.v % 4}`], it.kind === 'request' ? FIX_HEX.request : FIX_HEX.item, o);
      out[`i${i}`].side = DoubleSide;
    });
    return out;
  }, [tex, kindTex, mode]);
  // the request's copy carries the request's vermilion while Fix A holds the focus (beat3.ts aRequestInkAt; the turn's: grey)
  const ink = A.requestInk ?? 0;
  // pressed at the turn (desk/turn.ts foldPressAt): the folder's grey stock, its clip and its pile go to the slate's tone as
  // lit where it lies (pressA.tone) by amount, monotonic, so it is in the desk's own tone by the time it goes under
  const slate = pressA.slate ?? 0;
  const tone = pressA.tone;
  // the turn's queue (A_ITEMS by index) turns to paper as it leaves the desk
  const papers = A.items.map((it) => (it && it.kind === undefined ? it.paper : 0)).join(',');
  useLayoutEffect(() => {
    // every colour is written from this frame alone (a page that seeks backwards draws exactly what a forward one does)
    const target = tone ? new Color(tone[0], tone[1], tone[2]) : SLATE;
    // (its sheen goes with its own light: by metalness toward 1 on a colour going to black, nothing is reflected at the end,
    // so it is exactly the slate's tone; the clip starts from the kit graphite's metalness)
    const set = (x: MeshStandardMaterial, c: Color, toned: boolean, metal = 0) => {
      x.color.copy(c);
      if (toned && slate > 0) {
        x.color.multiplyScalar(1 - slate);
        x.emissive.copy(target).multiplyScalar(slate);
        x.metalness = metal + (1 - metal) * slate;
      } else {
        x.emissive.setRGB(0, 0, 0);
        x.metalness = metal;
      }
    };
    set(mats.tape, new Color(FIX_HEX.tape), false);
    set(mats.span, new Color(TAPE_HEX.tape), false);
    set(mats.chute, new Color(FIX_HEX.stock), false);
    set(mats.cover, new Color(FIX_HEX.stock), true);
    set(mats.stack, new Color(FIX_HEX.shade), true);
    set(mats.sheet, new Color(FIX_HEX.light), true);
    set(mats.clip, new Color(CLIP_HEX), true, 0.55);
    // the pile's pieces (in the turn the queue draws with its own i-mats, so the k-mats are the pile's)
    for (const key of Object.keys(mats)) if (key.startsWith('k')) set(mats[key], key.startsWith('krequest') ? lerpHex(FIX_HEX.request, HEX.vermilion, ink) : new Color(FIX_HEX.item), true);
    const p = papers.split(',').map(Number);
    A_ITEMS.forEach((it, i) => mats[`i${i}`] && set(mats[`i${i}`], lerpHex(it.kind === 'request' ? FIX_HEX.request : FIX_HEX.item, HEX.paper, p[i] ?? 0), false));
  }, [ink, slate, tone, papers, mats]);
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
  // the stack's top (it thickens as the pile grows; the turn's: every swallow done)
  const top = A.stackTop ?? A_STACK_END;
  const grow = top - A_FOLDER_TOP;
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
          <Pressed p={pressA} w={F.w} d={F.d}>
            <mesh geometry={folder.cover} material={mats.cover} />
            <mesh geometry={folder.tab} material={mats.cover} />
            <mesh geometry={folder.stack} material={mats.stack} position={[0, 0, 1.4]} scale={[1, 1, (top - 0.5 - 1.4) / (A_FOLDER_TOP - 0.5 - 1.4)]} />
            <group position={[0, 0, grow]}>
              <mesh geometry={folder.sheet} material={mats.sheet} />
              <mesh geometry={folder.clip} material={mats.clip} />
            </group>
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
// Fix B: the trays (posted back out, or walled up into the bays), what lies in each, the replies, the follow-up and its torn stub

/**
 * One grey-stock rim strip (tray-local): a card folded up into a low wall, its outer edge torn (`side`) and a row of punched
 * holes along it (perforated stock: grey stock is a fix, never built enamel), from (x0, y0) to (x1, y1).
 */
function rimStrip(x0: number, x1: number, y0: number, y1: number, side: 'n' | 'e' | 's' | 'w', seed: number): BufferGeometry {
  const w = x1 - x0;
  const d = y1 - y0;
  const s = tornShape(w, d, seed, side, 1.3, 4);
  const along = w >= d;
  const len = along ? w : d;
  const n = Math.floor((len - 8) / 7);
  for (let i = 0; i < n; i++) {
    const t = -len / 2 + 4 + 3.5 + i * 7;
    const h = new Path();
    h.absarc(along ? t : 0, along ? 0 : t, 1.05, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const g = extrude(s, 0, TRAY_Z.rim, 0.6, 1);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  return g;
}

/** A tray at rest (tray-local): its torn-edged floor, its low grey-stock walls (torn and perforated; the north wall with its door gap), and the turn's single event card. */
export function trayGeometry(w: number, d: number, doorAt: number, seed = 0) {
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -d / 2;
  const y1 = d / 2;
  const T = TRAY_Z.wallT;
  const door = 26;
  const walls = merge([
    rimStrip(x0, x1, y0, y0 + T + 1, 's', 31 + seed),
    rimStrip(x0, x0 + T, y0 + T + 1, y1 - T, 'w', 37 + seed),
    rimStrip(x1 - T, x1, y0 + T + 1, y1 - T, 'e', 41 + seed),
    rimStrip(x0, doorAt - door / 2, y1 - T, y1, 'n', 43 + seed),
    rimStrip(doorAt + door / 2, x1, y1 - T, y1, 'n', 47 + seed),
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

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({ x0: a.x0 + (b.x0 - a.x0) * t, x1: a.x1 + (b.x1 - a.x1) * t, y0: a.y0 + (b.y0 - a.y0) * t, y1: a.y1 + (b.y1 - a.y1) * t });

/** A hashed bite, 0..1 (as geom.ts tornShape's). */
const biteOf = (i: number, seed: number): number => ((Math.imul(i * 7919 + seed * 104729 + 17, 2654435761) >>> 0) % 1000) / 1000;
/**
 * A rectangle's outline, centred: its sides in `sides` torn inward by up to `amp` (n points a side, s e n w, kept as it
 * stretches), its corners rounded by `r`. A tray's grey-stock rim or floor at amp > 0 and r 0; a bay's bevelled wall or
 * lid at amp 0 (the outline geom.ts rectShape draws).
 */
function stripShape(w: number, d: number, seed: number, sides: string, amp: number, r: number, n: readonly number[]): Shape {
  const x = w / 2;
  const y = d / 2;
  const rr = Math.max(0, Math.min(r, x - 0.01, y - 0.01));
  const S: readonly [number, number, number, number, number, number, string][] = [
    [-x, -y, x, -y, 0, 1, 's'],
    [x, -y, x, y, -1, 0, 'e'],
    [x, y, -x, y, 0, -1, 'n'],
    [-x, y, -x, -y, 1, 0, 'w'],
  ];
  const s = new Shape();
  s.moveTo(-x + rr, -y);
  let k = 0;
  S.forEach(([ax, ay, bx, by, ix, iy, key], e) => {
    const len = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    if (sides.includes(key) && amp > 1e-3) {
      for (let i = 1; i < n[e]; i++) {
        const t = rr + ((len - 2 * rr) * i) / n[e];
        const m = amp * biteOf(k + i, seed);
        s.lineTo(ax + ux * t + ix * m, ay + uy * t + iy * m);
      }
    }
    k += n[e];
    s.lineTo(bx - ux * rr, by - uy * rr);
    if (rr > 0) {
      const [nax, nay, nbx, nby] = S[(e + 1) % 4];
      const nl = Math.hypot(nbx - nax, nby - nay);
      s.quadraticCurveTo(bx, by, bx + ((nbx - nax) / nl) * rr, by + ((nby - nay) / nl) * rr);
    }
  });
  s.closePath();
  return s;
}
/** The points a side of a rect is torn at (4 u apart), kept as the rect stretches. */
const tornCounts = (r: Rect): number[] => {
  const w = r.x1 - r.x0;
  const d = r.y1 - r.y0;
  return [w, d, w, d].map((l) => Math.max(2, Math.round(l / 4)));
};

/** The outer side of each of a bay shape's walls (footprints.ts bayWalls order: west, east, south, north either side of the door). */
const WALL_SIDES = ['w', 'e', 's', 'n', 'n'] as const;
/** A bay tray's walls and floor as built: the torn points and punched holes of each piece at the tray's own size (they stretch with it). */
function bayTrayPlan(k: number, id: BayId) {
  const s0 = bayShapeAt(k, BAYS[id], 0);
  const walls = shapeWalls(s0).map((r) => {
    const len = Math.max(r.x1 - r.x0, r.y1 - r.y0);
    return { n: tornCounts(r), holes: Math.max(0, Math.floor((len - 8) / 7)) };
  });
  return { walls, floor: tornCounts(inset(s0.box, 1)) };
}
/**
 * A bay tray's walls at a shape: each piece from its grey-stock rim (m 0: its outer side torn, a row of punched holes, a fine
 * bevel) straightening into the bay's bevelled wall (m 1: the slab objects/Bay.tsx BayBase builds), as tall as `h`.
 */
function bayWallsGeometry(k: number, s: BayShape, plan: ReturnType<typeof bayTrayPlan>, m: number, h: number): BufferGeometry {
  return merge(
    shapeWalls(s).map((r, i) => {
      if (m >= 0.999) return slab(r, 0, h, 3, 3);
      const w = r.x1 - r.x0;
      const d = r.y1 - r.y0;
      const sh = stripShape(w, d, 31 + 6 * k + i, WALL_SIDES[i], 1.3 * (1 - m), 3 * m, plan.walls[i].n);
      const hr = 1.05 * (1 - m);
      const holes = plan.walls[i].holes;
      if (hr > 0.08) {
        const along = w >= d;
        const len = along ? w : d;
        for (let j = 0; j < holes; j++) {
          const t = -len / 2 + (len * (j + 0.5)) / holes;
          const p = new Path();
          p.absarc(along ? t : 0, along ? 0 : t, hr, 0, Math.PI * 2, true);
          sh.holes.push(p);
        }
      }
      const g = extrude(sh, 0, h, 0.6 + 2.4 * m, 2);
      g.translate((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0);
      return g;
    }),
  );
}
/** A bay tray's floor over a rect: torn grey stock (m 0) straightening into a plate (m 1). */
function bayFloorGeometry(k: number, r: Rect, plan: ReturnType<typeof bayTrayPlan>, m: number): BufferGeometry {
  const g = extrude(stripShape(r.x1 - r.x0, r.y1 - r.y0, 11 + k, 'nesw', 1.2 * (1 - m), 0.8 * m, plan.floor), 0, TRAY_Z.floor, 0.3);
  g.translate((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0);
  return g;
}

/** The lid's seam and a leaf's hinge barrels (objects/Dispatch.tsx LidHatch's, so the morph ends on its very geometry). */
const LID_SEAM = 2.4;
const LID_TOP = 1.2;
function lidBarrels(inner: Rect): BufferGeometry {
  const barrel = (y: number) => {
    const c = cylinderZ(2.4, 0, 22, 0, 0, 12);
    c.rotateX(Math.PI / 2);
    c.translate(2.4, y + 22, -0.6);
    return c;
  };
  return merge([barrel(inner.y0 + 6), barrel(inner.y1 - 28)]);
}
/**
 * A bay tray's floor becoming the bay's lid (`lid` 0..1): it parts along its middle into two leaves (the seam opening to
 * LidHatch's), sinks to the lid's height, and its hinges' barrels slide out of the walls; its stock turns to the lid's
 * graphite (the material, by amount). At 1 it is objects/Dispatch.tsx LidHatch shut, which takes over.
 */
function MorphLid({ inner, lid, material }: { inner: Rect; lid: number; material: Material }) {
  const m = useDeskMats();
  const L = (inner.x1 - inner.x0) / 2 - (LID_SEAM / 2) * lid;
  const leaf = useGeo(() => slab({ x0: 0, x1: L, y0: inner.y0, y1: inner.y1 }, -2.6, 0, 0.8, 0.4), [L, inner.y0, inner.y1]);
  const barrels = useGeo(() => lidBarrels(inner), [inner.y0, inner.y1]);
  const top = LID_TOP + (TRAY_Z.floor - LID_TOP) * (1 - lid);
  const out = -4.8 * (1 - lid);
  return (
    <group>
      <group position={[inner.x0, 0, top]}>
        <mesh geometry={leaf} material={material} />
        <mesh geometry={barrels} material={m.steel} position={[out, 0, 0]} />
      </group>
      <group position={[inner.x1, 0, top]} scale={[-1, 1, 1]}>
        <mesh geometry={leaf} material={material} />
        <mesh geometry={barrels} material={m.steel} position={[out, 0, 0]} />
      </group>
    </group>
  );
}

/** The bay at rest for an id, closed and idle, as act two draws it (objects/World.tsx: the bay, its lid shut on the slate: Dispatch.tsx Hatches). */
function ClosedBay({ id, f }: { id: BayId; f: number }) {
  const s = useMemo(() => turnDeskState(f), [f]);
  return (
    <>
      {id === 'tests' ? <TestsBay s={s} /> : id === 'docs' ? <DocsBay s={s} /> : <BugBay s={s} noRequest />}
      <Hatch box={BAYS[id].box} open={0} depth={WORK_DEPTH[id]} look="lid" inner={shellInside(id)} />
    </>
  );
}

/**
 * One of the three trays that wall up into a bay (desk/turn.ts BayTurn), drawn in the world from beat 3 on (so its rest is
 * the same geometry it grows from): it slides to its bay's place (the test tower's), its grey-stock rim grows and
 * straightens into the bay's walls (stock turning to graphite), the door plate rises in its door gap and the blank
 * nameplate band widens on its south wall; its floor becomes the bay's graphite lid, which drops open like a trapdoor
 * (what lay in the tray falls into the pit under it) and swings shut. Closed, it is act two's bay (ClosedBay).
 */
function BayTray({ k, b, f, mats, contents, post }: { k: number; b: BayTurn; f: number; mats: { wall: MeshStandardMaterial; floor: MeshStandardMaterial; band: MeshStandardMaterial }; contents: ReactNode; post?: TrayPost }) {
  const m = useDeskMats();
  const L = BAYS[b.id];
  const plan = useMemo(() => bayTrayPlan(k, b.id), [k, b.id]);
  const s = bayShapeAt(k, L, b.grow, b.slide);
  const h = TRAY_Z.rim + (L.wallH - TRAY_Z.rim) * b.grow;
  const walls = useGeo(() => bayWallsGeometry(k, s, plan, b.morph, h), [k, plan, b.morph, h, s.box.x0, s.box.x1, s.box.y0, s.box.y1, s.wall, s.southWall, s.door[0], s.door[1]]);
  // the door plate and its bar rise in the door gap, the blank nameplate band widens along the south wall's top
  const g = b.grow;
  const door = useGeo(() => (g < 0.02 ? null : slab({ x0: s.door[0], x1: s.door[1], y0: s.box.y1 - s.wall + 2, y1: s.box.y1 - 2 }, BAY_FLOOR * g, (L.wallH - 6) * g, 2, 1.5 * g)), [g, s.door[0], s.door[1], s.box.y1, s.wall]);
  const doorBar = useGeo(() => (g < 0.02 ? null : slab({ x0: s.door[0] + 10 * g, x1: s.door[1] - 10 * g, y0: s.box.y1 - s.wall / 2 - 2, y1: s.box.y1 - s.wall / 2 + 2 }, (L.wallH - 6) * g, (L.wallH - 2) * g, 1, 0.6 * g)), [g, s.door[0], s.door[1], s.box.y1, s.wall]);
  const south = shapeWalls(s)[2];
  const band = useGeo(() => {
    if (g < 0.02) return null;
    const r = inset(south, 2);
    const cy = (r.y0 + r.y1) / 2;
    const half = ((r.y1 - r.y0) / 2) * g;
    return planeOn({ x0: r.x0, x1: r.x1, y0: cy - half, y1: cy + half }, h + 0.25);
  }, [g, south.x0, south.x1, south.y0, south.y1, h]);
  // the floor: the tray's, drawn under its walls as they grow (its edge never in sight), straightening to the lid's plate
  const inner = shellInside(b.id);
  const fr = lerpRect(inset(bayShapeAt(k, L, 0, b.slide).box, 1), inner, g);
  const floor = useGeo(() => (b.lid > 0 ? null : bayFloorGeometry(k, fr, plan, b.morph)), [k, plan, b.lid > 0, b.morph, fr.x0, fr.x1, fr.y0, fr.y1]);
  if (b.done) return <ClosedBay id={b.id} f={f} />;
  // what lay in the tray rides its floor (and the lid's leaves), then falls into the pit as they drop open
  const tc: P2 = [TRAYS[k].c[0] + b.slide, TRAYS[k].c[1]];
  const shift: P2 = [(fr.x0 + fr.x1) / 2 - tc[0], (fr.y0 + fr.y1) / 2 - tc[1]];
  const top = b.lid > 0 ? LID_TOP + (TRAY_Z.floor - LID_TOP) * (1 - b.lid) : TRAY_Z.floor;
  const fall = (WORK_DEPTH[b.id] + 6) * b.fall;
  // as it falls it slides toward the near (south) wall, in under its rim (the pit runs under the walls, to 6 u past the box),
  // where the camera loses most of it before the leaves shut
  const toWall = Math.max(0, tc[1] + shift[1] - (L.box.y0 - 6 + TRAYS[k].d / 2 - 4)) * b.fall;
  const wallMat = b.built >= 0.999 ? m.graphite : mats.wall;
  const off = post?.off ?? [0, 0, 0];
  const sq = post?.squash ?? 0;
  return (
    <group position={[tc[0] + off[0], tc[1] + off[1], off[2]]} scale={[1 + sq / 2, 1 + sq / 2, 1 - sq]}>
      <group position={[-tc[0], -tc[1], 0]}>
        <mesh geometry={walls} material={wallMat} />
        {door && <mesh geometry={door} material={m.enamelShade} />}
        {doorBar && <mesh geometry={doorBar} material={m.steel} />}
        {band && <mesh geometry={band} material={mats.band} />}
        {floor && <mesh geometry={floor} material={mats.floor} />}
        {b.lid > 0 && b.lid < 1 && <MorphLid inner={inner} lid={b.lid} material={mats.floor} />}
        {b.lid >= 1 && <Hatch box={L.box} open={b.leaves} depth={WORK_DEPTH[b.id]} look="lid" inner={inner} />}
        <group position={[tc[0] + shift[0], tc[1] + shift[1] - toWall, top - TRAY_Z.floor - fall]}>{contents}</group>
      </group>
    </group>
  );
}

/**
 * The event families' prints: a chat slip's bubble, a punched card's holes, an envelope's flap, a calendar leaf's grid.
 * Variant 1 is tray 2's task card and its follow-up: one conversation, the same punches (a pattern no other card has),
 * so the follow-up in tray 6 reads at once as the torn card's own.
 */
function eventTexture(kind: EventKind, w: number, d: number, variant = 0): Texture {
  return texture(
    w,
    d,
    (g) => {
      tooth(g, w, d);
      const ink = FIX_HEX.ink;
      g.fillStyle = ink;
      if (kind === 'chat') bubbleMark(g, 4, d * 0.18, d * 0.6, ink);
      else if (kind === 'ci') {
        if (variant === 1) {
          // a full row of square punches along its top edge over two staggered rows of round ones: the conversation's own
          // mark, on the card and on its follow-up alike (torn in two, each half keeps a run of every row); no other card
          // is punched round (two long slots here read as two lines of text: the critic's X3 P1-5)
          for (let i = 0; i < 9; i++) g.fillRect(4 + i * 4.3, 3.5, 2.4, 3.6);
          for (let r = 0; r < 2; r++)
            for (let i = 0; i < 9 - r; i++) {
              g.beginPath();
              g.arc(5.2 + i * 4.3 + r * 2.15, d * (0.47 + 0.25 * r), 1.35, 0, Math.PI * 2);
              g.fill();
            }
        } else for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) if ((i + r * 2) % 3 !== 1) g.fillRect(6 + i * 6, 6 + r * 9, 2.6, 5.4);
      } else if (kind === 'mail') {
        g.strokeStyle = ink;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(2, 2);
        g.lineTo(w / 2, d * 0.55);
        g.lineTo(w - 2, 2);
        g.stroke();
      } else if (kind === 'leaf') {
        g.fillRect(0, 0, w, 5.5);
        for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) g.fillRect(4 + i * 8.6, 10 + r * 7.4, 4.6, 4);
      }
    },
    4,
  );
}

export function SlipMesh({ p, rot, tilt, material }: { p: P3; rot: number; tilt: number; material: Material }) {
  const g = useGeo(() => piece('chat', B_SLIP.l, B_SLIP.w, B_SLIP.t), []);
  return <mesh geometry={g} material={material} position={p} rotation={[tilt, 0, rot]} />;
}

/** A half of tray 2's card (card-local, its UVs on the whole card's print), torn along the middle on its inner side. */
function cardHalf(east: boolean): BufferGeometry {
  const [w, d] = EVENT_SIZE.ci;
  const g = extrude(tornShape(w / 2, d, 21, east ? 'w' : 'e', 1.6, 3), 0, 0.8, 0.2);
  g.translate(east ? w / 4 : -w / 4, 0, 0);
  return fitUv(g, w, d);
}

function useStuffGeometry() {
  const g = useMemo(() => {
    const event = Object.fromEntries(
      (['chat', 'ci', 'mail', 'leaf'] as const).map((kind) => [kind, kind === 'chat' ? piece('chat', ...EVENT_SIZE.chat) : kind === 'ci' ? piece('ci', ...EVENT_SIZE.ci) : fitUv(extrude(tornShape(...EVENT_SIZE[kind], kind === 'leaf' ? 7 : 9, kind === 'leaf' ? 'n' : '', 1, 4), 0, 0.8, 0.25), ...EVENT_SIZE[kind])]),
    ) as Record<EventKind, BufferGeometry>;
    const halves = { west: cardHalf(false), east: cardHalf(true) };
    // the follow-up: a whole card of the same family and size as tray 2's
    const followUp = piece('ci', FOLLOW_UP.w, FOLLOW_UP.d);
    const dossier = TRAY_STUFF.map((S) => {
      const { w, d, sheets } = S.dossier;
      const h = 0.4 + 0.8 * sheets;
      // the top sheet hinged on its west edge (it riffles about it): built east of x 0, placed at the stack's west edge
      const top = fitUv(extrude(tornShape(w - 1, d - 1, sheets, 's', 1, 4), 0, 0.3, 0.15), w, d);
      top.translate((w - 1) / 2, 0, 0);
      return { stack: slab({ x0: -w / 2, x1: w / 2, y0: -d / 2, y1: d / 2 }, 0, h - 0.3, 1.5, 0.3), top, h };
    });
    return { event, halves, followUp, dossier };
  }, []);
  useLayoutEffect(
    () => () => {
      Object.values(g.event).forEach((x) => x.dispose());
      g.halves.west.dispose();
      g.halves.east.dispose();
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

/** What lies in tray k (tray-local): its event (tray 2's card in two halves, its east half torn off by `tear`), its dossier (its top sheet riffling by `riffle`). */
function TrayStuffMesh({ k, g, mats, tear, riffle }: { k: number; g: ReturnType<typeof useStuffGeometry>; mats: Record<string, MeshStandardMaterial>; tear: number; riffle: number }) {
  const S = TRAY_STUFF[k];
  const z = TRAY_Z.floor;
  const ev = S.event;
  const D = g.dossier[k];
  const [cw] = EVENT_SIZE.ci;
  return (
    <>
      <group position={[ev.o[0], ev.o[1], z]} rotation={[0, 0, ev.rot]}>
        {k === BREAK.from ? (
          <>
            <mesh geometry={g.halves.west} material={mats.evBreak} />
            {/* the east half twists about its own middle and slides off, lying apart in the same tray */}
            <group position={[cw / 4 + TEAR.slide[0] * tear, TEAR.slide[1] * tear, 0.05 * tear]} rotation={[0, 0, TEAR.rot * tear]}>
              <mesh geometry={g.halves.east} material={mats.evBreak} position={[-cw / 4, 0, 0]} />
            </group>
          </>
        ) : (
          <mesh geometry={g.event[ev.kind]} material={mats[`ev${ev.kind}`]} />
        )}
      </group>
      <group position={[S.dossier.o[0], S.dossier.o[1], z]} rotation={[0, 0, S.dossier.rot]}>
        <mesh geometry={D.stack} material={mats.dossierSide} />
        <group position={[-S.dossier.w / 2, 0, D.h - 0.3]} rotation={[0, -riffle, 0]}>
          <mesh geometry={D.top} material={mats.dossierTop} />
        </group>
      </group>
    </>
  );
}

/**
 * Fix B in grey stock (beat 3's eight trays; at the turn five are posted back out east and three wall up into bays), posed
 * by beat3.ts fixBAt in beat 3 and turn.ts fixBTurnAt from f1400. Each tray holds its own event and dossier; the follow-up
 * (beat3.ts followUpAt) lies in tray 6, and tray 2's card tears in two on the break (tearAt), both pure functions of f
 * unless given. In beat 3 each tray is posted in on its own (`posts`) and its dossier riffles in place (`riffle`); the
 * turn passes neither, and the follow-up rides tray 6 into its bay.
 */
export function FixB({ fixB, f, tear, followUp, posts, riffle }: { fixB: TurnState['fixB']; f: number; tear?: number; followUp?: { p: P3; rot: number; tilt: number } | null; posts?: readonly TrayPost[]; riffle?: readonly number[] }) {
  const sets = useDeskSets();
  const mode = useStepMode();
  const m = useDeskMats();
  const B = fixB;
  const tk = tear ?? tearAt(f);
  const fu = followUp === undefined ? followUpAt(f) : followUp;
  const turn = posts === undefined;
  const gs = useMemo(() => TRAYS.map((tr, k) => trayGeometry(tr.w, tr.d, tr.door, k)), []);
  const stuff = useStuffGeometry();
  const slipTex = useReplyTexture();
  const evTex = useMemo(
    () => ({
      chat: eventTexture('chat', ...EVENT_SIZE.chat),
      ci: eventTexture('ci', ...EVENT_SIZE.ci),
      mail: eventTexture('mail', ...EVENT_SIZE.mail),
      leaf: eventTexture('leaf', ...EVENT_SIZE.leaf),
      // tray 2's conversation: its card and its follow-up share one print
      conv: eventTexture('ci', ...EVENT_SIZE.ci, 1),
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
  const env = m.enamel.envMap;
  const mats = useMats(() => {
    const o = { stepped: mode };
    const white = whiteTexture();
    const out: Record<string, MeshStandardMaterial> = {
      tray: paper(white, FIX_HEX.rim, { ...o, roughness: 0.95 }),
      floor: paper(white, FIX_HEX.floor, o),
      card: paper(white, FIX_HEX.item, o),
      evchat: paper(evTex.chat, FIX_HEX.item, o),
      evci: paper(evTex.ci, FIX_HEX.item, o),
      evmail: paper(evTex.mail, FIX_HEX.item, o),
      evleaf: paper(evTex.leaf, FIX_HEX.item, o),
      evBreak: paper(evTex.conv, FIX_HEX.item, o),
      followUp: paper(evTex.conv, FIX_HEX.item, o),
      dossierSide: paper(white, FIX_HEX.shade, o),
      dossierTop: paper(white, FIX_HEX.light, o),
    };
    out.dossierTop.side = DoubleSide;
    TRAYS.forEach((_, k) => (out[`s${k}`] = paper(slipTex, FIX_HEX.reply, o)));
    BAY_TRAYS.forEach(({ k }) => {
      // a bay tray's rim and floor: grey stock on the kit's graphite program from beat 3 on, so walling up and becoming the
      // lid is a change of amount (colour, sheen), never a swap; its band the blank nameplate's enamel (objects/Bay.tsx)
      out[`w${k}`] = graphite(FIX_HEX.rim, { metalness: 0, roughness: 0.95, stepped: mode });
      out[`f${k}`] = graphite(FIX_HEX.floor, { metalness: 0, roughness: 0.9, brush: 0, stepped: mode });
      if (env) out[`b${k}`] = enamel(white, env, HEX.enamel, { stepped: mode });
    });
    return out;
  }, [slipTex, evTex, mode, env]);
  useLayoutEffect(() => {
    // a walled-up tray turns from grey stock to the bay's graphite, its floor to the lid's (contrast and sheen, never alpha)
    BAY_TRAYS.forEach(({ k }, i) => {
      const b = B.bays[i];
      const w = mats[`w${k}`];
      w.color.copy(lerpHex(FIX_HEX.rim, BAY_WALL_HEX, b.built));
      w.metalness = 0.55 * b.built;
      w.roughness = 0.95 + (0.42 - 0.95) * b.built;
      const fl = mats[`f${k}`];
      // the floor turns with the walls (the growing bay never reads as a pale tray): it is the lid's graphite by the time it parts
      fl.color.copy(lerpHex(FIX_HEX.floor, LID_HEX, b.built));
      fl.metalness = 0.45 * b.built;
      fl.roughness = 0.9 + (0.55 - 0.9) * b.built;
    });
    // a reply clear of its tray's shade eases its paper up from the tone it had there (beat3.ts REPLY_FREE): no flash in place
    TRAYS.forEach((_, k) => mats[`s${k}`].color.set(FIX_HEX.reply).multiplyScalar(replyToneB(k, f)));
    // no Worker computes yet: every work slot is dark (they light when a task is dispatched, 4.3 on)
    for (const set of [sets.full, sets.stepped]) for (const s of [set.slotBug, set.slotTests, set.slotDocs]) s.color.set(SLOT_IDLE);
  });
  const landed = (k: number) => turn && f >= replyLands(k);
  // what lies in tray k (tray-local): its event and dossier, its reply once home, and (in the turn) the follow-up in tray 6
  const contents = (k: number) => (
    <>
      <TrayStuffMesh k={k} g={stuff} mats={mats} tear={tk} riffle={riffle?.[k] ?? 0} />
      {landed(k) && <SlipMesh p={[TRAY_STUFF[k].reply.o[0], TRAY_STUFF[k].reply.o[1], TRAY_Z.floor + 0.6]} rot={TRAY_STUFF[k].reply.rot} tilt={0} material={mats[`s${k}`]} />}
      {turn && k === BREAK.to && fu && <mesh geometry={stuff.followUp} material={mats.followUp} position={[FOLLOW_UP.o[0], FOLLOW_UP.o[1], TRAY_Z.floor + 0.9]} rotation={[0, 0, FOLLOW_UP.rot]} />}
    </>
  );
  // a tray on its post (beat 3) or on its way back out (the turn): carried by its offset, squashed as it lands (3%)
  const posted = (k: number, off: P3, body: ReactNode) => {
    const P = posts?.[k];
    const tr = TRAYS[k];
    const sq = P?.squash ?? 0;
    const o = P?.off ?? [0, 0, 0];
    return (
      <group key={k} position={[tr.c[0] + o[0] + off[0], tr.c[1] + o[1] + off[1], o[2] + off[2]]} scale={[1 + sq / 2, 1 + sq / 2, 1 - sq]}>
        {body}
      </group>
    );
  };
  const bayOf = (k: number) => BAY_TRAYS.findIndex((b) => b.k === k);
  return (
    <group>
      {TRAYS.map((_, k) => {
        const i = bayOf(k);
        if (i >= 0)
          return <BayTray key={k} k={k} b={B.bays[i]} f={f} post={posts?.[k]} mats={{ wall: mats[`w${k}`], floor: mats[`f${k}`], band: mats[`b${k}`] ?? mats.card }} contents={contents(k)} />;
        const R = B.retire[k];
        if (R?.gone) return null;
        return posted(
          k,
          R?.off ?? [0, 0, 0],
          <>
            <mesh geometry={gs[k].floor} material={mats.floor} />
            <mesh geometry={gs[k].walls} material={mats.tray} />
            {contents(k)}
          </>,
        );
      })}
      {!turn && fu && <mesh geometry={stuff.followUp} material={mats.followUp} position={fu.p} rotation={[fu.tilt, 0, fu.rot]} />}
      {/* the replies in flight and in your in-tray (until the turn brings them home) */}
      {B.slips.map((s, k) => (landed(k) ? null : <SlipMesh key={k} p={posts && s.p[2] < TRAY_Z.floor + 1 ? [s.p[0] + posts[k].off[0], s.p[1] + posts[k].off[1], s.p[2] + posts[k].off[2]] : s.p} rot={s.rot} tilt={s.tilt} material={mats[`s${k}`]} />))}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------
// After the turn (act two, desk/beat4.ts): the riders wound into the reel; the old heap and the request rising out of it

/** How high a folded tab's top face stands over the pack's top at its hinge (tabMatrix: its frame 0.9 u up, turned over, its face 0.2 u over that). */
const TAB_RISE = 1.1;

/** The coil at rest on the reel, as the turn locks it: the rim its clip and tabs ride. */
const LOCKED: CoilState = { c: [REEL.x, REEL.y], h: REEL.packZ[0], rIn: REEL.hubR, rOut: REEL.packR, t: REEL.packZ[1] - REEL.packZ[0], k: 1, spin: 0, hub: 1, spokes: 1, wrap: 2 * Math.PI, wrapLead: 0, rim: REEL.packR, stock: 1 };

/**
 * The notes loop's clip and tabs riding the Register's reel as the coil left them at the lock, turned with the reel
 * (`angle`, as the coil's spin), until the request's detent winds them in at the rim (`wind`, 0..1 linear in time from
 * the detent's start: desk/beat4.ts ridersAt; nothing moves before the reel does): each tab, hinged on the rim's top edge
 * where it is fastened to the tape, is carried round with the reel and drawn down over its hinge into the coil, under the
 * next turn of tape: its free end goes under the pack's top first and the part still showing shortens evenly frame by
 * frame (the fold is set so the edge of the pack's top travels along the tab at a steady pace), then its hinge edge goes
 * under too, so nothing of it is left above the top when it is gone. The clip slides in off the rim's edge as the tape
 * tightens and tips down into the coil about its outer edge, its wire handles last, all of it under the top by its end.
 * At their own size all the way (never scaled): each tab over 6 f (0.3 f after the one before it), the clip over 9 f.
 */
export function ReelRiders({ angle, sink: wind }: { angle: number; sink: number }) {
  const m = useDeskMats();
  const tabMat = useMemo(() => paper(whiteTexture(), TAPE_HEX.tab), []);
  useLayoutEffect(() => () => tabMat.dispose(), [tabMat]);
  const tab = useGeo(() => tabLocal(), []);
  const clip = useMemo(() => clipGeometry(LOOP_A), []);
  useLayoutEffect(() => () => Object.values(clip).forEach((x) => x.dispose()), [clip]);
  const L = coilRim({ ...LOCKED, spin: angle });
  const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
  const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
  const tabs = TABS.map((_, k) => {
    // its own 6 f of the wind (10 f), 0.3 f after the tab before it
    const s = clamp01((wind - 0.03 * k) / 0.6);
    const M0 = tabMatrix(L, 1, 1, k, angle);
    // the fold that leaves (1 - s) of its length over the pack's top (its top face TAB_RISE over the top at the hinge)
    const theta = s <= 0 ? 0 : Math.asin(Math.min(1, TAB_RISE / Math.max(TAB_RISE, TAB.l * (1 - s))));
    const e = M0.elements;
    // inward along the rim's radius at the hinge (inside the outer wall as it stands), and down at the end, so its hinge
    // edge goes under the pack's top too
    const r = Math.hypot(e[12] - REEL.x, e[13] - REEL.y) || 1;
    const ix = ((REEL.x - e[12]) / r) * 1.6 * ease(s / 0.5);
    const iy = ((REEL.y - e[13]) / r) * 1.6 * ease(s / 0.5);
    const down = -2.8 * ease((s - 0.6) / 0.4);
    // (the folded tab's own z points down into the coil (tabMatrix turns it over the rim): a positive turn about its hinge
    // takes its free end down)
    return new Matrix4().makeTranslation(ix, iy, down).multiply(M0).multiply(new Matrix4().makeRotationX(theta));
  });
  // the clip: tipped into the coil as it is drawn in off the rim's edge (its folded thickness inside the rim), folding down
  // about its outer edge as it goes, so it is foreshortened away as much as it travels; its wire handles, standing proud
  // of the body, go under last, as the whole clip settles below the top
  const c = clamp01(wind / 0.9);
  const slide = ease(c) * 62;
  // (gathering pace: the clip is long, so a small tip already sinks its inner end under the pack's top)
  const fold = ease((c - 0.1) / 0.9) ** 2.2;
  const settle = 12 * ease((c - 0.2) / 0.6);
  const zb = LOOP_A.z + 0.9;
  const xp = 48 - slide;
  const cm = clipMatrix(L, 1, angle)
    .clone()
    .multiply(CLIP_FROM.clone().invert())
    .multiply(new Matrix4().makeTranslation(xp, 0, zb - 2.2 * fold * fold - settle))
    .multiply(new Matrix4().makeRotationY((-Math.PI / 2) * fold))
    .multiply(new Matrix4().makeTranslation(-xp - slide, 0, -zb))
    .multiply(CLIP_FROM);
  return (
    <group>
      {tabs.map((mx, k) => (
        <Placed key={k} matrix={mx} geometry={tab} material={tabMat} />
      ))}
      <Placed matrix={cm} geometry={clip.body} material={m.enamel} />
      <Placed matrix={cm} geometry={clip.spine} material={m.graphiteDark} />
      <Placed matrix={cm} geometry={clip.wire} material={m.steel} />
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
        const q = heapPieceAt(p.z, Math.abs(p.z - onReq) < 1e-6, heap, heapFloor(p.c, p.rot, PIECE[p.kind][0], PIECE[p.kind][1], p.z));
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

/** The older reply on its way down the chute into your in-tray (turn.ts olderReplyAt): YourDesk's slip1, the same sheet and print. */
function OlderReply({ r }: { r: NonNullable<ReturnType<typeof olderReplyAt>> }) {
  const m = useDeskMats();
  const g = useGeo(() => plane(OLDER_REPLY_REST.size[0], OLDER_REPLY_REST.size[1], 0, 0, 0), []);
  return (
    <group position={r.p} rotation={[0, r.slope, r.heading, 'ZYX']}>
      <mesh geometry={g} material={m.printed.inTray[0]} />
    </group>
  );
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
      {t.reply && <OlderReply r={t.reply} />}
    </>
  );
}
