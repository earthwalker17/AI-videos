# 3D Concept Visualizations

> See the mechanism. Complex technical systems (LLMs, diffusion and video models,
> world models, embodied AI, robotics) explained as physical, spatial machines.

Status: active · First video: [THE AI STACK](../../videos/the-ai-stack/README.md)

[#4 *Who Routes the Agents?*](../../videos/super-agent/README.md) was made under this series from
2026-11-16 and released in [`science-explainers`](../science-explainers/SERIES.md) on 2026-11-18:
it explains one published design and weighs its evidence, which is that series' promise. What
its recipe confirmed is recorded there.

## Promise
A viewer who has heard the words ("attention", "denoising", "policy", "latent")
leaves with a picture of *how the thing works* — what moves, in what order, and why
it produces the result. Not hype, not a slideshow of buzzwords.

## Editorial principles
- **One mechanism per shot.** Each shot answers one "how" question. If a shot needs
  two captions to explain, it is two shots.
- **A consistent physical metaphor.** Choose what tokens, vectors, weights or
  gradients *are* in this world (objects, light, fluid, architecture) and never
  silently change it mid-video.
- **The camera explains.** Moves reveal cause and effect: push in to enter a
  mechanism, pull out to show its consequence, track along data flow. No decorative
  orbits.
- **Faithful to the real system.** Visual simplifications are allowed; false
  mechanisms are not. Anything that encodes a factual claim (sizes, orders of
  magnitude, steps of an algorithm) is sourced in `FACTS.md`.
- **Meaningful glow only.** Emission, particles and colour carry information
  (activation, flow, attention weight). Ambient sparkle that means nothing is cut.
- **Scale cues.** Show the magnitude (layers, parameters, tokens, FLOPs, watts)
  against something legible.

## Typical arc (hypothesis)
Hook with the phenomenon → enter the system → step through the mechanism at the
speed of understanding → zoom out to what it enables or costs → a recap image that
compresses the whole video into one frame.

## Craft hypotheses (to confirm with the next videos)
- Engines: Remotion + React Three Fiber for composited 3D with typography
  (THE AI STACK precedent); the web engine for heavy WebGL/WebGPU scenes.
- Look: clean studio materials, restrained palette with one information colour,
  depth of field and bloom used sparingly and deterministically.
- Sound: procedural or code-composed score; narration optional (THE AI STACK had
  none).
- Length: 4–10 minutes, 16:9, 30 fps.

## Policies
- Facts standard: every technical claim in narration or on-screen text is sourced
  (papers, official docs) in `FACTS.md` + `sources.jsonl` before `locked`.
- A film here that explains someone else's published design follows
  [`science-explainers`](../science-explainers/SERIES.md)' rules for it (built, proposed and
  open said on screen; caveats before numbers; no third-party marks), or belongs there.
- Generative AI: allowed for textures and plates, never as a depiction of how a
  system actually works.
- Lessons that already apply: see the R3F-under-Remotion gotchas in
  `knowledge/` (sync-built postprocessing, memoized environments, clamped `pow`).

## Reusable resources
Indexed in `docs/INDEX.md` once videos in this series declare `reusable` items.
