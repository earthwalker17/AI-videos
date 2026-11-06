/**
 * The hanging ghosts on the ghost tree's hero limb (world/Trees.tsx GHOST_HOOKS, in that order:
 * the long ghost right of the moon, the short one left of it, LAND.peek's, the one that lowers to
 * peek at Clawd, and a fourth tied on above the hero frame's top, its hem framing the moon from
 * above), as the reference's are: old sheets thrown over a ball and tied off on top, in a dark
 * plum-mauve burlap (plum in the folds, lilac grey where the ridges catch the sky), no rim light.
 * Each is a hood (the sheet gathered in a crumpled tuft at the knot, rounding over the ball, a
 * slight neck under it), two slanted cream-amber eyes that glow (emissive, a soft halo spilling
 * onto the cloth around them), many narrow folds that deepen toward the hem, and the hem torn
 * into five to nine uneven strips (each its own length and shape, nicked again here and there),
 * two to four holes worn through near it and a few threads dripping below. A twisted three-ply
 * rope runs from three tight turns round the limb (fitted to the bark) down to the knot.
 *
 * Cloth as geometry: a lathe-like grid (columns round the axis, rows down from the tie; each
 * column's last rows reach its own hem), an outer shell and a dark inner shell (the inside of the
 * sheet, seen through the tears and the holes), RGBA vertex colours for the fold occlusion and the
 * streaks. Each ghost sways as a slow pendulum about its hook (its own periods, an elliptical
 * swing, a slow twist of the rope), the cloth lagging the head with depth so the hems trail, the
 * strips and threads fluttering: all from the frame, on the CPU, into one merged mesh (the ghosts,
 * ropes, wraps) and one additive eye mesh (the eyes and their halos). `lower` lets a ghost down on
 * its rope; the peek ghost's 1 brings its eyes PEEK_EYES above the ground under its hook, and as
 * it comes it turns three-quarter toward him (PEEK_YAW), leans in and bows its head to peer down
 * at him (its hem swinging back clear of his hat), cocks its head, and its eyes go wide. At rest it is
 * bunched up snug under the limb, a crumpled bundle with a ragged fringe, its eyes shut to a dim
 * glow. Two draw calls (plus the cloth's shadow).
 */
import { rand, smoothstep } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three';
import { FPS } from '../cues.ts';
import { fbm2Fast as fbm2 } from '../kit/field.ts';
import { findTube, surfacePoint, type Ring } from '../kit/tree.ts';
import { storybookMaterial } from '../look/materials.ts';
import { matte } from './Bats.tsx';
import { FLOOR, groundHeight, HERO } from './layout.ts';
import { GHOST_BASE, GHOST_HOOKS, ghostTreeSkeleton } from './Trees.tsx';

const TAU = Math.PI * 2;
type V3 = [number, number, number];
type Hooks = readonly (readonly [number, number, number])[];

interface EyeDesign {
  /** the almond's length and its lower half-height (× the head's radius) */
  len: number;
  h: number;
  /** each eye's angle off the face's middle (radians round the head) */
  sep: number;
  /** the slant (radians: the inner ends low, a scowl) */
  slant: number;
  /** height on the ball: the fraction of its radius below the equator (− above) */
  y: number;
}

interface GhostDesign {
  /** rope from the hook to the tie at rest (world units) */
  rope: number;
  /** the sheet from the tie to its hem */
  length: number;
  /** the head ball's radius and the hem's */
  head: number;
  hem: number;
  /** how far `lower` = 1 lets it down; 'peek': until its eyes are PEEK_EYES above the ground under its hook */
  drop: number | 'peek';
  /** pendulum period (s) and the yaw off facing the hero eye */
  period: number;
  yaw: number;
  seed: number;
  eye: EyeDesign;
  /** the sheet's corners' extra length (× length) */
  corners: number;
  /** the body's flare: its radius a third and two thirds of the way down, as a share of the way from the head's to the hem's */
  flare?: readonly [number, number];
  /** the strips the hem is torn into */
  strips: number;
}

/**
 * In hook order, as the reference hangs them round its moon: the long ghost on a longer rope right
 * of the moon (a narrow top, a wide heavy hem, clear of the disc), the short wide one snug under
 * the limb left of it, the peek ghost, and the fourth from above the frame's top (its head out of
 * the hero frame, its hem just above the disc); eyes of their own size, spacing and scowl.
 */
const DESIGNS: GhostDesign[] = [
  { rope: 0.22, length: 1.26, head: 0.13, hem: 0.31, flare: [0.1, 0.48], drop: 0.4, period: 4.6, yaw: 0.16, seed: 12, eye: { len: 0.46, h: 0.15, sep: 0.35, slant: 0.38, y: -0.18 }, corners: 0.06, strips: 8 },
  { rope: 0.05, length: 0.86, head: 0.15, hem: 0.3, drop: 0.4, period: 3.9, yaw: -0.2, seed: 11, eye: { len: 0.46, h: 0.13, sep: 0.42, slant: 0.5, y: -0.1 }, corners: 0.09, strips: 6 },
  { rope: 0.05, length: 1.08, head: 0.138, hem: 0.27, drop: 'peek', period: 3.4, yaw: -0.05, seed: 13, eye: { len: 0.52, h: 0.12, sep: 0.39, slant: 0.44, y: -0.12 }, corners: 0.1, strips: 7 },
  { rope: 0.15, length: 0.92, head: 0.14, hem: 0.28, flare: [0.36, 0.72], drop: 0.3, period: 4.2, yaw: 0.1, seed: 14, eye: { len: 0.48, h: 0.13, sep: 0.38, slant: 0.42, y: -0.14 }, corners: 0.08, strips: 9 },
];
/** the peek ghost's index (film/beats.ts ghostLowerAt drives its `lower`) */
const PEEK = DESIGNS.findIndex((d) => d.drop === 'peek');
/**
 * the peek ghost's eyes above the ground under its hook at lower = 1 (before its bow): as low as
 * it comes with its hem off the ground (its threads' ends ~0.15 above it at the shoo) and no cloth
 * over Clawd's hat (its top ~0.41 above the ground) lower than ~0.6 on the way down (clothLowest);
 * leaning in, its face hangs over him ~1.2 above the ground (V1's 1.8)
 */
export const PEEK_EYES = 1.25;
/**
 * the yaw the lowered ghost turns to: three-quarter toward Clawd (facing him is about −0.96, the
 * truck camera's side 0.72), so it peers at him and his pail with its face still to the lens
 */
const PEEK_YAW = -0.3;
/**
 * the lowered ghost's bow (radians: its head pitched down to peer at him), the lean of its body
 * after it (its hem swinging back, away from him, so its head can come lower over his hat) and the
 * curious cock of its head
 */
const PEEK_BOW = 0.55;
const PEEK_LEAN = 0.26;
const PEEK_COCK = 0.2;
const LOWER_MAX = 1.5;
/**
 * The peek ghost at rest is gathered up under the limb: only its head and this much of the sheet
 * hang open, the rest bunched up beneath in a short, narrowing bundle (GATHER_TAIL long) with its
 * eyes shut; as it is let down to peek the sheet pays out of the bundle to its full length and
 * the eyes open, and it gathers back up as it is snatched away (so in the hero view it does not
 * hang in front of the castle's crag).
 */
const GATHER_MIN = 0.26;
const GATHER_TAIL = 0.1;
/** a depth on the sheet as hung when only `ell` of it is open (the rest bunched up under it) */
const gatheredDepth = (d: number, ell: number) => (d <= ell ? d : ell + GATHER_TAIL * (1 - Math.exp(-(d - ell) / GATHER_TAIL)));
/** how much narrower the bunched cloth hangs than the open sheet at that depth (it tapers to a sack's round bottom) */
const gatheredWidth = (d: number, ell: number) => (d <= ell ? 1 : 0.42 + 0.58 * Math.exp(-(d - ell) / 0.07));
/** the bundled strips: how far below the bundle a strip still hangs (× its length below its tear) */
const GATHER_FRINGE = 0.55;

/** columns round a ghost; rows: the tuft, the head, the body, the strips */
const COLS = 96;
const TUFT: { d: number; r: number }[] = [
  { d: -0.072, r: 0.006 },
  { d: -0.064, r: 0.019 },
  { d: -0.048, r: 0.027 },
  { d: -0.03, r: 0.026 },
  { d: -0.016, r: 0.018 },
  { d: -0.006, r: 0.0125 },
  { d: 0, r: 0.012 },
];
const HEAD_ROWS = 10;
const NECK_ROWS = 4;
const BODY_ROWS = 24;
const STRIP_ROWS = 14;
/** the sheet's thickness (the inner shell's inset) */
const THICK = 0.0065;
/** the swing's lag down the cloth (s per world unit below the tie) and its depth bins */
const LAG = 0.22;
const BINS = 128;
const MAX_DEPTH = 2.0;
const BIN_DEPTH = MAX_DEPTH / BINS;

/** linear RGB from an sRGB hex (vertex colours are linear) */
function lin(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
}
/**
 * The sheet's paint (linear, past 1 where the night needs it): a plum mauve that the night's floor
 * and haze turn to the reference's (its sheets sit at about sRGB (46, 20, 38) in the folds, (50,
 * 31, 46) on the flats and (58, 53, 74) on the lit ridges): the fold valleys deeper and redder,
 * the streaks a cool lilac grey.
 */
const CLOTH: [number, number, number] = [1.42, 0.3, 0.34];
const VALLEY: [number, number, number] = [0.5, 0.26, 0.24];
const SHEEN: [number, number, number] = [2.3, 2.05, 2.7];
const ROPE = lin('#5e4a40');

const angDist = (a: number, b: number) => {
  const d = (((a - b) % TAU) + TAU) % TAU;
  return d > Math.PI ? TAU - d : d;
};
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

// ---- a monotone cubic through (d, r) points: the profile, smooth through its pinch -----------------

function monotoneSlopes(p: readonly [number, number][]): number[] {
  const n = p.length;
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) s.push((p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]));
  const t: number[] = [s[0]];
  for (let i = 1; i < n - 1; i++) t.push(s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2);
  t.push(s[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / s[i];
    const b = t[i + 1] / s[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * s[i];
      t[i + 1] = k * b * s[i];
    }
  }
  return t;
}
function hermite(p: readonly [number, number][], t: readonly number[], x: number): number {
  let i = 0;
  while (i < p.length - 2 && x > p[i + 1][0]) i++;
  const [x0, y0] = p[i];
  const [x1, y1] = p[i + 1];
  const h = x1 - x0;
  const u = clamp((x - x0) / h, 0, 1);
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * h * t[i] + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * h * t[i + 1];
}

// ---- one ghost's rest geometry (ghost-local: the tie at the origin, y up, the face toward +z) -------

interface Fold {
  th: number;
  w: number;
  a: number;
  s: number;
  drift: number;
}
interface Strip {
  c0: number;
  c1: number;
  tip: number;
  curlOut: number;
  curlSide: number;
  phase: number;
  /** its end's shape: the exponent of its rounding (low: worn to a point, high: blunt) */
  end: number;
  /** a nick torn into its end: where across it (0..1; < 0 none) and how deep */
  nick: number;
  nickD: number;
}
interface Hole {
  c: number;
  d: number;
  wc: number;
  wd: number;
}
interface Streak {
  th: number;
  w: number;
  d0: number;
  d1: number;
  k: number;
}
interface Drip {
  c: number;
  len: number;
  r: number;
  bend: number;
  side: number;
  phase: number;
}

interface GhostShape {
  d: GhostDesign;
  rh: number;
  /** where the sheet leaves the head (below its pinch) */
  shoulder: number;
  prof: [number, number][];
  slopes: number[];
  folds: Fold[];
  tears: number[];
  strips: Strip[];
  /** the shallowest tear: where the strip rows begin */
  solid: number;
  cornerPhase: number;
  /** per column: its strip, the fraction across it, its hem depth and its tear depth */
  colStrip: Strip[];
  hemD: Float32Array;
  tearD: Float32Array;
  holes: Hole[];
  drips: Drip[];
  /** painted pale streaks down the fold crests (the moon's light caught along them) */
  streaks: Streak[];
  /** the eyes' depth below the tie */
  eyeD: number;
  /** the deepest point (hem, corners, threads) */
  bottom: number;
}

function design(d: GhostDesign): GhostShape {
  const r = (id: number, k: number) => rand(d.seed, id, k);
  const rh = d.head;
  const L = d.length;
  const hem = d.hem;
  const sh = rh * 1.95;
  // a ball under the sheet: round over the top from the knot, its widest at the equator; the
  // sheet pinched ~10% under the ball, then falling in a near-straight A-line flare to the hem
  // (the top a hood: the sheet drawn up into the knot, a little pointed, then round over the ball)
  const [f1, f2] = d.flare ?? [0.46, 0.8];
  const prof: [number, number][] = [
    [0, 0.012],
    [0.05 * rh, 0.24 * rh],
    [0.15 * rh, 0.45 * rh],
    [0.35 * rh, 0.71 * rh],
    [0.62 * rh, 0.9 * rh],
    [1.0 * rh, 1.0 * rh],
    [1.36 * rh, 0.94 * rh],
    [1.62 * rh, 0.86 * rh],
    [sh, 0.97 * rh],
    [sh + 0.3 * (L - sh), rh + f1 * (hem - rh)],
    [sh + 0.66 * (L - sh), rh + f2 * (hem - rh)],
    [L, hem],
  ];
  const slopes = monotoneSlopes(prof);
  const folds: Fold[] = [];
  // many narrow pleats (the reference's sheets hang in close vertical folds), a few broad ones
  const K = 17 + Math.floor(r(1, 0) * 5);
  for (let k = 0; k < K; k++) {
    const crease = r(10 + k, 0) < 0.45;
    folds.push({
      th: ((k + 0.5 + (r(10 + k, 1) - 0.5) * 0.8) / K) * TAU,
      w: crease ? 0.06 + 0.05 * r(10 + k, 2) : 0.1 + 0.16 * r(10 + k, 2),
      a: crease ? -(0.05 + 0.07 * r(10 + k, 3)) : 0.06 + 0.09 * r(10 + k, 3),
      s: sh * 0.85 + (L - sh) * 0.5 * r(10 + k, 4) ** 2,
      drift: (r(10 + k, 5) - 0.5) * 0.5,
    });
  }
  // the hem torn into `strips` uneven strips (the reference's ragged hems): their widths drawn at
  // random, the tears between them run deep up the sheet (a few only nicks), each strip its own
  // length (some hang well below the rest) and its own end (blunt, or worn to a point)
  const n = d.strips;
  const wts = Array.from({ length: n }, (_, k) => 0.4 + 1.3 * r(30 + k, 0) ** 1.2);
  const tot = wts.reduce((a, v) => a + v, 0);
  const first = Math.floor(r(2, 0) * (COLS / n));
  const bounds: number[] = [first];
  let cum = 0;
  for (let k = 0; k < n; k++) {
    cum += wts[k];
    bounds.push(first + Math.round((cum / tot) * COLS));
  }
  bounds[n] = first + COLS;
  const tears = bounds.map((_, k) => {
    const id = 60 + (k % n);
    return L * (r(id, 1) < 0.22 ? 0.9 + 0.05 * r(id, 0) : 0.7 + 0.17 * r(id, 0));
  });
  tears[n] = tears[0];
  const strips: Strip[] = [];
  for (let k = 0; k < n; k++) {
    const long = r(90 + k, 0) < 0.3;
    strips.push({
      c0: bounds[k],
      c1: bounds[k + 1],
      tip: L * (long ? 1.04 + 0.08 * r(90 + k, 1) : 0.95 + 0.07 * r(90 + k, 1)),
      curlOut: 0.002 + 0.01 * r(90 + k, 3),
      curlSide: (r(90 + k, 4) - 0.5) * 0.2,
      phase: r(90 + k, 5) * TAU,
      end: 1.3 + 3.2 * r(90 + k, 6),
      nick: r(90 + k, 7) < 0.6 ? 0.2 + 0.6 * r(90 + k, 8) : -1,
      nickD: L * (0.04 + 0.07 * r(90 + k, 9)),
    });
  }
  const cornerPhase = r(3, 0) * TAU;
  const cornerAmp = [0, 1, 2, 3].map((k) => d.corners * (0.45 + 0.75 * r(4, k)));
  const cornerTh = [0, 1, 2, 3].map((k) => cornerPhase + (k * TAU) / 4 + (r(5, k) - 0.5) * 0.5);
  // the hem's fray: ragged from column to column
  const raw = Array.from({ length: COLS }, (_, k) => r(400 + k, 0) - 0.5);
  const fray = raw.map((v, k) => 0.6 * v + 0.2 * (raw[(k + COLS - 1) % COLS] + raw[(k + 1) % COLS]));
  const colStrip: Strip[] = [];
  const hemD = new Float32Array(COLS);
  const tearD = new Float32Array(COLS);
  for (let cc = 0; cc < COLS; cc++) {
    let k = 0;
    let x = 0;
    for (let s = 0; s < strips.length; s++) {
      const st = strips[s];
      const cw = cc < st.c0 ? cc + COLS : cc;
      if (cw >= st.c0 && cw < st.c1) {
        k = s;
        x = (cw - st.c0 + 0.5) / (st.c1 - st.c0);
        break;
      }
    }
    const st = strips[k];
    const t0 = tears[k];
    const t1 = tears[k + 1];
    const edge = t0 + (t1 - t0) * x;
    // the strip's end: rounding off into the tears (blunt or pointed), a nick torn into some
    let blunt = 1 - Math.abs(2 * x - 1) ** st.end;
    if (st.nick >= 0) blunt -= (st.nickD / Math.max(0.05, st.tip - edge)) * Math.exp(-(((x - st.nick) / 0.07) ** 2));
    const th = (cc / COLS) * TAU;
    let corner = 0;
    for (let q = 0; q < 4; q++) corner += cornerAmp[q] * Math.exp(-((angDist(th, cornerTh[q]) / 0.3) ** 2));
    corner *= L;
    colStrip.push(st);
    hemD[cc] = edge + (st.tip - edge) * Math.max(0, blunt) + corner + 0.035 * L * fray[cc];
    tearD[cc] = Math.min(t0, t1) + corner;
  }
  const solid = Math.min(...tears) - 0.012;
  // holes worn through near the hem (both shells), not under the face
  const nh = 2 + Math.floor(r(6, 0) * 3);
  const holes: Hole[] = [];
  for (let k = 0; k < nh; k++) {
    let hc = r(7, k) * COLS;
    // keep them off the face's middle (column COLS/4 is th = π/2)
    if (Math.abs(hc - COLS / 4) < 6) hc += 12;
    // most bite into the hem's edge (gaps the sky shows through), one is worn through higher up
    const edge = k > 0 || r(8, 1) < 0.5;
    const hd = edge ? hemD[Math.floor(hc) % COLS] - 0.012 * r(8, 2) : L * (0.7 + 0.18 * r(8, k));
    holes.push({ c: hc, d: hd, wc: (edge ? 2.0 : 1.4) + 2.4 * r(9, k), wd: (edge ? 0.03 : 0.014) + 0.025 * r(10, k) });
  }
  // two or three long threads dripping below the hem
  const nd = 3 + (r(11, 0) < 0.5 ? 1 : 0);
  const drips: Drip[] = [];
  for (let k = 0; k < nd; k++) {
    drips.push({ c: Math.floor(r(12, k) * COLS), len: 0.08 + 0.2 * r(13, k), r: 0.0032 + 0.0018 * r(14, k), bend: (r(15, k) - 0.5) * 0.08, side: (r(16, k) - 0.5) * 0.05, phase: r(17, k) * TAU });
  }
  // the streaks: round the whole sheet at jittered, uneven spacing (it is seen from every side),
  // a few skipped; each broken (its own start and end), its own width and strength
  const streaks: Streak[] = [];
  const NS = 23;
  for (let k = 0; k < NS; k++) {
    if (r(130 + k, 0) < 0.2) continue;
    const d0 = sh + (L - sh) * 0.35 * r(130 + k, 1) ** 1.5;
    streaks.push({ th: ((k + 0.5 + (r(130 + k, 2) - 0.5) * 0.75) / NS) * TAU, w: 0.04 + 0.05 * r(130 + k, 3), d0, d1: d0 + (L - d0) * (0.4 + 0.65 * r(130 + k, 4)), k: 0.45 + 0.55 * r(130 + k, 5) });
  }
  let bottom = 0;
  for (let k = 0; k < COLS; k++) bottom = Math.max(bottom, hemD[k]);
  for (const dr of drips) bottom = Math.max(bottom, hemD[dr.c] + dr.len);
  return { d, rh, shoulder: sh, prof, slopes, folds, tears, strips, solid, cornerPhase, colStrip, hemD, tearD, holes, drips, streaks, eyeD: rh * (1 + d.eye.y), bottom };
}

/** the profile radius at depth d below the tie (before the folds) */
function profile(g: GhostShape, d: number): number {
  const L = g.d.length;
  if (d >= L) return g.d.hem * (1 + 0.03 * ((d - L) / L));
  return Math.max(0.009, hermite(g.prof, g.slopes, Math.max(0, d)));
}

/** the folds' relative displacement at angle th (0 is +x; the face is +z, th = π/2) and depth d */
function folds(g: GhostShape, th: number, d: number, wideOnly = false): number {
  const L = g.d.length;
  const rh = g.rh;
  let F = 0;
  const grow = smoothstep(rh * 1.5, L, d);
  for (const k of g.folds) {
    if (wideOnly && k.w < 0.15) continue;
    const a = k.th + k.drift * grow;
    const x = angDist(th, a) / k.w;
    F += k.a * Math.exp(-x * x) * smoothstep(k.s - 0.04, k.s + 0.3 * L, d);
  }
  F *= 0.5 + 0.5 * grow ** 0.7;
  if (wideOnly) return F;
  // fine wrinkles and close pleats in the body
  F += (0.01 * Math.sin(17 * th + 5.0 * d + g.cornerPhase) + 0.007 * Math.sin(31 * th - 3.0 * d + 2.3 * g.cornerPhase)) * smoothstep(rh * 1.6, 0.6 * L, d);
  // the gathers converging on the knot, over the top of the ball only (the ball reads round)
  const top = 1 - Math.max(0, d) / (rh * 0.62);
  if (top > 0) F += 0.11 * top ** 1.6 * (0.6 * Math.sin(9 * th + g.cornerPhase) + 0.4 * Math.sin(5 * th + 1.3 * g.cornerPhase));
  // soft creases where the sheet pinches under the ball
  F += 0.025 * Math.sin(7 * th + 2.1 * g.cornerPhase) * Math.exp(-(((d - rh * 1.62) / (rh * 0.3)) ** 2));
  return F;
}

/** a point of the sheet's outer surface (ghost-local) */
function surface(g: GhostShape, th: number, d: number, out = 0): V3 {
  const r = profile(g, d) * (1 + folds(g, th, d)) + out;
  // the head is a ball; the sheet below it hangs a little flatter front to back
  const squash = 1 - 0.12 * smoothstep(g.rh, g.rh * 3, d);
  return [r * Math.cos(th), -d, r * Math.sin(th) * squash];
}

/** The sheet's point at column c (fractional), depth d: on the outer or inner shell, the free strips curled. */
function clothPoint(g: GhostShape, ci: number, d: number, inner: boolean): { p: V3; free: number } {
  const c = ((Math.round(ci) % COLS) + COLS) % COLS;
  const th = (ci / COLS) * TAU;
  const p = surface(g, th, d, inner ? -THICK : 0);
  const st = g.colStrip[c];
  const tear = g.tearD[c];
  let free = 0;
  if (d > tear) {
    const len = Math.max(0.02, g.hemD[c] - tear);
    free = Math.min(1, (d - tear) / len);
    const e = free * free;
    const out = st.curlOut * e * len * 6;
    const rr = Math.hypot(p[0], p[2]) || 1;
    p[0] += (p[0] / rr) * out;
    p[2] += (p[2] / rr) * out;
    const side = st.curlSide * e;
    const c0 = Math.cos(side);
    const s0 = Math.sin(side);
    const x = p[0] * c0 - p[2] * s0;
    p[2] = p[0] * s0 + p[2] * c0;
    p[0] = x;
  }
  return { p, free };
}

interface Builder {
  pos: number[];
  col: number[];
  uv: number[];
  idx: number[];
  depth: number[];
  free: number[];
  phase: number[];
  rope: number[];
  /** the depth where the vertex's strip of the hem begins (its tear; 99: none) */
  tear: number[];
  /** pairs of vertices on the uv seam (the same point twice): their normals are welded */
  seams: [number, number][];
  /** an extra tilt added to each vertex's normal (the folds' shading steepened), or empty */
  tilt: number[];
}
const builder = (): Builder => ({ pos: [], col: [], uv: [], idx: [], depth: [], free: [], phase: [], rope: [], tear: [], seams: [], tilt: [] });
/**
 * The folds' shading, steepened: each outer vertex's normal tilts round the axis by this many times
 * the folds' own slope again, so the flanks of the folds that face the moon turn far enough to
 * catch its rim and the ridges facing the front fill catch it: the reference's long pale streaks
 * (the silhouette is the geometry's; only the shading is pushed)
 */
const FOLD_TILT = 1.1;
/** the fabric map's repeats round a ghost and per unit down it */
const UREP = 3;
const VREP = 2.6;

/** how deep inside a hole (< 1) a point of the sheet is, at column c and depth d */
function holeDist(g: GhostShape, c: number, d: number): number {
  let q = Infinity;
  for (const h of g.holes) {
    let dc = Math.abs(c - h.c) % COLS;
    if (dc > COLS / 2) dc = COLS - dc;
    q = Math.min(q, Math.hypot(dc / h.wc, (d - h.d) / h.wd));
  }
  return q;
}

/** The cloth grid (outer or inner shell) of one ghost. */
function shell(g: GhostShape, b: Builder, inner: boolean): void {
  const base = b.pos.length / 3;
  const L = g.d.length;
  const rh = g.rh;
  const seed = g.d.seed;
  const rows: { d: (c: number) => number; tuftR?: number }[] = [];
  for (const t of TUFT) rows.push({ d: () => t.d, tuftR: t.r });
  // the ball's rows by its angle from the knot (dense where the profile turns), then on to the shoulder
  for (let k = 1; k <= HEAD_ROWS; k++) rows.push({ d: () => rh * (1 - Math.cos((k / HEAD_ROWS) * (Math.PI / 2))) });
  for (let k = 1; k <= NECK_ROWS; k++) rows.push({ d: () => rh + (g.shoulder - rh) * (k / NECK_ROWS) });
  for (let k = 1; k <= BODY_ROWS; k++) rows.push({ d: () => g.shoulder + (g.solid - g.shoulder) * (k / BODY_ROWS) });
  for (let k = 1; k <= STRIP_ROWS; k++) rows.push({ d: (c) => g.solid + (g.hemD[c] - g.solid) * (k / STRIP_ROWS) });
  const R = rows.length;
  const C = COLS + 1;
  for (let ri = 0; ri < R; ri++) {
    const row = rows[ri];
    // the folds' shading is relative to the row's mean (valleys dark, ridges catching light)
    const Fs = Array.from({ length: COLS }, (_, c) => (row.tuftR !== undefined ? 0 : folds(g, (c / COLS) * TAU, row.d(c))));
    const Fm = Fs.reduce((a, v) => a + v, 0) / COLS;
    for (let ci = 0; ci < C; ci++) {
      const c = ci % COLS;
      const th = (ci / COLS) * TAU;
      const d = row.d(c);
      let p: V3;
      let free = 0;
      if (row.tuftR !== undefined) {
        // the gathered tuft above the knot: crumpled
        const crumple = 1 + (0.3 * Math.sin(7 * th + g.cornerPhase + d * 90) + 0.14 * Math.sin(11 * th - d * 140)) * (row.tuftR > 0.01 ? 1 : 0.3);
        const r = (row.tuftR - (inner ? THICK * 0.4 : 0)) * crumple;
        p = [r * Math.cos(th), -d, r * Math.sin(th)];
      } else {
        const cp = clothPoint(g, ci, d, inner);
        p = cp.p;
        free = cp.free;
      }
      b.pos.push(...p);
      b.uv.push((ci / COLS) * UREP, d * VREP);
      b.depth.push(Math.max(0, d));
      b.free.push(free);
      b.phase.push(g.colStrip[c].phase);
      b.rope.push(0);
      b.tear.push(g.tearD[c]);
      if (ci === COLS) b.seams.push([base + ri * C, base + ri * C + COLS]);
      if (row.tuftR === undefined && !inner) {
        const eps = 0.012;
        const dF = (folds(g, th + eps, d, true) - folds(g, th - eps, d, true)) / (2 * eps);
        const k = clamp(-FOLD_TILT * dF, -0.6, 0.6) * smoothstep(rh * 0.9, rh * 1.8, d);
        b.tilt.push(-Math.sin(th) * k, 0, Math.cos(th) * k);
      } else b.tilt.push(0, 0, 0);
      // colour: fold valleys dark, ridges lighter and streaked pale; the pinch under the ball shaded
      const dF = Fs[c] - Fm;
      // (the pleats shaded deep: lit flat by the night, they read as a smooth velvet hood)
      let ao = clamp(1 + 4.2 * Math.max(0, dF), 1, 1.75);
      // a valley's shade: a colour (its red holds), from 0 on the mean to 1 in the deepest
      const vy = clamp(-13.0 * Math.min(0, dF), 0, 1);
      ao *= 1 - 0.28 * Math.exp(-(((d - rh * 1.62) / (rh * 0.4)) ** 2));
      if (row.tuftR !== undefined) ao *= 0.75 + 0.2 * Math.sin(7 * th + g.cornerPhase);
      // the frayed rims of the holes, darker
      const hq = holeDist(g, ci, d);
      ao *= 1 - 0.4 * smoothstep(1.7, 1.0, hq);
      // the hem's edge a touch darker (thicker, folded over), the very edge of each strip
      ao *= 1 - 0.18 * smoothstep(g.hemD[c] - 0.03, g.hemD[c], d);
      // the moon's streaks: down the fold ridges (every ridge a little, the moon's flank most),
      // broken along their length like a painter's dry-brush
      const flank = Math.exp(-((angDist(th, -0.45) / 0.85) ** 2));
      // (and the painted streaks down the crests, each fading in and out along its length)
      let streak = 0;
      for (const st of g.streaks) {
        const x = angDist(th, st.th) / st.w;
        if (x > 3) continue;
        const along = smoothstep(st.d0, st.d0 + 0.08, d) * (1 - smoothstep(st.d1 - 0.1, st.d1, d));
        streak = Math.max(streak, st.k * Math.exp(-x * x) * along);
      }
      const ridge = Math.min(1, 5 * Math.max(0, dF));
      const broken = clamp(0.6 + 0.7 * fbm2(th * 2.4 + seed, d * 3.2, seed + 3, 2, 1), 0.15, 1);
      const sheen = Math.min(0.85, (flank * (0.2 + 2.4 * Math.max(0, dF)) + 0.35 * ridge) * broken * smoothstep(rh * 0.8, rh * 1.9, d) + 0.9 * streak * (0.7 + 0.3 * broken));
      // the rim's share: the body full, none on the free strips (edge-on they flashed thin slivers)
      let alpha = free > 0.5 ? 0 : 0.95 * (1 - 1.9 * free);
      if (inner) {
        ao *= 0.3;
        alpha = 0.1;
      }
      // a cool, dusty cast toward the hem
      const hemT = smoothstep(L * 0.5, L * 1.05, d);
      const tint = [1 - 0.06 * hemT, 1 - 0.02 * hemT, 1 + 0.04 * hemT];
      const k = inner ? 0 : sheen;
      for (let q = 0; q < 3; q++) b.col.push(Math.max(0, ao * (1 - vy * (1 - VALLEY[q])) * tint[q] * (CLOTH[q] * (1 - k) + SHEEN[q] * k)));
      b.col.push(Math.max(0, alpha));
    }
  }
  for (let ri = 0; ri < R - 1; ri++)
    for (let c = 0; c < COLS; c++) {
      // the holes: no cell where its middle falls inside one (both shells), the outline ragged
      if (ri >= TUFT.length + HEAD_ROWS) {
        const dm = 0.5 * (rows[ri].d(c) + rows[ri + 1].d(c));
        const q = holeDist(g, c + 0.5, dm);
        if (q < 1 + 0.45 * (rand(seed, 700 + ri * COLS + c, 0) - 0.5)) continue;
      }
      const a = base + ri * C + c;
      const bb = a + 1;
      const cc = a + C;
      const dd = bb + C;
      // outward faces wind counter-clockwise seen from outside; the inner shell faces in
      if (inner) b.idx.push(a, cc, bb, bb, cc, dd);
      else b.idx.push(a, bb, cc, bb, dd, cc);
    }
}

/** The threads dripping below the hem: thin tapering tubes, hung from the hem and fluttering. */
function threads(g: GhostShape, b: Builder): void {
  const SIDES = 5;
  const N = 8;
  for (const dr of g.drips) {
    const d0 = g.hemD[dr.c] - 0.015;
    const top = clothPoint(g, dr.c + 0.5, d0, false).p;
    const rr = Math.hypot(top[0], top[2]) || 1;
    const out: V3 = [top[0] / rr, 0, top[2] / rr];
    const side: V3 = [-out[2], 0, out[0]];
    const base = b.pos.length / 3;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const c: V3 = [top[0] + out[0] * dr.bend * t * t + side[0] * dr.side * t * t, top[1] - dr.len * t, top[2] + out[2] * dr.bend * t * t + side[2] * dr.side * t * t];
      // a frayed thread: tapering to nothing, a little lumpy, flattened like a torn ribbon
      const r = dr.r * (1 - 0.85 * t) * (1 + 0.15 * Math.sin(t * 9 + dr.phase));
      for (let k = 0; k < SIDES; k++) {
        const a = (k / SIDES) * TAU;
        b.pos.push(c[0] + (out[0] * Math.cos(a) * 0.45 + side[0] * Math.sin(a)) * r, c[1], c[2] + (out[2] * Math.cos(a) * 0.45 + side[2] * Math.sin(a)) * r);
        b.uv.push(k / SIDES, t);
        b.depth.push(d0 + dr.len * t);
        b.free.push(0.4 + 0.6 * t);
        b.phase.push(dr.phase);
        b.rope.push(0);
        b.tear.push(g.tearD[dr.c]);
        const v = 0.8 + 0.1 * Math.cos(a);
        b.col.push(CLOTH[0] * v, CLOTH[1] * v, CLOTH[2] * v, 0);
      }
    }
    for (let i = 0; i < N; i++)
      for (let k = 0; k < SIDES; k++) {
        const a = base + i * SIDES + k;
        const bb = base + i * SIDES + ((k + 1) % SIDES);
        b.idx.push(a, bb, a + SIDES, bb, bb + SIDES, a + SIDES);
      }
  }
}

/** rope: radius, sides, rows per unit, the lay's repeat (three plies) */
const ROPE_R = 0.0105;
const ROPE_SIDES = 8;
const ROPE_ROWS_PER_UNIT = 120;
const ROPE_LAY = 0.026;

/**
 * A twisted three-ply rope from the tie up `len` (its rest y is the distance up from the tie: the
 * pose lays it from the hook down, so letting the ghost down pays rope out of the wrap above).
 */
function rope(g: GhostShape, b: Builder, len: number): void {
  const N = Math.max(8, Math.ceil(len * ROPE_ROWS_PER_UNIT));
  const base = b.pos.length / 3;
  const ph = g.cornerPhase;
  for (let i = 0; i <= N; i++) {
    const dist = (i / N) * len;
    const wob = 1 + 0.06 * Math.sin(dist * 23 + ph) + 0.03 * Math.sin(dist * 61 + 2 * ph);
    for (let k = 0; k < ROPE_SIDES; k++) {
      const a = (k / ROPE_SIDES) * TAU;
      // three plies spiralling up the rope: the section bulges at each strand, grooved between
      const ply = 0.5 + 0.5 * Math.cos(3 * (a - (dist / ROPE_LAY) * (TAU / 3)));
      const r = ROPE_R * wob * (0.86 + 0.24 * ply);
      b.pos.push(Math.cos(a) * r, dist, Math.sin(a) * r);
      b.uv.push(k / ROPE_SIDES, dist * 3);
      b.depth.push(0);
      b.free.push(0);
      b.phase.push(0);
      b.rope.push(1);
      b.tear.push(99);
      const v = 0.6 + 0.4 * ply;
      b.col.push(ROPE[0] * v, ROPE[1] * v, ROPE[2] * v, 0.3);
    }
  }
  for (let i = 0; i < N; i++)
    for (let k = 0; k < ROPE_SIDES; k++) {
      const a = base + i * ROPE_SIDES + k;
      const bb = base + i * ROPE_SIDES + ((k + 1) % ROPE_SIDES);
      b.idx.push(a, a + ROPE_SIDES, bb, bb, a + ROPE_SIDES, bb + ROPE_SIDES);
    }
}

/** The knot gathering the sheet at the tie (two lumpy turns) and the rope's cut end, frayed. */
function knot(g: GhostShape, b: Builder): void {
  const ring = (RM: number, RT: number, y: number, tilt: number, seedK: number) => {
    const kb = b.pos.length / 3;
    const U = 14;
    const V = 6;
    for (let i = 0; i < U; i++) {
      const u = (i / U) * TAU;
      for (let k = 0; k < V; k++) {
        const v = (k / V) * TAU;
        const lump = 1 + 0.18 * Math.sin(3 * u + seedK) * Math.cos(v);
        const rr = RM + RT * lump * Math.cos(v);
        b.pos.push(Math.cos(u) * rr, y + RT * Math.sin(v) * 1.15 + tilt * Math.sin(u + seedK), Math.sin(u) * rr);
        b.uv.push(i / U, k / V);
        b.depth.push(0);
        b.free.push(0);
        b.phase.push(0);
        b.rope.push(0);
        b.tear.push(99);
        const ply = 0.6 + 0.4 * (0.5 + 0.5 * Math.cos(3 * v + 5 * u));
        b.col.push(ROPE[0] * ply, ROPE[1] * ply, ROPE[2] * ply, 0.4);
      }
    }
    for (let i = 0; i < U; i++)
      for (let k = 0; k < V; k++) {
        const a = kb + i * V + k;
        const bb = kb + ((i + 1) % U) * V + k;
        const c = kb + i * V + ((k + 1) % V);
        const d = kb + ((i + 1) % U) * V + ((k + 1) % V);
        b.idx.push(a, c, bb, bb, c, d);
      }
  };
  ring(0.0165, 0.0085, -0.003, 0.003, g.cornerPhase);
  ring(0.0185, 0.0075, -0.014, 0.004, g.cornerPhase + 2);
  // the cut end: out of the knot, down and away, splitting into fibres
  const a0 = g.cornerPhase + 1.1;
  const out: V3 = [Math.cos(a0), 0, Math.sin(a0)];
  const tube = (pts: V3[], r0: number, r1: number, sides: number) => {
    const base = b.pos.length / 3;
    pts.forEach((p, i) => {
      const t = i / (pts.length - 1);
      const q = pts[Math.min(pts.length - 1, i + 1)];
      const o = pts[Math.max(0, i - 1)];
      const dv = [q[0] - o[0], q[1] - o[1], q[2] - o[2]];
      const l = Math.hypot(dv[0], dv[1], dv[2]) || 1;
      const dn: V3 = [dv[0] / l, dv[1] / l, dv[2] / l];
      const s1: V3 = [-dn[2], 0, dn[0]];
      const sl = Math.hypot(s1[0], s1[2]) || 1;
      s1[0] /= sl;
      s1[2] /= sl;
      const s2: V3 = [dn[1] * s1[2] - dn[2] * s1[1], dn[2] * s1[0] - dn[0] * s1[2], dn[0] * s1[1] - dn[1] * s1[0]];
      const r = r0 + (r1 - r0) * t;
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * TAU;
        b.pos.push(p[0] + (s1[0] * Math.cos(a) + s2[0] * Math.sin(a)) * r, p[1] + (s1[1] * Math.cos(a) + s2[1] * Math.sin(a)) * r, p[2] + (s1[2] * Math.cos(a) + s2[2] * Math.sin(a)) * r);
        b.uv.push(k / sides, t);
        b.depth.push(Math.max(0, -p[1]));
        b.free.push(0);
        b.phase.push(0);
        b.rope.push(0);
        b.tear.push(99);
        b.col.push(ROPE[0] * 0.85, ROPE[1] * 0.85, ROPE[2] * 0.85, 0.05);
      }
    });
    for (let i = 0; i < pts.length - 1; i++)
      for (let k = 0; k < sides; k++) {
        const a = base + i * sides + k;
        const bb = base + i * sides + ((k + 1) % sides);
        b.idx.push(a, bb, a + sides, bb, bb + sides, a + sides);
      }
  };
  const R0 = 0.024;
  const p0: V3 = [out[0] * R0, -0.008, out[2] * R0];
  const p1: V3 = [out[0] * (R0 + 0.014), -0.022, out[2] * (R0 + 0.014)];
  const p2: V3 = [out[0] * (R0 + 0.022), -0.04, out[2] * (R0 + 0.022)];
  tube([p0, p1, p2], 0.0075, 0.0062, 6);
  for (let k = 0; k < 4; k++) {
    const a = a0 + (k - 1.5) * 0.5;
    const len = 0.018 + 0.012 * rand(g.d.seed, 800 + k, 0);
    const dir: V3 = [Math.cos(a) * 0.5, -0.85, Math.sin(a) * 0.5];
    const q1: V3 = [p2[0] + dir[0] * len * 0.5, p2[1] + dir[1] * len * 0.5, p2[2] + dir[2] * len * 0.5];
    const q2: V3 = [p2[0] + dir[0] * len + out[0] * 0.004, p2[1] + dir[1] * len, p2[2] + dir[2] * len + out[2] * 0.004];
    tube([p2, q1, q2], 0.0026, 0.0006, 4);
  }
}

/** The two slanted almond eyes and their soft halos (ghost-local), uvs into the glow atlas. */
function eyes(g: GhostShape): { pos: number[]; uv: number[]; idx: number[]; depth: number[] } {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const depth: number[] = [];
  const e = g.d.eye;
  const de = g.eyeD;
  const re = profile(g, de);
  const LEN = g.rh * e.len;
  const H = g.rh * e.h;
  const N = 48;
  const place = (the: number, s: number, u0: number, v0: number, out: number) => {
    // the slant: the inner end (toward the face's middle) lower
    const sl = s * e.slant;
    const u = u0 * Math.cos(sl) - v0 * Math.sin(sl);
    const v = u0 * Math.sin(sl) + v0 * Math.cos(sl);
    const th = the - u / re;
    const d = de - v;
    pos.push(...surface(g, th, d, out));
    depth.push(d);
  };
  for (const s of [1, -1]) {
    // s = 1: the eye on the ghost's left (the viewer's right), at a smaller angle than the face's middle
    const the = Math.PI / 2 - s * e.sep;
    // the halo: a soft patch on the cloth round the eye, 2.2× its size (the atlas's right half)
    {
      const HX = 8;
      const HY = 6;
      const base = pos.length / 3;
      for (let j = 0; j <= HY; j++)
        for (let i = 0; i <= HX; i++) {
          const x = (i / HX) * 2 - 1;
          const y = (j / HY) * 2 - 1;
          place(the, s, x * LEN * 1.1, y * H * 2.6, 0.0042);
          // (inset from the atlas's middle: linear filtering there would bleed the eye's lit edge into a line)
          uv.push(0.54 + 0.42 * (i / HX), 0.04 + 0.92 * (j / HY));
        }
      for (let j = 0; j < HY; j++)
        for (let i = 0; i < HX; i++) {
          const a = base + j * (HX + 1) + i;
          idx.push(a, a + 1, a + HX + 1, a + 1, a + HX + 2, a + HX + 1);
        }
    }
    const base = pos.length / 3;
    place(the, s, 0, 0, 0.0036);
    uv.push(0.25, 0.5);
    for (let i = 0; i < N; i++) {
      const t = (i / N) * TAU;
      const a = Math.cos(t);
      // an almond: the upper lid flatter than the lower; pointed at both ends
      const up = Math.sin(t) > 0;
      const yv = Math.sin(t) * H * (up ? 0.55 : 1.0) * (1 - a * a) ** 0.15;
      place(the, s, a * LEN * 0.5, yv, 0.0036);
      uv.push(0.25 + 0.25 * a, (Math.sin(t) + 1) / 2);
    }
    for (let i = 0; i < N; i++) idx.push(base, base + 1 + ((i + 1) % N), base + 1 + i);
  }
  return { pos, uv, idx, depth };
}

function normals(pos: number[], idx: number[]): Float32Array {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = (g.getAttribute('normal').array as Float32Array).slice();
  g.dispose();
  return n;
}

// ---- the limb: hooks and the wraps (static, world) --------------------------------------------------

/** The hero limb's ring nearest a world point, and its arc length. */
function nearestRing(p: readonly number[]): Ring {
  const limb = findTube(ghostTreeSkeleton(), 'hero')!;
  let best = Infinity;
  let ring = limb.rings[0];
  for (const r of limb.rings) {
    const dd = Math.hypot(r.pos.x + GHOST_BASE[0] - p[0], r.pos.y + GHOST_BASE[1] - p[1], r.pos.z + GHOST_BASE[2] - p[2]);
    if (dd < best) {
      best = dd;
      ring = r;
    }
  }
  return ring;
}

/**
 * A rope's hook on the hero limb's underside at arc length `along` from where it leaves the trunk
 * (world), read off the bark as world/Trees.tsx reads GHOST_HOOKS.
 */
export function limbHook(along: number): V3 {
  const skel = ghostTreeSkeleton();
  const limb = findTube(skel, 'hero')!;
  const p = surfacePoint(skel, limb, along, new Vector3(0, -1, 0));
  return [p.x + GHOST_BASE[0], p.y + GHOST_BASE[1], p.z + GHOST_BASE[2]];
}


/** Three tight turns of rope round the limb at each hook, fitted to the bark (in the plane across the limb). */
function wraps(hooks: Hooks): { pos: number[]; col: number[]; idx: number[] } {
  const skel = ghostTreeSkeleton();
  const limb = findTube(skel, 'hero');
  const out = { pos: [] as number[], col: [] as number[], idx: [] as number[] };
  if (!limb) return out;
  const RT = 0.0085;
  hooks.forEach((h, gi) => {
    const ring = nearestRing(h);
    const t = ring.tangent.clone().normalize();
    const down = new Vector3(0, -1, 0).addScaledVector(t, t.y).normalize();
    const side = new Vector3().crossVectors(t, down).normalize();
    // (two turns, a gap between them: three abutting read as a solid dark band on the limb)
    const turns = [-0.013, 0.013];
    turns.forEach((off, ti) => {
      const s = ring.along + off;
      const U = 28;
      const V = 6;
      // the bark's radius round the ring (a tight rope bridges the furrows: the max of its neighbours)
      const c = new Vector3(ring.pos.x, ring.pos.y, ring.pos.z).addScaledVector(t, off);
      const raw: Vector3[] = [];
      const rr: number[] = [];
      for (let i = 0; i < U; i++) {
        const u = (i / U) * TAU;
        const dir = down.clone().multiplyScalar(Math.cos(u)).addScaledVector(side, Math.sin(u));
        const sp = surfacePoint(skel, limb, s, dir);
        raw.push(sp);
        rr.push(sp.distanceTo(c));
      }
      const base = out.pos.length / 3;
      for (let i = 0; i < U; i++) {
        const u = (i / U) * TAU;
        const rad = Math.max(rr[(i + U - 1) % U], rr[i], rr[(i + 1) % U]) + RT - 0.004;
        const radial = down.clone().multiplyScalar(Math.cos(u)).addScaledVector(side, Math.sin(u));
        // the turn creeps along the limb as it goes round (a spiral, not a ring)
        const ctr = c.clone().addScaledVector(radial, rad).addScaledVector(t, 0.005 * (i / U - 0.5) + 0.0015 * Math.sin(3 * u + gi + ti));
        for (let k = 0; k < V; k++) {
          const v = (k / V) * TAU;
          const p = ctr.clone().addScaledVector(radial, Math.cos(v) * RT).addScaledVector(t, Math.sin(v) * RT);
          out.pos.push(p.x + GHOST_BASE[0], p.y + GHOST_BASE[1], p.z + GHOST_BASE[2]);
          const ply = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(3 * v + u * 9));
          out.col.push(ROPE[0] * ply, ROPE[1] * ply, ROPE[2] * ply, 0.3);
        }
      }
      for (let i = 0; i < U; i++)
        for (let k = 0; k < V; k++) {
          const a = base + i * V + k;
          const bb = base + ((i + 1) % U) * V + k;
          const cc = base + i * V + ((k + 1) % V);
          const dd = base + ((i + 1) % U) * V + ((k + 1) % V);
          out.idx.push(a, bb, cc, bb, dd, cc);
        }
    });
  });
  return out;
}

// ---- the whole set: rest data and the per-frame pose -------------------------------------------------

/** A posed mesh: its geometry and, per vertex, ghost index (255 = static wrap), rest local position and normal, depth, freedom, phase, rope flag. */
interface Part {
  geo: BufferGeometry;
  ghost: Uint8Array;
  rest: Float32Array;
  restN: Float32Array;
  depth: Float32Array;
  free: Float32Array;
  phase: Float32Array;
  rope: Uint8Array;
  tear: Float32Array;
}

interface Built {
  /** the sheets and their threads (they cast the shadows) */
  cloth: Part;
  /** the ropes, their knots and the wraps on the limb (no shadow: a rope's shadow on the path read as a pole) */
  lines: Part;
  eyes: BufferGeometry;
  eyeGhost: Uint8Array;
  eyeRest: Float32Array;
  eyeRestN: Float32Array;
  eyeDepth: Float32Array;
  /** the depth of each eye vertex's eye centre (the shut eyes squash onto it) */
  eyeCentre: Float32Array;
  /** 1 on the halos' vertices, 0 on the eyes' */
  eyeHalo: Uint8Array;
  tris: number;
}

/** Each ghost's shape and its drop (the peek ghost's from its hook's height). */
function shapes(hooks: Hooks): { g: GhostShape; drop: number }[] {
  return DESIGNS.map((d, gi) => {
    const g = design(d);
    const h = hooks[gi];
    const drop = d.drop === 'peek' ? Math.max(0, h[1] - d.rope - g.eyeD - (FLOOR + groundHeight(h[0], h[2]) + PEEK_EYES)) : d.drop;
    return { g, drop };
  });
}

function part(all: Builder, ghostIdx: number[], restN: number[]): Part {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(all.pos.slice(), 3));
  geo.setAttribute('normal', new Float32BufferAttribute(restN.slice(), 3));
  geo.setAttribute('color', new Float32BufferAttribute(all.col, 4));
  geo.setAttribute('uv', new Float32BufferAttribute(all.uv, 2));
  geo.setIndex(all.idx);
  return {
    geo,
    ghost: Uint8Array.from(ghostIdx),
    rest: Float32Array.from(all.pos),
    restN: Float32Array.from(restN),
    depth: Float32Array.from(all.depth),
    free: Float32Array.from(all.free),
    phase: Float32Array.from(all.phase),
    rope: Uint8Array.from(all.rope),
    tear: Float32Array.from(all.tear),
  };
}

function build(hooks: Hooks): Built {
  const set = shapes(hooks);
  const all = builder();
  const ghostIdx: number[] = [];
  const restN: number[] = [];
  const lines = builder();
  const lineGhost: number[] = [];
  const lineN: number[] = [];
  const eyeAll = { pos: [] as number[], uv: [] as number[], idx: [] as number[], depth: [] as number[], ghost: [] as number[], nrm: [] as number[], centre: [] as number[], halo: [] as number[] };
  set.forEach(({ g, drop }, gi) => {
    for (const inner of [false, true]) {
      const b = builder();
      shell(g, b, inner);
      const n = normals(b.pos, b.idx);
      for (let i = 0; i < n.length / 3; i++) {
        const x = n[i * 3] + b.tilt[i * 3];
        const y = n[i * 3 + 1] + b.tilt[i * 3 + 1];
        const z = n[i * 3 + 2] + b.tilt[i * 3 + 2];
        const l = Math.hypot(x, y, z) || 1;
        n[i * 3] = x / l;
        n[i * 3 + 1] = y / l;
        n[i * 3 + 2] = z / l;
      }
      for (const [i, j] of b.seams) {
        const x = n[i * 3] + n[j * 3];
        const y = n[i * 3 + 1] + n[j * 3 + 1];
        const z = n[i * 3 + 2] + n[j * 3 + 2];
        const l = Math.hypot(x, y, z) || 1;
        n[i * 3] = n[j * 3] = x / l;
        n[i * 3 + 1] = n[j * 3 + 1] = y / l;
        n[i * 3 + 2] = n[j * 3 + 2] = z / l;
      }
      append(all, b, gi, ghostIdx, restN, n);
    }
    {
      const b = builder();
      threads(g, b);
      append(all, b, gi, ghostIdx, restN, normals(b.pos, b.idx));
    }
    {
      const b = builder();
      knot(g, b);
      append(lines, b, gi, lineGhost, lineN, normals(b.pos, b.idx));
    }
    {
      // the rope, long enough for its lowest let-down (its rest y is a distance up from the tie)
      const rb = builder();
      rope(g, rb, g.d.rope + LOWER_MAX * drop + 0.02);
      append(lines, rb, gi, lineGhost, lineN, normals(rb.pos, rb.idx));
    }
    const e = eyes(g);
    const eb = eyeAll.pos.length / 3;
    pushAll(eyeAll.pos, e.pos);
    pushAll(eyeAll.uv, e.uv);
    pushAll(eyeAll.depth, e.depth);
    for (const i of e.idx) eyeAll.idx.push(eb + i);
    for (let i = 0; i < e.pos.length / 3; i++) {
      eyeAll.ghost.push(gi);
      eyeAll.centre.push(g.eyeD);
      // (the halos sit in the glow atlas's right half)
      eyeAll.halo.push(e.uv[i * 2] > 0.52 ? 1 : 0);
    }
    pushAll(eyeAll.nrm, normals(e.pos, e.idx));
  });
  const w = wraps(hooks);
  {
    const base = lines.pos.length / 3;
    pushAll(lines.pos, w.pos);
    pushAll(lines.col, w.col);
    for (let i = 0; i < w.pos.length / 3; i++) lines.uv.push(0, 0);
    for (const i of w.idx) lines.idx.push(base + i);
    const wn = normals(w.pos, w.idx);
    for (let i = 0; i < w.pos.length / 3; i++) {
      lineGhost.push(255);
      lines.depth.push(0);
      lines.free.push(0);
      lines.phase.push(0);
      lines.rope.push(0);
      lines.tear.push(99);
      lineN.push(wn[i * 3], wn[i * 3 + 1], wn[i * 3 + 2]);
    }
  }
  const eyesG = new BufferGeometry();
  eyesG.setAttribute('position', new Float32BufferAttribute(eyeAll.pos.slice(), 3));
  eyesG.setAttribute('normal', new Float32BufferAttribute(eyeAll.nrm.slice(), 3));
  eyesG.setAttribute('uv', new Float32BufferAttribute(eyeAll.uv, 2));
  eyesG.setIndex(eyeAll.idx);
  return {
    cloth: part(all, ghostIdx, restN),
    lines: part(lines, lineGhost, lineN),
    eyes: eyesG,
    eyeGhost: Uint8Array.from(eyeAll.ghost),
    eyeRest: Float32Array.from(eyeAll.pos),
    eyeRestN: Float32Array.from(eyeAll.nrm),
    eyeDepth: Float32Array.from(eyeAll.depth),
    eyeCentre: Float32Array.from(eyeAll.centre),
    eyeHalo: Uint8Array.from(eyeAll.halo),
    tris: (all.idx.length + lines.idx.length + eyeAll.idx.length) / 3,
  };
}

/** dst.push(...src), without spreading a long array into arguments */
function pushAll(dst: number[], src: ArrayLike<number>): void {
  for (let i = 0; i < src.length; i++) dst.push(src[i]);
}

function append(all: Builder, b: Builder, gi: number, ghostIdx: number[], restN: number[], n: ArrayLike<number>): void {
  const base = all.pos.length / 3;
  pushAll(all.pos, b.pos);
  pushAll(all.col, b.col);
  pushAll(all.uv, b.uv);
  for (const i of b.idx) all.idx.push(base + i);
  pushAll(all.depth, b.depth);
  pushAll(all.free, b.free);
  pushAll(all.phase, b.phase);
  pushAll(all.rope, b.rope);
  pushAll(all.tear, b.tear);
  for (let i = 0; i < b.pos.length / 3; i++) {
    ghostIdx.push(gi);
    restN.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
  }
}

/** Each ghost's pose at a time: per depth bin, the 3x3 rotation (row-major) and the tie's world point. */
interface GhostPose {
  m: Float32Array;
  o: Float32Array;
  /** the swing alone (no yaw) at the rope (bin 0), for the rope's points */
  rm: Float32Array;
  hook: V3;
  ropeLen: number;
  flutter: number;
  /** how much of the sheet hangs open (Infinity: all of it; the peek ghost's gathered rest: GATHER_MIN) */
  ell: number;
  /** the eyes, 0 shut .. 1 open, and how wide they go (1: as built) */
  eyeOpen: number;
  eyeWide: number;
  /** how far the bundled sheet has paid out, 0 .. 1 (the strips' fringe lengthens with it) */
  payout: number;
}

/** The yaw that faces a hook toward the hero eye (0 faces +z). */
function heroYaw(h: readonly number[]): number {
  return Math.atan2(HERO.pos[0] - h[0], HERO.pos[2] - h[2]);
}

function rotation(ax: number, az: number, yaw: number, out: Float32Array, o: number): void {
  // R = Rz(az) · Rx(ax) · Ry(yaw), row-major
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  const cz = Math.cos(az);
  const sz = Math.sin(az);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const a = [cy, 0, sy, sx * sy, cx, -sx * cy, -cx * sy, sx, cx * cy];
  out[o + 0] = cz * a[0] - sz * a[3];
  out[o + 1] = cz * a[1] - sz * a[4];
  out[o + 2] = cz * a[2] - sz * a[5];
  out[o + 3] = sz * a[0] + cz * a[3];
  out[o + 4] = sz * a[1] + cz * a[4];
  out[o + 5] = sz * a[2] + cz * a[5];
  out[o + 6] = a[6];
  out[o + 7] = a[7];
  out[o + 8] = a[8];
}

/** out = a · b (3x3, row-major; out may not alias b) */
function mul3(a: Float32Array, ao: number, b: readonly number[], out: Float32Array, oo: number): void {
  const r0 = a[ao];
  const r1 = a[ao + 1];
  const r2 = a[ao + 2];
  const r3 = a[ao + 3];
  const r4 = a[ao + 4];
  const r5 = a[ao + 5];
  const r6 = a[ao + 6];
  const r7 = a[ao + 7];
  const r8 = a[ao + 8];
  for (let c = 0; c < 3; c++) {
    out[oo + c] = r0 * b[c] + r1 * b[3 + c] + r2 * b[6 + c];
    out[oo + 3 + c] = r3 * b[c] + r4 * b[3 + c] + r5 * b[6 + c];
    out[oo + 6 + c] = r6 * b[c] + r7 * b[3 + c] + r8 * b[6 + c];
  }
}

/** The ghost-local bow and cock: Rz(cock) · Rx(bow) about the tie (bow > 0 pitches the face down). */
function bowCock(bow: number, cock: number): number[] {
  const cb = Math.cos(bow);
  const sb = Math.sin(bow);
  const cc = Math.cos(cock);
  const sc = Math.sin(cock);
  // Rx(bow): y' = y cos − z sin, z' = y sin + z cos; then Rz(cock): x' = x cos − y sin, y' = x sin + y cos
  return [cc, -sc * cb, sc * sb, sc, cc * cb, -cc * sb, 0, sb, cb];
}

function posesAt(f: number, lower: readonly number[], hooks: Hooks, drops: readonly number[]): GhostPose[] {
  const t = f / FPS;
  return DESIGNS.map((d, gi) => {
    const hook = [...hooks[gi]] as V3;
    const lo = Math.min(LOWER_MAX, Math.max(0, lower[gi] ?? 0));
    const ropeLen = d.rope + lo * drops[gi];
    const ph = rand(d.seed, 1, 7) * TAU;
    const yaw0 = heroYaw(hook) + d.yaw;
    const peek = gi === PEEK;
    const yawL = peek ? yaw0 + (PEEK_YAW - yaw0) * smoothstep(0.2, 0.9, lo) : yaw0;
    // the peek: low over him it bows its head to peer down at him and cocks it, curious (a slow
    // tilt from one side to the other while it hangs there)
    const near = peek ? smoothstep(0.3, 0.95, Math.min(1, lo)) : 0;
    const rh = d.head;
    const cock = near * PEEK_COCK * Math.sin(t * 2.1 + 0.6);
    const m = new Float32Array(BINS * 9);
    const o = new Float32Array(BINS * 3);
    const rm = new Float32Array(9);
    const swing = (tt: number, depth: number) => {
      const amp = 1 + 0.15 * depth;
      const ax = 0.042 * amp * Math.sin((TAU * tt) / d.period + ph);
      const az = 0.03 * amp * Math.sin((TAU * tt) / (d.period * 1.27) + ph * 1.7);
      const tw = 0.06 * Math.sin((TAU * tt) / (d.period * 2.1) + ph * 0.6);
      return { ax, az, tw };
    };
    {
      const s = swing(t, 0);
      rotation(s.ax, s.az, 0, rm, 0);
    }
    const r = new Float32Array(9);
    for (let bi = 0; bi < BINS; bi++) {
      const depth = bi * BIN_DEPTH;
      const tt = t - LAG * depth;
      const s = swing(tt, depth);
      rotation(s.ax, s.az, yawL + s.tw, m, bi * 9);
      if (near > 0) {
        // the head bows the most, the body leans after it a little (its hem trails back)
        const head = 1 - smoothstep(rh * 1.2, rh * 3.4, depth);
        const bc = bowCock(near * (PEEK_LEAN + (PEEK_BOW - PEEK_LEAN) * head), cock * (0.25 + 0.75 * head));
        mul3(m, bi * 9, bc, m, bi * 9);
      }
      // the tie hangs on the rope, swung at the lagged time (continuous with the rope at bin 0)
      rotation(s.ax, s.az, 0, r, 0);
      o[bi * 3 + 0] = hook[0] + r[1] * -ropeLen;
      o[bi * 3 + 1] = hook[1] + r[4] * -ropeLen;
      o[bi * 3 + 2] = hook[2] + r[7] * -ropeLen;
    }
    // the peek ghost pays its sheet out of the bundle over the first part of its let-down, opens
    // its eyes, and they go wide as it comes close over him
    const payout = peek ? smoothstep(0.05, 0.65, lo) : 1;
    const ell = peek ? GATHER_MIN + payout * MAX_DEPTH * 1.2 : Infinity;
    const eyeOpen = peek ? smoothstep(0.35, 0.75, lo) : 1;
    const eyeWide = 1 + 0.4 * near;
    return { m, o, rm, hook, ropeLen, flutter: t * TAU * 0.55, ell, eyeOpen, eyeWide, payout };
  });
}

/** A ghost-local point's world position in a pose. */
function placeAt(g: GhostPose, x: number, y: number, z: number, depth: number): V3 {
  const bi = Math.min(BINS - 1, Math.round(Math.max(0, depth) / BIN_DEPTH));
  const m = g.m;
  const o = bi * 9;
  return [g.o[bi * 3] + m[o] * x + m[o + 1] * y + m[o + 2] * z, g.o[bi * 3 + 1] + m[o + 3] * x + m[o + 4] * y + m[o + 5] * z, g.o[bi * 3 + 2] + m[o + 6] * x + m[o + 7] * y + m[o + 8] * z];
}

/**
 * Where each ghost is at a frame (world): the tie, the middle between its eyes, the lowest point
 * of its hem and threads, and its hem's radius. For framing (the shoo's camera) and tests.
 */
export function ghostMarks(f: number, lower: readonly number[] = [0, 0, 0], hooks: Hooks = GHOST_HOOKS): { tie: V3; eyes: V3; bottom: V3; hem: number }[] {
  const set = shapes(hooks);
  const poses = posesAt(
    f,
    lower,
    hooks,
    set.map((s) => s.drop),
  );
  return set.map(({ g }, gi) => {
    const p = poses[gi];
    const e = surface(g, Math.PI / 2, g.eyeD);
    // (bundled, the lowest point is a strip's end in the fringe: bounded by the deepest tear's rim plus the longest strip)
    const bd = p.ell >= g.bottom ? g.bottom : gatheredDepth(Math.max(...g.tears), p.ell) + (g.bottom - g.solid) * (GATHER_FRINGE + (1 - GATHER_FRINGE) * p.payout);
    return { tie: placeAt(p, 0, 0, 0, 0), eyes: placeAt(p, e[0], e[1], e[2], g.eyeD), bottom: placeAt(p, 0, -bd, 0, bd), hem: g.d.hem };
  });
}

// ---- the glow of the eyes: a hot almond fading to 60% at its lids, and a soft halo --------------------

let eyeTex: CanvasTexture | null = null;
function eyeGlow(): CanvasTexture {
  if (eyeTex) return eyeTex;
  const W = 128;
  const H = 32;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const v = (y + 0.5) / H - 0.5;
      if (x >= W / 2 - 2 && x < W / 2 + 2) {
        // a black gutter between the eye and the halo
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 0;
      } else if (x < W / 2) {
        // the eye: pale cream at its heart (the reference's eyes read cream, not yellow), a warmer
        // cream toward the lids, never below 60%
        const u = (x + 0.5) / (W / 2) - 0.5;
        const r = Math.min(1, Math.hypot(u * 2.0, v * 2.0));
        const k = 1 - 0.4 * smoothstep(0.2, 1.0, r);
        img.data[o] = Math.round(255 * Math.min(1, 0.95 * k));
        img.data[o + 1] = Math.round(255 * 0.86 * k ** 1.2);
        img.data[o + 2] = Math.round(255 * 0.72 * k ** 1.8);
      } else {
        // the halo: a warm breath on the cloth, from its middle to nothing at its edge
        const u = (x - W / 2 + 0.5) / (W / 2) - 0.5;
        const r = Math.hypot(u * 2, v * 2);
        const k = 0.16 * Math.exp(-r * r * 3.2) * (1 - smoothstep(0.75, 1.0, r));
        img.data[o] = Math.round(255 * k);
        img.data[o + 1] = Math.round(255 * k * 0.68);
        img.data[o + 2] = Math.round(255 * k * 0.36);
      }
      img.data[o + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  eyeTex = new CanvasTexture(c);
  eyeTex.colorSpace = SRGBColorSpace;
  return eyeTex;
}

// ---- the fabric: coarse burlap, mottled and streaked (one tile, drawn once from seeded noise) ----------

let fabricTex: { map: CanvasTexture; bump: CanvasTexture } | null = null;
function fabric(): { map: CanvasTexture; bump: CanvasTexture } {
  if (fabricTex) return fabricTex;
  const W = 256;
  const H = 256;
  const val = new Float32Array(W * H);
  const bumpV = new Float32Array(W * H);
  // tileable noise: fbm with `fu` features across the tile and `fv` down it (integers), the four
  // shifted copies blended so it wraps both ways (no diagonal lattice, unlike sampling a torus)
  const tn = (u: number, v: number, seed: number, fu: number, fv: number, oct = 3) => {
    const x = u * fu;
    const y = v * fv;
    const n = (a: number, b: number) => fbm2(a, b * (fu / fv), seed, oct, 1);
    return n(x, y) * (1 - u) * (1 - v) + n(x - fu, y) * u * (1 - v) + n(x, y - fv) * (1 - u) * v + n(x - fu, y - fv) * u * v;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      // long thin streaks down the sheet (old creases, the warp), and the burlap's mottle: blotches
      // ~40 to the metre (a tile is ~0.2 across), multiplying 0.7..1.3
      const streak = tn(u, v, 201, 22, 2) * 0.6 + tn(u, v, 203, 46, 3) * 0.4;
      const mottle = tn(u, v, 205, 3, 3, 4);
      const burlap = 1 + 0.3 * Math.max(-1, Math.min(1, 1.8 * tn(u, v, 207, 8, 8, 3)));
      // the weave: a fine cross-hatch, broken (it reads as tooth up close, as grain at distance)
      const weave = 0.5 + 0.25 * Math.sin(u * TAU * 64 + 1.7 * tn(u, v, 209, 6, 6, 2)) + 0.25 * Math.sin(v * TAU * 64 + 1.7 * tn(u, v, 211, 6, 6, 2));
      // (the mottle and the burlap's blotches at half their old contrast: they read as stains, not cloth)
      val[y * W + x] = (0.8 + 0.14 * streak + 0.04 * mottle) * (1 + 0.5 * (burlap - 1)) * (0.9 + 0.16 * weave);
      // (the weave's bump is gentle: its micro-normals caught the cyan rim all over the sheet)
      bumpV[y * W + x] = 0.5 + 0.12 * (weave - 0.5) + 0.25 * streak;
    }
  // flecks: light threads catching the moon, a few dark stains
  for (let i = 0; i < 900; i++) {
    const cx = rand(77, i, 0) * W;
    const cy = rand(77, i, 1) * H;
    const light = rand(77, i, 2) < 0.55;
    const rad = 1.2 + rand(77, i, 3) * (light ? 1.8 : 3.2);
    const amt = light ? 0.1 + 0.14 * rand(77, i, 4) : -(0.12 + 0.16 * rand(77, i, 4));
    const r0 = Math.ceil(rad + 1);
    for (let dy = -r0; dy <= r0; dy++)
      for (let dx = -r0; dx <= r0; dx++) {
        const k = Math.max(0, 1 - Math.hypot(dx, dy * 1.6) / rad);
        if (k <= 0) continue;
        const px = (((Math.floor(cx) + dx) % W) + W) % W;
        const py = (((Math.floor(cy) + dy) % H) + H) % H;
        val[py * W + px] += amt * k;
      }
  }
  const mk = (data: Float32Array, srgb: boolean) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    const img = g.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const v = Math.round(255 * Math.min(1, Math.max(0, data[i])));
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new CanvasTexture(c);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = SRGBColorSpace;
    return t;
  };
  fabricTex = { map: mk(val, true), bump: mk(bumpV, false) };
  return fabricTex;
}

/** Pose a part's vertices (and normals) from the ghosts' poses: ropes laid from their hooks, cloth by depth bin. */
function posePart(pt: Part, poses: GhostPose[]): void {
  const pa = pt.geo.getAttribute('position') as BufferAttribute;
  const na = pt.geo.getAttribute('normal') as BufferAttribute;
  const P = pa.array as Float32Array;
  const N = na.array as Float32Array;
  const n = pt.ghost.length;
  for (let i = 0; i < n; i++) {
    const gi = pt.ghost[i];
    if (gi === 255) continue;
    const g = poses[gi];
    const x = pt.rest[i * 3];
    const y = pt.rest[i * 3 + 1];
    const z = pt.rest[i * 3 + 2];
    if (pt.rope[i]) {
      // the rope: straight from the hook to the tie, swung; y is its distance up from the tie
      // (beyond the let-out length it is still in the wrap: gathered at the hook)
      const ly = -(g.ropeLen - Math.min(y, g.ropeLen));
      const m = g.rm;
      P[i * 3] = g.hook[0] + m[0] * x + m[1] * ly + m[2] * z;
      P[i * 3 + 1] = g.hook[1] + m[3] * x + m[4] * ly + m[5] * z;
      P[i * 3 + 2] = g.hook[2] + m[6] * x + m[7] * ly + m[8] * z;
      const nx = pt.restN[i * 3];
      const ny = pt.restN[i * 3 + 1];
      const nz = pt.restN[i * 3 + 2];
      N[i * 3] = m[0] * nx + m[1] * ny + m[2] * nz;
      N[i * 3 + 1] = m[3] * nx + m[4] * ny + m[5] * nz;
      N[i * 3 + 2] = m[6] * nx + m[7] * ny + m[8] * nz;
      continue;
    }
    // the peek ghost's sheet bunched up under its open part (its rest), paid out as it is let down
    let dep = pt.depth[i];
    let lx = x;
    let ly = y;
    let lz = z;
    const tr = pt.tear[i];
    if (dep > tr && tr < 98 && g.ell < 98) {
      // a strip of the hem: it hangs from the bundle's rim below its tear, a ragged fringe
      // (shortened while bundled, its full length once the sheet is paid out)
      const d2 = gatheredDepth(tr, g.ell) + (dep - tr) * (GATHER_FRINGE + (1 - GATHER_FRINGE) * g.payout);
      const s = gatheredWidth(tr, g.ell);
      lx *= s;
      lz *= s;
      ly += dep - d2;
      dep = d2;
    } else if (dep > g.ell) {
      // the bunched sheet, crumpled where it piles up (bulges and creases round and down it)
      const u = dep - g.ell;
      const d2 = gatheredDepth(dep, g.ell);
      const th = Math.atan2(lz, lx);
      const cr = 1 + 0.24 * smoothstep(0, 0.07, u) * Math.sin(5 * th + u * 37 + pt.phase[i]) * Math.sin(3 * th - u * 23 + 1.3);
      const s = gatheredWidth(dep, g.ell) * cr;
      lx *= s;
      lz *= s;
      ly += dep - d2 + 0.012 * smoothstep(0, 0.07, u) * Math.sin(7 * th + u * 51);
      dep = d2;
    }
    const bi = Math.min(BINS - 1, Math.round(dep / BIN_DEPTH));
    const m = g.m;
    const o = bi * 9;
    const fr = pt.free[i];
    if (fr > 0) {
      // the strips and threads flutter: a little, more at their tips
      const e = fr * fr;
      const ph = pt.phase[i];
      lx += 0.01 * e * Math.sin(g.flutter + ph + y * 6);
      lz += 0.008 * e * Math.sin(g.flutter * 1.37 + ph * 1.3);
    }
    P[i * 3] = g.o[bi * 3] + m[o] * lx + m[o + 1] * ly + m[o + 2] * lz;
    P[i * 3 + 1] = g.o[bi * 3 + 1] + m[o + 3] * lx + m[o + 4] * ly + m[o + 5] * lz;
    P[i * 3 + 2] = g.o[bi * 3 + 2] + m[o + 6] * lx + m[o + 7] * ly + m[o + 8] * lz;
    const nx = pt.restN[i * 3];
    const ny = pt.restN[i * 3 + 1];
    const nz = pt.restN[i * 3 + 2];
    N[i * 3] = m[o] * nx + m[o + 1] * ny + m[o + 2] * nz;
    N[i * 3 + 1] = m[o + 3] * nx + m[o + 4] * ny + m[o + 5] * nz;
    N[i * 3 + 2] = m[o + 6] * nx + m[o + 7] * ny + m[o + 8] * nz;
  }
  pa.needsUpdate = true;
  na.needsUpdate = true;
  pt.geo.computeBoundingSphere();
}

// ---- the component --------------------------------------------------------------------------------

export interface GhostsProps {
  /** the film frame (the sway) */
  f: number;
  /**
   * how far each ghost is let down on its rope, in hook order: 0 at rest, 1 its drop (the peek
   * ghost's eyes then PEEK_EYES above the ground under its hook), on to 1.5
   */
  lower?: readonly [number, number, number] | readonly number[];
  /** the rope's hooks on the hero limb (default world/Trees.tsx GHOST_HOOKS) */
  hooks?: Hooks;
}

/**
 * The cloth's lowest point (world y) over a plan disc (x, z, radius) at a frame, as posed: how
 * low a ghost comes over something under it (the peek over Clawd's hat). For checks and tests.
 */
export function clothLowest(f: number, lower: readonly number[], disc: readonly [number, number, number], hooks: Hooks = GHOST_HOOKS): number {
  const b = build(hooks);
  const poses = posesAt(
    f,
    lower,
    hooks,
    shapes(hooks).map((s) => s.drop),
  );
  posePart(b.cloth, poses);
  const P = b.cloth.geo.getAttribute('position').array as Float32Array;
  let lowest = Infinity;
  for (let i = 0; i < P.length / 3; i++) if (Math.hypot(P[i * 3] - disc[0], P[i * 3 + 2] - disc[1]) < disc[2]) lowest = Math.min(lowest, P[i * 3 + 1]);
  b.cloth.geo.dispose();
  b.lines.geo.dispose();
  b.eyes.dispose();
  return lowest;
}

/** Triangles of the built set (lookdev budget report). */
export function ghostStats(hooks: Hooks = GHOST_HOOKS): number {
  return build(hooks).tris;
}

export function Ghosts({ f, lower = [0, 0, 0], hooks = GHOST_HOOKS }: GhostsProps) {
  const built = useMemo(() => {
    const b = build(hooks);
    const drops = shapes(hooks).map((s) => s.drop);
    // the colours live in the vertex colours (the sheet's mauve-grey, the rope's tarry brown);
    // matte: the strips' cut edges seen edge-on flashed the moon's grazing specular
    const cloth = matte(
      storybookMaterial({
        kind: 'cloth',
        color: '#ffffff',
        color2: '#3a2230',
        // they rise out of the page with the tree they hang from
        growX: GHOST_BASE[0],
        vertexColors: true,
        roughness: 0.96,
        breakup: 0.3,
        scale: 0.05,
        bump: 0.3,
        // no rim: the reference's hanging sheets are dark against the sky, unlit at their edges
        rim: 0,
        fog: 0.2,
        map: fabric().map,
        bumpMap: fabric().bump,
        bumpScale: 0.7,
      }),
      0.4,
    );
    // the eyes add their light to the cloth (and their halos breathe on it); no fog on light itself
    const eyes = storybookMaterial({
      color: '#000000',
      emissive: '#ffffff',
      emissiveMap: eyeGlow(),
      emissiveIntensity: 1.15,
      fog: 0,
      rim: 0,
      ambient: 0,
      breakup: 0,
      side: DoubleSide,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      growX: GHOST_BASE[0],
    });
    return { ...b, drops, clothMat: cloth, eyeMat: eyes };
  }, [hooks]);
  useLayoutEffect(
    () => () => {
      built.cloth.geo.dispose();
      built.lines.geo.dispose();
      built.eyes.dispose();
      built.clothMat.dispose();
      built.eyeMat.dispose();
    },
    [built],
  );
  const l0 = lower[0] ?? 0;
  const l1 = lower[1] ?? 0;
  const l2 = lower[2] ?? 0;
  useLayoutEffect(() => {
    const poses = posesAt(f, [l0, l1, l2], hooks, built.drops);
    for (const pt of [built.cloth, built.lines]) posePart(pt, poses);
    const ea = built.eyes.getAttribute('position') as BufferAttribute;
    const en = built.eyes.getAttribute('normal') as BufferAttribute;
    const E = ea.array as Float32Array;
    const EN = en.array as Float32Array;
    for (let i = 0; i < built.eyeGhost.length; i++) {
      const g = poses[built.eyeGhost[i]];
      const bi = Math.min(BINS - 1, Math.round(built.eyeDepth[i] / BIN_DEPTH));
      const m = g.m;
      const o = bi * 9;
      const x = built.eyeRest[i * 3];
      // shut: squashed onto the eye's middle line, a dim slit (the peek ghost asleep in its bundle),
      // its halo still breathing on the cloth; wide: opened taller
      const yc = -built.eyeCentre[i];
      const halo = built.eyeHalo[i] === 1;
      const open = halo ? 0.55 + 0.45 * g.eyeOpen : Math.max(0.2, g.eyeOpen);
      const y = yc + (built.eyeRest[i * 3 + 1] - yc) * open * g.eyeWide;
      const z = built.eyeRest[i * 3 + 2];
      E[i * 3] = g.o[bi * 3] + m[o] * x + m[o + 1] * y + m[o + 2] * z;
      E[i * 3 + 1] = g.o[bi * 3 + 1] + m[o + 3] * x + m[o + 4] * y + m[o + 5] * z;
      E[i * 3 + 2] = g.o[bi * 3 + 2] + m[o + 6] * x + m[o + 7] * y + m[o + 8] * z;
      const nx = built.eyeRestN[i * 3];
      const ny = built.eyeRestN[i * 3 + 1];
      const nz = built.eyeRestN[i * 3 + 2];
      EN[i * 3] = m[o] * nx + m[o + 1] * ny + m[o + 2] * nz;
      EN[i * 3 + 1] = m[o + 3] * nx + m[o + 4] * ny + m[o + 5] * nz;
      EN[i * 3 + 2] = m[o + 6] * nx + m[o + 7] * ny + m[o + 8] * nz;
    }
    ea.needsUpdate = true;
    en.needsUpdate = true;
    built.eyes.computeBoundingSphere();
  }, [built, f, l0, l1, l2, hooks]);
  return (
    <>
      <mesh geometry={built.cloth.geo} material={built.clothMat} castShadow receiveShadow frustumCulled={false} />
      <mesh geometry={built.lines.geo} material={built.clothMat} receiveShadow frustumCulled={false} />
      <mesh geometry={built.eyes} material={built.eyeMat} frustumCulled={false} renderOrder={2} />
    </>
  );
}
