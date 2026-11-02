/**
 * Cut-paper silhouettes, drawn once into canvases with a seeded sequence: Rackham-like
 * twisted trees whose twigs end in curls, a crooked spear fence, a castle on a floating rock,
 * rolling hills, tombstones. Shapes lean (nothing stands vertical) and curl, in the spirit of
 * gothic storybook illustration; none copies a film's design.
 *
 * Canvas units: pixels, origin top-left; a card's ground line is the canvas bottom.
 */
import { seq, type Seq } from './paper.ts';

export const INK = '#0b1017';

/** A tapering limb that curls at its tip, drawn as round-capped segments; returns its points. */
function limb(g: CanvasRenderingContext2D, r: Seq, x: number, y: number, a: number, len: number, w: number, curl: number, depth: number, opts: { minW: number; spawn: number }) {
  const steps = Math.max(8, Math.round(len / 6));
  let px = x;
  let py = y;
  let ang = a;
  const seg = len / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    // the curl tightens toward the tip: a hand-drawn spiral ending
    ang += curl * (0.004 + 0.09 * t * t * t) + (r() - 0.5) * 0.09;
    const nx = px + Math.cos(ang) * seg;
    const ny = py + Math.sin(ang) * seg;
    g.lineWidth = Math.max(opts.minW, w * (1 - 0.85 * t));
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(nx, ny);
    g.stroke();
    // side branches
    if (depth > 0 && i > steps * 0.25 && i < steps * 0.9 && r() < opts.spawn) {
      const side = r() < 0.5 ? -1 : 1;
      limb(g, r, nx, ny, ang + side * (0.45 + r() * 0.6), len * (0.35 + r() * 0.3), Math.max(opts.minW, w * (1 - 0.85 * t) * 0.62), side * (0.6 + r() * 1.2), depth - 1, opts);
    }
    px = nx;
    py = ny;
  }
}

/** A gnarled dead tree, rooted at the canvas bottom centre. */
export function drawTree(g: CanvasRenderingContext2D, w: number, h: number, seed: number, o: { lean?: number; eyes?: boolean } = {}) {
  const r = seq(seed, 'tree');
  g.fillStyle = INK;
  g.strokeStyle = INK;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const base = w * 0.5;
  const trunkW = w * 0.11;
  // flared roots
  g.beginPath();
  g.moveTo(base - trunkW * 2.2, h);
  g.quadraticCurveTo(base - trunkW * 0.6, h - trunkW * 0.5, base - trunkW * 0.5, h - trunkW * 2);
  g.lineTo(base + trunkW * 0.5, h - trunkW * 2);
  g.quadraticCurveTo(base + trunkW * 0.7, h - trunkW * 0.4, base + trunkW * 2.4, h);
  g.closePath();
  g.fill();
  // the trunk: an S-curve leaning, splitting into crooked limbs
  const lean = o.lean ?? (r() - 0.5) * 0.5;
  limb(g, r, base, h - trunkW, -Math.PI / 2 + lean, h * 0.62, trunkW, (r() - 0.5) * 1.6, 3, { minW: w * 0.004, spawn: 0.16 });
  // two big limbs from the crown
  const cy = h * 0.42;
  const cx = base + Math.cos(-Math.PI / 2 + lean) * h * 0.2;
  limb(g, r, cx, cy, -Math.PI / 2 - 0.9, h * 0.45, trunkW * 0.55, -1.6, 3, { minW: w * 0.004, spawn: 0.2 });
  limb(g, r, cx, cy, -Math.PI / 2 + 0.8, h * 0.45, trunkW * 0.5, 1.4, 3, { minW: w * 0.004, spawn: 0.2 });
  if (o.eyes) {
    // a knot that reads as two sleepy eyes (pareidolia): cut out of the trunk
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const ey = h * 0.66;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(base + s * trunkW * 0.28 + lean * h * 0.05, ey, trunkW * 0.13, trunkW * 0.07, s * 0.3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

/** A crooked iron fence with spear finials and curls, along the canvas width. */
export function drawFence(g: CanvasRenderingContext2D, w: number, h: number, seed: number, o: { gap?: number } = {}) {
  const r = seq(seed, 'fence');
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineCap = 'round';
  const gap = o.gap ?? h * 0.16;
  const barW = Math.max(3, h * 0.025);
  const rail = (y: number) => {
    g.lineWidth = barW * 0.9;
    g.beginPath();
    g.moveTo(0, y + (r() - 0.5) * 6);
    for (let x = 0; x <= w; x += gap) g.lineTo(x, y + (r() - 0.5) * 8);
    g.stroke();
  };
  for (let x = gap * 0.5; x < w; x += gap) {
    const lean = (r() - 0.5) * 0.18;
    const top = h * (0.06 + r() * 0.1);
    const tx = x + Math.sin(lean) * h;
    g.lineWidth = barW;
    g.beginPath();
    g.moveTo(x, h);
    g.lineTo(tx, top + barW * 3);
    g.stroke();
    // spear finial
    g.beginPath();
    g.moveTo(tx, top - barW * 2.5);
    g.lineTo(tx - barW * 1.6, top + barW * 2.2);
    g.lineTo(tx + barW * 1.6, top + barW * 2.2);
    g.closePath();
    g.fill();
  }
  rail(h * 0.3);
  rail(h * 0.85);
  // curls between the bars under the top rail
  g.lineWidth = barW * 0.6;
  for (let x = gap; x < w - gap * 0.5; x += gap * 2) {
    const cx = x;
    const cy = h * 0.42;
    g.beginPath();
    for (let t = 0; t < 4.5 * Math.PI; t += 0.2) {
      const rad = gap * 0.32 * (1 - t / (5 * Math.PI));
      const px = cx + Math.cos(t) * rad;
      const py = cy + Math.sin(t) * rad;
      if (t === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
  }
}

/** Rolling hills with curling crests, filled to the bottom. */
export function drawHills(g: CanvasRenderingContext2D, w: number, h: number, seed: number, color: string) {
  const r = seq(seed, 'hills');
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, h);
  const n = 5;
  let y0 = h * (0.35 + r() * 0.3);
  g.lineTo(0, y0);
  for (let i = 0; i < n; i++) {
    const x0 = (i / n) * w;
    const x1 = ((i + 1) / n) * w;
    const y1 = h * (0.25 + r() * 0.45);
    const lift = h * (0.08 + r() * 0.3);
    g.bezierCurveTo(x0 + (x1 - x0) * (0.2 + r() * 0.3), y0 - lift, x0 + (x1 - x0) * (0.55 + r() * 0.3), y1 - lift * (0.3 + r() * 0.6), x1, y1);
    y0 = y1;
  }
  g.lineTo(w, h);
  g.closePath();
  g.fill();
}

/**
 * A castle on a floating rock: an upturned, jagged crag with roots and vines hanging below, and
 * on top a crooked keep with witch-hat roofs, a battlemented wall and needle spires, every tower
 * leaning a little. Windows go to the second (emissive) canvas.
 */
export function drawCastle(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, w: number, h: number, seed: number, color: string, windowColor: string) {
  const r = seq(seed, 'castle');
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineCap = 'round';
  const rockTop = h * 0.6;
  // the crag: a jagged upturned cone, flat on top
  g.beginPath();
  g.moveTo(w * 0.08, rockTop);
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = w * (0.08 + 0.84 * t);
    const depth = Math.sin(t * Math.PI) ** 1.4 * h * 0.3;
    g.lineTo(x + (r() - 0.5) * w * 0.02, rockTop + depth * (0.75 + r() * 0.35));
  }
  g.lineTo(w * 0.92, rockTop);
  g.closePath();
  g.fill();
  // roots and vines dangling from the crag
  for (let i = 0; i < 16; i++) {
    const x = w * (0.2 + r() * 0.6);
    const y0 = rockTop + Math.sin(((x / w - 0.08) / 0.84) * Math.PI) ** 1.4 * h * 0.22;
    const len = h * (0.04 + r() * 0.1);
    g.lineWidth = 1.5 + r() * 3;
    g.beginPath();
    g.moveTo(x, y0);
    g.bezierCurveTo(x + (r() - 0.5) * 20, y0 + len * 0.4, x + (r() - 0.5) * 30, y0 + len * 0.7, x + (r() - 0.5) * 24, y0 + len);
    g.stroke();
  }
  // the wall with battlements
  const wallH = h * 0.07;
  g.fillRect(w * 0.16, rockTop - wallH, w * 0.68, wallH + 2);
  for (let x = w * 0.16; x < w * 0.84; x += w * 0.03) g.fillRect(x, rockTop - wallH - h * 0.015, w * 0.016, h * 0.016);
  // towers: varied heights, each leaning a little, with witch-hat roofs or needle spires
  const towers = [0.2, 0.31, 0.43, 0.52, 0.63, 0.75, 0.82];
  towers.forEach((tx, i) => {
    const cx = w * (tx + (r() - 0.5) * 0.02);
    const tw = w * (0.045 + r() * 0.035) * (i === 3 ? 1.5 : 1);
    const th = h * (0.12 + r() * 0.16) * (i === 3 ? 1.9 : i === 2 || i === 4 ? 1.3 : 1);
    const lean = (r() - 0.5) * 0.14;
    g.save();
    g.translate(cx, rockTop - wallH * 0.5);
    g.rotate(lean);
    g.fillRect(-tw / 2, -th, tw, th + 2);
    const roofH = h * (0.07 + r() * 0.08) * (i === 3 ? 1.4 : 1);
    const bend = (r() - 0.5) * tw * 1.2;
    g.beginPath();
    g.moveTo(-tw * 0.75, -th);
    g.quadraticCurveTo(-tw * 0.2, -th - roofH * 0.5, bend, -th - roofH);
    g.quadraticCurveTo(tw * 0.2, -th - roofH * 0.45, tw * 0.75, -th);
    g.closePath();
    g.fill();
    g.restore();
    // windows: tall slits, some lit
    e.save();
    e.translate(cx, rockTop - wallH * 0.5);
    e.rotate(lean);
    e.fillStyle = windowColor;
    for (let k = 0; k < 4; k++) {
      if (r() < 0.5) continue;
      const wy = -th * (0.25 + 0.2 * k);
      if (-wy > th * 0.9) continue;
      e.fillRect(-tw * 0.11, wy, tw * 0.22, th * 0.08);
    }
    e.restore();
  });
}

/** A page's printed ground: dark earth, grass tufts, pebbles and a winding path, inside a cream margin. */
export function drawGround(g: CanvasRenderingContext2D, w: number, h: number, seed: number, path: [number, number][], o: { earth?: string; pathColor?: string; margin?: number } = {}) {
  const r = seq(seed, 'ground');
  const m = o.margin ?? Math.round(w * 0.012);
  g.fillStyle = '#cfc3a6';
  g.fillRect(0, 0, w, h);
  g.fillStyle = o.earth ?? '#18241f';
  g.fillRect(m, m, w - 2 * m, h - 2 * m);
  // mottling: soft blotches, darker and greener
  for (let i = 0; i < 260; i++) {
    const x = m + r() * (w - 2 * m);
    const y = m + r() * (h - 2 * m);
    const rad = 20 + r() * 90;
    g.fillStyle = r() < 0.5 ? 'rgba(8,14,12,0.18)' : 'rgba(40,62,52,0.14)';
    g.beginPath();
    g.ellipse(x, y, rad, rad * 0.6, r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // the path: a ragged band through the given points (fractions of the page)
  const pts = path.map(([x, y]) => [m + x * (w - 2 * m), m + y * (h - 2 * m)] as const);
  const band = (width: number, color: string) => {
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    g.lineTo(last[0], last[1]);
    g.stroke();
  };
  band(h * 0.2, 'rgba(70,62,54,0.9)');
  band(h * 0.13, o.pathColor ?? '#7a6b5a');
  band(h * 0.05, 'rgba(160,145,122,0.45)');
  // pebbles on the path and tufts of grass off it
  for (let i = 0; i < 500; i++) {
    const x = m + r() * (w - 2 * m);
    const y = m + r() * (h - 2 * m);
    const k = r();
    if (k < 0.45) {
      g.fillStyle = 'rgba(120,110,95,0.35)';
      g.beginPath();
      g.ellipse(x, y, 2 + r() * 4, 1.5 + r() * 3, r() * 3, 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = r() < 0.5 ? 'rgba(30,58,50,0.8)' : 'rgba(12,22,18,0.9)';
      g.lineWidth = 2;
      for (let b = 0; b < 4; b++) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 18, y - 6 - r() * 16);
        g.stroke();
      }
    }
  }
}

/** A gravestone shape (round top, cross or obelisk) leaning, with an optional engraved word. */
export function drawStone(g: CanvasRenderingContext2D, w: number, h: number, kind: 'round' | 'cross' | 'obelisk', color: string, word?: string, font?: string) {
  g.fillStyle = color;
  if (kind === 'round') {
    g.beginPath();
    g.moveTo(w * 0.1, h);
    g.lineTo(w * 0.1, h * 0.4);
    g.arc(w * 0.5, h * 0.4, w * 0.4, Math.PI, 0);
    g.lineTo(w * 0.9, h);
    g.closePath();
    g.fill();
  } else if (kind === 'cross') {
    g.fillRect(w * 0.38, h * 0.05, w * 0.24, h * 0.95);
    g.fillRect(w * 0.12, h * 0.25, w * 0.76, h * 0.18);
  } else {
    g.beginPath();
    g.moveTo(w * 0.25, h);
    g.lineTo(w * 0.32, h * 0.15);
    g.lineTo(w * 0.5, 0);
    g.lineTo(w * 0.68, h * 0.15);
    g.lineTo(w * 0.75, h);
    g.closePath();
    g.fill();
  }
  if (word && font) {
    g.fillStyle = 'rgba(10,14,20,0.75)';
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(word, w * 0.5, h * 0.55);
  }
}

/** One leaf of a crooked wrought-iron gate: a frame, bars with spear tips, two big scrolls. */
export function drawGate(g: CanvasRenderingContext2D, w: number, h: number, seed: number, mirror = false) {
  const r = seq(seed, 'gate');
  g.save();
  if (mirror) {
    g.translate(w, 0);
    g.scale(-1, 1);
  }
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineCap = 'round';
  const bw = Math.max(4, w * 0.035);
  g.lineWidth = bw * 1.3;
  // the frame: the hinge stile on the left, a sagging top rail that rises to a point
  g.beginPath();
  g.moveTo(bw, h);
  g.lineTo(bw, h * 0.18);
  g.quadraticCurveTo(w * 0.5, h * 0.05, w - bw, h * 0.22 + (r() - 0.5) * 10);
  g.lineTo(w - bw * 1.2, h);
  g.stroke();
  g.lineWidth = bw;
  for (const y of [0.45, 0.92]) {
    g.beginPath();
    g.moveTo(bw, h * y);
    g.lineTo(w - bw, h * (y + (r() - 0.5) * 0.02));
    g.stroke();
  }
  // bars with spear tips, each slightly crooked
  const n = 6;
  for (let i = 1; i < n; i++) {
    const x = (i / n) * w;
    const top = h * (0.16 - 0.06 * Math.sin((i / n) * Math.PI)) - h * 0.04;
    g.beginPath();
    g.moveTo(x + (r() - 0.5) * 6, h);
    g.lineTo(x + (r() - 0.5) * 10, top + bw * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(x, top - bw * 2);
    g.lineTo(x - bw * 1.3, top + bw * 2);
    g.lineTo(x + bw * 1.3, top + bw * 2);
    g.closePath();
    g.fill();
  }
  // two scrolls between the rails
  g.lineWidth = bw * 0.75;
  for (const [cx, cy, s] of [
    [w * 0.33, h * 0.62, 1],
    [w * 0.66, h * 0.7, -1],
  ] as const) {
    g.beginPath();
    for (let t = 0; t < 5 * Math.PI; t += 0.15) {
      const rad = w * 0.13 * (1 - t / (5.4 * Math.PI));
      const px = cx + Math.cos(t * s) * rad;
      const py = cy + Math.sin(t * s) * rad;
      if (t === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
  }
  g.restore();
}

/** The last house seen from the lane: an hourglass-shaped gothic house, its roofs curling, windows glowing. */
export function drawFarHouse(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = seq(seed, 'farhouse');
  g.fillStyle = '#122633';
  // the hourglass body: wide at the base and the eaves, pinched in the middle
  g.beginPath();
  g.moveTo(w * 0.18, h);
  g.bezierCurveTo(w * 0.3, h * 0.75, w * 0.32, h * 0.55, w * 0.2, h * 0.38);
  g.lineTo(w * 0.82, h * 0.36);
  g.bezierCurveTo(w * 0.7, h * 0.55, w * 0.72, h * 0.75, w * 0.84, h);
  g.closePath();
  g.fill();
  // a steep roof leaning left with a curled finial, and a little side tower
  g.fillStyle = '#0b141b';
  g.beginPath();
  g.moveTo(w * 0.12, h * 0.4);
  g.lineTo(w * 0.42, h * 0.06);
  g.quadraticCurveTo(w * 0.47, h * 0.0, w * 0.52, h * 0.04);
  g.lineTo(w * 0.9, h * 0.38);
  g.closePath();
  g.fill();
  g.fillRect(w * 0.7, h * 0.12, w * 0.1, h * 0.28);
  g.beginPath();
  g.moveTo(w * 0.66, h * 0.14);
  g.lineTo(w * 0.76, h * -0.02);
  g.lineTo(w * 0.84, h * 0.14);
  g.closePath();
  g.fill();
  // windows, glowing cyan; the door dark
  const win = (x: number, y: number, ww: number, hh: number) => {
    for (const [ctx, fill] of [
      [g, '#0a1820'],
      [e, '#57CEE2'],
    ] as const) {
      ctx.fillStyle = fill;
      ctx.fillRect(x - ww / 2, y, ww, hh);
    }
  };
  win(w * 0.36, h * 0.46, w * 0.08, h * 0.12);
  win(w * 0.64, h * 0.46, w * 0.08, h * 0.12);
  win(w * 0.47, h * 0.18, w * 0.06, h * 0.08);
  win(w * 0.75, h * 0.2, w * 0.04, h * 0.07);
  g.fillStyle = '#05090c';
  g.fillRect(w * 0.45, h * 0.74, w * 0.1, h * 0.26);
  // two red lanterns, tiny, either side of the door (pigment only)
  g.fillStyle = '#6e2028';
  for (const x of [0.4, 0.6]) {
    g.beginPath();
    g.ellipse(w * x, h * 0.72, w * 0.018, h * 0.018, 0, 0, Math.PI * 2);
    g.fill();
  }
  void r;
}

/** A witch on a broom, in silhouette, riding left to right. */
export function drawWitch(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = INK;
  g.strokeStyle = INK;
  g.lineCap = 'round';
  // broom
  g.lineWidth = h * 0.04;
  g.beginPath();
  g.moveTo(w * 0.05, h * 0.72);
  g.lineTo(w * 0.85, h * 0.6);
  g.stroke();
  g.beginPath();
  g.moveTo(w * 0.05, h * 0.72);
  g.lineTo(w * 0.0, h * 0.58);
  g.lineTo(w * 0.0, h * 0.9);
  g.closePath();
  g.fill();
  // body and cloak
  g.beginPath();
  g.moveTo(w * 0.35, h * 0.68);
  g.quadraticCurveTo(w * 0.42, h * 0.35, w * 0.5, h * 0.33);
  g.quadraticCurveTo(w * 0.58, h * 0.4, w * 0.6, h * 0.66);
  g.lineTo(w * 0.2, h * 0.75);
  g.closePath();
  g.fill();
  // head and hat
  g.beginPath();
  g.arc(w * 0.53, h * 0.3, h * 0.07, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(w * 0.44, h * 0.27);
  g.lineTo(w * 0.62, h * 0.24);
  g.lineTo(w * 0.47, h * 0.0);
  g.closePath();
  g.fill();
}
