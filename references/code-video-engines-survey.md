# Code-driven video engines — survey and verdicts (2026-11)

| | |
|---|---|
| Upstream | Per row below; curated index: https://github.com/voidforall/awesome-video-as-code (`31219c12b30456a73c7b5a101edb076b169169af`, CC0-1.0) |
| Pin | Per row (versions and SHAs as of 2026-11-01) |
| Licence | Per row |
| Accessed | 2026-11-01 |
| Stale after | 2027-05-01 for "skip" verdicts (dormant projects rarely revive quickly); 2026-12-01 for anything pre-1.0. |

## What it is
A comparison of 16+ code-driven video engines and capture techniques other than Remotion
(see `remotion.md`), checked against live repos and registries.

## Why it matters here
The engine boundary is a file (mezzanine + `render.json`), so new engines are cheap to add,
but each first-class engine costs maintenance. This note records why each candidate is in,
optional or out, so the question isn't re-researched per video.

## Key facts — verdicts
| Engine | State on 2026-11-01 | Licence | Verdict |
|---|---|---|---|
| `engines/web` page contract (ours) | active | MIT | **First-class** |
| Remotion 4.0.539 | active | Remotion License | **First-class**, see `remotion.md` |
| HyperFrames 0.8.225 | very active, pre-1.0 | Apache-2.0 (+ proprietary GSAP) | Optional, see `hyperframes.md` [V] |
| Manim CE 0.22.1 | active | MIT | Deferred first-class for math, see `manim.md` [V] |
| ManimGL | master unreleased since 1.7.2 | MIT | Skip [V] |
| Motion Canvas | last release 3.17.2 (2024-12) / 3.18.0-alpha.0 (2025-02); HEAD `7b91435c` (2026-07, docs domain only) | MIT | Skip: dormant, renders from its editor UI, no headless CLI [V] |
| Revideo (now `midrender/revideo`) | 0.11.0 (2026-07-10) after a 17-month gap; HEAD `b5de67a0` | MIT | Skip/reference: thin cadence, PostHog telemetry on by default (`DISABLE_TELEMETRY=true`), overlaps others [V] |
| Theatre.js | public repo frozen since 2024-04 | core Apache-2.0, studio AGPL-3.0-only | Skip [V] |
| editly / FFCreator | inactive (2022 / 2024) | MIT | Skip: native headless-gl and node-canvas deps [V] |
| Twick | active | npm says MIT, repo LICENSE is the "Sustainable Use License" | Skip: licence mismatch, editor SDK [V] |
| Etro / Diffusion Studio / WebVideoCreator | — | GPL-3 / MPL-2.0 / Apache-2.0 | Skip [V] |
| timecut / timesnap | inactive 2023–24 | BSD-3 | Concepts only [V] |
| Blender (bpy) | local LTS 4.5.x; 5.2 LTS since 2026-07-14; PyPI `bpy` 5.2.3 needs Python ==3.13 | GPL-3.0 (outputs unencumbered) | Optional, assets and short hero shots [V] |
| glslViewer 3.5.2 | Windows zip, `--headless`, `-E record,<file>,<A>,<B>[,<fps>]` / `sequence` | BSD-3 | Optional for shader-only scenes [V] |
| p5.js 2.3.4 | 2.4.0-rc.2 | LGPL-2.1 | Optional via the web page contract (instance mode, `noLoop()`, `redraw()` from the frame index) [V] |
| matplotlib 3.11.2 | `FuncAnimation` + `FFMpegWriter` on Agg | PSF-style | Optional for data plots [V] |
| mediabunny 1.65.0 | WebCodecs muxer/encoder with `CanvasSource`, has llms.txt | MPL-2.0 | Optional in-page encoding for drafts [V] |

## Key facts — capture techniques
- **Seek + capture** (page exposes a pure function of time, harness seeks then captures) is the common pattern across HyperFrames, lemo-opuscar, community agent toolkits and our map-of-middle-earth harness [V].
- **Playwright `page.clock`** (since 1.45) fakes `Date`, `Temporal.Now`, timers, `requestAnimationFrame`, `requestIdleCallback`, `performance` and `Event.timeStamp` (`install`, `pauseAt`, `runFor`, `fastForward`, `setFixedTime`). It does **not** control compositor-driven CSS animations or media playback; a harness for third-party pages must also pause and seek `document.getAnimations()` [V].
- **CDP `HeadlessExperimental.beginFrame`**: experimental, works only in chrome-headless-shell (not `--headless=new`), needs flags such as `--deterministic-mode`, `--enable-begin-frame-control`, `--run-all-compositor-stages-before-draw`. puppeteer-capture (MIT, npm 1.69.0, https://github.com/alexey-pelykh/puppeteer-capture) rates its deprecation risk as moderate over 1–3 years. Do not make a contract depend on it [V].
- **Real-time capture** (screencast, MediaRecorder, OBS-style) drops frames and yields variable frame rate: never for finals [V].
- **WebGPU canvases** screenshot black in headless Chrome on Windows; use render-target readback (MAP) [V].
- Headless Chrome WebGL can silently fall back to SwiftShader, which is slower and changes output; record the renderer string and warn [V].
- Community agent toolkits worth knowing (all MIT): howseen-ai/claude-motion-design `render_template.py` @`3d90d349ef3fdde9b7e89de4df4a2159c9e8697f` (seek, double rAF, element screenshot, draft/full modes, `tmix` sub-frame motion blur, contact sheet); iart-ai/motion-skills `tools/verify` @`238dfc55aac123d4649be39adfe58c43193ca349` (contact sheet, ffprobe assertions, seek-shot) [V].
- **gl-transitions** (MIT, per-file `// License:` headers; 60 of 143 sampled were MIT) can be vendored file by file with headers intact; check each header [V]. Shadertoy code defaults to CC BY-NC-SA 3.0 unless the author says otherwise [V].

## Key facts — shared post stage
- The local FFmpeg 8.0.1 full build already has everything post and QA need: libx264/x265, libsvtav1, prores_ks, libvpx-vp9, QSV encoders, AAC, Opus, `loudnorm`, `ebur128`, libass `subtitles`, `tile`, `blackdetect`, `freezedetect`, `scdet`, `ssim`, `psnr`, `libvmaf`, `tmix`, `drawtext`, `silencedetect`, `zscale`, `libplacebo`, and a whisper.cpp filter [V].
- FFmpeg converts RGB→YUV with the BT.601 matrix unless told otherwise; Chrome, Blender, matplotlib and canvas output are sRGB. Convert explicitly to BT.709 limited range and tag it (see `youtube-publishing.md`) [V].
- Almost every engine outputs silent or engine-specific audio: keep the audio timeline outside engines and mux once in post [V].

## What we adopted / adapted
- Engine boundary as a file: every engine is an adapter driven by the shared runner, which writes the mezzanine + `render.json`; `render.v1` is derived from the first real output rather than specified up front (a full RenderRequest/RenderResult schema was proposed; we deliberately wait).
- Engines get an adapter only when a video needs them (rule of two for promotion); `engines/web` + `engines/remotion` first.
- Mezzanines stay RGB or visually lossless where feasible; post owns every delivery encode.
- Pages expose a pure frame function; RNG seeded; fonts bundled and awaited; no network mid-render.

## What we deliberately did NOT adopt, and why
- Motion Canvas, Revideo, Theatre.js, editly, FFCreator, Twick, Etro, WebVideoCreator: dormant, telemetry by default, native GL deps, or licence problems.
- beginFrame-based capture: experimental and Linux/headless-shell only.
- A per-scene multi-engine manifest and content-addressed scene cache (both proposed in research): speculative until a video mixes engines.
- Blender for frame rendering on the reference host: Cycles has no GPU path on a Gen11 iGPU (oneAPI needs Arc), so it is CPU-only and slow [V]; MAP used Blender for assets only.

## Gotchas
- Disk: a 10-minute 30 fps PNG sequence at 1080p can need tens of GB [U, estimate]; pipe frames to the encoder.
- Memory: each Chrome render worker takes roughly 0.5–1 GB [U]; cap workers on ~8 GB hosts.
- Blender: pin the version per video, always pass `--factory-startup` and `--python-exit-code 1`; API identifiers change between versions (4.5 reports `BLENDER_EEVEE_NEXT`) [V].
- Vendor benchmark pages are not evidence; decide on our own fixtures.

## Not read
HyperFrames Lottie/D3/TypeGPU adapters; Diffusion Studio and Etro internals; p5 2.x asset-loading changes (flagged as a likely agent pitfall, not checked); real throughput of any engine here on the reference host (only FFmpeg encodes were measured, see `toolchain-2026-11.md`).
