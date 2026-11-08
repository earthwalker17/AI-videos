/**
 * The diagram vocabulary of a route map, in world units inside a WorldLayer (camera.tsx): routes
 * with rounded corners, edges that draw on along their path at a constant pen speed, tokens that
 * ride a path, rings with a thin arc that fills, platform boxes, pills, hatching and the emphasis
 * ring. Every stroke is non-scaling, so its width is screen px at every zoom.
 *
 * Drawing on cuts the path (@remotion/paths cutPath) rather than animating a dash offset: under
 * `vector-effect: non-scaling-stroke` the browser lays a dash pattern out in screen units, so a
 * dash offset measured in world units would end the line in the wrong place at any zoom but 1.
 * A cut path also keeps a dashed line's pattern still while it draws.
 *
 * Pure geometry (routePath, penLength, arcPath, hatchLines, pointAt) is tested in diagram.test.ts.
 */
import { clamp, easings, rand } from '@aiv/core';
import { cutPath, getLength, getPointAtLength, getTangentAtLength } from '@remotion/paths';
import { useId, useMemo, type ReactNode } from 'react';
import { NON_SCALING, type Pt } from './camera.tsx';

const n3 = (v: number) => Math.round(v * 1000) / 1000;
const pt = ([x, y]: Pt) => `${n3(x)} ${n3(y)}`;

/**
 * A route through `points` (a transit line: runs at 0/45/90 degrees), its corners rounded with
 * circular arcs of `radius` (smaller where a run is too short to hold the full radius).
 */
export function routePath(points: readonly Pt[], radius: number): string {
  if (points.length < 2) throw new Error('routePath: a route needs at least two points');
  let d = `M ${pt(points[0])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const lenIn = Math.hypot(cx - px, cy - py);
    const lenOut = Math.hypot(nx - cx, ny - cy);
    const u = [(cx - px) / lenIn, (cy - py) / lenIn];
    const v = [(nx - cx) / lenOut, (ny - cy) / lenOut];
    const turn = Math.acos(clamp(u[0] * v[0] + u[1] * v[1], -1, 1));
    if (radius <= 0 || turn < 1e-6) {
      d += ` L ${pt(points[i])}`;
      continue;
    }
    const half = Math.tan(turn / 2);
    const t = Math.min(radius * half, lenIn / 2, lenOut / 2);
    const r = t / half;
    // y points down: a positive cross product turns clockwise on screen, SVG's sweep-flag 1
    const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
    d += ` L ${pt([cx - u[0] * t, cy - u[1] * t])} A ${n3(r)} ${n3(r)} 0 0 ${sweep} ${pt([cx + v[0] * t, cy + v[1] * t])}`;
  }
  return `${d} L ${pt(points[points.length - 1])}`;
}

/**
 * How much of a line a pen has drawn `f - start` frames after it set off: it accelerates over
 * `easeIn` frames, travels at `speed` (length per frame), and decelerates over `easeOut` frames to
 * stop exactly at `total`. A line too short for full speed keeps the ramps and goes slower.
 */
export function penLength(f: number, start: number, total: number, speed: number, easeIn = 4, easeOut = 6): number {
  if (total <= 0) return 0;
  const t = f - start;
  if (t <= 0) return 0;
  const a = Math.max(0, easeIn);
  const d = Math.max(0, easeOut);
  const v = Math.min(speed, a + d > 0 ? (2 * total) / (a + d) : speed);
  const T = total / v + (a + d) / 2;
  if (t >= T) return total;
  if (t < a) return (v * t * t) / (2 * a);
  if (t > T - d) return total - (v * (T - t) ** 2) / (2 * d);
  return v * (t - a / 2);
}

/** Frames the pen of penLength takes to draw `total`. */
export function penFrames(total: number, speed: number, easeIn = 4, easeOut = 6): number {
  const v = Math.min(speed, easeIn + easeOut > 0 ? (2 * total) / (easeIn + easeOut) : speed);
  return total <= 0 ? 0 : total / v + (easeIn + easeOut) / 2;
}

/** The point and heading (degrees, 0 = east, clockwise on screen) at `len` along a path. */
export function pointAt(d: string, len: number): { x: number; y: number; angle: number } {
  const p = getPointAtLength(d, len);
  const t = getTangentAtLength(d, len);
  if (!p || !t) throw new Error(`pointAt: no point at ${len} on the path`);
  return { x: p.x, y: p.y, angle: (Math.atan2(t.y, t.x) * 180) / Math.PI };
}

/**
 * An arc of a circle as a path, from turn `t0` to turn `t1` (0 = 12 o'clock, clockwise, 1 = a full
 * turn). A full turn is two half arcs (one SVG arc cannot close on itself).
 */
export function arcPath(cx: number, cy: number, r: number, t0: number, t1: number): string {
  const at = (t: number): Pt => [cx + r * Math.sin(2 * Math.PI * t), cy - r * Math.cos(2 * Math.PI * t)];
  const span = t1 - t0;
  if (span >= 1) return `M ${pt(at(t0))} A ${n3(r)} ${n3(r)} 0 1 1 ${pt(at(t0 + 0.5))} A ${n3(r)} ${n3(r)} 0 1 1 ${pt(at(t0))}`;
  return `M ${pt(at(t0))} A ${n3(r)} ${n3(r)} 0 ${span > 0.5 ? 1 : 0} 1 ${pt(at(t1))}`;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Parallel hatch lines across a box at `angle` degrees (45 = rising to the right, "/"), `pitch`
 * apart, anchored at the box's corner so the hatch moves with its box. Each line is clipped to the
 * box.
 */
export function hatchLines(b: Box, pitch: number, angle = 45): [Pt, Pt][] {
  const a = (angle * Math.PI) / 180;
  const dir: Pt = [Math.cos(a), -Math.sin(a)];
  const nrm: Pt = [Math.sin(a), Math.cos(a)];
  const corners: Pt[] = [
    [b.x0, b.y0],
    [b.x1, b.y0],
    [b.x0, b.y1],
    [b.x1, b.y1],
  ];
  const proj = corners.map(([x, y]) => x * nrm[0] + y * nrm[1]);
  const origin = b.x0 * nrm[0] + b.y0 * nrm[1];
  const lo = Math.min(...proj);
  const hi = Math.max(...proj);
  const out: [Pt, Pt][] = [];
  for (let k = Math.ceil((lo - origin) / pitch); origin + k * pitch <= hi; k++) {
    const c = origin + k * pitch;
    const base: Pt = [c * nrm[0], c * nrm[1]];
    // the stretch of the line inside the box (s along dir)
    let s0 = -Infinity;
    let s1 = Infinity;
    for (const [axis, min, max] of [
      [0, b.x0, b.x1],
      [1, b.y0, b.y1],
    ] as const) {
      if (Math.abs(dir[axis]) < 1e-12) {
        if (base[axis] < min || base[axis] > max) s0 = Infinity;
        continue;
      }
      const ta = (min - base[axis]) / dir[axis];
      const tb = (max - base[axis]) / dir[axis];
      s0 = Math.max(s0, Math.min(ta, tb));
      s1 = Math.min(s1, Math.max(ta, tb));
    }
    if (s1 - s0 > 1e-9) out.push([[base[0] + dir[0] * s0, base[1] + dir[1] * s0] as Pt, [base[0] + dir[0] * s1, base[1] + dir[1] * s1] as Pt]);
  }
  return out;
}

export interface EdgeProps {
  /** the path, world units */
  d: string;
  /** how much of it is drawn, from its start (world units; default: all of it) */
  drawn?: number;
  color: string;
  /** screen px */
  width: number;
  /** a dash pattern in screen px, e.g. [14, 10] for a proposed part */
  dash?: readonly number[];
  /** a cased line: this stroke first, under the line (a double line when the line is the ground colour) */
  casing?: { color: string; width: number };
  opacity?: number;
  cap?: 'round' | 'butt' | 'square';
}

/** A line along a path, drawn on from its start up to `drawn`. */
export function Edge({ d, drawn, color, width, dash, casing, opacity, cap = 'round' }: EdgeProps) {
  const total = useMemo(() => getLength(d), [d]);
  const len = drawn === undefined ? total : clamp(drawn, 0, total);
  if (len <= 0) return null;
  const shown = len >= total - 1e-6 ? d : cutPath(d, len);
  const common = { d: shown, fill: 'none', strokeLinecap: cap, strokeLinejoin: 'round', ...NON_SCALING } as const;
  return (
    <g opacity={opacity}>
      {casing && <path {...common} stroke={casing.color} strokeWidth={casing.width} />}
      <path {...common} stroke={color} strokeWidth={width} strokeDasharray={dash?.join(' ')} />
    </g>
  );
}

/** Something that rides a path: its children are drawn at `at` along `d`, turned to the path's heading. */
export function Token({ d, at, orient = true, children }: { d: string; at: number; orient?: boolean; children: ReactNode }) {
  const p = pointAt(d, at);
  return <g transform={`translate(${n3(p.x)} ${n3(p.y)})${orient ? ` rotate(${n3(p.angle)})` : ''}`}>{children}</g>;
}

export interface RingProps {
  cx: number;
  cy: number;
  r: number;
  color: string;
  width: number;
  fill?: string;
  /** a thin arc round the ring filling clockwise from 12 o'clock: `p` 0..1 of a turn */
  arc?: { p: number; r: number; width: number; color: string };
  opacity?: number;
}

/** A ring (a station, the interchange), with an optional thin progress arc round it. */
export function Ring({ cx, cy, r, color, width, fill = 'none', arc, opacity }: RingProps) {
  return (
    <g opacity={opacity}>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={color} strokeWidth={width} {...NON_SCALING} />
      {arc && arc.p > 0 && <path d={arcPath(cx, cy, arc.r, 0, clamp(arc.p))} fill="none" stroke={arc.color} strokeWidth={arc.width} strokeLinecap="round" {...NON_SCALING} />}
    </g>
  );
}

export interface PlatformBoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  color: string;
  width: number;
  fill?: string;
  dash?: readonly number[];
  opacity?: number;
  children?: ReactNode;
}

/** A platform box (a Worker): a rounded rectangle, its children drawn over it. */
export function PlatformBox({ x, y, w, h, r = 12, color, width, fill = 'none', dash, opacity, children }: PlatformBoxProps) {
  return (
    <g opacity={opacity}>
      <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={color} strokeWidth={width} strokeDasharray={dash?.join(' ')} {...NON_SCALING} />
      {children}
    </g>
  );
}

/** The path of a rounded rectangle (for clips and hatching). */
export const roundedRectPath = (x: number, y: number, w: number, h: number, r: number): string => {
  const q = Math.min(r, w / 2, h / 2);
  return `M ${x + q} ${y} H ${x + w - q} A ${q} ${q} 0 0 1 ${x + w} ${y + q} V ${y + h - q} A ${q} ${q} 0 0 1 ${x + w - q} ${y + h} H ${x + q} A ${q} ${q} 0 0 1 ${x} ${y + h - q} V ${y + q} A ${q} ${q} 0 0 1 ${x + q} ${y} Z`;
};

export interface PillProps {
  w?: number;
  h?: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  /** a few short seeded dashes inside, like a message's words */
  dashes?: { seed: number; id: string | number; color: string; width?: number };
}

/** A capsule centred on 0,0 (place it with a transform or a Token): a message, a request, a reply. */
export function Pill({ w = 64, h = 28, fill, stroke, strokeWidth = 2, dashes }: PillProps) {
  let marks: ReactNode = null;
  if (dashes) {
    const n = rand(dashes.seed, dashes.id, 0) < 0.5 ? 2 : 3;
    const gap = 5;
    const inner = w - h - (n - 1) * gap;
    const weights = Array.from({ length: n }, (_, k) => 0.6 + rand(dashes.seed, dashes.id, k + 1));
    const sum = weights.reduce((a, b) => a + b, 0);
    let x = -w / 2 + h / 2;
    marks = weights.map((wt, k) => {
      const len = (inner * wt) / sum;
      const seg = <line key={k} x1={n3(x)} y1={0} x2={n3(x + len)} y2={0} stroke={dashes.color} strokeWidth={dashes.width ?? 3} strokeLinecap="round" {...NON_SCALING} />;
      x += len + gap;
      return seg;
    });
  }
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={fill} stroke={stroke} strokeWidth={stroke ? strokeWidth : undefined} {...NON_SCALING} />
      {marks}
    </g>
  );
}

export interface HatchProps {
  /** the outline to hatch (a path) and its bounding box */
  shape: string;
  box: Box;
  /** world units between lines */
  pitch: number;
  /** screen px */
  width: number;
  color: string;
  angle?: number;
  opacity?: number;
}

/** Risk: parallel ink hatching clipped to a shape (an SVG clip path in the document, no filter). */
export function Hatch({ shape, box, pitch, width, color, angle = 45, opacity }: HatchProps) {
  const id = `hatch${useId().replace(/[^A-Za-z0-9_-]/g, '_')}`;
  const lines = useMemo(() => hatchLines(box, pitch, angle), [box, pitch, angle]);
  return (
    <g opacity={opacity}>
      <defs>
        <clipPath id={id}>
          <path d={shape} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`} stroke={color} strokeWidth={width} strokeLinecap="butt">
        {lines.map(([a, b], i) => (
          <line key={i} x1={n3(a[0])} y1={n3(a[1])} x2={n3(b[0])} y2={n3(b[1])} {...NON_SCALING} />
        ))}
      </g>
    </g>
  );
}

export interface EmphasisProps {
  cx: number;
  cy: number;
  /** the radius it starts from */
  r: number;
  f: number;
  start: number;
  frames?: number;
  /** the radius it grows to, as a multiple of `r` */
  grow?: number;
  color: string;
  width?: number;
}

/** Emphasis: one thin ring that expands and fades (16 frames in the motion grammar). */
export function Emphasis({ cx, cy, r, f, start, frames = 16, grow = 1.8, color, width = 2 }: EmphasisProps) {
  const t = (f - start) / frames;
  if (t < 0 || t >= 1) return null;
  const radius = r * (1 + (grow - 1) * easings.outCubic(t));
  return <circle cx={cx} cy={cy} r={radius} fill="none" stroke={color} strokeWidth={width} opacity={1 - t} {...NON_SCALING} />;
}
