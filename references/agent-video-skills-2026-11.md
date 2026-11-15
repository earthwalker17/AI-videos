# Agent skills and method sources for code-made explainer films (2026-11)

| | |
|---|---|
| Upstream | Skills: https://github.com/heygen-com/hyperframes (`skills/hyperframes/references/`, `.claude/skills/motion-doctrine`) · https://github.com/Tejashmakwana/motionmaxxing · https://github.com/anthropics/skills · https://github.com/pbakaus/impeccable · https://github.com/Vincentwei1021/anything2explainer · https://github.com/charlie947/motion-graphics-skills · https://github.com/bangtutorial/bang-motion. Methods: https://worrydream.com/LadderOfAbstraction/ · https://distill.pub/2020/communicating-with-interactive-articles/ · https://www.schoolofmotion.com/blog/guide-completing-motion-design-project · https://github.com/remotion-dev/github-unwrapped · https://github.com/helblazer811/ManimML · https://github.com/penrose/penrose. Tokens: https://github.com/androidx/androidx (Compose M3 tokens) · https://carbondesignsystem.com/elements/motion/overview/ · https://developer.apple.com/videos/play/wwdc2023/10158/ · https://www.joshwcomeau.com/css/designing-shadows/. List: https://github.com/zhuyansen/awesome-claude-video-skills |
| Pin | HyperFrames HEAD `070b964d7b8cd844a893f0abbe8e0b7f1ac6d879` (2026-11-08T14:01Z; npm 0.9.23). Other pins per row, read 2026-11-08; HEADs re-checked 2026-11-09. |
| Licence | Per row: Apache-2.0 (HyperFrames, motionmaxxing, impeccable, four anthropics/skills skills, Carbon, androidx), MIT, PolyForm Noncommercial 1.0.0 (anything2explainer), CC BY 4.0 (Distill), none (remotion-dev/skills, github-unwrapped, Victor), proprietary (GSAP bundled in two of them; vendor pages) |
| Accessed | 2026-11-08; re-checked 2026-11-09 where a bullet says so |
| Stale after | HyperFrames rows: 2026-11-22, as in `hyperframes.md` (it publishes several versions a day). Other skill repos: 2026-12-08. Method sources and motion tokens: 2027-05-01. |
| Excerpt policy | Apache-2.0 prose may be adapted with a `NOTICE.md` entry. PolyForm-NC and unlicensed sources: ideas only, never copied. GSAP code: never. |

## What it is
The agent skills and method sources found while reworking #4 V1's look, after its first
lookdev round passed the frame critic and was rejected by the user as too simple and crude.
It records what each source teaches about taste and craft (not engines: those are in
`hyperframes.md`, `remotion.md` and `motion-graphics-2d-2026-11.md`), its licence and our
verdict, and what the repo adopted: a finished-craft criterion for the critic, motion
tokens, and a lookdev method.

## Why it matters here
The repo's process skills (`make-video`, `render-verify`) cover routing, gates and the render
loop, not taste. The critic's greybox criterion was worded for 3D boxes and cones, so it
could not see round 1's failure: flat icon modules, identical parallel elements, straight
static connectors and a mostly empty dark field. The bar has to name what failed, and it
must fail the rejected stills before it is trusted on anything new.

## Key facts

**Stale pins corrected** [V]
- HyperFrames: `hyperframes.md` pinned npm 0.8.225 at `ee50cd2f` (re-pinned there in this round). Latest is **0.9.23** (published 2026-11-08T07:15Z, built from release commit `7ad2be96`); the skills were read at HEAD **`070b964d`**, three commits later with no skill-file changes between. On 2026-11-09 HEAD was `eb16510a`, one commit ahead, again no skill-file changes. The skill set has grown since 0.8.225.
- awesome-claude-video-skills: `multi-video-repos.md` pins `533c784c4f0f` (394 repos). It is now at **`6dbd11c4609a`** (2026-11-08, unchanged 2026-11-09), indexing 454 repos. GitHub's API reports NOASSERTION, but the LICENSE file dedicates the list itself to CC0 1.0 and says each listed project keeps its own licence (read 2026-11-09).
- remotion-dev/skills: HEAD `a2824c67f8b4` (2026-11-05) adds only a `remotion-license` skill and version bumps over the `30d4553e` pin in `remotion.md`.

**Agent skills** (licence from the LICENSE file, read 2026-11-08; HEADs and GitHub's licence detection re-checked 2026-11-09, and the motionmaxxing, anything2explainer, canvas-design and algorithmic-art licence files re-read) [V unless marked]

| Source, pin | Licence | What is genuinely useful | Verdict |
|---|---|---|---|
| heygen-com/hyperframes `070b964d` | Apache-2.0; its code examples use GSAP (proprietary) | The strongest find: the explainer type, the spec's BANNED list, "a look built from a medium", the stranger test, the motion doctrine (next group) | Adapt the prose with NOTICE; never the GSAP code |
| Tejashmakwana/motionmaxxing `8c8ec0f2` (2026-10-06) | Apache-2.0 plus a NOTICE file; bundles GSAP 3.12.5 under its own licence | `references/world.md` six world layers; `references/slop.md` "twelve reaches" | Adapt the checklist ideas with its NOTICE; not the runtime |
| anthropics/skills `2c5958ecac7c` (2026-11-06) | No repo-level licence; `canvas-design`, `algorithmic-art`, `frontend-design`, `theme-factory` each carry an Apache-2.0 `LICENSE.txt` | canvas-design: write a named visual philosophy first, end with a refinement pass that adds nothing and makes what exists crisper and more cohesive. algorithmic-art: seeded generators as a pattern for procedural material (hatching, engraving, fields) | Adopt the philosophy-then-refine pass (pattern) |
| pbakaus/impeccable `924bbd19` (2026-11-08) | Apache-2.0 | Its critique opens with a design-specificity verdict: authored for this subject, or interchangeable with anything in its category? The rest is web UI | Take the one question |
| Vincentwei1021/anything2explainer `735c79c8` (2026-09-18) | Custom notice plus PolyForm Noncommercial 1.0.0; commercial use of the toolkit needs the author's permission (API: NOASSERTION) | A bilingual Remotion explainer kit with numeric rules (next group) and a folder of good/bad contrast frames | Ideas only: the channel may be monetised |
| charlie947/motion-graphics-skills `229022eb` (2026-10-11) | MIT | `vox-explainer`: a lone bar or line crossing the screen reads as static; `reference-to-motion` keeps a reference for *moves* apart from one for *look* | Pattern only |
| bangtutorial/bang-motion `c1aa65e9` (2026-09-15) | MIT | In Indonesian. `references/anti-ppt.md` maps slide-like violations to fixes (text in and out under a still camera → change shot size toward what is speaking); `references/explainer.md`: a scene is 3–5 stacked elements, and assets must feel alive | Pattern only |

**HyperFrames skill references at `070b964d`** (files under `skills/hyperframes/references/`; re-read 2026-11-09) [V]
- `types/explainer.md`: one idea, spined on one concrete example worked start to finish. Devices: the object *is* the explanation (drawn with material and mount so it reads without a label); one diagram that grows, a part per beat as it is named; continuous transformation; a worked example that passes through every step. "Shapes of information" (a number that lands, a myth turned over, before/after, many converging into few, a network that densifies, one chosen of many, steps in order…): pick the shape before the picture, so similar lines get different pictures. Its tells: bullets, icons in circles, three cards in a row, the whole diagram at once.
- `spec.md`: turn every adjective into a number. **BANNED by default**, i.e. where generated video lands: a dark or navy void with small things floating in it; glow, bloom, neon, flares, orbs and rings, decorative particles; purple/blue or mesh gradients, glass cards; the cream-paper package (serif display, italic accents, "01 / 02" numbering, small mono caps, pill chips); everything centred, arriving at once, or fading and sliding up; text that moves while read, titles that drift after landing; decorative corner labels, borders, brackets and HUD; three cards in a row, KPI grids, a title over a dimmed screenshot; a corner logo. Each film keeps its own BANNED line and adds every default its first render used. Composition: the hero fills at least 40% of frame height or width; one hero move per shot; text floor 28 px at 1080.
- `spec.md`, "a look built from a medium": a look is the rules of one medium, listed as its parts, what each part may carry, and how the medium itself moves (ink is printed, paper is cut and lifted), not a palette.
- `review.md`: first describe each beat frame in one sentence as a stranger would, naming every object; an object you would have to explain is a P0. Then name every banned default on screen. Notes are ranked P0/P1/P2 as one line each.
- `look.md`: Inter, Space Grotesk, Instrument Serif, Geist and JetBrains Mono are "where generated design lands". Full-screen linear gradients on dark grounds band under H.264.
- `motion.md`: ease by role (arrivals on a long tail, camera both ways, exits accelerating); exits 40–50% shorter than entrances; the next element starts when the previous is 30–50% done; springs named by damping ratio (0.7–0.85 reads premium, 0.4–0.6 playful), with opacity and colour never bouncing; a landed title stays dead still; 0.3–0.75 s of hold before the payoff; breathing, floating and pulsing loops are a generated tell.
- `.claude/skills/motion-doctrine/SKILL.md` (marked `internal: true`): causal motion (the effect starts on the causing frame); carriers that hand the eye across beats; one dominant direction, with direction changes reserved for a visible cause; no idle wobble (motion must perform, not breathe); stillness before the climax.
- Skip `skills/style-sampling` and `skills/reverse-any-video`: both are HyperFrames Pro features checked against the account's plan, and both start with a usage beacon sent with the CLI's telemetry, account-linked when signed in.

> Quoted from https://github.com/heygen-com/hyperframes/blob/070b964d7b8cd844a893f0abbe8e0b7f1ac6d879/skills/hyperframes/references/review.md (accessed 2026-11-09): "Never score the film out of 10: a score finds nothing to fix."

**motionmaxxing at `8c8ec0f2`** [V, re-read 2026-11-09]
- `world.md`: a frame has six layers (ground, light, depth, texture, material, sound), each with a question and sources; a card on a flat colour has one of the six. One light logic and one lens per film. Its own aim: one focal point inside a built world.
- `slop.md`, the twelve reaches. Most relevant: #3 *states instead of events* (things appear and hold; nothing happens or causes anything); #8 *effects standing in for quality* (a new technique per beat to show range); #12 ***minimalism as a hiding place*** (a small element on a void, a lone line, long holds: restrained-looking, but nothing was risked or built).
- Bias: written for launch films with hard cuts, which conflicts with a single world without cuts [U].

> Quoted from https://github.com/Tejashmakwana/motionmaxxing/blob/8c8ec0f2a6f6c9a0da15cd24f7b1298ab298368c/references/slop.md (accessed 2026-11-09): "Where is the frame someone would screenshot?"

**anything2explainer rules** (ideas only; re-read 2026-11-09 in `SKILL.md` and `reference/agent-build-rules.md`) [V]
- One hero per shot, at least 170 px tall (or large type ≥ 96 px); size classes hero ≥ 170, supporting 60–110, labels 22–30 px.
- The largest object in the content area may not stay under 110 px for more than 45 frames.
- Longest stillness ≤ 3 s per shot and a 30–45 frame settle after the last element lands, measured by `template/scripts/motion_check.py`; no floating or breathing added to meet the numbers.
- One running example for the whole film; a "first 30 seconds" sample shown to the user before the other build groups start.
- All of this is set on a **1280×720** canvas (chapter slot = 1280 ÷ chapters; content x 60–1220). See Gotchas.

**Method sources and exemplary projects**

| Source, pin | Licence | Method | Use |
|---|---|---|---|
| Bret Victor, "Up and Down the Ladder of Abstraction" (2011) | None stated | Understanding comes from moving between levels: one concrete run; that run abstracted over time; varied over a parameter; varied over everything; and stepping back down to a concrete case [V 2026-11-08] | Ideas only: a spine for the narrative (one task traced, then many, then a parameter swept) |
| Distill, Hohman, Conlen, Heer, Chau, "Communicating with Interactive Articles" (2020-09-11, doi 10.23915/distill.00028) | CC BY 4.0 [V 2026-11-09] | Affordances including *making systems playful* (change a parameter, watch the model answer) and *reducing cognitive load* (overview plus detail on demand, labelled segments) [V 2026-11-08] | Quotable with attribution; "interactive" becomes parameter sweeps on screen |
| Studio pre-production | Proprietary pages | Idea → mood board → storyboard → **style frames** (start with a few frames, 2–3 variations) → **animatic** (timed boards that expose pacing before production) → production boards → feedback, then rough and final animation [V School of Motion guide, read 2026-11-09]. A **motion test** (one shot at final craft) as its own gate appears in studio blogs, not in that guide [S] | The repo had style frames (lookdev stills) but no animatic or motion tests |
| remotion-dev/github-unwrapped `ece8397d` (2026-04-06) | No LICENSE file | Heavy visual data is precomputed offline (`precompute-gradients.mjs`) and handed to compositions as props [V] | Ideas only: supports baking procedural texture and layout to JSON |
| helblazer811/ManimML `5e8f7cb6` (2023-11-04, dormant) | MIT | Animates a forward pass as activity flowing through an architecture [U] | Pattern for traffic through Router → Workers instead of static edges |
| penrose/penrose `d46d92b7` (2026-11-06) | MIT | Separates a diagram's substance from its style [U] | Concept: each entity class gets a systematic form; not at render time |

**Craft-token sources** (read 2026-11-08 by the research; numbers re-derived 2026-11-09)
- Compose M3 motion tokens, androidx `160825094a81` (2026-08-05) [V]: emphasized decelerate `(0.05, 0.7, 0.1, 1)`, emphasized accelerate `(0.3, 0, 0.8, 0.15)`, standard `(0.2, 0, 0, 1)`; expressive springs as damping ratio ζ and stiffness k: 0.8/380 default, 0.6/800 fast, 0.8/200 slow, 1/1600 effects.
- Carbon motion [V]: easings split by role (standard, entrance, exit) and mood (productive, expressive; expressive standard `(0.4, 0.14, 0.3, 1)`); durations 70–700 ms, i.e. 2–21 frames at 30 fps, which is UI scale and too short for film.
- Apple WWDC23 "Animate with springs": stiffness = (2π / duration)² [V]; ζ = 1 − bounce [S, transcript summary garbled]; bounce 0–0.15 reads smooth to brisk [V].
- Josh Comeau, "Designing beautiful shadows" [V]: one light source for the whole scene, a constant x : y offset ratio, 3–5 stacked layers, tinted with the ground's hue; with elevation, offset and blur grow while opacity drops.
- Remotion computes ζ = c / (2√(k·m)), so c = 2ζ√k at mass 1. Its default spring (c 10, k 100) is ζ 0.5, about 16% overshoot [V maths].

**Small libraries and API flagged by this research** (dates corrected from npm, 2026-11-09) [V]

| Item | Version, published | Licence | Note |
|---|---|---|---|
| perfect-arrows | 0.3.7, **2021-09-28** (not 2022) | MIT | Pure trig, no clock or random in the dist; curved connector arcs. A dependency decision |
| culori | 4.0.2, **2025-06-27** (not 2026-04-03) | MIT | OKLCH ramps; Remotion's `interpolateColors` blends gamma-encoded sRGB and rounds, muddy in dark fades |
| zdog | 1.1.3, **2022-01-22** (not 2022-05-25) | MIT in package.json; no LICENSE file in the repo | Optional pseudo-3D; chunk-start behaviour [U] |
| @carbon/motion | 11.56.0, 2026-11-04 | Apache-2.0 | Pattern only |
| Remotion 4.0.539 | pinned | Remotion License | `Easing.spring` exists (`easing.d.ts`); `interpolate` has `output: 'perceptual-scale'`, `posterize` and `outputType: 'font-weight'` (`interpolate.d.ts`), none yet used in the repo |

**Licence traps**

| Trap | Sources | Rule |
|---|---|---|
| No licence at all | remotion-dev/skills, github-unwrapped, PrimerTools, Victor's essays | Ideas only |
| Per-skill licences, none at repo level | anthropics/skills | Check each skill's `LICENSE.txt` |
| GSAP riding along | HyperFrames examples (incl. `cut-the-curve`), motionmaxxing runtime | Adapt prose, never the GSAP code |
| Non-commercial | anything2explainer (PolyForm NC 1.0.0) | Ideas only, paraphrased, nothing copied |
| Proprietary though public | imMamdouhaboammar/motion-graphics-skills `76da7e7e` ("all rights reserved") | Do not use |
| Paid tier and telemetry | HyperFrames `style-sampling`, `reverse-any-video` | Do not run |
| Attribution for adapted text | Apache prose from HyperFrames, motionmaxxing, anthropics/skills | `NOTICE.md` + `REUSE.toml` entries and a header on the adapted file; carry motionmaxxing's NOTICE |

## What we adopted / adapted
- **Frame-critic criterion 12, "Finished craft"** (`.claude/agents/frame-critic.md`), one merged rubric replacing two overlapping drafts (the craft checklist: 16 items, pass 26/32; and the skills strand's tells):
  - *P0, any one fails the frame:* tells (rings or boxes as nodes, pill chips, icons in circles, three equal cards or identical parallel modules, 0/45/90° or connect-only lines, dash or glyph lines for text, glow on lines or text, decorative particles, fade-and-slide-up entrances, idle wobble, text moving while read, rolling counters, white flashes, gold or amber on navy) [HyperFrames]; the **small-object rule** (no hero ≥ 170 px, or an object under 110 px is the largest content element for more than 45 frames, at 720p; the critic uses 255 px and 165 px at 1080p, Gotchas) [anything2explainer, idea]; **minimalism as a hiding place** [motionmaxxing]; the **stranger sentence** [HyperFrames]; **accuracy** (wrong built/proposed/open status, a number outside the facts).
  - *19 items scored 0–2*, pass at 30/38, a zero on a starred item fails: ★silhouettes, ★values, detail tiers, ★material, ★light, depth, ★relationships, choreography, easing, camera, ★type, composition, colour semantics, finish, genre distance, ★teaching, specificity [impeccable], ★world layers [motionmaxxing], worked example [HyperFrames explainer; Victor's ground level].
  - *Calibration gate:* before it is trusted on a new look it must fail the looks the user rejected (`.claude/agents/frame-critic.md`, Calibration). Its first run (2026-11-09) failed #4 V1's four rejected round-1 lookdev stills, at 14–16 of 38, each with P0 hits. Those stills were local render output and are gone; the critic's Calibration section is the record.
  - We score, against HyperFrames' advice (quote above), because calibration needs a threshold; the report still lists every P0 and the three fixes that raise the score most.
- **Motion tokens** for #4 V1 (V1 defined the springs in `src/desk/springs.ts` and used them across `src/desk/`, e.g. `src/desk/beat11.ts`, at tag `video/super-agent/v1-archived`; no shared home yet, promoted by the rule of two). Springs as `{stiffness, damping}`, mass 1:

| Token | ζ, k → Remotion config | Use |
|---|---|---|
| spring-settle | 0.8, 380 → `{380, 31.2}` (overshoot ≈ 1.5%) | Layout settles |
| spring-dock | 0.6, 800 → `{800, 33.9}` (≈ 9.5%) | Small cargo landing, nothing else |
| spring-heavy | 0.8, 200 → `{200, 22.6}` | Large masses |
| spring-detent | 0.9, 600 → `{600, 44.1}` | Detents, indexing |
| spring-effects | 1.0, 1600 → `{1600, 80}` | Light, opacity, colour (never bounce) |
| enter | `bezier(0.05, 0.7, 0.1, 1)`, 10–20 f | Arrivals |
| exit | `bezier(0.3, 0, 0.8, 0.15)`, 40–50% shorter than its entrance | Leaving |
| move | `bezier(0.2, 0, 0, 1)` | Moves on screen |
| camera | `bezier(0.65, 0, 0.35, 1)` [U] with `perceptual-scale`, 1–2 bars | Symmetric camera |

  - Rules: Remotion's default spring is banned; overlap 30–40% of the earlier move; stagger 2–3 f, at most 20 f per group; follow-through 2–4 f, labels trail their object by 2 f; 10–20 f of stillness before each climax; durations micro 5 f, entrance 10–20 f, structural change 40–80 f [U, about 1.5–2× UI durations]; life only from parts that are working, so notes and landed labels stay dead still and holds do not drift; shadows baked per state on Comeau's recipe, not animated blur.
- **Lookdev method** (home: `docs/PRODUCTION.md` and the `make-video` / `render-verify` skills): style frames of 2–3 *competing directions* at the same beat, each first written as a named philosophy and as the rules of one medium, filled to all six world layers, then given the refine-don't-add pass; then **motion tests** (a few seconds of a signature relationship move at final craft); then an **animatic** (stills and key poses timed on the cue sheet with the score). The user approves at each lock; this is also anything2explainer's first-30-seconds sample.
- **Per-film BANNED line** (proposed home: the film's `STORYBOARD.md`; V1 kept its list in `videos/super-agent/TREATMENT.md`, "BANNED (this film)", at tag `video/super-agent/v1-archived`): HyperFrames' defaults plus everything the first render used, growing with each review.
- **Attribution:** ideas restated in our words are credited here, as `NOTICE.md` says. Any repo file that keeps Apache-2.0 wording from HyperFrames, motionmaxxing or anthropics/skills needs a `NOTICE.md` and `REUSE.toml` entry and a file header; motionmaxxing's NOTICE travels with its text.

## What we deliberately did NOT adopt, and why
- Any GSAP code, HyperFrames' runtime and `cut-the-curve` code, the motionmaxxing runtime: proprietary GSAP, and not our engine.
- HyperFrames `style-sampling` / `reverse-any-video`: paid tier, account-linked usage beacon.
- The dark-void ban as an absolute: the user prefers dark grounds, so for us it reads "a dark ground must be built (light, texture, material), never a void".
- anything2explainer text, code and look (black ground, purple glow, star field are the genre's package); its 1.0 → 1.05 slow push to fill stillness, which contradicts "no drift on holds".
- The craft strand's 1–3% camera drift on every hold, breathing and hand wobble, and the tooling strand's bloom and decorative particles: the motion doctrine and the BANNED list forbid them; emission stays semantic.
- motionmaxxing's hard-cut launch-film grammar: it conflicts with a one-world film such as #4 V1; a film with cuts may take its grammar.
- remotion-dev/skills: nothing new, no licence. anthropics `theme-factory`: generic themes; `frontend-design` is web UI (already available as a plugin).
- Skipped as generic framework knowledge (a 2026-10-11 benchmark found such skills add nothing over a no-skill baseline [S]): adithya-s-k/manim_skill `cef04501`, yusuke710/manim-skill `a0048d9e` (both MIT), kylezantos/design-motion-principles `4a9ca879` (MIT, UI micro-interactions), ItsssssJack/claude-video-2 (MIT; one useful line: a shadow that tightens as a thing lands). MiyanoX/vibe-knowledge-video: no commits since `78cbecce`.
- D2, isoflow, excalidraw-animate (wrong look) and PrimerTools (no licence); imMamdouhaboammar/motion-graphics-skills (proprietary).

## Gotchas
- **anything2explainer's pixel thresholds are for 720p.** Scaled to 1080p, 170 px and 110 px become about 255 px and 165 px. ~~The critic adopted the raw numbers, which is 1.5× looser; whether to scale them is open [U].~~ Resolved 2026-11-09: the critic uses the scaled 255 px and 165 px (`.claude/agents/frame-critic.md`, criterion 12).
- The critic's P0 wording tracks HyperFrames' closely in places ("text that moves while it is read"). If it counts as adapted text, it needs the NOTICE entry; the safe reading is that it does [U].
- Overlap is stated two ways: HyperFrames starts the next element when the previous is 30–50% done (a deep overlap); the craft strand starts it at 60–75%. The token rules above take the craft side (overlap 30–40%, so the next move starts at 60–70%). Write the film's choice in frames.
- HyperFrames' text floor (28 px at 1080) is below the repo's (1/30 of frame height, 36 px at 1080p); the repo's wins. Its hero rule (≥ 40% of height or width) is stricter than 170 px.
- JetBrains Mono, #4 V1's first number face, is on HyperFrames' "generated" list; IBM Plex Mono matches Plex Sans [U]. IBM Plex Mono 5.3.0 replaced it on 2026-11-09 (`docs/ROADMAP.md`).
- HyperFrames publishes several versions a day (0.9.20 to 0.9.23 within about 20 hours): pin by commit and re-read before adapting any text.
- Motion tests need spans longer than 120 frames plus an encode and motion QA, which the tooling did not have when this was written. Since 2026-11-09 it has them: `aiv still --span --encode`, up to 240 frames, and `--inner` for the fresh-page check (`docs/ARCHITECTURE.md`, decision 31).
- anthropics/skills, awesome lists and GitHub's licence API all mislead in their own way: read the actual LICENSE file of the thing you take.

## Not read
Not read: HyperFrames `story.md`, `film.md`, `sound.md`, `storyboard.md`, the other `types/`, `cut-the-curve` and the seam-gate script (the motion doctrine only in part); motionmaxxing `slop.md` Parts 1–2 and `taste/`; anything2explainer `reference/composition-and-light.md`, `motion-vocabulary.md`, its contrast images and `motion_check.py` source; impeccable beyond `critique.md`; the bodies of the anthropics `algorithmic-art` and `frontend-design` skills after 2026-11-08; the Apple WWDC23 transcript itself. No primary source found for Bartosz Ciechanowski's process or for the motion test as a named studio gate. Not run: none of the libraries was installed or rendered; determinism verdicts come from reading source.
