/**
 * The proposed and the open, at the summary (desk/summary.ts; STORYBOARD 9.1–10.3).
 * - Proposed parts exist only as vellum drawings laid flat east of the system: the plan of the deck,
 *   the state cabinet, the cloud loop with its tethers, a daemon clip beside each machine, the
 *   lid strut docked on the loop and the Persistent plate; the Watchdog, an inspection station with
 *   its sightline, outside the engraved system boundary. Vellum is never drawn solid and casts no shadow.
 * - The machines a cloud loop would keep running are real: graphite (built).
 * - Open problems are pencil, drawn once: a "?" beside the tethers, on the reel's outer windings, on
 *   the split reel (with the split and the tear), and on a running bay's door beside the outline of
 *   the handle it lacks.
 */
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import type { BufferGeometry, Texture } from 'three';
import { WORDS } from '../../cues.ts';
import { merge, plane, slab, sweep } from '../geom.ts';
import { HEX, vellum } from '../gl/materials.ts';
import { texture } from '../gl/text.ts';
import { useDeskMats } from '../kit.tsx';
import { BAYS, REEL, rectC, type P2 } from '../layout.ts';
import { BOUNDARY, CLIP_DX, MACHINES, QUERIES, VELLUM, WATCHDOG } from '../summary.ts';

/** The cloud loop's sheet: from 0.3 of its width west of the loop's centre to the daemon clips' west edge; tall enough for the outer tethers. */
const LOOP_SHEET = { w: (MACHINES[0].c[0] + CLIP_DX - 30 - VELLUM.loop.c[0]) / 0.7, h: 2 * (MACHINES[0].c[1] - VELLUM.loop.c[1]) + 80 } as const;
const LINE = 'rgba(226,224,217,0.8)';
const FAINT = 'rgba(226,224,217,0.45)';
const FILL = 'rgba(217,219,213,0.14)';
/** Vellum's dashed edge, at 0.5× still 14/10 px at 2.5 px on screen. */
const DASH = [28, 20];

type G = CanvasRenderingContext2D;
function dashed(g: G, w = 5): void {
  g.strokeStyle = LINE;
  g.lineWidth = w;
  g.setLineDash(DASH);
}

/** The cloud loop's sheet: the loop itself, the lid strut docked on it (vellum now), the Persistent plate and the tethers out to each daemon clip. */
function loopSheet(g: G, w: number, h: number, family: string): void {
  const cx = w * 0.3;
  const cy = h / 2;
  const r = VELLUM.loop.a;
  g.fillStyle = FILL;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  dashed(g);
  g.beginPath();
  g.arc(cx, cy, r, 0.25, Math.PI * 2 - 0.1);
  g.stroke();
  // the loop's direction: a chevron where it closes
  g.setLineDash([]);
  g.beginPath();
  g.moveTo(cx + r - 14, cy - 34);
  g.lineTo(cx + r, cy - 18);
  g.lineTo(cx + r + 14, cy - 34);
  g.stroke();
  // the strut, docked at the loop's foot (it took the receiver's material)
  g.lineWidth = 4;
  g.strokeRect(cx - 40, cy + r - 9, 80, 18);
  g.beginPath();
  g.moveTo(cx - 12, cy + r - 9);
  g.lineTo(cx - 12, cy + r + 9);
  g.stroke();
  // the Persistent plate inside the loop
  g.setLineDash([14, 10]);
  g.lineWidth = 3;
  g.strokeRect(cx - 78, cy - 22, 156, 44);
  g.setLineDash([]);
  g.fillStyle = LINE;
  g.font = `700 22px ${family}`;
  g.textAlign = 'center';
  g.fillText(WORDS.traitPersistent.en, cx, cy + 8);
  // tethers to the three daemon clips (east)
  dashed(g, 3.5);
  for (const m of MACHINES) {
    const y = cy - (m.c[1] - VELLUM.loop.c[1]);
    g.beginPath();
    g.moveTo(cx + r * 0.92, cy - (cy - y) * 0.3);
    g.bezierCurveTo(w * 0.62, cy - (cy - y) * 0.5, w * 0.78, y, w - 4, y);
    g.stroke();
  }
}

function planSheet(g: G, w: number, h: number): void {
  g.fillStyle = FILL;
  g.fillRect(0, 0, w, h);
  dashed(g);
  g.strokeRect(6, 6, w - 12, h - 12);
  // the deck's plan: its rails, the reel, the window
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

function clipSheet(g: G, w: number, h: number): void {
  dashed(g, 4);
  g.setLineDash([14, 10]);
  g.strokeRect(8, 8, w - 16, h - 16);
  g.setLineDash([]);
  g.lineWidth = 3;
  g.beginPath();
  g.arc(w / 2, h * 0.32, 8, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(w / 2, h * 0.32 + 8);
  g.lineTo(w / 2, h - 18);
  g.stroke();
}

function watchSheet(g: G, w: number, h: number): void {
  const cx = w * 0.62;
  const cy = h * 0.62;
  const r = WATCHDOG.r * 0.55;
  // the sightline: a dashed wedge north-west, onto the bays
  const a = Math.atan2(-(WATCHDOG.look[1] - WATCHDOG.c[1]), WATCHDOG.look[0] - WATCHDOG.c[0]);
  g.fillStyle = 'rgba(217,219,213,0.08)';
  g.beginPath();
  g.moveTo(cx, cy);
  g.arc(cx, cy, w * 0.6, a - 0.16, a + 0.16);
  g.closePath();
  g.fill();
  dashed(g, 3.5);
  g.stroke();
  // the station: a round base, its lens
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
}

/** A pencil "?" (graphite grey at 80%, a few slightly offset passes: grain, not a font). */
function query(g: G, s: number): void {
  for (const [dx, dy, a] of [
    [0, 0, 0.8],
    [1.2, -0.8, 0.35],
    [-0.9, 0.7, 0.3],
  ]) {
    g.strokeStyle = `rgba(140,138,133,${a})`;
    g.lineWidth = s * 0.075;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s * 0.28 + dx, s * 0.3 + dy);
    g.bezierCurveTo(s * 0.28 + dx, s * 0.08 + dy, s * 0.74 + dx, s * 0.06 + dy, s * 0.7 + dx, s * 0.3 + dy);
    g.bezierCurveTo(s * 0.67 + dx, s * 0.46 + dy, s * 0.5 + dx, s * 0.46 + dy, s * 0.5 + dx, s * 0.66 + dy);
    g.stroke();
    g.beginPath();
    g.arc(s * 0.5 + dx, s * 0.84 + dy, s * 0.05, 0, Math.PI * 2);
    g.stroke();
  }
}

/** The pencil over the Register: the reel split in two, its tape torn, two windows that disagree. */
function splitSheet(g: G, w: number, h: number): void {
  g.strokeStyle = 'rgba(140,138,133,0.8)';
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.setLineDash([]);
  // the split, across the reel
  g.beginPath();
  g.moveTo(w * 0.5 - 8, 4);
  g.lineTo(w * 0.5 + 6, h * 0.45);
  g.lineTo(w * 0.5 - 4, h - 4);
  g.stroke();
  // the outer windings faded to pencil
  g.lineWidth = 2;
  g.beginPath();
  g.arc(w / 2, h / 2, w / 2 - 6, -0.3, 1.4);
  g.stroke();
  g.beginPath();
  g.arc(w / 2, h / 2, w / 2 - 14, -0.2, 1.2);
  g.stroke();
}

/** The handle a running bay's door lacks: its outline in pencil. */
function handleSheet(g: G, w: number, h: number): void {
  g.strokeStyle = 'rgba(140,138,133,0.8)';
  g.lineWidth = 3;
  g.setLineDash([8, 6]);
  g.strokeRect(6, h * 0.3, w - 12, h * 0.4);
}

function useProposedTextures(family: string) {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    const an = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const t = (w: number, h: number, draw: (g: G) => void): Texture => texture(w, h, draw, an, 'transparent');
    return {
      loop: t(LOOP_SHEET.w, LOOP_SHEET.h, (g) => loopSheet(g, LOOP_SHEET.w, LOOP_SHEET.h, family)),
      plan: t(VELLUM.plan.w, VELLUM.plan.d, (g) => planSheet(g, VELLUM.plan.w, VELLUM.plan.d)),
      cabinet: t(VELLUM.cabinet.w, VELLUM.cabinet.d, (g) => cabinetSheet(g, VELLUM.cabinet.w, VELLUM.cabinet.d)),
      clip: t(60, 90, (g) => clipSheet(g, 60, 90)),
      watch: t(WATCHDOG.r * 6, WATCHDOG.r * 4, (g) => watchSheet(g, WATCHDOG.r * 6, WATCHDOG.r * 4)),
      query: t(96, 96, (g) => query(g, 96)),
      split: t(REEL.r * 2, REEL.r * 2, (g) => splitSheet(g, REEL.r * 2, REEL.r * 2)),
      handle: t(40, 40, (g) => handleSheet(g, 40, 40)),
    };
  }, [gl, family]);
}

/** The graphite machines (built): a server's stacked units, a workstation's tower, a closed laptop. */
function machineGeometry(): BufferGeometry[] {
  return MACHINES.map((m) => {
    const r = { x0: m.c[0] - m.w / 2, x1: m.c[0] + m.w / 2, y0: m.c[1] - m.d / 2, y1: m.c[1] + m.d / 2 };
    if (m.kind === 'server') return merge([0, 1, 2].map((i) => slab({ ...r, x0: r.x0 + i * 2, x1: r.x1 - i * 2 }, i * (m.h / 3), (i + 1) * (m.h / 3) - 1.5, 4, 1.5)));
    if (m.kind === 'workstation') return merge([slab(r, 0, m.h, 6, 2.5), slab({ x0: r.x0 + 14, x1: r.x1 - 14, y0: r.y0 - 1, y1: r.y0 + 6 }, m.h * 0.55, m.h * 0.65, 1, 0.5)]);
    return merge([slab(r, 0, m.h * 0.6, 6, 2), slab({ ...r, x0: r.x0 + 3, x1: r.x1 - 3, y1: r.y1 - 3 }, m.h * 0.6, m.h, 6, 1.5)]);
  });
}

export function Proposed({ printFamily }: { printFamily: string }) {
  const m = useDeskMats();
  const tex = useProposedTextures(printFamily);
  const mats = useMemo(() => Object.fromEntries(Object.entries(tex).map(([k, t]) => [k, vellum(t)])), [tex]);
  useLayoutEffect(
    () => () => {
      for (const x of Object.values(mats)) x.dispose();
      for (const t of Object.values(tex)) t.dispose();
    },
    [mats, tex],
  );
  const g = useMemo(() => {
    const L = VELLUM.loop;
    const flat = (w: number, d: number, c: P2, z = 0.4) => plane(w, d, c[0], c[1], z);
    const boundary = sweep(
      BOUNDARY.map(([x, y]) => [x, y, 0.15] as const),
      [
        [-4, 0],
        [4, 0],
      ],
      60,
    );
    const lip = sweep(
      BOUNDARY.map(([x, y]) => [x - 6, y + 5, 0.2] as const),
      [
        [-1.5, 0],
        [1.5, 0],
      ],
      60,
    );
    return {
      // the sheet's loop sits at 0.3 of its width; it runs east to the clips
      loop: flat(LOOP_SHEET.w, LOOP_SHEET.h, [L.c[0] - 0.3 * LOOP_SHEET.w + LOOP_SHEET.w / 2, L.c[1]]),
      plan: flat(VELLUM.plan.w, VELLUM.plan.d, VELLUM.plan.c),
      cabinet: flat(VELLUM.cabinet.w, VELLUM.cabinet.d, VELLUM.cabinet.c),
      clips: merge(MACHINES.map((mc) => flat(60, 90, [mc.c[0] + CLIP_DX, mc.c[1]]))),
      watch: flat(WATCHDOG.r * 6, WATCHDOG.r * 4, [WATCHDOG.c[0] - WATCHDOG.r * 0.72, WATCHDOG.c[1] + WATCHDOG.r * 0.48]),
      queries: merge(QUERIES.map((q) => plane(q.size, q.size, q.at[0], q.at[1], q.at[2]))),
      split: plane(REEL.r * 2, REEL.r * 2, REEL.x, REEL.y, 151.5),
      handle: plane(40, 40, rectC(BAYS.docs.box)[0] - 30, BAYS.docs.box.y0 + 17, BAYS.docs.wallH + 0.6),
      machines: merge(machineGeometry()),
      boundary,
      lip,
    };
  }, []);
  return (
    <group>
      <mesh geometry={g.machines} material={m.graphite} />
      <mesh geometry={g.boundary} material={m.rubber} />
      <mesh geometry={g.lip} material={m.graphite} />
      <mesh geometry={g.loop} material={mats.loop} renderOrder={2} />
      <mesh geometry={g.plan} material={mats.plan} renderOrder={2} />
      <mesh geometry={g.cabinet} material={mats.cabinet} renderOrder={2} />
      <mesh geometry={g.clips} material={mats.clip} renderOrder={2} />
      <mesh geometry={g.watch} material={mats.watch} renderOrder={2} />
      <mesh geometry={g.split} material={mats.split} renderOrder={3} />
      <mesh geometry={g.handle} material={mats.handle} renderOrder={3} />
      <mesh geometry={g.queries} material={mats.query} renderOrder={3} />
    </group>
  );
}

/** Pencil grey (palette): what the "?" marks are drawn in. */
export const PENCIL_HEX = HEX.pencil;
