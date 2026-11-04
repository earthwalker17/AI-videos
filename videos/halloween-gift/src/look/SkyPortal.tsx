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
import { BackSide, Color, DoubleSide, ShaderMaterial, Vector2, Vector3, type Side } from 'three';
import { FLOOR, HERO, LAND } from '../world/layout.ts';
import { NOISE3_GLSL, NOISE_GLSL } from './glsl.ts';
import { NIGHT } from './materials.ts';

export const SKY_COLORS = {
  top: '#465c72',
  mid: '#2c7896',
  horizon: '#46aec6',
  cloud: '#3e4a60',
  cloudDark: '#332c44',
  cloudLit: '#a3d9cf',
  glow: '#8fc6bb',
  /** the luminous cyan haze behind the castle (the reference's brightest, most saturated sky) */
  haze: '#2297b8',
  moon: '#eef3cf',
} as const;

/** toward the castle's haze from the hero eye (a direction: the sky stays at infinity) */
const HAZE_DIR = new Vector3(LAND.crag.x - HERO.pos[0], 3.6 - HERO.pos[1], LAND.crag.z - HERO.pos[2]).normalize();
/** its azimuth and elevation (the shader's: azimuth atan(x, −z), elevation asin(y)) */
const HAZE_AE = new Vector2(Math.atan2(HAZE_DIR.x, -HAZE_DIR.z), Math.asin(HAZE_DIR.y));

/** the moon's angular radius (radians) */
export const MOON_RADIUS = 0.034;

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
  uniform vec2 uWitch;
  uniform vec3 uSbMoonDir, uTop, uMid, uHorizon, uCloud, uCloudDark, uCloudLit, uGlow, uMoon, uHaze;
  uniform vec2 uHazeAE;
  varying vec3 vWorld;
  // a ghost wisp in sky coordinates (centre c, size s): a soft hooded head trailing a long tail
  // that tapers and bends down-wind and thins out (smoke in the clouds, not a cut-out sheet)
  float ghost(vec2 p, vec2 c, float s, float lean) {
    vec2 q = (p - c) / s;
    q.x += lean * q.y;
    float head = length(vec2(q.x * 1.2, max(q.y, 0.0) * 0.95)) - 0.5;
    float t = clamp(-q.y / 2.4, 0.0, 1.0);
    float tail = abs(q.x + 0.5 * t * t) - 0.46 * (1.0 - t) * (1.0 - 0.35 * t);
    float d = q.y < 0.0 ? tail : head;
    return smoothstep(0.28, -0.12, d) * (1.0 - smoothstep(0.45, 1.0, t));
  }
  // the witch on her broom, flying toward +x (local units: the broom about 2.8 long), a signed distance
  float sdSeg(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
  }
  float sdTri(vec2 p, vec2 a, vec2 b, vec2 c) {
    vec2 e0 = b - a, e1 = c - b, e2 = a - c;
    vec2 v0 = p - a, v1 = p - b, v2 = p - c;
    vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
    float s = sign(e0.x * e2.y - e0.y * e2.x);
    vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))), vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
    return -sqrt(d.x) * sign(d.y);
  }
  float witch(vec2 w) {
    // the broom: stick and bristles
    float d = sdSeg(w, vec2(-1.1, -0.05), vec2(1.15, 0.12), 0.055);
    d = min(d, sdTri(w, vec2(-1.0, -0.02), vec2(-1.72, 0.22), vec2(-1.62, -0.32)));
    // the body hunched forward, a leg and boot hanging below the stick
    d = min(d, sdTri(w, vec2(-0.42, -0.02), vec2(0.42, 0.04), vec2(0.06, 0.66)) - 0.03);
    d = min(d, sdSeg(w, vec2(0.12, 0.0), vec2(0.3, -0.34), 0.07));
    // the cape streaming back in two tattered points
    d = min(d, sdTri(w, vec2(-0.2, 0.5), vec2(-1.05, 0.3), vec2(-0.3, 0.06)));
    d = min(d, sdTri(w, vec2(-0.3, 0.32), vec2(-0.95, -0.02), vec2(-0.25, 0.04)));
    // an arm to the stick, the head, the hat's cone bent back and its brim
    d = min(d, sdSeg(w, vec2(0.15, 0.44), vec2(0.62, 0.1), 0.06));
    d = min(d, length((w - vec2(0.08, 0.7)) * vec2(1.0, 1.1)) - 0.14);
    d = min(d, sdTri(w, vec2(-0.12, 0.76), vec2(0.28, 0.8), vec2(-0.18, 1.24)) - 0.02);
    d = min(d, length((w - vec2(0.07, 0.78)) * vec2(1.0, 4.0)) - 0.3);
    return d;
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
    // the castle's haze: a wide luminous cyan behind it and down to the mist at its foot, the
    // clouds thinning and lit through over it (the reference, about sRGB 28 121 148 beside the
    // castle and 37 145 171 below it)
    // a band: wide in azimuth, narrow in height (the sky above it stays dark slate)
    float hzE = el - uHazeAE.y;
    float hz = exp(-abs(az - uHazeAE.x) / 0.32 - max(hzE, 0.0) / 0.075 - max(-hzE, 0.0) / 0.05) * smoothstep(-0.04, 0.03, e);
    cover *= 1.0 - 0.45 * hz;
    cloudCol = mix(cloudCol, uHaze * 1.15, 0.45 * hz);
    col = mix(col + stars, cloudCol, cover * 0.94);
    col = mix(col, uHaze, 0.55 * hz * (1.0 - cover * 0.6));
    // sheet ghosts hidden in the clouds, faint, upper left
    float gh = ghost(p, vec2(-0.55, 0.42), 0.07, 0.3) + ghost(p, vec2(-0.38, 0.5), 0.055, 0.2) + ghost(p, vec2(-0.72, 0.36), 0.06, 0.35) + ghost(p, vec2(-0.2, 0.47), 0.05, 0.15);
    col = mix(col, uCloudLit * 0.5, clamp(gh, 0.0, 1.0) * 0.17 * cover);
    // the moon: a disc with faint maria, HDR so the bloom haloes it
    float disc = smoothstep(uMoonR, uMoonR * 0.94, moonAng);
    float maria = aivFbm(p * 40.0 + 4.0);
    vec3 moon = uMoon * (2.5 - 0.7 * smoothstep(0.45, 0.72, maria));
    col = mix(col, moon, disc);
    // the witch crosses the moon (uWitch: her progress 0..1, shown when .y is 1), a silhouette
    if (uWitch.y > 0.5 && moonAng < uMoonR * 5.0) {
      vec3 right = normalize(cross(uSbMoonDir, vec3(0.0, 1.0, 0.0)));
      vec3 upv = cross(right, uSbMoonDir);
      vec2 q = vec2(dot(dir, right), dot(dir, upv)) / uMoonR;
      float t = uWitch.x;
      vec2 at = vec2(mix(-2.7, 2.7, t), 0.22 - 0.4 * t + 0.18 * sin(3.14159 * t));
      float S = 0.5;
      float sd = witch((q - at) / S) * S;
      float aa = max(fwidth(sd), 1e-4);
      col = mix(col, vec3(0.018, 0.022, 0.035), (1.0 - smoothstep(-aa, aa, sd)));
    }
    // paper fibre through the cover's print (none on the dome)
    float fibre = 1.0 - uFibre * 0.05 * (1.0 - aivFbm3(vWorld * 40.0));
    gl_FragColor = vec4(col * fibre * uIntensity, uAlpha);
  }
`;

export interface SkyOptions {
  /** the dome (BackSide, no fibre, fades in with immersion) or the cover's print */
  dome?: boolean;
}

/**
 * The witch crossing the moon, shared by every sky (the dome, and the cover's print that stands in
 * front of it inside the story): her progress 0..1 and 1 while she flies (set by SkyDome's witch).
 */
const WITCH = { value: new Vector2(0, 0) };

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
        uHaze: { value: new Color(SKY_COLORS.haze) },
        uHazeAE: { value: HAZE_AE },
        uMoon: { value: new Color(SKY_COLORS.moon) },
        uMoonR: { value: MOON_RADIUS },
        /** the horizon's elevation (radians): where the far hills meet the sky */
        uHorizonEl: { value: 0.02 },
        uIntensity: { value: 1 },
        uFibre: { value: dome ? 0 : 1 },
        uAlpha: { value: 1 },
        // the witch crossing the moon: shared by the dome and the cover's print (whichever shows the moon)
        uWitch: WITCH,
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
 * `witch` 0..1: the witch on her broom crossing the moon, left to right (outside 0..1: none).
 */
export function SkyDome({ immersion = 1, witch = -1 }: { immersion?: number; witch?: number }) {
  const mat = useSkyPortal({ dome: true });
  const geo = useMemo(() => [DOME_RADIUS, 64, 32] as const, []);
  useLayoutEffect(() => {
    mat.uniforms.uAlpha.value = immersion;
    WITCH.value.set(Math.max(0, Math.min(1, witch)), witch >= 0 && witch <= 1 ? 1 : 0);
  }, [mat, immersion, witch]);
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
