/**
 * The gift's face B: a parody of the account-suspension email people receive, made to be
 * recognised by its format — a pale page, a rounded white card on it, a mark and a name at the
 * top, "Hello,", a paragraph with underlined links, "Regards" and a team sign-off — while every
 * element is our own (references/brand-parody.md): the mark is a Halloween starburst of candy-corn
 * rays round a tiny jack-o'-lantern (no Anthropic logo, hue shifted from #d97757), the name is
 * Clawd in the storybook serif, the words are ours (no sentence of the real email, no echo of its
 * team), the links lead nowhere.
 *
 * It is a printed card in the world, not a screenshot: the page is the gift's deckled paper (face
 * A's stock: grain, fibres, a browned edge, the transformation card's slat joins showing in its
 * margin only), the white card on it carries a faint shadow and the same grain, and the light of
 * the door yard falls across both (lighter at the upper left, the lantern's side). The 封号 seal is
 * a stamp pressed into the card: ink multiplied into the paper, the characters cut white (白文),
 * a cut ring inside its ragged edge, speckled where the ink did not take.
 *
 * One layout table (EMAIL, emailLayout) drives both renderings: the DOM card (crisp, over the
 * frame) and the canvas face printed on the 3D letter's slats, with the same explicit line breaks,
 * so the crossfade from the 3D letter to the DOM card lands on the same pixels. The paper, the card
 * and the mark are one canvas drawing (drawEmailPaper) in both; only the words and the seal's two
 * characters are DOM text over it (forced to grayscale antialiasing: no LCD colour fringes).
 */
import { rand } from '@aiv/core';
import { fillTextChecked, textCanvas, textContext } from '@aiv/remotion-kit';
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { fbm2 } from '../kit/field.ts';

/** The face's proportions (width / height) and its layout in fractions of the face's height. */
export const EMAIL = {
  aspect: 1.28,
  /** the paper's margin round the white card */
  margin: 0.042,
  /** the words' inset from the face's left and right edges (the margin and the card's padding); the Appeal tab's right edge */
  pad: 0.142,
  page: '#f1ebdd',
  card: '#fcfbf7',
  border: '#e0d8c8',
  /** the ink is neutral grey: the DOM words are drawn through a grayscale filter (no LCD fringes), so the canvas uses the same greys */
  ink: '#262626',
  body: '#363636',
  link: '#363636',
  tabFill: '#2a2a2a',
  tabInk: '#f8f8f8',
  radius: 0.03,
  mark: { top: 0.14, size: 0.088 },
  name: { size: 0.064 },
  hello: { top: 0.262, size: 0.052 },
  /** the paragraph: rows `size × lead` apart from `top` (a row may set its own, larger, type) */
  para: { top: 0.335, size: 0.044, lead: 1.56 },
  /** the sign-off: Regards on the row after the paragraph, the team `gap` rows further down */
  regards: { size: 0.044, gap: 0.45 },
  tab: { size: 0.05, padX: 0.032, padY: 0.014, radius: 0.016 },
  seal: { size: 0.2, right: 0.142, top: 0.095 },
} as const;

/** One run of a line: `b` bold (in the ink colour), `u` underlined (a link). */
export type Run = { t: string; b?: boolean; u?: boolean };
/** A row of the paragraph: its runs, its own type size (default EMAIL.para.size), and where it stands in row pitches (default its index). */
export interface Line {
  runs: Run[];
  size?: number;
  at?: number;
}
/**
 * The paragraph's rows, broken by hand (DOM and canvas share them): the link never splits, the
 * punch line has its own row, bold and large, as has the sign-off's "Happy Halloween!".
 */
export const PARAGRAPH: Line[] = [
  { runs: [{ t: 'Our spirits sensed suspicious signals haunting' }], at: 0 },
  { runs: [{ t: 'your account, against our ' }, { t: 'Trick-or-Treat Policy', u: true }, { t: '.' }], at: 0.95 },
  // a paragraph's air either side of the punch line
  { runs: [{ t: 'Your Claude account has been buried.', b: true }], size: 0.054, at: 2.2 },
  { runs: [{ t: 'To appeal, ' }, { t: 'knock three times', u: true }, { t: ' at midnight.' }], at: 3.4 },
  { runs: [{ t: 'Happy Halloween!', b: true }], size: 0.052, at: 4.35 },
];
export const SIGN_OFF = ['Regards', 'The Graveyard Shift'] as const;
/**
 * The read path the cue sheet's hold measures (src/cues.ts WORDS.email.en is this string): the
 * words set at 0.05 of the face's height and up, bold where they are the joke. At the door
 * spread's hold (film frames 918-1006) the face is about 765 px tall, so they stand 38-40 px.
 */
export const READ_PATH = 'Hello, Your Claude account has been buried. Happy Halloween! Appeal';

/**
 * Where things sit on a face `h` px tall (CSS px for the DOM card, canvas px for face B): the
 * words' left edge, the paragraph's row pitch and bottom, the sign-off's rows, and the Appeal
 * tab's top and right edge (its right edge `right` px in from the face's right edge). OverlayV2's
 * bat takes the tab from here: its top is EMAIL.para.top + rows × size × lead + 0.02 (h), its
 * right edge EMAIL.pad (h) in from the face's right, its width about TAB_W (h).
 */
export function emailLayout(h: number) {
  const L = EMAIL;
  const pitch = L.para.size * L.para.lead * h;
  const paraBottom = L.para.top * h + PARAGRAPH.length * pitch;
  const signTop = paraBottom + 0.02 * h;
  return {
    left: L.pad * h,
    pitch,
    paraBottom,
    signTop,
    teamTop: signTop + (1 + L.regards.gap) * pitch,
    tab: { top: signTop, right: L.pad * h },
  };
}
/** The Appeal tab's width (fractions of the face's height), as Inter and Noto Serif SC set it (measured in the Email lookdev). */
export const TAB_W = 0.37;

// ---- the mark ---------------------------------------------------------------------------------

const CORN = ['#fff4d6', '#f19a2a', '#f7c548'] as const;

/** Our own Halloween mark as SVG markup data: eight candy-corn rays round a jack-o'-lantern. */
export function markPaths(): { rays: { d: string; fill: string }[]; face: { d: string; fill: string }[] } {
  const rays: { d: string; fill: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (i % 2 ? 0.12 : -0.05);
    const len = i % 2 ? 44 : 48;
    // a candy corn: three bands from the tip (white) through orange to the yellow base
    const band = (r0: number, r1: number, w0: number, w1: number) => {
      const p = (r: number, w: number) => [50 + Math.cos(a) * r - Math.sin(a) * w, 50 + Math.sin(a) * r + Math.cos(a) * w];
      const [a1, a2, b2, b1] = [p(r0, -w0), p(r0, w0), p(r1, w1), p(r1, -w1)];
      return `M${a1[0].toFixed(1)} ${a1[1].toFixed(1)}L${a2[0].toFixed(1)} ${a2[1].toFixed(1)}L${b2[0].toFixed(1)} ${b2[1].toFixed(1)}L${b1[0].toFixed(1)} ${b1[1].toFixed(1)}Z`;
    };
    const r0 = 22;
    const r3 = len;
    const r1 = r0 + (r3 - r0) * 0.38;
    const r2 = r0 + (r3 - r0) * 0.72;
    rays.push({ d: band(r0, r1, 8.6, 6.6), fill: CORN[2] });
    rays.push({ d: band(r1, r2, 6.6, 3.9), fill: CORN[1] });
    rays.push({ d: band(r2, r3, 3.9, 0.6), fill: CORN[0] });
  }
  const face = [
    { d: 'M50 30 C63 30 72 39 72 51 C72 63 63 71 50 71 C37 71 28 63 28 51 C28 39 37 30 50 30Z', fill: '#e8862e' },
    { d: 'M48 30 C48 25 51 22 55 21 L56 24 C53 25 52 27 52 30Z', fill: '#4a5a2a' },
    { d: 'M37 46 L44 42 L44 50Z M63 46 L56 42 L56 50Z', fill: '#2c1a10' },
    { d: 'M36 56 L41 59 L45 56 L50 60 L55 56 L59 59 L64 56 C61 64 56 67 50 67 C44 67 39 64 36 56Z', fill: '#2c1a10' },
  ];
  return { rays, face };
}

export function Mark({ size }: { size: number }) {
  const { rays, face } = markPaths();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
      {rays.map((r, i) => (
        <path key={`r${i}`} d={r.d} fill={r.fill} />
      ))}
      {face.map((r, i) => (
        <path key={`f${i}`} d={r.d} fill={r.fill} />
      ))}
    </svg>
  );
}

// ---- the 封号 seal: a stamp's ink, as path data both renderings draw ------------------------------

const SEAL_RED = '#c3302a';
const SEAL_RED_EDGE = '#a8241f';
const SEAL_CUT = '#fffaf4';

/** A rounded square's outline with a ragged, pressed edge (viewBox 0..100, the stamp's face). */
function sealOutline(): string {
  const pts: string[] = [];
  const n = 36;
  const r = 3.2;
  // the four sides, each a little bowed and ragged where the ink thinned
  const corners: [number, number, number, number][] = [
    [r, 0, 100 - r, 0],
    [100, r, 100, 100 - r],
    [100 - r, 100, r, 100],
    [0, 100 - r, 0, r],
  ];
  corners.forEach(([x0, y0, x1, y1], s) => {
    const nx = y1 - y0 === 0 ? 0 : x0 === 0 ? 1 : -1;
    const ny = x1 - x0 === 0 ? 0 : y0 === 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const rag = 0.9 * (rand(5150, s, i) - 0.5) + 0.8 * fbm2(t * 9, s * 3.1, 5151, 2) + (rand(5152, s, i) < 0.08 ? 1.6 * rand(5153, s, i) : 0);
      const x = x0 + (x1 - x0) * t + nx * rag;
      const y = y0 + (y1 - y0) * t + ny * rag;
      pts.push(`${pts.length ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`);
    }
  });
  return pts.join('') + 'Z';
}

/** Where the ink did not take: small round specks and a few larger misses toward the edge (viewBox 0..100). */
function sealSpecks(): string {
  const out: string[] = [];
  const dot = (x: number, y: number, rr: number) => out.push(`M${(x - rr).toFixed(2)} ${y.toFixed(2)}a${rr.toFixed(2)} ${rr.toFixed(2)} 0 1 0 ${(2 * rr).toFixed(2)} 0a${rr.toFixed(2)} ${rr.toFixed(2)} 0 1 0 ${(-2 * rr).toFixed(2)} 0Z`);
  for (let i = 0; i < 90; i++) dot(3 + 94 * rand(5160, 'x', i), 3 + 94 * rand(5160, 'y', i), 0.35 + 1.1 * rand(5160, 'r', i) ** 2);
  for (let i = 0; i < 9; i++) {
    const side = Math.floor(rand(5161, 's', i) * 4);
    const t = 8 + 84 * rand(5161, 't', i);
    const d = 2 + 5 * rand(5161, 'd', i);
    const [x, y] = side === 0 ? [t, d] : side === 1 ? [100 - d, t] : side === 2 ? [t, 100 - d] : [d, t];
    dot(x, y, 1.2 + 1.8 * rand(5161, 'r', i));
  }
  return out.join('');
}

/** The cut ring inside the edge (a stroke, viewBox 0..100). */
const SEAL_RING = 'M9 7.5L91 7.5Q92.5 7.5 92.5 9L92.5 91Q92.5 92.5 91 92.5L9 92.5Q7.5 92.5 7.5 91L7.5 9Q7.5 7.5 9 7.5Z';
const SEAL_RING_W = 2.6;

let sealCache: { outline: string; specks: string } | null = null;
function sealPaths() {
  sealCache ??= { outline: sealOutline(), specks: sealSpecks() };
  return sealCache;
}

// ---- the paper: page, card, mark (one canvas drawing for both renderings) --------------------------

/** the slats of the 3D letter (world/Letter2 LETTER2.slats): their joins show in the paper's margin */
const SLATS = 8;

let grainCache: { grain: HTMLCanvasElement; mottle: HTMLCanvasElement } | null = null;
/** The paper's grain (fine) and mottle (soft blotches) as two small canvases, scaled up onto any face size. */
function grains() {
  if (grainCache) return grainCache;
  const g = textCanvas(400, 312);
  const gi = g.g.createImageData(400, 312);
  for (let i = 0; i < 400 * 312; i++) {
    const v = 255 - Math.round(38 * rand(5170, 'g', i) ** 2);
    gi.data[i * 4] = v;
    gi.data[i * 4 + 1] = v;
    gi.data[i * 4 + 2] = Math.min(255, v + 2);
    gi.data[i * 4 + 3] = 255;
  }
  g.g.putImageData(gi, 0, 0);
  const m = textCanvas(80, 62);
  const mi = m.g.createImageData(80, 62);
  for (let y = 0; y < 62; y++) {
    for (let x = 0; x < 80; x++) {
      const k = (y * 80 + x) * 4;
      const n = fbm2(x * 0.11, y * 0.11, 5171, 3);
      const v = 238 + 17 * n;
      mi.data[k] = Math.min(255, v + 2);
      mi.data[k + 1] = Math.min(255, v);
      mi.data[k + 2] = Math.min(255, v - 4);
      mi.data[k + 3] = 255;
    }
  }
  m.g.putImageData(mi, 0, 0);
  grainCache = { grain: g.c, mottle: m.c };
  return grainCache;
}

/** A rounded rectangle path. */
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** The page's deckled outline (the gift's paper, torn by hand): W × H px. */
function deckle(g: CanvasRenderingContext2D, W: number, H: number) {
  const inset = H * 0.0075;
  g.beginPath();
  let first = true;
  const side = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, s: number) => {
    const n = 160;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const d = inset * (0.55 + 0.45 * fbm2(t * 34, s, 5180, 2) + 0.4 * (rand(5181, s, i) - 0.5));
      const x = x0 + (x1 - x0) * t + nx * d;
      const y = y0 + (y1 - y0) * t + ny * d;
      if (first) g.moveTo(x, y);
      else g.lineTo(x, y);
      first = false;
    }
  };
  side(0, 0, W, 0, 0, 1, 1);
  side(W, 0, W, H, -1, 0, 2);
  side(W, H, 0, H, 0, -1, 3);
  side(0, H, 0, 0, 1, 0, 4);
  g.closePath();
}

/**
 * The face's paper at W × H px (no words): the deckled page with its grain, fibres and browned
 * edge, the slat joins in its margin, the white card with its shadow, border and grain, the mark,
 * and the door yard's light across it all. Resolution-free (every size and position in fractions
 * of H), so the DOM card's canvas and face B's 2048-px canvas show the same paper.
 */
export function drawEmailPaper(g: CanvasRenderingContext2D, W: number, H: number): void {
  const L = EMAIL;
  const px = (f: number) => f * H;
  const { grain, mottle } = grains();
  g.save();
  g.clearRect(0, 0, W, H);
  deckle(g, W, H);
  g.save();
  g.clip();
  g.fillStyle = L.page;
  g.fillRect(0, 0, W, H);
  g.imageSmoothingEnabled = true;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(mottle, 0, 0, W, H);
  g.globalAlpha = 0.55;
  g.drawImage(grain, 0, 0, W, H);
  g.globalAlpha = 1;
  // fibres: short curling hairs in the stock, a shade darker or lighter
  g.globalCompositeOperation = 'source-over';
  g.lineWidth = Math.max(0.6, px(0.0011));
  for (let i = 0; i < 420; i++) {
    const x = rand(5190, 'x', i) * W;
    const y = rand(5190, 'y', i) * H;
    const a = rand(5190, 'a', i) * Math.PI * 2;
    const l = px(0.006 + 0.016 * rand(5190, 'l', i));
    g.strokeStyle = rand(5190, 'c', i) < 0.55 ? 'rgba(120,92,52,0.10)' : 'rgba(255,253,244,0.16)';
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + px(0.002), y + Math.sin(a) * l * 0.5 - px(0.0015), x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // the browned edge just inside the deckle
  const e = px(0.03);
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const lg = g.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, 'rgba(128,88,40,0.22)');
    lg.addColorStop(1, 'rgba(128,88,40,0)');
    return lg;
  };
  g.fillStyle = edge(0, 0, 0, e);
  g.fillRect(0, 0, W, e);
  g.fillStyle = edge(0, H, 0, H - e);
  g.fillRect(0, H - e, W, e);
  g.fillStyle = edge(0, 0, e, 0);
  g.fillRect(0, 0, e, H);
  g.fillStyle = edge(W, 0, W - e, 0);
  g.fillRect(W - e, 0, e, H);
  // the slats' joins: hairline creases across the margin only (the card is one printed piece over them)
  const m = px(L.margin);
  for (let k = 1; k < SLATS; k++) {
    const y = (k * H) / SLATS;
    for (const [x0, x1] of [
      [0, m + px(0.004)],
      [W - m - px(0.004), W],
    ]) {
      g.fillStyle = 'rgba(92,66,36,0.34)';
      g.fillRect(x0, y - px(0.0012), x1 - x0, px(0.0016));
      g.fillStyle = 'rgba(255,250,236,0.28)';
      g.fillRect(x0, y + px(0.0006), x1 - x0, px(0.0012));
    }
  }
  // the card: a soft shadow on the page, then the white card with a hairline border
  const cx = m;
  const cy = m;
  const cw = W - 2 * m;
  const ch = H - 2 * m;
  const r = px(L.radius);
  g.save();
  g.shadowColor = 'rgba(70,48,24,0.32)';
  g.shadowBlur = px(0.014);
  g.shadowOffsetY = px(0.005);
  roundRect(g, cx, cy, cw, ch, r);
  g.fillStyle = L.card;
  g.fill();
  g.restore();
  g.save();
  roundRect(g, cx, cy, cw, ch, r);
  g.clip();
  const cg = g.createLinearGradient(cx, cy, cx + cw, cy + ch);
  cg.addColorStop(0, '#fefdfa');
  cg.addColorStop(1, '#f6f3ec');
  g.fillStyle = cg;
  g.fillRect(cx, cy, cw, ch);
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.22;
  g.drawImage(grain, 0, 0, W, H);
  g.globalAlpha = 0.35;
  g.drawImage(mottle, 0, 0, W, H);
  g.restore();
  roundRect(g, cx, cy, cw, ch, r);
  g.lineWidth = Math.max(1, px(0.0026));
  g.strokeStyle = L.border;
  g.stroke();
  // the mark
  const ms = px(L.mark.size);
  const { rays, face } = markPaths();
  g.save();
  g.translate(px(L.pad), px(L.mark.top));
  g.scale(ms / 100, ms / 100);
  for (const p of [...rays, ...face]) {
    g.fillStyle = p.fill;
    g.fill(new Path2D(p.d));
  }
  g.restore();
  // the door yard's light across the face: from the upper left (the lantern), falling off to the lower right
  g.globalCompositeOperation = 'multiply';
  const lg = g.createRadialGradient(W * 0.28, H * 0.22, H * 0.1, W * 0.45, H * 0.4, W * 0.85);
  lg.addColorStop(0, '#ffffff');
  lg.addColorStop(0.6, '#faf8f5');
  lg.addColorStop(1, '#ebe6dd');
  g.fillStyle = lg;
  g.fillRect(0, 0, W, H);
  g.restore();
  g.restore();
}

// ---- the canvas face (face B of the 3D letter) ------------------------------------------------

export interface EmailDraw {
  /** the Appeal tab's offset in px of this canvas; null hides it */
  tab?: { dx: number; dy: number } | null;
  seal?: { scale: number; shake: number } | null;
}

/** How far a line box `box` tall reaches above and below its baseline, in the current font. */
function lineReach(g: CanvasRenderingContext2D, box: number): { above: number; below: number } {
  const m = g.measureText('Hg');
  const asc = m.fontBoundingBoxAscent;
  const desc = m.fontBoundingBoxDescent;
  // CSS centres the font's content area (ascent + descent) in the line box; Chrome gives the
  // ascent's side the half-leading floored to a whole pixel and the descent's side the rest
  const half = Math.floor((box - (asc + desc)) / 2);
  return { above: asc + half, below: box - asc - half };
}

/** The alphabetic baseline of a line whose box starts at `top` and is `box` tall, in the current font (Chrome paints it on a whole pixel). */
function baseline(g: CanvasRenderingContext2D, top: number, box: number): number {
  return Math.round(top + lineReach(g, box).above);
}

/** The seal's ink on its own canvas (sz px square): the red, then its cuts (ring, specks, the two characters) in paper white. */
function sealCanvas(sz0: number, fonts: EmailFonts): HTMLCanvasElement {
  // at twice the size it is drawn at (drawn down: as crisp as the DOM's vector seal)
  const sz = sz0 * 2;
  const s = Math.ceil(sz);
  const { c, g } = textCanvas(s, s);
  const k = s / 100;
  const { outline, specks } = sealPaths();
  g.save();
  g.scale(k, k);
  const rg = g.createRadialGradient(50, 50, 0, 50, 50, 72);
  rg.addColorStop(8 / 72, SEAL_RED);
  rg.addColorStop(1, SEAL_RED_EDGE);
  g.fillStyle = rg;
  g.fill(new Path2D(outline));
  g.fillStyle = SEAL_CUT;
  g.strokeStyle = SEAL_CUT;
  g.lineWidth = SEAL_RING_W;
  g.stroke(new Path2D(SEAL_RING));
  g.fill(new Path2D(specks));
  g.restore();
  // the characters: a centred column of two rows, each lineHeight 1.05 (as the DOM seal sets them)
  const fs = sz * 0.4;
  const rh = fs * 1.05;
  g.font = `900 ${fs}px ${fonts.cjk}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = SEAL_CUT;
  fillTextChecked(g, '封', s / 2, baseline(g, s / 2 - rh, rh));
  fillTextChecked(g, '号', s / 2, baseline(g, s / 2, rh));
  return c;
}

/**
 * The face drawn on a canvas of W × H (H = the face's height, W = H × EMAIL.aspect), line for
 * line as the DOM card lays it out (the CSS line-box model on the alphabetic baseline), so the
 * crossfade from the 3D letter's face to the DOM card lands on the same pixels. Give it a CPU
 * canvas (the kit's textCanvas or textContext) and call it only once the fonts are ready: the text
 * throws while a face is not loaded (fillTextChecked).
 */
export function drawEmailCard(g: CanvasRenderingContext2D, W: number, H: number, fonts: EmailFonts, o: EmailDraw = {}): void {
  const L = EMAIL;
  const px = (f: number) => f * H;
  const lay = emailLayout(H);
  drawEmailPaper(g, W, H);
  g.save();
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  // the name, centred on the mark (the DOM's line box of one em, centred on the mark's height)
  const ms = px(L.mark.size);
  const ns = px(L.name.size);
  g.fillStyle = L.ink;
  g.font = `400 ${ns}px ${fonts.serif}`;
  fillTextChecked(g, 'Clawd', lay.left + ms + px(0.018), baseline(g, px(L.mark.top) + (ms - ns) / 2, ns));
  g.fillStyle = L.body;
  const hs = px(L.hello.size);
  g.font = `400 ${hs}px ${fonts.sans}`;
  fillTextChecked(g, 'Hello,', lay.left, baseline(g, px(L.hello.top), hs * 1.2));
  PARAGRAPH.forEach((line, i) => {
    const ps = px(line.size ?? L.para.size);
    g.font = `400 ${ps}px ${fonts.sans}`;
    const y = baseline(g, px(L.para.top) + (line.at ?? i) * lay.pitch, lay.pitch);
    // runs in the same face are shaped as one text in the DOM (kerning across a span's edge, as
    // "y" + "."): a run starts where the shaped prefix up to its end, minus its own width, ends
    let x = lay.left;
    let groupX = lay.left;
    let prefix = '';
    let face: boolean | null = null;
    for (const r of line.runs) {
      const b = !!r.b;
      if (b !== face) {
        groupX = x;
        prefix = '';
        face = b;
      }
      g.font = `${b ? 700 : 400} ${ps}px ${fonts.sans}`;
      g.fillStyle = b ? L.ink : L.body;
      const w = g.measureText(r.t).width;
      const end = groupX + g.measureText(prefix + r.t).width;
      const x0 = end - w;
      fillTextChecked(g, r.t, x0, y);
      // text-underline-offset is measured from the alphabetic baseline
      if (r.u) g.fillRect(x0, y + px(0.008), w, Math.max(1, px(0.003)));
      prefix += r.t;
      x = end;
    }
  });
  g.fillStyle = L.body;
  const rs = px(L.regards.size);
  g.font = `400 ${rs}px ${fonts.sans}`;
  fillTextChecked(g, SIGN_OFF[0], lay.left, baseline(g, lay.signTop, lay.pitch));
  fillTextChecked(g, SIGN_OFF[1], lay.left, baseline(g, lay.teamTop, lay.pitch));
  if (o.tab) {
    const T = L.tab;
    const fs = px(T.size);
    g.font = `500 ${fs}px ${fonts.sans}`;
    const a = 'Appeal · ';
    const wa = g.measureText(a).width;
    const pw = px(T.padX);
    const ph = px(T.padY);
    const by = lay.tab.top + o.tab.dy;
    // the line box: the sans strut's and the CJK span's boxes together (Noto Serif SC reaches higher)
    const ra = lineReach(g, fs * 1.1);
    g.font = `600 ${fs}px ${fonts.cjk}`;
    const rb = lineReach(g, fs * 1.1);
    const above = Math.max(ra.above, rb.above);
    const ty = Math.round(by + ph + above);
    const wb = g.measureText('申诉').width;
    const bw = wa + wb + 2 * pw;
    const bh = above + Math.max(ra.below, rb.below) + 2 * ph;
    const bx = W - lay.tab.right + o.tab.dx - bw;
    roundRect(g, bx, by, bw, bh, px(T.radius));
    g.fillStyle = L.tabFill;
    g.fill();
    g.fillStyle = L.tabInk;
    g.font = `500 ${fs}px ${fonts.sans}`;
    fillTextChecked(g, a, bx + pw, ty);
    g.font = `600 ${fs}px ${fonts.cjk}`;
    fillTextChecked(g, '申诉', bx + pw + wa, ty);
  }
  if (o.seal) {
    const sz = px(L.seal.size);
    const cx = W - px(L.seal.right) - sz / 2;
    const cy = px(L.seal.top) + o.seal.shake + sz / 2;
    const ink = sealCanvas(sz, fonts);
    g.save();
    g.translate(cx, cy);
    g.rotate((8 * Math.PI) / 180);
    g.scale(o.seal.scale, o.seal.scale);
    g.globalCompositeOperation = 'multiply';
    g.imageSmoothingQuality = 'high';
    g.drawImage(ink, -sz / 2, -sz / 2, sz, sz);
    g.restore();
  }
  g.restore();
}

// ---- the DOM card -----------------------------------------------------------------------------

export interface EmailFonts {
  serif: string;
  sans: string;
  cjk: string;
}

export interface EmailCardProps {
  /** the face's size in CSS px */
  width: number;
  height: number;
  fonts: EmailFonts;
  /** the Appeal tab's offset (px) as the bat carries it off; null hides it */
  tab?: { dx: number; dy: number } | null;
  /** the 封号 seal: null before it lands; scale (1.5 → 1 as it thunks), shake (px) */
  seal?: { scale: number; shake: number } | null;
  style?: CSSProperties;
}

/** The face's paper (drawEmailPaper) as a DOM canvas: drawn when the face's pixel size changes (no text on it). */
function Paper({ w, h }: { w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cw = Math.max(1, Math.round(w));
  const ch = Math.max(1, Math.round(h));
  useLayoutEffect(() => {
    if (ref.current) drawEmailPaper(textContext(ref.current), cw, ch);
  }, [cw, ch]);
  return <canvas ref={ref} width={cw} height={ch} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} />;
}

/** The seal as DOM: the ink's paths (SVG) and its two characters cut white, multiplied into the card. */
function Seal({ size: sz, fonts }: { size: number; fonts: EmailFonts }) {
  const { outline, specks } = sealPaths();
  return (
    <>
      <svg width={sz} height={sz} viewBox="0 0 100 100" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <defs>
          <radialGradient id="aiv-seal-ink" gradientUnits="userSpaceOnUse" cx={50} cy={50} r={72}>
            <stop offset={8 / 72} stopColor={SEAL_RED} />
            <stop offset={1} stopColor={SEAL_RED_EDGE} />
          </radialGradient>
        </defs>
        <path d={outline} fill="url(#aiv-seal-ink)" />
        <path d={SEAL_RING} fill="none" stroke={SEAL_CUT} strokeWidth={SEAL_RING_W} />
        <path d={specks} fill={SEAL_CUT} />
      </svg>
      <div style={{ position: 'absolute', left: 0, top: 0, width: sz, height: sz, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: SEAL_CUT, fontFamily: fonts.cjk, fontSize: sz * 0.4, fontWeight: 900, lineHeight: 1.05 }}>
        <span>封</span>
        <span>号</span>
      </div>
    </>
  );
}

export function EmailCard({ width: w, height: h, fonts, tab = { dx: 0, dy: 0 }, seal = null, style }: EmailCardProps) {
  const L = EMAIL;
  const px = (f: number) => f * h;
  const lay = emailLayout(h);
  const ms = px(L.mark.size);
  const ns = px(L.name.size);
  const T = L.tab;
  const sz = px(L.seal.size);
  return (
    <div style={{ position: 'absolute', width: w, height: h, fontFamily: fonts.sans, color: L.body, overflow: 'visible', ...style }}>
      <Paper w={w} h={h} />
      {/* the words: grayscale antialiasing only (a filtered layer gets no LCD subpixel text), as the canvas face draws them */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, filter: 'grayscale(1)' }}>
        <div style={{ position: 'absolute', left: lay.left + ms + px(0.018), top: px(L.mark.top) + (ms - ns) / 2, fontFamily: fonts.serif, fontSize: ns, color: L.ink, lineHeight: 1, whiteSpace: 'pre' }}>Clawd</div>
        <div style={{ position: 'absolute', left: lay.left, top: px(L.hello.top), fontSize: px(L.hello.size), lineHeight: 1.2, whiteSpace: 'pre' }}>Hello,</div>
        {PARAGRAPH.map((line, i) => (
          <div key={i} style={{ position: 'absolute', left: lay.left, top: px(L.para.top) + (line.at ?? i) * lay.pitch, fontSize: px(line.size ?? L.para.size), lineHeight: `${lay.pitch}px`, whiteSpace: 'pre' }}>
            {line.runs.map((r, k) => (
              <span key={k} style={{ fontWeight: r.b ? 700 : 400, color: r.b ? L.ink : L.body, textDecoration: r.u ? 'underline' : 'none', textDecorationSkipInk: 'none', textUnderlineOffset: px(0.008), textDecorationThickness: Math.max(1, px(0.003)) }}>
                {r.t}
              </span>
            ))}
          </div>
        ))}
        <div style={{ position: 'absolute', left: lay.left, top: lay.signTop, fontSize: px(L.regards.size), lineHeight: `${lay.pitch}px`, whiteSpace: 'pre' }}>{SIGN_OFF[0]}</div>
        <div style={{ position: 'absolute', left: lay.left, top: lay.teamTop, fontSize: px(L.regards.size), lineHeight: `${lay.pitch}px`, whiteSpace: 'pre' }}>{SIGN_OFF[1]}</div>
        {tab && (
          <div style={{ position: 'absolute', right: lay.tab.right - tab.dx, top: lay.tab.top + tab.dy, padding: `${px(T.padY)}px ${px(T.padX)}px`, borderRadius: px(T.radius), background: L.tabFill, color: L.tabInk, fontSize: px(T.size), fontWeight: 500, lineHeight: 1.1, whiteSpace: 'pre' }}>
            Appeal · <span style={{ fontFamily: fonts.cjk, fontWeight: 600 }}>申诉</span>
          </div>
        )}
      </div>
      {seal && (
        <div style={{ position: 'absolute', right: px(L.seal.right), top: px(L.seal.top) + seal.shake, width: sz, height: sz, transform: `rotate(8deg) scale(${seal.scale})`, mixBlendMode: 'multiply' }}>
          <Seal size={sz} fonts={fonts} />
        </div>
      )}
    </div>
  );
}
