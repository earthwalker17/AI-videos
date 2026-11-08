/**
 * The Register Desk's post chain (synthesis §2, Emission and bloom), for the kit's PostChain:
 * MSAA 4 HalfFloat buffers, mipmap bloom (threshold 1.0, smoothing 0.03, intensity 0.3, radius 0.4,
 * 5 levels, added in linear light), NEUTRAL tone mapping, the kit's finish (no vignette, no foot
 * band, no grain, no lift), then the kit's dither at the 8-bit output.
 *
 * The toe. three's NeutralToneMapping (Khronos PBR Neutral) subtracts an offset from every pixel
 * before its highlight shoulder: 0.04 above a channel minimum of 0.08, and x − 6.25x² below it,
 * which maps the dark end quadratically (linear 0.015, the desk, would come out at 0.0014: near
 * black). This film's palette is given in display values on a dark ground, so `PreToeEffect` adds
 * exactly that offset back first: for any colour whose peak stays under the shoulder (0.76), PreToe
 * then NEUTRAL is the identity, and above it NEUTRAL's shoulder still rolls the emitters off. The
 * pair is NEUTRAL's shoulder alone. `preToe` and `neutral` below mirror the GLSL for the tests.
 */
import { FinishEffect } from '@aiv/remotion-kit';
import { BlendFunction, BloomEffect, Effect, EffectAttribute } from 'postprocessing';

const PRE_TOE = /* glsl */ `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0);
  float m = min(c.r, min(c.g, c.b));
  float x = m < 0.04 ? sqrt(m / 6.25) : m + 0.04;
  outputColor = vec4(c + (x - m), inputColor.a);
}
`;

/** Adds back NEUTRAL tone mapping's dark-end offset (a NONE effect: it stays just before the tone mapping). */
export class PreToeEffect extends Effect {
  constructor() {
    super('PreToeEffect', PRE_TOE, { blendFunction: BlendFunction.NORMAL, attributes: EffectAttribute.NONE });
  }
}

/** PreToe in JS (the GLSL's arithmetic). */
export function preToe(c: readonly [number, number, number]): [number, number, number] {
  const v = c.map((x) => Math.max(x, 0)) as [number, number, number];
  const m = Math.min(...v);
  const x = m < 0.04 ? Math.sqrt(m / 6.25) : m + 0.04;
  return [v[0] + x - m, v[1] + x - m, v[2] + x - m];
}

/** three's NeutralToneMapping (r186, exposure 1) in JS. */
export function neutral(c: readonly [number, number, number]): [number, number, number] {
  const start = 0.8 - 0.04;
  const desat = 0.15;
  let v = [...c] as [number, number, number];
  const x = Math.min(...v);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  v = v.map((k) => k - offset) as [number, number, number];
  const peak = Math.max(...v);
  if (peak < start) return v;
  const d = 1 - start;
  const newPeak = 1 - (d * d) / (peak + d - start);
  v = v.map((k) => (k * newPeak) / peak) as [number, number, number];
  const g = 1 - 1 / (desat * (peak - newPeak) + 1);
  return v.map((k) => k * (1 - g) + newPeak * g) as [number, number, number];
}

/** The bloom settings (synthesis §2). */
export const BLOOM = { luminanceThreshold: 1.0, luminanceSmoothing: 0.03, intensity: 0.3, radius: 0.4, levels: 5 } as const;

/** Effects before the tone mapping, with bloom (module scope: PostChain needs stable factories). */
export const effectsWithBloom = () => [new BloomEffect({ blendFunction: BlendFunction.ADD, mipmapBlur: true, ...BLOOM }), new PreToeEffect()];
/** The same without bloom (the A/B the user chooses from). */
export const effectsNoBloom = () => [new PreToeEffect()];
/** After the tone mapping: the kit's finish, everything off (no vignette: the corners never darken). */
export const afterToneMapping = () => [new FinishEffect({ vignette: 0, foot: 0, grain: 0, liftLow: '#000000', liftHigh: '#000000' })];
