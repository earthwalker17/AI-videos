/**
 * The Workers: one class of walled bay rising from the floor (C11: "each task gets its own Worker,
 * context and tools"), each with its own task-shaped superstructure (synthesis §2, element sheet).
 * The shared base is the class: the enamel nameplate band on the south wall, the door in the north
 * wall facing the deck, the dossier tray (its thickness is the Worker's context), the work slot
 * (lit while computing) and the same three-tool rack. The superstructure is the task:
 * - BugBench: a tall bench with six test pins flipping, the vermilion folder docked on it with the
 *   request on top (the request is inside the bug bay), a thick dossier;
 * - TestTower: stacked test lamps, its card slot on the cap (the report card has just left);
 * - DocsGalley: a wide galley of type lines being set, under a clamped work light.
 */
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { Shape, type BufferGeometry } from 'three';
import { bayDoor, bayWalls } from '../footprints.ts';
import { cylinderZ, disc, dome, extrude, frame, merge, plane, planeOn, ringFlat, slab, tube } from '../geom.ts';
import { EMIT, useDeskMats } from '../kit.tsx';
import { BAYS, BAY_FLOOR, BENCH, FOLDER, GALLEY_LAMP, GALLEY_TRAY, PINS, REQUEST, SHEET, TOWER, rectC, type BayId, type BayLayout, type Rect } from '../layout.ts';
import { LIGHT_HEX } from '../pools.ts';
import type { DeskState } from '../state.ts';

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });

/** The three tools, lying in the rack (the same in every bay): a shell key (T-handle), a search loupe, an edit stylus. */
function toolGeometry(rack: Rect): { metal: BufferGeometry; grips: BufferGeometry; rail: BufferGeometry } {
  const z = BAY_FLOOR + 4;
  const cy = (rack.y0 + rack.y1) / 2;
  const len = Math.min(62, rack.y1 - rack.y0 - 8);
  const xs = [rack.x0 + 20, (rack.x0 + rack.x1) / 2, rack.x1 - 20];
  const y0 = cy - len / 2;
  const y1 = cy + len / 2;
  const metal = merge([
    // shell key: a shaft with a bit
    tube(
      [
        [xs[0], y0 + 14, z],
        [xs[0], y1, z],
      ],
      2.6,
      6,
      8,
    ),
    slab({ x0: xs[0], x1: xs[0] + 8, y0: y1 - 10, y1: y1 - 2 }, z - 2, z + 2, 1, 0.5),
    // search: a ring and its shank
    ringFlat(11, 2.8, xs[1], y1 - 13, z),
    tube(
      [
        [xs[1], y0 + 18, z],
        [xs[1], y1 - 24, z],
      ],
      2.2,
      6,
      8,
    ),
  ]);
  const stylus = (() => {
    const g = cylinderZ(3.6, 0, len - 12, 0, 0, 16, 0.8);
    g.rotateX(-Math.PI / 2);
    g.translate(xs[2], y0 + 4, z);
    return g;
  })();
  const grips = merge([
    // the key's T-handle, the loupe's handle, the stylus's grip
    tube(
      [
        [xs[0] - 13, y0 + 10, z],
        [xs[0] + 13, y0 + 10, z],
      ],
      4,
      6,
      10,
    ),
    tube(
      [
        [xs[1], y0 + 2, z],
        [xs[1], y0 + 20, z],
      ],
      4.2,
      6,
      10,
    ),
    stylus,
  ]);
  const rail = merge([slab({ x0: rack.x0, x1: rack.x1, y0: rack.y1 - 6, y1: rack.y1 }, BAY_FLOOR, BAY_FLOOR + 12, 2, 1), slab({ x0: rack.x0, x1: rack.x1, y0: rack.y0, y1: rack.y0 + 5 }, BAY_FLOOR, BAY_FLOOR + 7, 2, 1)]);
  return { metal, grips, rail };
}

function useBayGeometry(b: BayLayout) {
  return useMemo(() => {
    const walls = merge(bayWalls(b).map((w) => slab(w, 0, b.wallH, 3, 3.2)));
    const floor = slab(inset(b.box, 2), 0, BAY_FLOOR, 4, 1);
    const south = bayWalls(b)[2];
    const band = planeOn(inset(south, 2), b.wallH + 0.25);
    const door = slab(bayDoor(b), BAY_FLOOR, b.wallH - 6, 2, 1.5);
    const doorBar = slab({ x0: b.door[0] + 10, x1: b.door[1] - 10, y0: b.box.y1 - b.wall / 2 - 2, y1: b.box.y1 - b.wall / 2 + 2 }, b.wallH - 6, b.wallH - 2, 1, 0.6);
    // the work slot: a block with a lit slit on top
    const slotBlock = slab(b.slot, BAY_FLOOR, 40, 4, 2);
    const slit = planeOn({ x0: b.slot.x0 + 7, x1: b.slot.x1 - 7, y0: rectC(b.slot)[1] - 4, y1: rectC(b.slot)[1] + 4 }, 40.3);
    const slitLip = frame({ x0: b.slot.x0 + 4, x1: b.slot.x1 - 4, y0: rectC(b.slot)[1] - 7, y1: rectC(b.slot)[1] + 7 }, 3, 40, 42, 2, 0.6);
    // the dossier: a tray, the stack (sheets at 0.8 u), the top sheet's print
    const stackH = b.sheets * SHEET;
    const tray = merge([slab(b.dossier, BAY_FLOOR, BAY_FLOOR + 2, 3, 0.6), frame(b.dossier, 3, BAY_FLOOR, BAY_FLOOR + 10, 3, 0.8)]);
    const stack = slab(inset(b.dossier, 5), BAY_FLOOR + 2, BAY_FLOOR + 2 + stackH, 1.5, 0.5);
    const top = planeOn(inset(b.dossier, 5), BAY_FLOOR + 2 + stackH + 0.2);
    const tools = toolGeometry(b.rack);
    return { walls, floor, band, door, doorBar, slotBlock, slit, slitLip, tray, stack, top, tools };
  }, [b]);
}

/** The class every Worker shares, with its task's superstructure as children. */
function BayBase({ b, slot, children }: { b: BayLayout; slot: 'slotBug' | 'slotTests' | 'slotDocs'; children: ReactNode }) {
  const m = useDeskMats();
  const g = useBayGeometry(b);
  return (
    <group>
      <mesh geometry={g.floor} material={m.graphiteDeck} />
      <mesh geometry={g.walls} material={m.graphite} />
      <mesh geometry={g.band} material={m.printed.nameplate[b.id]} />
      <mesh geometry={g.door} material={m.enamelShade} />
      <mesh geometry={g.doorBar} material={m.steel} />
      <mesh geometry={g.slotBlock} material={m.graphiteDark} />
      <mesh geometry={g.slit} material={m[slot]} />
      <mesh geometry={g.slitLip} material={m.steel} />
      <mesh geometry={g.tray} material={m.enamelShade} />
      <mesh geometry={g.stack} material={m.paper} />
      <mesh geometry={g.top} material={m.printed.dossier[b.id]} />
      <mesh geometry={g.tools.rail} material={m.graphiteDark} />
      <mesh geometry={g.tools.metal} material={m.steel} />
      <mesh geometry={g.tools.grips} material={m.enamel} />
      {children}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------

function useBenchGeometry() {
  return useMemo(() => {
    const t = BENCH.top;
    const top = slab(t, BENCH.z[0], BENCH.z[1], 4, 2);
    const edge = slab({ x0: t.x0 - 1, x1: t.x1 + 1, y0: t.y0 - 3, y1: t.y0 + 4 }, BENCH.z[0] - 1, BENCH.z[1] + 1, 2, 1);
    const L = BENCH.leg;
    const legs = merge(
      [
        [t.x0 + 4, t.y0 + 4],
        [t.x1 - 4 - L, t.y0 + 4],
        [t.x0 + 4, t.y1 - 4 - L],
        [t.x1 - 4 - L, t.y1 - 4 - L],
      ].map(([x, y]) => slab({ x0: x, x1: x + L, y0: y, y1: y + L }, BAY_FLOOR, BENCH.z[0], 2, 1)),
    );
    // the six pins: a base, a post (the flags are posed per frame)
    const pinBases = merge(Array.from({ length: PINS.n }, (_, i) => cylinderZ(5, BENCH.z[1], BENCH.z[1] + 4, PINS.x0 + i * PINS.dx, PINS.y, 16)));
    const pinPosts = merge(Array.from({ length: PINS.n }, (_, i) => cylinderZ(1.8, BENCH.z[1] + 4, BENCH.z[1] + PINS.h, PINS.x0 + i * PINS.dx, PINS.y, 10)));
    const flag = (z: number) => {
      const g = slab({ x0: -8, x1: 8, y0: -18, y1: -2 }, z, z + 1, 1.5, 0.3);
      return g;
    };
    const folder = slab(FOLDER.box, FOLDER.z[0], FOLDER.z[1], 3, 1);
    const folderTop = planeOn(FOLDER.box, FOLDER.z[1] + 0.2);
    const folderTab = slab({ x0: FOLDER.box.x0 + 8, x1: FOLDER.box.x0 + 50, y0: FOLDER.box.y0 - 9, y1: FOLDER.box.y0 + 2 }, FOLDER.z[0], FOLDER.z[0] + 2, 2, 0.6);
    const request = (() => {
      const g = plane(REQUEST.l, REQUEST.w, 0, 0, 0, 0);
      g.rotateZ(REQUEST.rot - Math.PI / 2);
      g.translate(REQUEST.c[0], REQUEST.c[1], REQUEST.z + 0.4);
      return g;
    })();
    const requestBody = (() => {
      const g = slab({ x0: -REQUEST.l / 2, x1: REQUEST.l / 2, y0: -REQUEST.w / 2, y1: REQUEST.w / 2 }, 0, 0.8, 1.5, 0.2);
      g.rotateZ(REQUEST.rot - Math.PI / 2);
      g.translate(REQUEST.c[0], REQUEST.c[1], REQUEST.z - 0.4);
      return g;
    })();
    return { top, edge, legs, pinBases, pinPosts, flag: flag(0), folder, folderTop, folderTab, request, requestBody };
  }, []);
}

/** A pin's flag: graphite face up before its test runs, flipped (enamel up) once it passes. */
function PinFlag({ i, state, geometry }: { i: number; state: number; geometry: BufferGeometry }) {
  const m = useDeskMats();
  const z = BENCH.z[1] + PINS.h;
  // flipping about the pin's east-west axis: half a turn carries the flag from south to north
  const a = Math.PI * state;
  return (
    <group position={[PINS.x0 + i * PINS.dx, PINS.y, z]} rotation={[a, 0, 0]}>
      <mesh geometry={geometry} material={m.graphiteDark} position={[0, 0, 0.1]} />
      <mesh geometry={geometry} material={m.enamel} position={[0, 0, -1.1]} />
    </group>
  );
}

export function BugBay({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const g = useBenchGeometry();
  return (
    <BayBase b={BAYS.bug} slot="slotBug">
      <mesh geometry={g.legs} material={m.graphiteDark} />
      <mesh geometry={g.top} material={m.graphite} />
      <mesh geometry={g.edge} material={m.enamelShade} />
      <mesh geometry={g.pinBases} material={m.graphiteDark} />
      <mesh geometry={g.pinPosts} material={m.steel} />
      {s.pins.map((p, i) => (
        <PinFlag key={i} i={i} state={p} geometry={g.flag} />
      ))}
      <mesh geometry={g.folder} material={m.vermilionShade} />
      <mesh geometry={g.folderTop} material={m.printed.folder} />
      <mesh geometry={g.folderTab} material={m.vermilionShade} />
      <mesh geometry={g.requestBody} material={m.vermilionPaper} />
      <mesh geometry={g.request} material={m.printed.request} />
    </BayBase>
  );
}

// ------------------------------------------------------------------------------------------------

function useTowerGeometry() {
  return useMemo(() => {
    const drums: BufferGeometry[] = [];
    const bands: BufferGeometry[] = [];
    const lenses: BufferGeometry[] = [];
    for (let i = 0; i < TOWER.n; i++) {
      const z0 = TOWER.base + i * (TOWER.drum + TOWER.gap);
      const r = TOWER.r - i * 1.5;
      drums.push(cylinderZ(r, z0, z0 + TOWER.drum, TOWER.x, TOWER.y, 48));
      bands.push(cylinderZ(r + 1.6, z0 + TOWER.drum - 5, z0 + TOWER.drum, TOWER.x, TOWER.y, 48));
      // the lamp's lens, on the drum's south face
      const lens = dome(7.5, 0, 0, 0);
      lens.rotateX(-Math.PI / 2);
      lens.translate(TOWER.x - 10 + (i % 2) * 20, TOWER.y - r + 0.5, z0 + TOWER.drum / 2 - 1);
      lenses.push(lens);
      // the spacer between drums
      if (i > 0) drums.push(cylinderZ(r - 8, z0 - TOWER.gap, z0, TOWER.x, TOWER.y, 32));
    }
    const top = TOWER.base + TOWER.n * (TOWER.drum + TOWER.gap);
    const rTop = TOWER.r - (TOWER.n - 1) * 1.5;
    const cap = disc(rTop + 2, top - TOWER.gap, top + 5, { cx: TOWER.x, cy: TOWER.y, bevel: 1.5 });
    const capSlot = planeOn({ x0: TOWER.x - 26, x1: TOWER.x + 26, y0: TOWER.y + 8, y1: TOWER.y + 14 }, top + 5.3);
    const capKnob = dome(5, TOWER.x, TOWER.y - 14, top + 5);
    return { drums: merge(drums), bands: merge(bands), lenses: merge(lenses), cap, capSlot, capKnob };
  }, []);
}

export function TestsBay({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const g = useTowerGeometry();
  useLayoutEffect(() => {
    // its work light dims as the run finishes (8 f into the dim at f2200)
    m.slotTests.color.set(LIGHT_HEX.work).multiplyScalar(0.25 + (EMIT.slot - 0.25) * s.testsLight);
  }, [m, s.testsLight]);
  return (
    <BayBase b={BAYS.tests} slot="slotTests">
      <mesh geometry={g.drums} material={m.graphite} />
      <mesh geometry={g.bands} material={m.enamelShade} />
      <mesh geometry={g.lenses} material={m.enamel} />
      <mesh geometry={g.cap} material={m.enamel} />
      <mesh geometry={g.capSlot} material={m.hollow} />
      <mesh geometry={g.capKnob} material={m.graphite} />
    </BayBase>
  );
}

// ------------------------------------------------------------------------------------------------

function useGalleyGeometry() {
  return useMemo(() => {
    const t = GALLEY_TRAY.box;
    const tray = slab(t, GALLEY_TRAY.z[0], GALLEY_TRAY.z[0] + 6, 4, 1.5);
    const rails = frame(t, 7, GALLEY_TRAY.z[0], GALLEY_TRAY.z[1], 4, 1.2);
    const type = planeOn(inset(t, 8), GALLEY_TRAY.z[0] + 6.3);
    // the composing stick, holding the line being set
    const stick = slab({ x0: t.x0 + 12, x1: t.x0 + 200, y0: t.y0 + 12, y1: t.y0 + 30 }, GALLEY_TRAY.z[0] + 6, GALLEY_TRAY.z[0] + 13, 2, 1);
    const stickKnob = disc(6, GALLEY_TRAY.z[0] + 13, GALLEY_TRAY.z[0] + 17, { cx: t.x0 + 20, cy: t.y0 + 21, bevel: 1 });
    // the clamped work light: a bar on two posts
    const L = GALLEY_LAMP;
    const posts = merge(L.posts.map((x) => merge([cylinderZ(3.5, BAY_FLOOR, L.z, x, L.y + 18, 12), disc(7, BAY_FLOOR, BAY_FLOOR + 3, { cx: x, cy: L.y + 18, bevel: 0.8 })])));
    const bar = (() => {
      const s = new Shape();
      s.moveTo(L.x0, L.y - 9);
      s.lineTo(L.x1, L.y - 9);
      s.lineTo(L.x1, L.y + 9);
      s.lineTo(L.x0, L.y + 9);
      s.closePath();
      return extrude(s, L.z - 7, L.z + 7, 3);
    })();
    const arms = merge(
      L.posts.map((x) =>
        tube(
          [
            [x, L.y + 18, L.z - 2],
            [x + (x < (L.x0 + L.x1) / 2 ? 8 : -8), L.y + 6, L.z],
          ],
          2.4,
          4,
          6,
        ),
      ),
    );
    return { tray, rails, type, stick, stickKnob, posts, bar, arms };
  }, []);
}

export function DocsBay({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const g = useGalleyGeometry();
  // the stick advances with the line being set
  const along = 12 + 60 * s.galley;
  return (
    <BayBase b={BAYS.docs} slot="slotDocs">
      <mesh geometry={g.tray} material={m.graphiteDark} />
      <mesh geometry={g.rails} material={m.enamelShade} />
      <mesh geometry={g.type} material={m.printed.galley} />
      <group position={[along, 0, 0]}>
        <mesh geometry={g.stick} material={m.steel} />
        <mesh geometry={g.stickKnob} material={m.enamel} />
      </group>
      <mesh geometry={g.posts} material={m.graphite} />
      <mesh geometry={g.arms} material={m.graphite} />
      <mesh geometry={g.bar} material={m.enamel} />
    </BayBase>
  );
}

export const BAY_COMPONENTS: Record<BayId, (p: { s: DeskState }) => ReactNode> = { bug: BugBay, tests: TestsBay, docs: DocsBay };
