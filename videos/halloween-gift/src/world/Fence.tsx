/**
 * The graveyard's iron: the fence across the slope (layout FENCE_LINE, FENCE_LINE_RIGHT), the
 * tall double gates where the path leaves the graveyard (GATE_POSTS) and the cast-iron lamp
 * posts along the lantern lane (LAMPS). All built with kit/iron.ts, one merged geometry per
 * material (the gate leaves are their own meshes, so they can swing).
 *
 * The fence: a crooked, hand-made picket fence of wrought iron about 0.55–0.8 tall, bold bars
 * (radius ≥ 0.0125: fewer, thicker bars do not shimmer) with spear finials (bulbs in some bays),
 * a bottom rail and a top rail that follows the bars' tops and sags between the posts, posts
 * about every 0.8 with urn finials, one bay of rings per line. Every bar leans (its own ±6° on a
 * lean that wanders along the line), stands its own height (±15% on a slow wander), its own
 * distance from the last (±30%), wobbles along its length and swells and thins (hand-forged);
 * bent and missing bars come in clusters; one bay sags toward the viewer; bases sunk into the
 * turf, rusted and darkened at the ground; the rails never thinner than about 1.6 px from the
 * hero camera. Near a lamp the line steps round its base.
 *
 * The gates: two tall, wobbly, twig-like leaves, each hung on its own iron stile (no pillars),
 * rolled apart about their feet so their tops splay into a V even when shut, as the reference's;
 * their tops rise in an arch to where they meet, their bars bend in two or three slow waves (2-5
 * cm, twig-like) and swell and thin along their length by about 30%, crook toward the hinge at the top and end in spear tips of
 * uneven height above the arch rail; a paired middle rail, a brace and a pair of scrolls. `open`
 * 0..1 swings them away from the graveyard into the lane: the left leaf 80°, the right leaf 135°
 * (back against the fence: the lane turns right behind it, and at 80° that leaf would stand in
 * it); the left leaf leads, the right one sticks a moment and follows (leafAngle), both fully
 * open from open 0.85. See leafEnds for where they clear Clawd's path.
 *
 * The lamps: Victorian cast-iron posts about 1.3 tall, a stepped base, a fluted shaft, a ladder
 * bar, a lantern with cyan glass glowing hot at its heart (an emissive gradient: blooms; no real
 * light), a soft halo card facing the camera and a faint cyan pool on the ground under it.
 */
import { rand, smoothstep } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Euler, Matrix4, MeshBasicMaterial, Quaternion, SpriteMaterial, SRGBColorSpace, Vector3 } from 'three';
import { applyPoints, barPoints, bulbProfile, IronBuilder, scrollPoints, spearProfile, swellRadii, urnProfile, type Profile, type Shade, type V3 } from '../kit/iron.ts';
import { noise3 } from '../kit/stone.ts';
import { storybookMaterial } from '../look/materials.ts';
import { FENCE_LINE, FENCE_LINE_RIGHT, FLOOR, GATE_HALF, GATE_POSTS, HERO, LAMPS, PATH, STOPS } from './layout.ts';
import { surfaceHeight } from './Terrain.tsx';

const ss = smoothstep;
const gy = (x: number, z: number) => FLOOR + surfaceHeight(x, z);

// ---- the iron's paint ---------------------------------------------------------------------------

const IRON = new Color('#2d3035');
const IRON_LIGHT = new Color('#3f454c');
const RUST = new Color('#523528');

interface ShadeState {
  /** rim weight of the part being built (thin bars low) */
  alpha: number;
  /** ground height under the part (y in the builder's frame), or null: far from the ground */
  ground: number | null;
}

/** Wrought iron: dark, a little lighter in patches, rust in blotches and at the feet. */
function ironShade(st: ShadeState): Shade {
  const c = new Color();
  return (p) => {
    const ha = st.ground === null ? 1 : p.y - st.ground;
    const n1 = noise3(p.x * 9, p.y * 9, p.z * 9, 71);
    c.copy(IRON).lerp(IRON_LIGHT, ss(0.45, 0.8, n1) * 0.6);
    const rust = ss(0.62, 0.8, noise3(p.x * 23, p.y * 23, p.z * 23, 72)) * 0.55 + (1 - ss(0.0, 0.16, ha)) * 0.6;
    c.lerp(RUST, Math.min(1, rust));
    // contact: darker where it goes into the turf
    c.multiplyScalar(0.35 + 0.65 * ss(-0.02, 0.12, ha));
    return [c.r, c.g, c.b, st.alpha * (0.4 + 0.6 * ss(0.0, 0.2, ha))];
  };
}

// ---- the fence ----------------------------------------------------------------------------------

const BAR_R = 0.0125;
const GAP = 0.12;
const POST_EVERY = 0.8;

/** A point at arc length s on a polyline, and its unit tangent. */
function along(line: readonly (readonly [number, number])[], s: number): { x: number; z: number; tx: number; tz: number } {
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1];
    const [bx, bz] = line[i];
    const l = Math.hypot(bx - ax, bz - az);
    if (s <= acc + l || i === line.length - 1) {
      const t = Math.min(1, Math.max(0, (s - acc) / l));
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, tx: (bx - ax) / l, tz: (bz - az) / l };
    }
    acc += l;
  }
  const [x, z] = line[line.length - 1];
  return { x, z, tx: 1, tz: 0 };
}

function lineLength(line: readonly (readonly [number, number])[]): number {
  let s = 0;
  for (let i = 1; i < line.length; i++) s += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return s;
}

/** The fence's foot at arc length s, stepped round any lamp base near the line. */
function footAt(line: readonly (readonly [number, number])[], s: number): { x: number; z: number; tx: number; tz: number } {
  const p = along(line, s);
  // the line's normal (toward +z side for a line running +x)
  const nx = -p.tz;
  const nz = p.tx;
  for (const l of LAMPS) {
    const dx = p.x - l.x;
    const dz = p.z - l.z;
    const a = dx * p.tx + dz * p.tz;
    const c = dx * nx + dz * nz;
    if (Math.abs(a) > 0.35) continue;
    const need = 0.15;
    if (Math.abs(c) < need) {
      const k = Math.cos((Math.PI * a) / 0.7) ** 2;
      const sgn = c >= 0 ? 1 : -1;
      p.x += nx * sgn * (need - Math.abs(c)) * k;
      p.z += nz * sgn * (need - Math.abs(c)) * k;
    }
  }
  return p;
}

/** Height along a bar's polyline: the point at height y (linear between its points). */
function atHeight(pts: readonly V3[], y: number): V3 {
  for (let i = 1; i < pts.length; i++)
    if (pts[i][1] >= y || i === pts.length - 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const t = Math.min(1, Math.max(0, (y - a[1]) / (b[1] - a[1] || 1e-6)));
      return [a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t];
    }
  return pts[pts.length - 1];
}

interface FenceLineSpec {
  line: readonly (readonly [number, number])[];
  seed: number;
  /** the gate stile stands at this end: no fence post there, the rails end on the stile */
  gateAt: 'start' | 'end';
  /** the bay (index) that sags toward the viewer, if any */
  sag?: number;
  /** the one bay with rings under its top rail, if any */
  rings?: number;
}

/** A point on a gate stile's axis at height h above its foot (the stiles lean apart). */
function stileAt(i: 0 | 1, h: number): V3 {
  const f = postFrames()[i];
  const v = new Vector3(0, h, 0).applyMatrix4(frameMatrix(f));
  return [v.x, v.y, v.z];
}

function buildFenceLine(b: IronBuilder, st: ShadeState, spec: FenceLineSpec): void {
  const L = lineLength(spec.line);
  const r = (id: string, k: number) => rand(spec.seed, id, k);
  const nPosts = Math.max(1, Math.round(L / POST_EVERY));
  const postS: number[] = [];
  for (let k = 0; k <= nPosts; k++) {
    const s = (k / nPosts) * L + (k > 0 && k < nPosts ? (r('post', k) - 0.5) * 0.12 : 0);
    postS.push(s);
  }
  const gateS = spec.gateAt === 'start' ? 0 : L;
  const gateI: 0 | 1 = spec.gateAt === 'start' ? 1 : 0;
  // the bottom rail runs at a height above each upright's foot; the top rail under its top
  const bottom: V3[] = [];
  const topRail: V3[] = [];
  for (let k = 0; k < postS.length; k++) {
    const s = postS[k];
    const isGate = (spec.gateAt === 'start' && k === 0) || (spec.gateAt === 'end' && k === postS.length - 1);
    const p = footAt(spec.line, s);
    const g = gy(p.x, p.z);
    if (isGate) {
      // the rails end on the gate's stile (Gates builds it), on its leaning axis
      bottom.push(stileAt(gateI, 0.12));
      topRail.push(stileAt(gateI, 0.52));
    } else {
      // a post: a round shaft, a collar at the foot, an urn finial
      st.alpha = 0.5;
      st.ground = g;
      const ph = 0.8 + 0.06 * (r('ph', k) - 0.5);
      const lx = (r('plx', k) - 0.5) * 0.07;
      const lz = (r('plz', k) - 0.5) * 0.07;
      const top: V3 = [p.x + lx * ph, g + ph, p.z + lz * ph];
      const pts = barPoints([p.x, g - 0.09, p.z], top, 4);
      b.tube(pts, 0.021, 8);
      b.lathe(
        [
          [0.032, 0],
          [0.032, 0.03],
          [0.024, 0.045],
        ],
        [p.x + lx * 0.02, g - 0.012, p.z + lz * 0.02],
        [lx, 1, lz],
        8,
      );
      b.lathe(urnProfile(0.021, 0.13), top, [lx, 1, lz], 8);
      bottom.push(atHeight(pts, g + 0.12));
      topRail.push(atHeight(pts, g + 0.55 + 0.03 * (r('ptr', k) - 0.5)));
    }
    if (k === postS.length - 1) break;
    // the bay to the next post
    const s1 = postS[k + 1];
    const n = Math.max(1, Math.round((s1 - s) / GAP) - 1);
    const bayFinial = r('bayf', k) < 0.3 ? 'bulb' : 'spear';
    const rings = spec.rings === k;
    const sagging = spec.sag === k;
    // the top rail sags between the posts
    const bayDrop = 0.03 + 0.03 * r('drop', k);
    const bayBars: V3[][] = [];
    for (let j = 1; j <= n; j++) {
      const id = k * 100 + j;
      const u = j / (n + 1);
      // spacing jitter: ±30% of the gap
      const sj = s + (s1 - s) * u + (r('bj', id) - 0.5) * 0.6 * GAP * Math.min(u, 1 - u) * 2;
      // keep clear of the gate stile, which leans out over the fence's end
      if (Math.abs(sj - gateS) < 0.24) continue;
      const f = footAt(spec.line, sj);
      const gb = gy(f.x, f.z);
      const sag = sagging ? Math.sin(Math.PI * u) : 0;
      st.ground = gb;
      // missing bars come in clusters (and a few alone); sometimes a rusted stub is left
      const cluster = noise3(sj * 2.6, 0.4, spec.seed, 77);
      const missing = cluster > 0.78 || r('miss', id) < 0.025;
      if (missing) {
        if (r('stub', id) < 0.5) {
          st.alpha = 0.25;
          b.tube(barPoints([f.x, gb - 0.06, f.z], [f.x, gb + 0.1 + 0.16 * r('stubh', id), f.z], 2), BAR_R, 6);
        }
        continue;
      }
      // height: ±20% (a slow wander along the line and each bar's own)
      const h = 0.66 * (1 + 0.24 * (noise3(sj * 1.3, 0.2, spec.seed, 74) - 0.5) + 0.3 * (r('bh', id) - 0.5)) - sag * 0.04;
      // lean along the line and across it: a slow wander (bars pushed over together) and each
      // bar's own, up to about ±10°; the sagging bay leans toward the viewer
      const wander = (noise3(sj * 0.8, 1.3, spec.seed, 75) - 0.5) * 0.26;
      // (each bar's own lean up to ±6°, on top of the wander: never a row of plumb bars)
      const la = (r('la', id) - 0.5) * 0.21 + wander;
      const lc = (r('lc', id) - 0.5) * 0.16 + sag * 0.2 + (noise3(sj * 0.7, 2.9, spec.seed, 76) - 0.5) * 0.14;
      const nx = -f.tz;
      const nz = f.tx;
      const dx = f.tx * la + nx * lc;
      const dz = f.tz * la + nz * lc;
      // bent bars: in clusters too (a branch fell on them), kinked above their middle
      const bent = noise3(sj * 1.9, 3.3, spec.seed, 78) > 0.72 || r('bent', id) < 0.08;
      const bk = bent ? 0.04 + 0.07 * r('bk', id) : 0;
      const ba = r('ba', id) * Math.PI * 2;
      const top: V3 = [f.x + dx * h, gb + h * (1 - 0.5 * (dx * dx + dz * dz)), f.z + dz * h];
      const ph = id * 1.37;
      const pts = barPoints([f.x, gb - 0.07, f.z], top, 6, (t) => {
        // a bent bar kinks above its middle; every bar wobbles a little
        const kink = bent ? Math.max(0, t - 0.4) * bk : 0;
        const w = (0.012 * Math.sin(t * 5 + ph) + 0.005 * Math.sin(t * 11 + ph * 2)) * Math.sin(Math.PI * Math.min(1, t * 1.2));
        const wl = 0.008 * Math.sin(t * 4 + ph * 0.7) * t;
        return [Math.cos(ba) * kink + nx * w + f.tx * wl, 0, Math.sin(ba) * kink + nz * w + f.tz * wl];
      });
      st.alpha = 0.3;
      // hand-forged: each bar its own thickness, swelling and thinning along it
      b.tube(pts, swellRadii(pts.length, BAR_R * (0.9 + 0.3 * r('br', id)), 0.22, r('brp', id) * 6.28), 6);
      const broken = r('brk', id) < 0.06;
      if (!broken) {
        const tip = pts[pts.length - 1];
        const dir: V3 = [tip[0] - pts[pts.length - 2][0], tip[1] - pts[pts.length - 2][1], tip[2] - pts[pts.length - 2][2]];
        const len = 0.07 + 0.03 * r('fl', id);
        const prof: Profile = bayFinial === 'bulb' ? bulbProfile(BAR_R, len, 1.8 + 0.3 * r('fw', id)) : spearProfile(BAR_R, len + 0.01, 1.8 + 0.5 * r('fw', id));
        st.alpha = 0.35;
        b.lathe(prof, tip, dir, 6);
      }
      bottom.push(atHeight(pts, gb + 0.12 + 0.012 * (noise3(sj * 3.1, 0.5, spec.seed, 73) - 0.5) * 2));
      // the top rail rides a little under the bars' tops, sagging toward the middle of the bay
      const yTop = Math.min(top[1] - 0.1, gb + 0.53 + 0.04 * (noise3(sj * 0.9, 1.9, spec.seed, 79) - 0.5) * 2) - bayDrop * Math.sin(Math.PI * u) - sag * 0.05;
      topRail.push(atHeight(pts, yTop));
      bayBars.push(pts);
    }
    // the one bay of rings between the bars under the top rail
    if (rings && bayBars.length > 1) {
      st.alpha = 0.28;
      st.ground = null;
      for (let j = 0; j < bayBars.length - 1; j += 1) {
        if (r('ringskip', k * 100 + j) < 0.25) continue;
        const a = topRail[topRail.length - bayBars.length + j];
        const c = topRail[topRail.length - bayBars.length + j + 1];
        const ux = c[0] - a[0];
        const uz = c[2] - a[2];
        const ul = Math.hypot(ux, uz) || 1;
        const rad = Math.min(0.045, ul / 2 - 0.006);
        if (rad < 0.025) continue;
        const cx: V3 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 - rad - 0.004, (a[2] + c[2]) / 2];
        b.tube(scrollPoints(cx, [ux / ul, 0, uz / ul], [0, 1, 0], rad, rad, 0, 1, 1, 14), 0.0085, 5);
      }
    }
  }
  // the rails: crooked bars through every upright (never thinner than about 1.6 px from the hero camera: a thinner one shimmers)
  st.alpha = 0.3;
  st.ground = null;
  if (bottom.length > 1) b.tube(bottom, railRadii(bottom), 6);
  if (topRail.length > 1) b.tube(topRail, railRadii(topRail), 6);
}

/** The hero camera (layout's HERO): the rails keep a minimum width as it sees them. */
const HERO_EYE = new Vector3(...HERO.pos);
/** world radius per metre of distance for 1.6 px of radius in the hero view (1080 rows over its vertical fov) */
const PX_RADIUS = (1.6 * 2 * Math.tan((HERO.fov * Math.PI) / 360)) / 1080;
function railRadii(pts: readonly V3[]): number[] {
  return pts.map((p) => Math.max(0.0115, PX_RADIUS * HERO_EYE.distanceTo(_rv.set(p[0], p[1], p[2]))));
}
const _rv = new Vector3();

function fenceGeometry(): BufferGeometry {
  const st: ShadeState = { alpha: 0.3, ground: null };
  const b = new IronBuilder(ironShade(st));
  // the left fence runs to the left gate stile; one bay in view sags toward the viewer, one has rings
  const nL = Math.round(lineLength(FENCE_LINE) / POST_EVERY);
  buildFenceLine(b, st, { line: FENCE_LINE, seed: 511, gateAt: 'end', sag: nL - 3, rings: nL - 5 });
  buildFenceLine(b, st, { line: FENCE_LINE_RIGHT, seed: 512, gateAt: 'start' });
  return b.geometry();
}

function ironMaterial() {
  return storybookMaterial({ kind: 'iron', color: '#ffffff', color2: '#3a2a24', vertexColors: true, metalness: 0.25, roughness: 0.6, breakup: 0.15, scale: 0.05, bump: 0.5, rim: 1.0 });
}

/** The iron fence along FENCE_LINE and FENCE_LINE_RIGHT (the gate stiles are the Gates'). */
export function Fence() {
  const { geo, mat } = useMemo(() => ({ geo: fenceGeometry(), mat: ironMaterial() }), []);
  useLayoutEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />;
}

// ---- the gates ----------------------------------------------------------------------------------

/** the left leaf swings 80°, the right 135° (see the header) */
const SWING = [(80 * Math.PI) / 180, (-135 * Math.PI) / 180];
/**
 * Each leaf's share of `open`: the left leaf leads (all the way by open 0.85), the right one
 * sticks, then follows (from 0.2, all the way by 0.85). At the gate beat's camera (journeyAt(at(14)))
 * an evenly swinging right leaf stands edge-on, a dark slab across the frame, at open 0.25–0.3;
 * lagging, it shows its face there.
 */
function leafAngle(i: number, open: number): number {
  const p = i === 0 ? open / 0.85 : (open - 0.2) / 0.65;
  return SWING[i] * Math.min(1, Math.max(0, p));
}
/** the stiles lean apart (each leaf rolled out about its foot): the tops splay into a V */
const ROLL = [0.26, 0.23];
/** the stile (the hinge bar) and the leaf's reach from its axis to where the leaves meet */
const STILE_R = 0.019;
const LEAF_W = GATE_HALF - 0.016;

interface PostFrame {
  base: V3;
  yaw: number;
  lean: number;
}

/** Each stile's frame: at its plan point on the ground, its local +x toward the other stile, leaning away from it. */
function postFrames(): [PostFrame, PostFrame] {
  const [L, R] = GATE_POSTS;
  const ex = R[0] - L[0];
  const ez = R[1] - L[1];
  // yaw θ with (cos θ, −sin θ) = the direction toward the other post
  const yawL = Math.atan2(-ez, ex);
  const yawR = Math.atan2(ez, -ex);
  return [
    { base: [L[0], gy(L[0], L[1]), L[1]], yaw: yawL, lean: ROLL[0] },
    { base: [R[0], gy(R[0], R[1]), R[1]], yaw: yawR, lean: ROLL[1] },
  ];
}

function frameMatrix(p: PostFrame): Matrix4 {
  return new Matrix4().compose(new Vector3(...p.base), new Quaternion().setFromEuler(new Euler(0, p.yaw, p.lean, 'YXZ')), new Vector3(1, 1, 1));
}

/** The lowest the leaf's bottom may hang (above its stile's foot) so it clears the ground all through its swing. */
function leafClearance(p: PostFrame, swing: number): number {
  const m = frameMatrix(p);
  let need = 0;
  const v = new Vector3();
  for (let a = 0; a <= 1.0001; a += 0.1)
    for (let x = 0.05; x <= LEAF_W + 1e-6; x += 0.06) {
      const phi = swing * a;
      v.set(x * Math.cos(phi), 0, -x * Math.sin(phi)).applyMatrix4(m);
      need = Math.max(need, gy(v.x, v.z) - v.y);
    }
  return need + 0.04;
}

/**
 * One leaf in its hinge frame: the hinge axis = local y through the origin (the stile itself, sunk
 * into the ground), the leaf along +x to LEAF_W, its foot at y0.
 */
function leafGeometry(seed: number, y0: number): BufferGeometry {
  const st: ShadeState = { alpha: 0.32, ground: null };
  const b = new IronBuilder(ironShade(st));
  const r = (id: string, k = 0) => rand(seed, id, k);
  const W = LEAF_W;
  // the top rises in an arch from the hinge to where the leaves meet
  const Hh = 1.34 + 0.06 * r('hh');
  const Hf = 1.72 + 0.08 * r('hf');
  const topY = (x: number) => Hh + (Hf - Hh) * Math.sin((Math.min(1, Math.max(0, x / W)) * Math.PI) / 2) + 0.012 * Math.sin(x * 17 + seed);
  // the stile: straight (it is the hinge), sunk, a big bulb finial
  st.ground = 0;
  st.alpha = 0.45;
  const stileTop = Hh + 0.1;
  b.tube(barPoints([0, -0.16, 0], [0, stileTop, 0], 6), STILE_R, 8);
  b.lathe(bulbProfile(STILE_R, 0.16, 2.3), [0, stileTop, 0], [0, 1, 0], 8);
  // hinge collars round the stile at the bottom and the arch rail
  for (const y of [y0 + 0.07, topY(0.02) - 0.02])
    b.lathe(
      [
        [STILE_R * 1.45, -0.025],
        [STILE_R * 1.45, 0.025],
      ],
      [0, y, 0],
      [0, 1, 0],
      8,
    );
  st.ground = null;
  // the bars: unevenly spaced, the free stile at W
  const NB = 6;
  const xs: number[] = [];
  for (let k = 1; k <= NB; k++) {
    const u = k / NB;
    const j = k === NB ? 0 : (r('bx', k) - 0.5) * 0.55 * (W / NB);
    xs.push(W * u + j);
  }
  // a slow bend common to the leaf (its bars were bent together), then each bar's own
  const common1 = (r('c1') - 0.5) * 0.06;
  const bars: V3[][] = [];
  xs.forEach((x, k) => {
    const free = k === xs.length - 1;
    const u = x / W;
    const over = free ? 0.06 + 0.03 * r('ov', k) : 0.05 + 0.11 * r('ov', k);
    const H = topY(x) + over;
    const kk = free ? 0.45 : 1;
    // (two to five centimetres: twig-like, every bar of the reference bends)
    const a1 = (common1 + (r('a1', k) - 0.5) * 0.075) * kk;
    const a2 = (r('a2', k) - 0.5) * 0.07 * kk;
    const a3 = (r('a3', k) - 0.5) * 0.04 * kk;
    const p2 = r('p2', k) * 6.28;
    const p3 = r('p3', k) * 6.28;
    // out of the leaf's plane too, so edge-on the bars part instead of stacking into a slab
    const bz = (r('bz', k) - 0.5) * 0.07;
    const pz = r('pz', k) * 6.28;
    // the crook: the bar's top bends toward the hinge, more toward the meeting edge
    const crook = (0.04 + 0.06 * r('cr', k)) * (0.3 + 0.7 * u);
    const pts = barPoints([x, y0, 0], [x + (r('bl', k) - 0.5) * 0.02, H, 0], 12, (t) => {
      const bend = a1 * Math.sin(Math.PI * t) + a2 * Math.sin(2 * Math.PI * t + p2) * Math.sin(Math.PI * t) + a3 * Math.sin(3 * Math.PI * t + p3) * Math.sin(Math.PI * t);
      const c = -crook * Math.max(0, (t - 0.68) / 0.32) ** 2;
      return [bend + c, 0, bz * Math.sin(Math.PI * t * 1.3 + pz) * Math.sin(Math.PI * t)];
    });
    // the bar swells and thins along its length, and tapers a little toward the top
    const rb = free ? 0.016 : 0.0115 + 0.005 * r('rb', k);
    const rad = swellRadii(pts.length, rb, free ? 0.14 : 0.3, r('rp', k) * 6.28, 0.12);
    st.alpha = free ? 0.42 : 0.32;
    b.tube(pts, rad, free ? 8 : 6, { capStart: true });
    // a spear tip of its own size; one or two bent over
    const tip = pts[pts.length - 1];
    const prev = pts[pts.length - 3];
    const dir = new Vector3(tip[0] - prev[0], tip[1] - prev[1], tip[2] - prev[2]).normalize();
    if (r('tb', k) < 0.22) dir.x += (r('tbd', k) < 0.5 ? -1 : 1) * (0.35 + 0.3 * r('tba', k));
    st.alpha = 0.38;
    const tr = rad[rad.length - 1];
    b.lathe(free ? bulbProfile(tr, 0.11, 2.1) : spearProfile(tr, 0.075 + 0.05 * r('tl', k), 1.9 + 0.7 * r('tw', k)), tip, [dir.x, dir.y, dir.z], 6);
    bars.push(pts);
  });
  // the rails: through the stile's axis and every bar, a little crooked
  st.alpha = 0.32;
  const rail = (y: number, k: number, rr = 0.011) => {
    const tilt = (r('rt', k) - 0.5) * 0.06;
    const pts: V3[] = [[0, y, 0], ...bars.map((p, i) => atHeight(p, y + tilt * ((i + 1) / bars.length) + 0.014 * Math.sin(i * 2.1 + k) + 0.016 * (r('rw', k * 10 + i) - 0.5)))];
    b.tube(pts, swellRadii(pts.length, rr, 0.2, k * 1.7), 6);
  };
  rail(y0 + 0.07, 1);
  // the reference's paired middle rails
  const ym = 0.6 + 0.05 * r('ym');
  rail(ym, 2);
  rail(ym + 0.065, 3);
  // the arch rail just under the bars' tips, from the stile to the free stile
  const arch: V3[] = [];
  for (let i = 0; i <= 14; i++) {
    const x = (W * i) / 14;
    arch.push([x, topY(x) - 0.03 + 0.006 * Math.sin(i * 1.7 + seed), 0.003 * Math.sin(i)]);
  }
  b.tube(arch, 0.0115, 6);
  // a brace across the lower panel, from the stile's foot up to the free stile's middle rail
  st.alpha = 0.3;
  b.tube(
    barPoints([0.02, y0 + 0.1, 0], [W - 0.02, ym - 0.02, 0], 6, (t) => [0, 0.012 * Math.sin(Math.PI * t), 0.004 * Math.sin(2 * Math.PI * t)]),
    0.0105,
    6,
  );
  // two scrolls of different sizes under the arch rail, toward the meeting edge
  st.alpha = 0.28;
  for (let k = 0; k < 2; k++) {
    const xa = W * (k === 0 ? 0.42 : 0.74) + 0.02 * (r('sx', k) - 0.5);
    const ytop = topY(xa) - 0.03;
    const rad = k === 0 ? 0.042 : 0.055;
    const yc = ytop - rad - 0.012;
    const dir = k === 0 ? 1 : -1;
    b.tube(scrollPoints([xa - 0.03 * dir, yc, 0], [1, 0, 0], [0, 1, 0], rad, rad * 0.22, dir > 0 ? 0 : Math.PI, 1.2, dir, 22), 0.0085, 5);
    b.tube(scrollPoints([xa + 0.03 * dir, yc, 0], [1, 0, 0], [0, 1, 0], rad * 0.85, rad * 0.2, dir > 0 ? Math.PI : 0, 1.1, -dir, 20), 0.0085, 5);
  }
  return b.geometry();
}

export interface GatesProps {
  /** 0 closed .. 1 swung open into the lane */
  open?: number;
}

/** The tall double gates, each leaf hung on its own stile at GATE_POSTS. */
export function Gates({ open = 0 }: GatesProps) {
  const built = useMemo(() => {
    const frames = postFrames();
    const y0 = frames.map((p, i) => leafClearance(p, SWING[i]));
    return { frames, leaves: [leafGeometry(621, y0[0]), leafGeometry(622, y0[1])], mat: ironMaterial() };
  }, []);
  useLayoutEffect(
    () => () => {
      built.leaves.forEach((g) => g.dispose());
      built.mat.dispose();
    },
    [built],
  );
  const o = Math.min(1, Math.max(0, open));
  return (
    <>
      {built.frames.map((p, i) => (
        <group key={i} position={p.base} rotation={[0, p.yaw, p.lean, 'YXZ']}>
          <mesh geometry={built.leaves[i]} material={built.mat} rotation-y={leafAngle(i, o)} castShadow />
        </group>
      ))}
    </>
  );
}

// ---- the lamps ----------------------------------------------------------------------------------

interface LampParts {
  iron: BufferGeometry;
  glass: BufferGeometry;
  pool: BufferGeometry;
  /** each lantern's centre (for its halo) */
  heads: V3[];
}

/** Fluted shaft: one tube whose radius dips in `flutes` grooves round it (thin separate ridges would shimmer). */
function flutedShaft(b: IronBuilder, m: Matrix4, y0: number, y1: number, r0: number, r1: number, flutes = 8, sides = 24): void {
  const rings = 6;
  const pos: V3[][] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = y0 + (y1 - y0) * t;
    const r = r0 + (r1 - r0) * t;
    const ring: V3[] = [];
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const rr = r * (1 - 0.13 * (0.5 + 0.5 * Math.cos(flutes * a)));
      ring.push([Math.cos(a) * rr, y, Math.sin(a) * rr]);
    }
    pos.push(applyPoints(ring, m));
  }
  b.rings(pos);
}

/** The cyan pool on the ground under a lamp: a disc on the terrain, its colour falling off from the middle (additive). */
function poolDisc(cx: number, cz: number, rad: number, out: { pos: number[]; col: number[]; idx: number[] }): void {
  const rings = 6;
  const segs = 20;
  const base = out.pos.length / 3;
  const glow = new Color('#5fe6ff');
  for (let i = 0; i <= rings; i++) {
    const rr = i / rings;
    for (let j = 0; j < (i === 0 ? 1 : segs); j++) {
      const a = (j / segs) * Math.PI * 2 + i * 0.37;
      const wob = 1 + 0.12 * (noise3(Math.cos(a) * 2 + cx, Math.sin(a) * 2, cz, 66) - 0.5);
      const x = cx + Math.cos(a) * rad * rr * wob;
      const z = cz + Math.sin(a) * rad * rr * wob;
      out.pos.push(x, gy(x, z) + 0.008, z);
      const k = 0.13 * (1 - rr * rr) ** 2;
      out.col.push(glow.r * k, glow.g * k, glow.b * k);
    }
  }
  const ring = (i: number) => (i === 0 ? base : base + 1 + (i - 1) * segs);
  for (let j = 0; j < segs; j++) out.idx.push(base, ring(1) + ((j + 1) % segs), ring(1) + j);
  for (let i = 1; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const a = ring(i) + j;
      const b = ring(i) + ((j + 1) % segs);
      const c = ring(i + 1) + j;
      const d = ring(i + 1) + ((j + 1) % segs);
      out.idx.push(a, b, d, a, d, c);
    }
}

function lampGeometry(): LampParts {
  const st: ShadeState = { alpha: 0.5, ground: null };
  const b = new IronBuilder(ironShade(st));
  const gl: number[] = [];
  const guv: number[] = [];
  const heads: V3[] = [];
  const pool = { pos: [] as number[], col: [] as number[], idx: [] as number[] };
  LAMPS.forEach((l, i) => {
    const r = (id: string) => rand(700 + i, id, 0);
    const g = gy(l.x, l.z);
    st.ground = g;
    const m = new Matrix4().compose(new Vector3(l.x, g - 0.05, l.z), new Quaternion().setFromEuler(new Euler((r('tx') - 0.5) * 0.07, (l.yaw ?? 0) + (r('yaw') - 0.5) * 0.3, (r('tz') - 0.5) * 0.07, 'YXZ')), new Vector3(1, 1, 1));
    const up = new Vector3(0, 1, 0).applyMatrix4(new Matrix4().extractRotation(m));
    const ax: V3 = [up.x, up.y, up.z];
    const at = (x: number, y: number, z: number): V3 => applyPoints([[x, y, z]], m)[0];
    // the base: a stepped plinth with a moulding
    st.alpha = 0.6;
    b.lathe(
      [
        [0.074, 0],
        [0.074, 0.06],
        [0.064, 0.075],
        [0.062, 0.11],
        [0.05, 0.13],
        [0.046, 0.17],
        [0.054, 0.19],
        [0.034, 0.22],
        [0.03, 0.27],
      ],
      at(0, 0, 0),
      ax,
      12,
    );
    // the fluted shaft and its collar
    flutedShaft(b, m, 0.27, 0.98, 0.029, 0.022);
    b.lathe(
      [
        [0.022, 0],
        [0.034, 0.012],
        [0.034, 0.028],
        [0.025, 0.038],
        [0.03, 0.055],
        [0.03, 0.065],
      ],
      at(0, 0.97, 0),
      ax,
      12,
    );
    // the ladder bar through the shaft, with ball ends: along the lane (local z faces along the
    // path), so it never reaches across it toward a camera following the path
    st.alpha = 0.35;
    const bar = applyPoints(barPoints([0, 0.93, -0.11], [0, 0.93, 0.11], 2), m);
    b.tube(bar, 0.008, 6);
    for (const e of [bar[0], bar[bar.length - 1]])
      b.lathe(
        [
          [0, -0.012],
          [0.009, -0.008],
          [0.013, 0],
          [0.009, 0.008],
          [0, 0.012],
        ],
        e,
        ax,
        6,
      );
    // the lantern: a square frustum wider at the top, frame posts at the corners
    const yA = 1.04;
    const yB = 1.2;
    const wA = 0.042;
    const wB = 0.062;
    st.alpha = 0.5;
    b.lathe(
      [
        [0.026, 0],
        [0.05, 0.025],
        [0.058, 0.035],
        [0.058, 0.045],
      ],
      at(0, yA - 0.045, 0),
      ax,
      4,
    );
    const corners = (w: number, y: number) => [0, 1, 2, 3].map((k) => at(Math.cos((k + 0.5) * (Math.PI / 2)) * w * Math.SQRT2, y, Math.sin((k + 0.5) * (Math.PI / 2)) * w * Math.SQRT2));
    const ca = corners(wA, yA);
    const cb = corners(wB, yB);
    st.alpha = 0.3;
    for (let k = 0; k < 4; k++) b.tube([ca[k], cb[k]], 0.0065, 5);
    // the cap: a square roof with an overhang, and a finial
    st.alpha = 0.55;
    b.lathe(
      [
        [0.07, 0],
        [0.098, 0.012],
        [0.098, 0.02],
        [0.05, 0.07],
        [0.016, 0.1],
        [0.012, 0.11],
      ],
      at(0, yB - 0.005, 0),
      ax,
      4,
    );
    b.lathe(
      [
        [0.012, 0],
        [0.02, 0.012],
        [0.02, 0.022],
        [0.006, 0.035],
        [0, 0.07],
      ],
      at(0, yB + 0.1, 0),
      ax,
      8,
    );
    // the glass panes between the corner posts (both windings: seen from any side), each with
    // its own (u, v) for the glow's gradient (opaque: panes seen through panes would double it)
    const inset = 0.92;
    const ga = corners(wA * inset, yA + 0.004);
    const gb = corners(wB * inset, yB - 0.004);
    // each pane is a trapezoid: a 4 × 4 grid (bilinear) keeps its gradient round, where two
    // triangles would kink it along their diagonal
    const G = 4;
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4;
      const pt = (u: number, v: number): V3 => {
        const a = ga[k].map((c, i) => c + (ga[k1][i] - c) * u);
        const b = gb[k].map((c, i) => c + (gb[k1][i] - c) * u);
        return [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v, a[2] + (b[2] - a[2]) * v];
      };
      for (let i = 0; i < G; i++)
        for (let j = 0; j < G; j++) {
          const c: [number, number][] = [
            [i / G, j / G],
            [(i + 1) / G, j / G],
            [(i + 1) / G, (j + 1) / G],
            [i / G, (j + 1) / G],
          ];
          for (const tri of [
            [0, 1, 2, 0, 2, 3],
            [0, 2, 1, 0, 3, 2],
          ])
            for (const v of tri) {
              gl.push(...pt(c[v][0], c[v][1]));
              guv.push(c[v][0], c[v][1]);
            }
        }
    }
    heads.push(at(0, (yA + yB) / 2, 0));
    poolDisc(l.x, l.z, 0.42 + 0.06 * r('pool'), pool);
  });
  const glass = new BufferGeometry();
  glass.setAttribute('position', new BufferAttribute(new Float32Array(gl), 3));
  glass.setAttribute('uv', new BufferAttribute(new Float32Array(guv), 2));
  glass.computeVertexNormals();
  const pg = new BufferGeometry();
  pg.setAttribute('position', new BufferAttribute(new Float32Array(pool.pos), 3));
  pg.setAttribute('color', new BufferAttribute(new Float32Array(pool.col), 3));
  pg.setIndex(pool.idx);
  return { iron: b.geometry(), glass, pool: pg, heads };
}

/** A radial gradient canvas (drawn once): stops of (offset, css colour) about (cx, cy) in 0..1. */
function radialTexture(size: number, cx: number, cy: number, stops: [number, string][]): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(cx * size, cy * size, 0, cx * size, cy * size, size * 0.5);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** the halo card's size (world units): about 35 px across at the hero view's lamps */
const HALO = 0.56;

/** The cast-iron lamp posts along the lane, their lanterns glowing cyan. */
export function Lamps() {
  const built = useMemo(() => {
    const parts = lampGeometry();
    // the glass: hot at the mantle low in the lantern (canvas y down), cyan toward the frame
    const glow = radialTexture(128, 0.5, 0.7, [
      [0, '#e6ffff'],
      [0.15, '#cff9ff'],
      [0.35, '#9cefff'],
      [0.6, '#6ae7ff'],
      [0.85, '#4bd0ee'],
      [1, '#38b6d4'],
    ]);
    const halo = radialTexture(128, 0.5, 0.5, [
      [0, 'rgba(255,255,255,0.85)'],
      [0.18, 'rgba(255,255,255,0.42)'],
      [0.45, 'rgba(255,255,255,0.12)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    return {
      parts,
      glow,
      halo,
      ironMat: ironMaterial(),
      glassMat: storybookMaterial({ color: '#0a2a32', emissive: '#ffffff', emissiveMap: glow, emissiveIntensity: 2.2, roughness: 0.35, rim: 0, fog: 0.6, ambient: 0 }),
      haloMat: new SpriteMaterial({ map: halo, color: '#5fe6ff', blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.8 }),
      poolMat: new MeshBasicMaterial({ vertexColors: true, blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    };
  }, []);
  useLayoutEffect(
    () => () => {
      built.parts.iron.dispose();
      built.parts.glass.dispose();
      built.parts.pool.dispose();
      built.glow.dispose();
      built.halo.dispose();
      built.ironMat.dispose();
      built.glassMat.dispose();
      built.haloMat.dispose();
      built.poolMat.dispose();
    },
    [built],
  );
  return (
    <>
      <mesh geometry={built.parts.iron} material={built.ironMat} castShadow />
      <mesh geometry={built.parts.glass} material={built.glassMat} />
      <mesh geometry={built.parts.pool} material={built.poolMat} renderOrder={1} />
      {built.parts.heads.map((p, i) => (
        <sprite key={i} position={p} scale={[HALO, HALO, 1]} material={built.haloMat} renderOrder={2} />
      ))}
    </>
  );
}

/** The path's direction at the gates (for cameras that look through them). */
export function gateAxis(): { x: number; z: number; tx: number; tz: number } {
  const s = STOPS.gates + 0.32;
  const p = PATH.pointAt(s);
  const t = PATH.tangentAt(s);
  return { x: p[0], z: p[1], tx: t[0], tz: t[1] };
}

/** Triangle counts of the iron (fence, gate leaves with their stiles, lamps), for the budget. */
export function ironStats(): Record<string, number> {
  const tris = (g: BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  const frames = postFrames();
  const leaves = frames.map((p, i) => leafGeometry(621 + i, leafClearance(p, SWING[i])));
  const lamps = lampGeometry();
  return { fence: tris(fenceGeometry()), leaves: leaves.reduce((s, g) => s + tris(g), 0), lampIron: tris(lamps.iron), lampGlass: tris(lamps.glass), lampPool: tris(lamps.pool) };
}

/** Where the open leaves' free ends stand (x, z) at `open`, at their foot and at their top. */
export function leafEnds(open: number, h = 0): { x: number; z: number }[] {
  return postFrames().map((p, i) => {
    const a = leafAngle(i, open);
    const v = new Vector3(LEAF_W * Math.cos(a), h, -LEAF_W * Math.sin(a)).applyMatrix4(frameMatrix(p));
    return { x: v.x, z: v.z };
  });
}
