/**
 * Paper: the film's one material family. A cut-paper card is a plane whose picture and
 * outline come from a canvas drawn once (seeded, so every chunk page draws the same pixels),
 * alpha-tested so its edge is a clean cut, with a shared fibre bump so the moonlight rakes
 * across real paper. A card can glow from behind (`backlight`), the lightbox look: back layers
 * glow through, front layers stay silhouettes.
 */
import { rand } from '@aiv/core';
import { CanvasTexture, DoubleSide, LinearSRGBColorSpace, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, type Color } from 'three';

/** A stateful seeded sequence for one drawing (deterministic: same seed, same calls, same numbers). */
export function seq(seed: number, id: string) {
  let k = 0;
  const next = () => rand(seed, id, k++);
  return Object.assign(next, { range: (a: number, b: number) => a + (b - a) * next() });
}
export type Seq = ReturnType<typeof seq>;

export function canvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: false })!;
  return { c, g };
}

let fibre: CanvasTexture | null = null;
/** A tileable paper-fibre height map (built once per page). */
export function fibreTexture(): CanvasTexture {
  if (fibre) return fibre;
  const n = 256;
  const { c, g } = canvas(n, n);
  const img = g.createImageData(n, n);
  const r = seq(77, 'fibre');
  const h = new Float32Array(n * n).fill(0.5);
  // short fibres: random strokes of slightly raised height, wrapped at the edges
  for (let i = 0; i < 1400; i++) {
    let x = r() * n;
    let y = r() * n;
    const a = r() * Math.PI;
    const len = 4 + r() * 14;
    const v = 0.08 + r() * 0.12;
    for (let s = 0; s < len; s++) {
      const xi = ((Math.floor(x) % n) + n) % n;
      const yi = ((Math.floor(y) % n) + n) % n;
      h[yi * n + xi] += v;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
  for (let i = 0; i < n * n; i++) {
    const v = Math.max(0, Math.min(255, Math.round((h[i] + (r() - 0.5) * 0.15) * 200)));
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  fibre = new CanvasTexture(c);
  fibre.colorSpace = LinearSRGBColorSpace;
  fibre.wrapS = fibre.wrapT = RepeatWrapping;
  fibre.repeat.set(6, 6);
  return fibre;
}

export interface CardOptions {
  /** glow from behind, 0 (silhouette) .. 1+ */
  backlight?: number;
  glow?: Color | string;
  /** a second canvas whose bright parts glow on their own (windows, eyes) */
  emissive?: HTMLCanvasElement;
  emissiveIntensity?: number;
  roughness?: number;
}

export function cardMaterial(art: HTMLCanvasElement, o: CardOptions = {}): MeshStandardMaterial {
  const map = new CanvasTexture(art);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  const em = o.emissive ? new CanvasTexture(o.emissive) : map;
  em.colorSpace = SRGBColorSpace;
  const m = new MeshStandardMaterial({
    map,
    alphaTest: 0.5,
    alphaToCoverage: true,
    side: DoubleSide,
    roughness: o.roughness ?? 0.96,
    metalness: 0,
    bumpMap: fibreTexture(),
    bumpScale: 0.6,
    emissiveMap: em,
    emissive: o.emissive ? '#ffffff' : (o.glow ?? '#0e2a36'),
    emissiveIntensity: o.emissive ? (o.emissiveIntensity ?? 1) : (o.backlight ?? 0),
  });
  return m;
}
