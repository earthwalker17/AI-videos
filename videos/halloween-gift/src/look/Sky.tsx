/**
 * The backdrop: the inside of the book's cover, printed as a moonlit sky and lit from behind
 * like a lightbox. A vertical gradient (slate at the top, deep teal, a pale teal glow around the
 * moon), banded clouds with silver linings toward the moon, faint stars, and the moon itself, a
 * pale mint disc in HDR so the bloom gives it a halo. Paper fibre runs through all of it.
 * Clouds drift and stars twinkle from the frame (on twos), never from a clock.
 */
import { useLayoutEffect, useMemo } from 'react';
import { Color, ShaderMaterial, Vector2 } from 'three';
import { twos } from '../film/timeline.ts';
import { NOISE_GLSL } from './glsl.ts';

export const SKY = {
  top: '#2b3142',
  mid: '#1D5E7B',
  glow: '#45A1B4',
  cloud: '#16384a',
  lining: '#9fd3c9',
  moon: '#DCE6B7',
} as const;

/** the moon's centre in the backdrop's UV space (0..1 across, 0..1 up) and radius in V units */
export const MOON_UV = new Vector2(0.73, 0.55);
export const MOON_R = 0.085;

export function useSkyMaterial(aspect: number, intensity = 1): ShaderMaterial {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAspect: { value: aspect },
          uMoon: { value: MOON_UV.clone() },
          uMoonR: { value: MOON_R },
          uIntensity: { value: intensity },
          uTop: { value: new Color(SKY.top) },
          uMid: { value: new Color(SKY.mid) },
          uGlow: { value: new Color(SKY.glow) },
          uCloud: { value: new Color(SKY.cloud) },
          uLining: { value: new Color(SKY.lining) },
          uMoonCol: { value: new Color(SKY.moon) },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          ${NOISE_GLSL}
          uniform float uTime, uAspect, uMoonR, uIntensity;
          uniform vec2 uMoon;
          uniform vec3 uTop, uMid, uGlow, uCloud, uLining, uMoonCol;
          varying vec2 vUv;
          void main() {
            vec2 p = vec2(vUv.x * uAspect, vUv.y);
            vec2 m = vec2(uMoon.x * uAspect, uMoon.y);
            float d = length(p - m);
            // gradient: slate at the top, teal below, a pale glow around the moon
            vec3 col = mix(uMid, uTop, smoothstep(0.35, 1.0, vUv.y));
            col = mix(col, uGlow, 0.85 * exp(-d * 3.2));
            // banded clouds (printed in a few inks), drifting slowly to the left
            vec2 q = vec2(p.x * 1.4 + uTime * 0.012, p.y * 3.2);
            vec2 w = vec2(aivFbm(q + 3.1), aivFbm(q + 7.7));
            float c = aivFbm(q + 1.8 * w);
            float band = smoothstep(0.52, 0.56, c) + smoothstep(0.64, 0.68, c);
            float toward = clamp(1.0 - d * 1.6, 0.0, 1.0);
            vec3 cloudCol = mix(uCloud, uMid * 0.8, 0.35 * band);
            col = mix(col, cloudCol, 0.62 * clamp(band, 0.0, 1.0) * smoothstep(0.25, 0.55, vUv.y));
            // silver lining: the cloud edge that faces the moon
            float edge = smoothstep(0.50, 0.53, c) - smoothstep(0.53, 0.58, c);
            col += uLining * edge * toward * toward * 0.9;
            // stars: a sparse seeded grid, twinkling on twos
            vec2 g = floor(p * 70.0);
            float s = aivHash12(g);
            float tw = 0.6 + 0.4 * aivHash12(g + floor(uTime * 12.0));
            float star = step(0.985, s) * smoothstep(0.08, 0.0, length(fract(p * 70.0) - 0.5)) * tw;
            col += vec3(0.8, 0.9, 0.85) * star * smoothstep(0.45, 0.8, vUv.y) * (1.0 - toward);
            // the moon: a soft-edged disc with faint maria, then a halo ring
            float disc = smoothstep(uMoonR, uMoonR - 0.004, d);
            float maria = aivFbm((p - m) * 18.0 + 4.0);
            vec3 moon = uMoonCol * (2.4 - 0.5 * smoothstep(0.45, 0.7, maria));
            col = mix(col, moon, disc);
            col += uGlow * 0.35 * exp(-max(d - uMoonR, 0.0) * 14.0);
            // paper fibre through the print
            float fibre = 0.93 + 0.07 * aivFbm(vUv * vec2(520.0, 360.0));
            gl_FragColor = vec4(col * fibre * uIntensity, 1.0);
          }
        `,
        fog: false,
      }),
    [aspect, intensity],
  );
  useLayoutEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/** Set the sky's frame-driven time (seconds, stepped on twos). */
export function skyTime(mat: ShaderMaterial, film: number, fps: number): void {
  mat.uniforms.uTime.value = twos(film) / fps;
}
