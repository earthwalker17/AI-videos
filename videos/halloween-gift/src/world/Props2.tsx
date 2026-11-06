/**
 * The graveyard's props (V2), each at its layout spot and sat in the ground:
 *  - <Cauldron f />: at LAND.cauldron, right of the shoo stop under the ghosts (the RIP stone beside
 *    it): a squat cast-iron pot on three short legs, a thick rolled rim crusted where the brew
 *    boiled over, two lugs with rings; under it a few charred logs with dim embers in their cracks
 *    and a bed of coals; a glowing green-cyan brew with slow swirls, bubbles that rise, swell and
 *    pop (each a seeded cycle of the frame), foam at the rim, and wisps of steam drifting up
 *    (camera-facing). Its footprint stays inside film/journey.ts's 0.35 circle.
 *  - <Coffin />: at COFFIN, beside the path's first run: a six-sided coffin of weathered planks
 *    with iron nails, its lid slid askew, loose planks around, and a shovel stuck in a dirt mound
 *    at its head (COFFIN_FOOTPRINT: the camera clearance circle it needs).
 *  - <Fireflies f />: will-o'-wisps over the graveyard and the lane, warm green and cyan, drifting
 *    on sums of sines of the frame, each fading in and out slowly (never popping); instanced,
 *    additive.
 * Every surface is a storybook material (the film's light, rim and fog); the glows are emission
 * and bloom, no lights. Everything animates from the frame number only.
 */
import { rand } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FPS } from '../cues.ts';
import { tubeGeometry, type V3 } from '../kit/pumpkin.ts';
import { fbm3, noise3 } from '../kit/stone.ts';
import { storybookMaterial } from '../look/materials.ts';
import { FLOOR, groundHeight, LAMPS, LAND } from './layout.ts';
import { surfaceHeight } from './Terrain.tsx';

const TAU = Math.PI * 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const gy = (x: number, z: number) => FLOOR + surfaceHeight(x, z);
const lin = (hex: string) => new Color(hex);

/** RGBA vertex colours + an emission mask in uv.x for a geometry, from a function of position. */
function paint(g: BufferGeometry, fn: (x: number, y: number, z: number, i: number) => [number, number, number, number, number]): BufferGeometry {
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 4);
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const c = fn(p.getX(i), p.getY(i), p.getZ(i), i);
    col.set(c.slice(0, 4), i * 4);
    uv[i * 2] = c[4];
    uv[i * 2 + 1] = 0.5;
  }
  g.setAttribute('color', new BufferAttribute(col, 4));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  return g;
}

/** Keep only position and normal, non-indexed (so different builders merge; `paint` adds the rest). */
function tidy(g: BufferGeometry): BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(ng.attributes)) if (!['position', 'normal'].includes(name)) ng.deleteAttribute(name);
  if (!ng.attributes.normal) ng.computeVertexNormals();
  if (ng !== g) g.dispose();
  return ng;
}

/** A 1D emission gradient (uv.x looks it up). */
function ramp(stops: [number, string][]): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 256, 0);
  for (const [t, col] of stops) gr.addColorStop(t, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 1);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// ---- camera-facing sprites, instanced (steam, fireflies) ----------------------------------------

const BILL_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aData;
varying vec2 vUv;
varying float vA;
varying float vMix;
void main() {
  vec4 c = modelViewMatrix * vec4(aPos, 1.0);
  float cs = cos(aData.z);
  float sn = sin(aData.z);
  vec2 p = vec2(cs * position.x - sn * position.y, sn * position.x + cs * position.y) * aData.x;
  c.xy += p;
  gl_Position = projectionMatrix * c;
  vUv = uv;
  vA = aData.y;
  vMix = aData.w;
}
`;
const BILL_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColA;
uniform vec3 uColB;
varying vec2 vUv;
varying float vA;
varying float vMix;
void main() {
  vec4 t = texture2D(uMap, vUv);
  gl_FragColor = vec4(mix(uColA, uColB, vMix) * t.rgb, t.a * vA);
}
`;

function billboards(n: number, map: CanvasTexture, a: string | Color, b: string | Color, gain: number) {
  const geo = new InstancedBufferGeometry();
  const base = new PlaneGeometry(1, 1);
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const pos = new InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const data = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
  pos.setUsage(DynamicDrawUsage);
  data.setUsage(DynamicDrawUsage);
  geo.setAttribute('aPos', pos);
  geo.setAttribute('aData', data);
  geo.instanceCount = n;
  const mat = new ShaderMaterial({
    vertexShader: BILL_VERT,
    fragmentShader: BILL_FRAG,
    uniforms: { uMap: { value: map }, uColA: { value: new Color(a).multiplyScalar(gain) }, uColB: { value: new Color(b).multiplyScalar(gain) } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  return { geo, mat, pos, data, base };
}

/** A soft round glow: a hot core and a wide falloff (fireflies). */
function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.07, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.4)');
  gr.addColorStop(0.42, 'rgba(255,255,255,0.13)');
  gr.addColorStop(0.72, 'rgba(255,255,255,0.035)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A wisp of steam: a soft, uneven blob of seeded noise (drawn once). */
function steamTexture(): CanvasTexture {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S - 0.5;
      const v = (y + 0.5) / S - 0.5;
      const r = Math.hypot(u, v * 1.25) * 2;
      const n = fbm3(u * 4, v * 4, 0.5, 71, 3) * 0.5 + 0.5;
      const a = clamp01(1 - r) ** 1.6 * smoothstep(0.25, 0.75, n + 0.25 * (1 - r));
      const k = (y * S + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.round(255 * a);
    }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// ---- the cauldron -------------------------------------------------------------------------------

/** The pot's bottom above the ground (its legs), the brew's height in the pot, the brew's radius. */
const LEG_H = 0.068;
const BREW_Y = 0.26;
const BREW_R = 0.131;
/** the pot's profile (radius, height above its bottom): belly, neck, the rolled rim, the inside */
const POT: [number, number][] = [
  [0.0, 0.0],
  [0.05, 0.002],
  [0.095, 0.012],
  [0.135, 0.034],
  [0.163, 0.068],
  [0.178, 0.106],
  [0.182, 0.134],
  [0.177, 0.164],
  [0.164, 0.194],
  [0.149, 0.217],
  [0.141, 0.231],
  [0.143, 0.239],
  [0.155, 0.243],
  [0.168, 0.25],
  [0.175, 0.26],
  [0.175, 0.27],
  [0.168, 0.278],
  [0.156, 0.281],
  [0.145, 0.278],
  [0.138, 0.27],
  [0.134, 0.259],
  [0.131, 0.246],
  [0.12, 0.236],
];

/** The pot's profile resampled (three points per span): enough rows for the hammer's dents. */
function potProfile(): Vector2[] {
  const out: Vector2[] = [];
  for (let i = 0; i < POT.length - 1; i++) {
    const [r0, y0] = POT[i];
    const [r1, y1] = POT[i + 1];
    const n = y1 - y0 > 0.02 ? 3 : 1;
    for (let k = 0; k < n; k++) out.push(new Vector2(r0 + ((r1 - r0) * k) / n, y0 + ((y1 - y0) * k) / n + LEG_H));
  }
  const [rl, yl] = POT[POT.length - 1];
  out.push(new Vector2(rl, yl + LEG_H));
  return out;
}

/** Hammered iron: shallow round dents in rows (a cell pattern in angle and height), 0 on a dent's floor .. 1 between. */
function hammer(a: number, y: number, seed: number): number {
  const u = (a / TAU) * 46;
  const v = y * 70;
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  let best = 9;
  for (let dv = -1; dv <= 1; dv++)
    for (let du = -1; du <= 1; du++) {
      const cu = iu + du;
      const cv = iv + dv;
      const cell = (((cu % 46) + 46) % 46) * 1000 + cv;
      const ox = rand(seed, 9101, cell);
      const oy = rand(seed, 9102, cell);
      best = Math.min(best, Math.hypot(u - (cu + 0.15 + 0.7 * ox), v - (cv + 0.15 + 0.7 * oy)));
    }
  return smoothstep(0.0, 0.62, best);
}

function cauldronIron(seed: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const pot = new LatheGeometry(potProfile(), 92);
  // cast and hammered unevenly: lumps, rows of shallow hammer dents over the belly, a big dent,
  // the rim a little out of round (a smooth ball read as plastic)
  const p = pot.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const a = Math.atan2(z, x);
    const belly = smoothstep(LEG_H + 0.015, LEG_H + 0.05, y) * smoothstep(LEG_H + 0.232, LEG_H + 0.21, y);
    const k = 1 + 0.012 * (noise3(x * 30, y * 30, z * 30, seed) - 0.5) - 0.022 * (1 - hammer(a + Math.PI, y, seed)) * belly + 0.018 * Math.cos(2 * a + 0.7) * smoothstep(0.2, 0.3, y) - 0.03 * Math.exp(-((a - 2.2) ** 2) / 0.08 - ((y - 0.17) ** 2) / 0.002);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  pot.computeVertexNormals();
  parts.push(tidy(pot));
  // two lugs and their rings on the shoulders
  for (const s of [-1, 1]) {
    const ax = s * 0.15;
    const lug = new IcosahedronGeometry(0.022, 1);
    lug.scale(1, 0.7, 1.2);
    lug.translate(ax, LEG_H + 0.215, 0);
    parts.push(tidy(lug));
    // a ring hanging from the lug, in the plane out from the pot
    const ring: V3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * TAU;
      ring.push([s * (0.172 + 0.026 * Math.sin(t)), LEG_H + 0.19 + 0.028 * Math.cos(t), 0.004 * Math.sin(2 * t)]);
    }
    parts.push(tidy(tubeGeometry({ points: ring, segments: 24, sides: 6, radius: () => 0.0065, color: () => [1, 1, 1, 0.4] })));
  }
  // three short legs, splayed, with claw feet
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + 0.4 + (rand(seed, 'leg', k) - 0.5) * 0.25;
    const top = new Vector3(Math.cos(a) * 0.1, LEG_H + 0.02, Math.sin(a) * 0.1);
    const foot = new Vector3(Math.cos(a) * 0.14, -0.012, Math.sin(a) * 0.14);
    const leg = tubeGeometry({
      points: [top.toArray() as V3, top.clone().lerp(foot, 0.5).add(new Vector3(Math.cos(a) * 0.008, 0, Math.sin(a) * 0.008)).toArray() as V3, foot.toArray() as V3],
      segments: 8,
      sides: 7,
      closeEnd: true,
      radius: (t) => 0.019 - 0.007 * t + 0.006 * Math.exp(-(((t - 0.92) / 0.08) ** 2)),
      color: () => [1, 1, 1, 0.8],
    });
    parts.push(tidy(leg));
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  const iron = lin('#323844');
  const rust = lin('#4a3530');
  const worn = lin('#5e6672');
  const crust = lin('#24413f');
  return paint(merged, (x, y, z) => {
    const n = fbm3(x * 14, y * 14, z * 14, seed + 3, 3) * 0.5 + 0.5;
    const rs = smoothstep(0.55, 0.75, n);
    let r = iron.r + (rust.r - iron.r) * rs;
    let g = iron.g + (rust.g - iron.g) * rs;
    let b = iron.b + (rust.b - iron.b) * rs;
    // the worn top of the rim, the brew's crust dribbled down below it, soot low by the fire
    const rim = smoothstep(LEG_H + 0.268, LEG_H + 0.279, y) * smoothstep(0.14, 0.16, Math.hypot(x, z));
    r += (worn.r - r) * rim;
    g += (worn.g - g) * rim;
    b += (worn.b - b) * rim;
    const a = Math.atan2(z, x);
    // (only dribbles below the lip: a crusted ring all round read as a mint plastic rim)
    const drip = smoothstep(LEG_H + 0.19, LEG_H + 0.245, y) * smoothstep(LEG_H + 0.268, LEG_H + 0.255, y) * smoothstep(0.66, 0.86, noise3(a * 3.2, y * 4, 0.5, seed + 9)) * smoothstep(0.15, 0.165, Math.hypot(x, z));
    r += (crust.r - r) * drip * 0.7;
    g += (crust.g - g) * drip * 0.7;
    b += (crust.b - b) * drip * 0.7;
    const soot = 0.55 + 0.45 * smoothstep(LEG_H - 0.01, LEG_H + 0.09, y);
    // the fire's warm uplight on the lower belly and the legs (reads even where grass hides the logs)
    const warm = smoothstep(LEG_H + 0.1, LEG_H - 0.01, y) * (0.75 + 0.25 * n);
    // the brew's own light on the iron: the inner lip and the rolled rim brightest, the shoulder
    // below it fading down the belly (the pot is lit by its brew, as in the reference)
    const lip = smoothstep(LEG_H + 0.236, LEG_H + 0.276, y) * (1 - 0.35 * smoothstep(0.165, 0.176, Math.hypot(x, z)));
    const brew = Math.max(lip, (0.2 + 0.55 * smoothstep(LEG_H + 0.02, LEG_H + 0.235, y)) * (0.75 + 0.25 * n));
    // uv.x: 0.5 is no glow, below it the fire's warmth, above it the brew's light (a triangle
    // between either and none never interpolates through the other's colours)
    return [r * soot, g * soot, b * soot, 1, warm > brew ? 0.5 - 0.5 * warm : 0.5 + 0.5 * brew];
  });
}

/** Charred logs under the pot and a bed of coals; embers glow in their cracks (uv.x). */
function cauldronFire(seed: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const n = 4;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + 0.3 + (rand(seed, 'log', k) - 0.5) * 0.5;
    const len = 0.2 + 0.07 * rand(seed, 'len', k);
    const r0 = 0.021 + 0.008 * rand(seed, 'rad', k);
    const inner = 0.03 + 0.015 * rand(seed, 'in', k);
    const lift = r0 * 0.55;
    const pts: V3[] = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const d = inner + len * t;
      pts.push([Math.cos(a) * d + Math.sin(a) * 0.01 * Math.sin(t * 5 + k), lift + 0.012 * (1 - t) * (k % 2) + 0.004 * Math.sin(t * 7), Math.sin(a) * d - Math.cos(a) * 0.01 * Math.sin(t * 5 + k)]);
    }
    parts.push(
      tidy(
        tubeGeometry({
          points: pts,
          segments: 14,
          sides: 8,
          closeEnd: true,
          radius: (t, ang) => r0 * (1 - 0.35 * Math.exp(-((t / 0.15) ** 2))) * (1 + 0.12 * (noise3(t * 9, Math.cos(ang) * 2, Math.sin(ang) * 2, seed + k) - 0.5)),
          color: () => [1, 1, 1, 0.5],
        }),
      ),
    );
  }
  // coals heaped under the pot
  for (let k = 0; k < 9; k++) {
    const a = rand(seed, 'coal', k) * TAU;
    const d = 0.07 * Math.sqrt(rand(seed, 'cd', k));
    const s = 0.016 + 0.014 * rand(seed, 'cs', k);
    const c = new IcosahedronGeometry(s, 0);
    c.scale(1, 0.65, 1.1);
    c.rotateY(rand(seed, 'cr', k) * TAU);
    c.translate(Math.cos(a) * d, s * 0.35, Math.sin(a) * d);
    parts.push(tidy(c));
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  const coal = lin('#17110f');
  const ash = lin('#4a4440');
  return paint(merged, (x, y, z) => {
    const d = Math.hypot(x, z);
    const n = noise3(x * 60, y * 60, z * 60, seed + 5);
    const crack = smoothstep(0.58, 0.72, n);
    // embers near the middle, in the cracks; grey ash on the logs' tops further out
    const hot = smoothstep(0.2, 0.05, d) * (0.35 + 0.65 * crack);
    const top = smoothstep(0.02, 0.05, y) * smoothstep(0.1, 0.22, d) * smoothstep(0.4, 0.7, noise3(x * 25, y * 25, z * 25, seed + 6));
    const k = 0.8 + 0.4 * n;
    return [(coal.r + (ash.r - coal.r) * top) * k, (coal.g + (ash.g - coal.g) * top) * k, (coal.b + (ash.b - coal.b) * top) * k, 0.4, hot];
  });
}

/** The brew's surface: a disc in rings (displaced per frame), uv over the disc for the swirl map. */
function brewDisc(): BufferGeometry {
  const rings = 7;
  const segs = 44;
  const pos: number[] = [0, 0, 0];
  const uv: number[] = [0.5, 0.5];
  const idx: number[] = [];
  for (let r = 1; r <= rings; r++)
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * TAU;
      const rr = (r / rings) * BREW_R;
      pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      uv.push(0.5 + (Math.cos(a) * rr) / BREW_R / 2, 0.5 + (Math.sin(a) * rr) / BREW_R / 2);
    }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let r = 1; r < rings; r++)
    for (let s = 0; s < segs; s++) {
      const a = 1 + (r - 1) * segs + s;
      const b = 1 + (r - 1) * segs + ((s + 1) % segs);
      const c = a + segs;
      const d = b + segs;
      idx.push(a, b, d, a, d, c);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The brew's glow: swirling bands of seeded noise, foam toward the rim (drawn once). */
function swirlTexture(): CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  const deep = new Color('#1a58a8');
  const mid = new Color('#48a8f0');
  const hot = new Color('#c8f4ff');
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S - 0.5;
      const v = (y + 0.5) / S - 0.5;
      const r = Math.hypot(u, v) * 2;
      const a = Math.atan2(v, u);
      const sw = fbm3(Math.cos(a + r * 3.2) * r * 3, Math.sin(a + r * 3.2) * r * 3, 0.3, 81, 4) * 0.5 + 0.5;
      const foam = smoothstep(0.75, 0.98, r) * (0.35 + 0.4 * noise3(u * 30, v * 30, 1, 82));
      const t = clamp01(sw * 1.1 + foam * 0.8 - 0.1);
      const col = t < 0.5 ? deep.clone().lerp(mid, t / 0.5) : mid.clone().lerp(hot, (t - 0.5) / 0.5);
      const k = (y * S + x) * 4;
      img.data[k] = Math.round(255 * col.r);
      img.data[k + 1] = Math.round(255 * col.g);
      img.data[k + 2] = Math.round(255 * col.b);
      img.data[k + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  // the data above is already display-referred: mark it sRGB so it is linearised on sampling
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The froth's dome height above the brew at distance d from the middle. */
const domeAt = (d: number) => 0.004 + 0.004 * Math.max(0, 1 - (d / BREW_R) ** 2);

/**
 * The foam heaped over the brew: a dome of glowing bubbles (blue-violet to cyan) bulging above the
 * rim, a few slumped over it; each breathes slowly (sines of the frame, never popping).
 */
const FROTH_N = 70;
interface FrothBall {
  a: number;
  d: number;
  r: number;
  h: number;
  ph: number;
  w: number;
  tint: number;
}
function frothBalls(seed: number): FrothBall[] {
  const out: FrothBall[] = [];
  for (let i = 0; i < FROTH_N; i++) {
    const r = (k: string) => rand(seed, k, i);
    const over = i >= FROTH_N - 6;
    // a thin ring of foam hugging the inside of the rim (flattened caps), a few over its lip
    const d = over ? BREW_R * (1.06 + 0.06 * r('fo')) : BREW_R * (0.8 + 0.18 * Math.sqrt(r('fd')));
    const a = i * 2.39996 + r('fa2') * 0.7;
    const rad = over ? 0.005 + 0.004 * r('frr') : 0.005 + 0.007 * r('frr') ** 1.5;
    const h = over ? 0.024 + 0.004 * r('fh') : 0.002 + 0.004 * r('fh');
    out.push({ a, d, r: rad, h, ph: r('fp') * TAU, w: 0.5 + 0.9 * r('fw'), tint: r('ft') });
  }
  return out;
}
/** The froth's surface: a polar grid over the brew and just past the rim (rings, segments). */
const FROTH_RINGS = 22;
const FROTH_SEGS = 64;
const FROTH_REACH = BREW_R * 1.24;

/** Polynomial smooth maximum (blend width k): the foam's cells run together in rounded creases. */
function smax(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

/**
 * The froth: ONE surface, the smooth union of every bubble's cap and a low dome (a heap of
 * separate spheres read as identical balls), its cells merged into creases; uv.x picks the glow
 * (violet .. cyan by the dominant bubble's tint, brighter on top). Heights are set per frame
 * (frothHeights) in the balls' own turning frame (the mesh turns with them).
 */
function frothGeometry(): { geo: BufferGeometry; xz: Float32Array } {
  const n = 1 + FROTH_RINGS * FROTH_SEGS;
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const xz = new Float32Array(n * 2);
  for (let r = 0; r <= FROTH_RINGS; r++)
    for (let k = 0; k < (r === 0 ? 1 : FROTH_SEGS); k++) {
      const i = r === 0 ? 0 : 1 + (r - 1) * FROTH_SEGS + k;
      // denser toward the rim (where the overflow slumps over it)
      const d = FROTH_REACH * (r / FROTH_RINGS) ** 0.85;
      const a = (k / FROTH_SEGS) * TAU + (r % 2) * (Math.PI / FROTH_SEGS);
      xz[i * 2] = Math.cos(a) * d;
      xz[i * 2 + 1] = Math.sin(a) * d;
      pos[i * 3] = xz[i * 2];
      pos[i * 3 + 2] = xz[i * 2 + 1];
    }
  const idx: number[] = [];
  const at = (r: number, k: number) => (r === 0 ? 0 : 1 + (r - 1) * FROTH_SEGS + (((k % FROTH_SEGS) + FROTH_SEGS) % FROTH_SEGS));
  for (let k = 0; k < FROTH_SEGS; k++) idx.push(0, at(1, k + 1), at(1, k));
  for (let r = 1; r < FROTH_RINGS; r++)
    for (let k = 0; k < FROTH_SEGS; k++) {
      // (odd rings are turned half a segment: a triangle strip without long slivers)
      const o = r % 2;
      idx.push(at(r, k), at(r, k + 1), at(r + 1, k + 1 - o), at(r, k), at(r + 1, k + 1 - o), at(r + 1, k - o));
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage));
  g.setAttribute('uv', new BufferAttribute(uv, 2).setUsage(DynamicDrawUsage));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return { geo: g, xz };
}

/** The froth's heights at film time t (in the balls' frame): the caps of the breathing bubbles, smooth-unioned over the dome. */
function frothHeights(froth: { geo: BufferGeometry; xz: Float32Array }, balls: FrothBall[], t: number): void {
  const pos = froth.geo.attributes.position as BufferAttribute;
  const uvA = froth.geo.attributes.uv as BufferAttribute;
  const P = pos.array as Float32Array;
  const U = uvA.array as Float32Array;
  const B = balls.map((b) => {
    const k = 1 + 0.12 * Math.sin(t * b.w + b.ph) + 0.05 * Math.sin(t * b.w * 2.3 + b.ph * 1.7);
    return { x: Math.cos(b.a) * b.d, z: Math.sin(b.a) * b.d, y: b.h + 0.004 * Math.sin(t * b.w * 0.7 + b.ph), r: b.r * k * 1.15, tint: b.tint };
  });
  const y0 = BREW_Y + LEG_H;
  const n = froth.xz.length / 2;
  for (let i = 0; i < n; i++) {
    const x = froth.xz[i * 2];
    const z = froth.xz[i * 2 + 1];
    const d = Math.hypot(x, z) / BREW_R;
    // the low dome under the foam; past the brew's edge the surface runs on inside the rolled
    // lip's iron (hidden), never out under it, so only the overflow bubbles' caps show over the rim
    // (the middle sinks under the brew's surface: only the foam ring shows, the brew glows bare)
    let h = d < 1 ? -0.012 + 0.014 * smoothstep(0.62, 0.86, d) : 0.004;
    let top = -1;
    let tint = 0.35;
    for (const c of B) {
      const dx = x - c.x;
      const dz = z - c.z;
      const q = c.r * c.r - dx * dx - dz * dz;
      if (q <= -c.r * c.r * 0.3) continue;
      const cap = c.y + (q > 0 ? Math.sqrt(q) * 0.55 : -Math.sqrt(-q) * 0.6);
      if (cap > top) {
        top = cap;
        tint = c.tint;
      }
      h = smax(h, cap, 0.006);
    }
    P[i * 3 + 1] = y0 + h;
    U[i * 2] = clamp01(0.15 + 0.6 * tint + 0.25 * smoothstep(0.0, 0.06, h));
    U[i * 2 + 1] = 0.5;
  }
  pos.needsUpdate = true;
  uvA.needsUpdate = true;
  froth.geo.computeVertexNormals();
}

/** Bubbles: each a seeded cycle (rise out of the froth, swell, pop, a fresh spot); foam at the rim. */
const BUBBLES = 5;
const FOAM = 16;
function bubbleAt(i: number, t: number, seed: number): { x: number; y: number; z: number; s: number } {
  const period = 1.6 + 1.7 * rand(seed, 'bp', i);
  const ph = t / period + rand(seed, 'bph', i);
  const cycle = Math.floor(ph);
  const u = ph - cycle;
  const a = rand(seed, 'ba', i * 97 + cycle) * TAU;
  const d = BREW_R * 0.78 * Math.sqrt(rand(seed, 'bd', i * 97 + cycle));
  const smax = 0.007 + 0.006 * rand(seed, 'bs', i * 97 + cycle);
  // swell out of the brew over the first 60 %, lift off and rise a little, pop (a few frames), then rest unseen
  const grow = smoothstep(0, 0.6, u);
  const rise = smoothstep(0.5, 0.9, u);
  const pop = 1 - smoothstep(0.9, 0.95, u);
  const s = smax * Math.sqrt(grow) * pop;
  return { x: Math.cos(a) * d, y: BREW_Y + LEG_H + domeAt(d) - s * 0.5 + s * 0.9 * grow + 0.05 * rise, z: Math.sin(a) * d, s };
}

/** Wisps of steam rising (STEAM), then the froth cloud lying on the brew (FROTH), one draw. */
const STEAM = 6;
const FROTH = 3;
function steamAt(i: number, t: number, seed: number): { x: number; y: number; z: number; size: number; alpha: number; rot: number; mix: number } {
  if (i >= STEAM) {
    // the froth: low, wide, glowing, turning slowly (never cycling)
    const k = i - STEAM;
    const a = (k / FROTH) * TAU + 0.3 * Math.sin(t * 0.21 + k);
    return {
      x: Math.cos(a) * BREW_R * 0.35,
      y: BREW_Y + LEG_H + 0.018 + 0.006 * Math.sin(t * 0.8 + k * 2),
      z: Math.sin(a) * BREW_R * 0.35,
      size: 0.22 + 0.03 * Math.sin(t * 0.6 + k * 1.3),
      alpha: 0.3 + 0.05 * Math.sin(t * 0.9 + k * 2.1),
      rot: t * 0.15 * (k % 2 ? 1 : -1) + k * 2.1,
      mix: 0.1,
    };
  }
  const life = 3.4 + 2.2 * rand(seed, 'sl', i);
  const ph = t / life + i / STEAM + 0.13 * rand(seed, 'sp', i);
  const cycle = Math.floor(ph);
  const u = ph - cycle;
  const a = rand(seed, 'sa', i * 31 + cycle) * TAU;
  const d = BREW_R * 0.6 * rand(seed, 'sd', i * 31 + cycle);
  // each wisp leans its own way as it rises, and curls
  const lean = rand(seed, 'slx', i * 31 + cycle) * TAU;
  const drift = 0.16 * u * (0.5 + 0.5 * rand(seed, 'sdr', i * 31 + cycle));
  const curl = 0.035 * Math.sin(t * 1.1 + i * 1.7 + u * 5) * u;
  return {
    x: Math.cos(a) * d + Math.cos(lean) * drift + curl,
    y: BREW_Y + LEG_H + 0.05 + (0.3 + 0.18 * rand(seed, 'sh', i * 31 + cycle)) * u,
    z: Math.sin(a) * d + Math.sin(lean) * drift,
    size: 0.08 + 0.2 * u,
    alpha: 0.34 * smoothstep(0, 0.2, u) * (1 - smoothstep(0.35, 1, u)),
    rot: rand(seed, 'sr', i * 31 + cycle) * TAU + u * 1.2 * (i % 2 ? 1 : -1),
    mix: u,
  };
}

const CAULDRON_SEED = 5;

export function Cauldron({ f }: { f: number }) {
  const built = useMemo(() => {
    const iron = cauldronIron(CAULDRON_SEED);
    const fire = cauldronFire(CAULDRON_SEED);
    const brew = brewDisc();
    const rest = Float32Array.from(brew.attributes.position.array as Float32Array);
    const swirl = swirlTexture();
    const ember = ramp([
      [0, '#000000'],
      [0.3, '#2a0602'],
      [0.7, '#8a1e06'],
      [1, '#e0520e'],
    ]);
    const crust = ramp([
      [0, '#4c2210'],
      [0.2, '#160803'],
      [0.46, '#000000'],
      [0.54, '#000000'],
      [0.8, '#1a2a46'],
      [1, '#4e6e9e'],
    ]);
    const bubbleGeo = new SphereGeometry(1, 10, 8);
    const bubbleMat = storybookMaterial({ color: '#12284c', emissive: '#a8d4ff', emissiveIntensity: 1.6, roughness: 0.2, rim: 0.3, ambient: 0, fog: 0.6, breakup: 0 });
    const bubbles = new InstancedMesh(bubbleGeo, bubbleMat, BUBBLES + FOAM);
    bubbles.instanceMatrix.setUsage(DynamicDrawUsage);
    bubbles.frustumCulled = false;
    const steamTex = steamTexture();
    const steam = billboards(STEAM + FROTH, steamTex, '#5fe4f4', '#9cc8dc', 1.8);
    const balls = frothBalls(CAULDRON_SEED);
    const froth = frothGeometry();
    const frothRamp = ramp([
      [0, '#2a64b8'],
      [0.45, '#4aa0f0'],
      [0.8, '#94d4f8'],
      [1, '#d0f2ff'],
    ]);
    // one soft halo over the pot: the brew's glow in the haze
    const haloTex = glowTexture();
    const halo = billboards(1, haloTex, '#5a9cff', '#8ff0ff', 2.2);
    return {
      iron,
      fire,
      brew,
      balls,
      froth,
      frothRamp,
      haloTex,
      halo,
      frothMat: storybookMaterial({ color: '#16264a', emissive: '#ffffff', emissiveMap: frothRamp, emissiveIntensity: 1.5, roughness: 0.5, rim: 0.25, ambient: 0, fog: 0.6, breakup: 0 }),
      rest,
      swirl,
      ember,
      crust,
      bubbleGeo,
      bubbleMat,
      bubbles,
      steam,
      steamTex,
      // matte cast iron: no glint (the rim reads by the moon's rim light, not a specular hit)
      ironMat: storybookMaterial({ kind: 'iron', vertexColors: true, color: '#ffffff', color2: '#3a3a44', breakup: 0.35, scale: 0.03, bump: 1.4, rim: 1.2, roughness: 0.6, metalness: 0, emissive: '#ffffff', emissiveMap: crust, emissiveIntensity: 1.25 }),
      fireMat: storybookMaterial({ kind: 'bark', vertexColors: true, color: '#ffffff', color2: '#2a2422', breakup: 0.3, scale: 0.03, bump: 1.2, rim: 0.6, roughness: 0.95, emissive: '#ffffff', emissiveMap: ember, emissiveIntensity: 0.9 }),
      brewMat: storybookMaterial({ color: '#0c2a30', emissive: '#ffffff', emissiveMap: swirl, emissiveIntensity: 3.2, roughness: 0.55, rim: 0, ambient: 0, fog: 0.6, breakup: 0 }),
    };
  }, []);
  useLayoutEffect(
    () => () => {
      for (const k of ['iron', 'fire', 'brew', 'bubbleGeo'] as const) built[k].dispose();
      for (const k of ['swirl', 'ember', 'crust', 'steamTex', 'frothRamp', 'haloTex'] as const) built[k].dispose();
      for (const k of ['ironMat', 'fireMat', 'brewMat', 'bubbleMat', 'frothMat'] as const) built[k].dispose();
      built.froth.geo.dispose();
      for (const k of ['geo', 'base', 'mat'] as const) built.halo[k].dispose();
      built.bubbles.dispose();
      built.steam.geo.dispose();
      built.steam.base.dispose();
      built.steam.mat.dispose();
    },
    [built],
  );
  const t = f / FPS;
  useLayoutEffect(() => {
    // the brew heaves gently (slow waves from the frame), the bubbles, the foam, the steam
    const p = built.brew.attributes.position as BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = built.rest[i * 3];
      const z = built.rest[i * 3 + 2];
      const r = Math.hypot(x, z) / BREW_R;
      p.setY(i, 0.006 * (1 - r * r) + 0.0025 * Math.sin(t * 1.3 + x * 60) * Math.sin(t * 0.9 + z * 50) * (1 - r));
    }
    p.needsUpdate = true;
    built.brew.computeVertexNormals();
    const m = new Matrix4();
    const q = new Quaternion();
    for (let i = 0; i < BUBBLES; i++) {
      const b = bubbleAt(i, t, CAULDRON_SEED);
      m.compose(new Vector3(b.x, b.y, b.z), q, new Vector3(b.s, b.s * 0.85, b.s));
      built.bubbles.setMatrixAt(i, m);
    }
    for (let i = 0; i < FOAM; i++) {
      const a = (i / FOAM) * TAU + 0.4 * rand(CAULDRON_SEED, 'fa', i);
      const s = (0.006 + 0.006 * rand(CAULDRON_SEED, 'fs', i)) * (0.85 + 0.15 * Math.sin(t * 1.7 + i * 2.3));
      const d = BREW_R * (0.9 + 0.08 * rand(CAULDRON_SEED, 'fd', i));
      m.compose(new Vector3(Math.cos(a) * d, BREW_Y + LEG_H + 0.003, Math.sin(a) * d), q, new Vector3(s * 1.3, s * 0.6, s * 1.3));
      built.bubbles.setMatrixAt(BUBBLES + i, m);
    }
    built.bubbles.instanceMatrix.needsUpdate = true;
    const sp = built.steam.pos;
    const sd = built.steam.data;
    for (let i = 0; i < STEAM + FROTH; i++) {
      const s = steamAt(i, t, CAULDRON_SEED);
      sp.setXYZ(i, s.x, s.y, s.z);
      sd.setXYZW(i, s.size, s.alpha, s.rot, s.mix);
    }
    sp.needsUpdate = true;
    sd.needsUpdate = true;
    built.fireMat.emissiveIntensity = 0.9 * (1 + 0.1 * Math.sin(t * 2.1) + 0.06 * Math.sin(t * 3.7 + 1));
    // the froth breathes: each bubble's cap swells and settles on its own slow sines (the mesh turns with them)
    {
      frothHeights(built.froth, built.balls, t);
      built.froth.geo.computeBoundingSphere();
      built.halo.pos.setXYZ(0, 0, BREW_Y + LEG_H + 0.07, 0);
      built.halo.data.setXYZW(0, 0.85 + 0.04 * Math.sin(t * 0.8), 0.32 + 0.03 * Math.sin(t * 1.3), 0, 0.5 + 0.3 * Math.sin(t * 0.4));
      built.halo.pos.needsUpdate = true;
      built.halo.data.needsUpdate = true;
    }
  }, [built, t]);
  const C = LAND.cauldron;
  // its feet into the lowest ground under them
  let g0 = gy(C.x, C.z);
  for (let k = 0; k < 6; k++) g0 = Math.min(g0, gy(C.x + Math.cos(k) * 0.15, C.z + Math.sin(k) * 0.15));
  return (
    <group position={[C.x, g0 - 0.006, C.z]} rotation-y={C.yaw ?? 0}>
      <mesh geometry={built.iron} material={built.ironMat} castShadow receiveShadow />
      <mesh geometry={built.fire} material={built.fireMat} receiveShadow />
      <mesh geometry={built.brew} material={built.brewMat} position-y={BREW_Y + LEG_H} rotation-y={t * 0.05} />
      <primitive object={built.bubbles} />
      <mesh geometry={built.froth.geo} material={built.frothMat} rotation-y={-0.05 * t} frustumCulled={false} />
      <mesh geometry={built.halo.geo} material={built.halo.mat} frustumCulled={false} renderOrder={3} />
      <mesh geometry={built.steam.geo} material={built.steam.mat} frustumCulled={false} renderOrder={3} />
    </group>
  );
}

// ---- the coffin, its planks and the shovel ------------------------------------------------------

/**
 * The coffin's place: behind the path's front run, in front of the cross and the graves, lying
 * across the hero view (world x, z, yaw), the shovel stuck at its left end (as the reference's
 * coffin and shovel lie beside the walker's path).
 */
export const COFFIN = { x: LAND.coffin.x, z: LAND.coffin.z, yaw: LAND.coffin.yaw ?? 0 };
/**
 * The coffin's scale: built at a person's size, drawn at Clawd's (0.4 tall with his hat): the
 * coffin 0.48 long, about 1.2 x his height, the shovel 0.42 tall, about his height (the reference's
 * proportions to the walker).
 */
const KS = 0.65;
/**
 * The camera clearance the coffin, its planks, the mound and the shovel need, for film/journey.ts
 * CAMERA_OBSTACLES: a plan circle (measured from the built geometry's extent, propsStats) and its
 * height above the ground (the shovel's grip).
 */
export const COFFIN_FOOTPRINT = { x: COFFIN.x - 0.05, z: COFFIN.z + 0.01, r: 0.46, h: 0.45 };

/**
 * A plank along local x (length len, height h along y, thickness t along z): a chamfered section
 * swept along x in segments, bowed, twisted and chipped at the ends; flat-shaded facets.
 */
function plank(len: number, h: number, t: number, seed: number, o: { bow?: number; twist?: number; chip?: number } = {}): BufferGeometry {
  const { bow = 0.004, twist = 0.03, chip = 0.3 } = o;
  const c = Math.min(h, t) * 0.28;
  // the section (y, z), chamfered corners
  const sec: [number, number][] = [
    [h / 2 - c, t / 2],
    [-h / 2 + c, t / 2],
    [-h / 2, t / 2 - c],
    [-h / 2, -t / 2 + c],
    [-h / 2 + c, -t / 2],
    [h / 2 - c, -t / 2],
    [h / 2, -t / 2 + c],
    [h / 2, t / 2 - c],
  ];
  const S = 6;
  const r = (k: number) => rand(seed, 'plank', k);
  const b = (r(1) - 0.5) * 2 * bow;
  const tw = (r(2) - 0.5) * 2 * twist;
  // ends cut a little off square, and chipped
  const end0 = (r(3) - 0.5) * 0.02;
  const end1 = (r(4) - 0.5) * 0.02;
  const ring = (i: number): V3[] => {
    const u = i / S;
    return sec.map(([y, z], j) => {
      let x = -len / 2 + len * u;
      if (i === 0) x += end0 * (y / h) + (r(10 + j) < chip ? 0.012 * r(20 + j) : 0);
      if (i === S) x += end1 * (y / h) - (r(30 + j) < chip ? 0.012 * r(40 + j) : 0);
      const a = tw * (u - 0.5);
      const yy = y * Math.cos(a) - z * Math.sin(a) + b * (1 - (2 * u - 1) ** 2);
      const zz = y * Math.sin(a) + z * Math.cos(a);
      return [x, yy, zz];
    });
  };
  const rings = Array.from({ length: S + 1 }, (_, i) => ring(i));
  const pos: number[] = [];
  const tri = (a: V3, bb: V3, cc: V3) => pos.push(...a, ...bb, ...cc);
  const n = sec.length;
  for (let i = 0; i < S; i++)
    for (let j = 0; j < n; j++) {
      const a = rings[i][j];
      const bb = rings[i][(j + 1) % n];
      const cc = rings[i + 1][(j + 1) % n];
      const d = rings[i + 1][j];
      tri(a, bb, cc);
      tri(a, cc, d);
    }
  // end caps
  for (let j = 1; j < n - 1; j++) {
    tri(rings[0][0], rings[0][j + 1], rings[0][j]);
    tri(rings[S][0], rings[S][j], rings[S][j + 1]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return g;
}

/** The coffin's outline (local x along it, z across): head, shoulders, foot. */
const OUTLINE: [number, number][] = [
  [-0.37, -0.095],
  [-0.2, -0.145],
  [0.37, -0.078],
  [0.37, 0.078],
  [-0.2, 0.145],
  [-0.37, 0.095],
];
const BOX_H = 0.17;
const BOARD_T = 0.017;

interface Placed {
  geo: BufferGeometry;
  m: Matrix4;
  /** per-plank colour jitter (value, warmth) */
  tone: [number, number];
  /** a lid board: bleached paler on top by the weather */
  lid?: boolean;
}

function coffinParts(seed: number): { wood: Placed[]; nails: Matrix4[] } {
  const wood: Placed[] = [];
  const nails: Matrix4[] = [];
  const r = (k: number | string, j = 0) => rand(seed, k, j);
  const tone = (k: number): [number, number] => [0.78 + 0.4 * r('tv', k), r('tw', k)];
  let k = 0;
  // the six sides, two boards each, overlapping at the corners
  for (let e = 0; e < OUTLINE.length; e++) {
    const A = OUTLINE[e];
    const B = OUTLINE[(e + 1) % OUTLINE.length];
    const dx = B[0] - A[0];
    const dz = B[1] - A[1];
    const len = Math.hypot(dx, dz) + BOARD_T * 0.8;
    const yaw = -Math.atan2(dz, dx);
    // outward normal (the outline runs clockwise seen from above: outward is to the edge's left)
    const nx = -dz / Math.hypot(dx, dz);
    const nz = dx / Math.hypot(dx, dz);
    const sgn = (A[0] + B[0]) * nx + (A[1] + B[1]) * nz > 0 ? 1 : -1;
    const cx = (A[0] + B[0]) / 2 - sgn * nx * BOARD_T * 0.5;
    const cz = (A[1] + B[1]) / 2 - sgn * nz * BOARD_T * 0.5;
    for (let row = 0; row < 2; row++) {
      const h = BOX_H / 2 - 0.004;
      const y = 0.02 + h / 2 + row * (BOX_H / 2) + (r('ry', k) - 0.5) * 0.004;
      const g = plank(len, h, BOARD_T, seed * 100 + k, { bow: 0.003, twist: 0.04 });
      const m = new Matrix4().makeRotationY(yaw).setPosition(cx, y, cz);
      m.multiply(new Matrix4().makeRotationX((r('tilt', k) - 0.5) * 0.05));
      wood.push({ geo: g, m, tone: tone(k) });
      // nails at both ends of the board
      // nails at both ends of the board, hammered in a little unevenly (one sometimes missing)
      for (const end of [-1, 1]) {
        if (r('nm', k * 2 + end) < 0.12) continue;
        const nm = m.clone().multiply(new Matrix4().makeTranslation(end * (len / 2 - 0.014 - 0.012 * r('nx', k * 2 + end)), (r('ny', k * 2 + end) - 0.5) * h * 0.5, sgn * BOARD_T * 0.55));
        nails.push(nm);
      }
      k++;
    }
  }
  // the floor (dark inside)
  {
    const g = plank(0.72, BOARD_T, 0.26, seed * 100 + 90, { bow: 0, twist: 0 });
    g.rotateX(Math.PI / 2);
    wood.push({ geo: g, m: new Matrix4().makeTranslation(0, 0.02, 0), tone: [0.35, 0.5] });
  }
  // the lid: three boards on two battens, slid toward the foot and skewed, the foot end dipping
  const lid = new Matrix4().makeTranslation(0.17, BOX_H + 0.02 + BOARD_T / 2 + 0.004, 0.03).multiply(new Matrix4().makeRotationY(-0.24)).multiply(new Matrix4().makeRotationZ(-0.07));
  const widths = [0.088, 0.094, 0.086];
  let z0 = -0.134;
  for (let i = 0; i < 3; i++) {
    const w = widths[i];
    const zc = z0 + w / 2;
    z0 += w + 0.003;
    const len = 0.74 - Math.abs(zc) * 1.4 + (r('ll', i) - 0.5) * 0.03;
    const g = plank(len, BOARD_T, w, seed * 100 + 50 + i, { bow: 0.002, twist: 0.02, chip: 0.5 });
    const m = lid.clone().multiply(new Matrix4().makeTranslation((r('lx', i) - 0.5) * 0.02, 0, zc));
    wood.push({ geo: g, m, tone: tone(50 + i), lid: true });
    for (const end of [-1, 1]) nails.push(m.clone().multiply(new Matrix4().makeTranslation(end * (len / 2 - 0.035 - 0.03 * r('lnx', i * 2 + end)), BOARD_T * 0.55, (r('lnz', i * 2 + end) - 0.5) * w * 0.5).multiply(new Matrix4().makeRotationX(Math.PI / 2))));
  }
  for (const bx of [-0.2, 0.18]) {
    const g = plank(0.24, BOARD_T, 0.05, seed * 100 + 60 + Math.round(bx * 10), { bow: 0, twist: 0 });
    g.rotateY(Math.PI / 2);
    wood.push({ geo: g, m: lid.clone().multiply(new Matrix4().makeTranslation(bx, -BOARD_T, 0)), tone: tone(60), lid: true });
  }
  // loose planks on the ground: one leaning on the side, two lying, one broken short
  const loose: { x: number; z: number; yaw: number; len: number; tilt: number; y: number; roll?: number }[] = [
    { x: 0.05, z: 0.25, yaw: 0.12, len: 0.6, tilt: 0.0, y: 0.009 },
    { x: -0.12, z: 0.3, yaw: -0.35, len: 0.44, tilt: 0.04, y: 0.026 },
    { x: 0.5, z: 0.14, yaw: 1.1, len: 0.34, tilt: 0.0, y: 0.009 },
    { x: 0.08, z: -0.2, yaw: 0.05, len: 0.62, tilt: 0.0, y: 0.06, roll: 1.05 },
  ];
  loose.forEach((p, i) => {
    const g = plank(p.len, BOARD_T, 0.085, seed * 100 + 70 + i, { bow: 0.003, chip: 0.6 });
    const m = new Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new Matrix4().makeRotationY(p.yaw)).multiply(new Matrix4().makeRotationZ(p.tilt)).multiply(new Matrix4().makeRotationX(p.roll ?? 0));
    wood.push({ geo: g, m, tone: tone(70 + i), lid: true });
    if (i !== 2) nails.push(m.clone().multiply(new Matrix4().makeTranslation(p.len / 2 - 0.03, BOARD_T * 0.55, 0.02).multiply(new Matrix4().makeRotationX(Math.PI / 2))));
  });
  return { wood, nails };
}

/** The shovel (local: the blade's top centre at the origin, the shaft up +y): blade, socket, shaft, D-handle. */
function shovelParts(): { iron: BufferGeometry; wood: BufferGeometry } {
  // the blade: a dished spade, its tip rounded to a point
  const W = 0.068;
  const Hh = 0.17;
  const cols = 8;
  const rows = 10;
  const pos: number[] = [];
  const pt = (i: number, j: number, side: number): V3 => {
    const v = j / rows;
    const hw = W * (1 - 0.18 * v) * Math.sqrt(Math.max(0, 1 - Math.max(0, (v - 0.55) / 0.45) ** 1.6));
    const x = (-1 + (2 * i) / cols) * hw;
    const y = -Hh * v;
    const dish = 0.012 * (1 - (x / W) ** 2);
    return [x, y, dish + side * 0.003];
  };
  for (const side of [1, -1])
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = pt(i, j, side);
        const b = pt(i + 1, j, side);
        const c = pt(i + 1, j + 1, side);
        const d = pt(i, j + 1, side);
        if (side > 0) pos.push(...a, ...d, ...c, ...a, ...c, ...b);
        else pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
  // the edges between the two faces
  for (let j = 0; j < rows; j++)
    for (const i of [0, cols]) {
      const a = pt(i, j, 1);
      const b = pt(i, j + 1, 1);
      const c = pt(i, j + 1, -1);
      const d = pt(i, j, -1);
      if (i === 0) pos.push(...a, ...d, ...c, ...a, ...c, ...b);
      else pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  const blade = new BufferGeometry();
  blade.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  blade.computeVertexNormals();
  // the tread rolled along the blade's top, and the socket up the shaft
  const tread = tubeGeometry({ points: [[-W, 0.002, 0.006], [0, 0.004, 0.009], [W, 0.002, 0.006]], segments: 10, sides: 6, radius: () => 0.006, color: () => [1, 1, 1, 0.6] });
  const socket = tubeGeometry({ points: [[0, -0.02, 0.008], [0, 0.03, 0.008], [0, 0.07, 0.008]], segments: 6, sides: 8, closeEnd: true, radius: (t) => 0.017 - 0.004 * t, color: () => [1, 1, 1, 0.7] });
  const iron = mergeGeometries([tidy(blade), tidy(tread), tidy(socket)], false);
  // the shaft and the D-handle
  const L = 0.5;
  const shaft = tubeGeometry({ points: [[0, 0.05, 0.008], [0.002, L * 0.5, 0.008], [0, L, 0.008]], segments: 10, sides: 8, radius: () => 0.0125, color: () => [1, 1, 1, 0.7] });
  // a T grip across the top of the shaft
  const d = tubeGeometry({ points: [[-0.055, L + 0.012, 0.008], [0, L + 0.016, 0.008], [0.055, L + 0.012, 0.008]], segments: 8, sides: 7, closeEnd: true, radius: () => 0.0135, color: () => [1, 1, 1, 0.5] });
  const wood = mergeGeometries([tidy(shaft), tidy(d)], false);
  return { iron, wood };
}

/** The dirt mound the shovel stands in: a lumpy heap with a few clods, its base below the ground. */
function moundGeometry(seed: number): BufferGeometry {
  const g = new SphereGeometry(1, 28, 12, 0, TAU, 0, Math.PI * 0.62);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = 1 + 0.22 * fbm3(x * 2.2, y * 2.2, z * 2.2, seed, 3);
    p.setXYZ(i, x * 0.27 * n, (y - 0.32) * 0.16 * n, z * 0.2 * n);
  }
  g.computeVertexNormals();
  const parts = [tidy(g)];
  for (let k = 0; k < 7; k++) {
    const a = rand(seed, 'clod', k) * TAU;
    const d = 0.2 + 0.07 * rand(seed, 'cd', k);
    const s = 0.018 + 0.02 * rand(seed, 'cs', k);
    const c = new IcosahedronGeometry(s, 0);
    c.scale(1, 0.7, 1);
    c.translate(Math.cos(a) * d, s * 0.2, Math.sin(a) * d * 0.8);
    parts.push(tidy(c));
  }
  const m = mergeGeometries(parts, false);
  parts.forEach((q) => q.dispose());
  return m;
}

/**
 * Weathered wood grain (drawn once, seeded): long streaks along u with darker growth lines that
 * wander, a few checks (thin dark cracks) and knots; mid-grey around 1 so it multiplies the paint.
 */
function grainTexture(): CanvasTexture {
  const W = 512;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      // the rings wander along the board; the stripes are their crossing
      const wob = 0.035 * Math.sin(u * TAU * 2 + 1.3) + 0.02 * (fbm3(u * 6, v * 2, 0.5, 61, 2) - 0.5);
      const ring = 0.5 + 0.5 * Math.sin((v + wob) * TAU * 9 + 2 * fbm3(u * 3, v * 9, 1.5, 62, 2));
      const streak = fbm3(u * 40, v * 3, 2.5, 63, 3);
      const check = smoothstep(0.9, 0.97, noise3(u * 3, v * 60, 3.5, 64)) * smoothstep(0.3, 0.6, noise3(u * 12, v * 4, 4.5, 65));
      const k = clamp01(0.98 - 0.24 * Math.pow(ring, 3) - 0.22 * (streak - 0.5) - 0.45 * check);
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * k);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Wood uv for the grain map (a board's own frame: x along it, its section across). */
function woodUV(g: BufferGeometry, seed: number, along: 'x' | 'y' = 'x') {
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    uv[i * 2] = (along === 'x' ? x : y) * 2.2 + seed * 0.37;
    uv[i * 2 + 1] = (along === 'x' ? y + z : x + z) * 7 + seed * 0.13;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
}

/** The world matrix of a point of the coffin's local frame, sat on the ground (tilted with it). */
function coffinFrame(): Matrix4 {
  const { x, z, yaw } = COFFIN;
  const e = 0.3;
  const sx = (groundHeight(x + e, z) - groundHeight(x - e, z)) / (2 * e);
  const sz = (groundHeight(x, z + e) - groundHeight(x, z - e)) / (2 * e);
  let low = Infinity;
  for (const [ox, oz] of OUTLINE) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    low = Math.min(low, gy(x + ox * KS * c + oz * KS * s, z - ox * KS * s + oz * KS * c));
  }
  const up = new Vector3(-sx, 1, -sz).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), up).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw));
  return new Matrix4().compose(new Vector3(x, low - 0.018 * KS, z), q, new Vector3(KS, KS, KS));
}

/** Where the mound and the shovel stand, coffin-local: by the head end, behind it (up the slope). */
const MOUND = { x: -0.46, z: -0.22 };

/** The coffin, its planks, the shovel and the mound, in world space: wood, iron, earth. */
export function coffinGeometry(): { wood: BufferGeometry; iron: BufferGeometry; mound: BufferGeometry } {
  const F = coffinFrame();
  const { wood, nails } = coffinParts(23);
  const weather = lin('#8e7f6a');
  const bleach = lin('#dcd2be');
  const grey = lin('#9a9c98');
  const moss = lin('#4a5a44');
  // the coffin's boards, painted per board in its own frame (x along it): weathered grey-brown
  // with long grain streaks and a knot or two, the lid bleached pale on top; then placed
  const woodGeos: BufferGeometry[] = [];
  wood.forEach((p, bi) => {
    const g = p.geo;
    const [tv, tw] = p.tone;
    paint(g, (x, y, z) => {
      const grain = noise3(x * 4 + bi * 3.1, y * 140 + z * 140, bi * 1.7, 31) - 0.5;
      const fine = noise3(x * 11, y * 400 + z * 400, bi * 2.3, 32) - 0.5;
      const knot = smoothstep(0.82, 0.92, noise3(x * 18 + bi, y * 30, z * 30, 33));
      const base = p.lid ? bleach.clone().lerp(weather, 0.25 + 0.25 * (1 - tv)) : weather.clone().lerp(grey, 0.25 + 0.3 * tw);
      const k = tv * (1 + 0.42 * grain + 0.16 * fine) * (1 - 0.5 * knot) * (1 - 0.25 * smoothstep(0.3, 0.5, Math.abs(x) / 0.4));
      return [base.r * k * (0.96 + 0.08 * tw) * 1.15, base.g * k * 1.15, base.b * k * (1.04 - 0.08 * tw) * 1.15, 0.7, 0];
    });
    woodUV(g, bi);
    g.applyMatrix4(new Matrix4().multiplyMatrices(F, p.m));
    woodGeos.push(g);
  });
  // the shovel, in the mound at the head end: leaning toward the coffin and the path
  const sh = shovelParts();
  const mx = MOUND.x;
  const mz = MOUND.z;
  const shovelM = new Matrix4().makeTranslation(mx + 0.02, 0.17, mz).multiply(new Matrix4().makeRotationY(0.5)).multiply(new Matrix4().makeRotationZ(-0.2)).multiply(new Matrix4().makeRotationX(0.1));
  sh.wood.applyMatrix4(new Matrix4().multiplyMatrices(F, shovelM));
  sh.iron.applyMatrix4(new Matrix4().multiplyMatrices(F, shovelM));
  const shaft = tidy(sh.wood);
  paint(shaft, (x, y, z) => {
    const n = noise3(x * 300, y * 8, z * 300, 34) - 0.5;
    const k = 0.75 * (1 + 0.3 * n);
    return [weather.r * k * 0.9, weather.g * k * 0.85, weather.b * k * 0.8, 0.5, 0];
  });
  woodUV(shaft, 99, 'y');
  const woodAll = mergeGeometries([...woodGeos, shaft], false);
  woodGeos.forEach((g) => g.dispose());
  shaft.dispose();
  const ground = (x: number, z: number) => gy(x, z);
  // contact: darker and mossy where the boards meet the ground
  {
    const p = woodAll.attributes.position;
    const col = woodAll.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const h = p.getY(i) - ground(p.getX(i), p.getZ(i));
      const ao = 0.5 + 0.5 * smoothstep(0.0, 0.05, h);
      const m = smoothstep(0.035, 0.0, h) * 0.5;
      col.setXYZ(i, (col.getX(i) + (moss.r - col.getX(i)) * m) * ao, (col.getY(i) + (moss.g - col.getY(i)) * m) * ao, (col.getZ(i) + (moss.b - col.getZ(i)) * m) * ao);
    }
  }
  // iron: the nails (small square heads) and the shovel's blade
  const nailGeos = nails.map((m) => {
    const g = new IcosahedronGeometry(0.0075, 0);
    g.scale(1, 1, 0.5);
    g.applyMatrix4(new Matrix4().multiplyMatrices(F, m));
    return tidy(g);
  });
  const ironAll = mergeGeometries([...nailGeos, tidy(sh.iron)], false);
  nailGeos.forEach((g) => g.dispose());
  const rust = lin('#5a3424');
  const steel = lin('#5a5e66');
  paint(ironAll, (x, y, z) => {
    const n = noise3(x * 40, y * 40, z * 40, 7);
    const c = steel.clone().lerp(rust, smoothstep(0.3, 0.7, n));
    const k = 0.6 + 0.4 * smoothstep(0.0, 0.05, y - ground(x, z));
    return [c.r * k, c.g * k, c.b * k, 0.8, 0];
  });
  // the mound
  const mound = moundGeometry(29);
  mound.applyMatrix4(new Matrix4().multiplyMatrices(F, new Matrix4().makeTranslation(mx, 0.005, mz).multiply(new Matrix4().makeRotationY(0.4))));
  const dirt = lin('#4a3530');
  const dark = lin('#241a1a');
  paint(mound, (x, y, z) => {
    const h = y - ground(x, z);
    const n = fbm3(x * 20, y * 20, z * 20, 33, 3) * 0.5 + 0.5;
    const c = dark.clone().lerp(dirt, smoothstep(0.0, 0.08, h) * (0.6 + 0.4 * n));
    return [c.r, c.g, c.b, 0.6, 0];
  });
  return { wood: woodAll, iron: ironAll, mound };
}

export function Coffin() {
  const built = useMemo(() => {
    const { wood: woodAll, iron: ironAll, mound } = coffinGeometry();
    const grain = grainTexture();
    return {
      grain,
      wood: woodAll,
      iron: ironAll,
      mound,
      woodMat: storybookMaterial({ kind: 'wood', vertexColors: true, color: '#ffffff', map: grain, color2: '#93abb6', breakup: 0.3, scale: 0.06, bump: 1.1, rim: 0.8, topCoat: 0.45, roughness: 0.9 }),
      ironMat: storybookMaterial({ kind: 'iron', vertexColors: true, color: '#ffffff', breakup: 0.25, scale: 0.02, bump: 0.8, rim: 1.0, roughness: 0.55, metalness: 0.25, side: DoubleSide }),
      earthMat: storybookMaterial({ kind: 'earth', vertexColors: true, color: '#ffffff', color2: '#2a2124', breakup: 0.3, scale: 0.04, bump: 1.1, rim: 0.5, roughness: 0.95 }),
    };
  }, []);
  useLayoutEffect(
    () => () => {
      built.wood.dispose();
      built.iron.dispose();
      built.mound.dispose();
      built.woodMat.dispose();
      built.ironMat.dispose();
      built.earthMat.dispose();
      built.grain.dispose();
    },
    [built],
  );
  return (
    <>
      <mesh geometry={built.wood} material={built.woodMat} castShadow receiveShadow />
      <mesh geometry={built.iron} material={built.ironMat} castShadow />
      <mesh geometry={built.mound} material={built.earthMat} castShadow receiveShadow />
    </>
  );
}

// ---- fireflies ----------------------------------------------------------------------------------

const FIREFLIES = 34;
/** how many of them hang about the lamp posts */
const LAMP_WISPS = 8;
interface Fly {
  bx: number;
  bz: number;
  h: number;
  ph: number[];
  amp: number;
  period: number;
  green: boolean;
  size: number;
}

/**
 * Seeded homes over the graveyard (front and slope) and along the lane, and a few cyan wisps
 * clustered round each lamp post's glass (the reference's will-o'-wisps by the lamps).
 */
function flies(): Fly[] {
  const out: Fly[] = [];
  for (let i = 0; i < FIREFLIES; i++) {
    const r = (k: number) => rand(91, i, k);
    const lamp = i < LAMP_WISPS ? LAMPS[i % LAMPS.length] : null;
    if (lamp) {
      const a = r(0) * TAU;
      const d = 0.12 + 0.3 * r(1);
      out.push({ bx: lamp.x + Math.cos(a) * d, bz: lamp.z + Math.sin(a) * d, h: 0.75 + 0.55 * r(2), ph: [0, 1, 2, 3, 4, 5].map((k) => r(10 + k) * TAU), amp: 0.06 + 0.1 * r(3), period: 4 + 4 * r(4), green: false, size: 0.05 + 0.04 * r(6) });
      continue;
    }
    const lane = i % 3 === 2;
    const bx = lane ? 1.3 + 2.9 * r(0) : -2.6 + 5.0 * r(0);
    const bz = lane ? -1.75 + 0.75 * r(1) : -0.4 + 2.9 * r(1);
    out.push({ bx, bz, h: 0.18 + 0.55 * r(2), ph: [0, 1, 2, 3, 4, 5].map((k) => r(10 + k) * TAU), amp: 0.12 + 0.18 * r(3), period: 5 + 5 * r(4), green: r(5) < 0.6, size: 0.064 + 0.05 * r(6) });
  }
  return out;
}

/** A firefly's place, glow and colour at film time t. */
export function fireflyAt(fl: Fly, t: number): { x: number; y: number; z: number; alpha: number; size: number } {
  const x = fl.bx + fl.amp * Math.sin(0.31 * t + fl.ph[0]) + 0.4 * fl.amp * Math.sin(0.83 * t + fl.ph[1]);
  const z = fl.bz + fl.amp * Math.sin(0.27 * t + fl.ph[2]) + 0.4 * fl.amp * Math.sin(0.71 * t + fl.ph[3]);
  const y = FLOOR + groundHeight(x, z) + fl.h + 0.07 * Math.sin(0.47 * t + fl.ph[4]) + 0.03 * Math.sin(1.3 * t + fl.ph[5]);
  const pulse = 0.5 + 0.5 * Math.sin((TAU * t) / fl.period + fl.ph[1]);
  const alpha = smoothstep(0.15, 0.85, pulse) * (0.85 + 0.15 * Math.sin(t * 2.3 + fl.ph[2]));
  return { x, y, z, alpha, size: fl.size * (0.85 + 0.15 * pulse) };
}

export function Fireflies({ f }: { f: number }) {
  const built = useMemo(() => {
    const tex = glowTexture();
    const b = billboards(FIREFLIES, tex, '#b4ff5c', '#6ef2ff', 2.4);
    return { tex, b, flies: flies() };
  }, []);
  useLayoutEffect(
    () => () => {
      built.tex.dispose();
      built.b.geo.dispose();
      built.b.base.dispose();
      built.b.mat.dispose();
    },
    [built],
  );
  const t = f / FPS;
  useLayoutEffect(() => {
    built.flies.forEach((fl, i) => {
      const p = fireflyAt(fl, t);
      built.b.pos.setXYZ(i, p.x, p.y, p.z);
      built.b.data.setXYZW(i, p.size, p.alpha, 0, fl.green ? 0 : 1);
    });
    built.b.pos.needsUpdate = true;
    built.b.data.needsUpdate = true;
  }, [built, t]);
  return <mesh geometry={built.b.geo} material={built.b.mat} frustumCulled={false} renderOrder={4} />;
}

/** Triangle counts of the props' static geometry (for the budget). */
export function propsStats(): Record<string, number> {
  const tri = (g: BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  const parts = coffinParts(23);
  const sh = shovelParts();
  return {
    cauldronIron: tri(cauldronIron(CAULDRON_SEED)),
    cauldronFire: tri(cauldronFire(CAULDRON_SEED)),
    brew: tri(brewDisc()),
    bubbles: (BUBBLES + FOAM) * tri(new SphereGeometry(1, 10, 8)),
    froth: tri(frothGeometry().geo),
    steam: (STEAM + FROTH) * 2,
    coffinWood: parts.wood.reduce((a, p) => a + tri(p.geo), 0) + tri(sh.wood),
    coffinIron: parts.nails.length * 20 + tri(sh.iron),
    mound: tri(moundGeometry(29)),
    fireflies: FIREFLIES * 2,
  };
}
