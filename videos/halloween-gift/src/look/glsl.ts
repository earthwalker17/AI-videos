/**
 * GLSL helpers shared by the film's shaders: a hash, value noise and fbm. Written for this film
 * (MIT with the repository), not taken from Shadertoy. Pure functions of their inputs, so a
 * pixel depends only on its position and the frame uniform.
 */
export const NOISE_GLSL = /* glsl */ `
float aivHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
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

/** 3D value noise and a 4-octave fbm in [0, 1] (world-space paint and bumps). */
export const NOISE3_GLSL = /* glsl */ `
float aivHash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
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
