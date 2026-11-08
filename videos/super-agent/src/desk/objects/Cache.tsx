/**
 * Still (c), context as a cache (film f3150; STORYBOARD 6.3, state.ts EVENTS_C), at 2.0x on the
 * Register's reading window:
 * - the request's bay sends a progress report up: the card rises out of its work slot and flies into
 *   the mouth under the one transit light, docking on spring-dock;
 * - the older cards in the window shrink to their stubs and pack east, the bars between them sliding
 *   with them, while the reel detents and drives the tape (never before it);
 * - the card's header strip tears off along its perforation and slides into the print head; the head
 *   drops and prints the header and a three-line summary inline, the record the hooded lamp lights;
 *   the stubs dim one step;
 * - the body folds along a visible crease into a pointer tab carrying the same ID, which drops into
 *   the spill drawer. The Router keeps a stub and a pointer, never the whole Ticket.
 * Every card in the window draws with its own paper material (its dim is a colour, never alpha); the
 * record's ink spreads in over 3 f.
 */
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry, CircleGeometry, Color, MeshStandardMaterial, PlaneGeometry, type Material } from 'three';
import { slab } from '../geom.ts';
import { HEX, paper } from '../gl/materials.ts';
import { useDeskMats, useDeskSets } from '../kit.tsx';
import { CACHE_WINDOW, CARD_C, CELLS_X, MOUTH, TAPE, WINDOW, type P3 } from '../layout.ts';
import { TAB_REST_C, type CacheState, type DeskState } from '../state.ts';

const Z_CARD = TAPE.z + 0.35;
const TAPE_Y = (TAPE.y0 + TAPE.y1) / 2;
const TAPE_H = TAPE.y1 - TAPE.y0;
/** The stubs' paper: idle, and one step dimmer once the record is in (about 22 codes of luma). */
const STUB_HEX = { idle: HEX.paper, dim: '#8E897F' } as const;
/** Where the header strip ends: inside the print head, turned along it. */
const HEAD_INSIDE: P3 = [-321, 225, 152];

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** The card stands as it rises out of the slot, and lies at the mouth's tilt once docked. */
const RISE_TILT = Math.PI / 2 - 0.2;
const DOCK_TILT = 0.28;
/** It docks lying across the hopper's rim (the tests card sat lower, in it): the close shot sees all of it. */
const DOCK_Z = MOUTH.z[1] + 3;

/** A card's place in the window at its shrink k: its west edge, its width. */
export function cellAt(i: number, k: number): { x0: number; w: number } {
  const w0 = CELLS_X[i][1] - CELLS_X[i][0];
  return { x0: lerp(CELLS_X[i][0], CACHE_WINDOW.stubX0[i], k), w: lerp(w0, CACHE_WINDOW.stub, k) };
}
/** The bar on card i's east edge: it rides the edge as the card shrinks, never over its print. */
export function barAt(i: number, k: number): number {
  const { x0, w } = cellAt(i, k);
  return x0 + w + 0.5;
}

/** UVs of a box's top (+z, group 4) and bottom (-z, group 5) faces from its vertex positions. */
function faceUV(g: BoxGeometry, top: (x: number, y: number) => [number, number], bottom?: (x: number, y: number) => [number, number]): BoxGeometry {
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (const grp of g.groups) {
    const which = grp.materialIndex === 4 ? top : grp.materialIndex === 5 ? bottom : undefined;
    if (!which) continue;
    const idx = g.getIndex()!;
    for (let k = grp.start; k < grp.start + grp.count; k++) {
      const v = idx.getX(k);
      const [u, w] = which(pos.getX(v), pos.getY(v));
      uv.setXY(v, u, w);
    }
  }
  uv.needsUpdate = true;
  return g;
}

function useCacheGeometry() {
  return useMemo(() => {
    const W = CARD_C.w;
    const D = CARD_C.d;
    const hy = D * (1 - CARD_C.header);
    // the whole card (flying, docked before its header tears off)
    const card = faceUV(new BoxGeometry(W, D, 1.4), (x, y) => [(x + W / 2) / W, (y + D / 2) / D]);
    // the header strip (the card's top 40%)
    const header = faceUV(new BoxGeometry(W, D - hy, 1.2), (x, y) => [(x + W / 2) / W, (y + (D - hy) / 2 + hy) / D]);
    // the body's halves about the crease (x = 0 in the body's frame; body y from 0 to hy); the west half
    // turns over onto the east, so its back (the tab's face) comes up and faces the key mid-fold
    const west = faceUV(
      new BoxGeometry(W / 2, hy, 0.8).translate(-W / 4, hy / 2, 0),
      (x, y) => [(x + W / 2) / W, y / D],
      (x, y) => [(-x) / (W / 2), y / hy],
    );
    const east = faceUV(new BoxGeometry(W / 2, hy, 0.8).translate(W / 4, hy / 2, 0), (x, y) => [(x + W / 2) / W, y / D]);
    // one card in the window, a unit quad posed per frame; a window bar
    const bar = slab({ x0: 0, x1: CACHE_WINDOW.bar, y0: WINDOW.frame.y0 + WINDOW.bar - 1, y1: WINDOW.frame.y1 - WINDOW.bar + 1 }, TAPE.z, WINDOW.z[1] - 2, 1, 0.5);
    const light = new CircleGeometry(4.6, 24);
    return { card, header, west, east, bar, hy, light };
  }, []);
}

/** The window's cards: each a quad cropped to its width (its stub at the west end), with its own paper. */
function WindowCards({ c }: { c: CacheState }) {
  const { textures } = useDeskSets();
  const quads = useMemo(() => textures.cacheCells.map(() => new PlaneGeometry(1, 1)), [textures]);
  const mats = useMemo(() => textures.cacheCells.map((t) => paper(t, STUB_HEX.idle)), [textures]);
  const record = useMemo(() => {
    const m = paper(textures.record, HEX.paper);
    m.transparent = true;
    return m;
  }, [textures]);
  const recordQuad = useMemo(() => new PlaneGeometry(1, 1), []);
  useLayoutEffect(
    () => () => {
      for (const q of [...quads, recordQuad]) q.dispose();
      for (const m of [...mats, record] as Material[]) m.dispose();
    },
    [quads, mats, record, recordQuad],
  );
  const idle = useMemo(() => new Color(STUB_HEX.idle), []);
  const dim = useMemo(() => new Color(STUB_HEX.dim), []);
  useLayoutEffect(() => {
    quads.forEach((q, i) => {
      const { w } = cellAt(i, c.shrink[i]);
      const w0 = CELLS_X[i][1] - CELLS_X[i][0];
      const uv = q.getAttribute('uv');
      // a plane's uv: (0,1) (1,1) (0,0) (1,0); crop from the east
      const u1 = w / w0;
      uv.setXY(1, u1, 1);
      uv.setXY(3, u1, 0);
      uv.needsUpdate = true;
    });
    for (const m of mats) (m as MeshStandardMaterial).color.copy(idle).lerp(dim, c.dim);
    record.opacity = c.ink;
    record.visible = c.ink > 0;
  }, [quads, mats, record, c.shrink, c.dim, c.ink, idle, dim]);
  const [r0, r1] = CACHE_WINDOW.record;
  return (
    <group>
      {quads.map((q, i) => {
        const { x0, w } = cellAt(i, c.shrink[i]);
        return <mesh key={i} geometry={q} material={mats[i]} position={[x0 + w / 2, TAPE_Y, Z_CARD]} scale={[w, TAPE_H, 1]} />;
      })}
      <mesh geometry={recordQuad} material={record} position={[(r0 + r1) / 2, TAPE_Y, Z_CARD + 0.05]} scale={[r1 - r0, TAPE_H, 1]} />
    </group>
  );
}

export function Cache({ s }: { s: DeskState }) {
  const c = s.cache;
  const m = useDeskMats();
  const g = useCacheGeometry();
  if (!c) return null;
  const edge = m.paperLit;
  const faces = [edge, edge, edge, edge, m.printed.cardC, edge];
  const westFaces = [edge, edge, edge, edge, m.printed.cardC, m.printed.cardCBack];
  const D = CARD_C.d;
  const hy = g.hy;
  // the docked pose: in the mouth, tilted as the tests card was (objects/Links.tsx), settling on spring-dock
  const dockP: P3 = [MOUTH.land[0], MOUTH.land[1], DOCK_Z + (1 - (c.docked?.settle ?? 1)) * 6];
  // the body (and the folded tab): from the dock to its rest in the drawer
  const drop = c.drop;
  const settle = c.landed ?? 0;
  const bodyP: P3 =
    drop <= 0
      ? dockP
      : [lerp(dockP[0], TAB_REST_C[0], drop), lerp(dockP[1], TAB_REST_C[1], drop), lerp(dockP[2], TAB_REST_C[2], drop * drop) + 16 * drop * (1 - drop) + (c.landed !== null ? 1.5 * (1 - settle) : 0)];
  const tilt = DOCK_TILT * (1 - drop) + 0.06 * drop;
  const turn = 0.5 * drop;
  // the folded tab sits where the body's west half was: it travels as one piece
  const showBody = (c.docked && !c.docked.headerOn) || drop > 0;
  return (
    <group>
      {/* the window: the cards, their stubs, the record; the bars slide with the cards */}
      <WindowCards c={c} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={g.bar} material={m.enamelShade} position={[barAt(i, c.shrink[i]), 0, 0]} />
      ))}
      {c.out !== null && (
        // rising out of the request bay's work slot, its lower part still in the slot
        <group position={[CARD_C.from[0], CARD_C.from[1], CARD_C.from[2] - D * (1 - c.out)]} rotation={[RISE_TILT, 0, 0]}>
          <mesh geometry={g.card} material={faces} />
        </group>
      )}
      {c.card && (
        // it leaves standing (as it rose) and turns flat over the first half of the arc, docking at the mouth's tilt
        <group position={c.card.pos} rotation={[DOCK_TILT + (RISE_TILT - DOCK_TILT) * (1 - Math.min(1, c.card.s / 0.5)) ** 2, -0.12 * Math.sin(Math.PI * c.card.s), 0]}>
          <mesh geometry={g.card} material={faces} />
          {c.transit > 0 && <mesh geometry={g.light} material={m.transit} position={[CARD_C.w / 2 - 10, -CARD_C.d / 2 + 22, 0.75]} />}
        </group>
      )}
      {c.docked?.headerOn && (
        <group position={dockP} rotation={[DOCK_TILT, 0, 0]}>
          <mesh geometry={g.card} material={faces} />
        </group>
      )}
      {c.header !== null && (
        // the header strip, torn off, slides up into the head (it turns along the head and goes inside it)
        <group
          position={[lerp(dockP[0], HEAD_INSIDE[0], c.header), lerp(dockP[1] + (D - hy) / 2 + hy - D / 2, HEAD_INSIDE[1], c.header), lerp(dockP[2] + 6, HEAD_INSIDE[2], c.header) + 30 * c.header * (1 - c.header)]}
          rotation={[DOCK_TILT * (1 - c.header), 0, (Math.PI / 2) * c.header]}
        >
          <mesh geometry={g.header} material={faces} />
        </group>
      )}
      {showBody && (
        <group position={bodyP} rotation={[tilt, 0, turn]}>
          {/* the body's frame: its bottom edge at y = -D/2 of the card, so the crease stays where it was */}
          <group position={[0, -D / 2, 0]}>
            <mesh geometry={g.east} material={faces} />
            {/* the west half turns over the crease onto the east: its back (the tab's face, the ID) comes up */}
            <group position={[0, 0, 0.4]} rotation={[0, Math.PI * c.fold, 0]}>
              <group position={[0, 0, -0.4]}>
                <mesh geometry={g.west} material={westFaces} />
              </group>
            </group>
          </group>
        </group>
      )}
    </group>
  );
}
