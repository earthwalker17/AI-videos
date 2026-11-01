/**
 * Render targets. `<slug>` is a video (videos/<slug>/video.json); `template:<engine>` is a
 * runnable template (templates/<engine>/video.json) whose output goes to out/_template-<engine>/
 * so it never collides with a real video.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXIT, ExitError, parseContract, VideoConfig } from '@aiv/core';
import { repoRel, repoRoot } from '../util/paths.ts';

export interface Target {
  /** as given on the command line */
  spec: string;
  kind: 'video' | 'template';
  /** the slug used under out/ */
  slug: string;
  /** absolute folder of the target */
  dir: string;
  /** repo-relative folder */
  relDir: string;
  /** absolute path of its video.json */
  configPath: string;
  config: VideoConfig;
  root: string;
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function resolveTarget(spec: string, root = repoRoot()): Target {
  const tpl = /^template:([a-z0-9][a-z0-9-]*)$/.exec(spec);
  if (!tpl && !SLUG.test(spec)) throw new ExitError(EXIT.USAGE, `'${spec}' is not a target: use a video slug (lowercase-kebab) or template:<engine>`);
  const dir = tpl ? join(root, 'templates', tpl[1]) : join(root, 'videos', spec);
  const configPath = join(dir, 'video.json');
  if (!existsSync(configPath)) throw new ExitError(EXIT.USAGE, `no ${tpl ? 'template' : 'video'} '${spec}': ${repoRel(configPath, root)} does not exist`);
  const config = parseContract(VideoConfig, JSON.parse(readFileSync(configPath, 'utf8')), repoRel(configPath, root));
  return {
    spec,
    kind: tpl ? 'template' : 'video',
    slug: tpl ? `_template-${tpl[1]}` : spec,
    dir,
    relDir: repoRel(dir, root),
    configPath,
    config,
    root,
  };
}
