# 2D explainer motion graphics in code — building blocks, fonts, determinism (2026-11)

| | |
|---|---|
| Upstream | Per row below. Key sources: https://github.com/remotion-dev/remotion (npm `@remotion/*`) · https://github.com/shikijs/shiki · https://github.com/juliangarnier/anime · https://github.com/motiondivision/motion · https://github.com/motion-canvas/motion-canvas · https://docs.manim.community · https://fontsource.org · https://github.com/google/budoux |
| Pin | Remotion 4.0.539 (repo pin; latest 4.0.541). Source read at shikijs/shiki `de15fd2efb709ea4528d894ab857ac145f3dc277`, anime master `01b81be1df6843ccfe0a71c0699a746bf740dd77`, motion main `78f3ff51b5508f7e8c1c283d8e80bcd26fec37d7`, motion-canvas `7b91435c301d530351dcf5ebb91dd139c002e405`, remotion-dev/skills `a2824c67f8b4585c294a8101db9f9f0ad3c643f8`; repo facts at `abf1904`. Other versions per row (npm, 2026-11-08). |
| Licence | Per row: MIT, ISC, Apache-2.0, OFL-1.1, BSD-3, EPL-2.0 OR GPL-3.0-or-later (elkjs), proprietary (GSAP), Remotion License |
| Accessed | 2026-11-08 |
| Stale after | Remotion rows: the next Remotion upgrade or 2026-12-01. Library and font verdicts: 2027-05-01. |
| Excerpt policy | Paraphrase only. Remotion docs and skills, and the Code Hike examples (no licence), are ideas only, never copied. |

## What it is
The libraries, fonts and patterns for deterministic, code-generated 2D explainer graphics
(DOM + inline SVG under `engines/remotion`), checked for video #4 (`super-agent`). It is a
delta: engine verdicts live in `code-video-engines-survey.md`, Remotion itself (licence,
`--gl`, colour, browser, v5) in `remotion.md`. Neither is repeated here.

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

**Code animation** (for code or terminal shots; video #4 has none storyboarded) [V]
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
- Load through the kit's `useFont(spec)` (`packages/remotion-kit/src/fonts.ts`): pinned files via bundler URLs under an `AIV <family>` name, each frame held until the faces load, and the render fails if `sample` has a character no source covers. Every zh string must be in the Noto spec's `sample`. *A Halloween Gift* hand-picked 8 Noto Serif SC slices; a slice planner fed by the cue sheet is a candidate helper [U].
- Pair by listing both families in `font-family` (Latin face first, then Noto Sans SC). Variable slices carry every weight in one file per slice, so fewer requests and animatable weight; static families multiply files by weights.
- Subsetting, only for a font not on npm: `subset-font` 2.9.0 (BSD-3, Node; depends on harfbuzzjs ^1.6.1 and fontverter); fonttools 4.68.0 `pyftsubset` (MIT, Python ≥ 3.11); glyphhanger 6.0.0 (MIT, wraps pyftsubset and jsdom) adds nothing.

**CJK typesetting** [V unless marked]
- Chrome ships `text-autospace` on by default from Chrome 140 (chromestatus feature 5202578236768256): the pinned 157 shell inserts the Han–Latin gap itself. Pick one convention: no typed spaces between Han and Latin on screen, or `text-autospace: no-autospace` with typed spaces. Sidecar subtitles are not rendered by Chrome, so they keep typed spaces [U].
- `Intl.Segmenter('zh', {granularity: 'word'})` on Node 24.19.0 (ICU 78.3) splits 路由器 as 路|由|器, 工作者 as 工作|者 and 超级智能体 as 超级|智能|体; Chrome's ICU was not checked. Write explicit phrase breaks into the cue data (BudouX can propose them; its quality on technical terms is [U]) instead of segmenting at render time.
- The on-screen text bar is the repo's own (`docs/PRODUCTION.md`; `textHeld` in `packages/pipeline/src/audio/intent.ts`): a hold of at least max(1.8 s, reading + 0.6 s), reading = CJK/4.5 + other non-space characters/15, checked per language, and text at least 1/30 of frame height (36 px at 1080p). The lemo-opuscar formula in `subtitles.md` is not the gate. A reveal must finish before its `text` span starts, because the span covers only the fully visible state.

**Glow, blur and motion blur on the iGPU**
- Remotion's docs list box-shadow, text-shadow, gradients, `filter: blur()`, `drop-shadow()`, transforms and many canvas operations as GPU-drawn; our engine runs ANGLE D3D11 [V]. Blur is a convolution whose cost grows with area × radius and an animated blur is recomputed every frame; Chrome's advice is to cross-fade a few pre-blurred copies (https://developer.chrome.com/blog/animated-blur) [V]. `url()` SVG filters on non-composited elements take a CPU path per an older Chromium design doc [S, dated].
- Offline, determinism matters more than speed: a GPU canvas rastered large glyphs differently from page to page (kit README: from 166 px at weight 600, every weight from 200 px); a per-frame DOM grain canvas and a CSS shadow differed on 3 chunk-start frames of *A Halloween Gift* (`docs/ROADMAP.md`); large DOM text is untested [V].
- Cheapest-first ranking [U until a fixture runs]: gradients and translucent fills; `mix-blend-mode: plus-lighter`/`screen`; a small static `blur()`/`drop-shadow()`; SVG `feGaussianBlur` on small regions; full-frame bloom only through WebGL and the kit's `PostChain`. Avoid `backdrop-filter`; never `background-image: url()` or `mask-image: url()`, which Remotion cannot wait on [V docs].
- Motion blur: Remotion's components cost N× and shift colours; FFmpeg `tmix`/`tblend`/`dblur`/`gblur`/`avgblur`/`minterpolate` are in the local 8.0.1 build [V], but sub-frame `tmix` needs an N× fps render, which breaks the fps = `video.json` contract. Where one fast move needs it, a velocity smear from the easing derivative on that element alone is frame-pure at 1× cost [U].
- Video #4's look uses none of this (no glow, bloom, blur or particles); banding on the dark ground is handled by a static seeded dither tile.

**Determinism-lint blind spots** (`eslint.config.js` at `abf1904`) [V]
- `NONDETERMINISM` bans clocks, timers, rAF, `document.timeline`, `Math.random` and crypto randomness across videos, templates, styles, the kit, `@aiv/core`, the web page code and engine fixtures. It does not catch CSS `transition`/`animation`/`@keyframes` (style objects or CSS files), `element.animate()` and `getAnimations()` (WAAPI), or `ResizeObserver`/`IntersectionObserver`.
- Those are exactly the mechanisms inside magic-move's renderer, anime.js `splitText` and `@remotion/rough-notation`, and library internals are never linted. `hyperframes.md`'s advice to prefer WAAPI, CSS or anime.js in shared code holds only where HyperFrames' adapters seek them; under Remotion nothing does [U].

## What we adopted / adapted — the stack for video #4
- **Engine**: `engines/remotion` at 4.0.539, DOM + inline SVG, no R3F, 1920×1080 at 30 fps (set in `video.json`; the series has no formal default). Timing from the video's cue sheet on a 90 bpm grid (80 frames per bar). The web engine is the fallback only if the DOM determinism probe fails.
- **Dependencies** (approved with the plan, added by the main agent through the catalog): `@remotion/paths` and `@remotion/layout-utils` 4.0.539; `@fontsource-variable/ibm-plex-sans` 5.3.0, `@fontsource-variable/noto-sans-sc` 5.3.1, `@fontsource-variable/jetbrains-mono` 5.3.0, credited in `CREDITS.md`. Shiki, magic-move core, `@remotion/shapes`, the DOM transitions, d3-shape or perfect-freehand only if a shot needs them, each as a new dependency decision.
- **Lint first**, as its own commit: ban CSS `transition`/`animation`/`@keyframes`, `element.animate`, `getAnimations` and `ResizeObserver`/`IntersectionObserver` in frame code.
- **2D motion kit**, started in `videos/super-agent/src/kit/` with no film imports and its own tests, promoted to `@aiv/remotion-kit` when the next 2D explainer needs it (rule of two); look tokens stay in `src/look/`:

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
- `@remotion/motion-blur`, HTML-in-canvas transitions and effects, `@remotion/effects`/light-leaks/starburst: N× cost or colour shift, unverified on the Windows shell, and outside the approved look.
- Code Hike: MDX-centric, unlicensed examples. `Intl.Segmenter` and BudouX at render time: wrong splits, and possibly different ICU data in Node and Chrome [U].

## Gotchas
- `measureText` keeps a module-level cache keyed on text, family, weight, size, spacing, transform and styles: a call before the fonts load caches the fallback size, and `fontVariantNumeric` is not in the key (tabular and proportional figures share one entry).
- `validateFontIsLoaded` (default false in v4, true in v5) throws only when the box equals the fallback box *and* the string has more than 4 distinct characters, so short labels such as 路由器 or 工作者 are never checked. The real guard is the kit's `useFont` `ready`.
- anime.js `seek()` resumes a playing instance; d3-force runs a timer unless stopped; rough.js is random unless every shape gets a non-zero seed.
- Shiki's JavaScript engine throws on grammars it cannot convert: test the exact languages first.
- Draft renders at half scale turn 1 px hairlines into 0.5 px: keep strokes at least 2 px at 1080p [U].
- QA's black and freeze thresholds are hard-coded (`docs/ROADMAP.md`): a still diagram held over 3 s needs `hold` cues or `qa.allowFreeze`, and a dark ground must stay above limited-range luma 38 or declare `qa.allowBlack`.
- Render budget [U]: the 3D template measured 0.28–0.37 s/frame at 1080p and FFV1 at ~1.2 MiB/frame dithered, ~0.8 without (`engines/remotion/ENGINE.md`). Planning on 0.2–0.4 s/frame, 5,280 frames take roughly 18–35 minutes per 1080p render and ~4–6 GiB of mezzanine; check free disk. DOM frame cost on the iGPU is unmeasured.

## Not read
Not run on the reference host: DOM/SVG frame cost, large-DOM-text and CSS-shadow determinism, `HtmlInCanvas.isSupported()` in the headless shell, Chrome 157's ICU segmentation. Not read: anime.js v4 docs beyond the engine page (behaviour read from source), Motion Canvas time-events docs, Remotion Elements and their licence, the Smiley Sans and Source Han Sans licence files, `interpolateColors`' colour space, @dagrejs/graphlib's randomness, whether fontsource's Plex Sans slices keep the `tnum` feature. Not re-checked: the Remotion skills points, BudouX on technical terms, Code Hike snapshots at chunk starts, the glow cost ranking.
