import { collectGpuInfo, type GpuInfo } from '../page/gpuInfo.ts';

declare global {
  interface Window {
    __aivProbe?: Promise<GpuInfo>;
  }
}

window.__aivProbe = collectGpuInfo();
