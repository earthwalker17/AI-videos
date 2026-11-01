import { join } from 'node:path';
import { EXIT } from '@aiv/core';
import { exec, repoRoot, writeFileAtomic } from '@aiv/pipeline';
import { candidateFiles, docs, hygiene, privacy, provenance, type Issue } from '../check/files.ts';
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

export const check: Command = {
  name: 'check',
  summary: 'check schemas, gates, generated files, file hygiene, privacy, provenance and docs (--fix)',
  usage,
  async run(argv) {
    const { values, positionals } = parse(argv, { fix: { type: 'boolean' }, staged: { type: 'boolean' }, json: { type: 'boolean' } }, usage);
    if (positionals.length) usageError('aiv check takes no arguments besides its flags', usage);
    const root = repoRoot();
    const repo = loadRepo(root);
    // the command list is imported lazily: commands/index.ts imports this file
    const { COMMANDS } = await import('./index.ts');

    const issues: Issue[] = [...slots(repo)];
    const fixed: string[] = [];
    for (const g of generatedFiles(repo)) {
      const { state, expected } = freshness(root, g);
      const what = g.block ? `${g.path} (block '${g.block}')` : g.jsonField ? `${g.path} (${g.jsonField})` : g.path;
      if (state === 'no-marker') issues.push({ group: 'generated', file: g.path, message: `has no <!-- aiv:generated ${g.block} --> … <!-- /aiv:generated --> block` });
      else if (state === 'stale' && values.fix) {
        writeFileAtomic(join(root, g.path), expected!);
        fixed.push(what);
      } else if (state === 'stale') issues.push({ group: 'generated', file: g.path, message: `${what} is stale: run pnpm aiv check --fix` });
      else if (values.staged) {
        // the commit holds the staged copy: a file regenerated in the working tree but not staged would slip through
        const r = await exec('git', ['show', `:${g.path}`], { cwd: root, timeoutMs: 30_000 });
        const staged = r.code === 0 ? r.stdout.replace(/\r\n/g, '\n') : null;
        if (staged !== null && render(g, staged) !== staged) issues.push({ group: 'generated', file: g.path, message: `${what} is regenerated but not staged: git add ${g.path}` });
      }
    }

    const all = await candidateFiles(root, false);
    const files = values.staged ? await candidateFiles(root, true) : all;
    issues.push(...hygiene(root, files), ...privacy(root, files), ...provenance(root, files, all));
    issues.push(...docs(root, files, COMMANDS.map((c) => c.name)));

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

