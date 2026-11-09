/**
 * MT1 after the reply (film f2226-2340, state.ts EVENTS_D): the next chat slip comes out of the
 * spout, is posted over the gate's keep side (its fingers only stand ready: the gate is explained in
 * beat 5), rides the belt into the throat, waits while the loupe reads the policy card, is notched by
 * the punch that rises out of the throat's cheek, and feeds into the print head. Then the dispatch
 * folder is pushed out of the deck's rail slot, down the ramp and along the fresh groove into the
 * fresh bay (objects/Bay.tsx FreshBay), under the one transit light.
 *
 * `DeskUniforms` sets what the frame changes on shared uniforms before it is drawn: the own focus
 * ramp (kit.tsx), the fresh groove's cut and the hatches open in the desk (gl/desk.ts).
 */
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry, CircleGeometry, Color, Path, PlaneGeometry, Shape, Vector4, type BufferGeometry } from 'three';
import { HEAP_HATCH, WORK_DEPTH } from '../beat4.ts';
import { cylinderZ, dome, extrude, frame, merge, slab } from '../geom.ts';
import { DESK_GROOVE_CUT, DESK_HOLES, HOLE_SHUT, makeDeskMaterial } from '../gl/desk.ts';
import { STEP_OWN, stepColour } from '../gl/materials.ts';
import { EMIT, Step, isStepped, useDeskMats, useDeskSets } from '../kit.tsx';
import { BAYS, DISPATCH, FRESH, HATCH_DEPTH, NEXT_SLIP, PUNCH, rectC, type Rect } from '../layout.ts';
import { EVENTS_D, closeAt, type DeskState } from '../state.ts';
import { slotColour } from './Bay.tsx';

/** A hatch's hole in the slate: a little larger than its box (the seam round it); the leaves in it are drawn by `Hatch`. */
export const holeOf = (b: Rect): Vector4 => new Vector4(b.x0 - 1.2, b.y0 - 1.2, b.x1 + 1.2, b.y1 + 1.2);

/**
 * The frame's hatch holes, one per slot of gl/desk.ts DESK_HOLES (each slot serves hatches that are never open together):
 * the request's bay or MT1's fresh bay; the test tower (its dispatch, then sinking once finished); the old heap or the
 * docs galley.
 */
export function deskHoles(s: DeskState): Vector4[] {
  const b = s.b4.bays;
  const pick = (...open: [boolean, Rect][]): Vector4 => {
    const o = open.find(([on]) => on);
    return o ? holeOf(o[1]) : HOLE_SHUT();
  };
  return [pick([s.next.hole, FRESH.box], [b.bug.hole, BAYS.bug.box]), pick([b.tests.hole || s.testsSink > 0, BAYS.tests.box]), pick([s.b4.heap.hole, HEAP_HATCH.box], [b.docs.hole, BAYS.docs.box])];
}

export function DeskUniforms({ s }: { s: DeskState }) {
  const sets = useDeskSets();
  const close = closeAt(s.f);
  useLayoutEffect(() => {
    // the close shot's fine print cross-fades in over the micro-print (every set's instance)
    for (const set of [sets.full, sets.stepped, sets.late, sets.own]) {
      const p = set.printed;
      for (const m of [p.fanfoldFine, p.galleyFine, ...Object.values(p.dossierFine)]) m.opacity = close;
    }
  }, [sets, close]);
  const own = s.step.own?.amount ?? 0;
  const stepA = s.step.amount;
  const late = s.testsStep;
  useLayoutEffect(() => {
    // a stepped vellum drawing fades with its set's step amount (0.6 when fully stepped), so handing a part from
    // one set to another (C12's ramp, the own ramp) never jumps
    for (const [set, k] of [
      [sets.stepped, stepA],
      [sets.own, own],
      [sets.late, late],
    ] as const) {
      set.vellumMail.opacity = 1 - 0.4 * k;
      set.vellumCalendar.opacity = 1 - 0.4 * k;
    }
  }, [sets, stepA, own, late]);
  const docs = s.b4.bays.docs.light;
  useLayoutEffect(() => {
    // the docs galley's slot: dark while it is idle, lit (clamped, never blooming) once it computes; a stepped set's slot
    // follows its own step amount, so handing a bay from the stepped set back to the full one never jumps its light
    const base = slotColour(new Color(), EMIT.slotDocs, docs);
    sets.full.slotDocs.color.copy(base);
    for (const [set, k] of [
      [sets.stepped, stepA],
      [sets.own, own],
      [sets.late, late],
    ] as const)
      set.slotDocs.color.copy(stepColour(base, k));
  }, [sets, stepA, own, late, docs]);
  const cuts = [s.b4.bays.bug.cut, s.b4.bays.tests.cut, s.b4.bays.docs.cut, s.next.cut];
  const holes = deskHoles(s);
  const key = `${cuts.join(',')}|${holes.map((h) => `${h.x},${h.y},${h.z},${h.w}`).join(';')}`;
  useLayoutEffect(() => {
    STEP_OWN.value = own;
    // every groove's cut and every hole slot, every frame: a page that starts anywhere draws what one running through does
    DESK_GROOVE_CUT.value.splice(0, cuts.length, ...cuts);
    for (let i = 0; i < DESK_HOLES.value.length; i++) DESK_HOLES.value[i] = holes[i] ?? HOLE_SHUT();
  }, [own, key]);
  return null;
}

/**
 * A hatch in the slate (beat4.ts hatchRiseAt): two leaves that slide apart under the slate's edges, their tops the
 * desk's own surface (the desk's program, the same uniforms), so a shut hatch reads as the slate with a seam; under them
 * a dark pit. Drawn while its hole is open (gl/desk.ts DESK_HOLES).
 */
export function Hatch({ box, open, depth }: { box: Rect; open: number; depth: number }) {
  const m = useDeskMats();
  const leafMat = useMemo(() => {
    const mat = makeDeskMaterial();
    // the leaves are never cut away themselves
    mat.uniforms.uHole = { value: [HOLE_SHUT(), HOLE_SHUT(), HOLE_SHUT()] };
    return mat;
  }, []);
  const g = useMemo(() => {
    const h = { x0: box.x0 - 1.2, x1: box.x1 + 1.2, y0: box.y0 - 1.2, y1: box.y1 + 1.2 };
    const hw = (h.x1 - h.x0) / 2;
    const leaf = new PlaneGeometry(hw + 1, h.y1 - h.y0);
    // each leaf's inner edge: a steel lip under it, seen in the gap as the leaves part
    const lip = slab({ x0: -1.6, x1: 0, y0: h.y0 - rectC(h)[1], y1: h.y1 - rectC(h)[1] }, -3.2, -0.5, 0.4, 0.2);
    const pit = frame({ x0: box.x0 - 6, x1: box.x1 + 6, y0: box.y0 - 6, y1: box.y1 + 6 }, 5, -depth - 8, -0.5, 1, 0.5);
    const floor = slab({ x0: box.x0 - 2, x1: box.x1 + 2, y0: box.y0 - 2, y1: box.y1 + 2 }, -depth - 10, -depth - 8, 1, 0.5);
    return { leaf, lip, pit, floor, c: rectC(h), hw };
  }, [box, depth]);
  useLayoutEffect(
    () => () => {
      for (const x of [g.leaf, g.lip, g.pit, g.floor]) x.dispose();
    },
    [g],
  );
  useLayoutEffect(() => () => leafMat.dispose(), [leafMat]);
  const [cx, cy] = g.c;
  const out = (g.hw + 4) * clamp01(open);
  return (
    <group>
      <mesh geometry={g.pit} material={m.graphiteDark} />
      <mesh geometry={g.floor} material={m.hollow} />
      {/* the west leaf and the east leaf, each with its lip along its inner edge */}
      <group position={[cx - out, cy, 0]}>
        <mesh geometry={g.leaf} material={leafMat} position={[-(g.hw + 1) / 2 + 0.5, 0, -0.25]} />
        <mesh geometry={g.lip} material={m.steel} />
      </group>
      <group position={[cx + out, cy, 0]} rotation={[0, 0, Math.PI]}>
        <mesh geometry={g.leaf} material={leafMat} position={[-(g.hw + 1) / 2 + 0.5, 0, -0.25]} />
        <mesh geometry={g.lip} material={m.steel} />
      </group>
    </group>
  );
}
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Every hatch open in the slate at a state: the bays' (beat 4), the old heap's, MT1's fresh bay's. */
export function Hatches({ s }: { s: DeskState }) {
  const b = s.b4.bays;
  return (
    <>
      {(['bug', 'tests', 'docs'] as const).map((id) => (b[id].hole ? <Hatch key={id} box={BAYS[id].box} open={b[id].hatch} depth={WORK_DEPTH[id]} /> : null))}
      {s.b4.heap.hole && <Hatch box={HEAP_HATCH.box} open={s.b4.heap.hatch} depth={HEAP_HATCH.depth} />}
      {s.next.hole && <Hatch box={FRESH.box} open={s.next.hatch} depth={HATCH_DEPTH} />}
    </>
  );
}

/** The chat slip as a thin paper body with its print on top, its tail cut in a swallow notch (the chat slip's form); `notched`: the loupe's accept, a V cut in its north edge. */
function slipGeometry(notched: boolean): BufferGeometry {
  const hl = NEXT_SLIP.l / 2;
  const hw = NEXT_SLIP.w / 2;
  const nx = PUNCH.x - NEXT_SLIP.throat[0];
  const s = new Shape();
  s.moveTo(-hl, -hw);
  s.lineTo(hl, -hw);
  s.lineTo(hl, hw);
  if (notched) {
    s.lineTo(nx + 5, hw);
    s.lineTo(nx, hw - 7);
    s.lineTo(nx - 5, hw);
  }
  s.lineTo(-hl, hw);
  s.lineTo(-hl + 9, 0);
  s.closePath();
  const g = extrude(s, -0.4, 0.4, 0);
  // the print's UVs from the outline (the cut takes its paper with it)
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + hl) / NEXT_SLIP.l, (pos.getY(i) + hw) / NEXT_SLIP.w);
  uv.needsUpdate = true;
  return g;
}

function useDispatchGeometry() {
  return useMemo(() => {
    const slip = slipGeometry(false);
    const slipNotched = slipGeometry(true);
    const punch = merge([cylinderZ(PUNCH.r, 0, PUNCH.h, 0, 0, 20), dome(PUNCH.r - 0.6, 0, 0, PUNCH.h)]);
    // the folder (the task handed over whole), heading +x: its back cover, the sheets in it (their edges a step in),
    // the front cover a little short so the back's edge shows along its foot, the index tab standing off its north
    // side, the round cut in the front cover its transit light shows through
    const W = DISPATCH.w;
    const D = DISPATCH.d;
    const back = new BoxGeometry(W, D, 0.8);
    const sheets = (() => {
      const g = new BoxGeometry(W - 6, D - 5, 1.8);
      g.translate(2, -1, 1.2);
      return g;
    })();
    const coverShape = new Shape();
    coverShape.moveTo(-W / 2, -D / 2 + 3);
    coverShape.lineTo(W / 2 - 3, -D / 2 + 3);
    coverShape.lineTo(W / 2 - 3, D / 2);
    coverShape.lineTo(-W / 2, D / 2);
    coverShape.closePath();
    const cut = new Path();
    cut.absarc(-W / 2 + 13, -D / 2 + 14, 4.6, 0, Math.PI * 2, true);
    coverShape.holes.push(cut);
    const cover = extrude(coverShape, 2.2, 2.8, 0);
    {
      // the print's UVs over the folder's whole face
      const pos = cover.getAttribute('position');
      const uv = cover.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, pos.getY(i) / D + 0.5);
      uv.needsUpdate = true;
    }
    const tabShape = new Shape();
    tabShape.moveTo(-W / 2 + 14, D / 2 - 1);
    tabShape.lineTo(-W / 2 + 18, D / 2 + 9);
    tabShape.lineTo(-W / 2 + 40, D / 2 + 9);
    tabShape.lineTo(-W / 2 + 44, D / 2 - 1);
    tabShape.closePath();
    const tab = extrude(tabShape, -0.4, 0.4, 0);
    const light = new CircleGeometry(4.0, 24);
    light.translate(-W / 2 + 13, -D / 2 + 14, 2.15);
    // a punched CI card (the card feeder's), its clipped corner at its north-west, for beat 4's arrival
    const ciShape = new Shape();
    ciShape.moveTo(-42 + 9, 25);
    ciShape.lineTo(42, 25);
    ciShape.lineTo(42, -25);
    ciShape.lineTo(-42, -25);
    ciShape.lineTo(-42, 25 - 9);
    ciShape.closePath();
    const ci = extrude(ciShape, -0.4, 0.4, 0);
    {
      const pos = ci.getAttribute('position');
      const uv = ci.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 84 + 0.5, pos.getY(i) / 50 + 0.5);
      uv.needsUpdate = true;
    }
    return { slip, slipNotched, punch, back, sheets, cover, tab, light, ci };
  }, []);
}

/** The punch: out of the cheek a beat before the notch, down on the slip's edge, back into the cheek. */
function punchZ(f: number): number | null {
  const E = EVENTS_D;
  const sine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
  const out = sine((f - (E.notch - 4)) / 3) * (1 - sine((f - (E.notch + 1)) / 3));
  if (out <= 0) return null;
  const drop = Math.max(0, 1 - Math.abs(f - E.notch) / 1.5);
  return PUNCH.hidden + PUNCH.out * out - PUNCH.drop * drop;
}

export function Dispatch({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const g = useDispatchGeometry();
  const n = s.next;
  const pz = punchZ(s.f);
  const slip = n.slip;
  const folder = n.folder;
  return (
    <group>
      {slip && (
        // the intake and the Slow Path are on their own ramp: the slip draws with them
        <Step on={isStepped(s.step, 'intake')}>
          <SlipMesh slip={slip} geometry={slip.notched ? g.slipNotched : g.slip} />
        </Step>
      )}
      {/* beat 4's arrivals on the intake: a CI card, a chat slip, each riding to the head for its row (beat4.ts arrivalsAt) */}
      {s.b4.arrivals.map((a, i) => (
        <group key={i} position={a.pose.p} rotation={[0, -a.pose.slope, a.pose.heading, 'ZYX']} scale={[1 + 0.015 * a.pose.squash, 1, 1 - 0.03 * a.pose.squash]}>
          <mesh geometry={a.kind === 'ci' ? g.ci : g.slip} material={a.kind === 'ci' ? m.printed.ciCard : m.printed.chatNext} />
        </group>
      ))}
      {pz !== null && <mesh geometry={g.punch} material={m.steel} position={[PUNCH.x, PUNCH.y, pz]} />}
      {folder && (
        <group position={folder.p} rotation={[0, -folder.slope, folder.heading, 'ZYX']}>
          <mesh geometry={g.back} material={m.paperShade} />
          <mesh geometry={g.sheets} material={m.paper} />
          <mesh geometry={g.cover} material={m.printed.folderFresh} />
          <mesh geometry={g.tab} material={m.printed.folderFresh} />
          {n.folderTransit > 0 && <mesh geometry={g.light} material={m.transit} />}
        </group>
      )}
    </group>
  );
}

function SlipMesh({ slip, geometry }: { slip: NonNullable<DeskState['next']['slip']>; geometry: BufferGeometry }) {
  const m = useDeskMats();
  const squash = 1 - 0.03 * slip.squash;
  return (
    <group position={slip.p} rotation={[0, -slip.slope, slip.heading, 'ZYX']} scale={[1 + 0.015 * slip.squash, 1, squash]}>
      <mesh geometry={geometry} material={m.printed.chatNext} />
    </group>
  );
}
