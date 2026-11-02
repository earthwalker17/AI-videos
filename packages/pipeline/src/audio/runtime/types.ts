/**
 * The score contract: what a video's `audio/index.ts` default-exports, and what each of its
 * track functions receives. A track is a pure function of its context (the cue sheet, the seed,
 * verified sample files): the same inputs give the same samples and, written by wav.ts, the
 * same bytes. The context is the only way in, so the audio input hash sees everything a track
 * depends on (docs/ARCHITECTURE.md, Determinism).
 */
import type { CueSheet } from '@aiv/core';
import type { LibraryFile, LibraryManifest } from './library.ts';
import type { WavData } from './wav.ts';

/** The stage's one sample rate: the delivery bed is 48 kHz, so post never resamples a track. */
export const SAMPLE_RATE = 48_000;

/** Left and right, each exactly ctx.filmSamples long: the film only (the stage adds the leader). */
export type Stereo = [Float32Array, Float32Array];

/**
 * A pinned sample library, read from the store `.cache/libraries/<id>@<commit>/`. Every read is
 * checked against the video's audio/library.json (bytes and sha256); a path outside the library
 * or one the manifest does not pin is an error (with `aiv audio --pin`, an unpinned file is
 * recorded instead).
 */
export interface Library {
  id: string;
  /** the upstream commit (40 hex) the store folder holds */
  commit: string;
  /** a PCM 16/24-bit or float 32-bit WAV, at its own sample rate (resampling is the score's choice) */
  readWav(path: string): WavData;
  /** a UTF-8 text file (an .sfz, a licence) */
  readText(path: string): string;
}

export interface ScoreContext {
  sampleRate: typeof SAMPLE_RATE;
  /** the video's cue sheet (src/cues.ts), validated and frozen */
  cues: CueSheet;
  fps: number;
  /** samples per channel of the film (without the leader) */
  filmSamples: number;
  /** the first sample of a film frame (counted from the end of the leader): round(frame · sampleRate / fps) */
  frameToSample(filmFrame: number): number;
  /** a library the video pins in audio/library.json */
  library(id: string): Library;
  /** a stable per-video seed (FNV-1a of the slug) for @aiv/core rand(seed, id, k) */
  seed: number;
}

export type Track = (ctx: ScoreContext) => Stereo | Promise<Stereo>;

/** A video's score: named tracks (lowercase-kebab), each referenced in video.json as `audio:<name>`. */
export interface Score {
  tracks: Record<string, Track>;
}

/** Identity with a type: `export default defineScore({ tracks: { bed: (ctx) => … } })`. */
export const defineScore = (score: Score): Score => score;

/** What the stage hands its child process (job.json). Absolute paths: never committed. */
export interface AudioJob {
  /** the repository root of the target */
  root: string;
  slug: string;
  /** video.json format.fps: the cue sheet must agree */
  fps: number;
  cuesFile: string;
  scoreFile: string;
  /** a fresh folder the tracks are written into */
  outDir: string;
  /** audio/library.json, parsed, or null when the video has none */
  libraries: LibraryManifest | null;
  /** record unpinned library reads instead of refusing them */
  pin: boolean;
  /** aiv.local.json librarySeeds: local checkouts that fill the store in --pin mode */
  seeds: Record<string, string>;
}

/** What the child prints as its one stdout line. */
export interface AudioReport {
  ok: boolean;
  error?: string;
  sheet?: CueSheet;
  /** the tracks written into job.outDir, sorted by name */
  tracks: { name: string; samples: number }[];
  /** every library file the score read, per library, sorted by path */
  reads: { id: string; commit: string; files: LibraryFile[] }[];
  /** absolute paths of every module file loaded once the hooks were registered */
  modules: string[];
}
