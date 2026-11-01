# Toolchain snapshot — versions and constraints as of 2026-11-01

| | |
|---|---|
| Upstream | npm registry, PyPI JSON API, https://nodejs.org/dist/index.json, GitHub releases of each tool, https://www.gyan.dev/ffmpeg/builds/ |
| Pin | This table *is* the pin: "repo HEAD" = what the root `pnpm-workspace.yaml` / `package.json` / `.nvmrc` pinned on 2026-11-01; "latest" = upstream on 2026-11-01 |
| Licence | Facts only (version numbers and constraints) |
| Accessed | 2026-11-01 |
| Stale after | **2026-12-01**. Remotion ships about twice a week, HyperFrames daily, Node/pnpm monthly. The generated ENVIRONMENT version table in `docs/` is the live source once it exists; this note keeps the *why*. |

## What it is
A dated record of which versions the repo pins, what upstream had released on the same
day, and the constraint that explains every gap.

## Why it matters here
"Upgrade to latest" is wrong for at least five packages right now. The reasons are
peer ranges and interpreter ceilings, not taste; this note saves re-deriving them.

## Key facts — Node / TypeScript stack
| Tool | Repo HEAD | Latest 2026-11-01 | Constraint / reason |
|---|---|---|---|
| Node.js | `engines >=24.11`, `.nvmrc` 24 (dev host 24.19.0) | 26.13.0 LTS "Lithium" (2026-10-28, support to 2029-04-30); 24.22.2 (24 "Krypton" in maintenance since 2026-10-20, ends 2028-04-30) | Remotion CI tests Node 26 [V]; the dev host trails 24.x security fixes [V] |
| pnpm | `packageManager` pnpm@11.1.3 | `latest` 12.16.1, `next-12` 12.17.0, `latest-11` 11.28.9 | pnpm 12 fails on unknown `pnpm-workspace.yaml` keys and drops `--frozen-lockfile false`; pnpm ≥ 10 blocks dependency build scripts unless approved (`allowBuilds: {esbuild: true}`) [V] |
| TypeScript | 5.9.3 | 7.0.2 (native port); 6.0.3 exists | `@remotion/eslint-config-flat@4.0.539` *depends* on typescript 5.9.3 + typescript-eslint 8.71.2; typescript-eslint 8.72.1 peers `<6.1.0`. A root TS 6/7 means two compilers or broken lint [V] |
| typescript-eslint / eslint | 8.72.1 / 10.14.0 | — | Lint is the determinism enforcer: keep it working [V] |
| remotion + `@remotion/*` | 4.0.539 (exact, all equal) | 4.0.539 (2026-10-26); 5.0 unreleased | Lockstep required; see `remotion.md` [V] |
| Chrome Headless Shell (Remotion) | 157.0.8080.0 (pinned by 4.0.539) | Remotion HEAD 158.0.8127.2; CfT stable 156.0.8078.80 | Downloaded next to the nearest `package.json`: render from the repo root [V] |
| three / `@types/three` | 0.186.1 / 0.186.0 | 0.187.0 (2026-10-30) | postprocessing 6.39.5 peers three `<0.187.0` [V] |
| @react-three/fiber | 9.8.2 | 9.8.2; 10.0.0-alpha.6 | v10 makes WebGPU the default Canvas [V] |
| @react-three/drei | 10.7.9 | 10.7.9 | Deny-list clock-driven helpers [V] |
| @react-three/postprocessing / postprocessing | 3.2.2 / 6.39.5 | same (postprocessing 7 alpha/beta) | Pins the three ceiling [V] |
| react / react-dom / `@types/react` | 19.3.1 / 19.3.1 / 19.3.0 | 19.3.1 | R3F 9.8.2 peers react `<19.4` [V] |
| zod | 4.6.7 | 4.6.7 | `@remotion/media` brings its own exact 4.5.4: don't dedupe [V] |
| playwright-core | 1.64.1 | 1.64.1 | Its Chromium is revision 1248 (156.0.8078.4); older cached revisions are stale [V] |
| vite / vitest / tsx | 8.3.5 / 5.0.5 / 4.23.15 | — | — |
| `@fontsource-variable/inter` | 5.3.0 | — | OFL fonts from the lockfile render identically on Windows and Linux CI [V] |
| KaTeX (optional) | not installed | 0.19.1 (MIT) | Math without a TeX install [V] |
| gsap + `@remotion/gsap` (optional) | not installed | 3.15.0 + 4.0.539 | GSAP licence is proprietary [V] |
| hyperframes (optional) | not installed | 0.8.225 | Pin exactly; telemetry opt-out [V] |
| mediabunny / p5 (optional) | not installed | 1.65.0 (MPL-2.0) / 2.3.4 (LGPL-2.1) | — [V] |

## Key facts — media and system tools
| Tool | Dev host | Latest 2026-11-01 | Notes |
|---|---|---|---|
| FFmpeg | 8.0.1 full build (gyan.dev) | 9.0.2 (gyan.dev release, built 2026-10-29) | 8.0.1 already has libx264/x265, svtav1, prores_ks, vp9, QSV, loudnorm, ebur128, libass, zscale, libplacebo, libvmaf, whisper; record version + buildconf hash in `render.json` [V] |
| Blender | 4.5.3 LTS (bundled Python 3.11, not on PATH; use `BLENDER_BIN`) | 5.2.3 LTS (Python 3.13.13, fixes to July 2028); 4.5.15 | Cycles has no GPU path on Intel Gen11 (oneAPI needs Arc) [V] |
| Git for Windows | 2.52 | 2.56.0.windows.4 (2026-10-26) | Set `core.longpaths true` [V] |
| Git LFS | installed, unused | 3.8.1 | Policy: no LFS (see `github-storage-limits.md`) |
| reuse / gitleaks / pre-commit | not installed | 6.3.0 / 8.30.1 / 4.7.0 | CI tools (see `licensing-tooling.md`) [V] |
| ImageMagick | not installed | 7.1.2-34 | On Windows always call `magick`; `convert` resolves to a Windows system disk tool [V] |
| whisper.cpp CLI | not installed | v1.9.5 | FFmpeg ≥ 8 embeds a whisper filter already [V] |
| Typst CLI | not installed | 0.15.1 | Equations to SVG without TeX [V] |

## Key facts — Python (deferred until the first Python module)
- **3.13 is the only interpreter every planned tool accepts** [V]: kokoro-onnx 0.6.1 `<3.14`; hexgrad `kokoro` 0.9.4 and misaki `<3.13` (avoid; PyTorch package); bpy 5.2.3 `==3.13.*`; onnxruntime 1.31.1 Windows wheels cp311–cp314 only; av 19.0.2 and soxr 1.1.0 cp312-abi3; typst cp38-abi3; ctranslate2 4.8.4 cp39–cp315; manim 0.22.1 `>=3.11`; librosa 1.0.0 `>=3.12`.
- uv latest 0.13.6 (2026-10-27); **uv 0.13 defaults to Python 3.15**, which has no onnxruntime wheel, so commit `.python-version` = 3.13 and `requires-python = ">=3.13,<3.14"` in every uv project [V].
- Use a standalone uv, not a copy bundled with another application; call tools through `uv run`, never a bare `python`, whose resolution on Windows hosts can point at an unrelated interpreter [V].
- Voice/ASR when needed: kokoro-onnx 0.6.1 + espeakng-loader 0.2.4 (win wheel); faster-whisper 1.2.1 / ctranslate2 4.8.4 [V].

## Key facts — measured on the reference host class
Windows 11 laptop, 4-core/8-thread 15 W CPU, Intel Gen11 (Ice Lake) iGPU, ~8 GB RAM shared
with the GPU, typically ~3.5 GB free. FFmpeg `testsrc2` → null, 120 frames [V]:

| Encode | Throughput | Peak RSS |
|---|---|---|
| 1080p30 libx264 medium CRF 18 | ~39 fps | 0.83 GiB |
| 1080p30 h264_qsv | ~114 fps | 0.26 GiB |
| 1080p30 hevc_qsv | ~65 fps | — |
| 1080p30 libsvtav1 preset 8 | ~26 fps | 1.15 GiB |
| 4K60 libx264 medium | ~11 fps | 2.97 GiB |
| 4K60 libx264 veryfast | ~26 fps | 2.08 GiB |
| 4K60 h264_qsv | ~55 fps | 0.75 GiB |
| 4K60 hevc_qsv Main10 | ~29 fps | 1.83 GiB |

- Quick Sync works for H.264, HEVC (incl. Main10) and VP9; **AV1 hardware encode and decode do not** on Gen11 [V]. Remotion cannot use Quick Sync at all (NVENC/VideoToolbox only) [V].
- Remotion + R3F measured at about 1 s/frame at concurrency 1; MAP's final tier about 0.55 s per sub-sample [S, from the foundation plan].
- Chrome's WebGPU blocklist has no Intel D3D12 entry, so headless WebGPU may work on Gen11; MAP observed hardware WebGPU in new headless Chrome on this host class [V for MAP's observation, U for Remotion's headless shell].

## Windows traps (generic, any Windows dev host) [V]
- System git config may set `core.autocrlf=true` and `core.symlinks=false`; long paths may be disabled. The repo's `.gitattributes` forces LF; avoid committed symlinks; enable long paths.
- NTFS is case-insensitive while Linux CI is not: an import with the wrong case passes locally and fails in CI.
- Reserved names (CON, PRN, AUX, NUL, COM1–9, LPT1–9), trailing dots/spaces and `:` are invalid in file names: validate slugs.
- Paths with spaces break some CLI wrappers, `@import` in CLAUDE.md, and older TeX tooling: keep the clone path short and space-free.
- Proprietary system fonts look right locally and are absent on Linux renderers.
- Docker Desktop on an 8 GB Windows Home host is costly; use GitHub's Linux runners for Linux parity.

## What we adopted (per the plan)
Exact pins above in the root catalog with reasons beside them; Node and pnpm kept at the
proven host versions for now (upgrades deferred, `aiv doctor` prints the fix); a pinned
Chrome for Testing in `.cache/` for the web engine, system Chrome only by explicit flag;
toolchain fingerprint (Chrome, FFmpeg version + buildconf hash, Node, engine versions) in
`render.json` and release manifests; Python 3.13 via standalone uv when the first module lands.

## What we deliberately did NOT adopt, and why
Floating to `latest` for three, R3F, React, TypeScript or pnpm 12 (reasons in the tables);
Theatre.js, Motion Canvas, Revideo, sox (unmaintained), Inkscape (Chrome/resvg rasterise
SVG), DVC, Git LFS; Docker on this host class.

## Not read
Release notes of Node 26 and pnpm 12 beyond the breaking points listed; FFmpeg 9.0 changelog; Chrome for Testing channel details; GPU driver update channel for Gen11; the hardware-GL probe of Remotion's headless shell on the reference host (not run in the sweep).
