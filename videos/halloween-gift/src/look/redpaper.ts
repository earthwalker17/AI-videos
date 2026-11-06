/**
 * The red papers on the last house's door (the approved Chinese text, never changed): the upright
 * 福 in a diamond, the spring couplets (上联 '代码千行一次过' on the left, 下联 '账号百年永不封' on
 * the right, one character per row, top to bottom) and the 横批 '一路绿灯' above the door, left to
 * right. Gold ink (#E8C66A) on red paper (#B5332B) with gold flecks, as V1's door set drew them
 * (V1's door set), now as weathered paper glued on: mottled dye, a printed gold border, water
 * stains, a torn corner (cut out of the alpha, with the paper's pale core along the tear), and a
 * wrinkle height map (glue ridges, creases) for a bump. Canvases are drawn once from a seed, once
 * the fonts are in (the stage mounts only when they are `ready`), on CPU canvases (the kit's
 * textCanvas): every canvas here gets the ink, and text on a GPU canvas rasters differently from
 * render to render.
 */
import { fillTextChecked, textCanvas } from '@aiv/remotion-kit';
import { useLayoutEffect, useMemo } from 'react';
import { CanvasTexture, LinearSRGBColorSpace, SRGBColorSpace } from 'three';
import { seq, type Seq } from './paper.ts';

export type RedPaperKind = 'fu' | 'upper' | 'lower' | 'horizontal';

/** The approved text (never change, add or translate a character). */
export const RED_PAPER_TEXT: Record<RedPaperKind, string> = {
  fu: '福',
  upper: '代码千行一次过',
  lower: '账号百年永不封',
  horizontal: '一路绿灯',
};

export const PAPER_RED = '#B5332B';
export const GOLD_INK = '#E8C66A';

/** Canvas size per kind (pixels): the 福 square, the tall couplets, the wide 横批. */
export function paperSize(kind: RedPaperKind): [number, number] {
  return kind === 'fu' ? [512, 512] : kind === 'horizontal' ? [880, 220] : [220, 1540];
}

/** the torn corner per kind: which corner (0 TL, 1 TR, 2 BR, 3 BL) and how big (fraction of the short side) */
const TEAR: Record<RedPaperKind, [number, number]> = { fu: [1, 0.2], upper: [2, 0.5], lower: [3, 0.36], horizontal: [0, 0.36] };

function tornCorner(r: Seq, W: number, H: number, corner: number, size: number): [number, number][] {
  const s = Math.min(W, H) * size;
  const cx = corner === 1 || corner === 2 ? W : 0;
  const cy = corner === 2 || corner === 3 ? H : 0;
  const ax = cx === 0 ? 1 : -1;
  const ay = cy === 0 ? 1 : -1;
  // a ragged line from one edge to the other, cutting the corner off
  const pts: [number, number][] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const jag = (r() - 0.5) * s * 0.16 + Math.sin(t * 9 + r()) * s * 0.04;
    const x = cx + ax * (s * (1 - t) * (0.85 + 0.3 * r()) + jag * 0.5);
    const y = cy + ay * (s * t * (0.85 + 0.3 * r()) + jag * 0.5);
    pts.push([x, y]);
  }
  return pts;
}

/**
 * Draw one paper: its colour (with alpha: the tear), its height (wrinkles, ink, glue) and its ink
 * alone (white on black: an emissive mask, so the gold leaf can catch the lanterns' light).
 */
export function drawRedPaper(kind: RedPaperKind, cjk: string, seed = 7): { color: HTMLCanvasElement; height: HTMLCanvasElement; ink: HTMLCanvasElement } {
  const [W, H] = paperSize(kind);
  const r = seq(seed, `redpaper-${kind}`);
  const a = textCanvas(W, H);
  const g = a.g;
  // the dyed paper: red, mottled a little darker and lighter
  g.fillStyle = PAPER_RED;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = (0.15 + 0.35 * r()) * Math.min(W, H) * (kind === 'fu' ? 0.6 : 1.2);
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.6;
    grd.addColorStop(0, dark ? 'rgba(70,10,14,0.16)' : 'rgba(225,95,70,0.12)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  }
  // paper fibre: short faint streaks
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = r() < 0.5 ? 'rgba(60,8,10,0.10)' : 'rgba(240,120,95,0.08)';
    g.lineWidth = 1 + r() * 1.5;
    const x = r() * W;
    const y = r() * H;
    const ang = r() * Math.PI;
    const l = 6 + r() * 22;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l);
    g.stroke();
  }
  // gold flecks, scattered
  for (let i = 0; i < (kind === 'fu' ? 70 : 90); i++) {
    g.fillStyle = `rgba(222,180,90,${0.35 + 0.35 * r()})`;
    const s = 2 + r() * 4;
    g.save();
    g.translate(r() * W, r() * H);
    g.rotate(r() * Math.PI);
    g.fillRect(-s / 2, -s / 3, s, s * 0.66);
    g.restore();
  }
  // a printed gold border (a thin double line), a little uneven
  const inset = Math.min(W, H) * 0.075;
  g.strokeStyle = 'rgba(232,198,106,0.75)';
  g.lineWidth = Math.max(2, Math.min(W, H) * 0.012);
  g.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  g.lineWidth = Math.max(1, Math.min(W, H) * 0.005);
  const i2 = inset * 1.45;
  g.strokeRect(i2, i2, W - i2 * 2, H - i2 * 2);
  // the ink: gold, as on many printed couplets (it stays legible on red paper at night)
  g.fillStyle = GOLD_INK;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const text = RED_PAPER_TEXT[kind];
  const ink = (ctx: CanvasRenderingContext2D) => {
    if (kind === 'fu') {
      // the square hangs as a diamond: the mesh turns it 45° counter-clockwise, so the character is
      // drawn turned 45° clockwise and ends upright
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(Math.PI / 4);
      ctx.font = `900 ${Math.round(W * 0.56)}px ${cjk}`;
      fillTextChecked(ctx, text, 0, H * 0.03);
      ctx.restore();
    } else if (kind === 'horizontal') {
      ctx.font = `700 ${Math.round(H * 0.6)}px ${cjk}`;
      // a modern 横批 reads left to right
      [...text].forEach((ch, i) => fillTextChecked(ctx, ch, W * ((i + 0.5) / 4), H * 0.54));
    } else {
      const n = [...text].length;
      ctx.font = `700 ${Math.round(W * 0.62)}px ${cjk}`;
      [...text].forEach((ch, i) => fillTextChecked(ctx, ch, W / 2, H * ((i + 0.55) / n)));
    }
  };
  ink(g);
  // weathering: water stains running down from the top, a faded lower part, grime at the edges
  for (let i = 0; i < 4; i++) {
    const x = r() * W;
    const w = (0.08 + 0.2 * r()) * W;
    const grd = g.createLinearGradient(0, 0, 0, H * (0.4 + 0.5 * r()));
    grd.addColorStop(0, 'rgba(40,6,10,0.22)');
    grd.addColorStop(1, 'rgba(40,6,10,0)');
    g.fillStyle = grd;
    g.fillRect(x - w / 2, 0, w, H);
  }
  const edge = g.createLinearGradient(0, 0, 0, H);
  edge.addColorStop(0, 'rgba(30,5,8,0.18)');
  edge.addColorStop(0.15, 'rgba(30,5,8,0)');
  edge.addColorStop(0.85, 'rgba(255,200,170,0)');
  edge.addColorStop(1, 'rgba(255,200,170,0.10)');
  g.fillStyle = edge;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(25,4,6,0.35)';
  g.lineWidth = Math.min(W, H) * 0.02;
  g.strokeRect(0, 0, W, H);
  // the torn corner: the paper's pale core along the tear, the rest cut away (alpha)
  const [corner, size] = TEAR[kind];
  const tear = tornCorner(r, W, H, corner, size);
  const cx = corner === 1 || corner === 2 ? W : 0;
  const cy = corner === 2 || corner === 3 ? H : 0;
  g.strokeStyle = 'rgba(236,206,190,0.85)';
  g.lineWidth = Math.min(W, H) * 0.035;
  g.lineJoin = 'round';
  g.beginPath();
  tear.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.moveTo(cx, cy);
  tear.forEach(([x, y]) => g.lineTo(x, y));
  g.closePath();
  g.fill();
  g.restore();

  // the height: mid grey, creases and glue ridges, the ink a little raised
  const h = textCanvas(W, H);
  const q = h.g;
  q.fillStyle = 'rgb(128,128,128)';
  q.fillRect(0, 0, W, H);
  q.filter = `blur(${Math.max(1, Math.round(Math.min(W, H) * 0.012))}px)`;
  for (let i = 0; i < (kind === 'fu' ? 18 : 30); i++) {
    const up = r() < 0.5;
    q.strokeStyle = up ? 'rgba(200,200,200,0.55)' : 'rgba(60,60,60,0.55)';
    q.lineWidth = 2 + r() * 6;
    const x = r() * W;
    const y = r() * H;
    const ang = (kind === 'horizontal' ? 0 : Math.PI / 2) + (r() - 0.5) * 1.6;
    const l = (0.2 + 0.5 * r()) * Math.max(W, H) * 0.5;
    q.beginPath();
    q.moveTo(x - Math.cos(ang) * l, y - Math.sin(ang) * l);
    q.quadraticCurveTo(x + (r() - 0.5) * l * 0.3, y + (r() - 0.5) * l * 0.3, x + Math.cos(ang) * l, y + Math.sin(ang) * l);
    q.stroke();
  }
  // glue: a raised band along the top and bottom edges where the paste was brushed
  q.fillStyle = 'rgba(175,175,175,0.6)';
  q.fillRect(0, 0, W, Math.min(W, H) * 0.06);
  q.fillRect(0, H - Math.min(W, H) * 0.06, W, Math.min(W, H) * 0.06);
  q.filter = 'none';
  q.fillStyle = 'rgba(165,165,165,0.8)';
  ink(q);
  // the ink alone, and the printed border a little: the gold leaf's mask
  const k = textCanvas(W, H);
  k.g.fillStyle = '#000000';
  k.g.fillRect(0, 0, W, H);
  k.g.strokeStyle = 'rgba(255,255,255,0.5)';
  k.g.lineWidth = Math.max(2, Math.min(W, H) * 0.012);
  k.g.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  k.g.fillStyle = '#ffffff';
  k.g.textAlign = 'center';
  k.g.textBaseline = 'middle';
  ink(k.g);
  return { color: a.c, height: h.c, ink: k.c };
}

/** The paper's textures (colour with alpha, height, the ink's mask), drawn once per kind and font; only once the fonts are `ready`. */
export function useRedPaper(kind: RedPaperKind, cjk: string, ready: boolean, seed = 7): { map: CanvasTexture; bumpMap: CanvasTexture; inkMap: CanvasTexture } {
  const res = useMemo(() => {
    const { color, height, ink } = drawRedPaper(kind, cjk, seed);
    const map = new CanvasTexture(color);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 8;
    const bumpMap = new CanvasTexture(height);
    bumpMap.colorSpace = LinearSRGBColorSpace;
    const inkMap = new CanvasTexture(ink);
    inkMap.colorSpace = SRGBColorSpace;
    return { map, bumpMap, inkMap };
    // drawn with `ready` true (the stage mounts only then: fillTextChecked throws otherwise)
  }, [kind, cjk, ready, seed]);
  useLayoutEffect(() => () => (res.map.dispose(), res.bumpMap.dispose(), res.inkMap.dispose()), [res]);
  return res;
}
