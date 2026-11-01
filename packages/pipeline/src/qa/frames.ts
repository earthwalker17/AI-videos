/**
 * Decoded-frame hashes: the determinism check compares pixels, not files (two encodes of the
 * same frames can differ in bytes; the decoded pixels must not, on the same host).
 */
import { ffmpegBin } from '../media/bin.ts';
import { probe } from '../media/probe.ts';
import { exec } from '../util/proc.ts';

/** rgb24 for comparing files; rgba to compare with the RGBA an engine delivered (alpha becomes 255). */
export type HashPixFmt = 'rgb24' | 'rgba';

/**
 * Filter that turns the decoded frames into RGB with a fixed conversion: YUV files are read
 * with their tagged matrix (BT.709 when untagged) and range, so two files are compared under
 * the same rules.
 */
export async function toRgbFilter(file: string, pixFmt: HashPixFmt = 'rgb24'): Promise<string> {
  const v = (await probe(file)).video;
  if (!v) throw new Error(`${file} has no video stream`);
  const yuv = /^(yuv|yuvj|nv|p0)/.test(v.pixFmt ?? '');
  if (!yuv) return `format=${pixFmt}`;
  const matrix = v.colorSpace === 'bt470bg' || v.colorSpace === 'smpte170m' ? 'bt601' : 'bt709';
  const range = v.colorRange === 'pc' || /^yuvj/.test(v.pixFmt ?? '') ? 'pc' : 'tv';
  return `scale=in_color_matrix=${matrix}:in_range=${range}:out_range=pc:flags=accurate_rnd+full_chroma_int,format=${pixFmt}`;
}

/** Parse framehash muxer output: one hash per frame, in output order. */
export function parseFramehash(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').pop()!.trim());
}

/** sha256 of every decoded frame (rgb24 or rgba) of a file, in order. */
export async function allFrameHashes(file: string, pixFmt: HashPixFmt = 'rgb24'): Promise<string[]> {
  const vf = await toRgbFilter(file, pixFmt);
  const r = await exec(ffmpegBin(), ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', file, '-map', '0:v:0', '-vf', vf, '-fps_mode', 'passthrough', '-f', 'framehash', '-hash', 'sha256', '-'], {
    timeoutMs: 30 * 60_000,
  });
  if (r.code !== 0) throw new Error(`frame hashing failed for ${file}: ${r.stderr.trim().split('\n').slice(-3).join(' ')}`);
  return parseFramehash(r.stdout);
}

/** sha256 of the decoded frames (rgb24 or rgba) at `frameIndices` (0-based decode order). */
export async function decodedFrameHashes(file: string, frameIndices: readonly number[], pixFmt: HashPixFmt = 'rgb24'): Promise<{ i: number; sha256: string }[]> {
  const want = [...new Set(frameIndices)].sort((a, b) => a - b);
  if (!want.length) return [];
  // a long select expression would hit the Windows command-line limit: hash everything instead
  if (want.length > 48) {
    const all = await allFrameHashes(file, pixFmt);
    return want.map((i) => ({ i, sha256: all[i] ?? '' })).filter((x) => x.sha256);
  }
  const select = `select=${want.map((i) => `eq(n\\,${i})`).join('+')}`;
  const vf = `${select},${await toRgbFilter(file, pixFmt)}`;
  const r = await exec(
    ffmpegBin(),
    ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', file, '-map', '0:v:0', '-vf', vf, '-fps_mode', 'passthrough', '-frames:v', String(want.length), '-f', 'framehash', '-hash', 'sha256', '-'],
    { timeoutMs: 30 * 60_000 },
  );
  if (r.code !== 0) throw new Error(`frame hashing failed for ${file}: ${r.stderr.trim().split('\n').slice(-3).join(' ')}`);
  const hashes = parseFramehash(r.stdout);
  return hashes.map((sha256, k) => ({ i: want[k], sha256 }));
}
