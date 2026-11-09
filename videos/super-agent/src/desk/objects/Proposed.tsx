/**
 * The proposed and the open, at the summary (desk/summary.ts; STORYBOARD 9.1–10.3).
 * - Proposed parts exist only as vellum drawings laid flat east of the system: the plan of the deck,
 *   the state cabinet, the cloud loop (an open ring track, never a filled disc) with the lid strut
 *   docked on it and the Persistent plate beside it, curved tethers of unequal length out to a daemon
 *   clip beside each machine; the Watchdog, an inspection station outside the system, its sightline
 *   reaching in to the bays. Vellum is never drawn solid and casts no shadow.
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
import { BAYS, REEL } from '../layout.ts';
import { CLIP_DX, HANDLE, MACHINES, QUERIES, VELLUM, WATCHDOG } from '../summary.ts';

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

/** The loop sheet's extent (world): from west of the ring to the daemon clips' west edges, north and south of the outer clips. */
const L = VELLUM.loop;
const CLIPS = MACHINES.map((m) => [m.c[0] + CLIP_DX, m.c[1]] as const);
const LOOP_SHEET = {
  x0: L.c[0] - L.a - 70,
  x1: Math.max(...CLIPS.map((c) => c[0])) - 28,
  y0: Math.min(...CLIPS.map((c) => c[1])) - 60,
  y1: Math.max(...CLIPS.map((c) => c[1])) + 60,
} as const;
const SHEET_W = LOOP_SHEET.x1 - LOOP_SHEET.x0;
const SHEET_H = LOOP_SHEET.y1 - LOOP_SHEET.y0;
/** World to the loop sheet's canvas (north up). */
const sx = (x: number): number => x - LOOP_SHEET.x0;
const sy = (y: number): number => LOOP_SHEET.y1 - y;

/**
 * The cloud loop: an open ring track (two dashed rails, their band at the vellum fill, the inside empty
 * desk), running anticlockwise to a chevron at its open end; the lid strut docked across the track at
 * its foot; the Persistent plate beside it with its mark (a looped arrow; no word at this distance); the
 * tethers curving out to each daemon clip, each its own length and bend.
 */
function loopSheet(g: G): void {
  const cx = sx(L.c[0]);
  const cy = sy(L.c[1]);
  const ro = L.a;
  const ri = L.a - 18;
  const a0 = -0.95;
  const a1 = Math.PI * 2 - 1.45;
  // the track's band
  g.fillStyle = FILL;
  g.beginPath();
  g.arc(cx, cy, ro, a0, a1);
  g.arc(cx, cy, ri, a1, a0, true);
  g.closePath();
  g.fill();
  dashed(g, 3.6);
  for (const r of [ro, ri]) {
    g.beginPath();
    g.arc(cx, cy, r, a0, a1);
    g.stroke();
  }
  // its sleepers, drawn finer: a track, not a ring
  g.setLineDash([]);
  g.strokeStyle = FAINT;
  g.lineWidth = 2;
  for (let a = a0 + 0.12; a < a1; a += 0.26) {
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (ri + 2), cy + Math.sin(a) * (ri + 2));
    g.lineTo(cx + Math.cos(a) * (ro - 2), cy + Math.sin(a) * (ro - 2));
    g.stroke();
  }
  // the chevron at the open end: the way it runs
  const ae = a1;
  const mx = cx + Math.cos(ae) * (ri + 9);
  const my = cy + Math.sin(ae) * (ri + 9);
  const tx = -Math.sin(ae);
  const ty = Math.cos(ae);
  g.strokeStyle = LINE;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(mx - tx * 2 + Math.cos(ae) * 16, my - ty * 2 + Math.sin(ae) * 16);
  g.lineTo(mx + tx * 16, my + ty * 16);
  g.lineTo(mx - tx * 2 - Math.cos(ae) * 16, my - ty * 2 - Math.sin(ae) * 16);
  g.stroke();
  // the lid strut, docked across the track at its foot (south): its bar and its clip end
  const fy = cy + (ro + ri) / 2;
  g.lineWidth = 3.4;
  g.strokeRect(cx - 34, fy - 7, 68, 14);
  g.beginPath();
  g.arc(cx + 42, fy, 7, 0, Math.PI * 2);
  g.stroke();
  // the Persistent plate under the strut, south of the ring: a looped arrow
  const px = cx - 6;
  const py = fy + 46;
  g.setLineDash([12, 8]);
  g.lineWidth = 3;
  g.strokeRect(px - 40, py - 20, 80, 40);
  g.setLineDash([]);
  g.lineWidth = 3.2;
  g.beginPath();
  g.arc(px, py, 11, 0.5, Math.PI * 2 - 0.2);
  g.stroke();
  g.beginPath();
  g.moveTo(px + 14, py - 4);
  g.lineTo(px + 10, py + 6);
  g.lineTo(px + 2, py + 1);
  g.stroke();
  // the tethers: each leaves the track's outer rail at its own angle and curves out to its clip's west edge
  dashed(g, 3.2);
  const leave = [-0.55, 0.12, 0.78];
  const bend = [-46, 38, 64];
  MACHINES.forEach((m, i) => {
    const a = leave[i];
    const x0 = cx + Math.cos(a) * ro;
    const y0 = cy + Math.sin(a) * ro;
    const x1 = sx(m.c[0] + CLIP_DX - 28);
    const y1 = sy(m.c[1]);
    g.beginPath();
    g.moveTo(x0, y0);
    g.bezierCurveTo(x0 + Math.cos(a) * 60, y0 + Math.sin(a) * 60 + bend[i], x1 - 70, y1 - bend[i] * 0.6, x1, y1);
    g.stroke();
  });
  g.setLineDash([]);
}

function planSheet(g: G, w: number, h: number): void {
  g.fillStyle = FILL;
  g.fillRect(0, 0, w, h);
  dashed(g);
  g.strokeRect(6, 6, w - 12, h - 12);
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
}

function cabinetSheet(g: G, w: number, h: number): void {
  g.fillStyle = FILL;
  g.fillRect(0, 0, w, h);
  dashed(g);
  g.strokeRect(6, 6, w - 12, h - 12);
  g.strokeStyle = LINE;
  g.lineWidth = 3;
  g.setLineDash([]);
  for (let i = 0; i < 3; i++) {
    const y = 22 + i * ((h - 36) / 3);
    g.strokeRect(22, y, w - 44, (h - 36) / 3 - 8);
    g.strokeRect(w / 2 - 16, y + (h - 36) / 6 - 8, 32, 8);
  }
}

/** A daemon clip: a spring clip in plan, its jaw open toward its machine. */
function clipSheet(g: G, w: number, h: number): void {
  dashed(g, 3.4);
  g.setLineDash([12, 8]);
  g.beginPath();
  g.moveTo(w - 8, 10);
  g.lineTo(14, 10);
  g.quadraticCurveTo(6, h / 2, 14, h - 10);
  g.lineTo(w - 8, h - 10);
  g.stroke();
  g.setLineDash([]);
  g.lineWidth = 3;
  g.beginPath();
  g.arc(w * 0.42, h / 2, 8, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(w * 0.42 + 8, h / 2);
  g.lineTo(w - 6, h / 2 - 12);
  g.moveTo(w * 0.42 + 8, h / 2);
  g.lineTo(w - 6, h / 2 + 12);
  g.stroke();
}

function watchSheet(g: G, w: number, h: number): void {
  const cx = w * 0.62;
  const cy = h * 0.62;
  const r = WATCHDOG.r * 0.55;
  // the sightline: a dashed wedge north-west, reaching in to the bays
  const a = Math.atan2(-(WATCHDOG.look[1] - WATCHDOG.c[1]), WATCHDOG.look[0] - WATCHDOG.c[0]);
  g.fillStyle = rgba(VELLUM_FILL, 0.08);
  g.beginPath();
  g.moveTo(cx, cy);
  g.arc(cx, cy, w * 0.6, a - 0.16, a + 0.16);
  g.closePath();
  g.fill();
  dashed(g, 3.4);
  g.stroke();
  // the station: a round base, its lens, a short post
  g.fillStyle = FILL;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  dashed(g);
  g.stroke();
  g.setLineDash([]);
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(cx + Math.cos(a) * r * 0.42, cy - Math.sin(a) * r * 0.42);
  g.lineTo(cx + Math.cos(a) * r * 1.25, cy - Math.sin(a) * r * 1.25);
  g.stroke();
}

/** A pencil "?" (graphite at 80%, a lead of 4–6 u, two passes, grained). */
function query(g: G, s: number, seed: number): void {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    // the hook: an arc over the top, then down to the stem
    const a = Math.PI * (1.05 + 1.25 * Math.min(1, t / 0.7));
    const p: [number, number] = t <= 0.7 ? [s * 0.5 + Math.cos(a) * s * 0.21, s * 0.3 + Math.sin(a) * s * 0.21] : [s * 0.5, s * 0.47 + (t - 0.7) * s * 0.55];
    pts.push(p);
  }
  lead(g, pts, s * 0.052);
  lead(
    g,
    [
      [s * 0.5, s * 0.83],
      [s * 0.51, s * 0.86],
    ],
    s * 0.085,
  );
  grain(g, s, s, seed);
}

/** The pencil over the Register: the reel split across, its tape torn, its outer windings gone to pencil. */
function splitSheet(g: G, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  // the outer windings, in pencil (the reel's paper stops short of them)
  for (let k = 0; k < 5; k++) {
    const r = w / 2 - 3 - k * 3.4;
    const from = -0.4 + k * 0.17;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const a = from + (i / 40) * 4.6;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    lead(g, pts, 2.2);
  }
  // the split: a jagged cut across the reel, its tape torn where it crosses the windings
  lead(
    g,
    [
      [cx - 10, 2],
      [cx - 2, h * 0.18],
      [cx - 9, h * 0.3],
      [cx + 4, h * 0.45],
      [cx - 3, h * 0.6],
      [cx + 6, h * 0.78],
      [cx - 2, h - 2],
    ],
    3.6,
  );
  lead(
    g,
    [
      [cx + 14, 8],
      [cx + 22, 14],
      [cx + 16, 20],
      [cx + 25, 27],
    ],
    2.4,
  );
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
      plan: t(VELLUM.plan.w, VELLUM.plan.d, (g) => planSheet(g, VELLUM.plan.w, VELLUM.plan.d)),
      cabinet: t(VELLUM.cabinet.w, VELLUM.cabinet.d, (g) => cabinetSheet(g, VELLUM.cabinet.w, VELLUM.cabinet.d)),
      clip: t(56, 64, (g) => clipSheet(g, 56, 64)),
      watch: t(WATCHDOG.r * 6, WATCHDOG.r * 4, (g) => watchSheet(g, WATCHDOG.r * 6, WATCHDOG.r * 4)),
      query: QUERIES.map((q, i) => t(q.size, q.size, (g) => query(g, q.size, 11 + i))),
      split: t(REEL.r * 2, REEL.r * 2, (g) => splitSheet(g, REEL.r * 2, REEL.r * 2)),
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

export function Proposed() {
  const m = useDeskMats();
  const tex = useProposedTextures();
  const mats = useMemo(
    () => ({
      loop: vellum(tex.loop),
      plan: vellum(tex.plan),
      cabinet: vellum(tex.cabinet),
      clip: vellum(tex.clip),
      watch: vellum(tex.watch),
      query: tex.query.map((t) => vellum(t)),
      split: vellum(tex.split),
      handle: vellum(tex.handle),
    }),
    [tex],
  );
  useLayoutEffect(
    () => () => {
      for (const x of [mats.loop, mats.plan, mats.cabinet, mats.clip, mats.watch, mats.split, mats.handle, ...mats.query]) {
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
      loop: flat(SHEET_W, SHEET_H, [(LOOP_SHEET.x0 + LOOP_SHEET.x1) / 2, (LOOP_SHEET.y0 + LOOP_SHEET.y1) / 2]),
      plan: flat(VELLUM.plan.w, VELLUM.plan.d, VELLUM.plan.c),
      cabinet: flat(VELLUM.cabinet.w, VELLUM.cabinet.d, VELLUM.cabinet.c),
      clips: merge(CLIPS.map((c) => flat(56, 64, c))),
      watch: flat(WATCHDOG.r * 6, WATCHDOG.r * 4, [WATCHDOG.c[0] - WATCHDOG.r * 0.72, WATCHDOG.c[1] + WATCHDOG.r * 0.48]),
      queries: QUERIES.map((q) => plane(q.size, q.size, q.at[0], q.at[1], q.at[2])),
      split: plane(REEL.r * 2, REEL.r * 2, REEL.x, REEL.y, REEL.packZ[1] + 0.6),
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
      <mesh geometry={g.plan} material={mats.plan} renderOrder={2} />
      <mesh geometry={g.cabinet} material={mats.cabinet} renderOrder={2} />
      <mesh geometry={g.clips} material={mats.clip} renderOrder={2} />
      <mesh geometry={g.watch} material={mats.watch} renderOrder={2} />
      <mesh geometry={g.split} material={mats.split} renderOrder={3} />
      <mesh geometry={g.handle} material={mats.handle} renderOrder={3} />
      {g.queries.map((q, i) => (
        <mesh key={i} geometry={q} material={mats.query[i]} renderOrder={3} />
      ))}
    </group>
  );
}
