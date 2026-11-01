import { describe, expect, it } from 'vitest';
import { gpuFamily, isSoftwareRenderer } from './gpu.ts';

// The full rule set is exercised through the web engine's gpu.test.ts (it re-exports these);
// this pins the strings the Remotion engine's headless shell reports.
describe('shared GPU strings', () => {
  it('reduces the headless shell’s ANGLE renderers to the same family as the web engine', () => {
    expect(gpuFamily('ANGLE (Intel, Intel(R) UHD Graphics (0x00008A56) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('ANGLE (Intel, Intel(R) UHD Graphics, D3D11)');
    expect(gpuFamily('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')).toBe('ANGLE (Google, SwiftShader Device (Subzero), Vulkan)');
  });

  it('flags swangle and other software paths', () => {
    expect(isSoftwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')).toBe(true);
    expect(isSoftwareRenderer('ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
    expect(isSoftwareRenderer('ANGLE (Intel, Intel(R) UHD Graphics (0x00008A56) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
  });
});
