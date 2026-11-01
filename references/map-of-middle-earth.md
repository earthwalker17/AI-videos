# map-of-middle-earth — our earlier film repo

| | |
|---|---|
| Upstream | https://github.com/earthwalker17/map-of-middle-earth (film: "Journey Through Middle-Earth", https://youtu.be/kRuPq4GjhGc) |
| Pin | `696e968e9d550327beda9e663ef5aec6961583c9`. Paths below are relative to that commit, e.g. https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/gpuLock.ts |
| Licence | MIT (code). Renders derived from data of uncertain licence were published as "not MIT, no reuse licence granted". |
| Accessed | 2026-11-01 (tooling harvest for this repo) |
| Stale after | Does not go stale at the pin (the film is finished). Re-check only if work resumes upstream. |
| Our use | Adapted files start with an SPDX licence header (MIT) and `// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/<path>`; `NOTICE.md` lists them. |

Tagging: facts about `tools/` and `src/` are [V] (those trees were confirmed identical to the
public commit). Numbers recorded in the project's own docs (state, architecture, credits,
release notes) are [S]: those files were read but their identity with the public commit
was not separately checked.

## What it is
A three.js WebGPU film made with deterministic Playwright capture, bit-identical re-renders,
a sampled orchestral score and a sha256 release manifest, built over about 8 days
(342 commits) on a Windows laptop with an Intel Gen11 iGPU and ~8 GB RAM [S]. Roughly 70 %
of `tools/capture` does not depend on the engine.

## Why it matters here
It is the source of most of `@aiv/pipeline` and `engines/web`: host safety, the readback
capture contract, chunked resumable rendering, encode presets with correct colour, golden
hashes and release provenance. It also records what went wrong, with commits.

## Key facts
**Page capture contract** [V]
- Boot `/?capture=1&quality=preview|review|final[&film=1]`: pixel ratio 1, fixed size, no animation loop. `window.__mm` (`src/render/capture.ts`) exposes `ready`, `info()` (GPU, three version, timings, heap), `render(request)`, `benchmark()`, timeline helpers.
- `ready` resolves after world load, `compileAsync` and one throwaway warm-up render + readback, so the first captured frame equals any later render of the same state.
- `render()` returns `{name, width, height, spp, renderMs, sha256, meanLuma}`; the sha256 is computed in-page over raw RGBA8 bytes.
- Frames go out as `fetch` POST `/__capture/frame?name&w&h` with a **Blob** body (keeps frames out of DevTools request retention). The sink answers only after Node has written the frame, which gives end-to-end backpressure.
- No screenshots: headless WebGPU screenshots are black on Windows. Readback rows are padded to 256 bytes and must be unpacked. The readback target must be NoColorSpace when the post pass already encodes sRGB (else double encoding).
- Time: frame k ↔ t = k/fps. Sub-samples use Halton(2,3) pixel jitter, Halton(5,7) aperture, and shutter times permuted by a stride coprime to n (decorrelates blur from jitter). Averaging happens in HDR before tone mapping.

**Determinism** [V]: every frame is a pure `SceneState` from `Timeline.evaluate(t)`; randomness is stateless `rand(seed,id,k)` / `hash32` / `halton` (`src/core/rng.ts`); banned: `Math.random`, `Date.now`, `performance.now`, TSL `time`/`deltaTime` (they read `performance.now`), hidden accumulated state. Film grain is keyed on the frame index. Verified 12/12 identical across fresh processes and 26/26 across reordered batches [S].

**Host safety** [V]
- Lock (`tools/capture/gpuLock.ts`): O_EXCL file with `{pid, owner, cwd, since}`, 15 s mtime heartbeat, reclaimed after 2 min stale or a dead pid, 60 min acquire timeout; abort handlers run newest-first on SIGINT/SIGTERM/SIGBREAK/SIGHUP.
- Memory guard (`tools/capture/host.ts`): ≥ 1800 MB available and ≥ 1500 MB commit headroom, bounded 3-min wait, error lists top consumers; mid-batch abort below 500 MB → exit 3. Per-job overrides (bake 2500, music/Blender 1500).
- Order matters: wait for memory *without* the lock; sweep orphaned Chrome (matched by `--user-data-dir`, plus Singleton* lock files) *only while holding* it, so another agent's live capture is never killed.
- `tools/heavy.ts <label> [--min-free-mb N] -- <cmd>`: guard → lock → child → release; kills the whole tree with `taskkill /T /F` on abort. Keep-awake via a hidden child holding `SetThreadExecutionState` until its stdin closes.
- Chrome: persistent profile (keeps the shader cache warm), pinned executable via env, anti-throttling flags, CDP garbage collection between shots and every 24 frames. Chrome honours only the **last** `--disable-features`, so the list must be a superset of Playwright's.

**Chunked film renderer** (`tools/capture/film.ts`) [V]
- `run.json` freezes settings; chunks are encoded into `partial/`, frame-counted with ffprobe, then renamed into `chunks/`; `cNNNN.json` keeps `{k, t, sha256, ms, luma, spp, motion}` per frame.
- Resume **refuses** (exit 2) on another film hash, a git diff touching render inputs since `run.commit`, a dirty tree, or another Chrome version. This fixes the THE AI STACK bug where chunks were reused without a code hash.
- Budget per call: estimate = recent ms per sub-sample × 1.25 + 4 s; exit 75 when the budget would be exceeded ("call again"). ≥ 2 GB free disk per chunk.
- Tiers: preview 960×540 x264 CRF 20 veryfast (240-frame chunks); review 1280×720 x264 CRF 14 medium (96); final 1920×1080 ProRes 422 HQ (48).
- Exit codes: 0 ok · 1 error · 2 refused · 3 low memory · 64 usage · 75 budget ran out. (MAP's lock CLI used 3 for "settings differ": we standardise.)

**Encode presets and colour** (`tools/capture/ffmpeg.ts`) [V]
- Input raw RGBA on stdin with drain backpressure and a frame-size assertion; ffmpeg must exit 0.
- RGB→YUV: `scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=…,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv` plus the matching output flags. Without the explicit matrix ffmpeg uses BT.601. sRGB-graded bytes are treated as BT.709 with no transfer conversion (screen-capture convention).
- x264 chunk: high, CRF 14 medium, one keyframe per chunk, bf 2. ProRes: `prores_ks` profile 3, yuv422p10le. FFV1: level 3, intra, 16 slices with CRC, bgr0 tagged rgb / iec61966-2-1.
- Delivery: libx264 slow CRF 16 high, GOP 2 s, bf 2, AAC 320k 48 kHz, `+faststart`, exact `-t`, written as `.part.mp4` and renamed after an ffprobe frame count. Master: copied video + 24-bit PCM in .mov.
- Count packets, not frames, for intra-only ProRes (seconds instead of minutes).

**QA, lock, review** [V]: bounded batched stills (fresh Chrome per batch), contact / compare / blind sheets (answer key written outside the sheet folder), a golden-hash lock recording Chrome, GPU and display-driver versions, a perf gate that waits for a quiet host, a manifest-driven review folder, and a reproducible encoder for README images. Hash raw decoded pixels, not PNG files.

**Music engine** (`tools/music`, uv Python) [V]
- Sample-based, not synthesized: the score is Python, rendered as one MIDI file per stem, played through CC0 VSCO 2 CE samples by `sfizz_render`, then mixed and mastered in numpy/scipy.
- Deterministic humanisation from a hash (±12 ms, ±5 velocity); unlooped sustains re-bowed (strings every 5 s, brass/winds 3.8 s, 0.35 s overlap); per-instrument calibration to −20 LUFS cached by SFZ hash; one synthetic stereo hall IR; glue compressor, own look-ahead limiter; `report.json` + spectrogram.
- A cue sheet exported from the picture timeline (sections, intensity envelopes, hits, film hash) keeps score and picture in sync.
- Score master −16.02 LUFS / −1.79 dBTP, 48 kHz 24-bit, exactly 227.750 s [S]. Pedalboard (GPL-3.0) was replaced by own DSP to keep the dependency set permissive.

**Blender asset runner** (`tools/blender`) [V]: `blender -b --factory-startup -noaudio --python-exit-code 1 --python <script> -- --out <glb>`, spawned without a shell, timeout kills the tree; last stdout line `MOME_STATS {…}`; manifest records output sha256 and a script hash (script + NUL + helper lib); `--verify` builds twice and requires identical bytes. Blender generated assets only, never rendered frames (too slow on the iGPU).

**Provenance manifests** [V]: six JSON manifests (fetched data, textures, fonts, music inputs, models, README images), each item with file, url, bytes, sha256, licence, source and why; a zero-dependency Node fetcher restores and verifies (size then streaming sha256, polite per-host pacing, retries honouring Retry-After). Release notes list sizes, sha256, bitrates, frame counts, commit, film hash, settings, Chrome/driver, dates, verification claims and credits [S].

**Lookdev and typography numbers** [S] (from the project's lookdev notes; facts restated)
- Grade order in linear HDR: bloom → halation → glow key → tint/lift → saturation → hue pulls → contrast → split-tone/toe → vignette → night compress → AgX → dither → grain (final tier only). Keep graphic colours (route lines, UI) *out* of a non-linear grade: composite after it or mask them.
- Rules of thumb: a near-monochrome grade needs 2–5 % warm/cool accents; Pro-Mist emulation = bloom threshold 0.6–0.8 linear, wide radius, strength 0.15–0.3.
- Title system sized in fractions of frame height H: title cap height 0.055 H (max width 0.62 W, tracking 0.09 em); subtitle 0.04 H; place name 0.045 H (0.12 em); credit line 0.02 H (leading 1.75). Legibility from a three-layer baked shadow plus a soft scrim (alpha 0.24), never boxes. Labels 2× supersampled (sub-pixel motion otherwise pulses).
- Reveal timings: place labels 1.4 s in / 1.0 s out; pass labels 0.8 / 0.6 s, capped at 40 / 30 % of the caption window. Camera: holds 4–8 s, pacing in whole bars (72 BPM = 3.33 s), view rotation < 30°/s.
- Fonts: OFL only; a modified or subset font with a Reserved Font Name must be renamed; wait for every FontFace and prove the canvas uses it (fallback glyphs break determinism).

**Measured on the reference host class** [S]
- Final film: 5466 frames (227.75 s @ 24 fps, 1080p), 11.1 h wall in one attempt, 0.545 s per sub-sample, avg 12.5 spp, 32 Chrome restarts (25-min cap).
- Review cut 1280×720 spp 4: 57 chunks in 18 calls of ≤ 9 min (~2.4 h); 17 isolated stills matched the cut bit for bit.
- Synthetic 1080p encodes: ffv1 ~20 fps, prores_ks HQ ~6.5 fps, libx264 slow CRF 16 ~3.4 fps, h264_qsv ~62 fps; final re-encode of 227.75 s took 32–33 min.
- Deliverables: mp4 1080p24 BT.709, 492.7 MB (17.3 Mb/s); ProRes 422 HQ master 5.28 GB. A 1080p RGBA8 readback is 8.3 MB.

## What we adopted / adapted (homes per the foundation plan)
- Lock, memory guard, `heavy`, orphan sweep → `@aiv/pipeline` host safety with win32/linux/darwin backends; `aiv heavy`. `aiv.local.json` may point our lock at MAP's so the two repos never render at once.
- Browser, session, sink, encoder → `engines/web` (`@aiv/engine-web`); page side → `./page` runtime `window.__aiv` with integer frame indices.
- BT.709 conversion arguments and presets → `@aiv/pipeline` media (youtube-1080p / archive / preview-hw); the single RGB→YUV conversion happens in post.
- `run.json`, per-frame sha256, input-hash resume refusal, exit 75 → `@aiv/pipeline` chunk runner.
- Stateless rng → `@aiv/core`; determinism rules → ESLint config and CLAUDE.md.
- Contact sheets from the final mp4, frame-count checks, release manifest + verify → `@aiv/pipeline` QA/release.
- Exit-code protocol 0/1/2/3/64/75, standardised across every CLI.
- Doc set (constitution / rolling state / contracts / historical research with a verification legend) → CLAUDE.md, ROADMAP, ARCHITECTURE, `references/`.
- Agent protocol: ≤ 2 implementers, read-only reviewer and visual critic, main agent views every render.
- Later (not M1): fetch manifests, music engine (first Python module), Blender runner, lookdev/typography as knowledge cards.

## What we deliberately did NOT adopt, and why
- three WebGPU offline accumulation (jitter, aperture DOF, adaptive spp ladder): three-specific; promote only when a video needs it.
- A live Vite dev server as the capture server: it forces a "no commits during a render" rule; a static or plain `node:http` sink is simpler.
- Film-specific QA (shot sets, review composer, perf gate) and GLB conventions (1 BU = 1 km, `fam:` materials).
- Sweeping background apps by default: opt-in only, configured locally.
- Windows-only implementations (CIM queries, PowerShell wrappers) as the only backend.
- The −16 LUFS master target as a series default: YouTube normalises to about −14 LUFS.

## Gotchas
- A list of 143 copyrighted reference-image URLs was committed and later untracked; it stays in history. Never commit reference-image manifests; cite article pages, not image files (218 image links had to be stripped from briefs).
- Fetch URLs pointed at mutable branches, so sha256 pins broke; use commit-pinned URLs. The music fetcher recorded hashes after download without checking a pin.
- Git cannot re-include a file under an ignored directory: ignore `dir/*`, then whitelist the manifest.
- Chrome auto-updated minutes after the 11 h render; pin a private Chrome copy and record its version per run and chunk. Display-driver updates are part of the determinism environment.
- Claude Code reaps background shells under memory pressure: run captures in ≤ 10-min foreground calls; multi-hour renders in their own window, polled briefly.
- Windows does not kill children with their parent; spawn without a shell where possible and kill trees explicitly.
- PowerShell: pass `SetThreadExecutionState` flags as decimal; `Start-Process -ArgumentList` joins unquoted (colon-bind args); quote comma lists.
- Variable-font file names containing `[wght]` failed to write on Windows.
- Vite: pre-bundle dynamically imported deps, or the first capture gets "504 Outdated Optimize Dep".
- Laptop power regimes differ ~1.7×; compare performance only in interleaved A/B runs on a quiet host.
- The score read the picture timeline directly, bypassing the cue sheet; `report.json` lacked the score-code commit. Put everything music needs in the cue sheet and record the commit.

## Not read
`src/` world, terrain and tour code beyond the capture, timeline and rng contracts; most research briefs except the music and lookdev ones; CI workflow details; whether the release notes file and docs exist identically at the public commit; whether a `v1.0.0` tag points at `696e968` (the foundation plan's NOTICE names v1.0.0; not checked).
