/**
 * The ground: the flat dark tint, optionally lifted towards the centre (never darkened at the
 * corners: the QA black margin), optionally with the static dither tile over a region of it. It is
 * opaque, so it is always the frame's bottom layer, and it never moves with the camera.
 */
import { AbsoluteFill, staticFile } from 'remotion';
import { DitherLayer } from '../kit/dither.tsx';
import { C } from './tokens.ts';

/** The baked dither tile in assets/ (src/lookdev/ditherTile.ts writes it); its URL is resolved at render, not at module load. */
export const DITHER_TILE = { file: 'dither-256.png', size: 256 } as const;

export interface GroundLift {
  /** the colour at the centre; the ellipse fades from it to the ground */
  centre: string;
  /** the ellipse's radii, px */
  rx: number;
  ry: number;
}

export interface GroundProps {
  lift?: GroundLift;
  /** the region the dither covers, composition px (whole output pixels) */
  dither?: { x: number; y: number; width: number; height: number };
}

export function Ground({ lift, dither }: GroundProps) {
  const background = lift ? `radial-gradient(ellipse ${lift.rx}px ${lift.ry}px at 50% 50%, ${lift.centre} 0%, ${C.ground} 100%)` : C.ground;
  return (
    <AbsoluteFill style={{ background }}>
      {dither && <DitherLayer src={staticFile(DITHER_TILE.file)} tile={DITHER_TILE.size} {...dither} />}
    </AbsoluteFill>
  );
}
