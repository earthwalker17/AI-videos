/**
 * The GPU program cache across calls: Chrome's compiled WebGL programs, kept from one aiv call to
 * the next, so a scene's first frame does not compile every shader again.
 *
 * Why: under ANGLE (D3D11 on the reference host) a WebGL program is translated to HLSL and
 * compiled by the D3D compiler when it is linked, and that dominates a heavy scene's first draw
 * (halloween-gift's V2 film: about a minute for its programs). Chrome already stores every linked
 * program's binary in the profile's GPU disk cache (Default/GPUCache) and loads it back into the
 * GPU process, where ANGLE takes the binary instead of compiling; within one browser session that
 * is why a later page of the same scene starts much faster. But Remotion's openBrowser makes a new
 * temp profile per call, so every call started cold.
 *
 * How: the persistent store is .cache/remotion-gpu/<shell version>-<gl>/store (local, never in
 * git). Each session copies it to its own working folder (work-<pid>-<n>), and browser.ts links the
 * new profile's Default/GPUCache to that folder (a junction on Windows) before Chrome starts, so
 * Chrome reads and writes the copy. After the browser exited, the copy replaces the store (a
 * session whose shell crashed keeps the old store). Render sessions hold the heavy-job lock, so a
 * store is not replaced concurrently, and with a copy per session no two browsers ever share
 * Chrome's cache files (its disk cache is single-process). A killed session leaves its working
 * folder behind; the next session deletes working folders whose process is gone. Deleting
 * .cache/remotion-gpu, or AIV_GPU_CACHE=0, only makes first frames cold again.
 *
 * Why the pixels do not change: a cached entry is the binary the same compiler produced for the
 * same shader source and options (ANGLE keys it by them and rejects a binary of another ANGLE build
 * or GPU), so the GPU runs the same code either way. The store also records the host it was built
 * on (browser, gl, WebGL renderer, driver): a session on another one (a driver update) discards it
 * and relaunches cold (browser.ts), so a store only ever serves the host that wrote it.
 *
 * Measured on the reference host 2026-11-05 (Chrome Headless Shell 157.0.8080.0, ANGLE D3D11,
 * Intel UHD): halloween-gift's V2 world (82 programs, 102 textures) took 119-225 s from the commit
 * to the end of its first draw in a fresh browser; with a warm store, 6.7 s. The store held 99
 * entries, 2.2 MB. adapter.test.ts renders a shader-heavy fixture with the cache off, on and warm
 * and requires the same frame hashes; FilmV2 frames rendered warm hashed as the pre-cache
 * baseline (236, 594) and as the same frames rendered with the cache off (82, 130, 1214).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The host a store was built on: a store serves only the same one. */
export interface GpuHost {
  browser: string;
  gl: string;
  renderer: string | null;
  driver: string | null;
}

export const gpuCacheRoot = (root: string): string => join(root, '.cache', 'remotion-gpu');

/** AIV_GPU_CACHE=0 turns the cache off (every first frame cold, as before it existed). */
export const gpuCacheEnabled = (): boolean => process.env.AIV_GPU_CACHE !== '0';

const STORE = 'store';
const HOST = 'store.json';
// a session's working copy, and a store being replaced (left behind only by a killed process)
const WORK = /^(?:work|old)-(\d+)-\d+$/;

const alive = (pid: number): boolean => {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM: it exists, owned by someone else
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const sameHost = (a: GpuHost, b: GpuHost) => a.browser === b.browser && a.gl === b.gl && a.renderer === b.renderer && a.driver === b.driver;

/** Rename with retries: on Windows a just-killed browser can hold its files for a moment. */
async function renameRetry(from: string, to: string): Promise<void> {
  for (let k = 0; ; k++) {
    try {
      renameSync(from, to);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (k >= 20 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw e;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

let serial = 0;

export interface GpuCacheSession {
  /** the working copy this session's Chrome uses as Default/GPUCache */
  readonly work: string;
  /** the host the seeded store was built on (null: there was none, the session starts cold) */
  readonly builtOn: GpuHost | null;
  /** link a fresh profile's Default/GPUCache to the working copy (before Chrome starts) */
  link(profile: string): void;
  /** the seeded store was built on this host (or there was none) */
  serves(host: GpuHost): boolean;
  /** drop the store and the working copy, and start an empty one (another host's store) */
  reset(): void;
  /** after the browser exited: the working copy becomes the store, stamped with the host */
  commit(host: GpuHost): Promise<void>;
  /** drop the working copy, keep the store as it was */
  discard(): void;
}

/** The cache folder of one browser build and gl backend, e.g. 157.0.8080.0-angle. */
export const gpuCacheKey = (browserVersion: string, gl: string): string => `${browserVersion}-${gl}`.replace(/[^\w.-]/g, '_');

/**
 * Open a session on the store of `key`: delete working folders of dead processes, copy the store
 * (if any) to a new working folder.
 */
export function openGpuCache(root: string, key: string): GpuCacheSession {
  const base = join(gpuCacheRoot(root), key);
  mkdirSync(base, { recursive: true });
  for (const name of readdirSync(base)) {
    const m = WORK.exec(name);
    if (m && !alive(Number(m[1]))) rmSync(join(base, name), { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
  const store = join(base, STORE);
  const work = join(base, `work-${process.pid}-${serial++}`);
  let builtOn: GpuHost | null = null;
  try {
    builtOn = JSON.parse(readFileSync(join(base, HOST), 'utf8')) as GpuHost;
  } catch {
    builtOn = null;
  }
  // a store without its host record is not trusted
  if (existsSync(store) && builtOn) cpSync(store, work, { recursive: true });
  else {
    builtOn = null;
    mkdirSync(work, { recursive: true });
  }
  let done = false;
  return {
    work,
    get builtOn() {
      return builtOn;
    },
    link(profile: string) {
      mkdirSync(join(profile, 'Default'), { recursive: true });
      symlinkSync(work, join(profile, 'Default', 'GPUCache'), process.platform === 'win32' ? 'junction' : 'dir');
    },
    serves(host: GpuHost) {
      return builtOn === null || sameHost(builtOn, host);
    },
    reset() {
      rmSync(join(base, HOST), { force: true });
      rmSync(store, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      mkdirSync(work, { recursive: true });
      builtOn = null;
    },
    async commit(host: GpuHost) {
      if (done) return;
      done = true;
      const old = join(base, `old-${process.pid}-${serial++}`);
      const hadStore = existsSync(store);
      if (hadStore) await renameRetry(store, old);
      try {
        await renameRetry(work, store);
      } catch (e) {
        if (hadStore) renameSync(old, store);
        rmSync(work, { recursive: true, force: true });
        throw e;
      }
      writeFileSync(join(base, HOST), `${JSON.stringify(host, null, 2)}\n`);
      if (hadStore) rmSync(old, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    },
    discard() {
      if (done) return;
      done = true;
      rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    },
  };
}
