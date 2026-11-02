/**
 * PostChain: a postprocessing EffectComposer built SYNCHRONOUSLY, inside a <Stage3D>.
 *
 * Why not @react-three/postprocessing: it assembles its composer and passes in effects that run
 * after the first render, so under Remotion the first frames of every page (every chunk start)
 * come out blank or unprocessed (THE AI STACK). Here the composer, the render pass and one merged
 * effect pass are created in useMemo, sized in useLayoutEffect, and take over rendering from the
 * very first R3F advance: a frame looks the same whichever frame a chunk started at.
 *
 * Render takeover is R3F's priority subscription (useFrame with priority 1 makes R3F skip its own
 * gl.render). The callback ignores R3F's state and delta (wall-clock based) and renders with a
 * delta of 0, so effects never accumulate time: an effect that animates must get its time from
 * the frame index, either a uniform set from useCurrentFrame() or the `time` prop, which sets the
 * pass's shared `time` uniform (NoiseEffect and custom effect shaders read it) before each render.
 *
 * Effects run in HDR linear light (HalfFloat buffers); a ToneMappingEffect follows them, then the
 * `afterToneMapping` effects (grain, paper, anything that must act on display values), and the
 * final pass encodes sRGB, then dithers (on by default): the 8-bit output of dark gradients
 * (vignette, fog) otherwise bands, worse after YouTube's re-encode. three's dither is a fixed
 * hash of gl_FragCoord (±0.5 code value), so it is the same in every render. Pass stable
 * factories (module scope or useCallback): a new function every render would rebuild the
 * composer every frame.
 */
// eslint-disable-next-line no-restricted-imports -- the one render-takeover subscription (priority 1); frame-driven: ThreeCanvas advances once per Remotion frame and the callback reads no time
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode, type Effect, type EffectMaterial } from 'postprocessing';
import { useLayoutEffect, useMemo } from 'react';
import { HalfFloatType, type Camera } from 'three';
import { assertAfterToneMapping } from './effectOrder.ts';

export interface PostChainProps {
  /** builds the effects for the scene camera, once (keep the function stable) */
  effects: (camera: Camera) => Effect[];
  /**
   * builds effects that run after tone mapping, in the same pass (keep the function stable). Each
   * must have EffectAttribute.NONE: postprocessing sorts a pass's effects by attributes, which
   * would move a depth or convolution effect in front of the tone mapping (PostChain throws).
   */
  afterToneMapping?: (camera: Camera) => Effect[];
  /** seconds for the effects' shared `time` uniform, from the frame index (frame / fps); absent: 0 */
  time?: number;
  /** MSAA samples of the composer's buffers (default 4; WebGL 2) */
  multisampling?: number;
  /** tone mapping, applied after the effects (default ACES Filmic) */
  toneMapping?: ToneMappingMode;
  /** dither the 8-bit output against banding (default true; off for exact-value tests) */
  dithering?: boolean;
}

export function PostChain({ effects, afterToneMapping, time, multisampling = 4, toneMapping = ToneMappingMode.ACES_FILMIC, dithering = true }: PostChainProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const { composer, pass } = useMemo(() => {
    const after = afterToneMapping?.(camera) ?? [];
    // postprocessing sorts a pass's effects by attributes: only NONE effects stay after tone mapping
    assertAfterToneMapping(after);
    const c = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling });
    c.addPass(new RenderPass(scene, camera));
    const p = new EffectPass(camera, ...effects(camera), new ToneMappingEffect({ mode: toneMapping }), ...after);
    p.dithering = dithering;
    c.addPass(p);
    return { composer: c, pass: p };
  }, [gl, scene, camera, effects, afterToneMapping, multisampling, toneMapping, dithering]);
  // before the first advance: layout effects run before ThreeCanvas's per-frame render
  useLayoutEffect(() => composer.setSize(width, height), [composer, width, height]);
  useLayoutEffect(() => () => composer.dispose(), [composer]);
  useFrame(() => {
    // EffectPass.render adds delta × timeScale to the material's time: with delta 0 the value set
    // here is exactly what the shaders read (EffectMaterial.time, the `time` uniform)
    if (time !== undefined) (pass.fullscreenMaterial as EffectMaterial).time = time;
    composer.render(0);
  }, 1);
  return null;
}
