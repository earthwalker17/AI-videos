import { BlendFunction, BloomEffect, ChromaticAberrationEffect, DepthEffect, DepthOfFieldEffect, Effect, EffectAttribute, NoiseEffect, SMAAEffect, ToneMappingEffect, VignetteEffect } from 'postprocessing';
import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { assertAfterToneMapping, assertStage, assertStages, stageOrder } from './effectOrder.ts';

// a stand-in for a painterly filter (Kuwahara): samples neighbours, so CONVOLUTION
class Painterly extends Effect {
  constructor() {
    super('Painterly', 'void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = inputColor; }', { attributes: EffectAttribute.CONVOLUTION });
  }
}
// an effect that moves the image (mainUv), like a lens wobble
class Wobble extends Effect {
  constructor() {
    super('Wobble', 'void mainUv(inout vec2 uv) { uv += 0.0; }');
  }
}

describe('PostChain afterToneMapping', () => {
  it('accepts effects postprocessing keeps in place and refuses those it would sort before tone mapping', () => {
    expect(() => assertAfterToneMapping([])).not.toThrow();
    expect(() => assertAfterToneMapping([new NoiseEffect(), new VignetteEffect()])).not.toThrow();
    expect(() => assertAfterToneMapping([new NoiseEffect(), new ChromaticAberrationEffect()])).toThrow(/ChromaticAberrationEffect.*before the tone mapping/);
    expect(() => assertAfterToneMapping([new DepthEffect()])).toThrow(/DepthEffect/);
  });
});

describe('PostChain stages', () => {
  it('runs a stage in postprocessing order: by attributes, highest first, stable', () => {
    const camera = new PerspectiveCamera();
    const bloom = new BloomEffect();
    const dof = new DepthOfFieldEffect(camera);
    const paint = new Painterly();
    const vignette = new VignetteEffect();
    // in one pass the painterly filter would run first, on the raw scene, whatever its place
    expect(stageOrder([bloom, dof, vignette, paint]).map((e) => e.name)).toEqual(['Painterly', 'DepthOfFieldEffect', 'BloomEffect', 'VignetteEffect']);
    // NONE effects keep their order, so effects placed after the tone mapping stay after it
    const tone = new ToneMappingEffect();
    const noise = new NoiseEffect();
    expect(stageOrder([vignette, tone, noise])).toEqual([vignette, tone, noise]);
  });

  it('allows one convolution effect per stage and names the clashing effects', () => {
    expect(() => assertStage([new Painterly(), new BloomEffect(), new VignetteEffect()], 'stage 1 of 1')).not.toThrow();
    expect(() => assertStage([new Painterly(), new SMAAEffect()], 'stage 2 of 3')).toThrow(/stage 2 of 3: Painterly, SMAAEffect are convolution effects.*one of them per stage/);
    // a DST-blended effect is not merged, so it does not count
    const muted = new ChromaticAberrationEffect();
    muted.blendMode.blendFunction = BlendFunction.DST;
    expect(() => assertStage([new Painterly(), muted], 'stage 1 of 1')).not.toThrow();
  });

  it('refuses a UV-transforming effect next to a convolution effect', () => {
    expect(() => assertStage([new Wobble(), new VignetteEffect()], 'stage 1 of 1')).not.toThrow();
    expect(() => assertStage([new Wobble(), new Painterly()], 'stage 1 of 1')).toThrow(/Wobble transforms UVs.*Painterly/);
  });

  it('checks every stage and the last one, which holds the tone mapping', () => {
    const camera = new PerspectiveCamera();
    const last = [new BloomEffect(), new ToneMappingEffect(), new NoiseEffect()];
    // the painterly filter in its own stage after the depth of field and its own convolution: fine
    expect(() => assertStages([[new DepthOfFieldEffect(camera)], [new Painterly()]], last)).not.toThrow();
    expect(() => assertStages([[new DepthOfFieldEffect(camera)], [new Painterly(), new ChromaticAberrationEffect()]], last)).toThrow(/stage 2 of 2: Painterly, ChromaticAberrationEffect/);
    expect(() => assertStages([[new Painterly()]], [new SMAAEffect(), new ChromaticAberrationEffect(), new ToneMappingEffect()])).toThrow(/last stage.*SMAAEffect, ChromaticAberrationEffect/);
    expect(() => assertStages([], last)).not.toThrow();
  });
});
