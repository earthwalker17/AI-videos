/**
 * Beat 7.3's job rail and what docks on it (desk/beat7.ts): the background jobs' station south of the request's bay.
 * - JobRail: still (d)'s job rail shelf (summary.ts JOB_RAIL, Trace.tsx's geometry: a low graphite shelf with a back lip)
 *   and the receipt's slit in its west part. It takes a static pose (`dz` 0: risen), so the summary can draw the same
 *   body (objects/Trace.tsx, lane D).
 * - OvalTrack: the oval south of the shelf the long test runs round while it is in the background: a graphite plate, a
 *   raised graphite rail with a rim, a steel running strip on it. It rises with the shelf and sinks into its own hatch once
 *   the test has docked back (still (d) has the shelf alone).
 * - RailHatch, PlateHatch: the slate hatches they rise out of (objects/Dispatch.tsx Hatch; their holes in the desk:
 *   Beat7.tsx).
 * - Capsule: the long test, a steel-capped enamel pill with the request's vermilion band.
 * - Receipt: its "started" ticket, pushed up out of the shelf's slit and leaning back.
 * - Glass: your tray's sand-glass (objects/YourDesk.tsx's own numbers and materials, about its rest point, so the hand-over
 *   is an identity on its lift frame), taking still (d)'s body in flight (Trace.tsx glassAt: its ends and bulbs), docked on
 *   the shelf; it too takes a static pose (morph 1).
 * - ProductivePlate: Productive · 高效 (gl/plate.ts on enamel, as the Proactive plate), risen out of its slate hatch.
 */
import { useLayoutEffect, useMemo } from 'react';
import { MeshPhysicalMaterial, Path, PlaneGeometry, Shape, type BufferGeometry, type Texture } from 'three';
import { CAPSULE, GLASS_REST, OVAL, OVAL_BOX, PLATE_RISE, PRODUCTIVE_PLATE, RAIL, RAIL_HATCH, RECEIPT, SHELF, type CapsulePose, type GlassPose } from '../beat7.ts';
import { cylinderZ, dome, extrude, latheZ, merge, planeOn, slab, tube } from '../geom.ts';
import { HEX, enamel, matte, paper } from '../gl/materials.ts';
import { WithMats, useDeskMats, useStepMode } from '../kit.tsx';
import type { Rect } from '../layout.ts';
import { Hatch } from './Dispatch.tsx';

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });

/** A racetrack outline about the oval's two centres at radius r (counter-clockwise), as a Shape or a hole Path. */
function racetrack(r: number, path: Shape | Path = new Shape()): Shape | Path {
  const [x0, cy] = OVAL.c0;
  const x1 = OVAL.c1[0];
  path.moveTo(x0, cy - r);
  path.lineTo(x1, cy - r);
  path.absarc(x1, cy, r, -Math.PI / 2, Math.PI / 2, false);
  path.lineTo(x0, cy + r);
  path.absarc(x0, cy, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  return path;
}
/** A flat ring between two racetracks (the rail's band), extruded. */
function band(rOut: number, rIn: number, z0: number, z1: number, bevel: number): BufferGeometry {
  const s = racetrack(rOut) as Shape;
  const h = racetrack(rIn, new Path()) as Path;
  // the hole must wind the other way
  s.holes.push(new Path(h.getPoints(24).reverse()));
  return extrude(s, z0, z1, bevel, 1);
}

/** Still (d)'s shelf exactly (objects/Trace.tsx) and the receipt's slit in its west part. */
function useShelfGeometry() {
  const g = useMemo(() => {
    const R = SHELF;
    const shelf = merge([slab(R, 0, R.z, 3, 1.2), slab({ ...R, y0: R.y1 - 6 }, R.z, R.lip, 2, 1)]);
    const slit = planeOn({ x0: RECEIPT.c[0] - RECEIPT.w / 2 - 1.5, x1: RECEIPT.c[0] + RECEIPT.w / 2 + 1.5, y0: RECEIPT.c[1] - 1.8, y1: RECEIPT.c[1] + 1.8 }, R.z + 0.05);
    return { shelf, slit };
  }, []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}

/** The job rail shelf (still (d)'s), `dz` under its rest while it rises (0: up). */
export function JobRail({ dz = 0 }: { dz?: number }) {
  const g = useShelfGeometry();
  const m = useDeskMats();
  return (
    <group position={[0, 0, dz]}>
      <mesh geometry={g.shelf} material={m.graphiteDark} />
      <mesh geometry={g.slit} material={m.graphiteDark} />
    </group>
  );
}

/**
 * The oval's geometry: its plate, the raised rail with a rim on each side (the outer one a lit enamel lip, 3 u wide, so the
 * track and the test's lap read on the dark slate at 0.85x: session 6's critics found it dark on dark), the steel running
 * strip on it (built once).
 */
function useOvalGeometry() {
  const g = useMemo(() => {
    const w = OVAL.railW / 2;
    const plate = extrude(racetrack(OVAL.r + w + OVAL.plate) as Shape, 0, OVAL.z, 1.5, 1);
    const rail = band(OVAL.r + w, OVAL.r - w, OVAL.z, OVAL.railZ, 1);
    const lip = band(OVAL.r + w + 1, OVAL.r + w - 2, OVAL.railZ - 0.2, OVAL.railZ + 1.1, 0.4);
    const rims = band(OVAL.r - w + 1.4, OVAL.r - w - 0.2, OVAL.railZ - 0.2, OVAL.railZ + 0.9, 0.3);
    const strip = band(OVAL.r + 1.6, OVAL.r - 1.6, OVAL.railZ - 0.05, OVAL.stripZ, 0.2);
    return { plate, rail, lip, rims, strip };
  }, []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}
/** The oval track, `dz` under its rest (rising with the shelf, or sinking into its own hatch). */
export function OvalTrack({ dz = 0 }: { dz?: number }) {
  const g = useOvalGeometry();
  const m = useDeskMats();
  return (
    <group position={[0, 0, dz]}>
      <mesh geometry={g.plate} material={m.graphiteDark} />
      <mesh geometry={g.rail} material={m.graphite} />
      <mesh geometry={g.lip} material={m.enamel} />
      <mesh geometry={g.rims} material={m.steel} />
      <mesh geometry={g.strip} material={m.steel} />
    </group>
  );
}
void OVAL_BOX;

/** The slate hatch the station (or the oval alone) rises out of or sinks into (its hole in the desk: objects/Beat7.tsx writes it). */
export function RailHatch({ open, box = RAIL_HATCH }: { open: number; box?: Rect }) {
  return <Hatch box={box} open={open} depth={RAIL.depth + 6} look="slate" />;
}
/** The Productive plate's slate hatch. */
export function PlateHatch({ open }: { open: number }) {
  return <Hatch box={PRODUCTIVE_PLATE.box} open={open} depth={PLATE_RISE.depth + 6} look="slate" />;
}

/** The long test's pill: its enamel body along x, the request's vermilion band round its middle, steel caps (built about its centre). */
function useCapsuleGeometry() {
  const g = useMemo(() => {
    const { r, half } = CAPSULE;
    const along = (geo: BufferGeometry) => {
      geo.rotateY(Math.PI / 2);
      return geo;
    };
    const body = along(cylinderZ(r, -half + 4, half - 4, 0, 0, 24));
    const band = along(cylinderZ(r + 0.25, -6, 6, 0, 0, 24));
    const caps = merge(
      [-1, 1].map((k) => {
        // a hemispherical steel cap on a short steel collar at each end, its axis along x out of the body's end
        const cap = dome(r, 0, 0, 0);
        cap.rotateY(k > 0 ? Math.PI / 2 : -Math.PI / 2);
        cap.translate(k * half, 0, 0);
        const collar = cylinderZ(r + 0.4, -4, 0, 0, 0, 24);
        collar.rotateY(Math.PI / 2);
        collar.translate(k > 0 ? half : -half + 4, 0, 0);
        return merge([cap, collar]);
      }),
    );
    return { body, band, caps };
  }, []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}

/** The long test at its pose (in the air, on the rail, docking back): it never steps down (cargo in motion). */
export function Capsule({ c }: { c: CapsulePose }) {
  const g = useCapsuleGeometry();
  const m = useDeskMats();
  const q = c.squash;
  return (
    <group position={c.p} rotation={[c.roll, -c.slope, c.heading, 'ZYX']} scale={[1 + q, 1 + q / 2, 1 - q]}>
      <mesh geometry={g.body} material={m.enamel} />
      <mesh geometry={g.band} material={m.vermilionPaper} />
      <mesh geometry={g.caps} material={m.steel} />
    </group>
  );
}

/** The receipt, risen `up` (0..1) out of the shelf's slit, leaning back (its print: gl/print7.ts). */
export function Receipt({ up, face }: { up: number; face: Texture }) {
  const mode = useStepMode();
  const mat = useMemo(() => paper(face, HEX.paperLit, { stepped: mode }), [face, mode]);
  useLayoutEffect(() => () => mat.dispose(), [mat]);
  const g = useMemo(() => {
    // a ticket standing on its foot edge (local y up its height), its face toward the camera
    const body = new PlaneGeometry(RECEIPT.w, RECEIPT.h);
    body.translate(0, RECEIPT.h / 2, 0);
    return body;
  }, []);
  useLayoutEffect(() => () => g.dispose(), [g]);
  // it rises out of the slit (its hidden part under the shelf's top), standing back at its lean
  const h = RECEIPT.h * Math.max(0, up);
  return (
    <group position={[RECEIPT.c[0], RECEIPT.c[1], RECEIPT.c[2] - RECEIPT.h + h]} rotation={[Math.PI / 2 - RECEIPT.lean, 0, 0]}>
      <mesh geometry={g} material={mat} />
    </group>
  );
}

/** Your tray's sand-glass (objects/YourDesk.tsx GLASS) and still (d)'s (objects/Trace.tsx glassAt): the numbers each part takes in flight. */
const TRAY_GLASS = { plateR: 20, plateT: 5, plateY: 31, postX: 14, postR: 2.2, profile: [[0.01, -29], [9.5, -27], [11.5, -15.95], [2.6, -1.6], [2.6, 1.6], [11.5, 15.95], [9.5, 27], [0.01, 29]] as [number, number][] } as const;
const D_GLASS = { plateR: 13.5, plateT: 4, plateY: 28, postX: 9, postR: 0, profile: [[0.01, -26], [10, -24], [11.5, -14], [2.4, -1.5], [2.4, 1.5], [11.5, 14], [10, 24], [0.01, 26]] as [number, number][] } as const;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** The glass's parts about its centre: unit ends and posts (scaled per frame), the sand. */
function useGlassParts() {
  const g = useMemo(() => {
    const end = cylinderZ(1, -0.5, 0.5, 0, 0, 32);
    end.rotateX(Math.PI / 2);
    const post = tube(
      [
        [0, -1, 0],
        [0, 1, 0],
      ],
      1,
      4,
      8,
    );
    const sand = latheZ(
      [
        [0.01, -29 + 1.4],
        [11.5 - 3, -29 + 3.4],
        [11.5 - 2.6, -29 * 0.6],
        [0.01, -29 * 0.42],
      ],
      32,
    );
    sand.rotateX(Math.PI / 2);
    return { end, post, sand };
  }, []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}
/** The bulbs' lathe at a morph (your tray's profile at 0, still (d)'s at 1), rebuilt only while it changes. */
function useBulb(morph: number) {
  const g = useMemo(() => {
    const p = TRAY_GLASS.profile.map(([r, y], i): [number, number] => [mix(r, D_GLASS.profile[i]![0], morph), mix(y, D_GLASS.profile[i]![1], morph)]);
    const x = latheZ(p, 32);
    x.rotateX(Math.PI / 2);
    return x;
  }, [morph]);
  useLayoutEffect(() => () => g.dispose(), [g]);
  return g;
}

/** The sand-glass at a pose (beat7.ts glassAt; `p` its rest point on what it lies on: GLASS_REST is your tray's own pose). */
export function Glass({ pose }: { pose: GlassPose }) {
  const g = useGlassParts();
  const bulb = useBulb(pose.morph);
  const m = useDeskMats();
  const mode = useStepMode();
  // the sand: your desk's own material (objects/YourDesk.tsx useYouMats), in this set's mode
  const sand = useMemo(() => matte('#8E8676', 0.85, 0, mode), [mode]);
  useLayoutEffect(() => () => sand.dispose(), [sand]);
  const k = pose.squash;
  const t = pose.morph;
  const R = mix(TRAY_GLASS.plateR, D_GLASS.plateR, t);
  const T = mix(TRAY_GLASS.plateT, D_GLASS.plateT, t);
  const Y = mix(TRAY_GLASS.plateY, D_GLASS.plateY, t);
  const X = mix(TRAY_GLASS.postX, D_GLASS.postX, t);
  const pr = mix(TRAY_GLASS.postR, D_GLASS.postR, t);
  return (
    <group position={pose.p}>
      <group rotation={[pose.tilt, 0, pose.yaw]} scale={[1 + k / 2, 1 + k / 2, 1 - k]}>
        <group position={[0, 0, R]}>
          <mesh geometry={bulb} material={m.paper} />
          {t < 1 && <mesh geometry={g.sand} material={sand} scale={[1 - t, 1 - t, 1 - t]} />}
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={g.end} material={m.graphite} position={[0, s * Y, 0]} scale={[R, T, R]} />
          ))}
          {pr > 0.05 &&
            [-1, 1].map((s) => (
              <mesh key={`p${s}`} geometry={g.post} material={m.steel} position={[s * X, 0, 0]} scale={[pr, Y, pr]} />
            ))}
        </group>
      </group>
    </group>
  );
}
void GLASS_REST;

/**
 * The Productive plate (as objects/Filter.tsx's Proactive plate: a graphite back, an enamel body, its engraved face), `dz`
 * under its dock while it rises; `words` (0..1, default all): how much of its engraved face is written on from its west
 * edge (beat7.ts productivePlateAt), the enamel body's blank top showing east of it.
 */
export function ProductivePlate({ dz, face, words = 1 }: { dz: number; face: Texture; words?: number }) {
  const g = useMemo(() => {
    const B = PRODUCTIVE_PLATE.box;
    const [z0, z1] = PRODUCTIVE_PLATE.z;
    return { back: slab(B, z0, z0 + 1.6, 4, 0.8), body: slab(inset(B, 3), z0 + 1.6, z1, 3, 1), face: planeOn(inset(B, 5), z1 + 0.2) };
  }, []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return <WithMats>{(m) => <PlateBody g={g} m={m} dz={dz} face={face} words={words} />}</WithMats>;
}
function PlateBody({ g, m, dz, face, words }: { g: { back: BufferGeometry; body: BufferGeometry; face: BufferGeometry }; m: ReturnType<typeof useDeskMats>; dz: number; face: Texture; words: number }) {
  const mode = useStepMode();
  // its engraved face: the kit's enamel (the room's light on it) with the plate's words for a map, in this set's mode
  const mat = useMemo(() => enamel(face, (m.enamel as MeshPhysicalMaterial).envMap!, HEX.enamel, { stepped: mode }), [face, m, mode]);
  useLayoutEffect(() => () => mat.dispose(), [mat]);
  const k = Math.min(1, Math.max(0, words));
  // the written part: the face's west k of its width, its map cut to match (the texture's u 0..k), so nothing stretches
  useLayoutEffect(() => {
    face.repeat.set(Math.max(1e-3, k), 1);
  }, [face, k]);
  const x0 = PRODUCTIVE_PLATE.box.x0 + 5;
  return (
    <group position={[0, 0, dz]}>
      <mesh geometry={g.back} material={m.graphiteDark} />
      <mesh geometry={g.body} material={m.enamel} />
      {k >= 1 ? (
        <mesh geometry={g.face} material={mat} />
      ) : k > 0 ? (
        <group position={[x0, 0, 0]} scale={[k, 1, 1]}>
          <mesh geometry={g.face} material={mat} position={[-x0, 0, 0]} />
        </group>
      ) : null}
    </group>
  );
}
