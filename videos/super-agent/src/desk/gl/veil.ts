/**
 * The dissolve to the bare desk (STORYBOARD 13.1, cues.ts END.dissolve; end.ts veilAt): the desk itself, laid over the
 * whole world as a veil and faded in, so the world dissolves to the bare desk and never to black. One WebGL world at a
 * time (the module-level uniforms, DeskWorld's ResetShared and the iGPU's memory rule out a second world under it).
 *
 * The veil is the desk's own shader (gl/desk.ts makeDeskMaterial: the slate's tooth and cloud, the floor clamp) on a
 * plane registered exactly at the desk plane (z = 0), so each pixel shows the desk point that pixel looks at. It is the
 * bare desk: no grooves and no imprints (its own mark uniforms, as DeskWorld's Ground drops them for `marks` false) and
 * its own shut hatches, so a bay standing in its open hatch dissolves into the slate with everything else; and it is lit
 * by its own light (`END_LIGHT`: the same uniform objects' shape, holding only the end card's footprints and the end's
 * one soft pool, endCard.ts endPools), so at a full veil the frame is what the end's own world draws from the card's
 * landing (desk/EndFrame.tsx, its ground's marks off).
 *
 * The incoming layer (the bare desk and the end card being posted onto it) is laid over the world by one constant alpha
 * (the dissolve's amount `veilAlpha`, no fragment alpha, so each shader is its own), exactly: a pixel of the card is
 * a·card + (1−a)·world, every other pixel a·desk + (1−a)·world. In the draw order after everything of the world (the
 * transparent list, renderOrder from `VEIL_ORDER`):
 * 1. `makeDepthReset`: the desk plane's depth everywhere and no colour (depthFunc Always), so the incoming layer is
 *    tested against the bare desk and never against the world under it;
 * 2. the end card (objects/End.tsx EndCardBody `over`), blended at the constant alpha (`veilBlend`), its depth written;
 * 3. the veil, blended at the same alpha, depth-tested LessEqual against step 1's plane (the same geometry, so the same
 *    depths): it draws everywhere but where the card is.
 *
 * Its program is the desk's without three's OPAQUE define (any blending but NormalBlending is not opaque; the depth
 * reset is transparent too): one new program, compiled the first time the veil draws (film f6161).
 */
import { AlwaysDepth, AddEquation, ConstantAlphaFactor, CustomBlending, LessEqualDepth, OneFactor, OneMinusConstantAlphaFactor, Vector4, ZeroFactor, type Material, type ShaderMaterial } from 'three';
import { MAX_FOOTPRINTS, packFootprints, type Footprint } from '../footprints.ts';
import type { Pool } from '../layout.ts';
import { MAX_POOLS, packPools } from '../pools.ts';
import { HOLE_SHUT, makeDeskMaterial } from './desk.ts';
import { LIGHT_UNIFORMS } from './light.ts';

/** Where the veil and what lies on it sit in the draw order (after every object of the world: their renderOrder is under 100). */
export const VEIL_ORDER = 1000;
/** The draw order of the incoming layer's three passes (see the module's doc). */
export const VEIL_PASS = { depth: VEIL_ORDER, card: VEIL_ORDER + 1, desk: VEIL_ORDER + 2 } as const;

/**
 * The end's own light: the shape of LIGHT_UNIFORMS (the shadow direction shared), its footprints the end card's only, its
 * pools the end's one soft pool. The veil and the card drawn over it (objects/End.tsx) take these objects; `setEndLight`
 * packs them per frame.
 */
export const END_LIGHT: typeof LIGHT_UNIFORMS = {
  uFp: { value: new Float32Array(MAX_FOOTPRINTS * 12) },
  uFpCount: { value: 0 },
  uPool: { value: new Float32Array(MAX_POOLS * 12) },
  uPoolCount: { value: 0 },
  uShadowDir: LIGHT_UNIFORMS.uShadowDir,
};

/** Set the end's own light (call in a layout effect, before the frame is drawn): these footprints and pools. */
export function setEndLight(fps: readonly Footprint[], pools: readonly Pool[]): void {
  packFootprints(fps, END_LIGHT.uFp.value);
  END_LIGHT.uFpCount.value = fps.length;
  packPools(pools, END_LIGHT.uPool.value);
  END_LIGHT.uPoolCount.value = pools.length;
}

/**
 * The veil's opacity at the dissolve's progress k (end.ts veilAt): the blend is in linear light, where a fade toward the
 * dark slate keeps light paper and enamel up longer than the eye expects; this curve brings a mid-tone's display value
 * down about evenly over the dissolve (white paper at half the dissolve: display 106 against an even fade's 116).
 */
export const veilAlpha = (k: number): number => 1 - (1 - k) * (1 - k);

/** Blend a material of the incoming layer over the frame by the constant alpha `blendAlpha` (set per frame; the colour's own alpha is unused). */
export function veilBlend<M extends Material>(m: M): M {
  m.transparent = true;
  m.blending = CustomBlending;
  m.blendEquation = AddEquation;
  m.blendSrc = ConstantAlphaFactor;
  m.blendDst = OneMinusConstantAlphaFactor;
  m.blendSrcAlpha = ZeroFactor;
  m.blendDstAlpha = OneFactor;
  m.blendAlpha = 0;
  return m;
}

/** The bare desk's shader: lit by END_LIGHT, no grooves, no imprints, its hatches shut. */
function bareDesk(): ShaderMaterial {
  const m = makeDeskMaterial();
  m.uniforms.uFp = END_LIGHT.uFp;
  m.uniforms.uFpCount = END_LIGHT.uFpCount;
  m.uniforms.uPool = END_LIGHT.uPool;
  m.uniforms.uPoolCount = END_LIGHT.uPoolCount;
  m.uniforms.uShadowDir = END_LIGHT.uShadowDir;
  // the bare desk is whole: no bay stands in an open hatch (the world's own holes, DESK_HOLES, stay the ground's)
  m.uniforms.uHole = { value: [HOLE_SHUT(), HOLE_SHUT(), HOLE_SHUT()] };
  // and bare: its marks moved out of every lookup, as DeskWorld's Ground does for `marks` false (the shader unchanged)
  m.uniforms.uGrooveBox = { value: (m.uniforms.uGrooveBox!.value as Vector4[]).map(() => new Vector4(1e6, 1e6, -1e6, -1e6)) };
  m.uniforms.uImp = { value: (m.uniforms.uImp!.value as Vector4[]).map(() => new Vector4(1e6, 1e6, 1, 1)) };
  return m;
}

/** The veil's material: the bare desk blended over the frame by the constant alpha (set per frame), drawn where the depth reset's plane is the nearest. */
export function makeVeilMaterial(): ShaderMaterial {
  const m = veilBlend(bareDesk());
  m.depthTest = true;
  m.depthFunc = LessEqualDepth;
  m.depthWrite = true;
  return m;
}

/** The depth reset: the desk plane's depth over the whole frame, no colour (the veil's program). */
export function makeDepthReset(): ShaderMaterial {
  const m = bareDesk();
  m.transparent = true;
  m.colorWrite = false;
  m.depthTest = true;
  m.depthFunc = AlwaysDepth;
  m.depthWrite = true;
  return m;
}
