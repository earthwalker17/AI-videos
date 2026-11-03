/**
 * The ground of the world: one displaced grid over the open page, its heights from
 * world/layout.ts (the hill, mounds, lumps, the carved path) plus the ground's own small detail
 * (`surfaceDetail`: cart ruts and worn banks along the track, grave mounds, rough turf toward
 * the fence, puddle hollows), coloured per vertex (moonlit turf with darker hollows and bare
 * patches, the track's muddy dirt with wet and dry patches, and at the margin the printed page it
 * grows out of), shaded by the storybook material in two groups (turf; dirt with a finer bump).
 *
 * The track: the walking path widened into a trodden dirt track in the foreground, plus the
 * APRON, a wide muddy foot of the track that runs from the path down toward the viewer, so the
 * hero view's lower centre is dirt (as in the reference). Its ragged edges blend into the turf.
 * One or two puddles in the ruts catch the sky (dark, glossy, a cool fresnel sheen).
 *
 * The grid is finer (4.6 cm) where the cameras look closely (the graveyard, the track, the
 * lane) and coarser (12 cm) at the back and the margins: about 92k triangles. `grow` (0..1)
 * raises it out of the flat page as the book opens (one smooth scale of the heights).
 *
 * Other families place things with layout's `groundHeight`; the detail stays within a few
 * centimetres of it (ruts −2.5 cm, banks and mounds +1..3 cm) so nothing floats. The dressing
 * and the grass use `surfaceHeight` (the true surface). All of them sample the ground through
 * `ground`, an exact, faster replica of layout's groundHeight (checked against it when this
 * module loads; on any mismatch it falls back to layout's own). The door's yard
 * (DOOR_FRONT.yard, `yardMask`) is kept clear: short grass, no stones or leaves.
 */
import { mix32, smoothstep } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, CircleGeometry, Color, Matrix4, Vector3, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bump, fbm2 } from '../kit/field.ts';
import { Curve, type P2 } from '../kit/spline.ts';
import { storybookMaterial } from '../look/materials.ts';
import { DOOR_FRONT, FENCE_LINE, FENCE_LINE_RIGHT, FLOOR, groundHeight, houseFrame, LAND, PAGE, pageMask, PATH, pathDistance, pathHalfWidth, STONES } from './layout.ts';

// ---- fast, exact replicas of the layout's ground (verified when this module loads) ------------
// layout's groundHeight costs ~90 µs a call (a 200-segment polyline scan with Math.hypot, and
// rest-argument hashing in the noise); the terrain, the grass and the dressing sample the ground
// a few hundred thousand times. These give bit-identical results much faster: the same noise
// with the hash inlined, the same nearest-segment search over a grid of candidate lists. If the
// layout changes and they no longer match, everything falls back to layout's own functions.

const HK = 0x632be5ab;
function hashI3(a: number, b: number, c: number): number {
  let h = 0x9e3779b9;
  h = mix32(h ^ mix32((a | 0) + HK));
  h = mix32(h ^ mix32((b | 0) + HK));
  return mix32(h ^ mix32((c | 0) + HK));
}
/** = @aiv/core valueNoise */
function vnoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const h00 = hashI3(seed, xi, zi) / 4294967296;
  const h10 = hashI3(seed, xi + 1, zi) / 4294967296;
  const h01 = hashI3(seed, xi, zi + 1) / 4294967296;
  const h11 = hashI3(seed, xi + 1, zi + 1) / 4294967296;
  const a = h00 + (h10 - h00) * u;
  const b = h01 + (h11 - h01) * u;
  return a + (b - a) * v;
}
const OCT_C = Array.from({ length: 8 }, (_, o) => Math.cos(o * 1.7));
const OCT_S = Array.from({ length: 8 }, (_, o) => Math.sin(o * 1.7));
/** = kit/field fbm2 (bit-identical, faster) */
export function fbm(x: number, z: number, seed: number, octaves = 4, freq = 1, gain = 0.5): number {
  let s = 0;
  let a = 1;
  let norm = 0;
  let f = freq;
  for (let o = 0; o < octaves; o++) {
    const c = OCT_C[o];
    const sn = OCT_S[o];
    const u = (x * c - z * sn) * f + o * 17.3;
    const v = (x * sn + z * c) * f - o * 9.1;
    s += a * (vnoise(u, v, seed + o * 101) * 2 - 1);
    norm += a;
    a *= gain;
    f *= 2.03;
  }
  return s / norm;
}

/** Nearest point on a polyline (= kit/spline distanceToPolyline), over a grid of candidate segments. */
class NearLine {
  private readonly ax: Float64Array;
  private readonly az: Float64Array;
  private readonly vx: Float64Array;
  private readonly vz: Float64Array;
  private readonly l2: Float64Array;
  private readonly seg: Float64Array;
  private readonly acc: Float64Array;
  private readonly cells: Int32Array[] = [];
  private readonly x0: number;
  private readonly z0: number;
  private readonly nx: number;
  private readonly nz: number;
  private readonly cs: number;
  d = 0;
  s = 0;
  px = 0;
  pz = 0;
  /** unit direction of the nearest segment */
  tx = 0;
  tz = 0;
  constructor(line: readonly (readonly number[])[], cs = 0.25) {
    this.cs = cs;
    const n = line.length - 1;
    this.ax = new Float64Array(n);
    this.az = new Float64Array(n);
    this.vx = new Float64Array(n);
    this.vz = new Float64Array(n);
    this.l2 = new Float64Array(n);
    this.seg = new Float64Array(n);
    this.acc = new Float64Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const [ax, az] = line[i];
      const [bx, bz] = line[i + 1];
      this.ax[i] = ax;
      this.az[i] = az;
      this.vx[i] = bx - ax;
      this.vz[i] = bz - az;
      this.l2[i] = this.vx[i] * this.vx[i] + this.vz[i] * this.vz[i] || 1e-12;
      this.seg[i] = Math.sqrt(this.l2[i]);
      this.acc[i] = acc;
      acc += this.seg[i];
    }
    this.x0 = -PAGE.w / 2 - 0.5;
    this.z0 = -PAGE.d / 2 - 0.5;
    this.nx = Math.ceil((PAGE.w + 1) / cs);
    this.nz = Math.ceil((PAGE.d + 1) / cs);
    const half = (cs * Math.SQRT2) / 2;
    const ds = new Float64Array(n);
    for (let j = 0; j < this.nz; j++)
      for (let i = 0; i < this.nx; i++) {
        const cx = this.x0 + (i + 0.5) * cs;
        const cz = this.z0 + (j + 0.5) * cs;
        let m = Infinity;
        for (let k = 0; k < n; k++) {
          ds[k] = this.segDist(k, cx, cz);
          if (ds[k] < m) m = ds[k];
        }
        const list: number[] = [];
        for (let k = 0; k < n; k++) if (ds[k] - half <= m + half + 1e-9) list.push(k);
        this.cells.push(Int32Array.from(list));
      }
  }
  private segDist(k: number, x: number, z: number): number {
    const t = Math.min(1, Math.max(0, ((x - this.ax[k]) * this.vx[k] + (z - this.az[k]) * this.vz[k]) / this.l2[k]));
    return Math.hypot(x - (this.ax[k] + this.vx[k] * t), z - (this.az[k] + this.vz[k] * t));
  }
  /** Sets d, s (arc length), the nearest point and its segment's direction. */
  query(x: number, z: number): this {
    const i = Math.floor((x - this.x0) / this.cs);
    const j = Math.floor((z - this.z0) / this.cs);
    const list = i >= 0 && j >= 0 && i < this.nx && j < this.nz ? this.cells[j * this.nx + i] : null;
    let best = Infinity;
    let bk = 0;
    let bt = 0;
    const n = list ? list.length : this.ax.length;
    for (let q = 0; q < n; q++) {
      const k = list ? list[q] : q;
      const t = Math.min(1, Math.max(0, ((x - this.ax[k]) * this.vx[k] + (z - this.az[k]) * this.vz[k]) / this.l2[k]));
      const d = Math.hypot(x - (this.ax[k] + this.vx[k] * t), z - (this.az[k] + this.vz[k] * t));
      if (d < best) {
        best = d;
        bk = k;
        bt = t;
      }
    }
    this.d = best;
    this.s = this.acc[bk] + bt * this.seg[bk];
    this.px = this.ax[bk] + this.vx[bk] * bt;
    this.pz = this.az[bk] + this.vz[bk] * bt;
    this.tx = this.vx[bk] / this.seg[bk];
    this.tz = this.vz[bk] / this.seg[bk];
    return this;
  }
}

const PATH_NEAR = new NearLine(PATH.polyline(200));

/** = layout's rawHeight */
function rawFast(x: number, z: number): number {
  const hill = 0.05 + 0.75 * smoothstep(1.4, -3.4, z) + 0.2 * bump(x, z, LAND.house.x, LAND.house.z, 2.6);
  const back = 0.35 * bump(x, z, LAND.crag.x, LAND.crag.z + 0.4, 2.8);
  const mounds = 0.2 * bump(x, z, LAND.ghostTree.x, LAND.ghostTree.z, 1.5) + 0.2 * bump(x, z, -5.0, 3.7, 2.3) + 0.26 * bump(x, z, 5.8, 3.9, 2.4) - 0.06 * bump(x, z, -0.6, 2.2, 1.8);
  const lumps = 0.055 * fbm(x, z, 31, 4, 0.55) + 0.018 * fbm(x, z, 32, 3, 2.4);
  return hill + back + mounds + lumps;
}
/** = layout's groundHeight */
function groundFast(x: number, z: number): number {
  const h = rawFast(x, z);
  const { d, s } = PATH_NEAR.query(x, z);
  const w = pathHalfWidth(s);
  const t = smoothstep(w * 1.7, w * 0.7, d);
  if (t === 0) return h * pageMask(x, z);
  const p = PATH.pointAt(s);
  const along = rawFast(p[0], p[1]) - 0.03;
  return (h * (1 - t) + along * t) * pageMask(x, z);
}

/** True when the replicas match the layout exactly at a few hundred points (else: the layout's own). */
const FAST = (() => {
  for (let k = 0; k < 400; k++) {
    const x = -PAGE.w / 2 + ((k * 0.6180339887) % 1) * PAGE.w;
    const z = -PAGE.d / 2 + ((k * 0.7548776662) % 1) * PAGE.d;
    if (groundFast(x, z) !== groundHeight(x, z) || fbm(x, z, 7, 3, 1.3) !== fbm2(x, z, 7, 3, 1.3)) return false;
    const a = pathDistance(x, z);
    PATH_NEAR.query(x, z);
    if (a.d !== PATH_NEAR.d || a.s !== PATH_NEAR.s) return false;
  }
  return true;
})();
if (!FAST) console.warn('[Terrain] fast ground replicas disagree with layout.ts: using the layout (slow); update Terrain.tsx');

/** Layout's ground height above FLOOR (fast). */
export const ground: (x: number, z: number) => number = FAST ? groundFast : groundHeight;
/** Layout's path distance (fast): d, s, the nearest point and the path's direction there. */
function nearPath(x: number, z: number): NearLine {
  const q = PATH_NEAR.query(x, z);
  if (!FAST) {
    const a = pathDistance(x, z);
    q.d = a.d;
    q.s = a.s;
  }
  return q;
}

// ---- the ground's shading: a layer over the storybook material ---------------------------------
// The storybook material (look/materials.ts) gives every surface the film's paint, rim and fog;
// the ground's surfaces add a few terms of their own on top of it, injected after it (one
// module-level function, keyed by defines, so every variant gets its own program):
//  - sheen: moonlight scattered forward through grass and dew when looking toward the low moon
//    (the moonlit turf of the reference glows as a mass, not blade by blade);
//  - shade: the ambient light turned plum (the reference's warm darks near the lens);
//  - wrap: a soft warm wrap-around fill from the viewer's side (fronts keep their value);
//  - grain: a fine bump (2-5 cm) that fades out below a pixel;
//  - wet: wet patches and streaks along the track (vertex aGrWet, direction aGrDir): darker and
//    glossy, so the low moon catches thin wet lines;
//  - water: the puddles' surface: fresnel reflection of the sky's colours and the moon's glow;
//  - fade (grass): with distance, blade contrast and moon-catching tips fade into the turf.

export interface GroundShading {
  sheen?: number;
  shade?: [string, number];
  wrap?: [string, number];
  /** world units per grain feature, bump amplitude */
  grain?: [number, number];
  wet?: boolean;
  /** grain as combed strokes (matted grass), in the albedo too */
  comb?: boolean;
  water?: number;
  /** grass: distances (from the camera) over which blades fade into the turf */
  fade?: [number, number];
}

type Inject = (this: MeshStandardMaterial, shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => void;
/** The storybook material's own injection (taken from a throwaway material). */
const SB_INJECT: Inject = (() => {
  const m = storybookMaterial();
  const f = m.onBeforeCompile as Inject;
  m.dispose();
  return f;
})();

/** Toward the viewer's side and a little above: where the wrap fill comes from (world). */
const WRAP_DIR = new Vector3(-0.2, 0.45, 1).normalize();

const GR_VERT_PARS = /* glsl */ `
varying float vGrWet;
varying vec2 vGrDir;
varying float vGrFade;
uniform vec2 uGrFade;
#ifdef GR_WET
attribute float aGrWet;
attribute vec2 aGrDir;
#endif
`;

const GR_VERT_COLOR = /* glsl */ `
#include <color_vertex>
vGrFade = 0.0;
#ifdef GR_FADE
{
  vec4 grW = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  grW = instanceMatrix * grW;
  #endif
  grW = modelMatrix * grW;
  vGrFade = smoothstep(uGrFade.x, uGrFade.y, distance(grW.xyz, cameraPosition));
  #if defined(USE_COLOR) && defined(USE_INSTANCING_COLOR)
  vColor.xyz = mix(vColor.xyz, instanceColor.xyz * 0.78, vGrFade * 0.85);
  #endif
}
#endif
`;

const GR_VERT_NORMAL = /* glsl */ `
#include <beginnormal_vertex>
#ifdef GR_FADE
objectNormal = normalize(mix(objectNormal, vec3(0.0, 1.0, 0.0), vGrFade * 0.9));
#endif
`;

const GR_VERT_END = /* glsl */ `
#include <fog_vertex>
#ifdef GR_WET
vGrWet = aGrWet;
vGrDir = aGrDir;
#else
vGrWet = 0.0;
vGrDir = vec2(1.0, 0.0);
#endif
`;

const GR_FRAG_PARS = /* glsl */ `
varying float vGrWet;
varying vec2 vGrDir;
varying float vGrFade;
uniform float uGrSheen;
uniform vec3 uGrShadeCol;
uniform float uGrShade;
uniform vec3 uGrWrapCol;
uniform vec3 uGrWrapDir;
uniform vec2 uGrGrain;
uniform float uGrWater;
vec3 grPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sx = normalize(dFdx(surfPos));
  vec3 sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
void main() {`;

const GR_FRAG_ROUGH = /* glsl */ `
#include <roughnessmap_fragment>
#ifdef GR_WET
{
  vec2 d = normalize(vGrDir + vec2(1e-4, 0.0));
  vec2 q = vec2(dot(vSbWorld.xz, d), dot(vSbWorld.xz, vec2(-d.y, d.x)));
  // long thin wet streaks along the track (wheel and foot worn), and wet spots
  float streak = aivFbm3(vec3(q.x * 2.4, q.y * 24.0, 0.5));
  float spots = aivFbm3(vec3(vSbWorld.xz * 4.0, 1.7));
  float wet = clamp(vGrWet + smoothstep(0.6, 0.74, streak) * (0.3 + 0.7 * vGrWet) + smoothstep(0.64, 0.78, spots) * 0.35, 0.0, 1.0);
  roughnessFactor = mix(roughnessFactor, 0.3, wet);
  diffuseColor.rgb *= 1.0 - 0.45 * wet;
}
#endif
`;

const GR_FRAG_GRAIN = /* glsl */ `
#ifdef GR_GRAIN
{
  // two octaves of value noise, each fading out before it is a pixel wide (no sparkle in the wet speculars)
  float fw = length(fwidth(vSbWorld)) / uGrGrain.x;
  vec3 q = vSbWorld / uGrGrain.x;
  #ifdef GR_COMB
  // matted grass: strokes combed along z (seen from the cameras, upright strokes), in the albedo too
  vec3 qc = vec3(vSbWorld.x / (uGrGrain.x * 0.3), vSbWorld.y / uGrGrain.x, vSbWorld.z / (uGrGrain.x * 1.6));
  float fwc = length(fwidth(vSbWorld)) / (uGrGrain.x * 0.3);
  float comb = aivNoise3(qc) * (1.0 - smoothstep(0.15, 0.6, fwc));
  diffuseColor.rgb *= 0.65 + 0.7 * comb * (1.0 - smoothstep(0.15, 0.6, fwc)) + 0.35 * smoothstep(0.15, 0.6, fwc);
  float h = comb + 0.5 * aivNoise3(q) * (1.0 - smoothstep(0.12, 0.45, fw));
  #else
  float h = aivNoise3(q) * (1.0 - smoothstep(0.12, 0.45, fw)) + 0.45 * aivNoise3(q * 2.3 + 3.1) * (1.0 - smoothstep(0.05, 0.2, fw));
  #endif
  float det = 1.0;
  vec2 dh = vec2(dFdx(h), dFdy(h)) * uGrGrain.y * det;
  normal = grPerturb(-vViewPosition, normal, dh, faceDirection);
}
#endif
#include <emissivemap_fragment>
`;

const GR_FRAG_LIGHT = /* glsl */ `
#include <lights_fragment_end>
{
  vec3 grV = normalize(vViewPosition);
  vec3 grL = normalize((viewMatrix * vec4(uSbMoonDir, 0.0)).xyz);
#ifdef GR_SHADE
  float grLum = dot(reflectedLight.indirectDiffuse, vec3(0.2126, 0.7152, 0.0722));
  reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, grLum * uGrShadeCol, uGrShade);
#endif
#ifdef GR_WRAP
  vec3 grW = normalize((viewMatrix * vec4(uGrWrapDir, 0.0)).xyz);
  float grWr = clamp((dot(normal, grW) + 0.7) / 1.7, 0.0, 1.0);
  reflectedLight.indirectDiffuse += diffuseColor.rgb * uGrWrapCol * grWr * grWr;
#endif
#ifdef GR_SHEEN
  float grFwd = pow(max(dot(-grV, grL), 0.0), 4.0);
  float grNv = clamp(dot(normal, grV), 0.0, 1.0);
  float grG = 1.0 - grNv;
  reflectedLight.indirectDiffuse += diffuseColor.rgb * uSbRimColor * uSbRim * uGrSheen * grFwd * grG * grG * grG;
#endif
#ifdef GR_WATER
  {
    // ripples: a small wobble of the normal (the reflection breaks into streaks, it is not a mirror decal)
    float grRp = aivNoise3(vec3(vSbWorld.x * 22.0, uSbTime * 0.4, vSbWorld.z * 9.0)) + 0.5 * aivNoise3(vec3(vSbWorld.x * 51.0, 3.0, vSbWorld.z * 23.0));
    vec3 grN = grPerturb(-vViewPosition, normal, vec2(dFdx(grRp), dFdy(grRp)) * 0.004, faceDirection);
    vec3 grR = reflect(-grV, grN);
    vec3 grRw = normalize((vec4(grR, 0.0) * viewMatrix).xyz);
    float grF = 0.03 + 0.97 * pow(1.0 - clamp(dot(grN, grV), 0.0, 1.0), 5.0);
    // the sky's colours by the reflected ray's height, brighter toward the moon
    vec3 grSky = mix(uSbFogMid * 0.9, uSbFogNear * 0.8, smoothstep(0.02, 0.5, grRw.y));
    grSky += uSbMoonGlow * pow(max(dot(grRw, uSbMoonDir), 0.0), 8.0) * 1.2;
    // the moon's glitter: near its azimuth, stretched toward the viewer
    float grAz = 1.0 - dot(normalize(grRw.xz + 1e-5), normalize(uSbMoonDir.xz));
    float grEl = grRw.y - uSbMoonDir.y;
    grSky += uSbMoonGlow * 2.5 * exp(-grAz / 0.0025) * exp(-grEl * grEl / 0.12);
    reflectedLight.indirectSpecular += grSky * grF * uGrWater;
  }
#endif
}
`;

/** The ground's injection: the storybook's, then the ground's own terms (by defines). */
function groundInject(this: MeshStandardMaterial, shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer): void {
  SB_INJECT.call(this, shader, renderer);
  shader.vertexShader = GR_VERT_PARS + shader.vertexShader.replace('#include <color_vertex>', GR_VERT_COLOR).replace('#include <beginnormal_vertex>', GR_VERT_NORMAL).replace('#include <fog_vertex>', GR_VERT_END);
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', GR_FRAG_PARS)
    .replace('#include <roughnessmap_fragment>', GR_FRAG_ROUGH)
    .replace('#include <emissivemap_fragment>', GR_FRAG_GRAIN)
    .replace('#include <lights_fragment_end>', GR_FRAG_LIGHT);
}

/** A colour scaled to luminance 1 (the shade keeps the ambient's brightness, only its hue turns). */
function unitLuma(c: Color): Color {
  return c.multiplyScalar(1 / Math.max(1e-4, 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b));
}

/** Add the ground's shading terms to a storybook material (in place; returns it). */
export function groundShading<M extends MeshStandardMaterial>(m: M, o: GroundShading): M {
  const sb = (m.userData as { sb: Record<string, { value: unknown }> }).sb;
  Object.assign(sb, {
    uGrSheen: { value: o.sheen ?? 0 },
    uGrShadeCol: { value: unitLuma(new Color(o.shade?.[0] ?? '#ffffff')) },
    uGrShade: { value: o.shade?.[1] ?? 0 },
    uGrWrapCol: { value: new Color(o.wrap?.[0] ?? '#000000').multiplyScalar(o.wrap?.[1] ?? 0) },
    uGrWrapDir: { value: WRAP_DIR.clone() },
    uGrGrain: { value: [o.grain?.[0] ?? 0.04, o.grain?.[1] ?? 0] },
    uGrWater: { value: o.water ?? 0 },
    uGrFade: { value: [o.fade?.[0] ?? 1e3, o.fade?.[1] ?? 2e3] },
  });
  const defs: Record<string, number> = {};
  if (o.sheen) defs.GR_SHEEN = 1;
  if (o.shade) defs.GR_SHADE = 1;
  if (o.wrap) defs.GR_WRAP = 1;
  if (o.grain) defs.GR_GRAIN = 1;
  if (o.wet) defs.GR_WET = 1;
  if (o.comb) defs.GR_COMB = 1;
  if (o.water) defs.GR_WATER = 1;
  if (o.fade) defs.GR_FADE = 1;
  m.defines = { ...(m.defines ?? {}), ...defs };
  const key = m.customProgramCacheKey();
  m.onBeforeCompile = groundInject;
  m.customProgramCacheKey = () => `${key}:gr:${Object.keys(defs).sort().join(',')}`;
  return m;
}

// ---- the door's yard (kept flat and clear for the door beats) --------------------------------

const HOUSE_INV = new Matrix4().copy(houseFrame()).invert();
const _v = new Vector3();
/** 1 inside the yard in front of the last house's door (DOOR_FRONT.yard), fading over `soft`. */
export function yardMask(x: number, z: number, soft = 0.15): number {
  _v.set(x, 0, z).applyMatrix4(HOUSE_INV);
  const { x: yx, z: yz } = DOOR_FRONT.yard;
  const ex = Math.min(_v.x - yx[0], yx[1] - _v.x);
  const ez = Math.min(_v.z - yz[0], yz[1] - _v.z);
  return smoothstep(-soft, soft, Math.min(ex, ez));
}

// ---- the track ------------------------------------------------------------------------------

/**
 * The apron: the track's muddy foot, from the path (s ≈ 1.9) down toward the viewer. It leaves
 * the path narrow, squeezes between the grave plots of the slab at (0.6, 3.35) and the round
 * stone at (1.7, 2.75), and opens wide toward the lens (the reference's lane: narrow as it
 * climbs, wide at the bottom of the frame, turf banks on both sides).
 */
export const APRON = new Curve<P2>([
  [1.0, 2.2],
  [1.08, 2.75],
  [1.13, 3.3],
  [1.06, 3.9],
  [0.92, 4.6],
  [0.82, 5.3],
]);
const APRON_NEAR = new NearLine(APRON.polyline(80));

/** The apron's half width at its arc length (narrow where it leaves the path, wide at the lens). */
function apronHalf(s: number): number {
  return 0.2 + 0.1 * smoothstep(0.0, 0.6, s) + 0.68 * smoothstep(1.0, 1.9, s);
}

// ---- grave plots: turf around every stone and its mound (the track flows around them) ---------

interface Plot {
  x: number;
  z: number;
  /** facing (unit, toward the mound) */
  fx: number;
  fz: number;
  /** half extents along the facing and across */
  ra: number;
  rb: number;
}

const PLOTS: Plot[] = [...STONES, { kind: 'round' as const, x: LAND.ripStone.x, z: LAND.ripStone.z, h: 0.85, yaw: LAND.ripStone.yaw ?? 0, lean: 0 }].map((s) => {
  const hs = s.h / 0.5;
  const fx = Math.sin(s.yaw);
  const fz = Math.cos(s.yaw);
  // the stone and the mound in front of it (graveMound), with a margin of turf
  const broken = s.kind === 'broken';
  const ahead = broken ? 0 : 0.16 * hs;
  return { x: s.x + fx * ahead, z: s.z + fz * ahead, fx, fz, ra: broken ? 0.24 : 0.34 * Math.max(0.8, hs) + 0.1, rb: broken ? 0.22 : 0.27 };
});

/** Signed distance (world units, about) to the nearest grave plot: negative inside. */
export function plotDistance(x: number, z: number): number {
  let best = Infinity;
  for (const p of PLOTS) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (Math.abs(dx) > 1.6 || Math.abs(dz) > 1.6) continue;
    const a = (dx * p.fx + dz * p.fz) / p.ra;
    const b = (dx * p.fz - dz * p.fx) / p.rb;
    best = Math.min(best, (Math.hypot(a, b) - 1) * Math.min(p.ra, p.rb));
  }
  return best;
}

/** The dirt's half width along the path: wider than the walked path in the foreground, the path's own past the gates. */
export function dirtHalf(s: number): number {
  return pathHalfWidth(s) * (1 + 0.45 * (1 - smoothstep(2.4, 4.6, s)) + 0.25 * bump(s, 0, 0, 0, 0.9));
}

/** Ragged edge noise (world units), shared by the terrain, the grass and the dressing. */
function edgeNoise(x: number, z: number): number {
  return 0.075 * fbm(x, z, 91, 3, 5.5) + 0.03 * fbm(x, z, 92, 2, 17);
}

export interface TrackInfo {
  /** 1 on the dirt, 0 on the turf (ragged edge) */
  m: number;
  /** signed offset across the path (+ to the walker's right), and its arc length */
  u: number;
  s: number;
  /** distance from the dirt's edge (negative inside), on the path's track or the apron, whichever is nearer */
  edge: number;
  /** offset across the apron and its arc length, and how much this point is apron (0..1) */
  ua: number;
  sa: number;
  apron: number;
}

/** Where (x, z) sits on the track. */
export function trackAt(x: number, z: number): TrackInfo {
  const np = nearPath(x, z);
  const d = np.d;
  const s = np.s;
  // + to the right when walking along the path (tangent (tx, tz) turned clockwise: (−tz, tx))
  const u = (x - np.px) * -np.tz + (z - np.pz) * np.tx;
  const a = APRON_NEAR.query(x, z);
  const ua = (x - a.px) * -a.tz + (z - a.pz) * a.tx;
  const sa = a.s;
  const rp = d - dirtHalf(s);
  const ra = a.d - apronHalf(sa);
  // the ragged edge's noise matters only near the track
  const e = Math.min(rp, ra) < 0.8 ? edgeNoise(x, z) : 0;
  const ep = rp + e;
  const ea = ra + e;
  // the grave plots stay turf: the dirt's edge runs around them
  const edge = Math.max(Math.min(ep, ea), -plotDistance(x, z) + 0.6 * e);
  const m = smoothstep(0.05, -0.05, edge) * pageMask(x, z) ** 0.5;
  const apron = smoothstep(0.1, -0.15, ea - ep) * smoothstep(0.1, -0.05, ea);
  return { m, u, s, edge, ua, sa, apron };
}

/** How much (x, z) is dirt (1) or turf (0): no grass on it. */
export function dirtMask(x: number, z: number): number {
  return trackAt(x, z).m;
}

// ---- puddles --------------------------------------------------------------------------------

export interface Puddle {
  x: number;
  z: number;
  /** half extents along and across its yaw */
  rx: number;
  rz: number;
  yaw: number;
}

function onTrack(s: number, u: number): [number, number] {
  const p = PATH.pointAt(s);
  const t = PATH.tangentAt(s);
  return [p[0] - t[1] * u, p[1] + t[0] * u];
}
function onApron(s: number, u: number): [number, number] {
  const p = APRON.pointAt(s);
  const t = APRON.tangentAt(s);
  return [p[0] - t[1] * u, p[1] + t[0] * u];
}
const yawOf = (c: Curve<P2>, s: number) => {
  const t = c.tangentAt(s);
  return Math.atan2(t[1], t[0]);
};

/** Puddles in the ruts: one on the path where it turns toward the gates, one where the apron opens, small ones on the path. */
export const PUDDLES: Puddle[] = [
  { ...xz(onTrack(2.35, -0.15)), rx: 0.26, rz: 0.1, yaw: -yawOf(PATH, 2.35) },
  { ...xz(onApron(1.62, 0.2)), rx: 0.3, rz: 0.12, yaw: -yawOf(APRON, 1.62) },
  { ...xz(onTrack(0.55, 0.12)), rx: 0.13, rz: 0.07, yaw: -yawOf(PATH, 0.55) },
  { ...xz(onTrack(1.5, -0.14)), rx: 0.16, rz: 0.06, yaw: -yawOf(PATH, 1.5) },
];
function xz(p: [number, number]): { x: number; z: number } {
  return { x: p[0], z: p[1] };
}

/** 0..1 inside a puddle's hollow (1 at its centre). */
/** The nearest puddle's normalised radius at (x, z) (1 at its hollow's edge; large far away). */
function puddleR(x: number, z: number): number {
  let best = 9;
  for (const p of PUDDLES) {
    const c = Math.cos(p.yaw);
    const sn = Math.sin(p.yaw);
    const dx = x - p.x;
    const dz = z - p.z;
    const a = (dx * c - dz * sn) / (p.rx * 1.25);
    const b = (dx * sn + dz * c) / (p.rz * 1.25);
    if (a * a + b * b > 3.2) continue;
    best = Math.min(best, Math.hypot(a, b) + 0.12 * fbm(x, z, 97, 2, 9));
  }
  return best;
}
/** 0..1 inside a puddle's hollow (1 at its centre). */
function puddleHollow(x: number, z: number): number {
  return smoothstep(1, 0.35, puddleR(x, z));
}

// ---- the surface ------------------------------------------------------------------------------

const FENCES = [new NearLine(FENCE_LINE, 0.4), new NearLine(FENCE_LINE_RIGHT, 0.4)];
/** Distance to the nearest fence line. */
export function fenceDistance(x: number, z: number): number {
  return Math.min(FENCES[0].query(x, z).d, FENCES[1].query(x, z).d);
}

/** The grave mound in front of each stone: 0..1. */
export function graveMound(x: number, z: number): number {
  let m = 0;
  for (const s of STONES) {
    if (s.kind === 'broken') continue;
    const fx = Math.sin(s.yaw);
    const fz = Math.cos(s.yaw);
    const cx = s.x + fx * 0.36 * (s.h / 0.5);
    const cz = s.z + fz * 0.36 * (s.h / 0.5);
    const a = ((x - cx) * fx + (z - cz) * fz) / (0.34 * Math.max(0.8, s.h / 0.5));
    const b = ((x - cx) * fz - (z - cz) * fx) / 0.19;
    const r2 = a * a + b * b;
    if (r2 > 1.6) continue;
    const q = r2 + 0.3 * fbm(x, z, 103, 2, 6);
    if (q < 1) m = Math.max(m, (1 - q) ** 0.8);
  }
  return m;
}

/** The ground's own detail on top of layout's height (world units, within a few cm). */
export function surfaceDetail(x: number, z: number, tr: TrackInfo = trackAt(x, z)): number {
  const pm = pageMask(x, z);
  if (pm <= 0) return 0;
  // the track: trodden a little below the turf, a worn bank at its edge, two cart ruts
  let h = tr.edge < 0.3 ? 0.006 * Math.exp(-(((tr.edge - 0.02) / 0.06) ** 2)) * (0.5 + 0.5 * fbm(x, z, 104, 2, 3)) : 0;
  if (tr.m > 0) {
    const along = 0.55 + 0.45 * fbm(tr.s * 1.7, 0.3, 93, 2, 1);
    const off = 0.15 + 0.02 * fbm(tr.s, 1.1, 94, 2, 1.3);
    const rutP = Math.exp(-(((Math.abs(tr.u) - off) / 0.05) ** 2)) * along * (1 - tr.apron);
    const offA = 0.2 + 0.03 * fbm(tr.sa, 2.1, 95, 2, 1.1);
    const rutA = tr.apron > 0 ? Math.exp(-(((Math.abs(tr.ua) - offA) / 0.06) ** 2)) * (0.6 + 0.4 * fbm(tr.sa * 1.5, 0.7, 96, 2, 1)) * tr.apron : 0;
    const tread = 0.0045 * fbm(x, z, 98, 3, 7);
    h += tr.m * (-0.008 - 0.017 * Math.max(rutP, rutA) + tread);
  }
  // puddle hollows
  h -= 0.016 * puddleHollow(x, z);
  // turf: grave mounds, a rougher hill toward the fence, small tussocky lumps
  const turf = 1 - tr.m;
  const fence = smoothstep(1.4, 0.15, fenceDistance(x, z));
  h += turf * (0.032 * graveMound(x, z) + (0.006 + 0.018 * fence) * fbm(x, z, 99, 3, 3.2) + 0.004 * fbm(x, z, 100, 2, 11));
  return h * pm;
}

/** The true surface height above FLOOR at (x, z) (layout's height plus the ground's detail). */
export function surfaceHeight(x: number, z: number, tr?: TrackInfo): number {
  return ground(x, z) + surfaceDetail(x, z, tr ?? trackAt(x, z));
}

/** Bare earth patches in the turf (0..1): no grass there, the turf's earth shows. */
export function bareMask(x: number, z: number, tr?: TrackInfo): number {
  const n = fbm(x, z, 101, 3, 1.3) + 0.35 * fbm(x, z, 102, 2, 4.5);
  // a little more bare ground by the track, never on the grave plots, never on the far hill
  const near = smoothstep(0.5, 0.0, (tr ?? trackAt(x, z)).edge) * 0.1;
  const plot = smoothstep(0.0, 0.3, plotDistance(x, z));
  return smoothstep(0.5 - near, 0.68 - near, n) * smoothstep(-0.6, 1.2, z) * plot;
}

// ---- the mesh ---------------------------------------------------------------------------------

/** Grid coordinates from min to max: `fine` spacing inside [a, b], `coarse` outside, smooth between. */
function axis(min: number, max: number, a: number, b: number, fine: number, coarse: number): number[] {
  const w = (x: number) => smoothstep(a - 0.8, a, x) * smoothstep(b + 0.8, b, x);
  const out = [min];
  let x = min;
  while (x < max - 1e-6) {
    x += coarse + (fine - coarse) * w(x);
    out.push(x);
  }
  const k = (max - min) / (out[out.length - 1] - min);
  return out.map((v) => min + (v - min) * k);
}

const PAPER = new Color('#cfc2a2');
const TURF_DARK = new Color('#16252e');
const TURF = new Color('#2a4a56');
const TURF_LIT = new Color('#6aa2ad');
const TURF_NEAR = new Color('#262833');
const EARTH = new Color('#2a2326');
const DIRT = new Color('#382c31');
const DIRT_DRY = new Color('#54474a');
const DIRT_WET = new Color('#140e10');
const DIRT_NEAR = new Color('#45212c');
const ROCK = new Color('#393b48');

/** The turf's colour at (x, z): patchy, long sweeps of light and dark, lighter on crests (relief > 0) and up the moonlit hill, darker in hollows. */
export function turfColor(x: number, z: number, g: number, relief = 0, out = new Color()): Color {
  const patch = 0.5 + 0.5 * fbm(x, z, 41, 3, 0.8);
  const sw = turfSweep(x, z);
  const hill = smoothstep(0.15, 0.75, g);
  out.copy(TURF_DARK).lerp(TURF, 0.3 + 0.7 * patch).lerp(TURF_LIT, hill * (0.45 + 0.35 * patch) + 0.3 * Math.max(0, relief) + 0.2 * Math.max(0, sw));
  // near the lens the turf darkens toward a plum grey (the cool grass on it carries the light)
  out.lerp(TURF_NEAR, smoothstep(2.0, 4.0, z) * 0.55);
  return out.multiplyScalar(Math.max(0.55, 1 + 0.25 * sw) * (1 + 0.25 * Math.min(0, relief)));
}

/** Long sweeps of light and dark across the turf (along the hill's contours, climbing a little to the left): about −1..1. */
export function turfSweep(x: number, z: number): number {
  const u = x * 0.94 + z * 0.34;
  const v = -x * 0.34 + z * 0.94;
  return 1.3 * (0.7 * fbm(u * 0.21, v * 0.62, 47, 3, 1) + 0.3 * fbm(u * 0.55, v * 1.5, 48, 2, 1));
}

export function terrainGeometry(): BufferGeometry {
  const xs = axis(-PAGE.w / 2, PAGE.w / 2, -3.4, 5.0, 0.046, 0.12);
  const zs = axis(-PAGE.d / 2, PAGE.d / 2, -1.8, 4.7, 0.046, 0.12);
  const nx = xs.length;
  const nz = zs.length;
  const n = nx * nz;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const dirt = new Float32Array(n);
  const bareK = new Float32Array(n);
  const base = new Float32Array(n);
  const height0 = new Float32Array(n);
  const tracks: TrackInfo[] = new Array(n);
  const wet = new Float32Array(n);
  const dir = new Float32Array(n * 2);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = xs[i];
      const z = zs[j];
      const tr = trackAt(x, z);
      tracks[k] = tr;
      const g = ground(x, z);
      const h = g + surfaceDetail(x, z, tr);
      pos[k * 3] = x;
      pos[k * 3 + 1] = h;
      pos[k * 3 + 2] = z;
      height0[k] = h;
      base[k] = g;
      dirt[k] = tr.m;
    }
  // relief: height against a blurred neighbourhood (crests light, hollows dark)
  const blur = (src: Float32Array, r: number) => {
    const a = new Float32Array(n);
    const b = new Float32Array(n);
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        let s = 0;
        let c = 0;
        for (let q = Math.max(0, i - r); q <= Math.min(nx - 1, i + r); q++) {
          s += src[j * nx + q];
          c++;
        }
        a[j * nx + i] = s / c;
      }
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        let s = 0;
        let c = 0;
        for (let q = Math.max(0, j - r); q <= Math.min(nz - 1, j + r); q++) {
          s += a[q * nx + i];
          c++;
        }
        b[j * nx + i] = s / c;
      }
    return b;
  };
  const smoothH = blur(height0, 7);
  const c = new Color();
  const tmp = new Color();
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = xs[i];
      const z = zs[j];
      const h = height0[k];
      const relief = Math.max(-1, Math.min(1, (h - smoothH[k]) / 0.025));
      turfColor(x, z, base[k], relief, c);
      // bare earth patches and the fresh earth of the grave mounds
      const bare = bareMask(x, z, tracks[k]);
      bareK[k] = bare;
      c.lerp(EARTH, Math.max(bare * 0.85, graveMound(x, z) * 0.15));
      // rock where the ground climbs to the crag
      const rocky = smoothstep(2.6, 1.2, Math.hypot(x - LAND.crag.x, z - LAND.crag.z)) * 0.8;
      c.lerp(ROCK, rocky);
      // the dirt: wet and dry patches, wetter in the ruts and in a ring around the puddles, plum near the lens
      const m = dirt[k];
      if (m > 0) {
        const rut = smoothstep(0.002, -0.016, h - base[k] + 0.008);
        const ring = smoothstep(1.6, 1.0, puddleR(x, z));
        const wetV = Math.min(1, smoothstep(0.05, 0.55, fbm(x, z, 43, 3, 1.6)) * 0.45 + rut * 0.65 + ring);
        const dry = Math.min(1, smoothstep(0.05, 0.7, fbm(x, z, 44, 3, 2.3)) * 0.6 + Math.max(0, relief) * 0.3);
        tmp.copy(DIRT).lerp(DIRT_DRY, dry * 0.75 * (1 - wetV)).lerp(DIRT_WET, wetV * 0.7);
        tmp.lerp(DIRT_NEAR, smoothstep(2.3, 4.0, z) * 0.6 * (1 - dry * 0.4));
        tmp.lerp(DIRT_DRY, smoothstep(0.25, 0.7, base[k]) * 0.6);
        c.lerp(tmp, m);
        wet[k] = wetV * m * (1 - 0.7 * smoothstep(0.3, 0.7, base[k]));
        const tr = tracks[k];
        const tp = PATH.tangentAt(tr.s);
        const ta = APRON.tangentAt(tr.sa);
        const dx = tp[0] * (1 - tr.apron) + ta[0] * tr.apron;
        const dz = tp[1] * (1 - tr.apron) + ta[1] * tr.apron;
        const dl = Math.hypot(dx, dz) || 1;
        dir[k * 2] = dx / dl;
        dir[k * 2 + 1] = dz / dl;
      } else {
        dir[k * 2] = 1;
      }
      // contact darkness under the big landmarks that sit on the ground
      const under = Math.max(bump(x, z, LAND.bigPumpkin.x, LAND.bigPumpkin.z, 1.0) * 0.55, bump(x, z, LAND.roots.x + 0.22, LAND.roots.z - 0.06, 1.35) * 0.7, bump(x, z, LAND.ghostTree.x, LAND.ghostTree.z, 0.8) * 0.5, bump(x, z, LAND.oldTree.x, LAND.oldTree.z, 0.7) * 0.45, bump(x, z, LAND.bigCross.x, LAND.bigCross.z, 0.7) * 0.4);
      c.multiplyScalar(1 - under);
      // the printed page at the margin
      c.lerp(PAPER, 1 - pageMask(x, z));
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
    }
  // two index groups: turf (0) and dirt (1, every quad touching the track or a puddle)
  const turfIdx: number[] = [];
  const dirtIdx: number[] = [];
  for (let j = 0; j < nz - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const cc = a + nx;
      const d = cc + 1;
      const isDirt = Math.max(dirt[a], dirt[b], dirt[cc], dirt[d]) > 0.01 || Math.max(bareK[a], bareK[b], bareK[cc], bareK[d]) > 0.35;
      const out = isDirt ? dirtIdx : turfIdx;
      // split along the shorter-height diagonal (fewer creases across the ruts)
      if (Math.abs(height0[a] - height0[d]) < Math.abs(height0[b] - height0[cc])) out.push(a, cc, d, a, d, b);
      else out.push(a, cc, b, b, cc, d);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setAttribute('aGrWet', new BufferAttribute(wet, 1));
  g.setAttribute('aGrDir', new BufferAttribute(dir, 2));
  const index = new Uint32Array(turfIdx.length + dirtIdx.length);
  index.set(turfIdx, 0);
  index.set(dirtIdx, turfIdx.length);
  g.setIndex(new BufferAttribute(index, 1));
  g.addGroup(0, turfIdx.length, 0);
  g.addGroup(turfIdx.length, dirtIdx.length, 1);
  g.userData.height0 = height0;
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** The puddles' water: flat ragged discs a little below their hollows' rims. */
export function puddleGeometry(): BufferGeometry {
  const parts = PUDDLES.map((p, i) => {
    const g = new CircleGeometry(1, 28).rotateX(-Math.PI / 2);
    const pos = g.attributes.position as BufferAttribute;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k);
      const z = pos.getZ(k);
      const a = Math.atan2(z, x);
      const r = Math.hypot(x, z) * (1 + 0.18 * fbm(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 120 + i, 2, 1.5));
      const lx = Math.cos(a) * r * p.rx;
      const lz = Math.sin(a) * r * p.rz;
      const c = Math.cos(p.yaw);
      const s = Math.sin(p.yaw);
      pos.setXYZ(k, p.x + lx * c + lz * s, 0, p.z - lx * s + lz * c);
    }
    // the water level: just under the hollow's rim
    const y = surfaceHeight(p.x, p.z) + 0.0095;
    g.translate(0, y, 0);
    g.deleteAttribute('uv');
    return g;
  });
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

/** The plum the ground's shadows turn (groundShading shade: the hue only, the ambient keeps its brightness). */
export const PLUM = '#8a5e62';

/** The forward-scatter sheen of the turf (and the grass, so blades and turf glow together). */
export const TURF_SHEEN = 9;

export function Terrain({ grow = 1 }: { grow?: number }) {
  const { geometry, turf, dirt, water, waterGeo } = useMemo(() => {
    const geometry = terrainGeometry();
    const turf = groundShading(storybookMaterial({ kind: 'earth', vertexColors: true, roughness: 0.97, breakup: 0.3, scale: 0.18, bump: 0.6, color2: '#33585f' }), { sheen: TURF_SHEEN, shade: [PLUM, 0.45], grain: [0.045, 0.7], comb: true });
    const dirt = groundShading(storybookMaterial({ kind: 'earth', vertexColors: true, roughness: 0.9, breakup: 0.3, scale: 0.12, bump: 1.0, color2: '#3a3035', rim: 1.0 }), { grain: [0.03, 0.6], wet: true, shade: [PLUM, 0.75] });
    const waterGeo = puddleGeometry();
    const water = groundShading(storybookMaterial({ color: '#020405', roughness: 0.05, metalness: 0, emissive: '#02070a', breakup: 0, rim: 0.5 }), { water: 1 });
    return { geometry, turf, dirt, water, waterGeo };
  }, []);
  useLayoutEffect(
    () => () => {
      geometry.dispose();
      turf.dispose();
      dirt.dispose();
      water.dispose();
      waterGeo.dispose();
    },
    [geometry, turf, dirt, water, waterGeo],
  );
  // the world rises out of the page: one smooth scale of the heights (no per-vertex rebuild)
  return (
    <group position-y={FLOOR + 0.004} scale-y={Math.max(0.001, grow)}>
      <mesh geometry={geometry} material={[turf, dirt]} receiveShadow />
      <mesh geometry={waterGeo} material={water} receiveShadow visible={grow > 0.98} />
    </group>
  );
}
