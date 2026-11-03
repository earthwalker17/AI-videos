/**
 * Moonlit grass: tens of thousands of real blade meshes (no alpha cards, so no overdraw or
 * shimmering cut-outs), scattered once with hashed randomness over the turf, kept off the path,
 * the page margin and the stones, in clumps; split into tiles so off-screen tiles cull. Blades
 * sway with a frame-driven wind in the storybook material, darker at the root, catching the moon
 * on their tips. `grow` raises them with the terrain.
 */
import { rand } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { bump, fbm2 } from '../kit/field.ts';
import { storybookMaterial } from '../look/materials.ts';
import { FLOOR, groundHeight, LAND, PAGE, pageMask, pathMask, STONES } from './layout.ts';

/** One blade: a curved, tapering strip of `seg` segments, height 1, root at the origin. */
function bladeGeometry(seg = 4): BufferGeometry {
  const pos: number[] = [];
  const wind: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const w = 0.009 * (1 - t) ** 0.9 + 0.001;
    const bend = 0.18 * t * t;
    const shade = 0.45 + 0.55 * t;
    pos.push(-w, t, bend, w, t, bend);
    wind.push(t, t);
    col.push(shade, shade, shade, shade, shade, shade);
    if (i < seg) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aWind', new BufferAttribute(new Float32Array(wind), 1));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

interface Blade {
  x: number;
  z: number;
  h: number;
  m: Matrix4;
  c: Color;
}

/** Density of grass at (x, z): 0 on the path and the margin, thin by the stones, in clumps. */
function density(x: number, z: number): number {
  let d = pageMask(x, z) * (1 - pathMask(x, z));
  d *= 0.45 + 0.55 * (0.5 + 0.5 * fbm2(x, z, 71, 3, 1.1));
  for (const s of STONES) d *= 1 - 0.9 * bump(x, z, s.x, s.z, 0.16);
  d *= 1 - bump(x, z, LAND.house.x, LAND.house.z, 0.9);
  d *= 1 - bump(x, z, LAND.bigPumpkin.x, LAND.bigPumpkin.z, 0.55);
  return d;
}

const TIP = new Color('#4c7d8c');
const TIP_DRY = new Color('#5d6670');

function scatter(spacing: number): Blade[] {
  const out: Blade[] = [];
  const q = new Quaternion();
  const e = new Vector3();
  const up = new Vector3(0, 1, 0);
  const nx = Math.floor(PAGE.w / spacing);
  const nz = Math.floor(PAGE.d / spacing);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const x = -PAGE.w / 2 + (i + rand(5, i, j * 2)) * spacing;
      const z = -PAGE.d / 2 + (j + rand(5, i, j * 2 + 1)) * spacing;
      const d = density(x, z);
      if (rand(6, i, j) > d) continue;
      const h = groundHeight(x, z);
      // taller and unkempt by the fence, the stones and the corners; short near the path
      const tall = 0.06 + 0.09 * rand(7, i, j) + 0.07 * (1 - pathMask(x, z)) * (0.5 + 0.5 * fbm2(x, z, 72, 2, 0.6));
      const yaw = rand(8, i, j) * Math.PI * 2;
      const tilt = (rand(9, i, j) - 0.5) * 0.5;
      q.setFromAxisAngle(up, yaw);
      const t = new Quaternion().setFromAxisAngle(e.set(1, 0, 0), tilt);
      q.multiply(t);
      const m = new Matrix4().compose(new Vector3(x, h, z), q, new Vector3(1, tall, 1));
      const c = TIP.clone().lerp(TIP_DRY, rand(10, i, j) * 0.6).multiplyScalar(0.75 + 0.5 * rand(11, i, j));
      out.push({ x, z, h, m, c });
    }
  return out;
}

export function Grass({ grow = 1, spacing = 0.04, tiles = 4 }: { grow?: number; spacing?: number; tiles?: number }) {
  const { meshes, geometry, material } = useMemo(() => {
    const geometry = bladeGeometry();
    const material = storybookMaterial({ kind: 'grass', vertexColors: true, side: DoubleSide, roughness: 0.85, breakup: 0.08, scale: 0.6, rim: 1.4, wind: 0.035 });
    const blades = scatter(spacing);
    // tiles over the page so off-screen ones cull (instances never move: their bounds are true)
    const buckets: Blade[][] = Array.from({ length: tiles * tiles }, () => []);
    for (const b of blades) {
      const ti = Math.min(tiles - 1, Math.floor(((b.x + PAGE.w / 2) / PAGE.w) * tiles));
      const tj = Math.min(tiles - 1, Math.floor(((b.z + PAGE.d / 2) / PAGE.d) * tiles));
      buckets[tj * tiles + ti].push(b);
    }
    const meshes = buckets
      .filter((b) => b.length)
      .map((bucket) => {
        const m = new InstancedMesh(geometry, material, bucket.length);
        bucket.forEach((b, k) => {
          m.setMatrixAt(k, b.m);
          m.setColorAt(k, b.c);
        });
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.computeBoundingSphere();
        m.receiveShadow = true;
        m.castShadow = false;
        return m;
      });
    return { meshes, geometry, material, count: blades.length };
  }, [spacing, tiles]);
  useLayoutEffect(
    () => () => {
      meshes.forEach((m) => m.dispose());
      geometry.dispose();
      material.dispose();
    },
    [meshes, geometry, material],
  );
  return (
    <group position-y={FLOOR + 0.004} scale-y={Math.max(0.001, grow)} visible={grow > 0.02}>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}
