/**
 * The analytic light's kit as a leaf module (it imports only layout.ts): the footprint shapes and their helpers
 * (footprints.ts casts them, gl/light.ts packs them) and the light colours (pools.ts). footprints.ts and pools.ts
 * re-export all of it; a beat module (beat7.ts ... end.ts), which state.ts and footprints.ts import, builds its own
 * footprints and pools from here, so its tables never meet an import cycle.
 */
import { rectC, type P2, type P3, type Rect } from './layout.ts';

export type Footprint =
  /** a rounded rectangle centred at c, half sizes h, corner radius r, turned by rot (radians) */
  | { kind: 'rect'; c: P2; h: P2; r: number; rot: number; z0: number; z1: number; contact: number }
  | { kind: 'circle'; c: P2; r: number; z0: number; z1: number; contact: number }
  /** a capsule from a (at height ha) to b (at hb), radius r: cords, arms, sloped plates */
  | { kind: 'seg'; a: P2; b: P2; ha: number; hb: number; r: number }
  /** an open structure overhead (the deck): it casts no shadow of its own but takes sky light from what lies under it */
  | { kind: 'canopy'; c: P2; h: P2; z: number; strength: number };

/** A footprint of a rectangle from z0 to z1 (contact: how strongly it occludes the receiver it stands on, 0..1). */
export const rectFp = (r: Rect, z0: number, z1: number, contact = 1, radius = 3): Footprint => ({
  kind: 'rect',
  c: rectC(r),
  h: [(r.x1 - r.x0) / 2, (r.y1 - r.y0) / 2],
  r: Math.min(radius, (r.x1 - r.x0) / 2, (r.y1 - r.y0) / 2),
  rot: 0,
  z0,
  z1,
  contact,
});
export const circleFp = (c: P2, r: number, z0: number, z1: number, contact = 1): Footprint => ({ kind: 'circle', c, r, z0, z1, contact });
export const segFp = (a: P3, b: P3, r: number): Footprint => ({ kind: 'seg', a: [a[0], a[1]], b: [b[0], b[1]], ha: a[2], hb: b[2], r });

/** Segments along a 3D polyline (for cords and the chute). */
export const polySegs = (pts: readonly P3[], r: number): Footprint[] => pts.slice(1).map((b, i) => segFp(pts[i], b, r));

/** Footprints moved up or down by dz (a bay rising out of or sinking into its hatch); what ends under the desk casts nothing on it. */
export function shiftFootprints(fps: readonly Footprint[], dz: number): Footprint[] {
  if (dz === 0) return [...fps];
  const out: Footprint[] = [];
  for (const fp of fps) {
    if (fp.kind === 'rect' || fp.kind === 'circle') {
      if (fp.z1 + dz <= 0.5) continue;
      out.push({ ...fp, z0: Math.max(0, fp.z0 + dz), z1: fp.z1 + dz });
    } else if (fp.kind === 'seg') {
      if (Math.max(fp.ha, fp.hb) + dz <= 0.5) continue;
      out.push({ ...fp, ha: Math.max(0, fp.ha + dz), hb: Math.max(0, fp.hb + dz) });
    } else out.push(fp);
  }
  return out;
}

/** A sheet's footprint: lying `tilt` up from the desk about x, its centre at c (its depth foreshortened, its height span). */
export const tiltedFp = (c: P3, w: number, d: number, tilt: number, contact = 0): Footprint => ({ kind: 'rect', c: [c[0], c[1]], h: [w / 2, Math.max(1, (d / 2) * Math.cos(tilt))], r: 3, rot: 0, z0: c[2] - (d / 2) * Math.sin(tilt), z1: c[2] + (d / 2) * Math.sin(tilt) + 1, contact });

/**
 * The heights a flat carrier's footprint spans (its centre plane at p, its top `top` over it, `hl` its half length, tilted
 * by its slope): its top a quarter unit under the lowest point of the carrier's own top face, so the carrier never shades
 * itself (a footprint's top exactly at a receiver is a coin flip of its shade: a tilted card read two-toned, half of it
 * under its own footprint, and flattened to one tone in a frame as it landed).
 */
export function carrierSpan(c: { p: P3; slope: number }, hl: number, top: number): { z0: number; z1: number } {
  const z1 = c.p[2] + top * Math.cos(c.slope) - hl * Math.abs(Math.sin(c.slope)) - 0.25;
  return { z0: Math.min(c.p[2] - 0.4, z1 - 0.5), z1 };
}

// ------------------------------------------------------------------------------------------------
// Light colours (pools.ts): light is attention or work (synthesis §2)

/** sRGB hex to linear RGB. */
export function linearOf(hex: string): P3 {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
}

export const tint = (hex: string, k: number): P3 => {
  // the light's colour normalised to unit luminance, times k
  const [r, g, b] = linearOf(hex);
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [(r / y) * k, (g / y) * k, (b / y) * k];
};

/** The emitters' levels (HDR: above 1.0 blooms); objects/*.tsx draw with them (kit.tsx). At most three emitters bloom in a frame. */
export const EMIT = { slot: 9, slotDocs: 0.9, transit: 7, bulbMax: 1.1, jewel: 0.85 } as const;

/** The synthesis's light colours. */
export const LIGHT_HEX = { yours: '#FFF1E0', reading: '#F4F5F2', work: '#EEF3F0' } as const;
