/**
 * The finish: a postprocessing effect for `PostChain`'s `afterToneMapping`, on display values
 * (tone-mapped linear light in [0, 1]). It has three parts:
 *  - a vignette and a foot band (`FINISH_TINT_GLSL`); a glow inside them keeps its own colour
 *    and most of its light;
 *  - a floor lift: the picture sits on a dark colour that runs from `liftLow` at the bottom of
 *    the frame to `liftHigh` at the top;
 *  - a monochrome film grain, constant in output levels, that changes every frame. Set `frame`
 *    from the frame index each frame (QA's freeze check must still see a held shot as alive).
 *
 * Copied from the frozen film *A Halloween Gift* at its release tag `video/halloween-gift/v1`
 * (`videos/halloween-gift/src/look/NightPost.tsx`: `FinishEffect` and `FINISH_TINT_GLSL`), for its
 * second use (video #4, docs/ARCHITECTURE.md decision 30). The film keeps its own copy, and
 * `NightPost` stays in it. Generalised: the vignette, grain, lift colours and foot band are
 * options, and their defaults are the film's values. With the defaults the shader computes what
 * the film's does. With `vignette: 0` and `foot: 0` the tint is skipped (a uniform branch), so the
 * picture is never darkened toward its corners or its foot, exactly. The grain's hash is the kit's
 * `aivHash12` (glsl.ts, public domain), not the film's.
 */
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { Color, Uniform, type ColorRepresentation } from 'three';
import { AIV_HASH_GLSL } from './glsl.ts';

/** The finish's default vignette strength (*A Halloween Gift*'s). */
export const FINISH_VIGNETTE = 0.8;
/** The default floor the finished picture sits on (sRGB hex, *A Halloween Gift*'s): near-black maroon low in the frame, slate high. */
export const FINISH_LIFT = { low: '#1a0505', high: '#0d1018' } as const;

/**
 * The finish's screen-space tint at a pixel, as a multiplier (uv 0..1 from the bottom left):
 * the vignette (strength `v`) and the foot band (`foot` 0..1). One definition for the finish and
 * for any material that undoes the tint on its own pixels. The shape is *A Halloween Gift*'s:
 *  - the vignette: an oval that frames the bottom corners in near-black; wide open in the middle
 *    and eased out toward the top, and toward the bottom red darkens less than green and blue,
 *    so the corners go maroon;
 *  - the foot: a deep band across the bottom of the frame, where green and blue go down much
 *    more than red.
 * With `v` and `foot` both 0 it returns exactly 1.
 */
export const FINISH_TINT_GLSL = /* glsl */ `
vec3 aivFinishTint(vec2 uv, float v, float foot) {
  vec2 d = (uv - 0.5) * vec2(1.0, 0.82);
  float k = smoothstep(0.3, 0.8, length(d)) * v * mix(1.0, 0.2, smoothstep(0.4, 0.95, uv.y));
  vec3 dk = mix(vec3(0.6, 1.0, 1.0), vec3(1.0), smoothstep(0.15, 0.75, uv.y));
  float fb = smoothstep(0.27, 0.02, uv.y) * foot;
  return (1.0 - min(k * dk, vec3(0.95))) * (1.0 - fb * vec3(0.4, 0.8, 0.82));
}
`;

const FINISH = /* glsl */ `
uniform float uVignette;
uniform float uFrame;
uniform float uGrain;
uniform vec3 uLiftLow;
uniform vec3 uLiftHigh;
uniform float uFoot;
${FINISH_TINT_GLSL}
${AIV_HASH_GLSL}
vec3 fEnc(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 fDec(vec3 c) { c = max(c, 0.0); return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  // the vignette and the foot band (FINISH_TINT_GLSL); a glow inside them keeps its own colour
  // and most of its light (the band recoloured a cyan glow into a salmon-lilac smear). Skipped
  // when both are off: the picture is then never darkened, not even by a rounding
  if (uVignette > 0.0 || uFoot > 0.0) {
    vec3 tint = aivFinishTint(uv, uVignette, uFoot);
    float glow = smoothstep(0.3, 0.7, dot(c, vec3(0.2126, 0.7152, 0.0722)));
    c *= mix(tint, vec3(max(tint.r, max(tint.g, tint.b))), glow);
  }
  // the floor the picture sits on: uLiftLow low in the frame, uLiftHigh high
  vec3 lift = mix(uLiftLow, uLiftHigh, smoothstep(0.05, 0.85, uv.y));
  c = lift + c * (1.0 - lift);
  // film grain on display values (this pass works in linear light): one monochrome value on all
  // three channels, constant in output levels (about 1.8 levels std in the mid-tones, less in the
  // darks), in cells of 1.5 px so it survives the delivery encode; in linear light the encode
  // amplified it most in the darkest channel (a teal speckle on dark maroon)
  vec3 e = fEnc(c);
  float l = dot(e, vec3(0.2126, 0.7152, 0.0722));
  float n = aivHash12(floor(gl_FragCoord.xy / 1.5) + uFrame * 17.31) - 0.5;
  float resp = smoothstep(0.03, 0.3, l) * (1.0 - smoothstep(0.7, 1.0, l));
  e += n * uGrain * (0.35 + 0.65 * resp) * 0.024;
  outputColor = vec4(clamp(fDec(e), 0.0, 1.0), inputColor.a);
}
`;

export interface FinishOptions {
  /** vignette strength (default `FINISH_VIGNETTE`, 0.8); 0: the corners never darken */
  vignette?: number;
  /** film grain strength (default 1; 0: none, for measuring boil) */
  grain?: number;
  /** the floor low in the frame (sRGB; default `FINISH_LIFT.low`); black: no floor */
  liftLow?: ColorRepresentation;
  /** the floor high in the frame (sRGB; default `FINISH_LIFT.high`); black: no floor */
  liftHigh?: ColorRepresentation;
  /** the foot band's strength, 0..1 (default 1, as in *A Halloween Gift*); 0: no band */
  foot?: number;
}

/**
 * Vignette, floor lift and grain on display values (EffectAttribute.NONE: it stays after the tone
 * mapping). Its uniforms are `uVignette`, `uGrain`, `uLiftLow`, `uLiftHigh` (linear, from the sRGB
 * options), `uFoot` and `uFrame`; `frame` and `foot` set the two that change per frame.
 */
export class FinishEffect extends Effect {
  constructor({ vignette = FINISH_VIGNETTE, grain = 1.0, liftLow = FINISH_LIFT.low, liftHigh = FINISH_LIFT.high, foot = 1 }: FinishOptions = {}) {
    super('FinishEffect', FINISH, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.NONE,
      uniforms: new Map<string, Uniform>([
        ['uVignette', new Uniform(vignette)],
        ['uFrame', new Uniform(0)],
        ['uGrain', new Uniform(grain)],
        // the floor the final picture sits on (sRGB in; the pass works in tone-mapped linear light)
        ['uLiftLow', new Uniform(new Color(liftLow))],
        ['uLiftHigh', new Uniform(new Color(liftHigh))],
        ['uFoot', new Uniform(foot)],
      ]),
    });
  }

  /** The grain's frame (the frame index: a pure function of it, never a clock). */
  get frame(): number {
    return this.uniforms.get('uFrame')!.value as number;
  }
  set frame(f: number) {
    this.uniforms.get('uFrame')!.value = f;
  }

  /** The foot band's strength, 0..1. */
  get foot(): number {
    return this.uniforms.get('uFoot')!.value as number;
  }
  set foot(v: number) {
    this.uniforms.get('uFoot')!.value = v;
  }
}
