/**
 * A jack-o'-lantern: a ribbed, slightly squashed rind with a carved grin whose cuts glow from
 * the candle inside, a curled stem, and a warm point light. The flicker is seeded noise of the
 * stepped frame (2-8 Hz feel), never a clock. `lit` 0..1 lights it; 0 is a cold, dark gourd.
 */
import { valueNoise } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { CanvasTexture, CatmullRomCurve3, SphereGeometry, SRGBColorSpace, TubeGeometry, Vector3 } from 'three';
import { twos } from '../film/timeline.ts';
import { canvas, seq } from '../look/paper.ts';

const RIND = '#C9702C';
const RIND_DARK = '#7a3d17';
const GLOW = '#FFD27A';

function faceArt(seed: number, grin: 'wide' | 'small') {
  const W = 1024;
  const H = 512;
  const col = canvas(W, H);
  const em = canvas(W, H);
  const r = seq(seed, 'pumpkin');
  // rind with darker grooves between the ribs
  const grd = col.g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, RIND_DARK);
  grd.addColorStop(0.25, RIND);
  grd.addColorStop(0.75, RIND);
  grd.addColorStop(1, RIND_DARK);
  col.g.fillStyle = grd;
  col.g.fillRect(0, 0, W, H);
  col.g.strokeStyle = 'rgba(70,30,10,0.55)';
  for (let i = 0; i < 10; i++) {
    col.g.lineWidth = 6 + r() * 6;
    const x = (i / 10) * W;
    col.g.beginPath();
    col.g.moveTo(x, 0);
    col.g.bezierCurveTo(x + 10, H * 0.3, x - 10, H * 0.7, x, H);
    col.g.stroke();
  }
  em.g.fillStyle = '#000';
  em.g.fillRect(0, 0, W, H);
  // the face lives around u = 0.25: three's SphereGeometry faces +z there (x = -cos(2πu), z = sin(2πu))
  const cx = W * 0.25;
  const cy = H * 0.5;
  const s = grin === 'wide' ? 1 : 0.8;
  const cut = (paint: (g: CanvasRenderingContext2D) => void) => {
    for (const [g, fill] of [
      [col.g, '#2a0d03'],
      [em.g, GLOW],
    ] as const) {
      g.fillStyle = fill;
      g.beginPath();
      paint(g);
      g.fill();
    }
  };
  // slanted triangle eyes
  for (const side of [-1, 1]) {
    cut((g) => {
      g.moveTo(cx + side * 40 * s, cy - 40 * s);
      g.lineTo(cx + side * 105 * s, cy - 95 * s);
      g.lineTo(cx + side * 120 * s, cy - 30 * s);
      g.closePath();
    });
  }
  // a nose
  cut((g) => {
    g.moveTo(cx, cy - 12);
    g.lineTo(cx - 16 * s, cy + 18 * s);
    g.lineTo(cx + 16 * s, cy + 18 * s);
    g.closePath();
  });
  // a jagged grin
  cut((g) => {
    const w = 150 * s;
    g.moveTo(cx - w, cy + 25 * s);
    g.quadraticCurveTo(cx, cy + 140 * s, cx + w, cy + 25 * s);
    const teeth = 6;
    for (let i = teeth; i >= 0; i--) {
      const x = cx - w + (2 * w * i) / teeth;
      const y = cy + 40 * s + Math.sin((i / teeth) * Math.PI) * 30 * s;
      g.lineTo(x + w / teeth, y + (i % 2 ? 22 : -4) * s);
      g.lineTo(x, y);
    }
    g.closePath();
  });
  return { col: col.c, em: em.c };
}

export function Pumpkin({ position, scale = 1, lit, f, seed = 1, grin = 'wide', light = true, rotation = 0 }: { position: [number, number, number]; scale?: number; lit: number; f: number; seed?: number; grin?: 'wide' | 'small'; light?: boolean; rotation?: number }) {
  const { geo, stem, map, emap } = useMemo(() => {
    const g = new SphereGeometry(1, 64, 40);
    const p = g.attributes.position;
    const v = new Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const phi = Math.atan2(v.z, v.x);
      const rib = 1 - 0.07 * Math.sqrt(Math.abs(Math.cos(5 * phi)));
      const squash = 0.8 + 0.06 * (1 - Math.abs(v.y));
      v.set(v.x * rib, v.y * squash * (v.y > 0.85 ? 0.9 : 1), v.z * rib);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const curve = new CatmullRomCurve3([new Vector3(0, 0.7, 0), new Vector3(0.02, 0.95, 0.02), new Vector3(0.12, 1.12, 0.0), new Vector3(0.25, 1.15, -0.05)]);
    const stem = new TubeGeometry(curve, 16, 0.07, 8, false);
    const art = faceArt(seed, grin);
    const map = new CanvasTexture(art.col);
    map.colorSpace = SRGBColorSpace;
    const emap = new CanvasTexture(art.em);
    emap.colorSpace = SRGBColorSpace;
    return { geo: g, stem, map, emap };
  }, [seed, grin]);
  useLayoutEffect(
    () => () => {
      geo.dispose();
      stem.dispose();
      map.dispose();
      emap.dispose();
    },
    [geo, stem, map, emap],
  );
  const flick = 1 + 0.12 * (valueNoise(twos(f) * 0.37, seed * 3.1, seed) * 2 - 1);
  const e = lit * flick;
  return (
    <group position={position} scale={scale} rotation-y={rotation}>
      <mesh geometry={geo} position-y={0.8} castShadow receiveShadow>
        <meshStandardMaterial map={map} emissiveMap={emap} emissive="#ffb347" emissiveIntensity={2.6 * e} roughness={0.62} bumpScale={0} />
      </mesh>
      <mesh geometry={stem} position-y={0.8} castShadow>
        <meshStandardMaterial color="#3b3a1c" roughness={0.9} />
      </mesh>
      {/* the candle: inside the shell, so it lights the ground around (as through the cuts), not the rind */}
      {light && lit > 0 && <pointLight color="#ff9a3c" intensity={7 * e} distance={6} decay={2} position={[0, 0.8, 0.35]} />}
    </group>
  );
}
