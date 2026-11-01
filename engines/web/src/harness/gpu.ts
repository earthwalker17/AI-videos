/**
 * Hardware or software? A capture on SwiftShader / llvmpipe / Microsoft Basic Render is slow and
 * renders other pixels than the hardware path, so a resumed run or a re-render would not match.
 * The harness refuses it unless AIV_ALLOW_SOFTWARE_GL=1 (CI runners have no GPU).
 *
 * The renderer-string rules (software detection, the coarse family) are shared with the Remotion
 * engine and live in @aiv/pipeline (host/gpu.ts); WebGPU and the per-API verdict stay here.
 */
import { gpuFamily, isSoftwareRenderer } from '@aiv/pipeline';
import type { GpuApi, GpuInfo } from '../page/index.ts';

export { gpuFamily, isSoftwareRenderer, softwareAllowed } from '@aiv/pipeline';

export function webgpuLabel(g: NonNullable<GpuInfo['webgpu']>): string {
  const parts = [g.vendor, g.architecture, g.description].filter(Boolean);
  return `${parts.join(' / ') || 'unknown adapter'}${g.fallback ? ' (fallback adapter)' : ''}`;
}

export interface GpuVerdict {
  /** the API the page draws with is on hardware (or the page needs no GPU) */
  hardware: boolean;
  /** coarse family of the renderer the page uses (EngineInfo.gpu) */
  family: string | undefined;
  detail: string;
}

/** Judge the GPU path for the API a page draws with. */
export function judgeGpu(info: GpuInfo, api: GpuApi): GpuVerdict {
  if (api === 'webgpu') {
    const g = info.webgpu;
    if (!g) return { hardware: false, family: undefined, detail: `no WebGPU adapter: ${info.webgpuError ?? 'unknown reason'}` };
    const sw = g.fallback || isSoftwareRenderer(`${g.vendor} ${g.architecture} ${g.description}`);
    return { hardware: !sw, family: `WebGPU ${[g.vendor, g.architecture].filter(Boolean).join(' ') || 'adapter'}${sw ? ' (software)' : ''}`, detail: webgpuLabel(g) };
  }
  const r = info.webglRenderer;
  if (!r) return { hardware: api === 'none', family: undefined, detail: 'WebGL is unavailable' };
  const sw = isSoftwareRenderer(r);
  return { hardware: api === 'none' || !sw, family: gpuFamily(r), detail: r };
}
