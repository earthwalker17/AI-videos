/**
 * Lifecycle gates as data: what a video folder must hold before its video.json may claim a
 * status. `aiv check` evaluates them; the table in docs/PRODUCTION.md is generated from them, so
 * the documented and the enforced lifecycle cannot drift apart.
 *
 * Requirements are cumulative: a video at `review` must also meet everything from `idea` to
 * `production`. Stage documents start as stubs from templates/_video/; a file that still holds
 * the stub marker counts as not written.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SeriesConfig, Status, VideoSlot } from './schema.ts';
import { statusRank } from './schema.ts';

/** The line every stage stub carries until its author replaces the placeholder text. */
export const STUB_MARKER = '<!-- aiv:stub';

export type FileState = 'missing' | 'stub' | 'written';

export interface GateContext {
  /** absolute folder of the video */
  dir: string;
  series: SeriesConfig | null;
}

export interface Requirement {
  /** the first status that needs it */
  from: Status;
  /** for the generated table in docs/PRODUCTION.md */
  describe: string;
  /** null when met, else what is missing */
  check(v: VideoSlot, ctx: GateContext): string | null;
  /** regular videos, metadata-only entries (earlier films kept as records), or both */
  applies: 'regular' | 'metadata-only' | 'both';
}

export function fileState(file: string): FileState {
  if (!existsSync(file)) return 'missing';
  return readFileSync(file, 'utf8').includes(STUB_MARKER) ? 'stub' : 'written';
}

const written =
  (name: string) =>
  (_v: VideoSlot, ctx: GateContext): string | null => {
    const s = fileState(join(ctx.dir, name));
    return s === 'written' ? null : s === 'stub' ? `${name} is still the stub (remove the aiv:stub line once written)` : `${name} is missing`;
  };

const approved =
  (gate: 'treatment' | 'review' | 'final') =>
  (v: VideoSlot): string | null =>
    v.approvals.some((a) => a.gate === gate) ? null : `no '${gate}' approval in video.json approvals (only the user gives it)`;

const nonEmptyLines = (file: string): number => (existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).length : 0);

export const REQUIREMENTS: readonly Requirement[] = [
  { from: 'idea', describe: '`video.json`, `README.md`', check: (_v, ctx) => (existsSync(join(ctx.dir, 'README.md')) ? null : 'README.md is missing'), applies: 'both' },
  { from: 'brief', describe: '`BRIEF.md` written', check: written('BRIEF.md'), applies: 'regular' },
  { from: 'brief', describe: '`README.md` written', check: written('README.md'), applies: 'both' },
  { from: 'treatment', describe: '`TREATMENT.md` written (three candidates and the choice)', check: written('TREATMENT.md'), applies: 'regular' },
  { from: 'production', describe: 'the **treatment approval**', check: approved('treatment'), applies: 'regular' },
  { from: 'review', describe: '`SCRIPT.md` and `STORYBOARD.md` written', check: (v, ctx) => written('SCRIPT.md')(v, ctx) ?? written('STORYBOARD.md')(v, ctx), applies: 'regular' },
  {
    from: 'review',
    describe: '`FACTS.md` written and `sources.jsonl` non-empty (series with `factsRequired`)',
    check: (v, ctx) => {
      if (!ctx.series?.factsRequired) return null;
      return written('FACTS.md')(v, ctx) ?? (nonEmptyLines(join(ctx.dir, 'sources.jsonl')) > 0 ? null : 'sources.jsonl is missing or empty');
    },
    applies: 'regular',
  },
  { from: 'review', describe: 'the entry file exists', check: (v, ctx) => (v.entry && existsSync(join(ctx.dir, v.entry)) ? null : `the entry ${v.entry ?? '(none)'} does not exist`), applies: 'regular' },
  { from: 'locked', describe: 'the **review approval**; `CREDITS.md` written', check: (v, ctx) => approved('review')(v) ?? written('CREDITS.md')(v, ctx), applies: 'regular' },
  {
    from: 'published',
    describe: 'the **final approval**; `release.version` with its manifest `release/v<N>.json`; `youtube.id`',
    check: (v, ctx) => {
      const a = approved('final')(v);
      if (a) return a;
      if (!v.release) return 'release is null: run aiv release, then set release.version';
      if (!existsSync(join(ctx.dir, 'release', `v${v.release.version}.json`))) return `release/v${v.release.version}.json is missing`;
      return v.youtube ? null : 'youtube is null: record the YouTube id';
    },
    applies: 'regular',
  },
  {
    from: 'published',
    describe: '`youtube.id`',
    check: (v) => (v.youtube ? null : 'youtube is null: record the YouTube id'),
    applies: 'metadata-only',
  },
];

/** Every unmet requirement for the video's current status. */
export function unmetGates(v: VideoSlot, ctx: GateContext): string[] {
  const kind = v.reproducibility === 'metadata-only' ? 'metadata-only' : 'regular';
  return REQUIREMENTS.filter((r) => statusRank(r.from) <= statusRank(v.status) && (r.applies === 'both' || r.applies === kind))
    .map((r) => r.check(v, ctx))
    .filter((m): m is string => m !== null);
}

/** The Markdown table for docs/PRODUCTION.md (the regular lifecycle; metadata-only entries need README + YouTube id). */
export function gatesTable(): string {
  const rows = REQUIREMENTS.filter((r) => r.applies !== 'metadata-only');
  const by = new Map<Status, string[]>();
  for (const r of rows) by.set(r.from, [...(by.get(r.from) ?? []), r.describe]);
  const lines = ['| Status | Requires, on top of every earlier status |', '|---|---|'];
  for (const [status, reqs] of by) lines.push(`| \`${status}\` | ${reqs.join('; ')} |`);
  return lines.join('\n');
}
