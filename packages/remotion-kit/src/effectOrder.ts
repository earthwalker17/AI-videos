/**
 * The effect-order rule of PostChain's afterToneMapping, apart from the component so it is tested
 * without loading R3F.
 */
import { EffectAttribute, type Effect } from 'postprocessing';

/**
 * Throws unless every effect has EffectAttribute.NONE. EffectPass.setEffects sorts by attributes,
 * highest first (postprocessing 6.39.5, build/index.js line 15580:
 * `this.effects = effects.sort((a, b) => b.attributes - a.attributes)`). The sort is stable and
 * ToneMappingEffect has NONE, so NONE effects placed after it stay after it; a depth or
 * convolution effect would silently run before the tone mapping.
 */
export function assertAfterToneMapping(effects: readonly Effect[]): void {
  const moved = effects.filter((e) => e.getAttributes() !== EffectAttribute.NONE);
  if (moved.length > 0)
    throw new Error(
      `PostChain afterToneMapping: ${moved.map((e) => e.name).join(', ')} has depth or convolution attributes, so postprocessing would sort it before the tone mapping; put it in \`effects\` instead`,
    );
}
