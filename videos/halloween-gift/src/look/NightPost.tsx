/**
 * The V2 post chain, in HDR linear light (packages/remotion-kit PostChain stages):
 *   stage 1  the painterly filter (look/paint.ts KuwaharaEffect), optional: it must see the
 *            whole rendered image before anything blurs or glows on top of it;
 *   stage 2  with it, FXAA on its output (paintAA: the filter re-hardens the MSAA's edges);
 *   last     depth of field (focus per shot: shallow close up, deep in the wide shots, as the
 *            painting is), soft god rays from the moon, Pro-Mist bloom and the storybook grade,
 *            then neutral tone mapping;
 *   after    the finish on display values: a deep maroon vignette and foot band that frame the
 *            picture in near-black (FINISH_TINT_GLSL; a glow inside them keeps its colour), the
 *            floor it sits on, and a monochrome film grain, constant in output levels, that
 *            changes every frame (QA's freeze check must still see a held shot as alive).
 *
 * God rays: postprocessing's GodRaysEffect renders a light-source mesh, occluded by the scene's
 * depth, and smears it radially. The sky draws the moon itself (look/SkyPortal.tsx, a direction
 * at infinity), so the light source is a disc that never joins the scene: it is placed every
 * frame where the moon direction meets the sky plane, facing the camera, and the rays fade out
 * as the moon leaves the frame. Everything is a pure function of the frame and the camera.
 */
import { PostChain } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { BlendFunction, BloomEffect, DepthOfFieldEffect, Effect, EffectAttribute, FXAAEffect, GodRaysEffect, KernelSize, ToneMappingMode, type Effect as AnyEffect } from 'postprocessing';
import { useCallback, useLayoutEffect, useMemo } from 'react';
import { CircleGeometry, Color, Mesh, MeshBasicMaterial, Uniform, Vector2, Vector3, type Camera } from 'three';
import { KuwaharaEffect } from './paint.ts';
import { StorybookGrade } from './Post.tsx';
import { MOON_RADIUS, moonOnPlane } from './SkyPortal.tsx';

/** The finish's vignette strength (FinishEffect's default; what FINISH_TINT_GLSL's callers pass). */
export const FINISH_VIGNETTE = 0.8;
/** The floor the finished picture sits on (sRGB hex): near-black maroon low in the frame, slate high. */
// (high lowered from #131822 in round 2: the room and the night's darks had no true blacks)
export const FINISH_LIFT = { low: '#1a0505', high: '#0d1018' } as const;

/**
 * The finish's screen-space tint at a pixel, as a multiplier (uv 0..1 from the bottom left):
 * the vignette (strength `v`) and the maroon foot band (`foot` 0..1). One definition for the
 * finish and for any material that undoes the tint on its own pixels (world/Clawd2.tsx COMP_GLSL).
 *  - the vignette: an oval that frames the picture's bottom corners in near-black, as the
 *    reference's are (its bottom left sits at about sRGB 34 4 3); wide open in the middle and
 *    eased out toward the top (the reference's sides and top corners keep their lilac stone and
 *    slate sky: a tighter oval crushed the left foreground to black), and toward the bottom red
 *    darkens less than green and blue, so the corners go maroon;
 *  - the foot: a deep maroon band across the bottom of the frame (the reference's bottom fifth
 *    sits at about sRGB 45 20 22): green and blue go down much more than red.
 */
export const FINISH_TINT_GLSL = /* glsl */ `
vec3 aivFinishTint(vec2 uv, float v, float foot) {
  vec2 d = (uv - 0.5) * vec2(1.0, 0.82);
  float k = smoothstep(0.3, 0.8, length(d)) * v * mix(1.0, 0.2, smoothstep(0.4, 0.95, uv.y));
  vec3 dk = mix(vec3(0.6, 1.0, 1.0), vec3(1.0), smoothstep(0.15, 0.75, uv.y));
  float fb = smoothstep(0.27, 0.02, uv.y) * foot;
  return (1.0 - min(k * dk, vec3(0.95))) * (1.0 - fb * vec3(0.4, 0.8, 0.82));
}
`;

const FINISH = /* glsl */ `
uniform float uVignette;
uniform float uFrame;
uniform float uGrain;
uniform vec3 uLiftLow;
uniform vec3 uLiftHigh;
uniform float uFoot;
${FINISH_TINT_GLSL}
float fHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 fEnc(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 fDec(vec3 c) { c = max(c, 0.0); return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  // the vignette and the maroon foot band (FINISH_TINT_GLSL); a glow inside them (the brew, a
  // lantern, a grin) keeps its own colour and most of its light: the band recoloured a cyan glow
  // into a salmon-lilac smear
  vec3 tint = aivFinishTint(uv, uVignette, uFoot);
  float glow = smoothstep(0.3, 0.7, dot(c, vec3(0.2126, 0.7152, 0.0722)));
  c *= mix(tint, vec3(max(tint.r, max(tint.g, tint.b))), glow);
  // the floor the picture sits on: near-black maroon low in the frame, slate high (the
  // reference's darkest darks are a deep maroon, its high darks slate)
  vec3 lift = mix(uLiftLow, uLiftHigh, smoothstep(0.05, 0.85, uv.y));
  c = lift + c * (1.0 - lift);
  // film grain on display values (this pass works in linear light): one monochrome value on all
  // three channels, constant in output levels (about 1.8 levels std in the mid-tones, less in the
  // darks), in cells of 1.5 px so it survives the delivery encode; in linear light the encode
  // amplified it most in the darkest channel (a teal speckle on the maroon darks)
  vec3 e = fEnc(c);
  float l = dot(e, vec3(0.2126, 0.7152, 0.0722));
  float n = fHash(floor(gl_FragCoord.xy / 1.5) + uFrame * 17.31) - 0.5;
  float resp = smoothstep(0.03, 0.3, l) * (1.0 - smoothstep(0.7, 1.0, l));
  e += n * uGrain * (0.35 + 0.65 * resp) * 0.024;
  outputColor = vec4(clamp(fDec(e), 0.0, 1.0), inputColor.a);
}
`;

/** Vignette and grain on display values (EffectAttribute.NONE: it stays after the tone mapping). */
export class FinishEffect extends Effect {
  constructor({ vignette = FINISH_VIGNETTE, grain = 1.0, liftLow = FINISH_LIFT.low as string, liftHigh = FINISH_LIFT.high as string } = {}) {
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
        // the maroon foot band's strength (set per frame: the door shots keep Clawd's feet clear)
        ['uFoot', new Uniform(1)],
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
  /**
   * the warm-near hue shift, 0..1 (off: by camera distance it turned every near thing orange in the
   * close graveyard shots; the reference's warmth is the jack-o'-lantern's own light)
   */
  warm?: number;
  /** the maroon foot band across the bottom of the frame, 0..1 (eased per shot by the film) */
  foot?: number;
  /** the painterly pass's strength, 0..1 (eased by the film where type is close to the lens) */
  paintMix?: number;
}

export interface NightPostProps extends NightPostOptions {
  f: number;
  /** DOF focus distance and range (world units) */
  focus: number;
}

/**
 * The painterly pass's anti-aliasing, in a stage of its own after it: the Kuwahara picks one side
 * of every edge (the lobes that straddle it lose), which turned the MSAA's soft edges back into
 * one-pixel stairs that crawl as the camera moves. FXAA on its output, tuned for linear light
 * (the night's darks sit far below FXAA's display-space minimum) and gentle on sub-pixel detail.
 */
function paintAA(): FXAAEffect {
  const aa = new FXAAEffect();
  aa.minEdgeThreshold = 0.004;
  aa.maxEdgeThreshold = 0.166;
  aa.subpixelQuality = 0.5;
  return aa;
}

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function NightPost({ f, focus, paint = 0, sharpness = 8, rays = true, raysWeight = 0.04, dof = true, grain = 1, skyZ = -5.44, near = '#4a1a2e', far = '#2a5c80', split = 0, warm = 0, foot = 1, paintMix = 1 }: NightPostProps) {
  const camera = useThree((s) => s.camera);
  const height = useThree((s) => s.size.height);
  const moon = useMemo(() => {
    // a warm cream, as the moon's disc is (a cyan-white source turned the disc mint)
    const m = new Mesh(new CircleGeometry(1, 48), new MeshBasicMaterial({ color: new Color('#fff0c8'), fog: false }));
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
  const hold = useMemo(() => ({ dof: null as DepthOfFieldEffect | null, rays: null as GodRaysEffect | null, finish: null as FinishEffect | null, paint: null as KuwaharaEffect | null }), []);
  // the painter's radius is in 1080p pixels: half-size drafts paint the same strokes
  const px = (paint * height) / 1080;
  const stages = useCallback((): AnyEffect[][] => (px > 0 ? [[(hold.paint = new KuwaharaEffect({ radius: px, sharpness }))], [paintAA()]] : ((hold.paint = null), [])), [hold, px, sharpness]);
  const effects = useCallback(
    (cam: Camera): AnyEffect[] => {
      const list: AnyEffect[] = [];
      if (dof) list.push((hold.dof = new DepthOfFieldEffect(cam, { focusDistance: 6, focusRange: 3, bokehScale: 1.3, resolutionScale: 0.5 })));
      else hold.dof = null;
      if (rays) list.push((hold.rays = new GodRaysEffect(cam, moon, { samples: 60, density: 0.65, decay: 0.88, weight: raysWeight, exposure: 0.45, clampMax: 1, blur: true, kernelSize: KernelSize.SMALL, resolutionScale: 0.5 })));
      else hold.rays = null;
      // only the moon's disc, the lamps and the glows bloom (a lower threshold spilled a grey halo
      // over the dark silhouettes in front of the moon's glow)
      list.push(new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.95, luminanceSmoothing: 0.2, intensity: 0.8, radius: 0.5 }));
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
      // the miniature's shallow focus close up; deep focus in the wide shots, as the painting is
      // (its far castle as crisp as its near pumpkin): the range opens and the bokeh shrinks
      const wide = sstep(2.5, 7, focus);
      hold.dof.cocMaterial.focusDistance = focus;
      hold.dof.cocMaterial.focusRange = Math.max(1.2, focus * (0.55 + 2.45 * wide));
      hold.dof.bokehScale = 1.3 - 0.9 * wide;
    }
    if (hold.finish) {
      hold.finish.uniforms.get('uFrame')!.value = f;
      hold.finish.uniforms.get('uFoot')!.value = foot;
    }
    if (hold.paint) hold.paint.uniforms.get('uMix')!.value = paintMix;
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
