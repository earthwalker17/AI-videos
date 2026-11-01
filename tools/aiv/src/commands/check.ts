import { join } from 'node:path';
import { EXIT } from '@aiv/core';
import { exec, repoRoot, writeFileAtomic } from '@aiv/pipeline';
import { candidateFiles, diskSource, docs, hygiene, privacy, provenance, stagedSource, type Issue } from '../check/files.ts';
import { slots } from '../check/slots.ts';
import { parse, usageError, type Command } from '../command.ts';
import { freshness, generatedFiles, render } from '../slot/generate.ts';
import { loadRepo } from '../slot/repo.ts';

const usage = `usage: aiv check [--fix] [--staged] [--json]

Checks the repository: every video.json / series.json / template / release manifest against its
schema; slugs, numbers, series, styles and engines consistent; every video meets the gates of the
status it claims (docs/PRODUCTION.md); generated files fresh (schemas/, catalog.json, docs/INDEX.md,
the marked blocks in README.md, docs/PRODUCTION.md and docs/ENVIRONMENT.md, tsconfig.json exclude);
files git would commit are at most 2 MiB, portable names, no private data or secrets; adapted code
keeps its SPDX header and is listed in NOTICE.md; docs name only real aiv commands and existing files.

  --fix     rewrite stale generated files (then review and commit them)
  --staged  file checks on staged files only (the pre-commit hook)
  --json    print the issues as JSON

exit: 0 clean · 1 issues found · 64 usage`;

/** 'videos/<slug>' and 'series/<id>' folders that hold at least one tracked file. */
async function trackedSlots(root: string): Promise<Set<string>> {
  const r = await exec('git', ['ls-files', '-z', '--', 'videos', 'series'], { cwd: root, timeoutMs: 30_000 });
  if (r.code !== 0) throw new Error(`git ls-files failed: ${r.stderr.trim()}`);
  return new Set(r.stdout.split('\0').filter(Boolean).map((f) => f.split('/').slice(0, 2).join('/')));
}

export const check: Command = {
  name: 'check',
  summary: 'check schemas, gates, generated files, file hygiene, privacy, provenance and docs (--fix)',
  usage,
  async run(argv) {
    const { values, positionals } = parse(argv, { fix: { type: 'boolean' }, staged: { type: 'boolean' }, json: { type: 'boolean' } }, usage);
    if (positionals.length) usageError('aiv check takes no arguments besides its flags', usage);
    if (values.fix && values.staged) usageError('--fix regenerates from the working tree: run it alone, git add the result, then --staged', usage);
    const root = repoRoot();
    // the commit holds only tracked slots: an untracked work-in-progress video must not block it
    const tracked = values.staged ? await trackedSlots(root) : null;
    const repo = loadRepo(root, tracked ? { only: (d) => tracked.has(d) } : {});
    // the command list is imported lazily: commands/index.ts imports this file
    const { COMMANDS } = await import('./index.ts');

    const issues: Issue[] = [...slots(repo)];
    const fixed: string[] = [];
    for (const g of generatedFiles(repo)) {
      const what = g.block ? `${g.path} (block '${g.block}')` : g.jsonField ? `${g.path} (${g.jsonField})` : g.path;
      const noMarker = `has no <!-- aiv:generated ${g.block} --> … <!-- /aiv:generated --> block`;
      if (values.staged) {
        // the commit holds the staged copy, and it must match the slots the commit holds
        const r = await exec('git', ['show', `:${g.path}`], { cwd: root, timeoutMs: 30_000 });
        const staged = r.code === 0 ? r.stdout.replace(/\r\n/g, '\n') : null;
        const expected = render(g, staged);
        if (expected === null) issues.push({ group: 'generated', file: g.path, message: noMarker });
        else if (expected !== staged) issues.push({ group: 'generated', file: g.path, message: `${what} in the commit does not match the slots it holds: run pnpm aiv check --fix, then git add ${g.path}` });
        continue;
      }
      const { state, expected } = freshness(root, g);
      if (state === 'no-marker') issues.push({ group: 'generated', file: g.path, message: noMarker });
      else if (state === 'stale' && values.fix) {
        writeFileAtomic(join(root, g.path), expected!);
        fixed.push(what);
      } else if (state === 'stale') issues.push({ group: 'generated', file: g.path, message: `${what} is stale: run pnpm aiv check --fix` });
    }

    const all = await candidateFiles(root, false);
    const files = values.staged ? await candidateFiles(root, true) : all;
    // the pre-commit hook judges what will be committed: the staged blobs
    const src = values.staged ? await stagedSource(root, files) : diskSource(root);
    issues.push(...hygiene(root, files, src), ...privacy(root, files, src), ...provenance(root, files, all, src));
    issues.push(...docs(root, files, COMMANDS.map((c) => c.name), src));

    if (values.json) console.log(JSON.stringify({ issues, fixed }, null, 2));
    else {
      for (const f of fixed) console.log(`  FIXED  ${f}`);
      for (const i of issues) console.log(`  FAIL   ${i.group.padEnd(10)} ${i.file ?? ''}${i.line ? `:${i.line}` : ''}  ${i.message}`);
      const scope = values.staged ? `${files.length} staged file(s)` : `${files.length} files`;
      console.log(issues.length ? `CHECK FAILED: ${issues.length} issue(s) (${scope}, ${repo.videos.length} videos)` : `CHECK PASSED (${scope}, ${repo.videos.length} videos, ${repo.series.length} series)`);
    }
    return issues.length ? EXIT.ERROR : EXIT.OK;
  },
};

