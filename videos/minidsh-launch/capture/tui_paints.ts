// SPDX-License-Identifier: MIT
/**
 * Turns a recorded MiniDSH terminal take (tui_record.py) into the film's paint table.
 *
 * MiniDSH's full-screen terminal writes each repaint as one DEC 2026 synchronized-output block of
 * DIFFS against the previous frame (absolute cursor moves, SGR, text; a full clear only on a full
 * repaint). So every block is applied on top of the screen the earlier blocks left, and the
 * screen at each block's end is one paint. The escape set it emits is small and closed (its
 * screen.ts and tty.ts): CUP, `ESC[H`, `ESC[2J`, SGR resets with bold/faint/italic/underline/
 * inverse and 24-bit foreground, `?2026`, `?25`, `?1049`, `?2004`, `?7`, BEL and OSC 52. Anything
 * else is reported, not guessed.
 *
 * Output: unique styled rows plus, per paint, its time, its row ids and the cursor. A paint is a
 * pure lookup, so the film draws paint k identically whatever it drew before.
 *
 *   node videos/minidsh-launch/capture/tui_paints.ts <take.jsonl> <paints.json> [--dump a,b,c]
 */
import { readFileSync, writeFileSync } from 'node:fs';

export interface CellStyle {
  fg?: [number, number, number];
  b?: 1;
  d?: 1;
  i?: 1;
  u?: 1;
  v?: 1;
}
interface Cell {
  ch: string;
  w: 0 | 1 | 2;
  s: string; // style key ('' = default)
}
export interface Paint {
  t: number;
  r: number[];
  c: [number, number] | null;
}
export interface PaintTable {
  cols: number;
  rows: number;
  styles: CellStyle[];
  /** Each row: runs of [text, style index]. */
  table: [string, number][][];
  paints: Paint[];
  keys: { t: number; key: string }[];
  glyphs: string[];
  unknown: string[];
}

const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{1f300}-\u{1faff}]/u;

export function convert(lines: string[]): PaintTable {
  const head = JSON.parse(lines[0]!) as { cols: number; rows: number };
  const { cols, rows } = head;
  const blank = (): Cell[][] => Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ ch: ' ', w: 1, s: '' }) as Cell));
  let main = blank();
  let alt = blank();
  let onAlt = false;
  let x = 0;
  let y = 0;
  let style: CellStyle = {};
  let styleKey = '';
  let cursorOn = true;
  const styles: CellStyle[] = [{}];
  const styleIndex = new Map<string, number>([['', 0]]);
  const table: [string, number][][] = [];
  const rowIndex = new Map<string, number>();
  const paints: Paint[] = [];
  const keys: { t: number; key: string }[] = [];
  const glyphs = new Set<string>();
  const unknown = new Set<string>();
  const decoder = new TextDecoder('utf-8');
  let pending = ''; // an escape sequence split across reads

  const grid = (): Cell[][] => (onAlt ? alt : main);
  const setStyle = (params: string): void => {
    const p = params === '' ? ['0'] : params.split(';');
    let next: CellStyle = { ...style };
    for (let k = 0; k < p.length; k++) {
      const n = p[k]!;
      if (n === '0' || n === '') next = {};
      else if (n === '1') next.b = 1;
      else if (n === '2') next.d = 1;
      else if (n === '3') next.i = 1;
      else if (n === '4') next.u = 1;
      else if (n === '7') next.v = 1;
      else if (n === '38' && p[k + 1] === '2') {
        next.fg = [Number(p[k + 2]), Number(p[k + 3]), Number(p[k + 4])];
        k += 4;
      } else if (n === '39') delete next.fg;
      else unknown.add(`SGR ${n}`);
    }
    style = next;
    styleKey = JSON.stringify(next) === '{}' ? '' : JSON.stringify(next);
    if (!styleIndex.has(styleKey)) {
      styleIndex.set(styleKey, styles.length);
      styles.push(next);
    }
  };
  const put = (ch: string): void => {
    if (y < 0 || y >= rows) return;
    const w: 1 | 2 = WIDE.test(ch) ? 2 : 1;
    if (x + w > cols) return; // autowrap is off (?7l): the writer never crosses the edge
    if (ch.codePointAt(0)! > 0x7e) glyphs.add(ch);
    const row = grid()[y]!;
    row[x] = { ch, w, s: styleKey };
    if (w === 2 && x + 1 < cols) row[x + 1] = { ch: '', w: 0, s: styleKey };
    x += w;
  };
  const snapshot = (t: number): void => {
    const g = grid();
    const ids = g.map((row) => {
      const runs: [string, number][] = [];
      for (const cell of row) {
        if (cell.w === 0) continue;
        const s = styleIndex.get(cell.s)!;
        const last = runs.at(-1);
        if (last && last[1] === s) last[0] += cell.ch;
        else runs.push([cell.ch, s]);
      }
      // trailing default blanks carry nothing
      const lastRun = runs.at(-1);
      if (lastRun && lastRun[1] === 0) {
        lastRun[0] = lastRun[0].replace(/ +$/, '');
        if (lastRun[0] === '') runs.pop();
      }
      const key = JSON.stringify(runs);
      let id = rowIndex.get(key);
      if (id === undefined) {
        id = table.length;
        rowIndex.set(key, id);
        table.push(runs);
      }
      return id;
    });
    paints.push({ t, r: ids, c: cursorOn ? [x, y] : null });
  };

  const apply = (text: string, t: number): void => {
    let s = pending + text;
    pending = '';
    let i = 0;
    while (i < s.length) {
      const ch = s[i]!;
      if (ch === '\x1b') {
        const rest = s.slice(i);
        const csi = /^\x1b\[([?]?)([0-9;]*)([$]?)([A-Za-z@])/.exec(rest);
        const osc = /^\x1b\][^\x07\x1b]*(\x07|\x1b\\)/.exec(rest);
        if (csi) {
          const [all, priv, params, , final] = csi;
          i += all.length;
          if (priv === '?') {
            const on = final === 'h';
            for (const m of params!.split(';')) {
              if (m === '1049') {
                onAlt = on;
                if (on) alt = blank();
              } else if (m === '25') cursorOn = on;
              else if (m === '2026') {
                if (!on) snapshot(t);
              } else if (m === '2004' || m === '7' || m === '1') {
                // bracketed paste, autowrap, cursor keys: no picture
              } else unknown.add(`?${m}${final}`);
            }
          } else if (final === 'H' || final === 'f') {
            const [r, c] = params!.split(';');
            y = Math.max(0, Number(r || 1) - 1);
            x = Math.max(0, Number(c || 1) - 1);
          } else if (final === 'J') {
            if (params === '2' || params === '3') {
              if (onAlt) alt = blank();
              else main = blank();
            } else unknown.add(`J${params}`);
          } else if (final === 'K') {
            const row = grid()[y];
            if (row) for (let c = params === '1' ? 0 : x; c < (params === '1' ? x + 1 : cols); c++) row[c] = { ch: ' ', w: 1, s: '' };
          } else if (final === 'm') setStyle(params!);
          else unknown.add(`CSI ${params}${final}`);
          continue;
        }
        if (osc) {
          i += osc[0].length;
          continue;
        }
        if (rest.length < 64) {
          pending = rest; // an incomplete sequence: finish it with the next read
          return;
        }
        unknown.add(JSON.stringify(rest.slice(0, 8)));
        i++;
        continue;
      }
      if (ch === '\r') x = 0;
      else if (ch === '\n') y = Math.min(rows - 1, y + 1);
      else if (ch === '\x07' || ch === '\b') {
        // the bell rings when an approval's keys arm; nothing to draw
      } else {
        const cp = s.codePointAt(i)!;
        const g = String.fromCodePoint(cp);
        put(g);
        i += g.length;
        continue;
      }
      i++;
    }
  };

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const rec = JSON.parse(line) as { t: number; b?: string; key?: string };
    if (rec.key !== undefined) keys.push({ t: rec.t, key: rec.key });
    if (rec.b !== undefined) apply(decoder.decode(Buffer.from(rec.b, 'base64'), { stream: true }), rec.t);
  }
  return { cols, rows, styles, table, paints, keys, glyphs: [...glyphs].sort(), unknown: [...unknown].sort() };
}

/** Plain text of one paint, for looking at a take in a terminal. */
export function paintText(p: PaintTable, k: number): string {
  return p.paints[k]!.r.map((id) => p.table[id]!.map((run) => run[0]).join('')).join('\n');
}

if (import.meta.main) {
  const [input, output, flag, list] = process.argv.slice(2);
  if (!input || !output) {
    console.error('usage: tui_paints.ts <take.jsonl> <paints.json> [--dump a,b,c]');
    process.exit(64);
  }
  const p = convert(readFileSync(input, 'utf8').split('\n'));
  writeFileSync(output, JSON.stringify(p));
  const bytes = Buffer.byteLength(JSON.stringify(p));
  console.log(`${p.paints.length} paints, ${p.table.length} unique rows, ${p.styles.length} styles, ${(bytes / 1024).toFixed(0)} KiB`);
  console.log(`glyphs beyond ASCII: ${p.glyphs.join(' ')}`);
  if (p.unknown.length) console.log(`UNKNOWN sequences: ${p.unknown.join(', ')}`);
  if (flag === '--dump' && list) {
    for (const k of list.split(',').map(Number)) {
      const at = k < 0 ? p.paints.length + k : k;
      console.log(`\n--- paint ${at} at ${p.paints[at]!.t} ms, cursor ${JSON.stringify(p.paints[at]!.c)}`);
      console.log(paintText(p, at));
    }
  }
}
