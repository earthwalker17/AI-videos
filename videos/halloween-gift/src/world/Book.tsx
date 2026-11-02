/**
 * The storybook on the desk: a page block and a cover hinged along the spine at the back. Open,
 * the cover stands up as the stage's backdrop (its inside is the night sky with the moon) and the
 * first page is the stage floor. Units: the book is 12 wide (x), 8 deep (z), 1.2 thick.
 */
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry, CanvasTexture, PlaneGeometry, SRGBColorSpace } from 'three';
import { at, FPS } from '../cues.ts';
import { coverOpen, FLOOR, pageTurn } from '../film/timeline.ts';
import { drawGround } from '../look/cutouts.ts';
import { canvas, fibreTexture, seq } from '../look/paper.ts';
import { VALLEY_PATH } from './Ground.tsx';
import { skyTime, useSkyMaterial } from '../look/Sky.tsx';
import { twos } from '../film/timeline.ts';

export const BOOK_W = 12;
export const BOOK_D = 8;
const COVER_T = 0.14;

/** The cover's outside: plum cloth, a mint foil border and the title in English and Chinese. */
function coverArt(fonts: { serif: string; cjk: string }) {
  const W = 1536;
  const H = 1024;
  const { c, g } = canvas(W, H);
  const r = seq(71, 'cover');
  g.fillStyle = '#3a2438';
  g.fillRect(0, 0, W, H);
  // cloth weave
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(20,10,20,0.18)' : 'rgba(90,60,90,0.12)';
    g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
  }
  const foil = '#DCE6B7';
  g.strokeStyle = foil;
  g.lineWidth = 6;
  g.strokeRect(70, 60, W - 140, H - 120);
  g.lineWidth = 2;
  g.strokeRect(92, 82, W - 184, H - 164);
  // curls in the corners
  for (const [x, y, sx, sy] of [
    [92, 82, 1, 1],
    [W - 92, 82, -1, 1],
    [92, H - 82, 1, -1],
    [W - 92, H - 82, -1, -1],
  ]) {
    g.beginPath();
    for (let t = 0; t < 3.5 * Math.PI; t += 0.15) {
      const rr = 70 * (1 - t / (4 * Math.PI));
      g.lineTo(x + sx * (70 + Math.cos(t) * rr), y + sy * (70 + Math.sin(t) * rr));
    }
    g.stroke();
  }
  // a crescent moon and a small pumpkin emblem
  g.fillStyle = foil;
  g.beginPath();
  g.arc(W / 2, H * 0.22, 64, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a2438';
  g.beginPath();
  g.arc(W / 2 + 26, H * 0.2, 58, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = foil;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${Math.round(H * 0.15)}px ${fonts.serif}`;
  g.fillText('A Halloween Gift', W / 2, H * 0.5);
  g.font = `600 ${Math.round(H * 0.1)}px ${fonts.cjk}`;
  g.fillText('万圣节礼物', W / 2, H * 0.7);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** The book knocks from inside: the cover jolts up and settles over 4 frames (on twos). */
function knockLift(t: number): number {
  for (const k of [at(2, 1), at(2, 3), at(38, 1), at(38, 3)]) if (t >= k && t < k + 6) return 0.045 * (1 - (t - k) / 6);
  return 0;
}

export function Book({ f, children, fonts, ready }: { f: number; children?: React.ReactNode; fonts: { serif: string; cjk: string }; ready: boolean }) {
  const title = useMemo(() => coverArt(fonts), [fonts, ready]);
  useLayoutEffect(() => () => title.dispose(), [title]);
  // the turning page is the valley's page: its printed ground goes with it
  const pageArt = useMemo(() => {
    const W = 1856;
    const H = Math.round((W * (BOOK_D - 0.3)) / (BOOK_W - 0.4));
    const { c, g } = canvas(W, H);
    drawGround(g, W, H, 21, VALLEY_PATH);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  useLayoutEffect(() => () => pageArt.dispose(), [pageArt]);
  const geo = useMemo(
    () => ({
      block: new BoxGeometry(BOOK_W - 0.3, FLOOR - 0.04, BOOK_D - 0.25),
      cover: new BoxGeometry(BOOK_W, COVER_T, BOOK_D),
      sheet: new PlaneGeometry(BOOK_W - 0.4, BOOK_D - 0.3),
    }),
    [],
  );
  const sky = useSkyMaterial((BOOK_W - 0.4) / (BOOK_D - 0.3));
  useLayoutEffect(() => skyTime(sky, f, FPS), [sky, f]);
  const t = twos(f);
  const open = coverOpen(f) + knockLift(t) / (Math.PI / 2);
  // cyan light leaks from the pages before the cover bursts (and while it knocks)
  const leak = t < at(4) ? 0.35 + 0.65 * Math.min(1, t / at(4)) + (knockLift(t) > 0 ? 1.5 : 0) : knockLift(t) > 0 ? 1.2 : 0;
  const turn = pageTurn(f);
  return (
    <group>
      {/* the page block, sitting on the back board */}
      <mesh geometry={geo.block} position={[0, (FLOOR - 0.04) / 2, 0.1]} receiveShadow castShadow>
        <meshStandardMaterial color="#cfc3a6" roughness={0.95} />
      </mesh>
      {/* the cover, hinged at the spine (z = -4, top of the block) */}
      <group position={[0, FLOOR, -BOOK_D / 2]} rotation-x={-open * (Math.PI / 2)}>
        <mesh geometry={geo.cover} position={[0, COVER_T / 2, BOOK_D / 2]} castShadow receiveShadow>
          <meshStandardMaterial color="#312030" roughness={0.9} />
        </mesh>
        {/* the cover's outside: cloth, foil border, the title */}
        <mesh position={[0, COVER_T + 0.002, BOOK_D / 2]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[BOOK_W - 0.1, BOOK_D - 0.1]} />
          <meshStandardMaterial map={title} roughness={0.8} metalness={0.15} bumpMap={fibreTexture()} bumpScale={0.4} emissive="#DCE6B7" emissiveMap={title} emissiveIntensity={0.05} />
        </mesh>
        {/* the inside of the cover: the backdrop (night sky), facing the stage when open */}
        <mesh geometry={geo.sheet} material={sky} position={[0, -0.005, BOOK_D / 2]} rotation-x={Math.PI / 2} />
      </group>
      {/* the turning page: lies on the floor, sweeps up against the backdrop */}
      {turn > 0 && turn < 1 && (
        <group position={[0, FLOOR + 0.01, -BOOK_D / 2]} rotation-x={-turn * (Math.PI / 2)}>
          <mesh geometry={geo.sheet} position={[0, 0, BOOK_D / 2]} rotation-x={-Math.PI / 2}>
            <meshStandardMaterial map={pageArt} roughness={0.95} side={2} />
          </mesh>
        </group>
      )}
      {leak > 0 && (
        <>
          <mesh position={[0, FLOOR - 0.1, BOOK_D / 2 - 0.12]}>
            <planeGeometry args={[BOOK_W - 0.5, 0.12]} />
            <meshBasicMaterial color={[0.35 * leak, 1.5 * leak, 1.7 * leak]} toneMapped={false} />
          </mesh>
          <pointLight color="#57CEE2" intensity={3 * leak} distance={5} decay={2} position={[0, FLOOR, BOOK_D / 2 + 0.4]} />
        </>
      )}
      {open > 0.02 && children}
    </group>
  );
}
