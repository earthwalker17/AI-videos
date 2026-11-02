/**
 * The last house, drawn as cut paper: a leaning weatherboard front with a pointed porch roof,
 * a door opening cut clean through (the room shows behind it), tall arched windows that glow
 * cyan (on the emissive canvas), a cobweb in the door frame's corner. And the room behind the
 * door: a desk, a laptop's teal glow, shelves, a mug, a plant: an ordinary home.
 */
import { seq } from './paper.ts';

export interface FacadeLayout {
  /** door opening in canvas fractions: centre x, bottom y (1 = ground), width, height */
  door: { cx: number; w: number; h: number };
}

export function drawFacade(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, w: number, h: number, seed: number, layout: FacadeLayout) {
  const r = seq(seed, 'facade');
  const dx = layout.door.cx * w;
  const dw = layout.door.w * w;
  const dh = layout.door.h * h;
  // the wall: boards, leaning a little to the right as it rises
  g.save();
  g.fillStyle = '#1c3846';
  g.beginPath();
  g.moveTo(0, h);
  g.lineTo(w * 0.02, h * 0.2);
  g.lineTo(w * 0.98, h * 0.17);
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  g.clip();
  for (let y = h * 0.2; y < h; y += h * 0.035) {
    g.strokeStyle = `rgba(6,16,22,${0.35 + r() * 0.25})`;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, y + (r() - 0.5) * 4);
    g.lineTo(w, y + (r() - 0.5) * 8);
    g.stroke();
  }
  g.restore();
  // the porch roof: a pointed overhang over the door, with a curl at the peak
  g.fillStyle = '#120d16';
  g.beginPath();
  const ry = h - dh - h * 0.12;
  g.moveTo(dx - dw * 1.25, ry + h * 0.08);
  g.lineTo(dx + dw * 0.05, ry - h * 0.14);
  g.quadraticCurveTo(dx + dw * 0.35, ry - h * 0.22, dx + dw * 0.4, ry - h * 0.17);
  g.lineTo(dx + dw * 0.2, ry - h * 0.12);
  g.lineTo(dx + dw * 1.25, ry + h * 0.08);
  g.closePath();
  g.fill();
  // the door frame (trim) and the opening itself, cut through
  g.fillStyle = '#100b12';
  g.fillRect(dx - dw / 2 - dw * 0.09, h - dh - dw * 0.09, dw + dw * 0.18, dh + dw * 0.09);
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.fillRect(dx - dw / 2, h - dh, dw, dh);
  g.restore();
  // a cobweb in the frame's top-left corner
  g.strokeStyle = 'rgba(210,225,220,0.55)';
  g.lineWidth = 1.5;
  const cx = dx - dw / 2;
  const cy = h - dh;
  const R = dw * 0.32;
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 2) * (k / 5);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    g.stroke();
  }
  for (let ring = 1; ring <= 4; ring++) {
    g.beginPath();
    for (let k = 0; k <= 5; k++) {
      const a = (Math.PI / 2) * (k / 5);
      const rr = (R * ring) / 4.4 + (r() - 0.5) * 3;
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (k === 0) g.moveTo(px, py);
      else g.quadraticCurveTo(cx + Math.cos(a - 0.15) * rr * 0.86, cy + Math.sin(a - 0.15) * rr * 0.86, px, py);
    }
    g.stroke();
  }
  // tall arched windows, glowing cyan (the room's screen light)
  for (const side of [-1, 1]) {
    const wx = dx + side * dw * 1.9;
    const wy = h - dh * 0.98;
    const ww = dw * 0.55;
    const wh = dh * 0.62;
    for (const [ctx, fill] of [
      [g, '#0a1820'],
      [e, '#57CEE2'],
    ] as const) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(wx - ww / 2, wy + wh);
      ctx.lineTo(wx - ww / 2, wy + ww / 2);
      ctx.arc(wx, wy + ww / 2, ww / 2, Math.PI, 0);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.closePath();
      ctx.fill();
    }
    // mullions, on both canvases so they stay dark
    for (const ctx of [g, e]) {
      ctx.fillStyle = '#0a0f14';
      ctx.fillRect(wx - 3, wy, 6, wh);
      ctx.fillRect(wx - ww / 2, wy + wh * 0.55, ww, 6);
    }
  }
}

/** The door: dark plum planks with iron straps (the 福 is a separate paper square). */
export function drawDoor(g: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = seq(seed, 'door');
  g.fillStyle = '#3a2232';
  g.fillRect(0, 0, w, h);
  const planks = 5;
  for (let i = 1; i < planks; i++) {
    g.fillStyle = 'rgba(15,6,12,0.6)';
    g.fillRect((i * w) / planks - 2, 0, 4, h);
  }
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(20,8,16,${0.2 + r() * 0.2})`;
    g.lineWidth = 1 + r() * 2;
    const x = r() * w;
    g.beginPath();
    g.moveTo(x, r() * h);
    g.lineTo(x + (r() - 0.5) * 6, r() * h);
    g.stroke();
  }
  g.fillStyle = '#16121a';
  for (const y of [0.18, 0.8]) g.fillRect(0, y * h, w * 0.8, h * 0.035);
  // a ring knocker
  g.strokeStyle = '#1e1a20';
  g.lineWidth = w * 0.025;
  g.beginPath();
  g.arc(w * 0.82, h * 0.5, w * 0.06, 0, Math.PI * 2);
  g.stroke();
}

/** The room behind the door: an ordinary home at night, lit by a laptop. */
export function drawRoom(g: CanvasRenderingContext2D, e: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#0d1a22';
  g.fillRect(0, 0, w, h);
  // floor
  g.fillStyle = '#1a1416';
  g.fillRect(0, h * 0.72, w, h * 0.28);
  // a bookshelf on the left
  g.fillStyle = '#1b1418';
  g.fillRect(w * 0.04, h * 0.18, w * 0.22, h * 0.56);
  const spines = ['#3b5868', '#5a3a3a', '#46523a', '#6b5a3a', '#3a3a5a'];
  for (let s = 0; s < 3; s++) {
    for (let k = 0; k < 7; k++) {
      g.fillStyle = spines[(k + s) % spines.length];
      g.fillRect(w * (0.06 + k * 0.027), h * (0.24 + s * 0.17), w * 0.02, h * 0.12);
    }
  }
  // a desk with a laptop (the screen glows teal) and a mug and a small plant
  g.fillStyle = '#231a1c';
  g.fillRect(w * 0.42, h * 0.55, w * 0.5, h * 0.05);
  g.fillRect(w * 0.45, h * 0.6, w * 0.03, h * 0.14);
  g.fillRect(w * 0.86, h * 0.6, w * 0.03, h * 0.14);
  for (const [ctx, fill] of [
    [g, '#0f2a30'],
    [e, '#57CEE2'],
  ] as const) {
    ctx.fillStyle = fill;
    ctx.fillRect(w * 0.55, h * 0.36, w * 0.22, h * 0.18);
  }
  g.fillStyle = '#121216';
  g.fillRect(w * 0.53, h * 0.54, w * 0.26, h * 0.012);
  g.fillStyle = '#c9c2b0';
  g.fillRect(w * 0.82, h * 0.5, w * 0.03, h * 0.05);
  g.fillStyle = '#2f4a30';
  g.beginPath();
  g.ellipse(w * 0.47, h * 0.5, w * 0.03, h * 0.05, 0, 0, Math.PI * 2);
  g.fill();
}
