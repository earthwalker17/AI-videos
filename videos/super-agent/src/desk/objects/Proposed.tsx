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
 *
 * In act two (beats 9-10: desk/beat9.ts proposedAt, mounted by objects/Beat9.tsx) the same parts are drawn from a
 * state: each sheet laid from its west edge by a wipe (its plane and its UVs cut at the lay's front, never a fade); the
 * machines risen out of the slate, the server's work light; the drawn strut inked in and the Persistent plate slid out
 * from under it; the tethers' dashes marching; the Watchdog's sightline and flag drawn on; the etch's graphite hatching
 * over the vellum and the machines' tops (their gloss killed while it lies on them); each pencil stroke drawn on along
 * its length, never erased. A live drawing at its last value runs exactly the static drawing's commands, so every part
 * ends exactly as still (d) draws it.
 */
import { fillTextChecked } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, Color, MeshBasicMaterial, PlaneGeometry, RepeatWrapping, type BufferGeometry, type Texture } from 'three';
import type { ProposedState } from '../beat9.ts';
import type { Span } from '../beat10.ts';
import { cylinderZ, merge, plane, slab } from '../geom.ts';
import { graphite, stepColour, vellum } from '../gl/materials.ts';
import { texture } from '../gl/text.ts';
import { EMIT, useDeskMats, useStepMode } from '../kit.tsx';
import { BAYS, REEL, type P2, type Rect } from '../layout.ts';
import { LIGHT_HEX } from '../pools.ts';
import type { DeskState } from '../state.ts';
import { FLAG, HANDLE, MACHINES, QUERIES, TETHER_W, VELLUM, WATCHDOG, clipC } from '../summary.ts';

/**
 * The step on vellum and pencil (a drawing on the desk has no surface to darken): it fades with its set's step amount, as the
 * kit's own vellum does (objects/Dispatch.tsx DeskUniforms: 0.6 at a full step), so handing it from one set to another never
 * jumps. `mode`: the enclosing `<Step>`'s (kit.tsx useStepMode); `step`, `late`: the frame's DeskState.step and testsStep
 * (the late set's amount).
 */
export const VELLUM_STEP = 0.4;
export function stepAmountOf(mode: boolean | 'late' | 'own', step?: DeskState['step'], late = 1): number {
  if (!mode || !step) return 0;
  return mode === 'own' ? (step.own?.amount ?? 0) : mode === 'late' ? late : step.amount;
}
/** A vellum or pencil drawing's opacity under the enclosing step (1 unstepped). */
export function useVellumOpacity(step?: DeskState['step'], late?: number): number {
  return 1 - VELLUM_STEP * stepAmountOf(useStepMode(), step, late);
}
/** Write the opacity on every vellum material drawn this frame (every frame: nothing carried from a frame before). */
export function useVellumStep(mats: readonly (MeshBasicMaterial | null | undefined)[], opacity: number): void {
  useLayoutEffect(() => {
    for (const x of mats) if (x) x.opacity = opacity;
  });
}

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
/** Vellum's inks for other drawings of the beats 9-10 lane (objects/Beat10.tsx: the shard's window). */
export const VELLUM_INK = { fill: FILL, line: LINE, faint: FAINT } as const;
/** Vellum's dashed edge, at 0.64× still about 14/10 px at 2.5 px on screen. */
const DASH = [22, 16];

type G = CanvasRenderingContext2D;
type Pt = readonly [number, number];
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
function lead(g: G, pts: readonly Pt[], width: number, on: 'desk' | 'enamel' = 'desk'): void {
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

/** A polyline's first `t` of its length (the pencil's way along it so far); the very same points at t >= 1. */
function partOf(pts: readonly Pt[], t: number): readonly Pt[] {
  if (t >= 1) return pts;
  if (t <= 0 || pts.length < 2) return [];
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  let left = t * seg.reduce((a, b) => a + b, 0);
  const out: Pt[] = [pts[0]!];
  for (let i = 0; i < seg.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (left >= seg[i]!) {
      out.push(b);
      left -= seg[i]!;
      continue;
    }
    const k = seg[i]! > 0 ? left / seg[i]! : 0;
    out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    break;
  }
  return out;
}
/** A pencil line drawn on to `t` of its length (nothing at 0). */
function leadOn(g: G, pts: readonly Pt[], width: number, on: 'desk' | 'enamel', t: number): void {
  const p = partOf(pts, t);
  if (p.length >= 2) lead(g, p, width, on);
}
/** A stroke's share of a draw-on: `t` over [a, b] (0 before, 1 after). */
const share = (t: number, a: number, b: number): number => (t >= b ? 1 : t <= a ? 0 : (t - a) / (b - a));

/**
 * The etch: 45° graphite strokes (2 px at an 8 px pitch at 0.64×: about 3.1 u at a 12.5 u pitch), scratched light into
 * the vellum (pencil's grey, so they read over the dark desk), on a grid fixed to the canvas, so the hatching never swims
 * as its span grows or recedes. Drawn inside the current clip, over [x0, x1] × [y0, y1].
 */
const ETCH_W = 3.1;
const ETCH_PITCH = 12.5;
function etchHatch(g: G, x0: number, y0: number, x1: number, y1: number): void {
  if (x1 <= x0 || y1 <= y0) return;
  g.save();
  g.beginPath();
  g.rect(x0, y0, x1 - x0, y1 - y0);
  g.clip();
  g.setLineDash([]);
  g.lineCap = 'butt';
  g.strokeStyle = LEAD;
  g.lineWidth = ETCH_W;
  g.beginPath();
  const h = y1 - y0;
  // a line x - y = c on the canvas runs north-east on the desk (canvas y down): one every pitch, anchored at c = 0
  const c0 = Math.floor((x0 - y1) / ETCH_PITCH) * ETCH_PITCH;
  for (let c = c0; c <= x1 - y0 + ETCH_PITCH; c += ETCH_PITCH) {
    g.moveTo(c + y1 + h, y1 + h);
    g.lineTo(c + y0 - h, y0 - h);
  }
  g.stroke();
  g.restore();
}
const spanOn = (s: Span | undefined): boolean => !!s && s[1] > s[0];

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
/** The tethers' dash patterns repeat every 156 u (16+10 and 3+9): a march that stops on a whole number of them ends as drawn. */
export const MARCH_PERIOD = 156;
/** The lay's front for the tethers and their clips together: from the sheet's east edge out past the farthest clip (world x). */
export const TETHER_LAY = { x0: TETHER.x0, x1: Math.max(...CLIPS.map((c) => c[0])) + CLIP_SIZE[0] / 2 } as const;

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

/** The loop sheet's live parts (act two): the drawn strut inked so far, the plate's offset north of its place (null: not out yet), the etch's span north to south. */
interface LoopLive {
  strut: number;
  plate: number | null;
  etch?: Span;
}

/**
 * The cloud loop's sheet: a vellum drawing laid flat like the deck's plan. On it the loop (an oval
 * track: two dashed rails, sleepers, its way round marked by a chevron), the lid strut docked across the
 * track's foot, the Persistent plate's outline with its looped mark, and on its east edge the three
 * ports the tethers leave from.
 */
function loopSheet(g: G, live?: LoopLive): void {
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
  // (act two: inked along its length from its west end under the docked strut, beat9.ts strutInkAt)
  const strut = live ? live.strut : 1;
  if (strut > 0) {
    if (strut < 1) {
      g.save();
      g.beginPath();
      g.rect(cx - 46, fy - 14, 108 * strut, 28);
      g.clip();
    }
    g.strokeRect(cx - 40, fy - 7, 80, 14);
    g.beginPath();
    g.arc(cx + 50, fy, 8, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(cx - 32, fy, 3, 0, Math.PI * 2);
    g.stroke();
    if (strut < 1) g.restore();
  }
  // the Persistent plate's outline under it, its looped mark (act two: slid south out from under the strut, beat9.ts plateAt)
  const plateDy = live ? live.plate : 0;
  if (plateDy !== null) drawPlate(g, cx, fy + 44 - plateDy, fy);
  // the ports on the east edge the tethers leave from
  g.lineWidth = 3;
  for (const c of CLIPS) {
    g.beginPath();
    g.arc(SHEET_W - 8, sy(c[1]), 10, Math.PI / 2, (3 * Math.PI) / 2);
    g.stroke();
  }
  // (act two: the etch over the sheet, north to south)
  const e = live?.etch;
  if (e && spanOn(e)) etchHatch(g, 4, 4 + e[0] * (SHEET_H - 8), SHEET_W - 4, 4 + e[1] * (SHEET_H - 8));
}

/** The Persistent plate on the loop's sheet (its pictogram: a dashed outline, its looped mark), its centre at (px, py); while it slides out (act two) only what is south of the strut's bar (`under`, the bar's canvas y). */
function drawPlate(g: G, px: number, py: number, under: number): void {
  const hidden = py - 18 < under + 7;
  if (hidden) {
    g.save();
    g.beginPath();
    g.rect(px - 60, under + 7, 120, 80);
    g.clip();
  }
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
  if (hidden) g.restore();
}

/** The tethers' live parts (act two): each strip's dash phase (u marched so far), its etch's span from the port out. */
interface TetherLive {
  march: readonly number[];
  etch: readonly Span[];
}

/** The tethers: parallel vellum strips, one per machine, each a band with dashed edges and a perforated middle, sagging its own way. */
function tetherSheet(g: G, live?: TetherLive): void {
  CLIPS.forEach((c, i) => {
    // (act two: its dashes marching out toward the machine, beat9.ts marchAt: a whole number of both patterns once it stops)
    const march = live ? -(live.march[i]! % MARCH_PERIOD) : 0;
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
    if (march) g.lineDashOffset = march;
    for (const off of [-hw, hw]) {
      path(off);
      g.stroke();
    }
    g.setLineDash([3, 9]);
    g.strokeStyle = FAINT;
    g.lineWidth = 2.4;
    path(0);
    g.stroke();
    if (march) g.lineDashOffset = 0;
    // (act two: the etch along the strip from its port, inside the band)
    const e = live?.etch[i];
    if (e && spanOn(e)) {
      g.save();
      g.beginPath();
      g.moveTo(0, y - hw);
      g.quadraticCurveTo(x1 / 2, y - hw + s, x1, y - hw);
      g.lineTo(x1, y + hw);
      g.quadraticCurveTo(x1 / 2, y + hw + s, 0, y + hw);
      g.closePath();
      g.clip();
      etchHatch(g, e[0] * x1, y - hw - 12, e[1] * x1, y + hw + 12);
      g.restore();
    }
  });
  g.setLineDash([]);
}

/** A daemon clip in plan, each its machine's own fixture: a rack ear for the server, a C-clamp for the workstation, a binder clip for the laptop. `etch` (act two): the etch's span across it, west to east, inside its outline. */
function clipSheet(g: G, kind: (typeof MACHINES)[number]['kind'], w: number, h: number, etch?: Span): void {
  const outline = () => {
    g.fillStyle = FILL;
    g.fill();
    dashed(g, 3);
    g.setLineDash([10, 7]);
    g.stroke();
    if (etch && spanOn(etch)) {
      g.save();
      g.clip();
      etchHatch(g, etch[0] * w, 0, etch[1] * w, h);
      g.restore();
    }
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

function planSheet(g: G, w: number, h: number, etch?: Span): void {
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
  // (act two: the etch over the plan, west to east)
  if (etch && spanOn(etch)) etchHatch(g, 4 + etch[0] * (w - 8), 4, 4 + etch[1] * (w - 8), h - 4);
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
/** Where the Watchdog's drawing starts on its sheet (its plate's west edge, 2 u out), as a share of the sheet's width. */
const WATCH_LAY_FROM = (WATCHDOG.c[0] - WATCHDOG.w / 2 - 2 - WD.x0) / (WD.x1 - WD.x0);
/** Where it ends (its centre line's east end, 2 u out): east of it the sheet is blank margin, so the lay's whole run shows. */
const WATCH_LAY_TO = (WATCHDOG.c[0] + WATCHDOG.w / 2 + 12 - WD.x0) / (WD.x1 - WD.x0);
/** The scope's barrel length on the sheet, its half width, and the sightline's half spread (radians). */
const SCOPE = { L: 84, hw: 11, spread: 0.045 } as const;
/** The Watchdog's lens in the world (the scope's end, aimed at the flag) and its aim's bearing (radians from east, anticlockwise): where its sightline leaves from (objects/Beat9.tsx). */
export const WATCH_LENS = (() => {
  const [cx, cy] = WATCHDOG.c;
  const [fx, fy] = WATCHDOG.look;
  const a = Math.atan2(fy - cy, fx - cx);
  const p: P2 = [cx + Math.cos(a) * (SCOPE.L + 8), cy + Math.sin(a) * (SCOPE.L + 8)];
  return { p, a, reach: Math.hypot(fx - p[0], fy - p[1]), spread: SCOPE.spread };
})();

/**
 * The Watchdog, entirely vellum: a plan of an inspection station (its base plate and bolts, a
 * turntable with the arc of its sweep, a scope on it with its lens, a counterweight, centre lines) aimed
 * at the stuck bay; its sightline a narrow dashed wedge out to the pencil flag it pins there, ringed.
 * `marks` (act two): how much of the sightline is drawn on the sheet (the wedge out from the lens, then the ring).
 */
function watchSheet(g: G, marks = 1): void {
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
  const L = SCOPE.L;
  const hw = SCOPE.hw;
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
  const spread = SCOPE.spread;
  if (marks < 1) {
    // (act two: drawn out from the lens along the wedge, then the ring round the flag)
    sightlinePart(g, lx, ly, fx, fy, a, d, marks);
    return;
  }
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
/** The sightline drawn so far (marks 0..1): the wedge to `t` of its reach over the first 0.7, then the ring round the flag. */
function sightlinePart(g: G, lx: number, ly: number, fx: number, fy: number, a: number, d: number, marks: number): void {
  if (marks <= 0) return;
  const spread = SCOPE.spread;
  const r = d * Math.min(1, marks / 0.7);
  g.fillStyle = rgba(VELLUM_FILL, 0.08);
  g.beginPath();
  g.moveTo(lx, ly);
  g.lineTo(lx + Math.cos(a - spread) * r, ly + Math.sin(a - spread) * r);
  g.lineTo(lx + Math.cos(a + spread) * r, ly + Math.sin(a + spread) * r);
  g.closePath();
  g.fill();
  dashed(g, 2.8);
  g.setLineDash([14, 10]);
  for (const k of [-1, 1]) {
    g.beginPath();
    g.moveTo(lx, ly);
    const e = Math.min(r, d - 22);
    g.lineTo(lx + Math.cos(a + k * spread) * e, ly + Math.sin(a + k * spread) * e);
    g.stroke();
  }
  const ring = share(marks, 0.7, 1);
  if (ring > 0) {
    g.setLineDash([8, 6]);
    g.beginPath();
    // round from still (d)'s start (its [8, 6] dashes land where (d) prints them: nothing shifts as it closes)
    g.arc(fx, fy, 22, 0, Math.PI * 2 * ring);
    g.stroke();
  }
  g.setLineDash([]);
}

/**
 * The pencil flag the Watchdog pins on the stuck bay (meso-sized: its pennant about 39 x 29 px at 0.64x): its staff stands
 * north from the east end of the bay's nameplate band, its foot pinned into the band (dark lead on the enamel, a pin's head),
 * its pennant flying west at the top over the bay's south-east corner, hatched (pencil's grey, so it reads over the dark
 * bay). Drawn on a square of FLAG_SIZE whose centre lies FLAG_OFF from the flag's foot (summary.ts FLAG, where the
 * sightline pins it). `t` (act two): drawn on, the staff down from its top into the band (pinned at 0.4), the pennant out
 * from it (to 0.9), the pin's head.
 */
const FLAG_SIZE = 96;
const FLAG_OFF: P2 = [-28, 38];
/** The flag's parts on its square (canvas u: x east, y south): the foot on FLAG, the staff's top, the pennant's tip and foot, the band's north edge. */
const FLAG_FOOT: Pt = [FLAG_SIZE / 2 - FLAG_OFF[0], FLAG_SIZE / 2 + FLAG_OFF[1]];
const FLAG_TOP: Pt = [FLAG_FOOT[0], FLAG_FOOT[1] - 78];
const FLAG_TIP: Pt = [FLAG_FOOT[0] - 58, FLAG_TOP[1] + 22];
const FLAG_LOW: Pt = [FLAG_FOOT[0], FLAG_TOP[1] + 44];
// (the band: the bay's south wall, FRESH.southWall deep; FLAG lies 12 u into it from its south edge)
const FLAG_BAND: number = FLAG_FOOT[1] - 22;
function flagSheet(g: G, s: number, t = 1): void {
  if (t <= 0) return;
  // the staff, from its top down into the band (light lead over the bay, dark on the enamel)
  const staff = share(t, 0, 0.4);
  const yTo = FLAG_TOP[1] + (FLAG_FOOT[1] - FLAG_TOP[1]) * staff;
  if (staff > 0) {
    leadOn(g, [FLAG_TOP, [FLAG_TOP[0], Math.min(yTo, FLAG_BAND)]], 4.6, 'desk', 1);
    if (yTo > FLAG_BAND) lead(g, [[FLAG_TOP[0], FLAG_BAND], [FLAG_TOP[0], yTo]], 4.6, 'enamel');
  }
  // the pennant: its hatch and edges wiped in from the staff, west
  const p = share(t, 0.4, 0.9);
  if (p > 0) {
    g.save();
    g.beginPath();
    g.rect(FLAG_FOOT[0] - (FLAG_FOOT[0] - FLAG_TIP[0] + 4) * p, 0, s, s);
    g.clip();
    g.beginPath();
    g.moveTo(...FLAG_TOP);
    g.lineTo(...FLAG_TIP);
    g.lineTo(...FLAG_LOW);
    g.closePath();
    g.fillStyle = rgba(PENCIL, 0.34);
    g.fill();
    g.save();
    g.clip();
    // its hatch: 45° pencil strokes on a fixed grid (they never swim as it wipes in)
    g.lineWidth = 2.6;
    g.strokeStyle = rgba(PENCIL, 0.8);
    g.setLineDash([]);
    for (let k = -s; k < s; k += 9) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + s, s);
      g.stroke();
    }
    g.restore();
    lead(g, [FLAG_TOP, FLAG_TIP, FLAG_LOW], 4.2, 'desk');
    g.restore();
  }
  // the pin's head, pressed into the band at the foot
  if (t >= 0.95) {
    lead(g, [FLAG_FOOT, [FLAG_FOOT[0] + 0.5, FLAG_FOOT[1] + 0.5]], 9, 'enamel');
  }
  grain(g, s, s, 97);
}

/**
 * The Persistent plate's words in vellum (beat9.ts PERSIST_WORDS): the trait plates' line (gl/plate.ts: "Persistent · " in
 * the sans SemiBold, the Han a step lighter, centred, fitted to the face), in the vellum's ink on its 14% fill, inside its
 * dashed edge: a proposed plate, drawn as the proposed parts are.
 */
export function persistWordsSheet(g: G, w: number, h: number, sans: string, words: { en: string; 'zh-Hans': string }): void {
  g.fillStyle = FILL;
  g.fillRect(2, 2, w - 4, h - 4);
  dashed(g, 3.4);
  g.setLineDash([16, 11]);
  g.strokeRect(3, 3, w - 6, h - 6);
  g.setLineDash([]);
  const en = `${words.en} · `;
  const zh = words['zh-Hans'];
  const fit = (em: number) => {
    g.font = `600 ${em}px ${sans}`;
    const a = g.measureText(en).width;
    g.font = `500 ${em}px ${sans}`;
    return a + g.measureText(zh).width;
  };
  let em = 43;
  while (em > 36 && fit(em) > w - 26) em -= 0.5;
  const x0 = (w - fit(em)) / 2;
  const base = h / 2 + em * 0.36;
  g.fillStyle = rgba(VELLUM_LINE, 0.9);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.font = `600 ${em}px ${sans}`;
  fillTextChecked(g, en, x0, base);
  const enW = g.measureText(en).width;
  g.font = `500 ${em}px ${sans}`;
  fillTextChecked(g, zh, x0 + enW, base);
}

/** A "?"'s hook as a polyline (its points for a glyph of size s at (ox, oy)). */
function queryHook(s: number, ox: number, oy: number): Pt[] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    // the hook: an arc over the top, then down to the stem
    const a = Math.PI * (1.05 + 1.25 * Math.min(1, t / 0.7));
    const p: [number, number] = t <= 0.7 ? [ox + s * 0.5 + Math.cos(a) * s * 0.21, oy + s * 0.3 + Math.sin(a) * s * 0.21] : [ox + s * 0.5, oy + s * 0.47 + (t - 0.7) * s * 0.55];
    pts.push(p);
  }
  return pts;
}
/** A pencil "?" (graphite at 80%, a lead of 4–6 u, two passes, grained); `on` a light surface the lead reads darker. `t` (act two): drawn on, the hook then the point. */
function query(g: G, s: number, seed: number, on: 'desk' | 'enamel' = 'desk', ox = 0, oy = 0, t = 1): void {
  const pts = queryHook(s, ox, oy);
  if (t < 1) {
    leadOn(g, pts, s * 0.052, on, share(t, 0, 0.8));
    if (t >= 0.9)
      lead(
        g,
        [
          [ox + s * 0.5, oy + s * 0.83],
          [ox + s * 0.51, oy + s * 0.86],
        ],
        s * 0.085,
        on,
      );
    if (on === 'desk' && t > 0) grain(g, s, s, seed);
    return;
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
/** The split sheet's pencil drawn so far (act two, beat10.ts: each 0..1). */
interface SplitLive {
  crack: number;
  shard: number;
  tear: number;
  windings: number;
  windingsQ: number;
}
const SPLIT_DONE: SplitLive = { crack: 1, shard: 1, tear: 1, windings: 1, windingsQ: 1 };
/**
 * The pencil over the Register: the reel split across (its crack at full pencil value), its tape torn,
 * its outer windings gone to pencil, a "?" on the split (sharding) and one on the outer windings
 * (memory over months), each at least 64 px.
 */
function splitSheet(g: G, w: number, h: number, live: SplitLive = SPLIT_DONE): void {
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
    leadOn(g, pts, 2.4, 'enamel', live.windings);
  }
  // the split: a jagged cut across the reel at full pencil value, its tape torn where it crosses the windings
  leadOn(
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
    live.crack,
  );
  leadOn(
    g,
    [
      [cx + 14, cy - R + 8],
      [cx + 22, cy - R + 14],
      [cx + 16, cy - R + 20],
      [cx + 25, cy - R + 27],
    ],
    2.6,
    'enamel',
    live.tear,
  );
  // sharding: a "?" on the west half; memory over months: a "?" over the north-east windings
  // (a "?" glyph is 0.77 of its box: 134 u is 66 px at 0.64x)
  if (live.shard > 0) query(g, 134, 41, 'enamel', cx - R * 0.5 - 67, cy - 76, live.shard);
  if (live.windingsQ > 0) query(g, 132, 43, 'enamel', cx + R * 0.56 - 66, cy - R * 0.88 - 62, live.windingsQ);
  grain(g, w, h, 41);
}

/** The handle a running bay's door lacks: its pull's outline in pencil, its two screw marks. `t` (act two): drawn on, the pull then its screws. */
function handleSheet(g: G, w: number, h: number, t = 1): void {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 28; i++) {
    const a = Math.PI + (i / 28) * Math.PI;
    pts.push([w / 2 + Math.cos(a) * (w / 2 - 6), h - 6 + Math.sin(a) * (h - 12)]);
  }
  if (t < 1) {
    leadOn(g, pts, 3.4, 'enamel', share(t, 0, 0.8));
    if (t >= 0.86) lead(g, [[6, h - 6], [6.5, h - 5]], 4.4, 'enamel');
    if (t >= 0.94) lead(g, [[w - 6, h - 6], [w - 5.5, h - 5]], 4.4, 'enamel');
    if (t > 0) grain(g, w, h, 73);
    return;
  }
  lead(g, pts, 3.4, 'enamel');
  for (const x of [6, w - 6]) lead(g, [[x, h - 6], [x + 0.5, h - 5]], 4.4, 'enamel');
  grain(g, w, h, 73);
}

/** A vellum slip (act two's queued work, beat 9): a dashed outline on a denser vellum fill than the sheets' (it is a thing in transit, read at 0.64x), its east end notched as every slip; nothing printed on it (proposed work: no words yet). */
export function slipSheet(g: G, w: number, h: number): void {
  g.fillStyle = rgba(VELLUM_FILL, 0.55);
  g.beginPath();
  g.moveTo(3, 3);
  g.lineTo(w - 3, 3);
  g.lineTo(w - 11, h / 2);
  g.lineTo(w - 3, h - 3);
  g.lineTo(3, h - 3);
  g.closePath();
  g.fill();
  dashed(g, 3);
  g.setLineDash([9, 5]);
  g.stroke();
  g.setLineDash([]);
}

/** The Watchdog's sightline as its own drawing (act two: it turns about the lens), along +x from the lens out `len` u: the wedge's fill and its dashed edges. */
export function beamSheet(g: G, len: number, h: number): void {
  const spread = SCOPE.spread;
  const cy = h / 2;
  g.fillStyle = rgba(VELLUM_FILL, 0.08);
  g.beginPath();
  g.moveTo(0, cy);
  g.lineTo(len, cy - Math.tan(spread) * len);
  g.lineTo(len, cy + Math.tan(spread) * len);
  g.closePath();
  g.fill();
  dashed(g, 2.8);
  g.setLineDash([14, 10]);
  for (const k of [-1, 1]) {
    g.beginPath();
    g.moveTo(0, cy);
    g.lineTo(len, cy + k * Math.tan(spread) * len);
    g.stroke();
  }
  g.setLineDash([]);
}

/** A tile of the etch's hatching (transparent), for the machines' tops: ETCH_TILE u square, the strokes continuous across its edges. */
export const ETCH_TILE = 100;
function etchTile(g: G): void {
  etchHatch(g, 0, 0, ETCH_TILE, ETCH_TILE);
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

/** One machine's geometry (built), each its own silhouette, pushed into `body` and `detail`. */
function machineParts(m: (typeof MACHINES)[number], body: BufferGeometry[], detail: BufferGeometry[]): void {
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

/**
 * The graphite machines (built), each its own silhouette: a rack server (two units, the slot lines of
 * its vents across its top), a tower workstation (tall, its vent column along its top), a closed laptop
 * (its lid a step in from the base, the hinge barrel along its north edge).
 */
function machineGeometry(): { body: BufferGeometry; detail: BufferGeometry } {
  const body: BufferGeometry[] = [];
  const detail: BufferGeometry[] = [];
  for (const m of MACHINES) machineParts(m, body, detail);
  return { body: merge(body), detail: merge(detail) };
}
/** Each machine on its own (act two: they rise one by one, and the etch kills each one's gloss in turn). */
function machineEach(): { body: BufferGeometry; detail: BufferGeometry }[] {
  return MACHINES.map((m) => {
    const body: BufferGeometry[] = [];
    const detail: BufferGeometry[] = [];
    machineParts(m, body, detail);
    return { body: merge(body), detail: merge(detail) };
  });
}
/** Each machine's top as the etch lies on it (its highest face, inset to it), and that face's height. */
export const MACHINE_TOPS: readonly { r: Rect; z: number }[] = MACHINES.map((m) => {
  const r = { x0: m.c[0] - m.w / 2, x1: m.c[0] + m.w / 2, y0: m.c[1] - m.d / 2, y1: m.c[1] + m.d / 2 };
  if (m.kind === 'server') return { r: { ...r, x0: r.x0 + 4, x1: r.x1 - 4, y0: r.y0 + 1, y1: r.y1 - 1 }, z: m.h + 2.3 };
  if (m.kind === 'workstation') return { r: { ...r, x0: r.x0 + 2, x1: r.x1 - 2, y0: r.y0 + 2, y1: r.y1 - 2 }, z: m.h + 2.7 };
  return { r: { x0: r.x0 + 5, x1: r.x1 - 5, y0: r.y0 + 10, y1: r.y1 - 7 }, z: m.h + 0.3 };
});
/** The server's work light: a status slit along its top's west margin (it opens from a line, lights, goes out, closes). */
export const SERVER_LAMP = (() => {
  const m = MACHINES[0]!;
  const x0 = m.c[0] - m.w / 2 + 5;
  return { c: [x0 + 3.5, m.c[1]] as P2, w: 7, d: m.d - 28, z: m.h + 0.2 };
})();
/** The slit's dark: never darker than the slate's floor tone (as a capped bay's slot, objects/Trace.tsx). */
const LAMP_DARK = '#2A2D2C';

/** A plane `w` × `d` at (cx, cy, z) laid from its west edge to `k` of its width: its plane and its UVs cut at the lay's front. */
function wipeGeometry(w: number, d: number, cx: number, cy: number, z: number, k: number): BufferGeometry {
  const g = new PlaneGeometry(w * k, d);
  const uv = g.getAttribute('uv') as BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
  uv.needsUpdate = true;
  g.translate(cx - w / 2 + (w * k) / 2, cy, z);
  return g;
}
/** A plane over [x0, x1] × [y0, y1] at z whose UVs are world-fixed (u = x / tile), so a tiled hatching never swims as it grows. */
function tiledGeometry(x0: number, x1: number, y0: number, y1: number, z: number, tile: number): BufferGeometry {
  const g = new PlaneGeometry(x1 - x0, y1 - y0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  const pos = g.getAttribute('position') as BufferAttribute;
  const uv = g.getAttribute('uv') as BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / tile, pos.getY(i) / tile);
  uv.needsUpdate = true;
  return g;
}

/** A texture and its vellum material redrawn for a live drawing's key (null: the static one is used), disposed as the key changes. */
function useLive(key: string | null, w: number, h: number, draw: (g: G) => void, an: number): MeshBasicMaterial | null {
  const mat = useMemo(() => (key === null ? null : vellum(texture(w, h, draw, an, 'transparent'))), [key]);
  useLayoutEffect(
    () => () => {
      mat?.map?.dispose();
      mat?.dispose();
    },
    [mat],
  );
  return mat;
}
/** A geometry made for a key (null: none), disposed as the key changes. */
function useGeo(key: string | null, make: () => BufferGeometry): BufferGeometry | null {
  const g = useMemo(() => (key === null ? null : make()), [key]);
  useLayoutEffect(() => () => g?.dispose(), [g]);
  return g;
}
const keyOf = (x: unknown): string => JSON.stringify(x);
const q3 = (v: number): number => Math.round(v * 1000) / 1000;
/** A sheet's lay: 1 laid (its static plane), 0 not yet (null: not drawn), else its wipe's key. */
const layKey = (k: number): string | null => (k >= 1 || k <= 0 ? null : String(q3(k)));

/**
 * The proposed and the open parts. `state`: their pose in act two's world from beat 9 on (desk/beat9.ts proposedAt,
 * mounted by objects/Beat9.tsx); absent or null, still (d)'s static pose (the summary's mount), the end state every pose
 * arrives at. `step`, `late`: the frame's step (DeskState.step, testsStep): inside a `<Step>` the vellum and pencil fade
 * with the set they ride (VELLUM_STEP), the machines step with the kit's set (useDeskMats); unstepped, exactly still (d).
 * `watchOpacity` (act two: objects/Beat9.tsx WATCHDOG_STEP_ID): the Watchdog's sheet and its pencil flag ride their own id;
 * absent, they ride the enclosing step with the rest.
 */
export function Proposed({ state, step, late, watchOpacity }: { state?: ProposedState | null; step?: DeskState['step']; late?: number; watchOpacity?: number }) {
  const m = useDeskMats();
  const opacity = useVellumOpacity(step, late);
  const wOpacity = watchOpacity ?? opacity;
  const gl = useThree((x) => x.gl);
  const an = Math.min(8, gl.capabilities.getMaxAnisotropy());
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
      // the flag standing on the stuck bay's nameplate band, its pennant over the bay (its square's centre FLAG_OFF from its foot)
      flag: plane(FLAG_SIZE, FLAG_SIZE, FLAG[0] + FLAG_OFF[0], FLAG[1] + FLAG_OFF[1], FLAG[2]),
      queries: QUERIES.map((q) => plane(q.size, q.size, q.at[0], q.at[1], q.at[2])),
      split: plane(SPLIT, SPLIT, REEL.x, REEL.y, REEL.packZ[1] + 0.6),
      handle: plane(HANDLE.w, HANDLE.d, HANDLE.c[0], HANDLE.c[1], BAYS.docs.wallH + 0.6),
      machines: machines.body,
      machineDetail: machines.detail,
    };
  }, []);
  useLayoutEffect(() => () => Object.values(g).forEach((x) => (Array.isArray(x) ? x.forEach((y) => y.dispose()) : x.dispose())), [g]);
  useVellumStep([mats.loop, mats.tethers, mats.plan, mats.cabinet, mats.split, mats.handle, ...mats.clips, ...mats.query], opacity);
  useVellumStep([mats.watch, mats.flag], wOpacity);
  if (!state) {
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
  return <LiveProposed s={state} g={g} mats={mats} an={an} opacity={opacity} watchOpacity={wOpacity} />;
}

type Geo = { loop: BufferGeometry; tethers: BufferGeometry; plan: BufferGeometry; cabinet: BufferGeometry; clips: BufferGeometry[]; watch: BufferGeometry; flag: BufferGeometry; queries: BufferGeometry[]; split: BufferGeometry; handle: BufferGeometry; machines: BufferGeometry; machineDetail: BufferGeometry };
type Mats = { loop: MeshBasicMaterial; tethers: MeshBasicMaterial; plan: MeshBasicMaterial; cabinet: MeshBasicMaterial; clips: MeshBasicMaterial[]; watch: MeshBasicMaterial; flag: MeshBasicMaterial; query: MeshBasicMaterial[]; split: MeshBasicMaterial; handle: MeshBasicMaterial };

/** Act two's proposed parts at a state (each ends on the static drawing: the same textures, planes and materials). */
function LiveProposed({ s, g, mats, an, opacity, watchOpacity }: { s: ProposedState; g: Geo; mats: Mats; an: number; opacity: number; watchOpacity: number }) {
  const m = useDeskMats();
  const mode = useStepMode();
  // ---- the live drawings (null keys: at their last value, the static drawing)
  const loopLive: LoopLive = { strut: q3(s.strutInk), plate: s.plate === null ? null : q3(s.plate), etch: s.etch?.loop };
  const loopFinal = loopLive.strut >= 1 && loopLive.plate === 0 && !spanOn(loopLive.etch);
  const loopMat = useLive(loopFinal ? null : keyOf(loopLive), SHEET_W, SHEET_H, (c) => loopSheet(c, loopLive), an);
  const tetherLive: TetherLive = { march: s.march.map(q3), etch: s.etch?.tethers ?? [] };
  const tetherFinal = tetherLive.march.every((x) => x % MARCH_PERIOD === 0) && !tetherLive.etch.some(spanOn);
  const tetherMat = useLive(tetherFinal ? null : keyOf(tetherLive), TETHER.x1 - TETHER.x0, TETHER.y1 - TETHER.y0, (c) => tetherSheet(c, tetherLive), an);
  const planEtch = s.etch?.plan;
  const planMat = useLive(spanOn(planEtch) ? keyOf(planEtch) : null, VELLUM.plan.w, VELLUM.plan.d, (c) => planSheet(c, VELLUM.plan.w, VELLUM.plan.d, planEtch), an);
  const clipEtch = s.etch?.clips ?? [];
  const clipMats = [
    useLive(spanOn(clipEtch[0]) ? keyOf(clipEtch[0]) : null, CLIP_SIZE[0], CLIP_SIZE[1], (c) => clipSheet(c, MACHINES[0]!.kind, CLIP_SIZE[0], CLIP_SIZE[1], clipEtch[0]), an),
    useLive(spanOn(clipEtch[1]) ? keyOf(clipEtch[1]) : null, CLIP_SIZE[0], CLIP_SIZE[1], (c) => clipSheet(c, MACHINES[1]!.kind, CLIP_SIZE[0], CLIP_SIZE[1], clipEtch[1]), an),
    useLive(spanOn(clipEtch[2]) ? keyOf(clipEtch[2]) : null, CLIP_SIZE[0], CLIP_SIZE[1], (c) => clipSheet(c, MACHINES[2]!.kind, CLIP_SIZE[0], CLIP_SIZE[1], clipEtch[2]), an),
  ];
  const marks = q3(s.marks);
  const watchMat = useLive(marks >= 1 ? null : String(marks), WD.x1 - WD.x0, WD.y1 - WD.y0, (c) => watchSheet(c, marks), an);
  const flagT = q3(s.flag);
  const flagMat = useLive(flagT >= 1 || flagT <= 0 ? null : String(flagT), FLAG_SIZE, FLAG_SIZE, (c) => flagSheet(c, FLAG_SIZE, flagT), an);
  const qT = s.queries.map(q3);
  const queryMats = [
    useLive(qT[0]! >= 1 || qT[0]! <= 0 ? null : String(qT[0]), QUERIES[0]!.size, QUERIES[0]!.size, (c) => query(c, QUERIES[0]!.size, 11, 'desk', 0, 0, qT[0]), an),
    useLive(qT[1]! >= 1 || qT[1]! <= 0 ? null : String(qT[1]), QUERIES[1]!.size, QUERIES[1]!.size, (c) => query(c, QUERIES[1]!.size, 12, 'desk', 0, 0, qT[1]), an),
  ];
  const sp: SplitLive = { crack: q3(s.split.crack), shard: q3(s.split.shard), tear: q3(s.split.tear), windings: q3(s.split.windings), windingsQ: q3(s.split.windingsQ) };
  const spAny = Object.values(sp).some((x) => x > 0);
  const spDone = Object.values(sp).every((x) => x >= 1);
  const splitMat = useLive(spDone || !spAny ? null : keyOf(sp), SPLIT, SPLIT, (c) => splitSheet(c, SPLIT, SPLIT, sp), an);
  const handleT = q3(s.handle);
  const handleMat = useLive(handleT >= 1 || handleT <= 0 ? null : String(handleT), HANDLE.w, HANDLE.d, (c) => handleSheet(c, HANDLE.w, HANDLE.d, handleT), an);

  // ---- the lays (each sheet's plane cut at its front; the tethers and clips under one front)
  const L = s.lay;
  const loopLay = useGeo(layKey(L.loop), () => wipeGeometry(SHEET_W, SHEET_H, (LS.x0 + LS.x1) / 2, (LS.y0 + LS.y1) / 2, 0.4, L.loop));
  const planLay = useGeo(layKey(L.plan), () => wipeGeometry(VELLUM.plan.w, VELLUM.plan.d, VELLUM.plan.c[0], VELLUM.plan.c[1], 0.4, L.plan));
  const cabLay = useGeo(layKey(L.cabinet), () => wipeGeometry(VELLUM.cabinet.w, VELLUM.cabinet.d, VELLUM.cabinet.c[0], VELLUM.cabinet.c[1], 0.4, L.cabinet));
  // (the Watchdog's sheet is laid over its drawing's run, its plate's west edge to its centre line's east end: the blank
  // margins either side are not part of the lay, so every one of its 12 f shows it move)
  const wK = L.watch <= 0 || L.watch >= 1 ? L.watch : WATCH_LAY_FROM + (WATCH_LAY_TO - WATCH_LAY_FROM) * L.watch;
  const watchLay = useGeo(layKey(wK), () => wipeGeometry(WD.x1 - WD.x0, WD.y1 - WD.y0, (WD.x0 + WD.x1) / 2, (WD.y0 + WD.y1) / 2, 0.4, wK));
  const front = TETHER_LAY.x0 + (TETHER_LAY.x1 - TETHER_LAY.x0) * L.tethers;
  const tK = Math.min(1, Math.max(0, (front - TETHER.x0) / (TETHER.x1 - TETHER.x0)));
  const tetherLay = useGeo(layKey(tK), () => wipeGeometry(TETHER.x1 - TETHER.x0, TETHER.y1 - TETHER.y0, (TETHER.x0 + TETHER.x1) / 2, (TETHER.y0 + TETHER.y1) / 2, 0.45, tK));
  const cK = CLIPS.map((c) => Math.min(1, Math.max(0, (front - (c[0] - CLIP_SIZE[0] / 2)) / CLIP_SIZE[0])));
  const clipLays = [
    useGeo(layKey(cK[0]!), () => wipeGeometry(CLIP_SIZE[0], CLIP_SIZE[1], CLIPS[0]![0], CLIPS[0]![1], 0.5, cK[0]!)),
    useGeo(layKey(cK[1]!), () => wipeGeometry(CLIP_SIZE[0], CLIP_SIZE[1], CLIPS[1]![0], CLIPS[1]![1], 0.5, cK[1]!)),
    useGeo(layKey(cK[2]!), () => wipeGeometry(CLIP_SIZE[0], CLIP_SIZE[1], CLIPS[2]![0], CLIPS[2]![1], 0.5, cK[2]!)),
  ];
  const lay = (k: number, cut: BufferGeometry | null, whole: BufferGeometry): BufferGeometry | null => (k <= 0 ? null : k >= 1 ? whole : cut);

  // ---- the machines: risen, their gloss, the etch on their tops, the server's work light
  const each = useMemo(() => machineEach(), []);
  useLayoutEffect(() => () => each.forEach((x) => (x.body.dispose(), x.detail.dispose())), [each]);
  const dull = useMemo(() => MACHINES.map(() => graphite('#626764', { stepped: mode })), [mode]);
  useLayoutEffect(() => () => dull.forEach((x) => x.dispose()), [dull]);
  const gloss = s.gloss;
  useLayoutEffect(() => {
    // the etch kills the gloss: rougher, a little darker (its specular gone), back as the etch leaves
    dull.forEach((x, i) => {
      const k = gloss[i] ?? 0;
      x.roughness = 0.42 + (0.97 - 0.42) * k;
      x.color.set('#626764').lerp(new Color('#555957'), k);
    });
  }, [dull, gloss]);
  const settled = s.dz.every((z) => z === 0) && gloss.every((k) => k <= 0);
  const hatchTile = useMemo(() => {
    const t = texture(ETCH_TILE, ETCH_TILE, etchTile, an, 'transparent');
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    return vellum(t);
  }, [an]);
  useLayoutEffect(
    () => () => {
      hatchTile.map?.dispose();
      hatchTile.dispose();
    },
    [hatchTile],
  );
  const tops = s.etch?.tops ?? [];
  const topKey = (i: number): string | null => (spanOn(tops[i]) ? keyOf(tops[i]) : null);
  const topGeo = (i: number) => {
    const T = MACHINE_TOPS[i]!;
    const w = T.r.x1 - T.r.x0;
    const sp0 = tops[i]!;
    return tiledGeometry(T.r.x0 + sp0[0] * w, T.r.x0 + sp0[1] * w, T.r.y0, T.r.y1, T.z, ETCH_TILE);
  };
  const topGeos = [useGeo(topKey(0), () => topGeo(0)), useGeo(topKey(1), () => topGeo(1)), useGeo(topKey(2), () => topGeo(2))];
  const lampGeo = useMemo(() => plane(SERVER_LAMP.w, SERVER_LAMP.d, 0, 0, 0), []);
  useLayoutEffect(() => () => lampGeo.dispose(), [lampGeo]);
  const lampMat = useMemo(() => new MeshBasicMaterial({ color: new Color(LAMP_DARK) }), []);
  useLayoutEffect(() => () => lampMat.dispose(), [lampMat]);
  const lit = s.lamp;
  // (a stepped light steps with its set's amount, as the bays' slots do: the vellum's opacity carries it)
  const lampK = (1 - opacity) / VELLUM_STEP;
  useLayoutEffect(() => {
    // dark (the floor tone's) to the server's work light, clamped under the bloom (EMIT.slotDocs), geometric per channel
    const dark = new Color(LAMP_DARK);
    const on = new Color(LIGHT_HEX.work).multiplyScalar(EMIT.slotDocs);
    lampMat.color.setRGB(dark.r * (on.r / dark.r) ** lit, dark.g * (on.g / dark.g) ** lit, dark.b * (on.b / dark.b) ** lit);
    if (lampK > 0) lampMat.color.copy(stepColour(lampMat.color, lampK));
  }, [lampMat, lit, lampK]);
  useVellumStep([loopMat, tetherMat, planMat, ...clipMats, ...queryMats, splitMat, handleMat, hatchTile], opacity);
  useVellumStep([watchMat, flagMat], watchOpacity);

  return (
    <group>
      {settled ? (
        <>
          <mesh geometry={g.machines} material={m.graphite} />
          <mesh geometry={g.machineDetail} material={m.graphiteDark} />
        </>
      ) : (
        each.map((x, i) => (
          <group key={i} position={[0, 0, s.dz[i] ?? 0]}>
            <mesh geometry={x.body} material={(gloss[i] ?? 0) > 0 ? dull[i] : m.graphite} />
            <mesh geometry={x.detail} material={m.graphiteDark} />
          </group>
        ))
      )}
      {s.lampOpen > 0 && <mesh geometry={lampGeo} material={lampMat} position={[SERVER_LAMP.c[0], SERVER_LAMP.c[1], SERVER_LAMP.z + (s.dz[0] ?? 0)]} scale={[s.lampOpen, 1, 1]} />}
      {topGeos.map((x, i) => (x ? <mesh key={`top${i}`} geometry={x} material={hatchTile} renderOrder={2} /> : null))}
      {lay(L.loop, loopLay, g.loop) && <mesh geometry={lay(L.loop, loopLay, g.loop)!} material={loopMat ?? mats.loop} renderOrder={2} />}
      {lay(tK, tetherLay, g.tethers) && <mesh geometry={lay(tK, tetherLay, g.tethers)!} material={tetherMat ?? mats.tethers} renderOrder={2} />}
      {lay(L.plan, planLay, g.plan) && <mesh geometry={lay(L.plan, planLay, g.plan)!} material={planMat ?? mats.plan} renderOrder={2} />}
      {lay(L.cabinet, cabLay, g.cabinet) && <mesh geometry={lay(L.cabinet, cabLay, g.cabinet)!} material={mats.cabinet} renderOrder={2} />}
      {g.clips.map((c, i) => {
        const geo = lay(cK[i]!, clipLays[i]!, c);
        return geo ? <mesh key={i} geometry={geo} material={clipMats[i] ?? mats.clips[i]} renderOrder={2} /> : null;
      })}
      {lay(wK, watchLay, g.watch) && <mesh geometry={lay(wK, watchLay, g.watch)!} material={watchMat ?? mats.watch} renderOrder={2} />}
      {flagT > 0 && <mesh geometry={g.flag} material={flagMat ?? mats.flag} renderOrder={3} />}
      {spAny && <mesh geometry={g.split} material={splitMat ?? mats.split} renderOrder={3} />}
      {handleT > 0 && <mesh geometry={g.handle} material={handleMat ?? mats.handle} renderOrder={3} />}
      {g.queries.map((q, i) => (qT[i]! > 0 ? <mesh key={i} geometry={q} material={queryMats[i] ?? mats.query[i]} renderOrder={3} /> : null))}
    </group>
  );
}
