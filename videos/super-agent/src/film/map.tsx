/**
 * The inked map after the turn (TREATMENT.md, Diagram vocabulary): the Router with its memory
 * track, the trunk and branches, Worker platforms, the points and the gate, the flyover, the
 * cased return line and the proposed (dashed) parts. Positions come from world.ts; weights from
 * look/tokens.ts STROKE, in screen px at every zoom. The weights fall from the Router (8 px) to
 * the trunk (6), the branches (4), and the platforms and the cased line's rails (3).
 */
import { clamp } from '@aiv/core';
import { useMemo } from 'react';
import { NON_SCALING, useCamera, type Pt } from '../kit/camera.tsx';
import { Edge, PlatformBox, arcPath, fittedDash, fittedOpenDash, offsetRoute, routePath, squareFromTop } from '../kit/diagram.tsx';
import { C, STROKE } from '../look/tokens.ts';
import { Tool, TOOLS } from './glyphs.tsx';
import { MessagePill, RequestPill } from './pills.tsx';
import { detailOpacity } from './style.ts';
import { BRIDGE, CORNER, DEPOT, DEPOT_TETHER, GATE, GATE_SIZE, MACHINE, MEMORY, PLATFORM, ROUTER, ROUTER_R, SIDING, memorySlots, platformBox } from './world.ts';

const f3 = (v: number) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------------------------------------
// Lines

/** An inked line along a route of points (0/45/90 degrees), corners rounded. */
export function Line({ points, width, color = C.ink, opacity, radius = CORNER, dash, cap }: { points: readonly Pt[]; width: number; color?: string; opacity?: number; radius?: number; dash?: readonly number[]; cap?: 'round' | 'butt' }) {
  const d = useMemo(() => routePath(points, radius), [points, radius]);
  return <Edge d={d} color={color} width={width} opacity={opacity} dash={dash} cap={cap} />;
}

/** The trunk: 6 px ink. */
export const Trunk = ({ points, color = C.ink }: { points: readonly Pt[]; color?: string }) => <Line points={points} width={STROKE.trunk} color={color} />;

/** A branch: 4 px, ink until the Workers step down to the receded tone. */
export const Branch = ({ points, color = C.ink }: { points: readonly Pt[]; color?: string }) => <Line points={points} width={STROKE.branch} color={color} />;

/** A cased line, screen px: two 3 px rails with a 2 px ground-colour gap (8 px across, its ink as much as the trunk's 6). */
export const CASED = { outer: 2 * STROKE.casedRail + STROKE.casedGap, core: STROKE.casedGap } as const;

/** A cased line: two rails of `color` with the ground between (the return route's form). */
export function CasedLine({ points, color, radius = CORNER }: { points: readonly Pt[]; color: string; radius?: number }) {
  const d = useMemo(() => routePath(points, radius), [points, radius]);
  return <Edge d={d} color={C.ground} width={CASED.core} casing={{ color, width: CASED.outer }} />;
}

/**
 * A route drawn beside another, `offset` to its left on screen (PARALLEL apart), corners kept
 * concentric: the green return beside a branch.
 */
export function ParallelRoute({ points, offset, color, width, cased }: { points: readonly Pt[]; offset: number; color: string; width: number; cased?: boolean }) {
  const d = useMemo(() => {
    const o = offsetRoute(points, offset, CORNER);
    return routePath(o.points, o.radii);
  }, [points, offset]);
  if (cased) return <Edge d={d} color={C.ground} width={CASED.core} casing={{ color, width: CASED.outer }} />;
  return <Edge d={d} color={color} width={width} />;
}

/** A terminus bar across the end of a line at `at`, perpendicular to a line heading `angle` (degrees). */
export function Terminus({ at, angle = 0, length = 32, width = STROKE.branch, color = C.ink }: { at: Pt; angle?: number; length?: number; width?: number; color?: string }) {
  const a = ((angle + 90) * Math.PI) / 180;
  const h = length / 2;
  return <line x1={f3(at[0] - Math.cos(a) * h)} y1={f3(at[1] - Math.sin(a) * h)} x2={f3(at[0] + Math.cos(a) * h)} y2={f3(at[1] + Math.sin(a) * h)} stroke={color} strokeWidth={width} strokeLinecap="round" {...NON_SCALING} />;
}

// ---------------------------------------------------------------------------------------------
// The Router

export interface RouterRingProps {
  /** how many memory ticks are inked (the track never clears) */
  ticks: number;
  /** the thinking arc, 0..1 of a turn (0: none) */
  thinking?: number;
  at?: Pt;
}

/**
 * The Router: a 160 px interchange ring (8 px ink, filled with the ground), its memory track of
 * ticks outside it, and a thin thinking arc. Only the ticks it has filled are drawn, from 12
 * o'clock clockwise on fixed slots (world.ts memorySlots): a tally in groups of four, each group's
 * ticks parallel, with gaps where lines meet the ring; never a dashed boundary round it, a dial or
 * rays. Never a bar through it.
 */
export function RouterRing({ ticks, thinking = 0, at = ROUTER }: RouterRingProps) {
  const slots = useMemo(() => memorySlots(), []);
  const [cx, cy] = at;
  const n = Math.min(slots.length, Math.max(0, Math.floor(ticks)));
  const mid = (MEMORY.inner + MEMORY.outer) / 2;
  const half = (MEMORY.outer - MEMORY.inner) / 2;
  return (
    <g>
      <circle cx={cx} cy={cy} r={ROUTER_R} fill={C.ground} stroke={C.ink} strokeWidth={STROKE.router} {...NON_SCALING} />
      {thinking > 0 && <path d={arcPath(cx, cy, (ROUTER_R + MEMORY.inner) / 2, 0, clamp(thinking))} fill="none" stroke={C.ink} strokeWidth={STROKE.thinkingArc} strokeLinecap="round" {...NON_SCALING} />}
      <g stroke={C.ink} strokeWidth={STROKE.hairline + 0.5} strokeLinecap="round">
        {slots.slice(0, n).map(({ at: t, dir }) => {
          // the tick's middle on the track, the tick itself along its group's direction
          const [px, py] = [cx + Math.sin(2 * Math.PI * t) * mid, cy - Math.cos(2 * Math.PI * t) * mid];
          const [ux, uy] = [Math.sin(2 * Math.PI * dir) * half, -Math.cos(2 * Math.PI * dir) * half];
          return <line key={t} x1={f3(px - ux)} y1={f3(py - uy)} x2={f3(px + ux)} y2={f3(py + uy)} {...NON_SCALING} />;
        })}
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// Worker platforms

export type WorkerTaskKind = 'request' | 'message';

export interface WorkerPlatformProps {
  /** the west door, where its branch arrives */
  door: Pt;
  /** what it holds: the request, another task, or nothing */
  task?: WorkerTaskKind;
  /** the step marker's stop, 0..PLATFORM.steps - 1 */
  step: number;
  /** ink (busy) or the receded tone (stepped down to an implementation detail) */
  color?: string;
  /** done: the platform's far end is closed with an ink cap */
  done?: boolean;
  id: string | number;
}

/** Where a platform's parts sit, from its box (world units): the task's berth, the tool row and the step track. */
export function platformParts(door: Pt) {
  const b = platformBox(door);
  const cy = b.y + b.h / 2;
  return {
    box: b,
    berth: [b.x + 54, cy] as Pt,
    tools: TOOLS.map((_, i) => [b.x + 126 + i * 34, cy - 15] as Pt),
    track: { x0: b.x + 112, x1: b.x + b.w - 22, y: cy + 20 },
    /** the cap: the box's east side, inked heavy (flush with the box, so it reads as part of it at any zoom) */
    cap: { x: b.x + b.w, y0: b.y + PLATFORM.r, y1: b.y + b.h - PLATFORM.r },
  };
}

/**
 * A Worker platform: a 220 x 88 box with its task in the berth, a tool row and a step marker. The
 * tool row and the step marker are small glyphs: they fade out when the camera is far out.
 */
export function WorkerPlatform({ door, task, step, color = C.ink, done = false, id }: WorkerPlatformProps) {
  const { cam } = useCamera();
  const lod = detailOpacity(cam.scale);
  const p = platformParts(door);
  const { x0, x1, y } = p.track;
  const stops = PLATFORM.steps;
  const sx = (k: number) => x0 + ((x1 - x0) * k) / (stops - 1);
  const at = sx(Math.min(stops - 1, Math.max(0, step)));
  return (
    <g>
      <PlatformBox x={p.box.x} y={p.box.y} w={p.box.w} h={p.box.h} r={PLATFORM.r} color={color} width={STROKE.platform} fill={C.ground} />
      {task && (
        <g transform={`translate(${p.berth[0]} ${p.berth[1]})`}>
          {task === 'request' ? <RequestPill /> : <MessagePill id={`task-${id}`} />}
        </g>
      )}
      {lod > 0 && (
        <g opacity={lod < 1 ? lod : undefined}>
          {p.tools.map(([tx, ty], i) => (
            <g key={i} transform={`translate(${tx} ${ty})`}>
              <Tool kind={TOOLS[i]} color={color} />
            </g>
          ))}
          {/* the step track: done stretch in the platform's colour, the rest in the sketch tone, a stop tick at each step */}
          <line x1={f3(at)} y1={y} x2={x1} y2={y} stroke={C.sketch} strokeWidth={STROKE.min} strokeLinecap="round" {...NON_SCALING} />
          {at > x0 && <line x1={x0} y1={y} x2={f3(at)} y2={y} stroke={color} strokeWidth={STROKE.min} strokeLinecap="round" {...NON_SCALING} />}
          {Array.from({ length: stops }, (_, k) => (
            <line key={k} x1={f3(sx(k))} y1={y - 4} x2={f3(sx(k))} y2={y + 4} stroke={sx(k) <= at ? color : C.sketch} strokeWidth={STROKE.min} strokeLinecap="round" {...NON_SCALING} />
          ))}
          <circle cx={f3(at)} cy={y} r={6} fill={color} />
        </g>
      )}
      {done && <line x1={p.cap.x} y1={p.cap.y0} x2={p.cap.x} y2={p.cap.y1} stroke={C.ink} strokeWidth={STROKE.trunk} strokeLinecap="butt" {...NON_SCALING} />}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// The Fast Path and the Slow Path

/** The railway points: a 45 degree siding off the trunk into a terminus, where one shunted pill waits. */
export function Points({ parked = true }: { parked?: boolean }) {
  const end = SIDING[SIDING.length - 1];
  return (
    <g>
      <Line points={SIDING} width={STROKE.branch} />
      <Terminus at={end} angle={0} />
      {parked && (
        <g transform={`translate(${end[0] - 48} ${end[1]})`}>
          <MessagePill id="parked" />
        </g>
      )}
    </g>
  );
}

/**
 * The lamp's fill at camera `scale`, world units: a pie drawn as an arc of radius `r` with a
 * scaling stroke `width` (= 2r) wide, so that it covers the disc from the centre out to the inner
 * edge of the lamp's outline (a non-scaling STROKE.platform px ring) at every zoom. Pure.
 */
export function lampFill(scale: number): { r: number; width: number } {
  const inner = GATE_SIZE.lamp - STROKE.platform / 2 / scale;
  return { r: inner / 2, width: inner };
}

/** The gate on the trunk: one bar across the line, its lamp beside the bar (it fills while a model judges). */
export function Gate({ lamp = 0, at = GATE }: { lamp?: number; at?: Pt }) {
  const { cam } = useCamera();
  const [cx, cy] = at;
  const h = GATE_SIZE.bar / 2;
  const [lx, ly] = [cx + GATE_SIZE.lampAt[0], cy + GATE_SIZE.lampAt[1]];
  const fill = lampFill(cam.scale);
  return (
    <g stroke={C.ink} strokeLinecap="round">
      <line x1={cx} y1={cy - h} x2={cx} y2={cy + h} strokeWidth={STROKE.branch} {...NON_SCALING} />
      <circle cx={lx} cy={ly} r={GATE_SIZE.lamp} fill={C.ground} strokeWidth={STROKE.platform} {...NON_SCALING} />
      {/* a scaling stroke: its width is world units, like the lamp's radius */}
      {lamp > 0 && <path d={arcPath(lx, ly, fill.r, 0, clamp(lamp))} fill="none" strokeWidth={f3(fill.width)} strokeLinecap="butt" />}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// The flyover

/** Screen px: the bridge's ground-colour casing either side of the flyover, and its parapets. */
const BRIDGE_LOOK = { gap: 7, splay: 6 } as const;

/**
 * Thread pass-through: a line that leaves the trunk and crosses over it on a bridge (a ground
 * casing that breaks the line below, two thin parapets with splayed ends), then lands at a Worker.
 * Draw it after the lines it crosses.
 */
export function Flyover({ points, bridge = BRIDGE }: { points: readonly Pt[]; bridge?: readonly Pt[] }) {
  const { cam } = useCamera();
  const [a, b] = bridge;
  // the parapets stand `gap` px off the line's edge on screen; their ends splay outwards
  const off = (STROKE.branch / 2 + BRIDGE_LOOK.gap) / cam.scale;
  const sp = BRIDGE_LOOK.splay / cam.scale;
  const parapet = (side: -1 | 1) => `M ${f3(a[0] - sp)} ${f3(a[1] + side * (off + sp))} L ${f3(a[0])} ${f3(a[1] + side * off)} L ${f3(b[0])} ${f3(b[1] + side * off)} L ${f3(b[0] + sp)} ${f3(b[1] + side * (off + sp))}`;
  return (
    <g>
      <Line points={bridge} width={2 * (STROKE.branch / 2 + BRIDGE_LOOK.gap)} color={C.ground} cap="butt" />
      <Line points={points} width={STROKE.branch} />
      <path d={`${parapet(-1)} ${parapet(1)}`} fill="none" stroke={C.ink} strokeWidth={STROKE.min} strokeLinecap="round" strokeLinejoin="round" {...NON_SCALING} />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// Proposed: dashed, only on new parts

/*
 * Proposed parts are always ink (TREATMENT.md: proposed = 3 px dashed ink), whatever the built
 * parts round them have stepped down to: the dash, not a tone, says "proposed", and the end card's
 * key needs an example of it on screen. Only the rest's step-down (a group opacity) dims them.
 */

/** A proposed tether: 3 px dashed ink (14 on, 10 off). */
export const Tether = ({ points }: { points: readonly Pt[] }) => <Line points={points} width={STROKE.proposed} color={C.ink} dash={STROKE.proposedDash} cap="butt" />;

/** A proposed machine: a dashed ink square with a daemon dot. */
export function Machine({ at }: { at: Pt }) {
  const color = C.ink;
  const { cam } = useCamera();
  const sq = squareFromTop(at[0], at[1], MACHINE.size, MACHINE.r);
  // the proposed dash, fitted so that every side of the square carries the same dashes
  const [on, off] = fittedDash(sq.length * cam.scale, STROKE.proposedDash[0], STROKE.proposedDash[1]);
  return (
    <g>
      <path d={sq.d} fill={C.ground} stroke={color} strokeWidth={STROKE.proposed} strokeDasharray={`${f3(on)} ${f3(off)}`} strokeDashoffset={f3(on / 2)} {...NON_SCALING} />
      <circle cx={at[0]} cy={at[1]} r={MACHINE.dot} fill={color} />
    </g>
  );
}

/**
 * The proposed state depot: three equal stacked dashed rules beside the Router (a store), on a
 * dashed tether. Each rule's dash is fitted to its length on screen so that it starts and ends on
 * a whole dash: both ends of the stack are clean.
 */
export function Depot() {
  const { cam } = useCamera();
  const [on, off] = STROKE.proposedDash;
  const color = C.ink;
  return (
    <g>
      <Tether points={DEPOT_TETHER} />
      {Array.from({ length: DEPOT.rules }, (_, i) => {
        const y = DEPOT.y + i * DEPOT.pitch;
        const [a, b] = fittedOpenDash(DEPOT.w[i] * cam.scale, on, off);
        return <line key={i} x1={DEPOT.x} y1={y} x2={DEPOT.x + DEPOT.w[i]} y2={y} stroke={color} strokeWidth={STROKE.proposed} strokeDasharray={b > 0 ? `${f3(a)} ${f3(b)}` : undefined} strokeLinecap="butt" {...NON_SCALING} />;
      })}
    </g>
  );
}
