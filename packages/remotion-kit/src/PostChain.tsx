/**
 * PostChain: a postprocessing EffectComposer built SYNCHRONOUSLY, inside a <Stage3D>.
 *
 * Why not @react-three/postprocessing: it assembles its composer and passes in effects that run
 * after the first render, so under Remotion the first frames of every page (every chunk start)
 * come out blank or unprocessed (THE AI STACK). Here the composer, the render pass and every
 * other pass are created in useMemo, sized in useLayoutEffect, and take over rendering from the
 * very first R3F advance: a frame looks the same whichever frame a chunk started at.
 *
 * Render takeover is R3F's priority subscription (useFrame with priority 1 makes R3F skip its own
 * gl.render). The callback ignores R3F's state and delta (wall-clock based) and renders with a
 * delta of 0, so effects never accumulate time: an effect that animates must get its time from
 * the frame index, either a uniform set from useCurrentFrame() or the `time` prop, which sets
 * every effect pass's shared `time` uniform (NoiseEffect and custom effect shaders read it)
 * before each render.
 *
 * The passes, in order: the render pass; the custom `passes`; one effect pass per `stages` entry;
 * the last effect pass: `effects`, a ToneMappingEffect, then the `afterToneMapping` effects.
 * postprocessing merges a pass's effects into one shader, sorts them by attributes and lets each
 * sample the pass's input, so effects that must see another's result (a painterly filter after
 * the depth of field and the bloom) go in an earlier stage, and a stage holds at most one
 * convolution effect (effectOrder.ts). Every pass before the last renders in HDR linear light into
 * the composer's HalfFloat buffers, without tone mapping or dithering; the last pass encodes sRGB,
 * then dithers (on by default): the 8-bit output of dark gradients (vignette, fog) otherwise
 * bands, worse after YouTube's re-encode. three's dither is a fixed hash of gl_FragCoord (±0.5
 * code value), so it is the same in every render. Without `stages` and `passes` the chain is
 * the render pass and the one merged pass, exactly as before they existed (same pixels).
 *
 * Pass stable factories (module scope or useCallback): a new function every render would rebuild
 * the composer every frame.
 */
// eslint-disable-next-line no-restricted-imports -- the one render-takeover subscription (priority 1); frame-driven: ThreeCanvas advances once per Remotion frame and the callback reads no time
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode, type Effect, type EffectMaterial, type Pass } from 'postprocessing';
import { useLayoutEffect, useMemo } from 'react';
import { HalfFloatType, type Camera, type Scene, type WebGLRenderer } from 'three';
import { assertAfterToneMapping, assertStages } from './effectOrder.ts';

export interface PostChainProps {
  /** builds the last stage's effects, before the tone mapping, for the scene camera, once (keep the function stable) */
  effects?: (camera: Camera) => Effect[];
  /**
   * builds effect stages that run before the last stage, in order (keep the function stable).
   * Each inner array becomes its own effect pass, which sees the previous stage's output in HDR
   * linear light; an empty one is skipped. At most one convolution effect per stage (PostChain throws).
   */
  stages?: (camera: Camera) => Effect[][];
  /**
   * builds custom passes (with render targets of their own) that run right after the render pass,
   * before the stages (keep the function stable). The composer initializes and sizes them; they
   * get delta 0 and take their time from the frame, through their own uniforms.
   */
  passes?: (camera: Camera) => Pass[];
  /**
   * builds effects that run after tone mapping, in the last pass (keep the function stable). Each
   * must have EffectAttribute.NONE: postprocessing sorts a pass's effects by attributes, which
   * would move a depth or convolution effect in front of the tone mapping (PostChain throws).
   */
  afterToneMapping?: (camera: Camera) => Effect[];
  /** seconds for every effect pass's shared `time` uniform, from the frame index (frame / fps); absent: 0 */
  time?: number;
  /** MSAA samples of the composer's buffers (default 4; WebGL 2) */
  multisampling?: number;
  /** tone mapping, applied in the last pass after its effects (default ACES Filmic) */
  toneMapping?: ToneMappingMode;
  /** dither the 8-bit output against banding (default true; off for exact-value tests) */
  dithering?: boolean;
}

/** What buildPostChain needs: the factories and the resolved settings. */
export type PostChainBuild = Pick<PostChainProps, 'effects' | 'stages' | 'passes' | 'afterToneMapping'> & Required<Pick<PostChainProps, 'multisampling' | 'toneMapping' | 'dithering'>>;

/**
 * The composer with all its passes, and its effect passes in order (the last one tone-maps).
 * Construction only (three allocates GPU resources on first use): PostChain calls it inside
 * useMemo, synchronously. Exported for the test.
 */
export function buildPostChain(gl: WebGLRenderer, scene: Scene, camera: Camera, o: PostChainBuild): { composer: EffectComposer; effectPasses: EffectPass[] } {
  const after = o.afterToneMapping?.(camera) ?? [];
  // postprocessing sorts a pass's effects by attributes: only NONE effects stay after tone mapping
  assertAfterToneMapping(after);
  const c = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: o.multisampling });
  c.addPass(new RenderPass(scene, camera));
  for (const p of o.passes?.(camera) ?? []) c.addPass(p);
  const staged = (o.stages?.(camera) ?? []).filter((s) => s.length > 0);
  const last = [...(o.effects?.(camera) ?? []), new ToneMappingEffect({ mode: o.toneMapping }), ...after];
  // before any effect pass is built: a clear message instead of postprocessing's merge error
  assertStages(staged, last);
  const eps = [...staged, last].map((s) => new EffectPass(camera, ...s));
  // HDR intermediates: no dither (it belongs to the 8-bit output); the composer's buffers are HalfFloat
  eps.forEach((p, k) => (p.dithering = k === eps.length - 1 ? o.dithering : false));
  for (const p of eps) c.addPass(p);
  // only the last pass draws to the canvas (a custom pass built with renderToScreen would
  // otherwise stop the composer from handing it to the last pass)
  c.passes.forEach((p, k) => (p.renderToScreen = k === c.passes.length - 1));
  return { composer: c, effectPasses: eps };
}

export function PostChain({ effects, stages, passes, afterToneMapping, time, multisampling = 4, toneMapping = ToneMappingMode.ACES_FILMIC, dithering = true }: PostChainProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const { composer, effectPasses } = useMemo(
    () => buildPostChain(gl, scene, camera, { effects, stages, passes, afterToneMapping, multisampling, toneMapping, dithering }),
    [gl, scene, camera, effects, stages, passes, afterToneMapping, multisampling, toneMapping, dithering],
  );
  // before the first advance: layout effects run before ThreeCanvas's per-frame render
  useLayoutEffect(() => composer.setSize(width, height), [composer, width, height]);
  useLayoutEffect(() => () => composer.dispose(), [composer]);
  useFrame(() => {
    // EffectPass.render adds delta × timeScale to the material's time: with delta 0 the value set
    // here is exactly what the shaders read (EffectMaterial.time, the `time` uniform)
    if (time !== undefined) for (const p of effectPasses) (p.fullscreenMaterial as EffectMaterial).time = time;
    composer.render(0);
  }, 1);
  return null;
}
