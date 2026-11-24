/**
 * MiniDSH's full-screen terminal, drawn from its recorded output (assets/tui/paints.json, made by
 * capture/tui_paints.ts from the live take of 2026-11-24). Each paint is the terminal's screen at
 * one moment: rows of styled text in a 100x30 grid. The UI paints no background, so the terminal's
 * colours are ours: a dark pane with the UI's own text colours on it.
 *
 * A paint is drawn into a CPU canvas cell by cell (every glyph at its grid x), so text never
 * drifts off the grid. Symbols the pinned Plex Mono subset does not have (box drawing, the
 * status glyphs, the braille spinner) are drawn as vector strokes from a closed table; any other
 * code point outside the font fails the page rather than falling back to a system font.
 */
import paintsJson from '../assets/tui/paints.json';
import { MONO } from './look.ts';

interface PaintTable {
  cols: number;
  rows: number;
  styles: { fg?: [number, number, number]; b?: 1; d?: 1; i?: 1; u?: 1; v?: 1 }[];
  table: [string, number][][];
  paints: { t: number; r: number[]; c: [number, number] | null }[];
  keys: { t: number; key: string }[];
}
const P = paintsJson as unknown as PaintTable;
export const TUI_COLS = P.cols;
export const TUI_ROWS = P.rows;
export const PAINT_COUNT = P.paints.length;

/** The canvas: one cell is CW x CH px, with a header bar and a margin. */
const FONT_PX = 40;
const CW = 24;
const CH = 52;
const PAD = 44;
const HEADER = 76;
export const TUI_W = TUI_COLS * CW + PAD * 2;
export const TUI_H = TUI_ROWS * CH + PAD + HEADER + 30;

const BG = '#15181d';
const HEAD_BG = '#1c2027';
const FG = '#d9dde4';
const HEAD_FG = '#8b93a1';
const CARET = '#3cc2b0';

/** Real time (ms into the take) of paint k. */
export const paintTime = (k: number): number => P.paints[k]!.t;
/** The last paint at or before real time `t` (ms). */
export function paintAt(t: number): number {
  let lo = 0;
  let hi = P.paints.length - 1;
  if (t <= P.paints[0]!.t) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (P.paints[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
/** Real time of the n-th key the take typed (\r is Enter). */
export const keyTime = (key: string, nth = 0): number => P.keys.filter((k) => k.key === key)[nth]!.t;

const rgb = (c: [number, number, number]): string => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Draws a symbol the font lacks in the cell at (x, y); false if `ch` is not one of them. */
function symbol(g: CanvasRenderingContext2D, ch: string, x: number, y: number, color: string): boolean {
  const cx = x + CW / 2;
  const cy = y + CH / 2;
  const lw = 2.6;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const line = (pts: [number, number][]) => {
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.stroke();
  };
  const cp = ch.codePointAt(0)!;
  if (cp >= 0x2800 && cp <= 0x28ff) {
    // braille: bits 1-8 are dots (col, row): 1 (0,0) 2 (0,1) 3 (0,2) 7 (0,3) 4 (1,0) 5 (1,1) 6 (1,2) 8 (1,3)
    const bits = cp - 0x2800;
    const at: [number, number, number][] = [[0x01, 0, 0], [0x02, 0, 1], [0x04, 0, 2], [0x40, 0, 3], [0x08, 1, 0], [0x10, 1, 1], [0x20, 1, 2], [0x80, 1, 3]];
    for (const [b, col, row] of at) {
      if (!(bits & b)) continue;
      g.beginPath();
      g.arc(x + CW * (0.32 + 0.36 * col), y + CH * (0.2 + 0.2 * row), 2.6, 0, Math.PI * 2);
      g.fill();
    }
    return true;
  }
  const r = 9;
  switch (ch) {
    case '─':
      line([[x, cy], [x + CW, cy]]);
      return true;
    case '│':
      line([[cx, y], [cx, y + CH]]);
      return true;
    case '╎':
      line([[cx, y + CH * 0.08], [cx, y + CH * 0.42]]);
      line([[cx, y + CH * 0.58], [cx, y + CH * 0.92]]);
      return true;
    case '╭':
      g.beginPath();
      g.moveTo(x + CW, cy);
      g.arcTo(cx, cy, cx, y + CH, r);
      g.lineTo(cx, y + CH);
      g.stroke();
      return true;
    case '╮':
      g.beginPath();
      g.moveTo(x, cy);
      g.arcTo(cx, cy, cx, y + CH, r);
      g.lineTo(cx, y + CH);
      g.stroke();
      return true;
    case '╰':
      g.beginPath();
      g.moveTo(cx, y);
      g.arcTo(cx, cy, x + CW, cy, r);
      g.lineTo(x + CW, cy);
      g.stroke();
      return true;
    case '╯':
      g.beginPath();
      g.moveTo(cx, y);
      g.arcTo(cx, cy, x, cy, r);
      g.lineTo(x, cy);
      g.stroke();
      return true;
    case '▎':
      g.fillRect(x + 2, y + 2, CW * 0.25, CH - 4);
      return true;
    case '▏':
      g.fillRect(x + 2, y + 2, CW * 0.12, CH - 4);
      return true;
    case '●':
      g.beginPath();
      g.arc(cx, cy, CW * 0.27, 0, Math.PI * 2);
      g.fill();
      return true;
    case '✓':
      line([[x + CW * 0.18, cy + 1], [x + CW * 0.42, cy + CH * 0.17], [x + CW * 0.84, cy - CH * 0.2]]);
      return true;
    case '✕':
      line([[x + CW * 0.22, cy - CH * 0.15], [x + CW * 0.78, cy + CH * 0.15]]);
      line([[x + CW * 0.78, cy - CH * 0.15], [x + CW * 0.22, cy + CH * 0.15]]);
      return true;
    case '❯':
      line([[x + CW * 0.3, cy - CH * 0.16], [x + CW * 0.72, cy], [x + CW * 0.3, cy + CH * 0.16]]);
      return true;
    case '▸':
      g.beginPath();
      g.moveTo(x + CW * 0.3, cy - CH * 0.12);
      g.lineTo(x + CW * 0.74, cy);
      g.lineTo(x + CW * 0.3, cy + CH * 0.12);
      g.closePath();
      g.fill();
      return true;
    case '→':
      line([[x + CW * 0.12, cy], [x + CW * 0.88, cy]]);
      line([[x + CW * 0.62, cy - CH * 0.11], [x + CW * 0.88, cy], [x + CW * 0.62, cy + CH * 0.11]]);
      return true;
    case 'ℹ':
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, CW * 0.36, 0, Math.PI * 2);
      g.stroke();
      g.fillRect(cx - 1.5, cy - 2, 3, CH * 0.17);
      g.fillRect(cx - 1.5, cy - CH * 0.16, 3, 3);
      return true;
    default:
      return false;
  }
}

/** What the Plex Mono latin subset can draw itself (Basic Latin, Latin-1, general punctuation). */
const inFont = (cp: number): boolean => cp < 0x0250 || (cp >= 0x2000 && cp <= 0x206f) || cp === 0x2212;

/** Draws paint `k` into a fresh canvas, header bar included. */
export function drawPaint(k: number, header: { left: string; right: string }): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TUI_W;
  canvas.height = TUI_H;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = BG;
  g.fillRect(0, 0, TUI_W, TUI_H);
  g.fillStyle = HEAD_BG;
  g.fillRect(0, 0, TUI_W, HEADER);
  g.fillStyle = 'rgba(255,255,255,0.10)';
  g.fillRect(0, HEADER - 1, TUI_W, 1);
  g.textBaseline = 'middle';
  g.font = `500 30px "${MONO}"`;
  g.fillStyle = HEAD_FG;
  g.fillText(header.left, PAD, HEADER / 2 + 1);
  g.textAlign = 'right';
  g.fillText(header.right, TUI_W - PAD, HEADER / 2 + 1);
  g.textAlign = 'left';

  const paint = P.paints[k]!;
  const top = HEADER + 18;
  paint.r.forEach((id, row) => {
    let col = 0;
    for (const [text, s] of P.table[id]!) {
      const st = P.styles[s]!;
      const fgRaw = st.fg ? rgb(st.fg) : FG;
      for (const ch of text) {
        const x = PAD + col * CW;
        const y = top + row * CH;
        col++;
        if (ch === ' ') continue;
        const color = st.v ? BG : fgRaw;
        if (st.v) {
          g.fillStyle = fgRaw;
          g.fillRect(x, y, CW, CH);
        }
        g.globalAlpha = st.d ? 0.52 : 1;
        if (!symbol(g, ch, x, y, color)) {
          const cp = ch.codePointAt(0)!;
          if (!inFont(cp)) throw new Error(`tui: no glyph for U+${cp.toString(16).toUpperCase()} '${ch}' in paint ${k}: add it to the symbol table`);
          g.font = `${st.b ? 600 : 500} ${FONT_PX}px "${MONO}"`;
          g.fillStyle = color;
          if (st.i) {
            g.save();
            g.translate(x + CW / 2, y + CH / 2);
            g.transform(1, 0, -0.18, 1, 0, 0);
            g.fillText(ch, -CW / 2, 1);
            g.restore();
          } else g.fillText(ch, x, y + CH / 2 + 1);
          if (st.u) g.fillRect(x, y + CH * 0.82, CW, 2);
        }
        g.globalAlpha = 1;
      }
    }
  });
  if (paint.c) {
    const [cx, cy] = paint.c;
    g.fillStyle = CARET;
    g.fillRect(PAD + cx * CW + 1, top + cy * CH + 6, 4, CH - 12);
  }
  return canvas;
}

/** The screen position (canvas px) of cell (col, row): for marks pinned to the terminal's text. */
export const cellPx = (col: number, row: number): [number, number] => [PAD + col * CW, HEADER + 18 + row * CH];
