// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/ffmpeg.ts
/**
 * Streaming encode: one ffmpeg process per chunk, fed raw RGBA frames on stdin with drain
 * backpressure (a fast engine never buffers a chunk in RAM), every frame size asserted, and
 * ffmpeg must exit 0. Files are written as <name>.part.<ext> and renamed into place only after
 * ffprobe confirms the frame count, so a crash never leaves a plausible-looking short file.
 */
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ffmpeg, ffmpegBin } from './bin.ts';
import { concatLine } from './escape.ts';
import { MATROSKA_BITEXACT, mezzanineArgs } from './presets.ts';
import { countFrames } from './probe.ts';
import { killTree, spawnTool } from '../util/proc.ts';

export interface ChunkEncoderOptions {
  width: number;
  height: number;
  fps: number;
  out: string;
  /** ffmpeg's stderr goes here (default: discarded beyond the last error lines) */
  logFile?: string;
  /** full ffmpeg arguments; default mezzanineArgs (FFV1 RGB) */
  args?: string[];
}

export class ChunkEncoder {
  readonly opts: ChunkEncoderOptions;
  frames = 0;
  private readonly proc: ChildProcess;
  private readonly exited: Promise<number>;
  private failed: Error | null = null;
  private stderrTail = '';

  constructor(opts: ChunkEncoderOptions) {
    this.opts = opts;
    mkdirSync(dirname(opts.out), { recursive: true });
    this.proc = spawnTool(ffmpegBin(), opts.args ?? mezzanineArgs(opts), { stdio: ['pipe', 'ignore', 'pipe'] });
    const log = opts.logFile ? createWriteStream(opts.logFile) : null;
    this.proc.stderr!.on('data', (d: Buffer) => {
      log?.write(d);
      this.stderrTail = (this.stderrTail + d.toString()).slice(-4000);
    });
    this.exited = new Promise((resolve) =>
      this.proc.on('close', (code) => {
        log?.end();
        resolve(code ?? -1);
      }),
    );
    this.proc.on('error', (e) => (this.failed = e));
    this.proc.stdin!.on('error', (e) => (this.failed = e));
  }

  /** Queue one frame; resolves once ffmpeg can take more. */
  async write(rgba: Uint8Array): Promise<void> {
    if (this.failed) throw this.failed;
    const expect = this.opts.width * this.opts.height * 4;
    if (rgba.length !== expect) throw new Error(`frame size ${rgba.length} ≠ ${expect} (${this.opts.width}x${this.opts.height} RGBA)`);
    if (!this.proc.stdin!.write(rgba)) await once(this.proc.stdin!, 'drain');
    this.frames++;
  }

  /** Close stdin and wait for ffmpeg; throws unless it exits 0. */
  async finish(): Promise<void> {
    this.proc.stdin!.end();
    const code = await this.exited;
    if (this.failed) throw this.failed;
    if (code !== 0) throw new Error(`ffmpeg exited ${code} for ${this.opts.out}: ${this.stderrTail.trim().split('\n').slice(-5).join(' | ')}`);
  }

  /** Drop the chunk: kill ffmpeg and remove its partial output. */
  async abort(): Promise<void> {
    try {
      this.proc.stdin!.destroy();
    } catch {
      /* already closed */
    }
    killTree(this.proc.pid);
    await this.exited;
    rmSync(this.opts.out, { force: true });
  }
}

/** Rename `part` to `final` after its video frame count is exactly `frames`; otherwise throw (and keep the part for inspection). */
export async function commitPart(part: string, final: string, frames: number): Promise<void> {
  const got = await countFrames(part, 'packets');
  if (got !== frames) throw new Error(`${part}: ${got ?? 'unreadable'} frames, expected ${frames}`);
  rmSync(final, { force: true });
  renameSync(part, final);
}

/** Concatenate same-format files by stream copy (no re-encode) with the concat demuxer. */
export async function concatCopy(files: readonly string[], out: string, listFile: string, format = 'matroska'): Promise<void> {
  writeFileSync(listFile, `${files.map(concatLine).join('\n')}\n`);
  try {
    await ffmpeg(['-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-map', '0', '-c', 'copy', ...(format === 'matroska' ? MATROSKA_BITEXACT : []), '-f', format, out], 'concat');
  } finally {
    rmSync(listFile, { force: true });
  }
}
