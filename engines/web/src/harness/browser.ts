// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/browser.ts
/**
 * The capture browser. Default: the Chrome for Testing build that the pinned playwright-core
 * downloads, kept in the repo's .cache/browsers, so pixels never change behind our back with a
 * Chrome auto-update. `system` uses the installed Google Chrome (not pinned: warned).
 *
 * New headless, a persistent profile per run under .cache/browser-profiles/ (the shader cache
 * stays warm across resumed calls, and the orphan sweep recognises it), WebGL through ANGLE
 * (D3D11 on Windows), anti-throttling flags, and fail-fast collection of page errors.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { browserProfilesDir, type Log } from '@aiv/pipeline';
import type { BrowserContext, CDPSession, ConsoleMessage, Page } from 'playwright-core';

export type BrowserChoice = 'pinned' | 'system';

const require = createRequire(import.meta.url);

/** The installed playwright-core package folder (it lives under engines/web/node_modules). */
export const playwrightDir = (): string => dirname(require.resolve('playwright-core/package.json'));

export const browsersDir = (root: string): string => join(root, '.cache', 'browsers');

export interface PinnedBrowser {
  /** Chrome for Testing version, e.g. "156.0.8078.4" */
  version: string;
  /** playwright's revision folder (chromium-<revision>) */
  revision: string;
  playwright: string;
  executable: string;
  installed: boolean;
}

const EXE: Partial<Record<string, string[]>> = {
  win32: ['chrome-win64', 'chrome.exe'],
  linux: ['chrome-linux64', 'chrome'],
  darwin: [process.arch === 'arm64' ? 'chrome-mac-arm64' : 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
};

/** What the pinned playwright-core installs as 'chromium', and whether it is in .cache/browsers. */
export function pinnedBrowser(root: string): PinnedBrowser {
  const dir = playwrightDir();
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version: string };
  const list = JSON.parse(readFileSync(join(dir, 'browsers.json'), 'utf8')) as { browsers: { name: string; revision: string; browserVersion: string }[] };
  const c = list.browsers.find((b) => b.name === 'chromium');
  if (!c) throw new Error(`playwright-core ${pkg.version} lists no chromium build`);
  const tokens = EXE[process.platform];
  if (!tokens) throw new Error(`no Chrome for Testing build for ${process.platform}`);
  const executable = join(browsersDir(root), `chromium-${c.revision}`, ...tokens);
  return { version: c.browserVersion, revision: c.revision, playwright: pkg.version, executable, installed: existsSync(executable) };
}

/** The installed Google Chrome that `--browser system` would use (Playwright's 'chrome' channel), if any. */
export function systemChrome(): { found: boolean; version?: string } {
  const env = process.env;
  const candidates =
    process.platform === 'win32'
      ? [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean).map((d) => join(d!, 'Google', 'Chrome', 'Application', 'chrome.exe'))
      : process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        : ['/opt/google/chrome/chrome'];
  const exe = candidates.find((p) => existsSync(p));
  if (!exe) return { found: false };
  // Windows keeps the build in a version-named folder next to chrome.exe
  const version = process.platform === 'win32' ? readdirSync(dirname(exe)).find((d) => /^\d+\.\d+\.\d+\.\d+$/.test(d)) : undefined;
  return { found: true, ...(version ? { version } : {}) };
}

/** The install command for the pinned build (Chrome for Testing only, no headless shell): file, args, env. */
export function installCommand(root: string): { file: string; args: string[]; env: NodeJS.ProcessEnv } {
  return {
    file: process.execPath,
    args: [join(playwrightDir(), 'cli.js'), 'install', 'chromium', '--no-shell'],
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersDir(root) },
  };
}

/**
 * Chrome honours only the LAST --disable-features switch, and Playwright passes its own list
 * (chromiumSwitches.ts). Ours must be a superset or it silently re-enables Translate,
 * OptimizationHints, MediaRouter… (memory and background work). This is playwright-core
 * 1.64.1's list; browser.test.ts fails when an upgrade adds to it.
 */
export const PLAYWRIGHT_DISABLED_FEATURES = [
  'AvoidUnnecessaryBeforeUnloadCheckSync',
  'DestroyProfileOnBrowserClose',
  'DialMediaRouteProvider',
  'GlobalMediaControls',
  'HttpsUpgrades',
  'LensOverlay',
  'MediaRouter',
  'PaintHolding',
  'ThirdPartyStoragePartitioning',
  'BlockOriginHeaderModificationOnRedirect',
  'AvoidCorsURLLoaderRestartOnRedirect',
  'Translate',
  'AutoDeElevate',
  'OptimizationHints',
  'NetworkTimeServiceQuerying',
  'AimEnabled',
  'msForceBrowserSignIn',
  'msEdgeUpdateLaunchServicesPreferredVersion',
];
// occlusion tracking can mark a headless window hidden and throttle it on Windows
const OUR_DISABLED_FEATURES = ['CalculateNativeWinOcclusion'];

/** The Chrome switches, besides the ones Playwright adds itself. */
export function chromeArgs(platform: NodeJS.Platform = process.platform): string[] {
  return [
    // WebGL through ANGLE's D3D11 backend: the hardware path on Windows (Remotion's --gl=angle)
    ...(platform === 'win32' ? ['--use-angle=d3d11'] : platform === 'darwin' ? ['--use-angle=metal'] : []),
    '--ignore-gpu-blocklist',
    // WebGPU in headless needs these on Windows (MAP: hardware WebGPU on the Ice Lake iGPU)
    '--enable-unsafe-webgpu',
    '--enable-webgpu-developer-features',
    `--disable-features=${[...PLAYWRIGHT_DISABLED_FEATURES, ...OUR_DISABLED_FEATURES].join(',')}`,
    // a capture page is never "in the background": no timer or renderer throttling
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--force-device-scale-factor=1',
    // pixels in sRGB as written, whatever the display profile; glyphs without hinting differences
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
  ];
}

export interface LaunchOptions {
  root: string;
  /** profile folder name under .cache/browser-profiles/ (one per run) */
  profile: string;
  browser: BrowserChoice;
  width: number;
  height: number;
  headed?: boolean;
  log: Log;
}

export interface LaunchedBrowser {
  context: BrowserContext;
  page: Page;
  /** e.g. "chrome-for-testing 156.0.8078.4" or "chrome 156.0.8078.76 (system, not pinned)" */
  label: string;
  version: string;
  close(): Promise<void>;
}

/** playwright-core reads PLAYWRIGHT_BROWSERS_PATH once, when it is first imported. */
async function playwright(root: string) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = browsersDir(root);
  return import('playwright-core');
}

export async function launchBrowser(o: LaunchOptions): Promise<LaunchedBrowser> {
  if (o.browser === 'pinned') {
    const pin = pinnedBrowser(o.root);
    if (!pin.installed) throw new Error(`the pinned browser (Chrome for Testing ${pin.version}) is not installed in .cache/browsers: run pnpm aiv doctor --fix`);
  } else {
    o.log.warn('--browser system: the installed Google Chrome is not pinned; an auto-update changes pixels and refuses resumes');
  }
  const { chromium } = await playwright(o.root);
  const userDataDir = join(browserProfilesDir(o.root), o.profile);
  mkdirSync(userDataDir, { recursive: true });
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: o.browser === 'pinned' ? 'chromium' : 'chrome',
    headless: !o.headed,
    viewport: { width: o.width, height: o.height },
    deviceScaleFactor: 1,
    args: chromeArgs(),
    // a capture page is local and trusted; nothing to download, no service workers
    acceptDownloads: false,
    serviceWorkers: 'block',
  });
  const version = context.browser()?.version() ?? 'unknown';
  const label = o.browser === 'pinned' ? `chrome-for-testing ${version}` : `chrome ${version} (system, not pinned)`;
  const page = context.pages()[0] ?? (await context.newPage());
  let closed = false;
  return {
    context,
    page,
    label,
    version,
    async close() {
      if (closed) return;
      closed = true;
      await Promise.race([context.close(), new Promise((r) => setTimeout(r, 15_000))]).catch(() => {});
    },
  };
}

/**
 * Fail-fast watch over a page: page errors, crashes, console errors and failed requests for
 * the page's own code or assets reject `fatal`; the recent console lines go into every error.
 */
export interface PageWatch {
  fatal: Promise<never>;
  /** the last console lines (for error messages) */
  tail(): string;
  dispose(): void;
}

// requests whose failure means the page is not the page we meant to capture
const ESSENTIAL = new Set(['document', 'script', 'stylesheet', 'font', 'image', 'fetch', 'xhr', 'media']);

export function watchPage(page: Page, log: Log): PageWatch {
  const lines: string[] = [];
  const warned = new Set<string>();
  let fail!: (e: Error) => void;
  const fatal = new Promise<never>((_, reject) => (fail = reject));
  fatal.catch(() => {});
  const push = (l: string) => {
    lines.push(l);
    if (lines.length > 30) lines.shift();
  };
  const onConsole = (m: ConsoleMessage) => {
    const text = m.text();
    push(`${m.type()}: ${text}`);
    // first line, each distinct warning once (D3D compiler notes repeat per shader program)
    const first = text.split('\n')[0];
    if (m.type() === 'warning' && !warned.has(first)) {
      warned.add(first);
      log.warn(`page: ${first}${text.includes('\n') ? ' …' : ''}`);
    }
    // resource errors are judged by type below (a missing favicon is not a broken page)
    if (m.type() === 'error' && !text.startsWith('Failed to load resource')) fail(new Error(`page console error: ${text}`));
  };
  const onError = (e: Error) => fail(new Error(`page error: ${e.message}`));
  const onCrash = () => fail(new Error('the page crashed (renderer or GPU process gone; low memory?)'));
  const onClose = () => fail(new Error('the page closed'));
  const onFailed = (r: import('playwright-core').Request) => {
    if (ESSENTIAL.has(r.resourceType())) fail(new Error(`request failed: ${r.method()} ${r.url()} (${r.failure()?.errorText ?? 'unknown'})`));
  };
  const onResponse = (r: import('playwright-core').Response) => {
    if (r.status() >= 400 && ESSENTIAL.has(r.request().resourceType())) fail(new Error(`HTTP ${r.status()} for ${r.request().resourceType()} ${r.url()}`));
  };
  page.on('console', onConsole);
  page.on('pageerror', onError);
  page.on('crash', onCrash);
  page.on('close', onClose);
  page.on('requestfailed', onFailed);
  page.on('response', onResponse);
  return {
    fatal,
    tail: () => lines.join('\n'),
    dispose() {
      page.off('console', onConsole);
      page.off('pageerror', onError);
      page.off('crash', onCrash);
      page.off('close', onClose);
      page.off('requestfailed', onFailed);
      page.off('response', onResponse);
    },
  };
}

/** A V8 garbage collector on demand: readback buffers otherwise pile up on a 7.6 GB host. */
export async function gcSession(context: BrowserContext, page: Page): Promise<() => Promise<void>> {
  let cdp: CDPSession | null = null;
  try {
    cdp = await context.newCDPSession(page);
  } catch {
    return async () => {};
  }
  return async () => {
    try {
      await cdp!.send('HeapProfiler.collectGarbage');
    } catch {
      /* best effort */
    }
  };
}

/** Race a promise against a timeout and the page's fatal errors. */
export async function guarded<T>(p: Promise<T>, watch: PageWatch, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`timeout after ${ms / 1000} s: ${what}`)), ms)));
  try {
    return await Promise.race([p, timeout, watch.fatal]);
  } finally {
    clearTimeout(timer);
  }
}
