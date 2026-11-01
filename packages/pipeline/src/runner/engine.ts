/**
 * The engine adapter interface: how any renderer (web pages, Remotion, later Manim/Blender)
 * plugs into the shared chunk runner. The runner owns chunking, resume, hashing, budgets and
 * the mezzanine; an engine only produces frames for a frame range.
 *
 * Two styles, so both kinds of engine fit without adapters of adapters:
 *  - frame streaming (web, Remotion): renderFrames calls onFrame(i, rgba) for each frame in
 *    order; the runner hashes the RGBA and streams it into a lossless FFV1 RGB chunk.
 *  - file producing (future engines such as Blender or Manim): renderChunkFile writes the range
 *    to a video file itself; the runner verifies its frame count and hashes its decoded frames.
 */
import type { ColorInfo } from '@aiv/core';
import type { Log } from '../util/log.ts';
import type { Profile } from './profiles.ts';
import type { Target } from './target.ts';

/** [start, end): start inclusive, end exclusive. */
export type FrameSpan = readonly [number, number];

/** Strings for the toolchain block and resume checks: a resume refuses another browser or GPU. */
export interface EngineInfo {
  /** e.g. "chrome-for-testing 156.0.7600.0" */
  browser?: string;
  /** vendor / renderer family, e.g. "ANGLE (Intel, D3D11)" */
  gpu?: string;
  /** display driver of that GPU (resume refuses another one; kept out of committed files) */
  driver?: string;
  [key: string]: string | undefined;
}

export interface FrameMeta {
  i: number;
  /** sha256 of the frame's RGBA pixels, if the engine computed it */
  sha256?: string;
  /** render time of the frame, ms */
  ms?: number;
}

export interface EngineOpenContext {
  target: Target;
  profile: Profile;
  /** render size (profile scale applied, even) */
  width: number;
  height: number;
  fps: number;
  /** the run folder (out/<slug>/render/<profile>); engines may keep caches/logs here */
  runDir: string;
  root: string;
  /**
   * the repo-relative roots the input hash covers: an engine that serves files to a page must
   * refuse to serve (or fail on) anything outside them, or pixels change without the hash
   */
  inputRoots: readonly string[];
  log: Log;
}

export interface EngineSession {
  /** total frames of the composition (the runner renders [0, durationFrames) unless given a range) */
  durationFrames: number;
  info: EngineInfo;
  /**
   * streaming style: deliver frames [start, end) in order as tightly packed RGBA (width*4
   * stride, sRGB-encoded, opaque). Await each onFrame (backpressure); when it throws (budget,
   * low memory, encoder failure) stop rendering and reject with that same error.
   */
  renderFrames?(range: FrameSpan, onFrame: (i: number, rgba: Uint8Array, meta?: { ms?: number }) => Promise<void>): Promise<void>;
  /** file style: render [start, end) into outFile (container given by `output.ext`) */
  renderChunkFile?(range: FrameSpan, outFile: string): Promise<FrameMeta[] | void>;
  /** file style: the container and colour of the chunk files (streaming engines get FFV1 RGB) */
  output?: { ext: '.mkv' | '.mov' | '.mp4'; color: ColorInfo };
  close(): Promise<void>;
}

export interface EngineAdapter {
  /** 'web', 'remotion', … (matches video.json engine) */
  name: string;
  /** the engine's own version (e.g. the renderer library) */
  version: string;
  /** the adapter's version: part of the input hash, bump it when the adapter changes pixels */
  adapterVersion: string;
  /** extra repo-relative files/folders that shape pixels (the harness, the page runtime, a kit) */
  inputs?(target: Target): string[];
  /** choices of this adapter instance that change pixels (web: browser pinned|system); part of the render settings */
  settings?: Record<string, string>;
  open(ctx: EngineOpenContext): Promise<EngineSession>;
}
