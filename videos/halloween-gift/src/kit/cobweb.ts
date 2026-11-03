/**
 * Cobwebs: old, torn orb webs strung between anchor points, as threads (polylines) and as one
 * ribbon geometry that draws them as soft, thin lines.
 *
 * `orbWeb` builds a web from a hub and 3-6 anchors (points on whatever holds it): a sagging
 * frame, radials from the hub to the frame (some broken short), a few irregular rings of capture
 * thread scalloped between the radials and largely torn away, long tethers out to the nearest
 * roots, rocks or grass, and broken strands hanging down; every thread sags with its span.
 * `threadRibbons` turns threads into camera-facing ribbons, three vertices across (alpha
 * 0 | a | 0), so a thread is an anti-aliased soft line about `px` pixels wide as seen from a view
 * point, with no MSAA and no texture; its brightness varies along it and with silk's sheen (it
 * glints where it lies across the light). Draw them additive, without depth writes.
 *
 * Deterministic: all randomness from @aiv/core's hashed `rand`.
 * Generic: no film imports.
 */
import { rand } from '@aiv/core';
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';

export interface Thread {
  pts: Vector3[];
  /** peak alpha of the thread (0..1) */
  alpha: number;
}

export interface OrbWebSpec {
  seed: number;
  hub: Vector3;
  /** anchor points around the hub (3..6), roughly in one plane: the web's frame */
  anchors: Vector3[];
  radials?: number;
  /** rings of the capture thread (5..8), their spacing jittered ±40% */
  rings?: number;
  /** inner and outer radius of the rings as fractions of each radial */
  inner?: number;
  outer?: number;
  /** sag of the ring threads between radials (fraction of a segment's length) */
  sag?: number;
  /** fraction of ring segments torn away (seeded, partly in clustered holes) */
  torn?: number;
  /** fraction of radials broken short */
  broken?: number;
  /** broken strands hanging down */
  strands?: number;
  /** long anchor threads from the web's frame out to these points (roots, rocks, grass tops), sagging */
  tethers?: Vector3[];
  /** gravity direction (default −y) */
  down?: Vector3;
}

const v3 = () => new Vector3();

/** A sagging thread from a to b: `n` points, pulled by `pull` (a vector) at its middle. */
function sagged(a: Vector3, b: Vector3, pull: Vector3, n: number): Vector3[] {
  const pts: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(a.clone().lerp(b, t).addScaledVector(pull, 4 * t * (1 - t)));
  }
  return pts;
}

/**
 * The threads of an old, torn orb web: a sagging frame between the anchors, radials (some
 * broken short), a few irregular rings of capture thread (spacing jittered, a third or more of
 * their segments torn away, each segment sagging toward the hub and with gravity, the sag in
 * proportion to its span), long tethers out to whatever holds it, and broken strands hanging.
 */
export function orbWeb(spec: OrbWebSpec): Thread[] {
  const { seed, hub, anchors, radials = 11, rings = 6, inner = 0.14, outer = 0.9, sag = 0.14, torn = 0.4, broken = 0.15, strands = 3, tethers = [], down = new Vector3(0, -1, 0) } = spec;
  let k = 0;
  const r = () => rand(seed, 'web', k++);
  // the web's plane from its anchors
  const n = v3();
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i].clone().sub(hub);
    const b = anchors[(i + 1) % anchors.length].clone().sub(hub);
    n.add(a.cross(b));
  }
  n.normalize();
  const e1 = anchors[0].clone().sub(hub);
  e1.addScaledVector(n, -e1.dot(n)).normalize();
  const e2 = n.clone().cross(e1).normalize();
  const ang = (p: Vector3) => {
    const d = p.clone().sub(hub);
    return Math.atan2(d.dot(e2), d.dot(e1));
  };
  const frame = [...anchors].sort((a, b) => ang(a) - ang(b));
  const threads: Thread[] = [];
  const gravity = down.clone().normalize();
  // frame threads, sagging in proportion to their span
  for (let i = 0; i < frame.length; i++) {
    const a = frame[i];
    const b = frame[(i + 1) % frame.length];
    threads.push({ pts: sagged(a, b, gravity.clone().multiplyScalar(a.distanceTo(b) * (0.05 + 0.05 * r())), 10), alpha: 0.34 });
  }
  // radials: from the hub to where their ray meets the frame polygon (in the plane)
  const ends: Vector3[] = [];
  const to2 = (p: Vector3) => {
    const d = p.clone().sub(hub);
    return [d.dot(e1), d.dot(e2)];
  };
  for (let i = 0; i < radials; i++) {
    const th = ((i + (r() - 0.5) * 0.7) / radials) * Math.PI * 2;
    const dx = Math.cos(th);
    const dy = Math.sin(th);
    let best: Vector3 | null = null;
    let bestT = Infinity;
    for (let j = 0; j < frame.length; j++) {
      const A = frame[j];
      const B = frame[(j + 1) % frame.length];
      const [ax, ay] = to2(A);
      const [bx, by] = to2(B);
      const ex = bx - ax;
      const ey = by - ay;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = (ax * ey - ay * ex) / den;
      const u = (ax * dy - ay * dx) / den;
      if (t > 0 && u >= 0 && u <= 1 && t < bestT) {
        bestT = t;
        best = A.clone().lerp(B, u);
      }
    }
    if (best) ends.push(best);
  }
  // a radial is broken short now and then (it then hangs from its stub)
  const reach = ends.map(() => (r() < broken ? 0.35 + 0.4 * r() : 1));
  ends.forEach((e, i) => {
    const end = hub.clone().lerp(e, reach[i]);
    threads.push({ pts: sagged(hub, end, gravity.clone().multiplyScalar(hub.distanceTo(end) * (0.02 + 0.04 * r())), 8), alpha: 0.42 });
    if (reach[i] < 1) {
      const len = hub.distanceTo(e) * (1 - reach[i]) * (0.4 + 0.4 * r());
      const side = e1.clone().multiplyScalar((r() - 0.5) * len * 0.5);
      threads.push({ pts: sagged(end, end.clone().addScaledVector(gravity, len).add(side), side.clone().multiplyScalar(-0.6), 6), alpha: 0.3 });
    }
  });
  // the rings: a few, irregularly spaced, segments sagging between the radials, many torn
  const N = ends.length;
  if (N >= 3) {
    const step = (outer - inner) / Math.max(1, rings - 1);
    const fr = Array.from({ length: rings }, (_, j) => inner + step * j + (j > 0 && j < rings - 1 ? (r() - 0.5) * 0.8 * step : 0));
    const holeA = r() * Math.PI * 2;
    for (let j = 0; j < rings; j++) {
      let run: Vector3[] = [];
      const flush = () => {
        if (run.length > 1) threads.push({ pts: run, alpha: 0.5 });
        run = [];
      };
      const jit = ends.map(() => 1 + (r() - 0.5) * 0.18);
      for (let i = 0; i < N; i++) {
        const i2 = (i + 1) % N;
        const f0 = fr[j] * jit[i];
        const f1 = fr[j] * jit[i2];
        // only where both radials reach
        if (f0 > reach[i] || f1 > reach[i2]) {
          flush();
          continue;
        }
        const th = (i / N) * Math.PI * 2;
        const hole = Math.max(0, Math.cos(th - holeA)) * smoothstepN(0.3, 0.7, fr[j]);
        if (r() < torn * (0.55 + 1.2 * hole)) {
          flush();
          continue;
        }
        const a = hub.clone().lerp(ends[i], f0);
        const b = hub.clone().lerp(ends[i2], f1);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const len = a.distanceTo(b);
        const s = sag * (0.6 + 0.8 * r());
        const pull = hub.clone().sub(mid).normalize().multiplyScalar(len * s).addScaledVector(gravity, len * s * 0.9);
        const seg = sagged(a, b, pull, 5);
        if (run.length) seg.shift();
        run.push(...seg);
      }
      flush();
    }
  }
  // long tethers from the frame out to what holds it
  for (const t of tethers) {
    let near = frame[0];
    for (const a of frame) if (a.distanceTo(t) < near.distanceTo(t)) near = a;
    const start = near.clone().lerp(hub, 0.08 * r());
    threads.push({ pts: sagged(start, t, gravity.clone().multiplyScalar(start.distanceTo(t) * (0.06 + 0.06 * r())), 14), alpha: 0.32 });
  }
  // broken strands hanging down from the web
  for (let s = 0; s < strands && ends.length; s++) {
    const e = ends[Math.floor(r() * ends.length)];
    const start = hub.clone().lerp(e, 0.4 + 0.55 * r());
    const len = 0.05 + 0.16 * r();
    const side = e1.clone().multiplyScalar((r() - 0.5) * len * 0.6);
    const end = start.clone().addScaledVector(gravity, len).add(side);
    threads.push({ pts: sagged(start, end, side.clone().multiplyScalar(-0.5), 6), alpha: 0.38 });
  }
  return threads;
}

function smoothstepN(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export interface RibbonOptions {
  /** the point the ribbons face (the camera they are drawn for) */
  eye: Vector3;
  /** line width in pixels at that eye, for a vertical field of view `fov` (degrees) and `height` pixels */
  px?: number;
  fov?: number;
  height?: number;
  /** clamp of the half width (world units) */
  minHalf?: number;
  maxHalf?: number;
  /** brightness variation along a thread (0 none .. 1 strong) */
  glint?: number;
  /** silk's sheen: threads lying across the light's half vector glint, the others fade (0 none .. 1) */
  sheen?: number;
  /** unit direction toward the light the sheen is from */
  light?: Vector3;
  seed?: number;
}

/** Threads as soft ribbons facing `eye`: position, normal, color (rgba: alpha 0 | a | 0 across). */
export function threadRibbons(threads: Thread[], o: RibbonOptions): BufferGeometry {
  const { eye, px = 2.6, fov = 44, height = 1080, minHalf = 0.0012, maxHalf = 0.009, glint = 0.6, sheen = 0, light = new Vector3(0, 1, 0), seed = 1 } = o;
  const pxAngle = (2 * Math.tan(((fov / 2) * Math.PI) / 180)) / height;
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const t = v3();
  const view = v3();
  const w = v3();
  const h = v3();
  threads.forEach((th, ti) => {
    const pts = th.pts;
    if (pts.length < 2) return;
    const base = pos.length / 3;
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      t.copy(pts[Math.min(pts.length - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
      view.copy(eye).sub(p);
      const dist = view.length();
      view.normalize();
      w.crossVectors(t, view).normalize();
      const half = Math.min(maxHalf, Math.max(minHalf, px * 0.5 * pxAngle * dist * 1.5));
      if (i > 0) acc += p.distanceTo(pts[i - 1]);
      // the thread catches the light in places along its length
      const g = 1 - glint + glint * (0.5 + 0.5 * Math.sin(acc * 37 + rand(seed, ti, 0) * 6.283) * Math.sin(acc * 13 + rand(seed, ti, 1) * 6.283) + 0.35 * rand(seed, ti, i + 2));
      // a fibre's highlight (Kajiya-Kay): strongest where the thread lies across the half vector
      h.copy(light).add(view).normalize();
      const kk = Math.sqrt(Math.max(0, 1 - t.dot(h) ** 2)) ** 24;
      const sh = 1 - sheen + sheen * (0.3 + 1.6 * kk);
      const a = Math.max(0, Math.min(1, th.alpha * g * sh));
      for (const s of [-1, 0, 1]) {
        pos.push(p.x + w.x * half * s, p.y + w.y * half * s, p.z + w.z * half * s);
        nor.push(view.x, view.y, view.z);
        col.push(1, 1, 1, s === 0 ? a : 0);
      }
      if (i > 0) {
        const a0 = base + (i - 1) * 3;
        const a1 = base + i * 3;
        idx.push(a0, a0 + 1, a1, a0 + 1, a1 + 1, a1, a0 + 1, a0 + 2, a1 + 1, a0 + 2, a1 + 2, a1 + 1);
      }
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 4));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
