import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { EXIT, ExitError, parseContract, PostResult, QaReport, RenderResult } from '@aiv/core';
import { createLog, fromRepo, getProfile, outDir, readManifest, repoRel, resolveTarget, verifyRelease, writeRelease, type Target } from '@aiv/pipeline';
import { intFlag, parse, usageError, type Command } from '../command.ts';

const usage = `usage: aiv release <target> [--profile final] [--version N] [--allow-dirty] [--allow-qa-fail] [--allow-partial] [--allow-unpinned]
       aiv release verify <target> [--version N]
       aiv release verify --manifest <file> [--dir <folder>]

release: copies the profile's deliverables (post.json: delivery mp4 + archive master) to
out/<slug>/release/v<N>/ and writes the manifest (sha256, probe facts, render provenance,
post, build tree, loudness, QA) to videos/<slug>/release/v<N>.json (templates:
out/<slug>/release/v<N>/manifest.json). N defaults to the next. Refused (exit 2) when v<N>
exists, post.json was made from an older render, a file lacks a QA report for its exact bytes
(delivery and archive), the render is partial (--frames) or used the system browser, a file is
over 2 GiB (GitHub Releases), the render, mix or build tree has uncommitted changes, or QA failed.

verify: re-hashes and re-probes the release files against the manifest (default: latest).

exit: 0 ok · 1 error / verify failed · 2 refused · 64 usage`;

/** Where a target's release manifests live. */
function manifestPath(target: Target, version: number): string {
  return target.kind === 'video' ? join(target.dir, 'release', `v${version}.json`) : join(outDir(target.slug, 'release', `v${version}`), 'manifest.json');
}

function versions(target: Target): number[] {
  const dir = target.kind === 'video' ? join(target.dir, 'release') : dirname(outDir(target.slug, 'release', 'v1'));
  if (!existsSync(dir)) return [];
  const re = target.kind === 'video' ? /^v(\d+)\.json$/ : /^v(\d+)$/;
  return readdirSync(dir)
    .map((f) => re.exec(f)?.[1])
    .filter((v): v is string => v !== undefined)
    .map(Number)
    .filter((v) => existsSync(manifestPath(target, v)))
    .sort((a, b) => a - b);
}

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as unknown;

async function verify(argv: string[]): Promise<number> {
  const { values, positionals } = parse(argv, { version: { type: 'string' }, manifest: { type: 'string' }, dir: { type: 'string' } }, usage);
  let manifestFile: string;
  let dir: string;
  if (values.manifest) {
    manifestFile = resolve(values.manifest);
    if (!existsSync(manifestFile)) throw new ExitError(EXIT.ERROR, `no manifest at ${values.manifest}`);
    const m = readManifest(manifestFile);
    dir = values.dir ? resolve(values.dir) : outDir(m.slug, 'release', `v${m.version}`);
  } else {
    if (positionals.length !== 1) usageError('expected exactly one <target> (or --manifest)', usage);
    const target = resolveTarget(positionals[0]);
    const v = intFlag(values.version, 'version', usage) ?? versions(target).at(-1);
    if (!v) throw new ExitError(EXIT.ERROR, `${target.spec} has no release yet`);
    manifestFile = manifestPath(target, v);
    dir = values.dir ? resolve(values.dir) : outDir(target.slug, 'release', `v${v}`);
  }
  if (!existsSync(manifestFile)) throw new ExitError(EXIT.ERROR, `no manifest at ${repoRel(manifestFile)}`);
  const m = readManifest(manifestFile);
  const r = await verifyRelease(m, dir);
  for (const c of r.checks) console.log(`  ${c.passed ? 'PASS' : 'FAIL'}  ${c.name}  ${c.detail}`);
  console.log(`  ${r.passed ? 'RELEASE VERIFIED' : 'RELEASE DOES NOT MATCH ITS MANIFEST'} (${m.slug} v${m.version})`);
  return r.passed ? EXIT.OK : EXIT.ERROR;
}

export const release: Command = {
  name: 'release',
  summary: 'copy the final deliverables to a versioned release and write its sha256 manifest; `release verify` re-checks one',
  usage,
  async run(argv) {
    if (argv[0] === 'verify') return verify(argv.slice(1));
    const { values, positionals } = parse(
      argv,
      {
        profile: { type: 'string', default: 'final' },
        version: { type: 'string' },
        'allow-dirty': { type: 'boolean' },
        'allow-qa-fail': { type: 'boolean' },
        'allow-partial': { type: 'boolean' },
        'allow-unpinned': { type: 'boolean' },
      },
      usage,
    );
    if (positionals.length !== 1) usageError('expected exactly one <target>', usage);
    const target = resolveTarget(positionals[0]);
    const profile = getProfile(values.profile);
    const log = createLog('release');
    const postFile = join(outDir(target.slug, 'post', profile.name), 'post.json');
    const qaDir = outDir(target.slug, 'qa', profile.name);
    const missing = (f: string, step: string) => new ExitError(EXIT.ERROR, `${repoRel(f)} is missing: run aiv ${step} ${target.spec} --profile ${profile.name}`);
    if (!existsSync(postFile)) throw missing(postFile, 'post');
    const postJson = parseContract(PostResult, readJson(postFile), repoRel(postFile));
    const renderFile = fromRepo(postJson.render.path);
    if (!existsSync(renderFile)) throw missing(renderFile, 'render');
    const renderJson = parseContract(RenderResult, readJson(renderFile), postJson.render.path);
    // one report per released file: the delivery's and (final) the archive master's
    const reports = { delivery: join(qaDir, 'report.json'), ...(postJson.archive ? { archive: join(qaDir, 'report-archive.json') } : {}) };
    const qa: Partial<Record<'delivery' | 'archive', QaReport>> = {};
    for (const [role, f] of Object.entries(reports) as ['delivery' | 'archive', string][]) {
      if (!existsSync(f)) throw missing(f, 'qa');
      qa[role] = parseContract(QaReport, readJson(f), repoRel(f));
    }
    const version = intFlag(values.version, 'version', usage) ?? (versions(target).at(-1) ?? 0) + 1;
    if (version < 1) usageError('--version starts at 1', usage);
    const dest = outDir(target.slug, 'release', `v${version}`);
    const mPath = manifestPath(target, version);
    const m = await writeRelease({
      target,
      version,
      postJson,
      renderJson,
      qa,
      outDir: dest,
      manifestPath: mPath,
      allowDirty: values['allow-dirty'],
      allowQaFail: values['allow-qa-fail'],
      allowPartial: values['allow-partial'],
      allowUnpinned: values['allow-unpinned'],
      log,
    });
    log.info(`release v${m.version}: ${m.files.length} file(s) in ${repoRel(dest)} · manifest ${repoRel(mPath)}`);
    log.info(`next: upload the files to GitHub Releases; verify with aiv release verify ${target.spec} --version ${version}`);
    return EXIT.OK;
  },
};
