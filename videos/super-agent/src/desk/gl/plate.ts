/**
 * A trait plate's face (synthesis §2, Trait plates; SCRIPT.md, Labels and plates): its EN · zh words
 * engraved in ink on enamel, one line, set in the film's sans (IBM Plex Sans SemiBold, the Han in Noto
 * Sans SC from the same stack) at `em` world units or more: 43 u is about 36 px on screen at the 0.85×
 * framing. One function for every trait plate (Continuous · 连续, Proactive · 主动, Productive · 高效,
 * Persistent · 持久): the plate's size comes from layout.ts, the words from cues.ts WORDS.
 *
 * Drawn once into a CPU canvas (the kit's textCanvas, fillTextChecked: a missing glyph fails the
 * render) after the faces are in, white paper with ink: the enamel material's colour tints it.
 */
import { fillTextChecked, textCanvas } from '@aiv/remotion-kit';
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';

/** Texels per world unit on a plate (as gl/text.ts TEX). */
const TEX = 2.8;
/** The words' size (world units): at least 36 px at the 0.85× framing. */
export const PLATE_EM = 43;
const INK = '#2A2B2A';

/** The plate's words as one line: "Continuous · 连续". */
export const plateLine = (w: { en: string; 'zh-Hans': string }): string => `${w.en} · ${w['zh-Hans']}`;

/**
 * A trait plate's face texture for `size` (world units, the face inside the plate's rim): an engraved border rule and
 * the words centred, at PLATE_EM (smaller only if they would not fit: never below 40 u).
 */
export function plateTexture(sans: string, words: { en: string; 'zh-Hans': string }, size: readonly [number, number], aniso: number): Texture {
  const [w, h] = size;
  const { c, g } = textCanvas(Math.ceil(w * TEX), Math.ceil(h * TEX));
  g.scale(TEX, TEX);
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, w, h);
  // the engraved border: a fine rule inset from the face's edge, its corners cut
  g.strokeStyle = '#5E5B55';
  g.lineWidth = 1.1;
  const k = 4;
  g.beginPath();
  g.moveTo(3 + k, 3);
  g.lineTo(w - 3 - k, 3);
  g.lineTo(w - 3, 3 + k);
  g.lineTo(w - 3, h - 3 - k);
  g.lineTo(w - 3 - k, h - 3);
  g.lineTo(3 + k, h - 3);
  g.lineTo(3, h - 3 - k);
  g.lineTo(3, 3 + k);
  g.closePath();
  g.stroke();
  // the words: EN and the dot in SemiBold, the Han a step lighter (the labels' CJK weight)
  const en = `${words.en} · `;
  const zh = words['zh-Hans'];
  const fit = (em: number) => {
    g.font = `600 ${em}px ${sans}`;
    const a = g.measureText(en).width;
    g.font = `500 ${em}px ${sans}`;
    return a + g.measureText(zh).width;
  };
  let em = PLATE_EM;
  while (em > 40 && fit(em) > w - 22) em -= 0.5;
  const total = fit(em);
  const x0 = (w - total) / 2;
  const base = h / 2 + em * 0.36;
  g.fillStyle = INK;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.font = `600 ${em}px ${sans}`;
  fillTextChecked(g, en, x0, base);
  const enW = g.measureText(en).width;
  g.font = `500 ${em}px ${sans}`;
  fillTextChecked(g, zh, x0 + enW, base);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
