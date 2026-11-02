/**
 * What post and release require of `audio:<name>` tracks before they mix or release them:
 *  - out/<slug>/audio/audio.json exists (else: run aiv audio) and its input hash is today's
 *    (else refused, exit 2, naming what changed: the score, the cues, the runtime, the pins);
 *  - each track file is the one audio.json describes (sha256) and exactly as long as the
 *    picture's composition, round(durationFrames · 48000 / fps) samples;
 *  - the picture was rendered from the same cue sheet: audio.json's cues sha256 equals the
 *    src/cues.ts hash in the render's inputs.json.
 * A stale track is refused rather than mixed: its hits would land where an older cue sheet put them.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AudioResult, audioTrackName, EXIT, ExitError, parseContract, type AudioTrack, type RenderResult } from '@aiv/core';
import { PictureInputs } from '../runner/inputHash.ts';
import type { Target } from '../runner/target.ts';
import { sha256, sha256File } from '../util/hash.ts';
import { fromRepo, repoRel } from '../util/paths.ts';
import { computeAudioHash, describeAudioChanges } from './hash.ts';
import { SAMPLE_RATE } from './runtime/types.ts';
import { audioJsonFile } from './stage.ts';

export interface GeneratedAudio {
  /** repo-relative audio.json */
  audioJson: string;
  audioJsonSha256: string;
  result: AudioResult;
  /** absolute file per audio:<name> source, for the mix */
  files: Record<string, string>;
  /** the files as post.json records them */
  described: { source: string; path: string; bytes: number; sha256: string }[];
}

const refuse = (message: string): never => {
  throw new ExitError(EXIT.REFUSED, message);
};

/** Read a target's audio.json, or exit 1 with the command that makes it. */
export function readAudioResult(target: Pick<Target, 'root' | 'slug' | 'spec'>): { file: string; bytes: Buffer; result: AudioResult } {
  const file = audioJsonFile(target.slug, target.root);
  if (!existsSync(file)) throw new ExitError(EXIT.ERROR, `${repoRel(file, target.root)} is missing: run aiv audio ${target.spec}`);
  const bytes = readFileSync(file);
  return { file, bytes, result: parseContract(AudioResult, JSON.parse(bytes.toString('utf8')), repoRel(file, target.root)) };
}

/** Refuse (exit 2) when the audio input hash moved on since `recorded` was made. */
export function refuseStaleAudio(target: Pick<Target, 'root' | 'slug' | 'relDir' | 'spec'>, recorded: Pick<AudioResult, 'inputHash' | 'settings' | 'inputs'>): void {
  const now = computeAudioHash(target);
  if (now.hash !== recorded.inputHash) refuse(`the audio tracks are stale (${describeAudioChanges(recorded, now)}): run aiv audio ${target.spec}`);
}

/** The cue sheet's sha256 as the picture render saw it (from its inputs.json). */
export function pictureCuesSha(target: Pick<Target, 'root' | 'relDir' | 'spec'>, render: RenderResult, renderDir: string): string {
  const file = join(renderDir, 'inputs.json');
  const rerender = `aiv render ${target.spec} --profile ${render.profile}`;
  if (!existsSync(file)) throw new ExitError(EXIT.ERROR, `${repoRel(file, target.root)} is missing (the render predates it): run ${rerender} (a render that is up to date only writes inputs.json)`);
  const inputs = parseContract(PictureInputs, JSON.parse(readFileSync(file, 'utf8')), repoRel(file, target.root));
  if (inputs.inputHash !== render.inputHash) throw new ExitError(EXIT.ERROR, `${repoRel(file, target.root)} belongs to another render than render.json: run ${rerender}`);
  const cues = `${target.relDir}/src/cues.ts`;
  const f = inputs.files.find((x) => x.path === cues);
  if (!f) refuse(`the picture was rendered without ${cues}: re-render it (aiv render) so picture and score share one cue sheet`);
  return f!.sha256;
}

/** Check every audio:<name> track for a mix (null when there is none). */
export async function verifyGeneratedTracks(o: { target: Target; render: RenderResult; renderDir: string; tracks: readonly AudioTrack[] }): Promise<GeneratedAudio | null> {
  const names = o.tracks.map((t) => audioTrackName(t.source)).filter((n): n is string => n !== null);
  if (!names.length) return null;
  const { target, render } = o;
  const root = target.root;
  const { file, bytes, result } = readAudioResult(target);
  refuseStaleAudio(target, result);
  if (result.sampleRate !== SAMPLE_RATE) refuse(`audio.json was made at ${result.sampleRate} Hz, the mix needs ${SAMPLE_RATE}: run aiv audio ${target.spec}`);
  const expected = Math.round((render.composition.durationFrames * SAMPLE_RATE) / render.fps);
  const pictureCues = pictureCuesSha(target, render, o.renderDir);
  if (pictureCues !== result.cues.sha256)
    refuse(`the picture and the score saw different cue sheets (${result.cues.path}: render ${pictureCues.slice(0, 12)}, audio ${result.cues.sha256.slice(0, 12)}): re-render whichever is older (aiv render / aiv audio ${target.spec})`);
  const files: Record<string, string> = {};
  const described: GeneratedAudio['described'] = [];
  for (const name of [...new Set(names)]) {
    const t = result.tracks.find((x) => x.name === name);
    if (!t) throw new ExitError(EXIT.ERROR, `video.json names audio:${name}, but the score makes ${result.tracks.map((x) => x.name).join(', ') || 'no track'}`);
    const abs = fromRepo(t.path, root);
    if (!existsSync(abs)) throw new ExitError(EXIT.ERROR, `${t.path} is missing: run aiv audio ${target.spec}`);
    const sum = await sha256File(abs);
    if (sum !== t.sha256) refuse(`${t.path} is not the file audio.json describes (sha256 ${sum.slice(0, 12)} ≠ ${t.sha256.slice(0, 12)}): run aiv audio ${target.spec}`);
    if (t.samples !== expected)
      refuse(`${t.path} has ${t.samples} samples; the picture's composition needs ${expected} (${render.composition.durationFrames} frames at ${render.fps} fps): the cue sheet's leaderFrames + filmFrames must match the composition`);
    files[`audio:${name}`] = abs;
    described.push({ source: `audio:${name}`, path: t.path, bytes: t.bytes, sha256: t.sha256 });
  }
  return { audioJson: repoRel(file, root), audioJsonSha256: sha256(bytes), result, files, described };
}
