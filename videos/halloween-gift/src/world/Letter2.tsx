/**
 * The gift, V2: a pop-up transformation card that rises out of a slot in the door yard on a short
 * folded stalk (V1's LETTER_AT, carried onto the house by fromV1Door; it faces out of the house),
 * 0.86 wide x 0.672 high (EMAIL.aspect 1.28: face B is exactly the email card), made of eight
 * horizontal slats like a Victorian transformation picture, held between two board rails on a
 * bottom bar. On `flip` the slats turn over top to bottom, one after another, quick, each with a
 * little overshoot (on ones), from face A to face B; before the flip they quiver in the silence
 * (bar 24).
 *
 * Face A, lit (the storybook material): an aged storybook card — warm cream paper with fibres,
 * mottling and foxing, browned toward a deckled edge, a printed double rule with corner
 * flourishes and tiny pumpkins, A GIFT FOR YOU (cues.ts WORDS.gift, exact) in IM Fell English,
 * letterpressed on slat 3 (no seam crosses it), a flourish under it, a flat satin ribbon across the
 * seventh slat that runs off both deckled edges, with swallowtail ends under a real red wax seal:
 * a lumpy, glossy wax blob with a deep stamped impression and a pressed pumpkin in relief (also
 * painted into its map as lit from the upper left, so it reads in the house's shadow), on a dark
 * wax bleed, that cracks on 'seal-crack' (`crack` 0..1: it breaks into three pieces that part
 * over the bleed, dark crack lines run out from the stamp and a chip pops off its edge).
 * Face B, unlit (MeshBasic, toneMapped false, no fog): overlay/EmailCard.tsx drawEmailCard on a
 * 2048-px-wide canvas (the Appeal tab drawn; the 封号 seal once `sealed`), drawn once the film's
 * fonts are ready (the stage mounts only then; both faces are CPU canvases, the kit's textCanvas,
 * as a GPU canvas rasters their large glyphs differently from render to render), at FACE_B_GAIN (just under the bloom's threshold, so the ink stays dark), each
 * slat darkened only while it turns.
 *
 * Props: <Letter2 rise={0..1.1} flip={0..1} sealed crack={0..1} f /> (film/beats.ts letterAt);
 * `quiver` overrides the bar-24 quiver; `place` false leaves it at the origin (local frame: the
 * slot's centre on the ground, facing +z). Draw calls: face A, face B, the seal (and the chip
 * while it flies), the rails and stalk, the slot: 5-6. About 13.4k triangles (the seal 9.9k).
 */
import { clamp, progress, rand } from '@aiv/core';
import { fillTextChecked, textCanvas } from '@aiv/remotion-kit';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, CanvasTexture, FrontSide, Matrix4, MeshBasicMaterial, SRGBColorSpace, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { at, WORDS } from '../cues.ts';
import { fbm2 } from '../kit/field.ts';
import { useFilmFonts, type FilmFonts } from '../look/fonts.ts';
import { storybookMaterial } from '../look/materials.ts';
import { canvas } from '../look/paper.ts';
import { drawEmailCard, EMAIL } from '../overlay/EmailCard.tsx';
import { lin, softBox } from './Clawd2.tsx';
import { FLOOR, fromV1Door, LAND } from './layout.ts';
import { surfaceHeight } from './Terrain.tsx';

const TAU = Math.PI * 2;
type V3 = [number, number, number];

/** The card: width, height (face B's aspect is the email card's), the bottom edge's height above the ground, slats, board thickness. */
/**
 * (0.86 wide, its bottom 0.13 up: in the door spread its top edge falls between the left
 * couplet's first two characters, 代 and 码, both on face A's hold and, lifted FLIP_LIFT, on the
 * email's, where face B is about 765 px tall)
 */
export const LETTER2 = { w: 0.86, h: 0.86 / EMAIL.aspect, base: 0.13, slats: 8, thick: 0.004 } as const;
/** how far the card lifts as its slats turn to the email (eased with the flip): face B stands this much higher than face A */
export const FLIP_LIFT = 0.02;
const flipLift = (flip: number) => FLIP_LIFT * smooth(0, 1, flip);
const SH = LETTER2.h / LETTER2.slats;
/** the slot's centre on the ground (V1's LETTER_AT, its floor), and the card's facing (the house's) */
export const LETTER2_AT: V3 = (() => {
  const p = fromV1Door([-0.05, 1.2, -0.15]);
  return [p[0], FLOOR + surfaceHeight(p[0], p[2]), p[2]];
})();
export const LETTER2_YAW = LAND.house.yaw ?? 0;
/** canvas size of both faces (2048 wide: crisp for the crossfade to the DOM card) */
const CW = 2048;
const CH = Math.round(CW / EMAIL.aspect);
/** which slat (from the top) carries the wax seal */
const SEAL_SLAT = 6;
/** which slat carries the title */
const TITLE_SLAT = 3;
const SEAL_R = 0.036;

/** The four corners of face B in the world, risen and flipped (top-left, top-right, bottom-left, bottom-right): for the overlay's crossfade. */
export function letter2Corners(): V3[] {
  // (face B is only ever overlaid once every slat has turned: the card stands FLIP_LIFT higher then)
  const m = new Matrix4().makeRotationY(LETTER2_YAW).setPosition(...LETTER2_AT);
  const { w, h, thick } = LETTER2;
  const base = LETTER2.base + FLIP_LIFT;
  return [
    [-w / 2, base + h],
    [w / 2, base + h],
    [-w / 2, base],
    [w / 2, base],
  ].map(([x, y]) => new Vector3(x, y, thick / 2).applyMatrix4(m).toArray() as V3);
}

// ---- face A: the aged storybook card ----------------------------------------------------------

function deckledPath(g: CanvasRenderingContext2D, W: number, H: number) {
  const inset = W * 0.006;
  const pts: [number, number][] = [];
  const side = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, seed: number) => {
    const n = 220;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const d = inset * (0.55 + 0.45 * fbm2(t * 40, seed, 9, 2) + 0.35 * (rand(9, seed, i) - 0.5));
      pts.push([x0 + (x1 - x0) * t + nx * d, y0 + (y1 - y0) * t + ny * d]);
    }
  };
  side(0, 0, W, 0, 0, 1, 1);
  side(W, 0, W, H, -1, 0, 2);
  side(W, H, 0, H, 0, -1, 3);
  side(0, H, 0, 0, 1, 0, 4);
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

/** Set `font` at the largest size ≤ `px` that fits `text` in maxW. */
function fitFont(g: CanvasRenderingContext2D, text: string, family: string, px: number, maxW: number): number {
  g.font = `${px}px ${family}`;
  const w = g.measureText(text).width;
  const s = w > maxW ? Math.floor((px * maxW) / w) : px;
  g.font = `${s}px ${family}`;
  return s;
}

function drawPumpkinGlyph(g: CanvasRenderingContext2D, x: number, y: number, r: number, ink: string) {
  g.save();
  g.translate(x, y);
  g.fillStyle = ink;
  for (const [dx, rx] of [
    [-0.42, 0.5],
    [0.42, 0.5],
    [0, 0.55],
  ] as const) {
    g.beginPath();
    g.ellipse(dx * r, 0, rx * r, 0.72 * r, 0, 0, TAU);
    g.fill();
  }
  g.fillRect(-0.08 * r, -1.0 * r, 0.16 * r, 0.36 * r);
  g.restore();
}

function drawFaceA(g: CanvasRenderingContext2D, W: number, H: number, fonts: FilmFonts) {
  const R = (id: string, k: number) => rand(2311, id, k);
  g.clearRect(0, 0, W, H);
  g.save();
  deckledPath(g, W, H);
  g.clip();
  // paper: warm cream, browner toward the edge
  const grd = g.createRadialGradient(W * 0.48, H * 0.45, W * 0.1, W * 0.5, H * 0.5, W * 0.62);
  grd.addColorStop(0, '#f3e8c8');
  grd.addColorStop(0.7, '#ead9ad');
  grd.addColorStop(1, '#c9ad78');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // mottling: soft blobs a shade lighter or darker
  for (let i = 0; i < 160; i++) {
    const x = R('mx', i) * W;
    const y = R('my', i) * H;
    const r = (0.02 + 0.07 * R('mr', i)) * W;
    const dark = R('md', i) < 0.6;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, dark ? 'rgba(150,110,60,0.07)' : 'rgba(255,250,232,0.08)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // fibres
  g.lineWidth = 1.2;
  for (let i = 0; i < 1400; i++) {
    const x = R('fx', i) * W;
    const y = R('fy', i) * H;
    const a = R('fa', i) * TAU;
    const l = 6 + 22 * R('fl', i);
    g.strokeStyle = R('fc', i) < 0.5 ? 'rgba(120,90,50,0.10)' : 'rgba(255,252,240,0.14)';
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5 - 2, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // foxing: rust spots, clustered toward the edges and a corner
  for (let i = 0; i < 90; i++) {
    const edgey = R('fe', i);
    let x = R('sx', i) * W;
    let y = R('sy', i) * H;
    if (edgey < 0.55) {
      const s = Math.floor(R('ss', i) * 4);
      if (s === 0) y = R('sy2', i) * H * 0.12;
      else if (s === 1) y = H - R('sy2', i) * H * 0.12;
      else if (s === 2) x = R('sx2', i) * W * 0.09;
      else x = W - R('sx2', i) * W * 0.09;
    }
    const r = 3 + 16 * R('sr', i) ** 2;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.18 + 0.32 * R('sa', i);
    rg.addColorStop(0, `rgba(140,82,38,${a.toFixed(3)})`);
    rg.addColorStop(0.6, `rgba(160,100,50,${(a * 0.5).toFixed(3)})`);
    rg.addColorStop(1, 'rgba(160,100,50,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // a faint tide mark from an old spill, lower left
  g.strokeStyle = 'rgba(150,105,55,0.12)';
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(W * 0.16, H * 0.7, W * 0.07, H * 0.06, 0.4, 0.3, 5.6);
  g.stroke();
  // the browned edge just inside the deckle
  const eg = (x0: number, y0: number, x1: number, y1: number) => {
    const lg = g.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, 'rgba(120,80,35,0.38)');
    lg.addColorStop(1, 'rgba(120,80,35,0)');
    return lg;
  };
  const e = W * 0.035;
  g.fillStyle = eg(0, 0, 0, e);
  g.fillRect(0, 0, W, e);
  g.fillStyle = eg(0, H, 0, H - e);
  g.fillRect(0, H - e, W, e);
  g.fillStyle = eg(0, 0, e, 0);
  g.fillRect(0, 0, e, H);
  g.fillStyle = eg(W, 0, W - e, 0);
  g.fillRect(W - e, 0, e, H);
  // the printed frame: a double rule, corner flourishes and tiny pumpkins
  const ink = '#4b2530';
  g.strokeStyle = ink;
  g.lineWidth = W * 0.0042;
  const m1 = W * 0.045;
  const m2 = W * 0.058;
  g.strokeRect(m1, m1, W - 2 * m1, H - 2 * m1);
  g.lineWidth = W * 0.0018;
  g.strokeRect(m2, m2, W - 2 * m2, H - 2 * m2);
  for (const [cx, cy, sx, sy] of [
    [m2, m2, 1, 1],
    [W - m2, m2, -1, 1],
    [m2, H - m2, 1, -1],
    [W - m2, H - m2, -1, -1],
  ] as const) {
    g.lineWidth = W * 0.0022;
    g.beginPath();
    g.moveTo(cx + sx * W * 0.012, cy + sy * W * 0.075);
    g.bezierCurveTo(cx + sx * W * 0.05, cy + sy * W * 0.06, cx + sx * W * 0.02, cy + sy * W * 0.02, cx + sx * W * 0.07, cy + sy * W * 0.014);
    g.stroke();
    g.beginPath();
    g.arc(cx + sx * W * 0.036, cy + sy * W * 0.036, W * 0.009, 0, TAU);
    g.stroke();
    drawPumpkinGlyph(g, cx + sx * W * 0.036, cy + sy * W * 0.036, W * 0.0055, '#b0541e');
  }
  // the title, letterpressed (the exact cue words), centred on slat 3 (TITLE_SLAT) with its caps
  // inside it: the slats' seams never cross the words, and the title turns as one board
  const title = WORDS.gift.en;
  g.fillStyle = '#3b1a2c';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(W * 0.004)}px`;
  let px = fitFont(g, title, fonts.serif, Math.round(H * 0.19), W * 0.78);
  const cap = g.measureText(title).actualBoundingBoxAscent || px * 0.66;
  if (cap > H * 0.098) px = fitFont(g, title, fonts.serif, Math.floor((px * H * 0.098) / cap), W * 0.78);
  const capH = g.measureText(title).actualBoundingBoxAscent || px * 0.66;
  const titleY = H * ((TITLE_SLAT + 0.5) / LETTER2.slats);
  fillTextChecked(g, title, W / 2, titleY + capH / 2);
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  // uneven ink: a speckle knocked out of the type (keeps the paper showing through, as letterpress does)
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 2600; i++) {
    const x = W * (0.1 + 0.8 * R('ix', i));
    const y = titleY + H * (0.12 * R('iy', i) - 0.06);
    g.fillStyle = `rgba(0,0,0,${(0.08 + 0.25 * R('ia', i)).toFixed(3)})`;
    g.fillRect(x, y, 2 + 3 * R('iw', i), 2 + 2 * R('ih', i));
  }
  g.restore();
  // re-lay the paper under the knocked-out specks
  g.save();
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = '#efe2bf';
  g.fillRect(0, 0, W, H);
  g.restore();
  // a flourish under the title: a rule with curls and a little bat
  g.strokeStyle = ink;
  g.lineWidth = W * 0.0026;
  const fy = H * 0.565;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(W / 2 + s * W * 0.05, fy);
    g.bezierCurveTo(W / 2 + s * W * 0.12, fy - H * 0.02, W / 2 + s * W * 0.18, fy + H * 0.02, W / 2 + s * W * 0.27, fy);
    g.stroke();
    g.beginPath();
    g.arc(W / 2 + s * W * 0.275, fy - H * 0.012, H * 0.012, 0, TAU * 0.8);
    g.stroke();
  }
  g.fillStyle = ink;
  g.beginPath();
  const bx = W / 2;
  const bw = W * 0.034;
  g.moveTo(bx, fy - H * 0.012);
  g.quadraticCurveTo(bx - bw * 0.4, fy - H * 0.03, bx - bw, fy - H * 0.018);
  g.quadraticCurveTo(bx - bw * 0.8, fy, bx - bw * 0.55, fy + H * 0.004);
  g.quadraticCurveTo(bx - bw * 0.3, fy - H * 0.004, bx, fy + H * 0.012);
  g.quadraticCurveTo(bx + bw * 0.3, fy - H * 0.004, bx + bw * 0.55, fy + H * 0.004);
  g.quadraticCurveTo(bx + bw * 0.8, fy, bx + bw, fy - H * 0.018);
  g.quadraticCurveTo(bx + bw * 0.4, fy - H * 0.03, bx, fy - H * 0.012);
  g.fill();
  drawRibbon(g, W, H);
  // the slats' seams: a faint line where each turns
  for (let k = 1; k < LETTER2.slats; k++) {
    const y = (k / LETTER2.slats) * H;
    g.fillStyle = 'rgba(90,60,30,0.28)';
    g.fillRect(0, y - 1.5, W, 3);
    g.fillStyle = 'rgba(255,250,235,0.18)';
    g.fillRect(0, y + 1.5, W, 2);
  }
  g.restore();
}

/**
 * The ribbon across the seal's slat: a flat satin band (one colour, a soft sheen that wanders along
 * it, slightly wavy edges) that runs off both deckled edges where it wraps round onto the back (a
 * fold shadow at each end), two swallowtail ends hanging from under the seal, and the wax's dark
 * bleed on the paper under the seal (its cracks open onto that, not onto the bright ribbon).
 */
function drawRibbon(g: CanvasRenderingContext2D, W: number, H: number) {
  const R = (id: string, k: number) => rand(2312, id, k);
  const ry = H * ((SEAL_SLAT + 0.5) / LETTER2.slats);
  const rh = H * 0.046;
  const edge = (x: number, side: number) => ry + side * rh * 0.5 + H * 0.0022 * Math.sin((x / W) * 9.1 + side * 1.3) + H * 0.0012 * Math.sin((x / W) * 23 + side);
  const N = 120;
  const band = () => {
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * W;
      if (i === 0) g.moveTo(x, edge(x, -1));
      else g.lineTo(x, edge(x, -1));
    }
    for (let i = N; i >= 0; i--) {
      const x = (i / N) * W;
      g.lineTo(x, edge(x, 1));
    }
    g.closePath();
  };
  // the swallowtails first (under the band and the seal): two tails falling from the seal's middle
  const sx = W / 2;
  for (const side of [-1, 1]) {
    const ang = Math.PI / 2 - side * 0.42;
    const len = H * 0.13;
    const tw = H * 0.042;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const nx = -dy;
    const ny = dx;
    const x0 = sx + side * W * 0.008;
    const y0 = ry;
    const x1 = x0 + dx * len;
    const y1 = y0 + dy * len;
    g.beginPath();
    g.moveTo(x0 + (nx * tw) / 2, y0 + (ny * tw) / 2);
    g.quadraticCurveTo(x0 + dx * len * 0.5 + nx * tw * 0.62, y0 + dy * len * 0.5 + ny * tw * 0.62, x1 + (nx * tw) / 2, y1 + (ny * tw) / 2);
    // the V-cut end
    g.lineTo(x1 - dx * tw * 0.55, y1 - dy * tw * 0.55);
    g.lineTo(x1 - (nx * tw) / 2, y1 - (ny * tw) / 2);
    g.quadraticCurveTo(x0 + dx * len * 0.5 - nx * tw * 0.38, y0 + dy * len * 0.5 - ny * tw * 0.38, x0 - (nx * tw) / 2, y0 - (ny * tw) / 2);
    g.closePath();
    const tg = g.createLinearGradient(x0, y0, x1, y1);
    tg.addColorStop(0, '#a9461a');
    tg.addColorStop(0.55, side < 0 ? '#c6612a' : '#b8541f');
    tg.addColorStop(1, '#9c4118');
    g.fillStyle = tg;
    g.fill();
    // a soft sheen down the tail
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(255,196,150,0.16)';
    g.lineWidth = tw * 0.3;
    g.beginPath();
    g.moveTo(x0 + nx * tw * 0.12, y0 + ny * tw * 0.12);
    g.quadraticCurveTo(x0 + dx * len * 0.5 + nx * tw * 0.3, y0 + dy * len * 0.5 + ny * tw * 0.3, x1 + nx * tw * 0.05 - dx * tw * 0.6, y1 + ny * tw * 0.05 - dy * tw * 0.6);
    g.stroke();
    g.restore();
  }
  // the band: flat satin
  band();
  g.fillStyle = '#c8622a';
  g.fill();
  g.save();
  band();
  g.clip();
  // the sheen: a soft lighter stripe a little above the middle, waxing and waning along the band
  for (let i = 0; i < N; i++) {
    const x = (i / N) * W;
    const k = 0.5 + 0.5 * Math.sin((x / W) * 5.3 + 0.8) * Math.sin((x / W) * 2.1 + 2.0);
    const yc = ry - rh * 0.12 + H * 0.0015 * Math.sin((x / W) * 7);
    const sg = g.createLinearGradient(0, yc - rh * 0.4, 0, yc + rh * 0.4);
    sg.addColorStop(0, 'rgba(255,200,150,0)');
    sg.addColorStop(0.5, `rgba(255,200,150,${(0.1 + 0.2 * k).toFixed(3)})`);
    sg.addColorStop(1, 'rgba(255,200,150,0)');
    g.fillStyle = sg;
    g.fillRect(x, yc - rh * 0.4, W / N + 1, rh * 0.8);
  }
  // fine woven grain along it and a faint selvedge line at each edge
  for (let i = 0; i < 260; i++) {
    const x = R('gx', i) * W;
    const y = ry + (R('gy', i) - 0.5) * rh * 0.9;
    g.fillStyle = R('gc', i) < 0.5 ? 'rgba(120,40,10,0.10)' : 'rgba(255,210,170,0.08)';
    g.fillRect(x, y, 10 + 30 * R('gl', i), 1.4);
  }
  g.strokeStyle = 'rgba(110,38,12,0.35)';
  g.lineWidth = 2;
  for (const side of [-1, 1]) {
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * W;
      const y = edge(x, side) - side * 2;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // where it wraps round the card's edges onto the back: a fold shadow at each end
  for (const [x0, x1] of [
    [0, W * 0.022],
    [W, W - W * 0.022],
  ] as const) {
    const fg = g.createLinearGradient(x0, 0, x1, 0);
    fg.addColorStop(0, 'rgba(60,18,6,0.55)');
    fg.addColorStop(1, 'rgba(60,18,6,0)');
    g.fillStyle = fg;
    g.fillRect(Math.min(x0, x1), ry - rh, Math.abs(x1 - x0), rh * 2);
  }
  g.restore();
  // the soft shadow the band lays on the paper just below it
  g.save();
  g.globalCompositeOperation = 'multiply';
  const shg = g.createLinearGradient(0, ry + rh * 0.5, 0, ry + rh * 0.5 + H * 0.01);
  shg.addColorStop(0, 'rgba(120,80,50,0.35)');
  shg.addColorStop(1, 'rgba(120,80,50,0)');
  g.fillStyle = shg;
  g.fillRect(0, ry + rh * 0.5, W, H * 0.01);
  g.restore();
  // the wax's bleed under the seal: dark, lumpy, a little wider than the seal
  const cx = W / 2;
  const rr = (SEAL_R / LETTER2.w) * W * 1.06;
  g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * TAU;
    const r = rr * (1 + 0.05 * Math.sin(3 * a + 1) + 0.03 * Math.sin(7 * a + 2) + 0.04 * fbm2(Math.cos(a) * 2, Math.sin(a) * 2, 78, 2));
    const x = cx + Math.cos(a) * r;
    const y = ry - Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillStyle = '#2a0907';
  g.fill();
}

// ---- the wax seal --------------------------------------------------------------------------------

/** The seal's edge radius at angle φ (a lumpy blob). */
const sealEdge = (phi: number) => SEAL_R * (1 + 0.05 * Math.sin(3 * phi + 1) + 0.03 * Math.sin(7 * phi + 2) + 0.025 * fbm2(Math.cos(phi) * 2, Math.sin(phi) * 2, 77, 2));
/** the chip: the sector it breaks from */
const CHIP = { phi: -0.55, half: 0.38, from: 0.6 };
/** the chip's middle (its geometry is centred there, so it tumbles about itself) */
const CHIP_C: V3 = [Math.cos(CHIP.phi) * SEAL_R * 0.82, Math.sin(CHIP.phi) * SEAL_R * 0.82, 0];
const inChip = (phi: number, rn: number) => rn > CHIP.from && Math.abs(Math.atan2(Math.sin(phi - CHIP.phi), Math.cos(phi - CHIP.phi))) < CHIP.half;

/** The pressed pumpkin's relief (0..1) at seal-local x, y. */
function pumpkinRelief(x: number, y: number): number {
  const s = SEAL_R;
  const ex = x / (0.48 * s);
  const ey = (y + 0.08 * s) / (0.37 * s);
  const body = 1 - Math.hypot(ex, ey);
  let v = Math.min(1, Math.max(0, body * 6));
  // ribs: grooves down the body
  for (const rx of [-0.62, -0.25, 0.25, 0.62]) v *= 1 - 0.55 * Math.exp(-(((ex - rx * Math.sqrt(Math.max(0, 1 - ey * ey))) / 0.08) ** 2));
  // the stem and a leaf
  const stem = Math.max(0, 1 - Math.abs(x + 0.02 * s - (y - 0.3 * s) * 0.3) / (0.055 * s)) * (y > 0.27 * s && y < 0.47 * s ? 1 : 0);
  const lx = (x - 0.12 * s) / (0.11 * s);
  const ly = (y - 0.36 * s) / (0.05 * s);
  const leaf = Math.max(0, 1 - Math.hypot(lx, ly)) * 2;
  return Math.min(1, Math.max(v, stem, leaf));
}

function sealHeight(rho: number, phi: number, chipped: boolean): number {
  const rb = sealEdge(phi);
  const rn = rho / rb;
  if (rn >= 1) return 0;
  let h = 0.0042 * Math.sqrt(Math.max(0, 1 - rn ** 6));
  // the stamp's impression, the wax pushed up round it, the pumpkin in relief inside
  // a deep stamp (the pumpkin survives the painterly filter only in strong relief)
  const imp = 1 - smooth(0.7, 0.77, rho / SEAL_R);
  h -= 0.003 * imp;
  h += 0.0007 * Math.exp(-(((rho / SEAL_R - 0.8) / 0.04) ** 2));
  const x = rho * Math.cos(phi);
  const y = rho * Math.sin(phi);
  h += 0.0029 * imp * pumpkinRelief(x, y);
  if (chipped && inChip(phi, rn)) h = 0.0005;
  return h;
}
function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Where the seal breaks: three pieces between jagged lines running out from its middle. */
const BREAKS = [CHIP.phi - CHIP.half, 1.05, 3.35];
const breakAt = (k: number, rn: number) => BREAKS[k % 3] + (k >= 3 ? TAU : 0) + 0.13 * Math.sin(rn * 8 + 1.7 * (k % 3)) + 0.06 * Math.sin(rn * 21 + (k % 3));

/**
 * The seal in three pieces (each a polar grid over its sector, on the slat's face, +z up off it)
 * that part along the breaks as it cracks: real gaps, which survive the painterly filter where a
 * drawn crack line does not. `pose(crack)` moves the pieces apart (and drops the chip's notch).
 */
class SealRig {
  readonly geometry = new BufferGeometry();
  private readonly base: Float32Array;
  private readonly piece: Uint8Array;
  private readonly chip: Uint8Array;
  private posed = -1;
  constructor() {
    const NR = 30;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const pieceOf: number[] = [];
    const chipOf: number[] = [];
    const z0 = LETTER2.thick / 2 + 0.0002;
    for (let k = 0; k < 3; k++) {
      const start = pos.length / 3;
      const span = breakAt(k + 1 === 3 ? 3 : k + 1, 0.5) - breakAt(k, 0.5);
      const NS = Math.ceil(Math.abs(span) * 26) + 1;
      for (let i = 0; i <= NR; i++) {
        const t = i / NR;
        for (let j = 0; j < NS; j++) {
          const s = j / (NS - 1);
          const rn = 1.02 * t;
          const a0 = breakAt(k, rn);
          const a1 = breakAt(k + 1, rn);
          const phi = a0 + (a1 - a0) * s;
          const rho = sealEdge(phi) * rn;
          const x = rho * Math.cos(phi);
          const y = rho * Math.sin(phi);
          pos.push(x, y, z0 + sealHeight(rho, phi, false));
          uv.push(0.5 + x / (2.2 * SEAL_R), 0.5 + y / (2.2 * SEAL_R));
          pieceOf.push(k);
          chipOf.push(inChip(phi, rn) ? 1 : 0);
        }
      }
      for (let i = 0; i < NR; i++)
        for (let j = 0; j < NS - 1; j++) {
          const a = start + i * NS + j;
          const b = a + 1;
          const c = a + NS;
          const d = c + 1;
          // outward (+z): radius then round
          idx.push(a, c, b, b, c, d);
        }
    }
    this.base = new Float32Array(pos);
    this.piece = Uint8Array.from(pieceOf);
    this.chip = Uint8Array.from(chipOf);
    this.geometry.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    this.geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    this.geometry.setIndex(idx);
    this.pose(0);
  }
  pose(crack: number): void {
    if (crack === this.posed) return;
    this.posed = crack;
    const P = this.geometry.attributes.position as BufferAttribute;
    const a = P.array as Float32Array;
    const e = smooth(0, 1, crack);
    const z0 = LETTER2.thick / 2 + 0.0002;
    const mids = [0, 1, 2].map((k) => (breakAt(k, 0.5) + breakAt(k + 1, 0.5)) / 2);
    for (let i = 0; i < this.piece.length; i++) {
      const k = this.piece[i];
      const rot = (k - 1) * 0.05 * e;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const x = this.base[i * 3];
      const y = this.base[i * 3 + 1];
      a[i * 3] = x * c - y * s + Math.cos(mids[k]) * 0.0026 * e;
      a[i * 3 + 1] = x * s + y * c + Math.sin(mids[k]) * 0.0026 * e;
      a[i * 3 + 2] = this.chip[i] && crack >= 0.3 ? z0 + 0.0005 : this.base[i * 3 + 2];
    }
    P.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
  dispose(): void {
    this.geometry.dispose();
  }
}

/** The seal as a polar grid on the slat's face (+z up off it); `sector` builds only the chip. */
function buildSeal(chipped: boolean, sector = false): BufferGeometry {
  const NR = sector ? 12 : 34;
  const NS = sector ? 24 : 120;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const z0 = LETTER2.thick / 2 + 0.0002;
  const phis = Array.from({ length: NS }, (_, j) => (sector ? CHIP.phi - CHIP.half + (2 * CHIP.half * j) / (NS - 1) : (j / NS) * TAU));
  for (let i = 0; i <= NR; i++) {
    const t = i / NR;
    for (const phi of phis) {
      const rb = sealEdge(phi);
      const rho = sector ? rb * (CHIP.from + (1.02 - CHIP.from) * t) : rb * 1.02 * t;
      const h = sector ? sealHeight(rho, phi, false) : sealHeight(rho, phi, chipped);
      const x = rho * Math.cos(phi);
      const y = rho * Math.sin(phi);
      pos.push(x, y, z0 + h);
      uv.push(0.5 + x / (2.2 * SEAL_R), 0.5 + y / (2.2 * SEAL_R));
    }
  }
  const ns = phis.length;
  const wrap = !sector;
  for (let i = 0; i < NR; i++)
    for (let j = 0; j < (wrap ? ns : ns - 1); j++) {
      const a = i * ns + j;
      const b = i * ns + ((j + 1) % ns);
      const c = a + ns;
      const d = b + ns;
      // outward (+z): from the rim inward is the radius, then round
      idx.push(a, c, b, b, c, d);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (!sector) {
    const N = g.attributes.normal as BufferAttribute;
    for (let j = 0; j < ns; j++) N.setXYZ(j, 0, 0, 1);
  } else g.translate(-CHIP_C[0], -CHIP_C[1], 0);
  return g;
}

/** The seal's colour: deep red wax, marbled, darker at its edge; crack lines run out from the stamp as `crack` goes 0..1. */
function drawSeal(g: CanvasRenderingContext2D, S: number, crack: number) {
  const R = (id: string, k: number) => rand(4242, id, k);
  g.fillStyle = '#c8352c';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    const x = R('x', i) * S;
    const y = R('y', i) * S;
    const r = S * (0.04 + 0.12 * R('r', i));
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, R('d', i) < 0.5 ? 'rgba(60,4,6,0.35)' : 'rgba(210,60,50,0.25)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const eg = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.48);
  eg.addColorStop(0, 'rgba(40,0,2,0)');
  eg.addColorStop(1, 'rgba(40,0,2,0.45)');
  g.fillStyle = eg;
  g.fillRect(0, 0, S, S);
  // the stamp, painted as lit from the upper left (the house's shadow models nothing: a painter's
  // light): the blob's dome, the impression's groove (its upper-left wall in shadow, its lower-right
  // lip catching light), the pressed pumpkin standing up in it (lit edge up-left, shadow down-right,
  // dark rib grooves, a stem and a leaf) and a small hot glint on the dome
  {
    const k = S / 2.2;
    const cx = S / 2;
    const cy = S / 2;
    const dome = g.createRadialGradient(cx - 0.38 * k, cy - 0.4 * k, 0.02 * k, cx, cy, 1.0 * k);
    dome.addColorStop(0, 'rgba(255,140,115,0.42)');
    dome.addColorStop(0.55, 'rgba(230,80,62,0.12)');
    dome.addColorStop(1, 'rgba(60,0,4,0.0)');
    g.fillStyle = dome;
    g.fillRect(0, 0, S, S);
    // the impression's floor, a shade darker than the dome
    g.fillStyle = 'rgba(70,4,8,0.3)';
    g.beginPath();
    g.arc(cx, cy, 0.71 * k, 0, TAU);
    g.fill();
    // the groove: shadowed upper-left wall, lit lower-right lip
    g.lineCap = 'round';
    g.lineWidth = S * 0.03;
    g.strokeStyle = 'rgba(35,0,4,0.75)';
    g.beginPath();
    g.arc(cx, cy, 0.72 * k, Math.PI * 0.75, Math.PI * 1.85);
    g.stroke();
    g.strokeStyle = 'rgba(255,150,125,0.55)';
    g.lineWidth = S * 0.02;
    g.beginPath();
    g.arc(cx, cy, 0.76 * k, -Math.PI * 0.2, Math.PI * 0.7);
    g.stroke();
    // the pumpkin (seal-local y up is canvas up): three lobes, the body centred 0.08 R low
    const pumpkin = (dx: number, dy: number) => {
      g.beginPath();
      for (const [ox, rx] of [
        [-0.45, 0.27],
        [0.45, 0.27],
        [0, 0.3],
      ] as const) {
        g.moveTo(cx + (ox * 0.48 + dx + rx) * k, cy + (0.08 + dy) * k);
        g.ellipse(cx + (ox * 0.48 + dx) * k, cy + (0.08 + dy) * k, rx * k, 0.37 * k, 0, 0, TAU);
      }
    };
    g.fillStyle = 'rgba(40,0,4,0.6)';
    pumpkin(0.035, 0.035);
    g.fill();
    g.fillStyle = 'rgba(255,165,140,0.7)';
    pumpkin(-0.03, -0.03);
    g.fill();
    g.fillStyle = '#d4493a';
    pumpkin(0, 0);
    g.fill();
    // its ribs: dark grooves
    g.strokeStyle = 'rgba(60,2,6,0.8)';
    g.lineWidth = S * 0.011;
    for (const rx of [-0.3, 0.3]) {
      g.beginPath();
      g.ellipse(cx + rx * 0.48 * k, cy + 0.1 * k, 0.11 * k, 0.32 * k, 0, 0, TAU);
      g.stroke();
    }
    // the stem and a leaf, standing up
    g.fillStyle = 'rgba(50,2,6,0.7)';
    g.fillRect(cx - 0.03 * k, cy - 0.47 * k, 0.11 * k, 0.2 * k);
    g.fillStyle = '#e06a52';
    g.fillRect(cx - 0.055 * k, cy - 0.5 * k, 0.1 * k, 0.2 * k);
    g.beginPath();
    g.ellipse(cx + 0.14 * k, cy - 0.38 * k, 0.12 * k, 0.05 * k, -0.4, 0, TAU);
    g.fill();
    // the glint: a soft bloom and a hot core on the dome's upper left
    const gl = g.createRadialGradient(cx - 0.5 * k, cy - 0.52 * k, 0, cx - 0.5 * k, cy - 0.52 * k, 0.16 * k);
    gl.addColorStop(0, 'rgba(255,235,225,0.95)');
    gl.addColorStop(0.35, 'rgba(255,200,185,0.5)');
    gl.addColorStop(1, 'rgba(255,180,160,0)');
    g.fillStyle = gl;
    g.fillRect(cx - 0.7 * k, cy - 0.72 * k, 0.4 * k, 0.4 * k);
  }
  if (crack <= 0) return;
  // the cracks: jagged lines from inside the stamp out to the edge, the chip's own two first
  const lines: [number, number][] = [
    [CHIP.phi - CHIP.half, 0.55],
    [CHIP.phi + CHIP.half, 0.5],
    [2.1, 0.15],
    [3.4, 0.3],
    [1.0, 0.25],
  ];
  lines.forEach(([phi, r0], k) => {
    const len = clamp(crack * 1.6 - k * 0.15, 0, 1);
    if (len <= 0) return;
    const steps = 12;
    const cx = S / 2;
    const cy = S / 2;
    const pts: [number, number][] = [];
    let a = phi;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (t > len) break;
      a += (R('j' + k, i) - 0.5) * 0.35;
      const rr = (r0 + (1.02 - r0) * t) * (S / 2.2) * 1.0;
      pts.push([cx + Math.cos(a) * rr, cy - Math.sin(a) * rr]);
    }
    if (pts.length < 2) return;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(20,0,2,0.95)';
    g.lineWidth = S * 0.02;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.strokeStyle = 'rgba(255,150,130,0.7)';
    g.lineWidth = S * 0.007;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x + 1.5, y + 1.5) : g.moveTo(x + 1.5, y + 1.5)));
    g.stroke();
  });
}

// ---- the slats ----------------------------------------------------------------------------------

/** A slat's turn (0 face A .. π face B) at flip 0..1: top first, quick, a small overshoot that settles. */
export function slatAngle(flip: number, i: number): number {
  const frames = flip * 18;
  const t = clamp((frames - i * 1.55) / 6.6, 0, 1);
  if (t <= 0) return 0;
  const c1 = 1.25;
  const c3 = c1 + 1;
  const x = t - 1;
  return Math.PI * (1 + c3 * x * x * x + c1 * x * x);
}

/** The bar-24 quiver (silence 2): the slats tremble before they turn, 0..1. */
function quiverAt(f: number): number {
  return progress(f, at(24), at(24) + 6, 'inOutSine') * (1 - progress(f, at(25) - 4, at(25, 2), 'inOutSine'));
}

/** Push a quad (two triangles) whose front faces `n`, with its UVs. */
function quad(pos: number[], nrm: number[], uv: number[], p: Vector3[], n: Vector3, t: [number, number][]) {
  const e1 = new Vector3().subVectors(p[1], p[0]);
  const e2 = new Vector3().subVectors(p[2], p[0]);
  const ok = new Vector3().crossVectors(e1, e2).dot(n) >= 0;
  const order = ok ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
  for (const k of order) {
    pos.push(p[k].x, p[k].y, p[k].z);
    nrm.push(n.x, n.y, n.z);
    uv.push(t[k][0], t[k][1]);
  }
}

/** Both faces' geometry for the slats' angles (letter-local, risen): face A (with the slats' paper edges) and face B. */
function slatGeometry(angles: number[], a: BufferGeometry, b: BufferGeometry, turning: boolean) {
  const { w, base, h, thick } = LETTER2;
  const A = { pos: [] as number[], nrm: [] as number[], uv: [] as number[] };
  const B = { pos: [] as number[], nrm: [] as number[], uv: [] as number[] };
  const shade: number[] = [];
  const m = new Matrix4();
  const edgeUV: [number, number][] = [
    [0.5, 0.975],
    [0.5, 0.975],
    [0.5, 0.975],
    [0.5, 0.975],
  ];
  angles.forEach((ang, i) => {
    const cy = base + h - (i + 0.5) * SH;
    m.makeRotationX(ang).setPosition(0, cy, 0);
    const P = (x: number, y: number, z: number) => new Vector3(x, y, z).applyMatrix4(m);
    const N = (x: number, y: number, z: number) => new Vector3(x, y, z).transformDirection(m);
    const v0 = 1 - (i + 1) / LETTER2.slats;
    const v1 = 1 - i / LETTER2.slats;
    const hw = w / 2;
    const hs = SH / 2;
    const hz = thick / 2;
    quad(A.pos, A.nrm, A.uv, [P(-hw, -hs, hz), P(hw, -hs, hz), P(hw, hs, hz), P(-hw, hs, hz)], N(0, 0, 1), [
      [0, v0],
      [1, v0],
      [1, v1],
      [0, v1],
    ]);
    // the board's top and bottom edges (seen as the slat turns)
    quad(A.pos, A.nrm, A.uv, [P(-hw, hs, -hz), P(hw, hs, -hz), P(hw, hs, hz), P(-hw, hs, hz)], N(0, 1, 0), edgeUV);
    quad(A.pos, A.nrm, A.uv, [P(-hw, -hs, -hz), P(hw, -hs, -hz), P(hw, -hs, hz), P(-hw, -hs, hz)], N(0, -1, 0), edgeUV);
    // face B on the back, its band upside down so it stands upright once turned
    quad(B.pos, B.nrm, B.uv, [P(-hw, -hs, -hz), P(hw, -hs, -hz), P(hw, hs, -hz), P(-hw, hs, -hz)], N(0, 0, -1), [
      [0, v1],
      [1, v1],
      [1, v0],
      [0, v0],
    ]);
    // a board turning away from the lens darkens (unlit, it would slide flat white like a sticker); exactly 1 at rest
    const k = turning ? 0.55 + 0.45 * Math.abs(Math.cos(ang)) : 1;
    for (let q = 0; q < 6; q++) shade.push(k, k, k);
  });
  for (const [g, d] of [
    [a, A],
    [b, B],
  ] as const) {
    const write = (name: string, arr: number[], size: number) => {
      const cur = g.attributes[name] as BufferAttribute | undefined;
      if (cur && cur.array.length === arr.length) {
        (cur.array as Float32Array).set(arr);
        cur.needsUpdate = true;
      } else g.setAttribute(name, new BufferAttribute(new Float32Array(arr), size));
    };
    write('position', d.pos, 3);
    write('normal', d.nrm, 3);
    write('uv', d.uv, 2);
    if (d === B) write('color', shade, 3);
    g.computeBoundingSphere();
  }
}

/** The rails, the bottom bar and the folded stalk (letter-local, risen). */
function buildFrame(): BufferGeometry {
  const board = lin('#5a3026');
  const kraft = lin('#9a7a52');
  const { w, h, base } = LETTER2;
  const col = (c: [number, number, number], a = 0.6) => (_p: Vector3, n: Vector3): [number, number, number, number] => {
    const k = 0.75 + 0.25 * Math.max(0, n.y) + 0.1 * n.z;
    return [c[0] * k, c[1] * k, c[2] * k, a];
  };
  const parts: BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const g = softBox({ size: [0.016, h + 0.026, 0.014], r: 0.003, inner: [1, 8, 1], bevel: 2, seed: 600 + s, color: col(board) });
    g.translate(s * (w / 2 + 0.0095), base + h / 2 + 0.002, 0);
    parts.push(g);
  }
  const bar = softBox({ size: [w + 0.05, 0.016, 0.014], r: 0.003, inner: [8, 1, 1], bevel: 2, seed: 610, color: col(board) });
  bar.translate(0, base - 0.0105, 0);
  parts.push(bar);
  // the stalk: a strip of kraft board folded into a V, from under the ground to the bar
  for (const s of [-1, 1]) {
    const g = softBox({ size: [0.03, base + 0.07, 0.0025], r: 0.001, inner: [1, 4, 1], bevel: 1, seed: 620 + s, color: col(kraft, 0.4) });
    g.applyMatrix4(new Matrix4().makeRotationY(s * 0.62).setPosition(s * 0.011, (base - 0.018) / 2 - 0.035, -0.006));
    parts.push(g);
  }
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

/** The slot in the yard the card rises through: a dark slit with a kraft lip (letter-local, on the ground). */
function buildSlot(): BufferGeometry {
  const kraft = lin('#7d6044');
  const parts: BufferGeometry[] = [];
  const W = LETTER2.w + 0.08;
  const D = 0.034;
  const inner = softBox({ size: [W - 0.01, 0.01, D - 0.01], r: 0.002, inner: [4, 1, 1], bevel: 1, seed: 630, color: () => [0.012, 0.01, 0.012, 0.1] });
  inner.translate(0, -0.004, 0);
  parts.push(inner);
  for (const [sx, sz, x, z] of [
    [W, 0.008, 0, D / 2],
    [W, 0.008, 0, -D / 2],
    [0.008, D, W / 2, 0],
    [0.008, D, -W / 2, 0],
  ] as const) {
    const g = softBox({ size: [sx, 0.006, sz], r: 0.002, inner: [3, 1, 1], bevel: 1, seed: 640 + x * 10 + z * 100, color: (_p, n) => [kraft[0] * (0.7 + 0.3 * n.y), kraft[1] * (0.7 + 0.3 * n.y), kraft[2] * (0.7 + 0.3 * n.y), 0.4] });
    g.translate(x, 0.0, z);
    parts.push(g);
  }
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

const CRACK_STEPS = 8;
/**
 * Face B's level (its map × this, linear): the card's white (#fffdf8, luminance 0.98) × 0.8 sits
 * just under NightPost's bloom threshold (0.78, smoothing 0.25), so no glow veils the ink. The DOM
 * card the film crossfades to is drawn at full level: match it (e.g. CSS brightness ≈ 0.89 on the
 * card, measured in the door stills) for the crossfade to land on the same pixels.
 */
export const FACE_B_GAIN = 0.8;
/** face A's faint self-glow (its map as emissive) */
export const A_GLOW = 0.24;

export interface Letter2Props {
  /** 0 below the ground .. 1 standing (up to 1.1 on the spring) */
  rise: number;
  /** 0 face A .. 1 every slat turned to face B */
  flip: number;
  /** the 封号 seal on face B */
  sealed: boolean;
  /** the bat has taken the Appeal tab (face B drawn without it: film/beats.ts letterAt) */
  tabGone?: boolean;
  /** the wax seal cracking, 0..1 */
  crack: number;
  f: number;
  /** the slats' tremble 0..1 (default: the bar-24 silence) */
  quiver?: number;
  /** stand at LETTER2_AT facing out of the house (default true); false: at the origin */
  place?: boolean;
}

export function Letter2({ rise, flip, sealed, tabGone = false, crack, f, quiver, place = true }: Letter2Props) {
  const { fonts, ready } = useFilmFonts();
  const faces = useMemo(() => {
    const a = textCanvas(CW, CH);
    drawFaceA(a.g, CW, CH, fonts);
    const b0 = textCanvas(CW, CH);
    const b1 = textCanvas(CW, CH);
    const b2 = textCanvas(CW, CH);
    drawEmailCard(b0.g, CW, CH, fonts, { tab: { dx: 0, dy: 0 }, seal: null });
    drawEmailCard(b1.g, CW, CH, fonts, { tab: { dx: 0, dy: 0 }, seal: { scale: 1, shake: 0 } });
    // sealed, and the Appeal tab gone with the bat
    drawEmailCard(b2.g, CW, CH, fonts, { tab: null, seal: { scale: 1, shake: 0 } });
    const tex = [a.c, b0.c, b1.c, b2.c].map((c) => {
      const t = new CanvasTexture(c);
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    });
    return { a: tex[0], b: [tex[1], tex[2], tex[3]] };
    // drawn with `ready` true (the stage mounts only then: fillTextChecked throws otherwise)
  }, [fonts, ready]);
  const built = useMemo(() => {
    const a = new BufferGeometry();
    const b = new BufferGeometry();
    const sealCanvas = canvas(256, 256);
    const sealTex = new CanvasTexture(sealCanvas.c);
    sealTex.colorSpace = SRGBColorSpace;
    const seal = new SealRig();
    const chip = buildSeal(false, true);
    const frame = buildFrame();
    const slot = buildSlot();
    // the gift's paper glows faintly (its own map as emissive): the magic in the card, and the only way the cream reads in the house's shadow
    const aMat = storybookMaterial({ kind: 'plain', color: '#ffffff', breakup: 0, rim: 0.35, roughness: 0.88, alphaTest: 0.5, side: FrontSide, emissive: '#ffffff', emissiveIntensity: A_GLOW });
    // face B: unlit, kept just under the bloom's threshold (look/NightPost.tsx: 0.78; at full white
    // the bloom veiled its ink to mid-grey), out of three's fog, shaded per slat only while turning
    const bMat = new MeshBasicMaterial({ toneMapped: false, alphaTest: 0.5, side: FrontSide, fog: false, vertexColors: true });
    bMat.color.setScalar(FACE_B_GAIN);
    // glossy wax: a small hot highlight off the moon and the rim
    const sealMat = storybookMaterial({ kind: 'plain', color: '#ffffff', map: sealTex, breakup: 0, rim: 0.9, roughness: 0.25, emissive: '#ffffff', emissiveMap: sealTex, emissiveIntensity: A_GLOW * 0.9 });
    // (a faint rim only: a bright one drew a hairline round the email card's edge)
    const frameMat = storybookMaterial({ kind: 'wood', color: '#ffffff', breakup: 0.15, scale: 0.05, bump: 0.3, rim: 0.2, vertexColors: true, roughness: 0.9 });
    return { a, b, sealCanvas, sealTex, seal, chip, frame, slot, aMat, bMat, sealMat, frameMat, crackDrawn: -1 };
  }, []);
  useLayoutEffect(
    () => () => {
      built.seal.dispose();
      for (const g of [built.a, built.b, built.chip, built.frame, built.slot]) g.dispose();
      for (const m of [built.aMat, built.bMat, built.sealMat, built.frameMat]) m.dispose();
      built.sealTex.dispose();
    },
    [built],
  );
  useLayoutEffect(() => () => [faces.a, ...faces.b].forEach((t) => t.dispose()), [faces]);
  const q = quiver ?? quiverAt(f);
  const angles = Array.from({ length: LETTER2.slats }, (_, i) => slatAngle(clamp(flip, 0, 1), i) + q * 0.05 * Math.sin(f * 2.3 + i * 1.9) * (1 - clamp(flip * 4, 0, 1)));
  const crackLevel = Math.round(clamp(crack, 0, 1) * CRACK_STEPS) / CRACK_STEPS;
  useLayoutEffect(() => {
    slatGeometry(angles, built.a, built.b, flip > 0.0005 && flip < 0.9995);
    // a map's first assignment recompiles the program; later swaps are only a uniform
    if (built.aMat.map !== faces.a) {
      if (!built.aMat.map) built.aMat.needsUpdate = true;
      built.aMat.map = faces.a;
      built.aMat.emissiveMap = faces.a;
    }
    const bm = faces.b[sealed ? (tabGone ? 2 : 1) : 0];
    if (built.bMat.map !== bm) {
      if (!built.bMat.map) built.bMat.needsUpdate = true;
      built.bMat.map = bm;
    }
    if (built.crackDrawn !== crackLevel) {
      drawSeal(built.sealCanvas.g, 256, crackLevel);
      built.seal.pose(crackLevel);
      built.sealTex.needsUpdate = true;
      built.crackDrawn = crackLevel;
    }
  });
  const r = clamp(rise, 0, 1.2);
  const lift = (r - 1) * (LETTER2.base + LETTER2.h + 0.07);
  const sealY = LETTER2.base + LETTER2.h - (SEAL_SLAT + 0.5) * SH;
  const chipT = clamp((crack - 0.3) / 0.68, 0, 1);
  const chipDir = new Vector3(Math.cos(CHIP.phi), Math.sin(CHIP.phi), 0);
  const body = (
    <>
      <mesh geometry={built.slot} material={built.frameMat} receiveShadow />
      {r > 0.001 && (
        <group position-y={lift + flipLift(clamp(flip, 0, 1))} rotation-x={-0.1 * Math.max(0, r - 1)}>
          <mesh geometry={built.frame} material={built.frameMat} castShadow receiveShadow />
          <mesh geometry={built.a} material={built.aMat} castShadow receiveShadow />
          <mesh geometry={built.b} material={built.bMat} />
          <group position-y={sealY} rotation-x={angles[SEAL_SLAT]}>
            <mesh geometry={built.seal.geometry} material={built.sealMat} castShadow />
            {chipT < 0.98 && (
              <mesh
                geometry={built.chip}
                material={built.sealMat}
                position={[CHIP_C[0] + chipDir.x * 0.03 * chipT, CHIP_C[1] + chipDir.y * 0.03 * chipT - 0.09 * chipT * chipT, 0.02 * chipT]}
                rotation={[chipT * 2.2, chipT * 1.4, chipT * 3.1]}
                visible={crack >= 0.3}
              />
            )}
          </group>
        </group>
      )}
    </>
  );
  if (!place) return body;
  return (
    <group position={LETTER2_AT} rotation-y={LETTER2_YAW}>
      {body}
    </group>
  );
}

/** Triangle counts (for the budget). */
export function letter2Stats(): Record<string, number> {
  const tri = (g: BufferGeometry) => (g.index ? g.index.count : (g.attributes.position as BufferAttribute).count) / 3;
  const seal = new SealRig();
  const n = tri(seal.geometry);
  seal.dispose();
  return { faces: LETTER2.slats * 8, seal: n, chip: tri(buildSeal(false, true)), frame: tri(buildFrame()), slot: tri(buildSlot()) };
}
