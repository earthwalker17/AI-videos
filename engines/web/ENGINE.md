# Web engine (`@aiv/engine-web`)

**Status: active.** Verified on the reference host (Windows 11, Intel UHD iGPU) with
the pinned Chrome for Testing 156.0.8078.4 from playwright-core 1.64.1.

The web engine captures any page that installs the page contract, frame by frame and
deterministically, into the shared chunk runner. The runner writes a lossless FFV1 RGB
mezzanine plus `render.json`. Post, QA and release never know that a browser was involved.

## When to use it

Use it for anything a browser draws:
- raw three.js (WebGL or WebGPU);
- Canvas 2D;
- SVG or DOM rendered to a canvas;
- custom shaders, p5, d3.

It suits work where you want full control of the render loop, a WebGPU-only feature, or
offline accumulation (many samples per frame, as in Journey Through Middle-Earth).

Use the Remotion engine instead for React/R3F compositions, sequencing and timelines,
captions and layered video overlays. With either engine, audio comes from the
`video.json` tracks, mixed by `aiv post`.

## Quick start

```sh
pnpm aiv doctor --fix                         # once: installs the pinned browser (~440 MB on disk)
pnpm aiv render template:web --profile draft  # 960x540, about 20 s on the reference host
pnpm aiv post   template:web --profile draft
pnpm aiv qa     template:web --profile draft  # then look at out/_template-web/qa/draft/contact.png
```

`templates/web/` is the runnable reference page. It is also this engine's fixture.

## The page contract

A page is a `video.json` whose `engine` is `web` and whose `entry` is an `.html` file.
Vite serves the entry's folder as `/`. Bare imports such as `three`, `@aiv/core` and
`@aiv/engine-web/page` resolve from the repository root, so a video has no `package.json`.

```ts
import { installCapture, pageParams } from '@aiv/engine-web/page';

const { width, height, fps } = pageParams({ width: 1920, height: 1080, fps: 30 }); // ?w=&h=&fps=
installCapture({
  fps, width, height,
  durationFrames: Math.round(5 * fps),
  canvas,                       // 2D or WebGL canvas holding the finished frame; or readPixels()
  renderFrame(i) { /* draw frame i from i alone */ },
  setup: fontsLoaded,           // optional: the page's own async boot
  fonts: ['650 72px "AIV Inter"'],
  gpu: 'webgl',                 // 'webgl' | 'webgpu' | 'none': which software fallback to refuse
  swatchFrames: [0, 15],        // optional: [start, end) frames showing the @aiv/core swatch strip
});
```

`installCapture` defines `window.__aiv`:

| Field | Meaning |
|---|---|
| `version` | `1` |
| `ready` | Resolves after `setup`, after the `fonts` are loaded **and in use**, after a warm-up and after a purity probe (see below). Rejects with the page's own error. |
| `meta` | `{ fps, durationFrames, width, height, gpu, swatchFrames }`. The harness refuses a size or rate that differs from the run's, and `swatchFrames` that differ from `video.json` `qa.swatchFrames` (QA would measure other content). |
| `info()` | WebGL renderer/vendor (`WEBGL_debug_renderer_info`), the WebGPU adapter (vendor, architecture, fallback) and the user agent. |
| `renderFrame(i)` | Renders frame `i`, reads back tight RGBA rows top-down, hashes them (SHA-256) and POSTs them to the harness. Resolves `{ i, sha256, ms }`. Calls are serialised. |

Readback paths:
- **2D canvas**: `getImageData`. Create the context with `{ alpha: false, willReadFrequently: true }`.
  This makes it a CPU canvas, so text rasterises the same way every time.
- **WebGL canvas**: `readPixels` from the default framebuffer, then a row flip. The app's
  framebuffer binding is saved and restored. Use `preserveDrawingBuffer: true`, unless
  `renderFrame` draws synchronously.
- **`readPixels()`**: your own readback. Use it for WebGPU render targets: `unpadRows()`
  removes the 256-byte row alignment.

Every frame must be **opaque**: the mezzanine drops alpha. A frame with transparent pixels
fails loudly.

Every file the page loads must lie under the input hash's roots: the video's `src/` and
`assets/`, `styles/`, `packages/<name>/src` (all but the node-only pipeline), this
engine's `src/page` and `src/harness`, or `node_modules` (pinned by the lockfile). After
`ready`, and after every frame range, the harness compares the files Vite served (its
module graph plus `/@fs/` and page-folder requests) with those roots and fails on anything
else, naming the file. Otherwise an edit to that file would change pixels without changing
the hash, and a resume could mix two versions of the video.

HyperFrames pages can join through an `hf-seek` listener. That is documented in
`src/page/index.ts` but not tested.

## Determinism rules

A frame is a pure function of its index. The ESLint determinism block applies to
`engines/web/src/page`, `templates/*/src` and `videos/*/src`.

- **No clocks.** No `Date.now`, `performance.now`, `requestAnimationFrame`, timers,
  `THREE.Clock`, or `getElapsedTime`/`getDelta`. Time is `i / fps`.
- **Seeded randomness only.** Use `rand(seed, id, k)` from `@aiv/core`: stateless, so any
  frame renders on its own (chunks, resume, warm-up order).
- **No state carried between frames.** Pose everything from `i` on every frame.
  `ready` enforces this: it renders the last warm-up frame again after another frame and
  requires identical pixels.
- **No lazy caches that depend on which frame came first.** Example: three's
  `InstancedMesh` caches a bounding sphere from the instances of the first frame it
  renders. Set `frustumCulled = false` on moving instances.
- **No network access while rendering.** Load everything in `setup`. A failed request for
  a document, script, style, font, image, media or fetch fails the run.

Verified on the reference host with the template (pinned Chrome for Testing 156.0.8078.4):
- draft: two `--fresh` renders, the second after deleting its browser profile (cold shader
  cache), gave identical SHA-256 for all 150 frames;
- draft: a run stopped by its budget (exit 75), refused after an input edit (exit 2) and
  resumed after the edit was undone matched the uninterrupted run frame for frame, and its
  delivery mp4 (`preview-hw`, h264_qsv) was byte-identical to the uninterrupted run's;
- final (1920x1080): two `--fresh` renders, each posted, gave byte-identical mezzanines,
  `frames.sha256`, delivery mp4s and archive masters (Matroska is written bit-exact, so it
  carries no random segment UID or muxing date).

## How frames leave the browser, and why

1. `renderFrame(i)` draws, then reads the pixels back inside the page.
2. The page POSTs the bytes as a **Blob** body to `/__aiv/frame?i=&w=&h=&ms=` on the
   harness's Vite server. That server is bound to 127.0.0.1.
3. The server hands the bytes to the runner, which hashes them and streams them into
   ffmpeg (FFV1). The HTTP reply is sent only **after** the frame is in the encoder, and
   the page's `fetch` waits for it. That gives backpressure end to end: a fast page can
   never run ahead of the encoder.
4. The harness compares the page's SHA-256 with the hash of the bytes that arrived.

Why not screenshots? Headless WebGPU canvas screenshots come back black on Windows. Why a
Blob body? A typed-array body would show up in the DevTools protocol's request events,
and Playwright keeps the post data of recent requests in the harness process, which costs
memory.

## Browser pinning

- **Default (`--browser pinned`)**: the Chrome for Testing build pinned by
  `playwright-core`, downloaded by `pnpm aiv doctor --fix` into `.cache/browsers`.
  `PLAYWRIGHT_BROWSERS_PATH` is set before playwright-core is first imported. An
  auto-update can never change pixels.
- **`--browser system`**: the installed Google Chrome. It is not pinned, so the harness
  warns. A different version also refuses to resume an existing run.
- **Recorded**: `render.json` keeps the browser version and a coarse GPU family, e.g.
  `ANGLE (Intel, Intel(R) UHD Graphics, D3D11)`. `run.json` (local only) also keeps the
  full renderer string and the display-driver version. A resume refuses if the browser,
  GPU or driver changed.
- **Profiles**: each run uses its own profile, `.cache/browser-profiles/web-<slug>-<profile>`.
  It persists, so the ANGLE/Dawn shader cache stays warm across resumed calls. Because it
  lives under that folder, the heavy-job orphan sweep recognises it.

## Flags and why

| Flag | Why |
|---|---|
| new headless (`channel: 'chromium'`) | The full browser, not the headless shell. It gets the hardware GPU path: on the reference host, ANGLE D3D11 WebGL and hardware WebGPU. |
| `--use-angle=d3d11` (Windows), `metal` (macOS) | Forces the hardware ANGLE backend that Remotion's `--gl=angle` also uses. |
| `--ignore-gpu-blocklist` | An iGPU on the blocklist would fall back to SwiftShader. |
| `--enable-unsafe-webgpu`, `--enable-webgpu-developer-features` | Exposes WebGPU in headless on Windows (as found in [map-of-middle-earth](../../references/map-of-middle-earth.md)). |
| `--disable-features=<Playwright's list + CalculateNativeWinOcclusion>` | Chrome honours only the **last** `--disable-features`. Ours must be a superset of Playwright's, or it silently re-enables Translate, OptimizationHints and others. `browser.test.ts` fails when a playwright-core upgrade adds features. |
| `--disable-renderer-backgrounding`, `--disable-background-timer-throttling`, `--disable-backgrounding-occluded-windows` | A capture page is never "in the background". |
| `--force-color-profile=srgb`, `--force-device-scale-factor=1` | Pixels exactly as written, whatever the display. |
| `--font-render-hinting=none` | Glyphs do not depend on the host's hinting settings. |

The harness refuses software rendering (SwiftShader, llvmpipe, Microsoft Basic Render) for
the API the page declares in `gpu`. It is slow, and its pixels differ from the hardware
path. `AIV_ALLOW_SOFTWARE_GL=1` allows it, and is meant only for GPU-less CI runners.

## Measured on the reference host

Host: 4-core 10th-gen Intel Core i5, Intel UHD iGPU, 8 GB RAM; Chrome for Testing 156, new
headless, ANGLE D3D11.
Scene: `templates/web` (three.js, shadows, MSAA, 160 instances, a Canvas 2D overlay).

| Profile | Size | Per frame (render + readback + FFV1) | 150 frames | Whole `aiv render` call |
|---|---|---|---|---|
| draft | 960x540 | 0.05-0.07 s | 8.8-9.5 s | 18-24 s |
| final | 1920x1080 | 0.12-0.13 s | 18.4 s | 30 s |

- **Fixed cost per call: about 10 s.** That covers the memory guard and orphan sweep,
  Vite with fresh dependency pre-bundling, the browser launch, the page boot and its
  warm-up, and the close and sweep.
- **Mezzanine size (FFV1 RGB)**: 0.22 MB per frame at 960x540, 0.63 MB per frame at 1080p.
- **Doctor GPU probe**: 1.3 s.

## Gotchas (lessons from Journey Through Middle-Earth)

- **Warm up before the first captured frame.** Lazily created GPU resources (programs,
  render targets, glyph atlases) can make the first frame differ from a re-render of it.
  `ready` renders and reads back mid, last and first, then runs the purity probe.
- **WebGPU readback rows are padded to 256 bytes.** Unpad them (`unpadRows`) before hashing
  or encoding, or every width that is not a multiple of 64 is wrong.
- **Use a `NoColorSpace` readback target when your post pass already encodes sRGB.** An
  `SRGBColorSpace` target becomes `rgba8unorm-srgb`, which encodes a second time.
- **The `--disable-features` superset**: see the flags table above.
- **POST frames as a Blob**: see "How frames leave the browser" above.
- **GC every 24 frames.** The harness calls `HeapProfiler.collectGarbage` over CDP.
  Readback ArrayBuffers otherwise pile up on an 8 GB host.
- **Never use wall-clock time.** Not even for "just a little" animation noise.
- **Vite's dependency cache is keyed on the lockfile, not on your imports.** A stale cache
  missed a new `three/addons` import, re-bundled during a session and gave the page two
  three.js instances. The server therefore pre-bundles from the entry on every start. A
  re-bundle or a reload during a capture is an error.
- **Vite always injects its client, and the client always opens a WebSocket.** So the
  WebSocket stays on, with HMR and the file watcher off.
- **Load fonts with `FontFace` under a family name no system font has** (the template uses
  `"AIV Inter"`). The runtime checks that text measured with the font ignores the
  fallback. A fallback cannot then pass for the real face.
- **A shader-compiler warning in the render log is not an error.** On Windows, ANGLE
  compiles three.js shaders to HLSL, and the template prints `THREE.WebGLProgram: Program
  Info Log: … warning X4122: sum of … cannot be represented accurately in double precision`.
  It is harmless; the harness fails a render on page errors, never on these warnings.

## Files

| Path | What |
|---|---|
| `src/page/` | Browser runtime: `installCapture`, `pageParams`, `flipRows`, `unpadRows`, GPU info. This is frame code. |
| `src/harness/browser.ts` | Pinned or system Chrome, flags, page watch (fail-fast), GC. |
| `src/harness/server.ts` | Vite page server and the frame sink. |
| `src/harness/adapter.ts` | The `EngineAdapter` (streaming style) for the chunk runner. |
| `src/harness/gpu.ts` | Hardware/software judgement and the coarse GPU family. |
| `src/harness/probe.ts`, `src/probe/` | The `aiv doctor` GPU probe page. |
| `src/fixtures/src/` | Test pages for `adapter.test.ts` (laid out like a video's `src/`). |

The input hash covers `src/page` and `src/harness` (tests excluded): the runtime, the
browser flags, the viewport, the URL size and the Vite config all shape pixels, so an edit
there refuses a resume by itself. `ADAPTER_VERSION` needs a bump only for a pixel change
outside those folders. The browser choice (`pinned`/`system`) is a render setting: a run
started with one is refused (never "up to date") with the other.

## Provenance

Adapted from [earthwalker17/map-of-middle-earth@696e968](https://github.com/earthwalker17/map-of-middle-earth/tree/696e968)
(MIT):
- `tools/capture/browser.ts`, `server.ts` and `session.ts`;
- the page capture API, `src/render/capture.ts`.

Each adapted file carries an SPDX header and an `Adapted from` line. The idea of a page
contract that a harness waits on (`window.READY`, software-GL warnings) also appears in
lemo-opuscar (MIT, @bebbbe1); no code was taken from it here.
