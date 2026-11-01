import type { GitState } from '@aiv/core';
import { exec } from './proc.ts';

/**
 * HEAD commit and whether the working tree has uncommitted changes (optionally only under
 * `paths`, repo-relative). Read-only git. Outside a repository or before the first commit the
 * commit is 'none' and the tree counts as dirty: nothing about it is pinned.
 */
export async function gitState(root: string, paths: readonly string[] = []): Promise<GitState> {
  try {
    const head = await exec('git', ['rev-parse', 'HEAD'], { cwd: root, timeoutMs: 15_000 });
    const status = await exec('git', ['status', '--porcelain', '--untracked-files=normal', ...(paths.length ? ['--', ...paths] : [])], { cwd: root, timeoutMs: 30_000 });
    if (head.code !== 0) return { commit: 'none', dirty: true };
    return { commit: head.stdout.trim(), dirty: status.code !== 0 || status.stdout.trim().length > 0 };
  } catch {
    return { commit: 'none', dirty: true };
  }
}
