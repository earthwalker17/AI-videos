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
