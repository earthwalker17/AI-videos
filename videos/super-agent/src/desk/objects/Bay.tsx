/**
 * The Workers: one class of walled bay rising from the floor (C11: "each task gets its own Worker,
 * context and tools"), each with its own task-shaped superstructure (synthesis §2, element sheet).
 * The shared base is the class: the enamel nameplate band on the south wall, the door in the north
 * wall facing the deck, the dossier tray (its thickness is the Worker's context), the work slot
 * (lit while computing) and a three-tool rack. What differs is the task, and it breaks the bay's
 * outline: every bay stays under 80, clearly below the deck at 120.
 * - BugBay: a bench whose six test pins stand above its walls, the vermilion folder docked on it with
 *   the request on top; its rack holds tweezers, a magnifier and a probe;
 * - TestsBay: a stack light of test lamps taller than its walls (a dome on top); its rack holds a
 *   caliper, a fork gauge and a stopwatch;
 * - DocsBay: wide and low, type set in lines in a galley tray (ink on enamel); its rack holds a nib,
 *   a ruler and a composing stick.
 */
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import type { BufferGeometry } from 'three';
import { bayDoor, bayWalls } from '../footprints.ts';
import { cylinderZ, disc, dome, frame, merge, plane, planeOn, ringFlat, slab, tube } from '../geom.ts';
import { EMIT, Step, WithMats, isStepped, useDeskMats, type DeskMats } from '../kit.tsx';
import { BAYS, BAY_FLOOR, BENCH, FOLDER, GALLEY_TRAY, PINS, REQUEST, SHEET, TOWER, rectC, type BayLayout, type Rect } from '../layout.ts';
import { LIGHT_HEX } from '../pools.ts';
import type { DeskState } from '../state.ts';

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });
const z = BAY_FLOOR + 4;
const rodX = (x0: number, x1: number, y: number, r: number, zz = z): BufferGeometry =>
  tube(
    [
      [x0, y, zz],
      [x1, y, zz],
    ],
    r,
    4,
    10,
  );

type Tools = { metal: BufferGeometry; grips: BufferGeometry };

/** The rack's rail and the three rows the tools lie in (each tool about 60 u long, along x). */
function rackRows(rack: Rect): { rail: BufferGeometry; rows: number[]; x0: number; x1: number } {
  const rail = merge([slab({ x0: rack.x0, x1: rack.x1, y0: rack.y1 - 6, y1: rack.y1 }, BAY_FLOOR, BAY_FLOOR + 12, 2, 1), slab({ x0: rack.x0, x1: rack.x1, y0: rack.y0, y1: rack.y0 + 5 }, BAY_FLOOR, BAY_FLOOR + 7, 2, 1)]);
  const d = rack.y1 - rack.y0 - 14;
  return { rail, rows: [rack.y0 + 8 + d * 0.16, rack.y0 + 8 + d * 0.5, rack.y0 + 8 + d * 0.84], x0: rack.x0 + 14, x1: rack.x1 - 14 };
}

/** Debugging: tweezers, a magnifier, a probe. */
function bugTools(rack: Rect): Tools {
  const { rows, x0, x1 } = rackRows(rack);
  const [a, b, c] = rows;
  const tweezers = merge([
    tube(
      [
        [x0, a - 1, z],
        [x1 - 4, a - 5, z],
      ],
      1.6,
      6,
      6,
    ),
    tube(
      [
        [x0, a + 1, z],
        [x1 - 4, a + 5, z],
      ],
      1.6,
      6,
      6,
    ),
  ]);
  const magnifier = merge([ringFlat(10, 2.6, x1 - 12, b, z), rodX(x0 + 18, x1 - 24, b, 2)]);
  const probe = rodX(x0 + 16, x1, c, 1.2);
  return { metal: merge([tweezers, magnifier, probe]), grips: merge([rodX(x0, x0 + 16, b, 3.8), merge([rodX(x0, x0 + 16, c, 3.6), dome(4, x0, c, z)])]) };
}

/** Testing: a caliper, a fork gauge, a stopwatch on its strap. */
function testTools(rack: Rect): Tools {
  const { rows, x0, x1 } = rackRows(rack);
  const [a, b, c] = rows;
  const caliper = merge([slab({ x0, x1, y0: a - 2.5, y1: a + 2.5 }, z - 1.5, z + 1.5, 1, 0.4), slab({ x0, x1: x0 + 5, y0: a - 12, y1: a + 2 }, z - 1.5, z + 1.5, 1, 0.4), slab({ x0: x0 + 22, x1: x0 + 27, y0: a - 12, y1: a + 2 }, z - 1.5, z + 1.5, 1, 0.4)]);
  const fork = merge([rodX(x0 + 16, x1, b - 4, 1.6), rodX(x0 + 16, x1, b + 4, 1.6), rodX(x0 + 10, x0 + 18, b, 2.6)]);
  const watch = merge([disc(11, z - 2, z + 2.5, { cx: x1 - 12, cy: c, bevel: 1 }), cylinderZ(2, z, z + 2, x1 - 12, c + 13, 8)]);
  const strap = rodX(x0, x1 - 22, c, 2.4);
  return { metal: merge([caliper, fork, watch]), grips: merge([strap, rodX(x0, x0 + 12, b, 3.4)]) };
}

/** Writing: a nib, a ruler, a composing stick. */
function docTools(rack: Rect): Tools {
  const { rows, x0, x1 } = rackRows(rack);
  const [a, b, c] = rows;
  const nib = (() => {
    const g = cylinderZ(3.4, 0, x1 - x0 - 18, 0, 0, 14, 0.6);
    g.rotateY(Math.PI / 2);
    g.translate(x0 + 18, a, z);
    return g;
  })();
  const ruler = merge([slab({ x0, x1, y0: b - 5, y1: b + 5 }, z - 2, z + 1, 1, 0.4), ...Array.from({ length: 8 }, (_, i) => slab({ x0: x0 + 6 + i * 8, x1: x0 + 7.4 + i * 8, y0: b + 1, y1: b + 5 }, z + 1, z + 1.6, 0.2, 0.1))]);
  const stick = merge([slab({ x0, x1, y0: c - 6, y1: c + 6 }, z - 2, z, 1, 0.4), slab({ x0, x1, y0: c + 4, y1: c + 6 }, z - 2, z + 4, 0.5, 0.3), slab({ x0: x1 - 4, x1, y0: c - 6, y1: c + 6 }, z - 2, z + 4, 0.5, 0.3)]);
  return { metal: merge([ruler, stick]), grips: merge([nib, rodX(x0, x0 + 18, a, 3.6)]) };
}

function useBayGeometry(b: BayLayout, tools: (rack: Rect) => Tools) {
  return useMemo(() => {
    const walls = merge(bayWalls(b).map((w) => slab(w, 0, b.wallH, 3, 3)));
    const floor = slab(inset(b.box, 2), 0, BAY_FLOOR, 4, 1);
    const south = bayWalls(b)[2];
    const band = planeOn(inset(south, 2), b.wallH + 0.25);
    const door = slab(bayDoor(b), BAY_FLOOR, b.wallH - 6, 2, 1.5);
    const doorBar = slab({ x0: b.door[0] + 10, x1: b.door[1] - 10, y0: b.box.y1 - b.wall / 2 - 2, y1: b.box.y1 - b.wall / 2 + 2 }, b.wallH - 6, b.wallH - 2, 1, 0.6);
    // the work slot: a block with a lit slit on top
    const slotBlock = slab(b.slot, BAY_FLOOR, 30, 4, 2);
    const cy = rectC(b.slot)[1];
    const slit = planeOn({ x0: b.slot.x0 + 8, x1: b.slot.x1 - 8, y0: cy - 6, y1: cy + 6 }, 30.3);
    const slitLip = frame({ x0: b.slot.x0 + 5, x1: b.slot.x1 - 5, y0: cy - 9, y1: cy + 9 }, 3, 30, 32, 2, 0.6);
    // the dossier: a tray, the stack (sheets at 0.8 u), the top sheet's print
    const stackH = b.sheets * SHEET;
    const tray = merge([slab(b.dossier, BAY_FLOOR, BAY_FLOOR + 2, 3, 0.6), frame(b.dossier, 3, BAY_FLOOR, BAY_FLOOR + 10, 3, 0.8)]);
    const stack = slab(inset(b.dossier, 5), BAY_FLOOR + 2, BAY_FLOOR + 2 + stackH, 1.5, 0.5);
    const top = planeOn(inset(b.dossier, 5), BAY_FLOOR + 2 + stackH + 0.2);
    const t = tools(b.rack);
    return { walls, floor, band, door, doorBar, slotBlock, slit, slitLip, tray, stack, top, rail: rackRows(b.rack).rail, ...t };
  }, [b, tools]);
}

/** The class every Worker shares, with its task's superstructure as children. */
function BayBase({ b, slot, tools, children }: { b: BayLayout; slot: 'slotBug' | 'slotTests' | 'slotDocs'; tools: (rack: Rect) => Tools; children: ReactNode }) {
  const m = useDeskMats();
  const g = useBayGeometry(b, tools);
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
      <mesh geometry={g.rail} material={m.graphiteDark} />
      <mesh geometry={g.metal} material={m.steel} />
      <mesh geometry={g.grips} material={m.enamel} />
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
    // the six pins stand above the walls: a base, a post (the flags are posed per frame)
    const pinBases = merge(Array.from({ length: PINS.n }, (_, i) => cylinderZ(5, BENCH.z[1], BENCH.z[1] + 4, PINS.x0 + i * PINS.dx, PINS.y, 16)));
    const pinPosts = merge(Array.from({ length: PINS.n }, (_, i) => cylinderZ(1.8, BENCH.z[1] + 4, BENCH.z[1] + PINS.h, PINS.x0 + i * PINS.dx, PINS.y, 10)));
    const flag = slab({ x0: -8, x1: 8, y0: -18, y1: -2 }, 0, 1, 1.5, 0.3);
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
    return { top, edge, legs, pinBases, pinPosts, flag, folder, folderTop, folderTab, request, requestBody };
  }, []);
}

/** A pin's flag: graphite face up before its test runs, flipped (enamel up) once it passes. */
function PinFlag({ i, state, geometry }: { i: number; state: number; geometry: BufferGeometry }) {
  const m = useDeskMats();
  return (
    <group position={[PINS.x0 + i * PINS.dx, PINS.y, BENCH.z[1] + PINS.h]} rotation={[Math.PI * state, 0, 0]}>
      <mesh geometry={geometry} material={m.graphiteDark} position={[0, 0, 0.1]} />
      <mesh geometry={geometry} material={m.enamel} position={[0, 0, -1.1]} />
    </group>
  );
}

export function BugBay({ s }: { s: DeskState }) {
  const g = useBenchGeometry();
  return (
    <Step on={isStepped(s.step, 'bugBay')}>
      <WithMats>
        {(m) => (
          <BayBase b={BAYS.bug} slot="slotBug" tools={bugTools}>
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
        )}
      </WithMats>
    </Step>
  );
}

// ------------------------------------------------------------------------------------------------

function useTowerGeometry() {
  return useMemo(() => {
    const T = TOWER;
    const z0 = T.base + T.post;
    const post = merge([disc(T.r + 6, T.base, T.base + 3, { cx: T.x, cy: T.y, bevel: 1 }), cylinderZ(5, T.base + 3, z0, T.x, T.y, 16)]);
    const lamps: BufferGeometry[] = [];
    const rings: BufferGeometry[] = [];
    for (let i = 0; i < T.n; i++) {
      const a = z0 + i * (T.seg + T.gap);
      lamps.push(cylinderZ(T.r, a, a + T.seg, T.x, T.y, 40));
      rings.push(cylinderZ(T.r + 1.2, a + T.seg, a + T.seg + T.gap, T.x, T.y, 40));
    }
    rings.push(cylinderZ(T.r + 1.2, z0 - 2, z0, T.x, T.y, 40));
    const top = z0 + T.n * T.seg + (T.n - 1) * T.gap;
    const cap = dome(T.r - 1, T.x, T.y, top);
    return { post, lamps: merge(lamps), rings: merge(rings), cap };
  }, []);
}

export function TestsBay({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const g = useTowerGeometry();
  useLayoutEffect(() => {
    // its work light dims as the run finishes
    m.slotTests.color.set(LIGHT_HEX.work).multiplyScalar(0.25 + (EMIT.slotDocs - 0.25) * s.testsLight);
  }, [m, s.testsLight]);
  return (
    <BayBase b={BAYS.tests} slot="slotTests" tools={testTools}>
      <mesh geometry={g.post} material={m.graphite} />
      <mesh geometry={g.lamps} material={m.paperLit} />
      <mesh geometry={g.rings} material={m.graphite} />
      <mesh geometry={g.cap} material={m.enamel} />
    </BayBase>
  );
}

// ------------------------------------------------------------------------------------------------

function useGalleyGeometry() {
  return useMemo(() => {
    const t = GALLEY_TRAY.box;
    const tray = slab(t, GALLEY_TRAY.z[0], GALLEY_TRAY.z[0] + 5, 4, 1.5);
    const rails = frame(t, 6, GALLEY_TRAY.z[0], GALLEY_TRAY.z[1], 4, 1.2);
    const type = planeOn(inset(t, 8), GALLEY_TRAY.z[0] + 5.3);
    // the composing stick beside the type, never across it
    const stick = merge([slab({ x0: t.x1 + 6, x1: t.x1 + 18, y0: t.y0 + 4, y1: t.y1 - 4 }, BAY_FLOOR, BAY_FLOOR + 5, 2, 1)]);
    return { tray, rails, type, stick };
  }, []);
}

function DocsParts({ m }: { m: DeskMats }) {
  const g = useGalleyGeometry();
  return (
    <>
      <mesh geometry={g.tray} material={m.graphiteDark} />
      <mesh geometry={g.rails} material={m.enamelShade} />
      <mesh geometry={g.type} material={m.printed.galley} />
      <mesh geometry={g.stick} material={m.steel} />
    </>
  );
}

export function DocsBay({ s }: { s: DeskState }) {
  return (
    <Step on={isStepped(s.step, 'docsBay')}>
      <WithMats>
        {(m) => (
          <BayBase b={BAYS.docs} slot="slotDocs" tools={docTools}>
            <DocsParts m={m} />
          </BayBase>
        )}
      </WithMats>
    </Step>
  );
}

