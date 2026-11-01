// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/session.ts
/**
 * The web engine adapter for the shared chunk runner (streaming style). open() starts the page
 * server and the browser, loads <entry>?w=&h=&fps= and waits for window.__aiv.ready; each frame
 * is one page.evaluate(renderFrame(i)) whose bytes arrive through the frame sink and go straight
 * to the runner's onFrame (the page's fetch waits for it: backpressure end to end).
 *
 * The runner holds the heavy-job lock around all of this (the aiv render command takes it), so
 * closing may sweep every browser on a .cache/browser-profiles/ profile: they are all ours.
 *
 * Every file the page loads must be covered by the input hash (EngineOpenContext.inputRoots):
 * after ready, and after every frame range, the files the server handed out are checked, and a
 * page that pulled in anything else fails instead of rendering pixels the hash does not pin.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { EXIT, ExitError } from '@aiv/core';
import { filesOutsideHash, sha256, sweepOrphans, type EngineAdapter, type EngineInfo, type EngineOpenContext, type EngineSession, type FrameSpan } from '@aiv/pipeline';
import type { BrowserContext } from 'playwright-core';
import type { FrameResult, PageMeta } from '../page/index.ts';
import { gcSession, guarded, launchBrowser, watchPage, type BrowserChoice, type LaunchedBrowser, type PageWatch } from './browser.ts';
import { judgeGpu, softwareAllowed } from './gpu.ts';
import { startPageServer, type PageServer } from './server.ts';

/** Part of the input hash. The harness and page runtime are hashed as files, so this only needs a bump for a change outside them. */
export const ADAPTER_VERSION = '1';

export const ENGINE_VERSION = (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version;

const LOAD_TIMEOUT_MS = 120_000;
const READY_TIMEOUT_MS = 240_000;
const FRAME_TIMEOUT_MS = 120_000;
// a full V8 GC every N frames: readback ArrayBuffers otherwise accumulate (MAP: every 24)
const GC_EVERY = 24;

export interface WebAdapterOptions {
  /** 'pinned' (default): Chrome for Testing from .cache/browsers; 'system': installed Chrome */
  browser?: BrowserChoice;
  /** show the browser window (debugging) */
  headed?: boolean;
}

/** The display driver of the active GPU (browser-target CDP): a driver update changes pixels too. */
async function driverVersion(context: BrowserContext): Promise<string | undefined> {
  try {
    const cdp = await context.browser()?.newBrowserCDPSession();
    if (!cdp) return undefined;
    const si = (await cdp.send('SystemInfo.getInfo')) as { gpu?: { devices?: { driverVendor?: string; driverVersion?: string }[] } };
    await cdp.detach().catch(() => {});
    const d = si.gpu?.devices?.[0];
    return d?.driverVersion ? `${d.driverVendor ? `${d.driverVendor} ` : ''}${d.driverVersion}` : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Served files the input hash does not cover (@aiv/pipeline filesOutsideHash). Vite's pre-bundle
 * of third-party code (the cache folder) is pinned by the lockfile line, like node_modules.
 */
export function unhashedFiles(files: readonly string[], root: string, roots: readonly string[], cacheDir: string): string[] {
  const rel = (f: string) => relative(cacheDir, f);
  return filesOutsideHash(files, root, roots).filter((f) => rel(f).startsWith('..') || isAbsolute(rel(f)));
}

async function openSession(ctx: EngineOpenContext, opts: WebAdapterOptions): Promise<EngineSession> {
  const { target, root, log, width, height, fps } = ctx;
  const entry = resolve(target.dir, target.config.entry);
  if (!/\.html?$/i.test(entry)) throw new ExitError(EXIT.USAGE, `web engine: entry '${target.config.entry}' must be an .html page`);
  if (!existsSync(entry)) throw new Error(`web engine: ${target.relDir}/${target.config.entry} does not exist`);

  let server: PageServer | null = null;
  let browser: LaunchedBrowser | null = null;
  let watch: PageWatch | null = null;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    watch?.dispose();
    await browser?.close();
    await server?.close().catch(() => {});
    // a crashed or timed-out browser leaves children behind on Windows
    await sweepOrphans({ root, log }).catch(() => {});
  };
  const withTail = (e: unknown): Error => {
    const err = e instanceof Error ? e : new Error(String(e));
    const tail = watch?.tail();
    if (tail && !err.message.includes('page console')) err.message += `\n  page console (last lines):\n    ${tail.split('\n').join('\n    ')}`;
    return err;
  };

  try {
    server = await startPageServer({ root, pageDir: dirname(entry), entry, cacheKey: target.slug, log });
    const choice = opts.browser ?? 'pinned';
    // one profile per run, and never shared between Chrome builds (a newer build migrates it)
    const profile = `web-${target.slug}-${ctx.profile.name}${choice === 'system' ? '-system' : ''}`;
    browser = await launchBrowser({ root, profile, browser: choice, width, height, headed: opts.headed, log });
    const { page, context } = browser;
    watch = watchPage(page, log);
    const w = watch;
    let loads = 0;
    page.on('load', () => loads++);
    const srv = server;
    // a re-bundle or a reload mid-session means the page may no longer run the code we loaded
    const assertStable = () => {
      const re = srv.reoptimized();
      if (re) throw new Error(`Vite re-bundled dependencies during the capture ("${re}"): the page may now hold two copies of a module. Import the dependency statically from the entry.`);
      if (loads > 1) throw new Error('the page reloaded during the capture');
    };
    const assertHashed = () => {
      const bad = unhashedFiles(srv.servedFiles(), root, ctx.inputRoots, srv.cacheDir);
      if (bad.length) {
        const list = bad.slice(0, 5).map((f) => (relative(root, f).startsWith('..') ? f : relative(root, f).split(sep).join('/')));
        throw new Error(
          `the page loaded ${bad.length} file(s) the input hash does not cover: ${list.join(', ')}${bad.length > 5 ? ', …' : ''}. Keep page files under ${target.relDir}/src or assets (shared code under packages/<name>/src or styles/), or a resume could mix two versions of the video.`,
        );
      }
    };

    const url = `${server.url}/${basename(entry)}?w=${width}&h=${height}&fps=${fps}`;
    await guarded(page.goto(url, { waitUntil: 'load', timeout: LOAD_TIMEOUT_MS }), w, LOAD_TIMEOUT_MS + 5000, `loading ${target.config.entry}`);
    await guarded(page.waitForFunction(() => Boolean(window.__aiv), undefined, { timeout: LOAD_TIMEOUT_MS }), w, LOAD_TIMEOUT_MS + 5000, 'window.__aiv (does the page call installCapture?)');
    await guarded(page.evaluate(() => window.__aiv!.ready), w, READY_TIMEOUT_MS, 'window.__aiv.ready');
    const meta: PageMeta = await page.evaluate(() => window.__aiv!.meta);
    if (meta.width !== width || meta.height !== height) throw new Error(`the page renders ${meta.width}x${meta.height}, the run asks for ${width}x${height}: read the size with pageParams()`);
    if (meta.fps !== fps) throw new Error(`the page runs at ${meta.fps} fps, video.json says ${fps}: read the rate with pageParams()`);
    assertStable();
    assertHashed();
    // QA measures the swatch strip at video.json's frames: they must be the frames the page draws it on
    const qaSwatch = target.config.qa?.swatchFrames;
    const pageSwatch = meta.swatchFrames ?? null;
    if (pageSwatch && qaSwatch && (pageSwatch[0] !== qaSwatch[0] || pageSwatch[1] !== qaSwatch[1]))
      throw new Error(`the page draws the swatch strip on frames [${pageSwatch.join(', ')}), video.json qa.swatchFrames says [${qaSwatch.join(', ')}): QA would measure other content. Make them agree.`);
    if (qaSwatch && !pageSwatch) log.warn('video.json sets qa.swatchFrames, but the page does not declare swatchFrames in installCapture: nothing checks that they agree');
    if (pageSwatch && !qaSwatch) log.warn(`the page draws a swatch strip on frames [${pageSwatch.join(', ')}), but video.json has no qa.swatchFrames: QA will not verify colour`);

    const gpu = await page.evaluate(() => window.__aiv!.info());
    const verdict = judgeGpu(gpu, meta.gpu);
    if (!verdict.hardware) {
      const msg = `${meta.gpu} runs on software rendering (${verdict.detail}): slow, and other pixels than the hardware path`;
      if (!softwareAllowed()) throw new Error(`${msg}. Check the GPU driver and pnpm aiv doctor; set AIV_ALLOW_SOFTWARE_GL=1 only on a GPU-less CI runner.`);
      log.warn(`${msg} (allowed by AIV_ALLOW_SOFTWARE_GL=1)`);
    }
    const info: EngineInfo = {
      browser: browser.label,
      gpu: verdict.family,
      driver: await driverVersion(context),
      api: meta.gpu,
      webgl: gpu.webglRenderer ?? undefined,
      webgpu: gpu.webgpu ? `${gpu.webgpu.vendor} ${gpu.webgpu.architecture}${gpu.webgpu.fallback ? ' (fallback)' : ''}` : undefined,
    };
    log.info(`page ready: ${meta.durationFrames} frames at ${meta.width}x${meta.height} ${meta.fps} fps · ${info.browser} · ${verdict.detail}`);
    const gc = await gcSession(context, page);

    return {
      durationFrames: meta.durationFrames,
      info,
      async renderFrames([a, b]: FrameSpan, onFrame) {
        let expect = -1;
        // sha256 of the bytes that reached the sink, per frame
        const arrived = new Map<number, string>();
        let sinkError: unknown = null;
        srv.setHandler(async (ev) => {
          if (ev.i !== expect) throw new Error(`the page posted frame ${ev.i} while frame ${expect} was asked for`);
          if (ev.width !== width || ev.height !== height) throw new Error(`frame ${ev.i} is ${ev.width}x${ev.height}, expected ${width}x${height}`);
          arrived.set(ev.i, sha256(ev.rgba));
          try {
            await onFrame(ev.i, ev.rgba, { ms: ev.ms });
          } catch (e) {
            // the runner's own error (budget, low memory, encoder) must reach it unchanged
            sinkError = e;
            throw e;
          }
        });
        try {
          for (let i = a; i < b; i++) {
            expect = i;
            let r: FrameResult;
            try {
              r = await guarded(page.evaluate((k) => window.__aiv!.renderFrame(k), i), w, FRAME_TIMEOUT_MS, `frame ${i}`);
            } catch (e) {
              throw sinkError ?? withTail(e);
            }
            if (sinkError) throw sinkError;
            const got = arrived.get(i);
            arrived.delete(i);
            if (r.i !== i || got === undefined) throw new Error(`frame ${i} never reached the frame sink`);
            if (r.sha256 !== got) throw new Error(`frame ${i}: the bytes that arrived (sha256 ${got.slice(0, 12)}) differ from the page's readback (${r.sha256.slice(0, 12)})`);
            assertStable();
            if ((i - a + 1) % GC_EVERY === 0) await gc();
          }
          // a lazy import during rendering is checked before the chunk can be committed
          assertHashed();
        } finally {
          srv.setHandler(null);
        }
      },
      close,
    };
  } catch (e) {
    const err = withTail(e);
    await close();
    throw err;
  }
}

export function webAdapter(opts: WebAdapterOptions = {}): EngineAdapter {
  return {
    name: 'web',
    version: ENGINE_VERSION,
    adapterVersion: ADAPTER_VERSION,
    // the page runtime reads the pixels back; the harness picks the browser flags (ANGLE backend,
    // colour profile, hinting), the viewport, the URL size and the Vite config: all shape frames
    inputs: () => ['engines/web/src/page', 'engines/web/src/harness'],
    // pinned Chrome for Testing and the installed Chrome render different pixels
    settings: { browser: opts.browser ?? 'pinned' },
    open: (ctx) => openSession(ctx, opts),
  };
}
