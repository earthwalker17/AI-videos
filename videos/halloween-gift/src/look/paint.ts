/**
 * A painterly filter: a generalised Kuwahara (Kyprianidis et al.'s method, written for this film
 * from the published description — no code copied). Around each pixel, eight overlapping
 * angular lobes of a small disc each give a mean colour and a variance; the output mixes the
 * means, weighted toward the lobes with the least variance, so flat areas smooth into strokes
 * while edges stay sharp: the "painted" look. It is a convolution effect, so it runs in its own
 * PostChain stage BEFORE depth of field and bloom (packages/remotion-kit PostChain `stages`).
 * Pure function of the input image: deterministic; judge it on moving frames (it can amplify
 * input aliasing into shimmer). Thin bright shapes (a carved grin, a lit window) would erode
 * into dashes, so HDR-bright pixels (emissive, above `protect` in linear luminance) keep their
 * own colour.
 */
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';

const FRAG = /* glsl */ `
uniform float uRadius;
uniform float uSharp;
uniform float uMix;
uniform float uProtect;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  const int R = 4;
  vec4 m[8];
  vec3 s[8];
  for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
  vec2 dirs[8];
  for (int k = 0; k < 8; k++) { float a = float(k) * 0.7853982; dirs[k] = vec2(cos(a), sin(a)); }
  float rr = max(uRadius, 0.5);
  for (int j = -R; j <= R; j++) {
    for (int i = -R; i <= R; i++) {
      vec2 o = vec2(float(i), float(j));
      float d2 = dot(o, o);
      if (d2 > float(R * R) + 0.5) continue;
      vec2 v = o / float(R);
      vec3 c = texture2D(inputBuffer, uv + o * texelSize * (rr / float(R))).rgb;
      // a soft disc falloff, and lobes that overlap their neighbours
      float g = exp(-2.2 * dot(v, v));
      float len = length(v);
      vec2 n = len > 1e-4 ? v / len : vec2(0.0);
      for (int k = 0; k < 8; k++) {
        float lobe = len < 1e-4 ? 1.0 : pow(max(dot(n, dirs[k]) + 0.38, 0.0) / 1.38, 3.0);
        float w = lobe * g;
        m[k] += vec4(c * w, w);
        s[k] += c * c * w;
      }
    }
  }
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int k = 0; k < 8; k++) {
    vec3 mean = m[k].rgb / max(m[k].w, 1e-5);
    vec3 var = abs(s[k] / max(m[k].w, 1e-5) - mean * mean);
    float sig = var.r + var.g + var.b;
    float w = 1.0 / (1.0 + pow(max(sig * 255.0, 0.0), 0.5 * uSharp));
    acc += mean * w;
    wsum += w;
  }
  vec3 painted = acc / max(wsum, 1e-5);
  float lum = max(max(inputColor.r, inputColor.g), inputColor.b);
  float keep = smoothstep(uProtect * 0.6, uProtect, lum);
  outputColor = vec4(mix(inputColor.rgb, painted, uMix * (1.0 - keep)), inputColor.a);
}
`;

export class KuwaharaEffect extends Effect {
  constructor({ radius = 3.0, sharpness = 8.0, mix = 1.0, protect = 1.1 } = {}) {
    super('KuwaharaEffect', FRAG, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['uRadius', new Uniform(radius)],
        ['uSharp', new Uniform(sharpness)],
        ['uMix', new Uniform(mix)],
        ['uProtect', new Uniform(protect)],
      ]),
    });
  }
}
