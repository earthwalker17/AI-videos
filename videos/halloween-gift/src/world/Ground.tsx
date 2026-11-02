/**
 * A page's printed ground, lying on the open book's first page (the stage floor): dark earth,
 * grass, pebbles and a path, inside a cream page margin. Drawn once per mount, seeded.
 */
import { useLayoutEffect, useMemo } from 'react';
import { CanvasTexture, PlaneGeometry, SRGBColorSpace } from 'three';
import { FLOOR } from '../film/timeline.ts';
import { drawGround } from '../look/cutouts.ts';
import { canvas, fibreTexture } from '../look/paper.ts';

/** the valley page's path (fractions of the page), shared with the turning page */
export const VALLEY_PATH: [number, number][] = [[0.62, 1.0], [0.55, 0.78], [0.66, 0.58], [0.5, 0.4], [0.56, 0.2]];

export const PAGE_W = 11.6;
export const PAGE_D = 7.7;

export function Ground({ seed, path, earth }: { seed: number; path: [number, number][]; earth?: string }) {
  const { geometry, map } = useMemo(() => {
    const W = 1856;
    const H = Math.round((W * PAGE_D) / PAGE_W);
    const { c, g } = canvas(W, H);
    drawGround(g, W, H, seed, path, { earth });
    const map = new CanvasTexture(c);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 8;
    const geometry = new PlaneGeometry(PAGE_W, PAGE_D).rotateX(-Math.PI / 2);
    return { geometry, map };
    // path and colours are fixed per set
  }, [seed]);
  useLayoutEffect(() => () => (geometry.dispose(), map.dispose()), [geometry, map]);
  return (
    <mesh geometry={geometry} position={[0, FLOOR + 0.003, 0.05]} receiveShadow>
      <meshStandardMaterial map={map} roughness={0.97} bumpMap={fibreTexture()} bumpScale={0.5} />
    </mesh>
  );
}
