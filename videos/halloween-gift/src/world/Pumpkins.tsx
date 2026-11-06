/**
 * The film's pumpkins, built as real carved geometry (kit/pumpkin.ts), one mesh and one draw call
 * each (the rind, the cut faces, the cavity and the stem share a material; which surface a vertex
 * is on lives in its vertex colour and in uv.x, the emission ramp's index):
 *  - <BigPumpkin f lit />: the giant jack-o'-lantern at LAND.bigPumpkin, seated on world/Dressing's
 *    boulders (SEAT_HEIGHT), its angry face turned toward the path, three-quarter to the hero
 *    camera as in the reference. The film's one warm practical: a candle inside, as emission (the
 *    cavity orange-gold, hot yellow low by the flame; the cut walls through the shell brighter
 *    inward; the knife bevels dimly warm) plus exactly one point light, always mounted, low in the
 *    cavity toward the face, that lays the warm pool on the rocks and the ground in front. `lit` 0
 *    is a cold, dark-eyed gourd. A soft contact shadow darkens the boulder under it.
 *  - <Pumpkin seed scale lit f carve />: one small pumpkin of seeded shape (tall, squat, warty,
 *    smooth), carved "grin", "small", "angry" or "round", or "none" (a plain orange pumpkin); its
 *    bottom at the group's origin (or `position`), its face toward +z turned by `yaw`.
 *  - <PumpkinPatch f lit />: every layout SMALL_PUMPKINS (the stack by the gates, all three lit,
 *    the top one seated on the two below by raycasting; the lone one by the lane), MID_PUMPKIN
 *    (the reference's second jack-o'-lantern, left of the cauldron) and the two DOOR_FRONT porch
 *    pumpkins at the cottage, merged into one mesh; plus one mesh of soft contact shadows under them
 *    and one of warm pools in front of the lit ones (decals: no lights).
 *  - <PumpkinPail f lit />: Clawd's pail, a tiny jack-o'-lantern bucket with a wire handle (its
 *    bottom at the origin; PAIL.handle is where a hand holds it).
 * Every pumpkin material adds a cool sky rim from the screen's left (the reference's teal edge on
 * the pumpkin's shadow side) to the shared moon rim. The flicker is smooth low-frequency noise of
 * the frame (three sines, 1-3 Hz, at most 12 %), never stepped; the emission is HDR for the bloom.
 * No light but the giant's candle.
 */
import { rand } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CustomBlending,
  DstColorFactor,
  FrontSide,
  LinearFilter,
  Matrix4,
  Mesh,
  Ray,
  Raycaster,
  ShaderMaterial,
  Sphere,
  SRGBColorSpace,
  Vector3,
  ZeroFactor,
  type Material,
  type MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FPS } from '../cues.ts';
import { buildPumpkin, giantSpec, pailSpec, pumpkinHalf, smallSpec, tubeGeometry, type Carve, type PumpkinBuild, type V3 } from '../kit/pumpkin.ts';
import { NIGHT, storybookMaterial } from '../look/materials.ts';
import { SEAT_HEIGHT } from './Dressing.tsx';
import { DOOR_FRONT, FLOOR, fromHouse, HERO, LAND, SMALL_PUMPKINS, type Spot } from './layout.ts';
import { surfaceHeight } from './Terrain.tsx';

const TAU = Math.PI * 2;

/** The candle's flicker: 1 ± at most 0.12, three slow sines of the film time (smooth on ones). */
export function candleFlicker(f: number, seed = 0): number {
  const t = f / FPS;
  return 1 + 0.055 * Math.sin(TAU * 1.31 * t + seed * 1.7) + 0.04 * Math.sin(TAU * 2.13 * t + 0.6 + seed * 2.3) + 0.025 * Math.sin(TAU * 2.87 * t + 2.2 + seed * 0.9);
}

/**
 * The emission ramp (kit/pumpkin.ts's uv.x): the rind's faint glow toward a cut (0..0.1, barely
 * there), the knife bevel (0.16..0.26), the cut wall from the rind to its inner edge (0.38..0.7),
 * the cavity, orange high and far from the flame, hot yellow by it (0.72..1).
 */
const RAMP: [number, string][] = [
  // (an ember floor: the lit rind never goes cold grey, a faint warmth through the shell)
  [0, '#160700'],
  [0.15, '#44180a'],
  [0.2, '#56200a'],
  [0.26, '#64280c'],
  [0.38, '#7e3410'],
  [0.7, '#e07a1c'],
  [0.715, '#a4400c'],
  [0.84, '#e47e1c'],
  [0.94, '#f8b03e'],
  [1, '#ffe08c'],
];
/** the small pumpkins glow yellower (cream-gold faces at a distance, as the reference's stack) */
const SMALL_RAMP: [number, string][] = [
  [0, '#140700'],
  [0.12, '#401808'],
  [0.16, '#4e1e08'],
  [0.26, '#66300a'],
  [0.38, '#8e4210'],
  [0.7, '#f0a640'],
  [0.715, '#d07a20'],
  [0.84, '#f4ac44'],
  [0.94, '#ffd070'],
  [1, '#fff0b0'],
];

/** A 1D gradient (256 × 1) that uv.x looks up. */
function ramp(stops: [number, string][]): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 256, 0);
  for (const [t, col] of stops) gr.addColorStop(t, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 1);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.generateMipmaps = false;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  return t;
}

// ---- the sky rim: the storybook material's shader plus a cool edge light from the screen's left ----

const RIM_LINE = 'outgoingLight += uSbRimColor * edge * toward * behind * uSbRim * uSbRimMul * diffuseColor.a;';
const SKY_PARS = 'uniform vec3 uPkSky;\nuniform vec3 uPkSkyDir;\n';
const SKY_RIM = /* glsl */ `
  {
    // the sky's teal edge on the side away from the moon (view space: from the screen's left)
    // (a narrow edge: a broad one turned the whole shadow side grey-blue plastic)
    float skyEdge = pow(max(1.0 - facing, 0.0), 3.2);
    float skyTo = smoothstep(-0.15, 0.75, dot(normal, uPkSkyDir));
    outgoingLight += uPkSky * skyEdge * skyTo * diffuseColor.a;
  }`;

interface SkyData {
  sbInject: (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => void;
  pkSky: { value: Color };
  pkSkyDir: { value: Vector3 };
}

/** One module-level injection for every pumpkin material (the storybook one, then the sky rim). */
function pumpkinInject(this: MeshStandardMaterial, shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer): void {
  const ud = this.userData as unknown as SkyData;
  ud.sbInject.call(this, shader, renderer);
  shader.uniforms.uPkSky = ud.pkSky;
  shader.uniforms.uPkSkyDir = ud.pkSkyDir;
  if (!shader.fragmentShader.includes(RIM_LINE)) throw new Error('pumpkin sky rim: the storybook rim line moved');
  shader.fragmentShader = SKY_PARS + shader.fragmentShader.replace(RIM_LINE, RIM_LINE + SKY_RIM);
}

interface PumpkinPaint {
  mat: MeshStandardMaterial;
  ramp: CanvasTexture;
}

/** A pumpkin's paint (`size`: its width, for the noise scale): the rind's furrows run up the ribs. */
function pumpkinPaint(size: number, rim = 1, stops: [number, string][] = RAMP, sky = 0.2): PumpkinPaint {
  const r = ramp(stops);
  // a dry, pitted rind (a stronger, finer bump; a warm brown breakup), never glossy
  const mat = storybookMaterial({ kind: 'bark', vertexColors: true, color: '#ffffff', color2: '#6a3412', breakup: 0.24, scale: size * 0.07, bump: 1.3, rim, roughness: 0.84, emissive: '#ffffff', emissiveMap: r, emissiveIntensity: 0 });
  const key = mat.customProgramCacheKey();
  const ud = mat.userData as unknown as SkyData;
  ud.sbInject = mat.onBeforeCompile;
  ud.pkSky = { value: new Color('#5f8fa8').multiplyScalar(sky) };
  ud.pkSkyDir = { value: new Vector3(-1, 0.4, -0.05).normalize() };
  mat.onBeforeCompile = pumpkinInject;
  mat.customProgramCacheKey = () => `${key}:pk`;
  return { ramp: r, mat };
}

function disposePaint(p: PumpkinPaint) {
  p.mat.dispose();
  p.ramp.dispose();
}

/** The emission at full light (HDR multiplier of the ramp). */
const GLOW = 2.4;
const SMALL_GLOW = 3.6;

// ---- decals: soft contact shadows (multiplied) and warm pools (added), no lights ------------------

const DECAL_VERT = /* glsl */ `
attribute float aAmt;
varying vec2 vQ;
varying float vAmt;
varying float vFade;
void main() {
  vQ = uv;
  vAmt = aAmt;
  vec4 w = modelMatrix * vec4(position, 1.0);
  // fade with distance: far off, the fogged ground must not show an unfogged dark spot
  vFade = 1.0 - smoothstep(5.0, 16.0, length(w.xyz - cameraPosition));
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const SHADOW_FRAG = /* glsl */ `
uniform vec3 uTint;
varying vec2 vQ;
varying float vAmt;
varying float vFade;
void main() {
  float r = length(vQ);
  float a = 1.0 - smoothstep(0.3, 1.0, r);
  gl_FragColor = vec4(mix(vec3(1.0), uTint, a * a * vAmt * vFade), 1.0);
}
`;
const POOL_FRAG = /* glsl */ `
uniform vec3 uWarm;
uniform float uK;
varying vec2 vQ;
varying float vAmt;
varying float vFade;
void main() {
  float r = length(vQ);
  float a = 1.0 - smoothstep(0.0, 1.0, r);
  gl_FragColor = vec4(uWarm * a * a * vAmt * uK * vFade, 1.0);
}
`;

interface Disc {
  x: number;
  z: number;
  /** half extents along its own x and z, its turn */
  rx: number;
  rz: number;
  yaw: number;
  amt: number;
  /** a fixed height (a flat disc on a rock), or null to follow the terrain */
  y: number | null;
}

/** Polar-grid discs laid on the terrain (or flat at a height), uv the disc's own coordinates (−1..1). */
function discGeometry(discs: Disc[]): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const amt: number[] = [];
  const idx: number[] = [];
  const RINGS = 5;
  const SEG = 18;
  for (const d of discs) {
    const base = pos.length / 3;
    const c = Math.cos(d.yaw);
    const s = Math.sin(d.yaw);
    for (let r = 0; r <= RINGS; r++)
      for (let k = 0; k < (r === 0 ? 1 : SEG); k++) {
        const a = (k / SEG) * TAU;
        const q = r / RINGS;
        const lx = Math.cos(a) * q;
        const lz = Math.sin(a) * q;
        const x = d.x + (lx * d.rx * c + lz * d.rz * s);
        const z = d.z + (-lx * d.rx * s + lz * d.rz * c);
        const y = d.y ?? FLOOR + surfaceHeight(x, z) + 0.004;
        pos.push(x, y, z);
        uv.push(lx, lz);
        amt.push(d.amt);
      }
    const ring = (r: number, k: number) => (r === 0 ? base : base + 1 + (r - 1) * SEG + (k % SEG));
    for (let k = 0; k < SEG; k++) idx.push(ring(0, 0), ring(1, k + 1), ring(1, k));
    for (let r = 1; r < RINGS; r++)
      for (let k = 0; k < SEG; k++) idx.push(ring(r, k), ring(r, k + 1), ring(r + 1, k + 1), ring(r, k), ring(r + 1, k + 1), ring(r + 1, k));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('aAmt', new BufferAttribute(new Float32Array(amt), 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Contact shadows: the scene's colour multiplied toward a dark plum (no depth write). */
function shadowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: DECAL_VERT,
    fragmentShader: SHADOW_FRAG,
    uniforms: { uTint: { value: new Color('#2a1c2c') } },
    blending: CustomBlending,
    blendSrc: DstColorFactor,
    blendDst: ZeroFactor,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** Warm pools of candle light on the ground in front of lit pumpkins (added; `uK` the flicker). */
function poolMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: DECAL_VERT,
    fragmentShader: POOL_FRAG,
    uniforms: { uWarm: { value: new Color('#ff8a30').multiplyScalar(0.22) }, uK: { value: 1 } },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

// ---- the giant ----------------------------------------------------------------------------------

/** The giant's width across (world units). */
export const BIG_WIDTH = 1.2;
/** how far its face turns past LAND.bigPumpkin.yaw, toward the path (the reference's three-quarter face: about 35° right of the hero camera) */
const FACE_TURN = 0.45;
/** how far its seat sinks into the boulder's top */
const SINK = 0.035;
/** the candle: the film's one warm practical light */
const CANDLE = { color: '#ff9a48', intensity: 0.65, distance: 2.5, decay: 2 };

export function BigPumpkin({ f, lit = 1 }: { f: number; lit?: number }) {
  const P = LAND.bigPumpkin;
  const seat = FLOOR + surfaceHeight(P.x, P.z) + SEAT_HEIGHT;
  const built = useMemo(() => {
    // the moon's side (+x, toward it across the view) in the pumpkin's own frame: the side away,
    // screen-left in the hero view, is painted cool
    const yaw = (P.yaw ?? 0) + FACE_TURN;
    const m = { x: Math.sign(NIGHT.uSbMoonDir.value.x) || 1, y: 0.25, z: 0 };
    const shade: V3 = [m.x * Math.cos(yaw) - m.z * Math.sin(yaw), m.y, m.x * Math.sin(yaw) + m.z * Math.cos(yaw)];
    const b = buildPumpkin({ ...giantSpec(11, BIG_WIDTH), shade });
    const contact = discGeometry([{ x: P.x, z: P.z, rx: BIG_WIDTH * 0.5, rz: BIG_WIDTH * 0.45, yaw: (P.yaw ?? 0) + FACE_TURN, amt: 0.9, y: seat + 0.018 }]);
    return { b, paint: pumpkinPaint(BIG_WIDTH, 0.9, RAMP, 0.7), contact, shadow: shadowMaterial() };
  }, [P.x, P.z, P.yaw, seat]);
  useLayoutEffect(
    () => () => {
      built.b.geometry.dispose();
      disposePaint(built.paint);
      built.contact.dispose();
      built.shadow.dispose();
    },
    [built],
  );
  const k = Math.max(0, lit) * candleFlicker(f, 2);
  useLayoutEffect(() => {
    built.paint.mat.emissiveIntensity = GLOW * k;
  }, [built, k]);
  const y = seat - SINK - built.b.bottom;
  return (
    <>
      <group position={[P.x, y, P.z]} rotation-y={(P.yaw ?? 0) + FACE_TURN}>
        <mesh geometry={built.b.geometry} material={built.paint.mat} castShadow receiveShadow />
        <pointLight position={built.b.candle} color={CANDLE.color} intensity={CANDLE.intensity * k} distance={CANDLE.distance} decay={CANDLE.decay} castShadow={false} />
      </group>
      <mesh geometry={built.contact} material={built.shadow} renderOrder={2} />
    </>
  );
}

// ---- small pumpkins -----------------------------------------------------------------------------

export interface PumpkinProps {
  seed: number;
  /** width across (world units) */
  scale: number;
  lit?: number;
  f: number;
  carve?: Carve;
  position?: V3;
  yaw?: number;
}

/** One small pumpkin; its bottom at the origin (or `position`), its face toward +z turned by `yaw`. */
export function Pumpkin({ seed, scale, lit = 1, f, carve = 'grin', position = [0, 0, 0], yaw = 0 }: PumpkinProps) {
  const built = useMemo(() => ({ b: buildPumpkin(smallSpec(seed, scale, carve)), paint: pumpkinPaint(scale, 1, SMALL_RAMP) }), [seed, scale, carve]);
  useLayoutEffect(
    () => () => {
      built.b.geometry.dispose();
      disposePaint(built.paint);
    },
    [built],
  );
  const k = Math.max(0, lit) * candleFlicker(f, seed);
  useLayoutEffect(() => {
    built.paint.mat.emissiveIntensity = SMALL_GLOW * k;
  }, [built, k]);
  return (
    <group position={position} rotation-y={yaw}>
      <mesh geometry={built.b.geometry} material={built.paint.mat} position-y={-built.b.bottom} castShadow receiveShadow />
    </group>
  );
}

/** Where the patch's pumpkins stand: world position of the bottom, yaw, width, carve, seed. */
export interface PatchItem {
  x: number;
  y: number;
  z: number;
  yaw: number;
  width: number;
  carve: Carve;
  seed: number;
  lit: boolean;
  /** resting on others (the stack's top): no contact shadow on the ground */
  onTop?: boolean;
  /** the carving's size (the stack's faces are cut big, to read at the hero distance) */
  face?: number;
}

/**
 * The reference's second jack-o'-lantern (layout.ts LAND.midPumpkin), lit and toothy, in front of
 * the cauldron and left of it in the hero view, clear of the path (0.54 from its centre line:
 * half-width 0.30 + its own 0.2).
 */
export const MID_PUMPKIN: Spot & { lit: boolean; carve: Carve } = { ...LAND.midPumpkin, lit: true, carve: 'angry' };
/** the gate stack is drawn this much bigger than layout's sizes (its faces read at the hero distance) */
const STACK_SCALE = 1.4;
/** the carves, in SMALL_PUMPKINS order (the stack's three, the lane's one), and the porch's two */
const SMALL_CARVES: Carve[] = ['angry', 'grin', 'round', 'small'];
const PORCH_CARVES: Carve[] = ['round', 'angry'];
/** how much further out from the door (house-local x) the porch pumpkins sit than DOOR_FRONT.porchPumpkins */
const PORCH_OUT = 0.1;

/** The yaw that turns a face (+z) toward a point, with a seeded wander. */
const faceToward = (x: number, z: number, tx: number, tz: number, j: number) => Math.atan2(tx - x, tz - z) + j;

/**
 * The patch: the stack by the gates (the two larger on the ground, the smallest resting on them;
 * all three lit and carved), the lone one by the lane, the mid-ground one left of the cauldron,
 * the two porch pumpkins either side of the cottage's door. The stack's top is seated here on an
 * analytic estimate; PumpkinPatch refines it by raycasting the built meshes.
 */
export function patchItems(porch = true): PatchItem[] {
  const out: PatchItem[] = [];
  const [cx, , cz] = HERO.pos;
  // halfway between the true ground at the centre and the lowest under a ring (on a slope the
  // downhill side touches, the uphill side sinks in a little), so no base floats
  const seat = (x: number, z: number, r: number) => {
    const c = FLOOR + surfaceHeight(x, z);
    let m = c;
    for (let k = 0; k < 8; k++) m = Math.min(m, FLOOR + surfaceHeight(x + Math.cos(k * 0.785) * r, z + Math.sin(k * 0.785) * r));
    return (c + m) / 2 - 0.012;
  };
  SMALL_PUMPKINS.forEach((p, i) => {
    const seed = 40 + i;
    const stack = i < 3;
    const lit = stack || p.lit;
    const carve: Carve = lit ? SMALL_CARVES[i] : 'none';
    const w = (p.scale ?? 0.2) * (stack ? STACK_SCALE : 1);
    out.push({ x: p.x, y: seat(p.x, p.z, w * 0.3), z: p.z, yaw: faceToward(p.x, p.z, cx, cz, (rand(seed, 'yaw') - 0.5) * 0.7), width: w, carve, seed, lit, face: stack ? 1.2 : 1 });
  });
  {
    const m = MID_PUMPKIN;
    const w = m.scale ?? 0.4;
    out.push({ x: m.x, y: seat(m.x, m.z, w * 0.3), z: m.z, yaw: faceToward(m.x, m.z, cx, cz, -0.25), width: w, carve: m.carve, seed: 48, lit: m.lit });
  }
  // the stack: the smallest rests in the saddle of its two neighbours (squat ellipsoids touching)
  const by = [...out.slice(0, 3)].sort((a, b) => b.width - a.width);
  const top = by[2];
  top.onTop = true;
  const half = (it: PatchItem) => pumpkinHalf(smallSpec(it.seed, it.width, it.carve, it.face));
  const ht = half(top);
  let lift = -Infinity;
  for (let k = 0; k < 64; k++) {
    // a point under the top pumpkin (sunflower spiral over 80 % of its radius)
    const rr = ht.a * 0.8 * Math.sqrt((k + 0.5) / 64);
    const an = k * 2.39996;
    const px = top.x + Math.cos(an) * rr;
    const pz = top.z + Math.sin(an) * rr;
    const under = ht.c * Math.sqrt(Math.max(0, 1 - (rr / ht.a) ** 2));
    for (const b of by.slice(0, 2)) {
      const hb = half(b);
      const d = Math.hypot(px - b.x, pz - b.z);
      if (d >= hb.a) continue;
      const surf = b.y + hb.c + hb.c * Math.sqrt(1 - (d / hb.a) ** 2);
      lift = Math.max(lift, surf + under - ht.c);
    }
  }
  if (lift > -Infinity) top.y = Math.max(top.y, lift - 0.01);
  if (porch) {
    DOOR_FRONT.porchPumpkins.forEach((p, i) => {
      // a little further out from the door than DOOR_FRONT's places: in the door shots Clawd's arm
      // stub merged with the right one and its stem rose into the couplet's last character
      const [x, , z] = fromHouse([p[0] + Math.sign(p[0]) * PORCH_OUT, p[1], p[2]]);
      const seed = 60 + i;
      const w = i ? 0.2 : 0.24;
      out.push({ x, y: seat(x, z, w * 0.3), z, yaw: (LAND.house.yaw ?? 0) + (i ? -0.35 : 0.35) + (rand(seed, 'yaw') - 0.5) * 0.3, width: w, carve: PORCH_CARVES[i], seed, lit: true });
    });
  }
  return out;
}

/** Place a build at an item (in place: rotate, then lift its bottom to item.y). */
function place(b: PumpkinBuild, item: PatchItem) {
  b.geometry.rotateY(item.yaw);
  b.geometry.translate(item.x, item.y - b.bottom, item.z);
  b.geometry.computeBoundingSphere();
  b.geometry.computeBoundingBox();
}

/**
 * `raycaster.intersectObject(mesh, false)` for a ray straight down, with the same hits in the same
 * order (bit-identical: three's own bounding tests and triangle test, the same distances, the same
 * stable sort), but only the triangles whose (x, z) bounds hold the ray are tested: a grid over
 * x, z lists them (each bound widened by 1e-6, far beyond the triangle test's rounding). Mesh.raycast
 * tries every triangle of a 15k-triangle pumpkin for each of a few thousand rays. Non-indexed
 * geometry without groups only (anything else goes to three).
 */
class DownCast {
  private readonly cells: Int32Array[] = [];
  private readonly x0: number;
  private readonly z0: number;
  private readonly nx: number;
  private readonly nz: number;
  private readonly exact: boolean;
  private static readonly CELL = 0.01;
  private static readonly PAD = 1e-6;
  private readonly sphere = new Sphere();
  private readonly local = new Ray();
  private readonly inverse = new Matrix4();
  private readonly at = new Vector3();
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly c = new Vector3();
  private readonly point = new Vector3();
  private readonly world = new Vector3();
  constructor(private readonly mesh: Mesh) {
    const g = mesh.geometry;
    const p = g.attributes.position;
    this.exact = g.index === null && g.groups.length === 0 && !g.morphAttributes.position && !Array.isArray(mesh.material) && g.drawRange.start === 0 && g.drawRange.count === Infinity;
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < p.count; i++) {
      x0 = Math.min(x0, p.getX(i));
      x1 = Math.max(x1, p.getX(i));
      z0 = Math.min(z0, p.getZ(i));
      z1 = Math.max(z1, p.getZ(i));
    }
    const C = DownCast.CELL;
    const D = DownCast.PAD;
    this.x0 = x0 - 2 * D;
    this.z0 = z0 - 2 * D;
    this.nx = Math.max(1, Math.ceil((x1 - x0 + 4 * D) / C) + 1);
    this.nz = Math.max(1, Math.ceil((z1 - z0 + 4 * D) / C) + 1);
    if (!this.exact) return;
    const lists: number[][] = Array.from({ length: this.nx * this.nz }, () => []);
    for (let t = 0; t + 2 < p.count; t += 3) {
      const ax = p.getX(t);
      const bx = p.getX(t + 1);
      const cx = p.getX(t + 2);
      const az = p.getZ(t);
      const bz = p.getZ(t + 1);
      const cz = p.getZ(t + 2);
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - D - this.x0) / C));
      const i1 = Math.min(this.nx - 1, Math.floor((Math.max(ax, bx, cx) + D - this.x0) / C));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - D - this.z0) / C));
      const j1 = Math.min(this.nz - 1, Math.floor((Math.max(az, bz, cz) + D - this.z0) / C));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) lists[j * this.nx + i].push(t);
    }
    for (const l of lists) this.cells.push(Int32Array.from(l));
  }
  /** The hits of a downward ray (raycaster.ray), nearest first: as intersectObject(mesh, false) gives them. */
  hits(raycaster: Raycaster): { distance: number; point: Vector3 }[] {
    const { mesh, sphere, local } = this;
    const ray = raycaster.ray;
    if (!this.exact || ray.direction.x !== 0 || ray.direction.z !== 0 || !mesh.layers.test(raycaster.layers)) return raycaster.intersectObject(mesh, false);
    const geometry = mesh.geometry;
    const material = mesh.material as Material;
    if (material === undefined) return [];
    // (Mesh.raycast's early-outs, as it does them)
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
    sphere.copy(geometry.boundingSphere!);
    sphere.applyMatrix4(mesh.matrixWorld);
    local.copy(ray).recast(raycaster.near);
    if (sphere.containsPoint(local.origin) === false) {
      if (local.intersectSphere(sphere, this.at) === null) return [];
      if (local.origin.distanceToSquared(this.at) > (raycaster.far - raycaster.near) ** 2) return [];
    }
    this.inverse.copy(mesh.matrixWorld).invert();
    local.copy(ray).applyMatrix4(this.inverse);
    if (geometry.boundingBox !== null && local.intersectsBox(geometry.boundingBox) === false) return [];
    const out: { distance: number; point: Vector3 }[] = [];
    // the local ray is vertical too (a rigid or identity matrix keeps it so; anything else goes to three)
    if (local.direction.x !== 0 || local.direction.z !== 0) return raycaster.intersectObject(mesh, false);
    const i = Math.floor((local.origin.x - this.x0) / DownCast.CELL);
    const j = Math.floor((local.origin.z - this.z0) / DownCast.CELL);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return out;
    const p = geometry.attributes.position;
    const cull = material.side === FrontSide;
    for (const t of this.cells[j * this.nx + i]) {
      this.a.fromBufferAttribute(p, t);
      this.b.fromBufferAttribute(p, t + 1);
      this.c.fromBufferAttribute(p, t + 2);
      const hit = material.side === BackSide ? local.intersectTriangle(this.c, this.b, this.a, true, this.point) : local.intersectTriangle(this.a, this.b, this.c, cull, this.point);
      if (hit === null) continue;
      this.world.copy(this.point).applyMatrix4(mesh.matrixWorld);
      const distance = ray.origin.distanceTo(this.world);
      if (distance < raycaster.near || distance > raycaster.far) continue;
      out.push({ distance, point: this.world.clone() });
    }
    out.sort((u, v) => u.distance - v.distance);
    return out;
  }
}

/** Seat the stack's top on the two built below it: the most any of its low vertices must rise (bodies only: no stems). */
function seatOnTop(top: { b: PumpkinBuild; item: PatchItem }, below: { b: PumpkinBuild; item: PatchItem }[]) {
  const meshes = below.map((q) => {
    const m = new Mesh(q.b.geometry);
    return { m, cast: new DownCast(m), roof: q.item.y + (q.b.top - q.b.bottom) + 0.004 };
  });
  const ray = new Raycaster();
  const p = top.b.geometry.attributes.position;
  let minY = Infinity;
  for (let i = 0; i < p.count; i++) minY = Math.min(minY, p.getY(i));
  const h = pumpkinHalf(smallSpec(top.item.seed, top.item.width, top.item.carve, top.item.face)).c * 2;
  let lift = -Infinity;
  const dir = new Vector3(0, -1, 0);
  for (let i = 0; i < p.count; i += 5) {
    const y = p.getY(i);
    if (y > minY + h * 0.35) continue;
    ray.set(new Vector3(p.getX(i), y + 2, p.getZ(i)), dir);
    for (const { cast, roof } of meshes)
      for (const hit of cast.hits(ray))
        if (hit.point.y <= roof) {
          lift = Math.max(lift, hit.point.y - y);
          break;
        }
  }
  if (lift > -Infinity) {
    const d = lift - 0.006;
    top.b.geometry.translate(0, d, 0);
    top.item.y += d;
  }
}

/** Every layout SMALL_PUMPKINS, the mid-ground one and (with `porch`) the porch pumpkins: one mesh. */
export function PumpkinPatch({ f, lit = 1, porch = true }: { f: number; lit?: number; porch?: boolean }) {
  const built = useMemo(() => {
    const items = patchItems(porch);
    const builds = items.map((item) => {
      const b = buildPumpkin(smallSpec(item.seed, item.width, item.carve, item.face));
      place(b, item);
      return { b, item };
    });
    const topI = builds.findIndex((q) => q.item.onTop);
    if (topI >= 0) seatOnTop(builds[topI], builds.filter((q, i) => i < 3 && i !== topI));
    const geo = mergeGeometries(
      builds.map((q) => q.b.geometry),
      false,
    );
    builds.forEach((q) => q.b.geometry.dispose());
    geo.computeBoundingSphere();
    // contact shadows under the ones on the ground; warm pools in front of the lit ones
    const shadows: Disc[] = [];
    const pools: Disc[] = [];
    for (const it of items) {
      if (!it.onTop) shadows.push({ x: it.x, z: it.z, rx: it.width * 0.72, rz: it.width * 0.66, yaw: it.yaw, amt: 0.75, y: null });
      if (it.lit) pools.push({ x: it.x + Math.sin(it.yaw) * it.width * 0.75, z: it.z + Math.cos(it.yaw) * it.width * 0.75, rx: it.width * 1.1, rz: it.width * 0.8, yaw: it.yaw, amt: it.onTop ? 0.5 : 1, y: null });
    }
    return { geo, paint: pumpkinPaint(0.22, 1, SMALL_RAMP, 0.2), shadowGeo: discGeometry(shadows), poolGeo: discGeometry(pools), shadow: shadowMaterial(), pool: poolMaterial() };
  }, [porch]);
  useLayoutEffect(
    () => () => {
      built.geo.dispose();
      disposePaint(built.paint);
      built.shadowGeo.dispose();
      built.poolGeo.dispose();
      built.shadow.dispose();
      built.pool.dispose();
    },
    [built],
  );
  const k = Math.max(0, lit) * candleFlicker(f, 5) * 0.85;
  useLayoutEffect(() => {
    built.paint.mat.emissiveIntensity = SMALL_GLOW * k;
    built.pool.uniforms.uK.value = k;
  }, [built, k]);
  return (
    <>
      <mesh geometry={built.geo} material={built.paint.mat} castShadow receiveShadow />
      <mesh geometry={built.shadowGeo} material={built.shadow} renderOrder={2} />
      <mesh geometry={built.poolGeo} material={built.pool} renderOrder={3} />
    </>
  );
}

// ---- Clawd's pail -------------------------------------------------------------------------------

const PAIL_W = 0.1;
const PAIL_SEED = 77;

/** The pail's measures (local, its bottom at the origin): the rim's height, the handle's top where a hand holds it. */
export const PAIL = (() => {
  const s = pailSpec(PAIL_SEED, PAIL_W);
  const a = PAIL_W / 2;
  const c = a * s.squat;
  const rimY = c * 0.9 + c * Math.sin(s.openTop ?? 0.6);
  return { width: PAIL_W, rimY, handle: [0, rimY + a * 1.05, 0] as V3 };
})();

/** The wire handle: an arc from ear to ear over the open top (local to the pail's bottom). */
function handleGeometry(): BufferGeometry {
  const a = PAIL_W / 2;
  const y0 = PAIL.rimY - 0.004;
  const pts: V3[] = [];
  for (let i = 0; i <= 12; i++) {
    const ang = Math.PI * (1 - i / 12);
    pts.push([Math.cos(ang) * a * 0.86, y0 + Math.sin(ang) * a * 1.05, 0.004 * Math.sin(ang * 3)]);
  }
  const wire = new Color('#2e2c2a');
  return tubeGeometry({ points: pts, segments: 24, sides: 5, radius: () => 0.0028, color: () => [wire.r, wire.g, wire.b, 0.25] });
}

export function PumpkinPail({ f, lit = 1 }: { f: number; lit?: number }) {
  const built = useMemo(() => {
    const b = buildPumpkin(pailSpec(PAIL_SEED, PAIL_W));
    b.geometry.translate(0, -b.bottom, 0);
    const handle = handleGeometry();
    const geo = mergeGeometries([b.geometry, handle], false);
    b.geometry.dispose();
    handle.dispose();
    return { geo, paint: pumpkinPaint(PAIL_W, 1, SMALL_RAMP) };
  }, []);
  useLayoutEffect(
    () => () => {
      built.geo.dispose();
      disposePaint(built.paint);
    },
    [built],
  );
  const k = Math.max(0, lit) * candleFlicker(f, 9) * 0.7;
  useLayoutEffect(() => {
    built.paint.mat.emissiveIntensity = SMALL_GLOW * k;
  }, [built, k]);
  return <mesh geometry={built.geo} material={built.paint.mat} castShadow receiveShadow />;
}

/** Triangle counts (for the budget). */
export function pumpkinStats(): Record<string, number> {
  const big = buildPumpkin(giantSpec(11, BIG_WIDTH));
  const patch = patchItems(true).map((it) => buildPumpkin(smallSpec(it.seed, it.width, it.carve, it.face)).triangles);
  const pail = buildPumpkin(pailSpec(PAIL_SEED, PAIL_W));
  return { big: big.triangles, patch: patch.reduce((a, b) => a + b, 0), pail: pail.triangles };
}
