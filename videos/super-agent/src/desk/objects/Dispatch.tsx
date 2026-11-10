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
import { BoxGeometry, CircleGeometry, Color, MeshBasicMaterial, Path, PlaneGeometry, Shape, Vector4, type BufferGeometry, type ShaderMaterial } from 'three';
import { WORK_DEPTH, lidShown, type Carrier } from '../beat4.ts';
import { cylinderZ, dome, extrude, frame, merge, slab } from '../geom.ts';
import { DESK_GROOVE_CUT, DESK_HOLES, HOLE_SHUT, makeDeskMaterial } from '../gl/desk.ts';
import { STEP_OWN, graphite, stepColour } from '../gl/materials.ts';
import { EMIT, Step, isStepped, useDeskMats, useDeskSets } from '../kit.tsx';
import { BAYS, DISPATCH, FRESH, HATCH_DEPTH, NEXT_SLIP, PUNCH, rectC, type BayId, type BayLayout, type Rect } from '../layout.ts';
import { EVENTS_D, closeAt, type DeskState } from '../state.ts';
import { slotColour } from './Bay.tsx';

/** A hatch's hole in the slate: a little larger than its box (the seam round it); the leaves in it are drawn by `Hatch`. */
export const holeOf = (b: Rect): Vector4 => new Vector4(b.x0 - 1.2, b.y0 - 1.2, b.x1 + 1.2, b.y1 + 1.2);

/**
 * The frame's hatch holes, one per slot of gl/desk.ts DESK_HOLES (each slot serves hatches that are never open together):
 * the request's bay or MT1's fresh bay; the test tower (its dispatch, then sinking once finished); the docs galley.
 */
export function deskHoles(s: DeskState): Vector4[] {
  const b = s.b4.bays;
  const pick = (...open: [boolean, Rect][]): Vector4 => {
    const o = open.find(([on]) => on);
    return o ? holeOf(o[1]) : HOLE_SHUT();
  };
  return [pick([s.next.hole, FRESH.box], [b.bug.hole, BAYS.bug.box]), pick([b.tests.hole || s.testsSink > 0, BAYS.tests.box]), pick([b.docs.hole, BAYS.docs.box])];
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

/** The pit under an open hatch: its floor never darker than the slate's floor tone (an unlit dark grey, BT.709 luma above 40). */
const PIT_FLOOR = '#2B2D2C';
/** A closed bay's lid: a graphite plate, unbrushed (nothing world-locked on it, so it slides clean), lying on the slate. */
const LID_HEX = '#5A5E5C';
const LID_TOP = 1.2;

/**
 * A hatch (beat4.ts hatchRiseAt, bayDispatchAt). `look`:
 * - 'slate' (MT1's fresh bay, opened in bare slate): two leaves that slide apart under the slate's edges, their tops the
 *   desk's own surface (the desk's program, its marks shifted with the leaf: gl/desk.ts uShift), so a shut hatch reads as
 *   the slate with a seam;
 * - 'lid' (a beat-4 bay standing closed, `inner` its shell's inside): a graphite lid of two leaves lying on the slate
 *   inside the walls, hinged along the walls' inner faces (their barrels at each end), the seam between them; opened, the
 *   leaves swing down into the pit like a trapdoor's, gathering speed, and hit their stops hanging against the walls.
 * Under them, while it opens, the pit (never darker than the slate's floor tone). Drawn while its hole is open
 * (gl/desk.ts DESK_HOLES), and a lid while its bay stands closed.
 */
export function Hatch(p: { box: Rect; open: number; depth: number; look?: 'slate' | 'lid'; inner?: Rect }) {
  return p.look === 'lid' ? <LidHatch box={p.box} open={p.open} depth={p.depth} inner={p.inner ?? p.box} /> : <SlateHatch box={p.box} open={p.open} depth={p.depth} />;
}

function usePit(box: Rect, depth: number) {
  const g = useMemo(
    () => ({
      walls: frame({ x0: box.x0 - 6, x1: box.x1 + 6, y0: box.y0 - 6, y1: box.y1 + 6 }, 5, -depth - 8, -0.5, 1, 0.5),
      floor: slab({ x0: box.x0 - 2, x1: box.x1 + 2, y0: box.y0 - 2, y1: box.y1 + 2 }, -depth - 10, -depth - 8, 1, 0.5),
    }),
    [box, depth],
  );
  const floorMat = useMemo(() => new MeshBasicMaterial({ color: new Color(PIT_FLOOR) }), []);
  useLayoutEffect(
    () => () => {
      g.walls.dispose();
      g.floor.dispose();
    },
    [g],
  );
  useLayoutEffect(() => () => floorMat.dispose(), [floorMat]);
  return { g, floorMat };
}

function Pit({ box, depth }: { box: Rect; depth: number }) {
  const m = useDeskMats();
  const { g, floorMat } = usePit(box, depth);
  return (
    <>
      <mesh geometry={g.walls} material={m.graphiteDark} />
      <mesh geometry={g.floor} material={floorMat} />
    </>
  );
}

function SlateHatch({ box, open, depth }: { box: Rect; open: number; depth: number }) {
  const m = useDeskMats();
  const leafMats = useMemo(
    () =>
      [0, 1].map(() => {
        const mat = makeDeskMaterial();
        // the leaves are never cut away themselves
        mat.uniforms.uHole = { value: [HOLE_SHUT(), HOLE_SHUT(), HOLE_SHUT()] };
        return mat;
      }),
    [],
  );
  const g = useMemo(() => {
    const h = { x0: box.x0 - 1.2, x1: box.x1 + 1.2, y0: box.y0 - 1.2, y1: box.y1 + 1.2 };
    const hw = (h.x1 - h.x0) / 2;
    const y0 = h.y0 - rectC(h)[1];
    const y1 = h.y1 - rectC(h)[1];
    // a leaf, its inner edge at x = 0 (the west leaf; the east is it mirrored): its top just under the slate
    const leaf = new PlaneGeometry(hw + 1, h.y1 - h.y0);
    leaf.translate(-(hw + 1) / 2 + 0.5, 0, -0.25);
    // each leaf's inner edge: a steel lip under it, seen in the gap as the leaves part
    const lip = slab({ x0: -1.6, x1: 0, y0, y1 }, -3.2, -0.5, 0.4, 0.2);
    return { leaf, lip, c: rectC(h), hw };
  }, [box]);
  useLayoutEffect(
    () => () => {
      g.leaf.dispose();
      g.lip.dispose();
    },
    [g],
  );
  useLayoutEffect(() => () => leafMats.forEach((x) => x.dispose()), [leafMats]);
  const [cx, cy] = g.c;
  const out = (g.hw + 4) * clamp01(open);
  useLayoutEffect(() => {
    // a slate leaf's marks slide with it (the west leaf west, the east leaf east)
    (leafMats[0] as ShaderMaterial).uniforms.uShift.value.set(-out, 0);
    (leafMats[1] as ShaderMaterial).uniforms.uShift.value.set(out, 0);
  }, [leafMats, out]);
  return (
    <group>
      {open > 0 && <Pit box={box} depth={depth} />}
      <group position={[cx - out, cy, 0]}>
        <mesh geometry={g.leaf} material={leafMats[0]} />
        <mesh geometry={g.lip} material={m.steel} />
      </group>
      <group position={[cx + out, cy, 0]} scale={[-1, 1, 1]}>
        <mesh geometry={g.leaf} material={leafMats[1]} />
        <mesh geometry={g.lip} material={m.steel} />
      </group>
    </group>
  );
}

/** The lid's seam: the gap between its two leaves (u). */
const LID_SEAM = 2.4;

function LidHatch({ box, inner, open, depth }: { box: Rect; inner: Rect; open: number; depth: number }) {
  const m = useDeskMats();
  const lid = useMemo(() => graphite(LID_HEX, { roughness: 0.55, metalness: 0.45, brush: 0 }), []);
  useLayoutEffect(() => () => lid.dispose(), [lid]);
  const g = useMemo(() => {
    // a leaf in its hinge's frame (the hinge along y at the origin, the leaf out along +x to the seam, its top at 0)
    const L = (inner.x1 - inner.x0) / 2 - LID_SEAM / 2;
    const leaf = slab({ x0: 0, x1: L, y0: inner.y0, y1: inner.y1 }, -2.6, 0, 0.8, 0.4);
    // its hinge's barrels at each end, steel
    const barrel = (y: number) => {
      const c = cylinderZ(2.4, 0, 22, 0, 0, 12);
      c.rotateX(Math.PI / 2);
      c.translate(2.4, y + 22, -0.6);
      return c;
    };
    const barrels = merge([barrel(inner.y0 + 6), barrel(inner.y1 - 28)]);
    return { leaf, barrels };
  }, [inner]);
  useLayoutEffect(
    () => () => {
      g.leaf.dispose();
      g.barrels.dispose();
    },
    [g],
  );
  // gathering speed as it falls, hitting its stop (hanging) as the swing ends
  const a = (Math.PI / 2) * clamp01(open) ** 2;
  return (
    <group>
      {open > 0 && <Pit box={box} depth={depth} />}
      <group position={[inner.x0, 0, LID_TOP]} rotation={[0, a, 0]}>
        <mesh geometry={g.leaf} material={lid} />
        <mesh geometry={g.barrels} material={m.steel} />
      </group>
      {/* the east leaf: the west one mirrored */}
      <group position={[inner.x1, 0, LID_TOP]} rotation={[0, -a, 0]} scale={[-1, 1, 1]}>
        <mesh geometry={g.leaf} material={lid} />
        <mesh geometry={g.barrels} material={m.steel} />
      </group>
    </group>
  );
}
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** The inside of a bay's shell (its walls' inner faces), where its closed lid lies (one object per bay, so a lid's geometry is made once). */
const INSIDE: Record<BayId, Rect> = (() => {
  const of = (b: BayLayout): Rect => ({ x0: b.box.x0 + b.wall, x1: b.box.x1 - b.wall, y0: b.box.y0 + b.southWall, y1: b.box.y1 - b.wall });
  return { bug: of(BAYS.bug), tests: of(BAYS.tests), docs: of(BAYS.docs) };
})();
export const shellInside = (id: BayId): Rect => INSIDE[id];

/** Every hatch in the slate at a state: the beat-4 bays' (a closed lid on the slate from the turn's end, then their dispatch), MT1's fresh bay's. */
export function Hatches({ s }: { s: DeskState }) {
  const b = s.b4.bays;
  return (
    <>
      {(['bug', 'tests', 'docs'] as const).map((id) => (lidShown(b[id]) ? <Hatch key={id} box={BAYS[id].box} open={b[id].hatch} depth={WORK_DEPTH[id]} look="lid" inner={shellInside(id)} /> : null))}
      {s.next.hole && <Hatch box={FRESH.box} open={s.next.hatch} depth={HATCH_DEPTH} look="slate" />}
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

/** A punched CI card (the card feeder's), its clipped corner at its north-west, 84 x 50 (beat 4's arrival and the tests dispatch). */
function ciGeometry(): BufferGeometry {
  const ciShape = new Shape();
  ciShape.moveTo(-42 + 9, 25);
  ciShape.lineTo(42, 25);
  ciShape.lineTo(42, -25);
  ciShape.lineTo(-42, -25);
  ciShape.lineTo(-42, 25 - 9);
  ciShape.closePath();
  const ci = extrude(ciShape, -0.4, 0.4, 0);
  const pos = ci.getAttribute('position');
  const uv = ci.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 84 + 0.5, pos.getY(i) / 50 + 0.5);
  uv.needsUpdate = true;
  return ci;
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
    return { slip, slipNotched, punch, back, sheets, cover, tab, light, ci: ciGeometry() };
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
      {/* beat 4's tests and docs dispatches: the CI card and the docs slip on their rides (docked, their bays draw them: objects/Bay.tsx) */}
      {s.b4.carriers.map((c) => (c.docked ? null : <TaskCarrier key={c.id} c={c} />))}
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

/** A task's carrier (beat4.ts carriersAt): the CI card that asked for the test run, the chat slip that asked for docs; on its ride or docked on its bay's dossier, landing with a 3% squash. */
export function TaskCarrier({ c }: { c: Carrier }) {
  const m = useDeskMats();
  const g = useMemo(() => ({ ci: ciGeometry(), slip: slipGeometry(false) }), []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  const q = c.pose.squash;
  return (
    <group position={c.pose.p} rotation={[0, -c.pose.slope, c.pose.heading, 'ZYX']} scale={[1 + 0.015 * q, 1, 1 - 0.03 * q]}>
      <mesh geometry={c.kind === 'ci' ? g.ci : g.slip} material={c.kind === 'ci' ? m.printed.ciCard : m.printed.chatNext} />
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
