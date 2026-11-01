# HyperFrames — candidate HTML engine

| | |
|---|---|
| Upstream | https://github.com/heygen-com/hyperframes · docs index https://hyperframes.heygen.com/llms.txt |
| Pin | HEAD `ee50cd2fc0d0fe4a4eac22683ed23b6066289ab3` (2026-10-31T21:04Z), npm `hyperframes` 0.8.225. Detailed reading at `47fe68562f39d91b4d9280dff41ae43d67805fae` (0.8.224, same day). |
| Licence | Apache-2.0. Its default animation library, GSAP, is proprietary ("Standard No Charge" licence: https://gsap.com/community/standard-license/). |
| Accessed | 2026-11-01 |
| Stale after | 2026-11-15. 576 npm versions between 2026-03-23 and 2026-10-31; a new patch appeared within a day. |
| Status here | Optional; not an engine in this repo until two videos need it. |

## What it is
HeyGen's open-source HTML-to-video renderer, built for coding agents: a composition is an
HTML file whose timed elements carry data attributes, animated by paused GSAP timelines (or
other adapters) that are seeked frame by frame and captured from headless Chrome.

## Why it matters here
It is the strongest agent-oriented HTML engine, renders on Windows, and its `hf-seek` event
means our own page contract could run under it with a few lines of glue. It is also a
source of concrete lessons (LFS patterns, eol, Windows CI).

## Key facts
- Stats: Apache-2.0, ~76.5k stars, created 2026-03-10 [V].
- Requires Node ≥ 22 and FFmpeg; optional `--docker` mode pins Chromium, fonts and the encoder for cross-machine pixel reproducibility [V].
- Composition model: elements with `data-composition-id`, `data-start`, `data-duration`, `data-track-index`; timed elements use `class="clip"`; nesting via `data-composition-src` [V].
- Time: `t = floor(frame)/fps`; every frame is seeked, never played. Documented rules: no `Date.now`/rAF/timers, no unseeded `Math.random`, no fetch mid-render, fixed size, finite length [V].
- Built-in runtime adapters: GSAP, CSS, WAAPI, Anime.js, Lottie, Three.js, TypeGPU, D3, map libraries, plus video-texture compatibility [V].
- GPU/canvas pages receive an `hf-seek` CustomEvent with detail `{time, waitUntil}` (defined in `packages/core/src/runtime/adapters/seek-dispatch.ts`, dispatched by the three and typegpu adapters) [V].
- Public `FrameAdapter` interface `{id, init?, getDurationFrames, seekFrame, destroy?}`, marked "experimental v0" [V].
- Capture mode: CDP `HeadlessExperimental.beginFrame` only for chrome-headless-shell on Linux; everywhere else `Page.captureScreenshot` ("screenshot" mode). So on Windows determinism rests entirely on seeking [V].
- `.github/workflows/windows-render.yml` runs on `windows-latest` and disables Defender real-time monitoring (a useful CI speed hint) [V].
- Telemetry is on by default; `HYPERFRAMES_NO_TELEMETRY=1` or `DO_NOT_TRACK=1` turns it off [V].
- Render provenance: output containers carry `hyperframes_renderer` / `hyperframes_version` tags [V].
- Outputs: MP4, MOV (ProRes 4444 with alpha), WebM (VP9 alpha), GIF, PNG sequence, HLS; Lambda and Cloud Run packages exist [V].
- Agent material: Claude Code plugin (`hyperframes@hyperframes` from the `heygen-com/hyperframes` marketplace), 7 skills, CLAUDE.md/AGENTS.md, llms.txt indexing 134 docs + 449 catalog pages; CLI commands for agent loops (`lint --json`, `check`, `inspect`, `snapshot`, `doctor`, `benchmark`, `compare`, `layout`, `contrast-*`) [V].
- Catalog: 210 blocks, each `registry/blocks/<name>/registry-item.json` with name, type, title, description, tags, licence, dimensions, duration, files with target paths, and an external preview URL; `themes/CONTRACT.md` defines 18 theme tokens (palette, type, shape/spacing, motion durations and easings) [V].
- `.gitattributes` comments: non-recursive LFS patterns let binaries into history "forever" (fixed with `**`); `eol=lf` is needed against Windows CRLF/BOM [V].
- Some features depend on HeyGen's cloud (avatars, TTS, publishing) [V].
- In a 2026-10-11 third-party test of 16 video skills making the same 15 s promo, all passed the same basic checks as a no-skill baseline; the HyperFrames skill was the slowest (23.5 min vs 4.4 min baseline) [S].
- GSAP's licence has a Prohibited Uses clause aimed at tools that let users build animations without code in competition with Webflow; otherwise free when end users are not charged [V].

## What we adopted / adapted
- Nothing installed. Ideas only: seek-driven determinism rules (already ours), container provenance tags (→ `render.json` / post metadata), the registry-item fields (licence per item, external preview) as input for a future catalog format, `eol=lf` from day one (already in `.gitattributes`).
- Proposed, not planned: an optional `hf-seek` listener in the `engines/web` page runtime that calls our frame renderer, so a page could also be captured by HyperFrames.

## What we deliberately did NOT adopt, and why
- HyperFrames as a first-class engine: pre-1.0 churn, experimental adapter API, and two engines (web, Remotion) already cover M1–M2.
- GSAP inside reusable library components: proprietary, with a Prohibited Uses clause. Prefer WAAPI, CSS or Anime.js (MIT) for shared code.
- Its upstream skills/plugin vendored into the repo: install-only if ever used.
- Its "vs Remotion" marketing page as evidence: decide on our own fixture renders.

## Gotchas
- Float version ranges will break old videos: pin exactly and keep golden fixtures if adopted.
- Set the telemetry opt-out in repo scripts and `.env.example` before the first run.
- Anything animating on the compositor clock (CSS transitions without an adapter, `<video>` playback) drifts in screenshot mode.

## Not read
Engine internals beyond capture-mode selection and the Windows streaming-encode workarounds in `packages/engine/src/config.ts`; the Lottie/D3/TypeGPU adapters; Lambda and Cloud Run packages; the content of the 7 skills. Never rendered on the reference host.
