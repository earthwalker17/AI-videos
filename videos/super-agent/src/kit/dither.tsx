/**
 * A static dither over a screen region: a baked noise tile (a file the video's assets/ holds, its
 * URL from staticFile) laid edge to edge, one tile pixel on one output pixel at every render scale,
 * so the noise is neither blurred nor stretched at draft size. Each tile is a Remotion <Img>,
 * which holds the frame until the image has loaded (a CSS background-image could not). Place it
 * over the ground and under everything drawn on it.
 */
import type { CSSProperties } from 'react';
import { Img } from 'remotion';
import { useRenderScale } from '@aiv/remotion-kit';

export interface DitherLayerProps {
  /** the tile's URL (staticFile) */
  src: string;
  /** the tile's size in its own pixels */
  tile: number;
  /** the region, in composition px; place it on whole output pixels */
  x?: number;
  y?: number;
  width: number;
  height: number;
  opacity?: number;
}

/** The tiles that cover a region: their positions in composition px, `step` apart. */
export function tilesFor(width: number, height: number, step: number): { left: number; top: number }[] {
  const out: { left: number; top: number }[] = [];
  for (let top = 0; top < height; top += step) for (let left = 0; left < width; left += step) out.push({ left, top });
  return out;
}

export function DitherLayer({ src, tile, x = 0, y = 0, width, height, opacity }: DitherLayerProps) {
  const scale = useRenderScale();
  // composition px per tile, so that the tile's pixels land 1:1 on the output's
  const step = tile / scale;
  const box: CSSProperties = { position: 'absolute', left: x, top: y, width, height, overflow: 'hidden', opacity, pointerEvents: 'none' };
  return (
    <div style={box}>
      {tilesFor(width, height, step).map(({ left, top }) => (
        <Img key={`${left},${top}`} src={src} style={{ position: 'absolute', left, top, width: step, height: step, imageRendering: 'pixelated' }} />
      ))}
    </div>
  );
}
