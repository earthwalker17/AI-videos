import { ChromaticAberrationEffect, DepthEffect, NoiseEffect, VignetteEffect } from 'postprocessing';
import { describe, expect, it } from 'vitest';
import { assertAfterToneMapping } from './effectOrder.ts';

describe('PostChain afterToneMapping', () => {
  it('accepts effects postprocessing keeps in place and refuses those it would sort before tone mapping', () => {
    expect(() => assertAfterToneMapping([])).not.toThrow();
    expect(() => assertAfterToneMapping([new NoiseEffect(), new VignetteEffect()])).not.toThrow();
    expect(() => assertAfterToneMapping([new NoiseEffect(), new ChromaticAberrationEffect()])).toThrow(/ChromaticAberrationEffect.*before the tone mapping/);
    expect(() => assertAfterToneMapping([new DepthEffect()])).toThrow(/DepthEffect/);
  });
});
