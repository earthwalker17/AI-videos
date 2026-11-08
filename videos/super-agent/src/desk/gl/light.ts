/**
 * The light every surface of the Register Desk shares: the analytic footprint shadows and contact
 * occlusion (footprints.ts) and the light pools (pools.ts), as one GLSL block and one set of
 * module-scope uniform objects. The desk shader (gl/desk.ts) and every patched material
 * (gl/materials.ts) paste `LIGHT_GLSL` once and take these same uniform objects, so the frame's
 * state is set once per frame (`setLight`) and reaches every program.
 *
 * Determinism: the shading is a pure function of the uniforms and the fragment's world position;
 * loops run over the uniform counts, never over anything a previous frame left behind.
 */
import { Vector3 } from 'three';
import { MAX_FOOTPRINTS, packFootprints, type Footprint } from '../footprints.ts';
import { PENUMBRA_K, SHADOW_DIR, SHADOW_K, type Pool } from '../layout.ts';
import { MAX_POOLS, packPools } from '../pools.ts';

/** The shared uniform objects (pass these same objects to every material's patch). */
export const LIGHT_UNIFORMS = {
  uFp: { value: new Float32Array(MAX_FOOTPRINTS * 12) },
  uFpCount: { value: 0 },
  uPool: { value: new Float32Array(MAX_POOLS * 12) },
  uPoolCount: { value: 0 },
  /** xy: the direction shadows fall, z: offset per unit height */
  uShadowDir: { value: new Vector3(SHADOW_DIR[0], SHADOW_DIR[1], SHADOW_K) },
};

/** Set the frame's footprints and pools (call in a layout effect, before the frame is drawn). */
export function setLight(fps: readonly Footprint[], pools: readonly Pool[]): void {
  packFootprints(fps, LIGHT_UNIFORMS.uFp.value);
  LIGHT_UNIFORMS.uFpCount.value = fps.length;
  packPools(pools, LIGHT_UNIFORMS.uPool.value);
  LIGHT_UNIFORMS.uPoolCount.value = pools.length;
}

/**
 * GLSL: `dskShade(p, zr)` gives (cast-shadow coverage, contact occlusion) for a receiver at desk
 * position p and height zr; `dskPool(w)` the pool light at world point w.
 *
 * The cast shadow of a footprint is its base shape swept along the key from the height of its
 * lowest part above the receiver to its top; the penumbra widens with height (4 + 0.35·h), so
 * the minimum of distance over penumbra along the sweep is found by a short ternary search (the
 * distance to a convex shape moving on a line is convex in the line's parameter).
 */
export const LIGHT_GLSL = /* glsl */ `
#define DSK_MAX_FP ${MAX_FOOTPRINTS}
#define DSK_MAX_POOLS ${MAX_POOLS}
uniform vec4 uFp[DSK_MAX_FP * 3];
uniform int uFpCount;
uniform vec4 uPool[DSK_MAX_POOLS * 3];
uniform int uPoolCount;
uniform vec3 uShadowDir;

float dskRoundRect(vec2 q, vec2 h, float r) {
  vec2 d = abs(q) - (h - r);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
// signed distance from p to a rect (kind 0) or circle (kind 1) footprint
float dskShape(vec4 a, vec4 b, vec4 c, vec2 p) {
  vec2 q = p - a.xy;
  if (b.w < 0.5) {
    q = vec2(c.x * q.x + c.y * q.y, -c.y * q.x + c.x * q.y);
    return dskRoundRect(q, a.zw, b.x);
  }
  return length(q) - a.z;
}
float dskPen(float h) { return 4.0 + ${PENUMBRA_K.toFixed(3)} * h; }

vec2 dskShade(vec2 p, float zr) {
  float cov = 0.0;
  float ao = 0.0;
  vec2 dir = uShadowDir.xy;
  float k = uShadowDir.z;
  for (int i = 0; i < uFpCount; i++) {
    vec4 a = uFp[3 * i];
    vec4 b = uFp[3 * i + 1];
    vec4 c = uFp[3 * i + 2];
    if (b.w > 2.5) {
      // a canopy: sky occlusion under it, fading over b.x units inside its outline
      if (zr >= b.y) continue;
      float dc = dskRoundRect(p - a.xy, a.zw, 20.0);
      ao = max(ao, c.w * (1.0 - smoothstep(-b.x, 10.0, dc)) * clamp((b.y - zr) / 60.0, 0.0, 1.0));
      continue;
    }
    if (b.w > 1.5) {
      // a capsule segment: its ends at heights b.y and b.z over the desk
      float ha = b.y - zr;
      float hb = b.z - zr;
      if (min(ha, hb) <= 0.5) continue;
      vec2 A = a.xy + dir * k * ha;
      vec2 B = a.zw + dir * k * hb;
      if (length(p - 0.5 * (A + B)) > c.z) continue;
      vec2 pa = p - A;
      vec2 ba = B - A;
      float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
      float d = length(pa - ba * t) - b.x;
      float w = dskPen(mix(ha, hb, t));
      cov = max(cov, 1.0 - smoothstep(-0.5 * w, 0.5 * w, d));
      continue;
    }
    float z0 = b.y;
    float z1 = b.z;
    if (z1 <= zr + 0.5) continue;
    float lo = max(z0, zr) - zr;
    float hi = z1 - zr;
    if (length(p - a.xy - dir * k * 0.5 * (lo + hi)) > c.z) continue;
    // contact: a footprint standing on (or through) this receiver darkens round its foot
    if (c.w > 0.0 && z0 <= zr + 2.0) {
      float d0 = dskShape(a, b, c, p);
      float R = 16.0 + 12.0 * clamp((z1 - z0) / 140.0, 0.0, 1.0);
      ao = max(ao, c.w * (1.0 - smoothstep(-2.0, R, d0)));
    }
    float s0 = 0.0;
    float s1 = 1.0;
    for (int j = 0; j < 5; j++) {
      float m1 = mix(s0, s1, 0.382);
      float m2 = mix(s0, s1, 0.618);
      float h1 = mix(lo, hi, m1);
      float h2 = mix(lo, hi, m2);
      float g1 = dskShape(a, b, c, p - dir * k * h1) / dskPen(h1);
      float g2 = dskShape(a, b, c, p - dir * k * h2) / dskPen(h2);
      if (g1 < g2) s1 = m2; else s0 = m1;
    }
    float hm = mix(lo, hi, 0.5 * (s0 + s1));
    float g = min(dskShape(a, b, c, p - dir * k * hm) / dskPen(hm), dskShape(a, b, c, p - dir * k * lo) / dskPen(lo));
    cov = max(cov, 1.0 - smoothstep(-0.5, 0.5, g));
  }
  return vec2(cov, ao);
}

vec3 dskPool(vec3 w) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < uPoolCount; i++) {
    vec4 a = uPool[3 * i];
    vec4 b = uPool[3 * i + 1];
    vec4 c = uPool[3 * i + 2];
    if (w.z < a.z || w.z > a.w) continue;
    vec2 d = (w.xy - a.xy) / b.xy;
    s += c.rgb * exp(-0.5 * dot(d, d));
  }
  return s;
}
`;
