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
import { BoxGeometry, CircleGeometry, Shape, Vector4, type BufferGeometry } from 'three';
import { cylinderZ, dome, extrude, merge, slab } from '../geom.ts';
import { DESK_GROOVE_CUT, DESK_HOLES, HOLE_SHUT } from '../gl/desk.ts';
import { STEP_OWN } from '../gl/materials.ts';
import { Step, isStepped, useDeskMats, useDeskSets } from '../kit.tsx';
import { BAYS, DISPATCH, FRESH, NEXT_SLIP, PUNCH, type Rect } from '../layout.ts';
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

/** The chat slip as a thin paper body with its print on top; `notched`: the loupe's accept, a V cut in its north edge. */
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
    // the folder: a few sheets in a paper cover, its tab on the leading edge; the punched hole its transit light shows through
    const folder = new BoxGeometry(DISPATCH.w, DISPATCH.d, 3);
    const cover = (() => {
      const g = new BoxGeometry(DISPATCH.w, DISPATCH.d, 0.2);
      g.translate(0, 0, 1.6);
      return g;
    })();
    const tab = (() => {
      const g = new BoxGeometry(10, 22, 2.4);
      g.translate(DISPATCH.w / 2 + 4, 6, 0.4);
      return g;
    })();
    const light = (() => {
      const g = new CircleGeometry(4.2, 24);
      g.translate(DISPATCH.w / 2 - 12, -DISPATCH.d / 2 + 11, 1.75);
      return g;
    })();
    // the hatch's two leaves' edges: steel lips that part from the centre line and stay as its seam
    const lip = slab({ x0: -1.3, x1: 1.3, y0: FRESH.box.y0 - 1.4, y1: FRESH.box.y1 + 1.4 }, -0.4, 0.9, 0.6, 0.3);
    return { slip, slipNotched, punch, folder, cover, tab, light, lip };
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
      {n.hatch > 0 &&
        [-1, 1].map((side) => {
          const cx = (FRESH.box.x0 + FRESH.box.x1) / 2;
          const hw = ((FRESH.box.x1 - FRESH.box.x0) / 2 + 1.2) * n.hatch;
          return <mesh key={side} geometry={g.lip} material={m.steel} position={[cx + side * (hw + 1.3), 0, 0]} />;
        })}
      {folder && (
        <group position={folder.p} rotation={[0, -folder.slope, folder.heading, 'ZYX']}>
          <mesh geometry={g.folder} material={m.paper} />
          <mesh geometry={g.cover} material={m.printed.folderFresh} />
          <mesh geometry={g.tab} material={m.paperShade} />
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
