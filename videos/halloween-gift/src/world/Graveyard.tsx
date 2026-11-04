/**
 * The graveyard's stones: every tombstone of layout's STONES, the big leaning cross at the far
 * left of the hero view (LAND.bigCross) and the big RIP IN PEACE stone by the path before the
 * gates (LAND.ripStone), each a hand-cut field from kit/stone.ts meshed by surface nets:
 * bevelled, slightly bulging, its edges worn unevenly and chipped, some cracked, one broken in
 * two with its top fallen beside it. Each stands where its table entry says, turned by its yaw
 * and leaning (sideways by its lean, a little forward or back from its seed), sunk below the
 * lowest ground under its footprint (Terrain's surfaceHeight), and darkened where it meets the
 * turf (contact occlusion, a damp dark base with moss creeping up). Vertex colour carries the
 * stone's own colour: worn edges lighter, hollows darker, lichen blotches, rain streaks.
 *
 * Carving: the front faces sample one canvas atlas (drawn once, seeded): an albedo multiplier
 * (dark recesses, a light lip on the moon side) and a height for the bump. Worn pseudo
 * lettering, carved crosses, rings and arch borders; only the RIP stone says anything.
 *
 * A few graves have an earth mound (or sunken earth) in front of the stone: a lumpy mesh lying
 * on the terrain, its edge pressed under the turf.
 *
 * Three draw calls (stone bodies, carved faces, earth), about 175k triangles; built in about 2 s.
 */
import { rand, smoothstep } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, CanvasTexture, Color, Euler, Matrix4, Quaternion, Vector3, type MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { breakField, chipped, chipSites, faceFacets, noise3, pseudoGlyph, stoneBounds, stoneField, strokeWord, surfaceNets, wordWidth, type NetMesh, type SDF, type StoneShape } from '../kit/stone.ts';
import { storybookMaterial } from '../look/materials.ts';
import { FLOOR, LAND, pathDistance, pathHalfWidth, STONES } from './layout.ts';
import { surfaceHeight } from './Terrain.tsx';

// ---- the graves -------------------------------------------------------------------------------

type Motif = 'lettering' | 'cross' | 'ring' | 'arch' | 'blank' | 'rip' | 'panel' | 'cross-panel';

interface Grave {
  id: number;
  shape: StoneShape;
  x: number;
  z: number;
  yaw: number;
  /** sideways lean (about the stone's own z) and forward tilt (about its x), radians */
  lean: number;
  tilt: number;
  /** mesh cell size */
  cell: number;
  /** base colour (linear) and rim weight */
  color: Color;
  alpha: number;
  motif: Motif;
  lines: number;
  /** a hairline crack drawn on the face (local x, y polyline) */
  crackLine?: [number, number][];
  /** the broken stone's fallen top: where it lies (stone-local offset, spin) */
  fallen?: { dx: number; dz: number; spin: number; roll: number };
  /** an earth mound in front: raised or sunken */
  mound?: 'raised' | 'sunken';
  /** chips knocked off */
  chips: number;
}

/** weathered limestone, granite and slate (sRGB): light stone, as the reference's moonlit graves */
const PALETTE = ['#99aab3', '#8899a5', '#a9b5b6', '#a1a3a3', '#7d8d98', '#a2afb1'];

/** the big cross leans into the frame (toward world +x) by this much, whatever its yaw */
const CROSS_LEAN = 0.234;

function graves(): Grave[] {
  const out: Grave[] = [];
  STONES.forEach((st, i) => {
    const r = (k: number) => rand(400 + i, 'grave', k);
    const hs = st.h / 0.5;
    // (lighter than the swatch: the vertex shading below darkens it about 0.6 on average)
    const base = new Color(PALETTE[Math.floor(r(0) * PALETTE.length)]).multiplyScalar(1.15 + 0.25 * r(1));
    // hand-cut: worn unevenly (wavy faces, wandering bevels), tops skewed, never two alike
    const common = { seed: 1000 + i * 17, round: 0.005, chamfer: 0.011 + 0.013 * r(2), roundVar: 0.8, wear: 0.005 + 0.004 * r(3), wearFreq: 7 + 5 * r(4), taper: 0.03 + 0.07 * r(5), bulge: 0.1 + 0.2 * r(6), skew: (r(23) - 0.5) * 0.22 };
    const t = (0.09 + 0.04 * r(7)) * (0.8 + 0.25 * hs);
    let shape: StoneShape;
    let fallen: Grave['fallen'];
    const motifs: Motif[] = ['lettering', 'lettering', 'cross', 'ring', 'arch', 'blank', 'cross-panel'];
    let motif = motifs[Math.floor(r(8) * motifs.length)];
    switch (st.kind) {
      case 'round':
        shape = { kind: 'round', h: st.h, w: Math.min(0.46, st.h * (0.7 + 0.14 * r(9))), t, sink: 0, arch: 1 + 0.7 * r(10), shoulders: r(11) < 0.4 ? 0.1 + 0.08 * r(12) : 0, ...common };
        break;
      case 'gothic':
        shape = { kind: 'gothic', h: st.h, w: Math.min(0.44, st.h * (0.62 + 0.1 * r(9))), t, sink: 0, shoulders: r(11) < 0.5 ? 0.08 + 0.06 * r(12) : 0, ...common };
        break;
      case 'slab':
        // a low, wide stone with a flat segmental top and shoulders (never a box)
        shape = { kind: 'round', h: st.h, w: 0.4 + 0.07 * r(9), t: t * 1.15, sink: 0, arch: 2.2 + 1.2 * r(10), shoulders: 0.1 + 0.06 * r(12), ...common, taper: 0.04 };
        motif = r(13) < 0.5 ? 'panel' : 'lettering';
        break;
      case 'cross': {
        const sw = (0.085 + 0.02 * r(9)) * (0.8 + 0.3 * hs);
        shape = { kind: 'cross', h: st.h, w: sw, t: sw * (0.85 + 0.2 * r(10)), sink: 0, arm: { at: 0.68 + 0.06 * r(11), span: st.h * (0.5 + 0.1 * r(12)), hgt: sw * (0.9 + 0.2 * r(14)) }, plinth: { h: 0.06 + 0.04 * r(15), out: 0.025 + 0.015 * r(16) }, ...common, bulge: 0.04, taper: 0.04 };
        motif = r(13) < 0.4 ? 'ring' : 'blank';
        break;
      }
      case 'obelisk':
        shape = { kind: 'obelisk', h: st.h, w: 0.3, t: 0.3, sink: 0, ...common, round: 0.006, wear: 0.0028 };
        motif = 'panel';
        break;
      case 'broken': {
        // a round or pointed headstone snapped along a jagged break; its top lies beside it
        const H0 = st.h * (1.75 + 0.3 * r(9));
        shape = { kind: r(10) < 0.5 ? 'round' : 'gothic', h: H0, w: Math.min(0.42, H0 * 0.68), t: t * 1.05, sink: 0, arch: 1.2, ...common, split: { y: st.h, tilt: (r(11) < 0.5 ? -1 : 1) * (0.18 + 0.2 * r(12)), rough: 0.035, keep: 'below' } };
        // the top falls to whichever side leaves it clear of the neighbouring stones, the RIP stone and the cauldron
        const dx = 0.2 + 0.05 * r(14);
        const dz = 0.12 + 0.06 * r(15);
        const clearance = (side: number) => {
          const c = Math.cos(st.yaw);
          const sn = Math.sin(st.yaw);
          const px = st.x + side * dx * c + (dz + 0.2) * sn;
          const pz = st.z - side * dx * sn + (dz + 0.2) * c;
          const others = [...STONES.filter((o) => o !== st), LAND.ripStone, LAND.cauldron];
          return Math.min(...others.map((o) => Math.hypot(o.x - px, o.z - pz)));
        };
        const side = clearance(1) >= clearance(-1) ? 1 : -1;
        fallen = { dx: side * dx, dz, spin: (r(16) - 0.5) * 1.2, roll: (r(17) - 0.5) * 0.25 };
        motif = 'lettering';
        break;
      }
    }
    // a few graves carry a mound of earth, or a sunken one, in front of the stone
    const mound = st.kind === 'broken' ? undefined : r(18) < 0.38 ? 'raised' : r(18) < 0.5 ? 'sunken' : undefined;
    out.push({
      id: i,
      shape,
      x: st.x,
      z: st.z,
      yaw: st.yaw,
      lean: st.lean,
      tilt: (r(19) - 0.45) * 0.2,
      // the stones near the lens get a finer mesh, the broken ones finer still (crisp fracture facets)
      cell: st.kind === 'broken' ? 0.0095 : st.z > 1.4 ? 0.0135 : 0.0155,
      color: base,
      alpha: 0.7,
      motif,
      lines: 2 + Math.floor(r(20) * 3),
      crackLine: r(21) < 0.35 ? crackPath(shape, r) : undefined,
      fallen,
      mound,
      chips: 10 + Math.floor(r(22) * 8),
    });
  });
  // the RIP stone: a big rounded headstone, leaning back a little and to its right
  out.push({
    id: STONES.length,
    // (an even chamfer: a wandering one steps the outline beside the lettering, reading as a ledge)
    shape: { kind: 'round', seed: 7001, h: 0.92, w: 0.62, t: 0.22, sink: 0, arch: 1.04, skew: 0.05, round: 0.006, chamfer: 0.026, roundVar: 0.25, bulge: 0.12, taper: 0.06, wear: 0.006, wearFreq: 7, cracks: [{ pts: [[0.32, 0.24], [0.26, 0.19], [0.21, 0.1], [0.14, 0.05]], width: 0.006, depth: 0.03 }] },
    x: LAND.ripStone.x,
    z: LAND.ripStone.z,
    yaw: LAND.ripStone.yaw ?? 0,
    lean: -0.15,
    tilt: -0.06,
    cell: 0.013,
    color: new Color('#c9d1d4').multiplyScalar(1.3),
    alpha: 0.7,
    motif: 'rip',
    lines: 0,
    mound: undefined,
    chips: 11,
  });
  // the big cross: a chunky stone cross leaning into the frame from the left edge, framing it as
  // the reference's does (2.3 tall: the hero view was composed around the greybox's size)
  const BC = BIG_CROSS_H / 1.78;
  const crossYaw = LAND.bigCross.yaw ?? 0;
  const bigCross: StoneShape = {
    kind: 'cross',
    seed: 7002,
    h: BIG_CROSS_H,
    w: 0.25 * BC,
    t: 0.2 * BC,
    sink: 0,
    arm: { at: 0.71, span: 0.94 * BC, hgt: 0.26 * BC },
    round: 0.008,
    chamfer: 0.05,
    roundVar: 0.8,
    taper: 0.1,
    bulge: 0.06,
    wear: 0.012,
    wearFreq: 4,
    plinth: { h: 0.16, out: 0.05 },
    cracks: [
      {
        pts: [
          [0.57, 1.66],
          [0.44, 1.58],
          [0.36, 1.48],
          [0.22, 1.45],
        ],
        width: 0.013,
        depth: 0.07,
      },
      {
        pts: [
          [-0.155, 0.72],
          [-0.07, 0.8],
          [-0.08, 0.96],
        ],
        width: 0.009,
        depth: 0.05,
      },
    ],
  };
  bigCross.grooves = [{ pts: crossPanel(bigCross), width: 0.013, depth: 0.04 }];
  out.push({
    id: STONES.length + 1,
    shape: bigCross,
    x: LAND.bigCross.x,
    z: LAND.bigCross.z,
    yaw: crossYaw,
    // the lean in the cross's own frame that tips its top toward world +x
    lean: -CROSS_LEAN * Math.cos(crossYaw),
    tilt: CROSS_LEAN * Math.sin(crossYaw),
    cell: 0.0135,
    color: new Color('#a3acb2').multiplyScalar(1.3),
    alpha: 0.5,
    motif: 'cross-panel',
    lines: 0,
    chips: 26,
  });
  return out;
}

/** The big cross's height (LAND.bigCross at scale 1). */
export const BIG_CROSS_H = 2.3 * (LAND.bigCross.scale ?? 1);

/** A hairline crack from the stone's edge toward its middle (local x, y). */
function crackPath(s: StoneShape, r: (k: number) => number): [number, number][] {
  const side = r(30) < 0.5 ? -1 : 1;
  const hw = s.w / 2;
  let x = side * hw;
  let y = s.h * (0.35 + 0.4 * r(31));
  const pts: [number, number][] = [[x, y]];
  for (let k = 0; k < 5; k++) {
    x -= side * hw * (0.12 + 0.12 * r(32 + k));
    y += (r(40 + k) - 0.6) * 0.05;
    pts.push([x, y]);
  }
  return pts;
}

// ---- placing ------------------------------------------------------------------------------------

/** A grid sample of the terrain around a point (bilinear between samples): the per-vertex contact needs thousands of heights. */
class GroundPatch {
  private readonly h: Float32Array;
  private readonly n: number;
  constructor(
    private readonly cx: number,
    private readonly cz: number,
    private readonly r: number,
    private readonly step = 0.05,
  ) {
    this.n = Math.ceil((2 * r) / step) + 1;
    this.h = new Float32Array(this.n * this.n);
    for (let j = 0; j < this.n; j++) for (let i = 0; i < this.n; i++) this.h[i + j * this.n] = surfaceHeight(cx - r + i * step, cz - r + j * step);
  }
  at(x: number, z: number): number {
    const u = Math.min(this.n - 1.001, Math.max(0, (x - this.cx + this.r) / this.step));
    const v = Math.min(this.n - 1.001, Math.max(0, (z - this.cz + this.r) / this.step));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = u - i;
    const fv = v - j;
    const n = this.n;
    const a = this.h[i + j * n] + (this.h[i + 1 + j * n] - this.h[i + j * n]) * fu;
    const b = this.h[i + (j + 1) * n] + (this.h[i + 1 + (j + 1) * n] - this.h[i + (j + 1) * n]) * fu;
    return a + (b - a) * fv;
  }
}

/** The stone's local frame in the world, and how deep its base must reach below the ground line. */
function standing(g: Grave, ground: GroundPatch): { m: Matrix4; sink: number } {
  const s = g.shape;
  const hw = s.kind === 'cross' ? Math.max(s.w / 2 + (s.plinth?.out ?? 0), 0.08) : s.w / 2 + (s.plinth?.out ?? 0);
  const ht = s.kind === 'obelisk' ? s.w / 2 : s.t / 2 + (s.plinth?.out ?? 0);
  const c = Math.cos(g.yaw);
  const sn = Math.sin(g.yaw);
  let lo = Infinity;
  for (let a = -1; a <= 1; a += 0.5)
    for (let b = -1; b <= 1; b += 1) {
      const lx = a * hw;
      const lz = b * ht;
      lo = Math.min(lo, ground.at(g.x + lx * c + lz * sn, g.z - lx * sn + lz * c));
    }
  const centre = ground.at(g.x, g.z);
  // the base goes below the lowest ground under the footprint, leaning or not
  const sink = Math.max(0.07, centre - lo + hw * Math.abs(Math.sin(g.lean)) + ht * Math.abs(Math.sin(g.tilt)) + 0.05);
  const m = new Matrix4().compose(new Vector3(g.x, FLOOR + centre - 0.012, g.z), new Quaternion().setFromEuler(new Euler(g.tilt, g.yaw, g.lean, 'YXZ')), new Vector3(1, 1, 1));
  return { m, sink };
}

/** The fallen top's frame: it lies on its back in front of the stub and a little aside, its top away from it, sunk and askew. */
function lying(g: Grave, ground: GroundPatch): Matrix4 {
  const f = g.fallen!;
  const s = g.shape;
  const yb = s.split!.y;
  const c = Math.cos(g.yaw);
  const sn = Math.sin(g.yaw);
  const wx = g.x + f.dx * c + f.dz * sn;
  const wz = g.z - f.dx * sn + f.dz * c;
  const y = FLOOR + ground.at(wx, wz) + s.t * 0.34;
  // the piece's own frame: its break edge at the origin, laid on its back (its top toward the
  // stone's front), spun about the vertical and rolled a little
  return new Matrix4()
    .makeTranslation(wx, y, wz)
    .multiply(new Matrix4().makeRotationY(g.yaw + Math.PI + f.spin))
    .multiply(new Matrix4().makeRotationZ(f.roll))
    .multiply(new Matrix4().makeRotationX(-Math.PI / 2 + 0.1))
    .multiply(new Matrix4().makeTranslation(0, -yb, 0));
}

// ---- the carving atlas ----------------------------------------------------------------------------

/** A canvas that draws nothing (lays out lettering before it is cut). */
const NOOP_CTX = { beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} } as unknown as CanvasRenderingContext2D;

/** The big cross's sunk panel border (stone-local x, y): inset from its stem and arms, open at the foot. */
function crossPanel(s: StoneShape): [number, number][] {
  const a = s.arm!;
  const ay = a.at * s.h;
  const i = 0.06;
  const sw = s.w / 2 - i;
  const ah = a.hgt / 2 - i;
  const sx = a.span / 2 - i;
  return [
    [-sw, 0.24],
    [-sw, ay - ah],
    [-sx, ay - ah],
    [-sx, ay + ah],
    [-sw, ay + ah],
    [-sw, s.h - i],
    [sw, s.h - i],
    [sw, ay + ah],
    [sx, ay + ah],
    [sx, ay - ah],
    [sw, ay - ah],
    [sw, 0.24],
  ];
}

const ATLAS = 2048;
/** canvas value of an uncarved face (the face material scales by its inverse) */
const PLATE = 200;

interface Cell {
  /** pixel rect in the atlas */
  px: number;
  py: number;
  pw: number;
  ph: number;
  /** the face rect it maps (local metres) and its scale (px per metre) */
  x0: number;
  y1: number;
  k: number;
}

function faceRect(s: StoneShape): { x0: number; x1: number; y0: number; y1: number } {
  const b = stoneBounds(s, 0.01);
  return { x0: b.min[0], x1: b.max[0], y0: -0.1, y1: b.max[1] };
}

function cellFor(g: Grave, slot: number): Cell {
  const r = faceRect(g.shape);
  let px: number;
  let py: number;
  let pw: number;
  let ph: number;
  if (g.motif === 'rip') [px, py, pw, ph] = [0, 1152, 512, 768];
  else if (g.id === STONES.length + 1) [px, py, pw, ph] = [512, 1152, 512, 896];
  else [px, py, pw, ph] = [(slot % 8) * 256, Math.floor(slot / 8) * 384, 256, 384];
  const k = Math.min((pw - 8) / (r.x1 - r.x0), (ph - 8) / (r.y1 - r.y0));
  // centred in the cell
  const x0 = (r.x0 + r.x1) / 2 - pw / 2 / k;
  const y1 = (r.y0 + r.y1) / 2 + ph / 2 / k;
  return { px, py, pw, ph, x0, y1, k };
}

/** Draw one stone's carving into the albedo (a) and height (h) atlases. */
function drawCarving(a: CanvasRenderingContext2D, h: CanvasRenderingContext2D, g: Grave, c: Cell): void {
  const s = g.shape;
  const r = (k: number) => rand(800 + g.id, 'carve', k);
  for (const ctx of [a, h]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(c.px, c.py, c.pw, c.ph);
    ctx.clip();
    ctx.setTransform(c.k, 0, 0, -c.k, c.px - c.x0 * c.k, c.py + c.y1 * c.k);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  /**
   * An incised groove along the path `p` (metres), width w (metres), depth 0..1 (`hDepth` the
   * bump's share, 0 where the geometry is cut already). The albedo paints the cut as lit from
   * above: a light lower lip (the wall that faces up), the dark recess, a darker upper wall.
   */
  const groove = (p: (ctx: CanvasRenderingContext2D) => void, w: number, depth = 1, fill = false, hDepth = depth) => {
    const px = w * c.k;
    const draw = (ctx: CanvasRenderingContext2D) => {
      p(ctx);
      if (fill) ctx.fill();
      else ctx.stroke();
    };
    if (hDepth > 0) {
      // height: a soft V groove
      h.filter = `blur(${Math.max(0.6, px * 0.2).toFixed(2)}px)`;
      h.globalAlpha = hDepth;
      h.strokeStyle = '#000';
      h.fillStyle = '#000';
      h.lineWidth = w;
      draw(h);
      h.filter = 'none';
      h.globalAlpha = 1;
    }
    const layer = (color: string, alpha: number, lw: number, dx: number, dy: number) => {
      a.save();
      a.globalAlpha = alpha * depth;
      a.strokeStyle = color;
      a.fillStyle = color;
      a.lineWidth = lw;
      a.translate(dx, dy);
      draw(a);
      a.restore();
    };
    layer('#ffffff', 0.85, w * 0.9, w * 0.12, -w * 0.42);
    layer('#1a1a1e', 0.95, w, 0, 0);
    layer('#050506', 0.75, w * 0.5, 0, w * 0.24);
  };
  const hw = s.w / 2;
  const top = s.kind === 'cross' ? s.h : s.h;
  // worn lettering: centred lines of even cap height, words of worn capitals (never readable)
  const lettering = (yTop: number, lines: number, width: number, gh: number) => {
    let y = yTop;
    for (let l = 0; l < lines; l++) {
      const size = l === 0 ? gh * 1.12 : gh * (0.84 + 0.1 * r(120 + l));
      const sp = size * 0.2;
      const lineW = width * (l === 0 ? 0.78 + 0.22 * r(100 + l) : 0.5 + 0.45 * r(100 + l));
      // lay the line out first (glyph widths from a dry run), then centre it
      const items: { k: number; w: number }[] = [];
      let used = 0;
      let inWord = 0;
      let wordLen = 3 + Math.floor(r(130 + l) * 5);
      for (let k = 0; k < 40; k++) {
        const kk = 1000 + l * 50 + k * 13;
        if (inWord >= wordLen) {
          items.push({ k: -1, w: size * 0.45 });
          used += size * 0.45;
          inWord = 0;
          wordLen = 2 + Math.floor(r(kk + 7) * 6);
          continue;
        }
        const w = pseudoGlyph(NOOP_CTX, 0, 0, size, (q) => r(kk + q));
        if (used + w > lineW) break;
        items.push({ k: kk, w });
        used += w + sp;
        inWord++;
      }
      while (items.length && items[items.length - 1].k < 0) used -= items.pop()!.w;
      let x = -used / 2 + (r(110 + l) - 0.5) * 0.008;
      for (const it of items) {
        if (it.k >= 0) {
          const x0 = x;
          groove(
            (ctx) => {
              pseudoGlyph(ctx, x0, y, size, (q) => r(it.k + q));
            },
            size * 0.17,
            0.55 + 0.45 * r(it.k + 11),
          );
          x += it.w + sp;
        } else x += it.w;
      }
      y -= size * 1.65;
    }
  };
  // an incised line following the stone's outline, inset
  const archBorder = (inset: number) => {
    groove((ctx) => {
      ctx.beginPath();
      const ih = hw - inset;
      const yb = 0.06;
      if (s.kind === 'gothic') {
        const R = ih * 1.9;
        const ha = Math.sqrt(R * R - (R - ih) * (R - ih));
        const yS = top - inset - ha;
        // the left side is an arc of the circle centred right of the middle, and vice versa
        const t1 = Math.acos((R - ih) / R);
        ctx.moveTo(-ih, yb);
        ctx.lineTo(-ih, yS);
        ctx.arc(R - ih, yS, R, Math.PI, Math.PI - t1, true);
        ctx.arc(ih - R, yS, R, t1, 0, true);
        ctx.lineTo(ih, yb);
      } else if (s.kind === 'slab' || s.kind === 'obelisk') {
        ctx.rect(-ih, yb, ih * 2, top - inset - yb - 0.02);
      } else {
        const R = ih * (s.arch ?? 1);
        const cy = top - inset - R;
        const yS = cy + Math.sqrt(Math.max(0, R * R - ih * ih));
        const a0 = Math.atan2(yS - cy, ih);
        ctx.moveTo(-ih, yb);
        ctx.lineTo(-ih, yS);
        ctx.arc(0, cy, R, Math.PI - a0, a0, true);
        ctx.lineTo(ih, yb);
      }
    }, 0.007, 0.8);
  };
  /** a carved cross, its arms crossing at (cx, cy) */
  const crossRelief = (cx: number, cy: number, size: number) =>
    groove(
      (ctx) => {
        ctx.beginPath();
        const w = size * 0.2;
        ctx.rect(cx - w / 2, cy - size * 0.64, w, size);
        ctx.rect(cx - size * 0.33, cy - w / 2, size * 0.66, w);
      },
      0.006,
      0.9,
      true,
    );
  const ring = (cx: number, cy: number, rad: number) =>
    groove((ctx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    }, 0.008, 0.8);

  switch (g.motif) {
    case 'lettering':
      if (s.kind !== 'slab' && r(1) < 0.5) crossRelief(0, top * 0.78, Math.min(0.09, hw * 0.45));
      lettering(top * (s.kind === 'slab' ? 0.72 : 0.62), g.lines, s.w * 0.7, Math.min(0.042, s.w * 0.1));
      break;
    case 'cross':
      crossRelief(0, top * 0.62, Math.min(top * 0.42, 0.2));
      lettering(top * 0.28, 1, s.w * 0.6, 0.032);
      break;
    case 'ring':
      if (s.kind === 'cross') {
        const at = (s.arm?.at ?? 0.7) * s.h;
        ring(0, at, s.w * 0.32);
      } else {
        // a Celtic cross: its arms run through a ring centred on the crossing
        const cs = Math.min(0.2, hw * 0.75);
        crossRelief(0, top * 0.72, cs);
        ring(0, top * 0.72, cs * 0.22);
        lettering(top * 0.42, Math.max(1, g.lines - 1), s.w * 0.65, 0.032);
      }
      break;
    case 'arch':
      archBorder(0.03 + 0.01 * r(3));
      lettering(top * 0.58, g.lines, s.w * 0.62, Math.min(0.038, s.w * 0.09));
      break;
    case 'cross-panel':
      if (s.kind === 'cross') {
        // the big cross: a sunk panel border along its stem and arms (as the reference's), worn
        // the sunk panel border is cut in the geometry (crossPanel); the atlas darkens its channel
        const pts = crossPanel(s);
        groove(
          (ctx) => {
            ctx.beginPath();
            pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          },
          0.026,
          0.7,
          false,
          0,
        );
      } else {
        archBorder(0.028);
        crossRelief(0, top * 0.55, Math.min(0.16, top * 0.35));
      }
      break;
    case 'panel': {
      // an inscription panel: on the obelisk's die, across a slab
      if (s.kind === 'obelisk') {
        const db = s.w * 0.4 - 0.025;
        const y0 = s.h * 0.085 + 0.025;
        const y1 = s.h * 0.305 - 0.02;
        groove((ctx) => {
          ctx.beginPath();
          ctx.rect(-db, y0, db * 2, y1 - y0);
        }, 0.006, 0.8);
        lettering(y1 - 0.035, 3, db * 1.6, 0.026);
      } else {
        archBorder(0.03);
        lettering(top * 0.66, Math.min(2, g.lines), s.w * 0.62, 0.036);
      }
      break;
    }
    case 'rip': {
      archBorder(0.034);
      const big = 0.185;
      const wR = wordWidth('RIP', 0.24) * big;
      a.lineCap = h.lineCap = 'round';
      const jit = (k: number) => (rand(97, 'rip', k) - 0.5) * 0.035;
      // the letters are drawn y-down (canvas convention): flip back for them
      // `cond` narrows a word's letters (cut to fit the face, as a mason would)
      const word = (text: string, x: number, base: number, size: number, sp: number, k0: number, slant: number, cond = 1) => (ctx: CanvasRenderingContext2D) => {
        ctx.save();
        ctx.scale(cond, -1);
        strokeWord(ctx, text, x / cond, -base, size, { spacing: sp, jitter: (k) => jit(k + k0), slant });
        ctx.restore();
      };
      groove(word('RIP', -wR / 2, 0.47, big, 0.24, 0, 0.03), 0.032, 1);
      // as wide as the face allows inside the border (0.55 of the 0.62), condensed: 0.62 of RIP's height
      const small = 0.115;
      const cond = 0.8;
      const wP = wordWidth('IN PEACE', 0.12) * small * cond;
      groove(word('IN PEACE', -wP / 2, 0.29, small, 0.12, 400, 0.02, cond), 0.02, 1);
      break;
    }
    default:
      break;
  }
  if (g.crackLine) {
    const pts = g.crackLine;
    groove((ctx) => {
      ctx.beginPath();
      pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    }, 0.004, 0.9);
  }
  for (const ctx of [a, h]) ctx.restore();
}

function carvingAtlas(list: Grave[], cells: Cell[]): { albedo: CanvasTexture; height: CanvasTexture } {
  const make = (fill: string) => {
    const c = document.createElement('canvas');
    c.width = ATLAS;
    c.height = ATLAS;
    const g = c.getContext('2d')!;
    g.fillStyle = fill;
    g.fillRect(0, 0, ATLAS, ATLAS);
    return { c, g };
  };
  const A = make(`rgb(${PLATE},${PLATE},${PLATE})`);
  const H = make('#ffffff');
  list.forEach((g, i) => drawCarving(A.g, H.g, g, cells[i]));
  const tex = (c: HTMLCanvasElement) => {
    const t = new CanvasTexture(c);
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  return { albedo: tex(A.c), height: tex(H.c) };
}

// ---- building ---------------------------------------------------------------------------------

const MOSS = new Color('#4f6a56');
const LICHEN = new Color('#c4cdbd');
const DAMP = new Color('#2c2a30');
const ss = smoothstep;

interface Piece {
  grave: Grave;
  mesh: NetMesh;
  m: Matrix4;
  ground: GroundPatch;
  /** a broken piece: its break (< 0 below the fracture) and its body without the break, stone-local */
  fracture?: { brk: SDF; body: SDF };
}

/** Fresh fracture: lighter, unweathered stone. */
const FRESH = new Color('#b9bcbb');

/** Colour (RGBA), world placement, contact darkening and the face/body split of one meshed piece. */
function bake(p: Piece, cell: Cell, body: BufferGeometry[], face: BufferGeometry[]): void {
  const { mesh, m, grave: g, ground } = p;
  const nv = mesh.positions.length / 3;
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 4);
  const uv = new Float32Array(nv * 2);
  const above = new Float32Array(nv);
  const nm = new Matrix4().extractRotation(m);
  const v = new Vector3();
  const n = new Vector3();
  const c = new Color();
  const seed = g.shape.seed;
  for (let i = 0; i < nv; i++) {
    const lx = mesh.positions[i * 3];
    const ly = mesh.positions[i * 3 + 1];
    const lz = mesh.positions[i * 3 + 2];
    const ny = mesh.normals[i * 3 + 1];
    v.set(lx, ly, lz).applyMatrix4(m);
    n.set(mesh.normals[i * 3], ny, mesh.normals[i * 3 + 2]).applyMatrix4(nm).normalize();
    pos[i * 3] = v.x;
    pos[i * 3 + 1] = v.y;
    pos[i * 3 + 2] = v.z;
    nrm[i * 3] = n.x;
    nrm[i * 3 + 1] = n.y;
    nrm[i * 3 + 2] = n.z;
    const conv = mesh.convex[i];
    const open = mesh.open[i];
    c.copy(g.color);
    // worn edges lighter, hollows and crevices darker
    c.multiplyScalar((1 + 1.1 * ss(0.04, 0.35, conv)) * (0.45 + 0.55 * ss(-0.4, -0.02, conv)) * (0.55 + 0.45 * open));
    // weathered lighter toward the top, darker and damper toward the foot; mottled light and dark
    c.multiplyScalar(0.72 + 0.5 * ss(-0.05, 1.0, ly / Math.max(0.2, g.shape.h)));
    c.multiplyScalar(0.5 + 0.95 * (0.65 * noise3(lx * 7.5, ly * 7.5, lz * 7.5, seed + 20) + 0.35 * noise3(lx * 19, ly * 19, lz * 19, seed + 19)));
    // lichen blotches (pale) and moss patches (dark green) in the stone's own frame
    const l1 = noise3(lx * 11, ly * 11, lz * 11, seed + 21) + 0.5 * noise3(lx * 29, ly * 29, lz * 29, seed + 22);
    c.lerp(LICHEN, ss(0.84, 1.04, l1) * 0.75);
    const mo = noise3(lx * 6, ly * 6, lz * 6, seed + 23) + 0.4 * noise3(lx * 17, ly * 17, lz * 17, seed + 24) + 0.35 * Math.max(0, ny) + 0.25 * ss(-0.1, -0.35, conv);
    c.lerp(MOSS, ss(0.9, 1.2, mo) * 0.7);
    // rain streaks down the faces from the top
    const st = noise3(lx * 38, ly * 2.2, lz * 38, seed + 25);
    c.multiplyScalar(1 - 0.28 * ss(0.55, 0.85, st) * (1 - Math.abs(ny)));
    // tops and upper bevels weathered paler (they catch the sky and the low moon)
    c.multiplyScalar(1 + 0.22 * ss(0.35, 0.9, n.y));
    // the ground: contact shadow, a damp dark base with moss creeping up
    const gy = FLOOR + ground.at(v.x, v.z);
    const ha = v.y - gy;
    above[i] = ha;
    const wob = 0.04 * (noise3(v.x * 9, 0.5, v.z * 9, seed + 26) - 0.5);
    const damp = 1 - ss(0.0, 0.2, ha + wob);
    c.lerp(DAMP, damp * 0.55);
    c.lerp(MOSS, damp * 0.25 * noise3(lx * 14, ly * 14, lz * 14, seed + 27));
    c.multiplyScalar(0.3 + 0.7 * ss(-0.015, 0.13, ha + wob * 0.5));
    col[i * 4] = c.r;
    col[i * 4 + 1] = c.g;
    col[i * 4 + 2] = c.b;
    col[i * 4 + 3] = g.alpha * (0.7 + 0.3 * ss(0.0, 0.25, ha));
    // the face atlas: local x, y on the stone's face → the cell (clamped inside it)
    const px = Math.min(cell.px + cell.pw - 3, Math.max(cell.px + 3, cell.px + (lx - cell.x0) * cell.k));
    const py = Math.min(cell.py + cell.ph - 3, Math.max(cell.py + 3, cell.py + (cell.y1 - ly) * cell.k));
    uv[i * 2] = px / ATLAS;
    uv[i * 2 + 1] = 1 - py / ATLAS;
  }
  // a broken piece's fracture: the vertices on the break (and well inside the body)
  const onBreak = new Uint8Array(nv);
  if (p.fracture) {
    const { brk, body: inner } = p.fracture;
    const tol = g.cell * 0.75;
    for (let i = 0; i < nv; i++) {
      const lx = mesh.positions[i * 3];
      const ly = mesh.positions[i * 3 + 1];
      const lz = mesh.positions[i * 3 + 2];
      onBreak[i] = Math.abs(brk(lx, ly, lz)) < tol && inner(lx, ly, lz) < -g.cell * 0.45 ? 1 : 0;
    }
  }
  // split: carved front faces (all three normals face the stone's front), fracture facets and the
  // rest; drop what is buried
  const fi: number[] = [];
  const bi: number[] = [];
  const fr: number[] = [];
  const I = mesh.indices;
  const nz = (k: number) => mesh.normals[k * 3 + 2];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t];
    const b = I[t + 1];
    const d = I[t + 2];
    if (above[a] < -0.035 && above[b] < -0.035 && above[d] < -0.035) continue;
    if (onBreak[a] && onBreak[b] && onBreak[d]) fr.push(a, b, d);
    else if (nz(a) > 0.72 && nz(b) > 0.72 && nz(d) > 0.72) fi.push(a, b, d);
    else bi.push(a, b, d);
  }
  if (fr.length) body.push(fractureFacets(fr, pos, uv, g));
  const geo = (idx: number[]) => {
    const gm = new BufferGeometry();
    gm.setAttribute('position', new BufferAttribute(pos, 3));
    gm.setAttribute('normal', new BufferAttribute(nrm, 3));
    gm.setAttribute('color', new BufferAttribute(col, 4));
    gm.setAttribute('uv', new BufferAttribute(uv, 2));
    gm.setIndex(idx);
    return compact(gm);
  };
  if (bi.length) body.push(geo(bi));
  if (fi.length) face.push(geo(fi));
}

/**
 * The fracture's triangles as flat facets (their own vertices, the face normal): fresh, lighter
 * stone with crisp creases, as a snapped stone shows.
 */
function fractureFacets(tri: number[], pos: Float32Array, uv: Float32Array, g: Grave): BufferGeometry {
  const n = tri.length;
  const P = new Float32Array(n * 3);
  const N = new Float32Array(n * 3);
  const C = new Float32Array(n * 4);
  const U = new Float32Array(n * 2);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const col = new Color();
  for (let t = 0; t < n; t += 3) {
    a.fromArray(pos, tri[t] * 3);
    b.fromArray(pos, tri[t + 1] * 3);
    c.fromArray(pos, tri[t + 2] * 3);
    const fn = c.clone().sub(b).cross(a.clone().sub(b)).normalize();
    // the facet's own shade: fresh stone, a little dust in the lower facets
    const k = 0.82 + 0.3 * noise3(a.x * 21, a.y * 21, a.z * 21, g.shape.seed + 41);
    col.copy(FRESH).multiplyScalar(k);
    for (let j = 0; j < 3; j++) {
      const v = tri[t + j];
      P.set([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]], (t + j) * 3);
      N.set([fn.x, fn.y, fn.z], (t + j) * 3);
      C.set([col.r, col.g, col.b, 0.35], (t + j) * 4);
      U.set([uv[v * 2], uv[v * 2 + 1]], (t + j) * 2);
    }
  }
  const gm = new BufferGeometry();
  gm.setAttribute('position', new BufferAttribute(P, 3));
  gm.setAttribute('normal', new BufferAttribute(N, 3));
  gm.setAttribute('color', new BufferAttribute(C, 4));
  gm.setAttribute('uv', new BufferAttribute(U, 2));
  gm.setIndex(new BufferAttribute(Uint32Array.from({ length: n }, (_, i) => i), 1));
  return gm;
}

/** Drop the vertices an index no longer uses. */
function compact(g: BufferGeometry): BufferGeometry {
  const idx = g.index!.array;
  const map = new Int32Array(g.attributes.position.count).fill(-1);
  let n = 0;
  for (let i = 0; i < idx.length; i++) if (map[idx[i]] < 0) map[idx[i]] = n++;
  const out = new BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const src = g.attributes[name] as BufferAttribute;
    const k = src.itemSize;
    const arr = new Float32Array(n * k);
    for (let i = 0; i < map.length; i++) if (map[i] >= 0) for (let j = 0; j < k; j++) arr[map[i] * k + j] = src.array[i * k + j];
    out.setAttribute(name, new BufferAttribute(arr, k));
  }
  const ni = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) ni[i] = map[idx[i]];
  out.setIndex(new BufferAttribute(ni, 1));
  g.dispose();
  return out;
}

/** Mesh one grave (and its fallen top). */
function meshGrave(g: Grave): Piece[] {
  const ground = new GroundPatch(g.x, g.z, g.fallen ? 0.62 : g.id === STONES.length + 1 ? 0.8 : 0.45, 0.065);
  const st = standing(g, ground);
  const shape: StoneShape = { ...g.shape, sink: st.sink };
  const b = stoneBounds(shape);
  const raw = stoneField(shape);
  const r = (k: number) => rand(g.shape.seed, 'chips', k);
  // fewer, flatter chips on the broken pieces (scoops read as chewed there) and on the RIP stone
  // (a scoop in its arch reads as a hole)
  const fewer = !!shape.split || g.motif === 'rip';
  // (the RIP stone's chips keep to its arch: a flat chip in the edge beside the lettering reads as a ledge)
  const chips = chipSites(raw, b.min, b.max, shape.split ? Math.round(g.chips * 0.6) : g.chips, r, { depth: [0.008, 0.026 * Math.min(1.8, shape.h / 0.5)], radius: [0.03, 0.07 * Math.min(1.8, shape.h / 0.5)], minY: g.motif === 'rip' ? shape.h * 0.62 : 0.03, scoop: fewer ? 0.08 : 0.3, spacing: 0.035 });
  // the mason's dressing: broad shallow flat cuts over the faces (wider on the big stones)
  const big = Math.min(2, shape.h / 0.5);
  // (none on the RIP stone: a tilted flat cut on its side, ending at its ball, steps its outline
  // beside the lettering and reads as a ledge)
  const dressed = g.motif === 'rip' ? 0 : shape.kind === 'cross' ? Math.round(8 * big) : Math.round(10 + 6 * big);
  const facets = faceFacets(raw, b.min, b.max, dressed, (k) => rand(g.shape.seed, 'facets', k), { depth: [0.0025, 0.006], radius: [0.06 * big, 0.12 * big], tilt: [0.05, 0.13], minY: 0.02 });
  const field = chipped(raw, [...chips, ...facets]);
  const fracture = shape.split ? { brk: breakField(shape), body: stoneField({ ...shape, split: undefined }) } : undefined;
  const out: Piece[] = [{ grave: g, mesh: surfaceNets(field, b.min, b.max, g.cell), m: st.m, ground, fracture }];
  if (g.fallen && shape.split) {
    const top = stoneField({ ...shape, split: { ...shape.split, keep: 'above' } });
    const tf = chipped(top, [...chips, ...facets]);
    const tb = { min: [b.min[0], shape.split.y - 0.12, b.min[2]] as [number, number, number], max: b.max };
    out.push({ grave: { ...g, alpha: 0.75 }, mesh: surfaceNets(tf, tb.min, tb.max, g.cell), m: lying(g, ground), ground, fracture });
  }
  return out;
}

// ---- the earth on the graves --------------------------------------------------------------------

function moundGeometry(list: Grave[]): BufferGeometry | null {
  const parts: BufferGeometry[] = [];
  const c = new Color();
  const EARTH = new Color('#43363a');
  const EARTH_DARK = new Color('#1e171a');
  for (const g of list) {
    if (!g.mound) continue;
    const hs = g.shape.h / 0.5;
    const fx = Math.sin(g.yaw);
    const fz = Math.cos(g.yaw);
    const cx = g.x + fx * (0.36 * hs + 0.02);
    const cz = g.z + fz * (0.36 * hs + 0.02);
    const ra = 0.31 * Math.max(0.8, hs);
    const rb = 0.17;
    // never onto the track
    const far = pathDistance(cx + fx * ra, cz + fz * ra);
    if (far.d < pathHalfWidth(far.s) * 1.5) continue;
    const rings = 8;
    const segs = 26;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const raised = g.mound === 'raised';
    const hm = raised ? 0.04 + 0.025 * rand(g.id, 'mound', 0) : 0.0;
    for (let i = 0; i <= rings; i++) {
      const rr = i / rings;
      for (let j = 0; j < (i === 0 ? 1 : segs); j++) {
        const a = (j / segs) * Math.PI * 2;
        const wob = 1 + 0.12 * (noise3(Math.cos(a) * 2 + g.id, Math.sin(a) * 2, 0.3, 61) - 0.5);
        const u = Math.cos(a) * ra * rr * wob;
        const w = Math.sin(a) * rb * rr * wob;
        const x = cx + u * fx + w * fz;
        const z = cz + u * fz - w * fx;
        const lump = 0.008 * (noise3(x * 19, 0.7, z * 19, 62) - 0.5) + 0.004 * (noise3(x * 47, 1.7, z * 47, 63) - 0.5);
        let y: number;
        if (raised) y = hm * Math.pow(Math.max(0, 1 - rr * rr), 0.75) + lump * (1 - rr * 0.5) - 0.014 * ss(0.8, 1, rr);
        else y = 0.006 + 0.01 * Math.exp(-((rr - 0.8) ** 2) / 0.012) + lump * 0.6 - 0.016 * ss(0.92, 1, rr);
        pos.push(x, FLOOR + surfaceHeight(x, z) + y, z);
        // fresh, loose earth: darker at the foot and in a sunken grave's hollow
        const t = raised ? 0.35 + 0.65 * ss(1, 0.3, rr) : 0.25 + 0.6 * ss(0.55, 0.85, rr) * ss(1, 0.9, rr);
        c.copy(EARTH_DARK).lerp(EARTH, t).multiplyScalar(0.85 + 0.3 * noise3(x * 23, 0.2, z * 23, 64));
        col.push(c.r, c.g, c.b, 0.35);
      }
    }
    const ringStart = (i: number) => (i === 0 ? 0 : 1 + (i - 1) * segs);
    for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
    for (let i = 1; i < rings; i++)
      for (let j = 0; j < segs; j++) {
        const a = ringStart(i) + j;
        const b = ringStart(i) + ((j + 1) % segs);
        const d = ringStart(i + 1) + j;
        const e = ringStart(i + 1) + ((j + 1) % segs);
        idx.push(a, b, e, a, e, d);
      }
    const gm = new BufferGeometry();
    gm.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    gm.setAttribute('color', new BufferAttribute(new Float32Array(col), 4));
    gm.setIndex(idx);
    gm.computeVertexNormals();
    parts.push(gm);
  }
  if (!parts.length) return null;
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

// ---- the component ------------------------------------------------------------------------------

export interface GraveyardBuild {
  body: BufferGeometry;
  face: BufferGeometry;
  earth: BufferGeometry | null;
  albedo: CanvasTexture;
  height: CanvasTexture;
}

/** Build the graveyard's geometry and carving (pure, seeded; needs a DOM canvas for the atlas). */
export function buildGraveyard(): GraveyardBuild {
  const list = graves();
  const cells = list.map((g, i) => cellFor(g, i));
  const body: BufferGeometry[] = [];
  const face: BufferGeometry[] = [];
  list.forEach((g, i) => {
    for (const p of meshGrave(g)) bake(p, cells[i], body, face);
  });
  const mb = mergeGeometries(body);
  const mf = mergeGeometries(face);
  body.forEach((x) => x.dispose());
  face.forEach((x) => x.dispose());
  const { albedo, height } = carvingAtlas(list, cells);
  return { body: mb, face: mf, earth: moundGeometry(list), albedo, height };
}

/**
 * How much of the storybook ambient the stones take. Under the first near ambient (#5e2a32, a
 * saturated maroon) light stone in shadow turned red at full strength (0.6 held it on the
 * reference's grey plum); with the greyer #4a3040 the stones take most of it again.
 */
export const STONE_AMBIENT = 0.85;

/** The stones' paint: a cool storybook stone, its colour in the vertex colours, pale moonlit lichen on the tops. */
function stoneMaterials(albedo: CanvasTexture, height: CanvasTexture): { body: MeshStandardMaterial; face: MeshStandardMaterial; earth: MeshStandardMaterial } {
  const common = { kind: 'stone' as const, color2: '#a2c4d2', vertexColors: true, breakup: 0.4, scale: 0.085, bump: 1.3, topCoat: 0.6, rim: 0.5, ambient: STONE_AMBIENT, roughness: 0.88 };
  const body = storybookMaterial({ ...common, color: '#ffffff' });
  const face = storybookMaterial({ ...common, color: new Color(1, 1, 1).multiplyScalar(255 / PLATE), map: albedo, bumpMap: height, bumpScale: 4 });
  const earth = storybookMaterial({ kind: 'earth', color: '#ffffff', color2: '#2a2124', vertexColors: true, breakup: 0.3, scale: 0.05, bump: 0.9, rim: 0.5, roughness: 0.95 });
  return { body, face, earth };
}

/** The tombstones, the big cross and the RIP stone, with the earth on some graves. */
export function Graveyard() {
  const built = useMemo(() => {
    const b = buildGraveyard();
    return { ...b, mats: stoneMaterials(b.albedo, b.height) };
  }, []);
  useLayoutEffect(
    () => () => {
      built.body.dispose();
      built.face.dispose();
      built.earth?.dispose();
      built.albedo.dispose();
      built.height.dispose();
      Object.values(built.mats).forEach((m) => m.dispose());
    },
    [built],
  );
  return (
    <>
      <mesh geometry={built.body} material={built.mats.body} castShadow receiveShadow />
      <mesh geometry={built.face} material={built.mats.face} castShadow receiveShadow />
      {built.earth && <mesh geometry={built.earth} material={built.mats.earth} receiveShadow />}
    </>
  );
}

/** The big cross's frame (stone-local → world) and its dimensions, for things anchored on it (the webs at its foot). */
export function bigCrossFrame(): { m: Matrix4; stemHalf: number; armAt: number; armHalfSpan: number; armHalfHeight: number; halfThickness: number } {
  const g = graves()[STONES.length + 1];
  const st = standing(g, new GroundPatch(g.x, g.z, 0.8, 0.065));
  const s = g.shape;
  return { m: st.m, stemHalf: s.w / 2, armAt: s.arm!.at * s.h, armHalfSpan: s.arm!.span / 2, armHalfHeight: s.arm!.hgt / 2, halfThickness: s.t / 2 };
}

/** Plan footprints (x, z, radius) of everything the graveyard stands on the ground: the grass may keep out of them. */
export function graveFootprints(): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (const g of graves()) {
    out.push({ x: g.x, z: g.z, r: Math.max(g.shape.w, g.shape.t) / 2 + 0.02 });
    if (g.fallen) {
      const c = Math.cos(g.yaw);
      const sn = Math.sin(g.yaw);
      out.push({ x: g.x + g.fallen.dx * c + g.fallen.dz * sn, z: g.z - g.fallen.dx * sn + g.fallen.dz * c, r: 0.2 });
    }
  }
  return out;
}
