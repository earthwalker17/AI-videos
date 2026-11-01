/**
 * What the page's GPU path really is. The harness refuses software rendering (SwiftShader,
 * llvmpipe, Microsoft Basic Render) because it is slow and renders different pixels from the
 * hardware path that a resumed run or a re-render would use. Shared by the page runtime and the
 * doctor's probe page; browser-only, self-contained.
 */

export interface WebGpuAdapterInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
  /** true for the CPU fallback adapter (SwiftShader) */
  fallback: boolean;
}

export interface GpuInfo {
  /** unmasked WebGL renderer, e.g. "ANGLE (Intel, Intel(R) UHD Graphics (0x00008A56) Direct3D11 vs_5_0 ps_5_0, D3D11)" */
  webglRenderer: string | null;
  webglVendor: string | null;
  webglVersion: string | null;
  /** null when navigator.gpu is missing or no adapter was granted */
  webgpu: WebGpuAdapterInfo | null;
  /** why WebGPU is unavailable, when it is */
  webgpuError: string | null;
  userAgent: string;
}

function webgl(): Pick<GpuInfo, 'webglRenderer' | 'webglVendor' | 'webglVersion'> {
  const canvas = document.createElement('canvas');
  const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
  if (!gl) return { webglRenderer: null, webglVendor: null, webglVersion: null };
  // Chrome still answers the debug extension; without it RENDERER may be a masked "WebKit WebGL"
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const info = {
    webglRenderer: String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
    webglVendor: String(gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR)),
    webglVersion: String(gl.getParameter(gl.VERSION)),
  };
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return info;
}

interface GpuLike {
  requestAdapter(): Promise<{ info?: Record<string, unknown>; isFallbackAdapter?: boolean } | null>;
}

async function webgpu(): Promise<Pick<GpuInfo, 'webgpu' | 'webgpuError'>> {
  const gpu = (navigator as Navigator & { gpu?: GpuLike }).gpu;
  if (!gpu) return { webgpu: null, webgpuError: 'navigator.gpu is missing (not a secure context, or WebGPU disabled)' };
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { webgpu: null, webgpuError: 'requestAdapter() returned null' };
    const i = adapter.info ?? {};
    const s = (k: string) => (typeof i[k] === 'string' ? (i[k] as string) : '');
    return {
      webgpu: { vendor: s('vendor'), architecture: s('architecture'), device: s('device'), description: s('description'), fallback: Boolean(i.isFallbackAdapter ?? adapter.isFallbackAdapter) },
      webgpuError: null,
    };
  } catch (e) {
    return { webgpu: null, webgpuError: String(e) };
  }
}

export async function collectGpuInfo(): Promise<GpuInfo> {
  return { ...webgl(), ...(await webgpu()), userAgent: navigator.userAgent };
}
