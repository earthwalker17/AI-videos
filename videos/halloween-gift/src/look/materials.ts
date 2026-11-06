/**
 * The film's one material family: MeshStandardMaterial plus a storybook-night layer injected in
 * `onBeforeCompile`:
 *  - paint breakup: world-space fbm and a directional "brush" streak modulate the albedo, so a
 *    surface reads as painted, not as flat CG colour; octaves fade out with `fwidth` (no
 *    sub-pixel shimmer when the camera moves);
 *  - a procedural bump (stone, bark, wood grain, iron pitting) from screen derivatives of a
 *    world-space height, no textures;
 *  - moon rim light: silhouette edges that face the moon glow cool (stronger when the moon is
 *    behind the subject, as in the reference), soft, capped, and faded out where its falloff is
 *    narrower than a few pixels (no crawling 1 px lines on thin branches and cloth edges);
 *  - the storybook ambient: a soft wrapped fill whose colour follows the distance from the lens
 *    (maroon near, plum slate in the mid-ground, the haze's cyan far off), so the shadows keep the
 *    reference's plum and maroon under its cyan light;
 *  - height fog with a depth colour ramp (near-black plum near, slate mid, cyan far), the moon's
 *    cyan in-scatter and slowly drifting fbm density, plus an aerial term that grows with
 *    distance (thinned as the camera rises over the page), all computed from the true world
 *    position (instancing and wind included).
 * Features are switched with `defines` and the injection is ONE module-level function, so three
 * keys every variant to its own program (no closures sharing a cache key) and recompiles cannot
 * strand uniforms: the shared uniforms below are module-scope objects set once per frame.
 */
import { Color, MeshStandardMaterial, Vector2, Vector3, Vector4, type MeshStandardMaterialParameters, type WebGLProgramParametersWithUniforms } from 'three';
import { NOISE3_GLSL } from './glsl.ts';

/** Uniforms every storybook material shares (set per frame by the light rig and the film). */
export const NIGHT = {
  uSbTime: { value: 0 },
  /** unit vector toward the moon, world space (azimuth 0.52, elevation 0.143: the reference's moon, upper right) */
  uSbMoonDir: { value: new Vector3(0.4923, 0.1425, -0.8587).normalize() },
  uSbRimColor: { value: new Color('#a4e0e8') },
  uSbRim: { value: 1.0 },
  // the reference's colour logic: plum and maroon darks near, slate in the mid-ground, under
  // saturated cyan light (the far fog, the in-scatter toward the moon)
  uSbFogNear: { value: new Color('#0e0a14') },
  uSbFogMid: { value: new Color('#4a4452') },
  uSbFogFar: { value: new Color('#2f9eb0') },
  uSbMoonGlow: { value: new Color('#8ccbd8') },
  /**
   * distances (world units) where the ramp turns mid, then far (the far cyan only past the
   * mid-ground: the conifers and the gnarled tree stay plum slate silhouettes against the sky)
   */
  uSbFogDist: { value: new Vector3(2.0, 7.0, 26.0) },
  /** the moon's in-scatter only from this distance on (the castle, the far hills), full at the second: the cottage under the moon stays plum */
  uSbScatterDist: { value: new Vector2(11.0, 14.5) },
  /** density, height falloff, ground height of the fog */
  uSbFog: { value: new Vector3(0.06, 1.6, 1.5) },
  /** aerial perspective: from this distance, 1 / its length, its most */
  uSbAir: { value: new Vector3(4.0, 0.075, 0.5) },
  /** the storybook ambient's colour near the lens (maroon) and in the mid-ground (plum slate), and where it turns */
  uSbAmbNear: { value: new Color('#3a2632') },
  uSbAmbFar: { value: new Color('#54465e') },
  uSbAmbDist: { value: new Vector3(3.5, 9.0, 1.0) },
  /**
   * beyond the mid-ground (the castle, the far hills) the ambient turns a violet slate, and where
   * it does: the far world's cyan is the light's (the in-scatter, the far fog), its shadows stay
   * plum (a cyan ambient here turned every silhouette teal against a violet sky)
   */
  uSbAmbHaze: { value: new Color('#4a4a66') },
  uSbAmbHazeDist: { value: new Vector2(13.0, 19.0) },
  /** how much of the fog there is, 0..1 (0: the desk shots, faded in as the camera enters the story) */
  uSbFogOn: { value: 1 },
  /**
   * The world growing out of the page (look/Grows.tsx opts a subtree in): the film frame, the
   * sweep's first frame, its length across the page and each point's rise (frames); and the page's
   * left x, width and the page's height (FLOOR). Default: long grown.
   */
  uSbGrow: { value: new Vector4(1e6, 0, 18, 14) },
  uSbGrowPage: { value: new Vector4(-8, 16, 1.5, 0) },
  /**
   * The world folding flat under the closing cover (look/Grows.tsx FoldClock, film/beats.ts
   * foldAt): tan of the cover's angle above the page (1e9: open, nothing folds), the hinge's z,
   * the page's height and the tallest the world stands; each point at distance d from the hinge
   * is squashed about the page to d × tan / tallest of its height (a pop-up folding shut).
   */
  uSbFold: { value: new Vector4(1e9, -5.5, 1.5, 6.5) },
};

/** Set the shared per-frame values (seconds from the film frame, never a clock). */
export function setNightTime(seconds: number): void {
  NIGHT.uSbTime.value = seconds;
}

/** The grow's schedule (film/beats.ts GROW and PAGE): a point at x rises from `from + sweep × u` (u its place across the page) over `dur` frames. */
export interface GrowSchedule {
  from: number;
  sweep: number;
  dur: number;
  x0: number;
  width: number;
  floor: number;
}
/** Set the grow for film frame f (the world in look/Grows.tsx rises out of the page); never called = grown. */
export function setGrow(f: number, s: GrowSchedule): void {
  NIGHT.uSbGrow.value.set(f, s.from, s.sweep, s.dur);
  NIGHT.uSbGrowPage.value.set(s.x0, s.width, s.floor, 0);
}
/** Set the fold for a frame (Infinity: the cover stands, nothing folds); hinge z, the page's height, the world's tallest point above it. */
export function setFold(tan: number, hingeZ: number, floor: number, tallest: number): void {
  NIGHT.uSbFold.value.set(Number.isFinite(tan) ? tan : 1e9, hingeZ, floor, tallest);
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
  /** the storybook ambient's strength on this surface (0 = none, e.g. glowing glass) */
  ambient?: number;
  /**
   * Where on the page this surface rises in the grow (look/Grows.tsx): by each point's own x
   * (default), by its mesh's origin ('origin': a tree rises whole, its limbs with its trunk), or at
   * a set x (what hangs from a tree rises with it).
   */
  growX?: number | 'origin';
}

const KIND_ID: Record<PaintKind, number> = { plain: 0, stone: 1, bark: 2, wood: 3, iron: 4, earth: 5, grass: 6, cloth: 7, shingle: 8 };

const VERT_PARS = /* glsl */ `
varying vec3 vSbWorld;
varying vec3 vSbNormalW;
varying float vSbMask;
varying float vSbGrow;
uniform vec4 uSbGrow;
uniform vec4 uSbGrowPage;
uniform float uSbGrowOn;
uniform float uSbGrowX;
uniform vec4 uSbFold;
// film/beats.ts riseAt(f, popAt(x)): paper springing up, easing in, overshooting to 1.1, settling
float sbRise(float x) {
  float u = clamp((x - uSbGrowPage.x) / uSbGrowPage.y, 0.0, 1.0);
  float t = clamp((uSbGrow.x - (uSbGrow.y + uSbGrow.z * u)) / uSbGrow.w, 0.0, 1.0);
  if (t <= 0.0) return 0.0;
  float k = t - 1.0;
  return clamp(1.0 + 2.3 * k * k * k + 1.3 * k * k, 0.0, 1.1);
}
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
  vSbGrow = 1.0;
  if (uSbGrowOn > 0.5) {
    // grown out of the page: heights above (and depths below) the page scaled about it
    // the sweep's x: the point's own (uSbGrowX -1e4), its mesh's origin (-2e4), or a set one
    vec4 o = vec4(0.0, 0.0, 0.0, 1.0);
    #ifdef USE_INSTANCING
    o = instanceMatrix * o;
    #endif
    o = modelMatrix * o;
    float gx = uSbGrowX < -1.5e4 ? o.x : (uSbGrowX < -0.5e4 ? w.x : uSbGrowX);
    vSbGrow = sbRise(gx);
    w.y = uSbGrowPage.z + (w.y - uSbGrowPage.z) * vSbGrow;
    // folded flat under the closing cover: squashed about the page, more the nearer the hinge
    if (uSbFold.x < 1e8) {
      float fold = clamp(max(w.z - uSbFold.y, 0.0) * uSbFold.x / uSbFold.w, 0.0, 1.0);
      w.y = uSbFold.z + (w.y - uSbFold.z) * fold;
    }
    mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
  }
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
varying float vSbGrow;
uniform float uSbGrowOn;
uniform vec4 uSbGrowPage;
uniform float uSbTime;
uniform vec3 uSbMoonDir;
uniform vec3 uSbRimColor;
uniform float uSbRim;
uniform vec3 uSbFogNear;
uniform vec3 uSbFogMid;
uniform vec3 uSbFogFar;
uniform vec3 uSbMoonGlow;
uniform vec3 uSbFogDist;
uniform vec2 uSbScatterDist;
uniform vec3 uSbFog;
uniform float uSbFogOn;
uniform vec3 uSbAir;
uniform vec3 uSbAmbNear;
uniform vec3 uSbAmbFar;
uniform vec3 uSbAmbDist;
uniform vec3 uSbAmbHaze;
uniform vec2 uSbAmbHazeDist;
uniform float uSbAmbMul;
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
// not yet risen off the page: nothing (the page itself, uSbGrowOn 2, stays)
if (uSbGrowOn > 0.5 && uSbGrowOn < 1.5 && vSbGrow < 0.02) discard;
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
  vec3 sbRay = vSbWorld - cameraPosition;
  float sbDist = length(sbRay);
  // seen from above (the crane into the book and out of it) the grown world is a model on a page:
  // its depth ramps count from the page under the lens, not from the lens high over it (or every
  // point of the miniature reads as far: a flood of the far cyan, an exposure pump as the camera
  // climbs), and only the page's world takes the story's air (the desk round the book has none)
  float camH = max(cameraPosition.y - uSbGrowPage.z, 0.0);
  float sbHi = smoothstep(2.5, 6.0, camH);
  float sbOnPage = (1.0 - smoothstep(8.2, 9.0, abs(vSbWorld.x))) * (1.0 - smoothstep(5.7, 6.5, abs(vSbWorld.z)));
  float sbDepth = max(sbDist - sbHi * sbOnPage * max(camH - 2.0, 0.0), 0.0);
  // the storybook ambient: a wrapped fill, maroon near the lens, plum slate in the mid-ground, a violet slate far off
  {
    vec3 amb = mix(uSbAmbNear, uSbAmbFar, smoothstep(uSbAmbDist.x, uSbAmbDist.y, sbDepth));
    amb = mix(amb, uSbAmbHaze, smoothstep(uSbAmbHazeDist.x, uSbAmbHazeDist.y, sbDepth));
    vec3 nW = normalize(vSbNormalW);
    float wrapA = clamp(0.62 + 0.22 * nW.y + 0.22 * dot(nW, uSbMoonDir), 0.2, 1.1);
    outgoingLight += diffuseColor.rgb * amb * wrapA * uSbAmbDist.z * uSbAmbMul;
  }
  // moon rim: silhouette edges facing the moon, stronger when the moon is behind the subject; on
  // the surface's own (unbumped) normal, capped, and gone where its falloff would be
  // narrower than a few pixels (a thin branch, a cloth's edge, a small far thing): there it would
  // be a 1-3 px unfiltered line that crawls as the camera moves
  vec3 V = normalize(vViewPosition);
  vec3 Lv = normalize((viewMatrix * vec4(uSbMoonDir, 0.0)).xyz);
  vec3 nG = normalize(nonPerturbedNormal);
  float facing = max(dot(nG, V), 0.0);
  float edge = pow(max(1.0 - facing, 0.0), 3.0) * (1.0 - smoothstep(0.1, 0.32, fwidth(facing)));
  float toward = smoothstep(-0.25, 0.65, dot(nG, Lv));
  float behind = mix(0.55, 1.0, smoothstep(0.3, -0.6, dot(Lv, V)));
  // its peak capped (a glow, never a white line); (assets patch the line below by its text: keep it)
  edge = min(edge, 0.45 / max(toward * behind * uSbRim * uSbRimMul, 1e-3));
  outgoingLight += uSbRimColor * edge * toward * behind * uSbRim * uSbRimMul * diffuseColor.a;
#if SB_KIND == 6
  // grass right at the lens (the door shots' foreground) goes to the reference's dark maroon
  // frame: its blades read as silhouettes, not pale moonlit strokes across the foot of the picture
  outgoingLight *= mix(vec3(0.32, 0.18, 0.22), vec3(1.0), smoothstep(0.6, 3.0, sbDist));
#endif
  // height fog with a depth ramp and moon in-scatter
  if (uSbFogOn > 0.0 && uSbFogMul > 0.0 && sbOnPage > 0.0) {
    float dist = sbDepth;
    float hF = max(vSbWorld.y - uSbFog.z, 0.0);
    float hC = max(cameraPosition.y - uSbFog.z, 0.0);
    float drift = aivFbm3(vec3(vSbWorld.xz * 0.35 + vec2(uSbTime * 0.03, uSbTime * 0.012), uSbTime * 0.02));
    float dens = uSbFog.x * 0.5 * (exp(-hF * uSbFog.y) + exp(-hC * uSbFog.y)) * (0.65 + 0.7 * drift);
    // the aerial term by distance; from above, the model under a little air (thinned as the camera
    // rises over the page), not a valley under a sky of it
    float air = (1.0 - exp(-max(dist - uSbAir.x, 0.0) * uSbAir.y)) * uSbAir.z;
    float amt = (1.0 - exp(-dens * dist) * (1.0 - air)) * uSbFogMul * uSbFogOn * sbOnPage * mix(1.0, 0.45, sbHi);
    // toward the moon (the luminous window behind the castle) the far cyan comes sooner: the castle
    // stands in it while the conifers at the same distance to the left stay plum slate
    float toMoon = max(dot(normalize(sbRay), uSbMoonDir), 0.0);
    float farW = smoothstep(uSbScatterDist.x, uSbScatterDist.y, dist);
    vec3 col = mix(uSbFogNear, uSbFogMid, smoothstep(uSbFogDist.x * 0.4, uSbFogDist.y, dist));
    col = mix(col, uSbFogFar, max(smoothstep(uSbFogDist.y, uSbFogDist.z, dist), farW * toMoon * toMoon * toMoon));
    // the moon's in-scatter: the saturated cyan light over the far world seen toward the moon (the
    // castle, the far hills); only a little on the mid-ground under it (the cottage keeps its plum)
    float sc = pow(toMoon, 8.0) * mix(0.25, 1.0, farW);
    col += uSbMoonGlow * sc * 1.2;
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
  const { kind = 'plain', color2, breakup = 0.25, scale = 0.5, bump = 0, rim = 1, fog = 1, wind = 0, topCoat = 0, mask = false, ambient = 1, growX, ...std } = o;
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
    uSbAmbMul: { value: ambient },
    /** 0 off, 1 grows out of the page, 2 is the page (flattens, never discarded): set by look/Grows.tsx */
    uSbGrowOn: { value: 0 },
    uSbGrowX: { value: growX === undefined ? -1e4 : growX === 'origin' ? -2e4 : growX },
  };
  m.defines = { ...(m.defines ?? {}), SB_KIND: KIND_ID[kind], ...(bump > 0 ? { SB_BUMP: 1 } : {}), ...(wind > 0 ? { SB_WIND: 1 } : {}), ...(mask ? { SB_MASK: 1 } : {}) };
  m.onBeforeCompile = inject;
  m.customProgramCacheKey = () => `sb:${KIND_ID[kind]}:${bump > 0 ? 1 : 0}:${wind > 0 ? 1 : 0}:${mask ? 1 : 0}`;
  return m;
}
