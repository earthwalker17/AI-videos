import { readFileSync } from 'node:fs';
import { EXIT, ExitError } from '@aiv/core';
import { exec, type Target } from '@aiv/pipeline';

/**
 * A frozen (published or archived) video is rebuilt only at its release tag: at a later commit
 * the shared code has moved on, so its picture and its score would no longer be the released
 * ones (docs/ARCHITECTURE.md, decision 18). `aiv render` and `aiv audio` refuse (exit 2) elsewhere.
 */
export async function refuseFrozen(target: Target): Promise<void> {
  if (target.kind !== 'video') return;
  const status = (JSON.parse(readFileSync(target.configPath, 'utf8')) as { status?: string }).status;
  if (status !== 'published' && status !== 'archived') return;
  const r = await exec('git', ['tag', '--points-at', 'HEAD'], { cwd: target.root, timeoutMs: 30_000 });
  if (r.stdout.split(/\r?\n/).some((t) => t.startsWith(`video/${target.slug}/v`))) return;
  throw new ExitError(EXIT.REFUSED, `${target.slug} is ${status}, so it is frozen: rebuild it from a worktree at its tag video/${target.slug}/v<N> (docs/PRODUCTION.md, 'Rebuild a frozen video'), not at this commit`);
}
