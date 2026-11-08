/**
 * FinishEffect's options and uniforms, and its place in a PostChain (no GL context: three and
 * postprocessing allocate on first use). Pixels are checked by rendering a video that uses it.
 */
import { BloomEffect, EffectAttribute, ToneMappingEffect, ToneMappingMode, type Effect } from 'postprocessing';
import { Color, PerspectiveCamera, Scene, SRGBColorSpace, type Vector2, type WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';
import { FINISH_LIFT, FINISH_TINT_GLSL, FINISH_VIGNETTE, FinishEffect } from './finish.ts';
import { AIV_HASH_GLSL, NOISE3_BODY_GLSL, NOISE3_GLSL, NOISE_GLSL } from './glsl.ts';
import { buildPostChain } from './PostChain.tsx';

const value = (e: Effect, name: string) => e.uniforms.get(name)!.value as unknown;

describe('FinishEffect', () => {
  it('defaults to A Halloween Gift: vignette 0.8, grain 1, foot band 1, its maroon and slate floor', () => {
    const e = new FinishEffect();
    expect(e.name).toBe('FinishEffect');
    expect(e.getAttributes()).toBe(EffectAttribute.NONE);
    expect([value(e, 'uVignette'), value(e, 'uGrain'), value(e, 'uFoot'), value(e, 'uFrame')]).toEqual([FINISH_VIGNETTE, 1, 1, 0]);
    expect(FINISH_VIGNETTE).toBe(0.8);
    expect(FINISH_LIFT).toEqual({ low: '#1a0505', high: '#0d1018' });
    // the sRGB options become linear uniforms, as three's colour management converts them
    expect((value(e, 'uLiftLow') as Color).equals(new Color('#1a0505'))).toBe(true);
    expect((value(e, 'uLiftHigh') as Color).equals(new Color('#0d1018'))).toBe(true);
    expect(e.getFragmentShader()).toContain(FINISH_TINT_GLSL);
  });

  it('takes vignette 0 (never replaced by the default), no foot band, its own floor and grain', () => {
    const e = new FinishEffect({ vignette: 0, foot: 0, grain: 0.5, liftLow: 0x000000, liftHigh: '#101010' });
    expect([value(e, 'uVignette'), value(e, 'uFoot'), value(e, 'uGrain')]).toEqual([0, 0, 0.5]);
    expect((value(e, 'uLiftLow') as Color).getHex()).toBe(0);
    // with both off the tint is skipped, so nothing darkens, not even by a rounding
    expect(e.getFragmentShader()).toMatch(/if \(uVignette > 0\.0 \|\| uFoot > 0\.0\) \{\s*vec3 tint = aivFinishTint/);
  });

  it('sets the grain frame and the foot band per frame', () => {
    const e = new FinishEffect();
    e.frame = 37;
    e.foot = 0.25;
    expect([e.frame, e.foot, value(e, 'uFrame'), value(e, 'uFoot')]).toEqual([37, 0.25, 37, 0.25]);
  });

  it('stays after the tone mapping in a PostChain', () => {
    const renderer = {
      getSize: (v: Vector2) => v.set(64, 36),
      getDrawingBufferSize: (v: Vector2) => v.set(64, 36),
      getPixelRatio: () => 1,
      setSize: () => undefined,
      getContext: () => ({ getContextAttributes: () => ({ alpha: false }) }),
      capabilities: { logarithmicDepthBuffer: false, reversedDepthBuffer: false },
      outputColorSpace: SRGBColorSpace,
      autoClear: true,
    } as unknown as WebGLRenderer;
    const finish = new FinishEffect({ vignette: 0 });
    const { effectPasses } = buildPostChain(renderer, new Scene(), new PerspectiveCamera(), {
      multisampling: 0,
      toneMapping: ToneMappingMode.NEUTRAL,
      dithering: true,
      effects: () => [new BloomEffect()],
      afterToneMapping: () => [finish],
    });
    const list = (effectPasses.at(-1) as unknown as { effects: Effect[] }).effects;
    expect(list.at(-2)).toBeInstanceOf(ToneMappingEffect);
    expect(list.at(-1)).toBe(finish);
  });
});

describe('the noise GLSL', () => {
  const defs = (src: string, name: string) => src.match(new RegExp(`\\b(?:float|uint) ${name}\\(`, 'g')) ?? [];
  it('defines each of its functions once', () => {
    for (const [src, names] of [
      [NOISE_GLSL, ['aivMix32', 'aivHash12', 'aivHash13', 'aivNoise', 'aivFbm']],
      [NOISE3_GLSL, ['aivMix32', 'aivHash12', 'aivHash13', 'aivNoise3', 'aivFbm3']],
      [NOISE_GLSL + NOISE3_BODY_GLSL, ['aivMix32', 'aivHash12', 'aivHash13', 'aivNoise', 'aivFbm', 'aivNoise3', 'aivFbm3']],
    ] as const)
      for (const n of names) expect(defs(src, n)).toHaveLength(1);
  });
  it("hashes with integer arithmetic (MurmurHash3's fmix32), not the film's float hash", () => {
    expect(AIV_HASH_GLSL).toContain('floatBitsToUint');
    expect(AIV_HASH_GLSL).toContain('0x85ebca6bu');
    for (const src of [NOISE_GLSL, NOISE3_GLSL, new FinishEffect().getFragmentShader() ?? '']) {
      expect(src).toContain('aivMix32');
      expect(src).not.toContain('0.1031');
      expect(src).not.toContain('33.33');
    }
  });
});
