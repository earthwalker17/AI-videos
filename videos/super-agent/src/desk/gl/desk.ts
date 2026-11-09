/**
 * The desk: one dark slate plane at z = 0 under everything (synthesis §2, Palette and Texture).
 * - base #212322, near-neutral green-graphite (BT.709 limited luma 45.6);
 * - static, world-locked tooth (±3% at 3 u) and cloud (±1.5% at 300 u) from the kit's value noise;
 * - the light pools and the analytic footprint shadows (gl/light.ts): alpha 0.40 towards #121312,
 *   and contact occlusion round everything that stands on the desk;
 * - the grooves, engraved: whole hand-overs run in them from the ramp to each bay's door. The wall
 *   that faces the key is lit (+8% on its lip), the other is in shadow (−18%);
 * - act one's folders, pressed into the desk under the deck (history, at −2);
 * - never darker than BT.709 limited luma 38 anywhere: a floor clamp.
 * Corners never darken: no vignette, here or in the post.
 */
import { Curve, NOISE_GLSL } from '@aiv/remotion-kit';
import { Color, ShaderMaterial, Vector2, Vector4 } from 'three';
import { IMPRINTS } from '../beat3.ts';
import { GROOVES, GROOVE_FRESH, GROOVE_HALF_W, KEY, type P2 } from '../layout.ts';
import { linearOf } from '../pools.ts';
import { LIGHT_GLSL, LIGHT_UNIFORMS } from './light.ts';

/** Points per groove polyline, and the grooves' count. */
export const GROOVE_PTS = 14;
const GROOVE_IDS = ['bug', 'tests', 'docs', 'fresh'] as const;

/**
 * What the frame sets on the desk (objects set them in layout effects, before the frame is drawn):
 * how much of each groove is cut (the fresh groove is cut in MT1, the others are whole) and up to three
 * open hatches, holes in the desk a bay rises or sinks through (x0, y0, x1, y1; far away when shut).
 */
export const DESK_GROOVE_CUT = { value: [1, 1, 1, 0] };
export const HOLE_SHUT = (): Vector4 => new Vector4(1e6, 1e6, 1e6, 1e6);
export const DESK_HOLES = { value: [HOLE_SHUT(), HOLE_SHUT(), HOLE_SHUT()] };

/** The desk's colours (sRGB hex from the synthesis's palette). */
export const DESK_HEX = { base: '#212322', tint: '#121312' } as const;
/** The ground never goes under luma 40 (BT.709 limited; QA's floor is 38): sRGB code 28 on a neutral grey, in linear light. */
export const DESK_FLOOR = ((28.4 / 255 + 0.055) / 1.055) ** 2.4;

/** Each groove as a polyline through its keys (centripetal Catmull-Rom, the kit's Curve). */
export function groovePolylines(): P2[][] {
  return GROOVE_IDS.map((id) => {
    const c = new Curve((id === 'fresh' ? GROOVE_FRESH : GROOVES[id]).map((p) => [p[0], p[1]]));
    return c.polyline(GROOVE_PTS - 1).map((p) => [p[0], p[1]] as P2);
  });
}

function grooveUniform(): Vector4[] {
  const out: Vector4[] = [];
  for (const line of groovePolylines()) for (const p of line) out.push(new Vector4(p[0], p[1], 0, 0));
  return out;
}

function grooveBoxes(): Vector4[] {
  return groovePolylines().map((line) => {
    const xs = line.map((p) => p[0]);
    const ys = line.map((p) => p[1]);
    const m = GROOVE_HALF_W + 6;
    return new Vector4(Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m);
  });
}

const VERT = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = /* glsl */ `
varying vec3 vW;
uniform vec3 uBase;
uniform vec3 uTint;
uniform float uFloor;
uniform vec2 uLight;
uniform vec4 uGroove[${GROOVE_IDS.length * GROOVE_PTS}];
uniform vec4 uGrooveBox[${GROOVE_IDS.length}];
uniform float uGrooveW;
uniform float uGrooveCut[${GROOVE_IDS.length}];
uniform vec4 uHole[3];
uniform vec4 uImp[${IMPRINTS.length}];
uniform vec4 uImpRot[${IMPRINTS.length}];
${NOISE_GLSL}
${LIGHT_GLSL}

// the groove's shading at p: a lift or cut relative to the ground (fraction), 0 outside
float grooveShade(vec2 p) {
  float best = 1e9;
  float side = 1.0;
  vec2 nrm = vec2(0.0, 1.0);
  for (int g = 0; g < ${GROOVE_IDS.length}; g++) {
    vec4 bx = uGrooveBox[g];
    if (p.x < bx.x || p.y < bx.y || p.x > bx.z || p.y > bx.w) continue;
    // how far the groove is cut, in segments (a whole groove: all of them)
    float lim = uGrooveCut[g] * ${GROOVE_PTS - 1}.0;
    if (lim <= 0.0) continue;
    for (int i = 0; i < ${GROOVE_PTS - 1}; i++) {
      if (float(i) >= lim) break;
      vec2 A = uGroove[g * ${GROOVE_PTS} + i].xy;
      vec2 B = uGroove[g * ${GROOVE_PTS} + i + 1].xy;
      vec2 pa = p - A;
      vec2 ba = B - A;
      float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, min(1.0, lim - float(i)));
      float d = length(pa - ba * t);
      if (d < best) {
        best = d;
        vec2 tn = normalize(ba);
        vec2 n = vec2(-tn.y, tn.x);
        side = dot(pa, n) >= 0.0 ? 1.0 : -1.0;
        nrm = n;
      }
    }
  }
  float w = uGrooveW;
  if (best > w + 4.0) return 0.0;
  // how much the wall on this side faces the key (its face normal points back to the centre line)
  float face = dot(-side * nrm, uLight);
  float aa = 1.2;
  float floorBand = 1.0 - smoothstep(0.5 * w - aa, 0.5 * w + aa, best);
  float wallBand = smoothstep(0.5 * w - aa, 0.5 * w + aa, best) * (1.0 - smoothstep(w - aa, w + aa, best));
  float lipBand = smoothstep(w - aa, w + aa, best) * (1.0 - smoothstep(w + 3.0 - aa, w + 3.0 + aa, best));
  // the floor: dark, and darker in the shadow of the wall nearer the key
  float floorShade = -0.30 - 0.06 * smoothstep(0.0, 0.5, side * dot(nrm, uLight) * 0.5 + 0.5);
  float wallShade = face > 0.0 ? 2.2 * face : 0.30 * face;
  float lipShade = face > 0.0 ? 7.5 * face : 0.6;
  return floorBand * floorShade + wallBand * wallShade + lipBand * lipShade;
}

// act one's folders, pressed 2 u into the desk: a faint floor and an engraved edge
float impSd(int i, vec2 p) {
  vec4 a = uImp[i];
  vec4 r = uImpRot[i];
  vec2 q = p - a.xy;
  q = vec2(r.x * q.x + r.y * q.y, -r.y * q.x + r.x * q.y);
  return dskRoundRect(q, a.zw, r.z);
}
float imprintShade(vec2 p) {
  float s = 0.0;
  for (int i = 0; i < ${IMPRINTS.length}; i++) {
    float d = impSd(i, p);
    if (d > 4.0) continue;
    float e = 1.0;
    vec2 gr = vec2(impSd(i, p + vec2(e, 0.0)) - impSd(i, p - vec2(e, 0.0)), impSd(i, p + vec2(0.0, e)) - impSd(i, p - vec2(0.0, e)));
    gr = gr / max(length(gr), 1e-4);
    // the inner wall at the edge faces inward (-gr): lit if that faces the key
    float face = dot(-gr, uLight);
    // an embossed outline that reads at delivery size (8-10 codes off the slate on its lit wall)
    float edge = 1.0 - smoothstep(0.0, 2.8, abs(d + 1.5));
    float inside = 1.0 - smoothstep(-1.0, 1.0, d);
    // how deep it is pressed (the turn presses the folders in; 1 once they are history)
    s += uImpRot[i].w * (inside * -0.06 + edge * (face > 0.0 ? 0.62 * face : 0.34 * face));
  }
  return s;
}

void main() {
  vec2 p = vW.xy;
  // an open hatch: the desk is cut away (the bay in it, or the dark below, shows through)
  for (int h = 0; h < 3; h++) {
    vec4 o = uHole[h];
    if (p.x > o.x && p.y > o.y && p.x < o.z && p.y < o.w) discard;
  }
  float tooth = aivNoise(p / 3.0) * 2.0 - 1.0;
  float cloud = aivFbm(p / 300.0 + 3.7) * 2.0 - 1.0;
  // tooth and cloud at amplitudes that survive the 8-bit delivery on this dark slate (about +/-2 and +/-1 codes)
  vec3 col = uBase * (1.0 + 0.065 * tooth + 0.035 * cloud);
  col *= 1.0 + grooveShade(p) + imprintShade(p);
  col *= 1.0 + dskPool(vec3(p, 0.0));
  vec2 sh = dskShade(p, 0.0);
  float dark = 1.0 - (1.0 - 0.40 * sh.x) * (1.0 - 0.46 * sh.y);
  col = mix(col, uTint, dark);
  // a soft floor: below 1.3x luma 38 the darkening is compressed, never clipped flat (the tooth survives)
  float yl = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float x = yl / uFloor;
  if (x < 1.3) col *= (1.0 + 0.3 * (x / 1.3) * (x / 1.3)) / max(x, 1e-3);
  gl_FragColor = vec4(min(col, vec3(0.95)), 1.0);
}
`;

/** The desk's ShaderMaterial (one program). */
export function makeDeskMaterial(): ShaderMaterial {
  const [r, g, b] = linearOf(DESK_HEX.base);
  const [tr, tg, tb] = linearOf(DESK_HEX.tint);
  const lxy = Math.hypot(KEY[0], KEY[1]);
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ...LIGHT_UNIFORMS,
      uBase: { value: new Color(r, g, b) },
      uTint: { value: new Color(tr, tg, tb) },
      uFloor: { value: DESK_FLOOR },
      uLight: { value: new Vector2(KEY[0] / lxy, KEY[1] / lxy) },
      uGroove: { value: grooveUniform() },
      uGrooveBox: { value: grooveBoxes() },
      uGrooveW: { value: GROOVE_HALF_W },
      uGrooveCut: DESK_GROOVE_CUT,
      uHole: DESK_HOLES,
      uImp: { value: IMPRINTS.map((m) => new Vector4(m.c[0], m.c[1], m.w / 2, m.d / 2)) },
      uImpRot: { value: IMPRINTS.map((m) => new Vector4(Math.cos(m.rot), Math.sin(m.rot), 10, 1)) },
    },
  });
}
