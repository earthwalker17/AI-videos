/**
 * GLSL helpers for shaders: a hash, value noise and fbm, in 2D (`NOISE_GLSL`) and 3D
 * (`NOISE3_GLSL`). Pure functions of their inputs, so a pixel depends only on its position and
 * the frame uniform. Paste each string once per shader (its functions are defined, not guarded).
 *
 * Copied from the frozen film *A Halloween Gift* at its release tag `video/halloween-gift/v1`
 * (`videos/halloween-gift/src/look/glsl.ts`), unchanged, for its second use (video #4,
 * docs/ARCHITECTURE.md decision 30). The film keeps its own copy. The noise and fbm were written
 * for that film. The hashes are not the film's: `aivHash12` and `aivHash13` hash the bits of
 * their float inputs with `aivMix32`, the 32-bit finaliser (fmix32) of Austin Appleby's
 * MurmurHash3, which its author placed in the public domain. Integer arithmetic wraps exactly, so
 * the hash is the same on every GPU that computes the same input floats. The film's own hashes
 * (another author's, licence unconfirmed: docs/ROADMAP.md, Known gaps) are not used here.
 * `AIV_HASH_GLSL` is pasted into both strings; a shader that needs both pastes `NOISE3_GLSL`
 * without the hash (`NOISE3_BODY_GLSL`) after `NOISE_GLSL`.
 */
/**
 * The kit's hashes, in [0, 1): MurmurHash3's fmix32 (public domain) over the float bits of the
 * input. Needs GLSL ES 3.00 (WebGL2, which three always uses).
 */
export const AIV_HASH_GLSL = /* glsl */ `
uint aivMix32(uint h) {
  h ^= h >> 16u;
  h *= 0x85ebca6bu;
  h ^= h >> 13u;
  h *= 0xc2b2ae35u;
  h ^= h >> 16u;
  return h;
}
float aivHash12(vec2 p) {
  uvec2 q = floatBitsToUint(p);
  return float(aivMix32(q.x ^ aivMix32(q.y + 0x9e3779b9u)) >> 8u) * (1.0 / 16777216.0);
}
float aivHash13(vec3 p) {
  uvec3 q = floatBitsToUint(p);
  return float(aivMix32(q.x ^ aivMix32(q.y ^ aivMix32(q.z + 0x9e3779b9u))) >> 8u) * (1.0 / 16777216.0);
}
`;

export const NOISE_GLSL = /* glsl */ `
${AIV_HASH_GLSL}
float aivNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = aivHash12(i);
  float b = aivHash12(i + vec2(1.0, 0.0));
  float c = aivHash12(i + vec2(0.0, 1.0));
  float d = aivHash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float aivFbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    s += a * aivNoise(p);
    p = r * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}
`;

/** 3D value noise and a 4-octave fbm in [0, 1], without the hash (paste after `NOISE_GLSL`). */
export const NOISE3_BODY_GLSL = /* glsl */ `
float aivNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = aivHash13(i);
  float n100 = aivHash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = aivHash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = aivHash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = aivHash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = aivHash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = aivHash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = aivHash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float aivFbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * aivNoise3(p);
    p = p * 2.07 + vec3(17.1, 9.3, 4.7);
    a *= 0.5;
  }
  return s / 0.9375;
}
`;

/** 3D value noise and a 4-octave fbm in [0, 1] (world-space paint and bumps), with the hash. */
export const NOISE3_GLSL = `${AIV_HASH_GLSL}${NOISE3_BODY_GLSL}`;
