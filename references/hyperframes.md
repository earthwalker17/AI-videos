# HyperFrames — candidate HTML engine

| | |
|---|---|
| Upstream | https://github.com/heygen-com/hyperframes · docs index https://hyperframes.heygen.com/llms.txt |
| Pin | Skills read at HEAD `070b964d7b8cd844a893f0abbe8e0b7f1ac6d879` (2026-11-08T14:01Z). npm `hyperframes` 0.9.23 (published 2026-11-08T07:15Z, from the earlier release commit `7ad2be96ea1cdf6c1c5d3da7f3be20584c3a9f25`). Engine facts are from the first reading: HEAD `ee50cd2fc0d0fe4a4eac22683ed23b6066289ab3` (0.8.225), detailed at `47fe68562f39d91b4d9280dff41ae43d67805fae` (0.8.224). |
| Licence | Apache-2.0 (root `LICENSE`; no `NOTICE` file at `070b964d`). Its default animation library, GSAP, is proprietary ("Standard No Charge" licence: https://gsap.com/community/standard-license/). |
| Accessed | 2026-11-01 (engine); 2026-11-08 (skills); pins, skill files and the telemetry opt-out re-checked 2026-11-09 |
| Stale after | 2026-11-22. 30 npm versions between 0.8.225 and 0.9.23 in eight days and 372 commits between the two reading pins; HEAD had moved again by 2026-11-08T16:16Z (`eb16510a`). |
| Status here | Optional; not an engine in this repo until two videos need it. Its skills are a source of craft rules (ideas only). |

## What it is
HeyGen's open-source HTML-to-video renderer, built for coding agents: a composition is an
HTML file whose timed elements carry data attributes, animated by paused GSAP timelines (or
other adapters) that are seeked frame by frame and captured from headless Chrome.

## Why it matters here
It is the strongest agent-oriented HTML engine, renders on Windows, and its `hf-seek` event
means our own page contract could run under it with a few lines of glue. It is also a
source of concrete lessons (LFS patterns, eol, Windows CI). Since 0.9 its skills carry the
most specific written craft bar we have found for generated explainers (what "generated"
looks like, and how to review against it), which is why round 2 of video #4 read them.

## Key facts
- Stats: Apache-2.0, ~76.5k stars, created 2026-03-10 [V]; ~80.9k stars on 2026-11-09 [V].
- Requires Node ≥ 22 and FFmpeg (0.9.23 `engines` still `node >=22`); optional `--docker` mode pins Chromium, fonts and the encoder for cross-machine pixel reproducibility [V].
- Composition model: elements with `data-composition-id`, `data-start`, `data-duration`, `data-track-index`; timed elements use `class="clip"`; nesting via `data-composition-src` [V].
- Time: `t = floor(frame)/fps`; every frame is seeked, never played. Documented rules: no `Date.now`/rAF/timers, no unseeded `Math.random`, no fetch mid-render, fixed size, finite length [V]. At `070b964d` the skill's contract adds no `repeat: -1` and one paused timeline per composition, registered in `window.__timelines` [V].
- Built-in runtime adapters: GSAP, CSS, WAAPI, Anime.js, Lottie, Three.js, TypeGPU, D3, map libraries, plus video-texture compatibility [V].
- GPU/canvas pages receive an `hf-seek` CustomEvent with detail `{time, waitUntil}` (defined in `packages/core/src/runtime/adapters/seek-dispatch.ts`, dispatched by the three and typegpu adapters) [V]. The file is still there at `070b964d` [V].
- Public `FrameAdapter` interface `{id, init?, getDurationFrames, seekFrame, destroy?}`, marked "experimental v0" [V].
- Capture mode: CDP `HeadlessExperimental.beginFrame` only for chrome-headless-shell on Linux; everywhere else `Page.captureScreenshot` ("screenshot" mode). So on Windows determinism rests entirely on seeking [V at `ee50cd2f`; not re-checked].
- `.github/workflows/windows-render.yml` runs on `windows-latest` and disables Defender real-time monitoring (a useful CI speed hint) [V].
- Telemetry is on by default; `HYPERFRAMES_NO_TELEMETRY=1` or `DO_NOT_TRACK=1` turns it off [V; both still read in `packages/cli/src/telemetry/policy.ts` at `070b964d`].
- Render provenance: output containers carry `hyperframes_renderer` / `hyperframes_version` tags [V].
- Outputs: MP4, MOV (ProRes 4444 with alpha), WebM (VP9 alpha), GIF, PNG sequence, HLS; Lambda and Cloud Run packages exist [V].
- Agent material: Claude Code plugin (`hyperframes@hyperframes` from the `heygen-com/hyperframes` marketplace), ~~7 skills~~ 8 skill folders at `ee50cd2f` (re-counted 2026-11-09), CLAUDE.md/AGENTS.md, llms.txt indexing 134 docs + 449 catalog pages; CLI commands for agent loops (`lint --json`, `check`, `inspect`, `snapshot`, `doctor`, `benchmark`, `compare`, `layout`, `contrast-*`) [V].
- Catalog: 210 blocks, each `registry/blocks/<name>/registry-item.json` with name, type, title, description, tags, licence, dimensions, duration, files with target paths, and an external preview URL; `themes/CONTRACT.md` defines 18 theme tokens (palette, type, shape/spacing, motion durations and easings) [V]. Still 210 at `070b964d` [V].
- `.gitattributes` comments: non-recursive LFS patterns let binaries into history "forever" (fixed with `**`); `eol=lf` is needed against Windows CRLF/BOM [V].
- Some features depend on HeyGen's cloud (avatars, TTS, publishing) [V].
- In a 2026-10-11 third-party test of 16 video skills making the same 15 s promo, all passed the same basic checks as a no-skill baseline; the HyperFrames skill was the slowest (23.5 min vs 4.4 min baseline) [S].
- GSAP's licence has a Prohibited Uses clause aimed at tools that let users build animations without code in competition with Webflow; otherwise free when end users are not charged [V].

**Skills at `070b964d`** [V, read 2026-11-08, re-read 2026-11-09]
- Two sets. `skills/` is the distributable plugin: `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `figma`, `slideshow`, `remotion-to-hyperframes`, `reverse-any-video`, and `style-sampling` (new since `ee50cd2f`). `.claude/skills/` holds six repo-only skills marked `internal: true` (`motion-doctrine`, `cut-the-curve`, `seam-craft`, `oversized-cursor`, `captions-overlay`, `changelog-video`), mirrored byte for byte in `.agents/skills/`.
- The craft material that matters here is in `skills/hyperframes/references/`:

| File | What it says (restated) |
|---|---|
| `types/explainer.md` | One idea, carried by one concrete worked example from start to answer. Ground it in a situation the viewer knows before the abstract device appears. Explaining devices: an object whose working *is* the idea, drawn with its material and mount so it reads as what it is; one diagram that grows a part per beat, each part appearing when named; continuous transformation instead of cuts. "Shapes of information" (a number that lands, a myth overturned, before/after, many converging into few, a network that densifies, one chosen out of many, steps in order, …): pick the shape first so similar lines get different pictures. Unnarrated lines up to about 10 words, held 0.5 s + 0.3 s a word; labels sit on the part they name. Tells: bullet slides, icons in circles, three cards in a row, the whole diagram at once. |
| `spec.md` | Write a `SPEC.md` brief before any scene, with a number wherever an adjective would go (GOAL, OUTPUT, TIME, LOOK, OBJECTS, MOTION, SHOTS, BANNED, QA). Composition: the hero fills at least 40% of the frame's height or width; one hero move per shot, secondary moves at 50–70% of its travel starting 100–200 ms later; something new every 2–4 s; readable text at least 28 px at 1080 (2.6% of the short side). "BANNED by default": a black or dark-navy void with small elements floating in it; glow, bloom, neon, flares, glowing orbs and rings, decorative particles; purple/blue and mesh gradients, glass cards; the cream-paper-plus-serif look with numbered labels, mono caps labels and pill chips; everything centred or fading and sliding up; text that moves while read; decorative HUD, corner labels and brackets; three cards in a row, KPI grids; a corner logo. Each item is allowed only where the brand or a given reference uses it. After the first render, every default the film used is added to its own BANNED line. "A look built from a medium": a look is the rules of one medium (its parts, what each part may carry, and how the medium itself moves), not a palette. |
| `review.md` | Run after `check` passes. `check --json` warns on measurable craft: `line_unread`, `dead_stretch` (over 3 s with nothing changing), `text_below_floor`, `first_frame_empty`, `film_silent`; a deliberate hold carries `data-hold`. `snapshot --review` writes three sheets: scene start and middle plus each beat, a strip across every cut, and the beats at 360 px phone width. First describe each beat frame in one sentence as a stranger would; an object that needs explaining is a P0. Then: does it read as what it is, does the subject separate, contact and framing, first-viewer timing, tells, the pictures alone with words covered, the phone sheet. Notes as `t · where · problem → exact change · what stays`, ranked P0/P1/P2; never a score out of 10. A fresh sub-agent gets only the storyboard and the sheets. |
| `look.md` | Outside input breaks the default look, in order: the project's design spec, a real brand, a reference the person gave, the subject's own world. Inter, Space Grotesk, Instrument Serif, Geist and JetBrains Mono are named as where generated design lands. Video facts: full-screen linear gradients on dark grounds band under H.264; an accent at 5% opacity vanishes in compression (15–25% for atmosphere). |
| `motion.md` | Defaults measured from the official launch films. Ease by role (arrivals on a long tail, camera both ways, exits accelerating); springs named by damping ratio (1.0 none, 0.7–0.85 premium, 0.4–0.6 playful; position and size may bounce, opacity and colour never); exits 40–50% shorter than entrances; the next element starts when the previous is 30–50% done; word staggers 60–120 ms; beats computed from their index, never by adding a rounded beat; a landed title is dead still; read holds 0.5 s + 0.3 s a word, the last line at least 2 s; 0.3–0.75 s of stillness before a payoff. "Defaults that look generated": breathing, floating or pulsing loops; titles that keep moving after landing; a slow creeping scale; bounce on UI; one entrance for everything. Opt-in render-time motion blur (`data-motion-blur`) is a per-element filter. |

- `motion-doctrine` (internal) adds, for multi-scene films with cuts: a "vector law" (exit and entry match axis, direction and speed, cut mid-motion); one dominant direction for the film, other directions reserved for meaning; carriers handed across seams; causal motion where the effect starts on the causing frame; no idle wobble (pause anywhere and something meaningful is mid-flight); stillness before the climax; a seam-gate script that checks a `ledger.json` of seams.
- Paid tier and telemetry: `style-sampling` (style templates) and `reverse-any-video` are "HyperFrames Pro" features checked by the server; reverse re-shoots people with HeyGen. Both open by running `npx hyperframes events --skill=<name>`, a usage beacon that sends the skill name with the CLI telemetry (account-linked when signed in; it honours the opt-out).
- GSAP stays the house runtime: the contract's rules are written for GSAP timelines, and `cut-the-curve` keeps its code templates in `examples/gsap-implementation.md`.

## What we adopted / adapted
- Nothing installed. Ideas only: seek-driven determinism rules (already ours), container provenance tags (→ `render.json` / post metadata), the registry-item fields (licence per item, external preview) as input for a future catalog format, `eol=lf` from day one (already in `.gitattributes`).
- Proposed, not planned: an optional `hf-seek` listener in the `engines/web` page runtime that calls our frame renderer, so a page could also be captured by HyperFrames.
- From the skills (2026-11-08, for lookdev round 2 of video #4), restated in our own words (in progress for round 2):
  - the "tells" and the stranger-sentence P0 test as input for the frame-critic's craft criterion (sources collected in `agent-video-skills-2026-11.md`);
  - a per-film BANNED line, grown after each render, with the default list treated as "defaults to justify" rather than absolute bans: the user's dark-ground preference overrides the dark-void item, and #4 keeps bloom only on live emitters (`motion-graphics-2d-2026-11.md`, delta);
  - a look written as the rules of one medium; shapes of information chosen per line before drawing; one worked example through every mechanism;
  - motion rules: ease by role, springs by damping ratio, overlap, a dead-still landed title, stillness before the payoff, effects on the causing frame, no idle wobble;
  - QA ideas for `aiv qa`: a dead-stretch check, a phone-width sheet, assertions of motion intent. Our text floor (1/30 of frame height, 36 px at 1080p) is already stricter than its 28 px.
- Text adapted rather than restated would need an Apache-2.0 Adapted-from header and a `NOTICE.md`/`REUSE.toml` entry (`licensing-tooling.md`); upstream has no NOTICE file to carry.

## What we deliberately did NOT adopt, and why
- HyperFrames as a first-class engine: pre-1.0 churn, experimental adapter API, and the two engines here (web, Remotion) already cover current needs.
- GSAP inside reusable library components: proprietary, with a Prohibited Uses clause. Prefer WAAPI, CSS or Anime.js (MIT) for shared code. *Under Remotion nothing seeks those either [U] (`motion-graphics-2d-2026-11.md`, lint blind spots): shared Remotion code stays on `interpolate`/`spring`.*
- GSAP code from the skills' examples (`cut-the-curve` and its `examples/gsap-implementation.md`): prose ideas only, never the code.
- `style-sampling` and `reverse-any-video`: paid Pro features with a usage beacon; and rebuilding someone else's video conflicts with the do-not-copy stance in `vibe-knowledge-style-2026-11.md`.
- The seam law, vector ledger and seam gate as written: built for multi-scene films with cuts; video #4 is one world with a moving camera [U]. Its causal-motion and no-wobble rules are taken.
- Its upstream skills/plugin vendored into the repo: install-only if ever used.
- Its "vs Remotion" marketing page as evidence: decide on our own fixture renders.

## Gotchas
- Float version ranges will break old videos: pin exactly and keep golden fixtures if adopted.
- Set the telemetry opt-out in repo scripts and `.env.example` before the first run. Skills that start with a usage beacon send telemetry even when the CLI is not rendering.
- Anything animating on the compositor clock (CSS transitions without an adapter, `<video>` playback) drifts in screenshot mode.
- The skills disagree on exit length: `motion.md` makes exits 40–50% shorter than entrances, `motion-doctrine` about 75% of the entry. Pick one per film.
- Several BANNED items describe looks a brief may legitimately want (a dark ground, a single glow); the list is a prompt to justify each with a number, not a verdict on its own.
- npm releases lag HEAD: 0.9.23 was cut before the reading pin, so a skill read at HEAD may not be in the installed CLI. Install the plugin at an exact version if ever used.

## Not read
Engine internals beyond capture-mode selection and the Windows streaming-encode workarounds in `packages/engine/src/config.ts`; the Lottie/D3/TypeGPU adapters; Lambda and Cloud Run packages. Never rendered on the reference host. Of the skills: `story.md`, `film.md`, `sound.md`, `storyboard*.md`, the other `types/` files, `media-use` (including its HeyGen and telemetry-dashboard references), `cut-the-curve` beyond its GSAP pointer, the seam-gate scripts. After the pin: `eb16510a` "seed random values in every render so re-renders give the same film" (2026-11-08), which suggests the producer had unseeded randomness before; whether capture mode or the Windows path changed between 0.8.225 and 0.9.23.
