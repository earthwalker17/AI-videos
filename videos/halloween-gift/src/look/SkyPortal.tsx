/**
 * The night sky printed inside the standing cover, drawn as a "portal": each pixel shows the sky
 * in the direction from the camera through it, so the moon, the clouds and the stars stay at
 * infinity while the camera trucks and cranes (a flat printed sky would slide like a prop). The
 * palette follows the reference: deep slate overhead, teal below, a bright cyan haze at the
 * horizon that the fog's far colour matches; heavy swirling cloud masses, darker to the upper
 * left, lit at their edges toward the moon, which sits in a clearing; a few sheet-ghost shapes
 * hidden in the clouds; stars between them. The moon is HDR so bloom gives it a halo, and its
 * screen position is exported for the god rays. Clouds drift from the frame, never a clock.
 */
import { useLayoutEffect, useMemo } from 'react';
import { Color, DoubleSide, ShaderMaterial, Vector3 } from 'three';
import { NOISE3_GLSL, NOISE_GLSL } from './glsl.ts';
import { NIGHT } from './materials.ts';

export const SKY_COLORS = {
  top: '#121a2c',
  mid: '#1e4d6d',
  horizon: '#4a96ae',
  cloud: '#17243a',
  cloudLit: '#8fcfd8',
  moon: '#eaf2c8',
} as const;

/** the moon's angular radius (radians) */
export const MOON_RADIUS = 0.052;

export function useSkyPortal(): ShaderMaterial {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        side: DoubleSide,
        depthWrite: true,
        uniforms: {
          uSbTime: NIGHT.uSbTime,
          uSbMoonDir: NIGHT.uSbMoonDir,
          uTop: { value: new Color(SKY_COLORS.top) },
          uMid: { value: new Color(SKY_COLORS.mid) },
          uHorizon: { value: new Color(SKY_COLORS.horizon) },
          uCloud: { value: new Color(SKY_COLORS.cloud) },
          uCloudLit: { value: new Color(SKY_COLORS.cloudLit) },
          uMoon: { value: new Color(SKY_COLORS.moon) },
          uMoonR: { value: MOON_RADIUS },
          /** the horizon's elevation (radians): where the far hills meet the sky */
          uHorizonEl: { value: 0.02 },
          uIntensity: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          ${NOISE_GLSL}
          ${NOISE3_GLSL}
          uniform float uSbTime, uMoonR, uHorizonEl, uIntensity;
          uniform vec3 uSbMoonDir, uTop, uMid, uHorizon, uCloud, uCloudLit, uMoon;
          varying vec3 vWorld;
          // a sheet ghost's silhouette in sky coordinates (centre c, size s): a dome over a tattered hem
          float ghost(vec2 p, vec2 c, float s, float lean) {
            vec2 q = (p - c) / s;
            q.x += lean * q.y;
            float body = length(vec2(q.x * 1.25, max(q.y, 0.0) * 0.9)) - 0.55;
            float skirt = abs(q.x) - (0.42 + 0.35 * clamp(-q.y, 0.0, 1.0));
            float hem = q.y + 0.95 + 0.12 * sin(q.x * 18.0);
            float d = max(q.y < 0.0 ? skirt : body, -hem);
            return smoothstep(0.12, -0.08, d);
          }
          void main() {
            vec3 dir = normalize(vWorld - cameraPosition);
            float el = asin(clamp(dir.y, -1.0, 1.0));
            float az = atan(dir.x, -dir.z);
            vec2 p = vec2(az, el);
            float moonAng = acos(clamp(dot(dir, uSbMoonDir), -1.0, 1.0));
            // gradient: bright haze at the horizon, teal, slate overhead
            float e = el - uHorizonEl;
            vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.32, e));
            col = mix(col, uTop, smoothstep(0.3, 0.95, e));
            // the moon's glow on the sky
            col += uHorizon * 0.55 * exp(-moonAng * 5.0) + uCloudLit * 0.25 * exp(-moonAng * 14.0);
            // stars, sparse, fading toward the horizon and the moon
            vec2 g = floor(p * vec2(160.0, 160.0));
            float s = aivHash12(g);
            float tw = 0.65 + 0.35 * aivHash12(g + floor(uSbTime * 3.0));
            float star = step(0.992, s) * smoothstep(0.35, 0.0, length(fract(p * 160.0) - 0.5)) * tw;
            col += vec3(0.75, 0.9, 0.9) * star * smoothstep(0.12, 0.45, e) * smoothstep(0.25, 0.6, moonAng) * 0.8;
            // clouds: domain-warped fbm masses, heavier to the upper left, a clearing round the moon
            vec2 cq = vec2(az * 2.4 + uSbTime * 0.006, el * 5.2);
            vec2 w = vec2(aivFbm(cq * 0.8 + 3.1 + uSbTime * 0.004), aivFbm(cq * 0.8 + 7.7));
            float c = aivFbm(cq + 2.2 * w);
            float heavy = smoothstep(0.6, -0.4, az) * 0.25 + smoothstep(0.1, 0.6, e) * 0.1;
            float clearing = smoothstep(0.12, 0.42, moonAng);
            float cover = smoothstep(0.42 - heavy, 0.62 - heavy, c) * clearing * smoothstep(-0.02, 0.1, e);
            // their edges facing the moon take the light (silver linings), bodies stay dark
            float edge = smoothstep(0.42 - heavy, 0.5 - heavy, c) - smoothstep(0.5 - heavy, 0.64 - heavy, c);
            float lit = exp(-moonAng * 2.2);
            vec3 cloudCol = mix(uCloud, uMid * 0.7, 0.35 * w.x);
            col = mix(col, cloudCol, cover * 0.85);
            col += uCloudLit * edge * clearing * (0.25 + 1.4 * lit);
            // sheet ghosts hidden in the clouds, faint, upper left
            float gh = ghost(p, vec2(-0.55, 0.42), 0.07, 0.3) + ghost(p, vec2(-0.38, 0.5), 0.055, 0.2) + ghost(p, vec2(-0.72, 0.36), 0.06, 0.35) + ghost(p, vec2(-0.2, 0.47), 0.05, 0.15);
            col = mix(col, uCloudLit * 0.55, clamp(gh, 0.0, 1.0) * 0.22 * smoothstep(0.3, 0.7, c + 0.2));
            // the moon: a disc with faint maria, HDR so the bloom haloes it
            float disc = smoothstep(uMoonR, uMoonR * 0.94, moonAng);
            vec2 mp = vec2(az, el) * 40.0;
            float maria = aivFbm(mp + 4.0);
            vec3 moon = uMoon * (3.2 - 0.9 * smoothstep(0.45, 0.72, maria));
            col = mix(col, moon, disc);
            // paper fibre through the print
            float fibre = 0.95 + 0.05 * aivFbm3(vWorld * 40.0);
            gl_FragColor = vec4(col * fibre * uIntensity, 1.0);
          }
        `,
        fog: false,
      }),
    [],
  );
  useLayoutEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/** Where the moon appears on a plane z = planeZ, seen from `cam` (for the god-ray source disc). */
export function moonOnPlane(cam: Vector3, planeZ: number, out = new Vector3()): Vector3 {
  const d = NIGHT.uSbMoonDir.value;
  const t = (planeZ - cam.z) / (d.z || -1e-6);
  return out.copy(cam).addScaledVector(d, Math.max(0, t));
}
