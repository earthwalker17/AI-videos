/**
 * The night sky, drawn as a "portal": each pixel shows the sky in the direction from the camera
 * through it, so the moon, the clouds and the stars stay at infinity while the camera trucks and
 * cranes (a painted backdrop would slide like a prop). Two carriers share the one shader: the
 * standing cover's inside (a printed sky, paper fibre and all, seen from the desk) and a dome
 * round the whole world that the film fades in as the camera enters the book (`immersion`), so
 * once inside no camera ever sees past the cover's edge. Where both show, they show the same
 * sky, so the cover's edge disappears.
 *
 * The palette and the masses follow the reference (measured, 2026-11-04): a slate sky overhead
 * (about sRGB 50 57 76), heavy swirling cloud banks darker to the upper left with sheet-ghost
 * shapes hidden in them, a bright cyan haze low behind the castle (about 44 124 152), the moon
 * upper right in a pale green-cyan halo with silver-lit cloud edges round it. Clouds are 3D noise
 * on the view direction (no seam anywhere round the dome) and drift from the frame, never a clock.
 * The moon is HDR so the bloom haloes it; moonOnPlane gives the god rays' source.
 */
import { useLayoutEffect, useMemo } from 'react';
import { BackSide, Color, DoubleSide, ShaderMaterial, Vector3, type Side } from 'three';
import { FLOOR } from '../world/layout.ts';
import { NOISE3_GLSL, NOISE_GLSL } from './glsl.ts';
import { NIGHT } from './materials.ts';

export const SKY_COLORS = {
  top: '#465c72',
  mid: '#3a7790',
  horizon: '#55a6ba',
  cloud: '#46405a',
  cloudDark: '#332c44',
  cloudLit: '#a3d9cf',
  glow: '#8fc6bb',
  moon: '#eef3cf',
} as const;

/** the moon's angular radius (radians) */
export const MOON_RADIUS = 0.04;

const VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  ${NOISE_GLSL}
  ${NOISE3_GLSL}
  uniform float uSbTime, uMoonR, uHorizonEl, uIntensity, uFibre, uAlpha;
  uniform vec3 uSbMoonDir, uTop, uMid, uHorizon, uCloud, uCloudDark, uCloudLit, uGlow, uMoon;
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
  // cloud density in a direction (warped 3D noise; the warp is passed in so a neighbour shares it)
  float cloudField(vec3 dir, vec3 w) {
    vec3 q = dir * vec3(2.4, 4.6, 2.4) + vec3(uSbTime * 0.004, 0.0, uSbTime * 0.0025);
    float big = aivFbm3(q + 1.9 * (w - 0.5));
    float fine = aivFbm3(q * 3.1 + 5.0 + 0.8 * (w - 0.5));
    return big * 0.78 + fine * 0.22;
  }
  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float el = asin(clamp(dir.y, -1.0, 1.0));
    float az = atan(dir.x, -dir.z);
    vec2 p = vec2(az, el);
    float moonAng = acos(clamp(dot(dir, uSbMoonDir), -1.0, 1.0));
    float e = el - uHorizonEl;
    // the gradient: a bright haze low down, teal, slate overhead
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.14, e));
    col = mix(col, uTop, smoothstep(0.1, 0.42, e));
    // the moon's halo: wide and pale, then tight and bright
    col += uGlow * (0.12 * exp(-moonAng * 5.0) + 0.32 * exp(-moonAng * 16.0));
    // stars, sparse, between the clouds, fading toward the horizon and the moon
    vec2 g = floor(p * 160.0);
    float s = aivHash12(g);
    float tw = 0.65 + 0.35 * aivHash12(g + floor(uSbTime * 3.0));
    float star = step(0.993, s) * smoothstep(0.35, 0.0, length(fract(p * 160.0) - 0.5)) * tw;
    vec3 stars = vec3(0.75, 0.9, 0.9) * star * smoothstep(0.12, 0.45, e) * smoothstep(0.25, 0.6, moonAng) * 0.7;
    // clouds: heavier to the upper left, a clearing round the moon and a clear haze band low down
    vec3 wq = dir * vec3(1.5, 2.8, 1.5) + vec3(uSbTime * 0.003, 0.0, 0.0);
    vec3 w = vec3(aivFbm3(wq + 3.1), aivFbm3(wq + 7.7), aivFbm3(wq + 11.3));
    float d = cloudField(dir, w);
    float heavy = 0.11 * smoothstep(0.25, -0.6, dir.x) + 0.07 * smoothstep(0.12, 0.55, e);
    float thr = 0.36 - heavy + 0.2 * exp(-moonAng * 5.0) + 0.14 * (1.0 - smoothstep(0.03, 0.13, e));
    float cover = smoothstep(thr, thr + 0.15, d) * smoothstep(-0.03, 0.05, e);
    // silver linings: where the density falls toward the moon, the cloud's edge takes the light
    vec3 toMoon = normalize(uSbMoonDir - dir * dot(uSbMoonDir, dir) + vec3(1e-5));
    float dm = cloudField(normalize(dir + toMoon * 0.03), w);
    float rim = clamp((d - dm) * 10.0, 0.0, 1.0) * smoothstep(thr - 0.04, thr + 0.1, d) * (1.0 - smoothstep(thr + 0.1, thr + 0.32, d));
    float lit = exp(-moonAng * 1.7);
    vec3 body = mix(uCloud, uCloudDark, smoothstep(thr + 0.05, thr + 0.35, d) * (1.0 - 0.6 * lit));
    body = mix(body, uMid * 0.85, 0.25 * (1.0 - smoothstep(0.05, 0.3, e)));
    vec3 cloudCol = body + uCloudLit * rim * (0.12 + 1.25 * lit) + uGlow * 0.18 * lit;
    col = mix(col + stars, cloudCol, cover * 0.94);
    // sheet ghosts hidden in the clouds, faint, upper left
    float gh = ghost(p, vec2(-0.55, 0.42), 0.07, 0.3) + ghost(p, vec2(-0.38, 0.5), 0.055, 0.2) + ghost(p, vec2(-0.72, 0.36), 0.06, 0.35) + ghost(p, vec2(-0.2, 0.47), 0.05, 0.15);
    col = mix(col, uCloudLit * 0.5, clamp(gh, 0.0, 1.0) * 0.2 * cover);
    // the moon: a disc with faint maria, HDR so the bloom haloes it
    float disc = smoothstep(uMoonR, uMoonR * 0.94, moonAng);
    float maria = aivFbm(p * 40.0 + 4.0);
    vec3 moon = uMoon * (2.5 - 0.7 * smoothstep(0.45, 0.72, maria));
    col = mix(col, moon, disc);
    // paper fibre through the cover's print (none on the dome)
    float fibre = 1.0 - uFibre * 0.05 * (1.0 - aivFbm3(vWorld * 40.0));
    gl_FragColor = vec4(col * fibre * uIntensity, uAlpha);
  }
`;

export interface SkyOptions {
  /** the dome (BackSide, no fibre, fades in with immersion) or the cover's print */
  dome?: boolean;
}

/** The sky material: the cover's printed sky, or the dome's (see SkyDome). */
export function useSkyPortal({ dome = false }: SkyOptions = {}): ShaderMaterial {
  const mat = useMemo(() => {
    const side: Side = dome ? BackSide : DoubleSide;
    return new ShaderMaterial({
      side,
      depthWrite: true,
      transparent: dome,
      uniforms: {
        uSbTime: NIGHT.uSbTime,
        uSbMoonDir: NIGHT.uSbMoonDir,
        uTop: { value: new Color(SKY_COLORS.top) },
        uMid: { value: new Color(SKY_COLORS.mid) },
        uHorizon: { value: new Color(SKY_COLORS.horizon) },
        uCloud: { value: new Color(SKY_COLORS.cloud) },
        uCloudDark: { value: new Color(SKY_COLORS.cloudDark) },
        uCloudLit: { value: new Color(SKY_COLORS.cloudLit) },
        uGlow: { value: new Color(SKY_COLORS.glow) },
        uMoon: { value: new Color(SKY_COLORS.moon) },
        uMoonR: { value: MOON_RADIUS },
        /** the horizon's elevation (radians): where the far hills meet the sky */
        uHorizonEl: { value: 0.02 },
        uIntensity: { value: 1 },
        uFibre: { value: dome ? 0 : 1 },
        uAlpha: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      fog: false,
    });
  }, [dome]);
  useLayoutEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/** The dome's radius: inside the camera's far plane from anywhere on the page. */
export const DOME_RADIUS = 60;

/**
 * The sky all round the world. `immersion` 0..1: hidden at 0 (the room shows round the book), the
 * full sky at 1 (inside the story). Pass the same to the cover's print so its fibre fades too.
 */
export function SkyDome({ immersion = 1 }: { immersion?: number }) {
  const mat = useSkyPortal({ dome: true });
  const geo = useMemo(() => [DOME_RADIUS, 64, 32] as const, []);
  useLayoutEffect(() => {
    mat.uniforms.uAlpha.value = immersion;
  }, [mat, immersion]);
  return (
    <mesh material={mat} position={[0, FLOOR, 0]} visible={immersion > 0} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={geo} />
    </mesh>
  );
}

/** Where the moon appears on a plane z = planeZ, seen from `cam` (for the god-ray source disc). */
export function moonOnPlane(cam: Vector3, planeZ: number, out = new Vector3()): Vector3 {
  const d = NIGHT.uSbMoonDir.value;
  const t = (planeZ - cam.z) / (d.z || -1e-6);
  return out.copy(cam).addScaledVector(d, Math.max(0, t));
}
