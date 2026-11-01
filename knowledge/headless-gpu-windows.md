# Capture WebGL and WebGPU on a Windows laptop GPU with headless Chrome

Headless Chrome can render on the real GPU of a modest Windows laptop, but only with the
right build and flags, and its screenshots are the wrong way to get frames out. Silent
fallbacks to software rendering are the main risk: they work, slowly, and change pixels.

## Method
1. **Pin the browser.** Use a Chrome for Testing build pinned by the automation library, not
   the system Chrome, so a background update never changes pixels mid-project.
2. **Flags** that mattered: `--use-angle=d3d11` (Windows), `--ignore-gpu-blocklist`,
   `--enable-unsafe-webgpu`, `--force-color-profile=srgb`, `--font-render-hinting=none`,
   `--force-device-scale-factor=1`. Use the new headless mode.
3. **Prove the GPU path before rendering.** Read `WEBGL_debug_renderer_info` and the WebGPU
   adapter info in the same browser build and profile settings. Refuse software renderers
   (SwiftShader, llvmpipe, "Basic Render", a WebGPU fallback adapter) unless explicitly
   allowed, for example in CI.
4. **Read pixels back inside the page** and send them to the harness, instead of taking
   screenshots: headless WebGPU canvas screenshots came back black on Windows. Send the bytes
   as a `Blob` body (a typed-array body is kept in the automation client's request log and
   costs memory) and reply only after the frame is in the encoder, which gives backpressure.
5. **Record what ran** (browser version, GPU family, driver), but keep driver builds and
   device ids out of committed files.

## Evidence
Intel UHD Graphics (10th-generation laptop CPU), Windows 11, Chrome for Testing 156:
- WebGL: hardware, `ANGLE (Intel, Intel(R) UHD Graphics … Direct3D11 …, D3D11)`.
- WebGPU: hardware adapter (vendor intel, architecture gen-11), not the fallback adapter.
- Web template throughput: 0.05–0.07 s per frame at 960x540 and 0.12 s per frame at
  1920x1080, including readback, transfer and lossless encoding; about 10 s fixed cost per
  render call (server, browser launch, warm-up).
- Chrome's GPU memory counts against system RAM on an integrated GPU: about 2 GB stayed
  available during renders on an 8 GB machine.

Not verified: a full WebGPU page capture end to end (only the adapter probe and the readback
row-padding logic), macOS (Metal) and Linux GPU paths.

## In this repo
`engines/web` (`harness/browser.ts` for flags and pinning, `harness/gpu.ts` for the checks,
`page/` for in-page readback); `pnpm aiv doctor` runs the probe.

## Pitfalls
- A dev server's client script can log console errors (a closed WebSocket) that a strict
  harness treats as fatal; keep its socket open and turn off hot reload instead.
- A dependency cache keyed on the lockfile can re-bundle in the middle of a capture and load
  two copies of three.js; pre-bundle at start-up and treat a re-bundle as fatal.
