/**
 * The ground of the world: one displaced grid over the open page, its heights from
 * world/layout.ts (the hill, mounds, lumps, the carved path), coloured per vertex (moonlit turf,
 * the path's dirt with cobbles, rock near the crag and the house, and at the margin the printed
 * page it grows out of), shaded by the storybook material (paint breakup, bump, rim, fog).
 * `grow` (0..1) raises it out of the flat page as the book opens: heights scale up and the
 * colours fade in from the paper, the world's six pops.
 */
import { smoothstep } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, Color, PlaneGeometry } from 'three';
import { fbm2 } from '../kit/field.ts';
import { storybookMaterial } from '../look/materials.ts';
import { FLOOR, groundHeight, LAND, PAGE, pageMask, pathMask } from './layout.ts';

const PAPER = new Color('#cfc2a2');
const TURF_DARK = new Color('#172129');
const TURF = new Color('#233d48');
const TURF_LIT = new Color('#365c68');
const DIRT = new Color('#3a3339');
const ROCK = new Color('#393b48');

export function terrainGeometry(segX = 300, segZ = 205): PlaneGeometry {
  const g = new PlaneGeometry(PAGE.w, PAGE.d, segX, segZ).rotateX(-Math.PI / 2);
  const pos = g.attributes.position as BufferAttribute;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const mask = new Float32Array(n);
  const height0 = new Float32Array(n);
  const c = new Color();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeight(x, z);
    height0[i] = h;
    pos.setY(i, h);
    const pm = pathMask(x, z);
    mask[i] = pm;
    // turf: patchy, lighter on the crests that catch the moon
    const patch = 0.5 + 0.5 * fbm2(x, z, 41, 3, 0.8);
    c.copy(TURF_DARK).lerp(TURF, patch).lerp(TURF_LIT, smoothstep(0.35, 0.8, h) * 0.5 * patch);
    // rock where the ground climbs to the crag and around the house's foundations
    const rocky = smoothstep(2.6, 1.2, Math.hypot(x - LAND.crag.x, z - LAND.crag.z)) * 0.8;
    c.lerp(ROCK, rocky);
    // the path's dirt, with darker ruts along its edges
    c.lerp(DIRT, pm);
    // the printed page at the margin
    c.lerp(PAPER, 1 - pageMask(x, z));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setAttribute('aSbMask', new BufferAttribute(mask, 1));
  g.userData.height0 = height0;
  g.computeVertexNormals();
  return g;
}

export function Terrain({ grow = 1 }: { grow?: number }) {
  const { geometry, material } = useMemo(() => {
    const geometry = terrainGeometry();
    const material = storybookMaterial({ kind: 'earth', vertexColors: true, roughness: 0.96, breakup: 0.32, scale: 0.4, bump: 0.9, mask: true, color2: '#24413a' });
    return { geometry, material };
  }, []);
  useLayoutEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);
  // the world rises out of the page: one smooth scale of the heights (no per-vertex rebuild)
  return <mesh geometry={geometry} material={material} position-y={FLOOR + 0.004} scale-y={Math.max(0.001, grow)} receiveShadow />;
}
