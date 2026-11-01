/**
 * GPU renderer strings, shared by every browser engine (web, Remotion): is a WebGL renderer a
 * software one, and the coarse family that may enter committed files.
 *
 * A capture on SwiftShader / llvmpipe / Microsoft Basic Render is slow and renders other pixels
 * than the hardware path, so a resumed run or a re-render would not match. Engines refuse it
 * unless AIV_ALLOW_SOFTWARE_GL=1 (CI runners have no GPU).
 */

const SOFTWARE = /swiftshader|llvmpipe|softpipe|lavapipe|basic render|software rasteri[sz]er|\bwarp\b/i;

export const isSoftwareRenderer = (s: string | null | undefined): boolean => !!s && SOFTWARE.test(s);

export const softwareAllowed = (): boolean => process.env.AIV_ALLOW_SOFTWARE_GL === '1';

/** "a, b (c, d), e" → ["a", "b (c, d)", "e"]: commas inside parentheses do not split. */
function topLevelParts(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** PCI ids, shader models, GL suffixes, driver builds and bare version numbers out of a device name. */
const scrub = (s: string): string =>
  s
    .replace(/\s*\(0x[0-9a-f]+\)/gi, '')
    .replace(/\s+Direct3D[\w.]*(\s+[vp]s_\d+_\d+)*/gi, '')
    .replace(/\/PCIe?\/SSE2/gi, '')
    .replace(/\b(?:Mesa|LLVM|DRM|NVIDIA|Vulkan|OpenGL(?: ES)?)\s+\d[\w.-]*/g, '')
    .replace(/(^|[\s(,])\d+\.\d+[\w.-]*/g, '$1')
    .replace(/\s*,\s*(?=[,)])/g, '')
    .replace(/\(\s*,\s*/g, '(')
    .replace(/\s*\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const BACKEND = /\b(D3D11on12|D3D11|D3D9|OpenGL ES|OpenGL|Vulkan|Metal)\b/i;

/**
 * The renderer family for committed files: `ANGLE (<vendor>, <device>, <backend>)` without PCI
 * ids, shader models, driver builds or API versions (those stay in run.json, local only):
 *   "ANGLE (Intel, Intel(R) UHD Graphics (0x00008A56) Direct3D11 vs_5_0 ps_5_0, D3D11)" → "ANGLE (Intel, Intel(R) UHD Graphics, D3D11)"
 *   "ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3080/PCIe/SSE2, OpenGL 4.5.0 NVIDIA 535.104.05)" → "ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3080, OpenGL)"
 * Other renderer strings are scrubbed the same way.
 */
export function gpuFamily(renderer: string): string {
  const m = /^ANGLE \((.*)\)$/s.exec(renderer.trim());
  if (!m) return scrub(renderer);
  const [vendor = '', device = '', ...rest] = topLevelParts(m[1]);
  let dev = device;
  let backend = rest.join(', ');
  // "Vulkan 1.3.255 (<device>)", driver name last; "ANGLE Metal Renderer: <device>", "Unspecified Version" last
  const vk = /^Vulkan [\d.]+ \((.*)\)$/.exec(dev);
  if (vk) [dev, backend] = [vk[1], 'Vulkan'];
  const metal = /^ANGLE Metal Renderer: (.*)$/.exec(dev);
  if (metal) [dev, backend] = [metal[1], 'Metal'];
  const api = BACKEND.exec(backend)?.[1] ?? scrub(backend);
  return `ANGLE (${[vendor, scrub(dev), api].filter(Boolean).join(', ')})`;
}
