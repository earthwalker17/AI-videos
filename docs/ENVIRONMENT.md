# Environment

What a machine needs to work on this repository, the pinned versions, the reference host
the numbers in the docs come from, and the optional modules that are added when a video
first needs them. `pnpm aiv doctor` checks a machine and prints the fix for each problem.

## Setup
1. Install **Node** (`>=24.11`), **pnpm** (the version in `package.json`
   `packageManager`; `corepack enable` provides it), **Git** and **FFmpeg** (≥ 8, a full
   build with libx264, on `PATH`).
2. `pnpm install`
3. `pnpm aiv doctor --fix` installs the pinned browsers (into `.cache/browsers` and
   `node_modules/.remotion`) and checks the GPU path. A warning names the fix.
4. `git config core.hooksPath .githooks` runs `aiv check --staged` before every commit.
5. Optional: copy `aiv.local.example.json` to `aiv.local.json` for machine-specific settings.

## Pinned versions
Third-party versions are pinned once, in the pnpm catalog (`pnpm-workspace.yaml`); this
table is generated from it.

<!-- aiv:generated versions -->
| Tool or package | Version |
|---|---|
| `node` | >=24.11 |
| `pnpm` | 11.1.3 |
| `remotion` | 4.0.539 |
| `@remotion/bundler` | 4.0.539 |
| `@remotion/cli` | 4.0.539 |
| `@remotion/renderer` | 4.0.539 |
| `@remotion/three` | 4.0.539 |
| `react` | 19.3.1 |
| `react-dom` | 19.3.1 |
| `three` | 0.186.1 |
| `@react-three/fiber` | 9.8.2 |
| `@react-three/drei` | 10.7.9 |
| `postprocessing` | 6.39.5 |
| `zod` | 4.6.7 |
| `@fontsource-variable/inter` | 5.3.0 |
| `playwright-core` | 1.64.1 |
| `vite` | 8.3.5 |
| `typescript` | 5.9.3 |
| `tsx` | 4.23.15 |
| `vitest` | 5.0.5 |
| `eslint` | 10.14.0 |
| `@eslint/js` | 10.0.1 |
| `typescript-eslint` | 8.72.1 |
| `globals` | 17.13.0 |
| `@types/node` | 24.19.2 |
| `@types/react` | 19.3.0 |
| `@types/three` | 0.186.0 |
<!-- /aiv:generated -->

The web engine's browser is the Chrome for Testing build that the pinned `playwright-core`
expects; the Remotion engine's is the Chrome Headless Shell that the pinned
`@remotion/renderer` expects. FFmpeg is not pinned by the repository; its version and a hash
of its build configuration are recorded in every `render.json`.

## Reference host
The measured numbers in the docs come from this laptop unless they say otherwise. It is a
deliberately modest machine: what works here works on most.

| | |
|---|---|
| OS | Windows 11 |
| CPU | 4-core Intel Core i5, 10th generation |
| GPU | Intel UHD integrated graphics (D3D11 through ANGLE; WebGPU available) |
| RAM | 8 GB (about 2–3.5 GB free while working) |

Measured there:
- Web template, 150 frames: 0.05–0.07 s per frame at 960x540, 0.12 s per frame at 1920x1080,
  plus about 10 s fixed cost per render call.
- Remotion template (React Three Fiber, shadows, bloom; frame capture, PNG decode and
  lossless encode included): 0.16–0.19 s per frame at 960x540, 0.28–0.37 s per frame at
  1920x1080. A changed bundle costs about 5 s with a warm webpack cache and about 50 s cold; an
  unchanged one is reused.
- Remotion with React Three Fiber in the previous film, *THE AI STACK* (a heavier scene,
  JPEG frames, `renderMedia`): about 0.8–1.2 s per 1080p frame at concurrency 1; concurrency 2
  was not faster.
- Disk: the two pinned browsers take about 440 MB (`.cache/browsers`) and 283 MB
  (`node_modules/.remotion`). Remotion's webpack cache in `node_modules/.cache` grows past
  1 GB and is safe to delete.

On a machine like this, long renders run in chunks of at most ten minutes per call (exit `75`
means "call again"), one heavy job at a time.

## Settings

| Variable | Effect |
|---|---|
| `AIV_ALLOW_SOFTWARE_GL=1` | Allow software rendering (SwiftShader, llvmpipe) where engines normally refuse it, for CI without a GPU; the Remotion engine then renders with `--gl=swangle`. Pixels differ from a GPU render. |
| `AIV_MIN_FREE_MB` | Free memory (MB) a heavy job needs before it starts (default 1500). |
| `AIV_HEAVY_LOCK` | Path of the machine-wide heavy-job lock file. |
| `AIV_PREVIEW_ENCODER` | Force the draft encoder (`libx264`, `h264_qsv`, `h264_nvenc`, …). |
| `AIV_DEBUG=1` | Print stack traces. |
| `AIV_QUIET=1` | Less progress output. |

`aiv.local.json` (gitignored) holds the per-machine settings that should not be environment
variables: `lockPath` (share one lock with another repository so the two never render at
once), `minFreeMB`, `abortFreeMB`, and `sweepApps`, an opt-in list of background apps that
may be stopped, only while they have no open window, when memory runs short.

## Platform notes
- **Windows.** Use a short repository path without spaces. Set `core.longpaths` true. A
  `python` on `PATH` may be another application's virtual environment, and `convert` is a
  Windows system tool rather than ImageMagick: tools in this repository never rely on either
  name. Consoles with a non-UTF-8 code page need `PYTHONIOENCODING=utf-8` for Python tools.
- **macOS.** Engines use ANGLE on Metal. The memory guard reads `vm_stat`. Not yet verified
  on a real Mac.
- **Linux.** Engines use the GPU through ANGLE when available; CI uses software GL with
  `AIV_ALLOW_SOFTWARE_GL=1` and checks ranges, not bytes.

## Optional modules
Added when a video first needs them, never speculatively. Each gets a `doctor` check when it
lands.

| Module | For | Status |
|---|---|---|
| Python 3.13 via a standalone `uv` | sample-based music, speech synthesis and recognition | deferred until the first Python tool |
| Manim Community + a TeX distribution | mathematical animation | deferred until the first video that needs it |
| Blender 5 (headless, `BLENDER_BIN`) | offline 3D | deferred |
| Speech: Whisper-class recognition, a local TTS voice | narration checks, drafts | deferred |
| Cloud rendering | renders this laptop cannot finish in reasonable time | deferred; needs the user's approval for any cost |
