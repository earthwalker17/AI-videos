/**
 * The subtitle linter: an SRT file against its language's profile (profiles.ts). The result is
 * data; `aiv captions` prints it and `aiv check` fails on its errors.
 *
 * Errors: the file is not valid SRT (a block that does not parse or a missing blank line between
 * two, indices not 1, 2, 3, …, an end
 * not after its start, a start before the previous one's, an overlap), a caption without text, a
 * line too long, too many lines, reading speed over the limit, zh-Hans punctuation. Warnings: a
 * caption shorter than MIN_DURATION_MS (our choice, not a reference number), a BOM or CRLF line
 * endings (we write UTF-8 with LF), and a language without a profile (only the structure is
 * checked).
 */
import { lineChars, MIN_DURATION_MS, speedChars, subtitleProfile, type SubtitleProfile } from './profiles.ts';
import { parseSrt, type ParsedCaption } from './srt.ts';

export type LintSeverity = 'error' | 'warning';

export interface LintIssue {
  rule: string;
  severity: LintSeverity;
  message: string;
  /** the file line (1-based) */
  line?: number;
  /** the caption's index as written */
  caption?: number;
}

export interface LintResult {
  lang: string;
  /** the profile the text was checked against, or null (structure only) */
  profile: string | null;
  captions: number;
  issues: LintIssue[];
  errors: number;
  warnings: number;
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** a character of a Latin run: not CJK, not white space */
const latin = (c: string | undefined) => c !== undefined && !CJK.test(c) && !/\s/u.test(c);

/**
 * The zh-Hans punctuation faults of a line: ，or 。 (a pause is a space); a half-width ? ! : , or .
 * anywhere but inside a run of Latin letters and digits (3:44 and 6.4 stay; "Router?" and
 * "好 ?" do not: ？！： are full-width, and commas and full stops go); a half-width quotation
 * mark " (zh-Hans quotes are full-width; which pair the guide prescribes was not recorded).
 */
export function zhPunctuationFaults(line: string): string[] {
  const out: string[] = [];
  if (/[，。]/u.test(line)) out.push('uses ，or 。: a pause is a single space');
  const cps = [...line];
  const half = new Set<string>();
  cps.forEach((c, i) => {
    if ('?!:,.'.includes(c) && !(latin(cps[i - 1]) && latin(cps[i + 1]))) half.add(c);
  });
  if (half.size) out.push(`half-width ${[...half].join(' ')} outside a Latin run: use ？！： and drop commas and full stops`);
  if (line.includes('"')) out.push('half-width quotation mark ": use full-width quotation marks');
  return out;
}

const secs = (ms: number) => (ms / 1000).toFixed(3);

/** Lint parsed captions against a profile (null: structure only). */
export function lintCaptions(captions: readonly ParsedCaption[], profile: SubtitleProfile | null): LintIssue[] {
  const issues: LintIssue[] = [];
  const err = (c: ParsedCaption, rule: string, message: string) => issues.push({ rule, severity: 'error', message, line: c.line, caption: c.index });
  captions.forEach((c, i) => {
    const prev = captions[i - 1];
    if (c.index !== i + 1) err(c, 'srt.index', `index ${c.index} where ${i + 1} belongs: number the captions 1, 2, 3, … in order`);
    if (c.end <= c.start) err(c, 'srt.timing', `ends at ${secs(c.end)} s, not after its start ${secs(c.start)} s`);
    if (prev && c.start < prev.start) err(c, 'srt.order', `starts at ${secs(c.start)} s, before caption ${prev.index} (${secs(prev.start)} s)`);
    else if (prev && c.start < prev.end) err(c, 'srt.overlap', `starts at ${secs(c.start)} s, while caption ${prev.index} is still up (until ${secs(prev.end)} s)`);
    if (!c.lines.some((l) => l.trim())) {
      err(c, 'text.empty', 'has no text');
      return;
    }
    const dur = c.end - c.start;
    if (dur > 0 && dur < MIN_DURATION_MS) issues.push({ rule: 'duration.min', severity: 'warning', message: `up for ${secs(dur)} s, under ${secs(MIN_DURATION_MS)} s`, line: c.line, caption: c.index });
    if (!profile) return;
    if (c.lines.length > profile.maxLines) err(c, 'line.count', `${c.lines.length} lines, more than ${profile.maxLines}`);
    c.lines.forEach((l, k) => {
      const n = lineChars(l);
      if (n > profile.maxLineChars) err(c, 'line.length', `line ${k + 1} has ${n} characters, more than ${profile.maxLineChars}: '${l}'`);
    });
    if (dur > 0) {
      const cps = (speedChars(c.lines, profile) * 1000) / dur;
      if (cps > profile.maxCps) err(c, 'speed', `${cps.toFixed(1)} characters/s over ${secs(dur)} s, more than ${profile.maxCps}`);
    }
    if (profile.zhPunctuation) for (const l of c.lines) for (const f of zhPunctuationFaults(l)) err(c, 'zh.punctuation', `'${l}' ${f}`);
  });
  return issues;
}

/** Lint an SRT file's text in `lang` (the profile found by subtitleProfile). */
export function lintSrt(text: string, lang: string): LintResult {
  const profile = subtitleProfile(lang);
  const parsed = parseSrt(text);
  const issues: LintIssue[] = parsed.errors.map((e) => ({ rule: 'srt.syntax', severity: 'error', message: e.message, line: e.line }));
  if (!parsed.captions.length && !parsed.errors.length) issues.push({ rule: 'srt.empty', severity: 'error', message: 'no captions' });
  if (parsed.bom) issues.push({ rule: 'file.bom', severity: 'warning', message: 'starts with a byte-order mark: we write UTF-8 without one' });
  if (parsed.crlf) issues.push({ rule: 'file.crlf', severity: 'warning', message: 'CRLF line endings: we write LF' });
  if (!profile) issues.push({ rule: 'profile.none', severity: 'warning', message: `no subtitle profile for '${lang}': only the SRT structure is checked` });
  issues.push(...lintCaptions(parsed.captions, profile));
  issues.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  const errors = issues.filter((i) => i.severity === 'error').length;
  return { lang, profile: profile?.lang ?? null, captions: parsed.captions.length, issues, errors, warnings: issues.length - errors };
}
