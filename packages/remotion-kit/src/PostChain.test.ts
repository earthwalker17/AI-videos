/**
 * PostChain's pass layout, built against a stand-in renderer (construction needs no GL context:
 * three allocates on first use). Pixels are checked by rendering the template (frames.sha256).
 */
import { BloomEffect, DepthOfFieldEffect, Effect, EffectAttribute, EffectPass, KawaseBlurPass, NoiseEffect, RenderPass, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';
import { PerspectiveCamera, Scene, SRGBColorSpace, type Camera, type Vector2, type WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';
import { buildPostChain, type PostChainBuild } from './PostChain.tsx';

const renderer = () =>
  ({
    getSize: (v: Vector2) => v.set(64, 36),
    getDrawingBufferSize: (v: Vector2) => v.set(64, 36),
    getPixelRatio: () => 1,
    setSize: () => undefined,
    getContext: () => ({ getContextAttributes: () => ({ alpha: false }) }),
    capabilities: { logarithmicDepthBuffer: false, reversedDepthBuffer: false },
    outputColorSpace: SRGBColorSpace,
    autoClear: true,
  }) as unknown as WebGLRenderer;

class Painterly extends Effect {
  constructor() {
    super('Painterly', 'void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = inputColor; }', { attributes: EffectAttribute.CONVOLUTION });
  }
}

// no MSAA: probing the sample count needs a real context
const base: PostChainBuild = { multisampling: 0, toneMapping: ToneMappingMode.NEUTRAL, dithering: true };
const build = (o: Partial<PostChainBuild>) => buildPostChain(renderer(), new Scene(), new PerspectiveCamera(), { ...base, ...o });
// private in the types: the list the pass merges, sorted the way postprocessing runs it
const effectsOf = (p: EffectPass) => (p as unknown as { effects: Effect[] }).effects;
const names = (p: EffectPass) => effectsOf(p).map((e) => e.name);

describe('buildPostChain', () => {
  it('without stages or passes: the render pass and one merged pass that tone-maps, dithers and draws to the canvas', () => {
    const { composer, effectPasses } = build({ effects: () => [new BloomEffect(), new VignetteEffect()], afterToneMapping: () => [new NoiseEffect()] });
    expect(composer.passes).toHaveLength(2);
    expect(composer.passes[0]).toBeInstanceOf(RenderPass);
    expect(effectPasses).toEqual([composer.passes[1]]);
    expect(names(effectPasses[0])).toEqual(['BloomEffect', 'VignetteEffect', 'ToneMappingEffect', 'NoiseEffect']);
    expect([effectPasses[0].dithering, effectPasses[0].renderToScreen, composer.passes[0].renderToScreen]).toEqual([true, true, false]);
  });

  it('runs custom passes, then each stage in its own pass, then the last stage; only the last dithers and draws to the canvas', () => {
    const blur = new KawaseBlurPass();
    // a custom pass that claims the screen must not keep the last pass from it
    blur.renderToScreen = true;
    const stages = (camera: Camera) => [[new DepthOfFieldEffect(camera), new BloomEffect()], [], [new Painterly()]];
    const { composer, effectPasses } = build({ passes: () => [blur], stages, effects: () => [new VignetteEffect()] });
    expect(composer.passes.map((p) => p.constructor.name)).toEqual(['RenderPass', 'KawaseBlurPass', 'EffectPass', 'EffectPass', 'EffectPass']);
    // the empty stage is skipped; the painterly filter sees the depth of field and the bloom
    expect(effectPasses.map(names)).toEqual([['DepthOfFieldEffect', 'BloomEffect'], ['Painterly'], ['VignetteEffect', 'ToneMappingEffect']]);
    expect(effectPasses.map((p) => p.dithering)).toEqual([false, false, true]);
    expect(composer.passes.map((p) => p.renderToScreen)).toEqual([false, false, false, false, true]);
    expect(effectsOf(effectPasses.at(-1)!).at(-1)).toBeInstanceOf(ToneMappingEffect);
  });

  it('works with stages alone, and refuses two convolution effects in one stage before building it', () => {
    const { effectPasses } = build({ stages: () => [[new Painterly()]] });
    expect(effectPasses.map(names)).toEqual([['Painterly'], ['ToneMappingEffect']]);
    expect(() => build({ stages: () => [[new Painterly(), new Painterly()]] })).toThrow(/stage 1 of 1: Painterly, Painterly are convolution effects/);
  });
});
