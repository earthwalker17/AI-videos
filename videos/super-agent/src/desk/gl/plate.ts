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
import { pictureLine, zhInPicture } from '../../look/zhInPicture.ts';

/** Texels per world unit on a plate (as gl/text.ts TEX). */
const TEX = 2.8;
/** Texels per world unit on the stress plate, read in the close (2.4x). */
const TEX_STRESS = 6;
/** The words' size (world units): at least 36 px at the 0.85× framing. */
export const PLATE_EM = 43;
const INK = '#2A2B2A';

/** The plate's words as one line: "Continuous · 连续" (the zh policy keeps the trait plates' zh: look/zhInPicture.ts). */
export const plateLine = (w: { en: string; 'zh-Hans': string }): string => pictureLine(w);

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
  // the words: EN and the dot in SemiBold, the Han a step lighter (the labels' CJK weight); the EN alone if the zh policy drew no zh
  const zh = zhInPicture(words) ?? '';
  const en = zh ? `${words.en} · ` : words.en;
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
  if (zh) fillTextChecked(g, zh, x0 + enW, base);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

/** The stress plate's lines (world units): about 38 px in the close (2.4x, camera.ts FRAMING_C), the header fitted to the face (never under 14 u, 36 px). */
export const STRESS_EM = 14.5;
/**
 * The stress plate's face, down from its top (u, on the 84 u face inside the plate's rim): the header's baseline, the
 * hairline, the two rows' baselines. With the header's zh line gone the four are spaced evenly: about 8 u of air from the
 * engraved border to the header's caps and from the last row's descenders to the border, 10 u either side of the hairline.
 */
export const STRESS_LINES = { head: 21, rule: 31.5, rows: [51, 70] as const } as const;
/** The lines the stress plate engraves, as they read (the tests hold them to the zh policy). */
export const stressText = (w: { head: { en: string; 'zh-Hans': string }; arrivals: { en: string }; decision: { en: string } }): string[] => [pictureLine(w.head), w.arrivals.en, w.decision.en];

/**
 * The stress plate's face (STORYBOARD 6.2; cues.ts WORDS.plateHead, plateArrivals, plateDecision): engraved like the
 * trait plates, ink on enamel, set in the film's sans: the header in EN (its zh is not drawn: the zh policy,
 * look/zhInPicture.ts, the user, 2026-11-14), a hairline, then the two rows of endpoints, which read the same in both
 * languages and are drawn once; the lines spaced evenly down the face (STRESS_LINES). Endpoints only: no axis, no curve.
 * Stamped, never rolled: the plate arrives engraved.
 */
export function stressTexture(sans: string, w: { head: { en: string; 'zh-Hans': string }; arrivals: { en: string }; decision: { en: string } }, size: readonly [number, number], aniso: number): Texture {
  const [W, H] = size;
  const { c, g } = textCanvas(Math.ceil(W * TEX_STRESS), Math.ceil(H * TEX_STRESS));
  g.scale(TEX_STRESS, TEX_STRESS);
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#5E5B55';
  g.lineWidth = 1.1;
  const k = 4;
  g.beginPath();
  g.moveTo(3 + k, 3);
  g.lineTo(W - 3 - k, 3);
  g.lineTo(W - 3, 3 + k);
  g.lineTo(W - 3, H - 3 - k);
  g.lineTo(W - 3 - k, H - 3);
  g.lineTo(3 + k, H - 3);
  g.lineTo(3, H - 3 - k);
  g.lineTo(3, 3 + k);
  g.closePath();
  g.stroke();
  g.fillStyle = INK;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  const x0 = 9;
  const em = STRESS_EM;
  // the header fitted to the face (never under 14 u: about 36 px in the close)
  let he = em;
  g.font = `600 ${he}px ${sans}`;
  while (he > 14 && g.measureText(w.head.en).width > W - 2 * x0) {
    he -= 0.25;
    g.font = `600 ${he}px ${sans}`;
  }
  const [head, arrivals, decision] = stressText(w);
  if (head !== w.head.en) throw new Error(`stress plate: its face is laid out for its header's EN alone, not "${head}" (gl/plate.ts STRESS_LINES)`);
  fillTextChecked(g, head, x0, STRESS_LINES.head);
  g.strokeStyle = '#8E8A82';
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(x0, STRESS_LINES.rule);
  g.lineTo(W - x0, STRESS_LINES.rule);
  g.stroke();
  // the endpoints, the arrows between them: one row each
  g.font = `600 ${em}px ${sans}`;
  fillTextChecked(g, arrivals!, x0, STRESS_LINES.rows[0]);
  fillTextChecked(g, decision!, x0, STRESS_LINES.rows[1]);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
