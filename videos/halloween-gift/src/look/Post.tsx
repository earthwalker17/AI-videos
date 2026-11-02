/**
 * The film's post chain, in HDR linear light: Pro-Mist bloom (threshold ~0.7, wide, gentle),
 * depth of field focused per shot (the miniature feel), and the storybook grade: shadows near
 * the camera lean warm maroon, depth leans teal (aerial perspective), a soft vignette and a
 * film grain that changes every frame (from the frame index: QA's freeze check must still see a
 * held letter as alive). Neutral tone mapping keeps Clawd's terracotta on-model (ACES would push
 * it toward pumpkin orange).
 */
import { PostChain } from '@aiv/remotion-kit';
import { useLayoutEffect, useMemo } from 'react';
import { BlendFunction, BloomEffect, DepthOfFieldEffect, Effect, EffectAttribute, ToneMappingMode, type Effect as AnyEffect } from 'postprocessing';
import { Color, Uniform, type Camera } from 'three';
import { shotPose } from '../film/camera.ts';

const GRADE = /* glsl */ `
uniform vec3 uNear;
uniform vec3 uFar;
uniform float uSplit;
uniform float uVignette;
uniform float uFrame;
uniform float uGrain;
float gHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float z = -getViewZ(depth);
  float far = smoothstep(2.5, 14.0, z);
  // split tone: the shadows take the tint of their depth (maroon near, teal far)
  float shadow = 1.0 - smoothstep(0.0, 0.35, l);
  vec3 tint = mix(uNear, uFar, far);
  c = mix(c, c * tint * 2.0 + tint * 0.012, uSplit * shadow);
  // vignette: a soft oval, darker in the corners
  vec2 d = (uv - 0.5) * vec2(1.0, 0.82);
  c *= mix(1.0, smoothstep(0.85, 0.25, length(d)), uVignette);
  // grain: luminance-weighted, new every frame
  float n = gHash(uv * vec2(1931.0, 1087.0) + uFrame * 17.31) - 0.5;
  float resp = smoothstep(0.02, 0.5, l) * (1.0 - smoothstep(0.6, 1.5, l));
  c += c * n * uGrain * (0.35 + resp);
  outputColor = vec4(max(c, 0.0), inputColor.a);
}
`;

export class StorybookGrade extends Effect {
  constructor() {
    super('StorybookGrade', GRADE, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uNear', new Uniform(new Color('#5a1e22'))],
        ['uFar', new Uniform(new Color('#2a6a7a'))],
        ['uSplit', new Uniform(0.55)],
        ['uVignette', new Uniform(0.55)],
        ['uFrame', new Uniform(0)],
        ['uGrain', new Uniform(0.16)],
      ]),
    });
  }
}

/** The chain plus a layout effect that sets the per-frame values (DOF focus, grain frame). */
export function FilmPost({ f, dof = true }: { f: number; dof?: boolean }) {
  const holder = useMemo(() => ({ dof: null as DepthOfFieldEffect | null, grade: null as StorybookGrade | null }), []);
  const effects = useMemo(
    () =>
      (camera: Camera): AnyEffect[] => {
        const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.7, luminanceSmoothing: 0.3, intensity: 0.85, radius: 0.78 });
        holder.grade = new StorybookGrade();
        const list: AnyEffect[] = [bloom];
        if (dof) {
          holder.dof = new DepthOfFieldEffect(camera, { focusDistance: 4, focusRange: 2.5, bokehScale: 2.2, resolutionScale: 0.5 });
          list.push(holder.dof);
        }
        list.push(holder.grade);
        return list;
      },
    [holder, dof],
  );
  useLayoutEffect(() => {
    const p = shotPose(f);
    if (holder.dof) {
      holder.dof.cocMaterial.focusDistance = p.focus;
      holder.dof.cocMaterial.focusRange = Math.max(1.2, p.focus * 0.55);
    }
    if (holder.grade) holder.grade.uniforms.get('uFrame')!.value = f;
  });
  return <PostChain effects={effects} toneMapping={ToneMappingMode.NEUTRAL} />;
}
