/**
 * The Remotion engine adapter for the shared chunk runner, in the STREAMING style: Remotion's
 * renderFrames captures lossless PNG screenshots, onFrameBuffer decodes each to opaque RGBA and
 * hands it to the runner's onFrame. Remotion frames therefore enter exactly the pipeline web
 * frames do: the same per-frame RGBA sha256, the same FFV1 RGB mezzanine, the same resume rules.
 *
 * One session = one aiv call:
 *  1. bundle the entry once (cached by input state, see bundle.ts; unhashed files and duplicate
 *     React/three/R3F/remotion copies fail here);
 *  2. open the headless shell once (gl 'angle', or 'swangle' only with AIV_ALLOW_SOFTWARE_GL=1)
 *     and probe the WebGL renderer in it: software GL is refused. Its GPU program cache is kept
 *     across calls (gpuCache.ts, browser.ts): a scene's shaders are compiled once per host, not
 *     once per call (AIV_GPU_CACHE=0 turns it off);
 *  3. select the composition (video.json `composition`, default 'Main') and check it against
 *     video.json's format; scale = render width / composition width;
 *  4. per chunk: renderFrames(frameRange, concurrency 1, puppeteerInstance = the session browser).
 *     Remotion awaits onFrameBuffer before it seeks the next frame (backpressure); the adapter
 *     still asserts strict order and no overlap, so a Remotion change cannot reorder frames.
 *
 * If the shell or its page crashes mid-chunk, Remotion would replace the browser with a new one:
 * unprobed, without our profile marker, and opened in the background after renderFrames has
 * already rejected, so nothing would close it. Its replacement starts by closing the session
 * browser; that close fails the session and never settles (browser.ts onReplace), so no new
 * browser starts. The chunk is discarded and the session fails (run again).
 *
 * The runner holds the heavy-job lock around all of this (aiv render takes it). Closing sweeps
 * the attributable headless shells of this repo (host/orphans.ts): ours, never a Studio render.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { EXIT, ExitError } from '@aiv/core';
import { gpuFamily, isSoftwareRenderer, softwareAllowed, sweepOrphans, type EngineAdapter, type EngineInfo, type EngineOpenContext, type EngineSession, type FrameSpan } from '@aiv/pipeline';
import type { BrowserLog } from '@remotion/renderer';
import type { VideoConfig as RemotionComposition } from 'remotion';
import { bundleTarget } from './bundle.ts';
import { defaultGl, driverVersion, openRemotionBrowser, probeWebGl, REMOTION_VERSION, type GlChoice, type OpenedBrowser } from './browser.ts';
import { checkComposition, checkSwatchFrames, DEFAULT_COMPOSITION } from './composition.ts';
import { decodePng, firstTransparent } from './png.ts';

/** Part of the input hash. The harness folder is hashed as files, so this only needs a bump for a change outside it. */
export const ADAPTER_VERSION = '1';
export const ENGINE_VERSION = REMOTION_VERSION;

/**
 * delayRender() timeout per frame (shader compiles, font loads on a cold iGPU). The first frame
 * of a call or chunk also builds the whole scene: halloween-gift's V2 film measured about 122 s
 * there on the reference host (60 s of CPU geometry and canvas builds, 61 s for the first draw's
 * shader links and uploads; later frames take well under a second), so the limit leaves room.
 */
const FRAME_TIMEOUT_MS = 300_000;

export interface RemotionAdapterOptions {
  /** Remotion's --gl: 'angle' (default, hardware) or 'swangle' (default when AIV_ALLOW_SOFTWARE_GL=1) */
  gl?: GlChoice;
}

/** The repo-relative inputs that shape pixels besides the target and the frame packages (kit, core). */
export const ENGINE_INPUTS = ['engines/remotion/src/harness'];

async function openSession(ctx: EngineOpenContext, opts: RemotionAdapterOptions): Promise<EngineSession> {
  const { target, root, log, width, height } = ctx;
  const gl = opts.gl ?? defaultGl();
  const entry = join(target.dir, ...target.config.entry.split('/'));
  if (!/\.[cm]?[jt]sx?$/.test(entry)) throw new ExitError(EXIT.USAGE, `remotion engine: entry '${target.config.entry}' must be the .ts/.tsx file that calls registerRoot()`);
  if (!existsSync(entry)) throw new Error(`remotion engine: ${target.relDir}/${target.config.entry} does not exist`);

  let opened: OpenedBrowser | null = null;
  let cancelActive: (() => void) | null = null;
  let closed = false;
  // the shell or its page crashed: the session stays failed
  let lost: Error | null = null;
  const crashed = () => new Error('the headless shell or its page crashed: the chunk is discarded and no replacement browser is opened. Run again; if it repeats, check memory and pnpm aiv doctor');
  // the page's last console lines, for every error message
  const lines: string[] = [];
  const tail = () => lines.slice(-20).join('\n');
  let pageError: Error | null = null;
  const onBrowserLog = (l: BrowserLog) => {
    lines.push(`${l.type}: ${l.text}`);
    if (lines.length > 40) lines.shift();
    // a resource error is judged by Remotion itself (a missing favicon is not a broken frame)
    if (l.type === 'error' && !l.text.startsWith('Failed to load resource') && !pageError) {
      pageError = new Error(`page console error: ${l.text}`);
      cancelActive?.();
    }
  };
  const withTail = (e: unknown): Error => {
    const err = e instanceof Error ? e : new Error(String(e));
    const t = tail();
    if (t && !err.message.includes('page console')) err.message += `\n  page console (last lines):\n    ${t.split('\n').join('\n    ')}`;
    return err;
  };
  const close = async () => {
    if (closed) return;
    closed = true;
    cancelActive?.();
    // a crashed shell may have left its GPU program cache half written: not kept
    await opened?.close({ keepGpuCache: !lost });
    // a crashed or killed shell leaves children (and its temp profile) behind on Windows
    await sweepOrphans({ root, log }).catch(() => {});
  };

  try {
    const bundle = await bundleTarget({ target, inputRoots: ctx.inputRoots, inputs: () => ENGINE_INPUTS, log });
    // the device scale factor follows video.json's format; the composition is checked against it below
    const deviceScale = width / target.config.format.width;
    // Remotion's crash replacement starts by closing the session browser: fail the session there
    const onReplace = () => {
      if (closed || lost) return;
      lost = crashed();
      cancelActive?.();
    };
    opened = await openRemotionBrowser({ root, gl, scale: deviceScale, dropSignalHandlers: true, onReplace, gpuCache: true, log });
    const browser = opened.browser;

    // the cache's host check already probed this browser
    const webgl = opened.probed?.webgl ?? (await probeWebGl(browser));
    if (!webgl.renderer) throw new Error(`WebGL is unavailable in the headless shell with --gl=${gl} (${webgl.error ?? 'no context'}): check the GPU driver and pnpm aiv doctor`);
    if (isSoftwareRenderer(webgl.renderer)) {
      const msg = `WebGL runs on software rendering (${webgl.renderer}): slow, and other pixels than the hardware path`;
      if (!softwareAllowed()) throw new Error(`${msg}. Check the GPU driver and pnpm aiv doctor; set AIV_ALLOW_SOFTWARE_GL=1 (renders with --gl=swangle) only on a GPU-less CI runner.`);
      log.warn(`${msg} (allowed by AIV_ALLOW_SOFTWARE_GL=1)`);
    } else if (gl === 'swangle') throw new Error(`--gl=swangle should run on SwiftShader, but WebGL reports ${webgl.renderer}`);

    const { selectComposition, renderFrames, makeCancelSignal } = await import('@remotion/renderer');
    const id = target.config.composition ?? DEFAULT_COMPOSITION;
    const chromiumOptions = { gl, headless: true } as const;
    const common = {
      serveUrl: bundle.serveUrl,
      puppeteerInstance: browser,
      chromiumOptions,
      // what a crash replacement would open (onReplace stops it first): this shell, never a downloaded one
      browserExecutable: opened.executable,
      chromeMode: 'headless-shell' as const,
      onBrowserDownload: (): never => {
        throw new Error('Remotion tried to download a browser during a render: run pnpm aiv doctor --fix');
      },
      logLevel: process.env.AIV_DEBUG ? ('verbose' as const) : ('error' as const),
      timeoutInMilliseconds: FRAME_TIMEOUT_MS,
      onBrowserLog,
    };
    let comp: RemotionComposition;
    try {
      comp = await selectComposition({ ...common, id, inputProps: {} });
    } catch (e) {
      const msg = (e as Error).message;
      if (/Could not find composition|No composition with the ID/i.test(msg)) throw new ExitError(EXIT.REFUSED, `${target.relDir}/${target.config.entry} registers no composition '${id}' (video.json composition, default '${DEFAULT_COMPOSITION}')`);
      throw e;
    }
    if (pageError) throw pageError;
    const { scale } = checkComposition(comp, target.config.format, { width, height });
    if (scale !== deviceScale) throw new Error(`internal: scale ${scale} differs from the browser's device scale factor ${deviceScale}`);
    checkSwatchFrames(comp, target.config.qa?.swatchFrames, log);

    const info: EngineInfo = {
      browser: opened.label,
      gpu: gpuFamily(webgl.renderer),
      driver: opened.probed ? opened.probed.driver : await driverVersion(browser),
      webgl: webgl.renderer,
      gl,
      // recorded with the run and the stills (not part of the resume check: warm and cold give the same pixels)
      ...(opened.gpuCache ? { gpuCache: opened.gpuCache } : {}),
    };
    log.info(`composition '${comp.id}': ${comp.durationInFrames} frames at ${comp.width}x${comp.height} ${comp.fps} fps, rendering at ${width}x${height} (scale ${scale}) · ${info.browser} · --gl=${gl} · ${webgl.renderer}${opened.gpuCache ? ` · GPU program cache ${opened.gpuCache}` : ''}`);

    return {
      durationFrames: comp.durationInFrames,
      info,
      async renderFrames([a, b]: FrameSpan, onFrame) {
        if (closed) throw new Error('the Remotion session is closed');
        if (lost) throw lost;
        const { cancelSignal, cancel } = makeCancelSignal();
        cancelActive = cancel;
        let next = a;
        let busy = false;
        // the runner's own error (budget, low memory, encoder) must reach it unchanged
        let sinkError: unknown = null;
        let decodeMs = 0;
        try {
          await renderFrames({
            ...common,
            composition: comp,
            inputProps: {},
            imageFormat: 'png',
            frameRange: [a, b - 1],
            concurrency: 1,
            scale,
            muted: true,
            outputDir: null,
            cancelSignal,
            onStart: () => {},
            onFrameUpdate: () => {},
            onFrameBuffer: async (buf, frame) => {
              try {
                // no frame after a crash is accepted
                if (lost) throw lost;
                if (busy) throw new Error(`Remotion delivered frame ${frame} before frame ${next} was consumed (no backpressure)`);
                busy = true;
                if (frame !== next) throw new Error(`Remotion delivered frame ${frame}, expected ${next}`);
                const t0 = performance.now();
                const png = decodePng(buf);
                decodeMs += performance.now() - t0;
                if (png.width !== width || png.height !== height) throw new Error(`frame ${frame} is ${png.width}x${png.height}, expected ${width}x${height}`);
                const clear = png.hadAlpha ? firstTransparent(png.rgba) : -1;
                if (clear >= 0) throw new Error(`frame ${frame} has transparent pixels (first at x=${clear % width}, y=${Math.floor(clear / width)}): the mezzanine has no alpha, so paint an opaque background (AbsoluteFill with a background colour)`);
                await onFrame(frame, png.rgba);
                next++;
                busy = false;
              } catch (e) {
                sinkError ??= e;
                throw e;
              }
            },
          });
        } catch (e) {
          cancel();
          throw sinkError ?? pageError ?? lost ?? withTail(e);
        } finally {
          cancelActive = null;
        }
        if (sinkError || pageError || lost) throw sinkError ?? pageError ?? lost;
        if (next !== b) throw new Error(`Remotion delivered ${next - a} of ${b - a} frames for [${a}, ${b})`);
        log.info(`frames ${a}-${b - 1}: PNG decode ${(decodeMs / (b - a)).toFixed(1)} ms/frame`);
      },
      close,
    };
  } catch (e) {
    const err = withTail(e);
    await close();
    throw err;
  }
}

export function remotionAdapter(opts: RemotionAdapterOptions = {}): EngineAdapter {
  const gl = opts.gl ?? defaultGl();
  return {
    name: 'remotion',
    version: ENGINE_VERSION,
    adapterVersion: ADAPTER_VERSION,
    // the harness picks the bundle options, the browser, the gl flag, the scale and the PNG decode
    inputs: () => [...ENGINE_INPUTS],
    // hardware ANGLE and SwiftShader render different pixels
    settings: { gl },
    open: (ctx) => openSession(ctx, { ...opts, gl }),
  };
}
