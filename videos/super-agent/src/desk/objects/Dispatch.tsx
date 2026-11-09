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
import { BoxGeometry, CircleGeometry, Color, Path, Shape, Vector4, type BufferGeometry } from 'three';
import { cylinderZ, dome, extrude, frame, merge, slab } from '../geom.ts';
import { DESK_GROOVE_CUT, DESK_HOLES, HOLE_SHUT } from '../gl/desk.ts';
import { STEP_OWN, stepColour } from '../gl/materials.ts';
import { EMIT, Step, isStepped, useDeskMats, useDeskSets } from '../kit.tsx';
import { BAYS, DISPATCH, DISPATCH_HOUSING, FRESH, HATCH_DEPTH, NEXT_SLIP, PUNCH, type Rect } from '../layout.ts';
import { LIGHT_HEX } from '../pools.ts';
import { EVENTS_D, closeAt, type DeskState } from '../state.ts';

/** A hole a little larger than a bay's box (the seam round a hatch), opened `open` from its centre line. */
function hole(b: Rect, open: number): Vector4 {
  if (open <= 0) return HOLE_SHUT();
  const cx = (b.x0 + b.x1) / 2;
  const hw = ((b.x1 - b.x0) / 2 + 1.2) * open;
  return new Vector4(cx - hw, b.y0 - 1.2, cx + hw, b.y1 + 1.2);
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
  useLayoutEffect(() => {
    // a stepped set's computing slot follows its own step amount, so handing a bay from the stepped set back to the
    // full one (C12's ramp out at the rest) never jumps its light
    const base = new Color(LIGHT_HEX.work).multiplyScalar(EMIT.slotDocs);
    for (const [set, k] of [
      [sets.stepped, stepA],
      [sets.own, own],
      [sets.late, late],
    ] as const)
      set.slotDocs.color.copy(stepColour(base, k));
  }, [sets, stepA, own, late]);
  const { cut, hatch } = s.next;
  const sink = s.testsSink;
  useLayoutEffect(() => {
    STEP_OWN.value = own;
    DESK_GROOVE_CUT.value[3] = cut;
    DESK_HOLES.value[0] = hole(FRESH.box, hatch);
    DESK_HOLES.value[1] = hole(BAYS.tests.box, sink > 0 ? 1 : 0);
  }, [own, cut, hatch, sink]);
  return null;
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
    // the hatch's two leaves' edges: steel lips that part from the centre line (the seam while the bay rises)
    const lip = slab({ x0: -1.3, x1: 1.3, y0: FRESH.box.y0 - 1.4, y1: FRESH.box.y1 + 1.4 }, -0.4, 0.9, 0.6, 0.3);
    // the hatch's pit the fresh bay waits in: dark walls and floor under the desk, seen only through the open hatch
    const B = FRESH.box;
    const pit = frame({ x0: B.x0 - 6, x1: B.x1 + 6, y0: B.y0 - 6, y1: B.y1 + 6 }, 5, -HATCH_DEPTH - 8, -0.5, 1, 0.5);
    const pitFloor = slab({ x0: B.x0 - 2, x1: B.x1 + 2, y0: B.y0 - 2, y1: B.y1 + 2 }, -HATCH_DEPTH - 10, -HATCH_DEPTH - 8, 1, 0.5);
    // the dispatch housing under the deck's east end: a graphite box behind the ramp's face, its top just under the rails
    const H = DISPATCH_HOUSING;
    const housing = slab({ ...H.box, x1: H.box.x1 - 4.2 }, H.z[0], H.z[1], 3, 1.5);
    const housingRim = frame({ x0: H.box.x0 + 4, x1: H.box.x1 - 4.2, y0: H.box.y0 + 4, y1: H.box.y1 - 4 }, 3, H.z[1], H.z[1] + 1.2, 1, 0.4);
    return { slip, slipNotched, punch, back, sheets, cover, tab, light, lip, pit, pitFloor, housing, housingRim };
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
      {pz !== null && <mesh geometry={g.punch} material={m.steel} position={[PUNCH.x, PUNCH.y, pz]} />}
      {/* the dispatch housing the folder is pushed out of */}
      <mesh geometry={g.housing} material={m.graphiteDark} />
      <mesh geometry={g.housingRim} material={m.steel} />
      {n.hatch > 0 && (
        <>
          <mesh geometry={g.pit} material={m.graphiteDark} />
          <mesh geometry={g.pitFloor} material={m.hollow} />
        </>
      )}
      {n.hatch > 0 &&
        n.rise < 0.995 &&
        [-1, 1].map((side) => {
          const cx = (FRESH.box.x0 + FRESH.box.x1) / 2;
          const hw = ((FRESH.box.x1 - FRESH.box.x0) / 2 + 1.2) * n.hatch;
          return <mesh key={side} geometry={g.lip} material={m.steel} position={[cx + side * (hw + 1.3), 0, 0]} />;
        })}
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
