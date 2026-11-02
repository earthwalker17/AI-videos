/**
 * aiv.local.json at the repo root: per-machine settings, gitignored, never committed. Absent =
 * defaults. Unknown keys are an error so a typo never silently disables a safety setting.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { repoRoot } from '../util/paths.ts';

export const LocalConfig = z.strictObject({
  $comment: z.string().optional(),
  /** heavy-job lock file; point it at another repo's lock to serialise heavy jobs across both */
  lockPath: z.string().min(1).optional(),
  /** free RAM (MB) a heavy job needs before it starts */
  minFreeMB: z.number().positive().optional(),
  /** a running render stops (exit 3) when free RAM falls below this (MB) */
  abortFreeMB: z.number().positive().optional(),
  /** opt-in: background apps (process names) that may be stopped when memory is short, only while they have no open window */
  sweepApps: z.array(z.string().regex(/^[\w.\- ]+$/, 'a process name (letters, digits, . _ - space)')).optional(),
  /**
   * sample libraries already on this machine: library id → absolute path of a local checkout at
   * the pinned commit, whose root maps 1:1 onto the library's upstream paths. `aiv doctor --fix`
   * copies pinned files from it (only when the sha256 matches) instead of downloading them, and
   * `aiv audio --pin` reads new files from it. The path stays in this gitignored file.
   */
  librarySeeds: z.record(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'a library id (lowercase-kebab)'), z.string().refine(isAbsolute, 'expected an absolute path')).optional(),
});
export type LocalConfig = z.infer<typeof LocalConfig>;

export const LOCAL_CONFIG_FILE = 'aiv.local.json';

const cache = new Map<string, LocalConfig>();

export function readLocalConfig(root = repoRoot()): LocalConfig {
  const hit = cache.get(root);
  if (hit) return hit;
  const file = join(root, LOCAL_CONFIG_FILE);
  let cfg: LocalConfig = {};
  if (existsSync(file)) {
    const r = LocalConfig.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    if (!r.success) throw new Error(`${LOCAL_CONFIG_FILE} is invalid:\n${z.prettifyError(r.error)}`);
    cfg = r.data;
  }
  cache.set(root, cfg);
  return cfg;
}
