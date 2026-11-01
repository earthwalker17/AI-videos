# lemo-opuscar — engine and method

<!-- REUSE-IgnoreStart: the upstream's holder, not a notice for this file -->

| | |
|---|---|
| Upstream | https://github.com/lemomo-ai/lemo-opuscar |
| Pin | `bebbbe1aa92a3cb4bb6f83500e61b23a17d1aa00` (commit 2026-10-31T14:52Z) |
| Licence | MIT, "Copyright (c) 2026 LemoLab" (code and docs). Demo films and stills CC BY 4.0, except three voice tracks (macOS `say`, Edge TTS, Doubao). Fonts OFL-1.1; sample packs CC0 / CC BY 3.0 / CC BY 4.0; Poly Haven assets CC0. |
| Accessed | 2026-11-01 |
| Stale after | 2026-12-01. The project was about 5 weeks old at the pin and pushed daily: re-diff any file before adapting it. |
| Our use | Ideas and method; any adapted file carries SPDX licence (MIT) and copyright (2026 LemoLab) headers and an Adapted-from URL at `bebbbe1` (see `NOTICE.md`). |

<!-- REUSE-IgnoreEnd -->

## What it is
A library of 66 film styles (plus `styles/_template`) that Claude Code agents use to make
short films entirely in code, with a deliberately small shared `core/`: Node ESM capture
tools, POSIX sh mastering, Python voice/ASR/audio. One maintainer; about 10.1k stars at the pin.

## Why it matters here
It is the closest prior art for both halves of this repo: a framework-free page contract
for capturing frames, and a written directing method with *numeric* quality bars that
agents can be checked against. Its provenance files, catalog generator and plugin layout
answer questions we would otherwise research again.

## Key facts — engine (`core/`)
- **Page contract** [V]: `window.READY` (required, waited up to 180 s), `window.render(t)` (required, must be deterministic), `window.DUR` (seconds), optional `window.EV=[{t,type,…}]` (exported to `events.json` for audio tools) and `window.TEXTS(t)` → `[{id,text,x0,y0,x1,y1}]` (for readcheck). `SUBS` by convention; `?k=v` passed through as `location.search`.
- **Capture** [V]: Playwright drives chromium-headless-shell at 1920×1080, device scale 1. Per frame: evaluate `render(f/FPS)`, then a JPEG screenshot (q95). No virtual clock, no CDP time control, no rAF hooking: determinism is purely an authoring rule. That the screenshot is CDP `Page.captureScreenshot` is [U] (Playwright internals).
- **Browser flags** [V]: `--enable-gpu --ignore-gpu-blocklist --font-render-hinting=none --force-color-profile=srgb`; `--use-angle=metal` only on macOS. Warns when `WEBGL_debug_renderer_info` reports SwiftShader/llvmpipe.
- **Fail fast** [V]: `pageerror` → exit 1; HTTP ≥ 400 on a script or document → exit 1; other 404s warn once.
- **Static server** [V]: binds 127.0.0.1 only, rejects non-local Host headers (DNS-rebinding guard), guards path traversal, mounts an external project at `/@film/`.
- **Parallelism** [V]: `--workers` (default 3) splits the frame range into contiguous chunks; each worker has its own browser and ffmpeg (mjpeg pipe → libx264 medium CRF 14 yuv420p); segments are concat-copied. Pid lockfile (12 h stale), cleanup on SIGINT/SIGTERM.
- **`slot.mjs`** [V]: optional machine-wide semaphore (`RENDER_SLOTS`): mkdir mutex in the OS temp dir, 15 s heartbeat, takeover after 90 s, free-memory gate (default 30 %).
- **`mux.sh`** [V]: two-pass `loudnorm` I=−14 / TP=−1.2 / LRA=11 with `linear=true`, resample 48 kHz, pad to picture; optional film grain; libx264 slow CRF 19; AAC 256k; `+faststart`; then `ebur128` verification (warns outside −15…−13 LUFS or peak > −1 dB). Parses the WAV header to reject truncated audio; needs ffmpeg ≥ 7. Never leaves a partial file.
- **Colour default** [V]: full-range `yuvj420p` tagged bt470bg; only `LEMO_COLOR=bt709` converts to limited-range BT.709. The chain is JPEG q95 → x264 CRF 14 → x264 CRF 19 (three lossy generations).
- **readcheck** [V]: steps 0.04 s through `TEXTS(t)`; each text must be fully in frame and unchanged for ≥ max(1.5, CJK/4.5 + other/15 + 1.5) s; only the first continuous stretch counts; exit 0 pass / 1 fail / 2 not checkable (not a pass).
- **ASR round trip** (`core/tts/asr_check.py`) [V]: faster-whisper CPU int8, beam 5. English word-exact after normalisation (integers 0–999 to words); CJK difflib similarity ≥ 0.92 with a Chinese numeral parser; a number heard as another number fails. Per-line `asr` override; writes `words.json` word timings.
- **TTS file contract** [V]: `lines.json [{id,text,say?,voice?,speed?,lang?}]` → `<id>.wav` + `dur.json`. The `say` (spoken form) vs `text` (displayed form) split is the useful part. Kokoro via kokoro-onnx (offline, 24 kHz); edge-tts cached by a hash of its parameters.
- **Audio** [V]: `sfx.py` seeded numpy foley plus compressor and look-ahead limiter; `sampler.py` with automatic CC BY `credits()`; `pluck.py` Karplus–Strong presets (numba). Every demo re-implements its own `mix.py`; 41 files import librosa, which is only in the dev requirements.
- **What is really shared** [V counts, U reading]: `/core/lib.js` in 155 files, `core/three/post.js` in 7 demos, `core/post/crt.js` in none. Shared = capture, mastering, voice, QA and small helpers; visuals are per style.
- **Published speeds** [V as published, not reproduced]: Apple-silicon Macs, roughly 17–45 frames/s aggregate (e.g. 768 frames of three.js at 2× SSAA in 30–45 s on 3 workers).
- **Windows** [V text / U portability]: upstream says to use WSL; scripts hard-code `.venv/bin/python` and `sh`. The Node tools look portable but were not run on Windows.
- **Storage** [V]: no LFS. Big inputs are tarballs on an `assets` release listed with size + sha256 in `tools/assets.json`; films on a `films` release (68 assets, ~4.8 GB); 720p cuts on `web` (73 assets, ~0.7 GB) feed GitHub Pages. `release.py` caps committed files at 5 MB.

## Key facts — method
- **Router** [V]: `CLAUDE.md` is the single line `@AGENTS.md`; AGENTS.md opens with a request → document table, then a 6-step workflow and "where things go".
- **Style slot** [V]: `style.json` (the only metadata source, validated fields, controlled category list in code), `STYLE.md`, `DEMO.md`, `demo/` (source, one-command build, `CREDITS`), styleframe, poster, `.srt`; the mp4 is gitignored and lives on Releases. Folders starting with `_` are templates.
- **STYLE.md template** [V]: 11 fixed sections — essence *and what it is not*; materials and rendering; colour logic (rules, not a palette); type and subtitles; motion quality; camera grammar (Move / What it expresses / Can serve); sound palette; native moves (each with "fits content like" and 3+ examples); pitfalls of the medium; engine pointers; variation space (3 structures, 3 openings, 3 endings far from the demo). Story, BPM, durations and end cards are banned from it.
- **Drift** [V]: the template asks for 6–11 KB; real files have a median ~12.5 KB, max 30.6 KB, and one style uses 12 differently named sections. Unlinted prose conventions erode.
- **Anti-anchoring** [V]: write `TREATMENT.md` (three candidate structures, then the choice) *before* opening the demo; at delivery at least 4 of 6 dimensions (structure, opening, signature shot, camera path, score shape, ending) must differ from the demo.
- **DIRECTOR.md quality bars** [V]: judged in the order sound, rhythm, camera, directing. Hook within 3 s; ≥ 2 real silences; sound used as a transition ≥ 2 times; ≥ 4 different camera moves; subject ≥ 1/3 of frame height at key moments; subtitles held ≥ max(1.8 s, speech + 0.6 s); on-screen text held (letters ÷ 15 + 1.5) s EN or (characters ÷ 4.5 + 1.5) s ZH; title cards ≥ 4 s; −14 LUFS; no black or NaN frames; every line passes ASR; one fix round. Defaults: 30–60 s, 1080p24.
- **Provenance tiers** [V]: `CREDITS` (every third-party asset: source, licence, changes made); `FACTS.md` for any film stating facts (claim table with source URL and quoted wording, derived arithmetic shown, a "Not claimed" section, date checked against the final script); `SOURCES.jsonl` (one record per downloaded file incl. licence, attribution flag, seconds used → film time), written by a stdlib-only fetcher.
- **Licence allowlist** [V]: CC0, CC BY, OFL only; public domain counts as CC0; "no known restrictions" does not; anything else only after the user agrees.
- **Gen-AI precedent** [V]: one demo commits two AI-generated plates with their prompt script, an on-screen "illustration / AI-generated" tag and a CREDITS entry.
- **Generator** [V]: one script turns every `style.json` into README grids between `<!-- markers -->`, counts, indexes, the AGENTS.md list, `catalog.json`, `llms.txt`, sitemap and the Pages site; CI fails when a linked film is missing.
- **Hygiene gate** [V]: `release.py check --strict` blocks files > 5 MB, local home-directory paths (macOS, Linux and Windows user profiles), Anthropic / GitHub / AWS key prefixes, missing slot files, orphan images, unreachable demo files and process wording.
- **Distribution** [V]: root `.claude-plugin/marketplace.json` → `./plugin`; a thin skill runs a setup script that sparse-clones the library into the user's home and installs dependency tiers; an orphan `directory` branch carries a self-contained edition.
- **Derivation flow** (MY-STYLES.md) [V]: sections sorted into safe to change / changes the character / can't change; up to 5 changes per round; `CHANGES.md` plus `based_on`, `borrows`, `library_version` lineage fields.

## What we adopted / adapted
- The *idea* of a tiny framework-free page contract → `engines/web` `./page` runtime (`window.__aiv`: ready, fps, durationFrames, renderFrame(i), readback POST). We use integer frame indices and pixel readback from MAP instead of screenshots (see `map-of-middle-earth.md`).
- Fail-fast page errors and a software-GL warning → `engines/web` harness, which goes further and refuses software GL; hardware ANGLE (D3D11) is confirmed on the reference host (`engines/web/ENGINE.md`).
- Two-pass loudnorm to −14 LUFS plus post-measurement → `@aiv/pipeline` media/QA.
- Numeric quality bars, TREATMENT-first ordering, "one fix round" → `docs/PRODUCTION.md` and the video slot stage files (TREATMENT: 3 candidates, then the chosen one).
- STYLE.md section idea → `styles/_template/STYLE.md` (fixed sections ending in checkable invariants). Heading lint is not built yet; add it to `aiv check` when the second style exists.
- CREDITS / FACTS + `sources.jsonl` → video slot stage files.
- Marker-based generation with a CI freshness check → `aiv check --fix` (catalog.json, docs/INDEX.md, README table).
- Hygiene checks → `aiv check` caps and privacy scan (our cap is 2 MiB, not 5 MB).
- Releases + sha256 manifest, no LFS → storage tiers (see `github-storage-limits.md`).
- Plugin marketplace layout → reserved for later (see `claude-code-packaging.md`).

## What we deliberately did NOT adopt, and why
- JPEG screenshot capture and the mjpeg pipe: three lossy generations, and WebGPU canvases screenshot black on Windows.
- The full-range bt470bg colour default: YouTube expects BT.709; our post does one explicit BT.709 limited-range conversion.
- POSIX sh glue, `.venv/bin/python`, "use WSL": the repo is Windows-native first and cross-platform.
- Default 3 workers: too many for an 8 GB shared-memory iGPU host; we serialise heavy jobs.
- Vendoring `core/` wholesale: untested on Windows, and the web engine is built from MAP's harness.
- The Python voice/music tier: deferred until the first Python module lands.
- Per-demo `mix.py` duplication: shared code is promoted by the rule of two.
- LemoLab sign-offs, end cards and the grep for them; DIRECTOR §12 (fan-film carve-out) and §13 (China-view map policy); the Oscar-themed gallery; the home-folder style location.
- Copying web cuts into the Pages site (1 GB Pages cap); keeping TREATMENT and process notes private (ours are public knowledge).

## Gotchas
- Anything driven by a clock (CSS animations, `<video>`, rAF loops, `Date.now`, unseeded random, state carried between frames) renders differently per worker, because workers jump straight to their chunk.
- WebGL canvases need `preserveDrawingBuffer: true` for screenshot capture.
- `core/three/post.js` targets three 0.170 addons, assumes a perspective camera, and its 2× SSAA means 4K render targets.
- readcheck fails typewriter reveals by design (TEXTS must report the full string from the first visible frame).
- Paths containing `#` or `?` break ffmpeg protocol parsing; their capture uses cwd + relative names, `mux.sh` does not.
- kokoro-onnx needs Python < 3.14 and an espeak-ng data path under 160 bytes.
- The bundled ZCOOL KuaiLe subset has about 208 glyphs; subset a CJK font per video.

## Not read
Most of the 66 styles' code (read in full: blueprint, chalkboard, caption-news, lidar-survey; partly glass-product, dataviz, ascii-crt). `styleboard/build.py`, `template.html`, `pages.yml`, `release.py` and the plugin setup script were skimmed, not read line by line. The `directory` branch and its SECURITY.md. Nothing upstream was executed on Windows; published speeds were not reproduced. Changes after `bebbbe1`.
