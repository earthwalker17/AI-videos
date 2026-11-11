/**
 * The proposed and the open, at the summary (desk/summary.ts; STORYBOARD 9.1–10.3).
 * - Proposed parts exist only as vellum drawings laid flat east of the system: the plan of the deck,
 *   the state cabinet, the cloud loop's sheet (the loop, the docked lid strut and the Persistent plate
 *   drawn on it, never a ring standing in for a node), three tethers run as parallel strips of unequal
 *   length from its east edge to a daemon clip beside each machine, each clip its machine's own
 *   fixture; the Watchdog, a plan of an inspection station outside the system, its scope and sightline
 *   aimed at the stuck bay and the pencil flag pinned on it. Vellum is never drawn solid and casts no shadow.
 * - The machines a cloud loop would keep running are real: graphite (built), each its own silhouette.
 * - Open problems are pencil, drawn once and grained: a "?" beside the tethers; the reel split, its tape
 *   torn and its outer windings in pencil (memory over months); the handle outline a running bay lacks,
 *   with its "?".
 *
 * Vellum's 14% fill and 75% edge are display-space coverages over the desk; the decals blend in linear
 * light, so each is drawn at the linear alpha that lands on that display value (`over`).
 */
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import type { BufferGeometry, Texture } from 'three';
import { cylinderZ, merge, plane, slab } from '../geom.ts';
import { vellum } from '../gl/materials.ts';
import { texture } from '../gl/text.ts';
import { useDeskMats } from '../kit.tsx';
import { BAYS, REEL, type P2 } from '../layout.ts';
import { FLAG, HANDLE, MACHINES, QUERIES, TETHER_W, VELLUM, WATCHDOG, clipC } from '../summary.ts';
import type { ProposedState } from '../beat9.ts';

/** A seeded hash of an index to 0..1 (integer mixing: deterministic, no randomness). */
function hash01(i: number, seed: number): number {
  let h = Math.imul(i ^ Math.imul(seed, 0x9e3779b9), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** sRGB (0..255) to linear. */
const lin = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
/** The desk's display value (#212322's green channel, its luma's near twin). */
const DESK = 35;
/** The linear alpha that puts a colour `v` over the desk at display-space coverage `t`. */
const over = (v: number, t: number): number => (lin(DESK + t * (v - DESK)) - lin(DESK)) / (lin(v) - lin(DESK));
const rgba = (rgb: readonly [number, number, number], t: number): string => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${over(rgb[1], t).toFixed(3)})`;
const VELLUM_FILL: [number, number, number] = [217, 219, 213];
const VELLUM_LINE: [number, number, number] = [226, 224, 217];
const PENCIL: [number, number, number] = [140, 138, 133];
/** Vellum (TREATMENT palette): a 14% fill under a 75% dashed edge; construction lines fainter. */
const FILL = rgba(VELLUM_FILL, 0.14);
const LINE = rgba(VELLUM_LINE, 0.75);
const FAINT = rgba(VELLUM_LINE, 0.4);
/** Pencil at 80%. */
const LEAD = rgba(PENCIL, 0.8);
/** Vellum's dashed edge, at 0.64× still about 14/10 px at 2.5 px on screen. */
const DASH = [22, 16];

type G = CanvasRenderingContext2D;
function dashed(g: G, w = 4): void {
  g.strokeStyle = LINE;
  g.lineWidth = w;
  g.setLineDash(DASH);
}

/** Pencil grain: lift seeded specks of the lead off what is drawn (the paper's tooth showing through), so a stroke is never a smooth grey hook. */
function grain(g: G, w: number, h: number, seed: number): void {
  g.save();
  g.setLineDash([]);
  g.globalCompositeOperation = 'destination-out';
  // specks of about 1.5 px on screen at 0.64x, so the grain survives the downscale
  const n = Math.round(w * h * 0.09);
  for (let i = 0; i < n; i++) {
    const x = hash01(i, seed) * w;
    const y = hash01(i + 7919, seed) * h;
    g.fillStyle = `rgba(0,0,0,${(0.3 + 0.55 * hash01(i, seed + 1)).toFixed(2)})`;
    g.fillRect(x, y, 2.4, 2.4);
  }
  g.restore();
}

/** A pencil line through points: two slightly offset passes, round caps (on the desk at 80%; `on` a light enamel band, the lead reads darker). */
function lead(g: G, pts: readonly (readonly [number, number])[], width: number, on: 'desk' | 'enamel' = 'desk'): void {
  g.setLineDash([]);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [dx, dy, k] of [
    [0, 0, 1],
    [0.9, -0.6, 0.55],
  ] as const) {
    g.strokeStyle = on === 'enamel' ? `rgba(70,68,64,${k === 1 ? 0.9 : 0.45})` : k === 1 ? LEAD : rgba(PENCIL, 0.4);
    g.lineWidth = width * (k === 1 ? 1 : 0.7);
    g.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x + dx, y + dy) : g.lineTo(x + dx, y + dy)));
    g.stroke();
  }
}

/** The loop's sheet (world), and world to its canvas (north up). */
const LS = VELLUM.loop;
const SHEET_W = LS.x1 - LS.x0;
const SHEET_H = LS.y1 - LS.y0;
const sx = (x: number): number => x - LS.x0;
const sy = (y: number): number => LS.y1 - y;
/** The loop drawn on it: an oval track, centred in the sheet's upper part. */
const LOOP = { c: [LS.x0 + SHEET_W * 0.48, LS.y0 + SHEET_H * 0.62] as P2, rx: 74, ry: 96, gauge: 16 } as const;
/** The tether strips: one per machine, from the sheet's east edge to its clip's west edge, each with its own sag. */
const CLIPS = MACHINES.map((m) => clipC(m));
const CLIP_SIZE: P2 = [60, 72];
const TETHER = { x0: LS.x1 - 4, x1: Math.max(...CLIPS.map((c) => c[0])) - CLIP_SIZE[0] / 2 + 8, y0: Math.min(...CLIPS.map((c) => c[1])) - 30, y1: Math.max(...CLIPS.map((c) => c[1])) + 30 } as const;
const SAG = [5, -4, 7] as const;

/** Construction ticks outside a rectangle's corners, as a draughtsman lays them. */
function construction(g: G, x: number, y: number, w: number, h: number): void {
  g.setLineDash([]);
  g.strokeStyle = FAINT;
  g.lineWidth = 1.6;
  for (const [cx, cy, kx, ky] of [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ]) {
    g.beginPath();
    g.moveTo(cx + kx * 4, cy);
    g.lineTo(cx + kx * 14, cy);
    g.moveTo(cx, cy + ky * 4);
    g.lineTo(cx, cy + ky * 14);
    g.stroke();
  }
}

/** A sheet's paper: the 14% fill, a dashed edge, a faint inner border, the ruled title block in its corner (no words). */
function sheet(g: G, w: number, h: number, title = true): void {
  g.fillStyle = FILL;
  g.fillRect(4, 4, w - 8, h - 8);
  dashed(g);
  g.strokeRect(8, 8, w - 16, h - 16);
  g.setLineDash([]);
  g.strokeStyle = FAINT;
  g.lineWidth = 1.6;
  g.strokeRect(20, 20, w - 40, h - 40);
  if (!title) return;
  const tw = Math.min(110, w * 0.5);
  g.strokeRect(w - 20 - tw, h - 54, tw, 34);
  for (const k of [0.33, 0.66]) {
    g.beginPath();
    g.moveTo(w - 20 - tw, h - 54 + 34 * k);
    g.lineTo(w - 20, h - 54 + 34 * k);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(w - 20 - tw * 0.4, h - 54);
  g.lineTo(w - 20 - tw * 0.4, h - 20);
  g.stroke();
}

/**
 * The cloud loop's sheet: a vellum drawing laid flat like the deck's plan. On it the loop (an oval
 * track: two dashed rails, sleepers, its way round marked by a chevron), the lid strut docked across the
 * track's foot, the Persistent plate's outline with its looped mark, and on its east edge the three
 * ports the tethers leave from.
 */
function loopSheet(g: G): void {
  sheet(g, SHEET_W, SHEET_H);
  const [cx, cy] = [sx(LOOP.c[0]), sy(LOOP.c[1])];
  const { rx, ry, gauge } = LOOP;
  // the track's band and its rails
  g.fillStyle = FILL;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.ellipse(cx, cy, rx - gauge, ry - gauge, 0, 0, Math.PI * 2, true);
  g.fill();
  // its rails drawn as lines on the drawing (the sheet's dashed edge already says proposed)
  g.setLineDash([]);
  g.strokeStyle = LINE;
  g.lineWidth = 2.6;
  for (const k of [0, gauge]) {
    g.beginPath();
    g.ellipse(cx, cy, rx - k, ry - k, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // sleepers across the band
  g.setLineDash([]);
  g.strokeStyle = FAINT;
  g.lineWidth = 2;
  for (let a = 0.1; a < Math.PI * 2; a += 0.24) {
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (rx - gauge + 2), cy + Math.sin(a) * (ry - gauge + 2));
    g.lineTo(cx + Math.cos(a) * (rx - 2), cy + Math.sin(a) * (ry - 2));
    g.stroke();
  }
  // the way round (anticlockwise seen from above): a chevron on the band's west side
  g.strokeStyle = LINE;
  g.lineWidth = 4;
  const mx = cx - rx + gauge / 2;
  g.beginPath();
  g.moveTo(mx - 9, cy - 8);
  g.lineTo(mx, cy + 6);
  g.lineTo(mx + 9, cy - 8);
  g.stroke();
  // the centre's construction cross
  g.strokeStyle = FAINT;
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(cx - 20, cy);
  g.lineTo(cx + 20, cy);
  g.moveTo(cx, cy - 20);
  g.lineTo(cx, cy + 20);
  g.stroke();
  // the lid strut, docked across the track's foot: its bar, its clip end, its pivot
  const fy = cy + ry - gauge / 2;
  g.strokeStyle = LINE;
  g.lineWidth = 3.4;
  g.strokeRect(cx - 40, fy - 7, 80, 14);
  g.beginPath();
  g.arc(cx + 50, fy, 8, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(cx - 32, fy, 3, 0, Math.PI * 2);
  g.stroke();
  // the Persistent plate's outline under it, its looped mark
  const px = cx;
  const py = fy + 44;
  g.setLineDash([12, 8]);
  g.lineWidth = 3;
  g.strokeRect(px - 44, py - 18, 88, 36);
  g.setLineDash([]);
  g.lineWidth = 3.2;
  g.beginPath();
  g.arc(px, py, 10, 0.5, Math.PI * 2 - 0.2);
  g.stroke();
  g.beginPath();
  g.moveTo(px + 13, py - 4);
  g.lineTo(px + 9, py + 6);
  g.lineTo(px + 1, py + 1);
  g.stroke();
  // the ports on the east edge the tethers leave from
  g.lineWidth = 3;
  for (const c of CLIPS) {
    g.beginPath();
    g.arc(SHEET_W - 8, sy(c[1]), 10, Math.PI / 2, (3 * Math.PI) / 2);
    g.stroke();
  }
}

/** The tethers: parallel vellum strips, one per machine, each a band with dashed edges and a perforated middle, sagging its own way. */
function tetherSheet(g: G): void {
  CLIPS.forEach((c, i) => {
    const y = TETHER.y1 - c[1];
    const x1 = c[0] - CLIP_SIZE[0] / 2 + 6 - TETHER.x0;
    const hw = TETHER_W / 2;
    const s = 2 * SAG[i];
    const path = (off: number) => {
      g.beginPath();
      g.moveTo(0, y + off);
      g.quadraticCurveTo(x1 / 2, y + off + s, x1, y + off);
    };
    g.fillStyle = FILL;
    g.beginPath();
    g.moveTo(0, y - hw);
    g.quadraticCurveTo(x1 / 2, y - hw + s, x1, y - hw);
    g.lineTo(x1, y + hw);
    g.quadraticCurveTo(x1 / 2, y + hw + s, 0, y + hw);
    g.closePath();
    g.fill();
    dashed(g, 2.6);
    g.setLineDash([16, 10]);
    for (const off of [-hw, hw]) {
      path(off);
      g.stroke();
    }
    g.setLineDash([3, 9]);
    g.strokeStyle = FAINT;
    g.lineWidth = 2.4;
    path(0);
    g.stroke();
  });
  g.setLineDash([]);
}

/** A daemon clip in plan, each its machine's own fixture: a rack ear for the server, a C-clamp for the workstation, a binder clip for the laptop. */
function clipSheet(g: G, kind: (typeof MACHINES)[number]['kind'], w: number, h: number): void {
  const outline = () => {
    g.fillStyle = FILL;
    g.fill();
    dashed(g, 3);
    g.setLineDash([10, 7]);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = LINE;
    g.lineWidth = 2.6;
  };
  g.beginPath();
  if (kind === 'server') {
    // an L-shaped rack ear: its flange with two screw holes, its arm reaching east to the machine
    g.moveTo(10, 8);
    g.lineTo(28, 8);
    g.lineTo(28, h * 0.4);
    g.lineTo(w - 6, h * 0.4);
    g.lineTo(w - 6, h * 0.6);
    g.lineTo(28, h * 0.6);
    g.lineTo(28, h - 8);
    g.lineTo(10, h - 8);
    g.closePath();
    outline();
    for (const y of [18, h - 18]) {
      g.beginPath();
      g.arc(19, y, 4.5, 0, Math.PI * 2);
      g.stroke();
    }
  } else if (kind === 'workstation') {
    // a C-clamp: the frame open to the east, its screw and swivel pad, the screw's handle
    g.moveTo(w - 8, 8);
    g.lineTo(12, 8);
    g.lineTo(12, h - 8);
    g.lineTo(w - 8, h - 8);
    g.lineTo(w - 8, h - 20);
    g.lineTo(24, h - 20);
    g.lineTo(24, 20);
    g.lineTo(w - 8, 20);
    g.closePath();
    outline();
    g.beginPath();
    g.moveTo(w * 0.62, 20);
    g.lineTo(w * 0.62, h - 34);
    g.stroke();
    g.strokeRect(w * 0.62 - 9, h - 34, 18, 7);
    g.beginPath();
    g.moveTo(w * 0.62 - 10, 14);
    g.lineTo(w * 0.62 + 10, 14);
    g.stroke();
  } else {
    // a binder clip: its folded body and its two wire handles folded back west
    g.moveTo(w - 8, 14);
    g.lineTo(w - 8, h - 14);
    g.lineTo(w * 0.45, h - 22);
    g.lineTo(w * 0.45, 22);
    g.closePath();
    outline();
    for (const [y0, y1] of [
      [24, 10],
      [h - 24, h - 10],
    ]) {
      g.beginPath();
      g.moveTo(w * 0.45, y0);
      g.lineTo(10, y1);
      g.lineTo(10, h / 2);
      g.stroke();
    }
  }
}

function planSheet(g: G, w: number, h: number): void {
  sheet(g, w, h, false);
  // the deck's plan: its rails, the reel, the window
  g.setLineDash([]);
  g.strokeStyle = FAINT;
  g.lineWidth = 2.5;
  g.strokeRect(26, 26, w - 52, h - 52);
  g.beginPath();
  g.arc(w * 0.66, h * 0.5, h * 0.27, 0, Math.PI * 2);
  g.stroke();
  g.strokeRect(36, h * 0.6, w * 0.42, 22);
  for (const x of [w * 0.2, w * 0.4]) {
    g.beginPath();
    g.moveTo(x, 26);
    g.lineTo(x, h * 0.55);
    g.stroke();
  }
  construction(g, 26, 26, w - 52, h - 52);
}

function cabinetSheet(g: G, w: number, h: number): void {
  sheet(g, w, h, false);
  g.strokeStyle = LINE;
  g.lineWidth = 3;
  g.setLineDash([]);
  for (let i = 0; i < 3; i++) {
    const y = 26 + i * ((h - 44) / 3);
    g.strokeRect(26, y, w - 52, (h - 44) / 3 - 8);
    g.strokeRect(w / 2 - 16, y + (h - 44) / 6 - 8, 32, 8);
  }
}

/** The Watchdog's sheet (world bounds): the station's plan and its sightline out to the flag. */
const WD = (() => {
  const [x, y] = WATCHDOG.c;
  const [fx, fy] = WATCHDOG.look;
  const m = 40;
  return { x0: Math.min(x - WATCHDOG.w / 2, fx) - m, x1: Math.max(x + WATCHDOG.w / 2, fx) + m, y0: Math.min(y - WATCHDOG.d / 2, fy) - m, y1: Math.max(y + WATCHDOG.d / 2, fy) + m };
})();

/**
 * The Watchdog, entirely vellum: a plan of an inspection station (its base plate and bolts, a
 * turntable with the arc of its sweep, a scope on it with its lens, a counterweight, centre lines) aimed
 * at the stuck bay; its sightline a narrow dashed wedge out to the pencil flag it pins there, ringed.
 */
function watchSheet(g: G): void {
  const wx = (x: number) => x - WD.x0;
  const wy = (y: number) => WD.y1 - y;
  const [cx, cy] = [wx(WATCHDOG.c[0]), wy(WATCHDOG.c[1])];
  const [fx, fy] = [wx(WATCHDOG.look[0]), wy(WATCHDOG.look[1])];
  const a = Math.atan2(fy - cy, fx - cx);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const bw = WATCHDOG.w;
  const bd = WATCHDOG.d;
  // the base plate, its bolts, its centre lines
  g.fillStyle = FILL;
  g.fillRect(cx - bw / 2, cy - bd / 2, bw, bd);
  dashed(g);
  g.strokeRect(cx - bw / 2, cy - bd / 2, bw, bd);
  g.setLineDash([]);
  g.strokeStyle = LINE;
  g.lineWidth = 2.4;
  for (const [kx, ky] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    g.beginPath();
    g.arc(cx + kx * (bw / 2 - 16), cy + ky * (bd / 2 - 16), 6, 0, Math.PI * 2);
    g.stroke();
  }
  construction(g, cx - bw / 2, cy - bd / 2, bw, bd);
  g.strokeStyle = FAINT;
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(cx - bw / 2 - 10, cy);
  g.lineTo(cx + bw / 2 + 10, cy);
  g.moveTo(cx, cy - bd / 2 - 10);
  g.lineTo(cx, cy + bd / 2 + 10);
  g.stroke();
  // the turntable and the arc of its sweep (ticks), centred on the aim
  const R = 40;
  g.strokeStyle = LINE;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 2;
  for (let k = -6; k <= 6; k++) {
    const t = a + k * 0.09;
    const r1 = R + (k % 3 === 0 ? 16 : 11);
    g.beginPath();
    g.moveTo(cx + Math.cos(t) * (R + 6), cy + Math.sin(t) * (R + 6));
    g.lineTo(cx + Math.cos(t) * r1, cy + Math.sin(t) * r1);
    g.stroke();
  }
  // the scope: its barrel from the turntable's centre toward the bay, its lens at the end
  const L = 84;
  const hw = 11;
  const px = -uy;
  const py = ux;
  g.lineWidth = 3.4;
  g.beginPath();
  g.moveTo(cx + px * hw, cy + py * hw);
  g.lineTo(cx + ux * L + px * hw, cy + uy * L + py * hw);
  g.lineTo(cx + ux * L - px * hw, cy + uy * L - py * hw);
  g.lineTo(cx - px * hw, cy - py * hw);
  g.stroke();
  const lx = cx + ux * (L + 8);
  const ly = cy + uy * (L + 8);
  g.beginPath();
  g.ellipse(lx, ly, 6, hw + 4, a, 0, Math.PI * 2);
  g.stroke();
  // the counterweight behind the pivot
  g.strokeRect(cx - ux * 34 - 12, cy - uy * 34 - 12, 24, 24);
  // the sightline: a narrow wedge out to the flag, and the ring that pins it
  const d = Math.hypot(fx - lx, fy - ly);
  const spread = 0.045;
  g.fillStyle = rgba(VELLUM_FILL, 0.08);
  g.beginPath();
  g.moveTo(lx, ly);
  g.lineTo(lx + Math.cos(a - spread) * d, ly + Math.sin(a - spread) * d);
  g.lineTo(lx + Math.cos(a + spread) * d, ly + Math.sin(a + spread) * d);
  g.closePath();
  g.fill();
  dashed(g, 2.8);
  g.setLineDash([14, 10]);
  for (const k of [-1, 1]) {
    g.beginPath();
    g.moveTo(lx, ly);
    g.lineTo(lx + Math.cos(a + k * spread) * (d - 22), ly + Math.sin(a + k * spread) * (d - 22));
    g.stroke();
  }
  g.setLineDash([8, 6]);
  g.beginPath();
  g.arc(fx, fy, 22, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
}

/** The pencil flag the Watchdog pins on the stuck bay: a pin lying along its nameplate band, its pennant at the head (dark lead on enamel). */
const FLAG_SIZE = 66;
function flagSheet(g: G, s: number): void {
  lead(
    g,
    [
      [s * 0.12, s * 0.64],
      [s * 0.88, s * 0.64],
    ],
    4.4,
    'enamel',
  );
  // the pennant, hatched in lead so it reads as a flag
  g.fillStyle = 'rgba(70,68,64,0.55)';
  g.beginPath();
  g.moveTo(s * 0.14, s * 0.14);
  g.lineTo(s * 0.56, s * 0.34);
  g.lineTo(s * 0.14, s * 0.52);
  g.closePath();
  g.fill();
  lead(
    g,
    [
      [s * 0.14, s * 0.64],
      [s * 0.14, s * 0.14],
      [s * 0.56, s * 0.34],
      [s * 0.14, s * 0.52],
    ],
    3.8,
    'enamel',
  );
  lead(
    g,
    [
      [s * 0.88, s * 0.64],
      [s * 0.89, s * 0.65],
    ],
    8,
    'enamel',
  );
  grain(g, s, s, 97);
}

/** A pencil "?" (graphite at 80%, a lead of 4–6 u, two passes, grained); `on` a light surface the lead reads darker. */
function query(g: G, s: number, seed: number, on: 'desk' | 'enamel' = 'desk', ox = 0, oy = 0): void {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    // the hook: an arc over the top, then down to the stem
    const a = Math.PI * (1.05 + 1.25 * Math.min(1, t / 0.7));
    const p: [number, number] = t <= 0.7 ? [ox + s * 0.5 + Math.cos(a) * s * 0.21, oy + s * 0.3 + Math.sin(a) * s * 0.21] : [ox + s * 0.5, oy + s * 0.47 + (t - 0.7) * s * 0.55];
    pts.push(p);
  }
  lead(g, pts, s * 0.052, on);
  lead(
    g,
    [
      [ox + s * 0.5, oy + s * 0.83],
      [ox + s * 0.51, oy + s * 0.86],
    ],
    s * 0.085,
    on,
  );
  if (on === 'desk') grain(g, s, s, seed);
}

/** The split sheet's size: the reel's diameter and the margin its windings' "?" reaches into. */
const SPLIT = REEL.r * 2 + 90;
/**
 * The pencil over the Register: the reel split across (its crack at full pencil value), its tape torn,
 * its outer windings gone to pencil, a "?" on the split (sharding) and one on the outer windings
 * (memory over months), each at least 64 px.
 */
function splitSheet(g: G, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const R = REEL.r;
  // the outer windings, in pencil (the reel's paper stops short of them)
  for (let k = 0; k < 5; k++) {
    const r = R - 3 - k * 3.4;
    const from = -0.4 + k * 0.17;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const a = from + (i / 40) * 4.6;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    lead(g, pts, 2.4, 'enamel');
  }
  // the split: a jagged cut across the reel at full pencil value, its tape torn where it crosses the windings
  lead(
    g,
    [
      [cx - 10, cy - R + 2],
      [cx - 2, cy - R * 0.64],
      [cx - 9, cy - R * 0.4],
      [cx + 4, cy - R * 0.1],
      [cx - 3, cy + R * 0.2],
      [cx + 6, cy + R * 0.56],
      [cx - 2, cy + R - 2],
    ],
    4,
    'enamel',
  );
  lead(
    g,
    [
      [cx + 14, cy - R + 8],
      [cx + 22, cy - R + 14],
      [cx + 16, cy - R + 20],
      [cx + 25, cy - R + 27],
    ],
    2.6,
    'enamel',
  );
  // sharding: a "?" on the west half; memory over months: a "?" over the north-east windings
  // (a "?" glyph is 0.77 of its box: 134 u is 66 px at 0.64x)
  query(g, 134, 41, 'enamel', cx - R * 0.5 - 67, cy - 76);
  query(g, 132, 43, 'enamel', cx + R * 0.56 - 66, cy - R * 0.88 - 62);
  grain(g, w, h, 41);
}

/** The handle a running bay's door lacks: its pull's outline in pencil, its two screw marks. */
function handleSheet(g: G, w: number, h: number): void {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 28; i++) {
    const a = Math.PI + (i / 28) * Math.PI;
    pts.push([w / 2 + Math.cos(a) * (w / 2 - 6), h - 6 + Math.sin(a) * (h - 12)]);
  }
  lead(g, pts, 3.4, 'enamel');
  for (const x of [6, w - 6]) lead(g, [[x, h - 6], [x + 0.5, h - 5]], 4.4, 'enamel');
  grain(g, w, h, 73);
}

function useProposedTextures() {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    const an = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const t = (w: number, h: number, draw: (g: G) => void): Texture => texture(w, h, draw, an, 'transparent');
    return {
      loop: t(SHEET_W, SHEET_H, (g) => loopSheet(g)),
      tethers: t(TETHER.x1 - TETHER.x0, TETHER.y1 - TETHER.y0, (g) => tetherSheet(g)),
      plan: t(VELLUM.plan.w, VELLUM.plan.d, (g) => planSheet(g, VELLUM.plan.w, VELLUM.plan.d)),
      cabinet: t(VELLUM.cabinet.w, VELLUM.cabinet.d, (g) => cabinetSheet(g, VELLUM.cabinet.w, VELLUM.cabinet.d)),
      clips: MACHINES.map((m) => t(CLIP_SIZE[0], CLIP_SIZE[1], (g) => clipSheet(g, m.kind, CLIP_SIZE[0], CLIP_SIZE[1]))),
      watch: t(WD.x1 - WD.x0, WD.y1 - WD.y0, (g) => watchSheet(g)),
      flag: t(FLAG_SIZE, FLAG_SIZE, (g) => flagSheet(g, FLAG_SIZE)),
      query: QUERIES.map((q, i) => t(q.size, q.size, (g) => query(g, q.size, 11 + i))),
      split: t(SPLIT, SPLIT, (g) => splitSheet(g, SPLIT, SPLIT)),
      handle: t(HANDLE.w, HANDLE.d, (g) => handleSheet(g, HANDLE.w, HANDLE.d)),
    };
  }, [gl]);
}

/**
 * The graphite machines (built), each its own silhouette: a rack server (two units, the slot lines of
 * its vents across its top), a tower workstation (tall, its vent column along its top), a closed laptop
 * (its lid a step in from the base, the hinge barrel along its north edge).
 */
function machineGeometry(): { body: BufferGeometry; detail: BufferGeometry } {
  const body: BufferGeometry[] = [];
  const detail: BufferGeometry[] = [];
  for (const m of MACHINES) {
    const r = { x0: m.c[0] - m.w / 2, x1: m.c[0] + m.w / 2, y0: m.c[1] - m.d / 2, y1: m.c[1] + m.d / 2 };
    if (m.kind === 'server') {
      body.push(slab(r, 0, m.h / 2 - 1, 3, 1.2), slab({ ...r, x0: r.x0 + 3, x1: r.x1 - 3 }, m.h / 2, m.h, 3, 1.2));
      for (let i = 0; i < 6; i++) detail.push(slab({ x0: r.x0 + 14, x1: r.x1 - 30, y0: r.y0 + 12 + i * 12, y1: r.y0 + 15 + i * 12 }, m.h, m.h + 1.2, 0.4, 0.3));
      detail.push(slab({ x0: r.x1 - 22, x1: r.x1 - 10, y0: r.y0 + 10, y1: r.y1 - 10 }, m.h, m.h + 2, 1, 0.6));
    } else if (m.kind === 'workstation') {
      body.push(slab(r, 0, m.h, 5, 2));
      detail.push(slab({ x0: m.c[0] - 9, x1: m.c[0] + 9, y0: r.y0 + 14, y1: r.y1 - 14 }, m.h, m.h + 1.5, 0.8, 0.5));
      for (let i = 0; i < 7; i++) detail.push(slab({ x0: m.c[0] - 7, x1: m.c[0] + 7, y0: r.y0 + 20 + i * 12, y1: r.y0 + 23 + i * 12 }, m.h + 1.5, m.h + 2.4, 0.3, 0.2));
    } else {
      // the base, its front lip showing past the shut lid; the lid; the hinge barrel along the back; the thumb notch
      body.push(slab(r, 0, m.h * 0.5, 6, 2), slab({ x0: r.x0 + 4, x1: r.x1 - 4, y0: r.y0 + 9, y1: r.y1 - 6 }, m.h * 0.5, m.h, 7, 1.8));
      const hinge = cylinderZ(4.6, 0, r.x1 - r.x0 - 34, 0, 0, 14);
      hinge.rotateY(Math.PI / 2);
      hinge.translate(r.x0 + 17, r.y1 - 4, m.h * 0.62);
      detail.push(hinge, slab({ x0: m.c[0] - 14, x1: m.c[0] + 14, y0: r.y0 + 3, y1: r.y0 + 8 }, m.h * 0.5, m.h * 0.5 + 1, 1.2, 0.6));
    }
  }
  return { body: merge(body), detail: merge(detail) };
}

/**
 * The proposed and the open parts. `state`: their pose in act two's world from beat 9 on (desk/beat9.ts proposedAt,
 * mounted by objects/Beat9.tsx; the beats 9-10 lane draws it); absent or null, still (d)'s static pose (the summary's
 * mount), the end state every pose arrives at.
 */
export function Proposed(_props: { state?: ProposedState | null }) {
  const m = useDeskMats();
  const tex = useProposedTextures();
  const mats = useMemo(
    () => ({
      loop: vellum(tex.loop),
      tethers: vellum(tex.tethers),
      plan: vellum(tex.plan),
      cabinet: vellum(tex.cabinet),
      clips: tex.clips.map((t) => vellum(t)),
      watch: vellum(tex.watch),
      flag: vellum(tex.flag),
      query: tex.query.map((t) => vellum(t)),
      split: vellum(tex.split),
      handle: vellum(tex.handle),
    }),
    [tex],
  );
  useLayoutEffect(
    () => () => {
      for (const x of [mats.loop, mats.tethers, mats.plan, mats.cabinet, mats.watch, mats.flag, mats.split, mats.handle, ...mats.clips, ...mats.query]) {
        x.map?.dispose();
        x.dispose();
      }
    },
    [mats],
  );
  const g = useMemo(() => {
    const flat = (w: number, d: number, c: readonly [number, number], z = 0.4) => plane(w, d, c[0], c[1], z);
    const machines = machineGeometry();
    return {
      loop: flat(SHEET_W, SHEET_H, [(LS.x0 + LS.x1) / 2, (LS.y0 + LS.y1) / 2]),
      tethers: flat(TETHER.x1 - TETHER.x0, TETHER.y1 - TETHER.y0, [(TETHER.x0 + TETHER.x1) / 2, (TETHER.y0 + TETHER.y1) / 2], 0.45),
      plan: flat(VELLUM.plan.w, VELLUM.plan.d, VELLUM.plan.c),
      cabinet: flat(VELLUM.cabinet.w, VELLUM.cabinet.d, VELLUM.cabinet.c),
      clips: CLIPS.map((c) => flat(CLIP_SIZE[0], CLIP_SIZE[1], c, 0.5)),
      watch: flat(WD.x1 - WD.x0, WD.y1 - WD.y0, [(WD.x0 + WD.x1) / 2, (WD.y0 + WD.y1) / 2]),
      // the flag lying on the stuck bay's nameplate band
      flag: plane(FLAG_SIZE, FLAG_SIZE, FLAG[0], FLAG[1], FLAG[2]),
      queries: QUERIES.map((q) => plane(q.size, q.size, q.at[0], q.at[1], q.at[2])),
      split: plane(SPLIT, SPLIT, REEL.x, REEL.y, REEL.packZ[1] + 0.6),
      handle: plane(HANDLE.w, HANDLE.d, HANDLE.c[0], HANDLE.c[1], BAYS.docs.wallH + 0.6),
      machines: machines.body,
      machineDetail: machines.detail,
    };
  }, []);
  return (
    <group>
      <mesh geometry={g.machines} material={m.graphite} />
      <mesh geometry={g.machineDetail} material={m.graphiteDark} />
      <mesh geometry={g.loop} material={mats.loop} renderOrder={2} />
      <mesh geometry={g.tethers} material={mats.tethers} renderOrder={2} />
      <mesh geometry={g.plan} material={mats.plan} renderOrder={2} />
      <mesh geometry={g.cabinet} material={mats.cabinet} renderOrder={2} />
      {g.clips.map((c, i) => (
        <mesh key={i} geometry={c} material={mats.clips[i]} renderOrder={2} />
      ))}
      <mesh geometry={g.watch} material={mats.watch} renderOrder={2} />
      <mesh geometry={g.flag} material={mats.flag} renderOrder={3} />
      <mesh geometry={g.split} material={mats.split} renderOrder={3} />
      <mesh geometry={g.handle} material={mats.handle} renderOrder={3} />
      {g.queries.map((q, i) => (
        <mesh key={i} geometry={q} material={mats.query[i]} renderOrder={3} />
      ))}
    </group>
  );
}
