import type { Toolchain } from '@aiv/core';
import { ffmpegBin } from '../media/bin.ts';
import { sha256 } from './hash.ts';
import { exec } from './proc.ts';

export interface FfmpegVersion {
  /** e.g. "8.0.1-full_build-www.gyan.dev" */
  version: string;
  /** first 16 hex chars of sha256 over `ffmpeg -buildconf` (LF-normalised) */
  buildconfHash: string;
}

let ffCache: Promise<FfmpegVersion> | null = null;

/** The ffmpeg version string and build-configuration hash (two builds of one version encode differently). */
export function ffmpegVersion(): Promise<FfmpegVersion> {
  ffCache ??= (async () => {
    const v = await exec(ffmpegBin(), ['-hide_banner', '-version'], { timeoutMs: 20_000 });
    if (v.code !== 0) throw new Error(`ffmpeg -version failed (exit ${v.code}); is ffmpeg on PATH or FFMPEG_BIN set?`);
    const version = /ffmpeg version (\S+)/.exec(v.stdout)?.[1] ?? 'unknown';
    const b = await exec(ffmpegBin(), ['-hide_banner', '-buildconf'], { timeoutMs: 20_000 });
    return { version, buildconfHash: sha256((b.stdout + b.stderr).replace(/\r\n/g, '\n').trim()).slice(0, 16) };
  })();
  return ffCache;
}

let pnpmCache: Promise<string | undefined> | null = null;

/** pnpm version: from the user agent pnpm sets for scripts, else `pnpm --version`. */
export function pnpmVersion(): Promise<string | undefined> {
  pnpmCache ??= (async () => {
    const ua = /\bpnpm\/(\S+)/.exec(process.env.npm_config_user_agent ?? '')?.[1];
    if (ua) return ua;
    try {
      const r = await exec('pnpm', ['--version'], { timeoutMs: 20_000 });
      return r.code === 0 ? r.stdout.trim() : undefined;
    } catch {
      return undefined;
    }
  })();
  return pnpmCache;
}

/**
 * The toolchain fingerprint recorded in render.json and release manifests. Versions and a coarse
 * host class only: never a hostname, user name or path.
 */
export async function toolchain(extra: { browser?: string; gpu?: string } = {}): Promise<Toolchain> {
  const [ff, pnpm] = await Promise.all([ffmpegVersion(), pnpmVersion()]);
  return {
    node: process.version,
    ...(pnpm ? { pnpm } : {}),
    ffmpeg: ff.version,
    ffmpegBuildconfHash: ff.buildconfHash,
    ...(extra.browser ? { browser: extra.browser } : {}),
    os: process.platform,
    arch: process.arch,
    ...(extra.gpu ? { gpu: extra.gpu } : {}),
  };
}
