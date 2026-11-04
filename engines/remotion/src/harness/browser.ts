/**
 * Remotion's browser: the Chrome Headless Shell that @remotion/renderer pins (one download per
 * repo, in <root>/node_modules/.remotion, installed by `pnpm aiv doctor --fix`). A render never
 * downloads: the executable is always passed explicitly, so Remotion's ensureBrowser sees a
 * user-defined path and a missing shell fails with the doctor command instead.
 *
 * openBrowser creates a fresh profile in the OS temp folder (puppeteer_dev_chrome_profile-*).
 * We write an owner marker into it: the heavy-job orphan sweep kills a shell of this repo only
 * when it can attribute it (the marker, or see host/orphans.ts), so a Studio render is never
 * touched, and deletes the profile if the render is killed before Remotion's own cleanup runs.
 * The GL backend is Remotion's `gl` option: 'angle' (hardware; D3D11 on Windows) or 'swangle'
 * (SwiftShader, CI only).
 *
 * With `gpuCache` (render sessions), the profile's GPU disk cache persists across calls
 * (gpuCache.ts). Remotion offers no option for the profile or for Chrome flags, so while
 * openBrowser runs, fs.promises.mkdtemp is wrapped: it links Default/GPUCache of the profile it
 * creates to the session's copy of the store, before Chrome starts. Then the WebGL renderer and
 * the driver are probed (the adapter reuses the result); a store built on another host is dropped
 * and the shell relaunched cold. Closing hands the copy back to the store once Chrome has exited.
 */
import { existsSync, promises as fsp, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { profileOwner, remotionBrowserDir, REMOTION_PROFILE_MARKER, REMOTION_PROFILE_PREFIX, softwareAllowed, type Log } from '@aiv/pipeline';
import type { HeadlessBrowser } from '@remotion/renderer';
import { gpuCacheEnabled, gpuCacheKey, openGpuCache, type GpuCacheSession, type GpuHost } from './gpuCache.ts';

const require = createRequire(import.meta.url);

export type GlChoice = 'angle' | 'swangle';

const rendererDir = () => dirname(require.resolve('@remotion/renderer/package.json'));

/** The Remotion version this adapter renders with (every remotion package is pinned to the same one). */
export const REMOTION_VERSION = (JSON.parse(readFileSync(join(rendererDir(), 'package.json'), 'utf8')) as { version: string }).version;

const PLATFORM: Partial<Record<string, string>> = { win32: 'win64', linux: process.arch === 'arm64' ? 'linux-arm64' : 'linux64', darwin: process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64' };

export interface HeadlessShell {
  /** <root>/node_modules/.remotion */
  cacheDir: string;
  executable: string;
  /** the version Remotion's renderer expects (null when it could not be read) */
  expected: string | null;
  /** the version recorded at download (VERSION file), null when absent */
  installed: string | null;
  /** the executable exists and its version is the expected one */
  ok: boolean;
}

/**
 * The renderer's pinned Chrome version. It is not part of the public API, so it is read from
 * the shipped file rather than imported (the package's exports map forbids deep imports).
 */
function expectedVersion(): string | null {
  try {
    const src = readFileSync(join(rendererDir(), 'dist', 'browser', 'get-chrome-download-url.js'), 'utf8');
    return /TESTED_VERSION = '([^']+)'/.exec(src)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Where the headless shell of this repo lives, and whether it is the one Remotion expects. */
export function headlessShell(root: string): HeadlessShell {
  const cacheDir = remotionBrowserDir(root);
  const platform = PLATFORM[process.platform];
  if (!platform) throw new Error(`Remotion's headless shell has no build for ${process.platform}`);
  const dir = join(cacheDir, 'chrome-headless-shell', platform, `chrome-headless-shell-${platform}`);
  // remotion.media builds (Linux, macOS arm64) name it headless_shell
  const alt = join(dir, 'headless_shell');
  const executable = existsSync(alt) ? alt : join(dir, platform === 'win64' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell');
  let installed: string | null;
  try {
    installed = readFileSync(join(cacheDir, 'chrome-headless-shell', 'VERSION'), 'utf8').trim();
  } catch {
    installed = null;
  }
  const expected = expectedVersion();
  const versionOk = installed !== null && (expected === null || installed === expected || installed.startsWith(`${expected}-`));
  return { cacheDir, executable, expected, installed, ok: existsSync(executable) && versionOk };
}

/** The error for a missing or outdated shell: never download in the middle of a render. */
export function shellMissing(shell: HeadlessShell): Error {
  const what = shell.installed ? `is ${shell.installed}, Remotion ${REMOTION_VERSION} expects ${shell.expected}` : 'is not installed';
  return new Error(`Remotion's Chrome Headless Shell in node_modules/.remotion ${what}: run pnpm aiv doctor --fix`);
}

/**
 * Download the headless shell Remotion expects into <root>/node_modules/.remotion (doctor --fix).
 * Remotion picks the folder from the working directory, so the call runs from the repo root;
 * progress goes to stderr (stdout may be --json).
 */
export async function installHeadlessShell(root: string): Promise<HeadlessShell> {
  const { ensureBrowser } = await import('@remotion/renderer');
  const cwd = process.cwd();
  let last = -10;
  process.chdir(root);
  try {
    await ensureBrowser({
      chromeMode: 'headless-shell',
      logLevel: 'error',
      onBrowserDownload: () => ({
        version: null,
        onProgress: ({ percent, totalSizeInBytes }) => {
          const p = Math.floor(percent * 100);
          if (p >= last + 10 || p === 100) {
            last = p;
            process.stderr.write(`[doctor] Chrome Headless Shell: ${p} % of ${(totalSizeInBytes / 2 ** 20).toFixed(0)} MB\n`);
          }
        },
      }),
    });
  } finally {
    process.chdir(cwd);
  }
  return headlessShell(root);
}

/** The --gl backend: hardware ANGLE, or SwiftShader when software GL is explicitly allowed (CI). */
export const defaultGl = (): GlChoice => (softwareAllowed() ? 'swangle' : 'angle');

const profiles = () => {
  try {
    return readdirSync(tmpdir()).filter((n) => n.startsWith(REMOTION_PROFILE_PREFIX));
  } catch {
    return [];
  }
};

// Remotion's CDP sessions resolve { value, size }, not the bare protocol result
type CdpSend = { send(method: string, params?: object): Promise<{ value: unknown }> };
const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const;
const CLOSE_TIMEOUT_MS = 5_000;

export interface OpenedBrowser {
  browser: HeadlessBrowser;
  /** e.g. "chrome-headless-shell 157.0.8080.0" */
  label: string;
  /** the shell's executable */
  executable: string;
  /** the temp profile, when it could be attributed (marker written) */
  profile: string | null;
  /** with gpuCache: the WebGL renderer and the driver, probed in this browser (the cache's host check) */
  probed?: { webgl: WebGlInfo; driver: string | undefined };
  /** with gpuCache: how the session's GPU program cache started (warm, cold or off, and why) */
  gpuCache?: string;
  /** keepGpuCache false: the session failed (a crashed shell), its cache copy is dropped, not saved */
  close(o?: { keepGpuCache?: boolean }): Promise<void>;
}

export interface OpenOptions {
  root: string;
  gl: GlChoice;
  /** device scale factor (the render scale), as Remotion's own renderMedia passes it */
  scale?: number;
  /**
   * remove the SIGINT/SIGTERM/SIGHUP handlers openBrowser installs (they process.exit at once):
   * a render's own abort handler then closes the encoder, the browser and the lock in order
   */
  dropSignalHandlers?: boolean;
  /**
   * Remotion's crash replacement (replace-browser.js) closes the browser it was given, then opens
   * a new one: unprobed, unmarked, and started after renderFrames has already rejected, so nothing
   * would close it. With this set, a close that is not this module's calls it and never settles,
   * so no replacement starts. Remotion closes a passed-in browser for nothing else.
   */
  onReplace?: () => void;
  /** keep compiled GPU programs across calls (gpuCache.ts); off with AIV_GPU_CACHE=0 */
  gpuCache?: boolean;
  log: Log;
}

/**
 * Run `open` with fs.promises.mkdtemp wrapped: the profile Remotion's openBrowser creates
 * (puppeteer_dev_chrome_profile-*) is handed to `onProfile` before Chrome is launched on it.
 * openBrowser reads fs.promises.mkdtemp at call time (dist/open-browser.js at 4.0.539); the wrap
 * is removed as soon as it returns.
 */
async function withProfileHook<T>(onProfile: (dir: string) => void, open: () => Promise<T>): Promise<T> {
  const orig = fsp.mkdtemp;
  const hooked = (async (prefix: string, options?: unknown) => {
    const dir = await (orig as (p: string, o?: unknown) => Promise<string>).call(fsp, prefix, options);
    if (basename(prefix) === REMOTION_PROFILE_PREFIX) onProfile(dir);
    return dir;
  }) as typeof fsp.mkdtemp;
  fsp.mkdtemp = hooked;
  try {
    return await open();
  } finally {
    if (fsp.mkdtemp === hooked) fsp.mkdtemp = orig;
  }
}

export async function openRemotionBrowser(o: OpenOptions): Promise<OpenedBrowser> {
  const shell = headlessShell(o.root);
  if (!shell.ok) throw shellMissing(shell);
  const { openBrowser } = await import('@remotion/renderer');
  let cache: GpuCacheSession | null = null;
  let cacheNote: string | undefined;
  if (o.gpuCache) {
    if (!gpuCacheEnabled()) cacheNote = 'off (AIV_GPU_CACHE=0)';
    else
      try {
        cache = openGpuCache(o.root, gpuCacheKey(shell.installed ?? 'unknown', o.gl));
      } catch (e) {
        cacheNote = 'off (unavailable)';
        o.log.warn(`GPU program cache unavailable, first frames compile cold: ${(e as Error).message}`);
      }
  }

  /** launch the shell: the browser, its attributed profile and Remotion's own close */
  const launch = async () => {
    const before = new Set(profiles());
    const handlers = new Map(SIGNALS.map((s) => [s, new Set(process.listeners(s))]));
    const opts = {
      browserExecutable: shell.executable,
      chromiumOptions: { gl: o.gl, headless: true },
      chromeMode: 'headless-shell' as const,
      ...(o.scale !== undefined ? { forceDeviceScaleFactor: o.scale } : {}),
      logLevel: process.env.AIV_DEBUG ? ('verbose' as const) : ('error' as const),
    };
    let linked = false;
    const link = (dir: string) => {
      try {
        cache?.link(dir);
        linked = true;
      } catch (e) {
        o.log.warn(`GPU program cache not linked into the profile, first frames compile cold: ${(e as Error).message}`);
        cache?.discard();
        cache = null;
        cacheNote = 'off (link failed)';
      }
    };
    const browser = cache ? await withProfileHook(link, () => openBrowser('chrome', opts)) : await openBrowser('chrome', opts);
    if (cache && !linked) {
      // openBrowser no longer creates its profile through fs.promises.mkdtemp (a Remotion upgrade):
      // Chrome uses a cache of its own, and an empty copy must not replace the store
      o.log.warn('GPU program cache not linked (Remotion did not create its profile through fs.promises.mkdtemp): first frames compile cold');
      cache.discard();
      cache = null;
      cacheNote = 'off (profile not seen)';
    }
    if (o.dropSignalHandlers) {
      for (const s of SIGNALS) for (const l of process.listeners(s)) if (!handlers.get(s)!.has(l)) process.removeListener(s, l as (...a: unknown[]) => void);
    }
    // attribute the profile only when exactly one appeared (we hold the heavy-job lock)
    const created = profiles().filter((n) => !before.has(n));
    let profile: string | null = null;
    if (created.length === 1) {
      profile = join(tmpdir(), created[0]);
      try {
        writeFileSync(join(profile, REMOTION_PROFILE_MARKER), `${profileOwner(o.root)}\n`);
      } catch {
        profile = null;
      }
    }
    let version = shell.installed ?? 'unknown';
    try {
      const v = (await (browser.connection as unknown as CdpSend).send('Browser.getVersion')).value as { product?: string };
      version = /\/([\d.]+)/.exec(v.product ?? '')?.[1] ?? version;
    } catch {
      /* keep the VERSION file's */
    }
    return { browser, profile, closeBrowser: browser.close.bind(browser), label: `chrome-headless-shell ${version}` };
  };

  /** close a launched shell (capped) and delete what is left of its profile; true when it exited in time */
  const shut = async (l: { profile: string | null; closeBrowser: HeadlessBrowser['close'] }): Promise<boolean> => {
    // a hung close must neither keep the event loop alive nor outlast abort.ts's 10 s cleanup cap
    // (the lock release runs after it); the orphan sweep kills a shell that did not exit
    let timer: NodeJS.Timeout | undefined;
    let exited = false;
    const cap = new Promise((r) => {
      timer = setTimeout(r, CLOSE_TIMEOUT_MS);
      timer.unref();
    });
    await Promise.race([l.closeBrowser({ silent: true }).then(() => (exited = true)), cap])
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    // Remotion deletes the profile while Chrome is still exiting; on Windows that leaves Default/
    // behind (and takes our marker with it). We created this one: remove what is left. A linked
    // Default/GPUCache is a junction (a symlink elsewhere): rmSync removes the link, not the cache.
    if (l.profile) {
      try {
        rmSync(l.profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      } catch {
        /* still held: the orphan sweep cannot attribute it any more, but it is small */
      }
    }
    return exited;
  };

  let l = await launch();
  let probed: OpenedBrowser['probed'];
  let host: GpuHost | null = null;
  const probeHost = async () => {
    probed = { webgl: await probeWebGl(l.browser), driver: await driverVersion(l.browser) };
    host = { browser: l.label, gl: o.gl, renderer: probed.webgl.renderer, driver: probed.driver ?? null };
    return host;
  };
  try {
    if (cache) {
      const c: GpuCacheSession = cache;
      const h = await probeHost();
      if (!c.serves(h)) {
        // compiled for another GPU, driver or shell: never mixed in; relaunch with an empty cache
        o.log.info(`GPU program cache was built on ${c.builtOn?.renderer ?? '?'} (driver ${c.builtOn?.driver ?? '?'}, ${c.builtOn?.browser ?? '?'}): rebuilding it for this host`);
        await shut(l);
        c.reset();
        l = await launch();
        await probeHost();
        cacheNote = 'cold (rebuilt for this host)';
      } else cacheNote = c.builtOn ? 'warm' : 'cold (new)';
    }
  } catch (e) {
    await shut(l);
    cache?.discard();
    throw e;
  }
  const { browser, profile, closeBrowser, label } = l;
  if (o.onReplace) {
    const onReplace = o.onReplace;
    browser.close = (() => {
      onReplace();
      return new Promise<void>(() => {});
    }) as typeof browser.close;
  }
  let closed = false;
  return {
    browser,
    label,
    executable: shell.executable,
    profile,
    ...(probed ? { probed } : {}),
    ...(cacheNote ? { gpuCache: cacheNote } : {}),
    async close(how?: { keepGpuCache?: boolean }) {
      if (closed) return;
      closed = true;
      const exited = await shut({ profile, closeBrowser });
      const c: GpuCacheSession | null = cache;
      if (!c) return;
      // only a browser that exited normally has written all it will (and let go of the files)
      if (exited && host && how?.keepGpuCache !== false) await c.commit(host).catch((e: Error) => o.log.warn(`GPU program cache not saved: ${e.message}`));
      c.discard();
    },
  };
}

export interface WebGlInfo {
  renderer: string | null;
  vendor: string | null;
  version: string | null;
  error?: string;
}

const WEBGL_PROBE = `(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return { renderer: null, vendor: null, version: null, error: 'no WebGL context' };
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    renderer: String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
    vendor: String(gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR)),
    version: String(gl.getParameter(gl.VERSION)),
  };
})()`;

/** The WebGL renderer a page of this browser gets (same process, same --gl flags as the render). */
export async function probeWebGl(browser: HeadlessBrowser): Promise<WebGlInfo> {
  const page = await browser.newPage({ context: () => null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {} });
  try {
    const r = (await (page._client() as unknown as CdpSend).send('Runtime.evaluate', { expression: WEBGL_PROBE, returnByValue: true })).value as { result?: { value?: WebGlInfo }; exceptionDetails?: { text?: string } };
    if (r.exceptionDetails || !r.result?.value) return { renderer: null, vendor: null, version: null, error: r.exceptionDetails?.text ?? 'the probe returned nothing' };
    return r.result.value;
  } finally {
    await page.close().catch(() => {});
  }
}

/** The display driver of the active GPU (browser-target CDP): a driver update changes pixels too. */
export async function driverVersion(browser: HeadlessBrowser): Promise<string | undefined> {
  try {
    const si = (await (browser.connection as unknown as CdpSend).send('SystemInfo.getInfo')).value as { gpu?: { devices?: { driverVendor?: string; driverVersion?: string }[] } };
    const d = si.gpu?.devices?.[0];
    return d?.driverVersion ? `${d.driverVendor ? `${d.driverVendor} ` : ''}${d.driverVersion}` : undefined;
  } catch {
    return undefined;
  }
}

export interface ProbeResult {
  browser: string;
  gl: GlChoice;
  webgl: WebGlInfo;
  seconds: number;
}

/** The doctor's GPU probe: the headless shell with the render's gl flag, one WebGL context, closed again. */
export async function probeGpu(o: { root: string; gl?: GlChoice; log: Log }): Promise<ProbeResult> {
  const t0 = Date.now();
  const gl = o.gl ?? defaultGl();
  const b = await openRemotionBrowser({ root: o.root, gl, log: o.log });
  try {
    return { browser: b.label, gl, webgl: await probeWebGl(b.browser), seconds: (Date.now() - t0) / 1000 };
  } finally {
    await b.close();
  }
}
