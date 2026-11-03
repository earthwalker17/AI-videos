/**
 * The effect-order rules of PostChain, apart from the component so they are tested without
 * loading R3F: what may follow the tone mapping, and what postprocessing can merge into one stage.
 *
 * postprocessing 6.39.5 (build/index.js) merges a pass's effects into one shader:
 *  - EffectPass.setEffects sorts them by attributes, highest first (line 15580:
 *    `this.effects = effects.sort((a, b) => b.attributes - a.attributes)`; stable). CONVOLUTION
 *    is 2, DEPTH 1, NONE 0, so a convolution effect runs first whatever its place in the list;
 *  - EffectPass.updateMaterial throws `Convolution effects cannot be merged` for a second
 *    effect with CONVOLUTION (line 15596), and integrateEffect throws `Effects that transform
 *    UVs are incompatible with convolution effects` for a mainUv effect in a pass that has one
 *    (line 15420). An effect blended with BlendFunction.DST is not merged at all (it only lends
 *    its DEPTH attribute), so it counts for neither rule.
 * Each effect of a pass samples the pass's input, not the previous effect's output: an effect
 * that must see another's result (a painterly filter after the depth of field) needs a later stage.
 */
import { BlendFunction, EffectAttribute, type Effect } from 'postprocessing';

/**
 * Throws unless every effect has EffectAttribute.NONE. EffectPass.setEffects sorts by attributes,
 * highest first, and the sort is stable; ToneMappingEffect has NONE, so NONE effects placed after
 * it stay after it, while a depth or convolution effect would silently run before the tone mapping.
 */
export function assertAfterToneMapping(effects: readonly Effect[]): void {
  const moved = effects.filter((e) => e.getAttributes() !== EffectAttribute.NONE);
  if (moved.length > 0)
    throw new Error(
      `PostChain afterToneMapping: ${moved.map((e) => e.name).join(', ')} has depth or convolution attributes, so postprocessing would sort it before the tone mapping; put it in \`effects\` instead`,
    );
}

/** The order in which postprocessing runs one pass's effects: by attributes, highest first, stable. */
export const stageOrder = (effects: readonly Effect[]): Effect[] => [...effects].sort((a, b) => b.getAttributes() - a.getAttributes());

// merged into the pass's shader (a DST-blended effect is skipped, see the header)
const merged = (e: Effect): boolean => e.blendMode.blendFunction !== BlendFunction.DST;
const isConvolution = (e: Effect): boolean => merged(e) && (e.getAttributes() & EffectAttribute.CONVOLUTION) !== 0;
const transformsUv = (e: Effect): boolean => merged(e) && /mainUv/.test(e.getFragmentShader() ?? '');

/**
 * Throws when postprocessing could not merge `effects` into one pass: two convolution effects, or
 * a convolution effect with one that transforms UVs. `label` names the stage in the message.
 */
export function assertStage(effects: readonly Effect[], label: string): void {
  const conv = effects.filter(isConvolution);
  if (conv.length > 1)
    throw new Error(
      `PostChain ${label}: ${conv.map((e) => e.name).join(', ')} are convolution effects (they sample neighbouring pixels); postprocessing merges a stage into one shader and allows one of them per stage: give each its own stage`,
    );
  const uv = conv.length ? effects.filter(transformsUv) : [];
  if (uv.length > 0)
    throw new Error(
      `PostChain ${label}: ${uv.map((e) => e.name).join(', ')} transforms UVs, which postprocessing cannot merge with the convolution effect ${conv[0].name}: give it its own stage`,
    );
}

/**
 * The checks of a whole chain: each of `stages` (in order), then the last stage (`effects`, the
 * tone mapping and `afterToneMapping`).
 */
export function assertStages(stages: readonly (readonly Effect[])[], last: readonly Effect[]): void {
  stages.forEach((s, k) => assertStage(s, `stage ${k + 1} of ${stages.length}`));
  assertStage(last, 'last stage (effects, tone mapping, afterToneMapping)');
}
