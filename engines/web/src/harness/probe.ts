/**
 * The doctor's GPU probe: the pinned (or system) browser on a tiny page served exactly like a
 * capture page (same server, same flags, a secure 127.0.0.1 origin so WebGPU is exposed).
 */
import { fileURLToPath } from 'node:url';
import type { Log } from '@aiv/pipeline';
import type { GpuInfo } from '../page/index.ts';
import { guarded, launchBrowser, watchPage, type BrowserChoice } from './browser.ts';
import { startPageServer } from './server.ts';

export interface ProbeResult {
  browser: string;
  gpu: GpuInfo;
  /** wall time of the probe, s */
  seconds: number;
}

export async function probeGpu(o: { root: string; browser?: BrowserChoice; log: Log }): Promise<ProbeResult> {
  const t0 = Date.now();
  const entry = fileURLToPath(new URL('../probe/index.html', import.meta.url));
  const pageDir = fileURLToPath(new URL('../probe/', import.meta.url));
  const server = await startPageServer({ root: o.root, pageDir, entry, cacheKey: '_probe', log: o.log });
  try {
    const b = await launchBrowser({ root: o.root, profile: `_probe-${o.browser ?? 'pinned'}`, browser: o.browser ?? 'pinned', width: 320, height: 180, log: o.log });
    try {
      const watch = watchPage(b.page, o.log);
      await guarded(b.page.goto(`${server.url}/index.html`, { waitUntil: 'load', timeout: 60_000 }), watch, 65_000, 'loading the probe page');
      const gpu = await guarded(b.page.evaluate(() => window.__aivProbe!), watch, 60_000, 'the GPU probe');
      watch.dispose();
      return { browser: b.label, gpu, seconds: (Date.now() - t0) / 1000 };
    } finally {
      await b.close();
    }
  } finally {
    await server.close();
  }
}
