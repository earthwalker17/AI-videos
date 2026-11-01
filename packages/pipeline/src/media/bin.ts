import { exec, which } from '../util/proc.ts';

/** ffmpeg / ffprobe: FFMPEG_BIN / FFPROBE_BIN when set (a pinned build), else whatever PATH resolves. */
export const ffmpegBin = (): string => process.env.FFMPEG_BIN || 'ffmpeg';
export const ffprobeBin = (): string => process.env.FFPROBE_BIN || 'ffprobe';

/** The resolved executable paths (null = not found), for doctor. */
export function mediaBins(): { ffmpeg: string | null; ffprobe: string | null } {
  return { ffmpeg: which(ffmpegBin()), ffprobe: which(ffprobeBin()) };
}

export interface FfmpegError extends Error {
  code: number;
  stderr: string;
}

/**
 * Run ffmpeg to completion (`-hide_banner -y` prepended). Throws with the stderr tail
 * on a non-zero exit; returns stderr, where filters (loudnorm, ebur128, blackdetect) report.
 */
export async function ffmpeg(args: readonly string[], what: string, opts: { timeoutMs?: number; input?: Uint8Array } = {}): Promise<string> {
  // -nostdin keeps ffmpeg from reading keys off stdin, unless stdin carries the input
  const head = opts.input ? ['-hide_banner', '-y'] : ['-hide_banner', '-nostdin', '-y'];
  const r = await exec(ffmpegBin(), [...head, ...args], { timeoutMs: opts.timeoutMs, input: opts.input });
  if (r.code !== 0) {
    const e = new Error(`ffmpeg ${what} failed (exit ${r.code}): ${r.stderr.trim().split('\n').slice(-12).join('\n')}`) as FfmpegError;
    e.code = r.code;
    e.stderr = r.stderr;
    throw e;
  }
  return r.stderr;
}
