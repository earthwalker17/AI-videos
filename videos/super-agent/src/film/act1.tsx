/**
 * Act one, the sketch world (TREATMENT.md, beats 1-3): the chat spring, the session tiles round
 * your ring, your switching trail, your ring, and the ink interchange ring that closes round you
 * at bar 10. Sketch shapes are tapered stroke polygons (kit/sketch.ts) in world units; ink is
 * non-scaling strokes. After the turn the hub stays as a 12% ghost where it was drawn, and
 * sketch A's braided track as a ghost where the Router now stands.
 */
import { clamp, rand } from '@aiv/core';
import { useId, useMemo } from 'react';
import { NON_SCALING, useCamera, type Pt } from '../kit/camera.tsx';
import { arcPath } from '../kit/diagram.tsx';
import { dashRuns, roundedRectLoop, sketchPasses } from '../kit/sketch.ts';
import { C, GHOST_OPACITY, STROKE } from '../look/tokens.ts';
import { CiSquare, Envelope, Laptop } from './glyphs.tsx';
import { MessagePill, RequestPill } from './pills.tsx';
import { PEN, SEED, detailOpacity } from './style.ts';
import { NOTCH_EDGE, TILE_NOTCHES, TRAIL_RECENCY, tileKeepOut, trailStrokes } from './trail.ts';
import { HUB, ROUTER, ROUTER_R, TILE, TILES, YOU_R, springPile, tileBox, type SpringItem, type Tile } from './world.ts';

/** Both passes of a sketch line, filled in `color`. */
function Sketch({ d, color, opacity }: { d: readonly [string, string]; color: string; opacity?: number }) {
  return (
    <g fill={color} opacity={opacity}>
      <path d={d[0]} />
      {d[1] && <path d={d[1]} />}
    </g>
  );
}

/** A mask id that is valid in url(#…). */
const useMaskId = (prefix: string) => `${prefix}${useId().replace(/[^A-Za-z0-9_-]/g, '_')}`;

// ---------------------------------------------------------------------------------------------
// The chat spring

function SpringGlyph({ item }: { item: SpringItem }) {
  if (item.kind === 'ci') return <CiSquare fill={C.pill} stroke={C.sketch} />;
  if (item.kind === 'mail') return <Envelope fill={C.pill} stroke={C.sketch} />;
  if (item.kind === 'request') return <RequestPill />;
  return <MessagePill id={item.id} />;
}

/**
 * The chat spring: the pile of events, oldest at the top. `request` says whether the request
 * still lies in it (until it rides the trunk at the turn); items are drawn bottom-up so that
 * a newer item lies over an older one.
 */
export function ChannelSpring({ request = true }: { request?: boolean }) {
  const items = springPile().filter((it) => request || it.kind !== 'request');
  return (
    <g>
      {items.map((it) => (
        <g key={it.id} transform={`translate(${it.x} ${it.y})`}>
          <SpringGlyph item={it} />
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// Session tiles

export interface SessionTileProps {
  tile: Tile;
  id: string | number;
  /** time since your last visit, as a fade: 0 = lit, 1 = all but gone */
  decay: number;
  /** waiting notches, one per hop that passed it by */
  notches: number;
  /** the edge the notches are cut across (the one facing away from the hub) */
  edge?: 'top' | 'bottom' | 'left' | 'right';
  /** what it knows: how many faint lines (default 3) */
  lines?: number;
  color?: string;
}

/**
 * A session tile: one tapered pen line round a rounded rectangle (it sets down on the top edge
 * and runs a little past where it began), holding a few faint lines. As it decays it dims and its
 * lines break into dashes; waiting notches are a tally cut across its outer edge.
 */
export function SessionTile({ tile, id, decay, notches, edge = 'top', lines = 3, color = C.sketch }: SessionTileProps) {
  const { x, y, w, h } = tileBox(tile);
  const k = clamp(decay);
  const shapes = useMemo(() => {
    const outline = sketchPasses(roundedRectLoop(x, y, w, h, TILE.r, 0.1 + 0.5 * rand(SEED, id, 1), 14, 4), { ...PEN.outline, seed: SEED, id: `tile-${id}` });
    // the lines: left-aligned, seeded lengths; a decayed tile's lines break into more dashes
    const breaks = 1 + Math.round(k * 3);
    const top = y + (h - (lines - 1) * 18) / 2;
    const inner = Array.from({ length: lines }, (_, i) => {
      const ly = top + i * 18;
      const len = w * (0.38 + 0.32 * rand(SEED, id, 10 + i));
      const pts: Pt[] = [
        [x + 22, ly],
        [x + 22 + len, ly + (rand(SEED, id, 20 + i) - 0.5) * 1.6],
      ];
      return dashRuns(breaks, 0.18 + 0.22 * k, SEED, `${id}:${i}`).map(([a, b], j) => sketchPasses(pts, { ...PEN.inner, seed: SEED, id: `tile-${id}-l${i}-${j}`, from: a, to: b }));
    });
    // waiting notches: a tally cut across the outer edge, from its far end inwards
    const marks = Array.from({ length: notches }, (_, i) => {
      const along = TILE.r + 8 + i * 11;
      const cut = 9;
      const seg: [Pt, Pt] =
        edge === 'top'
          ? [[x + along + 1, y - cut], [x + along - 1, y + cut]]
          : edge === 'bottom'
            ? [[x + w - along + 1, y + h - cut], [x + w - along - 1, y + h + cut]]
            : edge === 'left'
              ? [[x - cut, y + h - along + 1], [x + cut, y + h - along - 1]]
              : [[x + w - cut, y + along + 1], [x + w + cut, y + along - 1]];
      return sketchPasses(seg, { ...PEN.notch, seed: SEED, id: `tile-${id}-n${i}` });
    });
    return { outline, inner, marks };
  }, [x, y, w, h, id, k, lines, notches, edge]);
  const body = 1 - 0.74 * k;
  return (
    <g>
      <Sketch d={shapes.outline} color={color} opacity={body} />
      {shapes.inner.flat().map((d, i) => (
        <Sketch key={i} d={d} color={color} opacity={0.62 * body} />
      ))}
      {shapes.marks.map((d, i) => (
        <Sketch key={`n${i}`} d={d} color={color} opacity={Math.max(body, 0.7)} />
      ))}
    </g>
  );
}

/** The eight tiles in their state at bar 10 (Still 1): about four lit, the rest fading and notched. */
export function HubTiles() {
  return (
    <g>
      {TILES.map((t, i) => (
        <SessionTile key={i} tile={t} id={i} decay={1 - TRAIL_RECENCY[i]} notches={TILE_NOTCHES[i]} edge={NOTCH_EDGE[i]} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// Your switching trail

/** A box (world units) the trail leaves clear, e.g. round a label. */
export interface ClearBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the interchange ring hides the trail: inside this radius round the hub (world units), 6 px clear of the ring at 1.3x. */
export const TRAIL_HOLE = ROUTER_R + 8;

/**
 * Your trail at the hub: bundles of tapered strokes along worn transit routes (film/trail.ts),
 * the tiles you visited last drawn densest and darkest. A mask leaves the middle clear (where the
 * interchange ring closes over the routes' ends), the tiles, and any `clear` boxes (your label).
 */
export function SwitchingTrail({ recency = TRAIL_RECENCY, clear = [] }: { recency?: readonly number[]; clear?: readonly ClearBox[] }) {
  const id = useMaskId('trail');
  const strokes = useMemo(
    () =>
      trailStrokes(recency).map((s) => ({
        key: s.key,
        opacity: s.opacity,
        d: sketchPasses(s.points, { ...PEN.trail, width: s.width, seed: SEED, id: `trail-${s.key}` }),
      })),
    [recency],
  );
  const keepOut = useMemo(() => tileKeepOut(2), []);
  const box = { x: 0, y: 0, w: 2400, h: 1600 };
  return (
    <g>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x={box.x} y={box.y} width={box.w} height={box.h}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="white" />
          <circle cx={HUB[0]} cy={HUB[1]} r={TRAIL_HOLE} fill="black" />
          {[...keepOut, ...clear].map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill="black" />
          ))}
        </mask>
      </defs>
      <g fill={C.sketch} mask={`url(#${id})`}>
        {strokes.map((s) => (
          <g key={s.key} opacity={s.opacity}>
            <path d={s.d[0]} />
            {s.d[1] && <path d={s.d[1]} />}
          </g>
        ))}
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// You, and the interchange that closes round you

/** Screen px between your ring and the laptop glyph standing over it. */
const LAPTOP_GAP = 10;

/**
 * Your ring: 40 across in ink, filled with the ground; after the turn your laptop stands over it,
 * LAPTOP_GAP px clear (open, or shut once you have stepped back). The laptop is a small glyph:
 * it fades out with the other small glyphs when the camera is far out (style.ts detailOpacity).
 */
export function YouRing({ at, laptop }: { at: Pt; laptop?: { open: boolean } }) {
  const { cam } = useCamera();
  const lod = detailOpacity(cam.scale);
  return (
    <g>
      <circle cx={at[0]} cy={at[1]} r={YOU_R} fill={C.ground} stroke={C.ink} strokeWidth={STROKE.you} {...NON_SCALING} />
      {laptop && lod > 0 && (
        <g transform={`translate(${at[0]} ${at[1] - YOU_R - (STROKE.you / 2 + LAPTOP_GAP) / cam.scale})`} opacity={lod < 1 ? lod : undefined}>
          <Laptop open={laptop.open} color={C.ink} />
        </g>
      )}
    </g>
  );
}

/** The interchange ring that closes round you at bar 10 (`drawn` 0..1 of a turn, from 12 o'clock): the Router to be. */
export function InterchangeRing({ at, drawn = 1 }: { at: Pt; drawn?: number }) {
  const p = clamp(drawn);
  if (p <= 0) return null;
  return <path d={arcPath(at[0], at[1], ROUTER_R, 0, p)} fill="none" stroke={C.ink} strokeWidth={STROKE.router} strokeLinecap="round" {...NON_SCALING} />;
}

// ---------------------------------------------------------------------------------------------
// The ghosts after the turn

/** The act-one hub, erased at the turn: the tiles in their bar-10 state and your trail, a 12% ghost where they were drawn. */
export function HubGhost() {
  return (
    <g opacity={GHOST_OPACITY}>
      <SwitchingTrail />
      <HubTiles />
    </g>
  );
}

/** Sketch A's braided track (beat 3), erased where the Router now stands: it runs in from the west to the ring's 9 o'clock. */
export const BRAID = { x0: 1452, x1: ROUTER[0] - ROUTER_R + 12, y: ROUTER[1] + 22, amp: 12, wave: 132 } as const;

/**
 * The act-one tangle under the Router (TREATMENT.md, beat 4): sketch A's three task strands
 * (solid, dashed and dotted sketch line) braiding into the ring from the west, a ghost at
 * GHOST_OPACITY like every erased sketch line. The opacity is the group's, so where the strands
 * cross they do not stack. It runs beside the Router, not round it: no halo.
 */
export function BraidGhost({ opacity = GHOST_OPACITY }: { opacity?: number }) {
  const strands = useMemo(
    () =>
      [0, 1, 2].map((j) => {
        const pts: Pt[] = [];
        for (let x = BRAID.x0; x <= BRAID.x1 + 1e-6; x += 12) {
          // the strands tighten as they near the ring
          const t = (x - BRAID.x0) / (BRAID.x1 - BRAID.x0);
          const amp = BRAID.amp * (1 - 0.55 * t);
          pts.push([x, BRAID.y + amp * Math.sin(((x - BRAID.x0) / BRAID.wave) * 2 * Math.PI + (j * 2 * Math.PI) / 3)]);
        }
        const runs = j === 0 ? 1 : j === 1 ? 9 : 22;
        return dashRuns(runs, j === 1 ? 0.3 : 0.55, SEED, `braid-${j}`).map(([a, b], k) => sketchPasses(pts, { ...PEN.inner, width: 3, seed: SEED, id: `braid-${j}-${k}`, from: a, to: b }));
      }),
    [],
  );
  return (
    <g opacity={opacity} fill={C.sketch}>
      {strands.flat().map((d, i) => (
        <g key={i}>
          <path d={d[0]} />
          {d[1] && <path d={d[1]} />}
        </g>
      ))}
    </g>
  );
}
