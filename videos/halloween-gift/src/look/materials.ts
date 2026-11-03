/**
 * The film's one material family: MeshStandardMaterial plus a storybook-night layer injected in
 * `onBeforeCompile`:
 *  - paint breakup: world-space fbm and a directional "brush" streak modulate the albedo, so a
 *    surface reads as painted, not as flat CG colour; octaves fade out with `fwidth` (no
 *    sub-pixel shimmer when the camera moves);
 *  - a procedural bump (stone, bark, wood grain, iron pitting) from screen derivatives of a
 *    world-space height, no textures;
 *  - moon rim light: silhouette edges that face the moon glow cool (stronger when the moon is
 *    behind the subject, as in the reference);
 *  - height fog with a depth colour ramp (dark near, bright cyan mid, teal far), moon in-scatter
 *    and slowly drifting fbm density, computed from the true world position (instancing and
 *    wind included).
 * Features are switched with `defines` and the injection is ONE module-level function, so three
 * keys every variant to its own program (no closures sharing a cache key) and recompiles cannot
 * strand uniforms: the shared uniforms below are module-scope objects set once per frame.
 */
import { Color, MeshStandardMaterial, Vector3, type MeshStandardMaterialParameters, type WebGLProgramParametersWithUniforms } from 'three';
import { NOISE3_GLSL } from './glsl.ts';

/** Uniforms every storybook material shares (set per frame by the light rig and the film). */
export const NIGHT = {
  uSbTime: { value: 0 },
  /** unit vector toward the moon, world space */
  uSbMoonDir: { value: new Vector3(0.494, 0.105, -0.863).normalize() },
  uSbRimColor: { value: new Color('#a6dcef') },
  uSbRim: { value: 1.0 },
  uSbFogNear: { value: new Color('#141a2b') },
  uSbFogMid: { value: new Color('#2b5f7c') },
  uSbFogFar: { value: new Color('#3f88a3') },
  uSbMoonGlow: { value: new Color('#8ccbd8') },
  /** distances (world units) where the ramp turns mid, then far */
  uSbFogDist: { value: new Vector3(2.0, 7.0, 16.0) },
  /** density, height falloff, ground height of the fog */
  uSbFog: { value: new Vector3(0.06, 1.6, 1.5) },
  /** 0 disables fog (the desk shots) */
  uSbFogOn: { value: 1 },
};

/** Set the shared per-frame values (seconds from the film frame, never a clock). */
export function setNightTime(seconds: number): void {
  NIGHT.uSbTime.value = seconds;
}

export type PaintKind = 'plain' | 'stone' | 'bark' | 'wood' | 'iron' | 'earth' | 'grass' | 'cloth' | 'shingle';

export interface Paint extends Omit<MeshStandardMaterialParameters, 'fog'> {
  kind?: PaintKind;
  /** second colour the breakup mixes toward (moss on stone, lighter grain on wood) */
  color2?: string | Color;
  /** how strongly the albedo breaks up (0..1) */
  breakup?: number;
  /** world units per noise feature */
  scale?: number;
  /** bump amplitude (0 = none) */
  bump?: number;
  /** rim strength multiplier (0 = none) */
  rim?: number;
  /** fog multiplier (0 = no fog, e.g. glowing glass) */
  fog?: number;
  /** grass: sway its tips with the wind (needs the aWind attribute: 0 root .. 1 tip) */
  wind?: number;
  /** upward-facing parts take color2 (moss, dust on ledges): 0..1 */
  topCoat?: number;
  /** the geometry carries an aSbMask attribute (earth: where the path's cobbles are) */
  mask?: boolean;
}

const KIND_ID: Record<PaintKind, number> = { plain: 0, stone: 1, bark: 2, wood: 3, iron: 4, earth: 5, grass: 6, cloth: 7, shingle: 8 };

const VERT_PARS = /* glsl */ `
varying vec3 vSbWorld;
varying vec3 vSbNormalW;
varying float vSbMask;
#ifdef SB_MASK
attribute float aSbMask;
#endif
uniform float uSbTime;
uniform float uSbWind;
#ifdef SB_WIND
attribute float aWind;
#endif
`;

const VERT_WIND = /* glsl */ `
#include <begin_vertex>
#ifdef SB_WIND
{
  vec4 iw = vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef USE_INSTANCING
  iw = instanceMatrix * iw;
  #endif
  iw = modelMatrix * iw;
  float ph = iw.x * 0.9 + iw.z * 0.6;
  float gust = 0.6 + 0.4 * sin(uSbTime * 0.7 + iw.x * 0.15);
  float sway = (sin(uSbTime * 1.9 + ph) * 0.6 + sin(uSbTime * 3.3 + ph * 1.7) * 0.25) * gust;
  float k = aWind * aWind * uSbWind;
  transformed.x += sway * k;
  transformed.z += sway * 0.45 * k;
}
#endif
`;

const VERT_WORLD = /* glsl */ `
#include <project_vertex>
{
  vec4 w = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  w = instanceMatrix * w;
  #endif
  w = modelMatrix * w;
  vSbWorld = w.xyz;
  vec3 n = objectNormal;
  #ifdef USE_INSTANCING
  n = mat3(instanceMatrix) * n;
  #endif
  vSbNormalW = normalize(mat3(modelMatrix) * n);
  #ifdef SB_MASK
  vSbMask = aSbMask;
  #else
  vSbMask = 0.0;
  #endif
}
`;

const FRAG_PARS = /* glsl */ `
varying vec3 vSbWorld;
varying vec3 vSbNormalW;
varying float vSbMask;
uniform float uSbTime;
uniform vec3 uSbMoonDir;
uniform vec3 uSbRimColor;
uniform float uSbRim;
uniform vec3 uSbFogNear;
uniform vec3 uSbFogMid;
uniform vec3 uSbFogFar;
uniform vec3 uSbMoonGlow;
uniform vec3 uSbFogDist;
uniform vec3 uSbFog;
uniform float uSbFogOn;
uniform vec3 uSbColor2;
uniform float uSbBreakup;
uniform float uSbScale;
uniform float uSbBump;
uniform float uSbRimMul;
uniform float uSbFogMul;
uniform float uSbTop;
${NOISE3_GLSL}
// cobbles: distance to the nearest of a jittered grid of stones (x, z), and that stone's id
vec2 sbCobble(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float best = 8.0;
  float id = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(aivHash13(vec3(i + g, 1.7)), aivHash13(vec3(i + g, 5.3))) * 0.8 + 0.1;
      float d = length(g + o - f);
      if (d < best) { best = d; id = aivHash13(vec3(i + g, 9.1)); }
    }
  return vec2(best, id);
}
// a height field per kind, in world units scaled by uSbScale
float sbHeight(vec3 p) {
  vec3 q = p / uSbScale;
#if SB_KIND == 1
  // stone: lumpy, with ridged cracks
  return aivFbm3(q * 1.3) * 0.7 + (1.0 - abs(aivFbm3(q * 3.1 + 7.0) * 2.0 - 1.0)) * 0.3;
#elif SB_KIND == 2
  // bark: furrows stretched along the wood (v of the tube runs mostly vertical)
  return aivFbm3(vec3(q.x * 5.0, q.y * 0.9, q.z * 5.0)) ;
#elif SB_KIND == 3
  // wood planks: long grain
  return aivFbm3(vec3(q.x * 0.6, q.y * 9.0, q.z * 0.6));
#elif SB_KIND == 4
  // iron: fine pitting
  return aivFbm3(q * 6.0);
#elif SB_KIND == 5
  // earth: lumps, and rounded cobbles where the path mask is
  float lumps = aivFbm3(q * 1.5);
  vec2 c = sbCobble(p.xz * 13.0);
  float cob = smoothstep(0.62, 0.15, c.x) * (0.75 + 0.25 * c.y);
  return mix(lumps, cob, smoothstep(0.2, 0.8, vSbMask) * 0.85);
#elif SB_KIND == 8
  // shingles: wavy courses
  return fract(q.y * 2.2 + 0.15 * sin(q.x * 3.0)) * 0.6 + aivFbm3(q * 4.0) * 0.4;
#else
  return aivFbm3(q * 1.5);
#endif
}
vec3 sbPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sx = normalize(dFdx(surfPos));
  vec3 sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
// how much detail at this scale survives the pixel footprint (1 = all, 0 = sub-pixel)
float sbDetail(vec3 p, float featureScale) {
  float fw = length(fwidth(p)) / max(featureScale, 1e-4);
  return 1.0 - smoothstep(0.25, 1.0, fw);
}
`;

const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
{
  float det = sbDetail(vSbWorld, uSbScale);
  float n = aivFbm3(vSbWorld / uSbScale * 0.7) * 2.0 - 1.0;
  // a brush streak: noise stretched along a slanting stroke direction
  vec3 sd = normalize(vec3(0.8, 0.35, 0.5));
  float stroke = aivFbm3(vec3(dot(vSbWorld, sd) * 7.0 / uSbScale, vSbWorld.y * 0.6 / uSbScale, dot(vSbWorld.xz, vec2(-0.5, 0.8)) * 0.6 / uSbScale)) * 2.0 - 1.0;
  float b = (n * 0.65 + stroke * 0.35 * det) * uSbBreakup;
  diffuseColor.rgb *= 1.0 + b;
  float mixAmt = clamp(0.5 + n * 0.9, 0.0, 1.0) * uSbBreakup;
  diffuseColor.rgb = mix(diffuseColor.rgb, uSbColor2, mixAmt * 0.6);
#if SB_KIND == 5
  {
    vec2 c = sbCobble(vSbWorld.xz * 13.0);
    float m = smoothstep(0.2, 0.8, vSbMask);
    float stone = smoothstep(0.6, 0.3, c.x);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * mix(0.55, 1.25 + 0.3 * c.y, stone), m * det);
  }
#endif
  // a coat on up-facing parts (moss on stones, dust on ledges)
  float up = smoothstep(0.35, 0.85, vSbNormalW.y) * smoothstep(-0.2, 0.4, n + 0.2);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSbColor2, up * uSbTop);
}
`;

const FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
#ifdef SB_BUMP
{
  float det = sbDetail(vSbWorld, uSbScale * 0.4);
  float h = sbHeight(vSbWorld);
  vec2 dh = vec2(dFdx(h), dFdy(h)) * uSbBump * det;
  normal = sbPerturb(-vViewPosition, normal, dh, faceDirection);
}
#endif
`;

const FRAG_OUT = /* glsl */ `
{
  // moon rim: silhouette edges facing the moon, stronger when the moon is behind the subject
  vec3 V = normalize(vViewPosition);
  vec3 Lv = normalize((viewMatrix * vec4(uSbMoonDir, 0.0)).xyz);
  float facing = max(dot(normal, V), 0.0);
  float edge = pow(max(1.0 - facing, 0.0), 3.0);
  float toward = smoothstep(-0.25, 0.65, dot(normal, Lv));
  float behind = mix(0.55, 1.0, smoothstep(0.3, -0.6, dot(Lv, V)));
  outgoingLight += uSbRimColor * edge * toward * behind * uSbRim * uSbRimMul * diffuseColor.a;
  // height fog with a depth ramp and moon in-scatter
  if (uSbFogOn > 0.5 && uSbFogMul > 0.0) {
    vec3 ray = vSbWorld - cameraPosition;
    float dist = length(ray);
    float hF = max(vSbWorld.y - uSbFog.z, 0.0);
    float hC = max(cameraPosition.y - uSbFog.z, 0.0);
    float drift = aivFbm3(vec3(vSbWorld.xz * 0.35 + vec2(uSbTime * 0.03, uSbTime * 0.012), uSbTime * 0.02));
    float dens = uSbFog.x * 0.5 * (exp(-hF * uSbFog.y) + exp(-hC * uSbFog.y)) * (0.65 + 0.7 * drift);
    float amt = (1.0 - exp(-dens * dist)) * uSbFogMul;
    vec3 col = mix(uSbFogNear, uSbFogMid, smoothstep(uSbFogDist.x * 0.4, uSbFogDist.y, dist));
    col = mix(col, uSbFogFar, smoothstep(uSbFogDist.y, uSbFogDist.z, dist));
    float sc = pow(max(dot(normalize(ray), uSbMoonDir), 0.0), 6.0);
    col += uSbMoonGlow * sc * 0.6;
    outgoingLight = mix(outgoingLight, col, clamp(amt, 0.0, 1.0));
  }
}
#include <opaque_fragment>
`;

/** One injection for every storybook material (its source is the program cache key's stable part). */
function inject(this: MeshStandardMaterial, shader: WebGLProgramParametersWithUniforms): void {
  const own = (this.userData as { sb: Record<string, { value: unknown }> }).sb;
  Object.assign(shader.uniforms, NIGHT, own);
  shader.vertexShader = VERT_PARS + shader.vertexShader.replace('#include <begin_vertex>', VERT_WIND).replace('#include <project_vertex>', VERT_WORLD);
  shader.fragmentShader = FRAG_PARS + shader.fragmentShader.replace('#include <color_fragment>', FRAG_COLOR).replace('#include <normal_fragment_maps>', FRAG_NORMAL).replace('#include <opaque_fragment>', FRAG_OUT);
}

/** A storybook material. Fog is ours (three's scene fog is off for these). */
export function storybookMaterial(o: Paint = {}): MeshStandardMaterial {
  const { kind = 'plain', color2, breakup = 0.25, scale = 0.5, bump = 0, rim = 1, fog = 1, wind = 0, topCoat = 0, mask = false, ...std } = o;
  const m = new MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...std });
  m.fog = false;
  const base = m.color.clone();
  m.userData.sb = {
    uSbColor2: { value: color2 ? new Color(color2) : base.clone().multiplyScalar(0.6) },
    uSbBreakup: { value: breakup },
    uSbScale: { value: scale },
    uSbBump: { value: bump },
    uSbRimMul: { value: rim },
    uSbFogMul: { value: fog },
    uSbTop: { value: topCoat },
    uSbWind: { value: wind },
  };
  m.defines = { ...(m.defines ?? {}), SB_KIND: KIND_ID[kind], ...(bump > 0 ? { SB_BUMP: 1 } : {}), ...(wind > 0 ? { SB_WIND: 1 } : {}), ...(mask ? { SB_MASK: 1 } : {}) };
  m.onBeforeCompile = inject;
  m.customProgramCacheKey = () => `sb:${KIND_ID[kind]}:${bump > 0 ? 1 : 0}:${wind > 0 ? 1 : 0}:${mask ? 1 : 0}`;
  return m;
}
