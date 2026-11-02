/**
 * The gift: a pop-up letter that rises from a pull-tab in the door spread's floor, made of eight
 * horizontal slats like a Victorian transformation picture. Face A (warm cream, a storybook
 * serif): A GIFT FOR YOU. On the ding the slats flip top to bottom, on twos, to face B (cold
 * white, a plain sans): the suspension notice. Once flipped, the DOM layer takes over the
 * words (overlay/Overlay.tsx), so the type and the seal colour are exact.
 */
import { clamp } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { CanvasTexture, PlaneGeometry, SRGBColorSpace } from 'three';
import { canvas } from '../look/paper.ts';

export const LETTER_W = 1.7;
export const LETTER_H = 1.15;
/** the card stands this high above the page on its stalk (so the neighbour's eyes and the card share the frame) */
export const LETTER_BASE = 0.3;
const SLATS = 8;

export interface LetterFonts {
  /** CSS font-family values, already loaded */
  serif: string;
  sans: string;
}

/** Set `font`, shrinking its pixel size until `text` fits `maxW` (canvas text has no auto-fit). */
function fit(g: CanvasRenderingContext2D, text: string, font: string, maxW: number) {
  g.font = font;
  const w = g.measureText(text).width;
  if (w > maxW) g.font = font.replace(/(\d+)px/, (_, n) => `${Math.floor((Number(n) * maxW) / w)}px`);
}

function faceA(g: CanvasRenderingContext2D, w: number, h: number, fonts: LetterFonts) {
  g.fillStyle = '#F3EBBC';
  g.fillRect(0, 0, w, h);
  // a deckled inner border and pumpkins in the corners
  g.strokeStyle = '#8a5a2a';
  g.lineWidth = w * 0.006;
  g.strokeRect(w * 0.04, h * 0.06, w * 0.92, h * 0.88);
  g.fillStyle = '#e07b2a';
  for (const [x, y] of [
    [0.09, 0.14],
    [0.91, 0.14],
    [0.09, 0.86],
    [0.91, 0.86],
  ]) {
    g.beginPath();
    g.ellipse(x * w, y * h, w * 0.022, h * 0.03, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#2B1830';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fit(g, 'A GIFT FOR YOU', `${Math.round(h * 0.16)}px ${fonts.serif}`, w * 0.74);
  g.fillText('A GIFT FOR YOU', w / 2, h * 0.42);
  // a doodled ribbon bow
  g.strokeStyle = '#e07b2a';
  g.lineWidth = w * 0.008;
  const bx = w / 2;
  const by = h * 0.7;
  g.beginPath();
  g.ellipse(bx - w * 0.05, by, w * 0.05, h * 0.06, -0.4, 0, Math.PI * 2);
  g.ellipse(bx + w * 0.05, by, w * 0.05, h * 0.06, 0.4, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(bx, by);
  g.lineTo(bx - w * 0.04, by + h * 0.12);
  g.moveTo(bx, by);
  g.lineTo(bx + w * 0.04, by + h * 0.12);
  g.stroke();
}

/**
 * Face B: the suspension notice. Its layout (fractions of the card) is the DOM layer's
 * (overlay/Overlay.tsx Email), so the hand-over between them does not jump. `sealed` adds the
 * 封号 seal, for the frames after it has landed.
 */
export const FACE_B = {
  headTop: 0.17,
  head: 0.15,
  bodyTop: 0.55,
  body: 0.072,
  tabTop: 0.81,
  tab: 0.06,
  seal: 0.3,
  sealRight: 0.05,
  sealBottom: 0.06,
} as const;

function faceB(g: CanvasRenderingContext2D, w: number, h: number, fonts: LetterFonts & { cjk?: string }, sealed: boolean) {
  const L = FACE_B;
  g.fillStyle = '#EAF3F4';
  g.fillRect(0, 0, w, h);
  // an envelope glyph and greeked header lines: it reads as mail without saying who from
  g.strokeStyle = '#5b6b72';
  g.lineWidth = w * 0.006;
  g.strokeRect(w * 0.05, h * 0.06, w * 0.06, h * 0.07);
  g.beginPath();
  g.moveTo(w * 0.05, h * 0.06);
  g.lineTo(w * 0.08, h * 0.105);
  g.lineTo(w * 0.11, h * 0.06);
  g.stroke();
  g.fillStyle = '#c3cfd3';
  g.fillRect(w * 0.14, h * 0.07, w * 0.3, h * 0.018);
  g.fillRect(w * 0.14, h * 0.11, w * 0.2, h * 0.018);
  g.fillStyle = '#1a2228';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.font = `800 ${Math.round(h * L.head)}px ${fonts.sans}`;
  g.fillText('ACCOUNT', w * 0.05, h * L.headTop);
  g.fillText('SUSPENDED', w * 0.05, h * (L.headTop + L.head * 1.07));
  g.font = `400 ${Math.round(h * L.body)}px ${fonts.sans}`;
  g.fillText('Suspicious signals detected.', w * 0.05, h * L.bodyTop);
  g.fillText('Happy Halloween!', w * 0.05, h * (L.bodyTop + L.body * 1.4));
  if (sealed) {
    const sz = h * L.seal;
    const x = w - w * L.sealRight - sz;
    const y = h - h * L.sealBottom - sz;
    g.save();
    g.translate(x + sz / 2, y + sz / 2);
    g.rotate((-7 * Math.PI) / 180);
    g.fillStyle = '#C8322A';
    g.fillRect(-sz / 2, -sz / 2, sz, sz);
    g.fillStyle = '#fff7f0';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 ${Math.round(sz * 0.4)}px ${fonts.cjk ?? fonts.sans}`;
    g.fillText('封', 0, -sz * 0.21);
    g.fillText('号', 0, sz * 0.21);
    g.restore();
  }
}

export function Letter({ rise, flip, sealed, fonts, ready }: { rise: number; flip: number; sealed: boolean; fonts: LetterFonts & { cjk?: string }; ready: boolean }) {
  const { slats, maps } = useMemo(() => {
    const W = 1360;
    const H = Math.round((W * LETTER_H) / LETTER_W);
    const a = canvas(W, H);
    const b = canvas(W, H);
    const c = canvas(W, H);
    faceA(a.g, W, H, fonts);
    faceB(b.g, W, H, fonts, false);
    faceB(c.g, W, H, fonts, true);
    const ma = new CanvasTexture(a.c);
    const mb = new CanvasTexture(b.c);
    const mc = new CanvasTexture(c.c);
    ma.colorSpace = mb.colorSpace = mc.colorSpace = SRGBColorSpace;
    ma.anisotropy = mb.anisotropy = mc.anisotropy = 8;
    // one plane per slat, its UVs cut to its band of the face (front A; back B, upright after the flip)
    const slats = Array.from({ length: SLATS }, (_, i) => {
      const front = new PlaneGeometry(LETTER_W, LETTER_H / SLATS);
      const back = new PlaneGeometry(LETTER_W, LETTER_H / SLATS);
      const v0 = 1 - (i + 1) / SLATS;
      const v1 = 1 - i / SLATS;
      const uv = front.attributes.uv;
      const ub = back.attributes.uv;
      for (let k = 0; k < uv.count; k++) {
        const v = uv.getY(k);
        uv.setY(k, v0 + v * (v1 - v0));
        // the back plane is turned 180° about x here and the slat turns 180° more on the flip, so
        // after the flip it stands upright again: it takes the same band of face B
        ub.setY(k, v0 + v * (v1 - v0));
      }
      back.rotateX(Math.PI);
      return { front, back };
    });
    return { slats, maps: [ma, mb, mc] };
    // redraw once the fonts are ready (the first draw may use the fallback for a frame that is never captured)
  }, [fonts, ready]);
  useLayoutEffect(
    () => () => {
      slats.forEach((s) => (s.front.dispose(), s.back.dispose()));
      maps.forEach((m) => m.dispose());
    },
    [slats, maps],
  );
  if (rise <= 0) return null;
  const sh = LETTER_H / SLATS;
  // it slides up out of a slot in the page, on a paper stalk, and back down into it
  const lift = (rise - 1) * (LETTER_H + 0.4);
  const faceBMap = sealed ? maps[2] : maps[1];
  return (
    <group position-y={lift}>
      <mesh position-y={LETTER_BASE / 2}>
        <boxGeometry args={[0.05, LETTER_BASE + 0.02, 0.02]} />
        <meshStandardMaterial color="#2a2320" roughness={0.9} />
      </mesh>
      {slats.map((s, i) => {
        // top slat first, each a little behind the one above; on twos (flip is already stepped)
        const k = clamp(flip * 1.7 - i * 0.1);
        const y = LETTER_BASE + LETTER_H - (i + 0.5) * sh;
        return (
          <group key={i} position-y={y} rotation-x={k * Math.PI}>
            <mesh geometry={s.front}>
              <meshStandardMaterial map={maps[0]} roughness={0.9} emissive="#3a2a10" emissiveIntensity={0.15} />
            </mesh>
            <mesh geometry={s.back}>
              <meshStandardMaterial map={faceBMap} roughness={0.9} emissive="#ffffff" emissiveMap={faceBMap} emissiveIntensity={0.35} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
