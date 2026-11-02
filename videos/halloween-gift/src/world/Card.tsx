/**
 * A pop-up card: a cut-paper picture standing on the page, hinged at its base. `rise` 0 lies
 * flat on the page, 1 stands; the picture is drawn once into a canvas (`draw`), seeded. A small
 * per-hold jitter ("boil") on twos sells the handmade, stop-motion feel.
 */
import { rand } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { PlaneGeometry } from 'three';
import { twos } from '../film/timeline.ts';
import { canvas, cardMaterial, type CardOptions } from '../look/paper.ts';

export interface CardProps extends CardOptions {
  /** world position of the card's base centre */
  at: [number, number, number];
  /** world size: width, height */
  size: [number, number];
  /** canvas pixels per world unit */
  ppu?: number;
  draw: (g: CanvasRenderingContext2D, w: number, h: number, e: CanvasRenderingContext2D) => void;
  rise?: number;
  /** lean about the view axis, radians */
  tilt?: number;
  /** turn about y, radians */
  yaw?: number;
  /** film frame and a seed for the boil (omit for none) */
  boil?: { f: number; seed: number; amp?: number };
  shadow?: boolean;
  renderOrder?: number;
}

export function Card({ at, size, ppu = 160, draw, rise = 1, tilt = 0, yaw = 0, boil, shadow = true, renderOrder, ...mat }: CardProps) {
  const [w, h] = size;
  const { geometry, material } = useMemo(() => {
    const W = Math.round(w * ppu);
    const H = Math.round(h * ppu);
    const art = canvas(W, H);
    const em = canvas(W, H);
    draw(art.g, W, H, em.g);
    const geometry = new PlaneGeometry(w, h).translate(0, h / 2, 0);
    const material = cardMaterial(art.c, mat.emissive === undefined && mat.emissiveIntensity ? { ...mat, emissive: em.c } : mat);
    return { geometry, material };
    // the drawing is fixed per mount: deps are the size and density only
  }, [w, h, ppu]);
  useLayoutEffect(
    () => () => {
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const hold = boil ? twos(boil.f) : 0;
  const j = boil ? (k: number) => (rand(boil.seed, hold, k) - 0.5) * (boil.amp ?? 0.004) : () => 0;
  return (
    <group position={[at[0] + j(0), at[1], at[2] + j(1)]} rotation-y={yaw}>
      <group rotation-x={-(1 - Math.min(1, rise)) * (Math.PI / 2) + (rise > 1 ? -(rise - 1) * 0.6 : 0)} rotation-z={tilt + j(2) * 2}>
        <mesh geometry={geometry} material={material} castShadow={shadow} receiveShadow renderOrder={renderOrder} />
      </group>
    </group>
  );
}
