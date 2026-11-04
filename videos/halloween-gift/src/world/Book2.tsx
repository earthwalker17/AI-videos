/**
 * The V2 storybook (layout BOOK: 16 × 11, the page block's top at FLOOR = 1.5): a real hardcover
 * lying on the desk, its spine along the back edge, its cover hinged there like a lid. Closed it
 * lies flat on the page block; open (90°) it stands as the world's backdrop, its inside the
 * printed sky (look/SkyPortal useSkyPortal: the same sky the dome shows once the camera is inside
 * the story) framed by the cloth turn-ins and a marbled endpaper; as `immersion` rises the print
 * grows over the frame and its paper fibre fades, so inside the story the cover is the dome's sky.
 *  - boards 0.12 thick with squares (0.12 over the page block on its three open sides), crisp
 *    bevels, worn brass corners on the fore-edge corners of both boards;
 *  - plum bookcloth (kit/book boards, a canvas per face): a fine weave, mottling, rubbed lighter
 *    along the edges, the hinge groove, grime at the spine; the title debossed and gold-foiled
 *    (WORDS.title in IM Fell English and Noto Serif SC, look/fonts) in a ruled and ornamented
 *    border, the foil rubbed off here and there (metal and roughness in the ORM canvas, so it
 *    glints in the window's light);
 *  - the rounded spine with raised bands, headbands at the head and the tail;
 *  - the page block's open edges: about a hundred aged leaves in signatures, their lines
 *    wandering a little, darker gaps between signatures, a few leaves standing proud, foxing,
 *    dust toward the corners, the fore-edge concave; the first page the Terrain's paper margin;
 *  - a ribbon bookmark hanging out of the fore-edge onto the desk; a cyan glow in the crack when
 *    the cover only lifts a little (the world inside, before it bursts open).
 * The room's light (world/Desk2 roomMaterial: the window's moonlight, the candles) falls on all
 * of it but the first page (the world's terrain beside it takes no room light either).
 */
import { useLayoutEffect, useMemo } from 'react';
import { AdditiveBlending, BufferGeometry, CanvasTexture, Color, DoubleSide, LinearSRGBColorSpace, Matrix4, MeshDepthMaterial, PlaneGeometry, ShaderMaterial, Shape, ShapeGeometry, SRGBColorSpace, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORDS } from '../cues.ts';
import { boardGeometry, cornerGeometry, pageBlockGeometry, ribbonGeometry, spineGeometry, tubeAlong, type V3 } from '../kit/book.ts';
import { fbm2 } from '../kit/field.ts';
import { Curve, type P3 } from '../kit/spline.ts';
import { useFilmFonts, type FilmFonts } from '../look/fonts.ts';
import { NOISE3_GLSL } from '../look/glsl.ts';
import { NIGHT } from '../look/materials.ts';
import { canvas, seq } from '../look/paper.ts';
import { useSkyPortal } from '../look/SkyPortal.tsx';
import { ROOM, roomMaterial } from './Desk2.tsx';
import { BOOK, FLOOR } from './layout.ts';

const TAU = Math.PI * 2;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The boards' thickness and the squares (how far they stand over the page block). */
export const BOARD_T = 0.12;
export const SQUARE = 0.12;
const HW = BOOK.w / 2;
const HD = BOOK.d / 2;
/** the page block: x, z (spine side .. fore-edge), y (on the back board .. the first page) */
export const PAGES = { x0: -HW + SQUARE, x1: HW - SQUARE, z0: -HD + 0.08, z1: HD - SQUARE, y0: BOARD_T, y1: FLOOR - 0.003 } as const;
/** the closed book's top (the cover's outside) */
export const BOOK_TOP = FLOOR + BOARD_T;

/** The fore-edge's concavity and the crack the cover lifts for the bats (bar 3). */
const CONCAVE = 0.055;
const CRACK_DEG = 3.2;

/**
 * Where the closed book's cover lifts a crack and the bats squeeze out (bar 3): the middle of the
 * fore-edge in the gap under the lifted cover, the way out of it (forward and up), and the crack
 * (degrees, and as a `cover` value for Book2).
 */
export const BOOK_EDGE = {
  origin: [0.3, FLOOR + 0.27, HD - 0.02] as [number, number, number],
  dir: [0.12, 0.36, 0.92] as [number, number, number],
  crackDeg: CRACK_DEG,
  crack: CRACK_DEG / 90,
  /** the slit's half length along the fore-edge (BatBurst `gap`) */
  gap: 4.2,
} as const;

const PROUD = [
  { v: 0.64, u0: 0.4, u1: 0.53, out: 0.032 },
  { v: 0.33, u0: 0.6, u1: 0.665, out: 0.024 },
  { v: 0.86, u0: 0.31, u1: 0.35, out: 0.02 },
  { v: 0.5, u0: 0.1, u1: 0.18, out: 0.018 },
  { v: 0.21, u0: 0.47, u1: 0.5, out: 0.018 },
];
const SIGNATURES = 14;
const LEAVES = SIGNATURES * 8;

// ---- low-resolution noise fields, sampled bilinearly ------------------------------------------------

function noiseField(w: number, h: number, seed: number, freq: number, oct = 4): (u: number, v: number) => number {
  const a = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) a[j * w + i] = fbm2(i * freq, j * freq, seed, oct);
  return (u, v) => {
    const x = Math.min(w - 1.001, Math.max(0, u * (w - 1)));
    const y = Math.min(h - 1.001, Math.max(0, v * (h - 1)));
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const k = j * w + i;
    return (a[k] * (1 - fx) + a[k + 1] * fx) * (1 - fy) + (a[k + w] * (1 - fx) + a[k + w + 1] * fx) * fy;
  };
}

// ---- the cover's outside: cloth, foil, wear --------------------------------------------------------

/** The foil artwork (white on black): rules, corner ornaments, the panel, the emblem, the titles. */
function drawFoil(m: CanvasRenderingContext2D, W: number, H: number, fonts: FilmFonts) {
  const U = W / BOOK.w;
  const r = seq(81, 'foil');
  m.fillStyle = '#000';
  m.fillRect(0, 0, W, H);
  m.fillStyle = '#fff';
  m.strokeStyle = '#fff';
  m.lineCap = 'round';
  m.lineJoin = 'round';
  // the double rule with a row of dots between
  const o1 = 0.5 * U;
  const o2 = 0.7 * U;
  m.lineWidth = 0.055 * U;
  m.strokeRect(o1, o1, W - 2 * o1, H - 2 * o1);
  m.lineWidth = 0.02 * U;
  m.strokeRect(o2, o2, W - 2 * o2, H - 2 * o2);
  const om = (o1 + o2) / 2;
  const dot = (x: number, y: number, rr: number) => {
    m.beginPath();
    m.arc(x, y, rr, 0, TAU);
    m.fill();
  };
  for (let x = o2 + 0.3 * U; x < W - o2 - 0.2 * U; x += 0.32 * U) {
    dot(x, om, 0.022 * U);
    dot(x, H - om, 0.022 * U);
  }
  for (let y = o2 + 0.3 * U; y < H - o2 - 0.2 * U; y += 0.32 * U) {
    dot(om, y, 0.022 * U);
    dot(W - om, y, 0.022 * U);
  }
  // corner ornaments: a spiral curl, two leaves and a small star in each inner corner
  const curl = (cx: number, cy: number, sx: number, sy: number) => {
    m.lineWidth = 0.028 * U;
    m.beginPath();
    for (let t = 0; t <= 3.2 * Math.PI; t += 0.08) {
      const rr = 0.42 * U * (1 - t / (3.6 * Math.PI));
      const x = cx + sx * (0.45 * U + Math.cos(t + Math.PI) * rr);
      const y = cy + sy * (0.45 * U + Math.sin(t + Math.PI) * rr);
      if (t === 0) m.moveTo(x, y);
      else m.lineTo(x, y);
    }
    m.stroke();
    // a sweep along each rule from the curl
    m.lineWidth = 0.02 * U;
    m.beginPath();
    m.moveTo(cx + sx * 0.9 * U, cy + sy * 0.1 * U);
    m.quadraticCurveTo(cx + sx * 1.6 * U, cy + sy * 0.12 * U, cx + sx * 2.1 * U, cy + sy * 0.4 * U);
    m.moveTo(cx + sx * 0.1 * U, cy + sy * 0.9 * U);
    m.quadraticCurveTo(cx + sx * 0.12 * U, cy + sy * 1.6 * U, cx + sx * 0.4 * U, cy + sy * 2.1 * U);
    m.stroke();
    // leaves
    for (const [lx, ly, a] of [
      [2.15, 0.45, 0.6],
      [0.45, 2.15, 1.0],
    ]) {
      m.save();
      m.translate(cx + sx * lx * U, cy + sy * ly * U);
      m.rotate(sx * sy * a);
      m.beginPath();
      m.ellipse(0, 0, 0.16 * U, 0.06 * U, 0, 0, TAU);
      m.fill();
      m.restore();
    }
    star(cx + sx * 0.95 * U, cy + sy * 0.95 * U, 0.09 * U);
  };
  const star = (x: number, y: number, rr: number) => {
    m.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI) / 5 - Math.PI / 2;
      const q = k % 2 ? rr * 0.42 : rr;
      m.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
    }
    m.closePath();
    m.fill();
  };
  const c0 = o2 + 0.12 * U;
  curl(c0, c0, 1, 1);
  curl(W - c0, c0, -1, 1);
  curl(c0, H - c0, 1, -1);
  curl(W - c0, H - c0, -1, -1);
  // the title panel: a rounded panel with notched corners round the titles
  const px0 = W * 0.17;
  const px1 = W * 0.83;
  const py0 = H * 0.3;
  const py1 = H * 0.8;
  const notch = 0.42 * U;
  const panel = (inset: number) => {
    m.beginPath();
    m.moveTo(px0 + notch + inset, py0 + inset);
    m.lineTo(px1 - notch - inset, py0 + inset);
    m.arc(px1, py0, notch + inset, Math.PI, Math.PI / 2, true);
    m.lineTo(px1 - inset, py1 - notch - inset);
    m.arc(px1, py1, notch + inset, -Math.PI / 2, Math.PI, true);
    m.lineTo(px0 + notch + inset, py1 - inset);
    m.arc(px0, py1, notch + inset, 0, -Math.PI / 2, true);
    m.lineTo(px0 + inset, py0 + notch + inset);
    m.arc(px0, py0, notch + inset, Math.PI / 2, 0, true);
    m.closePath();
    m.stroke();
  };
  m.lineWidth = 0.035 * U;
  panel(0);
  m.lineWidth = 0.014 * U;
  panel(0.12 * U);
  // the emblem over the panel: a crescent moon, a bat across it, stars
  const mx = W / 2;
  const my = H * 0.17;
  const mr = 0.62 * U;
  m.beginPath();
  m.arc(mx, my, mr, 0, TAU);
  m.fill();
  m.globalCompositeOperation = 'destination-out';
  m.beginPath();
  m.arc(mx + mr * 0.42, my - mr * 0.18, mr * 0.88, 0, TAU);
  m.fill();
  m.globalCompositeOperation = 'source-over';
  const bat = (x: number, y: number, s: number, a: number) => {
    m.save();
    m.translate(x, y);
    m.rotate(a);
    m.scale(s, s);
    m.beginPath();
    m.moveTo(0, -0.12);
    m.quadraticCurveTo(0.25, -0.35, 0.62, -0.28);
    m.quadraticCurveTo(0.95, -0.25, 1.0, 0.02);
    m.quadraticCurveTo(0.82, -0.02, 0.74, 0.12);
    m.quadraticCurveTo(0.62, 0.0, 0.5, 0.14);
    m.quadraticCurveTo(0.38, 0.04, 0.22, 0.16);
    m.quadraticCurveTo(0.12, 0.08, 0, 0.2);
    m.quadraticCurveTo(-0.12, 0.08, -0.22, 0.16);
    m.quadraticCurveTo(-0.38, 0.04, -0.5, 0.14);
    m.quadraticCurveTo(-0.62, 0.0, -0.74, 0.12);
    m.quadraticCurveTo(-0.82, -0.02, -1.0, 0.02);
    m.quadraticCurveTo(-0.95, -0.25, -0.62, -0.28);
    m.quadraticCurveTo(-0.25, -0.35, 0, -0.12);
    m.fill();
    m.beginPath();
    m.ellipse(0, -0.05, 0.1, 0.17, 0, 0, TAU);
    m.fill();
    m.restore();
  };
  bat(mx + mr * 1.35, my + mr * 0.15, 0.36 * U, -0.18);
  bat(mx - mr * 1.9, my + mr * 0.55, 0.22 * U, 0.2);
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI + (k / 8) * Math.PI + (r() - 0.5) * 0.2;
    const d = mr * (2.4 + r() * 1.3);
    star(mx + Math.cos(a) * d * 1.6, my + Math.sin(a) * d * 0.55 + mr * 0.6, (0.05 + r() * 0.06) * U);
  }
  // the titles (WORDS.title exactly)
  m.textAlign = 'center';
  m.textBaseline = 'alphabetic';
  let size = Math.round(H * 0.13);
  m.font = `${size}px ${fonts.serif}`;
  const tw = m.measureText(WORDS.title.en).width;
  const maxW = (px1 - px0) * 0.86;
  if (tw > maxW) {
    size = Math.floor((size * maxW) / tw);
    m.font = `${size}px ${fonts.serif}`;
  }
  m.fillText(WORDS.title.en, W / 2, H * 0.535);
  // the rule between them: a line each side of a diamond, with curls
  const ry = H * 0.585;
  m.lineWidth = 0.02 * U;
  m.beginPath();
  m.moveTo(W / 2 - 2.6 * U, ry);
  m.lineTo(W / 2 - 0.3 * U, ry);
  m.moveTo(W / 2 + 0.3 * U, ry);
  m.lineTo(W / 2 + 2.6 * U, ry);
  m.stroke();
  m.beginPath();
  m.moveTo(W / 2, ry - 0.11 * U);
  m.lineTo(W / 2 + 0.14 * U, ry);
  m.lineTo(W / 2, ry + 0.11 * U);
  m.lineTo(W / 2 - 0.14 * U, ry);
  m.closePath();
  m.fill();
  for (const s of [-1, 1]) {
    m.beginPath();
    m.arc(W / 2 + s * 2.75 * U, ry - 0.08 * U, 0.12 * U, Math.PI / 2, Math.PI / 2 + s * 1.6 * Math.PI, s < 0);
    m.stroke();
  }
  m.font = `600 ${Math.round(H * 0.082)}px ${fonts.cjk}`;
  (m as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(H * 0.022)}px`;
  m.fillText(WORDS.title['zh-Hans'], W / 2 + H * 0.011, H * 0.75);
  (m as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  // a small jack-o'-lantern under the panel
  const jx = W / 2;
  const jy = H * 0.885;
  const jr = 0.36 * U;
  m.beginPath();
  m.ellipse(jx, jy, jr * 1.25, jr, 0, 0, TAU);
  m.fill();
  m.fillRect(jx - 0.04 * U, jy - jr - 0.14 * U, 0.08 * U, 0.18 * U);
  m.globalCompositeOperation = 'destination-out';
  for (const s of [-1, 1]) {
    m.beginPath();
    m.moveTo(jx + s * jr * 0.55, jy - jr * 0.35);
    m.lineTo(jx + s * jr * 0.2, jy - jr * 0.05);
    m.lineTo(jx + s * jr * 0.62, jy + jr * 0.05);
    m.closePath();
    m.fill();
  }
  m.beginPath();
  m.moveTo(jx - jr * 0.7, jy + jr * 0.22);
  for (let k = 0; k <= 6; k++) m.lineTo(jx - jr * 0.7 + (k * jr * 1.4) / 6, jy + jr * (k % 2 ? 0.45 : 0.3));
  m.lineTo(jx + jr * 0.7, jy + jr * 0.22);
  m.quadraticCurveTo(jx, jy + jr * 0.85, jx - jr * 0.7, jy + jr * 0.22);
  m.fill();
  m.globalCompositeOperation = 'source-over';
  for (const s of [-1, 1]) bat(jx + s * 1.9 * U, jy - 0.05 * U, 0.2 * U, s * 0.15);
}

interface Art {
  map: CanvasTexture;
  orm: CanvasTexture;
}

/** The cover's outside (colour, and ORM: R height, G roughness, B metal); canvas top = the spine. */
function coverArt(fonts: FilmFonts): Art {
  const W = 3072;
  const H = 2112;
  const U = W / BOOK.w;
  const { c: mc, g: m } = canvas(W, H);
  drawFoil(m, W, H, fonts);
  const { c: bc, g: b } = canvas(W, H);
  b.filter = `blur(${Math.round(0.018 * U)}px)`;
  b.drawImage(mc, 0, 0);
  b.filter = 'none';
  const mask = m.getImageData(0, 0, W, H).data;
  const blur = b.getImageData(0, 0, W, H).data;
  const mottle = noiseField(260, 180, 82, 0.09, 4);
  const patch = noiseField(260, 180, 83, 0.045, 3);
  const fwear = noiseField(520, 360, 84, 0.06, 4);
  const fine = noiseField(520, 360, 85, 0.35, 2);
  const { c, g } = canvas(W, H);
  const { c: oc, g: o } = canvas(W, H);
  const img = g.createImageData(W, H);
  const orm = o.createImageData(W, H);
  const D = img.data;
  const O = orm.data;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const z = -HD + v * BOOK.d;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const wx = -HW + u * BOOK.w;
      const k = (y * W + x) * 4;
      const mv = mask[k] / 255;
      const bv = blur[k] / 255;
      // the cloth: plum, mottled, rubbed lighter to the edges and the corners, grime by the spine
      const edge = Math.min(HW - Math.abs(wx), HD - Math.abs(z));
      const corner = Math.hypot(Math.max(0, Math.abs(wx) - (HW - 1.2)), Math.max(0, Math.abs(z) - (HD - 1.2)));
      const rub = Math.min(1, Math.exp(-edge / 0.07) * 0.9 + 0.5 * smooth(0.6, 1.5, corner) * (0.5 + 0.5 * patch(u, v)) + 0.25 * smooth(0.2, 0.6, patch(u, v)) * Math.exp(-edge / 0.5));
      const mo = mottle(u, v);
      const wv = (x >> 1) % 2 === (y >> 1) % 2 ? 1 : -1;
      const grime = (1 - smooth(-HD, -HD + 0.6, z)) * 0.35;
      // the hinge groove a little in from the spine edge
      const gz = z - (-HD + 0.42);
      const groove = Math.exp(-((gz / 0.025) ** 2));
      const ridge = Math.exp(-(((gz - 0.06) / 0.03) ** 2));
      let R = 72 + 10 * mo + 3 * wv;
      let G = 31 + 6 * mo + 2 * wv;
      let B = 46 + 8 * mo + 3 * wv;
      R += (128 - R) * rub * 0.75;
      G += (86 - G) * rub * 0.75;
      B += (96 - B) * rub * 0.75;
      const dk = (1 - grime) * (1 - 0.45 * groove) * (1 + 0.18 * ridge);
      R *= dk;
      G *= dk;
      B *= dk;
      // the foil: gold in the debossed ground, its walls darker, rubbed off where worn
      const worn = smooth(0.34, 0.58, fwear(u, v) + 0.25 * fine(u, v) + 0.4 * rub);
      const foil = mv * (1 - worn);
      const wall = Math.max(0, bv - mv) + Math.max(0, mv - bv);
      const sparkle = 0.9 + 0.1 * fine(u * 3, v * 3);
      const fr = 224 * sparkle * (1 - 0.3 * wall);
      const fg = 184 * sparkle * (1 - 0.32 * wall);
      const fb = 84 * sparkle * (1 - 0.4 * wall);
      // a worn deboss shows the cloth, pressed darker
      const pressed = 1 - 0.28 * bv;
      D[k] = Math.max(0, Math.min(255, R * pressed * (1 - foil) + fr * foil));
      D[k + 1] = Math.max(0, Math.min(255, G * pressed * (1 - foil) + fg * foil));
      D[k + 2] = Math.max(0, Math.min(255, B * pressed * (1 - foil) + fb * foil));
      D[k + 3] = 255;
      const h = 0.62 + 0.012 * wv + 0.03 * mo - 0.2 * bv - 0.06 * groove + 0.03 * ridge;
      O[k] = Math.max(0, Math.min(255, h * 255));
      O[k + 1] = Math.max(0, Math.min(255, (0.88 - 0.14 * rub) * (1 - foil) * 255 + (0.26 + 0.14 * fine(u * 2, v * 2)) * foil * 255));
      O[k + 2] = Math.max(0, Math.min(255, foil * 255));
      O[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  o.putImageData(orm, 0, 0);
  bc.width = 1;
  mc.width = 1;
  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  const ormT = new CanvasTexture(oc);
  ormT.colorSpace = LinearSRGBColorSpace;
  ormT.anisotropy = 8;
  return { map, orm: ormT };
}

// ---- the cover's inside: turn-ins and a marbled endpaper round the sky's plate ----------------------

/** the sky plate's size on the cover's inside, and the turn-ins' width */
const PLATE = { w: 14.3, d: 9.3 } as const;
const TURN_IN = 0.34;

function endpaperArt(): CanvasTexture {
  const W = 1600;
  const H = 1100;
  const U = W / BOOK.w;
  const { c, g } = canvas(W, H);
  const img = g.createImageData(W, H);
  const D = img.data;
  const mottle = noiseField(200, 140, 86, 0.08, 4);
  // marbling: a stone pattern combed into waves (domain-warped bands), veins between them
  const pal: [number, number, number][] = [
    [22, 26, 40],
    [30, 64, 74],
    [70, 34, 62],
    [24, 34, 52],
    [88, 30, 40],
    [36, 52, 66],
  ];
  const hx = (W - (PLATE.w / BOOK.w) * W) / 2;
  const hy = (H - (PLATE.d / BOOK.d) * H) / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4;
      const ex = Math.min(x, W - 1 - x) / U;
      const ey = Math.min(y, H - 1 - y) / U;
      const e = Math.min(ex, ey);
      let R: number;
      let G: number;
      let B: number;
      if (x > hx - 2 && x < W - hx + 2 && y > hy - 2 && y < H - hy + 2) {
        // under the plate (hidden)
        R = 20;
        G = 24;
        B = 34;
      } else if (e < TURN_IN) {
        // the turn-in: plum cloth, rubbed toward the board's edge
        const mo = mottle(x / W, y / H);
        const rub = Math.exp(-e / 0.06);
        R = 60 + 10 * mo + 50 * rub;
        G = 34 + 6 * mo + 44 * rub;
        B = 54 + 9 * mo + 44 * rub;
        // the endpaper's edge casts a thin shadow on it
        const sh = Math.exp(-((TURN_IN - e) / 0.02));
        R *= 1 - 0.5 * sh;
        G *= 1 - 0.5 * sh;
        B *= 1 - 0.5 * sh;
      } else {
        const px = x / U;
        const py = y / U;
        const wy = py + 0.35 * Math.sin(px * 2.2 + 1.3 * fbm2(px * 0.6, py * 0.6, 87));
        const wx = px + 0.5 * fbm2(px * 0.9, wy * 0.9, 88, 3);
        const val = fbm2(wx * 0.85, wy * 1.6, 89, 4) * 2.2 + 0.25 * Math.sin(wx * 9 + wy * 2);
        const t = (val * 3.5 + 20) % pal.length;
        const i = Math.floor(t);
        const f = t - i;
        const a = pal[i];
        const bcol = pal[(i + 1) % pal.length];
        const m = smooth(0.75, 1.0, f);
        R = a[0] + (bcol[0] - a[0]) * m;
        G = a[1] + (bcol[1] - a[1]) * m;
        B = a[2] + (bcol[2] - a[2]) * m;
        // veins: gold and pale where the bands meet
        const vein = Math.exp(-(((f - 0.97) / 0.025) ** 2)) + Math.exp(-((f / 0.02) ** 2));
        const gold = (i % 2) === 0;
        R += vein * (gold ? 120 : 150);
        G += vein * (gold ? 90 : 140);
        B += vein * (gold ? 40 : 115);
        // the printed frame round the plate: a pale line and a dark one
        const dx = Math.max(hx - x, x - (W - hx));
        const dy = Math.max(hy - y, y - (H - hy));
        const d = Math.max(dx, dy) / U;
        const line = Math.exp(-(((d - 0.07) / 0.012) ** 2));
        const dark = Math.exp(-(((d - 0.025) / 0.015) ** 2));
        R = R * (1 - 0.8 * dark) + line * (190 - R);
        G = G * (1 - 0.8 * dark) + line * (166 - G);
        B = B * (1 - 0.8 * dark) + line * (112 - B);
      }
      D[k] = Math.max(0, Math.min(255, R));
      D[k + 1] = Math.max(0, Math.min(255, G));
      D[k + 2] = Math.max(0, Math.min(255, B));
      D[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---- the page block's edges: leaves in signatures ---------------------------------------------------

/** The leaves' edges (colour) and their relief (bump), u round the perimeter, canvas top = the first page. */
function edgeArt(corners: [number, number]): { map: CanvasTexture; bump: CanvasTexture } {
  const W = 4096;
  const H = 1024;
  const r = seq(91, 'leaves');
  const { c, g } = canvas(W, H);
  const { c: bc, g: b } = canvas(W, H / 2);
  const BH = H / 2;
  g.fillStyle = '#2a2016';
  g.fillRect(0, 0, W, H);
  b.fillStyle = '#202020';
  b.fillRect(0, 0, W, BH);
  // the leaves' boundaries (fraction of the height from the top), signatures a little uneven
  const bounds: number[] = [0];
  for (let i = 1; i < LEAVES; i++) bounds.push(i / LEAVES + (r() - 0.5) * 0.3 / LEAVES);
  bounds.push(1);
  const wave = (k: number, x: number) => (0.22 / LEAVES) * Math.sin(x * 0.0021 + k * 1.7) + (0.35 / LEAVES) * fbm2(x * 0.0018, k * 0.37, 92, 3);
  const STEP = 32;
  // leaves gather in clumps of two to five (a darker parting between clumps, each clump its own tone):
  // the layering still reads where single leaves are under a pixel
  const clumpTone: number[] = [];
  const parting: boolean[] = [];
  {
    let left = 0;
    let tone = 1;
    for (let k = 0; k < LEAVES; k++) {
      if (left <= 0) {
        left = 2 + Math.floor(r() * 4);
        tone = 0.9 + 0.16 * r();
        parting.push(k > 0);
      } else parting.push(false);
      clumpTone.push(tone);
      left--;
    }
  }
  for (let k = 0; k < LEAVES; k++) {
    const outer = Math.min(k, LEAVES - 1 - k) / LEAVES;
    // aged: browner toward the outer leaves; each leaf its own paper
    const age = 1 - smooth(0.0, 0.18, outer);
    const base = (0.95 + 0.07 * r()) * clumpTone[k];
    const R = (214 - 26 * age) * base;
    const G = (198 - 34 * age) * base;
    const B = (160 - 42 * age) * base;
    const proud = PROUD.find((p) => Math.abs(1 - p.v - (k + 0.5) / LEAVES) < 0.6 / LEAVES);
    g.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
    b.fillStyle = '#ffffff';
    const poly = (ctx: CanvasRenderingContext2D, h: number, inset: number) => {
      ctx.beginPath();
      for (let x = -STEP; x <= W + STEP; x += STEP) ctx.lineTo(x, (bounds[k] + wave(k, x)) * h + inset);
      for (let x = W + STEP; x >= -STEP; x -= STEP) ctx.lineTo(x, (bounds[k + 1] + wave(k + 1, x)) * h - inset);
      ctx.closePath();
      ctx.fill();
    };
    poly(g, H, 0.55);
    // relief: each leaf rounded, highest at its middle
    const grad = b.createLinearGradient(0, bounds[k] * BH, 0, bounds[k + 1] * BH);
    grad.addColorStop(0, '#5a5a5a');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, '#5a5a5a');
    b.fillStyle = grad;
    poly(b, BH, 0);
    if (proud) {
      // a leaf standing proud: brighter, with its shadow under it
      g.fillStyle = 'rgba(236,226,196,0.85)';
      poly(g, H, 0.3);
    }
  }
  // the partings between clumps
  for (let k = 1; k < LEAVES; k++) {
    if (!parting[k]) continue;
    g.strokeStyle = 'rgba(46,32,18,0.6)';
    g.lineWidth = 1.7;
    b.strokeStyle = 'rgba(0,0,0,0.7)';
    b.lineWidth = 1.1;
    for (const [ctx, h] of [
      [g, H],
      [b, BH],
    ] as const) {
      ctx.beginPath();
      for (let x = -STEP; x <= W + STEP; x += STEP) ctx.lineTo(x, (bounds[k] + wave(k, x)) * h);
      ctx.stroke();
    }
  }
  // the gaps between signatures: a little darker
  for (let s = 1; s < SIGNATURES; s++) {
    const k = s * 8;
    g.strokeStyle = 'rgba(30,20,12,0.7)';
    g.lineWidth = 2.0;
    b.strokeStyle = '#000';
    b.lineWidth = 1.4;
    for (const [ctx, h] of [
      [g, H],
      [b, BH],
    ] as const) {
      ctx.beginPath();
      for (let x = -STEP; x <= W + STEP; x += STEP) ctx.lineTo(x, (bounds[k] + wave(k, x)) * h);
      ctx.stroke();
    }
  }
  // shadows under the proud leaves
  for (const p of PROUD) {
    const y = (1 - p.v) * H;
    const grad = g.createLinearGradient(0, y, 0, y + 9);
    grad.addColorStop(0, 'rgba(20,12,6,0.7)');
    grad.addColorStop(1, 'rgba(20,12,6,0)');
    g.fillStyle = grad;
    g.fillRect(p.u0 * W, y + 2, (p.u1 - p.u0) * W, 9);
  }
  // age: dust along the corners and the spine ends, a tide line, foxing
  const [cA, cB] = corners;
  for (const u of [0, cA, cB, 1]) {
    const x = u * W;
    const grad = g.createLinearGradient(x - 260, 0, x + 260, 0);
    grad.addColorStop(0, 'rgba(60,40,20,0)');
    grad.addColorStop(0.5, `rgba(60,40,20,${u === 0 || u === 1 ? 0.6 : 0.32})`);
    grad.addColorStop(1, 'rgba(60,40,20,0)');
    g.fillStyle = grad;
    g.fillRect(x - 260, 0, 520, H);
  }
  {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(70,46,22,0.38)');
    grad.addColorStop(0.12, 'rgba(70,46,22,0)');
    grad.addColorStop(0.88, 'rgba(70,46,22,0)');
    grad.addColorStop(1, 'rgba(70,46,22,0.45)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }
  // a water tide line along part of the fore-edge
  g.strokeStyle = 'rgba(96,66,34,0.35)';
  g.lineWidth = 14;
  g.beginPath();
  for (let x = W * 0.58; x <= W * 0.76; x += 16) g.lineTo(x, H * (0.78 + 0.05 * Math.sin(x * 0.01) + 0.02 * fbm2(x * 0.01, 1, 93)));
  g.stroke();
  for (let k = 0; k < 340; k++) {
    const x = r() * W;
    const y = r() * H;
    const rr = 1.5 + r() * 7;
    const grad = g.createRadialGradient(x, y, 0, x, y, rr);
    grad.addColorStop(0, `rgba(110,70,30,${0.25 + r() * 0.35})`);
    grad.addColorStop(1, 'rgba(110,70,30,0)');
    g.fillStyle = grad;
    g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
  }
  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  const bump = new CanvasTexture(bc);
  bump.colorSpace = LinearSRGBColorSpace;
  bump.anisotropy = 8;
  return { map, bump };
}

/**
 * The crack's glow at the mouth: a strip along the fore-edge between the first page and the lifted
 * cover, turned about its own line to face the camera; brightest in the gap, a soft halo outside
 * it, its strength along the slit broken up by the leaves' uneven tops and flickering slowly (the
 * same noise as the spill light it casts, Desk2's roomCrackLight). Additive.
 */
const MOUTH_VERT = /* glsl */ `
uniform vec3 uC;
uniform float uLen;
uniform float uH;
varying vec2 vP;
void main() {
  vec3 toCam = cameraPosition - uC;
  vec3 w = cross(vec3(1.0, 0.0, 0.0), toCam);
  w = dot(w, w) > 1e-8 ? normalize(w) : vec3(0.0, 1.0, 0.0);
  if (w.y < 0.0) w = -w;
  vec3 p = uC + vec3(position.x * uLen, 0.0, 0.0) + w * (position.y * uH);
  vP = vec2(position.x * uLen, position.y * uH);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const MOUTH_FRAG = /* glsl */ `
uniform float uSbTime;
uniform float uGap;
uniform float uLen;
uniform float uGain;
uniform vec3 uCore;
uniform vec3 uHalo;
varying vec2 vP;
${NOISE3_GLSL}
void main() {
  float x = vP.x;
  float a = abs(vP.y);
  float core = exp(-pow(a / (0.05 + uGap * 0.06), 2.0));
  float halo = exp(-a / 0.09);
  float ends = smoothstep(uLen * 0.5, uLen * 0.5 - 2.2, abs(x));
  // the same breakup as the light it casts (Desk2 roomCrackLight), and the leaves' tops notching it
  float n = aivFbm3(vec3(x * 0.45, uSbTime * 0.45, 3.0));
  float br = 0.06 + 1.7 * smoothstep(0.32, 0.78, n);
  float leaves = 0.6 + 0.4 * smoothstep(0.3, 0.7, aivNoise3(vec3(x * 1.8, 1.7, 0.0)));
  vec3 col = uCore * core * leaves + uHalo * halo * 0.35;
  gl_FragColor = vec4(col * ends * br * uGain, 1.0);
}
`;

/**
 * The cover's shadow-pass material: a share `keep` (0..1) of its texels written (interleaved
 * gradient noise in the shadow map's own pixels), so the shadow fades smoothly through PCF instead
 * of switching off in one frame.
 */
function fadingDepth(): MeshDepthMaterial {
  const m = new MeshDepthMaterial();
  const keep = { value: 1 };
  m.userData.keep = keep;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uKeep = keep;
    sh.fragmentShader = 'uniform float uKeep;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n\tif (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) >= uKeep) discard;');
  };
  m.customProgramCacheKey = () => 'book-cover-fading-depth';
  return m;
}

// ---- geometry ----------------------------------------------------------------------------------------

function ribbonPath(): { pts: V3[]; side: V3[] } {
  const P: P3[] = [
    [2.78, PAGES.y1 - 0.22, PAGES.z1 - 0.3],
    [2.78, PAGES.y1 - 0.22, PAGES.z1 + 0.012],
    [2.8, PAGES.y1 - 0.3, PAGES.z1 + 0.03],
    [2.82, 0.95, PAGES.z1 + 0.028],
    [2.85, 0.5, PAGES.z1 + 0.026],
    [2.87, 0.22, PAGES.z1 + 0.03],
    [2.89, BOARD_T + 0.012, PAGES.z1 + 0.07],
    [2.91, BOARD_T + 0.006, HD - 0.005],
    [2.94, 0.06, HD + 0.06],
    [3.0, 0.008, HD + 0.3],
    [3.12, 0.006, HD + 0.8],
    [3.32, 0.007, HD + 1.3],
    [3.46, 0.008, HD + 1.8],
    [3.5, 0.008, HD + 2.25],
    [3.44, 0.007, HD + 2.55],
  ];
  const c = new Curve<P3>(P);
  const pts: V3[] = [];
  const side: V3[] = [];
  const n = 70;
  for (let i = 0; i <= n; i++) {
    const s = (c.length * i) / n;
    const p = c.pointAt(s);
    pts.push([p[0], p[1], p[2]]);
    const q = c.pointAt(Math.min(c.length, s + 0.02));
    const q0 = c.pointAt(Math.max(0, s - 0.02));
    const t = new Vector3(q[0] - q0[0], q[1] - q0[1], q[2] - q0[2]).normalize();
    // across the ribbon: in the surface it lies on (the fore-edge while it hangs, the desk once it lies), across its run
    const nrm = new Vector3(0, 1 - Math.abs(t.y), Math.abs(t.y)).normalize();
    const a = new Vector3().crossVectors(t, nrm);
    if (a.lengthSq() < 1e-6) a.set(1, 0, 0);
    a.normalize();
    if (a.x < 0) a.negate();
    side.push([a.x, a.y, a.z]);
  }
  return { pts, side };
}

const WINE: [number, number, number] = [0.13, 0.012, 0.022];
const CREAM: [number, number, number] = [0.62, 0.52, 0.32];

function trimGeometry(): BufferGeometry {
  const { pts, side } = ribbonPath();
  const ribbon = ribbonGeometry(pts, side, 0.3, 0.12, (t, a) => {
    // satin: a little lighter on its centre line, darker where it lies in the fore-edge's shadow
    const k = (1 + 0.08 * (1 - Math.abs(a))) * (0.75 + 0.25 * smooth(0.05, 0.4, t));
    return [WINE[0] * k, WINE[1] * k, WINE[2] * k, 0.25];
  });
  const bands: BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const pts2: V3[] = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const v = i / n;
      pts2.push([sx * (PAGES.x1 + 0.018), PAGES.y0 + 0.03 + (PAGES.y1 - PAGES.y0 - 0.06) * v, PAGES.z0 + 0.05 - 0.14 * Math.pow(Math.sin(Math.PI * v), 0.6)]);
    }
    bands.push(
      tubeAlong(pts2, 0.034, 8, (t) => {
        const stripe = Math.floor(t * 26) % 2 === 0;
        const c = stripe ? WINE : CREAM;
        return [c[0], c[1], c[2], 0.2];
      }),
    );
  }
  const all = [ribbon, ...bands];
  const g = mergeGeometries(all.map((p) => p.toNonIndexed()))!;
  all.forEach((p) => p.dispose());
  return g;
}

interface BookGeometry {
  back: BufferGeometry;
  edges: BufferGeometry;
  corners: [number, number];
  top: BufferGeometry;
  cover: BufferGeometry;
  brassBack: BufferGeometry;
  brassCover: BufferGeometry;
  trim: BufferGeometry;
  endpaper: BufferGeometry;
  plate: BufferGeometry;
  mouth: BufferGeometry;
}

function bookGeometry(): BookGeometry {
  const boardSpec = { x0: -HW, x1: HW, t: BOARD_T, rBack: 0.03, rFront: 0.09, bevel: 0.03, edge: 1.3, rim: 0.7 };
  const backBoard = boardGeometry({ ...boardSpec, z0: -HD, z1: HD });
  const spine = spineGeometry({ x0: -HW, x1: HW, z: -HD, h: BOOK_TOP, bulge: 0.3, bands: [-5.95, -2.15, 1.85, 5.8], bandH: 0.06, bandW: 0.1, seed: 94 });
  const back = mergeGeometries([backBoard.toNonIndexed(), spine.index ? spine.toNonIndexed() : spine])!;
  backBoard.dispose();
  spine.dispose();
  const block = pageBlockGeometry({ ...PAGES, concave: CONCAVE, signatures: SIGNATURES, proud: PROUD, seed: 95 });
  const top = new PlaneGeometry(PAGES.x1 - PAGES.x0, PAGES.z1 - PAGES.z0);
  top.rotateX(-Math.PI / 2);
  top.translate(0, PAGES.y1, (PAGES.z0 + PAGES.z1) / 2);
  // the cover in its own frame: hinge at the origin, the board along +z (local), y 0..t
  const cover = boardGeometry({ ...boardSpec, z0: 0, z1: BOOK.d, edge: 1.0 });
  const corner = (y0: number, z: number, rivets: number) =>
    mergeGeometries([cornerGeometry({ x: -HW, z, sx: -1, sz: 1, y0, t: BOARD_T, leg: 0.95, plate: 0.016, r: 0.09, rivets }), cornerGeometry({ x: HW, z, sx: 1, sz: 1, y0, t: BOARD_T, leg: 0.95, plate: 0.016, r: 0.09, rivets })])!;
  const brassBack = corner(0, HD, 0);
  const brassCover = corner(0, BOOK.d, 1);
  // the endpaper: the cover's inside less the plate's hole, facing −y (local) = +z when standing
  const s = new Shape();
  const ex = HW - 0.02;
  const ez0 = 0.02;
  const ez1 = BOOK.d - 0.02;
  s.moveTo(-ex, ez0);
  s.lineTo(ex, ez0);
  s.lineTo(ex, ez1);
  s.lineTo(-ex, ez1);
  s.closePath();
  const hole = new Shape();
  const hx = PLATE.w / 2;
  const hz0 = HD - PLATE.d / 2;
  const hz1 = HD + PLATE.d / 2;
  hole.moveTo(-hx, hz0);
  hole.lineTo(-hx, hz1);
  hole.lineTo(hx, hz1);
  hole.lineTo(hx, hz0);
  hole.closePath();
  s.holes.push(hole);
  const endpaper = new ShapeGeometry(s, 1);
  endpaper.rotateX(Math.PI / 2);
  endpaper.translate(0, -0.004, 0);
  {
    const p = endpaper.getAttribute('position');
    const uv = endpaper.getAttribute('uv');
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + HW) / BOOK.w, p.getZ(i) / BOOK.d);
  }
  const plate = new PlaneGeometry(PLATE.w, PLATE.d);
  plate.rotateX(Math.PI / 2);
  // the crack's glow at the mouth (placed and turned to the camera in its shader)
  const mouth = new PlaneGeometry(1, 1, 64, 1);
  return { back, edges: block.edges, corners: block.corners, top, cover, brassBack, brassCover, trim: trimGeometry(), endpaper, plate, mouth };
}

// ---- the book ------------------------------------------------------------------------------------------

export interface Book2Props {
  /** 0 closed flat on the page block .. 1 standing open at 90° (film/beats coverAt) */
  cover: number;
  /** the film frame */
  f: number;
  /** 0 on the desk .. 1 inside the story (film/beats immersionAt): the cover's print becomes the dome's sky */
  immersion?: number;
}

export function Book2({ cover, f, immersion = 0 }: Book2Props) {
  const { fonts, ready } = useFilmFonts();
  const geo = useMemo(bookGeometry, []);
  const art = useMemo(() => coverArt(fonts), [fonts, ready]);
  const mats = useMemo(() => {
    const ea = edgeArt(geo.corners);
    const endTex = endpaperArt();
    return {
      ea,
      endTex,
      cloth: roomMaterial({ kind: 'cloth', color: '#46202e', color2: '#24121b', vertexColors: true, breakup: 0.22, scale: 0.18, roughness: 0.88, rim: 0.55, self: true }),
      edges: roomMaterial({ kind: 'plain', map: ea.map, bumpMap: ea.bump, bumpScale: 1.6, vertexColors: true, roughness: 0.9, breakup: 0.06, scale: 0.12, color2: '#8a7656', rim: 0.35, self: true, crack: 1 }),
      // the first page: the Terrain's paper margin; in the crack it takes the glow from inside
      top: roomMaterial({ kind: 'plain', color: '#cfc2a2', color2: '#b9aa86', breakup: 0.1, scale: 0.35, roughness: 0.95, rim: 0, fog: 1, window: 0, candle: 0, crack: 1, self: true, ambient: 0.4, moon: 0.4 }),
      // worn brass: a warm metal (F0 #d4a640), the room in its reflections, no cool ambient
      brass: roomMaterial({ kind: 'iron', color: '#d8b050', color2: '#6a5226', vertexColors: true, metalness: 1, roughness: 0.3, breakup: 0.35, scale: 0.05, bump: 0.22, rim: 0.2, self: true, env: 1, glitter: 0.25 }),
      trim: roomMaterial({ kind: 'cloth', color: '#ffffff', vertexColors: true, side: DoubleSide, roughness: 0.68, breakup: 0.08, scale: 0.05, rim: 0.2, self: true }),
      endpaper: roomMaterial({ kind: 'plain', map: endTex, roughness: 0.85, breakup: 0.06, scale: 0.2, rim: 0, transparent: true, self: true, crack: 1 }),
      mouth: new ShaderMaterial({
        vertexShader: MOUTH_VERT,
        fragmentShader: MOUTH_FRAG,
        uniforms: { uSbTime: NIGHT.uSbTime, uC: { value: new Vector3() }, uLen: { value: PAGES.x1 - PAGES.x0 - 0.4 }, uH: { value: 1 }, uGap: { value: 0.5 }, uGain: { value: 0 }, uCore: { value: new Color('#9ff0ff') }, uHalo: { value: new Color('#2fc6e6') } },
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
      }),
      coverDepth: fadingDepth(),
    };
  }, [geo]);
  const coverMat = useMemo(() => roomMaterial({ kind: 'cloth', map: art.map, bumpMap: art.orm, bumpScale: 2.2, roughnessMap: art.orm, metalnessMap: art.orm, roughness: 1, metalness: 1, vertexColors: true, breakup: 0.1, scale: 0.15, color2: '#24131f', rim: 0.2, self: true, env: 1, glitter: 1, crack: 1 }), [art]);
  const sky = useSkyPortal();
  useLayoutEffect(
    () => () => {
      art.map.dispose();
      art.orm.dispose();
      coverMat.dispose();
    },
    [art, coverMat],
  );
  useLayoutEffect(
    () => () => {
      mats.ea.map.dispose();
      mats.ea.bump.dispose();
      mats.endTex.dispose();
      for (const k of ['cloth', 'edges', 'top', 'brass', 'trim', 'endpaper', 'mouth', 'coverDepth'] as const) mats[k].dispose();
    },
    [mats],
  );
  useLayoutEffect(() => () => Object.values(geo).forEach((g) => g instanceof BufferGeometry && g.dispose()), [geo]);
  const angle = cover * (Math.PI / 2);
  const imm = Math.min(1, Math.max(0, immersion));
  // the crack's glow: only while the cover lifts a little (the world inside, before the burst)
  const gap = (PAGES.z1 + HD) * Math.sin(angle);
  // (gone once the cover lifts past the crack: bursting open, the mouth's line would float in the air)
  const leak = smooth(0.002, BOOK_EDGE.crack, cover) * (1 - smooth(BOOK_EDGE.crack * 1.15, BOOK_EDGE.crack * 2.2, cover)) * (0.85 + 0.15 * Math.sin(f * 0.37));
  // the cover's moon shadow fades out as it rises (standing, it would shade the whole page)
  const keep = 1 - smooth(0.15, 0.3, cover);
  useLayoutEffect(() => {
    // the cover as the room light's occluder
    ROOM.uRoomCoverInv.value.copy(new Matrix4().makeRotationX(-angle).setPosition(0, FLOOR, -HD)).invert();
    sky.uniforms.uFibre.value = 1 - imm;
    // every desk camera looks down at the print: lower its horizon so the clouds and the gradient show
    // on it (not the flat haze under the horizon), rising to the dome's as the camera enters the story
    sky.uniforms.uHorizonEl.value = -0.6 + 0.62 * smooth(0, 0.6, imm);
    mats.endpaper.opacity = 1 - imm;
    // the crack's light (Desk2 roomMaterial: a line light along the mouth) and the strip that is its glow
    ROOM.uRoomCrack.value.set((PAGES.x1 - PAGES.x0) / 2 - 0.2, FLOOR + gap * 0.45, PAGES.z1 + 0.05, 0.7 * leak);
    const mu = mats.mouth.uniforms;
    mu.uC.value.set(0, FLOOR + gap * 0.42, PAGES.z1 + 0.03);
    mu.uH.value = gap + 0.4;
    mu.uGap.value = gap;
    mu.uGain.value = 0.9 * leak;
    (mats.coverDepth.userData as { keep: { value: number } }).keep.value = keep;
  }, [angle, imm, sky, mats, leak, gap, keep]);
  // the plate grows over the frame as the camera enters the story (and past the board's edges)
  const ps: [number, number, number] = [1 + imm * ((BOOK.w + 0.5) / PLATE.w - 1), 1, 1 + imm * ((BOOK.d + 0.5) / PLATE.d - 1)];
  return (
    <group>
      <mesh geometry={geo.back} material={mats.cloth} castShadow receiveShadow />
      <mesh geometry={geo.edges} material={mats.edges} castShadow receiveShadow />
      <mesh geometry={geo.top} material={mats.top} receiveShadow />
      <mesh geometry={geo.brassBack} material={mats.brass} castShadow receiveShadow />
      <mesh geometry={geo.trim} material={mats.trim} castShadow receiveShadow />
      <group position={[0, FLOOR, -HD]} rotation-x={-angle}>
        <mesh geometry={geo.cover} material={coverMat} castShadow={keep > 0.001} customDepthMaterial={mats.coverDepth} receiveShadow />
        <mesh geometry={geo.brassCover} material={mats.brass} castShadow={keep > 0.001} customDepthMaterial={mats.coverDepth} receiveShadow />
        <mesh geometry={geo.endpaper} material={mats.endpaper} visible={imm < 0.999} />
        <mesh geometry={geo.plate} material={sky} scale={ps} position={[0, -0.002, HD]} />
      </group>
      {leak > 0.001 && <mesh geometry={geo.mouth} material={mats.mouth} frustumCulled={false} renderOrder={4} />}
    </group>
  );
}

/** Triangle counts of the book's meshes (for the budget). */
export function bookStats(): Record<string, number> {
  const g = bookGeometry();
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(g)) if (v instanceof BufferGeometry) out[k] = (v.index ? v.index.count : v.getAttribute('position').count) / 3;
  Object.values(g).forEach((v) => v instanceof BufferGeometry && v.dispose());
  return out;
}

/** a direction the bats leave the crack by, as a unit vector (for callers that want one) */
export const BOOK_EDGE_DIR = new Vector3(...BOOK_EDGE.dir).normalize();
