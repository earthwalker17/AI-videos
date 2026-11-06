/**
 * The neighbour, V2: a person under a homemade bedsheet-ghost costume, about 1.15 tall (V1's
 * profile × DOOR_SCALE; the eyeholes at ~0.99), holding a real candy bowl at chest height. The
 * costume does all the acting; the person is never seen (no face, no skin).
 *
 * The sheet is draped, not lathed: a hidden body of ellipsoids (a head about 7 heads into the
 * figure, the neck, shoulders wider than the head is tall, the torso, hips, upper arms and forearms
 * reaching forward, the hands cupped palms up under the bowl's foot, the cloth gathered round that
 * foot, the slippers' heels) is wrapped by the cloth as a two-pass hull — at every height the convex
 * hull of the body's cross-section (the cloth stretched round it), then down every column the
 * convex hull of those radii, the top of the head and the hem on the floor (the cloth falling from
 * whatever holds it up: taut over the head, off the shoulders, a shelf over the hands that the bowl
 * stands on, a curtain from there to the floor). Above the bowl's foot the cloth is pressed in
 * behind the bowl. On that drape: radial folds that start below the head and deepen toward the
 * hem (uneven ridges, never a regular star), a scalloped hem whose crests lift off the floor and
 * whose troughs pool on it, a slow sway of the lower cloth, the hem lagging a hop. The drape's
 * normals are smoothed round the sheet (a fold crest is a soft roll, not a 1-px rim line).
 * Vertex colours carry the cloth's colour and its occlusion (fold valleys, the shelf and the cloth
 * behind the bowl, the shadow under the forearms, the contact with the floor); the house's cyan
 * wall lantern and red porch lanterns light it the way they light the house (world/House.tsx's
 * baked practical model, glowMaterial: per vertex, recomputed as the sheet moves). Two eyeholes
 * cut in the sheet over the face (a soft cut edge, dark inside, a faint glint of an eye; ghosted
 * they fill with a cold cyan glow), plush slippers peeking out under the hem, and a glazed ceramic
 * bowl heaped with wrapped sweets and candy corn that slide downhill and heap against the low rim
 * as the bowl tips; with a `pail` target, one sweet leaves the bowl at the tip's peak and arcs into
 * Clawd's pail (bar 30 beat 2 to bar 31, V1's grace beat).
 *
 * Driven by film/blocking.ts userAt(f) (V1's UserPose, carried onto the house): pos (the house
 * floor, via fromV1Door), stand 1..0.68 (the person sags: head and shoulders drop and come
 * forward, the extra cloth pools wider on the floor, the eyeholes droop), ghosted 0..1 (the sheet
 * greys, the folds deepen, the eyeholes turn cold cyan), hop (the whole figure, the hem lagging),
 * tilt 0..1 (the bowl tipped toward Clawd's wait spot, at most 0.42 rad, the hands following).
 * Faces out of the house (LAND.house.yaw). Everything on ones.
 *
 * Draw calls: the sheet (rebuilt per frame on the CPU), the eyeholes (one mesh, one shader), the
 * slippers, the bowl, its sweets (posed per frame): 5. About 26k triangles.
 */
import { clamp, rand, smoothstep } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, CircleGeometry, Color, ConeGeometry, DoubleSide, InstancedMesh, LatheGeometry, Matrix4, NormalBlending, Quaternion, ShaderMaterial, SphereGeometry, Vector2, Vector3, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { at, FPS } from '../cues.ts';
import type { UserPose } from '../film/actors.ts';
import { fbm2 } from '../kit/field.ts';
import { storybookMaterial } from '../look/materials.ts';
import { lin, PartRig, softBox } from './Clawd2.tsx';
import { glowMaterial, RED_LANTERNS, WALL_LANTERN } from './House.tsx';
import { DOOR_SCALE, fromHouse, fromV1Door, LAND } from './layout.ts';

const TAU = Math.PI * 2;
type V3 = [number, number, number];

/** Columns round the sheet and rows down it (the drape's grid). */
const COLS = 144;
const ROWS = 60;
/** heights the cross-section hull is taken at */
const LEVEL_STEP = 0.02;
/** the bowl's tip at tilt 1 (radians): an offering, never a dump (the sweets stay in, heaped at the low rim) */
const TILT_MAX = 0.42;

// a cool cream: under the night's plum ambient a warm cream turns pink; this one stays a pale sheet
const CREAM = new Color('#dde7de');
// ghosted: a pale ghost-teal (the grey went to the door's slate in the yard's shadow)
const GHOST = new Color('#86b9b4');
/** the ghosted sheet's own cold glow (emissive, x the cloth's occlusion, stronger toward its edges) */
const GHOST_GLOW = '#3fb8b0';
const GHOST_GLOW_K = 0.3;

/** Where Clawd waits, in the neighbour's frame (V1's wait spot minus the doorway): the bowl tips toward it. */
const TO_CLAWD = (() => {
  const d = new Vector2(1.25 + 0.25, -0.15 + 1.05).normalize();
  return new Vector3(d.x, 0, d.y);
})();

interface Ell {
  c: V3;
  r: V3;
}

/** The hidden body the sheet hangs on, and where the bowl is, for a pose (neighbour-local, the floor at y 0). */
function bodyOf(stand: number, tilt: number) {
  const sag = clamp((1 - stand) / 0.32, 0, 1);
  const s = smoothstep(0, 1, sag);
  // about seven heads tall, the shoulders twice the head's width: a person under a sheet, not a chibi ghost
  const head: Ell = { c: [0, 1.02 - 0.3 * s, 0.012 + 0.055 * s], r: [0.13, 0.128, 0.13] };
  // the sheet's top is no dome: it sits flattened on the crown, tipped to one side, a bunch of the
  // cloth caught up off-centre (where it was thrown over and tugged straight)
  const crown: Ell = { c: [0.035, head.c[1] + 0.06, head.c[2] - 0.025], r: [0.085, 0.055, 0.08] };
  const ells: Ell[] = [
    { c: [head.c[0] - 0.01, head.c[1] - 0.012, head.c[2]], r: [0.13, 0.112, 0.13] },
    crown,
    { c: [0, 0.875 - 0.27 * s, 0.01 + 0.035 * s], r: [0.066, 0.07, 0.064] },
    { c: [0, 0.78 - 0.25 * s, -0.005 + 0.025 * s], r: [0.27, 0.062, 0.12] },
    { c: [0, 0.58 - 0.2 * s, 0], r: [0.19, 0.24 - 0.06 * s, 0.12] },
    { c: [0, 0.37 - 0.12 * s, -0.005], r: [0.175, 0.12, 0.115] },
  ];
  // the bowl: its foot's centre; offered (tipped toward Clawd) it comes out to him and down toward
  // his pail, so the candy's drop reads in one frame with his hat and pail (held at chest height it
  // tipped over his hat, 18 cm off)
  const offer = 0.09 * tilt;
  const bowlY = 0.6 - 0.24 * s - offer;
  // (its rim's front stays 2.5 cm behind the letter's card, which rises 0.45 in front of the doorway; the letter has sunk before the offer)
  const bowl = new Vector3(0, bowlY + 0.02 * tilt, 0.27 + 0.01 * s).addScaledVector(TO_CLAWD, 0.11 * tilt);
  const q = new Quaternion().setFromAxisAngle(new Vector3(TO_CLAWD.z, 0, -TO_CLAWD.x), TILT_MAX * tilt);
  const inBowl = (x: number, y: number, z: number) => new Vector3(x, y, z).applyQuaternion(q).add(bowl);
  const shoulderY = ells[3].c[1];
  for (const side of [-1, 1]) {
    // the hands, palms up, cupped under the bowl's foot (they tip with it): the cloth over them is the shelf it stands on
    const hand = inBowl(side * 0.04, -0.021, -0.004);
    ells.push({ c: [hand.x, hand.y, hand.z], r: [0.05, 0.021, 0.064] });
    const wrist = inBowl(side * 0.078, -0.03, -0.062);
    const elbow = new Vector3(side * 0.205, bowlY - 0.04 - 0.03 * s + 0.4 * offer, 0.06 + 0.02 * s + 0.5 * offer);
    const shoulder = new Vector3(side * 0.25, shoulderY - 0.03, -0.01);
    for (let k = 0; k <= 3; k++) {
      const t = k / 3;
      const u = new Vector3().lerpVectors(shoulder, elbow, t);
      ells.push({ c: [u.x, u.y, u.z], r: [0.05, 0.05, 0.05] });
      const w = new Vector3().lerpVectors(elbow, wrist, t);
      const rr = 0.045 - 0.007 * t;
      ells.push({ c: [w.x, w.y, w.z], r: [rr, rr, rr] });
    }
  }
  // the cloth gathered round the bowl's foot (pressed up round it by the hands)
  const gather = inBowl(0, 0.004, 0);
  ells.push({ c: [gather.x, gather.y, gather.z], r: [0.075, 0.016, 0.075] });
  // the slippers' heels hold the hem up a little at the front
  for (const side of [-1, 1]) ells.push({ c: [side * 0.082, 0, 0.31], r: [0.038, 0.03, 0.036] });
  return { ells, head, bowl, q, sag: s };
}

/** the bowl's outside, radius at a height above its foot (its lathe profile) */
const BOWL_OUT: [number, number][] = [
  [0, 0.063],
  [0.011, 0.066],
  [0.016, 0.084],
  [0.034, 0.115],
  [0.056, 0.137],
  [0.078, 0.15],
  [0.086, 0.155],
  [0.095, 0.15],
];
/** the bowl's inside: its floor's height at a radius (the sweets rest on it) */
const BOWL_IN: [number, number][] = [
  [0, 0.021],
  [0.03, 0.022],
  [0.072, 0.03],
  [0.11, 0.048],
  [0.136, 0.074],
  [0.144, 0.087],
];
function interp(tab: [number, number][], x: number): number {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++)
    if (x <= tab[i][0]) {
      const [x0, y0] = tab[i - 1];
      const [x1, y1] = tab[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  return tab[tab.length - 1][1];
}
const bowlRadius = (h: number) => interp(BOWL_OUT, h);

/** The 2D convex hull (monotone chain) of points, counter-clockwise. */
function hull2(pts: [number, number][]): [number, number][] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** Radius of a closed polygon (round the origin) along each column's direction (x = sin θ, z = cos θ). */
function radialOf(poly: [number, number][], out: Float32Array): void {
  out.fill(0);
  const n = poly.length;
  if (n < 3) return;
  for (let j = 0; j < COLS; j++) {
    const th = (j / COLS) * TAU;
    const dx = Math.sin(th);
    const dz = Math.cos(th);
    let best = 0;
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      const ex = b[0] - a[0];
      const ez = b[1] - a[1];
      const den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-12) continue;
      const s = (a[0] * ez - a[1] * ex) / den;
      const t = (a[0] * dz - a[1] * dx) / den;
      if (t >= -1e-6 && t <= 1 + 1e-6 && s > best) best = s;
    }
    out[j] = best;
  }
}

/** The folds' pattern round the sheet at depth v (0 the head .. 1 the hem): uneven ridges, drifting. */
function foldAt(th: number, v: number): number {
  // rounded crests and creased valleys (|sin|), two families of uneven count and drift, and noise
  const a = 0.62 - 1.24 * Math.abs(Math.sin(4.5 * th + 0.7 + 0.9 * v + 0.35 * Math.sin(2 * th)));
  const b = 0.5 - Math.abs(Math.sin(7 * th + 2.3 - 1.2 * v));
  return 0.62 * a + 0.26 * b + 0.34 * fbm2(Math.cos(th) * 2.3 + v * 1.4, Math.sin(th) * 2.3 - v * 0.8, 404, 3);
}
/** the slippers (neighbour-local): their centres' x and z, and their directions round the sheet */
const SLIPPER = { x: 0.082, z: 0.345, len: 0.13 };
const SLIPPER_TH = [-1, 1].map((s) => Math.atan2(s * SLIPPER.x, SLIPPER.z));
const slipperMask = (th: number) => {
  let m = 0;
  for (const a of SLIPPER_TH) {
    const d = Math.atan2(Math.sin(th - a), Math.cos(th - a));
    m = Math.max(m, Math.exp(-((d / 0.17) ** 2)));
  }
  return m;
};

interface Drape {
  pos: Float32Array;
  col: Float32Array;
}

/** The draped sheet for a pose at film time t (seconds): positions and colours of the COLS × (ROWS + 1) grid. */
function drape(pose: UserPose, t: number, out: Drape): void {
  const { ells, head, bowl, q } = bodyOf(pose.stand, pose.tilt);
  const shoulderY = ells[3].c[1];
  const tip = new Vector3(0, 1, 0).applyQuaternion(q);
  /** where the bowl's weight sits (its occlusion's centre) */
  const bowlMid = bowl.clone().addScaledVector(tip, 0.035);
  /** where the head's hull ends and the body's begins */
  const chin = head.c[1] - 0.55 * head.r[1];
  const top = Math.max(...ells.map((e) => e.c[1] + e.r[1])) + 0.005;
  const levels: number[] = [];
  for (let y = top - 0.004; y > 0.0; y -= LEVEL_STEP) levels.push(y);
  const radii = levels.map(() => new Float32Array(COLS));
  const ring: [number, number][] = [];
  levels.forEach((y, li) => {
    ring.length = 0;
    for (const e of ells) {
      const dy = (y - e.c[1]) / e.r[1];
      if (Math.abs(dy) >= 1) continue;
      const s = Math.sqrt(1 - dy * dy);
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * TAU;
        ring.push([e.c[0] + Math.cos(a) * e.r[0] * s, e.c[2] + Math.sin(a) * e.r[2] * s]);
      }
    }
    if (ring.length >= 3) radialOf(hull2(ring), radii[li]);
  });
  const ghosted = clamp(pose.ghosted, 0, 1);
  const sag = clamp((1 - pose.stand) / 0.32, 0, 1);
  const cloth = CREAM.clone().lerp(GHOST, ghosted);
  // (deep folds: at V1's 0.05 the sheet read as a moulded rubber bell)
  const amp = 0.115 * (1 + 0.25 * ghosted + 0.2 * sag);
  // a bedsheet's four corners: they hang lower and pool further out on the floor (never even)
  const CORNERS = [0.5, 2.1, 3.55, 5.2];
  const cornerAt = (th: number) => {
    let m = 0;
    for (const a of CORNERS) {
      const d = Math.atan2(Math.sin(th - a), Math.cos(th - a));
      m = Math.max(m, Math.exp(-((d / 0.22) ** 2)));
    }
    return m;
  };
  const prof: [number, number][] = [];
  const res: [number, number][] = Array.from({ length: ROWS + 1 }, () => [0, 0]);
  for (let j = 0; j < COLS; j++) {
    const th = (j / COLS) * TAU;
    const sx = Math.sin(th);
    const cz = Math.cos(th);
    const slip = slipperMask(th);
    // the column's outer hull, from the head's top down to the hem on the floor
    const R = 0.325 + 0.022 * cz + 0.07 * sag;
    prof.length = 0;
    prof.push([0, top]);
    // two hulls: over the head down to the chin (taut over the face, so the eyeholes sit on it),
    // then from the chin over the shoulders, the forearms and the hips to the hem
    const pts: [number, number][] = [];
    levels.forEach((y, li) => radii[li][j] > 0 && pts.push([radii[li][j], y]));
    pts.push([R, 0]);
    let start = 0;
    for (const q of pts) {
      while (prof.length >= start + 2) {
        const o = prof[prof.length - 2];
        const a = prof[prof.length - 1];
        const cr = (a[0] - o[0]) * (q[1] - o[1]) - (a[1] - o[1]) * (q[0] - o[0]);
        if (cr >= 0) prof.pop();
        else break;
      }
      prof.push(q);
      if (start === 0 && q[1] < chin) start = prof.length - 1;
    }
    // the pool: the hem's slack lying on the floor (more in the troughs, none over the slippers' toes)
    const trough = clamp(0.5 - 0.5 * foldAt(th, 1), 0, 1);
    const corner = cornerAt(th);
    const pool = (0.014 + 0.036 * trough + 0.06 * corner + 0.1 * sag) * (1 - 0.95 * slip);
    prof.push([R + pool * 0.55, 0.004], [R + pool, 0.002]);
    // resample by arc length into the rows, then soften the hull's corners
    const lens = [0];
    for (let i = 1; i < prof.length; i++) lens.push(lens[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
    const L = lens[lens.length - 1];
    let seg = 1;
    for (let i = 0; i <= ROWS; i++) {
      const s = (i / ROWS) * L;
      while (seg < prof.length - 1 && lens[seg] < s) seg++;
      const k = (s - lens[seg - 1]) / Math.max(1e-9, lens[seg] - lens[seg - 1]);
      res[i][0] = prof[seg - 1][0] + (prof[seg][0] - prof[seg - 1][0]) * k;
      res[i][1] = prof[seg - 1][1] + (prof[seg][1] - prof[seg - 1][1]) * k;
    }
    for (let pass = 0; pass < 2; pass++)
      for (let i = 1; i < ROWS; i++) {
        res[i][0] = res[i][0] * 0.6 + (res[i - 1][0] + res[i + 1][0]) * 0.2;
        res[i][1] = res[i][1] * 0.6 + (res[i - 1][1] + res[i + 1][1]) * 0.2;
      }
    for (let i = 0; i <= ROWS; i++) {
      const v = i / ROWS;
      const [r0, y0] = res[i];
      const fold = foldAt(th, v);
      // fine vertical creases between the big folds (a sheet out of the linen cupboard), stronger toward the hem
      const fine = Math.sin(21 * th + 1.7 * Math.sin(3 * th + 2 * v) + 0.8 * v) * 0.6 + Math.sin(29 * th - 2.1 + 1.3 * v) * 0.4;
      const fineK = smoothstep(0.18, 0.75, v);
      const A = amp * smoothstep(0.12, 0.65, v) + 0.008 * smoothstep(0.85, 1, v);
      const floor = smoothstep(0.03, 0.0, y0);
      // the lower cloth sways a little (on ones), the hem lags a hop
      const sway = 0.006 * v * v * Math.sin(TAU * 0.33 * t + th * 1.3 + 0.6) * (1 - floor);
      // the sheet hangs a little off true: drawn over to one side below the shoulders, its middle
      // never one plumb line (the mirror-symmetric bell read as moulded)
      const drift = 0.03 * smoothstep(0.15, 0.95, v) * (1 - 0.6 * floor) + 0.012 * Math.sin(v * 5.2 + 0.7) * smoothstep(0.1, 0.4, v);
      // the folds, and the sheet flaring out as it nears the floor (a bell, not a pillar); the hem's
      // scallop: its crests reach out a little further and lift off the floor
      const hemWave = smoothstep(0.9, 1.0, v);
      let r = Math.max(0, r0 + A * fold * (1 - 0.5 * floor) + 0.009 * fine * fineK + 0.045 * smoothstep(0.26, 0.0, y0) ** 2 * (1 - 0.9 * slip) + 0.03 * hemWave * fold + 0.03 * corner * smoothstep(0.7, 1, v));
      // the sheet's storage folds (a grid of shallow raised creases out of the linen cupboard: four
      // round it, three down it) and, where it lies on the floor, the hem crumpled into ridges
      const creaseU = Math.max(...[0.6, 1.95, 3.35, 4.75].map((a) => Math.exp(-(1 - Math.cos(th - a)) * 820)));
      const creaseV = Math.max(...[0.34, 0.56, 0.77].map((c) => Math.exp(-(((v - c) / 0.014) ** 2))));
      r += 0.0045 * Math.max(creaseU, creaseV) * smoothstep(0.22, 0.32, v) * (1 - floor);
      r += floor * 0.014 * (Math.sin(13 * th + 2.1) * Math.sin(7 * th - 0.7) + 0.5 * Math.sin(23 * th + 1.3));
      // creases over the crown, gathered toward the bunch on top (the sheet pulled over the head)
      const crownK = smoothstep(0.0, 0.05, v) * (1 - smoothstep(0.1, 0.2, v));
      r -= crownK * (0.007 * Math.abs(Math.sin(3.5 * th + 0.8)) + 0.004 * Math.abs(Math.sin(6 * th + 2.2)));
      // the slack between the head and the shoulders hangs in a little: the head reads as a head
      const n0 = shoulderY + 0.03;
      const n1 = head.c[1] - 0.075;
      if (y0 > n0 && y0 < n1) r -= 0.014 * Math.sin((Math.PI * (y0 - n0)) / (n1 - n0));
      // above the bowl's foot the sheet is pressed in behind the bowl (the cloth gathered round the
      // foot and the shelf of the hands under it stay); from there up to the chin it falls straight
      const hb = y0 - bowl.y;
      const wb = smoothstep(0.008, 0.02, hb) * smoothstep(chin - bowl.y + 0.03, chin - bowl.y - 0.04, hb);
      if (wb > 0) {
        const cx = bowl.x + tip.x * clamp(hb, 0, 0.09);
        const cz2 = bowl.z + tip.z * clamp(hb, 0, 0.09);
        const Rb = bowlRadius(Math.min(hb, 0.09)) + 0.012;
        const dc = sx * cx + cz * cz2;
        const disc = dc * dc - (cx * cx + cz2 * cz2) + Rb * Rb;
        if (disc > 0) {
          const near = dc - Math.sqrt(disc);
          if (near > 0 && r > near) r = r + (near - r) * wb;
        }
      }
      const lift = pose.hop * (1 - 0.45 * v * v);
      // the hem: crests lift off the floor, and over the slippers it rests on their tops
      const hemLift = floor * (0.022 * Math.max(0, fold) + 0.034 * slip + 0.03 * Math.max(0, Math.sin(2.3 * th + 1.1)) * (1 - corner));
      const y = Math.max(0.0015, y0 + hemLift) + lift;
      const o = (j * (ROWS + 1) + i) * 3;
      out.pos[o] = sx * r + sway + drift;
      out.pos[o + 1] = y;
      out.pos[o + 2] = cz * r + sway * 0.4 - 0.4 * drift;
      // colour × occlusion: fold valleys, the shelf and the cloth behind the bowl, the shadow under
      // the forearms, the floor contact
      const valley = clamp(-fold, 0, 1) * smoothstep(0.16, 0.6, v);
      const front = smoothstep(0.2, 0.9, cz);
      const underArms = front * smoothstep(bowl.y + 0.02, bowl.y - 0.15, y0) * smoothstep(0.0, 0.25, y0) * 0.3;
      const dB = Math.hypot(sx * r - bowlMid.x, y0 - bowlMid.y, cz * r - bowlMid.z);
      const nearBowl = 0.5 * smoothstep(0.2, 0.07, dB);
      const contact = 0.55 + 0.45 * smoothstep(0.0, 0.14, y0);
      const crest = clamp(fold, 0, 1) * smoothstep(0.2, 0.6, v);
      const k = (1 - 0.72 * valley) * (1 + 0.32 * crest) * (1 + 0.24 * fine * fineK) * (1 - underArms) * (1 - nearBowl) * contact;
      const c = (j * (ROWS + 1) + i) * 4;
      out.col[c] = cloth.r * k;
      out.col[c + 1] = cloth.g * k;
      out.col[c + 2] = cloth.b * k;
      // the rim's share: low on the hem's edge and on the crests (thin bright lines there crawl)
      out.col[c + 3] = (v > 0.93 ? 0.5 : 1) * (1 - 0.45 * crest);
    }
  }
}

function sheetIndex(): number[] {
  const idx: number[] = [];
  const R1 = ROWS + 1;
  for (let j = 0; j < COLS; j++) {
    const j1 = (j + 1) % COLS;
    for (let i = 0; i < ROWS; i++) {
      const a = j * R1 + i;
      const b = j1 * R1 + i;
      // outward: round the column (+θ toward +x from +z) then down the rows
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  return idx;
}

/** Blur the drape's normals round the sheet (a [1 2 3 2 1] kernel over the columns): soft fold rolls, no 1-px crest lines. */
function smoothNormals(N: BufferAttribute, tmp: Float32Array): void {
  const a = N.array as Float32Array;
  tmp.set(a);
  const R1 = ROWS + 1;
  const w = [1, 2, 3, 2, 1];
  for (let j = 0; j < COLS; j++)
    for (let i = 1; i <= ROWS; i++) {
      let x = 0;
      let y = 0;
      let z = 0;
      for (let k = -2; k <= 2; k++) {
        const o = ((((j + k) % COLS) + COLS) % COLS) * R1 * 3 + i * 3;
        x += tmp[o] * w[k + 2];
        y += tmp[o + 1] * w[k + 2];
        z += tmp[o + 2] * w[k + 2];
      }
      const l = Math.hypot(x, y, z) || 1;
      const o = (j * R1 + i) * 3;
      a[o] = x / l;
      a[o + 1] = y / l;
      a[o + 2] = z / l;
    }
}

/** The eyeholes: a soft-edged cut, dark inside, a faint glint of an eye; ghosted, a cold cyan glow (HDR, for the bloom). */
function eyeholeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uGhost: { value: 0 }, uGlint: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
        p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uGhost;
      uniform float uGlint;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float a = smoothstep(0.98, 0.72, r);
        vec3 col = vec3(0.010, 0.011, 0.016) * (0.6 + 0.4 * r);
        vec2 g = vP - vec2(-0.22, 0.26);
        col += vec3(0.42, 0.5, 0.55) * exp(-dot(g, g) * 70.0) * uGlint * (1.0 - uGhost);
        col += vec3(0.30, 1.05, 1.15) * uGhost * 2.4 * smoothstep(1.05, 0.05, r);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** The slippers: plush, a darker sole, a cuff; their heels under the hem, their toes out in front (neighbour-local). */
function buildSlippers(): BufferGeometry {
  // pale plush: the mauve ones sank into the hem's shadow as dark maroon blobs
  const plush = lin('#dcc3b4');
  const sole = lin('#4a3a44');
  const parts: BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const body = softBox({
      size: [0.074, 0.038, SLIPPER.len],
      r: 0.019,
      bulge: [0.004, 0.009, 0.004],
      wobble: 0.002,
      wobbleSize: 0.03,
      seed: 500 + side,
      inner: [3, 2, 5],
      bevel: 3,
      color: (p) => {
        const k = p.y < -0.012 ? 0 : 1;
        const c = k ? plush : sole;
        // the heel under the hem in the cloth's shade, the toe out in the night
        const ao = (0.7 + 0.3 * smoothstep(-0.018, 0.012, p.y)) * (0.55 + 0.45 * smoothstep(-0.03, 0.04, p.z));
        return [c[0] * ao, c[1] * ao, c[2] * ao, 0.8];
      },
    });
    body.applyMatrix4(new Matrix4().makeRotationY(side * 0.16).setPosition(side * SLIPPER.x, 0.018, SLIPPER.z));
    parts.push(body);
  }
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

/**
 * The bowl (glazed ceramic: a glossy pumpkin-orange outside with a deep plum band under the lip and
 * a run of drips from it, a cream rim and inside, an unglazed foot); its foot's centre at the origin.
 */
function buildBowl(): BufferGeometry {
  const prof: [number, number][] = [
    [0.0, 0.007],
    [0.044, 0.007],
    [0.05, 0.0],
    [0.063, 0.0],
    [0.066, 0.011],
    [0.084, 0.016],
    [0.115, 0.034],
    [0.137, 0.056],
    [0.15, 0.078],
    [0.155, 0.086],
    [0.151, 0.091],
    [0.144, 0.087],
    [0.136, 0.074],
    [0.11, 0.048],
    [0.072, 0.03],
    [0.03, 0.022],
    [0.0, 0.021],
  ];
  const lathe = new LatheGeometry(
    prof.map(([x, y]) => new Vector2(x, y)),
    72,
  );
  // a bright glaze: the deep teal (and then the lighter one) read as a grey hemisphere in the
  // house's shadow; a festive orange holds its colour there and catches the lanterns
  const glaze = lin('#e0782e');
  const band = lin('#5a2a5e');
  const cream = lin('#f1e6cc');
  const clay = lin('#8c6a50');
  const n = prof.length;
  const P = lathe.attributes.position as BufferAttribute;
  const UV = lathe.attributes.uv as BufferAttribute;
  const col = new Float32Array(P.count * 4);
  for (let i = 0; i < P.count; i++) {
    const k = Math.round(UV.getY(i) * (n - 1));
    const y = P.getY(i);
    const a = Math.atan2(P.getZ(i), P.getX(i));
    // the band under the lip, its lower edge running down in drips here and there
    const drip = 0.012 * Math.max(0, Math.sin(a * 7 + 1.3)) ** 6 + 0.006 * Math.max(0, Math.sin(a * 13 + 0.4)) ** 8;
    const inBand = k > 4 && k <= 8 && y > 0.066 - drip;
    const c = k <= 4 ? clay : k <= 8 ? (inBand ? band : glaze) : cream;
    // the glaze's tone pools darker low down and lighter where it ran thin over the belly
    const pool = k > 4 && k <= 8 ? 0.85 + 0.2 * smoothstep(0.02, 0.06, y) + 0.06 * Math.sin(a * 3 + y * 40) : 1;
    const ao = k <= 8 ? (0.75 + 0.25 * smoothstep(0.0, 0.07, y)) * pool : k >= 12 ? 0.7 + 0.3 * smoothstep(0.02, 0.08, y) : 1;
    col.set([c[0] * ao, c[1] * ao, c[2] * ao, k <= 8 ? 1 : 0.6], i * 4);
  }
  lathe.setAttribute('color', new BufferAttribute(col, 4));
  lathe.deleteAttribute('uv');
  const g = lathe.toNonIndexed();
  lathe.dispose();
  return g;
}

/** One sweet's rest place in the bowl (bowl-local) and its size. */
interface Sweet {
  p: Vector3;
  q: Quaternion;
  corn: boolean;
}
/** the sweet that leaves the bowl for Clawd's pail (an orange bonbon on top of the heap) */
const DROP_K = 16;
const SWEETS = 24;

/** The sweets (twist-wrapped bonbons in foil colours and candy corns), each centred on its own origin, and their rest places heaped above the rim. */
function buildSweets(): { parts: BufferGeometry[]; rest: Sweet[] } {
  const FOIL = ['#e9862e', '#7a4fa0', '#7fcfa6', '#c8322a', '#e6b84a', '#3aa6b0', '#e9862e', '#d4506e'].map(lin);
  const parts: BufferGeometry[] = [];
  const rest: Sweet[] = [];
  const paintAll = (g: BufferGeometry, cc: [number, number, number], s: number) => {
    const p = g.attributes.position as BufferAttribute;
    const arr = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) arr.set([cc[0] * s, cc[1] * s, cc[2] * s, 0.5], i * 4);
    g.setAttribute('color', new BufferAttribute(arr, 4));
    g.deleteAttribute('uv');
  };
  for (let k = 0; k < SWEETS; k++) {
    const R = (i: number) => rand(808, k, i);
    const ang = R(0) * TAU;
    // four layers: a bed on the bowl's floor, a layer at the rim, a heap above it and its crown,
    // 0.03 to 0.05 over the lip (from the door camera, below the bowl, only a heap shows)
    const layer = k < 8 ? 0 : k < 14 ? 1 : k < 21 ? 2 : 3;
    const rr = Math.sqrt(R(1)) * [0.1, 0.085, 0.07, 0.04][layer];
    const y = [0.04, 0.075, 0.112, 0.136][layer] + 0.012 * (1 - (rr / 0.1) ** 2) * R(2);
    const q = new Quaternion().setFromAxisAngle(new Vector3(R(4) - 0.5, 1, R(5) - 0.5).normalize(), R(6) * TAU);
    const corn = k % 6 === 5;
    rest.push({ p: new Vector3(Math.cos(ang) * rr, y, Math.sin(ang) * rr), q, corn });
    if (corn) {
      // a candy corn: white tip, orange middle, yellow base
      const cone = new ConeGeometry(0.012, 0.026, 12, 3);
      const p = cone.attributes.position as BufferAttribute;
      const arr = new Float32Array(p.count * 4);
      const tipC = lin('#f3eedc');
      const mid = lin('#ee8a24');
      const base = lin('#f2c23c');
      for (let i = 0; i < p.count; i++) {
        const t = (p.getY(i) + 0.013) / 0.026;
        const cc = t > 0.66 ? tipC : t > 0.3 ? mid : base;
        arr.set([cc[0], cc[1], cc[2], 0.5], i * 4);
      }
      cone.setAttribute('color', new BufferAttribute(arr, 4));
      cone.deleteAttribute('uv');
      parts.push(cone.toNonIndexed());
      cone.dispose();
      continue;
    }
    const c = FOIL[k % FOIL.length];
    const shade = 0.85 + 0.25 * R(3);
    const bits: BufferGeometry[] = [];
    const body = new SphereGeometry(1, 16, 10);
    body.scale(0.019, 0.0125, 0.0125);
    paintAll(body, c, shade);
    bits.push(body.toNonIndexed());
    body.dispose();
    for (const s of [-1, 1]) {
      const tw = new ConeGeometry(0.011, 0.016, 10, 1, true);
      tw.scale(1, 1, 0.45);
      tw.rotateZ((s * Math.PI) / 2);
      tw.translate(s * 0.022, 0, 0);
      paintAll(tw, c, shade * 1.12);
      bits.push(tw.toNonIndexed());
      tw.dispose();
    }
    parts.push(mergeGeometries(bits, false));
    bits.forEach((b) => b.dispose());
  }
  for (const g of parts) g.computeVertexNormals();
  return { parts, rest };
}

/** The candy's flight to the pail: it leaves the low rim as the tip peaks and lands on bar 31 (V1's grace beat). */
const DROP = { from: at(30, 2) + 2, to: at(31) };

/**
 * The sweets' places for a tilt (bowl-local): downhill they slide and heap against the low rim
 * (never past it: at most TILT_MAX of tip), tumbling a little; the dropped one is placed by the caller.
 */
function sweetMatrices(rest: Sweet[], q: Quaternion, out: Matrix4[]): void {
  const g = new Vector3(0, -1, 0).applyQuaternion(q.clone().invert());
  const slope = Math.hypot(g.x, g.z);
  const d = slope > 1e-6 ? new Vector2(g.x / slope, g.z / slope) : new Vector2(1, 0);
  const s = smoothstep(0.05, 0.38, slope);
  const p = new Vector3();
  const tumble = new Quaternion();
  rest.forEach((sw, k) => {
    const u0 = sw.p.x * d.x + sw.p.z * d.y;
    const w0 = -sw.p.x * d.y + sw.p.z * d.x;
    const u1 = u0 + s * (0.04 + 0.45 * (0.1 - u0) * 0.5);
    const w1 = w0 * (1 - 0.22 * s);
    let rr = Math.hypot(u1, w1);
    const lim = 0.126;
    const kk = rr > lim ? lim / rr : 1;
    const x = (u1 * d.x - w1 * d.y) * kk;
    const z = (u1 * d.y + w1 * d.x) * kk;
    rr = Math.min(rr, lim);
    // they ride up the low wall as they heap against it, and the heap's top sinks a little
    const y = Math.max(sw.p.y - 0.01 * s * (sw.p.y > 0.08 ? 1 : 0), interp(BOWL_IN, rr) + 0.011);
    p.set(x, y, z);
    tumble.setFromAxisAngle(new Vector3(-d.y, 0, d.x), s * (0.6 + 0.8 * rand(809, k, 0)));
    out[k].compose(p, tumble.clone().multiply(sw.q), new Vector3(1, 1, 1));
  });
}

/** The neighbour's yaw: out of the house's front. */
const YAW = LAND.house.yaw ?? 0;

/**
 * The house's practicals that reach the doorway (world/House.tsx LANTERN_LIGHTS, its baked light
 * model, repeated here for the moving sheet): the cyan wall lantern and the two red porch lanterns.
 */
const PRACTICALS = [
  { p: new Vector3(...fromHouse([WALL_LANTERN.x, WALL_LANTERN.y, WALL_LANTERN.z])), c: [0.3, 0.88, 1.0] as const, power: 0.18, r0: 0.12, reach: 1.4 },
  ...RED_LANTERNS.map((l) => ({ p: new Vector3(...fromHouse([l.x, l.y, l.z])), c: [1.0, 0.42, 0.16] as const, power: 0.026, r0: 0.1, reach: 0.65 })),
];

/** The practicals' light on the sheet per vertex (world/House.tsx lightAt), from the posed drape. */
function practicalLight(P: BufferAttribute, N: BufferAttribute, toWorld: Matrix4, out: Float32Array): void {
  const p = new Vector3();
  const n = new Vector3();
  const rot = new Matrix4().extractRotation(toWorld);
  for (let i = 0; i < P.count; i++) {
    p.fromBufferAttribute(P, i).applyMatrix4(toWorld);
    n.fromBufferAttribute(N, i).applyMatrix4(rot);
    let r = 0;
    let gg = 0;
    let b = 0;
    for (const L of PRACTICALS) {
      const dx = L.p.x - p.x;
      const dy = L.p.y - p.y;
      const dz = L.p.z - p.z;
      const dd = Math.hypot(dx, dy, dz);
      if (dd >= L.reach) continue;
      const ndl = clamp(((n.x * dx + n.y * dy + n.z * dz) / (dd || 1) + 0.25) / 1.25, 0, 1);
      const k = (L.power / (dd * dd + L.r0 * L.r0)) * ndl * smoothstep(L.reach, L.reach * 0.45, dd);
      r += L.c[0] * k;
      gg += L.c[1] * k;
      b += L.c[2] * k;
    }
    out[i * 3] = Math.min(r, 1.6);
    out[i * 3 + 1] = Math.min(gg, 1.6);
    out[i * 3 + 2] = Math.min(b, 1.6);
  }
}

/**
 * An eyehole's place on the draped sheet: the point on the cloth at angle th round the sheet and
 * height y (interpolated between the drape's columns and rows), 2 mm out along the cloth's normal,
 * facing out of it, rolled and scaled (31 mm wide, `h` high).
 */
function eyeOnSheet(g: BufferGeometry, th: number, y: number, roll: number, h: number): Matrix4 {
  const P = g.attributes.position as BufferAttribute;
  const N = g.attributes.normal as BufferAttribute;
  const R1 = ROWS + 1;
  const c = ((((th / TAU) * COLS) % COLS) + COLS) % COLS;
  const j0 = Math.floor(c);
  const tj = c - j0;
  const p = new Vector3();
  const n = new Vector3();
  const pa = new Vector3();
  const na = new Vector3();
  const pb = new Vector3();
  const nb = new Vector3();
  [j0, (j0 + 1) % COLS].forEach((j, k) => {
    // the row whose span holds y (the rows run down from the crown)
    let i = 1;
    while (i < ROWS && P.getY(j * R1 + i) > y) i++;
    const a = j * R1 + i - 1;
    const b = j * R1 + i;
    const ya = P.getY(a);
    const yb = P.getY(b);
    const t = Math.abs(ya - yb) > 1e-9 ? clamp((ya - y) / (ya - yb), 0, 1) : 0;
    pa.fromBufferAttribute(P, a).lerp(pb.fromBufferAttribute(P, b), t);
    na.fromBufferAttribute(N, a).lerp(nb.fromBufferAttribute(N, b), t);
    if (k === 0) {
      p.copy(pa);
      n.copy(na);
    } else {
      p.lerp(pa, tj);
      n.lerp(na, tj);
    }
  });
  n.normalize();
  p.addScaledVector(n, 0.002);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), roll));
  return new Matrix4().compose(p, q, new Vector3(0.031, h, 1));
}

/** An eyehole's disc (unit radius in x, y), bowed back to lie on the head under its instance scale. */
function eyeDisc(): BufferGeometry {
  const g = new CircleGeometry(1, 48);
  g.deleteAttribute('uv');
  const P = g.attributes.position as BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i) * 0.031;
    const y = P.getY(i) * 0.04;
    P.setZ(i, -(x * x + y * y) / (2 * 0.13));
  }
  return g;
}

/** the storybook material's moon-rim line (look/materials.ts FRAG_OUT) */
const SB_RIM_LINE = 'outgoingLight += uSbRimColor * edge * toward * behind * uSbRim * uSbRimMul * diffuseColor.a;';
/**
 * The sheet's rim from its smoothed geometric normal, a softer Fresnel (pow 4): the shared rim on
 * the bumped normal drew 1-2 px bright lines along the fold crests that crawl in motion.
 */
function softRim(m: MeshStandardMaterial): MeshStandardMaterial {
  const base = m.onBeforeCompile;
  const key = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = function (this: MeshStandardMaterial, shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) {
    base.call(this, shader, renderer);
    if (!shader.fragmentShader.includes(SB_RIM_LINE)) throw new Error('Neighbour: the storybook rim line moved (look/materials.ts)');
    // the ghosted glow follows the folds (the vertex colour's occlusion) and gathers toward the
    // sheet's edges (a soft Fresnel): it lifts the sheet off the door without flattening it
    if (!shader.fragmentShader.includes('#include <emissivemap_fragment>')) throw new Error('Neighbour: no emissivemap_fragment');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nvec3 nbGeoN = normal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR_ALPHA\ntotalEmissiveRadiance *= clamp(dot(vColor.rgb, vec3(0.45)) * 1.4, 0.15, 1.0) * (0.55 + 0.9 * pow(1.0 - max(dot(nbGeoN, normalize(vViewPosition)), 0.0), 2.0));\n#endif')
      .replace(SB_RIM_LINE, '{ float gE = pow(max(1.0 - max(dot(nbGeoN, V), 0.0), 0.0), 4.0); float gT = smoothstep(-0.25, 0.65, dot(nbGeoN, Lv)); outgoingLight += uSbRimColor * gE * gT * behind * uSbRim * uSbRimMul * diffuseColor.a; }');
  };
  m.customProgramCacheKey = () => `${key()}:nbrim`;
  return m;
}

/** The emissive in the vertex colours (a self-lit term that keeps the surface's own colours). */
function selfLit(m: MeshStandardMaterial): MeshStandardMaterial {
  const base = m.onBeforeCompile;
  const key = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = function (this: MeshStandardMaterial, shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) {
    base.call(this, shader, renderer);
    if (!shader.fragmentShader.includes('#include <emissivemap_fragment>')) throw new Error('Neighbour: no emissivemap_fragment');
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#if defined( USE_COLOR_ALPHA ) || defined( USE_COLOR )\ntotalEmissiveRadiance *= vColor.rgb;\n#endif');
  };
  m.customProgramCacheKey = () => `${key()}:selflit`;
  return m;
}

export interface NeighbourProps {
  pose: UserPose;
  f: number;
  /** Clawd's pail opening in the world (Clawd2.tsx pail2World at the landing): one sweet arcs into it on bar 30-31 */
  pail?: readonly [number, number, number];
}

export function Neighbour({ pose, f, pail }: NeighbourProps) {
  const built = useMemo(() => {
    const sheet = new BufferGeometry();
    const n = COLS * (ROWS + 1);
    const d: Drape = { pos: new Float32Array(n * 3), col: new Float32Array(n * 4) };
    sheet.setAttribute('position', new BufferAttribute(d.pos, 3));
    sheet.setAttribute('color', new BufferAttribute(d.col, 4));
    sheet.setAttribute('aGlow', new BufferAttribute(new Float32Array(n * 3), 3));
    sheet.setAttribute('aGlowW', new BufferAttribute(new Float32Array(n * 3), 3));
    sheet.setIndex(sheetIndex());
    const eyes = new InstancedMesh(eyeDisc(), eyeholeMaterial(), 2);
    eyes.frustumCulled = false;
    eyes.renderOrder = 2;
    const slippers = buildSlippers();
    const bowl = buildBowl();
    const sw = buildSweets();
    const sweets = new PartRig(sw.parts);
    sw.parts.forEach((g) => g.dispose());
    // (a fine weave and pilling in the bump, a little mottle: cotton, not rubber)
    const sheetMat = softRim(glowMaterial({ kind: 'cloth', color: '#ffffff', color2: '#d9dccd', breakup: 0.18, scale: 0.022, bump: 0.75, rim: 1.0, vertexColors: true, roughness: 0.95, side: DoubleSide, emissive: GHOST_GLOW, emissiveIntensity: 0 }));
    const eyeMat = eyes.material as ShaderMaterial;
    const slipperMat = storybookMaterial({ kind: 'cloth', color: '#ffffff', breakup: 0.15, scale: 0.012, bump: 0.8, rim: 0.9, vertexColors: true, roughness: 1 });
    // glossy: the glaze's highlights catch the lanterns and the moon
    // glossy: the glaze's highlights catch the lanterns and the moon; the bowl and its sweets keep a
    // little of their colour in the doorway's dark (a self-lit term in their own colours: without it
    // they read as one dark grey hemisphere from the door camera, below the bowl)
    const bowlMat = selfLit(storybookMaterial({ kind: 'plain', color: '#ffffff', breakup: 0.05, scale: 0.03, rim: 0.9, vertexColors: true, roughness: 0.16, metalness: 0.05, side: DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.3 }));
    const sweetMat = selfLit(storybookMaterial({ kind: 'plain', color: '#ffffff', breakup: 0.04, scale: 0.02, rim: 0.7, vertexColors: true, roughness: 0.3, metalness: 0.1, emissive: '#ffffff', emissiveIntensity: 0.42 }));
    const mats = Array.from({ length: SWEETS }, () => new Matrix4());
    return { sheet, d, tmpN: new Float32Array(n * 3), eyes, slippers, bowl, sweets, rest: sw.rest, mats, sheetMat, eyeMat, slipperMat, bowlMat, sweetMat };
  }, []);
  useLayoutEffect(
    () => () => {
      built.sheet.dispose();
      built.eyes.geometry.dispose();
      built.eyes.dispose();
      built.slippers.dispose();
      built.bowl.dispose();
      built.sweets.dispose();
      for (const m of [built.sheetMat, built.eyeMat, built.slipperMat, built.bowlMat, built.sweetMat]) m.dispose();
    },
    [built],
  );
  const body = bodyOf(pose.stand, pose.tilt);
  // the eyeholes on the sheet over the face: the head's surface (the cloth is taut there), drooping as the person sags
  // the eyeholes' aim on the head (the cloth over the face), drooping as the person sags; they are
  // laid on the draped cloth itself once it is built (eyeOnSheet), never on the head under it: the
  // cloth bunched under the chin poked a facet through an eyehole when it floated on the head
  const eyeAim = [-1, 1].map((side) => {
    const h = body.head;
    const dx = side * 0.05;
    const dy = -0.03 - 0.012 * body.sag;
    const zz = h.r[2] * Math.sqrt(Math.max(0, 1 - (dx / h.r[0]) ** 2 - (dy / h.r[1]) ** 2));
    return { th: Math.atan2(h.c[0] + dx, h.c[2] + zz), y: h.c[1] + dy, roll: side * 0.25 * body.sag };
  });
  const [px, py, pz] = pose.pos;
  const toWorld = new Matrix4().makeRotationY(YAW).setPosition(px, py, pz);
  const bowlAt = body.bowl.clone().setY(body.bowl.y + pose.hop);
  // the dropped sweet: from its place at the low rim to the pail, on a parabola, tumbling
  const dropT = pail ? clamp((f - DROP.from) / (DROP.to - DROP.from), 0, 1) : 0;
  const dropping = pail !== undefined && f >= DROP.from;
  useLayoutEffect(() => {
    drape(pose, f / FPS, built.d);
    const g = built.sheet;
    (g.attributes.position as BufferAttribute).needsUpdate = true;
    (g.attributes.color as BufferAttribute).needsUpdate = true;
    g.computeVertexNormals();
    const N = g.attributes.normal as BufferAttribute;
    smoothNormals(N, built.tmpN);
    // the crown: every column meets there; one normal, straight up
    for (let j = 0; j < COLS; j++) N.setXYZ(j * (ROWS + 1), 0, 1, 0);
    N.needsUpdate = true;
    const glow = g.attributes.aGlow as BufferAttribute;
    practicalLight(g.attributes.position as BufferAttribute, N, toWorld, glow.array as Float32Array);
    glow.needsUpdate = true;
    g.computeBoundingSphere();
    eyeAim.forEach((e, i) => built.eyes.setMatrixAt(i, eyeOnSheet(g, e.th, e.y + pose.hop, e.roll, 0.04 * (1 - 0.22 * body.sag))));
    built.eyes.instanceMatrix.needsUpdate = true;
    built.eyeMat.uniforms.uGhost.value = clamp(pose.ghosted, 0, 1);
    built.sheetMat.emissiveIntensity = GHOST_GLOW_K * clamp(pose.ghosted, 0, 1);
    sweetMatrices(built.rest, body.q, built.mats);
    if (pail) {
      if (f >= DROP.to) built.mats[DROP_K].makeScale(1e-6, 1e-6, 1e-6);
      else if (dropping) {
        // world → bowl-local (the bowl's group: the neighbour's frame, then the bowl's place and tip)
        const toBowl = toWorld.clone().multiply(new Matrix4().compose(bowlAt, body.q, new Vector3(1, 1, 1))).invert();
        const start = new Vector3().setFromMatrixPosition(built.mats[DROP_K]).applyMatrix4(toWorld.clone().multiply(new Matrix4().compose(bowlAt, body.q, new Vector3(1, 1, 1))));
        const end = new Vector3(pail[0], pail[1] - 0.01, pail[2]);
        const e = dropT;
        const w = start.clone().lerp(end, e);
        w.y += 0.12 * Math.sin(Math.PI * e);
        const spin = new Quaternion().setFromAxisAngle(new Vector3(0.3, 1, 0.5).normalize(), e * 7);
        // a touch bigger in the air (it is the beat's one moving thing, 15 px at the door camera)
        built.mats[DROP_K].compose(w.applyMatrix4(toBowl), spin, new Vector3(1.35, 1.35, 1.35));
      }
    }
    built.sweets.pose(built.mats);
  });
  if (!pose.visible) return null;
  return (
    <group position={[px, py, pz]} rotation-y={YAW}>
      <mesh geometry={built.sheet} material={built.sheetMat} castShadow receiveShadow />
      <primitive object={built.eyes} />
      <mesh geometry={built.slippers} material={built.slipperMat} position-y={pose.hop} castShadow receiveShadow />
      <group position={bowlAt.toArray()} quaternion={body.q}>
        <mesh geometry={built.bowl} material={built.bowlMat} castShadow receiveShadow />
        <mesh geometry={built.sweets.geometry} material={built.sweetMat} frustumCulled={false} castShadow />
      </group>
    </group>
  );
}

/** The neighbour's place at the door when fully out (V1's), for cameras and lookdev. */
export const NEIGHBOUR_OUT: V3 = fromV1Door([-0.25, 1.2, -1.05]);
/** V1's sheet height × DOOR_SCALE (the crown, standing) */
export const NEIGHBOUR_H = 2.3 * DOOR_SCALE;

/** Triangle counts (for the budget). */
export function neighbourStats(): Record<string, number> {
  const tri = (g: BufferGeometry) => (g.index ? g.index.count : (g.attributes.position as BufferAttribute).count) / 3;
  const sw = buildSweets();
  return { sheet: COLS * ROWS * 2, eyes: 2 * 48, slippers: tri(buildSlippers()), bowl: tri(buildBowl()), sweets: sw.parts.reduce((a, g) => a + tri(g), 0) };
}
