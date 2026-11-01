# Remotion (v4.0.539) — versions, licence, v5, 3D, rendering

| | |
|---|---|
| Upstream | https://github.com/remotion-dev/remotion · docs https://www.remotion.dev/docs (agent index https://www.remotion.dev/llms.txt; append `.md` to any docs URL) |
| Pin | v4.0.539 (released 2026-10-26, tag `e50b41a410933aa807515335d1c04dbba1b8b93f`); licence files read at HEAD `fe9ffaa7b349fcf50c9480291afdcfb2964fb50c` (2026-10-31) |
| Licence | Remotion License (source-available, not OSI open source). `@remotion/three` MIT. Docs: no explicit open licence. Skills repo: no LICENSE (treat as Remotion License). |
| Accessed | 2026-11-01 |
| Stale after | The next Remotion upgrade, or 2026-12-01 (about two releases a week). Immediately when 5.0 ships. |
| Excerpt policy | Paraphrase only. Never copy Remotion source, docs or skills text into this repo. |

## What it is
A React framework that renders compositions frame by frame in a headless Chrome, with
`@remotion/three` wrapping React Three Fiber. Our second engine (`engines/remotion`).

## Why it matters here
It is the engine of the prior film THE AI STACK and of the planned 3D concept series. Its
defaults (colour space, GL backend, browser cache location, licence) each change a
repo-level decision.

## Key facts
**Versions**
- Latest stable 4.0.539; ~39 releases between 2026-07-27 (4.0.500) and 2026-10-26 [V].
- Every `remotion` / `@remotion/*` package must be the same exact version; mixed versions warn and break [V]. `@remotion/media` pins its own exact mediabunny (1.62.0) and zod (4.5.4): do not force-dedupe [V].
- 5.0 is not released (no 5.x on npm; the `alpha` tag 4.1.0-alpha12 is from 2023) [V].

**v5 migration checklist** (from `5-0-migration.mdx` at v4.0.539) [V]
- `angle` becomes the default `--gl`, with a SwiftShader fallback.
- A licence key must be passed (`"free-license"` for eligible free users).
- `inputProps` becomes required in `selectComposition` / `getCompositions`.
- `bundle()` and `getCompositions()` take an options object.
- Google Fonts `loadFont()` needs explicit weights and subsets.
- `TransitionSeries layout="none"` is removed; `visualizeAudio` defaults to speed; `getVideoMetadata()` is removed (Mediabunny instead).
- `bt709` becomes the default colour space.
- Lambda: 10240 MB disk default, x264 preset `veryfast`.
- Write v5-ready code now: explicit `gl`, `inputProps: {}`, narrowed `loadFont`, options-object `bundle()`, a config slot for a licence key, `@remotion/media` `<Video>/<Audio>` rather than `Html5Video`/`OffthreadVideo`.

**Licence obligations** (paraphrased from LICENSE.md and the FAQ at `fe9ffaa7`) [V]
- Free License: an individual; a for-profit organisation with up to 3 employees; a non-profit; or anyone evaluating without commercial use. Commercial video creation is allowed. Selling, renting or relicensing a derivative of Remotion itself is not.
- Everyone who renders is their own licensee: cloning this repo grants nothing from Remotion; a larger company forking it needs a Company License.
- Company License: Creators $25/month per seat (anyone writing Remotion code, including through agents); Automators $0.01 per render, $100/month minimum (CLI renders, `renderMedia`, Lambda and `<Player>` embeds count as automation); Enterprise from $500/month. Studio/Player previews are not renders.
- Codec patents (H.264/AAC) are not covered. Agencies delivering only MP4s count only their own headcount.
- v5 draft (PR #3750, open): "organisation or team of individuals with up to 3 people", contractors count towards the threshold, and running a rendering service that accepts user-supplied Remotion code is banned. Whether regular outside contributors to a public repo form a "team" is unanswered [U].
- Package `license` fields are inconsistent (MIT for three/captions/fonts/media-utils/shapes/paths/studio/gsap; UNLICENSED for transitions/effects; "SEE LICENSE IN LICENSE.md" for core/cli/renderer/bundler/player/lambda/google-fonts). Treat the whole stack as Remotion-licensed, since core is always required [V].
- Prior art for documenting this: Remotion's own templates license their content MIT with a note that some entities need a company licence; several public repos carry a "Remotion is separately licensed" NOTICE section [V].

**3D: `<ThreeCanvas>` semantics** (`packages/three/src/ThreeCanvas.tsx`) [V]
- During rendering, `frameloop` is forced to `'never'` and the canvas is advanced once per frame change (it passes `performance.now()` to `advance`); `delayRender` holds capture until the canvas exists and each frame has rendered; children sit in `<Suspense>` whose fallback blocks the render (so `useGLTF`/`useTexture`/drei `Text` wait correctly).
- In Studio and Player `frameloop` defaults to `'always'`: clock-driven code *looks* right in preview but follows wall-clock time in renders, and concurrent tabs disagree.
- `width` and `height` props are required; any `<Sequence>` inside needs `layout="none"`. From 4.0.528 it inherits Sequence timing and premount props.
- `<ThreeWebGPUCanvas>` (`@remotion/three/webgpu`, 4.0.503, experimental) needs three ≥ 0.167, R3F ≥ 9, React 19; awaits `compileAsync`, `renderAsync` and the GPU queue per frame; falls back to WebGL2.
- The official skill's 3D rule (link only: https://github.com/remotion-dev/skills/blob/30d4553ecd46fbc5212fd0ff006ae43af522158b/skills/remotion-markup/3d.md) forbids R3F `useFrame()` and self-animating shaders.

**`--gl` → Chromium flags** (`packages/renderer/src/open-browser.ts`) [V]
| `--gl` | Flags | Use |
|---|---|---|
| `angle` | `--use-gl=angle` (D3D11 on Windows) | Local desktop with a GPU |
| `swangle` | `--use-gl=angle --use-angle=swiftshader` | CI and Lambda (no GPU) |
| `angle-egl` | `--use-angle=gl-egl` | Linux cloud GPUs |
| `vulkan` | `--use-angle=vulkan --use-vulkan=native …` | Vulkan |
| `null` | none (v4 default) | Leaves WebGL to Chrome; three.js does not render headless |

Always passed: `--ignore-gpu-blocklist`, `--enable-unsafe-webgpu`; the headless shell runs `--headless=old`. ANGLE leaks memory on long renders (docs advise splitting). In v4 `angle` fails on GitHub Actions. `remotion.config.ts` applies only to the CLI and Studio: `renderMedia`/`selectComposition` need `chromiumOptions.gl` and every other option passed explicitly, or 3D comes out blank.

**Colour** [V]: colorSpace `"default"` equals bt601 in v4; pass `bt709` explicitly. The docs recommend PNG frames for accurate conversion.

**Browser** [V]: Chrome Headless Shell pinned to 157.0.8080.0 at v4.0.539 (HEAD already 158.0.8127.2). On win64 it is a 125,915,690-byte zip from Google's Chrome-for-Testing CDN, stored in `<nearest dir with package.json, walking up from cwd>/node_modules/.remotion`, with no environment override. Desktop Chrome is irrelevant; Remotion uses its own bundled FFmpeg.

**Windows and Intel iGPU** [V]
- Hardware encoding only via NVENC (Windows/Linux) or VideoToolbox (macOS): no Quick Sync. `hardwareAcceleration: 'required'` fails on Intel; `'if-possible'` silently falls back.
- Shared-memory capture (4.0.534) is macOS/Linux only: Windows still JPEG/PNG-encodes every frame.
- Issue #10701 (`<Video>` frame extraction hang under `angle` on Windows 11 + Intel Iris Xe) closed 2026-08-22; #11393 (client-side render stalls from a small D3D11 decoder pool) open. Pre-transcode video sources to CFR H.264 or image sequences.
- Spaces in paths broke the whisper.cpp installer (#11072, fixed in #11089); keep repo paths space-free anyway.

**Other packages and services** [V]
- Bundler applies its TS loader to `.tsx?` with no `node_modules` exclude, so raw-TypeScript workspace packages need no build step. Rspack opt-in (`Config.setRspack(true)`). `staticFile()` resolves inside one public dir. `<Folder>` names are limited to `[a-zA-Z0-9-]`.
- 12 of 21 `@remotion/transitions` presentations are HTML-in-canvas and need `chrome://flags/#canvas-draw-element` for Studio preview; DOM-based ones: fade, slide, wipe, flip, clockWipe, iris, cube, none, pushCut.
- `@remotion/google-fonts` `loadFont` blocks until ready; unnarrowed CJK families pull 100+ unicode-range slices. `@remotion/fonts` loads local files.
- `@remotion/gsap` (4.0.517, MIT) seeks a paused GSAP timeline to the current frame; GSAP itself is proprietary.
- Client-side rendering (`@remotion/web-renderer`, stable 4.0.491) always sends a telemetry event; server-side rendering only does when a licence key is set.
- Lambda cost examples (measured on 4.0.381): ~$0.001 HelloWorld, ~$0.02 per 1-minute video, ~$0.10 for 10-minute HD; no GPU (3D via swangle, slow). Cloud Run is alpha and not actively developed.
- `@remotion/install-whisper-cpp` on Windows downloads a prebuilt binary; `@remotion/captions` (MIT) turns transcripts into a shared `Caption` type.
- TypeScript: `@remotion/eslint-config-flat@4.0.539` *depends* on typescript 5.9.3 and typescript-eslint 8.71.2; the "TS 7 for templates" issue #9004 is open.
- `template-three` config: Rspack on, OpenGL renderer `angle`, JPEG frames.

**Verified while building the engine** (2026-11-01, Remotion 4.0.539, webpack 5.105.0, three 0.186.1, win64) [V]
- `renderFrames` awaits `onFrameBuffer` before it seeks the next frame, so a slow consumer gives backpressure.
- `remotion gpu --gl=angle` fails with the headless shell 157.0.8080.0 (`chrome://gpu` gives `net::ERR_FAILED`). A WebGL context probe in the same browser is the GPU evidence instead.
- On Windows, `openBrowser`'s temp profiles (`puppeteer_dev_chrome_profile-*`) are left behind: deletion races Chrome's exit.
- Remotion bundles in production mode, and webpack's module concatenation removes each merged module's root from `compilation.modules`. To list every bundled file, read the modules at `finishModules` or walk `ConcatenatedModule.modules`.
- After a crash, `renderFrames` replaces the browser through its own `browserExecutable`, `chromeMode` and `onBrowserDownload` options, not through `puppeteerInstance`. Pass them, or the replacement may resolve or download another browser.
- Remotion's version check warns about zod 4.6.7 versus 4.5.4 (harmless when no Remotion zod schemas are used).
- The webpack cache in `node_modules/.cache/webpack` grows past 1 GB.
- three r186 ignores a material's `envMapIntensity` when its light comes only from `scene.environment` (it uses `scene.environmentIntensity`). Give a material its own `envMap` to set its intensity.

## What we adopted / adapted
- Exact catalog pins for every Remotion package (root `pnpm-workspace.yaml`); upgrades move all active videos together.
- Video and template code have no `package.json`, and all renders run from the repo root through `engines/remotion`, so there is one headless-shell download.
- `engines/remotion`: bundle once, then `renderFrames` per frame-range chunk with lossless PNG frames streamed into the shared runner (not `renderMedia` with `colorSpace bt709`, as first planned: this way the RGB→BT.709 conversion happens once, in post, as for every engine); `gl=angle` locally, `swangle` in CI; every option passed explicitly (v5-ready).
- `@aiv/remotion-kit` `Stage3D` wraps `<ThreeCanvas>`; ESLint bans `useFrame`, clocks and unseeded random in video/template code.
- Remotion notice in README, `ENGINE.md` and the template; official skills documented as an opt-in plugin install in `ENGINE.md` (see `claude-code-packaging.md`).
- Post stays outside Remotion: render picture, master audio and mux with system FFmpeg, so audio changes don't re-render frames.

## What we deliberately did NOT adopt, and why
- Vendoring or quoting Remotion source, docs or skills: source-available licence; skills unlicensed.
- Package-per-video: duplicate browser downloads (~126 MB zip each) and version drift.
- Lambda / Cloud Run / client-side rendering as defaults: no GPU, alpha status, telemetry and the open Windows decoder stall respectively.
- Hardware encoding through Remotion: unsupported on Intel.
- HTML-in-canvas shader transitions as template defaults; Google Fonts CDN loading at render time (use local OFL fonts).
- Theatre.js (see `r3f-drei-postprocessing.md`).

## Gotchas
- Studio previews hide nondeterminism (`frameloop='always'`): verify on rendered output, rendered twice.
- Without `--gl=angle` (or `swangle`) three.js canvases render empty headless.
- ANGLE memory leaks + ~8 GB shared memory: low concurrency and chunked renders; benchmark with `remotion benchmark --concurrencies=1,2,3,4` rather than trusting the default of 4.
- Retagging bt601 output as bt709 without converting shifts colours.
- `npx remotion skills add` creates a `.claude/skills` symlink; Windows checks symlinks out as text unless symlinks are enabled.

## Not read
Remotion Elements, `@remotion/media` internals, the `remotion-license` skill (4.0.540), Studio interactivity APIs. Not run: `remotion benchmark` on the reference host (`remotion gpu` was run and fails there; see `engines/remotion/ENGINE.md`, Gotchas). Unanswered: the team-threshold question for outside contributors; when 5.0 ships; whether the Windows headless shell (stock Chrome for Testing, issue #12638) limits HTML-in-canvas effects.
