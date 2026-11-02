/**
 * Parsers for what ffmpeg's analysis filters print on stderr (ebur128, astats, blackdetect,
 * freezedetect, silencedetect). Pure functions, so the formats are pinned by tests.
 */

export interface Segment {
  start: number;
  /** end in seconds; open segments (still running at EOF) end at the file's duration */
  end: number;
}

export interface Ebur128Summary {
  /** integrated loudness, LUFS */
  i: number;
  /** loudness range, LU */
  lra: number;
  /** true peak, dBTP (null when peak=true was not set) */
  tp: number | null;
}

/** The "Summary:" block of ebur128 (the last one, if several). */
export function parseEbur128(stderr: string): Ebur128Summary | null {
  const at = stderr.lastIndexOf('Summary:');
  if (at < 0) return null;
  const s = stderr.slice(at);
  const num = (re: RegExp) => {
    const m = re.exec(s);
    if (!m) return null;
    return m[1] === '-inf' ? -Infinity : Number(m[1]);
  };
  const i = num(/I:\s+(-?[\d.]+|-inf)\s+LUFS/);
  const lra = num(/LRA:\s+(-?[\d.]+)\s+LU/);
  const tp = num(/True peak:\s+Peak:\s+(-?[\d.]+|-inf)\s+dBFS/);
  return i === null ? null : { i, lra: lra ?? 0, tp };
}

/**
 * astats' overall sample peak, dBFS: the "Overall" block it prints at the end, "Peak level dB:
 * -0.512000" (-inf for digital silence; above 0 for float overs). Null without one.
 */
export function parseAstatsPeak(stderr: string): number | null {
  const at = stderr.lastIndexOf('] Overall');
  if (at < 0) return null;
  const m = /Peak level dB:\s*(-?inf|-?\d+(?:\.\d+)?)/.exec(stderr.slice(at));
  if (!m) return null;
  return m[1] === '-inf' ? -Infinity : m[1] === 'inf' ? Infinity : Number(m[1]);
}

/** blackdetect: "black_start:0 black_end:1.5 black_duration:1.5". */
export function parseBlack(stderr: string): Segment[] {
  const out: Segment[] = [];
  for (const m of stderr.matchAll(/black_start:\s*(-?[\d.]+)\s+black_end:\s*(-?[\d.]+)/g)) out.push({ start: Number(m[1]), end: Number(m[2]) });
  return out;
}

/** freezedetect: lavfi.freezedetect.freeze_start / freeze_end pairs (an unmatched start runs to `durationS`). */
export function parseFreeze(stderr: string, durationS: number): Segment[] {
  return pairs(stderr, /freeze_start:\s*(-?[\d.]+)/g, /freeze_end:\s*(-?[\d.]+)/g, durationS);
}

/** silencedetect: "silence_start: 0.5" … "silence_end: 3 | silence_duration: 2.5". */
export function parseSilence(stderr: string, durationS: number): Segment[] {
  return pairs(stderr, /silence_start:\s*(-?[\d.]+)/g, /silence_end:\s*(-?[\d.]+)/g, durationS);
}

function pairs(text: string, startRe: RegExp, endRe: RegExp, durationS: number): Segment[] {
  const events = [
    ...[...text.matchAll(startRe)].map((m) => ({ at: m.index, kind: 'start' as const, t: Number(m[1]) })),
    ...[...text.matchAll(endRe)].map((m) => ({ at: m.index, kind: 'end' as const, t: Number(m[1]) })),
  ].sort((a, b) => a.at - b.at);
  const out: Segment[] = [];
  let open: number | null = null;
  for (const e of events) {
    if (e.kind === 'start') open = e.t;
    else if (open !== null) {
      out.push({ start: open, end: e.t });
      open = null;
    }
  }
  if (open !== null) out.push({ start: open, end: durationS });
  return out;
}

/** Segments not inside any allowed [start, end) span (seconds, with `slack` on both sides). */
export function unexpected(segments: readonly Segment[], allowed: readonly Segment[], slack = 0): Segment[] {
  return segments.filter((s) => !allowed.some((a) => s.start >= a.start - slack && s.end <= a.end + slack));
}
