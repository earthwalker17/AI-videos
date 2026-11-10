/**
 * Geometry for the Register Desk's objects, in world units (z up). Every solid gets bevelled edges:
 * a bevel facing the key catches it as a rim, the other darkens, and that is most of what makes a
 * shape read as a made object rather than a flat box. Pure constructors of three geometries; the
 * objects memoise what they build.
 */
import { BufferGeometry, CatmullRomCurve3, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, Path, PlaneGeometry, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { P2, P3, Rect } from './layout.ts';

/** A rounded rectangle centred on (cx, cy) as a shape (or a hole path). */
export function roundRect(w: number, d: number, r: number, cx = 0, cy = 0, path: Shape | Path = new Shape()): Shape | Path {
  const x0 = cx - w / 2;
  const y0 = cy - d / 2;
  const rr = Math.max(0, Math.min(r, w / 2 - 0.01, d / 2 - 0.01));
  path.moveTo(x0 + rr, y0);
  path.lineTo(x0 + w - rr, y0);
  path.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + rr);
  path.lineTo(x0 + w, y0 + d - rr);
  path.quadraticCurveTo(x0 + w, y0 + d, x0 + w - rr, y0 + d);
  path.lineTo(x0 + rr, y0 + d);
  path.quadraticCurveTo(x0, y0 + d, x0, y0 + d - rr);
  path.lineTo(x0, y0 + rr);
  path.quadraticCurveTo(x0, y0, x0 + rr, y0);
  return path;
}

export const rectShape = (r: Rect, radius = 3): Shape => roundRect(r.x1 - r.x0, r.y1 - r.y0, radius, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2) as Shape;

/**
 * A shape extruded from z0 to z1 with a bevel on both edges (the outline is the outer size).
 * The bevel is limited so the solid keeps a flat top.
 */
export function extrude(shape: Shape, z0: number, z1: number, bevel = 2, segments = 2): BufferGeometry {
  const h = z1 - z0;
  const b = Math.max(0, Math.min(bevel, h / 2 - 0.05));
  const depth = Math.max(0.05, h - 2 * b);
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: segments, curveSegments: 10 });
  g.translate(0, 0, z0 + b);
  return g;
}

/** A bevelled slab over a rectangle. */
export const slab = (r: Rect, z0: number, z1: number, radius = 3, bevel = 2): BufferGeometry => extrude(rectShape(r, radius), z0, z1, bevel);

/** A rectangle with a rectangular hole (a frame), bevelled. */
export function frame(outer: Rect, inset: number, z0: number, z1: number, radius = 4, bevel = 1.5): BufferGeometry {
  const s = rectShape(outer, radius);
  s.holes.push(roundRect(outer.x1 - outer.x0 - 2 * inset, outer.y1 - outer.y0 - 2 * inset, Math.max(1, radius - inset / 2), (outer.x0 + outer.x1) / 2, (outer.y0 + outer.y1) / 2, new Path()) as Path);
  return extrude(s, z0, z1, bevel);
}

/** A disc (or ring) on the z axis from z0 to z1, bevelled, with optional round holes. */
export function disc(r: number, z0: number, z1: number, o: { inner?: number; holes?: { c: P2; r: number }[]; bevel?: number; cx?: number; cy?: number } = {}): BufferGeometry {
  const cx = o.cx ?? 0;
  const cy = o.cy ?? 0;
  const s = new Shape();
  s.absarc(cx, cy, r, 0, Math.PI * 2, false);
  if (o.inner) {
    const h = new Path();
    h.absarc(cx, cy, o.inner, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  for (const hole of o.holes ?? []) {
    const h = new Path();
    h.absarc(cx + hole.c[0], cy + hole.c[1], hole.r, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const h = z1 - z0;
  const b = Math.max(0, Math.min(o.bevel ?? 1.5, h / 2 - 0.05));
  const g = new ExtrudeGeometry(s, { depth: Math.max(0.05, h - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2, curveSegments: 48 });
  g.translate(0, 0, z0 + b);
  return g;
}

/** A smooth cylinder on the z axis (r, from z0 to z1), centred at (x, y). */
export function cylinderZ(r: number, z0: number, z1: number, x = 0, y = 0, segments = 40, rTop = r): BufferGeometry {
  const g = new CylinderGeometry(rTop, r, z1 - z0, segments, 1);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, (z0 + z1) / 2);
  return g;
}

/** A lathe about the z axis from (radius, z) points. */
export function latheZ(profile: readonly P2[], segments = 40): BufferGeometry {
  const g = new LatheGeometry(
    profile.map(([r, z]) => new Vector2(r, z)),
    segments,
  );
  g.rotateX(Math.PI / 2);
  return g;
}

/** A smooth tube along points (centripetal Catmull-Rom). */
export function tube(points: readonly P3[], radius: number, tubular = 64, radial = 10): BufferGeometry {
  const curve = new CatmullRomCurve3(
    points.map((p) => new Vector3(p[0], p[1], p[2])),
    false,
    'centripetal',
  );
  return new TubeGeometry(curve, tubular, radius, radial, false);
}

/** Points along a centripetal curve through `points` (for twisting strands about it). */
export function curvePoints(points: readonly P3[], n: number): { p: Vector3; t: Vector3 }[] {
  const curve = new CatmullRomCurve3(
    points.map((p) => new Vector3(p[0], p[1], p[2])),
    false,
    'centripetal',
  );
  return Array.from({ length: n + 1 }, (_, i) => ({ p: curve.getPointAt(i / n), t: curve.getTangentAt(i / n) }));
}

/** A twisted pair about a path: two strands winding round each other (radius `a`, `pitch` units a turn). */
export function twistedPair(points: readonly P3[], strandR: number, a: number, pitch: number, n = 220): BufferGeometry[] {
  const pts = curvePoints(points, n);
  let len = 0;
  const up = new Vector3(0, 0, 1);
  const strands: P3[][] = [[], []];
  pts.forEach((q, i) => {
    if (i > 0) len += q.p.distanceTo(pts[i - 1].p);
    const side = new Vector3().crossVectors(q.t, up).normalize();
    const nrm = new Vector3().crossVectors(side, q.t).normalize();
    for (let k = 0; k < 2; k++) {
      const ang = (2 * Math.PI * len) / pitch + k * Math.PI;
      const off = side.clone().multiplyScalar(Math.cos(ang) * a).add(nrm.clone().multiplyScalar(Math.sin(ang) * a));
      strands[k].push([q.p.x + off.x, q.p.y + off.y, q.p.z + off.z]);
    }
  });
  return strands.map((s) => tube(s, strandR, n, 8));
}

/**
 * A profile swept along a 3D path with a level frame (no twist): the profile's x runs across the
 * path (to its left), y up. For troughs and belts.
 */
export function sweep(path: readonly P3[], profile: readonly P2[], samples = 48): BufferGeometry {
  const curve = new CatmullRomCurve3(
    path.map((p) => new Vector3(p[0], p[1], p[2])),
    false,
    'centripetal',
  );
  const up = new Vector3(0, 0, 1);
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const m = profile.length;
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const side = new Vector3().crossVectors(up, t).normalize();
    const lift = new Vector3().crossVectors(t, side).normalize();
    for (let j = 0; j < m; j++) {
      const [x, y] = profile[j];
      pos.push(p.x + side.x * x + lift.x * y, p.y + side.y * x + lift.y * y, p.z + side.z * x + lift.z * y);
      uv.push(j / (m - 1), u);
    }
  }
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j;
      const b = (i + 1) * m + j;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** A flat plane lying on the desk at height z, centred on (cx, cy), w along x and d along y, turned by rot. */
export function plane(w: number, d: number, cx: number, cy: number, z: number, rot = 0): BufferGeometry {
  const g = new PlaneGeometry(w, d);
  if (rot) g.rotateZ(rot);
  g.translate(cx, cy, z);
  return g;
}

export const planeOn = (r: Rect, z: number): BufferGeometry => plane(r.x1 - r.x0, r.y1 - r.y0, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, z);

/** A sphere cap (a jewel, a knob) on the desk plane: the upper half of a sphere of radius r at (x, y, z). */
export function dome(r: number, x: number, y: number, z: number): BufferGeometry {
  const g = new SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** A torus lying flat (in the xy plane). */
export function ringFlat(r: number, tubeR: number, x: number, y: number, z: number): BufferGeometry {
  const g = new TorusGeometry(r, tubeR, 10, 48);
  g.translate(x, y, z);
  return g;
}

/** Merge geometries that share a material (one draw call); all are made non-indexed first. */
export function merge(list: BufferGeometry[]): BufferGeometry {
  const parts = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (!n.getAttribute('uv')) n.setAttribute('uv', new Float32BufferAttribute(new Float32Array((n.getAttribute('position').count * 2) as number), 2));
    for (const name of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(name)) n.deleteAttribute(name);
    return n;
  });
  const m = mergeGeometries(parts, false);
  if (!m) throw new Error('desk geom: geometries could not be merged');
  return m;
}

// ------------------------------------------------------------------------------------------------
// Paper pieces: the message family's slips and cards (act one's heap and folders, the feeders, the turn)

/** The two message cuts every slip and card is made from: a chat slip, a punched CI card. */
export type SlipKind = 'chat' | 'ci';

/**
 * A slip's outline centred on the origin: a chat slip's notched east (leading) end, a CI card's clipped
 * north-west corner. The cut is the mark: a chat slip carries no printed sign (BANNED: glyph-line "text").
 */
export function slipShape(kind: SlipKind, w: number, d: number): Shape {
  const s = new Shape();
  const x = w / 2;
  const y = d / 2;
  if (kind === 'chat') {
    s.moveTo(-x, -y);
    s.lineTo(x, -y);
    s.lineTo(x - d * 0.28, 0);
    s.lineTo(x, y);
    s.lineTo(-x, y);
  } else {
    const k = Math.min(w, d) * 0.22;
    s.moveTo(-x, -y);
    s.lineTo(x, -y);
    s.lineTo(x, y);
    s.lineTo(-x + k, y);
    s.lineTo(-x, y - k);
  }
  s.closePath();
  return s;
}

/** Map a flat piece's UVs to its own bounds (the print lies on its top face). */
export function fitUv(g: BufferGeometry, w: number, d: number): BufferGeometry {
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[2 * i] = pos.getX(i) / w + 0.5;
    uv[2 * i + 1] = pos.getY(i) / d + 0.5;
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

/** A thin paper piece of a kind, its print on top. */
export const piece = (kind: SlipKind, w: number, d: number, t = 0.8): BufferGeometry => fitUv(extrude(slipShape(kind, w, d), 0, t, 0.25), w, d);

/**
 * A rectangle centred on the origin with torn edges (grey stock: the road not taken has a torn, never a dashed, edge):
 * each torn side is walked every `pitch` u, each point bitten in by up to `amp` u (seeded, so no two tear alike).
 * `sides`: which of n, e, s, w are torn (the rest stay cut straight).
 */
export function tornShape(w: number, d: number, seed: number, sides = 'nesw', amp = 1.6, pitch = 5): Shape {
  const s = new Shape();
  const x = w / 2;
  const y = d / 2;
  const bite = (i: number): number => amp * (((Math.imul(i * 7919 + seed * 104729 + 17, 2654435761) >>> 0) % 1000) / 1000);
  const corners: [number, number][] = [
    [-x, -y],
    [x, -y],
    [x, y],
    [-x, y],
  ];
  // the sides in winding order: south (west to east), east (south to north), north (east to west), west (north to south)
  const sideKey = ['s', 'e', 'n', 'w'];
  const inward: [number, number][] = [
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 0],
  ];
  let k = 0;
  s.moveTo(corners[0][0], corners[0][1]);
  for (let e = 0; e < 4; e++) {
    const a = corners[e];
    const b = corners[(e + 1) % 4];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (sides.includes(sideKey[e])) {
      const n = Math.max(2, Math.round(len / pitch));
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const m = bite(k++);
        s.lineTo(a[0] + (b[0] - a[0]) * t + inward[e][0] * m, a[1] + (b[1] - a[1]) * t + inward[e][1] * m);
      }
    }
    s.lineTo(b[0], b[1]);
  }
  s.closePath();
  return s;
}
