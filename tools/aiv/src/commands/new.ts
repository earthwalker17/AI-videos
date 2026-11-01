import { cpSync, existsSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { EXIT, ExitError } from '@aiv/core';
import { repoRoot, writeJson } from '@aiv/pipeline';
import { parse, usageError, type Command } from '../command.ts';
import { loadRepo } from '../slot/repo.ts';
import { Slug, VideoSlot } from '../slot/schema.ts';
import { STAGE_DOCS, stageDoc } from '../slot/stages.ts';

const usage = `usage: aiv new <slug> [--engine <engine>] [--series <id>] [--title "<title>"]

Creates videos/<slug>/ from templates/<engine>/ (the code and video.json) and templates/_video/
(the stage documents README, BRIEF, TREATMENT, SCRIPT, STORYBOARD, FACTS and CREDITS, stubs until
written). video.json gets the next number, status 'idea' and the series' defaults, copied in once:
a later change to the series never changes this video. Nothing is installed: video code resolves
the studio dependencies from the repository root, so the lockfile does not change.

  --engine  an engine with a template (templates/<engine>/); default: the series' default engine
  --series  a series id (series/<id>/); omit for a standalone video
  --title   the working title (default: the slug in words)

exit: 0 created · 1 error · 64 usage (bad or taken slug, unknown engine or series)`;

const RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const COPY_SKIP = new Set(['README.md', 'node_modules', '.remotion', 'dist', 'out']);

export const newVideo: Command = {
  name: 'new',
  summary: 'create a video slot from an engine template and the stage-document stubs',
  usage,
  async run(argv) {
    const { values, positionals } = parse(argv, { engine: { type: 'string' }, series: { type: 'string' }, title: { type: 'string' } }, usage);
    if (positionals.length !== 1) usageError('expected exactly one <slug>', usage);
    const slug = positionals[0];
    const ok = Slug.safeParse(slug);
    if (!ok.success || RESERVED.test(slug)) usageError(`'${slug}' is not a usable slug: ${ok.success ? 'reserved on Windows' : ok.error.issues[0].message} (2-48 characters)`, usage);

    const root = repoRoot();
    const repo = loadRepo(root);
    // numbering needs every existing video.json readable; a broken one could hide a number
    const broken = repo.videos.filter((v) => !v.data);
    if (broken.length) throw new ExitError(EXIT.ERROR, `fix these first (pnpm aiv check): ${broken.map((b) => `${b.file}: ${b.error}`).join('; ')}`);
    if (repo.videos.some((v) => v.name.toLowerCase() === slug)) usageError(`videos/${slug} already exists`, usage);

    const series = values.series ? repo.series.find((s) => s.data?.id === values.series)?.data : null;
    if (values.series && !series) usageError(`no series '${values.series}' (known: ${repo.series.flatMap((s) => (s.data ? [s.data.id] : [])).join(', ')})`, usage);
    const engine = values.engine ?? series?.defaults.engine;
    if (!engine) usageError('--engine is required (the series has no default engine)', usage);
    const template = repo.templates.find((t) => t.name === engine && t.data);
    if (!template?.data) usageError(`no template for engine '${engine}' (known: ${repo.templates.map((t) => t.name).join(', ')})`, usage);
    const t = template.data;

    const number = Math.max(0, ...repo.videos.map((v) => v.data!.number)) + 1;
    const title = values.title ?? slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
    const d = series?.defaults ?? {};
    const slot = VideoSlot.parse({
      $schema: '../../schemas/video.v1.json',
      schemaVersion: 1,
      number,
      slug,
      title,
      series: series?.id ?? null,
      status: 'idea',
      approvals: [],
      next: 'Write BRIEF.md (docs/PRODUCTION.md, stage 1).',
      languages: d.languages ?? ['en'],
      styles: d.styles ?? [],
      reproducibility: 'full',
      engine: t.engine,
      entry: t.entry,
      ...(t.composition ? { composition: t.composition } : {}),
      format: d.format ?? t.format,
      ...(t.audio ? { audio: t.audio } : {}),
      ...(t.qa || d.qa ? { qa: { ...t.qa, ...d.qa } } : {}),
      reusable: [],
      license: { film: 'CC-BY-4.0' },
      youtube: null,
      release: null,
      source: null,
    });

    const dir = join(root, 'videos', slug);
    cpSync(join(root, template.dir), dir, { recursive: true, filter: (src) => !COPY_SKIP.has(basename(src)) });
    writeJson(join(dir, 'video.json'), slot);
    const vars = { title, slug, number, series: series ? `[${series.title}](../../series/${series.id}/SERIES.md)` : 'standalone', engine: t.engine };
    for (const doc of STAGE_DOCS) writeFileSync(join(dir, doc), stageDoc(root, doc, vars));
    if (series?.factsRequired && !existsSync(join(dir, 'sources.jsonl'))) writeFileSync(join(dir, 'sources.jsonl'), '');

    console.log(`created videos/${slug} (#${number}, ${series ? `series ${series.id}` : 'standalone'}, engine ${t.engine}, status idea)`);
    if (d.format && (d.format.width !== t.format.width || d.format.height !== t.format.height || d.format.fps !== t.format.fps))
      console.log(`note: the series format ${d.format.width}x${d.format.height}@${d.format.fps} differs from the template's; make src/ match video.json`);
    console.log(`next: pnpm aiv check --fix (adds the video to the catalog and index) · write videos/${slug}/BRIEF.md · pnpm aiv render ${slug} --profile draft`);
    return EXIT.OK;
  },
};
