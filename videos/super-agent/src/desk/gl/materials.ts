/**
 * The Register Desk's materials (synthesis §2, Materials): material is status.
 * - enamel: built plates, reel parts, nameplates (physical, roughness 0.3, clearcoat 0.4, the room
 *   environment at 0.25 for enamel only, orange-peel 0.5%);
 * - graphite: housings and structure (metalness 0.55, roughness 0.42, brushing ±4% every 2.5 u);
 * - paper: context (roughness 0.9, fibre normal 0.015; idle, lit, vermilion);
 * - vellum: proposed parts, unlit flat drawings on the desk;
 * - emitters: only live processes (a work slot, the one transit light, your bulb).
 *
 * Every lit material carries one patch (the kit's `patchMaterial`): its direct light is shadowed by
 * the analytic footprints, the light pools add to its diffuse light, contact occlusion darkens its
 * indirect light, and its output is clamped to 0.95 linear so only emitters reach the bloom's
 * threshold of 1.0. The patch's text is the same for every material (so standard materials share
 * one program, physical ones another); what differs is in each material's own uniform values.
 */
import { NOISE_GLSL, patchMaterial } from '@aiv/remotion-kit';
import { Color, DataTexture, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, SRGBColorSpace, type Texture } from 'three';
import { LIGHT_GLSL, LIGHT_UNIFORMS } from './light.ts';

/** The palette (sRGB hex, synthesis §2). */
export const HEX = {
  graphite: '#3A3D3C',
  graphiteHi: '#6A6F6C',
  graphiteShade: '#2A2D2C',
  enamel: '#D9D5CA',
  enamelShade: '#ACA79B',
  paper: '#A8A296',
  paperLit: '#E4DFD3',
  paperShade: '#7F7A70',
  ink: '#2A2B2A',
  vermilionShade: '#B4452C',
  vermilion: '#E8603F',
  vermilionLight: '#F4876B',
  green: '#8FD3A8',
  vellumFill: '#D9DBD5',
  vellumEdge: '#E2E0D9',
  pencil: '#8C8A85',
} as const;

const VERT_PATCH = {
  head: 'varying vec3 vDeskW;\n',
  replace: { project_vertex: '#include <project_vertex>\nvDeskW = (modelMatrix * vec4(transformed, 1.0)).xyz;' },
};

const FRAG_HEAD = /* glsl */ `
varying vec3 vDeskW;
uniform float uBrush;
uniform float uPeel;
uniform float uFibre;
uniform float uShadowAmt;
uniform float uClampMax;
${NOISE_GLSL}
${LIGHT_GLSL}
// the surface's albedo texture: graphite brushing along x, paper fibre
vec3 dskAlbedo(vec3 w) {
  float brush = aivNoise(vec2(w.x / 70.0, w.y / 2.5)) * 2.0 - 1.0;
  float fibre = aivNoise(w.xy / 1.6 + w.z * 0.37) * 2.0 - 1.0;
  return vec3(1.0 + uBrush * brush + (uFibre > 0.0 ? 0.02 * fibre : 0.0));
}
// a small world-space bump on up-facing surfaces: enamel orange-peel, paper fibre
vec3 dskBump(vec3 n, vec3 w) {
  float amt = uPeel + uFibre;
  if (amt <= 0.0) return n;
  float sc = uFibre > 0.0 ? 1.8 : 7.0;
  vec2 q = w.xy / sc;
  float e = 0.35;
  float gx = aivNoise(q + vec2(e, 0.0)) - aivNoise(q - vec2(e, 0.0));
  float gy = aivNoise(q + vec2(0.0, e)) - aivNoise(q - vec2(0.0, e));
  vec3 gv = mat3(viewMatrix) * vec3(gx, gy, 0.0);
  return normalize(n - gv * amt * 6.0);
}
`;

const FRAG_PATCH = {
  // dskAo is set in the lights block and read after lights_fragment_end
  head: FRAG_HEAD + 'float dskAo = 0.0;\n',
  replace: {
    map_fragment: '#include <map_fragment>\ndiffuseColor.rgb *= dskAlbedo(vDeskW);',
    normal_fragment_maps: '#include <normal_fragment_maps>\nnormal = dskBump(normal, vDeskW);',
    lights_fragment_begin: /* glsl */ `#include <lights_fragment_begin>
{
  vec3 nW = normalize((vec4(nonPerturbedNormal, 0.0) * viewMatrix).xyz);
  float up = smoothstep(0.2, 0.8, nW.z);
  vec2 sh = dskShade(vDeskW.xy, vDeskW.z - 0.5);
  float lit = 1.0 - uShadowAmt * sh.x * up;
  reflectedLight.directDiffuse *= lit;
  reflectedLight.directSpecular *= lit;
  #ifdef USE_CLEARCOAT
  clearcoatSpecularDirect *= lit;
  #endif
  reflectedLight.directDiffuse += dskPool(vDeskW) * material.diffuseColor * max(nW.z, 0.0);
  dskAo = sh.y * up;
}`,
    lights_fragment_end: '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 1.0 - 0.55 * dskAo;\nreflectedLight.directDiffuse *= 1.0 - 0.25 * dskAo;',
    opaque_fragment: '#include <opaque_fragment>\ngl_FragColor.rgb = min(gl_FragColor.rgb, vec3(uClampMax));',
  },
};

export interface LitOptions {
  brush?: number;
  peel?: number;
  fibre?: number;
  /** how much of the direct light a cast shadow takes away (default 0.75) */
  shadow?: number;
}

function patch<M extends MeshStandardMaterial>(m: M, key: string, o: LitOptions): M {
  return patchMaterial(m, {
    key: `desk-lit:${key}`,
    uniforms: {
      ...LIGHT_UNIFORMS,
      uBrush: { value: o.brush ?? 0 },
      uPeel: { value: o.peel ?? 0 },
      uFibre: { value: o.fibre ?? 0 },
      uShadowAmt: { value: o.shadow ?? 0.75 },
      uClampMax: { value: 0.95 },
    },
    vertex: VERT_PATCH,
    fragment: FRAG_PATCH,
  });
}

/** A 1×1 white texture: plain surfaces of a mapped kind still bind a map, so they share its program. */
export function whiteTexture(): Texture {
  const t = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Graphite (standard, no map): structure. */
export function graphite(hex: string = HEX.graphite, o: { roughness?: number; metalness?: number; brush?: number } = {}): MeshStandardMaterial {
  return patch(new MeshStandardMaterial({ color: new Color(hex), metalness: o.metalness ?? 0.55, roughness: o.roughness ?? 0.42 }), 'std', { brush: o.brush ?? 0.04 });
}

/** A non-metal standard surface without a map (cords, rubber, glass-like dark parts). */
export function matte(hex: string, roughness = 0.6, metalness = 0): MeshStandardMaterial {
  return patch(new MeshStandardMaterial({ color: new Color(hex), metalness, roughness }), 'std', {});
}

/** Paper (standard with a map): context. */
export function paper(map: Texture, hex: string = HEX.paper, o: { roughness?: number; fibre?: number } = {}): MeshStandardMaterial {
  return patch(new MeshStandardMaterial({ color: new Color(hex), map, metalness: 0, roughness: o.roughness ?? 0.9 }), 'std-map', { fibre: o.fibre ?? 0.015 });
}

/** The room environment's strength on enamel (the synthesis's 0.25 clipped a lit top to white: RoomEnvironment is bright). */
export const ENAMEL_ENV = 0.1;

/** Enamel (physical with a map and the room environment): built parts. */
export function enamel(map: Texture, env: Texture, hex: string = HEX.enamel, o: { roughness?: number; clearcoat?: number } = {}): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({ color: new Color(hex), map, metalness: 0, roughness: o.roughness ?? 0.3, clearcoat: o.clearcoat ?? 0.4, clearcoatRoughness: 0.25, envMap: env, envMapIntensity: ENAMEL_ENV });
  return patch(m, 'phys-map', { peel: 0.005 });
}

/** An emitter: unlit, HDR (intensity > 1 blooms; the bloom's threshold is 1.0). */
export function emitter(hex: string, intensity: number): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color: new Color(hex) });
  m.color.multiplyScalar(intensity);
  return m;
}

/** Vellum: an unlit flat drawing lying on the desk (proposed parts exist only as drawings). */
export function vellum(map: Texture): MeshBasicMaterial {
  return new MeshBasicMaterial({ map, transparent: true, depthWrite: false });
}
