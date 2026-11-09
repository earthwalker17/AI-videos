/**
 * Still (c), context as a cache (film f3150; STORYBOARD 6.3, state.ts EVENTS_C), at the close on the
 * Register's reading window:
 * - the request's bay sends a progress report up: the card rises out of its work slot and flies into
 *   the mouth under the one transit light, docking on spring-dock;
 * - the older cards in the window shrink to their stubs and pack east, the bars between them sliding
 *   with them (the reel stays still: one mechanism moves);
 * - the card's header strip, which carries the record's header and its three summary lines, tears off
 *   along its perforation, flies to the print head and feeds down through the slot in its cap; the
 *   head drops and the record stamps in with a 3 f ink spread (three ink stages, never an alpha fade),
 *   the record the hooded lamp lights; the stubs dim one step;
 * - the body (the rest) folds along its middle into a pointer tab whose face carries the same ID, and
 *   drops into the spill drawer, landing on spring-dock in front of the older tabs filed there
 *   (`FiledTabs`, each with the mark of what it points to). The Router keeps a stub and a pointer,
 *   never the whole Ticket.
 * Every card in the window draws with its own paper material (its dim is a colour, never alpha).
 */
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry, CircleGeometry, Color, MeshStandardMaterial, PlaneGeometry, type Material, type Texture } from 'three';
import { slab } from '../geom.ts';
import { HEX, paper } from '../gl/materials.ts';
import { useDeskMats, useDeskSets } from '../kit.tsx';
import { CACHE_WINDOW, CARD_C, CELLS_X, DRAWER, FILED_TABS, MOUTH, PRINT_HEAD, TAB_C, TAPE, WINDOW, rectC, type P3 } from '../layout.ts';
import { TAB_LEAN_C, TAB_REST_C, TAB_TURN_C, type CacheState, type DeskState } from '../state.ts';

const Z_CARD = TAPE.z + 0.35;
const TAPE_Y = (TAPE.y0 + TAPE.y1) / 2;
const TAPE_H = TAPE.y1 - TAPE.y0;
/** The stubs' paper: idle, and one step dimmer once the record is in (about 22 codes of luma). */
const STUB_HEX = { idle: HEX.paper, dim: '#8E897F' } as const;
/**
 * The feed slot in the print head's south face: the header strip, turned so its long side runs north,
 * slides in flat through it (the head is deeper than the strip is wide, and wider than it is deep).
 */
const HEAD_C = rectC(PRINT_HEAD.box);
const SLOT = { x: HEAD_C[0], y: PRINT_HEAD.box.y0 - 0.2, z: 150, w: CARD_C.d * CARD_C.header + 4, h: 3.4 } as const;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** The card stands as it rises out of the slot, and lies at the mouth's tilt once docked. */
const RISE_TILT = Math.PI / 2 - 0.2;
const DOCK_TILT = 0.28;
/** It docks lying across the hopper's rim: the close shot sees all of it. */
const DOCK_Z = MOUTH.z[1] + 3;

const W = CARD_C.w;
const D = CARD_C.d;
/** The header strip's depth (the card's top half) and the body's (the rest). */
const HH = D * CARD_C.header;
const HY = D - HH;
/** In the card's frame: the strip's centre, and the crease the body folds along (the body's middle). */
const STRIP_Y = D / 2 - HH / 2;
const CREASE_Y = -D / 2 + HY / 2;

/** How far the folding paper bows (radians the inner strip lags and the outer leads mid-fold). */
const BOW = 0.42;

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

/** A face material for a cut-out paper texture (a dog-eared tab): its clear corner is cut, never blended. */
function tabPaper(t: Texture, hex: string): MeshStandardMaterial {
  const m = paper(t, hex);
  m.alphaTest = 0.5;
  return m;
}

function useCacheGeometry() {
  return useMemo(() => {
    // the whole card (flying, docked before its header tears off)
    const card = faceUV(new BoxGeometry(W, D, 1.4), (x, y) => [(x + W / 2) / W, (y + D / 2) / D]);
    // the header strip (the card's top half), centred on its own origin
    const header = faceUV(new BoxGeometry(W, HH, 1.2), (x, y) => [(x + W / 2) / W, (y + HH / 2 + HY) / D]);
    // the body's halves about the crease (the crease frame: y = 0 on the crease). The south half turns up over
    // the north one, so its back (the tab's face, the ID upright once folded) comes up
    const north = faceUV(new BoxGeometry(W, HY / 2, 0.8).translate(0, HY / 4, 0), (x, y) => [(x + W / 2) / W, (y + HY / 2) / D]);
    // the south half as two strips, so the fold bends the paper (the outer strip leads, the inner lags) rather than
    // flipping it as a board: the inner strip next to the crease, the outer one hinged at the inner's far edge
    const strip = (off: number) =>
      faceUV(
        new BoxGeometry(W, HY / 4, 0.8).translate(0, -HY / 8, 0),
        (x, y) => [(x + W / 2) / W, (y + off + HY / 2) / D],
        (x, y) => [(x + W / 2) / W, -(y + off) / (HY / 2)],
      );
    const south = { inner: strip(0), outer: strip(-HY / 4) };
    // one card in the window, a unit quad posed per frame; a window bar
    const bar = slab({ x0: 0, x1: CACHE_WINDOW.bar, y0: WINDOW.frame.y0 + WINDOW.bar - 1, y1: WINDOW.frame.y1 - WINDOW.bar + 1 }, TAPE.z, WINDOW.z[1] - 2, 1, 0.5);
    const light = new CircleGeometry(4.6, 24);
    // the slot in the print head's cap, and its two lips
    // the slot: a dark slit on the head's south face, its two lips standing proud of the face
    const slot = new PlaneGeometry(SLOT.w, SLOT.h).rotateX(Math.PI / 2).translate(SLOT.x, SLOT.y, SLOT.z);
    const lips = [-1, 1].map((k) => slab({ x0: SLOT.x - SLOT.w / 2 - 1.5, x1: SLOT.x + SLOT.w / 2 + 1.5, y0: SLOT.y - 2.4, y1: SLOT.y + 0.4 }, SLOT.z + k * (SLOT.h / 2 + 0.8) - 0.8, SLOT.z + k * (SLOT.h / 2 + 0.8) + 0.8, 0.3, 0.2));
    return { card, header, north, south, bar, light, slot, lips };
  }, []);
}

/** The window's cards: each a quad cropped to its width (its stub at the west end), with its own paper; the record in its ink stage. */
function WindowCards({ c }: { c: CacheState }) {
  const { textures } = useDeskSets();
  const quads = useMemo(() => textures.cacheCells.map(() => new PlaneGeometry(1, 1)), [textures]);
  const mats = useMemo(() => textures.cacheCells.map((t) => paper(t, STUB_HEX.idle)), [textures]);
  const inks = useMemo(() => textures.recordInk.map((t) => paper(t, HEX.paper)), [textures]);
  const recordQuad = useMemo(() => new PlaneGeometry(1, 1), []);
  useLayoutEffect(
    () => () => {
      for (const q of [...quads, recordQuad]) q.dispose();
      for (const m of [...mats, ...inks] as Material[]) m.dispose();
    },
    [quads, mats, inks, recordQuad],
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
  }, [quads, mats, c.shrink, c.dim, idle, dim]);
  const [r0, r1] = CACHE_WINDOW.record;
  // the ink's stage: one per frame over the 3 f spread
  const stage = c.ink <= 0 ? -1 : Math.min(2, Math.ceil(c.ink * 3 - 1e-6) - 1);
  return (
    <group>
      {quads.map((q, i) => {
        const { x0, w } = cellAt(i, c.shrink[i]);
        return <mesh key={i} geometry={q} material={mats[i]} position={[x0 + w / 2, TAPE_Y, Z_CARD]} scale={[w, TAPE_H, 1]} />;
      })}
      {stage >= 0 && <mesh geometry={recordQuad} material={inks[stage]} position={[(r0 + r1) / 2, TAPE_Y, Z_CARD + 0.05]} scale={[r1 - r0, TAPE_H, 1]} />}
    </group>
  );
}

/** A folded pointer tab's body: two paper layers, the crease along its south edge (y = 0), its face on top. */
function useTabBox(w: number) {
  return useMemo(() => faceUV(new BoxGeometry(w, TAB_C.d, 1.6).translate(0, TAB_C.d / 2, 0.8), (x, y) => [(x + w / 2) / w, y / TAB_C.d]), [w]);
}

/** One filed tab, standing on its crease and leaning back at its own angle. */
function FiledTab({ i, face, edge }: { i: number; face: Material; edge: Material }) {
  const t = FILED_TABS[i];
  const g = useTabBox(t.w);
  const [cx] = rectC(DRAWER.box);
  return (
    <group position={[cx + t.dx, t.y, DRAWER.z[0] + 3]} rotation={[t.lean, 0, t.turn, 'ZXY']}>
      <mesh geometry={g} material={[edge, edge, edge, edge, face, edge]} />
    </group>
  );
}

/** The older pointer tabs filed in the spill drawer (layout.ts FILED_TABS): one family with the request's tab, each with the mark of what it points to. */
export function FiledTabs() {
  const m = useDeskMats();
  const { textures } = useDeskSets();
  const faces = useMemo(() => textures.filedTabs.map((t) => tabPaper(t, HEX.paper)), [textures]);
  useLayoutEffect(
    () => () => {
      for (const f of faces) f.dispose();
    },
    [faces],
  );
  return (
    <group>
      {FILED_TABS.map((_, i) => (
        <FiledTab key={i} i={i} face={faces[i]} edge={m.paperShade} />
      ))}
    </group>
  );
}

/** The crease frame's world pose while the body is docked at the mouth (the card tilted, the crease on its body's middle). */
function creaseDocked(dockP: P3): P3 {
  return [dockP[0], dockP[1] + CREASE_Y * Math.cos(DOCK_TILT), dockP[2] + CREASE_Y * Math.sin(DOCK_TILT)];
}

export function Cache({ s }: { s: DeskState }) {
  const c = s.cache;
  const m = useDeskMats();
  const { textures } = useDeskSets();
  const g = useCacheGeometry();
  const tabFace = useMemo(() => tabPaper(textures.cardCBack, HEX.paperLit), [textures]);
  useLayoutEffect(() => () => tabFace.dispose(), [tabFace]);
  if (!c) return null;
  const edge = m.paperLit;
  const faces = [edge, edge, edge, edge, m.printed.cardC, edge];
  const southFaces = [edge, edge, edge, edge, m.printed.cardC, tabFace];
  // the docked pose: in the mouth, tilted, settling on spring-dock
  const dockP: P3 = [MOUTH.land[0], MOUTH.land[1], DOCK_Z + (1 - (c.docked?.settle ?? 1)) * 6];
  const crease0 = creaseDocked(dockP);
  // the body (and the folded tab): from the dock to its rest in the drawer, an arc that clears the mouth's rim,
  // then on spring-dock into place (it overshoots a little and settles) with a 3% squash at contact
  const d = Math.max(0, c.drop);
  // its launch's anticipation (a negative drop: state.ts cacheAt): it lifts a little and draws back before it goes
  const ant = c.drop < 0 ? -c.drop / 0.04 : 0;
  const settle = c.landed ?? 0;
  const sink = c.landed !== null ? 2.2 * (1 - settle) : 0;
  // it slides across (eased in and out), then drops in (accelerating) once clear of the drawer's wall
  const across = d;
  const down = Math.max(0, (d - 0.7) / 0.3) ** 2;
  const bodyP: P3 = d <= 0 ? [crease0[0], crease0[1] + 1.6 * ant, crease0[2] + 2.6 * ant] : [lerp(crease0[0], TAB_REST_C[0], across), lerp(crease0[1], TAB_REST_C[1], across), lerp(crease0[2], TAB_REST_C[2], down) + 6 * Math.sin(Math.PI * Math.min(1, d / 0.7)) + sink];
  const lean = d <= 0 ? DOCK_TILT + 0.08 * ant : lerp(DOCK_TILT, TAB_LEAN_C, d) + (c.landed !== null ? 0.05 * (1 - settle) : 0);
  const turn = TAB_TURN_C * d;
  const sq = 0.03 * c.squash;
  const showBody = (c.docked && !c.docked.headerOn) || d > 0;
  // the header strip: torn off, it lifts, turns to stand along the head and feeds down through the slot in its cap
  const st = c.strip;
  const stripStart: P3 = [dockP[0], dockP[1] + STRIP_Y * Math.cos(DOCK_TILT), dockP[2] + STRIP_Y * Math.sin(DOCK_TILT) + 1];
  // at the slot: turned a quarter (its long side running north), flat, its north end at the slot
  const atSlot: P3 = [SLOT.x, SLOT.y - W / 2 - 1, SLOT.z];
  const stripP: P3 | null = st
    ? st.feed <= 0
      ? [lerp(stripStart[0], atSlot[0], st.fly), lerp(stripStart[1], atSlot[1], st.fly), lerp(stripStart[2], atSlot[2], st.fly) + 18 * st.fly * (1 - st.fly)]
      : [atSlot[0], atSlot[1] + (W + 4) * st.feed, atSlot[2]]
    : null;
  const stripTurn = st ? Math.min(1, st.fly * 1.1) : 0;
  return (
    <group>
      {/* the window: the cards, their stubs, the record; the bars slide with the cards */}
      <WindowCards c={c} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={g.bar} material={m.enamelShade} position={[barAt(i, c.shrink[i]), 0, 0]} />
      ))}
      {/* the slot in the print head's cap that the header strip feeds through */}
      <mesh geometry={g.slot} material={m.graphiteDark} />
      {g.lips.map((l, i) => (
        <mesh key={i} geometry={l} material={m.enamelShade} />
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
          {c.transit > 0 && <mesh geometry={g.light} material={m.transit} position={[W / 2 - 10, -D / 2 + 22, 0.75]} />}
        </group>
      )}
      {c.docked?.headerOn && (
        <group position={dockP} rotation={[DOCK_TILT, 0, 0]}>
          <mesh geometry={g.card} material={faces} />
        </group>
      )}
      {stripP && (
        <group position={stripP} rotation={[DOCK_TILT * (1 - stripTurn), 0, (Math.PI / 2) * stripTurn, 'ZXY']}>
          <mesh geometry={g.header} material={faces} />
        </group>
      )}
      {showBody && (
        <group position={bodyP} rotation={[lean, 0, turn, 'ZXY']} scale={[1 + sq, 1 - sq, 1]}>
          <mesh geometry={g.north} material={faces} />
          {/* the south half turns up over the crease onto the north half, bending as it goes: its back (the tab's face, the ID) comes up */}
          <group position={[0, 0, 0.4]} rotation={[-(Math.PI * c.fold - BOW * Math.sin(Math.PI * c.fold)), 0, 0]}>
            <group position={[0, 0, -0.4]}>
              <mesh geometry={g.south.inner} material={southFaces} />
              <group position={[0, -HY / 4, 0.4]} rotation={[-2 * BOW * Math.sin(Math.PI * c.fold), 0, 0]}>
                <group position={[0, 0, -0.4]}>
                  <mesh geometry={g.south.outer} material={southFaces} />
                </group>
              </group>
            </group>
          </group>
        </group>
      )}
    </group>
  );
}
