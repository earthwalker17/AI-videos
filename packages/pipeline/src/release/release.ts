/**
 * Releases: the deliverables copied to out/<slug>/release/v<N>/ (uploaded to GitHub Releases,
 * storage tier T1) and a manifest committed to git that pins them by sha256 and records how
 * they were made. A release is refused (exit 2) when:
 *  - the version already exists (versions are immutable);
 *  - post.json was not made from the current render.json (re-rendered since: the manifest would
 *    describe another picture than the files);
 *  - the picture is stale: its input hash, recomputed from inputs.json (the render's own
 *    settings and roots) against the current tree, differs (an edit after the render);
 *  - an audio:<name> track is stale: the audio input hash differs from the one post mixed;
 *  - a file is not the one post.json describes, or has no QA report for its exact bytes (the
 *    delivery AND the archive master);
 *  - the render is a --frames sub-range or used the unpinned system browser (unless allowed);
 *  - a file exceeds the T1 limit;
 *  - the render, the post or the build tree (code, templates, the video folder, the lockfile)
 *    has uncommitted changes (unless allowed, e.g. for template smoke tests), or QA failed
 *    (unless allowed).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import {
  AudioResult,
  EXIT,
  ExitError,
  parseContract,
  ReleaseManifest,
  T1_LIMIT_BYTES,
  type GitState,
  type PostResult,
  type QaReport,
  type ReleaseFile,
  type RenderResult,
} from '@aiv/core';
import { computeAudioHash, describeAudioChanges } from '../audio/hash.ts';
import { audioJsonFile } from '../audio/stage.ts';
import { countFrames, probe } from '../media/probe.ts';
import { PictureInputs, recomputePictureHash, videoSettingsChanges } from '../runner/inputHash.ts';
import type { Target } from '../runner/target.ts';
import { gitState } from '../util/git.ts';
import { sha256, sha256File } from '../util/hash.ts';
import type { Log } from '../util/log.ts';
import { fromRepo, repoRel, writeJson } from '../util/paths.ts';

type Role = ReleaseFile['role'];

export interface ReleaseOptions {
  target: Pick<Target, 'slug' | 'spec' | 'relDir' | 'root' | 'config'>;
  version: number;
  /** post.json: which files to release and how they were made */
  postJson: PostResult;
  /** the render.json post.json names, read now: it must still be the render post was made from */
  renderJson: RenderResult;
  /** QA report per released file (the archive's is required when post made one) */
  qa: Partial<Record<Role, QaReport>>;
  /** out/<slug>/release/v<N> */
  outDir: string;
  /** videos/<slug>/release/v<N>.json for videos; default <outDir>/manifest.json */
  manifestPath?: string;
  allowDirty?: boolean;
  allowQaFail?: boolean;
  /** release a --frames sub-range render */
  allowPartial?: boolean;
  /** release a render made with the installed (system) Chrome */
  allowUnpinned?: boolean;
  log?: Log;
}

/** What one media file is, as the manifest records it. */
export async function describeFile(path: string, name: string, role: Role): Promise<ReleaseFile> {
  const [p, frames, sum] = await Promise.all([probe(path), countFrames(path, 'packets'), sha256File(path)]);
  const v = p.video;
  return {
    name,
    role,
    bytes: statSync(path).size,
    sha256: sum,
    container: p.formatName,
    vcodec: v?.codec ?? null,
    acodec: p.audio?.codec ?? null,
    width: v?.width ?? null,
    height: v?.height ?? null,
    fps: v ? Math.round(v.fps * 1000) / 1000 : null,
    frames,
    durationS: p.durationS !== null ? Math.round(p.durationS * 1000) / 1000 : null,
    color: { space: v?.colorSpace ?? null, primaries: v?.colorPrimaries ?? null, transfer: v?.colorTransfer ?? null, range: v?.colorRange ?? null },
  };
}

/** Release file name: <slug>-v<N>[-archive].<ext> (self-describing once downloaded). */
export const releaseName = (slug: string, version: number, role: Role, ext: string): string => `${slug}-v${version}${role === 'archive' ? '-archive' : ''}${ext}`;

/**
 * Where a release's bytes come from besides the render and the mix: all code (the presets, the
 * mux, QA), the templates, styles, the target folder (but not its release manifests, which are
 * committed after the release) and the dependency pins. Docs and notes do not count.
 */
export const buildPaths = (targetRelDir: string): string[] => [
  'packages',
  'engines',
  'tools',
  'templates',
  'styles',
  targetRelDir,
  `:(exclude)${targetRelDir}/release`,
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
];

/** The git state of the build tree (tracked and untracked changes under buildPaths). */
export const buildTreeState = (root: string, targetRelDir: string): Promise<GitState> => gitState(root, buildPaths(targetRelDir));

function refuse(message: string): never {
  throw new ExitError(EXIT.REFUSED, message);
}

/**
 * Refuse a picture whose inputs changed after it was rendered: the hash recomputed from the
 * render's inputs.json (its settings and roots, never today's environment) over the current tree
 * must still be render.json's, and the settings video.json gives (engine, entry, composition,
 * format) must still be the recorded ones. The tree is what gets tagged, so the tag must rebuild
 * this picture.
 */
export function refuseStalePicture(target: Pick<Target, 'root' | 'slug' | 'spec' | 'config'>, renderJsonPath: string, render: RenderResult): void {
  const root = target.root;
  const rerender = `aiv render ${target.spec} --profile ${render.profile}`;
  const file = join(dirname(fromRepo(renderJsonPath, root)), 'inputs.json');
  if (!existsSync(file)) refuse(`${repoRel(file, root)} is missing (the render predates it): run ${rerender}. A render that is up to date only writes inputs.json, so post and qa stand; then release`);
  const recorded = parseContract(PictureInputs, JSON.parse(readFileSync(file, 'utf8')), repoRel(file, root));
  if (recorded.inputHash !== render.inputHash) refuse(`${repoRel(file, root)} belongs to another render than ${renderJsonPath}: run ${rerender}, then post, qa and release`);
  const fields = videoSettingsChanges(recorded.header, target);
  if (fields.length) refuse(`the picture is stale: video.json changed since the render (${fields.join(', ')}). Re-render (${rerender}), then post, qa and release`);
  const now = recomputePictureHash(root, recorded);
  if (now.hash !== render.inputHash) refuse(`the picture is stale: its inputs changed since the render (${now.changes || 'the hash differs'}). Re-render (${rerender}), then post, qa and release`);
}

/**
 * Refuse audio:<name> tracks whose audio input hash moved on since post mixed them, naming what
 * changed and the step that is behind: the tracks themselves (run aiv audio), or only the mix
 * (audio.json is current, post is older: re-run post).
 */
function refuseStaleGeneratedAudio(target: Pick<Target, 'slug' | 'spec' | 'relDir' | 'root'>, post: PostResult): void {
  const g = post.audio.generated;
  if (!g) return;
  const now = computeAudioHash(target);
  if (now.hash === g.inputHash) return;
  const file = audioJsonFile(target.slug, target.root);
  const bytes = existsSync(file) ? readFileSync(file) : null;
  const current = bytes ? parseContract(AudioResult, JSON.parse(bytes.toString('utf8')), 'audio.json') : null;
  if (current?.inputHash === now.hash)
    refuse(`post mixed older audio tracks (input hash ${g.inputHash.slice(0, 12)}; audio.json is now at ${now.hash.slice(0, 12)}): re-run aiv post ${target.spec} --profile ${post.profile}, then qa and release`);
  // name the files when the audio.json post mixed is still there to compare with
  const why = bytes && current && sha256(bytes) === g.audioJsonSha256 ? describeAudioChanges(current, now) : `input hash ${g.inputHash.slice(0, 12)} → ${now.hash.slice(0, 12)}`;
  refuse(`the audio tracks are stale (${why}): run aiv audio ${target.spec}, then post, qa and release`);
}

export async function writeRelease(o: ReleaseOptions): Promise<ReleaseManifest> {
  const { slug, root } = o.target;
  const manifestPath = o.manifestPath ?? join(o.outDir, 'manifest.json');
  if (existsSync(manifestPath)) refuse(`release v${o.version} of ${slug} already exists (${basename(manifestPath)}): versions are immutable, release v${o.version + 1}`);
  const r = o.renderJson;
  const post = o.postJson;
  if (post.render.inputHash !== r.inputHash || post.render.mezzanineSha256 !== r.mezzanine.sha256)
    refuse(`${post.render.path} changed since post.json was made (re-rendered?): the deliverables show another picture. Run aiv post and aiv qa again.`);
  if (r.frames.count !== r.composition.durationFrames && !o.allowPartial)
    refuse(`the render holds frames ${r.frames.start}-${r.frames.end - 1} of ${r.composition.durationFrames}: render the whole composition (or --allow-partial deliberately)`);
  if (/not pinned/.test(r.toolchain.browser ?? '') && !o.allowUnpinned) refuse(`the render used ${r.toolchain.browser}: render with the pinned browser (or --allow-unpinned deliberately)`);
  refuseStalePicture(o.target, post.render.path, r);
  refuseStaleGeneratedAudio(o.target, post);

  const files = [
    { role: 'delivery' as const, rec: post.delivery },
    ...(post.archive ? [{ role: 'archive' as const, rec: post.archive }] : []),
  ].map((f) => ({ ...f, path: fromRepo(f.rec.path, root) }));
  for (const f of files) {
    if (!existsSync(f.path)) throw new ExitError(EXIT.ERROR, `missing deliverable ${f.rec.path}`);
    const size = statSync(f.path).size;
    if (size > T1_LIMIT_BYTES) refuse(`${basename(f.path)} is ${(size / 2 ** 30).toFixed(2)} GiB: over the 2 GiB T1 limit (GitHub Releases); lower the archive quality or keep it as a T2 file`);
    const sum = await sha256File(f.path);
    if (sum !== f.rec.sha256) refuse(`${f.rec.path} is not the file post.json describes (sha256 ${sum.slice(0, 12)} ≠ ${f.rec.sha256.slice(0, 12)}): run aiv post again`);
    const rep = o.qa[f.role];
    // the QA verdict must be about these exact bytes
    if (!rep || rep.file !== f.rec.path || rep.sha256 !== sum) refuse(`no QA report for the current ${f.rec.path} (${f.role}): run aiv qa again`);
  }

  const tree = await buildTreeState(root, o.target.relDir);
  const dirty = [r.git.dirty && 'the render', post.git.dirty && 'the post (mix/encode)', tree.dirty && 'the build tree (code, templates, the video folder or the lockfile)'].filter(Boolean);
  if (dirty.length && !o.allowDirty) refuse(`${dirty.join(', ')}: uncommitted changes. Commit, re-render, then release (or --allow-dirty for a throwaway release)`);
  const failed = files.flatMap((f) =>
    o.qa[f.role]!.checks.filter((c) => !c.passed && !c.info).map((c) => (f.role === 'delivery' ? c.id : `${f.role}/${c.id}`)),
  );
  const qaPassed = files.every((f) => o.qa[f.role]!.passed);
  if (!qaPassed && !o.allowQaFail) refuse(`QA failed (${failed.join(', ')}): fix it, or --allow-qa-fail deliberately`);

  mkdirSync(o.outDir, { recursive: true });
  const described: ReleaseFile[] = [];
  for (const f of files) {
    const name = releaseName(slug, o.version, f.role, extname(f.path));
    const dest = join(o.outDir, name);
    if (resolve(dest) !== resolve(f.path)) copyFileSync(f.path, dest);
    described.push(await describeFile(dest, name, f.role));
    o.log?.info(`${name}: ${(described.at(-1)!.bytes / 2 ** 20).toFixed(1)} MB, sha256 ${described.at(-1)!.sha256.slice(0, 12)}…`);
  }
  const loud = o.qa.delivery?.loudness ?? null;
  const manifest = parseContract(
    ReleaseManifest,
    {
      schemaVersion: 1,
      slug,
      version: o.version,
      createdAt: new Date().toISOString(),
      files: described,
      picture: {
        engine: r.engine,
        profile: r.profile,
        commit: r.git.commit,
        dirty: r.git.dirty,
        inputHash: r.inputHash,
        frames: r.frames.count,
        durationFrames: r.composition.durationFrames,
        fps: r.fps,
        toolchain: r.toolchain,
      },
      post: { dirty: post.git.dirty, deliveryPreset: post.delivery.preset, encoder: post.delivery.encoder, archivePreset: post.archive?.preset ?? null },
      tree,
      audio: {
        lufs: loud?.i ?? null,
        truePeak: loud?.tp ?? null,
        ...(post.audio.files
          ? { sources: post.audio.files.map((f) => ({ source: f.source, bytes: f.bytes, sha256: f.sha256, ...(f.source.startsWith('audio:') && post.audio.generated ? { inputHash: post.audio.generated.inputHash } : {}) })) }
          : {}),
      },
      qa: { passed: qaPassed, failed },
      storage: { tier: 'T1', limitBytes: T1_LIMIT_BYTES },
    },
    'release manifest',
  );
  writeJson(manifestPath, manifest);
  return manifest;
}

export interface VerifyResult {
  passed: boolean;
  checks: { name: string; passed: boolean; detail: string }[];
}

/** Re-hash and re-probe the release files in `dir` against the manifest (an object or its file). */
export async function verifyRelease(manifestOrPath: ReleaseManifest | string, dir: string): Promise<VerifyResult> {
  const manifest = typeof manifestOrPath === 'string' ? readManifest(manifestOrPath) : manifestOrPath;
  const checks: VerifyResult['checks'] = [];
  for (const f of manifest.files) {
    const path = join(dir, f.name);
    if (!existsSync(path)) {
      checks.push({ name: f.name, passed: false, detail: 'missing' });
      continue;
    }
    const now = await describeFile(path, f.name, f.role);
    const diffs: string[] = (['bytes', 'sha256', 'container', 'vcodec', 'acodec', 'width', 'height', 'fps', 'frames'] as const).filter((k) => now[k] !== f[k]);
    if (JSON.stringify(now.color) !== JSON.stringify(f.color)) diffs.push('color');
    checks.push({ name: f.name, passed: diffs.length === 0, detail: diffs.length ? `differs: ${diffs.join(', ')}` : `sha256 ${f.sha256.slice(0, 12)}… · ${f.frames} frames · ${f.width}x${f.height}` });
  }
  return { passed: checks.length > 0 && checks.every((c) => c.passed), checks };
}

/** Read and validate a manifest file. */
export function readManifest(path: string): ReleaseManifest {
  return parseContract(ReleaseManifest, JSON.parse(readFileSync(path, 'utf8')), basename(path));
}
