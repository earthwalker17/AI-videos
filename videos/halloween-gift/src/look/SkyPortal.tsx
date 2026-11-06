/**
 * The night sky, drawn as a "portal": each pixel shows the sky in the direction from the camera
 * through it, so the moon, the clouds and the stars stay at infinity while the camera trucks and
 * cranes (a painted backdrop would slide like a prop). Two carriers share the one shader: the
 * standing cover's inside (a printed sky, paper fibre and all, seen from the desk) and a dome
 * round the whole world that the film fades in as the camera enters the book (`immersion`), so
 * once inside no camera ever sees past the cover's edge. Where both show, they show the same
 * sky, so the cover's edge disappears.
 *
 * The palette and the masses follow the reference (measured, 2026-11-05; retuned 2026-11-06
 * against critique round 2): blue-slate storm masses (about sRGB 50 54 74) streaming in bands
 * that rise to the right, over a teal sky glowing through their gaps (about 40 80 108), each mass
 * with a silver edge; heavier to the upper left, with pale sheet ghosts flying up and to the
 * right through them along a rising diagonal, long tails trailing (each shown only while its
 * head is in the frame: a tail hanging from the frame's top read as a smudge on the lens); a
 * deep cyan low down left of the gates (about 30 112 148); a dark storm bank over the castle and
 * under it the light: a luminous cyan window in the clouds (about 36 125 155, its cumulus lit to
 * 150-200) rising to the right round the moon, which sits upper right in a wide mint-cyan
 * clearing with its clouds silver-lit, crossing it thinly. The moon is a cream disc with soft
 * maria, just over 1 (the bloom haloes it, never clips it to white). Clouds are 3D noise on the
 * view direction (no seam anywhere round the dome) and drift from the frame, never a clock.
 * moonOnPlane gives the god rays' source.
 */
import { useLayoutEffect, useMemo } from 'react';
import { BackSide, Color, DoubleSide, ShaderMaterial, Vector2, Vector3, type Side } from 'three';
import { FLOOR, HERO, LAND } from '../world/layout.ts';
import { NOISE3_GLSL, NOISE_GLSL } from './glsl.ts';
import { NIGHT } from './materials.ts';

export const SKY_COLORS = {
  // (sRGB hex of the linear values the shader mixes: the post's neutral tone mapping takes about
  // 0.04 off every channel and deepens the darks, so these sit lighter and greyer than the screen)
  /** overhead, between the clouds: a deep teal slate (the reference's gaps, about 40 80 108 on screen) */
  top: '#4a7088',
  /** the band above the horizon away from the light, between the clouds */
  mid: '#487a94',
  /** low down away from the castle, left of the gates: a deep cyan (about 28 112 148 on screen) */
  horizon: '#357998',
  /** storm cloud away from the light: a blue slate (about 50 54 74 on screen), thick parts darker */
  cloud: '#545a72',
  cloudDark: '#40435b',
  /** a cloud's moonlit edge (silver lining) and the lit tops in the light */
  cloudLit: '#b1e6dc',
  /** the moon's halo: a saturated mint cyan, added */
  glow: '#40c8ac',
  /** the luminous window in the clouds behind the castle (about 36 125 155 on screen) */
  haze: '#2a9bba',
  /** the moon: pale cream (about 235 233 185 on screen), a little over 1 at its brightest */
  moon: '#fff2a8',
} as const;

/** toward the castle from the hero eye (a direction: the sky stays at infinity) */
const HAZE_DIR = new Vector3(LAND.crag.x - HERO.pos[0], 3.6 - HERO.pos[1], LAND.crag.z - HERO.pos[2]).normalize();
/** its azimuth and elevation (the shader's: azimuth atan(x, −z), elevation asin(y)) */
const HAZE_AE = new Vector2(Math.atan2(HAZE_DIR.x, -HAZE_DIR.z), Math.asin(HAZE_DIR.y));

/** the moon's angular radius (radians): about 49 px at the hero view's moon, as in the reference */
export const MOON_RADIUS = 0.031;

/**
 * The sheet ghosts streaming up and to the right through the dark clouds over the gates (the
 * reference's upper left), in sky coordinates: azimuth, elevation, size (radians, the head's
 * radius is half of it) and the flight's angle from straight up (radians, clockwise).
 */
const GHOSTS_GLSL = /* glsl */ `
  const vec4 SG0 = vec4(-0.102, 0.212, 0.026, 0.95);
  const vec4 SG1 = vec4(-0.040, 0.240, 0.033, 0.9);
  const vec4 SG2 = vec4(0.030, 0.268, 0.039, 0.85);
  const vec4 SG3 = vec4(0.098, 0.296, 0.031, 0.95);
`;

const VERT = /* glsl */ `
  ${GHOSTS_GLSL}
  varying vec3 vWorld;
  varying vec4 vGhostIn;
  vec3 skyDir(vec2 ae) { return vec3(cos(ae.y) * sin(ae.x), sin(ae.y), -cos(ae.y) * cos(ae.x)); }
  // 1 while a sky point is well inside the frame, 0 outside it (a ghost shows only with its head in view)
  float inFrame(vec2 ae) {
    vec4 c = projectionMatrix * (viewMatrix * vec4(skyDir(ae), 0.0));
    if (c.w <= 0.0) return 0.0;
    vec2 n = abs(c.xy / c.w);
    return 1.0 - smoothstep(0.8, 0.97, max(n.x, n.y));
  }
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vGhostIn = vec4(inFrame(SG0.xy), inFrame(SG1.xy), inFrame(SG2.xy), inFrame(SG3.xy));
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  ${NOISE_GLSL}
  ${NOISE3_GLSL}
  ${GHOSTS_GLSL}
  uniform float uSbTime, uMoonR, uHorizonEl, uIntensity, uFibre, uAlpha;
  uniform vec2 uWitch;
  uniform vec3 uSbMoonDir, uTop, uMid, uHorizon, uCloud, uCloudDark, uCloudLit, uGlow, uMoon, uHaze;
  uniform vec2 uHazeAE;
  varying vec3 vWorld;
  varying vec4 vGhostIn;
  // a sheet ghost flying through the clouds (g: azimuth, elevation, size, angle): a hood with a
  // pointed crown, a body that tapers into a long tail (about five head radii) bending away behind
  // it and melting into the cloud, two slanting slit eyes and an open mouth. Returns its opacity
  // (x), its holes (y) and its light (z: the crown and the moon side, a lit rim, fading down the tail).
  vec3 ghost(vec2 p, vec4 g) {
    vec2 q = p - g.xy;
    float c = cos(g.w), s = sin(g.w);
    q = vec2(c * q.x - s * q.y, s * q.x + c * q.y) / g.z;
    float t = clamp(-q.y / 2.7, 0.0, 1.0);
    // the tail bends away and ripples as it trails
    q.x += 0.6 * t * t + 0.09 * sin(q.y * 3.2) * t;
    // the hood: narrower toward the top, so the crown comes to a soft point
    float hy = max(q.y, 0.0);
    float head = length(vec2(q.x * (1.0 + 1.1 * hy), hy * 0.95)) - 0.5;
    float w = 0.5 * pow(1.0 - t, 1.3) * (1.0 + 0.1 * sin(q.y * 11.0 + g.x * 50.0) * t);
    float body = abs(q.x) - w;
    float d = q.y < 0.0 ? min(body, head) : head;
    float a = smoothstep(0.05, -0.05, d) * (1.0 - smoothstep(0.3, 1.0, t)) * (1.0 - 0.4 * t);
    // slit eyes slanting down toward the middle, an open mouth below them
    vec2 ex = vec2(abs(q.x), q.y) - vec2(0.17, 0.07);
    ex = vec2(0.88 * ex.x - 0.47 * ex.y, 0.47 * ex.x + 0.88 * ex.y);
    float eyes = smoothstep(1.0, 0.6, length(ex / vec2(0.14, 0.055)));
    float mouth = smoothstep(1.0, 0.6, length((q - vec2(0.02, -0.21)) / vec2(0.09, 0.14)));
    // the light: the crown and the side toward the moon, and a rim along that edge
    float side = clamp(0.5 + 0.9 * q.x + 0.5 * q.y, 0.0, 1.0);
    float rim = (1.0 - smoothstep(0.0, 0.14, -d)) * side * (1.0 - t);
    float light = smoothstep(-1.6, 0.4, q.y) * (0.55 + 0.45 * side) + 0.8 * rim;
    return vec3(a, max(eyes, mouth) * step(-0.45, q.y), light);
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
    // sheared so the storm streams in bands rising to the right, along the ghosts' flight
    vec3 q = vec3(dir.x * 3.0, (dir.y - 0.35 * dir.x) * 5.6, dir.z * 3.0) + vec3(uSbTime * 0.004, 0.0, uSbTime * 0.0025);
    float big = aivFbm3(q + 2.2 * (w - 0.5));
    float fine = aivFbm3(q * 3.1 + 5.0 + 0.9 * (w - 0.5));
    return big * 0.68 + fine * 0.32;
  }
  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float el = asin(clamp(dir.y, -1.0, 1.0));
    float az = atan(dir.x, -dir.z);
    vec2 p = vec2(az, el);
    float moonAng = acos(clamp(dot(dir, uSbMoonDir), -1.0, 1.0));
    float e = el - uHorizonEl;
    // the gradient: a deep cyan low down, a slate band, deep slate overhead
    vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.13, e));
    col = mix(col, uTop, smoothstep(0.12, 0.4, e));
    // the light: a luminous window in the clouds behind the castle, from the mist at its foot up
    // past the crag's top, rising to the right round the moon (the reference's brightest sky);
    // left of the gates the sky stays the deep cyan of the horizon
    float ba = az - uHazeAE.x;
    float edgeN = aivFbm(p * vec2(7.0, 11.0) + 2.0) - 0.5;
    float bankTop = 0.2 + 0.04 * smoothstep(-0.15, 0.28, ba) + 0.06 * edgeN;
    float bank = smoothstep(-0.42, -0.22, ba + 0.08 * edgeN) * (1.0 - smoothstep(0.42, 0.66, ba)) * (1.0 - smoothstep(bankTop - 0.09, bankTop + 0.04, el)) * smoothstep(-0.16, -0.05, e);
    col = mix(col, uHaze, bank);
    // the moon's halo: a saturated cyan, wide and soft, then tight
    float halo = 0.4 * exp(-moonAng * 5.0) + 1.0 * exp(-moonAng * 12.0);
    col += uGlow * halo;
    // stars, sparse, between the clouds, fading toward the horizon and the moon
    vec2 g = floor(p * 160.0);
    float s = aivHash12(g);
    float tw = 0.65 + 0.35 * aivHash12(g + floor(uSbTime * 3.0));
    float star = step(0.993, s) * smoothstep(0.35, 0.0, length(fract(p * 160.0) - 0.5)) * tw;
    col += vec3(0.75, 0.9, 0.9) * star * smoothstep(0.12, 0.45, e) * smoothstep(0.25, 0.6, moonAng) * 0.7 * (1.0 - bank);
    // the moon: a disc with soft maria and a darker limb, a little over 1 (the bloom haloes it a little)
    float disc = smoothstep(uMoonR, uMoonR * 0.93, moonAng);
    float maria = aivFbm(p * 46.0 + 4.0);
    float rr = moonAng / uMoonR;
    vec3 moon = uMoon * (1.08 - 0.4 * smoothstep(0.38, 0.72, maria)) * (1.0 - 0.12 * rr * rr);
    col = mix(col, moon, disc);
    // clouds: heavy storm clouds to the upper left, lit cumulus in the light, thin over the moon
    vec3 wq = dir * vec3(1.5, 2.8, 1.5) + vec3(uSbTime * 0.003, 0.0, 0.0);
    vec3 w = vec3(aivFbm3(wq + 3.1), aivFbm3(wq + 7.7), aivFbm3(wq + 11.3));
    float d = cloudField(dir, w);
    float heavy = 0.12 * smoothstep(0.25, -0.6, dir.x) + 0.08 * smoothstep(0.12, 0.55, e);
    // a dark storm bank over the luminous window behind the castle (the reference's top centre)
    float darkBank = smoothstep(-0.45, -0.2, ba) * (1.0 - smoothstep(0.3, 0.55, ba)) * smoothstep(bankTop + 0.02, bankTop + 0.14, el) * (1.0 - exp(-moonAng * 5.0));
    float thr = 0.36 - heavy - 0.1 * darkBank + 0.12 * exp(-moonAng * 14.0) + 0.14 * (1.0 - smoothstep(0.03, 0.13, e)) * (1.0 - 0.7 * bank);
    float cover = smoothstep(thr, thr + 0.08, d) * smoothstep(-0.06, 0.03, e);
    // the moon's side: where the density falls toward the moon the cloud faces it and takes the light
    vec3 toMoon = normalize(uSbMoonDir - dir * dot(uSbMoonDir, dir) + vec3(1e-5));
    float dm = cloudField(normalize(dir + toMoon * 0.03), w);
    float facing = clamp((d - dm) * 9.0, 0.0, 1.0);
    float rim = facing * smoothstep(thr - 0.02, thr + 0.05, d) * (1.0 - smoothstep(thr + 0.07, thr + 0.24, d));
    float near = exp(-moonAng * 6.5);
    float light = clamp(bank + near, 0.0, 1.0);
    vec3 storm = mix(uCloud, uCloudDark, clamp(smoothstep(thr + 0.04, thr + 0.3, d) + 0.6 * darkBank, 0.0, 1.0) * (1.0 - 0.6 * near));
    vec3 lit = mix(uHaze, uCloudLit, 0.22 + 0.5 * facing + 0.3 * near) * (1.0 + 0.6 * near);
    // every storm mass's edge catches a little of the luminous sky behind it (the reference's
    // silver-edged billows), the moon side most
    float edgeLit = smoothstep(thr, thr + 0.04, d) * (1.0 - smoothstep(thr + 0.05, thr + 0.16, d));
    storm = mix(storm, mix(uMid, uCloudLit, 0.25) * 1.15, edgeLit * 0.45 * (1.0 - darkBank));
    vec3 cloudCol = mix(storm, lit, light) + uCloudLit * rim * (0.14 + 0.35 * light + 1.2 * near) * (1.0 - 0.7 * darkBank);
    col = mix(col, cloudCol, cover * 0.94 * (1.0 - 0.4 * disc));
    // the moon's own clouds: silver-lit streaks crossing its lower half and swirling under it (the
    // reference's lit swirl below the moon), in the moon's frame (moon radii)
    {
      vec3 mr = normalize(cross(uSbMoonDir, vec3(0.0, 1.0, 0.0)));
      vec3 mu = cross(mr, uSbMoonDir);
      vec2 mq = vec2(dot(dir, mr), dot(dir, mu)) / uMoonR;
      float streak = aivFbm(vec2(mq.x * 0.32 + uSbTime * 0.01, mq.y * 1.5 + 0.3 * sin(mq.x * 0.7)) + 11.0);
      float mmask = exp(-dot((mq - vec2(0.2, -1.3)) / vec2(3.2, 1.35), (mq - vec2(0.2, -1.3)) / vec2(3.2, 1.35)));
      float sv = smoothstep(0.4, 0.6, streak) * mmask * step(0.0, dot(dir, uSbMoonDir));
      col = mix(col, uCloudLit * (1.05 + 0.25 * disc), sv * 0.9);
    }
    // the sheet ghosts in the clouds over the gates: pale, their eyeholes dark (none without a head in the frame)
    vec3 g0 = ghost(p, SG0) * vGhostIn.x;
    vec3 g1 = ghost(p, SG1) * vGhostIn.y;
    vec3 g2 = ghost(p, SG2) * vGhostIn.z;
    vec3 g3 = ghost(p, SG3) * vGhostIn.w;
    float ga = clamp(g0.x + g1.x + g2.x + g3.x * 0.8, 0.0, 1.0);
    float gl = clamp(g0.x * g0.z + g1.x * g1.z + g2.x * g2.z + g3.x * g3.z * 0.8, 0.0, 1.0);
    float gh = clamp(g0.x * g0.y + g1.x * g1.y + g2.x * g2.y + g3.x * g3.y, 0.0, 1.0);
    vec3 ghostCol = mix(vec3(0.16, 0.16, 0.24), mix(uCloudLit, vec3(0.62, 0.58, 0.8), 0.6) * 0.5, clamp(gl, 0.0, 1.0));
    col = mix(col, ghostCol, ga * (0.42 + 0.22 * cover) * (0.85 + 0.3 * edgeN) * (1.0 - bank));
    col = mix(col, uCloudDark * 0.5, gh * 0.7 * (1.0 - bank));
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
