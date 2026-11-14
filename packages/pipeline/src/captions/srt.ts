/**
 * SubRip (SRT): what YouTube takes as a basic caption file (references/subtitles.md). A file is
 * blocks separated by a blank line: the index (1, 2, 3, …), the timing line
 * `HH:MM:SS,mmm --> HH:MM:SS,mmm`, then one or more lines of text. We write UTF-8 without a BOM,
 * with LF line endings and a final newline; the parser also reads CRLF and a BOM (and says so).
 */

export interface Caption {
  /** start time, ms */
  start: number;
  /** end time, ms (exclusive: the caption is gone from here) */
  end: number;
  /** the text lines, as shown */
  lines: string[];
}

export interface ParsedCaption extends Caption {
  /** the index as written in the file */
  index: number;
  /** the file line of the index (1-based) */
  line: number;
}

export interface SrtSyntaxError {
  line: number;
  message: string;
}

export interface ParsedSrt {
  captions: ParsedCaption[];
  /** blocks that could not be read (they are left out of `captions`) */
  errors: SrtSyntaxError[];
  bom: boolean;
  crlf: boolean;
}

const pad = (n: number, w: number) => String(n).padStart(w, '0');

/** ms as an SRT time, HH:MM:SS,mmm (hours grow past two digits when they must). */
export function formatSrtTime(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0) throw new Error(`an SRT time is a whole number of ms, 0 or more (got ${ms})`);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms % 1000, 3)}`;
}

const TIME = /(\d{2,}):(\d{2}):(\d{2}),(\d{3})/;
const TIMING = new RegExp(`^${TIME.source} --> ${TIME.source}$`);

/** An SRT time (HH:MM:SS,mmm) in ms, or null when it is not one. */
export function parseSrtTime(s: string): number | null {
  const m = new RegExp(`^${TIME.source}$`).exec(s);
  return m ? timeOf(m.slice(1, 5)) : null;
}

function timeOf([h, m, s, ms]: string[]): number | null {
  if (Number(m) > 59 || Number(s) > 59) return null;
  return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(ms);
}

/** Captions as an SRT file, numbered 1, 2, 3, … in the order given. */
export function formatSrt(captions: readonly Caption[]): string {
  return captions.map((c, i) => [String(i + 1), `${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}`, ...c.lines].join('\n')).join('\n\n') + (captions.length ? '\n' : '');
}

/**
 * Read an SRT file. Every block that is not index, timing and text is a syntax error, with its
 * line, and so is a missing blank line between two captions (a timing line among the text).
 */
export function parseSrt(text: string): ParsedSrt {
  const bom = text.charCodeAt(0) === 0xfeff;
  const crlf = text.includes('\r\n');
  const rows = (bom ? text.slice(1) : text).replace(/\r\n?/g, '\n').split('\n');
  const captions: ParsedCaption[] = [];
  const errors: SrtSyntaxError[] = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i].trim() === '') {
      i++;
      continue;
    }
    const first = i;
    const block: string[] = [];
    while (i < rows.length && rows[i].trim() !== '') block.push(rows[i++]);
    // a timing line among the text: the blank line before the next caption is missing. The block
    // ends before it (and before its index, when there is one), and the rest is read as a block.
    const t2 = block.findIndex((r, k) => k >= 2 && TIMING.test(r.trim()));
    if (t2 >= 0) {
      const cut = t2 >= 3 && /^\d+$/.test(block[t2 - 1].trim()) ? t2 - 1 : t2;
      errors.push({ line: first + cut + 1, message: `'${block[cut].trim()}' starts a new caption without the blank line before it` });
      block.length = cut;
      i = first + cut;
    }
    const line = first + 1;
    const [indexRow, timingRow, ...lines] = block;
    if (!/^\d+$/.test(indexRow.trim())) {
      errors.push({ line, message: `expected a caption index (a whole number), got '${indexRow.trim()}'` });
      continue;
    }
    const t = timingRow === undefined ? null : TIMING.exec(timingRow.trim());
    const start = t ? timeOf(t.slice(1, 5)) : null;
    const end = t ? timeOf(t.slice(5, 9)) : null;
    if (start === null || end === null) {
      errors.push({ line: line + 1, message: `expected 'HH:MM:SS,mmm --> HH:MM:SS,mmm' after index ${indexRow.trim()}, got '${(timingRow ?? '').trim()}'` });
      continue;
    }
    captions.push({ index: Number(indexRow.trim()), line, start, end, lines });
  }
  return { captions, errors, bom, crlf };
}
