# 2D explainer motion graphics in code — building blocks, fonts, determinism (2026-11)

| | |
|---|---|
| Upstream | Per row below. Key sources: https://github.com/remotion-dev/remotion (npm `@remotion/*`) · https://github.com/shikijs/shiki · https://github.com/juliangarnier/anime · https://github.com/motiondivision/motion · https://github.com/motion-canvas/motion-canvas · https://docs.manim.community · https://fontsource.org · https://github.com/google/budoux |
| Pin | Remotion 4.0.539 (repo pin; latest 4.0.541). Source read at shikijs/shiki `de15fd2efb709ea4528d894ab857ac145f3dc277`, anime master `01b81be1df6843ccfe0a71c0699a746bf740dd77`, motion main `78f3ff51b5508f7e8c1c283d8e80bcd26fec37d7`, motion-canvas `7b91435c301d530351dcf5ebb91dd139c002e405`, remotion-dev/skills `a2824c67f8b4585c294a8101db9f9f0ad3c643f8`; repo facts at `abf1904`. Other versions per row (npm, 2026-11-08). Delta (round 2): three 0.186.1, R3F 9.8.2, postprocessing 6.39.5 as pinned; npm latest per row as of 2026-11-08, spot re-checked 2026-11-09; LYGIA at `aa7580bec667100068038fbeb36fa37d961035ee`. |
| Licence | Per row: MIT, ISC, Apache-2.0, OFL-1.1, BSD-3, EPL-2.0 OR GPL-3.0-or-later (elkjs), proprietary (GSAP), Remotion License. Delta: Zlib (postprocessing), CC0 (blue-noise tiles), Prosperity 3.0.0 non-commercial (LYGIA), CC BY-NC-SA 3.0 by default (Shadertoy code) |
| Accessed | 2026-11-08; delta researched 2026-11-08, versions, licences and repo facts spot re-checked 2026-11-09 |
| Stale after | Remotion rows: the next Remotion upgrade or 2026-12-01. Library and font verdicts: 2027-05-01. Delta substrate verdicts: 2026-12-01 (the round-2 probe ran, and #4 V1 built and rendered the WebGL world: see the delta). |
| Excerpt policy | Paraphrase only. Remotion docs and skills, and the Code Hike examples (no licence), are ideas only, never copied. |

## What it is
The libraries, fonts and patterns for deterministic, code-generated 2D explainer graphics
(DOM + inline SVG under `engines/remotion`), checked for video #4 V1 (`super-agent`, archived
2026-11-15). It is a delta: engine verdicts live in `code-video-engines-survey.md`, Remotion
itself (licence, `--gl`, colour, browser, v5) in `remotion.md`. Neither is repeated here. The
dated delta at the end records round 2, which moved V1's world into WebGL and kept only text in
the DOM.

## Why it matters here
The first 2D explainer needs a motion vocabulary (draw-on lines, tokens on routes, text
reveals, a camera) and bilingual EN + zh-Hans type, with every frame a pure function of its
index. Most popular animation libraries run on a clock, and the repo's lint does not see
the DOM hazards they use. This note records what to take, what to write ourselves and why.

## Key facts

**Remotion first-party packages at 4.0.539** (npm documents at 4.0.539, unpkg files) [V]
- 4.0.540 (2026-11-02) and 4.0.541 (2026-11-05) are out; the repo stays on 4.0.539, and any added package joins the catalog at exactly that version.
- remotion.dev already documents 4.0.542 behaviour (not on npm): check a docs claim against the 4.0.539 `.d.ts` or dist before relying on it.

| Package | Licence (npm field · LICENSE file) | What it gives, frame-pure? | Verdict |
|---|---|---|---|
| `@remotion/paths` | MIT · MIT file | Pure path maths: `evolvePath`, `getLength`, `getPointAtLength`, `getTangentAtLength`, `interpolatePath`, `warpPath`, `cutPath`, plus parse/normalise/scale/translate/reverse/bounding-box helpers | **Adopt**: draw-on, tokens along edges, morphs |
| `@remotion/layout-utils` | MIT · no file | `measureText`, `fitText`, `fitTextOnNLines`, `fillTextBox`; DOM measurement, pure only after the fonts are ready (Gotchas) | **Adopt** |
| `@remotion/shapes` | MIT · MIT file | Path strings: `makeRect`, `makeArrow`, `makeCallout`, `makeCircle`, `makeStar`, … | Optional |
| `@remotion/transitions` | UNLICENSED · — | See the next group | Optional, DOM presentations only |
| `@remotion/motion-blur` | MIT · no file | `Trail` and `CameraMotionBlur` render the children N times at time offsets; the docs warn the camera blur damages colours | Skip |
| `@remotion/noise` | MIT | Seeded `noise2D(seed, x, y)` | Skip: `@aiv/core` has `rand` and `valueNoise` |
| `@remotion/animation-utils` | no field · MIT file | `interpolateStyles`, `makeTransform` | Pattern only |
| `@remotion/fonts` / `@remotion/google-fonts` | MIT / SEE LICENSE IN LICENSE.md | Local loader without a coverage check / Google CDN fetch at render time | Skip: the kit's `useFont` is stronger; no network mid-render |
| `@remotion/captions` | MIT · no file | `parseSrt`, `serializeSrt`, a `Caption` type; Latin-token oriented | Pattern only |
| `@remotion/rough-notation` (created 2026-07-16) | MIT | Seeded, but sizes itself with `ResizeObserver` + `useEffect` (source); may lag a frame at chunk starts [U] | Skip |
| `@remotion/effects` / `light-leaks` / `starburst` | UNLICENSED / "Remotion License" | Canvas effects | Skip |
| `@remotion/lottie` / `@remotion/rive` / `@remotion/gsap` | SEE LICENSE IN LICENSE.md / See LICENSE.md / MIT | Wrappers for the libraries below | Skip |

**Transitions and HTML-in-canvas** [V unless marked]
- `@remotion/transitions` 4.0.539 has 20 presentations, not 21, and no `cube` (unpkg 404). 8 are DOM-based: fade, slide, wipe, flip, clock-wipe, iris, none, push-cut. The other 12 (swap, ripple, dissolve, book-flip, crosswarp, film-burn, zoom-blur, blur-slide, cross-zoom, dreamy-zoom, linear-blur, zoom-in-out) use HTML-in-canvas. `remotion.md` now carries this correction in place.
- Remotion always passes the `CanvasDrawElement` feature (`packages/renderer/src/open-browser.ts` at v4.0.539). Its docs place the API in stock Chrome 149+ behind that flag, so the Windows shell (stock Chrome for Testing 157) most likely has it. Issue #12638 (open, created 2026-10-27) still lists a custom Windows build as to do; that build is mainly about bug fixes and codecs. Whether it works on the reference host is [U]: probe `HtmlInCanvas.isSupported()` (present in 4.0.539) in a fixture first. `<HtmlInCanvasMotionBlur>` (4.0.529) is experimental.

**Code animation** (for code or terminal shots; #4 V1 had none storyboarded) [V]
- **Shiki 4.6.0** (MIT, 2026-11-02, Node ≥ 20): Oniguruma WASM engine by default, or a JavaScript RegExp engine (`shiki/engine/javascript`) that is strict and throws on grammars it cannot convert (a `forgiving` option exists). Frame-pure recipe: one highlighter with only the languages and themes used, created behind a `delayRender` hold, or tokens precomputed to JSON; render tokens as spans.
- **`@shikijs/magic-move` 4.6.0** (MIT; `shiki-magic-move` is archived and deprecated on npm): its renderer animates with CSS transitions (FLIP through `getBoundingClientRect`, `transitionDuration`, `getAnimations()`), so it is not frame-pure. Its `/core` (`codeToKeyedTokens`, `createMagicMoveMachine`) is pure data: measure both layouts once fonts are ready and interpolate position, opacity and colour from the frame.
- **Code Hike 1.1.0** (MIT, 2026-03-17): `codehike/utils/token-transitions` (`getStartingSnapshot`, `calculateTransitions`) yields keyframes; its Remotion example interpolates them from `useCurrentFrame()` in a `useLayoutEffect` behind `delayRender`. The examples repo has no licence (pattern only) and the library is MDX-centric. Snapshot purity at chunk starts is [U].

**Timeline libraries** [V]
- **anime.js 4.5.0** (MIT, 2026-06-22): `Timer.seek()` pauses, ticks synchronously, then resumes unless the instance was already paused, so create it paused (`autoplay: false`). It mutates the DOM outside React, additive composition depends on prior state, `random()` is unseeded unless `createSeededRandom` or `stagger({seed})` is used, and `splitText` uses `Intl.Segmenter`, a `ResizeObserver` and a `setTimeout`. Pattern only.
- **GSAP 3.15.1** (2026-11-04): Standard "no charge" licence (effective 2025-04-30, modified 2025-05-30), issued by Webflow, all plugins (SplitText, MorphSVG) included; not OSI. Prohibited Uses target no-code animation builders competing with Webflow; the FAQ says AI-generated code is not a prohibited use; proprietary notices must not be removed. Skip, as `hyperframes.md` already rules for shared code.
- **Motion 14.10.1** (`motion` and `framer-motion`, MIT, 2026-11-06): `animate()` returns playback controls with a settable `time` and `pause()`/`play()` (motion.dev/docs/animate), so it *is* seekable. Skipped anyway: the declarative `<motion.*>` components run on a rAF frameloop (`sync-time.ts` reads the frame timestamp or `performance.now()`), the imperative path uses WAAPI where supported and mutates the DOM outside React, and it adds nothing over `interpolate`/`spring`. `MotionGlobalConfig.useManualTiming` is an undocumented flag.

**Vector, layout and text libraries** (licence, version and date from npm; behaviour [V] where a source file is named, else [U])

| Library | Licence, latest (date) | Determinism | Verdict |
|---|---|---|---|
| d3-shape | ISC, 3.2.1 (2026-11-03; previous 3.2.0 in 2022) | Pure generators (`linkHorizontal`/`linkVertical`, curves) | Optional for curved edges |
| d3-interpolate | ISC, 3.0.2 (2026-11-03) | Pure | Optional colour blends |
| d3-force | ISC, 3.0.1 (2026-11-03) | Default random source is a fixed-seed LCG (`src/lcg.js`), but `forceSimulation()` starts a d3-timer at once (`src/simulation.js`) | Pattern only: `.stop()` + `.tick(n)`, or bake positions to JSON |
| @dagrejs/dagre | MIT, 3.1.3 (2026-10-24) | Synchronous; `Math.random` only in `src/bench.ts` (graphlib not checked) | Optional for a DAG of more than ~10 nodes |
| elkjs | EPL-2.0 OR GPL-3.0-or-later; `latest` 0.12.1 (2026-10-28; 0.13.0 published minutes earlier, not tagged `latest`) | Async layout | Skip |
| flubber | MIT, 0.4.2 (2018-03-01), dormant | Pure | Optional for morphs between unrelated shapes; `interpolatePath` covers matching ones |
| rough.js | MIT, 4.6.6 (2023-11-20) | `Random.next()` falls back to `Math.random()` when the seed is 0, the default (`src/math.ts`) | Skip: not the look |
| perfect-freehand | MIT, 1.2.3 (2026-02-01) | Pure points-with-pressure → outline polygon [U] | Candidate for tapered sketch lines; not in the approved dependencies |
| KaTeX | MIT, 0.19.1 (2026-10-23) | Static render | Keep for maths videos |
| lottie-web | MIT, 5.13.0 (2025-05-21) | `goToAndStop` seeks | Skip: content authored in After Effects |
| Rive (`@rive-app/canvas-advanced`) | MIT runtime, 2.49.4 (2026-11-05) | State machines advance by deltas, so seeking means replaying [U] | Skip: proprietary editor |
| BudouX | Apache-2.0, 0.10.3 (2026-11-06) | Pure phrase segmentation; zh-Hans via `loadDefaultSimplifiedChineseParser().parse()` | Optional authoring aid, not at render time |

**Patterns worth borrowing** (ideas only, no code)
- Motion Canvas [V]: flow combinators `all`, `any`, `chain`, `delay`, `sequence`, `loop` (rebuild as pure frame → progress functions); signals, i.e. derived values (in Remotion, memoised pure functions of the frame); the `Code` node's patience-diff morphs, insert/replace/remove at ranges and `selection` that dims the rest (`packages/docs/docs/components/code/index.mdx`). `motioncanvas.io` now serves an unrelated site; the project is at `motion-canvas.io`.
- Manim CE 0.22.1 animation verbs [V docs index] mapped to kit names:

| Manim | Kit equivalent |
|---|---|
| `Create` / `Write`, `DrawBorderThenFill` | `drawOn` / stroke-then-fill title |
| `FadeIn(shift=…)` | `rise` |
| `Transform`, `ReplacementTransform`, `TransformMatchingShapes` | `morph` (frame-driven FLIP) |
| `LaggedStart(lag_ratio)` / `Succession` / `AnimationGroup` | `lagged` / `seq` / `all` |
| `Indicate`, `Circumscribe`, `ShowPassingFlash` | emphasis ring; a light running along an edge |
| `GrowArrow` / `MoveAlongPath` | arrow growth / `along` |
| `ValueTracker` + `always_redraw` | a scalar from the frame driving a drawing |

- Remotion skills (no licence) [U, not re-checked]: clamp both ends of every `interpolate`; `Easing.bezier` or a high-damping `spring` for a push without bounce; `TransitionSeries` transitions shorten the timeline, overlays do not; measure text only after fonts load.
- 3Blue1Brown-style pacing [U, craft guidance]: one idea per beat with a hold after each reveal; persistent objects that transform rather than cut; colour keeps one meaning for the whole film.

**Fonts for EN + zh-Hans** [V unless marked]

| Family | Package (version, date) | Licence | Shape | Role |
|---|---|---|---|---|
| IBM Plex Sans | `@fontsource-variable/ibm-plex-sans` 5.3.0 (2026-07-19) | OFL-1.1; fontsource's LICENSE copy names no Reserved Font Name | wght + wdth axes, normal and italic; 52 files, 1.35 MiB unpacked; latin wght slice 44.6 KiB | EN text, labels, title |
| Noto Sans SC | `@fontsource-variable/noto-sans-sc` 5.3.1 (2026-10-11) | OFL-1.1, no RFN | wght 100–900; 101 unicode-range slices, 4.29 MiB in all, largest 74.5 KiB | zh text and labels |
| JetBrains Mono | `@fontsource-variable/jetbrains-mono` 5.3.0 (2026-07-19) | OFL-1.1 | variable | Numbers, terminal text |
| Inter | `@fontsource-variable/inter` 5.3.0 (already pinned) | OFL-1.1 (LICENSE read; `licensing-tooling.md` still says [S]) | wght, plus opsz files (latin 71.2 KiB) | Alternative Latin |
| Geist / Geist Mono | `@fontsource-variable/geist(-mono)` 5.3.0 | OFL-1.1 | variable | Alternative "tech" Latin |
| IBM Plex Sans SC | `@ibm/plex-sans-sc` 1.1.0 (2024-12-03); not on fontsource | OFL-1.1, RFN "Plex" | Static only: 8 weights × 216 split files, ~124 MB unpacked | Skip: heavy |
| LXGW WenKai / Source Han Sans | `@fontsource/lxgw-wenkai` 5.3.0 (53 MiB) / not on fontsource | OFL-1.1 / OFL, RFN "Source" [U] | — | Accent only / use Noto (same design) |

- Fonts from pinned npm packages are never committed, so the 2 MiB cap does not apply. Credit them in the video's `CREDITS.md` (package pin, licence, "not redistributed"), as `videos/halloween-gift/CREDITS.md` does; `NOTICE.md` and `REUSE.toml` entries are needed only for a committed subset file, which must be renamed if the family has an RFN (`licensing-tooling.md`). IBM reserves "Plex" in its own licence: treat it as reserved for any Plex subset.
- Load through the kit's `useFont(spec)` (`packages/remotion-kit/src/fonts.ts`): pinned files via bundler URLs under an `AIV <family>` name, each frame held until the faces load, and the render fails if `sample` has a character no source covers. Every zh string must be in the Noto spec's `sample`. *A Halloween Gift* hand-picked 8 Noto Serif SC slices; a slice planner fed by the cue sheet is a candidate helper [U]; #4 V1 wrote one, not promoted (`src/look/slices.ts`, fed the film's strings by `src/look/fontPlan.ts`, at tag `video/super-agent/v1-archived`).
- Pair by listing both families in `font-family` (Latin face first, then Noto Sans SC). Variable slices carry every weight in one file per slice, so fewer requests and animatable weight; static families multiply files by weights.
- Subsetting, only for a font not on npm: `subset-font` 2.9.0 (BSD-3, Node; depends on harfbuzzjs ^1.6.1 and fontverter); fonttools 4.68.0 `pyftsubset` (MIT, Python ≥ 3.11); glyphhanger 6.0.0 (MIT, wraps pyftsubset and jsdom) adds nothing.

**CJK typesetting** [V unless marked]
- Chrome ships `text-autospace` on by default from Chrome 140 (chromestatus feature 5202578236768256): the pinned 157 shell inserts the Han–Latin gap itself. Pick one convention: no typed spaces between Han and Latin on screen, or `text-autospace: no-autospace` with typed spaces. Sidecar subtitles are not rendered by Chrome, so they keep typed spaces [U].
- `Intl.Segmenter('zh', {granularity: 'word'})` on Node 24.19.0 (ICU 78.3) splits 路由器 as 路|由|器, 工作者 as 工作|者 and 超级智能体 as 超级|智能|体; Chrome's ICU was not checked. Write explicit phrase breaks into the cue data (BudouX can propose them; its quality on technical terms is [U]) instead of segmenting at render time.
- The on-screen text bar is the repo's own (`docs/PRODUCTION.md`; `textHeld` in `packages/pipeline/src/audio/intent.ts`): a hold of at least max(1.8 s, reading + 0.6 s), reading = CJK/4.5 + other non-space characters/15, checked per language, and text at least 1/30 of frame height (36 px at 1080p). The lemo-opuscar formula in `subtitles.md` is not the gate. A reveal must finish before its `text` span starts, because the span covers only the fully visible state.

**Glow, blur and motion blur on the iGPU**
- Remotion's docs list box-shadow, text-shadow, gradients, `filter: blur()`, `drop-shadow()`, transforms and many canvas operations as GPU-drawn; our engine runs ANGLE D3D11 [V]. Blur is a convolution whose cost grows with area × radius and an animated blur is recomputed every frame; Chrome's advice is to cross-fade a few pre-blurred copies (https://developer.chrome.com/blog/animated-blur) [V]. `url()` SVG filters on non-composited elements take a CPU path per an older Chromium design doc [S, dated].
- Offline, determinism matters more than speed: a GPU canvas rastered large glyphs differently from page to page (kit README: from 166 px at weight 600, every weight from 200 px); a per-frame DOM grain canvas and a CSS shadow differed on 3 chunk-start frames of *A Halloween Gift* (`docs/ROADMAP.md`); ~~large DOM text is untested~~ 2026-11-08: a 200 px Plex SemiBold DOM line varied between fresh pages and mid-chunk frames, everything up to 136 px matched (`knowledge/dom-text-determinism.md`) [V].
- Cheapest-first ranking [U until a fixture runs]: gradients and translucent fills; `mix-blend-mode: plus-lighter`/`screen`; a small static `blur()`/`drop-shadow()`; SVG `feGaussianBlur` on small regions; full-frame bloom only through WebGL and the kit's `PostChain`. Avoid `backdrop-filter`; never `background-image: url()` or `mask-image: url()`, which Remotion cannot wait on [V docs].
- Motion blur: Remotion's components cost N× and shift colours; FFmpeg `tmix`/`tblend`/`dblur`/`gblur`/`avgblur`/`minterpolate` are in the local 8.0.1 build [V], but sub-frame `tmix` needs an N× fps render, which breaks the fps = `video.json` contract. Where one fast move needs it, a velocity smear from the easing derivative on that element alone is frame-pure at 1× cost [U].
- #4 V1's round-1 look used none of this (no glow, bloom, blur or particles; its round 2 allowed bloom on live emitters only, see the delta); ~~banding on the dark ground is handled by a static seeded dither tile~~ 2026-11-08: a seeded 0/+1/+2 DOM dither tile broke up the band edges but the average still stepped, so a lifted ground needs shader maths with an output dither (`knowledge/dom-text-determinism.md`) [V].

**Determinism-lint blind spots** (`eslint.config.js` at `abf1904`) [V]
- `NONDETERMINISM` bans clocks, timers, rAF, `document.timeline`, `Math.random` and crypto randomness across videos, templates, styles, the kit, `@aiv/core`, the web page code and engine fixtures. It does not catch CSS `transition`/`animation`/`@keyframes` (style objects or CSS files), `element.animate()` and `getAnimations()` (WAAPI), or `ResizeObserver`/`IntersectionObserver`.
- Those are exactly the mechanisms inside magic-move's renderer, anime.js `splitText` and `@remotion/rough-notation`, and library internals are never linted. `hyperframes.md`'s advice to prefer WAAPI, CSS or anime.js in shared code holds only where HyperFrames' adapters seek them; under Remotion nothing does [U].

## What we adopted / adapted — the stack #4 V1 used (round 1)
*Round 1 (the plan of 2026-11-08): V1's choices, not defaults. Round 2 replaced the DOM/SVG world with a WebGL layer: see the delta at the end.*

- **Engine**: `engines/remotion` at 4.0.539, DOM + inline SVG, no R3F, 1920×1080 at 30 fps (set in `video.json`; the series has no formal default). Timing from the video's cue sheet on a 90 bpm grid (80 frames per bar). The web engine is the fallback only if the DOM determinism probe fails.
- **Dependencies** (approved with the plan, added by the main agent through the catalog): `@remotion/paths` and `@remotion/layout-utils` 4.0.539; `@fontsource-variable/ibm-plex-sans` 5.3.0, `@fontsource-variable/noto-sans-sc` 5.3.1, `@fontsource-variable/jetbrains-mono` 5.3.0, credited in `CREDITS.md`. Shiki, magic-move core, `@remotion/shapes`, the DOM transitions, d3-shape or perfect-freehand only if a shot needs them, each as a new dependency decision.
- **Lint first**, as its own commit: ban CSS `transition`/`animation`/`@keyframes`, `element.animate`, `getAnimations` and `ResizeObserver`/`IntersectionObserver` in frame code.
- **2D motion kit**: V1 built it in `src/kit/` (at tag `video/super-agent/v1-archived`) with no film imports and its own tests; not promoted. A later film promotes to `@aiv/remotion-kit` only what it reuses (rule of two). V1's look tokens were in `src/look/`, with its font-slice planner (`slices.ts` and `fontPlan.ts`, the candidate helper under Fonts). The kit's modules:

| Module | Contents | Built on |
|---|---|---|
| timeline | `beat(cueId)` → local frame and progress; pure `seq`/`all`/`delay`/`lagged` combinators; named easings | `@aiv/core` `progress()` and easings |
| text | 6-frame wipe in, 6-frame fade out; EN word and zh phrase units from explicit breaks; the bilingual notes block | `useFont`, layout-utils after `ready` |
| diagram | nodes, edges drawn along their path, tokens that hop or ride (`getPointAtLength`/`getTangentAtLength`), dashed "proposed" lines, hatching, the expanding emphasis ring | `@remotion/paths` |
| camera | one 3840×2160 world plane; translate and scale only, eased between named framings; `vector-effect: non-scaling-stroke` | — |
| sketch | tapered, seeded-pressure stroke polygons for act one, chart rails and open items; a 12% ghost when erased | own code, `@aiv/core` `rand` |
| dither | static seeded tile against banding on the dark ground | `@aiv/core` `rand` |

- **Reuse and two-user promotions**: `Title` and `useRenderScale`/`useRenderSize` already exist in the kit, `progress()`, `rand` and `valueNoise` in `@aiv/core`. *A Halloween Gift*'s bilingual caption pattern moves to `@aiv/remotion-kit`, its cue-text helpers and `readingSeconds` to `@aiv/core`; the frozen film keeps its own copy. Sidecar SRT comes from cue `text` events through a generator and linter in `@aiv/pipeline` (not `@remotion/captions`).
- **Probe before film code**: large EN + zh DOM text, the dark ground with dither, SVG draw-on and tokens; `aiv still --check` on chunk-start frames, two `aiv render --fresh` runs, s/frame and MiB/frame, and a check that the 2D bundle tree-shakes the kit's 3D exports.

## What we deliberately did NOT adopt, and why
- GSAP: proprietary licence with a Prohibited Uses clause. Motion and anime.js: both mutate the DOM outside React and run on rAF unless created paused and seeked by hand; neither adds anything over `interpolate`/`spring`.
- Lottie and Rive: authored assets in proprietary or external editors; Rive would seek by replay [U].
- elkjs: async, heavy, copyleft-style licence. d3-force at render time: hidden timer.
- rough.js and `@remotion/rough-notation`: wrong look, unseeded by default, `ResizeObserver`.
- `@remotion/google-fonts` and `@remotion/fonts`: CDN fetch, weaker than `useFont`. IBM Plex Sans SC: static, ~124 MB, not on fontsource.
- `@remotion/motion-blur`, HTML-in-canvas transitions and effects, `@remotion/effects`/light-leaks/starburst: N× cost or colour shift, unverified on the Windows shell, and outside #4 V1's approved look.
- Code Hike: MDX-centric, unlicensed examples. `Intl.Segmenter` and BudouX at render time: wrong splits, and possibly different ICU data in Node and Chrome [U].

## Gotchas
- `measureText` keeps a module-level cache keyed on text, family, weight, size, spacing, transform and styles: a call before the fonts load caches the fallback size, and `fontVariantNumeric` is not in the key (tabular and proportional figures share one entry).
- `validateFontIsLoaded` (default false in v4, true in v5) throws only when the box equals the fallback box *and* the string has more than 4 distinct characters, so short labels such as 路由器 or 工作者 are never checked. The real guard is the kit's `useFont` `ready`.
- anime.js `seek()` resumes a playing instance; d3-force runs a timer unless stopped; rough.js is random unless every shape gets a non-zero seed.
- Shiki's JavaScript engine throws on grammars it cannot convert: test the exact languages first.
- Draft renders at half scale turn 1 px hairlines into 0.5 px: keep strokes at least 2 px at 1080p [U].
- QA's black and freeze thresholds are hard-coded (`docs/ROADMAP.md`): a still diagram held over 3 s needs `hold` cues or `qa.allowFreeze`, and a dark ground must stay above limited-range luma 38 or declare `qa.allowBlack`.
- Render budget [U]: the 3D template measured 0.28–0.37 s/frame at 1080p and FFV1 at ~1.2 MiB/frame dithered, ~0.8 without (`engines/remotion/ENGINE.md`). Planning on 0.2–0.4 s/frame, 5,280 frames take roughly 18–35 minutes per 1080p render and ~4–6 GiB of mezzanine; check free disk. ~~DOM frame cost on the iGPU is unmeasured.~~ Measured 2026-11-08: 0.20–0.21 s and 0.49 MiB per frame at 1080p for the DOM/SVG probe (`engines/remotion/ENGINE.md`, Measured on the reference host) [V].

## Not read
Not run on the reference host: ~~DOM/SVG frame cost, large-DOM-text~~ (run 2026-11-08, see above) and CSS-shadow determinism, `HtmlInCanvas.isSupported()` in the headless shell, Chrome 157's ICU segmentation. Not read: anime.js v4 docs beyond the engine page (behaviour read from source), Motion Canvas time-events docs, Remotion Elements and their licence, the Smiley Sans and Source Han Sans licence files, `interpolateColors`' colour space, @dagrejs/graphlib's randomness, whether fontsource's Plex Sans slices keep the `tnum` feature. Not re-checked: the Remotion skills points, BudouX on technical terms, Code Hike snapshots at chunk starts, the glow cost ranking.

## Delta 2026-11-09: round 2 puts the world in WebGL, text stays DOM
Research done 2026-11-08 for lookdev round 2 of #4 V1, after the user rejected round 1's
look as too simple and crude. Items marked "re-checked" were read again on 2026-11-09.
It was written before anything in it was rendered. V1 then built and rendered the world layer
(2026-11-09 to 2026-11-15; shaders in `src/desk/gl/` at tag `video/super-agent/v1-archived`)
and measured at 1080p on the reference host [V]:
- 0.37–0.62 s/frame in the first motion tests, 0.37–0.79 s steady by the look's sign-off
  (2026-11-10; the busiest test, the 0.64× summary, at the top), and 0.40–0.77 s/frame over
  the full 1080p render of 6,720 frames;
- 1.31–1.32 MiB/frame of lossless mezzanine;
- deterministic on fresh pages (V1's proof per change: two fresh stills hash-identical, and
  every span's `--inner` frames equal to the span's), and the final's 6,720 frame hashes
  equalled the review cut's.

Sources: `docs/ROADMAP.md` (2026-11-09) and `videos/super-agent/README.md` ("Numbers", the
final's render and proof, the build rules), both at the tag. These answer the [U] cost and
determinism guesses below.

**What changed for #4 V1**
- Round 1 failed on art direction, not on tooling: DOM/SVG was fast (0.20–0.21 s, 0.49 MiB per frame) and deterministic (two fresh renders identical, 12 of 12 chunk-start checks) [V]. The lit look round 2 asks for is what DOM does badly here: band-free light on a dark ground (CSS gradients band, a dither tile only broke the band edges), layered shading and shadows (a CSS shadow differed on chunk-start frames of *A Halloween Gift*), and real bloom [V].
- Round 2 plan: two layers driven by one pure camera function (built by V1 and measured: above).

| Layer | Contents | Built with |
|---|---|---|
| World (WebGL) | Ground, objects, routes, cargo, light | R3F through the kit's `Stage3D` and `PostChain` at the pins: MSAA 4×, HalfFloat linear light, mipmap bloom, tone mapping, one dither at the 8-bit output |
| Text (DOM, on top) | Notes, labels | The existing rules (≤ 136 px, `GREY_TEXT` layers); positions projected through the same camera function as the R3F camera |

- **Camera**: a long-lens perspective camera (fov about 20°, at the distance where 1 world unit = 1 px at 1.0×, fixed pitch) with objects at real heights, so depth comes from the lens; an orthographic camera has no parallax. `Stage3D` already takes a perspective `camera` (fov, near, far, position) [V source]; only an orthographic camera would need a new option.
- **Materials**: analytic, from shader maths and SDFs (forms, bevels, engraving, light pools, seeded world-locked texture) rather than baked textures, so they stay sharp at any camera scale. A fixed light set is always mounted, so light counts never change a shader program.
- **Shadows**: analytic SDF footprint shadows on the receiving surfaces, no shadow maps. This sidesteps the shadow-box hazard: three sets a shadow camera's projection only when the map is created, so a per-shot box depends on where the chunk began (`knowledge/r3f-under-remotion.md`) [V hazard; remedy U].
- **Bloom only on live emitters** (#4 V1's rule, not a default): emission marks a process that is running (a lamp attending, a Worker computing, the one carrier in flight), never a thing; at most 3 sources per frame, and every non-emitter is clamped below the bloom threshold of 1.0. A deliberate, numbered exception to HyperFrames' BANNED-by-default bloom (`hyperframes.md`) and to the genre "package" in `vibe-knowledge-style-2026-11.md`.
- **Text inside the depth stack** (rare): a texture from the kit's CPU text canvas (`textCanvas`/`textContext`), drawn after the fonts are ready, as in *A Halloween Gift* [V].
- **Confirmed only by the probe in the build**: SDF objects, a route with a travelling pulse, instanced cargo and the DOM notes on top; s/frame and MiB/frame at 1080p, two `--fresh` renders, chunk-start checks, `HtmlInCanvas.isSupported()` in the shell, then judged by eye. If the WebGL arm fails, the next candidate is the CPU Canvas2D below [U]. The WebGL arm held in V1 (costs above), so the Canvas2D arm was never tried; no record of the `HtmlInCanvas` probe was found at the tag [U].

**Substrate comparison** (per 1080p frame, PNG capture, decode and FFV1 included)

| Substrate | Cost per frame | Chunk-start determinism | Quality ceiling | Verdict |
|---|---|---|---|---|
| DOM/SVG + baked PNG + SVG filters | 0.20–0.21 s, 0.49 MiB [V probe] | Text ≤ 136 px and SVG proven [V]; a CSS shadow and a per-frame GPU canvas differed in *Halloween* [V]; `url()` SVG filters take a CPU path [S, dated design doc] | Low to medium: no real bloom, gradients band | Text layer only |
| CPU Canvas2D drawn per frame (`willReadFrequently: true`) | Unmeasured | The kit's CPU text canvas never varied across pages or browser launches (`packages/remotion-kit/README.md`) [V for text]; full scenes unmeasured [U] | Medium to high: `Path2D` takes the route strings; shadows and gradients (dither by hand) | Missed by the first comparison; second arm if WebGL fails [U] |
| R3F long lens + SDF shaders + PostChain | Template (MSAA 4× HalfFloat, bloom, shadows, 336 instances, DOM overlay): 0.28–0.37 s, 1.20 MiB dithered [V]; ~~an SDF scene 0.3–0.5 s [U]~~ #4 V1's SDF world 0.37–0.79 s in motion tests, 0.40–0.77 s over its full render, 1.31–1.32 MiB [V, top of the delta] | The synchronous composer, delta-0 rendering, HalfFloat + dither, animated `InstancedMesh` with `frustumCulled=false` and mipmap bloom gave bit-identical fresh renders, and pages started at frames 0, 3, 8, 20 and 75 matched (`engines/remotion/ENGINE.md`) [V] | Highest practical: HDR, bloom, analytic materials, instancing | **Adopt** (world layer) |
| `@remotion/skia` / CanvasKit | Unmeasured; CPU by default, the docs say `--gl=angle` helps a lot [V docs] | WASM must load before `registerRoot` [V docs] | High 2D: path effects, mask blur, SkSL | Skip (below) |
| Pixi.js v8 driven per frame | ≈ R3F [U] | Hazards below | ≈ R3F, rich filter set | Pattern only |
| Raw WebGL / regl full-screen SDF | 0.12 s in the web engine with in-page readback [V], but DOM text is not captured there | Low | Same as R3F | Skip: host the same shaders on an R3F plane |
| Remotion `<HtmlInCanvas>` | Unmeasured | Experimental (re-checks below) | Would let DOM text feed a WebGL effect | Probe only |

- **Why Skia is out** [V npm, re-checked 2026-11-09; docs 2026-11-08]: `@shopify/react-native-skia` 2.14.0 hard-depends on four native binary packages pinned at 154.0.0 (unpacked at 154.0.1: Android 214.2 MiB, iOS and tvOS 208.5 MiB each, macOS 86.2 MiB, ≈ 717 MiB), on `canvaskit-wasm` 0.41.0 exactly (0.42.0 is latest) and on `react-reconciler` 0.31.0, a second React reconciler. It also needs a webpack override (`enableSkia`) in the engine's bundler and an async `LoadSkia()` before `registerRoot`, and CJK text would need whole font files loaded into Skia.
- **Pixi determinism hazards** [V docs and bundle scan of 8.22.0, 2026-11-08]: `app.init` is async (so `delayRender`); `autoStart` defaults to true; garbage collection runs on the wall clock (`gcFrequency` 30 s, `gcMaxUnusedTime` 60 s); the core bundle has 21 `performance.now`, 5 rAF and 7 `setTimeout` calls; text goes through a GPU 2D canvas, which varies at large sizes. A safe setup would be `autoStart: false`, `sharedTicker: false`, `gcActive: false`, `preference: 'webgl'` and `app.render()` in a layout effect [U].

**Techniques for the world layer** [U: standard techniques, not yet built here]
- Forms: SDF primitives and operations (rounded box with per-corner radii, capsule, arc, ring, Bézier, polygon; union, smooth-min, outline, onion layers, domain repetition for vents and ticks), anti-aliased with `fwidth`; each role gets its own silhouette family.
- Material from one SDF: a normal from the distance gradient gives bevel, diffuse and specular from the key light; inner shadow inside the shape, soft drop shadow from an offset distance, rim light at the edge.
- Band-free gradients: computed in the shader at half-float precision and dithered once by PostChain (a fixed hash of `gl_FragCoord`) [V]; optionally a blue-noise tile (Peters, CC0 [V page]) or a self-generated one.
- Defocus without a pass: widen each SDF's anti-alias band by its plane's circle of confusion, which avoids `DepthOfFieldEffect` halos on alpha-blended quads. If used at all, only to settle back planes: never as a focus pull or a push (the critic's camera item; depth-of-field pushes are on the do-not-copy list in `vibe-knowledge-style-2026-11.md`).
- Routes as ribbons: a d3-shape curve sampled with `@remotion/paths` in `useMemo` becomes a triangle strip with arc-length and side attributes; the shader tapers it, draws it on by discarding past `progress`, marches dashes and runs pulses as travelling Gaussians pushed into HDR (a pulse may bloom only as the carrier in flight, within the 3-emitter cap; a glowing line is a frame-critic P0). meshline 3.3.1 is the pattern; three's `Line2`/`LineMaterial` (0.186.1) serves plain fat lines if `resolution` is set in a layout effect.
- Cargo: instanced points on a path lookup texture at `fract(seed + speed·t)`, seeds from `@aiv/core` `rand`. Tethers: closed-form sag plus an analytic damped oscillator after each event, no simulation. Morphs: `mix(dA, dB, t)` of two SDFs, no point correspondence (replaces flubber). `spring({frame, fps})` is pure [V].
- Motion blur: a velocity smear along the easing derivative at 1× cost. Sub-frame accumulation (K renders per frame, averaged in a PostChain pass) re-poses the scene K times per frame, which conflicts with the engine's model of a pose in props and one PostChain subscription: measure before relying on it.
- postprocessing 6.39.5 exports `SelectiveBloomEffect`, `KawaseBlurPass`, `TiltShiftEffect`, `LUT3DEffect`, `NoiseEffect` and `ToneMappingMode.NEUTRAL` [V build, re-checked 2026-11-09]; threshold bloom on HDR values needs no selection bookkeeping.

**Ranked adopt / pattern / skip** (npm latest on 2026-11-08, re-checked 2026-11-09; licence from the LICENSE file unless noted). None of the new packages is in the catalog at `371204b` [V]; each is its own dependency decision.

| Item | Version (date) | Licence | Frame-pure under Remotion 4.0.539? | Verdict |
|---|---|---|---|---|
| three + R3F + postprocessing via `Stage3D`/`PostChain` | 0.186.1 / 9.8.2 / 6.39.5 (pinned) | MIT / MIT / Zlib | Yes, proven on the host [V] | **Adopt** |
| Own SDF, ribbon and cargo shader modules | — | repo | Yes if driven by frame uniforms [U] | **Adopt**, video-local until a second video needs them (#4 V1's are in `src/desk/gl/` at tag `video/super-agent/v1-archived`; not promoted) |
| three `Line2`/`LineMaterial`, `SVGLoader` | in three 0.186.1 | MIT | Yes; `resolution` in a layout effect [U] | Adopt |
| `@remotion/paths`, `spring` | 4.0.539 (pinned) | MIT / Remotion License | Yes [V] | Adopt (already) |
| d3-shape | 3.2.1 (2026-11-03) | ISC | Pure generators | Adopt for curves |
| perfect-freehand | 1.2.3 (2026-02-01) | MIT | No clock or random [V scan] | Candidate; round 2 draws pencil with the kit's own sketch strokes |
| `@phosphor-icons/core` | 2.1.1 (2024-03-29) | MIT | Static data | One family as a glyph base, micro detail only |
| `@tabler/icons` / `lucide-static` | 3.51.0 (2026-11-08; 3.50.0 at research) / 1.70.0 (2026-11-06) | MIT / ISC, plus MIT for Feather-derived icons | Static | Alternatives |
| Blue-noise tiles (Peters) | — | CC0 [V page] | Static | Optional |
| culori | 4.0.2 (2025-06-27) | MIT | Pure [U] | Optional: OKLCH ramps at build time |
| meshline | 3.3.1 (2024-06-03) | MIT | No clock or random [V scan] | Pattern for the ribbon |
| pixi-filters (glow, bloom, bevel, motion blur GLSL) | 6.1.5 (2025-11-29) | MIT | The glitch filter calls `Math.random` [V scan] | Pattern: port GLSL as postprocessing Effects with a notice |
| Pixi.js | 8.22.0 (2026-10-01) | MIT | Only with the hazards above disabled | Pattern / fallback |
| `<HtmlInCanvas>` | in remotion 4.0.539 | Remotion License | Experimental | Probe |
| flubber | 0.4.2 (2018-03-01) | MIT | Clean, dormant | Skip: SDF morphs |
| `@remotion/skia` + RN Skia | 4.0.539 / 2.14.0 | MIT / MIT (canvaskit-wasm BSD-3) | Async WASM | Skip |
| regl | 2.1.1 (2024-11-12) | MIT | Pure | Skip: redundant with R3F |
| troika-three-text (drei `<Text>`) | 0.53.1 (2026-11-02) | MIT | Layout in a worker, async; fallback fonts from jsDelivr by default [V README] | Skip: text stays DOM or CPU canvas |
| postprocessing `SMAAEffect` with default images | 6.39.5 | Zlib | Loads its lookup images asynchronously through `new Image()` [V source] | Skip: MSAA, or preload behind `delayRender` |
| drei `MeshTransmissionMaterial` | 10.7.9 | MIT | Reads `state.clock.elapsedTime` in `useFrame` [V source] | Skip: fake glass in the SDF |
| LYGIA shader library | `aa7580be` | Prosperity 3.0.0 (non-commercial, 30-day commercial trial) or a Patron License for sponsors and contributors [V, re-checked 2026-11-09] | — | **Skip; copy nothing** |

**Baking** [U unless marked]
- WebGL layer: generate, don't bake. Noise, light pools, gradients and blue-noise-like tiles are `DataTexture`s built from `@aiv/core` `rand`/`valueNoise` in `useMemo`: synchronous, no files, covered by the input hash.
- Textures from files go through R3F `useTexture`/Suspense, which `ThreeCanvas` waits on; DOM images through `<Img>`; never CSS `url()` [V `remotion.md`].
- A DOM-layer PNG, only if the text layer needs one: generalise #4 V1's dither-tile writer (at the tag) to RGBA and pin decoded pixels in tests, not file bytes (zlib output can change between Node versions). Promote it to `packages/` on a second use.
- Not needed: sharp 0.35.5 (Apache-2.0; its prebuilt libvips binaries carry their own licence), @napi-rs/canvas 1.1.0, pngjs 7.0.0, fast-png 8.0.0 (browsers decode `<img>` to 8 bits, so 16-bit PNGs gain nothing).
- Keep grain static and world-locked: animated full-frame grain pushes FFV1 toward 2+ MiB/frame because noise cannot be predicted.

**Hazards and costs**
- DOM always sits above WebGL: anything that must sit between depth planes or receive light belongs in the world layer. EN and zh labels must project through the same camera function or they drift [U].
- Clamp before `pow()` in shaders (ANGLE NaN, then a bloom blackout); keep `frustumCulled=false` on animated instanced meshes; no posing in `useEffect` [V knowledge notes]. Keep the lifted ground above limited-range luma 38 for QA's black detector [V].
- Render budget [U, anchored on the template]: #4 V1's 6,720 frames × 0.3–0.5 s ≈ 34–56 min per 1080p pass (4–7 foreground calls with `--budget-min 9`, or overnight; its 2:56 cut's 5,280 frames ≈ 26–44 min); about 1.2 MiB/frame ≈ 7.9 GiB of mezzanine (6.2 GiB at 5,280 frames); ≈ 150 MB of shared GPU memory for an MSAA 4× HalfFloat 1080p composer with its mip chain. *A Halloween Gift*'s heavy V2 ran 0.9–1.9 s/frame, the practical ceiling [V]. Measured on V1's final [V, tag README]: 56 chunks, 4,754 s of rendering at 0.40–0.77 s/frame, and a 9.0 GB mezzanine.
- Shader compile time [V `engines/remotion/ENGINE.md`]: each distinct program costs about 1.5–2 s on ANGLE D3D11, and *Halloween* V2's diagnostic composition took 119–225 s for its first draw cold, 6.7 s warm from the GPU program cache. Changed programs compile cold once after every shader edit, so budget minutes per edit in lookdev; keep about 10 programs, one "uber" shader per element family [U].
- 4K is not costed (the craft research proposed a 3840×2160 master):
  - there is no 4K profile: `packages/pipeline/src/runner/profiles.ts` has draft at scale 0.5 and review/final at 1.0 [V];
  - the ≤ 136 px DOM-text proof was made at device scale 1; at scale 2 a 100 px line rasters at 200 device px, the size that varied, so the bound must be proven again [V];
  - an MSAA 4× HalfFloat composer at 4K needs about 600 MB, and the mezzanine about 4.8 MiB/frame × 5,280–6,720 frames ≈ 25–31 GiB [U]; check free disk;
  - so deliver 1080p unless the probe justifies a 4K profile and a new text-determinism run.
- Still-tooling gaps [V source, `packages/pipeline/src/stills/stills.ts`, 2026-11-08]: `aiv still` renders at most 120 frames (`MAX_STILLS`) and ~~`--span` writes PNGs only (no mp4, contact sheet or motion QA), so motion tests over 4 s need a render~~ (closed 2026-11-09 by decision 31: `--span` now renders up to 240 contiguous frames, `MAX_SPAN`; `--encode` adds a lossless clip, a preview mp4, a contact sheet and motion QA). `--check` compares against a finished run of the same profile and refuses a different input hash; a lookdev entry's settings name its entry and composition, so a lookdev composition cannot be chunk-start checked that way (since decision 31, `--inner <n>` re-renders frames inside a span on fresh pages instead). Putting the probe in `Main` instead changes `Main`'s input hash.

**Licence traps for shader work**
- Shadertoy code defaults to CC BY-NC-SA 3.0 unless its author states otherwise [S: the terms page refused a direct fetch on 2026-11-09]. Never paste shader code from it.
- iq's distance-function articles (https://iquilezles.org/articles/distfunctions2d) state no licence [S; not read at source]: re-derive the maths, never copy code.
- LYGIA: non-commercial unless sponsored (table above).
- pixi-filters and meshline (MIT): port only with SPDX and Adapted-from headers (`licensing-tooling.md`).

**Corrections and re-checks (2026-11-09)** [V npm or source unless marked]
- three latest is 0.187.0 (2026-10-30) and postprocessing 6.39.6 (2026-11-01), whose peer range widens to three < 0.188.0; R3F latest is still 9.8.2 (peers React < 19.4). Stay on the pins: a move is an upgrade decision for `r3f-drei-postprocessing.md` and `toolchain-2026-11.md`.
- Dates given wrongly in the round-2 skills research (not in this note): culori 4.0.2 was published 2025-06-27, perfect-arrows 0.3.7 (MIT) on 2021-09-28.
- Remotion 4.0.539 typings: `Easing.spring` exists; `interpolate` has `output: 'perceptual-scale'`, `posterize` and `outputType: 'font-weight'`; `HtmlInCanvas.isSupported` and `isHtmlInCanvasSupported` are both exported. Remotion latest is still 4.0.541.
- HtmlInCanvas on our shell: the pinned headless shell is Chrome 157.0.8080.0, the build of #12369 (Chrome 157 crashing while capturing with HtmlInCanvas, closed 2026-10-30; per the docs Remotion stopped premounting by default from 4.0.537 [V docs, 2026-11-08]). #12638 (the custom Windows build) is still open. Support on the reference host stays [U].
- Fonts: JetBrains Mono, #4 V1's number face at the time, is on HyperFrames' list of faces where generated design lands (`hyperframes.md`); IBM Plex Mono would match Plex Sans [U]. IBM Plex Mono 5.3.0 replaced it in V1 on 2026-11-09 (`docs/ROADMAP.md`).

**What we deliberately did NOT adopt (delta)**
- Skia, Pixi as the substrate, raw WebGL, troika text, `SMAAEffect` with default images, `MeshTransmissionMaterial`, LYGIA: reasons in the tables above.
- Shadow maps in the world layer: analytic footprints avoid the shadow-box hazard at chunk starts.
- Bloom, particles, vignette and depth of field as decoration: that is the genre package; emission stays semantic and capped.
- Sub-frame accumulated motion blur until it is measured; the velocity smear comes first.
- A 4K master until it is costed and the text bound is proven again.

**Not read (delta)**
Not rendered: ~~the SDF scene's cost and determinism~~ (rendered by #4 V1: top of the delta), the CPU Canvas2D option, Skia and Pixi on the host, `HtmlInCanvas.isSupported()` in the shell, K = 4 or 8 sub-frame accumulation, the cost of layered shadows. Not read: the iq articles' licence, Shadertoy's terms at source, the Chromium source on SVG-filter compositing, three's LICENSE file (MIT per npm).
