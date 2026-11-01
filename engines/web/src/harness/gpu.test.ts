import { describe, expect, it } from 'vitest';
import type { GpuInfo } from '../page/index.ts';
import { gpuFamily, isSoftwareRenderer, judgeGpu } from './gpu.ts';

const info = (o: Partial<GpuInfo>): GpuInfo => ({ webglRenderer: null, webglVendor: null, webglVersion: null, webgpu: null, webgpuError: null, userAgent: 'x', ...o });

describe('gpu', () => {
  it('reduces ANGLE renderer strings to a coarse family (no PCI ids, no shader models)', () => {
    // the reference host's string, verbatim
    expect(gpuFamily('ANGLE (Intel, Intel(R) UHD Graphics (0x00008A56) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('ANGLE (Intel, Intel(R) UHD Graphics, D3D11)');
    expect(gpuFamily('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002503) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060, D3D11)');
  });

  it('keeps driver builds and API versions out of the family on Linux and macOS', () => {
    const cases: [string, string][] = [
      ['ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3080/PCIe/SSE2, OpenGL 4.5.0 NVIDIA 535.104.05)', 'ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3080, OpenGL)'],
      ['ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)', 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL)'],
      ['ANGLE (AMD, AMD Radeon RX 6800 (radeonsi, navi21, LLVM 15.0.7, DRM 3.49, 6.2.0-39-generic), OpenGL ES 3.2 Mesa 23.2.1)', 'ANGLE (AMD, AMD Radeon RX 6800 (radeonsi, navi21), OpenGL ES)'],
      ['ANGLE (Intel, Vulkan 1.3.255 (Intel(R) UHD Graphics 620 (KBL GT2) (0x00005917)), Intel open-source Mesa driver)', 'ANGLE (Intel, Intel(R) UHD Graphics 620 (KBL GT2), Vulkan)'],
      ['ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', 'ANGLE (Apple, Apple M2, Metal)'],
      ['llvmpipe (LLVM 15.0.7, 256 bits)', 'llvmpipe (256 bits)'],
    ];
    for (const [raw, family] of cases) {
      expect(gpuFamily(raw), raw).toBe(family);
      expect(gpuFamily(raw), raw).not.toMatch(/\d+\.\d+/);
    }
  });

  it('recognises software renderers', () => {
    for (const s of [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    ])
      expect(isSoftwareRenderer(s), s).toBe(true);
    expect(isSoftwareRenderer('ANGLE (Intel, Intel(R) UHD Graphics (0x00008A56) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
    expect(isSoftwareRenderer(null)).toBe(false);
  });

  it('judges the API the page draws with', () => {
    const hw = info({ webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics (0x00008A56) Direct3D11 vs_5_0 ps_5_0, D3D11)' });
    expect(judgeGpu(hw, 'webgl')).toMatchObject({ hardware: true, family: 'ANGLE (Intel, Intel(R) UHD Graphics, D3D11)' });
    const sw = info({ webglRenderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' });
    expect(judgeGpu(sw, 'webgl').hardware).toBe(false);
    // a Canvas 2D page needs no GPU: software GL is recorded, not refused
    expect(judgeGpu(sw, 'none').hardware).toBe(true);
    expect(judgeGpu(hw, 'webgpu')).toMatchObject({ hardware: false });
    const fallback = info({ webgpu: { vendor: 'google', architecture: 'swiftshader', device: '', description: '', fallback: true } });
    expect(judgeGpu(fallback, 'webgpu').hardware).toBe(false);
    const gpu = info({ webgpu: { vendor: 'intel', architecture: 'gen-11', device: '0x8a56', description: 'Intel(R) UHD Graphics', fallback: false } });
    expect(judgeGpu(gpu, 'webgpu')).toMatchObject({ hardware: true, family: 'WebGPU intel gen-11' });
  });
});
