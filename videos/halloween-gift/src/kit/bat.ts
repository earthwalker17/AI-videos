/**
 * A bat from one outline spec (BAT_SPEC): the right wing's joints and the body's parts as 2D data
 * in the planform (x out along the span, z forward to the head; the wingspan is 1, tip to tip, at
 * full spread; the left wing mirrors it). A pose (BatPose) moves those joints in 3D, and the same
 * posed joints build both renderings:
 *  - the 3D bat (batWingGeometry, batBodyGeometry, batEyeGeometry): a furry oval body, a round
 *    head with two tall pointed ears and a short snout, two tiny eyes, and two membrane wings,
 *    each an arm (shoulder, elbow, wrist) and three long finger bones fanning from the wrist (a
 *    short index along the leading edge, a thumb claw at the wrist), the membrane cut into a
 *    SCALLOPED trailing edge between the finger tips and back to the foot. The wing geometry
 *    carries the flap cycle as morph targets (one per WING_POSES step, and a folded pose), so an
 *    InstancedMesh poses every bat on its own phase in one draw call;
 *  - the far fleck (batFleckGeometry): below ~25 px the bones and fur are sub-pixel and the
 *    painterly pass smears the mesh into a blob, so a far bat is the arm's line from the same
 *    posed joints, fattened into a chevron, with a small eared body (to be turned to the eye);
 *  - the 2D outline (batOutline) an SVG bat is drawn from (overlay/BatSvg.tsx).
 *
 * The flap (flapPose): the wings sweep down fast (the first 40% of the cycle) and come back up
 * slowly, the elbows and wrists flexing and the fingers closing on the upstroke, the hands lagging
 * the arms (tips bent up on the downstroke, trailing down on the upstroke), and the body bobbing
 * against the wings (rising on the downstroke). A pure function of the phase.
 *
 * Bat-local frame: x the bat's right, y its back (up), z its head (forward); units: the wingspan.
 * Vertex colours are RGBA: storybook materials scale the moon rim by the alpha, so the thin
 * membrane, the finger bones and the arm carry little rim (edge-on they flashed pale), the body
 * more. The finger bones read as dark lines through the membrane (the grid is sampled densely
 * beside each bone, so the line's feather is narrow), the skin between them a shade lighter.
 * Generic: no film imports.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { fbm2 } from './field.ts';

export type P2 = readonly [number, number];
export type V3 = [number, number, number];

/** The outline spec: the right wing in the planform (x, z) and the body's parts, at full spread. */
export const BAT_SPEC = {
  shoulder: [0.04, 0.034] as P2,
  elbow: [0.152, 0.07] as P2,
  wrist: [0.262, 0.114] as P2,
  /** the thumb's claw tip, forward of the wrist on the leading edge */
  thumb: [0.282, 0.148] as P2,
  /** the short index finger along the leading edge: knuckle, tip (a bone only) */
  index: [
    [0.33, 0.128],
    [0.39, 0.122],
  ] as readonly P2[],
  /** the three long fingers from the wrist, leading first: [knuckle, tip]; the first is the wing tip */
  fingers: [
    [
      [0.372, 0.126],
      [0.5, 0.082],
    ],
    [
      [0.352, 0.04],
      [0.436, -0.112],
    ],
    [
      [0.294, -0.014],
      [0.298, -0.186],
    ],
  ] as readonly (readonly P2[])[],
  /** where the membrane's trailing edge meets the leg */
  foot: [0.052, -0.13] as P2,
  /** each trailing-edge arc's depth toward the wrist, a fraction of its chord: finger 1→2, 2→3, 3→foot */
  scallop: [0.38, 0.36, 0.26] as readonly number[],
  /** the furry trunk: an ellipsoid (centre z, length, width, height) */
  body: { z: -0.026, length: 0.2, width: 0.088, height: 0.07 },
  head: { y: 0.014, z: 0.086, r: 0.04 },
  /** an ear: base centre (x, y, z), its tip's offset, base width and thickness */
  ear: { base: [0.019, 0.041, 0.09] as V3, tip: [0.014, 0.064, -0.014] as V3, w: 0.026, t: 0.008 },
  snout: { y: 0.005, z: 0.118, len: 0.026, r: 0.014 },
  eye: { x: 0.016, y: 0.024, z: 0.116, r: 0.0062 },
  /** the tail membrane's point between the feet */
  tail: [0, -0.19] as P2,
} as const;

// ---- the pose ----------------------------------------------------------------------------------

export interface BatPose {
  /** the arm's stroke about the body's long axis at the shoulder (radians, + raises the wings) */
  stroke: number;
  /** the hand's bend at the wrist on top of the stroke (+ bends the tips up) */
  hand: number;
  /** elbow and wrist flexed in the wing's plane: 0 spread .. 1 folded against the body */
  fold: number;
  /** the fingers' spread: 1 open .. 0 closed on the leading finger */
  spread: number;
  /** the arm swept forward (+) or back about the shoulder (radians) */
  sweep: number;
  /** the body's rise against the wings (wingspans) and its pitch (radians, + nose up) */
  bob: number;
  pitch: number;
}

/** the share of the cycle the downstroke takes (fast down, slow up) */
export const DOWNSTROKE = 0.4;

/** The stroke's own phase q (0 top, 0.5 bottom, 1 top) at a cycle phase (any real; period 1). */
export function strokePhase(phase: number): number {
  const x = phase - Math.floor(phase);
  return x < DOWNSTROKE ? (0.5 * x) / DOWNSTROKE : 0.5 + (0.5 * (x - DOWNSTROKE)) / (1 - DOWNSTROKE);
}

/** The flap cycle's pose at a phase (period 1; 0 is the top of the stroke). */
export function flapPose(phase: number): BatPose {
  const q = strokePhase(phase);
  const c = Math.cos(2 * Math.PI * q);
  const s = Math.sin(2 * Math.PI * q);
  // 0 .. 1 .. 0 over the upstroke: the wing flexes, then opens again for the next downstroke
  const up = q > 0.5 ? Math.sin(Math.PI * ((q - 0.5) / 0.5)) : 0;
  const upE = up * up * (3 - 2 * up);
  return {
    stroke: 0.14 + 0.98 * c,
    hand: 0.34 * s - 0.12 * upE,
    fold: 0.46 * upE,
    spread: 1 - 0.55 * upE,
    sweep: 0.14 * s,
    bob: -0.032 * c,
    pitch: 0.07 * s,
  };
}

/** The wings folded tight along the body (squeezing through a gap; a bat at rest). */
export const FOLDED: BatPose = { stroke: 0.35, hand: -0.4, fold: 1, spread: 0, sweep: 0, bob: 0, pitch: 0 };

// ---- the posed joints ---------------------------------------------------------------------------

export interface WingJoints {
  shoulder: V3;
  elbow: V3;
  wrist: V3;
  thumb: V3;
  index: V3[];
  /** per long finger: knuckle, tip */
  fingers: V3[][];
  foot: V3;
  /** the arm's and the hand's up (the membrane's normal side), for the bones' cross-sections */
  armUp: V3;
  handUp: V3;
}

const sub2 = (a: P2, b: P2): [number, number] => [a[0] - b[0], a[1] - b[1]];
const rot2 = (v: P2, a: number): [number, number] => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const add2 = (a: P2, b: P2): [number, number] => [a[0] + b[0], a[1] + b[1]];

/** Rotate (x, y) of p about the axis parallel to z through (cx, cy). */
function rotZ(p: V3, cx: number, cy: number, a: number): V3 {
  const x = p[0] - cx;
  const y = p[1] - cy;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [cx + x * c - y * s, cy + x * s + y * c, p[2]];
}

/** The right wing's joints in a pose (bat-local; mirror x for the left). */
export function poseWing(pose: BatPose): WingJoints {
  const S = BAT_SPEC;
  const fold = pose.fold;
  // in the wing's plane: the humerus swings back, the forearm flexes forward, the hand folds back
  const aS = -0.9 * fold + pose.sweep;
  const aE = aS + 1.9 * fold;
  const aW = aE - 2.6 * fold;
  const e2 = add2(S.shoulder, rot2(sub2(S.elbow, S.shoulder), aS));
  const w2 = add2(e2, rot2(sub2(S.wrist, S.elbow), aE));
  // the fingers close on the leading finger with the spread
  const lead = Math.atan2(S.fingers[0][1][1] - S.wrist[1], S.fingers[0][1][0] - S.wrist[0]);
  const hand = (p: P2, own: number): [number, number] => {
    const r = sub2(p, S.wrist);
    const closed = rot2(r, (lead - own) * (1 - pose.spread));
    return add2(w2, rot2(closed, aW));
  };
  const fingers2 = S.fingers.map((fg) => {
    const own = Math.atan2(fg[1][1] - S.wrist[1], fg[1][0] - S.wrist[0]);
    return fg.map((p) => hand(p, own));
  });
  const index2 = S.index.map((p) => hand(p, lead));
  const thumb2 = add2(w2, rot2(sub2(S.thumb, S.wrist), aE));
  // out of the plane: the stroke about the shoulder's long axis, the hand's bend at the wrist
  const lift = (p: P2): V3 => [p[0], 0, p[1]];
  const sx = S.shoulder[0];
  const st = (p: P2): V3 => rotZ(lift(p), sx, 0, pose.stroke);
  const wrist = st(w2);
  const hb = (p: P2): V3 => rotZ(st(p), wrist[0], wrist[1], pose.hand);
  const armUp = rotZ([0, 1, 0], 0, 0, pose.stroke);
  const handUp = rotZ([0, 1, 0], 0, 0, pose.stroke + pose.hand);
  return {
    shoulder: lift(S.shoulder),
    elbow: st(e2),
    wrist,
    thumb: st(thumb2),
    index: index2.map(hb),
    fingers: fingers2.map((fg) => fg.map(hb)),
    foot: [S.foot[0], -0.006, S.foot[1]],
    armUp,
    handUp,
  };
}

// ---- membrane sampling --------------------------------------------------------------------------

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm3 = (a: V3): V3 => {
  const l = len3(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const madd = (a: V3, b: V3, k: number): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** A point a fraction t along a polyline, by length. */
function along(pts: V3[], t: number): V3 {
  const segs = pts.slice(1).map((p, i) => len3(sub3(p, pts[i])));
  const total = segs.reduce((a, b) => a + b, 0);
  let d = Math.min(Math.max(t, 0), 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) return lerp3(pts[i], pts[i + 1], segs[i] > 0 ? Math.min(1, d / segs[i]) : 0);
    d -= segs[i];
  }
  return pts[pts.length - 1];
}

/** The scalloped edge from a to b (t 0..1): a quadratic arc bowing `depth` of its chord toward `toward`. */
function scallop(a: V3, b: V3, toward: V3, depth: number, t: number): V3 {
  const m = lerp3(a, b, 0.5);
  const chord = len3(sub3(b, a));
  const c = madd(m, norm3(sub3(toward, m)), 2 * depth * chord);
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]];
}

/**
 * grid samples: the two hand panels (rows from the wrist out; columns across, dense beside the
 * finger bones so their dark lines have a narrow feather) and the arm panel (along the span to the
 * third finger, across the chord from the arm), each dense beside its bones
 */
const HAND_S = 6;
const HAND_U = [0, 0.06, 0.2, 0.4, 0.6, 0.8, 0.94, 1] as const;
const ARM_A = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.88, 0.95, 1] as const;
const ARM_B = [0, 0.07, 0.22, 0.4, 0.58, 0.76, 0.9, 1] as const;
/** membrane camber (wingspans): the membrane billows a little to its upper side */
const CAMBER = 0.008;

/** The right wing's membrane panels in a pose: grids of points (rows from the leading side). */
export function wingPanels(j: WingJoints): V3[][][] {
  const S = BAT_SPEC;
  const panels: V3[][][] = [];
  // the hand panels, between long fingers k and k+1, radial from the wrist
  for (let k = 0; k < 2; k++) {
    const A = [j.wrist, ...j.fingers[k]];
    const B = [j.wrist, ...j.fingers[k + 1]];
    const ta = j.fingers[k][1];
    const tb = j.fingers[k + 1][1];
    const n = norm3(cross3(sub3(tb, j.wrist), sub3(ta, j.wrist)));
    const up = n[0] * j.handUp[0] + n[1] * j.handUp[1] + n[2] * j.handUp[2] >= 0 ? n : ([-n[0], -n[1], -n[2]] as V3);
    const grid: V3[][] = [];
    for (let i = 0; i <= HAND_S; i++) {
      const s = i / HAND_S;
      const row: V3[] = [];
      const pa = along(A, s);
      const pb = along(B, s);
      for (const u of HAND_U) {
        const base = lerp3(pa, pb, u);
        const e = scallop(ta, tb, j.wrist, S.scallop[k], u);
        const flat = lerp3(ta, tb, u);
        let p = madd(base, sub3(e, flat), s * s);
        p = madd(p, up, CAMBER * Math.sin(Math.PI * s) * Math.sin(Math.PI * u) * len3(sub3(ta, tb)) * 6);
        row.push(p);
      }
      grid.push(row);
    }
    panels.push(grid);
  }
  // the arm panel: a Coons patch between the arm (leading), the third finger (outer), the
  // scalloped edge back to the foot (trailing) and the body's flank (inner)
  {
    const arm = [j.shoulder, j.elbow, j.wrist];
    const outer = [j.wrist, ...j.fingers[2]];
    const t3 = j.fingers[2][1];
    const n = norm3(cross3(sub3(t3, j.shoulder), sub3(j.wrist, j.foot)));
    const up = n[0] * j.armUp[0] + n[1] * j.armUp[1] + n[2] * j.armUp[2] >= 0 ? n : ([-n[0], -n[1], -n[2]] as V3);
    const span = len3(sub3(t3, j.foot));
    const grid: V3[][] = [];
    for (const b of ARM_B) {
      const row: V3[] = [];
      for (const a of ARM_A) {
        const L = along(arm, a);
        const T = scallop(j.foot, t3, j.elbow, S.scallop[2], a);
        const I = lerp3(j.shoulder, j.foot, b);
        const O = along(outer, b);
        const p: V3 = [0, 0, 0];
        for (let d = 0; d < 3; d++) {
          p[d] = (1 - b) * L[d] + b * T[d] + (1 - a) * I[d] + a * O[d] - ((1 - a) * (1 - b) * j.shoulder[d] + a * (1 - b) * j.wrist[d] + (1 - a) * b * j.foot[d] + a * b * t3[d]);
        }
        row.push(madd(p, up, CAMBER * Math.sin(Math.PI * a) * Math.sin(Math.PI * b) * span * 2.5));
      }
      grid.push(row);
    }
    panels.push(grid);
  }
  return panels;
}

/** The bones as polylines with a radius at each point (arm, forearm, index, fingers, thumb). */
export function wingBones(j: WingJoints): { pts: V3[]; r: number[]; up: V3 }[] {
  return [
    { pts: [j.shoulder, j.elbow, j.wrist], r: [0.0085, 0.0068, 0.006], up: j.armUp },
    { pts: [j.wrist, ...j.index], r: [0.004, 0.003, 0.0018], up: j.handUp },
    ...j.fingers.map((fg) => ({ pts: [j.wrist, ...fg], r: [0.0042, 0.0032, 0.0016], up: j.handUp })),
    { pts: [j.wrist, lerp3(j.wrist, j.thumb, 0.55), j.thumb], r: [0.0045, 0.0034, 0.0008], up: j.armUp },
  ];
}

// ---- the 3D geometries --------------------------------------------------------------------------

/** the flap cycle's baked steps (morph targets): an instance blends the two around its phase */
export const WING_POSES = 12;

type RGBA = [number, number, number, number];
// linear RGB: a dark membrane, its thin trailing edge a touch warmer and paler against the moon, darker bones
// (the alpha is the rim's share: the thin membrane takes very little, its edge and the bones some)
// (edge-on, a thin membrane or finger must not carry a bright rim: it shimmers; the arm, thicker, takes some)
const MEMBRANE: RGBA = [0.13, 0.105, 0.135, 0.04];
const MEMBRANE_EDGE: RGBA = [0.19, 0.14, 0.16, 0.1];
const BONE: RGBA = [0.014, 0.01, 0.012, 0.05];
const ARM: RGBA = [0.018, 0.012, 0.015, 0.03];
/** the membrane's darkening on a finger bone's line (and its feather), and its lift between bones */
const BONE_DARK = 0.85;
const BETWEEN_LIFT = 0.35;
/** a sample's weight as a bone line: 1 on the bone, 0.45 at its feather column, else 0 */
const boneW = (u: number, at: number) => (Math.abs(u - at) < 1e-6 ? 1 : Math.abs(u - at) < 0.075 ? 0.6 : 0);

/** The wing mesh's vertex positions in a pose (both wings, a fixed topology); see batWingGeometry. */
function wingPositions(pose: BatPose): { pos: number[]; col: number[]; idx: number[] } {
  const j = poseWing(pose);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const side of [1, -1] as const) {
    const flip = (p: V3): V3 => [p[0] * side, p[1], p[2]];
    const tri = (a: number, b: number, c: number) => (side > 0 ? idx.push(a, b, c) : idx.push(a, c, b));
    // membranes
    const panels = wingPanels(j);
    panels.forEach((grid, pi) => {
      const base = pos.length / 3;
      const rows = grid.length;
      const cols = grid[0].length;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const p = flip(grid[r][c]);
          pos.push(...p);
          // the trailing edge (the last row of a hand panel, the last row of the arm panel) is thin and pale against the moon
          const edge = r === rows - 1 ? 1 : r === rows - 2 ? 0.35 : 0;
          // the finger bones read as dark lines through the membrane (a hand panel's sides; the arm
          // panel's leading row, the arm, and its outer column, the third finger), the skin
          // between them a shade lighter (thin against the sky)
          const w = pi < 2 ? Math.max(boneW(HAND_U[c], 0), boneW(HAND_U[c], 1)) : Math.max(boneW(ARM_B[r], 0), boneW(ARM_A[c], 1));
          const dark = (1 - BONE_DARK * w) * (1 + BETWEEN_LIFT * (1 - w)) ** (1 - edge);
          for (let d = 0; d < 4; d++) col.push((MEMBRANE[d] + (MEMBRANE_EDGE[d] - MEMBRANE[d]) * edge) * (d < 3 ? dark : 1));
        }
      // the arm panel's grid runs the other way round from the hand panels': wind it to face the same side
      const flipPanel = pi === 2;
      for (let r = 0; r < rows - 1; r++)
        for (let c = 0; c < cols - 1; c++) {
          const a = base + r * cols + c;
          const b = a + 1;
          const cc = a + cols;
          const dd = cc + 1;
          if (flipPanel) {
            tri(a, b, cc);
            tri(b, dd, cc);
          } else {
            tri(a, cc, b);
            tri(b, cc, dd);
          }
        }
    });
    // bones: four-sided prisms straddling the membrane
    for (const [bi, bone] of wingBones(j).entries()) {
      const bc = bi === 0 ? ARM : BONE;
      for (let i = 0; i < bone.pts.length - 1; i++) {
        const a = bone.pts[i];
        const b = bone.pts[i + 1];
        const d = norm3(sub3(b, a));
        const sideV = norm3(cross3(d, bone.up));
        const upV = norm3(cross3(sideV, d));
        const base = pos.length / 3;
        for (const [p, r] of [
          [a, bone.r[i]],
          [b, bone.r[i + 1]],
        ] as const) {
          for (const [ox, oy] of [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
          ] as const) {
            pos.push(...flip([p[0] + (sideV[0] * ox + upV[0] * oy) * r, p[1] + (sideV[1] * ox + upV[1] * oy) * r, p[2] + (sideV[2] * ox + upV[2] * oy) * r]));
            col.push(...bc);
          }
        }
        for (let k = 0; k < 4; k++) {
          const k1 = (k + 1) % 4;
          tri(base + k, base + 4 + k, base + k1);
          tri(base + k1, base + 4 + k, base + 4 + k1);
        }
      }
    }
  }
  return { pos, col, idx };
}

function normalsOf(pos: number[], idx: number[]): Float32Array {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = (g.getAttribute('normal').array as Float32Array).slice();
  g.dispose();
  return n;
}

/**
 * Both wings (bat-local, wingspan 1) with the flap cycle as relative morph targets: targets
 * 0..WING_POSES-2 are cycle steps 1..WING_POSES-1 (step 0 is the base), the last target the
 * FOLDED pose. Membrane, bones and the thumb claws in one mesh (RGBA vertex colours); render it
 * double-sided.
 */
export function batWingGeometry(): BufferGeometry {
  const steps = Array.from({ length: WING_POSES }, (_, i) => wingPositions(flapPose(i / WING_POSES)));
  const folded = wingPositions(FOLDED);
  const base = steps[0];
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(base.pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normalsOf(base.pos, base.idx), 3));
  g.setAttribute('color', new Float32BufferAttribute(base.col, 4));
  g.setIndex(base.idx);
  const baseN = g.getAttribute('normal').array as Float32Array;
  const targets = [...steps.slice(1), folded];
  g.morphAttributes.position = targets.map((t) => new Float32BufferAttribute(t.pos.map((v, i) => v - base.pos[i]), 3));
  g.morphAttributes.normal = targets.map((t) => {
    const n = normalsOf(t.pos, t.idx);
    return new Float32BufferAttribute(Array.from(n, (v, i) => v - baseN[i]), 3);
  });
  g.morphTargetsRelative = true;
  // the flap reaches out to the full span either way
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius = 0.6;
  return g;
}

/** The morph influences for a cycle phase, blended toward the folded pose by `folded` (0..1). */
export function wingInfluences(phase: number, folded: number, out: number[]): number[] {
  out.fill(0);
  const x = (phase - Math.floor(phase)) * WING_POSES;
  const i0 = Math.floor(x) % WING_POSES;
  const i1 = (i0 + 1) % WING_POSES;
  const w = x - Math.floor(x);
  const k = 1 - folded;
  // cycle step i is target i - 1 (step 0 is the base: no target)
  if (i0 > 0) out[i0 - 1] += (1 - w) * k;
  if (i1 > 0) out[i1 - 1] += w * k;
  out[WING_POSES - 1] = folded;
  return out;
}

/** A geometry builder: positions, RGBA colours, indices (merged parts). */
class Parts {
  pos: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  /** a lat-long ellipsoid around c with half-axes h, its radius displaced by `fur(dir)`; colour by the direction */
  ellipsoid(c: V3, h: V3, lat: number, lon: number, fur: (d: V3) => number, color: (d: V3) => RGBA): void {
    const base = this.pos.length / 3;
    for (let i = 0; i <= lat; i++) {
      const th = (i / lat) * Math.PI;
      for (let k = 0; k < lon; k++) {
        const ph = (k / lon) * Math.PI * 2;
        // z is the long axis: the poles at the head and the tail
        const d: V3 = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
        const f = 1 + fur(d);
        this.pos.push(c[0] + d[0] * h[0] * f, c[1] + d[1] * h[1] * f, c[2] + d[2] * h[2] * f);
        this.col.push(...color(d));
      }
    }
    for (let i = 0; i < lat; i++)
      for (let k = 0; k < lon; k++) {
        const a = base + i * lon + k;
        const b = base + i * lon + ((k + 1) % lon);
        const c2 = a + lon;
        const d2 = b + lon;
        this.idx.push(a, b, c2, b, d2, c2);
      }
  }
  /** a tapering tube along a polyline: `sides` around, a radius per point, its section scaled (sx, sy) and rolled */
  tube(pts: V3[], r: number[], sides: number, color: RGBA, sx = 1, sy = 1, roll = 0): void {
    const base = this.pos.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const d = norm3(sub3(b, a));
      const ref: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const s0 = norm3(cross3(d, ref));
      const u0 = cross3(s0, d);
      const cr = Math.cos(roll);
      const sr = Math.sin(roll);
      const s: V3 = [s0[0] * cr + u0[0] * sr, s0[1] * cr + u0[1] * sr, s0[2] * cr + u0[2] * sr];
      const u = cross3(s, d);
      for (let k = 0; k < sides; k++) {
        const a2 = (k / sides) * Math.PI * 2;
        const ox = Math.cos(a2) * r[i] * sx;
        const oy = Math.sin(a2) * r[i] * sy;
        this.pos.push(pts[i][0] + s[0] * ox + u[0] * oy, pts[i][1] + s[1] * ox + u[1] * oy, pts[i][2] + s[2] * ox + u[2] * oy);
        this.col.push(...color);
      }
    }
    for (let i = 0; i < pts.length - 1; i++)
      for (let k = 0; k < sides; k++) {
        const a = base + i * sides + k;
        const b = base + i * sides + ((k + 1) % sides);
        this.idx.push(a, b, a + sides, b, b + sides, a + sides);
      }
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

const FUR: RGBA = [0.05, 0.034, 0.042, 0.6];
const FUR_BELLY: RGBA = [0.032, 0.022, 0.027, 0.6];
const SKIN: RGBA = [0.035, 0.024, 0.03, 0.6];
const INNER_EAR: RGBA = [0.09, 0.045, 0.055, 0.5];

/** The rigid body (bat-local, wingspan 1): furry trunk, head, ears, snout, legs and the tail membrane. */
export function batBodyGeometry(seed = 1): BufferGeometry {
  const S = BAT_SPEC;
  const p = new Parts();
  const fur = (d: V3, amp: number, f: number) => amp * fbm2(d[0] * f + d[2] * 1.7, d[1] * f - d[2] * 2.3, seed, 3, 1);
  const shade = (d: V3, top: RGBA, belly: RGBA): RGBA => {
    const t = Math.min(1, Math.max(0, 0.5 + 0.8 * d[1]));
    return [belly[0] + (top[0] - belly[0]) * t, belly[1] + (top[1] - belly[1]) * t, belly[2] + (top[2] - belly[2]) * t, belly[3] + (top[3] - belly[3]) * t];
  };
  // the trunk: an oval of fur, fuller at the chest
  p.ellipsoid([0, 0, S.body.z], [S.body.width / 2, S.body.height / 2, S.body.length / 2], 9, 14, (d) => fur(d, 0.12, 5.5) + 0.08 * Math.max(0, d[2]) - 0.1 * Math.max(0, -d[2]) ** 2, (d) => shade(d, FUR, FUR_BELLY));
  // the head: round, a ruff of fur where it meets the chest
  p.ellipsoid([0, S.head.y, S.head.z], [S.head.r, S.head.r * 0.92, S.head.r * 0.95], 8, 12, (d) => fur(d, 0.08, 6.5), (d) => shade(d, FUR, FUR_BELLY));
  // the snout: short, a little down
  p.tube(
    [
      [0, S.snout.y, S.snout.z - 0.006],
      [0, S.snout.y - 0.002, S.snout.z + S.snout.len * 0.6],
      [0, S.snout.y - 0.004, S.snout.z + S.snout.len],
    ],
    [S.snout.r, S.snout.r * 0.72, S.snout.r * 0.25],
    7,
    SKIN,
    1,
    0.85,
  );
  // the ears: tall, pointed, flattened, splayed out and leaning back; the inner face paler
  for (const s of [1, -1]) {
    const b: V3 = [S.ear.base[0] * s, S.ear.base[1], S.ear.base[2]];
    const tip: V3 = [b[0] + S.ear.tip[0] * s, b[1] + S.ear.tip[1], b[2] + S.ear.tip[2]];
    const mid = lerp3(b, tip, 0.45);
    mid[0] += 0.004 * s;
    // (the tube's section: its first axis runs along z here, the second along x)
    p.tube([[b[0], b[1] - 0.008, b[2]], b, mid, tip], [S.ear.w * 0.5, S.ear.w * 0.5, S.ear.w * 0.38, 0.0008], 6, FUR, S.ear.t / S.ear.w, 1, s * 0.4);
    // the inner ear: a thin paler lining set into the front face
    p.tube([lerp3(b, tip, 0.12), lerp3(b, tip, 0.5), lerp3(b, tip, 0.88)].map((q) => [q[0], q[1], q[2] + 0.0035] as V3), [S.ear.w * 0.28, S.ear.w * 0.22, 0.0006], 5, INNER_EAR, 0.3, 1, s * 0.4);
  }
  // the legs, trailing back to the feet where the membrane's edge meets them, and the tail membrane
  for (const s of [1, -1]) {
    p.tube(
      [
        [0.018 * s, -0.008, S.body.z - S.body.length * 0.36],
        [0.036 * s, -0.008, S.foot[1] + 0.012],
        [S.foot[0] * s, -0.007, S.foot[1] - 0.006],
      ],
      [0.006, 0.0042, 0.0026],
      5,
      SKIN,
    );
  }
  {
    // the tail membrane: a thin wedge (top and bottom faces) between the feet and the tail's point, its edge scalloped
    const base = p.pos.length / 3;
    const fl: V3 = [-S.foot[0], -0.007, S.foot[1] - 0.004];
    const fr: V3 = [S.foot[0], -0.007, S.foot[1] - 0.004];
    const root: V3 = [0, -0.004, S.body.z - S.body.length * 0.42];
    const tail: V3 = [S.tail[0], -0.012, S.tail[1]];
    const ring = [fr, scallop(fr, tail, root, 0.22, 0.5), tail, scallop(tail, fl, root, 0.22, 0.5), fl];
    for (const off of [0.0016, -0.0016]) {
      p.pos.push(root[0], root[1] + off, root[2]);
      p.col.push(...MEMBRANE);
      for (const q of ring) {
        p.pos.push(q[0], q[1] + off, q[2]);
        p.col.push(...MEMBRANE_EDGE);
      }
    }
    const n = ring.length + 1;
    for (let k = 1; k < ring.length; k++) {
      p.idx.push(base, base + k + 1, base + k);
      p.idx.push(base + n, base + n + k, base + n + k + 1);
    }
  }
  return p.geometry();
}

/** The two eyes (bat-local): small beads on the face, for an emissive glint. */
export function batEyeGeometry(): BufferGeometry {
  const S = BAT_SPEC;
  const p = new Parts();
  for (const s of [1, -1]) p.ellipsoid([S.eye.x * s, S.eye.y, S.eye.z], [S.eye.r, S.eye.r * 0.85, S.eye.r * 0.7], 4, 6, () => 0, () => [1, 1, 1, 0]);
  return p.geometry();
}

// ---- the far fleck --------------------------------------------------------------------------------

/** the fleck's half-thickness along the arm (wingspans): shoulder, elbow, wrist, tip; fattened to survive the painterly pass */
const FLECK_T = [0.15, 0.14, 0.1, 0.045] as const;
const FLECK: RGBA = [0.02, 0.016, 0.02, 0];

/** A fleck's points in a pose (fleck-local: x right, y up, z toward the eye; wingspan 1). */
function fleckPositions(pose: BatPose): { pos: number[]; idx: number[] } {
  const j = poseWing(pose);
  const pos: number[] = [];
  const idx: number[] = [];
  // the wing seen from in front or behind: the arm's line from the shoulder through the wrist to
  // the tip (x out, y up), thick on the trailing side (the membrane seen a little from below)
  const line: [number, number][] = [
    [j.shoulder[0], j.shoulder[1]],
    [j.elbow[0], j.elbow[1]],
    [j.wrist[0], j.wrist[1]],
    [j.fingers[0][1][0], j.fingers[0][1][1]],
  ];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    line.forEach((p, i) => {
      const a = line[Math.max(0, i - 1)];
      const b = line[Math.min(line.length - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      // the line's normal, toward its upper side
      let nx = -dy / l;
      let ny = dx / l;
      if (ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const t = FLECK_T[i];
      pos.push((p[0] + nx * t * 0.45) * side, p[1] + ny * t * 0.45, 0);
      pos.push((p[0] - nx * t) * side, p[1] - ny * t, 0);
    });
    for (let i = 0; i < line.length - 1; i++) {
      const a = base + i * 2;
      // both wings face the eye (+z): the mirrored one winds the other way
      if (side > 0) idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      else idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
    }
  }
  // the body between the shoulders, with the ears' two points
  const S = BAT_SPEC;
  const base = pos.length / 3;
  const bw = S.body.width * 0.62;
  const ring: [number, number][] = [
    [0, -0.1],
    [bw, -0.02],
    [bw * 0.9, 0.035],
    [S.ear.base[0] + S.ear.tip[0], 0.03 + S.ear.tip[1]],
    [0, 0.05],
    [-(S.ear.base[0] + S.ear.tip[0]), 0.03 + S.ear.tip[1]],
    [-bw * 0.9, 0.035],
    [-bw, -0.02],
  ];
  pos.push(0, 0, 0);
  for (const [x, y] of ring) pos.push(x, y, 0);
  for (let i = 0; i < ring.length; i++) idx.push(base, base + 1 + i, base + 1 + ((i + 1) % ring.length));
  return { pos, idx };
}

/**
 * The far bat (below ~25 px): a flat fleck from the same spec and flap, the arm's line fattened
 * into a chevron and a small eared body, to be turned to face the eye. The flap cycle and the
 * folded pose as morph targets, as batWingGeometry's. Its normal is +z; RGBA colours (no rim).
 */
export function batFleckGeometry(): BufferGeometry {
  const steps = Array.from({ length: WING_POSES }, (_, i) => fleckPositions(flapPose(i / WING_POSES)));
  const folded = fleckPositions(FOLDED);
  const base = steps[0];
  const g = new BufferGeometry();
  const n = base.pos.length / 3;
  g.setAttribute('position', new Float32BufferAttribute(base.pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(Array.from({ length: n }, () => [0, 0, 1]).flat(), 3));
  g.setAttribute('color', new Float32BufferAttribute(Array.from({ length: n }, () => FLECK).flat(), 4));
  g.setIndex(base.idx);
  g.morphAttributes.position = [...steps.slice(1), folded].map((t) => new Float32BufferAttribute(t.pos.map((v, i) => v - base.pos[i]), 3));
  g.morphTargetsRelative = true;
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius = 0.6;
  return g;
}

// ---- the 2D outline -----------------------------------------------------------------------------

export interface BatOutline {
  /** closed polygons: each wing's membrane (leading edge, fingertips, scallops, flank) */
  wings: [number, number][][];
  /** the bones as polylines (arm, index, fingers, thumb) */
  bones: [number, number][][];
  /** the trunk, the head, the ears and the snout as closed polygons */
  body: [number, number][][];
  /** the eyes' centres */
  eyes: [number, number][];
  /** the leading edges (shoulder to wrist to wing tip), for a rim */
  leading: [number, number][][];
}

/**
 * The bat's outline in a pose, seen from the front and below (`view`: radians above its belly
 * plane; 0 is straight below, π/2 head-on), on a screen with x right and y down, wingspan 1, the
 * body's centre at the origin.
 */
export function batOutline(pose: BatPose, view = 0.55): BatOutline {
  const j = poseWing(pose);
  const S = BAT_SPEC;
  const ce = Math.cos(view);
  const se = Math.sin(view);
  const bob = pose.bob;
  const proj = (p: V3, side = 1): [number, number] => [p[0] * side, -((p[1] + bob) * se + p[2] * ce)];
  const wings: [number, number][][] = [];
  const bones: [number, number][][] = [];
  const leading: [number, number][][] = [];
  for (const side of [1, -1]) {
    const ring: V3[] = [j.shoulder, j.elbow, j.wrist, j.thumb, j.wrist, ...j.fingers[0]];
    for (let k = 0; k < 2; k++) for (let i = 1; i <= 8; i++) ring.push(scallop(j.fingers[k][1], j.fingers[k + 1][1], j.wrist, S.scallop[k], i / 8));
    for (let i = 1; i <= 12; i++) ring.push(scallop(j.fingers[2][1], j.foot, j.elbow, S.scallop[2], i / 12));
    wings.push(ring.map((p) => proj(p, side)));
    for (const b of wingBones(j)) bones.push(b.pts.map((p) => proj(p, side)));
    leading.push([j.shoulder, j.elbow, j.wrist, ...j.fingers[0]].map((p) => proj(p, side)));
  }
  const ellipse = (c: V3, rx: number, ry: number, rz: number, n = 20): [number, number][] =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      // the silhouette of an ellipsoid seen along the view: x and the (y, z) half-axes projected
      const ry2 = Math.sqrt((ry * se) ** 2 + (rz * ce) ** 2);
      return proj([c[0] + Math.cos(a) * rx, c[1], c[2]]).map((v, k) => (k === 0 ? v : v - Math.sin(a) * ry2)) as [number, number];
    });
  const body: [number, number][][] = [ellipse([0, 0, S.body.z], S.body.width / 2, S.body.height / 2, S.body.length / 2), ellipse([0, S.head.y, S.head.z], S.head.r, S.head.r * 0.92, S.head.r * 0.95, 16)];
  for (const s of [1, -1]) {
    const b: V3 = [S.ear.base[0] * s, S.ear.base[1], S.ear.base[2]];
    const tip: V3 = [b[0] + S.ear.tip[0] * s, b[1] + S.ear.tip[1], b[2] + S.ear.tip[2]];
    const w = S.ear.w * 0.5;
    const outerMid = lerp3(b, tip, 0.45);
    outerMid[0] += w * 0.7 * s;
    body.push([proj([b[0] - w * s, b[1] - 0.012, b[2]]), proj(tip), proj(outerMid), proj([b[0] + w * s, b[1] - 0.012, b[2]])]);
  }
  body.push([proj([-S.snout.r, S.snout.y, S.snout.z]), proj([S.snout.r, S.snout.y, S.snout.z]), proj([0, S.snout.y - 0.004, S.snout.z + S.snout.len])]);
  const eyes = [1, -1].map((s) => proj([S.eye.x * s, S.eye.y, S.eye.z]));
  return { wings, bones, body, eyes, leading };
}
