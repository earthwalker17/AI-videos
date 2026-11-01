// @aiv/engine-web — Node side: the Playwright harness and the EngineAdapter for the chunk runner.
// Pages import the browser runtime from '@aiv/engine-web/page' instead (see ENGINE.md).
export { webAdapter, ADAPTER_VERSION, ENGINE_VERSION, type WebAdapterOptions } from './harness/adapter.ts';
export { pinnedBrowser, systemChrome, installCommand, browsersDir, playwrightDir, chromeArgs, launchBrowser, PLAYWRIGHT_DISABLED_FEATURES, type BrowserChoice, type PinnedBrowser } from './harness/browser.ts';
export { startPageServer, type PageServer, type FrameEvent, type FrameHandler } from './harness/server.ts';
export { judgeGpu, gpuFamily, isSoftwareRenderer, softwareAllowed, webgpuLabel, type GpuVerdict } from './harness/gpu.ts';
export { probeGpu, type ProbeResult } from './harness/probe.ts';
