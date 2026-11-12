/**
 * The request's Thread cord in act two (STORYBOARD 7.1; desk/beat7.ts): one body from its payout to the seam. The same
 * parts as still (d)'s (objects/Links.tsx cordParts): the twisted pair along CORDS.vermilion, the guide (an arm off the
 * deck's east rail, a post, a sheave) and the terminal on the bug bay's north wall. In 7.1 the arm slides out of the
 * rail and the post telescopes up with its sheave growing on its top before the cord reaches it, the terminal rises out
 * of the wall before the cord's end bead docks in it, and the cord itself is built per frame: as far as it has paid out,
 * its twist travelling out with it (the strands' phase is the cord's own, so it streams out of the spool), drooped below
 * its final shape and plucked sideways (beat7.ts droopAt, pluckOffset). Once the droop is gone it is drawn with Links.tsx's
 * own geometry at rest (CordsAtRest), so from there to the seam it is still (d)'s cord exactly.
 * Gate: the Thread's gate on the bay's north wall top (beat7.ts GATE), rising with the terminal, shut, and swinging open
 * for the first follow-up; it takes a static pose (rise 1, open 1) for the summary (lane D).
 */
import { useLayoutEffect, useMemo } from 'react';
import { CatmullRomCurve3, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import { CORD_L, GATE, GATE_LEAF, GATE_RISE, cordPoint, cordStatic, type Beat7State, type CordState } from '../beat7.ts';
import { cylinderZ, dome, merge, slab, tube } from '../geom.ts';
import { Step, WithMats, isStepped, useDeskMats } from '../kit.tsx';
import { CORDS, DECK, MAST, type P3 } from '../layout.ts';
import type { DeskState } from '../state.ts';
import { CordsAtRest, cordParts, useCordGeometry } from './Links.tsx';

/** The twisted pair's numbers (Links.tsx cordParts: twistedPair(CORDS.vermilion, 2.4, 2.1, 16, 420)). */
const PAIR = { strandR: 2.4, a: 2.1, pitch: 16, n: 420 } as const;

/** The static curve's samples (as geom.ts curvePoints) and their chord length from the spool: the twist's own measure. */
const SAMPLES = (() => {
  const curve = new CatmullRomCurve3(
    CORDS.vermilion.map((p) => new Vector3(p[0], p[1], p[2])),
    false,
    'centripetal',
  );
  const pts = Array.from({ length: PAIR.n + 1 }, (_, i) => ({ u: i / PAIR.n, t: curve.getTangentAt(i / PAIR.n) }));
  let len = 0;
  let prev = curve.getPointAt(0);
  const lens = pts.map((q, i) => {
    const p = curve.getPointAt(q.u);
    if (i > 0) len += p.distanceTo(prev);
    prev = p;
    return len;
  });
  return { pts, lens, total: len };
})();

/** The two strands of the cord as it is at a state: up to its paid-out end, drooped and plucked, its twist carried out with it. */
function strandsAt(c: CordState): BufferGeometry[] {
  const head = Math.min(c.head, CORD_L);
  const up = new Vector3(0, 0, 1);
  const strands: P3[][] = [[], []];
  // the twist's phase travels with the cord (its end has come out `head` along the path, so a point of the cord at u has
  // been out for head - u·L): at the end of the payout it is the static pair's
  const lag = SAMPLES.total * (1 - head / CORD_L);
  const at = (u: number, len: number, t: Vector3) => {
    const q = cordPoint(u * CORD_L, c);
    const side = new Vector3().crossVectors(t, up).normalize();
    const nrm = new Vector3().crossVectors(side, t).normalize();
    for (let k = 0; k < 2; k++) {
      const ang = (2 * Math.PI * (len + lag)) / PAIR.pitch + k * Math.PI;
      const off = side.clone().multiplyScalar(Math.cos(ang) * PAIR.a).add(nrm.clone().multiplyScalar(Math.sin(ang) * PAIR.a));
      strands[k]!.push([q[0] + off.x, q[1] + off.y, q[2] + off.z]);
    }
  };
  let i = 0;
  for (; i < SAMPLES.pts.length && SAMPLES.pts[i]!.u * CORD_L < head - 0.5; i++) at(SAMPLES.pts[i]!.u, SAMPLES.lens[i]!, SAMPLES.pts[i]!.t);
  // its end, exactly at the paid-out length
  const j = Math.min(i, SAMPLES.pts.length - 1);
  const u = head / CORD_L;
  const k0 = Math.max(0, j - 1);
  const w = SAMPLES.pts[j]!.u > SAMPLES.pts[k0]!.u ? (u - SAMPLES.pts[k0]!.u) / (SAMPLES.pts[j]!.u - SAMPLES.pts[k0]!.u) : 0;
  at(u, SAMPLES.lens[k0]! + (SAMPLES.lens[j]! - SAMPLES.lens[k0]!) * w, SAMPLES.pts[j]!.t);
  if (strands[0]!.length < 2) return [];
  return strands.map((s) => tube(s, PAIR.strandR, Math.max(2, s.length - 1), 8));
}

/** The guide's parts, each drawn alone while it rises (the arm out of the rail, the post up, the sheave on its top), the terminal. */
function useParts() {
  const g = useMemo(() => {
    const p = cordParts();
    p.strands.forEach((x) => x.dispose());
    return { arm: p.arm, post: p.post, sheave: p.sheave, terminal: p.terminal, bead: new SphereGeometry(3.4, 14, 10) };
  }, []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}

/** Where the arm starts (inside the deck's east rail), the post's foot and top, the sheave's centre, the terminal's top (Links.tsx cordParts). */
const ARM_X0 = MAST.arm[0] - 6;
const Z0 = DECK.top - 4;
const POST_TOP = MAST.h - 12;
const SHEAVE_Z = MAST.h - 9;
const TERMINAL_RISE = 16;

/** The Thread cord, its guide and its terminal at a state (act two, from 7.1's payout to the seam). */
export function Thread({ s, e }: { s: DeskState; e: Beat7State }) {
  const parts = useParts();
  const rest = useCordGeometry();
  const settled = cordStatic(e.cord) && e.guide.arm >= 1 && e.guide.post >= 1 && e.terminal >= 1;
  const { head: h0, sag, pluck } = e.cord;
  const strands = useMemo(() => (settled ? [] : strandsAt({ head: h0, sag, pluck })), [settled, h0, sag, pluck]);
  useLayoutEffect(() => () => strands.forEach((x) => x.dispose()), [strands]);
  const { arm, post } = e.guide;
  const head = Math.min(e.cord.head, CORD_L);
  const bead = head < CORD_L ? cordPoint(head, e.cord) : null;
  // the end bead slides into the terminal's mouth over its last stretch (gone inside it by the dock)
  const beadK = Math.min(1, (CORD_L - head) / 40);
  return (
    <Step on={isStepped(s.step, 'cord')}>
      <WithMats>
        {(m) =>
          settled ? (
            <CordsAtRest g={rest} m={m} />
          ) : (
            <group>
              {arm > 0.005 && (
                <group position={[ARM_X0, 0, 0]} scale={[arm, 1, 1]}>
                  <mesh geometry={parts.arm} material={m.graphite} position={[-ARM_X0, 0, 0]} />
                </group>
              )}
              {post > 0.005 && (
                <group position={[0, 0, Z0]} scale={[1, 1, post]}>
                  <mesh geometry={parts.post} material={m.graphite} position={[0, 0, -Z0]} />
                </group>
              )}
              {post > 0.005 && (
                // the sheave rides the post's top, growing as it comes up out of the arm's end
                <group position={[MAST.x, MAST.y, Z0 + (POST_TOP - Z0) * post + (SHEAVE_Z - POST_TOP)]} scale={Math.min(1, 0.25 + post * 2)}>
                  <mesh geometry={parts.sheave} material={m.steel} position={[-MAST.x, -MAST.y, -SHEAVE_Z]} />
                </group>
              )}
              {e.terminal > 0.005 && <mesh geometry={parts.terminal} material={m.steel} position={[0, 0, -TERMINAL_RISE * (1 - e.terminal)]} />}
              {strands.map((g, i) => (
                <mesh key={i} geometry={g} material={m.cordVermilion} />
              ))}
              {bead && beadK > 0.02 && <mesh geometry={parts.bead} material={m.cordVermilion} position={bead} scale={beadK} />}
            </group>
          )
        }
      </WithMats>
    </Step>
  );
}

/** The gate's parts: its post (west, steel, a dome cap), the east leaf's hinge barrel by the terminal, a leaf (along +x from its hinge: enamel, a steel top rail). */
function useGateGeometry() {
  const g = useMemo(() => {
    const post = merge([cylinderZ(GATE.postR, GATE.z0 - 1, GATE.postTop, GATE.x0, GATE.y, 16), dome(GATE.postR, GATE.x0, GATE.y, GATE.postTop)]);
    const hinge = cylinderZ(2.2, GATE.z0, GATE.z1 + 2, GATE.x1, GATE.y, 12);
    const leaf = slab({ x0: 1.5, x1: GATE_LEAF - 0.5, y0: -GATE.t / 2, y1: GATE.t / 2 }, GATE.z0, GATE.z1, 1, 0.6);
    const rail = tube(
      [
        [0, 0, GATE.z1 + 0.8],
        [GATE_LEAF - 1, 0, GATE.z1 + 0.8],
      ],
      1.4,
      4,
      8,
    );
    return { post, hinge, leaf, rail };
  }, []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}
/** The Thread's gate at a pose: risen `rise` (0..1) out of the wall with the terminal, its two leaves swung `open` (0 shut .. 1 north). */
export function Gate({ rise, open }: { rise: number; open: number }) {
  const g = useGateGeometry();
  const m = useDeskMats();
  if (rise <= 0.001) return null;
  const a = (Math.PI / 2) * open;
  return (
    <group position={[0, 0, -GATE_RISE * (1 - rise)]}>
      <mesh geometry={g.post} material={m.steel} />
      <mesh geometry={g.hinge} material={m.steel} />
      <group position={[GATE.x0, GATE.y, 0]} rotation={[0, 0, a]}>
        <mesh geometry={g.leaf} material={m.enamelShade} />
        <mesh geometry={g.rail} material={m.steel} />
      </group>
      <group position={[GATE.x1, GATE.y, 0]} rotation={[0, 0, Math.PI - a]}>
        <mesh geometry={g.leaf} material={m.enamelShade} />
        <mesh geometry={g.rail} material={m.steel} />
      </group>
    </group>
  );
}
