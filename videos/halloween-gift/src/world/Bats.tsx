/**
 * Bats (kit/bat.ts): a renderer for any number of them (BatSwarm: one InstancedMesh per part, the
 * body, the wings with the flap cycle as per-instance morph targets, the eyes' glints; frustum
 * culling off, as instances fly anywhere) and the two ways the film flies them:
 *  - <BatFlock> flies `count` bats along a deterministic path (a FlightPath: open, entered and
 *    left one behind another, or a closed loop), each with its own smooth wander off the path,
 *    speed, size and flap rate, heading along its own motion and banking into its turns;
 *  - <BatBurst> squeezes bats out of a gap (a slit along the horizontal across `dir`, wings
 *    folded) one after another from `start`, unfolding as they clear it and scattering in a cone
 *    round `dir`, rising, flapping hard (the film's hook: out of the closed book's fore-edge).
 * Every bat flaps on ones (its phase from the frame, no twos), silhouette-dark with the moon's
 * rim on the body; the membranes' trailing edges a touch paler (thin against the moon). Far bats
 * (a `lod` with the eye) are flecks: flat chevrons from the same spec and flap, turned to the eye
 * (the reference paints its far flocks as crisp V shapes). Pure functions of the frame. 2 draw
 * calls a flock, +1 with eyes, +1 with flecks; no shadows (small and in the air).
 */
import { rand, smoothstep } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { Color, DoubleSide, InstancedMesh, Matrix4, Mesh, Vector3, type MeshStandardMaterial } from 'three';
import { FPS } from '../cues.ts';
import { batBodyGeometry, batEyeGeometry, batFleckGeometry, batWingGeometry, flapPose, WING_POSES, wingInfluences, type V3 } from '../kit/bat.ts';
import { Curve, type P3 } from '../kit/spline.ts';
import { storybookMaterial } from '../look/materials.ts';
import { ROOM } from './Desk2.tsx';
import { FLOOR, HERO } from './layout.ts';

const TAU = Math.PI * 2;

// ---- paths ----------------------------------------------------------------------------------------

/** A flight path by arc length (world units). */
export interface FlightPath {
  at(s: number): V3;
  length: number;
  closed: boolean;
}

/**
 * A flight path through points: open (a centripetal Catmull-Rom, kit/spline) or closed (the same
 * curve through the points wrapped round, so the seam is as smooth as the rest), by arc length.
 */
export function flightPath(points: readonly P3[], closed = false): FlightPath {
  if (!closed) {
    const c = new Curve<P3>(points);
    return { at: (s) => c.pointAt(Math.min(Math.max(s, 0), c.length)) as V3, length: c.length, closed: false };
  }
  const n = points.length;
  const wrapped = [points[n - 1], ...points, points[0], points[1]];
  const c = new Curve<P3>(wrapped);
  const segs = wrapped.length - 1;
  const u0 = 1 / segs;
  const u1 = (n + 1) / segs;
  const N = 720;
  const pts: V3[] = [];
  const acc: number[] = [0];
  for (let i = 0; i <= N; i++) {
    pts.push(c.at(u0 + ((u1 - u0) * i) / N) as V3);
    if (i > 0) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  }
  const L = acc[N];
  return {
    length: L,
    closed: true,
    at(s) {
      const x = ((s % L) + L) % L;
      let lo = 0;
      let hi = N;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (acc[mid] < x) lo = mid;
        else hi = mid;
      }
      const t = (x - acc[lo]) / Math.max(1e-9, acc[hi] - acc[lo]);
      const a = pts[lo];
      const b = pts[hi];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    },
  };
}

/**
 * The far flock's loop by the castle's crag: a small wheeling knot of bats against the clouds left
 * of its towers, at the castle's depth (the reference's flock, 8 to 15 px V shapes at the hero
 * eye), drawn as flecks (lod). The film passes the castle's parallax `offset` to it.
 */
export const CRAG_FLIGHT = flightPath(
  [
    [0.49, FLOOR + 3.95, -4.23],
    [1.05, FLOOR + 4.27, -4.76],
    [1.82, FLOOR + 4.06, -4.32],
    [2.09, FLOOR + 3.63, -3.74],
    [1.38, FLOOR + 3.41, -3.45],
    [0.73, FLOOR + 3.58, -3.78],
  ],
  true,
);

/** A few bats wheeling just under the moon as the hero eye sees it (the reference's), flecks too. */
export const MOON_FLIGHT = flightPath(
  [
    [4.88, FLOOR + 3.15, -1.21],
    [5.38, FLOOR + 3.29, -1.49],
    [5.53, FLOOR + 3.13, -1.08],
    [5.11, FLOOR + 2.92, -0.65],
    [4.91, FLOOR + 2.97, -0.99],
  ],
  true,
);

/**
 * The near flock's flight over the graveyard: down out of the top of the hero view through the
 * open sky between the dead tree and the castle and away toward the gates, so the hero eye sees
 * the bats from behind and above, wings spread against the bright haze, shrinking into it.
 */
export const GRAVEYARD_FLIGHT = flightPath([
  [0.95, FLOOR + 4.6, 4.6],
  [0.85, FLOOR + 3.95, 2.3],
  [0.7, FLOOR + 3.35, 0.15],
  [0.85, FLOOR + 2.95, -2.1],
  [1.25, FLOOR + 2.8, -4.6],
]);

// ---- the renderer ---------------------------------------------------------------------------------

/** One bat this frame. */
export interface BatState {
  pos: V3;
  /** its heading (need not be unit) */
  fwd: V3;
  /** roll about the heading (radians, + rolls the right wing up) */
  bank: number;
  /** wingspan (world units) */
  scale: number;
  /** flap phase (period 1) */
  phase: number;
  /** 0 the flap cycle .. 1 wings folded tight */
  folded: number;
  visible: boolean;
}

/**
 * Far bats as flecks: a bat whose wingspan is under `px` pixels seen from `eye` (a frame `height`
 * px tall through a vertical `fov`) is drawn as a flat chevron turned to face the eye (kit/bat.ts
 * batFleckGeometry), not the full mesh: at that size the bones and fur are sub-pixel and the
 * painterly pass smears the mesh into a blob, where the reference paints a crisp V.
 */
export interface BatLod {
  eye: readonly [number, number, number];
  fov?: number;
  height?: number;
  px?: number;
}

export interface BatSwarmProps {
  states: readonly BatState[];
  /** the typical wingspan (world units): the fur's and the membrane's paint scale */
  size: number;
  /** the eyes' glints (off unless the bats come within ~3 units of the lens: sub-pixel glints sparkle) */
  eyes?: boolean;
  /** the storybook fog multiplier (far flocks keep their silhouette against the haze) */
  fog?: number;
  /** the paint's second colour (the dark of the fur and membrane's breakup) */
  color2?: string;
  /** far bats as flecks (see BatLod); none when absent */
  lod?: BatLod;
  /** the storybook ambient's share (the book's bats against its pale fore-edge: low, so they read as silhouettes) */
  ambient?: number;
  /** the paint's brightness (albedo multiplier) */
  tone?: number;
  /** the book's crack light on them (world/Desk2 ROOM.uRoomCrack; 0: none): a rim, and the membranes lit through */
  crack?: number;
}

const UP = new Vector3(0, 1, 0);

/** the crack's light on the bats (a little paler than the light it casts on the paper) */
const CRACK_RIM = new Color('#7fe4f2');

/**
 * The book's crack light on a bat (after the storybook's own output): the light from the slit
 * behind it (world/Desk2's line light along the fore-edge's mouth, ROOM.uRoomCrack) catching its
 * silhouette's edges, strongest where the slit is behind it, and through the thin membranes (`thin`
 * 1: a wing) a glow where it is between the slit and the eye, warmed by the skin it passes through.
 */
export function crackLit(m: MeshStandardMaterial, thin: number, k: number): MeshStandardMaterial {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = function (shader, renderer) {
    prev.call(this, shader, renderer);
    shader.uniforms.uRoomCrack = ROOM.uRoomCrack;
    shader.uniforms.uBatCrackCol = { value: CRACK_RIM };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec4 uRoomCrack;\nuniform vec3 uBatCrackCol;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        `if (uRoomCrack.w > 0.0) {
  vec3 cP = vSbWorld;
  vec3 cq = vec3(clamp(cP.x, -uRoomCrack.x, uRoomCrack.x), uRoomCrack.y, uRoomCrack.z);
  vec3 cdl = cq - cP;
  float cd = length(cdl);
  vec3 cL = cdl / max(cd, 1e-4);
  vec3 cV = normalize(cameraPosition - cP);
  vec3 cN = normalize(vSbNormalW) * (gl_FrontFacing ? 1.0 : -1.0);
  float cEnds = smoothstep(uRoomCrack.x + 0.6, uRoomCrack.x - 1.6, abs(cP.x));
  float cAtt = uRoomCrack.w * cEnds * 2.0 / (1.0 + 0.9 * cd * cd);
  float cFres = pow(1.0 - abs(dot(cN, cV)), 3.0);
  float cBack = smoothstep(-0.4, 0.5, dot(cL, -cV));
  float cRim = cFres * (0.3 + 0.7 * cBack) * clamp(0.35 + 0.65 * dot(cN, cL), 0.0, 1.0);
  float cTrans = ${thin.toFixed(2)} * pow(max(dot(cL, -cV), 0.0), 2.5) * (1.0 - 0.5 * cFres);
  // the membrane darkened where the light is not through it (a dark wing with a lit rim, glowing only toward the slit)
  outgoingLight *= 1.0 - 0.35 * ${thin.toFixed(2)} * clamp(cAtt, 0.0, 1.0);
  outgoingLight += uBatCrackCol * cAtt * ${k.toFixed(2)} * (2.2 * cRim + 0.2 * cTrans * vec3(0.8, 0.9, 1.0));
}
#include <opaque_fragment>`,
      );
  };
  const key = m.customProgramCacheKey();
  m.customProgramCacheKey = () => `${key}:crack${thin.toFixed(2)}:${k.toFixed(2)}`;
  return m;
}

/**
 * A storybook material made matte: the injection as it is (light, ambient, rim, fog), with the
 * moon's direct specular scaled down. A bat's membrane and finger bones are thin and seen edge-on
 * every few frames, where GGX's Fresnel goes to 1 even at roughness 1: they flashed as pale
 * stick-lines that shimmer; leathery skin and fur reflect little. Keyed apart from the plain
 * storybook programs, so no other material shares the change. (The ghosts' cloth uses it too; its
 * home is look/materials.ts, as a `specular` option of storybookMaterial.)
 */
export function matte(m: MeshStandardMaterial, k: number): MeshStandardMaterial {
  const sb = m.onBeforeCompile;
  m.onBeforeCompile = function (shader, renderer) {
    sb.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.directSpecular *= ${k.toFixed(3)};`);
  };
  const key = m.customProgramCacheKey();
  m.customProgramCacheKey = () => `${key}:matte${k.toFixed(3)}`;
  return m;
}

/** Any number of bats, posed from their states (instanced: body, wings, eyes). */
export function BatSwarm({ states, size, eyes = true, fog = 1, color2 = '#1c1318', lod, ambient = 1, tone = 1, crack = 0 }: BatSwarmProps) {
  const count = states.length;
  const flecks = lod !== undefined;
  const built = useMemo(() => {
    const bodyGeo = batBodyGeometry(3);
    const wingGeo = batWingGeometry();
    const eyeGeo = batEyeGeometry();
    const fleckGeo = batFleckGeometry();
    const paint = new Color(tone, tone, tone);
    let bodyMat = matte(storybookMaterial({ kind: 'cloth', color: paint, color2, vertexColors: true, roughness: 1, breakup: 0.25, scale: size * 0.03, bump: 0.5, rim: 1.0, fog, ambient, side: DoubleSide }), 0.3);
    let wingMat = matte(storybookMaterial({ kind: 'plain', color: paint, color2, vertexColors: true, roughness: 1, breakup: 0.12, scale: size * 0.08, rim: 0.8, fog, ambient, side: DoubleSide }), 0.08);
    if (crack > 0) {
      bodyMat = crackLit(bodyMat, 0, crack);
      wingMat = crackLit(wingMat, 1, crack);
    }
    const eyeMat = storybookMaterial({ color: '#000000', emissive: '#d6f2ff', emissiveIntensity: 1.6, roughness: 0.3, rim: 0, ambient: 0, breakup: 0, fog: fog * 0.6 });
    // the flecks: flat, no rim (a facing card has no silhouette edge to catch it), matte
    const fleckMat = matte(storybookMaterial({ kind: 'plain', color: '#ffffff', color2, vertexColors: true, roughness: 1, breakup: 0, rim: 0, fog, side: DoubleSide }), 0);
    const n = Math.max(1, count);
    const body = new InstancedMesh(bodyGeo, bodyMat, n);
    const wings = new InstancedMesh(wingGeo, wingMat, n);
    const eye = new InstancedMesh(eyeGeo, eyeMat, n);
    const fleck = new InstancedMesh(fleckGeo, fleckMat, n);
    const dummy = new Mesh();
    dummy.morphTargetInfluences = new Array(WING_POSES).fill(0);
    for (const m of [body, wings, eye, fleck]) m.frustumCulled = false;
    // the per-instance morph texture exists before the first draw (the program needs it)
    for (let i = 0; i < n; i++) {
      wings.setMorphAt(i, dummy);
      fleck.setMorphAt(i, dummy);
    }
    return { body, wings, eye, fleck, dummy, bodyGeo, wingGeo, eyeGeo, fleckGeo, bodyMat, wingMat, eyeMat, fleckMat };
  }, [count, size, fog, color2, ambient, tone, crack]);
  useLayoutEffect(
    () => () => {
      for (const m of [built.body, built.wings, built.eye, built.fleck]) m.dispose();
      built.bodyGeo.dispose();
      built.wingGeo.dispose();
      built.eyeGeo.dispose();
      built.fleckGeo.dispose();
      built.bodyMat.dispose();
      built.wingMat.dispose();
      built.eyeMat.dispose();
      built.fleckMat.dispose();
    },
    [built],
  );
  const ex = lod?.eye[0] ?? 0;
  const ey = lod?.eye[1] ?? 0;
  const ez = lod?.eye[2] ?? 0;
  const lfov = lod?.fov ?? HERO.fov;
  const lh = lod?.height ?? 1080;
  const lpx = lod ? (lod.px ?? 25) : 0;
  useLayoutEffect(() => {
    const m = new Matrix4();
    const zero = new Matrix4().makeScale(0, 0, 0);
    const fw = new Vector3();
    const right = new Vector3();
    const up = new Vector3();
    const toEye = new Vector3();
    const infl = built.dummy.morphTargetInfluences as number[];
    // pixels per unit of wingspan at unit distance
    const focal = lh / 2 / Math.tan(((lfov / 2) * Math.PI) / 180);
    states.forEach((s, i) => {
      if (!s.visible || s.scale <= 0) {
        built.body.setMatrixAt(i, zero);
        built.wings.setMatrixAt(i, zero);
        built.eye.setMatrixAt(i, zero);
        built.fleck.setMatrixAt(i, zero);
        return;
      }
      if (lpx > 0) {
        toEye.set(ex - s.pos[0], ey - s.pos[1], ez - s.pos[2]);
        const dist = toEye.length();
        if ((s.scale * focal) / Math.max(dist, 1e-3) < lpx) {
          // a fleck turned to the eye, rolled a little with the bank, flapping on its own phase
          toEye.normalize();
          right.crossVectors(UP, toEye);
          if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
          right.normalize();
          up.crossVectors(toEye, right).normalize();
          right.applyAxisAngle(toEye, s.bank * 0.5);
          up.applyAxisAngle(toEye, s.bank * 0.5);
          m.makeBasis(right, up, toEye).scale(new Vector3(s.scale, s.scale, s.scale));
          m.setPosition(s.pos[0], s.pos[1], s.pos[2]);
          built.fleck.setMatrixAt(i, m);
          wingInfluences(s.phase, s.folded, infl);
          built.fleck.setMorphAt(i, built.dummy);
          built.body.setMatrixAt(i, zero);
          built.wings.setMatrixAt(i, zero);
          built.eye.setMatrixAt(i, zero);
          return;
        }
      }
      built.fleck.setMatrixAt(i, zero);
      const pose = flapPose(s.phase);
      const k = 1 - s.folded;
      fw.set(s.fwd[0], s.fwd[1], s.fwd[2]).normalize();
      right.crossVectors(UP, fw);
      if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
      right.normalize();
      up.crossVectors(fw, right).normalize();
      // the bank about the heading, then the body's pitch with the stroke about its right
      right.applyAxisAngle(fw, s.bank);
      up.applyAxisAngle(fw, s.bank);
      const pitch = -pose.pitch * k;
      fw.applyAxisAngle(right, pitch);
      up.applyAxisAngle(right, pitch);
      m.makeBasis(right, up, fw).scale(new Vector3(s.scale, s.scale, s.scale));
      // the body rises on the downstroke: the whole bat bobs against its wings
      const bob = pose.bob * k * s.scale;
      m.setPosition(s.pos[0] + up.x * bob, s.pos[1] + up.y * bob, s.pos[2] + up.z * bob);
      built.body.setMatrixAt(i, m);
      built.wings.setMatrixAt(i, m);
      built.eye.setMatrixAt(i, m);
      wingInfluences(s.phase, s.folded, infl);
      built.wings.setMorphAt(i, built.dummy);
    });
    for (const mesh of [built.body, built.wings, built.eye, built.fleck]) mesh.instanceMatrix.needsUpdate = true;
    if (built.wings.morphTexture) built.wings.morphTexture.needsUpdate = true;
    if (built.fleck.morphTexture) built.fleck.morphTexture.needsUpdate = true;
  }, [built, states, ex, ey, ez, lfov, lh, lpx]);
  return (
    <>
      <primitive object={built.body} />
      <primitive object={built.wings} />
      {eyes && <primitive object={built.eye} />}
      {flecks && <primitive object={built.fleck} />}
    </>
  );
}

// ---- flocks ---------------------------------------------------------------------------------------

export interface BatFlockProps {
  /** the film frame */
  f: number;
  path: FlightPath;
  count: number;
  seed: number;
  /** wingspan (world units), each bat ±15% */
  size?: number;
  /** cruising speed along the path (units / s), each bat ±12% */
  speed?: number;
  /** how far a bat wanders off the path (units) */
  spread?: number;
  /** flap rate (cycles / s), each bat ±15% */
  flap?: number;
  /** open paths: the frame the first bat enters, and the spacing between bats (units of path) */
  start?: number;
  gap?: number;
  /** shift the whole flock (the castle's parallax offset, for the crag's flock) */
  offset?: readonly [number, number, number];
  eyes?: boolean;
  fog?: number;
  /** far bats as flecks, seen from this eye (see BatLod) */
  lod?: BatLod;
}

/** Each flock bat's state at a frame (exported for tests and the film's framing). */
export function flockStates(f: number, o: Required<Omit<BatFlockProps, 'f' | 'lod'>>): BatState[] {
  const { path, count, seed, size, speed, spread, flap, start, gap, offset } = o;
  const L = path.length;
  const where = (i: number, t: number): { p: V3; s: number } => {
    const r = (k: number) => rand(seed, i, k);
    const v = speed * (0.88 + 0.24 * r(0));
    const s = path.closed ? ((i + 0.7 * (r(1) - 0.5)) / count) * L + v * t : v * (t - start / FPS) - i * gap * (0.7 + 0.6 * r(1));
    const c = path.at(s);
    // a slow wander and a quicker flutter, each bat its own
    const w = (k: number, f0: number, f1: number) => Math.sin(TAU * t * (f0 + (f1 - f0) * r(k)) + TAU * r(k + 1));
    const off: V3 = [
      spread * (0.7 * w(2, 0.12, 0.3) + 0.3 * w(4, 0.35, 0.6)),
      spread * (0.45 * w(6, 0.15, 0.35) + 0.2 * w(8, 0.9, 1.5)),
      spread * (0.7 * w(10, 0.1, 0.28) + 0.3 * w(12, 0.3, 0.55)),
    ];
    return { p: [c[0] + off[0] + offset[0], c[1] + off[1] + offset[1], c[2] + off[2] + offset[2]], s };
  };
  const t = f / FPS;
  const dt = 1 / FPS;
  return Array.from({ length: count }, (_, i) => {
    const a = where(i, t - dt);
    const b = where(i, t);
    const c = where(i, t + dt);
    const fwd: V3 = [c.p[0] - a.p[0], c.p[1] - a.p[1], c.p[2] - a.p[2]];
    // the turn's lateral acceleration banks the bat into it
    const acc = new Vector3(a.p[0] - 2 * b.p[0] + c.p[0], a.p[1] - 2 * b.p[1] + c.p[1], a.p[2] - 2 * b.p[2] + c.p[2]).divideScalar(dt * dt);
    const fv = new Vector3(...fwd).normalize();
    const right = new Vector3().crossVectors(UP, fv).normalize();
    // and bats flutter: an erratic roll of their own (it shows the wings' planform now and then)
    const roll = 0.42 * Math.sin(TAU * t * (0.6 + 0.5 * rand(seed, i, 23)) + TAU * rand(seed, i, 24)) + 0.18 * Math.sin(TAU * t * (1.7 + 0.8 * rand(seed, i, 25)) + TAU * rand(seed, i, 26));
    const bank = Math.max(-0.95, Math.min(0.95, -0.16 * acc.dot(right) + roll));
    const visible = path.closed || (b.s >= 0 && b.s <= L);
    const rate = flap * (0.85 + 0.3 * rand(seed, i, 20));
    return { pos: b.p, fwd, bank, scale: size * (0.85 + 0.3 * rand(seed, i, 21)), phase: t * rate + rand(seed, i, 22), folded: 0, visible };
  });
}

/** A flock flying a path. */
export function BatFlock({ f, path, count, seed, size = 0.22, speed = 1.3, spread = 0.3, flap = 3.4, start = 0, gap = 0.45, offset = [0, 0, 0], eyes = true, fog = 1, lod }: BatFlockProps) {
  const ox = offset[0];
  const oy = offset[1];
  const oz = offset[2];
  const states = useMemo(() => flockStates(f, { path, count, seed, size, speed, spread, flap, start, gap, offset: [ox, oy, oz], eyes, fog }), [f, path, count, seed, size, speed, spread, flap, start, gap, ox, oy, oz, eyes, fog]);
  return <BatSwarm states={states} size={size} eyes={eyes} fog={fog} lod={lod} />;
}

// ---- the burst ------------------------------------------------------------------------------------

export interface BatBurstProps {
  /** the film frame */
  f: number;
  /** the frame the first bat squeezes out */
  start: number;
  /** the gap's centre (world) and the way out of it */
  origin: readonly [number, number, number];
  dir: readonly [number, number, number];
  count?: number;
  seed?: number;
  /** wingspan (world units), each ±15% */
  size?: number;
  /** the gap's half length along the horizontal across `dir` */
  gap?: number;
  /** speed once clear (units / s), the scatter cone's half angle (radians), the climb (units / s²) */
  speed?: number;
  scatter?: number;
  rise?: number;
  /** frames over which the bats leave, and how long each stays in the air (s) */
  stagger?: number;
  life?: number;
  eyes?: boolean;
  /** the storybook fog multiplier: low, so the bats stay dark against the book's pale fore-edge */
  fog?: number;
  /** BatSwarm's ambient share and paint brightness (on the desk: ambient 0.25, tone 0.6, so they read as silhouettes) */
  ambient?: number;
  tone?: number;
  /** the book's crack light on them (BatSwarm `crack`; the burst is the book's: on by default) */
  crack?: number;
}

/** Each burst bat's state at a frame. */
export function burstStates(f: number, o: Required<Omit<BatBurstProps, 'f' | 'fog' | 'ambient' | 'tone' | 'crack'>>): BatState[] {
  const { start, origin, dir, count, seed, size, gap, speed, scatter, rise, stagger, life } = o;
  const d0 = new Vector3(...dir).normalize();
  const across = new Vector3().crossVectors(d0, UP);
  if (across.lengthSq() < 1e-8) across.set(1, 0, 0);
  across.normalize();
  const upish = new Vector3().crossVectors(across, d0).normalize();
  const where = (i: number, tau: number): V3 => {
    const r = (k: number) => rand(seed, i, k);
    // its own way out: a cone round dir, a little more up than down
    const a = TAU * r(1);
    const c = scatter * Math.sqrt(r(2));
    const di = d0
      .clone()
      .addScaledVector(across, Math.cos(a) * Math.tan(c))
      .addScaledVector(upish, Math.abs(Math.sin(a)) * Math.tan(c) * 0.8 - 0.1 * Math.tan(c))
      .normalize();
    const v = speed * (0.8 + 0.4 * r(3));
    // squeezing out slowly, then away: the distance eases from a crawl into the cruise
    const dist = v * (tau - 0.16 * (1 - Math.exp(-tau / 0.16)));
    const g = (r(4) * 2 - 1) * gap;
    const wob = 0.18 * size * 4 * Math.sin(TAU * (1.1 + 0.6 * r(5)) * tau + TAU * r(6)) * smoothstep(0.1, 0.6, tau);
    return [
      origin[0] + across.x * (g + wob) + di.x * dist + UP.x * rise * tau * tau,
      origin[1] + across.y * (g + wob) + di.y * dist + rise * tau * tau * 0.5 + 0.5 * wob,
      origin[2] + across.z * (g + wob) + di.z * dist,
    ];
  };
  const dt = 1 / FPS;
  return Array.from({ length: count }, (_, i) => {
    // leaving one after another, bunched at the start
    const leave = start + stagger * (i / Math.max(1, count - 1)) ** 1.35 * (0.75 + 0.5 * rand(seed, i, 7));
    const tau = (f - leave) / FPS;
    const visible = tau >= 0 && tau <= life;
    const a = where(i, Math.max(0, tau) - dt);
    const b = where(i, Math.max(0, tau));
    const c = where(i, Math.max(0, tau) + dt);
    const fwd: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const folded = 1 - smoothstep(0.04, 0.22, tau);
    // squeezed small in the slit, then big as it bursts clear (1.3x for its first ~half second, so
    // the squeeze-out reads before they disperse), easing to its cruising size
    const grow = (0.55 + 0.45 * smoothstep(0, 0.12, tau)) * (1 + 0.3 * (1 - smoothstep(0.35, 0.8, tau)));
    const rate = 4.6 * (0.85 + 0.3 * rand(seed, i, 8));
    const bank = 0.35 * Math.sin(TAU * 0.7 * tau + TAU * rand(seed, i, 9));
    return { pos: b, fwd, bank, scale: size * (0.85 + 0.3 * rand(seed, i, 10)) * grow, phase: tau * rate + rand(seed, i, 11), folded, visible };
  });
}

/** Bats squeezing out of a gap and scattering (the film's opening). */
export function BatBurst({ f, start, origin, dir, count = 10, seed = 7, size = 0.5, gap = 0.6, speed = 3.0, scatter = 0.55, rise = 1.0, stagger = 20, life = 2.8, eyes = true, fog = 0.25, ambient = 1, tone = 1, crack = 1 }: BatBurstProps) {
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = dir;
  const states = useMemo(() => burstStates(f, { start, origin: [ox, oy, oz], dir: [dx, dy, dz], count, seed, size, gap, speed, scatter, rise, stagger, life, eyes }), [f, start, ox, oy, oz, dx, dy, dz, count, seed, size, gap, speed, scatter, rise, stagger, life, eyes]);
  return <BatSwarm states={states} size={size} eyes={eyes} fog={fog} color2="#0e0a0c" ambient={ambient} tone={tone} crack={crack} />;
}
