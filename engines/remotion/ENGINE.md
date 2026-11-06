# Remotion engine (`@aiv/engine-remotion`)

**Status: active.** Verified on the reference host (Windows 11, Intel UHD iGPU) with
Remotion 4.0.539 and its pinned Chrome Headless Shell 157.0.8080.0, `--gl=angle`.

The Remotion engine renders a React/Remotion composition, frame by frame and
deterministically, into the shared chunk runner. It uses the same **streaming** style as the
web engine. Remotion captures each frame as a lossless PNG; the adapter decodes it to opaque
RGBA and hands it to the runner. The frames therefore get the same per-frame RGBA SHA-256,
the same FFV1 RGB mezzanine and the same resume rules as web frames. `render.json` is v1,
unchanged. Post, QA and release never know Remotion was involved: audio is post's job, so
Remotion's `<Audio>` is not used.

## When to use it

Use it for:
- React Three Fiber scenes;
- sequencing and timelines, where `useCurrentFrame()` and `<Sequence>` are the model;
- DOM/CSS typography and layout, captions, layered overlays.

Use the web engine instead for raw three.js, WebGPU-only work or offline accumulation.

## Quick start

```sh
pnpm aiv doctor --fix                              # once: Remotion's headless shell (~120 MB download, 283 MB on disk)
pnpm aiv render template:remotion --profile draft  # 960x540; about 35 s on the reference host once bundled
pnpm aiv post   template:remotion --profile draft
pnpm aiv qa     template:remotion --profile draft  # then look at out/_template-remotion/qa/draft/contact.png
```

`templates/remotion/` is the runnable reference. Preview it in Remotion Studio from the repo
root with `pnpm exec remotion studio templates/remotion/src/index.ts`. Studio is a preview
only: it runs R3F on a wall-clock loop, so it hides nondeterminism. Only renders count.

## The composition contract

A video is a `video.json` whose `engine` is `remotion` and whose `entry` is the `.ts`/`.tsx`
file that calls `registerRoot()`. Bare imports (`remotion`, `three`, `@aiv/remotion-kit`, …)
resolve from the repository root. A video has no `package.json`.

- **Composition.** The engine selects the composition named by `video.json`'s
  `composition`, `'Main'` by default.
  - A missing composition is refused with exit 2.
  - Its `width`, `height` and `fps` must equal `video.json` `format`, or the render is
    refused with exit 2. Post, QA and the audio bed follow `video.json`.
- **Length.** `durationInFrames` comes from the composition.
- **Profiles.** A profile renders at Remotion `scale` = render width / composition width.
  The draft profile is 0.5. The composition is laid out at its own size, and the page's
  device scale factor is the scale. The kit's `useRenderScale()` reads it.
- **Swatch strip.** A composition may declare `swatchFrames: [start, end)` in its props
  (`defaultProps`).
  - If it differs from `video.json` `qa.swatchFrames`, the render is refused: QA would
    measure other content.
  - If only one side declares it, the engine warns.
- **Opaque frames.** Every frame must be opaque: paint an `AbsoluteFill` background. A
  frame with a transparent pixel fails and names the first pixel. The mezzanine has no alpha.
- **Input hash.** Every bundled file outside `node_modules` must lie under the input hash's
  roots:
  - the video's `src/` and `assets/`;
  - `styles/`;
  - `packages/<name>/src`;
  - `engines/remotion/src/harness`.

  Anything else fails the open and names the file. Otherwise an edit to it would change
  pixels without changing the hash.
- **Static files.** `staticFile()` serves the video's `assets/` folder, which the hash covers.
- **No network.** Load nothing from the network. drei's `<Environment preset>` fetches HDRIs
  from a CDN; use the kit's `useRoomEnvironment()`. Runtime fetches are not intercepted yet
  (see Gotchas).

## How a render works

1. **Bundle once per input state.** `@remotion/bundler` (webpack) bundles the entry into
   `.cache/remotion-bundles/<key>/`.
   - The key hashes what shapes the bundle: the entry, every file under the input roots and
     the lockfile. It ignores the composition id, slug, format and profile: one bundle holds
     every composition of an entry, and draft and final share it. Any edit or lockfile change
     makes a new one.
   - A resume call reuses the bundle.
   - The bundle is renamed into place only after its checks pass. The newest six are kept.
2. **Check the bundle.** A webpack plugin records the source files of every module webpack
   built: its resource and the files its loaders read.
   - It reads them in `finishModules`, before optimisation. In production mode webpack folds
     ES modules into concatenated modules and drops each concatenation's root module from
     the final module list (the entry is always such a root). The plugin also walks the
     concatenated modules and child compilations (workers). The entry must be in the list.
   - A file the input hash does not cover fails (see above). That includes files under a root
     that the hash's walk skips: dot-files and dot-folders, `*.test.*`, and folders named
     `dist`, `out`, `.cache` or `node_modules`.
   - `react`, `react-dom`, `three`, `@react-three/fiber` and `remotion` must each come from
     exactly one package folder. Two copies break hooks, R3F's store and `instanceof`.
3. **Open the browser once per session.** Remotion's Chrome Headless Shell is opened with
   `--gl=angle` and the render scale, then reused for every chunk (`puppeteerInstance`).
   - The executable is always passed explicitly, so Remotion never downloads mid-render. A
     missing or outdated shell fails with `run pnpm aiv doctor --fix`.
   - If the shell or its page crashes, Remotion would open a replacement browser and retry the
     frame. That replacement would be unprobed and unmarked, and it starts in the background
     after the chunk has already failed, so nothing would close it. Remotion's replacement
     begins by closing the browser it was given, and a passed-in browser is closed for nothing
     else (read in `replace-browser.js` at 4.0.539). So the engine makes that close fail the
     session and never settle: no replacement starts. The chunk is discarded and the call
     fails: run again. The replacement would still get this shell and an `onBrowserDownload`
     that throws, never a download. `adapter.test.ts` kills the shell mid-chunk, then checks
     that no shell appears afterwards.
     - Why not point the replacement at a missing executable: Remotion chains every
       `ensureBrowser` call on one promise, so a single rejection fails every later
       `openBrowser` in that process.
4. **Probe the GPU.** A page of that same browser creates a WebGL context and reads
   `WEBGL_debug_renderer_info`.
   - Software renderers (SwiftShader, llvmpipe, Microsoft Basic Render) are refused unless
     `AIV_ALLOW_SOFTWARE_GL=1`.
   - With that variable set, the engine renders with `--gl=swangle`. It is meant for CI
     only.
   - The `gl` choice is a render setting (`adapter.settings`): a run started with one is
     refused with the other.
5. **Select the composition** and check it (see the contract).
6. **Render each chunk.** `renderFrames({ frameRange, concurrency: 1, imageFormat: 'png',
   scale, onFrameBuffer })`:
   - Remotion awaits `onFrameBuffer` before it seeks the next frame. That is backpressure all
     the way to the encoder (read in `render-frame-with-option-to-reject.js` at 4.0.539, and
     tested).
   - The adapter still asserts strict order, no overlap, the PNG size and opacity.
   - Each `renderFrames` call opens and closes its own page, so a long render does not
     accumulate one page's GPU memory.
7. **Decode PNG** with a small decoder on `node:zlib` (`png.ts`: 8-bit RGB/RGBA,
   non-interlaced, filters 0-4, every chunk CRC checked; anything else is refused loudly).
   `png.test.ts` pins it byte for byte against ffmpeg's decode of the same files, for every
   prediction filter.

Why PNG and not JPEG: JPEG is lossy, so frames would not be bit-exact and the swatches would
drift. Why not Remotion's shared-memory capture: it is macOS/Linux only in 4.0.539.

**EngineInfo** (resume refuses a change in any of the first three):
- `browser`: `chrome-headless-shell 157.0.8080.0`.
- `gpu`: the coarse family, e.g. `ANGLE (Intel, Intel(R) UHD Graphics, D3D11)`. The rules are
  shared with the web engine (`@aiv/pipeline` `host/gpu.ts`).
- `driver`: the display driver, from CDP `SystemInfo`.
- `webgl`: the full renderer string.
- `gl`: the `--gl` value.

Only `browser` and `gpu` reach `render.json`. The driver and the full renderer string stay
in the local `run.json`.

## Browser hygiene

Remotion's `openBrowser` makes a fresh profile in the OS temp folder
(`puppeteer_dev_chrome_profile-*`).
- **Cleanup on close.** On Windows, Remotion's own cleanup races Chrome's exit and leaves
  `Default/` behind, so such folders pile up in the temp folder (earlier Remotion and
  puppeteer use had left over a thousand on the reference host). The engine therefore
  attributes its profile, writes an owner marker into it, and deletes it after closing the
  browser.
- **Orphan sweep.** The heavy-job orphan sweep (`@aiv/pipeline` `host/orphans.ts`) also
  kills headless shells under THIS repo's `node_modules/.remotion`, but only those it can
  attribute:
  - the shell's profile carries the owner marker for this repo (an aiv render, live or
    killed);
  - or this process launched it (an unmarked shell, such as a crash replacement, which the
    adapter prevents);
  - or its parent process is gone (an orphan nobody drives);
  - and the children of any of these.

  It deletes the profiles of the shells it killed, and marked profiles of this repo nobody
  uses. It never touches the user's Chrome, other repos' shells or unmarked profiles. A
  Remotion Studio render or a `pnpm exec remotion render` of this repo has a live parent and
  no marker, so an aiv render does not kill it. Those renders do not take the heavy-job lock
  either: on a small machine such as the 8 GB reference host, do not run them while an aiv
  render runs.
- **Interruptions.** `openBrowser` installs SIGINT/SIGTERM/SIGHUP handlers that
  `process.exit` at once. In a render session the engine removes them, so the runner's abort
  handler runs instead: it stops the encoder, cancels the chunk (`makeCancelSignal`), closes
  the browser, sweeps and releases the lock. Remotion's `exit` handler, which kills the
  browser, stays. `close()` is idempotent. Closing the browser is capped at 5 s, below the
  abort handler's 10 s cap, so the lock release after it still runs. The sweep kills a shell
  that did not exit.

## The GPU program cache

A heavy 3D scene's first frame pays for every shader once: on the reference host's ANGLE D3D11,
each distinct program costs about 1.5–2 s to translate, compile and link. halloween-gift's V2
film has 82 of them, so its first frame spent up to 61 s in the first draw, on every call.
Chrome keeps compiled programs in the profile's `Default/GPUCache`, but Remotion makes a fresh
temp profile per call. So render sessions keep that folder across calls
(`src/harness/gpuCache.ts`):
- the store is `.cache/remotion-gpu/<shell version>-<gl>/store`, with a `store.json` naming the
  host it was built on (browser, gl, WebGL renderer, driver). A store from another host (a driver
  update, say) is emptied and the shell relaunched cold; a store without its `store.json` is
  never used;
- each session links its profile's `Default/GPUCache` (a junction on Windows) to its own copy
  (`work-<pid>-<n>`) before Chrome starts, and hands the copy back to the store only after
  Chrome has exited cleanly; a crashed shell's copy is dropped. Copies left by dead processes
  are deleted at the next start;
- Remotion offers no option for the profile, so `openRemotionBrowser` wraps
  `fs.promises.mkdtemp` while `openBrowser` runs (Remotion 4.0.539 creates its profile through
  it). If the link is never made (a Remotion change), the cache turns itself off rather than let
  an empty copy replace the store;
- the state (`warm`, `cold (new)`, `off (…)`) is logged and recorded in the run's and the
  stills' engine info (`gpuCache`), outside the resume check: cached programs give the same
  pixels (`adapter.test.ts` renders the shader-heavy fixture with the cache off, cold and warm
  and compares frame hashes). `AIV_GPU_CACHE=0` turns it off.

Measured on the reference host (halloween-gift's V2 film, its diagnostic composition): the first
draw 119–225 s cold, 6.7 s warm. After any shader edit, the changed programs compile cold once.

## Determinism rules (Remotion + R3F)

A frame is a pure function of `useCurrentFrame()`. The ESLint determinism block applies to
`packages/remotion-kit/src`, `templates/*/src` and `videos/*/src`.

- **No clocks, timers or unseeded randomness.** Time is `frame / fps`. Use
  `rand(seed, id, k)` from `@aiv/core`.
- **No `useFrame` and no clock-driven drei helpers** (`Float`, `Sparkles`, `Stars`,
  `CameraShake`, …).
  - While rendering, `ThreeCanvas` runs R3F with `frameloop: 'never'` and advances it once per
    frame, in a passive effect after React committed the frame.
  - So pose objects in JSX props or in `useLayoutEffect`. Both land before that advance.
  - Never pose in `useEffect`: it runs after the frame was drawn, so the frame is off by one.
- **Post-processing** only through the kit's `<PostChain>`, which builds its composer
  synchronously.
  - `@react-three/postprocessing` assembles its composer after the first render, so the first
    frames of every page come out blank or unprocessed (THE AI STACK).
  - Every chunk starts a fresh page, so this would hit every chunk boundary.
  - The chain renders with delta 0: no effect may accumulate time.
- **No lazy caches that depend on which frame came first.** Set `frustumCulled={false}` on
  animated `InstancedMesh`es: three caches their bounding sphere from the first frame drawn.
  A light's shadow box is another: three computes the shadow camera's projection only when the
  shadow map is created, and R3F never recomputes it when `shadow-camera-*` props change, so a
  box keyed per shot stays at the chunk's first frame. Call
  `light.shadow.camera.updateProjectionMatrix()` in a layout effect when the box changes
  (*A Halloween Gift*: `aiv still --check` mismatched a frame 61 frames into a chunk).
- **Fonts** are registered under a family name no system font has, and each frame is held
  until the font is loaded (the kit's `useInter()`).

Verified on the reference host (template, draft 960x540 unless noted):
- **Fresh renders.** Three `--fresh` draft renders gave identical `frames.sha256` (sha256
  `4721e995…` over the 150 lines) and byte-identical FFV1 mezzanines (sha256 `2f7dd288…`).
  Two `--fresh` final (1920x1080) renders gave identical frame hashes (`603424b9…`) and
  mezzanines (`45590280…`).
- **Chunk starts.** Chunks are aligned to multiples of the chunk size, so a `--frames` run
  starts a page at a new frame only where its first chunk is partial. Draft chunks are 60
  frames: the full run starts pages at 0, 60 and 120.
  - `--frames 20-149 --fresh` renders frames 20-59 on a page that starts at 20, where the 3D
    canvas first mounts at 20. In the full run those frames come from the page that started
    at 0, where the canvas mounted at 15. All 130 hashes equal lines 20-149 of the full run.
  - `--frames 75-149 --fresh` renders frames 75-119 on a page that starts at 75 instead of
    60. All 75 hashes equal lines 75-149 of the full run.
  - `adapter.test.ts` checks the same in one session, on a fixture with an animated
    `InstancedMesh`, room light, shadows and mipmap bloom. Frames 3-11 rendered on a page
    that starts at 0, at 3 and at 8 hash the same.
- **Resume.** A run stopped by its budget (exit 75), refused after a file was added under
  `src/` (exit 2), and continued with the printed command after the file was removed (two
  more calls: 75, then 0) matched the uninterrupted run frame for frame, mezzanine included.
  No headless shell and no marked temp profile were left.

## Measured on the reference host

Host: 4-core 10th-gen Intel Core i5, Intel UHD iGPU, 8 GB RAM. Chrome Headless Shell
157.0.8080.0, `--gl=angle` (ANGLE D3D11). Scene: `templates/remotion` (R3F, shadows, a
physical iridescent material, 4x MSAA HalfFloat composer, bloom, vignette, dithered output,
2x168 instances, a DOM overlay in Inter).

| Profile | Size | Per frame (render + PNG + decode + FFV1) | PNG decode | 150 frames (chunks) | Run wall time (`render.json` timing) |
|---|---|---|---|---|---|
| draft | 960x540 | 0.158-0.194 s | 15.6-16.9 ms | 25-27 s | 27.1 s (bundle reused) |
| final | 1920x1080 | 0.278-0.373 s | not re-measured (39-47 ms before) | 42.7-48.5 s | 57.6 s (bundle reused) |

- **Bundling:**
  - cold (empty webpack cache): 49.8 s, 381 files;
  - after an edit, with a warm webpack cache: 4.4-5.2 s (393 files for the template);
  - reused bundle: about 2 s from call start to the first frame, which covers the bundle
    check, the browser, the GPU probe and the composition.
- **Available memory** during renders: 2.0-2.7 GB, logged per chunk.
- **FFV1 mezzanine:** about 0.35 MiB per frame at 960x540 and 1.20 MiB per frame at 1080p.
  Dithering adds noise that FFV1 cannot predict; without it the template was 0.27 and
  0.79 MiB per frame.
- **Deliverables (final):** the `youtube` mp4 is 4.3 MB and the archive master 10.9 MB.
- **Doctor GPU probe:** 0.8 s. WebGL family: `ANGLE (Intel, Intel(R) UHD Graphics, D3D11)`.
- **Disk:**
  - headless shell: 283 MB in `node_modules/.remotion`;
  - each bundle: 42 MB with source maps, six kept;
  - Remotion's webpack cache (`node_modules/.cache/webpack`): 1.2 GB after these runs. It is
    safe to delete; the next bundle is cold.

## Gotchas

- **`pnpm exec remotion gpu --gl=angle` fails on this headless shell** with "Browser failed
  to load chrome://gpu/ (Document): net::ERR_FAILED". The Windows headless shell does not
  serve `chrome://gpu`. `pnpm aiv doctor` probes a real WebGL context instead.
- **Remotion's version check warns about zod.** It wants 4.5.4 and the root pins 4.6.7 for
  `@aiv/core`. We use no Remotion zod schemas; the warning is expected.
- **`selectComposition` and every chunk start their own local server.** That costs about a
  second; Remotion's shared-server option is internal API.
- **Runtime network fetches are not intercepted.** The bundle is checked, but a fetch from
  inside the page is not. Remotion's `openBrowser` exposes no way to add Chrome flags (the GPU
  program cache reaches the profile through a wrapped `fs.promises.mkdtemp` instead: see above).
- **The Studio preview runs R3F with `frameloop: 'always'`.** It hides nondeterminism. Check
  determinism by rendering twice.

## Licence

Remotion is **source-available** under the [Remotion License](https://www.remotion.dev/license),
not an OSI open-source licence.
- It is free for individuals and for organisations of up to 3 people. Larger companies need
  a company licence.
- This repository depends on Remotion through npm and does not redistribute it.
- Everyone who renders with it is their own licensee.
- `@remotion/three` is MIT.
- No Remotion source, documentation or skills text is copied here. The adapter uses the public
  API, and reads the pinned Chrome version from the renderer's shipped file because it is
  not exported.
- Remotion's official agent skills are not included: they are unlicensed. To use them, install
  the Claude Code plugin `remotion@remotion` from the `remotion-dev/claude-code-plugin`
  marketplace ([claude-code-packaging](../../references/claude-code-packaging.md)). Never run
  `npx remotion skills add` in this repo: it writes into `.agents/` and `.claude/skills`.

## Files

| Path | What |
|---|---|
| `src/harness/adapter.ts` | The `EngineAdapter` (streaming style) for the chunk runner. |
| `src/harness/bundle.ts` | Bundling, the bundle cache, the input-hash and single-instance checks. |
| `src/harness/browser.ts` | The headless shell: location, install, open, profile cleanup, WebGL probe, driver. |
| `src/harness/gpuCache.ts` | The GPU program cache kept across calls: its store, the session copy, the host check. |
| `src/harness/composition.ts` | The composition/format contract and the swatch-frame check. |
| `src/harness/png.ts` | The PNG decoder. |
| `src/fixtures/src/` | Test compositions for `adapter.test.ts` (laid out like a video's `src/`). |
| `src/fixtures/outside/` | A component outside the fixture's input roots, imported lazily by `src/lazy.ts`: the bundle check must name it. |

The input hash covers `src/harness` (tests excluded). `ADAPTER_VERSION` needs a bump only for
a pixel change outside it. Frame-side code lives in `@aiv/remotion-kit`
(`packages/remotion-kit`), which the hash covers as a frame package.

## Provenance

Original to this repository. The orphan sweep it extends (`@aiv/pipeline` `host/orphans.ts`)
was adapted from
[earthwalker17/map-of-middle-earth@696e968](https://github.com/earthwalker17/map-of-middle-earth/tree/696e968)
(MIT; see that file's header and [NOTICE.md](../../NOTICE.md)). The design follows the lessons
of THE AI STACK ([its catalog entry](../../videos/the-ai-stack/README.md)).
