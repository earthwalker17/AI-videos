import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { CueKind, CueSheet, EXIT, ExitError } from '@aiv/core';
import {
  CAPTION_KINDS,
  draftCaptions,
  formatSrt,
  formatSrtTime,
  lintSrt,
  repoRel,
  resolveTarget,
  selectCues,
  subtitleProfile,
  writeFileAtomic,
  type DraftCaption,
  type LintResult,
  type Target,
} from '@aiv/pipeline';
import { parse, usageError, type Command } from '../command.ts';
import { isFrozen, Lang, Status } from '../slot/schema.ts';

const usage = `usage: aiv captions <slug> [--lang <list>] [--cues <ids>] [--kinds <list>] [--json]
       aiv captions <slug> --lint [--lang <list>] [--json]

Writes draft captions from the video's cue sheet (src/cues.ts): the on-screen words of its text
and card cues in one language, as videos/<slug>/publish/captions/<lang>.srt (SRT, UTF-8, LF),
then lints them. The file is replaced. A person reads the draft before it is published: the words
are the picture's, never reworded.
- Times: each cue's span [frame, end), on the delivery (the sheet's leader included), each frame
  rounded to the nearest ms by one map, so touching captions never overlap.
- Lines: wrapped to the language's profile, balanced, a break after clause punctuation (or at a
  pause in Chinese) preferred; a '\\n' in a cue's text is kept. A cue with more lines than a
  caption holds becomes consecutive captions over its span, shared by characters.
- Overlapping cues: stacked while their lines fit, the earliest started on top; else the newest
  cue wins the caption, and the earlier one comes back when it ends. A chosen cue that newer ones
  cover the whole time would never be shown: that is an error (1), naming it, and nothing is written.

The linter, per language profile (references/subtitles.md): valid SRT (indices 1, 2, 3, …, end
after start, in order, no overlaps), text in every caption, and for en at most 42 characters a
line, 2 lines, 20 characters/s (spaces counted); for zh-Hans at most 16 characters a line, 2 lines,
9 characters/s (spaces not counted), no ，or 。, full-width ？！： and quotation marks (half-width
only inside a Latin run, as in 3:44). Warnings: a caption up for under 1 s (our choice), a BOM or
CRLF, a language without a profile (structure only). aiv check fails on lint errors in every
unfrozen video's publish/captions/*.srt, and on a file named by a language without a profile.

  <slug>          a video slug
  --lang <list>   languages, comma-separated (default: the first of video.json languages; with
                  --lint, every captions/<lang>.srt there is)
  --cues <ids>    the cues to caption, comma-separated ids or globs (* any characters, ? one
                  character), e.g. 'title,c?,c??,end' (default: every cue of --kinds). A name that
                  matches no cue of those kinds is a usage error
  --kinds <list>  the cue kinds to choose from (default: ${CAPTION_KINDS.join(',')})
  --lint          lint the existing files only; write nothing (allowed on a frozen video)
  --json          print the files, their captions and lint results as JSON

A published or archived video is frozen: its captions were published with it, so they are linted
but never rewritten.

exit: 0 ok (warnings allowed) · 1 a lint error, a cue sheet that does not load, or a cue without
      words in a language asked · 2 refused (the video is frozen) · 64 usage`;

interface FileResult {
  path: string;
  lang: string;
  wrote: boolean;
  captions?: DraftCaption[];
  lint: LintResult;
}

/** A comma-separated flag value as a list; undefined when the flag is absent, a usage error when it lists nothing. */
function list(v: string | undefined, flag: string): string[] | undefined {
  if (v === undefined) return undefined;
  const out = v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!out.length) usageError(`--${flag}: '${v}' lists nothing: give at least one, comma-separated`, usage);
  return out;
}

/** The video's cue sheet, loaded from src/cues.ts (aiv runs under tsx) and validated. */
async function loadCues(target: Target): Promise<CueSheet> {
  const file = join(target.dir, 'src', 'cues.ts');
  const rel = repoRel(file, target.root);
  if (!existsSync(file)) throw new ExitError(EXIT.ERROR, `${rel} is missing: captions are drafted from the cue sheet it exports as \`cues\``);
  let mod: { cues?: unknown };
  try {
    mod = (await import(pathToFileURL(file).href)) as { cues?: unknown };
  } catch (e) {
    throw new ExitError(EXIT.ERROR, `${rel} does not load: ${(e as Error).message}`);
  }
  if (mod.cues === undefined) throw new ExitError(EXIT.ERROR, `${rel} must export \`cues\` (a CueSheet)`);
  const parsed = CueSheet.safeParse(mod.cues);
  if (!parsed.success) throw new ExitError(EXIT.ERROR, `${rel}: the cue sheet does not match its contract:\n${z.prettifyError(parsed.error)}`);
  if (parsed.data.fps !== target.config.format.fps) throw new ExitError(EXIT.ERROR, `${rel} has fps ${parsed.data.fps}, video.json format.fps is ${target.config.format.fps}: they must agree`);
  return parsed.data;
}

function report(results: FileResult[], say: (line: string) => void): void {
  for (const r of results) {
    if (r.wrote && r.captions) {
      const c = r.captions;
      const cues = new Set(c.flatMap((x) => x.cues)).size;
      say(`wrote ${r.path}: ${c.length} caption(s) from ${cues} cue(s), ${c.length ? `${formatSrtTime(c[0].start)} to ${formatSrtTime(c.at(-1)!.end)}` : 'empty'}`);
    }
    for (const i of r.lint.issues)
      say(`  ${i.severity === 'error' ? 'ERROR' : 'WARN '}  ${r.path}${i.line ? `:${i.line}` : ''}  ${i.caption ? `#${i.caption} ` : ''}${i.rule}  ${i.message}`);
    const p = subtitleProfile(r.lang);
    const limits = p ? ` (${p.lang}: ≤ ${p.maxLineChars} characters a line, ≤ ${p.maxLines} lines, ≤ ${p.maxCps} characters/s)` : ' (no profile: structure only)';
    say(`lint ${r.path}: ${r.lint.captions} caption(s) · ${r.lint.errors} error(s) · ${r.lint.warnings} warning(s)${limits}`);
  }
}

export const captions: Command = {
  name: 'captions',
  summary: "draft a video's caption files (SRT) from its cue sheet's text, and lint them per language",
  usage,
  async run(argv) {
    const { values, positionals } = parse(
      argv,
      { lang: { type: 'string' }, cues: { type: 'string' }, kinds: { type: 'string' }, lint: { type: 'boolean' }, json: { type: 'boolean' } },
      usage,
    );
    if (positionals.length !== 1) usageError('expected exactly one <slug>', usage);
    const target = resolveTarget(positionals[0]);
    if (target.kind !== 'video') usageError('captions belong to a video: give its slug', usage);
    if (values.lint && (values.cues !== undefined || values.kinds !== undefined)) usageError('--cues and --kinds choose what to write: --lint writes nothing', usage);
    const langs = list(values.lang, 'lang');
    for (const l of langs ?? []) if (!Lang.safeParse(l).success) usageError(`--lang: '${l}' is not a BCP 47 tag such as en or zh-Hans`, usage);
    const raw = JSON.parse(readFileSync(target.configPath, 'utf8')) as { status?: unknown; languages?: unknown };
    const dir = join(target.dir, 'publish', 'captions');
    const rel = (lang: string) => repoRel(join(dir, `${lang}.srt`), target.root);
    const results: FileResult[] = [];

    if (values.lint) {
      const have = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.srt')).map((f) => f.slice(0, -4)).sort() : [];
      const want = langs ?? have;
      if (!want.length) throw new ExitError(EXIT.ERROR, `no captions in ${repoRel(dir, target.root)}/: write them with aiv captions ${target.slug}`);
      for (const lang of want) {
        if (!existsSync(join(dir, `${lang}.srt`))) throw new ExitError(EXIT.ERROR, `${rel(lang)} does not exist`);
        results.push({ path: rel(lang), lang, wrote: false, lint: lintSrt(readFileSync(join(dir, `${lang}.srt`), 'utf8'), lang) });
      }
    } else {
      const status = Status.safeParse(raw.status);
      if (status.success && isFrozen(status.data))
        throw new ExitError(EXIT.REFUSED, `${target.slug} is ${status.data}, so it is frozen: its captions were published with it. Lint them with --lint; never rewrite them`);
      const first = Array.isArray(raw.languages) && typeof raw.languages[0] === 'string' ? raw.languages[0] : undefined;
      const write = langs ?? (first ? [first] : []);
      if (!write.length) usageError('video.json lists no languages: pass --lang', usage);
      const kinds = list(values.kinds, 'kinds');
      for (const k of kinds ?? []) if (!CueKind.safeParse(k).success) usageError(`--kinds: '${k}' is not a cue kind (${CueKind.options.join(', ')})`, usage);
      const sheet = await loadCues(target);
      const sel = selectCues(sheet, { kinds: kinds as CueKind[] | undefined, ids: list(values.cues, 'cues') });
      if (sel.unmatched.length) usageError(`--cues: ${sel.unmatched.map((u) => `'${u}'`).join(', ')} match(es) no ${(kinds ?? CAPTION_KINDS).join(' or ')} cue in src/cues.ts`, usage);
      if (!sel.cues.length) throw new ExitError(EXIT.ERROR, `src/cues.ts has no ${(kinds ?? CAPTION_KINDS).join(' or ')} cue to caption`);
      for (const lang of write) {
        let caps: DraftCaption[];
        try {
          caps = draftCaptions(sheet, sel.cues, lang);
        } catch (e) {
          throw new ExitError(EXIT.ERROR, (e as Error).message);
        }
        const srt = formatSrt(caps);
        writeFileAtomic(join(dir, `${lang}.srt`), srt);
        results.push({ path: rel(lang), lang, wrote: true, captions: caps, lint: lintSrt(srt, lang) });
      }
    }

    const json = !!values.json;
    const say = (line: string) => (json ? console.error(line) : console.log(line));
    report(results, say);
    if (json) console.log(JSON.stringify({ files: results }, null, 2));
    return results.some((r) => r.lint.errors > 0) ? EXIT.ERROR : EXIT.OK;
  },
};
