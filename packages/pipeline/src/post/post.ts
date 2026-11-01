/**
 * Post: render.json + mezzanine in, deliverables out. Reads only the engine's files (the engine
 * boundary is a file) and video.json's audio section:
 *   out/<slug>/post/<profile>/<slug>.mp4      delivery (profile encode preset)
 *   out/<slug>/post/<profile>/archive.mkv     archival master (profiles with archive)
 *   out/<slug>/post/<profile>/audio.wav       the mastered bed (48 kHz, 24-bit)
 *   out/<slug>/post/<profile>/post.json       PostResult
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EXIT, ExitError, parseContract, PostResult, RenderResult } from '@aiv/core';
import { buildAudioBed, DEFAULT_LOUDNESS, masterAudio } from '../media/audio.ts';
import { encodeDelivery } from '../media/mux.ts';
import type { Profile } from '../runner/profiles.ts';
import type { Target } from '../runner/target.ts';
import { gitState } from '../util/git.ts';
import { sha256File } from '../util/hash.ts';
import { createLog, type Log } from '../util/log.ts';
import { fromRepo, outDir, repoRel, writeJson } from '../util/paths.ts';
import { toolchain } from '../util/toolchain.ts';

export interface PostOptions {
  target: Target;
  profile: Profile;
  log?: Log;
  /** render folder (default out/<slug>/render/<profile>) */
  renderDir?: string;
  /** output folder (default out/<slug>/post/<profile>) */
  dir?: string;
}

export interface PostOutcome {
  post: PostResult;
  postJsonPath: string;
  delivery: string;
  archive: string | null;
}

/** Headroom between the mastering true-peak target and QA's ceiling: AAC encoding adds overshoot. */
const TP_MARGIN_DB = 0.5;

export async function runPost(o: PostOptions): Promise<PostOutcome> {
  const root = o.target.root;
  const log = o.log ?? createLog('post');
  const slug = o.target.slug;
  const renderDir = o.renderDir ?? outDir(slug, 'render', o.profile.name, root);
  const renderFile = join(renderDir, 'render.json');
  if (!existsSync(renderFile)) throw new ExitError(EXIT.ERROR, `no render for ${o.target.spec} (${o.profile.name}): ${repoRel(renderFile, root)} is missing; run aiv render first`);
  const render = parseContract(RenderResult, JSON.parse(readFileSync(renderFile, 'utf8')), repoRel(renderFile, root));
  const mezz = fromRepo(render.mezzanine.path, root);
  if (!existsSync(mezz) || statSync(mezz).size !== render.mezzanine.bytes) throw new ExitError(EXIT.ERROR, `mezzanine ${render.mezzanine.path} is missing or not the file render.json describes`);

  const dir = o.dir ?? outDir(slug, 'post', o.profile.name, root);
  const durationS = render.frames.count / render.fps;
  const tracks = o.target.config.audio?.tracks ?? [];
  const qaLoud = o.target.config.qa?.loudness;
  const target = { i: qaLoud?.integrated ?? DEFAULT_LOUDNESS.i, tp: qaLoud ? qaLoud.truePeakMax - TP_MARGIN_DB : DEFAULT_LOUDNESS.tp, lra: DEFAULT_LOUDNESS.lra };
  const warnings: string[] = [];
  if (!tracks.length) warnings.push('video.json has no audio tracks: the deliverable carries silence');

  mkdirSync(dir, { recursive: true });
  const bed = join(dir, 'audio-bed.wav');
  const master = join(dir, 'audio.wav');
  log.info(`audio: ${tracks.length} track(s) → ${durationS.toFixed(3)} s bed, loudnorm to ${target.i} LUFS / ${target.tp} dBTP`);
  await buildAudioBed({ tracks, durationS, out: bed, root });
  const mastered = await masterAudio({ input: bed, out: master, durationS, target });
  rmSync(bed, { force: true });
  if (mastered.mode === 'dynamic') warnings.push('loudnorm fell back to dynamic mode (target not reachable with one gain): listen to the mix');
  if (mastered.before && mastered.after) log.info(`loudness ${mastered.before.i.toFixed(1)} → ${mastered.after.i.toFixed(1)} LUFS, peak ${mastered.after.tp.toFixed(1)} dBTP (${mastered.mode})`);

  const common = { video: mezz, audio: master, fps: render.fps, frames: render.frames.count, source: render.color, log };
  const deliveryFile = join(dir, `${slug}.mp4`);
  const del = await encodeDelivery({ ...common, out: deliveryFile, preset: o.profile.encode });
  let arch: { file: string; bytes: number; encoder: string } | null = null;
  if (o.profile.archive) arch = await encodeDelivery({ ...common, out: join(dir, 'archive.mkv'), preset: 'archive' });
  else rmSync(join(dir, 'archive.mkv'), { force: true });

  const describe = async (file: string, preset: string, encoder: string, frames: number) => ({ path: repoRel(file, root), preset, encoder, bytes: statSync(file).size, sha256: await sha256File(file), frames, durationS: Math.round(durationS * 1e6) / 1e6 });
  const audioPaths = tracks.filter((t) => !t.source.startsWith('lavfi:')).map((t) => t.source);
  const post = parseContract(
    PostResult,
    {
      schemaVersion: 1,
      slug,
      profile: o.profile.name,
      render: { path: repoRel(renderFile, root), inputHash: render.inputHash, mezzanineSha256: render.mezzanine.sha256 },
      delivery: await describe(del.file, o.profile.encode, del.encoder, del.frames),
      ...(arch ? { archive: await describe(arch.file, 'archive', arch.encoder, render.frames.count) } : {}),
      audio: {
        tracks,
        target,
        before: mastered.before,
        after: mastered.after,
        mode: mastered.mode,
      },
      // the mix and the encode: the video folder, its audio files, the presets/mux/audio code
      git: await gitState(root, [o.target.relDir, ...audioPaths, 'packages/pipeline/src', 'pnpm-lock.yaml']),
      toolchain: await toolchain({ browser: render.toolchain.browser, gpu: render.toolchain.gpu }),
      createdAt: new Date().toISOString(),
      warnings,
    },
    'post.json',
  );
  const postJsonPath = join(dir, 'post.json');
  writeJson(postJsonPath, post);
  return { post, postJsonPath, delivery: del.file, archive: arch?.file ?? null };
}
