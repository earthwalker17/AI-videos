/**
 * The V2 desk the closed storybook lies on (the opening and the end): old dark planks with grain,
 * worn edges and wax stains, a candle in a brass chamberstick, a small jack-o'-lantern, an
 * inkwell with a quill, a few dry leaves; and the room's light, which is not a three light but a
 * shading layer over the storybook material (`roomMaterial`):
 *  - moonlight through a gothic window projected across the desk and the book: a window-shaped
 *    cookie (two lancets with lead cames, a transom, a quatrefoil) evaluated in world space along
 *    the light's direction, with soft shadows marched through an analytic scene (the book's
 *    block, its cover at its current angle, capsules round the candle, the pumpkin, the inkwell
 *    and the quill) and the lightning as two soft pulses of it ('lightning');
 *  - the candles' warm glow (the chamberstick's flame and the jack-o'-lantern's), flickering
 *    smoothly on ones; plus contact darkening on the desk near everything standing on it.
 * Both go through three's own RE_Direct (the physical BRDF: brass and the gold foil glint), so
 * the light count stays fixed. Everything is a pure function of the frame.
 *
 * Proportions: the book is 16 wide and the candle with its holder about 1.6 tall (a giant
 * storybook, or a tiny world in a big room): one world unit is about 9 cm of the room.
 */
import { rand } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  LatheGeometry,
  LinearSRGBColorSpace,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  Vector4,
  type MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { at, cue, FPS } from '../cues.ts';
import { gridGeometry, tubeAlong, type V3 } from '../kit/book.ts';
import { fbm2 } from '../kit/field.ts';
import { NOISE3_GLSL } from '../look/glsl.ts';
import { NIGHT, storybookMaterial, type Paint } from '../look/materials.ts';
import { canvas, seq } from '../look/paper.ts';
import { BOOK, FLOOR } from './layout.ts';
import { candleFlicker, Pumpkin } from './Pumpkins.tsx';

const TAU = Math.PI * 2;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---- the room's light ----------------------------------------------------------------------------

/**
 * toward the window (the moon through it): high on the left, a little toward the opening's camera,
 * 38° up, so the beam crosses the frame from its upper left and the fore-edge takes the light
 */
const WIN_L = new Vector3(-0.62, 0.62, 0.48).normalize();
const WIN_U = new Vector3().crossVectors(new Vector3(0, 1, 0), WIN_L).normalize();
const WIN_V = new Vector3().crossVectors(WIN_L, WIN_U).normalize();
/** the window's light and the lightning's */
const WIN_COLOR = new Color('#a2c2e6');
const BOLT_COLOR = new Color('#d6ecff');
const WIN_BASE = 8.0;
const BOLT_GAIN = 1.5;

/** The book's closed bulk (back board, page block, spine) as a box: centre and half size. */
const BODY_C = new Vector3(0, FLOOR / 2, -0.15);
const BODY_H = new Vector3(BOOK.w / 2, FLOOR / 2, BOOK.d / 2 + 0.15);

/** The room's walls: the back wall's face (z) and the left wall's (x); the desk stands against the back wall. */
export const WALL = { z: -14.7, x: -21.6 } as const;
/** The back window's aperture in the back wall (x range, sill, where its pointed arch springs). */
export const BACK_WIN = { x0: -13.2, x1: -4.6, sill: 0.85, spring: 10.5 } as const;
/** The back window's glass colour (its night sky, the lightning flashes it). */
const GLASS_GAIN = 1.25;

/** The room's shared uniforms (set per frame by Desk2 and Book2). */
export const ROOM = {
  uRoomWinL: { value: WIN_L.clone() },
  uRoomWinU: { value: WIN_U.clone() },
  uRoomWinV: { value: WIN_V.clone() },
  /**
   * where the window's centre falls on the desk: the beam lands on the cover's front right, the
   * fore-edge and the desk before the book, its mullion and transom clear of the title panel (the
   * title reads by the candle and its foil's reflection, not cut by the cookie's cross)
   */
  uRoomWinO: { value: new Vector3(6.58, 0, 3.8) },
  /** window units per world unit at the window (the cookie's size) */
  uRoomWinScale: { value: 0.94 },
  uRoomWin: { value: WIN_COLOR.clone().multiplyScalar(WIN_BASE) },
  /** the window's soft lobe: the night sky through it lighting the room broadly (a fraction of the cookie's light) */
  uRoomSoft: { value: 0.3 },
  /** the flames: position (xyz) and strength (w) */
  uRoomCandle: { value: [new Vector4(), new Vector4()] },
  uRoomCandleColor: { value: new Color('#ff9540') },
  /** what metals see (the brass, the gold foil): the candle-lit room, warm and dark; the back window's glow */
  uRoomEnv: { value: new Color('#8a8270') },
  uRoomGlass: { value: new Color('#3f9fbd') },
  uRoomGlassC: { value: new Vector3((BACK_WIN.x0 + BACK_WIN.x1) / 2, 4.5, WALL.z) },
  /** the crack's glow (Book2): a line light along the fore-edge's mouth, x half length, height, depth (xyz) and strength (w) */
  uRoomCrack: { value: new Vector4(7.2, 1.8, 5.45, 0) },
  uRoomCrackColor: { value: new Color('#38d2ee') },
  uRoomBodyC: { value: BODY_C.clone() },
  uRoomBodyH: { value: BODY_H.clone() },
  /** world → the cover's frame (its slab spans x ±w/2, y 0..t, z 0..d there) */
  uRoomCoverInv: { value: new Matrix4().makeTranslation(0, -FLOOR, BOOK.d / 2) },
  uRoomCoverC: { value: new Vector3(0, 0.06, BOOK.d / 2) },
  uRoomCoverH: { value: new Vector3(BOOK.w / 2, 0.06, BOOK.d / 2) },
  /** capsules: a (xyz, radius) and b (xyz) */
  uRoomCapA: { value: [new Vector4(0, -50, 0, 0), new Vector4(0, -50, 0, 0), new Vector4(0, -50, 0, 0), new Vector4(0, -50, 0, 0)] },
  uRoomCapB: { value: [new Vector4(0, -50, 0, 0), new Vector4(0, -50, 0, 0), new Vector4(0, -50, 0, 0), new Vector4(0, -50, 0, 0)] },
};

/** the cover starts down on the score's close riffle (film/journey.ts COVER_CLOSE) */
const CLOSE_FROM = at(34, 2);

/** The lightning through the window: two soft pulses around the 'lightning' cue (0..~1). */
export function lightningAt(f: number): number {
  const L = cue('lightning');
  const pulse = (peak: number, rise: number, decay: number, amp: number) => {
    if (f <= peak - rise || f >= peak + decay) return 0;
    if (f < peak) return amp * smooth(peak - rise, peak, f);
    return amp * (1 - smooth(peak, peak + decay, f)) ** 1.6;
  };
  return pulse(L, 2.5, 8, 1) + pulse(L + 8, 2.5, 10, 0.7);
}

const ROOM_PARS = /* glsl */ `
uniform vec3 uRoomWinL;
uniform vec3 uRoomWinU;
uniform vec3 uRoomWinV;
uniform vec3 uRoomWinO;
uniform float uRoomWinScale;
uniform vec3 uRoomWin;
uniform vec4 uRoomCandle[2];
uniform vec3 uRoomCandleColor;
uniform vec3 uRoomBodyC;
uniform vec3 uRoomBodyH;
uniform mat4 uRoomCoverInv;
uniform vec3 uRoomCoverC;
uniform vec3 uRoomCoverH;
uniform vec4 uRoomCapA[4];
uniform vec4 uRoomCapB[4];
uniform float uRoomSoft;
uniform vec3 uRoomEnv;
uniform vec3 uRoomGlass;
uniform vec3 uRoomGlassC;
uniform vec4 uRoomCrack;
uniform vec3 uRoomCrackColor;
uniform float uRoomWinMul;
uniform float uRoomCandleMul;
uniform float uRoomAO;
uniform float uRoomSelf;
uniform float uRoomIgnore;
uniform float uRoomMoonMul;
uniform float uRoomEnvMul;
uniform float uRoomGlitter;
uniform float uRoomCrackMul;
uniform float uRoomHemi;
float roomBoxD(vec3 p, vec3 c, vec3 h) {
  vec3 q = abs(p - c) - h;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float roomCapD(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * t) - r;
}
// the analytic scene the room's light is shadowed by
float roomScene(vec3 p, float book) {
  float d = 1e3;
  if (book > 0.5) {
    d = roomBoxD(p, uRoomBodyC, uRoomBodyH);
    vec3 q = (uRoomCoverInv * vec4(p, 1.0)).xyz;
    d = min(d, roomBoxD(q, uRoomCoverC, uRoomCoverH));
  }
  for (int i = 0; i < 4; i++) {
    if (abs(float(i) - uRoomIgnore) < 0.5) continue;
    d = min(d, roomCapD(p, uRoomCapA[i].xyz, uRoomCapB[i].xyz, uRoomCapA[i].w));
  }
  return d;
}
// soft shadows toward a light: x a small source's (the cookie, a flame), y a broad one's (the window's soft lobe)
vec2 roomShadow2(vec3 ro, vec3 rd, float book, float maxT) {
  vec2 res = vec2(1.0);
  float t = 0.04;
  for (int i = 0; i < 40; i++) {
    float h = roomScene(ro + rd * t, book);
    res = min(res, vec2(9.0, 1.6) * h / t);
    if (res.y < 0.002 || t > maxT) break;
    t += clamp(h, 0.03, 1.2);
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
float roomShadow(vec3 ro, vec3 rd, float book, float maxT) {
  return roomShadow2(ro, rd, book, maxT).x;
}
// the window's soft lobe in window units: a broad glow round the cookie, taller than wide
float roomSoftLobe(vec2 p) {
  vec2 q = vec2(p.x / 7.5, (p.y + 1.0) / 11.0);
  return exp(-0.5 * dot(q, q));
}
// the back window as a metal sees it: the moonlit glass (pale: the moon's sky, the lightning) where a
// ray from P along R meets the window's opening in the back wall, blurred by the roughness over the
// distance it travels; a broad blur spreads the same light thinner (the window's area over the lobe's)
vec3 roomWinRefl(vec3 P, vec3 R, float rough) {
  if (R.z > -0.05) return vec3(0.0);
  float t = (${WALL.z.toFixed(3)} - P.z) / R.z;
  vec2 q = P.xy + R.xy * t;
  float blur = 0.25 + t * rough * rough * 1.1;
  const float X0 = ${BACK_WIN.x0.toFixed(3)};
  const float X1 = ${BACK_WIN.x1.toFixed(3)};
  const float SILL = ${BACK_WIN.sill.toFixed(3)};
  const float SPRING = ${BACK_WIN.spring.toFixed(3)};
  float w = X1 - X0;
  float cx = 0.5 * (X0 + X1);
  float rect = max(abs(q.x - cx) - 0.5 * w, max(SILL - q.y, q.y - SPRING));
  float arch = max(max(length(q - vec2(X0, SPRING)) - w, length(q - vec2(X1, SPRING)) - w), SPRING - q.y);
  float a = smoothstep(blur, -blur, min(rect, arch));
  // the mullion and the transom
  float bars = (1.0 - 0.6 * (1.0 - smoothstep(0.17, 0.17 + blur, abs(q.x - cx)))) * (1.0 - 0.6 * (1.0 - smoothstep(0.13, 0.13 + blur, abs(q.y - 3.95))));
  float k = 140.0 / (140.0 + 12.0 * blur * blur);
  vec3 g = mix(vec3(dot(uRoomGlass, vec3(0.2126, 0.7152, 0.0722))), uRoomGlass, 0.15);
  return g * 1.6 * a * bars * k;
}
// the room as a metal sees it, along a world direction R from P: the dark, warm, candle-lit room
// (brighter toward the horizon, where the lit desk and walls are), the flames, the windows
vec3 roomEnv(vec3 R, vec3 P, float rough) {
  float a = rough * rough;
  // a Phong lobe as sharp as the roughness allows (never below 1: pow(0, 0) is undefined, a NaN on some GPUs)
  float sharp = max(2.0 / max(a * a, 1e-3) - 2.0, 4.0);
  vec3 env = uRoomEnv * (0.35 + 0.65 * exp(-3.0 * R.y * R.y)) * (R.y < 0.0 ? 1.25 : 1.0);
  for (int i = 0; i < 2; i++) {
    vec4 cd = uRoomCandle[i];
    if (cd.w <= 0.0) continue;
    vec3 dl = cd.xyz - P;
    float d2 = dot(dl, dl);
    float c = max(dot(R, dl * inversesqrt(d2)), 0.0);
    // the flame itself (a small bright source: a normalised lobe over its solid angle) and the warm pool round it
    float n = min(sharp, 900.0);
    env += uRoomCandleColor * cd.w * (0.0045 * (n + 2.0) * pow(c, n) / (d2 + 1.0) + 0.06 * pow(c, 5.0) / (1.0 + 0.02 * d2));
  }
  // the moonlit window the cookie comes through, and the back window's sky
  env += uRoomWin * 0.012 * pow(max(dot(R, uRoomWinL), 0.0), clamp(sharp * 0.5, 2.0, 400.0));
  env += roomWinRefl(P, R, rough);
  return env;
}
// glitter: the foil's crumpled facets, each a tiny mirror turned a little its own way (cells in world space)
float roomGlitter(vec3 P, vec3 N, vec3 V, vec3 Lc) {
  vec3 c = floor(P / 0.045);
  vec3 j = vec3(aivHash13(c + 1.3), aivHash13(c + 7.9), aivHash13(c + 4.1)) - 0.5;
  vec3 n = normalize(N + 0.55 * j);
  vec3 r = reflect(-V, n);
  float on = step(0.55, aivHash13(c + 2.7));
  return on * pow(max(dot(r, Lc), 0.0), 260.0);
}
// the crack's glow: a line light along the mouth (its strength broken up along x and flickering)
vec3 roomCrackLight(vec3 P, vec3 N, out vec3 Ld) {
  float x = clamp(P.x, -uRoomCrack.x, uRoomCrack.x);
  vec3 q = vec3(x, uRoomCrack.y, uRoomCrack.z);
  vec3 dl = q - P;
  float d2 = dot(dl, dl);
  Ld = dl * inversesqrt(d2);
  float d = sqrt(d2);
  float ends = smoothstep(uRoomCrack.x, uRoomCrack.x - 2.2, abs(P.x));
  float n = aivFbm3(vec3(x * 0.45, uSbTime * 0.45, 3.0));
  float br = 0.06 + 1.7 * smoothstep(0.32, 0.78, n);
  // bright at the mouth, gone a little way into the book; a faint wide spill on the desk and the cover
  float att = exp(-1.8 * d) / (d2 + 0.06) + 0.12 / (1.0 + 0.25 * d2);
  return uRoomCrackColor * uRoomCrack.w * br * ends * att * (1.0 - smoothstep(4.0, 8.0, d));
}
// a lancet in window units: a rectangle under a pointed (equilateral) arch springing at y = 0
float roomLancet(vec2 p, float w, float hRect) {
  float rect = max(abs(p.x) - w * 0.5, max(-p.y - hRect, p.y));
  float arch = max(length(vec2(p.x + w * 0.5, p.y)) - w, length(vec2(p.x - w * 0.5, p.y)) - w);
  arch = max(arch, -p.y);
  return min(rect, arch);
}
// the window's light at a point of its plane (window units, its centre at the origin): 0..1
float roomWindowS(vec2 p, float soft) {
  float light = 0.0;
  for (int s = 0; s < 2; s++) {
    vec2 c = p - vec2(s == 0 ? -1.72 : 1.72, 1.0);
    float d = roomLancet(c, 3.0, 6.0);
    // the transom across both lancets
    d = max(d, -(abs(c.y + 2.5) - 0.12));
    light = max(light, smoothstep(soft, -soft, d));
  }
  // the quatrefoil over them
  vec2 o = p - vec2(0.0, 4.75);
  float qf = min(min(length(o - vec2(0.6, 0.0)), length(o + vec2(0.6, 0.0))), min(length(o - vec2(0.0, 0.6)), length(o + vec2(0.0, 0.6)))) - 0.52;
  light = max(light, smoothstep(soft, -soft, qf));
  // lead cames: a diamond lattice, and the glass a little uneven pane to pane
  vec2 g = vec2(p.x + p.y * 0.58, p.x - p.y * 0.58) / 0.62;
  vec2 f = abs(fract(g) - 0.5);
  float came = min(f.x, f.y) * 0.62;
  float cm = mix(0.62, 1.0, smoothstep(0.008, 0.06, came));
  float pane = 0.86 + 0.14 * aivHash13(vec3(floor(g), 3.1));
  return light * cm * pane;
}
float roomWindow(vec2 p) {
  return roomWindowS(p, 0.1);
}
`;

const ROOM_MAIN = /* glsl */ `
{
  vec3 rP = vSbWorld;
  vec3 rN = inverseTransformDirection(geometryNormal, viewMatrix);
  vec3 rNg = normalize(vSbNormalW) * faceDirection;
  vec3 rV = normalize(cameraPosition - rP);
  float book = 1.0 - uRoomSelf;
  // three's own lights (the night rig's moon and fill) on this surface: the walls take little of them,
  // nor much of its sky (the hemisphere's cool fill hazed the room: no true blacks)
  reflectedLight.directDiffuse *= uRoomMoonMul;
  reflectedLight.directSpecular *= uRoomMoonMul;
  irradiance *= uRoomHemi;
  // the window: its cookie and its soft lobe (the sky through it), one shadow march for both
  if (uRoomWinMul > 0.0) {
    float ndl = dot(rN, uRoomWinL);
    if (ndl > 0.0) {
      vec3 q = rP - uRoomWinO;
      vec2 wp = vec2(dot(q, uRoomWinU), dot(q, uRoomWinV)) * uRoomWinScale;
      float m = roomWindow(wp);
      float lobe = uRoomSoft * roomSoftLobe(wp);
      if (m + lobe > 0.002) {
        vec2 sh = roomShadow2(rP + rNg * 0.03, uRoomWinL, book, 30.0);
        IncidentLight wl;
        wl.direction = normalize((viewMatrix * vec4(uRoomWinL, 0.0)).xyz);
        wl.color = uRoomWin * (m * sh.x + lobe * sh.y) * uRoomWinMul;
        wl.visible = true;
        RE_Direct(wl, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
      }
    }
  }
  // the candles: a warm pool (softer than the inverse square, as a painter would light it)
  if (uRoomCandleMul > 0.0) {
    for (int i = 0; i < 2; i++) {
      vec4 cd = uRoomCandle[i];
      if (cd.w <= 0.0) continue;
      vec3 dl = cd.xyz - rP;
      float d2 = dot(dl, dl);
      float dd = sqrt(d2);
      vec3 Ld = dl / dd;
      if (dot(rN, Ld) <= 0.0) continue;
      float att = cd.w / (d2 + 1.6) * (1.0 - smoothstep(13.0, 24.0, dd));
      float sh = roomShadow(rP + rNg * 0.03, Ld, book, dd - 0.15);
      IncidentLight cl;
      cl.direction = normalize((viewMatrix * vec4(Ld, 0.0)).xyz);
      cl.color = uRoomCandleColor * att * sh * uRoomCandleMul;
      cl.visible = true;
      RE_Direct(cl, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
    }
  }
  // the crack's glow (the world inside the closed book): on the cover's underside, the first page, the fore-edge, the desk
  if (uRoomCrackMul > 0.0 && uRoomCrack.w > 0.0) {
    vec3 Ld;
    vec3 col = roomCrackLight(rP, rN, Ld);
    if (dot(rN, Ld) > 0.0) {
      IncidentLight kl;
      kl.direction = normalize((viewMatrix * vec4(Ld, 0.0)).xyz);
      kl.color = col * uRoomCrackMul;
      kl.visible = true;
      RE_Direct(kl, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
    }
  }
  // metals (the brass, the gold foil): none of the storybook's cool ambient (it turned the gold
  // green), the warm room in their reflections instead, and the foil's glitter in the candle
  if (uRoomEnvMul > 0.0) {
    vec3 rNw = inverseTransformDirection(normal, viewMatrix);
    vec3 R = reflect(-rV, rNw);
    // dielectrics (the cloth round the foil, the wax) take a little of it, metals all
    radiance += roomEnv(R, rP, material.roughness) * uRoomEnvMul * mix(0.2, 1.0, metalnessFactor);
    diffuseColor.rgb *= 1.0 - 0.88 * metalnessFactor;
    if (uRoomGlitter > 0.0 && metalnessFactor > 0.3) {
      for (int i = 0; i < 2; i++) {
        vec4 cd = uRoomCandle[i];
        if (cd.w <= 0.0) continue;
        vec3 dl = cd.xyz - rP;
        float d2 = dot(dl, dl);
        radiance += uRoomCandleColor * cd.w * uRoomGlitter * roomGlitter(rP, rNw, rV, dl * inversesqrt(d2)) / (1.0 + 0.03 * d2) * metalnessFactor;
      }
      radiance += uRoomWin * 0.08 * uRoomGlitter * roomGlitter(rP + 0.37, rNw, rV, uRoomWinL) * metalnessFactor;
    }
  }
  // contact darkening (the desk): the indirect light and the ambient fall near what stands on it
  if (uRoomAO > 0.0) {
    float d = roomScene(rP, 1.0);
    float ao = mix(1.0, 0.35 + 0.65 * smoothstep(0.0, 0.7, d), uRoomAO);
    diffuseColor.rgb *= ao;
    material.diffuseColor *= ao;
  }
}
`;

/** The storybook material's own injection (taken once from a throwaway material). */
let sbInject: ((shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => void) | null = null;
function storybookInject() {
  if (!sbInject) {
    const t = storybookMaterial();
    sbInject = t.onBeforeCompile as unknown as typeof sbInject;
    t.dispose();
  }
  return sbInject!;
}

interface RoomData {
  room: Record<string, { value: number }>;
  roomKey: string;
}

/** One injection for every room material: the storybook's, then the room's light before the light maps. */
function injectRoom(this: MeshStandardMaterial, shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer): void {
  shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>', ROOM_MAIN + '\n#include <lights_fragment_maps>');
  storybookInject().call(this, shader, renderer);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + ROOM_PARS);
  Object.assign(shader.uniforms, ROOM, (this.userData as RoomData).room);
}
function roomCacheKey(this: MeshStandardMaterial): string {
  return (this.userData as RoomData).roomKey;
}

export interface RoomPaint extends Paint {
  /** the window's light on this surface (0: none) */
  window?: number;
  /** the candles' light (0: none) */
  candle?: number;
  /** contact darkening near the book and the props (the desk) */
  ao?: number;
  /** the book's own surfaces: not shadowed by the book's boxes */
  self?: boolean;
  /** a capsule (0..3) this surface lies on, left out of its shadows */
  ignore?: number;
  /** three's own lights (the night rig's moon and fill) on this surface (1: all) */
  moon?: number;
  /** the room in its reflections (metals, glass, wax; 0: none) */
  env?: number;
  /** the foil's glitter in the candle (0: none) */
  glitter?: number;
  /** the crack's glow on this surface (0: none) */
  crack?: number;
  /** the night rig's sky (its hemisphere light) on this surface (1: all) */
  hemi?: number;
}

/** A storybook material lit by the room: the window's projected moonlight and the candles. */
export function roomMaterial(o: RoomPaint = {}): MeshStandardMaterial {
  const { window = 1, candle = 1, ao = 0, self = false, ignore = -1, moon = 1, env = 0, glitter = 0, crack = 0, hemi = 1, ...paint } = o;
  // the room is outside the story: its surfaces never take the storybook fog (the crane into the book has it on)
  const m = storybookMaterial({ fog: 0, ...paint });
  const base = m.customProgramCacheKey();
  m.userData.room = {
    uRoomWinMul: { value: window },
    uRoomCandleMul: { value: candle },
    uRoomAO: { value: ao },
    uRoomSelf: { value: self ? 1 : 0 },
    uRoomIgnore: { value: ignore },
    uRoomMoonMul: { value: moon },
    uRoomEnvMul: { value: env },
    uRoomGlitter: { value: glitter },
    uRoomCrackMul: { value: crack },
    uRoomHemi: { value: hemi },
  };
  m.userData.roomKey = `room:${base}`;
  m.onBeforeCompile = injectRoom;
  m.customProgramCacheKey = roomCacheKey;
  return m;
}

// ---- the desk's layout ------------------------------------------------------------------------------

export const DESK = { w: 40, d: 28, t: 1.1 } as const;
/** the chamberstick, front right of the book */
export const CANDLE = { x: 6.6, z: -8.0 } as const;
/** the jack-o'-lantern, front left of the book, its grin to the opening's camera */
export const DESK_PUMPKIN = { x: -10.2, z: 4.6, scale: 2.1, yaw: 0.85 } as const;
/** the inkwell and its quill, beside the book's back left (clear of it from the opening's camera) */
export const INKWELL = { x: -12.4, z: -1.9 } as const;

const SOCKET_TOP = 0.41;
const CANDLE_R = 0.2;
const CANDLE_TOP = 1.56;
/** the wick's tip, where the flame stands */
const WICK: V3 = [CANDLE.x + 0.01, CANDLE_TOP + 0.06, CANDLE.z];

// ---- the planks -------------------------------------------------------------------------------------

const PLANKS = 8;
/** plank edges across z, jittered widths */
const PLANK_Z: number[] = (() => {
  const w = Array.from({ length: PLANKS }, (_, i) => 1 + 0.22 * (rand(61, 'plank', i) * 2 - 1));
  const s = w.reduce((a, b) => a + b, 0);
  const out = [-DESK.d / 2];
  for (let i = 0; i < PLANKS; i++) out.push(out[i] + (w[i] / s) * DESK.d);
  return out;
})();

function plankGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const gap = 0.05;
  for (let i = 0; i < PLANKS; i++) {
    const z0 = PLANK_Z[i] + gap / 2;
    const z1 = PLANK_Z[i + 1] - gap / 2;
    const zc = (z0 + z1) / 2;
    const tilt = 0.004 * (rand(62, 'tilt', i) * 2 - 1);
    const lift = 0.006 * (rand(62, 'lift', i) * 2 - 1);
    const cup = 0.006 + 0.008 * rand(62, 'cup', i);
    const outer = i === 0 || i === PLANKS - 1;
    // the profile across the plank: [z, y, ao]
    const prof: [number, number, number][] = [];
    const deep = outer ? -DESK.t : -0.5;
    const edge = (zz: number, s: number): [number, number, number][] => [
      [zz, deep, 0.03],
      [zz, -0.12, 0.12],
      [zz, -0.05, 0.55],
      [zz + s * 0.016, -0.017, 1.12],
      [zz + s * 0.045, -0.004, 1.06],
      [zz + s * 0.09, 0, 1.0],
    ];
    prof.push(...edge(z0, 1));
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      prof.push([z0 + 0.09 + (z1 - z0 - 0.18) * t, 0, 1]);
    }
    prof.push(...edge(z1, -1).reverse());
    const nx = 110;
    const X0 = -DESK.w / 2;
    const vOf = (z: number) => 1 - (i + (z - PLANK_Z[i]) / (PLANK_Z[i + 1] - PLANK_Z[i])) / PLANKS;
    // the plank's undulation and its tone vary along it only: one value per column, not per vertex
    const wave = Array.from({ length: nx + 1 }, (_, a) => fbm2((X0 + (DESK.w * a) / nx) * 0.15, i * 3.1, 63));
    const tone = Array.from({ length: nx + 1 }, (_, a) => fbm2((a / nx) * 30, i, 64));
    const g = gridGeometry(
      nx,
      prof.length - 1,
      (a, j) => {
        const x = X0 + (DESK.w * a) / nx;
        const [z, y] = prof[j];
        const t = (z - z0) / (z1 - z0);
        const top = y > -0.03 ? 1 : 0;
        // worn round at the desk's ends
        const end = Math.min(x - X0, DESK.w / 2 - x);
        const yy = y + top * (lift + tilt * (z - zc) - cup * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) + 0.004 * wave[a] - 0.03 * (1 - smooth(0, 0.12, end)));
        return [x, yy, z];
      },
      (a, j) => [a / nx, vOf(prof[j][0])],
      (a, j) => {
        const k = prof[j][2] * (0.92 + 0.08 * tone[a]);
        return [k, k, k, 0.15];
      },
      () => [0, 1, 0],
    );
    parts.push(g);
    // the ends: a fan of the profile at x = ±w/2
    for (const sx of [-1, 1]) {
      const P: number[] = [];
      const UV: number[] = [];
      const C: number[] = [];
      const x = (sx * DESK.w) / 2;
      const cy = deep / 2;
      for (let j = 0; j < prof.length - 1; j++) {
        const a = prof[j];
        const b = prof[j + 1];
        P.push(x, cy, zc, x, a[1], a[0], x, b[1], b[0]);
        UV.push(sx < 0 ? 0 : 1, vOf(zc), sx < 0 ? 0 : 1, vOf(a[0]), sx < 0 ? 0 : 1, vOf(b[0]));
        C.push(0.5, 0.5, 0.5, 0.15, 0.6, 0.6, 0.6, 0.15, 0.6, 0.6, 0.6, 0.15);
      }
      const e = new BufferGeometry();
      e.setAttribute('position', new BufferAttribute(new Float32Array(P), 3));
      e.setAttribute('uv', new BufferAttribute(new Float32Array(UV), 2));
      e.setAttribute('color', new BufferAttribute(new Float32Array(C), 4));
      e.computeVertexNormals();
      if (e.getAttribute('normal').getX(0) * sx < 0) {
        const arr = e.getAttribute('position').array as Float32Array;
        for (let t = 0; t < arr.length; t += 9) for (let c = 0; c < 3; c++) [arr[t + 3 + c], arr[t + 6 + c]] = [arr[t + 6 + c], arr[t + 3 + c]];
        const uv = e.getAttribute('uv').array as Float32Array;
        for (let t = 0; t < uv.length; t += 6) for (let c = 0; c < 2; c++) [uv[t + 2 + c], uv[t + 4 + c]] = [uv[t + 4 + c], uv[t + 2 + c]];
        e.computeVertexNormals();
      }
      parts.push(e);
    }
  }
  const out = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
  parts.forEach((p) => p.dispose());
  return out;
}

/** Desk (x, z) → the wood canvas's pixel (x, y) and the plank it is on. */
function deskPx(x: number, z: number, W: number, H: number): [number, number] {
  let i = 0;
  while (i < PLANKS - 1 && z > PLANK_Z[i + 1]) i++;
  const vl = (z - PLANK_Z[i]) / (PLANK_Z[i + 1] - PLANK_Z[i]);
  return [((x + DESK.w / 2) / DESK.w) * W, ((i + vl) / PLANKS) * H];
}

/** The wood: grain, figure and knots per plank; wax, ink, rings, scratches and wear across the desk. Colour and ORM (R height, G roughness). */
function woodArt(): { map: CanvasTexture; orm: CanvasTexture } {
  const W = 4096;
  const H = 2048;
  const SH = H / PLANKS;
  const { c, g } = canvas(W, H);
  const { c: oc, g: o } = canvas(W, H);
  const r = seq(65, 'wood');
  o.fillStyle = 'rgb(128,205,0)';
  o.fillRect(0, 0, W, H);
  for (let i = 0; i < PLANKS; i++) {
    const y0 = i * SH;
    const hue = 24 + r() * 10;
    const lit = 41 + r() * 9;
    g.fillStyle = `hsl(${hue},${26 + r() * 10}%,${lit}%)`;
    g.fillRect(0, y0, W, SH);
    // a long soft streak of lighter and darker wood along the plank
    for (let k = 0; k < 6; k++) {
      const yy = y0 + r() * SH;
      const grad = g.createLinearGradient(0, yy - 60, 0, yy + 60);
      const tone = r() < 0.5 ? `hsla(${hue},40%,${lit + 6}%,0.22)` : `hsla(${hue - 4},45%,${lit - 5}%,0.3)`;
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, tone);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, yy - 60, W, 120);
    }
    g.save();
    g.beginPath();
    g.rect(0, y0, W, SH);
    g.clip();
    o.save();
    o.beginPath();
    o.rect(0, y0, W, SH);
    o.clip();
    // grain lines
    const n = 70 + Math.floor(r() * 30);
    for (let k = 0; k < n; k++) {
      const yy = y0 + r() * SH;
      const amp = 2 + r() * 10;
      const fr = 0.0015 + r() * 0.004;
      const ph = r() * TAU;
      const dark = r() < 0.7;
      const a = 0.12 + r() * 0.3;
      g.strokeStyle = dark ? `rgba(10,5,3,${a})` : `rgba(120,80,52,${a * 0.6})`;
      g.lineWidth = 0.8 + r() * 2.6;
      o.strokeStyle = dark ? `rgba(70,215,0,${a})` : `rgba(165,200,0,${a})`;
      o.lineWidth = g.lineWidth;
      g.beginPath();
      o.beginPath();
      for (let x = -20; x <= W + 20; x += 48) {
        const y = yy + amp * Math.sin(x * fr + ph) + 3 * fbm2(x * 0.004, k, 66 + i);
        if (x === -20) {
          g.moveTo(x, y);
          o.moveTo(x, y);
        } else {
          g.lineTo(x, y);
          o.lineTo(x, y);
        }
      }
      g.stroke();
      o.stroke();
    }
    // flat-sawn figure: nested arches along some planks
    if (r() < 0.65) {
      const cx = r() * W;
      const cy = y0 + SH * (0.3 + 0.4 * r());
      const len = 600 + r() * 900;
      for (let k = 1; k < 12; k++) {
        const hw = len * (0.25 + k * 0.08);
        g.strokeStyle = `rgba(12,6,3,${0.12 + 0.1 * r()})`;
        g.lineWidth = 1 + r() * 2.5;
        g.beginPath();
        for (let t = -1; t <= 1.001; t += 0.05) {
          const x = cx + t * hw;
          const y = cy + (k * 5 + 4) * (1 - t * t) * (r() < 0.02 ? 1.1 : 1) - k * 5;
          if (t === -1) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    // knots
    if (r() < 0.55) {
      const kx = r() * W;
      const ky = y0 + SH * (0.25 + 0.5 * r());
      const kr = 10 + r() * 16;
      for (let k = 6; k >= 0; k--) {
        g.fillStyle = k === 0 ? 'rgba(8,3,2,0.9)' : `rgba(${30 - k * 2},${16 - k},${10 - k},${0.25})`;
        g.beginPath();
        g.ellipse(kx, ky, kr * (1 + k * 0.9) * 2.6, kr * (1 + k * 0.5), 0, 0, TAU);
        g.fill();
      }
      o.fillStyle = 'rgba(60,230,0,0.8)';
      o.beginPath();
      o.ellipse(kx, ky, kr * 2.2, kr, 0, 0, TAU);
      o.fill();
    }
    g.restore();
    o.restore();
  }
  // desk-wide marks, placed in desk space
  const at = (x: number, z: number) => deskPx(x, z, W, H);
  // wear: a lighter, smoother band along the front where arms rest
  {
    const [, yF] = at(0, 9.5);
    const grad = g.createLinearGradient(0, yF, 0, H);
    grad.addColorStop(0, 'rgba(110,80,60,0)');
    grad.addColorStop(1, 'rgba(110,80,60,0.18)');
    g.fillStyle = grad;
    g.fillRect(0, yF, W, H - yF);
  }
  // wax: old drips round the candle and a trail across the desk
  const wax = (x: number, z: number, rx: number, rz: number) => {
    const [px, py] = at(x, z);
    const sx = (rx / DESK.w) * W;
    const sy = (rz / (DESK.d / PLANKS)) * SH;
    const grad = g.createRadialGradient(px, py, 0, px, py, Math.max(sx, sy));
    grad.addColorStop(0, 'rgba(200,186,154,0.55)');
    grad.addColorStop(0.7, 'rgba(170,152,120,0.4)');
    grad.addColorStop(1, 'rgba(160,140,110,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(px, py, sx, sy, 0, 0, TAU);
    g.fill();
    o.fillStyle = 'rgba(200,90,0,0.9)';
    o.beginPath();
    o.ellipse(px, py, sx * 0.8, sy * 0.8, 0, 0, TAU);
    o.fill();
  };
  for (let k = 0; k < 8; k++) {
    const a = r() * TAU;
    const d = 0.75 + r() * 1.4;
    wax(CANDLE.x + Math.cos(a) * d, CANDLE.z + Math.sin(a) * d, 0.05 + r() * 0.14, 0.05 + r() * 0.12);
  }
  for (let k = 0; k < 6; k++) wax(CANDLE.x + 1.4 + k * 0.8 + r() * 0.4, CANDLE.z - 0.9 - k * 0.22 + r() * 0.3, 0.03 + r() * 0.05, 0.03 + r() * 0.04);
  // a burn mark where a candle once fell
  {
    const [px, py] = at(CANDLE.x - 1.6, CANDLE.z - 1.8);
    const grad = g.createRadialGradient(px, py, 0, px, py, 70);
    grad.addColorStop(0, 'rgba(4,2,1,0.75)');
    grad.addColorStop(1, 'rgba(4,2,1,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(px, py, 90, 50, 0.3, 0, TAU);
    g.fill();
  }
  // ink: a dried splash by the inkwell
  {
    for (let k = 0; k < 7; k++) {
      const [px, py] = at(INKWELL.x + 0.9 + r() * 1.2, INKWELL.z + 0.6 + r() * 0.8);
      g.fillStyle = `rgba(6,8,16,${0.5 + r() * 0.4})`;
      g.beginPath();
      g.ellipse(px, py, 6 + r() * 26, 4 + r() * 16, r() * TAU, 0, TAU);
      g.fill();
      o.fillStyle = 'rgba(128,70,0,0.8)';
      o.beginPath();
      o.ellipse(px, py, 6 + r() * 20, 4 + r() * 12, 0, 0, TAU);
      o.fill();
    }
  }
  // cup rings
  for (const [x, z, rad] of [
    [-13.5, -7.5, 1.1],
    [13.2, -9.0, 0.9],
    [-15.0, 8.5, 1.0],
  ] as const) {
    const [px, py] = at(x, z);
    g.strokeStyle = 'rgba(8,4,2,0.35)';
    g.lineWidth = 5;
    g.beginPath();
    g.ellipse(px, py, (rad / DESK.w) * W, (rad / (DESK.d / PLANKS)) * SH, 0, 0.2, TAU - 0.5);
    g.stroke();
  }
  // the dry leaves' contact shadows (they lie a little curled, the desk darker under them)
  for (const l of LEAVES) {
    const [px, py] = at(l.x + Math.sin(l.yaw) * l.len * 0.45, l.z + Math.cos(l.yaw) * l.len * 0.45);
    const sx = ((l.len * 0.62) / DESK.w) * W;
    const sy = ((l.len * 0.62) / (DESK.d / PLANKS)) * SH;
    const grad = g.createRadialGradient(px, py, 0, px, py, Math.max(sx, sy));
    grad.addColorStop(0, 'rgba(8,4,2,0.6)');
    grad.addColorStop(0.6, 'rgba(8,4,2,0.3)');
    grad.addColorStop(1, 'rgba(8,4,2,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(px, py, sx, sy, 0, 0, TAU);
    g.fill();
  }
  // scratches
  for (let k = 0; k < 160; k++) {
    const x = r() * W;
    const y = r() * H;
    const a = (r() - 0.5) * 0.9 + (r() < 0.5 ? 0 : Math.PI / 2) * 0.3;
    const len = 20 + r() * 160;
    g.strokeStyle = `rgba(120,90,66,${0.08 + r() * 0.16})`;
    g.lineWidth = 0.7 + r() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.5);
    g.stroke();
    o.strokeStyle = 'rgba(100,180,0,0.5)';
    o.lineWidth = 1;
    o.beginPath();
    o.moveTo(x, y);
    o.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.5);
    o.stroke();
  }
  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  const orm = new CanvasTexture(oc);
  orm.colorSpace = LinearSRGBColorSpace;
  orm.anisotropy = 8;
  return { map, orm };
}

// ---- the candle -------------------------------------------------------------------------------------

/** The brass chamberstick: a dish with a lip, the socket, a finger ring. */
function holderGeometry(): BufferGeometry {
  const prof = [
    [0.0, 0.0],
    [0.56, 0.0],
    [0.62, 0.012],
    [0.65, 0.04],
    [0.66, 0.075],
    [0.635, 0.095],
    [0.6, 0.075],
    [0.56, 0.05],
    [0.42, 0.04],
    [0.3, 0.045],
    [0.25, 0.065],
    [0.22, 0.11],
    [0.235, 0.16],
    [0.235, 0.34],
    [0.27, 0.375],
    [0.27, 0.4],
    [0.245, SOCKET_TOP],
    [CANDLE_R + 0.005, SOCKET_TOP - 0.02],
    [CANDLE_R + 0.005, SOCKET_TOP - 0.1],
  ].map(([r, y]) => new Vector2(r, y));
  const lathe = new LatheGeometry(prof, 72);
  const ring = new TorusGeometry(0.14, 0.032, 10, 40);
  ring.rotateY(Math.PI / 2);
  ring.translate(0.74, 0.1, 0);
  const thumb = new TorusGeometry(0.06, 0.025, 8, 20, Math.PI);
  thumb.rotateY(Math.PI / 2);
  thumb.translate(0.74, 0.25, 0);
  const flat = [lathe, ring, thumb].map((p) => p.toNonIndexed());
  const g = mergeGeometries(flat)!;
  [lathe, ring, thumb, ...flat].forEach((p) => p.dispose());
  // worn bright on the lip and the ring's top, tarnished low in the dish
  const p = g.getAttribute('position');
  const col = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const rr = Math.hypot(p.getX(i), p.getZ(i));
    const lip = Math.exp(-(((rr - 0.65) / 0.03) ** 2)) * Math.exp(-(((y - 0.08) / 0.03) ** 2));
    const low = 1 - smooth(0.0, 0.08, y) * (rr < 0.58 ? 1 : 0.3);
    const k = 0.75 + 0.5 * lip + 0.15 * smooth(0.3, 0.4, y) - 0.25 * low * (rr < 0.55 ? 1 : 0);
    col.set([k, k, k, 0.5], i * 4);
  }
  g.setAttribute('color', new BufferAttribute(col, 4));
  g.rotateY(0.6);
  g.translate(CANDLE.x, 0, CANDLE.z);
  return g;
}

/** The candle: a column with an uneven melted rim, drips down its side, a crater round the wick; the wick; wax stains on the desk. */
function waxGeometry(): BufferGeometry {
  const drips = Array.from({ length: 6 }, (_, k) => ({ a: rand(67, 'drip', k) * TAU, len: 0.18 + 0.75 * rand(67, 'len', k), w: 0.11 + 0.08 * rand(67, 'w', k), t: 0.018 + 0.02 * rand(67, 't', k) }));
  const low = rand(67, 'low', 0) * TAU;
  const rimY = (a: number) => CANDLE_TOP - 0.05 * fbm2(Math.cos(a) * 2, Math.sin(a) * 2, 68) - 0.09 * Math.max(0, Math.cos(a - low)) ** 3;
  const nA = 72;
  const nS = 54;
  const y0 = SOCKET_TOP - 0.06;
  // s: 0..0.72 up the side, 0.72..0.8 over the rim, 0.8..1 across the crater to the wick
  const point = (i: number, j: number): V3 => {
    const a = (i / nA) * TAU;
    const s = j / nS;
    const ry = rimY(a);
    let rr: number;
    let y: number;
    if (s <= 0.72) {
      y = y0 + ((ry - 0.03 - y0) * s) / 0.72;
      rr = CANDLE_R;
      for (const d of drips) {
        const da = Math.atan2(Math.sin(a - d.a), Math.cos(a - d.a)) / d.w;
        const yEnd = ry - d.len;
        if (y > yEnd - 0.07) {
          const run = smooth(yEnd - 0.03, yEnd + 0.04, y);
          const blob = Math.exp(-(((y - yEnd) / 0.045) ** 2));
          rr += Math.exp(-da * da) * (d.t * run + d.t * 1.6 * blob);
        }
      }
      rr += 0.004 * fbm2(a * 3, y * 9, 69);
    } else if (s <= 0.8) {
      const t = (s - 0.72) / 0.08;
      const th = (t * Math.PI) / 2;
      rr = CANDLE_R - 0.03 + 0.03 * Math.cos(th);
      y = ry - 0.03 + 0.03 * Math.sin(th);
      for (const d of drips) {
        const da = Math.atan2(Math.sin(a - d.a), Math.cos(a - d.a)) / d.w;
        rr += Math.exp(-da * da) * d.t * (1 - t);
      }
    } else {
      const t = (s - 0.8) / 0.2;
      rr = (CANDLE_R - 0.03) * (1 - t);
      y = ry + (CANDLE_TOP - 0.075 - ry) * smooth(0, 0.6, t);
    }
    return [CANDLE.x + Math.cos(a) * rr, y, CANDLE.z + Math.sin(a) * rr];
  };
  const body = gridGeometry(
    nA,
    nS,
    point,
    (i, j) => [i / nA, j / nS],
    (i, j) => {
      const s = j / nS;
      // a little darker low on the column, cream at the rim, a soot ring in the crater
      const k = s < 0.72 ? 0.86 + 0.14 * (s / 0.72) : s < 0.9 ? 1.0 : 0.85;
      return [k, k * 0.98, k * 0.94, 0.4];
    },
    (p) => [p[0] - CANDLE.x, 0, p[2] - CANDLE.z],
  );
  // the wick: a short curved charred thread
  const wick = tubeAlong(
    [
      [CANDLE.x, CANDLE_TOP - 0.08, CANDLE.z],
      [CANDLE.x + 0.003, CANDLE_TOP - 0.02, CANDLE.z],
      [CANDLE.x + 0.01, WICK[1] - 0.02, CANDLE.z],
      [WICK[0] + 0.012, WICK[1] + 0.012, WICK[2]],
    ],
    0.014,
    6,
    (t) => [0.05 + 0.4 * t * t, 0.04 + 0.12 * t * t, 0.03, 0.2],
  );
  // wax stains on the desk: low rounded blobs
  const stains: BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) {
    const a = rand(70, 'stain', k) * TAU;
    const d = 0.75 + 0.9 * rand(70, 'sd', k);
    const rx = 0.05 + 0.09 * rand(70, 'sr', k);
    const h = 0.012 + 0.018 * rand(70, 'sh', k);
    const cx = CANDLE.x + Math.cos(a) * d;
    const cz = CANDLE.z + Math.sin(a) * d;
    const prof: Vector2[] = [];
    for (let q = 0; q <= 8; q++) {
      const t = q / 8;
      prof.push(new Vector2(rx * Math.sin((t * Math.PI) / 2 + Math.PI / 2) + 1e-4, h * Math.sin((t * Math.PI) / 2) - 0.004));
    }
    const l = new LatheGeometry(prof, 20);
    l.scale(1, 1, 0.6 + 0.5 * rand(70, 'sq', k));
    l.rotateY(a);
    l.translate(cx, 0, cz);
    const n = l.getAttribute('position').count;
    const col = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) col.set([0.82, 0.8, 0.74, 0.3], i * 4);
    l.setAttribute('color', new BufferAttribute(col, 4));
    stains.push(l);
  }
  const all = [body, wick, ...stains].map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    ng.deleteAttribute('uv');
    return ng;
  });
  const out = mergeGeometries(all)!;
  all.forEach((g) => g.dispose());
  return out;
}

const FLAME_VERT = /* glsl */ `
uniform float uLen;
uniform float uWidth;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 base = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 toCam = cameraPosition - base;
  toCam.y = 0.0;
  toCam = normalize(toCam);
  vec3 right = vec3(toCam.z, 0.0, -toCam.x);
  vec3 p = base + right * (position.x * uWidth) + vec3(0.0, (position.y + 0.5) * uLen, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const FLAME_FRAG = /* glsl */ `
uniform float uSway;
uniform float uGain;
varying vec2 vUv;
void main() {
  float y = vUv.y;
  float x = (vUv.x - 0.5) * 2.0;
  x -= uSway * y * y;
  float hw = 2.35 * pow(max(y, 0.0), 0.5) * pow(max(1.0 - y, 0.0), 0.85) + 1e-3;
  float r = abs(x) / hw;
  float body = smoothstep(1.0, 0.55, r) * smoothstep(0.0, 0.07, y) * smoothstep(1.0, 0.8, y);
  // the colours: a blue base, a hot yellow-white core, an orange skin and tip; the dark cone round the wick
  vec3 skin = vec3(1.0, 0.42, 0.08);
  vec3 core = vec3(1.0, 0.86, 0.55);
  vec3 col = mix(skin, core, smoothstep(0.85, 0.25, r) * smoothstep(0.98, 0.45, y));
  float cone = smoothstep(0.5, 0.0, r) * smoothstep(0.32, 0.12, y);
  col *= 1.0 - 0.55 * cone;
  float blue = smoothstep(0.3, 0.05, y) * smoothstep(0.35, 0.9, r);
  col = mix(col, vec3(0.25, 0.4, 1.0), blue * 0.8);
  float a = body * (1.0 - 0.6 * blue);
  gl_FragColor = vec4(col * a * uGain, 1.0);
}
`;
const HALO_VERT = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 c = viewMatrix * modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  c.xy += position.xy * uSize;
  gl_Position = projectionMatrix * c;
}
`;
const HALO_FRAG = /* glsl */ `
uniform float uGain;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - 0.5) * 2.0;
  float r2 = dot(d, d);
  float g = (0.55 * exp(-r2 * 26.0) + 0.45 * exp(-r2 * 5.5)) * smoothstep(1.0, 0.7, r2);
  gl_FragColor = vec4(uColor * g * uGain, 1.0);
}
`;

// ---- the inkwell and the quill ---------------------------------------------------------------------

function inkwellGeometry(): BufferGeometry {
  const prof = [
    [0.0, 0.0],
    [0.4, 0.0],
    [0.45, 0.02],
    [0.47, 0.06],
    [0.47, 0.34],
    [0.44, 0.43],
    [0.3, 0.52],
    [0.18, 0.57],
    [0.16, 0.6],
    [0.16, 0.68],
    [0.2, 0.7],
    [0.205, 0.74],
    [0.18, 0.76],
    [0.135, 0.75],
    [0.13, 0.66],
    [0.0, 0.64],
  ].map(([r, y]) => new Vector2(r, y));
  const g = new LatheGeometry(prof, 56);
  const p = g.getAttribute('position');
  const col = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const rr = Math.hypot(p.getX(i), p.getZ(i));
    // the ink's surface black, the glass a dark bottle green
    const ink = y < 0.67 && y > 0.6 && rr < 0.135 ? 1 : 0;
    const k = ink ? 0.25 : 1;
    col.set([k, k, k, 0.5], i * 4);
  }
  g.setAttribute('color', new BufferAttribute(col, 4));
  g.translate(INKWELL.x, 0, INKWELL.z);
  return g;
}

/** The quill: where its shaft leaves the inkwell and where its tip is. */
const QUILL_BASE: V3 = [INKWELL.x, 0.35, INKWELL.z];
const QUILL_DIR = new Vector3(-0.3, 0.88, -0.34).normalize();
const QUILL_LEN = 3.7;

/**
 * The feather's vane (u along the shaft from where the vane starts to the tip, v from the rachis
 * out to the edge): warm off-white barbs combed toward the tip in clumps, a few splits, a soft
 * grey-brown toward the tip and in faint bars, the downy afterfeather at the base; alpha cut.
 */
function featherArt(): CanvasTexture {
  const W = 1024;
  const H = 128;
  const { c, g } = canvas(W, H);
  const r = seq(79, 'feather');
  g.clearRect(0, 0, W, H);
  // the vane, clump by clump: each clump a band of barbs slanting toward the tip, its outer end ragged
  let u = 0;
  while (u < W) {
    const cw = 6 + r() * 16;
    // an old quill: the vane split open in many places (a few wide gaps), barred grey-brown, its tip dark
    const split = r() < 0.32;
    const reach = (split ? 0.4 + r() * 0.35 : 0.88 + r() * 0.12) * H;
    const t = u / W;
    const tip = smooth(0.7, 1.0, t);
    const bar = 0.5 + 0.5 * Math.sin(t * 34 + 0.7);
    const L = 74 - 30 * tip - 14 * bar * (1 - tip) + (r() - 0.5) * 7;
    for (let k = 0; k < cw; k += 2) {
      const x0 = u + k;
      const len = reach * (0.92 + 0.08 * r());
      g.strokeStyle = `hsla(${30 + r() * 8},${20 - 8 * tip}%,${L + (r() - 0.5) * 8}%,1)`;
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(x0, 0);
      g.quadraticCurveTo(x0 + len * 0.18, len * 0.55, x0 + len * 0.5, len);
      g.stroke();
    }
    u += cw + (split ? 5 + r() * 12 : 0.5);
  }
  // the afterfeather: soft down near the base
  for (let k = 0; k < 260; k++) {
    const x = r() * W * 0.12;
    const y = r() * H;
    g.strokeStyle = `rgba(236,226,206,${0.35 + 0.4 * r()})`;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x, 0);
    g.quadraticCurveTo(x + 20 * r(), y * 0.6, x + 30 * (r() - 0.3), y);
    g.stroke();
  }
  // the rachis' own row (the shaft's uv sits on v = 0)
  g.fillStyle = 'rgb(238,228,204)';
  g.fillRect(0, 0, W, 4);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  // v = 0 is the canvas' top row (the rachis)
  t.flipY = false;
  return t;
}

function quillGeometry(): BufferGeometry {
  const n = 48;
  const side = new Vector3().crossVectors(QUILL_DIR, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(side, QUILL_DIR).normalize();
  // the shaft, curving a little backward toward its tip
  const shaft = (t: number): Vector3 =>
    new Vector3(...QUILL_BASE)
      .addScaledVector(QUILL_DIR, QUILL_LEN * t)
      .addScaledVector(up, -0.22 * t * t)
      .addScaledVector(side, 0.08 * t * t * t);
  const pts: V3[] = [];
  for (let i = 0; i <= 30; i++) {
    const p = shaft(i / 30);
    pts.push([p.x, p.y, p.z]);
  }
  const rachis = tubeAlong(pts, 0.032, 8, () => [0.95, 0.93, 0.88, 1], 0.75);
  // the shaft on the texture's own row (v = 0), a little darker toward the nib
  {
    const uv = rachis.getAttribute('uv');
    const col = rachis.getAttribute('color');
    for (let i = 0; i < uv.count; i++) {
      const t = uv.getY(i);
      uv.setXY(i, Math.max(0.001, (t - 0.22) / 0.78), 0.005);
      const k = t < 0.2 ? 0.7 + 0.3 * (t / 0.2) : 1;
      col.setXYZW(i, 0.95 * k, 0.92 * k, 0.86 * k, 1);
    }
  }
  // the vanes: two strips, the barbs angled toward the tip, splits here and there
  const splits = [0.42, 0.58, 0.71, 0.83].map((s, k) => ({ s: s + 0.03 * (rand(71, 'split', k) - 0.5), side: k % 2 ? 1 : -1 }));
  const vanes: BufferGeometry[] = [];
  for (const sd of [-1, 1]) {
    const W = sd < 0 ? 0.3 : 0.42;
    vanes.push(
      gridGeometry(
        n,
        5,
        (i, j) => {
          const s = 0.22 + (0.78 * i) / n;
          const v = j / 5;
          let w = W * Math.pow(Math.sin(Math.PI * Math.min(1, (s - 0.22) / 0.8)), 0.55);
          for (const sp of splits) if (sp.side === sd) w *= 1 - 0.55 * Math.exp(-(((s - sp.s) / 0.012) ** 2)) * smooth(0.3, 1, v);
          const base = shaft(s);
          const tang = shaft(Math.min(1, s + 0.01)).sub(shaft(Math.max(0, s - 0.01))).normalize();
          const p = base
            .addScaledVector(side, sd * w * v)
            .addScaledVector(tang, 0.16 * w * v)
            .addScaledVector(up, -0.06 * v * v);
          return [p.x, p.y, p.z];
        },
        (i, j) => [i / n, j / 5],
        (i, j) => {
          // the texture carries the colour: here only a little shade toward the rachis' fold
          const v = j / 5;
          const k = 0.88 + 0.12 * v;
          // alpha 1: three multiplies the vertex alpha into the texture's, which the alpha test cuts
          return [k, k, k, 1];
        },
        () => [up.x, up.y, up.z],
      ),
    );
  }
  const all = [rachis, ...vanes].map((g) => (g.index ? g.toNonIndexed() : g));
  const out = mergeGeometries(all)!;
  [rachis, ...vanes, ...all].forEach((g) => g.dispose());
  return out;
}

// ---- dry leaves -------------------------------------------------------------------------------------

interface LeafSpot {
  x: number;
  z: number;
  y?: number;
  yaw: number;
  len: number;
  seed: number;
  /** linear colours: the leaf's middle, and its edges and tip */
  tone: [number, number, number];
  tone2: [number, number, number];
}
const OCHRE: [number, number, number] = [0.44, 0.15, 0.035];
const RUST: [number, number, number] = [0.32, 0.085, 0.026];
const BROWN: [number, number, number] = [0.17, 0.08, 0.032];
const DARK: [number, number, number] = [0.09, 0.045, 0.02];
const YELLOW: [number, number, number] = [0.5, 0.2, 0.04];
const RED: [number, number, number] = [0.3, 0.05, 0.03];
const LEAVES: LeafSpot[] = [
  { x: -8.4, z: 7.8, yaw: 0.6, len: 1.45, seed: 1, tone: OCHRE, tone2: RUST },
  { x: -7.4, z: 8.7, y: 0.03, yaw: -0.9, len: 1.2, seed: 2, tone: RUST, tone2: BROWN },
  { x: -12.3, z: 2.4, yaw: 2.4, len: 1.25, seed: 3, tone: BROWN, tone2: DARK },
  { x: -11.7, z: 7.4, yaw: 1.2, len: 1.1, seed: 4, tone: YELLOW, tone2: OCHRE },
  { x: -3.4, z: 7.7, yaw: -2.2, len: 1.3, seed: 5, tone: RED, tone2: BROWN },
  { x: 1.6, z: 8.9, yaw: 0.3, len: 1.15, seed: 6, tone: OCHRE, tone2: BROWN },
  { x: 6.1, z: 7.9, yaw: 2.8, len: 1.35, seed: 7, tone: RUST, tone2: DARK },
  { x: 9.7, z: 3.3, yaw: -0.8, len: 1.2, seed: 8, tone: BROWN, tone2: RUST },
  { x: 10.6, z: -3.8, yaw: 1.9, len: 1.05, seed: 9, tone: YELLOW, tone2: RUST },
  { x: -15.2, z: -4.6, yaw: 0.4, len: 1.2, seed: 10, tone: RUST, tone2: BROWN },
];

/**
 * A dry oak leaf: deeply lobed, folded along its midrib (its two halves catch the light
 * differently), its edges curled up, arched or saddled, twisted a little; coloured from its middle
 * to its rusty edges and tip, the midrib and veins paler, a few dark spots; its stem.
 */
function leafGeometry(l: LeafSpot): BufferGeometry {
  const r = (k: number) => rand(72, 'leaf' + l.seed, k);
  const nU = 28;
  const nV = 12;
  const lobes = 4 + Math.floor(r(0) * 2);
  const ph = r(5) * 0.8;
  // dry leaves curl hard: folded along the midrib, the edges rolled up, the tip lifting
  const fold = 0.2 + 0.2 * r(6);
  const curl = 0.22 + 0.2 * r(1);
  const arch = (r(2) - 0.4) * 0.12;
  const twist = (r(3) - 0.5) * 0.35;
  const width = (t: number, s: number) => {
    const lobe = 0.55 + 0.45 * Math.pow(Math.abs(Math.sin(Math.PI * lobes * t + (s > 0 ? ph : 0) + 0.3)), 0.35);
    return 0.36 * l.len * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.85) * 1.01)), 0.7) * lobe;
  };
  const local = (i: number, j: number): V3 => {
    const t = i / nU;
    const s = (j / nV) * 2 - 1;
    const x = s * width(t, s);
    const y = t * l.len;
    const z = fold * Math.abs(x) + curl * l.len * Math.abs(s) ** 3 * (0.3 + 0.7 * Math.sin(Math.PI * t)) + arch * l.len * 4 * t * (1 - t) + twist * x * (t - 0.4) + 0.18 * l.len * t ** 4;
    return [x, z, y];
  };
  const pts: V3[] = [];
  for (let j = 0; j <= nV; j++) for (let i = 0; i <= nU; i++) pts.push(local(i, j));
  const minY = Math.min(...pts.map((p) => p[1]));
  const c = Math.cos(l.yaw);
  const sn = Math.sin(l.yaw);
  const baseY = (l.y ?? 0) + 0.006 - minY;
  const place = (p: V3): V3 => [l.x + p[0] * c + p[2] * sn, baseY + p[1], l.z - p[0] * sn + p[2] * c];
  const g = gridGeometry(
    nU,
    nV,
    (i, j) => place(local(i, j)),
    (i, j) => [i / nU, j / nV],
    (i, j) => {
      const t = i / nU;
      const sa = Math.abs((j / nV) * 2 - 1);
      const m = Math.min(1, 0.65 * smooth(0.35, 1, sa) + 0.5 * smooth(0.6, 1, t) + 0.25 * fbm2(t * 3, sa * 2, 74 + l.seed));
      const base = [0, 1, 2].map((k) => l.tone[k] + (l.tone2[k] - l.tone[k]) * m);
      // the midrib and the veins running out to the lobes, paler; dark spots
      const rib = Math.exp(-((sa / 0.1) ** 2));
      const vf = (t * lobes * 2 - sa * 1.3) % 2;
      const vein = Math.exp(-(((vf < 0 ? vf + 2 : vf) - 1) ** 2) / 0.02) * smooth(0.1, 0.3, sa) * (1 - smooth(0.7, 0.95, sa));
      const spot = rand(73, 'spot' + l.seed, i * 31 + j) < 0.05 ? 0.6 : 1;
      const k = (1 + 0.5 * rib + 0.22 * vein) * spot * (0.9 + 0.2 * fbm2(t * 6, sa * 4, 75 + l.seed));
      return [base[0] * k, base[1] * k, base[2] * k, 0.15];
    },
    () => [0, 1, 0],
  );
  const stem = tubeAlong(
    [place([0, fold * 0.01 + 0.02, 0.02]), place([0, 0.06, -0.12 * l.len]), place([0.04, 0.1, -0.24 * l.len])],
    0.028,
    6,
    () => [l.tone2[0] * 0.8, l.tone2[1] * 0.8, l.tone2[2] * 0.8, 0.15],
    0.5,
  );
  const out = mergeGeometries([g.toNonIndexed(), stem.toNonIndexed()])!;
  g.dispose();
  stem.dispose();
  return out;
}

// ---- the moonbeam: the window's light in the room's dusty air ---------------------------------------

/** the air the beam is drawn in (centre, half size): over the desk, under the window */
const BEAM_BOX = { c: new Vector3(-2, 9, 1), h: new Vector3(23, 9, 17) };
/** (0.003 hazed the whole room: no true blacks in its corners) */
const BEAM_DENSITY = 0.0019;

const BEAM_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
/**
 * The beam: a march along the view ray through the air box, up to the desk or the book (both
 * analytic), summing the window's cookie where the book does not shadow it, with slowly drifting
 * dust; additive, so the lightning flashes it with the window.
 */
const BEAM_FRAG = /* glsl */ `
uniform float uSbTime;
uniform float uBeam;
uniform vec3 uBoxC;
uniform vec3 uBoxH;
varying vec3 vWorld;
${NOISE3_GLSL}
${ROOM_PARS}
float beamBox(vec3 ro, vec3 rd, vec3 c, vec3 h, out float tFar) {
  vec3 inv = 1.0 / rd;
  vec3 t0 = (c - h - ro) * inv;
  vec3 t1 = (c + h - ro) * inv;
  vec3 tn = min(t0, t1);
  vec3 tf = max(t0, t1);
  float a = max(max(tn.x, tn.y), tn.z);
  tFar = min(min(tf.x, tf.y), tf.z);
  return tFar > max(a, 0.0) ? a : 1e9;
}
// where a ray first meets the book (its block or its cover), 1e9 if it misses
float beamBook(vec3 ro, vec3 rd) {
  float tf;
  float t = beamBox(ro, rd, uRoomBodyC, uRoomBodyH, tf);
  vec3 lo = (uRoomCoverInv * vec4(ro, 1.0)).xyz;
  vec3 ld = mat3(uRoomCoverInv) * rd;
  return min(t, beamBox(lo, ld, uRoomCoverC, uRoomCoverH, tf));
}
void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  float tFar;
  float tIn = beamBox(ro, rd, uBoxC, uBoxH, tFar);
  if (tIn > 1e8) discard;
  tIn = max(tIn, 0.0);
  float tEnd = tFar;
  if (rd.y < 0.0) tEnd = min(tEnd, -ro.y / rd.y);
  // the room's walls
  if (rd.z < 0.0) tEnd = min(tEnd, (${WALL.z.toFixed(3)} - ro.z) / rd.z);
  if (rd.x < 0.0) tEnd = min(tEnd, (${WALL.x.toFixed(3)} - ro.x) / rd.x);
  tEnd = min(tEnd, max(beamBook(ro, rd), tIn));
  if (tEnd <= tIn) discard;
  const int N = 56;
  float dt = (tEnd - tIn) / float(N);
  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float acc = 0.0;
  for (int i = 0; i < N; i++) {
    vec3 p = ro + rd * (tIn + (float(i) + j) * dt);
    vec3 q = p - uRoomWinO;
    float m = roomWindowS(vec2(dot(q, uRoomWinU), dot(q, uRoomWinV)) * uRoomWinScale, 0.32);
    if (m < 0.003) continue;
    if (beamBook(p, uRoomWinL) < 1e8) continue;
    float dn = aivFbm3(p * 0.38 + vec3(uSbTime * 0.06, -uSbTime * 0.035, uSbTime * 0.025));
    // motes in clear air: next to nothing between them (a floor of haze veiled the whole room)
    float dust = 0.008 + 2.6 * dn * dn;
    acc += m * dust * exp(-p.y * 0.07) * dt;
  }
  gl_FragColor = vec4(uRoomWin * acc * uBeam, 1.0);
}
`;

// ---- the room: stone walls, the back window, books and bottles along the desk's back -----------------

/** the window's reveal depth, the transom's height, the outline of its pointed arch */
const REVEAL = 0.85;
const TRANSOM_Y = 3.95;
function archOutline(inset = 0): [number, number][] {
  const x0 = BACK_WIN.x0 + inset;
  const x1 = BACK_WIN.x1 - inset;
  const w = BACK_WIN.x1 - BACK_WIN.x0;
  const out: [number, number][] = [
    [x0, BACK_WIN.sill + inset],
    [x1, BACK_WIN.sill + inset],
  ];
  const n = 14;
  // the right arc about the left springing point, then the left arc about the right one (an equilateral arch)
  for (let k = 0; k <= n; k++) {
    const a = (Math.PI / 3) * (k / n);
    out.push([BACK_WIN.x0 + Math.cos(a) * (w - inset), BACK_WIN.spring + Math.sin(a) * (w - inset)]);
  }
  for (let k = 1; k <= n; k++) {
    const a = (2 * Math.PI) / 3 + (Math.PI / 3) * (k / n);
    out.push([BACK_WIN.x1 + Math.cos(a) * (w - inset), BACK_WIN.spring + Math.sin(a) * (w - inset)]);
  }
  return out;
}
const ARCH_TOP = BACK_WIN.spring + (BACK_WIN.x1 - BACK_WIN.x0) * Math.sin(Math.PI / 3);

/** UVs in world units for stone (by each face's main axis) and an RGBA colour (AO, rim mask) per vertex. */
function stoneUV(g: BufferGeometry, ao: (p: Vector3, n: Vector3) => number, rimMask = 0.25): BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  if (!ng.getAttribute('normal')) ng.computeVertexNormals();
  const p = ng.getAttribute('position');
  const n = ng.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  const col = new Float32Array(p.count * 4);
  const P = new Vector3();
  const N = new Vector3();
  for (let i = 0; i < p.count; i++) {
    P.set(p.getX(i), p.getY(i), p.getZ(i));
    N.set(n.getX(i), n.getY(i), n.getZ(i));
    const ax = Math.abs(N.x);
    const ay = Math.abs(N.y);
    const az = Math.abs(N.z);
    const [u, v] = ax >= ay && ax >= az ? [P.z, P.y] : ay >= az ? [P.x, P.z] : [P.x, P.y];
    uv.set([u / 6, v / 3], i * 2);
    const k = ao(P, N);
    col.set([k, k, k, rimMask], i * 4);
  }
  ng.setAttribute('uv', new BufferAttribute(uv, 2));
  ng.setAttribute('color', new BufferAttribute(col, 4));
  return ng;
}

/** The walls, the window's reveal, sill, mullion and transom: one stone mesh. */
function stoneGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const X1 = 40;
  const Y0 = -14;
  const Y1 = 40;
  // the back wall with the window's hole
  const s = new Shape();
  s.moveTo(WALL.x, Y0);
  s.lineTo(X1, Y0);
  s.lineTo(X1, Y1);
  s.lineTo(WALL.x, Y1);
  s.closePath();
  const hole = new Shape();
  archOutline().forEach(([x, y], i) => (i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)));
  hole.closePath();
  s.holes.push(hole);
  const back = new ShapeGeometry(s, 1);
  back.translate(0, 0, WALL.z);
  // darker low behind the desk and toward the corner
  const lowAO = (p: Vector3) => 0.55 + 0.45 * smooth(-1.5, 3.5, p.y) * (0.6 + 0.4 * smooth(WALL.x, WALL.x + 5, p.x));
  parts.push(stoneUV(back, lowAO));
  // the left wall
  const left = new PlaneGeometry(60, Y1 - Y0);
  left.rotateY(Math.PI / 2);
  left.translate(WALL.x, (Y0 + Y1) / 2, WALL.z + 30);
  parts.push(stoneUV(left, (p) => 0.6 + 0.4 * smooth(-1.5, 3.5, p.y) * (0.6 + 0.4 * smooth(WALL.z, WALL.z + 5, p.z))));
  // the reveal: quads round the arch, facing into the opening
  {
    const o = archOutline();
    const cx = (BACK_WIN.x0 + BACK_WIN.x1) / 2;
    const P: number[] = [];
    for (let i = 0; i < o.length; i++) {
      const a = o[i];
      const b = o[(i + 1) % o.length];
      const z0 = WALL.z;
      const z1 = WALL.z - REVEAL;
      const quad = [a[0], a[1], z0, b[0], b[1], z0, b[0], b[1], z1, a[0], a[1], z0, b[0], b[1], z1, a[0], a[1], z1];
      // facing the opening's centre line: flip the winding if its normal points away
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const nx = -ey;
      const ny = ex;
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const toward = (cx - mx) * nx + ((BACK_WIN.sill + ARCH_TOP) / 2 - my) * ny;
      // the triangle (a0, b0, b1)'s normal is along (nx, ny): flip it where that points away from the opening
      if (toward < 0) for (let t = 0; t < quad.length; t += 9) for (let c = 0; c < 3; c++) [quad[t + 3 + c], quad[t + 6 + c]] = [quad[t + 6 + c], quad[t + 3 + c]];
      P.push(...quad);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(P), 3));
    g.computeVertexNormals();
    // make sure: the sill's reveal (a horizontal quad at the bottom) faces up
    const n = g.getAttribute('normal');
    if (n.getY(0) < -0.5) {
      const arr = g.getAttribute('position').array as Float32Array;
      for (let t = 0; t < arr.length; t += 9) for (let c = 0; c < 3; c++) [arr[t + 3 + c], arr[t + 6 + c]] = [arr[t + 6 + c], arr[t + 3 + c]];
      g.computeVertexNormals();
    }
    parts.push(stoneUV(g, (p) => 0.5 + 0.35 * smooth(WALL.z - REVEAL, WALL.z, p.z)));
  }
  // the sill, the mullion, the transom
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, ao: number) => {
    const b = new BoxGeometry(w, h, d);
    b.translate(x, y, z);
    parts.push(stoneUV(b, (p) => ao * (0.75 + 0.25 * smooth(y - h / 2, y + h / 2, p.y))));
  };
  const cx = (BACK_WIN.x0 + BACK_WIN.x1) / 2;
  box(BACK_WIN.x1 - BACK_WIN.x0 + 0.9, 0.32, REVEAL + 0.5, cx, BACK_WIN.sill - 0.16, WALL.z - REVEAL / 2 + 0.25, 0.95);
  box(0.34, ARCH_TOP - BACK_WIN.sill - 1.2, 0.5, cx, (ARCH_TOP + BACK_WIN.sill - 1.2) / 2, WALL.z - REVEAL * 0.55, 0.85);
  box(BACK_WIN.x1 - BACK_WIN.x0, 0.26, 0.46, cx, TRANSOM_Y, WALL.z - REVEAL * 0.55, 0.85);
  const out = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return out;
}

/** Dressed stone: courses of blocks, worn and chipped, mortar between (colour; height in R for the bump). */
function stoneArt(): { map: CanvasTexture; bump: CanvasTexture } {
  const W = 1024;
  const H = 512;
  const U = W / 6;
  const { c, g } = canvas(W, H);
  const { c: bc, g: b } = canvas(W, H);
  const r = seq(74, 'stone');
  g.fillStyle = '#3a3532';
  g.fillRect(0, 0, W, H);
  b.fillStyle = '#202020';
  b.fillRect(0, 0, W, H);
  const courses = 4;
  const CH = H / courses;
  for (let row = 0; row < courses; row++) {
    let x = -r() * U * 1.2;
    while (x < W) {
      const len = U * (1.0 + r() * 1.1);
      const tone = 0.85 + r() * 0.3;
      const warm = r();
      const R = (104 + 18 * warm) * tone;
      const G = (98 + 8 * warm) * tone;
      const B = (94 - 6 * warm) * tone;
      // each block drawn wrapped (the texture tiles)
      for (const ox of [-W, 0, W]) {
        const x0 = x + ox + 3;
        const y0 = row * CH + 3;
        const w = len - 6;
        const h = CH - 6;
        g.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
        g.beginPath();
        g.roundRect(x0, y0, w, h, 5);
        g.fill();
        // weathering: a darker lower edge, a lighter worn top
        const grad = g.createLinearGradient(0, y0, 0, y0 + h);
        grad.addColorStop(0, 'rgba(255,240,220,0.06)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.22)');
        g.fillStyle = grad;
        g.fillRect(x0, y0, w, h);
        b.fillStyle = '#b8b8b8';
        b.beginPath();
        b.roundRect(x0, y0, w, h, 8);
        b.fill();
      }
      x += len;
    }
  }
  // pitting and chips, stains running down
  for (let k = 0; k < 900; k++) {
    const x = r() * W;
    const y = r() * H;
    const rr = 1 + r() * 5;
    g.fillStyle = `rgba(${r() < 0.5 ? '20,16,14' : '120,112,104'},${0.12 + r() * 0.2})`;
    g.beginPath();
    g.arc(x, y, rr, 0, TAU);
    g.fill();
    b.fillStyle = `rgba(40,40,40,${0.3 + r() * 0.4})`;
    b.beginPath();
    b.arc(x, y, rr * 0.8, 0, TAU);
    b.fill();
  }
  for (let k = 0; k < 14; k++) {
    const x = r() * W;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(10,8,8,0)');
    grad.addColorStop(r(), 'rgba(10,8,8,0.16)');
    grad.addColorStop(1, 'rgba(10,8,8,0)');
    g.fillStyle = grad;
    g.fillRect(x, 0, 8 + r() * 30, H);
  }
  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.anisotropy = 8;
  const bump = new CanvasTexture(bc);
  bump.colorSpace = LinearSRGBColorSpace;
  bump.wrapS = bump.wrapT = RepeatWrapping;
  return { map, bump };
}

/**
 * The night through the back window (its glass, quarry-glazed): the sky deep blue overhead and
 * cyan at the horizon, moonlit cloud banks, the far hills and a castle on its crag (the story's
 * own, far off), a bare branch reaching across; the lead cames and the panes a little uneven.
 * Canvas: the window's bounding box (x0..x1, sill..the arch's top), top = up.
 */
function glassArt(): CanvasTexture {
  const W = 512;
  const H = 1024;
  const { c, g } = canvas(W, H);
  const r = seq(75, 'glass');
  const wx = BACK_WIN.x1 - BACK_WIN.x0;
  const hy = ARCH_TOP - BACK_WIN.sill;
  const py = (y: number) => H - ((y - BACK_WIN.sill) / hy) * H;
  const px = (x: number) => ((x - BACK_WIN.x0) / wx) * W;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#081626');
  sky.addColorStop(0.55, '#123650');
  sky.addColorStop(0.8, '#215d78');
  sky.addColorStop(0.9, '#3a8aa2');
  sky.addColorStop(1, '#4aa2b6');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // the moon's glow from the right (it stands off to the right of the window)
  const glow = g.createRadialGradient(W * 1.15, py(5.5), 0, W * 1.15, py(5.5), W * 1.1);
  glow.addColorStop(0, 'rgba(170,225,235,0.55)');
  glow.addColorStop(1, 'rgba(170,225,235,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  // cloud banks: soft lobes, lit from the right
  for (let k = 0; k < 26; k++) {
    const y = py(2.6 + r() * 9);
    const x = r() * W;
    const rx = 40 + r() * 120;
    const ry = 10 + r() * 26;
    const cg = g.createRadialGradient(x + rx * 0.3, y - ry * 0.3, 0, x, y, rx);
    cg.addColorStop(0, `rgba(120,190,205,${0.25 + r() * 0.2})`);
    cg.addColorStop(0.6, 'rgba(40,90,110,0.18)');
    cg.addColorStop(1, 'rgba(20,50,70,0)');
    g.fillStyle = cg;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fill();
  }
  // stars overhead
  for (let k = 0; k < 40; k++) {
    g.fillStyle = `rgba(220,240,255,${0.4 + r() * 0.5})`;
    g.fillRect(r() * W, r() * py(7), 1.5, 1.5);
  }
  // the far hills, and the castle on its crag to the left
  g.fillStyle = '#0d2633';
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, py(1.35 + 0.35 * Math.sin(x * 0.012 + 1.0) + 0.15 * fbm2(x * 0.02, 1, 76)));
  g.lineTo(W, H);
  g.fill();
  g.fillStyle = '#0a1d28';
  const cx = px(BACK_WIN.x0 + 2.6);
  g.beginPath();
  g.moveTo(cx - 70, py(1.4));
  g.lineTo(cx - 34, py(2.3));
  g.lineTo(cx - 20, py(2.55));
  g.lineTo(cx + 30, py(2.5));
  g.lineTo(cx + 64, py(1.5));
  g.lineTo(cx + 70, py(1.2));
  g.closePath();
  g.fill();
  const tower = (x: number, w: number, top: number) => {
    g.fillRect(x - w / 2, py(top), w, py(2.45) - py(top));
    g.beginPath();
    g.moveTo(x - w / 2 - 3, py(top));
    g.lineTo(x, py(top + 0.55));
    g.lineTo(x + w / 2 + 3, py(top));
    g.fill();
  };
  tower(cx - 12, 12, 3.4);
  tower(cx + 4, 9, 3.85);
  tower(cx + 18, 10, 3.2);
  g.fillStyle = 'rgba(255,190,110,0.9)';
  g.fillRect(cx + 2, py(3.4), 2, 3);
  g.fillRect(cx - 14, py(3.0), 2, 3);
  // a bare branch reaching across from the right
  g.strokeStyle = '#06121a';
  g.lineCap = 'round';
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    if (depth <= 0 || w < 0.6) return;
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * len * 0.3, (y + y2) / 2 + (r() - 0.5) * len * 0.3, x2, y2);
    g.stroke();
    branch(x2, y2, a + (r() - 0.5) * 0.9, len * (0.62 + r() * 0.2), w * 0.64, depth - 1);
    if (r() < 0.7) branch(x2, y2, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5), len * (0.5 + r() * 0.2), w * 0.55, depth - 1);
  };
  branch(W + 10, py(6.2), Math.PI * 1.05, 160, 13, 6);
  // the panes: quarries in a lead grid, each a little its own tint
  const QW = W / 7;
  const QH = (0.85 / hy) * H;
  for (let j = 0; j * QH < H; j++)
    for (let i = 0; i < 7; i++) {
      const t = r();
      g.fillStyle = t < 0.5 ? `rgba(255,255,255,${0.02 + 0.05 * r()})` : `rgba(0,20,30,${0.04 + 0.1 * r()})`;
      g.fillRect(i * QW, H - (j + 1) * QH, QW, QH);
    }
  g.strokeStyle = 'rgba(6,10,12,0.92)';
  g.lineWidth = 3.2;
  for (let i = 1; i < 7; i++) {
    g.beginPath();
    g.moveTo(i * QW, 0);
    g.lineTo(i * QW, H);
    g.stroke();
  }
  for (let j = 1; j * QH < H; j++) {
    g.beginPath();
    g.moveTo(0, H - j * QH);
    g.lineTo(W, H - j * QH);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

interface BookSpot {
  x: number;
  w: number;
  h: number;
  d: number;
  lean: number;
  color: [number, number, number];
}
const SHELF_COLORS: [number, number, number][] = [
  [0.22, 0.07, 0.1],
  [0.26, 0.06, 0.05],
  [0.08, 0.16, 0.1],
  [0.08, 0.1, 0.18],
  [0.2, 0.12, 0.07],
  [0.07, 0.06, 0.06],
  [0.3, 0.2, 0.08],
  [0.07, 0.17, 0.17],
];

/** The books along the desk's back left (standing, a few leaning, a stack lying) and two bottles by the window. */
function shelfGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const r = (k: number, i: number) => rand(77, 'shelf' + k, i);
  const zBack = -13.95;
  let x = WALL.x + 0.5;
  let i = 0;
  const spots: BookSpot[] = [];
  while (x < BACK_WIN.x0 + 1.4) {
    const w = 0.26 + 0.32 * r(0, i);
    const h = 1.7 + 1.3 * r(1, i) * r(1, i + 50) + (r(2, i) < 0.2 ? 0.6 : 0);
    const d = 1.15 + 0.5 * r(3, i);
    const lean = i === 9 ? -0.24 : (r(4, i) - 0.5) * 0.04;
    const color = SHELF_COLORS[Math.floor(r(5, i) * SHELF_COLORS.length)];
    spots.push({ x: x + w / 2, w, h, d, lean, color });
    x += w + 0.01 + (r(6, i) < 0.15 ? 0.12 : 0) + (i === 9 ? 0.55 : 0);
    i++;
  }
  const bookBox = (s: BookSpot, place: (g: BufferGeometry) => void, lying = false) => {
    const b = new BoxGeometry(s.w, s.h, s.d, 1, 12, 1).toNonIndexed();
    const p = b.getAttribute('position');
    const n = b.getAttribute('normal');
    const col = new Float32Array(p.count * 4);
    for (let k = 0; k < p.count; k++) {
      const v = (p.getY(k) + s.h / 2) / s.h;
      const spine = !lying && n.getZ(k) > 0.5;
      // the spine's gilt bands near its head and tail; the top edge (a lying book's fore-edge) shows the pages' cream
      const band = spine ? Math.exp(-(((v - 0.12) / 0.03) ** 2)) + Math.exp(-(((v - 0.86) / 0.03) ** 2)) : 0;
      const top = lying ? n.getX(k) > 0.5 : n.getY(k) > 0.5;
      const ao = 0.7 + 0.3 * smooth(0, 0.3, v);
      const c: [number, number, number] = top ? [0.24, 0.2, 0.14] : [s.color[0] * ao * 0.7, s.color[1] * ao * 0.7, s.color[2] * ao * 0.7];
      col.set([c[0] + band * 0.5, c[1] + band * 0.34, c[2] + band * 0.1, spine ? 0.45 : 0.3], k * 4);
    }
    b.setAttribute('color', new BufferAttribute(col, 4));
    place(b);
    parts.push(b);
  };
  for (const s of spots)
    bookBox(s, (b) => {
      // leaning: about the bottom edge on the side it falls toward
      const pivot = s.lean < 0 ? s.w / 2 : -s.w / 2;
      b.translate(-pivot, s.h / 2, 0);
      b.rotateZ(s.lean);
      b.translate(s.x + pivot, 0, zBack + s.d / 2);
    });
  // a stack lying in front of the window
  let y = 0;
  for (let k = 0; k < 3; k++) {
    const s: BookSpot = { x: 0, w: 2.6 - k * 0.3, h: 0.34 + 0.1 * r(7, k), d: 1.7 - k * 0.15, lean: 0, color: SHELF_COLORS[(k * 3 + 1) % SHELF_COLORS.length] };
    const yy = y;
    bookBox(s, (b) => {
      b.translate(0, s.h / 2, 0);
      b.rotateY((r(8, k) - 0.5) * 0.3);
      b.translate(BACK_WIN.x0 + 2.4, yy, zBack + 1.1);
    }, true);
    y += s.h;
  }
  // two bottles: dark glass, a long neck, a cork
  for (const [bx, bz, bh, br] of [
    [BACK_WIN.x0 + 4.9, zBack + 1.0, 2.3, 0.36],
    [BACK_WIN.x0 + 5.8, zBack + 1.7, 1.5, 0.3],
  ] as const) {
    const prof = [
      [0, 0],
      [br, 0],
      [br * 1.04, 0.05],
      [br, bh * 0.55],
      [br * 0.75, bh * 0.66],
      [br * 0.3, bh * 0.74],
      [br * 0.27, bh * 0.93],
      [br * 0.33, bh * 0.95],
      [br * 0.3, bh],
      [0, bh],
    ].map(([a, b2]) => new Vector2(a, b2));
    const l = new LatheGeometry(prof, 28).toNonIndexed();
    l.translate(bx, 0, bz);
    const p = l.getAttribute('position');
    const col = new Float32Array(p.count * 4);
    for (let k = 0; k < p.count; k++) {
      const cork = p.getY(k) > bh * 0.93 ? 1 : 0;
      col.set(cork ? [0.35, 0.24, 0.14, 0.4] : [0.05, 0.11, 0.08, 0.6], k * 4);
    }
    l.setAttribute('color', new BufferAttribute(col, 4));
    l.deleteAttribute('uv');
    parts.push(l);
  }
  parts.forEach((p) => p.deleteAttribute('uv'));
  const out = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return out;
}

// ---- the desk ---------------------------------------------------------------------------------------

export interface Desk2Props {
  /** the film frame (the flame, the lightning) */
  f: number;
  /** the props standing on the desk (the candle, the pumpkin, the inkwell) and the room round it:
   * off inside the story, where they would rise past the page's edge */
  props?: boolean;
  /** the moonbeam in the room's air (0: none; the film passes 1 − immersion, it is gone by then) */
  beam?: number;
}

/** The desk, its props, the room round it and the room's light. Desk top at y = 0, the book centred on it. */
export function Desk2({ f, props = true, beam = 1 }: Desk2Props) {
  const built = useMemo(() => {
    const art = woodArt();
    const stone = stoneArt();
    const glassTex = glassArt();
    const feather = featherArt();
    const wood = roomMaterial({ kind: 'plain', map: art.map, bumpMap: art.orm, bumpScale: 1.2, roughnessMap: art.orm, roughness: 1, vertexColors: true, breakup: 0.16, scale: 0.9, color2: '#2a1a10', rim: 0.12, ambient: 0.3, ao: 1, hemi: 0.6 });
    // old ivory wax, yellowed, glowing a little with the flame through it (no cool rim: it read blue)
    const wax = roomMaterial({ kind: 'plain', color: '#efd6a8', color2: '#c49a62', vertexColors: true, breakup: 0.12, scale: 0.08, roughness: 0.42, rim: 0.08, ignore: 0, env: 0.6, ambient: 0.55, moon: 0.5, emissive: '#ff9a4c', emissiveIntensity: 0.11 });
    const brass = roomMaterial({ kind: 'iron', color: '#d8b050', color2: '#5a4420', vertexColors: true, metalness: 1, roughness: 0.32, breakup: 0.3, scale: 0.06, bump: 0.2, rim: 0.25, ignore: 0, env: 1 });
    const glass = roomMaterial({ kind: 'plain', color: '#14221f', color2: '#0a1210', vertexColors: true, roughness: 0.1, breakup: 0.05, rim: 0.6, ignore: 2, env: 1 });
    const quill = roomMaterial({ kind: 'plain', map: feather, alphaTest: 0.45, color: '#ffffff', color2: '#cfc4ae', vertexColors: true, side: DoubleSide, roughness: 0.72, breakup: 0.05, scale: 0.05, rim: 0.1, ignore: 3, ambient: 0.6 });
    const leaf = roomMaterial({ kind: 'plain', color: '#ffffff', color2: '#3a2210', vertexColors: true, side: DoubleSide, roughness: 0.8, breakup: 0.22, scale: 0.08, rim: 0.2, ambient: 0.7 });
    // the room: stone that takes little of the night rig's moon (it is outside), the candle's warmth
    const walls = roomMaterial({ kind: 'stone', map: stone.map, bumpMap: stone.bump, bumpScale: 2.5, color: '#ffffff', color2: '#2c2a2c', vertexColors: true, breakup: 0.18, scale: 1.2, bump: 0.3, roughness: 0.95, rim: 0.1, ambient: 0.14, moon: 0.08, hemi: 0.45 });
    const shelf = roomMaterial({ kind: 'cloth', color: '#ffffff', color2: '#201418', vertexColors: true, breakup: 0.14, scale: 0.25, roughness: 0.8, rim: 0.2, ambient: 0.12, moon: 0.12, env: 0.5, hemi: 0.45 });
    const pane = new MeshBasicMaterial({ map: glassTex, color: new Color(GLASS_GAIN, GLASS_GAIN, GLASS_GAIN), fog: false });
    const flame = new ShaderMaterial({ vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG, uniforms: { uLen: { value: 0.46 }, uWidth: { value: 0.2 }, uSway: { value: 0 }, uGain: { value: 6 } }, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
    const halo = new ShaderMaterial({ vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, uniforms: { uSize: { value: 1.6 }, uGain: { value: 0.6 }, uColor: { value: new Color('#ff9a4a') } }, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
    const beam = new ShaderMaterial({ vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, uniforms: { ...ROOM, uSbTime: NIGHT.uSbTime, uBeam: { value: BEAM_DENSITY }, uBoxC: { value: BEAM_BOX.c }, uBoxH: { value: BEAM_BOX.h }, uRoomWinMul: { value: 1 }, uRoomCandleMul: { value: 0 }, uRoomAO: { value: 0 }, uRoomSelf: { value: 0 }, uRoomIgnore: { value: -1 } }, side: BackSide, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, fog: false });
    const geo = {
      beamBox: new BoxGeometry(BEAM_BOX.h.x * 2, BEAM_BOX.h.y * 2, BEAM_BOX.h.z * 2),
      planks: plankGeometry(),
      holder: holderGeometry(),
      wax: waxGeometry(),
      ink: inkwellGeometry(),
      quill: quillGeometry(),
      leaves: mergeGeometries(LEAVES.map(leafGeometry))!,
      quad: new PlaneGeometry(1, 1),
      stone: stoneGeometry(),
      shelf: shelfGeometry(),
      pane: (() => {
        const p = new PlaneGeometry(BACK_WIN.x1 - BACK_WIN.x0, ARCH_TOP - BACK_WIN.sill);
        p.translate((BACK_WIN.x0 + BACK_WIN.x1) / 2, (ARCH_TOP + BACK_WIN.sill) / 2, WALL.z - REVEAL * 0.72);
        return p;
      })(),
    };
    return { art, stone, glassTex, feather, mats: { wood, wax, brass, glass, quill, leaf, walls, shelf, pane, flame, halo, beam }, geo };
  }, []);
  useLayoutEffect(
    () => () => {
      built.art.map.dispose();
      built.art.orm.dispose();
      built.stone.map.dispose();
      built.stone.bump.dispose();
      built.glassTex.dispose();
      built.feather.dispose();
      Object.values(built.mats).forEach((m) => m.dispose());
      Object.values(built.geo).forEach((g) => g.dispose());
    },
    [built],
  );
  // the room's light at this frame
  const bolt = lightningAt(f);
  const flick = candleFlicker(f, 3);
  const t = f / FPS;
  const sway = 0.12 * Math.sin(TAU * 0.37 * t + 0.4) + 0.07 * Math.sin(TAU * 0.93 * t + 1.3) + 0.04 * Math.sin(TAU * 1.71 * t);
  const pumpkinGlow = props ? candleFlicker(f, 12) : 0;
  // the beam goes as soon as the camera starts into the story (the world grows into the air it is
  // drawn in, and the beam's march does not see the world: it would veil it like glass)
  const beamAmt = smooth(0.85, 1.0, beam);
  useLayoutEffect(() => {
    ROOM.uRoomWin.value.copy(WIN_COLOR).lerp(BOLT_COLOR, Math.min(1, bolt)).multiplyScalar(WIN_BASE * (1 + BOLT_GAIN * bolt));
    const c0 = ROOM.uRoomCandle.value[0];
    const c1 = ROOM.uRoomCandle.value[1];
    if (props) {
      // the flame's light leans with the flame (the glints on the brass and the foil move with it);
      // set a little above the flame, as a painter would, so it pools on the cover and the desk round it
      c0.set(WICK[0] + sway * 0.2, WICK[1] + 0.55, WICK[2] + sway * 0.06, 22.0 * flick);
      // the jack-o'-lantern's candle shines out through its face (a light inside it would be shut in by its capsule)
      const out = DESK_PUMPKIN.scale * 0.56;
      c1.set(DESK_PUMPKIN.x + Math.sin(DESK_PUMPKIN.yaw) * out, DESK_PUMPKIN.scale * 0.34, DESK_PUMPKIN.z + Math.cos(DESK_PUMPKIN.yaw) * out, 7.0 * pumpkinGlow);
    } else {
      c0.w = 0;
      c1.w = 0;
    }
    const capA = ROOM.uRoomCapA.value;
    const capB = ROOM.uRoomCapB.value;
    const far = -50;
    if (props) {
      capA[0].set(CANDLE.x, 0.25, CANDLE.z, 0.19);
      capB[0].set(CANDLE.x, CANDLE_TOP - 0.05, CANDLE.z, 0);
      capA[1].set(DESK_PUMPKIN.x, DESK_PUMPKIN.scale * 0.36, DESK_PUMPKIN.z, DESK_PUMPKIN.scale * 0.42);
      capB[1].set(DESK_PUMPKIN.x, DESK_PUMPKIN.scale * 0.4, DESK_PUMPKIN.z, 0);
      capA[2].set(INKWELL.x, 0.2, INKWELL.z, 0.42);
      capB[2].set(INKWELL.x, 0.45, INKWELL.z, 0);
      const tip = new Vector3(...QUILL_BASE).addScaledVector(QUILL_DIR, QUILL_LEN * 0.92);
      capA[3].set(QUILL_BASE[0], QUILL_BASE[1] + 0.4, QUILL_BASE[2], 0.1);
      capB[3].set(tip.x, tip.y, tip.z, 0);
    } else
      for (let i = 0; i < 4; i++) {
        capA[i].set(0, far, 0, 0);
        capB[i].set(0, far, 0, 0);
      }
    // the back window's sky flashes with the lightning (and so does its reflection in the brass)
    const g = GLASS_GAIN * (1 + 2.2 * bolt);
    built.mats.pane.color.setRGB(g * (1 + 0.25 * bolt), g * (1 + 0.15 * bolt), g);
    ROOM.uRoomGlass.value.set('#3f9fbd').multiplyScalar(1 + 2.2 * bolt);
    const fl = built.mats.flame.uniforms;
    fl.uSway.value = sway;
    fl.uLen.value = 0.46 * (0.94 + 0.12 * (flick - 1) * 4) * (1 + 0.04 * Math.sin(TAU * 2.3 * t));
    fl.uGain.value = 6 * flick;
    built.mats.halo.uniforms.uGain.value = 0.6 * flick;
    built.mats.beam.uniforms.uBeam.value = BEAM_DENSITY * beamAmt;
    // the moonlight's lattice on the desk: it fades as the camera goes into the story (the desk round
    // the book was the brightest broad shape of the crane in), dims as the cover comes down (film/
    // journey.ts COVER_CLOSE) and stays low under the end card: the world, then the words, lead
    (built.mats.wood.userData.room as Record<string, { value: number }>).uRoomWinMul.value = (1 - 0.5 * smooth(CLOSE_FROM + 5, CLOSE_FROM + 24, f)) * (0.3 + 0.7 * smooth(0.6, 1, beam));
  }, [built, bolt, flick, sway, props, pumpkinGlow, t, beamAmt, f, beam]);
  return (
    <group>
      <mesh geometry={built.geo.planks} material={built.mats.wood} receiveShadow />
      {props && (
        <>
          <mesh geometry={built.geo.stone} material={built.mats.walls} receiveShadow />
          <mesh geometry={built.geo.pane} material={built.mats.pane} />
          <mesh geometry={built.geo.shelf} material={built.mats.shelf} castShadow receiveShadow />
          <mesh geometry={built.geo.holder} material={built.mats.brass} castShadow receiveShadow />
          <mesh geometry={built.geo.wax} material={built.mats.wax} castShadow receiveShadow />
          <mesh geometry={built.geo.quad} material={built.mats.flame} position={WICK} frustumCulled={false} renderOrder={5} />
          <mesh geometry={built.geo.quad} material={built.mats.halo} position={[WICK[0], WICK[1] + 0.2, WICK[2]]} frustumCulled={false} renderOrder={6} />
          <mesh geometry={built.geo.ink} material={built.mats.glass} castShadow receiveShadow />
          <mesh geometry={built.geo.quill} material={built.mats.quill} castShadow />
          <Pumpkin seed={12} scale={DESK_PUMPKIN.scale} lit={1} f={f} carve="grin" position={[DESK_PUMPKIN.x, 0, DESK_PUMPKIN.z]} yaw={DESK_PUMPKIN.yaw} />
        </>
      )}
      <mesh geometry={built.geo.leaves} material={built.mats.leaf} castShadow receiveShadow />
      {beamAmt > 0.001 && <mesh geometry={built.geo.beamBox} material={built.mats.beam} position={BEAM_BOX.c} frustumCulled={false} renderOrder={20} />}
    </group>
  );
}

/** Triangle and draw-call counts of the desk (for the budget). */
export function deskStats(): Record<string, number> {
  const g = { planks: plankGeometry(), holder: holderGeometry(), wax: waxGeometry(), ink: inkwellGeometry(), quill: quillGeometry(), leaves: mergeGeometries(LEAVES.map(leafGeometry))!, stone: stoneGeometry(), shelf: shelfGeometry() };
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(g)) {
    out[k] = (v.index ? v.index.count : v.getAttribute('position').count) / 3;
    v.dispose();
  }
  return out;
}
