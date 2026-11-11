/**
 * The Register's reading window from the close on (STORYBOARD 6.1-6.4; state.ts EVENTS_C, desk/beat6.ts), and still (c),
 * context as a cache (film f3150):
 * - from the bar-34 dolly the window holds cards (beat6.ts WINDOW_CARDS: what the tape held after MT1, in (c)'s card
 *   style), which replace the printed tape by the close shot's 8 f print swap; the test report's tab #0408 stays filed
 *   in the spill drawer (Handshake.tsx drew it until then: the same body, the same pose);
 * - the request's bay sends a progress report up: the card rises out of its work slot and flies into the mouth under
 *   the one transit light, docking on spring-dock;
 * - the older cards in the window shrink to their stubs and pack east, the bars between them sliding with them (the
 *   reel stays still: one mechanism moves);
 * - the card's header strip, which carries the record's header and its three summary lines, tears off along its
 *   perforation (3 f anticipation), flies to the print head in an arc and feeds down through the slot in its face; the
 *   head dips as it drops and the record stamps in, its header's ink first and each summary line a frame later (three
 *   ink stages each, never an alpha fade); the stubs dim one step;
 * - the body (the rest) folds along its middle into a pointer tab whose face carries the same ID, and drops into the
 *   spill drawer, landing on spring-dock in front of the older tabs (`FiledTabs`); #0408's tab, at the front until
 *   then, stands up and files back as the drawer pulls open; the record's pointer prints once the tab has landed;
 * - 6.4: the review comment's new row comes out from under the record as the tape advances one stub, and on the rewind
 *   the request's Thread's row comes back out from under the reel's flange onto the run.
 * Every card in the window draws with its own paper material (its dim is a colour, never alpha). From the summary on
 * (f5400) the window is still (d)'s (state.ts CacheState.summary: (c)'s own cards, none of beat 6's rows).
 */
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry, CircleGeometry, Color, MeshStandardMaterial, PlaneGeometry, type Material, type Texture } from 'three';
import { E6, STUB_STEP, TAB_FILE, THREAD_ROW, WINDOW_CARDS } from '../beat6.ts';
import { slab } from '../geom.ts';
import { HEX, paper } from '../gl/materials.ts';
import { isStepped, useDeskMats, useDeskSets } from '../kit.tsx';
import { CACHE_WINDOW, CARD_C, CELLS_X, DRAWER, DRAWER_OPEN_C, FILED_TABS, MOUTH, PRINT_HEAD, TAB_C, TAPE, WINDOW, rectC, type P3 } from '../layout.ts';
import { TAB_LEAN_B, TAB_LEAN_C, TAB_REST_B, TAB_REST_C, TAB_TURN_C, type CacheState, type DeskState } from '../state.ts';
import { CardHalves } from './Handshake.tsx';

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

/** The window's cards before the shrink: beat 6's (from the close) or still (c)'s own, as still (d) draws them. */
const CARDS_X: readonly (readonly [number, number])[] = WINDOW_CARDS.map((c) => [c.x0, c.x1] as const);
const layoutOf = (summary: boolean): readonly (readonly [number, number])[] => (summary ? CELLS_X : CARDS_X);

/** A card's place in the window at its shrink k: its west edge, its width. */
export function cellAt(i: number, k: number, summary = true): { x0: number; w: number } {
  const L = layoutOf(summary);
  const w0 = L[i][1] - L[i][0];
  return { x0: lerp(L[i][0], CACHE_WINDOW.stubX0[i], k), w: lerp(w0, CACHE_WINDOW.stub, k) };
}
/** The bar on card i's east edge: it rides the edge as the card shrinks, never over its print (and stays once they are stubs). */
export function barAt(i: number, k: number, summary = true): number {
  const { x0, w } = cellAt(i, k, summary);
  return x0 + w + 0.5;
}
/**
 * 6.4: as the tape advances one stub after the review's stamp-in, each stub moves on into the next stub's place (the
 * fourth out under the frame's east member onto the run, the request's further along it), and the new row's stub comes
 * out from under the record's east edge.
 */
function advanced(i: number, x0: number, a: number): number {
  if (a <= 0) return x0;
  const next = i < 4 ? CACHE_WINDOW.stubX0[i + 1] : CACHE_WINDOW.stubX0[4] + STUB_STEP;
  return lerp(x0, next, a);
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
    // the slot in the print head's south face, a dark slit (a unit height, posed as it opens), and its two lips standing proud of the face
    const slot = new PlaneGeometry(SLOT.w, 1).rotateX(Math.PI / 2);
    const lips = [-1, 1].map((k) => slab({ x0: SLOT.x - SLOT.w / 2 - 1.5, x1: SLOT.x + SLOT.w / 2 + 1.5, y0: SLOT.y - 2.4, y1: SLOT.y + 0.4 }, k * (SLOT.h / 2 + 0.8) - 0.8, k * (SLOT.h / 2 + 0.8) + 0.8, 0.3, 0.2));
    return { card, header, north, south, bar, light, slot, lips };
  }, []);
}

/** A card's material pair: as it is, and in the stepped set (the deck steps down with the window while a beat's focus leaves it out). */
function cardMats(textures: readonly Texture[], hex: string): { full: MeshStandardMaterial; stepped: MeshStandardMaterial }[] {
  return textures.map((t) => ({ full: paper(t, hex), stepped: paper(t, hex, { stepped: true }) }));
}

/**
 * The window's cards: each a quad cropped to its width (its stub at the west end), with its own paper; the record in its
 * ink stage; beat 6's rows (the review's stub, the request's Thread's row on the run).
 */
function WindowCards({ s, c }: { s: DeskState; c: CacheState }) {
  const { textures } = useDeskSets();
  const act = !c.summary;
  const cards = act ? textures.b6.windowCards : textures.cacheCells;
  const L = layoutOf(c.summary);
  const quads = useMemo(() => cards.map(() => new PlaneGeometry(1, 1)), [cards]);
  const mats = useMemo(() => cardMats(cards, STUB_HEX.idle), [cards]);
  const inks = useMemo(() => textures.recordInk.map((t) => paper(t, HEX.paper)), [textures]);
  const stagger = useMemo(() => textures.recordStagger.map((t) => paper(t, HEX.paper)), [textures]);
  const pointer = useMemo(
    () =>
      textures.recordPointer.map((t) => {
        const m = paper(t, HEX.paper);
        m.transparent = true;
        m.depthWrite = false;
        return m;
      }),
    [textures],
  );
  const rows = useMemo(() => cardMats([textures.b6.reviewStub, textures.b6.threadRow], STUB_HEX.idle), [textures]);
  const unit = useMemo(() => new PlaneGeometry(1, 1), []);
  useLayoutEffect(
    () => () => {
      for (const q of [...quads, unit]) q.dispose();
      for (const m of [...mats.flatMap((x) => [x.full, x.stepped]), ...rows.flatMap((x) => [x.full, x.stepped]), ...inks, ...stagger, ...pointer] as Material[]) m.dispose();
    },
    [quads, mats, inks, stagger, pointer, rows, unit],
  );
  const idle = useMemo(() => new Color(STUB_HEX.idle), []);
  const dim = useMemo(() => new Color(STUB_HEX.dim), []);
  useLayoutEffect(() => {
    quads.forEach((q, i) => {
      const { w } = cellAt(i, c.shrink[i], c.summary);
      const w0 = L[i][1] - L[i][0];
      const uv = q.getAttribute('uv');
      // a plane's uv: (0,1) (1,1) (0,0) (1,0); crop from the east
      const u1 = w / w0;
      uv.setXY(1, u1, 1);
      uv.setXY(3, u1, 0);
      uv.needsUpdate = true;
    });
    // the stubs dim one step with the record's stamp-in; the review's new stub prints fresh (it stays idle)
    for (const m of mats) for (const x of [m.full, m.stepped]) (x as MeshStandardMaterial).color.copy(idle).lerp(dim, c.dim);
    for (const x of [rows[1].full, rows[1].stepped]) (x as MeshStandardMaterial).color.copy(idle).lerp(dim, c.dim);
  }, [quads, mats, rows, c.shrink, c.dim, c.summary, L, idle, dim]);
  const set = isStepped(s.step, 'deck') ? 'stepped' : 'full';
  const [r0, r1] = CACHE_WINDOW.record;
  const e6 = s.e6;
  // the record's ink: still (d)'s three stages from the summary on; in act two the header first, then each line a frame later, its pointer once its tab has landed
  const stage = c.ink <= 0 ? -1 : Math.min(2, Math.ceil(c.ink * 3 - 1e-6) - 1);
  const recordMat = act ? (c.stagger < 0 ? null : stagger[Math.min(stagger.length - 1, c.stagger)]) : stage >= 0 ? inks[stage] : null;
  const showReview = act && s.f >= E6.reviewIn;
  const showThread = act && s.f >= E6.rewind;
  const reviewX0 = CACHE_WINDOW.stubX0[0] - STUB_STEP * (1 - e6.advance);
  return (
    <group>
      {quads.map((q, i) => {
        const cell = cellAt(i, c.shrink[i], c.summary);
        const x0 = act ? advanced(i, cell.x0, e6.advance) : cell.x0;
        return <mesh key={i} geometry={q} material={mats[i][set]} position={[x0 + cell.w / 2, TAPE_Y, Z_CARD]} scale={[cell.w, TAPE_H, 1]} />;
      })}
      {recordMat && <mesh geometry={unit} material={recordMat} position={[(r0 + r1) / 2, TAPE_Y, Z_CARD + 0.05]} scale={[r1 - r0, TAPE_H, 1]} />}
      {act && c.pointer >= 0 && <mesh geometry={unit} material={pointer[c.pointer]} position={[(r0 + r1) / 2, TAPE_Y, Z_CARD + 0.08]} scale={[r1 - r0, TAPE_H, 1]} />}
      {/* 6.4: the review's new row, under the record until the tape advances it out; the request's Thread's row, out from under the reel's flange on the rewind */}
      {showReview && <mesh geometry={unit} material={rows[0][set]} position={[reviewX0 + CACHE_WINDOW.stub / 2, TAPE_Y, Z_CARD]} scale={[CACHE_WINDOW.stub, TAPE_H, 1]} />}
      {showThread && <mesh geometry={unit} material={rows[1][set]} position={[e6.threadRow + THREAD_ROW.w / 2, TAPE_Y, Z_CARD]} scale={[THREAD_ROW.w, TAPE_H, 1]} />}
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


/** The test report's tab #0408 in the drawer from the close on (objects/Handshake.tsx ReportCard drew it until then, the same body in the same pose). */
function TestTab({ c }: { c: CacheState }) {
  const m = useDeskMats();
  const { textures } = useDeskSets();
  const back = useMemo(() => paper(textures.reportTab, HEX.paperLit), [textures]);
  useLayoutEffect(() => () => back.dispose(), [back]);
  // an older pointer: its face dims one step with the window's stubs as the new record stamps in
  const lit = useMemo(() => new Color(HEX.paperLit), []);
  const dim = useMemo(() => new Color(STUB_HEX.idle), []);
  useLayoutEffect(() => {
    back.color.copy(lit).lerp(dim, c.dim);
  }, [back, lit, dim, c.dim]);
  const faces = { body: m.paperLit, front: m.printed.report, back, transit: m.transit };
  const pos: P3 = [TAB_REST_B[0], TAB_REST_B[1] - DRAWER_OPEN_C * c.drawer + TAB_FILE.dy * c.file, TAB_REST_B[2] + TAB_FILE.dz * c.file];
  return (
    <group position={pos} rotation={[TAB_LEAN_B + (TAB_FILE.lean - TAB_LEAN_B) * c.file, 0, 0]}>
      <CardHalves fold={1} light={false} faces={faces} />
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
  // the header strip: torn off, it lifts, turns to stand along the head and feeds down through the slot in its face
  const st = c.strip;
  const stripStart: P3 = [dockP[0], dockP[1] + STRIP_Y * Math.cos(DOCK_TILT), dockP[2] + STRIP_Y * Math.sin(DOCK_TILT) + 1];
  // at the slot: turned a quarter (its long side running north), flat, its north end at the slot
  const atSlot: P3 = [SLOT.x, SLOT.y - W / 2 - 1, SLOT.z];
  const stripP: P3 | null = st
    ? st.feed <= 0
      ? [lerp(stripStart[0], atSlot[0], st.fly), lerp(stripStart[1], atSlot[1], st.fly), lerp(stripStart[2], atSlot[2], st.fly) + 18 * Math.max(0, st.fly) * (1 - st.fly)]
      : [atSlot[0], atSlot[1] + (W + 4) * st.feed, atSlot[2]]
    : null;
  const stripTurn = st ? Math.min(1, Math.max(0, st.fly) * 1.1) : 0;
  // the slot opens with the close (a shutter: the slit widens to its height over the print swap's frames)
  const slotOpen = c.fade;
  return (
    <group>
      {/* the window: the cards, their stubs, the record; the bars slide with the cards */}
      <WindowCards s={s} c={c} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={g.bar} material={m.enamelShade} position={[barAt(i, c.shrink[i], c.summary), 0, 0]} />
      ))}
      {!c.summary && <TestTab c={c} />}
      {/* the slot in the print head's south face: the header strip feeds through it, the decode slip and the answer come out of it */}
      {slotOpen > 0 && <mesh geometry={g.slot} material={m.graphiteDark} position={[SLOT.x, SLOT.y, SLOT.z]} scale={[1, 1, SLOT.h * slotOpen]} />}
      {/* its lips come out of the face as the shutter opens (flush, inside the head, before) */}
      {slotOpen > 0 &&
        g.lips.map((l, i) => <mesh key={i} geometry={l} material={m.enamelShade} position={[0, 2.6 * (1 - slotOpen), SLOT.z + (i === 0 ? 1 : -1) * (1 - slotOpen) * (SLOT.h / 2 + 0.8)]} />)}
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
