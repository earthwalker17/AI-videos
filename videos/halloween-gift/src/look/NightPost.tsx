/**
 * The V2 post chain, in HDR linear light (packages/remotion-kit PostChain stages):
 *   stage 1  the painterly filter (look/paint.ts KuwaharaEffect), optional: it must see the
 *            whole rendered image before anything blurs or glows on top of it;
 *   last     depth of field (focus per shot), god rays from the moon, Pro-Mist bloom and the
 *            storybook split-tone grade (maroon shadows near, teal far), then neutral tone mapping;
 *   after    the finish on display values: a soft vignette and a film grain that changes every
 *            frame (QA's freeze check must still see a held shot as alive).
 *
 * God rays: postprocessing's GodRaysEffect renders a light-source mesh, occluded by the scene's
 * depth, and smears it radially. The sky draws the moon itself (look/SkyPortal.tsx, a direction
 * at infinity), so the light source is a disc that never joins the scene: it is placed every
 * frame where the moon direction meets the sky plane, facing the camera, and the rays fade out
 * as the moon leaves the frame. Everything is a pure function of the frame and the camera.
 */
import { PostChain } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { BlendFunction, BloomEffect, DepthOfFieldEffect, Effect, EffectAttribute, GodRaysEffect, KernelSize, ToneMappingMode, type Effect as AnyEffect } from 'postprocessing';
import { useCallback, useLayoutEffect, useMemo } from 'react';
import { CircleGeometry, Color, Mesh, MeshBasicMaterial, Uniform, Vector2, Vector3, type Camera } from 'three';
import { KuwaharaEffect } from './paint.ts';
import { StorybookGrade } from './Post.tsx';
import { MOON_RADIUS, moonOnPlane } from './SkyPortal.tsx';

const FINISH = /* glsl */ `
uniform float uVignette;
uniform float uFrame;
uniform float uGrain;
uniform vec3 uLiftLow;
uniform vec3 uLiftHigh;
float fHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  // vignette: a soft oval; toward the bottom corners red darkens less, so they go maroon
  vec2 d = (uv - 0.5) * vec2(1.0, 0.82);
  float k = (1.0 - smoothstep(0.86, 0.22, length(d))) * uVignette * mix(1.0, 0.55, smoothstep(0.5, 1.0, uv.y));
  vec3 dk = mix(vec3(0.55, 1.0, 1.0), vec3(1.0), smoothstep(0.15, 0.75, uv.y));
  c *= 1.0 - k * dk;
  // a painted floor: nothing goes black; plum low in the frame, slate high (the reference's darks
  // sit at about sRGB 40 14 16 low and 50 56 74 high)
  vec3 lift = mix(uLiftLow, uLiftHigh, smoothstep(0.05, 0.85, uv.y));
  c = lift + c * (1.0 - lift);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float n = fHash(uv * vec2(1931.0, 1087.0) + uFrame * 17.31) - 0.5;
  float resp = smoothstep(0.02, 0.45, l) * (1.0 - smoothstep(0.65, 1.0, l));
  c += n * uGrain * (0.25 + resp) * 0.035;
  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}
`;

/** Vignette and grain on display values (EffectAttribute.NONE: it stays after the tone mapping). */
export class FinishEffect extends Effect {
  constructor({ vignette = 0.5, grain = 1.0, liftLow = '#26090c', liftHigh = '#161c26' } = {}) {
    super('FinishEffect', FINISH, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.NONE,
      uniforms: new Map<string, Uniform>([
        ['uVignette', new Uniform(vignette)],
        ['uFrame', new Uniform(0)],
        ['uGrain', new Uniform(grain)],
        // the floor the final picture sits on (sRGB hex; the pass works in tone-mapped linear light)
        ['uLiftLow', new Uniform(new Color(liftLow))],
        ['uLiftHigh', new Uniform(new Color(liftHigh))],
      ]),
    });
  }
}

export interface NightPostOptions {
  /** Kuwahara radius in pixels at 1080p (0: off) */
  paint?: number;
  /** Kuwahara edge sharpness */
  sharpness?: number;
  /** god rays from the moon */
  rays?: boolean;
  /** god-ray strength (0..1) */
  raysWeight?: number;
  /** depth of field */
  dof?: boolean;
  /** film grain strength (0: none, for measuring boil) */
  grain?: number;
  /** z of the sky plane the moon is drawn on (world units) */
  skyZ?: number;
  /** grade tints: maroon near, teal far, and how much of them (0: none) */
  near?: string;
  far?: string;
  split?: number;
  /** the warm-near hue shift, 0..1 */
  warm?: number;
}

export interface NightPostProps extends NightPostOptions {
  f: number;
  /** DOF focus distance and range (world units) */
  focus: number;
}

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function NightPost({ f, focus, paint = 0, sharpness = 8, rays = true, raysWeight = 0.1, dof = true, grain = 1, skyZ = -5.44, near = '#4a1a2e', far = '#2a5c80', split = 0, warm = 1 }: NightPostProps) {
  const camera = useThree((s) => s.camera);
  const height = useThree((s) => s.size.height);
  const moon = useMemo(() => {
    const m = new Mesh(new CircleGeometry(1, 48), new MeshBasicMaterial({ color: new Color('#d8eef5'), fog: false }));
    m.frustumCulled = false;
    return m;
  }, []);
  useLayoutEffect(
    () => () => {
      moon.geometry.dispose();
      (moon.material as MeshBasicMaterial).dispose();
    },
    [moon],
  );
  const hold = useMemo(() => ({ dof: null as DepthOfFieldEffect | null, rays: null as GodRaysEffect | null, finish: null as FinishEffect | null }), []);
  // the painter's radius is in 1080p pixels: half-size drafts paint the same strokes
  const px = (paint * height) / 1080;
  const stages = useCallback((): AnyEffect[][] => (px > 0 ? [[new KuwaharaEffect({ radius: px, sharpness })]] : []), [px, sharpness]);
  const effects = useCallback(
    (cam: Camera): AnyEffect[] => {
      const list: AnyEffect[] = [];
      if (dof) list.push((hold.dof = new DepthOfFieldEffect(cam, { focusDistance: 6, focusRange: 3, bokehScale: 1.3, resolutionScale: 0.5 })));
      else hold.dof = null;
      if (rays) list.push((hold.rays = new GodRaysEffect(cam, moon, { samples: 60, density: 0.9, decay: 0.9, weight: raysWeight, exposure: 0.45, clampMax: 1, blur: true, kernelSize: KernelSize.SMALL, resolutionScale: 0.5 })));
      else hold.rays = null;
      list.push(new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.78, luminanceSmoothing: 0.25, intensity: 0.75, radius: 0.75 }));
      const grade = new StorybookGrade();
      (grade.uniforms.get('uNear')!.value as Color).set(near);
      (grade.uniforms.get('uFar')!.value as Color).set(far);
      // the split tone multiplied shadows down by about half near the lens; the finish's floor
      // and tinted vignette carry the warm-near, cool-far grade instead
      grade.uniforms.get('uSplit')!.value = split;
      (grade.uniforms.get('uWarmDist')!.value as Vector2).set(3.0, 8.5);
      // the reference's near ground is plum and brown, its mid-ground teal: shift hue near the lens
      const w = new Vector3(1.0, 0.74, 0.68);
      w.divideScalar(0.2126 * w.x + 0.7152 * w.y + 0.0722 * w.z);
      (grade.uniforms.get('uWarm')!.value as Vector3).copy(w).lerp(new Vector3(1, 1, 1), 1 - warm);
      // vignette and grain move after the tone mapping (FinishEffect)
      grade.uniforms.get('uVignette')!.value = 0;
      grade.uniforms.get('uGrain')!.value = 0;
      list.push(grade);
      return list;
    },
    [hold, moon, dof, rays, raysWeight, near, far, split, warm],
  );
  const after = useCallback((): AnyEffect[] => [(hold.finish = new FinishEffect({ grain }))], [hold, grain]);
  useLayoutEffect(() => {
    if (hold.dof) {
      hold.dof.cocMaterial.focusDistance = focus;
      hold.dof.cocMaterial.focusRange = Math.max(1.2, focus * 0.55);
    }
    if (hold.finish) hold.finish.uniforms.get('uFrame')!.value = f;
    if (hold.rays) {
      const at = moonOnPlane(camera.position, skyZ, new Vector3());
      const dist = at.distanceTo(camera.position);
      moon.position.copy(at);
      moon.scale.setScalar(dist * Math.tan(MOON_RADIUS) * 1.35);
      moon.lookAt(camera.position);
      moon.updateMatrix();
      moon.updateMatrixWorld(true);
      // fade the rays as the moon leaves the frame (they would smear from a point off-screen)
      const s = at.clone().project(camera);
      const edge = Math.max(Math.abs(s.x), Math.abs(s.y));
      const inFront = s.z < 1 ? 1 : 0;
      hold.rays.blendMode.opacity.value = inFront * (1 - sstep(0.92, 1.12, edge));
    }
  });
  return <PostChain stages={stages} effects={effects} afterToneMapping={after} toneMapping={ToneMappingMode.NEUTRAL} />;
}
