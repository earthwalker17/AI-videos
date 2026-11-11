/**
 * Beat 5 (STORYBOARD 5.1-5.3; desk/beat5.ts): the hand-over of the starter key to the intake, the Proactive plate, and
 * the two-stage filter's moving parts that are not the gate's own (its fingers are objects/Intake.tsx Gate):
 * - the starter key (the tray's own key, objects/YourDesk.tsx keyGeometry) from the frame it lifts off your tray, in
 *   its arc and docked flat beside the gate's bar, stepping down with the gate;
 * - the Proactive plate (Proactive · 主动, gl/plate.ts on enamel, as the Continuous plate) lying on the slate south-west
 *   of the gate, slid out of your desk with its chore;
 * - the spike, risen out of its own hatch beside the gate, and the dropped slips impaled on it (the pile);
 * - the filter's slips (MT1's chat slip family, its tail cut in a swallow notch): out of the spout, posted at the gate,
 *   flipped onto the spike or riding the belt into the throat, notched by the punch and fed into the print head;
 * - the punch rising out of the throat's cheek for each kept slip;
 * - the spike's hatch (its leaves, its socket), and its hole in the slate (gl/desk.ts DESK_HOLES' third slot, written after objects/Dispatch.tsx
 *   DeskUniforms on every frame: World.tsx mounts `FilterHoles` after it).
 * From the summary (f5400) on, objects/Trace.tsx draws the hand-over's end state itself (beat5.ts E5.until).
 */
import { useLayoutEffect, useMemo } from 'react';
import { Color, MeshBasicMaterial, PlaneGeometry, Shape, type BufferGeometry } from 'three';
import { KEY_REST, SPIKE_BASE, SPIKE_DEPTH, SPIKE_HATCH, hatchHoleAt, type FilterSlip } from '../beat5.ts';
import { cylinderZ, disc, dome, extrude, frame, planeOn, slab } from '../geom.ts';
import { DESK_HOLES, HOLE_SHUT, makeDeskMaterial } from '../gl/desk.ts';
import { Step, WithMats, isStepped, useDeskMats } from '../kit.tsx';
import { NEXT_SLIP, PROACTIVE_PLATE, PUNCH, SPIKE, rectC, type Rect } from '../layout.ts';
import type { DeskState } from '../state.ts';
import { deskHoles, holeOf } from './Dispatch.tsx';
import { keyGeometry } from './YourDesk.tsx';

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });

/**
 * The filter's chat slip (NEXT_SLIP's size): a thin paper body, its tail cut in a swallow notch, the punch's V in its
 * north edge once notched; its print's UVs from its outline (as MT1's slip, objects/Dispatch.tsx).
 */
function filterSlipGeometry(notched: boolean): BufferGeometry {
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
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + hl) / NEXT_SLIP.l, (pos.getY(i) + hw) / NEXT_SLIP.w);
  uv.needsUpdate = true;
  return g;
}

function useFilterGeometry() {
  const g = useMemo(() => {
    const key = keyGeometry();
    const B = PROACTIVE_PLATE.box;
    const [z0, z1] = PROACTIVE_PLATE.z;
    const plate = { back: slab(B, z0, z0 + 1.6, 4, 0.8), body: slab(inset(B, 3), z0 + 1.6, z1, 3, 1), face: planeOn(inset(B, 5), z1 + 0.2) };
    const spike = {
      base: disc(SPIKE.baseR, 0, SPIKE_BASE, { cx: SPIKE.x, cy: SPIKE.y, bevel: 1.2 }),
      rod: cylinderZ(2.6, SPIKE_BASE, SPIKE.h, SPIKE.x, SPIKE.y, 12, 0.4),
    };
    const punch = cylinderZ(PUNCH.r, 0, PUNCH.h, 0, 0, 20);
    const punchTop = dome(PUNCH.r - 0.6, 0, 0, PUNCH.h);
    return { key, plate, spike, punch, punchTop, slip: filterSlipGeometry(false), slipNotched: filterSlipGeometry(true) };
  }, []);
  useLayoutEffect(
    () => () => {
      const all: BufferGeometry[] = [g.key.body, g.key.bow, ...Object.values(g.plate), ...Object.values(g.spike), g.punch, g.punchTop, g.slip, g.slipNotched];
      all.forEach((x) => x.dispose());
    },
    [g],
  );
  return g;
}

/** One slip of the filter at its pose (heading about z, then nose up, then rolled about its length), squashed as it lands. */
function SlipAt({ x, geometry }: { x: FilterSlip; geometry: BufferGeometry }) {
  const m = useDeskMats();
  const q = x.squash;
  return (
    <group position={x.p} rotation={[x.roll, -x.slope, x.heading, 'ZYX']} scale={[1 + 0.015 * q, 1, 1 - 0.03 * q]}>
      <mesh geometry={geometry} material={m.printed.chatNext} />
    </group>
  );
}

/** Everything of beat 5 but the gate's fingers (desk/beat5.ts beat5At). */
export function Filter({ s }: { s: DeskState }) {
  const g = useFilterGeometry();
  const e = s.e5;
  const k = e.key;
  const plate = e.plate;
  const spike = e.spike;
  // cargo in the air never steps down; what lies on the pile steps with the spike, the docked key with the gate
  const flying = e.slips.filter((x) => !x.onPile);
  const pile = e.slips.filter((x) => x.onPile);
  return (
    <>
      {k && (
        <Step on={k.lift > 0 ? false : isStepped(s.step, 'gate')}>
          <WithMats>
            {(m) => (
              // the tray's key, built where it rests in your tray: turned and tilted about that rest point, squashed as it docks
              <group position={k.p}>
                <group rotation={[k.tilt, 0, k.yaw]} scale={[1 + k.squash / 2, 1 + k.squash / 2, 1 - k.squash]}>
                  <group position={[-KEY_REST[0], -KEY_REST[1], -KEY_REST[2]]}>
                    <mesh geometry={g.key.body} material={m.steel} />
                    <mesh geometry={g.key.bow} material={m.steel} />
                  </group>
                </group>
              </group>
            )}
          </WithMats>
        </Step>
      )}
      {plate && (
        <Step on={isStepped(s.step, 'proactive')}>
          <WithMats>
            {(m) => (
              <group position={[0, plate.dy, 0]}>
                <mesh geometry={g.plate.back} material={m.graphiteDark} />
                <mesh geometry={g.plate.body} material={m.enamel} />
                <mesh geometry={g.plate.face} material={m.printed.proactive} />
              </group>
            )}
          </WithMats>
        </Step>
      )}
      {spike && (
        <Step on={isStepped(s.step, 'spike')}>
          <WithMats>
            {(m) => (
              <>
                <group position={[0, 0, spike.dz]}>
                  <mesh geometry={g.spike.base} material={m.steel} />
                  <mesh geometry={g.spike.rod} material={m.steel} />
                </group>
                {pile.map((x) => (
                  <SlipAt key={x.i} x={x} geometry={g.slip} />
                ))}
              </>
            )}
          </WithMats>
        </Step>
      )}
      {flying.map((x) => (
        <SlipAt key={x.i} x={x} geometry={x.notched ? g.slipNotched : g.slip} />
      ))}
      {e.punch !== null && (
        <WithMats>
          {(m) => (
            <group position={[PUNCH.x, PUNCH.y, e.punch!]}>
              <mesh geometry={g.punch} material={m.steel} />
              <mesh geometry={g.punchTop} material={m.steel} />
            </group>
          )}
        </WithMats>
      )}
      {spike?.hole && <SpikeHatch open={spike.leaves} />}
    </>
  );
}

/** The spike's socket: its lining, unlit and never darker than the slate's floor tone (a narrow, deep pit seen from above would otherwise read near black). */
const SOCKET_HEX = '#4C4F4D';

/**
 * The spike's hatch (objects/Dispatch.tsx Hatch 'slate', with its own socket): two leaves cut from the slate (the desk's
 * own program, its marks sliding with them) part over a socket lined in graphite, which the spike stands up out of.
 */
function SpikeHatch({ open }: { open: number }) {
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
  const lining = useMemo(() => new MeshBasicMaterial({ color: new Color(SOCKET_HEX) }), []);
  const g = useMemo(() => {
    const box = SPIKE_HATCH;
    const h = { x0: box.x0 - 1.2, x1: box.x1 + 1.2, y0: box.y0 - 1.2, y1: box.y1 + 1.2 };
    const [cx, cy] = rectC(h);
    const hw = (h.x1 - h.x0) / 2;
    // a leaf, its inner edge at x = 0 (the west leaf; the east is it mirrored), its top just under the slate; a steel lip under its inner edge
    const leaf = new PlaneGeometry(hw + 1, h.y1 - h.y0);
    leaf.translate(-(hw + 1) / 2 + 0.5, 0, -0.25);
    const lip = slab({ x0: -1.6, x1: 0, y0: h.y0 - cy, y1: h.y1 - cy }, -3.2, -0.5, 0.4, 0.2);
    const walls = frame({ x0: box.x0 - 6, x1: box.x1 + 6, y0: box.y0 - 6, y1: box.y1 + 6 }, 5, -SPIKE_DEPTH - 8, -0.5, 1, 0.5);
    const floor = slab({ x0: box.x0 - 2, x1: box.x1 + 2, y0: box.y0 - 2, y1: box.y1 + 2 }, -SPIKE_DEPTH - 10, -SPIKE_DEPTH - 8, 1, 0.5);
    return { leaf, lip, walls, floor, cx, cy, hw };
  }, []);
  useLayoutEffect(
    () => () => {
      for (const x of [g.leaf, g.lip, g.walls, g.floor]) x.dispose();
      for (const x of [...leafMats, lining]) x.dispose();
    },
    [g, leafMats, lining],
  );
  const out = (g.hw + 4) * Math.min(1, Math.max(0, open));
  useLayoutEffect(() => {
    // a slate leaf's marks slide with it (the west leaf west, the east leaf east)
    leafMats[0]!.uniforms.uShift.value.set(-out, 0);
    leafMats[1]!.uniforms.uShift.value.set(out, 0);
  }, [leafMats, out]);
  return (
    <group>
      {open > 0 && (
        <>
          <mesh geometry={g.walls} material={lining} />
          <mesh geometry={g.floor} material={lining} />
        </>
      )}
      <group position={[g.cx - out, g.cy, 0]}>
        <mesh geometry={g.leaf} material={leafMats[0]} />
        <mesh geometry={g.lip} material={m.steel} />
      </group>
      <group position={[g.cx + out, g.cy, 0]} scale={[-1, 1, 1]}>
        <mesh geometry={g.leaf} material={leafMats[1]} />
        <mesh geometry={g.lip} material={m.steel} />
      </group>
    </group>
  );
}

/**
 * The beat-5 hatch's hole in the slate: gl/desk.ts DESK_HOLES' third slot (the docs bay's, which is shut long before),
 * written on every frame after objects/Dispatch.tsx DeskUniforms has written all three, so a page that starts anywhere
 * draws what one running through does. Mount it after DeskUniforms.
 */
export function FilterHoles({ s }: { s: DeskState }) {
  const box = hatchHoleAt(s.f);
  const docs = deskHoles(s)[2]!;
  const hole = box ? holeOf(box) : docs;
  useLayoutEffect(() => {
    DESK_HOLES.value[2] = hole;
  });
  return null;
}
