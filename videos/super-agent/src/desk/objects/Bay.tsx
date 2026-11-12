/**
 * The Workers: one class of walled bay rising from the floor (C11: "each task gets its own Worker,
 * context and tools"), each with its own task-shaped superstructure (synthesis §2, element sheet).
 * The shared base is the class: the enamel nameplate band on the south wall, the door in the north
 * wall facing the deck, the dossier tray (its thickness is the Worker's context), the work slot
 * (lit while computing) and a three-tool rack. What differs is the task, and it breaks the bay's
 * outline: every bay stays under 80, clearly below the deck at 120.
 * - BugBay: a bench whose six test pins stand above its walls, the vermilion folder docked on it with
 *   the request on top (its beetle a die-cut window);
 * - TestsBay: a capped stack of three test lamps taller than its walls, concentric lenses on top;
 * - DocsBay: wide and low, type set in lines in a galley tray (ink on paper);
 * - FreshBay (MT1's dispatch): a rotary card file, a drum of cards between two enamel cheeks; it
 *   rises from its floor hatch on spring-heavy, its door lifts for the folder and drops after it.
 * A finished bay sinks 40 u into its hatch (the test tower from the rest, f2320), at 55% contrast.
 * Every rack holds the same three tools (a magnifier, a wrench, a pen): the family's shared fixture.
 */
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { textCanvas } from '@aiv/remotion-kit';
import { CanvasTexture, CircleGeometry, Color, MeshBasicMaterial, Path, SRGBColorSpace, Shape, ShapeGeometry, TorusGeometry, type BufferGeometry, type Texture } from 'three';
import { REQUEST_DOCK, REQUEST_DOCK_HEADING, RIDE, SHADE_TONE, WORK_DEPTH, liftOf, testsCapOpenAt, workLift, type BayDispatch, type Carry } from '../beat4.ts';
import { bayDoor, bayWalls } from '../footprints.ts';
import { cylinderZ, disc, dome, extrude, frame, merge, plane, planeOn, ringFlat, slab, tube } from '../geom.ts';
import { EMIT, Step, WithMats, isStepped, useDeskMats, useDeskSets, type DeskMats } from '../kit.tsx';
import { BAYS, BAY_FLOOR, BENCH, CARD, CARD_FILE, FOLDER, FRESH, GALLEY_TRAY, HATCH_DEPTH, PINS, REQUEST, SHEET, SINK, TOWER, rectC, towerTop, type BayId, type BayLayout, type Rect, type WorkerId } from '../layout.ts';
import { LIGHT_HEX } from '../pools.ts';
import { CAP_SLOT, closeAt, type DeskState } from '../state.ts';
import { Hatch, TaskCarrier, shellInside } from './Dispatch.tsx';
import { HEX, paper, whiteTexture } from '../gl/materials.ts';
import { INK, stagedInk } from '../gl/text.ts';

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

/**
 * The shared rack: every Worker has the same three tools (one family), lying in its rack, each a
 * silhouette of about 60 u (50 px): a magnifier (read), a wrench (run), a pen (write).
 */
function sharedTools(rack: Rect): Tools {
  const { rows, x0, x1 } = rackRows(rack);
  const [a, b, c] = rows;
  const magnifier = merge([ringFlat(10, 2.8, x1 - 12, a, z), rodX(x0 + 22, x1 - 23, a, 2)]);
  const jaw = (() => {
    const s = new Shape();
    s.absarc(x1 - 10, b, 10, 0, Math.PI * 2, false);
    const h = new Path();
    h.moveTo(x1 - 4, b - 4.5);
    h.lineTo(x1 + 2, b - 4.5);
    h.lineTo(x1 + 2, b + 4.5);
    h.lineTo(x1 - 4, b + 4.5);
    h.closePath();
    s.holes.push(h);
    return extrude(s, z - 2, z + 2, 0.6);
  })();
  const wrench = merge([jaw, slab({ x0: x0 + 4, x1: x1 - 16, y0: b - 3.5, y1: b + 3.5 }, z - 2, z + 2, 1.5, 0.5)]);
  const pen = (() => {
    const g = cylinderZ(3.4, 0, x1 - x0 - 16, 0, 0, 14, 0.6);
    g.rotateY(Math.PI / 2);
    g.translate(x0 + 16, c, z);
    return g;
  })();
  return { metal: merge([magnifier, wrench]), grips: merge([rodX(x0, x0 + 22, a, 3.8), pen, merge([rodX(x0, x0 + 16, c, 3.6), dome(3.6, x0, c, z)])]) };
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

/**
 * The class every Worker shares, with its task's superstructure as children; `door`: how far its door is lifted (0
 * shut). Its shell (the walls, the nameplate band, the door) stands on the slate; its work (the floor plate, the work
 * slot, the dossier, the rack and the superstructure) rises out of the hatch inside the shell when the bay is
 * dispatched (`work`: drawn at all, `workZ`: its height, below 0 while it rises). A closed, idle bay is its shell.
 */
function BayBase({ b, slot, slotMat, tools = sharedTools, door = 0, close = 0, work = true, workZ = 0, plate = 2, children }: { b: BayLayout; slot: 'slotBug' | 'slotTests' | 'slotDocs' | 'slotFresh'; slotMat?: MeshBasicMaterial; tools?: (rack: Rect) => Tools; door?: number; close?: number; work?: boolean; workZ?: number; plate?: number; children?: ReactNode }) {
  const m = useDeskMats();
  const g = useBayGeometry(b, tools);
  usePlatePrint(b.id, plate, close);
  const lift = door * (b.wallH - 2);
  return (
    <group>
      <mesh geometry={g.walls} material={m.graphite} />
      <mesh geometry={g.band} material={m.printed.nameplate[b.id]} />
      <mesh geometry={g.door} material={m.enamelShade} position={[0, 0, lift]} />
      <mesh geometry={g.doorBar} material={m.steel} position={[0, 0, lift]} />
      {work && (
        <group position={[0, 0, workZ]}>
          <mesh geometry={g.floor} material={m.floor} />
          <mesh geometry={g.slotBlock} material={m.graphiteDark} />
          <mesh geometry={g.slit} material={slotMat ?? m[slot]} />
          <mesh geometry={g.slitLip} material={m.steel} />
          <mesh geometry={g.tray} material={m.enamelShade} />
          <mesh geometry={g.stack} material={m.paper} />
          <mesh geometry={g.top} material={m.printed.dossier[b.id]} />
          {close > 0 && <mesh geometry={g.top} material={m.printed.dossierFine[b.id]} position={[0, 0, 0.06]} />}
          <mesh geometry={g.rail} material={m.graphiteDark} />
          <mesh geometry={g.metal} material={m.steel} />
          <mesh geometry={g.grips} material={m.enamel} />
          {children}
        </group>
      )}
    </group>
  );
}

/** A bay's work while it is dispatched (beat4.ts hatchRiseAt): drawn once its hatch's leaves part, at its height as it rises. */
export const workOf = (d: BayDispatch, id: BayId): { work: boolean; workZ: number } => ({ work: d.rise > 0 || d.hatch > 0, workZ: workLift(d, id) });

/**
 * The nameplate's print at its ink's stages (gl/text.ts stagedInk), made from its printed texture: its ink is what is
 * darker than the plate's white. Its coverage is taken relative to the print's own depth (a full-ink print's, as W-08's
 * '#' ID is set, unchanged): a print set as faint texture (W-07's and W-09's plain IDs: film.ts keepFilm) is only a tenth
 * as deep, and on the plain scale its cores never reached the stages' thresholds, so it printed nothing for two frames and
 * then all at once; scaled to its depth it inks over the same 3 f from its knock.
 */
function plateStages(printed: Texture): Texture[] {
  const src = printed.image as HTMLCanvasElement;
  const [W, H] = [src.width, src.height];
  const ink = textCanvas(W, H);
  ink.g.drawImage(src, 0, 0);
  const d = ink.g.getImageData(0, 0, W, H);
  const lum = (i: number) => (0.2126 * d.data[i * 4] + 0.7152 * d.data[i * 4 + 1] + 0.0722 * d.data[i * 4 + 2]) / 255;
  let depth = 0;
  for (let i = 0; i < W * H; i++) depth = Math.max(depth, 1 - lum(i));
  // (a print in full ink keeps the plain scale exactly)
  const gain = depth > FULL_INK_DEPTH / 2 ? 1.6 : (1.6 * FULL_INK_DEPTH) / Math.max(depth, 0.02);
  for (let i = 0; i < W * H; i++) {
    // ink where the print darkens the white plate (its own colour kept), clear elsewhere
    d.data[i * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, (1 - lum(i)) * gain)));
  }
  ink.g.putImageData(d, 0, 0);
  const out = [0, 1].map((stage) => {
    const { c, g } = textCanvas(W, H);
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, W, H);
    stagedInk(g, W, H, 1, stage, (ig) => ig.drawImage(ink.c, 0, 0));
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = printed.anisotropy;
    return t;
  });
  const blank = (() => {
    const { c, g } = textCanvas(4, 4);
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, 4, 4);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  })();
  // the close shot's cross-fade of the print to bare enamel (TREATMENT Type: printed fields swap by an 8 f cross-fade at
  // the start of a camera move, on those objects only): the print a step fainter each frame, as textures (never alpha)
  const fades = Array.from({ length: PLATE_FADES - 1 }, (_, i) => {
    const { c, g } = textCanvas(W, H);
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1 - (i + 1) / PLATE_FADES;
    g.drawImage(src, 0, 0);
    g.globalAlpha = 1;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = printed.anisotropy;
    return t;
  });
  return [...out, blank, ...fades];
}
/** How much a full-ink print (gl/text.ts INK) darkens the plate's white (luminance, as plateStages measures it). */
const FULL_INK_DEPTH = (() => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(INK.slice(i, i + 2), 16));
  return 1 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
})();
/** The steps of the close shot's cross-fade of a nameplate's print (its 8 f). */
const PLATE_FADES = 8;

/**
 * A beat-4 bay's nameplate as its dispatch prints it (beat4.ts bayDispatchAt `plate`): blank while the bay stands closed,
 * its ID inked over 3 f from the dispatch's cue; in the close on the reading window (state.ts closeAt) its print
 * cross-fades to bare enamel, as still (c) has it (marks.ts keepClose: the nameplates print nothing there). Every set's
 * nameplate material takes the frame's print (set every frame, so a page starting anywhere draws the same); the fresh
 * bay's plate is its own.
 */
function usePlatePrint(id: WorkerId, plate: number, close: number) {
  const sets = useDeskSets();
  const stages = useMemo(() => (id === 'fresh' ? null : plateStages(sets.textures.nameplate[id])), [id, sets]);
  useLayoutEffect(() => () => stages?.forEach((t) => t.dispose()), [stages]);
  const fade = Math.round(Math.min(1, Math.max(0, close)) * PLATE_FADES);
  useLayoutEffect(() => {
    if (!stages) return;
    const printed = fade >= PLATE_FADES ? stages[2] : fade > 0 ? stages[2 + fade] : sets.textures.nameplate[id];
    const map = plate < 0 ? stages[2] : plate < 2 ? stages[plate] : printed;
    for (const set of [sets.full, sets.stepped, sets.late, sets.own]) set.printed.nameplate[id].map = map;
  }, [stages, plate, fade, sets, id]);
}

/**
 * A beat-4 bay standing closed, as act two shows it from the turn's end until its dispatch (the turn draws it so): its
 * shell (walls, blank nameplate, shut door) round its lid lying on the slate (objects/Dispatch.tsx Hatch 'lid'); no
 * work, no light, no hole in the slate.
 */
export function ClosedBay({ id }: { id: BayId }) {
  const slot = id === 'bug' ? 'slotBug' : id === 'tests' ? 'slotTests' : 'slotDocs';
  return (
    <>
      <BayBase b={BAYS[id]} slot={slot} work={false} plate={-1} door={0} />
      <Hatch box={BAYS[id].box} open={0} depth={WORK_DEPTH[id]} look="lid" inner={shellInside(id)} />
    </>
  );
}

/** A dark work slot: nothing computes there (an idle Worker); a computing one is lit, evenly to the eye from dark (geometric). */
export const SLOT_IDLE = '#1E2120';
export function slotColour(target: Color, level: number, light: number): Color {
  const idle = new Color(SLOT_IDLE);
  if (light <= 0) return target.copy(idle);
  const lit = new Color(LIGHT_HEX.work).multiplyScalar(level);
  // geometric between dark and lit per channel, so the first frames of the spring are not most of the light
  return target.setRGB(idle.r * (lit.r / idle.r) ** light, idle.g * (lit.g / idle.g) ** light, idle.b * (lit.b / idle.b) ** light);
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
    const flag = slab({ x0: -11, x1: 11, y0: -22, y1: -2 }, 0, 1.2, 1.5, 0.3);
    const folder = slab(FOLDER.box, FOLDER.z[0], FOLDER.z[1], 3, 1);
    const folderTop = planeOn(FOLDER.box, FOLDER.z[1] + 0.2);
    const folderTab = slab({ x0: FOLDER.box.x0 + 8, x1: FOLDER.box.x0 + 50, y0: FOLDER.box.y0 - 9, y1: FOLDER.box.y0 + 2 }, FOLDER.z[0], FOLDER.z[0] + 2, 2, 0.6);
    return { top, edge, legs, pinBases, pinPosts, flag, folder, folderTop, folderTab };
  }, []);
}

/**
 * The request as it lies in its bay and as it rides its groove there (local: centred, its long axis along x, its
 * beetle die-cut at +x; z from 0.3 under its centre plane): its body, its print over the west 82 u (clear of the
 * beetle's window), and the transit light seen through the beetle while it moves (TREATMENT Emission).
 */
export function requestParts(): { body: BufferGeometry; print: BufferGeometry; light: BufferGeometry } {
  const hw = REQUEST.l / 2;
  const hh = REQUEST.w / 2;
  const s = new Shape();
  s.moveTo(-hw, -hh);
  s.lineTo(hw, -hh);
  s.lineTo(hw, hh);
  s.lineTo(-hw, hh);
  s.closePath();
  // the beetle, cut through: body, head and three legs a side (the folder shows through)
  const bx = hw - 19;
  const body = new Path();
  body.absellipse(bx, -1, 10, 8, 0, Math.PI * 2, true);
  s.holes.push(body);
  const head = new Path();
  head.absellipse(bx + 14, -1, 4, 4.5, 0, Math.PI * 2, true);
  s.holes.push(head);
  for (const side of [-1, 1])
    for (const k of [-1, 0, 1]) {
      const leg = new Path();
      leg.absellipse(bx + k * 6, -1 + side * 11.5, 1.4, 3.6, 0, Math.PI * 2, true);
      s.holes.push(leg);
    }
  const print = plane(82, REQUEST.w, -hw + 41, 0, 0.8);
  const uv = print.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (82 / REQUEST.l));
  const light = new CircleGeometry(8.4, 24);
  light.scale(1.2, 1, 1);
  light.translate(bx, -1, -0.5);
  return { body: extrude(s, -0.3, 0.6, 0), print, light };
}

/** The transit light through the request's beetle: a little over the bloom's threshold, so it reads as light through a stencil and never a blown disc. */
export const BEETLE_LIGHT = 2.2;
/** What the cut-out shows with its light out: a dark graphite, as the belt, the throat and the groove under it (its light ramps up from this, never from black). */
const BEETLE_DARK = '#3A3C3B';
/** The beetle's cut-out as light: its body, head and legs (each hole's outline, a hair larger, under the paper), the head toward `dir` along x. */
function beetleGeometry(x: number, y: number, dir: 1 | -1, z: number): BufferGeometry {
  const s = (cx: number, cy: number, rx: number, ry: number): Shape => {
    const sh = new Shape();
    sh.absellipse(cx, cy, rx + 0.5, ry + 0.5, 0, Math.PI * 2, false, 0);
    return sh;
  };
  const parts = [s(x, y, 10, 8), s(x + dir * 14, y, 4, 4.5)];
  for (const side of [-1, 1]) for (const k of [-1, 0, 1]) parts.push(s(x + k * 6, y + side * 11.5, 1.4, 3.6));
  const g = new ShapeGeometry(parts, 12);
  g.translate(0, 0, z);
  return g;
}
/**
 * The one transit light while the request moves (TREATMENT Emission): seen only through its beetle (the light is the
 * cut-out's own shape, under the paper), its level ramped by `transit` (its own material: nothing else scales it).
 */
export function BeetleLight({ x, y, dir, z, transit }: { x: number; y: number; dir: 1 | -1; z: number; transit: number }) {
  const g = useMemo(() => beetleGeometry(x, y, dir, z), [x, y, dir, z]);
  const mat = useMemo(() => new MeshBasicMaterial({ color: new Color(LIGHT_HEX.work) }), []);
  useLayoutEffect(() => () => g.dispose(), [g]);
  useLayoutEffect(() => () => mat.dispose(), [mat]);
  useLayoutEffect(() => {
    mat.color.set(BEETLE_DARK).lerp(new Color(LIGHT_HEX.work).multiplyScalar(BEETLE_LIGHT), Math.min(1, Math.max(0, transit)));
  }, [mat, transit]);
  return <mesh geometry={g} material={mat} />;
}

/** The request's materials: its own, so its chroma can step with its bay's focus ramp (shared by the carrier and the docked request). */
function useTracer() {
  const { textures } = useDeskSets();
  const tracer = useMemo(() => {
    const white = whiteTexture();
    return {
      folder: paper(white, HEX.vermilionShade, { roughness: 0.85 }),
      folderTop: paper(textures.folder, HEX.vermilionShade, { roughness: 0.85 }),
      body: paper(white, HEX.vermilion, { roughness: 0.82 }),
      print: paper(textures.request, HEX.vermilion, { roughness: 0.82 }),
      white,
    };
  }, [textures]);
  useLayoutEffect(
    () => () => {
      for (const x of [tracer.folder, tracer.folderTop, tracer.body, tracer.print]) x.dispose();
      tracer.white.dispose();
    },
    [tracer],
  );
  return tracer;
}

/**
 * The request riding its dispatch (beat4.ts requestAt): out of the housing, down the ramp, along its groove, up onto its
 * folder; the transit light through its beetle while it moves. Coming down onto its folder it darkens into the pins' shade
 * over the frames before the shade takes it (beat4.ts requestShadeAt), so the shade lands on it as a step of nothing.
 */
export function RequestCarrier({ pose }: { pose: Carry }) {
  const tracer = useTracer();
  const g = useMemo(() => requestParts(), []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  const tone = 1 - (1 - SHADE_TONE) * (pose.shade ?? 0);
  useLayoutEffect(() => {
    // (written every frame: its own materials, nothing carried from a frame before)
    tracer.body.color.set(HEX.vermilion).multiplyScalar(tone);
    tracer.print.color.set(HEX.vermilion).multiplyScalar(tone);
  }, [tracer, tone]);
  const squash = 1 - 0.03 * pose.squash;
  return (
    <group position={pose.p} rotation={[0, -pose.slope, pose.heading, 'ZYX']} scale={[1 + 0.015 * pose.squash, 1, squash]}>
      <mesh geometry={g.body} material={tracer.body} />
      <mesh geometry={g.print} material={tracer.print} />
      {pose.transit > 0 && <BeetleLight x={REQUEST.l / 2 - 19} y={-1} dir={1} z={-0.5} transit={pose.transit} />}
    </group>
  );
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

/** The request's vermilion when its bay steps down: the focus rule's chroma step, held at 60% (it stays the film's tracer, a step quieter). */
export const TRACER_STEP = 0.4;

/** A colour (sRGB hex) with its chroma cut by k toward its own grey in display values (its value kept). */
function quieter(hex: string, k: number): Color {
  return quieterColour(new Color(hex), k);
}
/** A colour (linear) with its chroma cut by k toward its own grey in display values (its value kept). */
export function quieterColour(c: Color, k: number): Color {
  const enc = (v: number) => Math.pow(Math.max(v, 0), 1 / 2.2);
  const [r, gg, b] = [enc(c.r), enc(c.g), enc(c.b)];
  const l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
  const f = (v: number) => (v + (l - v) * k) ** 2.2;
  return new Color(f(r), f(gg), f(b));
}

/**
 * The request's bay: its bench with six test pins, the folder that holds its task on the bench. Closed and idle from
 * the turn until the request is dispatched to it (beat4.ts, 4.3); its work rises from its hatch, the request rides
 * its groove in and lands on the folder, which takes its vermilion; its work slot lights. `noRequest`: without the
 * request at rest on its folder (it is still riding: beat4.ts requestAt).
 */
export function BugBay({ s, noRequest = false }: { s: DeskState; noRequest?: boolean }) {
  const g = useBenchGeometry();
  const r = useMemo(() => requestParts(), []);
  useLayoutEffect(() => () => Object.values(r).forEach((x) => x.dispose()), [r]);
  const { full } = useDeskSets();
  const tracer = useTracer();
  const d = s.b4.bays.bug;
  const st = isStepped(s.step, 'bugBay');
  const amt = st === 'late' ? s.testsStep : st === 'own' ? (s.step.own?.amount ?? 0) : st ? s.step.amount : 0;
  // the folder waits on the bench in its own stock until the request lands on it, then takes its vermilion (spring-effects)
  const take = s.b4.folderTake;
  useLayoutEffect(() => {
    const k = TRACER_STEP * amt;
    const own = new Color(HEX.paperShade);
    tracer.folder.color.copy(own.clone().lerp(quieter(HEX.vermilionShade, k), take));
    tracer.folderTop.color.copy(own.lerp(quieter(HEX.vermilionShade, k), take));
    tracer.body.color.copy(quieter(HEX.vermilion, k));
    tracer.print.color.copy(quieter(HEX.vermilion, k));
  }, [tracer, amt, take]);
  // its work slot: dark while idle, lit (blooming) once its work computes
  useLayoutEffect(() => {
    slotColour(full.slotBug.color, EMIT.slot, s.bugLight);
  }, [full, s.bugLight]);
  const atRest = !noRequest && s.f >= RIDE.dock + 12;
  const w = workOf(d, 'bug');
  return (
    <Step on={isStepped(s.step, 'bugBay')}>
      <WithMats>
        {(m) => (
          <BayBase b={BAYS.bug} slot="slotBug" slotMat={full.slotBug} close={closeAt(s.f)} door={d.door} work={w.work} workZ={w.workZ} plate={d.plate}>
            <mesh geometry={g.legs} material={m.graphiteDark} />
            <mesh geometry={g.top} material={m.graphite} />
            <mesh geometry={g.edge} material={m.enamelShade} />
            <mesh geometry={g.pinBases} material={m.graphiteDark} />
            <mesh geometry={g.pinPosts} material={m.steel} />
            {s.pins.map((p, i) => (
              <PinFlag key={i} i={i} state={p} geometry={g.flag} />
            ))}
            {/* the request's folder; the request keeps its vermilion when the bay steps down (it is the film's tracer), a step quieter */}
            <mesh geometry={g.folder} material={tracer.folder} />
            <mesh geometry={g.folderTop} material={tracer.folderTop} />
            <mesh geometry={g.folderTab} material={tracer.folder} />
            {atRest && (
              <group position={REQUEST_DOCK} rotation={[0, 0, REQUEST_DOCK_HEADING]}>
                <mesh geometry={r.body} material={tracer.body} />
                <mesh geometry={r.print} material={tracer.print} />
              </group>
            )}
          </BayBase>
        )}
      </WithMats>
    </Step>
  );
}

// ------------------------------------------------------------------------------------------------

/** A flat ring (a torus of radius r about z, at height z) cut where it crosses the band |y - dy| < half (two arcs). */
function cutRing(r: number, tube: number, dy: number, half: number, z: number): BufferGeometry[] {
  const a = Math.asin(Math.max(-1, Math.min(1, dy / r)));
  const d = Math.asin(Math.min(1, half / r)) / Math.max(0.2, Math.cos(a));
  // the crossings at angle a (east) and pi - a (west); the arcs between them, each short of the band
  const arcs: [number, number][] = [
    [a + d, Math.PI - a - d],
    [Math.PI - a + d, 2 * Math.PI + a - d],
  ];
  return arcs.map(([s, e]) => {
    const g = new TorusGeometry(r, tube, 10, Math.max(8, Math.round((48 * (e - s)) / (2 * Math.PI))), e - s);
    g.rotateZ(s);
    g.translate(0, 0, z);
    return g;
  });
}

/** Where each test lamp sits round the tower (radians from +x), bottom up: south-west, south, south-east. */
const LAMP_AZ = [(-125 * Math.PI) / 180, (-90 * Math.PI) / 180, (-55 * Math.PI) / 180] as const;

function useTowerGeometry() {
  return useMemo(() => {
    const T = TOWER;
    const z0 = T.base + T.post;
    const drums: BufferGeometry[] = [];
    const bands: BufferGeometry[] = [];
    const lenses: BufferGeometry[] = [];
    for (let i = 0; i < T.n; i++) {
      const a = z0 + i * (T.seg + T.gap);
      drums.push(cylinderZ(T.r, a, a + T.seg, T.x, T.y, 64));
      bands.push(cylinderZ(T.r + 1.5, a + T.seg - 4, a + T.seg, T.x, T.y, 64));
      // each lamp's lens on its drum's south flank (south-west, south, south-east up the tower), tilted up to the camera
      const az = LAMP_AZ[i];
      const lens = dome(11, 0, 0, 0);
      lens.rotateX(-Math.PI / 4);
      lens.rotateZ(az + Math.PI / 2);
      lens.translate(T.x + (T.r - 4) * Math.cos(az), T.y + (T.r - 4) * Math.sin(az), a + T.seg / 2 + 2);
      lenses.push(lens);
      // the collar between two lamps (nearly their width, so nothing inside the tower shows between them)
      if (i > 0) drums.push(cylinderZ(T.r - 2, a - T.gap, a, T.x, T.y, 48));
    }
    const bezels = merge(
      Array.from({ length: T.n }, (_, i) => {
        const a = z0 + i * (T.seg + T.gap);
        const az = LAMP_AZ[i];
        const g = ringFlat(12.5, 2.4, 0, 0, 0);
        g.rotateX(-Math.PI / 4);
        g.rotateZ(az + Math.PI / 2);
        g.translate(T.x + (T.r - 3.4) * Math.cos(az), T.y + (T.r - 3.4) * Math.sin(az), a + T.seg / 2 + 2);
        return g;
      }),
    );
    const top = towerTop();
    // the cap: a lid hinged along the tower's north edge (posed per frame), its concentric rings, the slot across its south half
    const capLid = disc(T.r + 2, 0, T.dome, { cx: 0, cy: -(T.r + 2), bevel: 1.5 });
    const slotY = CAP_SLOT[1] - (T.y + T.r + 2);
    // the concentric rings stop at the slot's edges (the slot is cut through them), so the card rises out of the slot
    // clear of them, never through a ring (the MT1 critic: the card looked translucent over the cap)
    const capRings = merge([cutRing(T.r - 6, 1.6, slotY + T.r + 2, 2.2 + 1.6, T.dome + 0.2), cutRing(T.r - 26, 1.4, slotY + T.r + 2, 2.2 + 1.4, T.dome + 0.3)].flat().map((g) => {
      g.translate(0, -(T.r + 2), 0);
      return g;
    }));
    const capSlot = slab({ x0: -CARD.w / 2 - 2, x1: CARD.w / 2 + 2, y0: slotY - 2.2, y1: slotY + 2.2 }, T.dome - 0.2, T.dome + 0.35, 0.4, 0.2);
    const hinge = (() => {
      const g = cylinderZ(3, 0, 2 * T.r - 20, 0, 0, 12);
      g.rotateY(Math.PI / 2);
      g.translate(-T.r + 10, 0, 1);
      return g;
    })();
    // the tower's top under the lid: the top lamp's face, dark, with the slot's throat
    const topFace = disc(T.r - 3, top - 0.6, top + 0.2, { cx: T.x, cy: T.y, bevel: 0.4 });
    const base = disc(T.r + 6, T.base, T.base + T.post, { cx: T.x, cy: T.y, bevel: 1 });
    return { drums: merge(drums), bands: merge(bands), lenses, bezels, capLid, capRings, capSlot, hinge, topFace, base, top };
  }, []);
}

export function TestsBay({ s }: { s: DeskState }) {
  const parts = (
    <Step on={s.testsStep > 0 ? 'late' : isStepped(s.step, 'testsBay')}>
      <TestsParts s={s} />
    </Step>
  );
  // finished, it sinks into its hatch (the desk opens round it: objects/Dispatch.tsx DeskUniforms)
  return s.testsSink > 0 ? <group position={[0, 0, -SINK * s.testsSink]}>{parts}</group> : parts;
}

/** The cap's swing when open (radians about its hinge): standing a little past upright, behind the tower. */
const CAP_OPEN = 1.78;
/** A test lamp's lens: lit while its test runs, out (graphite) once it has finished. */
const LENS_HEX = { lit: '#E4DFD3', out: '#4F5351' } as const;

/** The test tower's bay: its lamps go out one by one, its cap swings shut; once it has reported, it steps down on its own ramp (state.ts testsStep). */
function TestsParts({ s }: { s: DeskState }) {
  const m = useDeskMats();
  const g = useTowerGeometry();
  const lensMats = useMemo(() => {
    const white = whiteTexture();
    return [0, 1, 2].map(() => paper(white, LENS_HEX.lit, { roughness: 0.35, fibre: 0, stepped: 'late' }));
  }, []);
  useLayoutEffect(
    () => () => {
      for (const x of lensMats) {
        x.map?.dispose();
        x.dispose();
      }
    },
    [lensMats],
  );
  const lit = useMemo(() => new Color(LENS_HEX.lit), []);
  const out = useMemo(() => new Color(LENS_HEX.out), []);
  const on = s.b4.bays.tests.light;
  useLayoutEffect(() => {
    // dark while idle; lit once its tests run (beat 4); its work light dims as the run finishes (MT1)
    slotColour(m.slotTests.color, 0.25 + (EMIT.slotDocs - 0.25) * (on > 1e-6 ? s.testsLight / on : 1), on);
    lensMats.forEach((x, i) => x.color.copy(out).lerp(lit, s.lamps[i]));
  }, [m, s.testsLight, on, s.lamps, lensMats, lit, out]);
  const T = TOWER;
  // (it rises shut with the tower and swings open as its task lands on the dossier, before its lamps light: beat4.ts)
  const angle = CAP_OPEN * testsCapOpenAt(s.f) * (1 - s.testsCap);
  const w = workOf(s.b4.bays.tests, 'tests');
  const docked = s.b4.carriers.find((c) => c.id === 'tests' && c.docked);
  return (
    <BayBase b={BAYS.tests} slot="slotTests" close={closeAt(s.f)} door={s.b4.bays.tests.door} work={w.work} workZ={w.workZ} plate={s.b4.bays.tests.plate}>
      <mesh geometry={g.base} material={m.graphiteDark} />
      <mesh geometry={g.drums} material={m.graphite} />
      <mesh geometry={g.bands} material={m.enamelShade} />
      {g.lenses.map((l, i) => (
        <mesh key={i} geometry={l} material={lensMats[i]} />
      ))}
      <mesh geometry={g.bezels} material={m.steel} />
      <mesh geometry={g.topFace} material={m.graphiteDark} />
      {/* the cap on its hinge along the north edge: swung up behind the tower while the tests run, shut on the downbeat */}
      <group position={[T.x, T.y + T.r + 2, g.top]} rotation={[-angle, 0, 0]}>
        <mesh geometry={g.capLid} material={m.enamel} />
        <mesh geometry={g.capRings} material={m.steel} />
        <mesh geometry={g.capSlot} material={m.hollow} />
        <mesh geometry={g.hinge} material={m.steel} />
      </group>
      {/* its task: the CI card that asked for the run, on its dossier once it has docked (objects/Dispatch.tsx draws it riding) */}
      {docked && <TaskCarrier c={docked} />}
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

function DocsParts({ m, close }: { m: DeskMats; close: number }) {
  const g = useGalleyGeometry();
  return (
    <>
      <mesh geometry={g.tray} material={m.graphiteDark} />
      <mesh geometry={g.rails} material={m.enamelShade} />
      <mesh geometry={g.type} material={m.printed.galley} />
      {close > 0 && <mesh geometry={g.type} material={m.printed.galleyFine} position={[0, 0, 0.06]} />}
      <mesh geometry={g.stick} material={m.steel} />
    </>
  );
}

export function DocsBay({ s }: { s: DeskState }) {
  const w = workOf(s.b4.bays.docs, 'docs');
  const docked = s.b4.carriers.find((c) => c.id === 'docs' && c.docked);
  // in 5.2 W-09 takes its ask into its work slot (beat5.ts docsTakeAt): it never lies on the galley in still (c) or (d)
  const taken = s.e5.docs;
  return (
    <Step on={isStepped(s.step, 'docsBay')}>
      <WithMats>
        {(m) => (
          <BayBase b={BAYS.docs} slot="slotDocs" close={closeAt(s.f)} door={s.b4.bays.docs.door} work={w.work} workZ={w.workZ} plate={s.b4.bays.docs.plate}>
            <DocsParts m={m} close={closeAt(s.f)} />
            {docked && taken !== 'gone' && <TaskCarrier c={taken ? { ...docked, pose: { ...docked.pose, ...taken, squash: 0 } } : docked} />}
          </BayBase>
        )}
      </WithMats>
    </Step>
  );
}


// ------------------------------------------------------------------------------------------------

function useCardFileGeometry() {
  return useMemo(() => {
    const F = CARD_FILE;
    const along = (g: BufferGeometry) => {
      // built along z, laid along x at the axle
      g.rotateY(Math.PI / 2);
      g.translate(0, F.y, F.z);
      return g;
    };
    const cheeks = merge(
      [F.x0 - F.cheek, F.x1].map((x) => {
        const g = disc(F.cheekR, 0, F.cheek, { bevel: 1.2 });
        along(g);
        g.translate(x, 0, 0);
        return g;
      }),
    );
    // each cheek stands on a foot
    const feet = merge([F.x0 - F.cheek - 4, F.x1 - 4].map((x) => slab({ x0: x, x1: x + F.cheek + 8, y0: F.y - 26, y1: F.y + 26 }, BAY_FLOOR, BAY_FLOOR + 6, 2, 1)));
    const axle = (() => {
      const g = cylinderZ(4, 0, F.x1 - F.x0 + 2 * F.cheek + 8, 0, 0, 16);
      along(g);
      g.translate(F.x0 - F.cheek - 4, 0, 0);
      return g;
    })();
    const core = (() => {
      const g = cylinderZ(F.core, 0, F.x1 - F.x0, 0, 0, 24);
      along(g);
      g.translate(F.x0, 0, 0);
      return g;
    })();
    // the cards: thin radial leaves round the core, their outer edges a little ragged (seeded by index)
    const cards = merge(
      Array.from({ length: F.cards }, (_, i) => {
        const a = (i / F.cards) * Math.PI * 2;
        const r1 = F.r - ((i * 7) % 5) * 0.8;
        const g = slab({ x0: F.x0 + 3, x1: F.x1 - 3, y0: -0.7, y1: 0.7 }, F.core - 1, r1, 0.3, 0.2);
        // the slab stands in z from the axle: turn it round the axle (x) by a
        g.rotateX(a);
        g.translate(0, F.y, F.z);
        return g;
      }),
    );
    const crank = merge([
      tube(
        [
          [F.x1 + F.cheek + 4, F.y, F.z],
          [F.x1 + F.cheek + 9, F.y, F.z],
          [F.x1 + F.cheek + 9, F.y - 18, F.z + 8],
        ],
        2.4,
        12,
        8,
      ),
      dome(4, F.x1 + F.cheek + 9, F.y - 18, F.z + 8),
    ]);
    return { cheeks, feet, axle, core, cards, crank };
  }, []);
}

/** The fresh bay's own fixture: the card file (ask, look up). `drum` (beat 9, desk/beat9.ts drumAt): the drum and its crank turned about the axle (radians), as it steps out and back while stuck. */
function FreshParts({ m, drum = 0 }: { m: DeskMats; drum?: number }) {
  const g = useCardFileGeometry();
  const turning = (
    <>
      <mesh geometry={g.core} material={m.graphiteDark} />
      <mesh geometry={g.cards} material={m.paper} />
      <mesh geometry={g.crank} material={m.steel} />
    </>
  );
  return (
    <>
      <mesh geometry={g.feet} material={m.graphiteDark} />
      <mesh geometry={g.cheeks} material={m.enamel} />
      <mesh geometry={g.axle} material={m.steel} />
      {drum === 0 ? (
        turning
      ) : (
        <group position={[0, CARD_FILE.y, CARD_FILE.z]} rotation={[drum, 0, 0]}>
          <group position={[0, -CARD_FILE.y, -CARD_FILE.z]}>{turning}</group>
        </group>
      )}
    </>
  );
}

/**
 * The fresh bay of MT1's dispatch: under its hatch until the index turns to it, then it rises on
 * spring-heavy; its door lifts for the folder and drops after it; its work light ignites.
 */
export function FreshBay({ s }: { s: DeskState }) {
  const n = s.next;
  const sets = useDeskSets();
  useLayoutEffect(() => {
    // dark until the folder is in, then it ignites (spring-effects): a live process, it blooms (stepped down too: the same level)
    // its level ramps evenly to the eye (geometric between dark and computing), so the first frame of the spring is not most of the light
    // (the own set too: beat 9's hand-over carries the bay there over 4766-4779, and its light must not dip as it does)
    for (const set of [sets.full, sets.stepped, sets.own]) set.slotFresh.color.set(LIGHT_HEX.work).multiplyScalar(0.12 * (EMIT.slot / 0.12) ** n.light);
  }, [sets, n.light]);
  // in its pit under the shut hatch until the leaves part (beat4.ts hatchRiseAt): it rises only once they are open
  if (!n.hole && n.rise <= 0) return null;
  // stepped down with the other bays at the summary (desk/summary.ts)
  return (
    <Step on={isStepped(s.step, 'freshBay')}>
      <group position={[0, 0, liftOf(n.rise, HATCH_DEPTH)]}>
        <BayBase b={FRESH} slot="slotFresh" door={n.door}>
          <WithMats>{(mm) => <FreshParts m={mm} drum={s.e9?.drum ?? 0} />}</WithMats>
        </BayBase>
      </group>
    </Step>
  );
}
