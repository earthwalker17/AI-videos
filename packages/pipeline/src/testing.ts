/**
 * Test fixtures shared by the pipeline's tests and by engine tests: a throwaway repo layout in
 * the OS temp folder and a fake engine adapter that synthesises deterministic RGBA frames
 * (optionally with the swatch strip), in both adapter styles.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paintSwatches, type VideoConfig } from '@aiv/core';
import { SHARED_AUDIO_ROOTS } from './audio/hash.ts';
import { ChunkEncoder } from './media/encoder.ts';
import type { EngineAdapter, EngineSession, FrameSpan } from './runner/engine.ts';
import { repoRoot } from './util/paths.ts';

export interface TempRepo {
  root: string;
  /** write a repo-relative file */
  write(rel: string, content: string): string;
  cleanup(): void;
}

/** A minimal repo root (pnpm-workspace.yaml + lockfile) with one video folder `videos/<slug>`. */
export function tempRepo(video: Partial<VideoConfig> & { slug?: string } = {}): TempRepo {
  const root = mkdtempSync(join(tmpdir(), 'aiv-test-'));
  const write = (rel: string, content: string) => {
    const abs = join(root, ...rel.split('/'));
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content);
    return abs;
  };
  write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
  write('pnpm-lock.yaml', "lockfileVersion: '9.0'\n");
  write('packages/core/src/index.ts', 'export const x = 1;\n');
  const slug = video.slug ?? 'demo';
  const config: VideoConfig = { slug, title: 'Demo', engine: 'fake', entry: 'src/index.ts', format: { width: 320, height: 180, fps: 30 }, ...video };
  write(`videos/${slug}/video.json`, `${JSON.stringify(config, null, 2)}\n`);
  write(`videos/${slug}/src/index.ts`, 'export const scene = 1;\n');
  return { root, write, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/**
 * Copy this repository's score runtime and @aiv/core into a scratch repo, for tests that run
 * the audio stage there: the score runs on this repository's runtime, and the stage refuses it
 * unless the target's hashed copies are the same bytes (audio/hash.ts sharedCodeMismatches).
 */
export function withAudioRuntime(repo: TempRepo): TempRepo {
  const code = repoRoot(dirname(fileURLToPath(import.meta.url)));
  for (const rel of SHARED_AUDIO_ROOTS) cpSync(join(code, ...rel.split('/')), join(repo.root, ...rel.split('/')), { recursive: true });
  return repo;
}

/** A deterministic synthetic frame: moving gradient + frame-index bars; swatches when asked. */
export function syntheticFrame(i: number, width: number, height: number, swatches: boolean): Uint8Array {
  const buf = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      buf[o] = (x * 3 + i * 5) & 255;
      buf[o + 1] = (y * 4 + i * 3) & 255;
      buf[o + 2] = ((x + y) * 2 + i * 7) & 255;
      buf[o + 3] = 255;
    }
  }
  if (swatches) paintSwatches(buf, width, height);
  return buf;
}

export interface FakeAdapterOptions {
  frames: number;
  style?: 'stream' | 'file';
  /** frames [start, end) that show the swatch strip */
  swatchFrames?: FrameSpan;
  /** advance this clock per frame (ms), so budget logic is testable without sleeping */
  clock?: { t: number };
  frameMs?: number | ((i: number) => number);
  /** throw when asked for this frame (simulated crash) */
  failAt?: number;
  adapterVersion?: string;
  info?: { browser?: string; gpu?: string };
  /** adapter settings (like the web engine's browser choice) */
  settings?: Record<string, string>;
  /** open() fails (a missing browser, a refused GPU) */
  failOpen?: boolean;
}

export interface FakeAdapter extends EngineAdapter {
  /** frames rendered so far, across sessions */
  rendered: number[];
  opened: number;
}

export function fakeAdapter(o: FakeAdapterOptions): FakeAdapter {
  const rendered: number[] = [];
  const adapter: FakeAdapter = {
    name: 'fake',
    version: '1.0.0',
    adapterVersion: o.adapterVersion ?? '1',
    rendered,
    opened: 0,
    ...(o.settings ? { settings: o.settings } : {}),
    async open(ctx) {
      if (o.failOpen) throw new Error('simulated open failure');
      adapter.opened++;
      const frame = (i: number) => {
        if (o.failAt === i) throw new Error(`simulated crash at frame ${i}`);
        const ms = typeof o.frameMs === 'function' ? o.frameMs(i) : (o.frameMs ?? 0);
        if (o.clock) o.clock.t += ms;
        rendered.push(i);
        const sw = !!o.swatchFrames && i >= o.swatchFrames[0] && i < o.swatchFrames[1];
        return { rgba: syntheticFrame(i, ctx.width, ctx.height, sw), ms };
      };
      const session: EngineSession = {
        durationFrames: o.frames,
        info: o.info ?? { browser: 'fake-browser 1', gpu: 'fake-gpu' },
        async close() {},
      };
      if ((o.style ?? 'stream') === 'stream') {
        session.renderFrames = async ([a, b], onFrame) => {
          for (let i = a; i < b; i++) {
            const f = frame(i);
            await onFrame(i, f.rgba, { ms: f.ms });
          }
        };
      } else {
        session.output = { ext: '.mkv', color: { space: 'rgb', range: 'pc' } };
        session.renderChunkFile = async ([a, b], outFile) => {
          const enc = new ChunkEncoder({ width: ctx.width, height: ctx.height, fps: ctx.fps, out: outFile });
          try {
            for (let i = a; i < b; i++) await enc.write(frame(i).rgba);
            await enc.finish();
          } catch (e) {
            await enc.abort();
            throw e;
          }
        };
      }
      return session;
    },
  };
  return adapter;
}
