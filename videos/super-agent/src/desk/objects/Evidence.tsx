/**
 * Beat 8's test sheet (STORYBOARD 8.1-8.5; desk/beat8.ts, gl/print8.ts): the film's one chart, made as a printed sheet of
 * lit paper lying on the desk east of the bays, with its furniture: the steel rail along its head and the print carriage
 * riding it (it prints the load line), the clamp bar along its west margin that the lanes' paper strips slide out from
 * under (the die parked on it, which punches the told-to-delegate strip's notches), the token chart's clamp that the
 * stacks' sheets are fed out of. Everything rides the sheet's slide in (bar 50) and away (bar 58).
 *
 * Its print lies on it as decals of its own ink (transparent, never depth-writing: the strips and the stacks lie over
 * them), each inking in over its 3 f stages; the hero stamps' ink is their material's colour, so the one being read is
 * dark and the ones before it step to the light print. The strips and the band are paper cropped to what is out (their
 * holes and notches cut out: alpha-tested, never blended), so nothing appears from nowhere; a notch is cut on its contact
 * frame under the die's face and its chad slides out from under it as it lifts. Materials are the kit's (the sheet's
 * lit paper, graphite, steel) or the kit's paper program with the sheet's own maps, so the beat adds no new program.
 * The sheet is the beat's action: it never steps down.
 */
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { Color, PlaneGeometry, Shape, ShapeGeometry, type BufferGeometry, type MeshStandardMaterial, type Texture } from 'three';
import { BAND, BRACKET, CARRIAGE, CLAMP, DIE, LANES8, ORIGIN_U, RAIL, SECTION_RULE, SHEET8, SHEET_H, SHEET_W, STACK_DZ, STACKS8, STAMPS8, STRIP_W, TOKENS, Z8, onSheet, sheetRect, stackSheetReach, stripLength, type Beat8State } from '../beat8.ts';
import { dome, merge, plane, slab, tube } from '../geom.ts';
import { HEX, paper, whiteTexture } from '../gl/materials.ts';
import { BAND_SIZE, CAVEAT_BOX, CHAD_SIZE, HEAD_BOX, INK_LIGHT, LEGEND_BOX, NAME_BOX, RINGS_BOX, SHEET_SIZE, TICKS_BOX, TRACKS_BOX, beat8Textures, stampBox, type Beat8Textures, type Box8 } from '../gl/print8.ts';
import { INK } from '../gl/text.ts';
import { useDeskMats } from '../kit.tsx';

/** The registration marks at the form's corners: inset from the paper's edge. */
const MARK_IN = 12;
/** The bracket's stroke (u): 3 px on screen at the sheet's framing. */
const BRACKET_W = 4.6;

/** A decal's plane over its sheet box at the sheet's rest, lying at z. */
const decalPlane = (b: Box8, z: number): BufferGeometry => {
  const r = sheetRect(b.u0, b.u1, b.v0, b.v1);
  return plane(r.x1 - r.x0, r.y1 - r.y0, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, z);
};

/** The kit's paper program with one of the sheet's maps: a transparent ink decal (never writing depth), or an alpha-tested piece of paper. */
function inkMat(map: Texture): MeshStandardMaterial {
  const m = paper(map, HEX.paperLit);
  m.transparent = true;
  m.depthWrite = false;
  return m;
}
function pieceMat(map: Texture): MeshStandardMaterial {
  const m = paper(map, HEX.paperLit);
  m.alphaTest = 0.5;
  return m;
}
/** An ink colour as the decals carry it (the lit paper's colour times the ink's, both linear), for a white-glyph map. */
const inkColour = (hex: string): Color => new Color(HEX.paperLit).multiply(new Color(hex));

interface Assets {
  t: Beat8Textures;
  mats: {
    tracks: MeshStandardMaterial;
    ticks: MeshStandardMaterial;
    caveat: MeshStandardMaterial;
    names: MeshStandardMaterial[];
    legend: MeshStandardMaterial;
    rings: MeshStandardMaterial;
    bracket: MeshStandardMaterial;
    head: MeshStandardMaterial;
    stamps: Record<keyof typeof STAMPS8, MeshStandardMaterial>;
    strips: MeshStandardMaterial[];
    band: MeshStandardMaterial;
    chad: MeshStandardMaterial;
    sheets: MeshStandardMaterial[][];
  };
  geo: {
    sheet: BufferGeometry;
    marks: BufferGeometry;
    tracks: BufferGeometry;
    caveat: BufferGeometry;
    names: BufferGeometry[];
    legend: BufferGeometry;
    rings: BufferGeometry;
    head: BufferGeometry;
    stamps: Record<keyof typeof STAMPS8, BufferGeometry>;
    unit: PlaneGeometry;
    arrowHead: BufferGeometry;
    ticks: PlaneGeometry;
    strips: PlaneGeometry[];
    band: PlaneGeometry;
    chad: PlaneGeometry;
    stackSheet: PlaneGeometry;
    clamp: BufferGeometry;
    clampScrews: BufferGeometry;
    tokenClamp: BufferGeometry;
    tokenScrews: BufferGeometry;
    rail: BufferGeometry;
    posts: BufferGeometry;
    carriage: BufferGeometry;
    carriageHead: BufferGeometry;
    carriageSlot: BufferGeometry;
    die: BufferGeometry;
    dieCap: BufferGeometry;
    dieKnob: BufferGeometry;
  };
  colours: { ink: Color; light: Color };
}

function useEvidenceAssets(): Assets {
  const gl = useThree((s) => s.gl);
  const a = useMemo((): Assets => {
    const t = beat8Textures(Math.min(8, gl.capabilities.getMaxAnisotropy()));
    const white = whiteTexture();
    const colours = { ink: inkColour(INK), light: inkColour(INK_LIGHT) };
    const stampMat = (map: Texture) => {
      const m = inkMat(map);
      m.color.copy(colours.ink);
      return m;
    };
    const bracket = inkMat(white);
    bracket.color.copy(colours.ink);
    const mats = {
      tracks: inkMat(t.tracks),
      ticks: inkMat(t.ticks),
      caveat: inkMat(t.caveat[2]!),
      names: t.names.map((x) => inkMat(x[2]!)),
      legend: inkMat(t.legend[2]!),
      rings: inkMat(t.rings[2]!),
      bracket,
      head: inkMat(t.head[2]!),
      stamps: { half: stampMat(t.stamps.half[2]!), ten: stampMat(t.stamps.ten[2]!), tokens: stampMat(t.stamps.tokens[2]!) },
      strips: t.strips.map((x) => pieceMat(x[0]!)),
      band: pieceMat(t.band),
      chad: pieceMat(t.chad),
      sheets: t.sheets.map((x) => x.map((y) => paper(y, HEX.paperLit))),
    };
    // the decals a hair apart in z, each over the sheet's top
    const zp = (k: number) => Z8.print + 0.02 * k;
    const R = (u0: number, u1: number, v0: number, v1: number) => sheetRect(u0, u1, v0, v1);
    const screws = (pts: readonly (readonly [number, number])[], z: number) => merge(pts.map(([u, v]) => dome(5.5, ...onSheet(u, v), z)));
    const tc = TOKENS.clamp;
    const geo = {
      sheet: slab(R(0, SHEET_W, 0, SHEET_H), 0, SHEET8.z, 2, 0.25),
      // the form's registration marks at its four corners
      marks: merge(
        [
          [MARK_IN, MARK_IN],
          [SHEET_W - MARK_IN, MARK_IN],
          [MARK_IN, SHEET_H - MARK_IN],
          [SHEET_W - MARK_IN, SHEET_H - MARK_IN],
        ]
          .flatMap(([u, v]) => [decalPlane({ u0: u! - 6, u1: u! + 6, v0: v! - 0.7, v1: v! + 0.7 }, zp(0)), decalPlane({ u0: u! - 0.7, u1: u! + 0.7, v0: v! - 6, v1: v! + 6 }, zp(0))])
          // the rule between the lanes and the token chart
          .concat([decalPlane({ u0: SECTION_RULE.u0, u1: SECTION_RULE.u1, v0: SECTION_RULE.v - 0.8, v1: SECTION_RULE.v + 0.8 }, zp(0))]),
      ),
      tracks: decalPlane(TRACKS_BOX, zp(0)),
      caveat: decalPlane(CAVEAT_BOX, zp(1)),
      names: NAME_BOX.map((b, i) => decalPlane(b, zp(2 + i))),
      legend: decalPlane(LEGEND_BOX, zp(5)),
      // the rings and their leaders stamped across the strips (over them), under the band (which slides out later)
      rings: decalPlane(RINGS_BOX, Z8.mark),
      head: decalPlane(HEAD_BOX, zp(6)),
      stamps: { half: decalPlane(stampBox('half'), zp(7)), ten: decalPlane(stampBox('ten'), zp(8)), tokens: decalPlane(stampBox('tokens'), zp(9)) },
      unit: new PlaneGeometry(1, 1),
      // the bracket's arrowhead: its tip at the origin, pointing +x
      arrowHead: (() => {
        const { head, w } = BRACKET.arrow;
        const sh = new Shape();
        sh.moveTo(0, 0);
        sh.lineTo(-head, w / 2);
        sh.lineTo(-head, -w / 2);
        sh.closePath();
        return new ShapeGeometry(sh);
      })(),
      ticks: new PlaneGeometry(1, 1),
      strips: LANES8.map(() => new PlaneGeometry(1, 1)),
      band: new PlaneGeometry(1, 1),
      chad: new PlaneGeometry(CHAD_SIZE[0], CHAD_SIZE[1]),
      stackSheet: new PlaneGeometry(SHEET_SIZE[0], SHEET_SIZE[1]),
      clamp: slab(R(CLAMP.u0, CLAMP.u1, CLAMP.v0, CLAMP.v1), SHEET8.z, CLAMP.z, 4, 1.4),
      clampScrews: screws([[(CLAMP.u0 + CLAMP.u1) / 2, CLAMP.v0 + 22], [(CLAMP.u0 + CLAMP.u1) / 2, (LANES8[0].strip[1] + LANES8[1].strip[0]) / 2 - 20], [(CLAMP.u0 + CLAMP.u1) / 2, CLAMP.v1 - 22]], CLAMP.z),
      tokenClamp: slab(R(tc.u0, tc.u1, tc.v0, tc.v1), SHEET8.z, tc.z, 4, 1.2),
      tokenScrews: screws([[(tc.u0 + tc.u1) / 2, tc.v0 + 16], [(tc.u0 + tc.u1) / 2, tc.v1 - 16]], tc.z),
      rail: tube([[...onSheet(RAIL.u0, RAIL.v), RAIL.z], [...onSheet(RAIL.u1, RAIL.v), RAIL.z]], RAIL.r, 8, 12),
      posts: merge(RAIL.posts.map(([u0, u1]) => slab(R(u0, u1, RAIL.postV[0], RAIL.postV[1]), SHEET8.z, SHEET8.z + RAIL.postZ, 3, 1))),
      // the carriage about its head's u = 0 (it rides the rail: posed per frame)
      carriage: slab({ x0: -CARRIAGE.w / 2, x1: CARRIAGE.w / 2, y0: -CARRIAGE.v1, y1: -CARRIAGE.v0 }, CARRIAGE.z[0], CARRIAGE.z[1], 5, 1.6),
      carriageHead: slab({ x0: -CARRIAGE.head.w / 2, x1: CARRIAGE.head.w / 2, y0: -CARRIAGE.head.v1, y1: -CARRIAGE.head.v0 + 4 }, CARRIAGE.head.z[0], CARRIAGE.head.z[1], 2, 0.8),
      carriageSlot: slab({ x0: -CARRIAGE.w / 2 + 7, x1: CARRIAGE.w / 2 - 7, y0: -RAIL.v - 5, y1: -RAIL.v + 5 }, CARRIAGE.z[1] - 0.6, CARRIAGE.z[1] + 0.3, 2, 0.3),
      // the die about its face's centre (posed per frame): an enamel block, a steel cap and knob
      die: slab({ x0: -DIE.w / 2, x1: DIE.w / 2, y0: -DIE.d / 2, y1: DIE.d / 2 }, 0, DIE.h - 3, 5, 1.4),
      dieCap: slab({ x0: -DIE.w / 2 + 6, x1: DIE.w / 2 - 6, y0: -DIE.d / 2 + 6, y1: DIE.d / 2 - 6 }, DIE.h - 3.4, DIE.h, 4, 1),
      dieKnob: dome(7.5, 0, 0, DIE.h),
    };
    return { t, mats, geo, colours };
  }, [gl]);
  useLayoutEffect(
    () => () => {
      const seen = new Set<unknown>();
      const walk = (v: unknown): void => {
        if (!v || typeof v !== 'object' || seen.has(v)) return;
        seen.add(v);
        if ('isTexture' in v || 'isMaterial' in v || 'isBufferGeometry' in v) (v as unknown as { dispose: () => void }).dispose();
        else for (const x of Object.values(v)) walk(x);
      };
      walk(a);
    },
    [a],
  );
  return a;
}

/** Crop a unit plane to the leading part of a piece fed out to `len` of its `full` length (its UVs from 1 - len/full to 1 along u). */
function cropLead(g: PlaneGeometry, len: number, full: number): void {
  const uv = g.getAttribute('uv');
  const u0 = 1 - len / full;
  // a plane's uv order: (0,1) (1,1) (0,0) (1,0)
  uv.setXY(0, u0, 1);
  uv.setXY(1, 1, 1);
  uv.setXY(2, u0, 0);
  uv.setXY(3, 1, 0);
  uv.needsUpdate = true;
}
/** Crop a unit plane to the trailing part from its start to `len` of `full` (the load line as far as it is printed). */
function cropFrom(g: PlaneGeometry, len: number, full: number): void {
  const uv = g.getAttribute('uv');
  const u1 = len / full;
  uv.setXY(0, 0, 1);
  uv.setXY(1, u1, 1);
  uv.setXY(2, 0, 0);
  uv.setXY(3, u1, 0);
  uv.needsUpdate = true;
}

export function Evidence({ e }: { e: Beat8State }) {
  const m = useDeskMats();
  const { t, mats, geo, colours } = useEvidenceAssets();
  const ink = e.ink;
  const tickLen = Math.max(0, e.tickEdge - TICKS_BOX.u0);
  const tickFull = TICKS_BOX.u1 - TICKS_BOX.u0;
  const [n0, n1, n2] = ink.names;
  useLayoutEffect(() => {
    // every print at its ink stage, every stamp's ink colour, every piece cropped to what is out, this frame
    const stage = (k: number) => Math.max(0, Math.min(2, k));
    mats.caveat.map = t.caveat[stage(ink.form)]!;
    [n0, n1, n2].forEach((k, i) => (mats.names[i]!.map = t.names[i]![stage(k)]!));
    mats.legend.map = t.legend[stage(ink.legend)]!;
    mats.rings.map = t.rings[stage(ink.bracket)]!;
    mats.head.map = t.head[stage(ink.head)]!;
    mats.stamps.half.map = t.stamps.half[stage(ink.half)]!;
    mats.stamps.ten.map = t.stamps.ten[stage(ink.ten)]!;
    mats.stamps.tokens.map = t.stamps.tokens[stage(ink.tokens)]!;
    mats.stamps.half.color.copy(colours.ink).lerp(colours.light, e.stampStep.half);
    mats.stamps.ten.color.copy(colours.ink).lerp(colours.light, e.stampStep.ten);
    mats.strips[1]!.map = t.strips[1]![e.notches]!;
    cropFrom(geo.ticks, Math.min(tickLen, tickFull), tickFull);
    e.strips.forEach((len, i) => len > 0 && cropLead(geo.strips[i]!, len, stripLength(i)));
    if (e.band > 0) cropLead(geo.band, e.band, BAND_SIZE[0]);
  }, [t, mats, geo, colours, ink.form, n0, n1, n2, ink.legend, ink.bracket, ink.head, ink.half, ink.ten, ink.tokens, e.stampStep.half, e.stampStep.ten, e.notches, e.strips, e.band, tickLen, tickFull]);
  const [cu, cv] = onSheet(e.carriage, 0);
  const tickBox = sheetRect(TICKS_BOX.u0, TICKS_BOX.u0 + Math.min(tickLen, tickFull), TICKS_BOX.v0, TICKS_BOX.v1);
  const [du, dv] = onSheet(e.die.u, e.die.v);
  // the bracket: its serifs at both holes' u and its bar between them, springing open from the bar's middle on its frame
  const sp = e.bracketSpring;
  const [ba, bb] = [onSheet(BRACKET.a[0], BRACKET.bar), onSheet(BRACKET.b[0], BRACKET.bar)];
  const bx = (ba[0] + bb[0]) / 2;
  const half = ((ba[0] - bb[0]) / 2) * sp;
  return (
    <group position={[e.dx, 0, 0]}>
      {/* the sheet, lit paper, and its furniture */}
      <mesh geometry={geo.sheet} material={m.paperLit} />
      <mesh geometry={geo.marks} material={m.paperShade} />
      <mesh geometry={geo.tracks} material={mats.tracks} />
      <mesh geometry={geo.rail} material={m.steel} />
      <mesh geometry={geo.posts} material={m.steel} />
      <group position={[cu, cv, 0]}>
        <mesh geometry={geo.carriage} material={m.steel} />
        <mesh geometry={geo.carriageHead} material={m.steel} />
        <mesh geometry={geo.carriageSlot} material={m.graphiteDeck} />
      </group>
      <mesh geometry={geo.clamp} material={m.steel} />
      <mesh geometry={geo.clampScrews} material={m.graphite} />
      <mesh geometry={geo.tokenClamp} material={m.steel} />
      <mesh geometry={geo.tokenScrews} material={m.graphite} />
      {/* the die */}
      <group position={[du, dv, e.die.z]}>
        <mesh geometry={geo.die} material={m.enamel} />
        <mesh geometry={geo.dieCap} material={m.steel} />
        <mesh geometry={geo.dieKnob} material={m.steel} />
      </group>
      {/* the load line as far as the carriage has printed it */}
      {tickLen > 0.05 && <mesh geometry={geo.ticks} material={mats.ticks} position={[(tickBox.x0 + tickBox.x1) / 2, (tickBox.y0 + tickBox.y1) / 2, Z8.print]} scale={[tickBox.x1 - tickBox.x0, tickBox.y1 - tickBox.y0, 1]} />}
      {/* the form's print, the rings, the token header, the hero stamps: each from its first ink stage on */}
      {ink.form >= 0 && <mesh geometry={geo.caveat} material={mats.caveat} />}
      {geo.names.map((g, i) => (ink.names[i]! >= 0 ? <mesh key={i} geometry={g} material={mats.names[i]} /> : null))}
      {ink.legend >= 0 && <mesh geometry={geo.legend} material={mats.legend} />}
      {ink.bracket >= 0 && <mesh geometry={geo.rings} material={mats.rings} />}
      {sp > 0.001 && (
        <>
          <mesh geometry={geo.unit} material={mats.bracket} position={[bx, ba[1], Z8.mark + 0.02]} scale={[2 * half + BRACKET_W, BRACKET_W, 1]} />
          {/* each serif an extension line from its hole's side (the told-to-delegate hole's north, the two-level hole's south) to a hair past the bar: a jog, never an H */}
          {[ba[0], bb[0]].map((x, k) => {
            const dir = k === 0 ? 1 : -1;
            const len = Math.max(BRACKET_W, (BRACKET.serif + BRACKET.over) * sp);
            return <mesh key={k} geometry={geo.unit} material={mats.bracket} position={[bx + (x - bx) * sp, ba[1] + (dir * (BRACKET.serif - BRACKET.over) * sp) / 2, Z8.mark + 0.02]} scale={[BRACKET_W, len, 1]} />;
          })}
          {/* the arrows outside the serifs, each pointing in at its serif (east of the east one, west of the west one), growing out of it */}
          {[ba[0], bb[0]].map((x, k) => {
            const out = x > bx ? 1 : -1;
            const tip = bx + (x - bx) * sp + (out * BRACKET_W) / 2;
            const { shaft, head } = BRACKET.arrow;
            return (
              <group key={`a${k}`} position={[tip, ba[1], Z8.mark + 0.02]} scale={[-out * sp, sp, 1]}>
                <mesh geometry={geo.arrowHead} material={mats.bracket} />
                <mesh geometry={geo.unit} material={mats.bracket} position={[-head - shaft / 2 + 0.5, 0, 0]} scale={[shaft + 1, BRACKET_W, 1]} />
              </group>
            );
          })}
        </>
      )}
      {ink.head >= 0 && <mesh geometry={geo.head} material={mats.head} />}
      {(['half', 'ten', 'tokens'] as const).map((id) => {
        if (ink[id] < 0) return null;
        const b = stampBox(id);
        const r = sheetRect(b.u0, b.u1, b.v0, b.v1);
        const c: [number, number] = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
        // set slightly askew, as a hand stamps it (turned about its own centre)
        return (
          <group key={id} position={[c[0], c[1], 0]} rotation={[0, 0, STAMPS8[id].rot]}>
            <mesh geometry={geo.stamps[id]} material={mats.stamps[id]} position={[-c[0], -c[1], 0]} />
          </group>
        );
      })}
      {/* the strips, out from under the clamp so far */}
      {e.strips.map((len, i) => {
        if (len <= 0.05) return null;
        const [y0, y1] = [SHEET8.y1 - LANES8[i]!.strip[1], SHEET8.y1 - LANES8[i]!.strip[0]];
        const x0 = SHEET8.x0 + ORIGIN_U;
        return <mesh key={i} geometry={geo.strips[i]} material={mats.strips[i]} position={[x0 + len / 2, (y0 + y1) / 2, Z8.strip]} scale={[len, STRIP_W, 1]} />;
      })}
      {/* the long run's band, out of its notch place so far */}
      {e.band > 0.05 && <mesh geometry={geo.band} material={mats.band} position={[SHEET8.x0 + BAND.u0 + e.band / 2, SHEET8.y1 - (BAND.v0 + BAND.v1) / 2, Z8.band]} scale={[e.band, BAND_SIZE[1], 1]} />}
      {/* the chads */}
      {e.chads.map((c, k) => {
        const [x, y] = onSheet(c.u, c.v);
        return <mesh key={k} geometry={geo.chad} material={mats.chad} position={[x, y, c.z]} rotation={[0, 0, c.rot]} />;
      })}
      {/* the stacks: each lane's sheets out of the token clamp so far, each at min(its place, the pack's front), each over the ones before it */}
      {e.stacks.map((front, i) => {
        if (front <= -4 + 1e-6) return null;
        const [v0, v1] = TOKENS.rows[i]!;
        return Array.from({ length: STACKS8[i]!.n }, (_, k) => {
          const reach = Math.min(stackSheetReach(i, k), front);
          const [x, y] = onSheet(ORIGIN_U + reach - TOKENS.sheetW / 2, (v0 + v1) / 2);
          return <mesh key={`${i}.${k}`} geometry={geo.stackSheet} material={mats.sheets[i]![k % 2]} position={[x, y, Z8.stack + STACK_DZ * k]} />;
        });
      })}
    </group>
  );
}
