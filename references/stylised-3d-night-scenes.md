# Stylised 3D night scenes — painterly look, atmosphere, procedural assets, motion (2026-11)

| | |
|---|---|
| Upstream | https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders/ · https://github.com/GarrettGunnell/Post-Processing · https://diglib.eg.org/handle/10.2312/CGF.v28i7pp1955-1963 · https://github.com/simondevyoutube/ThreeJS_Tutorial_Fog · https://github.com/pmndrs/postprocessing · https://github.com/mrdoob/three.js (examples/jsm/generators) · https://github.com/dgreenheck/ez-tree · https://github.com/simondevyoutube/Quick_Grass · https://theasc.com/article/nightmare-before-christmas/ |
| Pin | three 0.186.1 (`examples/jsm/generators/TreeGenerator.js`, 371 lines, read in the installed package) · postprocessing 6.39.5 (`GodRaysEffect` present in the installed build) · articles and repos as accessed |
| Licence | three: MIT · postprocessing: Zlib · Acerola Post-Processing: MIT [S] · SimonDev fog/grass: MIT [S] · ez-tree: MIT [S] · Heckel's articles: no code licence found (ideas only) · Shadertoy: unlicensed by default (ideas only) |
| Accessed | 2026-11-04 |
| Stale after | 2027-05-01 (techniques move slowly); re-check licences before adapting any code |

## What it is
The techniques researched for the V2 picture of *A Halloween Gift*: making procedural 3D read
as a painted storybook night (painterly post, rim light, height fog, god rays), building its
assets in code (trees, grass, terrain, iron, stone, cloth, bats), and the art-direction and
motion principles behind smooth, storybook-like films.

## Why it matters here
A painted reference cannot be matched by flat cut-paper cards. The renderer is three.js under
Remotion on a laptop iGPU, every frame a pure function of its index, no network and no image
files: each technique below is judged against those constraints.

## Key facts
**Painterly post** 
- Generalised and anisotropic Kuwahara filters (Kyprianidis et al. 2009) give an oil-paint
  look; the anisotropic form needs a structure-tensor pass (Sobel, blur) before the filter, so it
  is a multi-pass effect, not a single merged effect [V, paper and Heckel's article].
- Heckel builds it as a custom pass in R3F, kernel size about 6, and replaces Gaussian sector
  weights by polynomial weights for speed; his code is inline in the article with no licence
  [V, article 2024-10-29].
- Acerola's Post-Processing repo (Unity HLSL) has basic, generalised and anisotropic Kuwahara
  with polynomial weighting [S: licence reported MIT, not re-read].
- Cost at 1080p on an Ice Lake iGPU: estimated 100–300 ms per frame at radius 6, about a
  quarter at half resolution [U, estimate].
- Temporal behaviour: a pure function of its input, but it amplifies input aliasing (twigs,
  fine noise, dither) into shimmer on camera moves; judge it on motion, not stills [U].
- LYGIA's kuwahara is under the Prosperity licence (non-commercial): avoid [S].

**Light and atmosphere**
- Rim light: add `pow(max(1 − N·V, 0), p)` weighted by how much the surface faces away from
  the moon to the outgoing light, in an `onBeforeCompile` patch of `MeshStandardMaterial`
  (or three-custom-shader-material, MIT) [S]. Clamp the base: a negative `pow` base is NaN under
  ANGLE (`knowledge/r3f-under-remotion.md`).
- Height fog: SimonDev's tutorial replaces three's fog shader chunks with an exponential
  height-fog integral distorted by fbm noise, about 30 lines [S]. Its world position must come
  from the transformed vertex including `instanceMatrix` and any wind displacement, or
  instanced grass fogs as if it stood at the mesh origin [U]. Global `ShaderChunk` edits depend
  on import order: inject per material instead [U].
- `onBeforeCompile` pitfalls: three's default `customProgramCacheKey()` is the callback's
  source text, so closures injecting different GLSL share one program; uniforms created inside
  the callback go stale on recompiles (a light mounting or unmounting triggers one) [U, from
  three's source behaviour].
- God rays: postprocessing's `GodRaysEffect` still exists in 6.x; its light source must be a
  `Mesh`/`Points` (it forces `transparent` and no depth writes); defaults 60 samples at half
  resolution [V, installed build + upstream source].
- WebGPU/TSL fog nodes (`exponentialHeightFogFactor`, r186 volumetric demo) are WebGPU-only:
  not for this renderer [S].
- Soft fog sprites: fade by scene depth minus sprite depth; drei `<Cloud>` fetches its default
  texture from a CDN at runtime (banned here) [V, drei source].
- Pumpkin and lamp glows: additive camera-facing quads with a radial falloff plus mipmap bloom.

**Procedural assets**
- three 0.186.1 ships `examples/jsm/generators/TreeGenerator.js` (MIT): parallel-transport
  tubes, pipe-model forks, golden-angle roll, droop, root flare, a seeded generator; output is
  position and normal (no UVs); only its material imports `three/webgpu`/`three/tsl` [V, read in
  the installed package]. `TerrainGenerator.js` sits beside it.
- ez-tree 1.1.0 (MIT) has per-level gnarliness/twist, a force vector, a seeded RNG, no texture
  loader; 10–40k triangles a tree [S].
- Geometric grass blades (≈7 vertices, no alpha) in one instanced draw: 50k blades ≈ 350k
  vertices, cheap offline; split into tiles so they can cull [S/U].
- `ExtrudeGeometry` caps are earcut triangles without interior vertices: displace in the
  fragment shader (bump), not by moving vertices [V, three source behaviour].
- Bats read as bats when the wing has finger bones (digits 2–5), a membrane between arm and
  fingertips with a sagging, scalloped trailing edge, ears and a fast downstroke / folded
  upstroke [S].

**Art direction** 
- *The Nightmare Before Christmas* (Kozachik, ASC): separate depth planes by value and hard
  light, not colour; scrims "milk out" the distant blacks; practicals are dimmed with the
  performance; every camera move should be one a real dolly crew could do [V, ASC article].
- *Room on the Broom* (Magic Light): one early colour script drove the whole film; miniature
  sets extended as matte paintings kept a handmade texture [S].
- *Corpse Bride*: two palette logics for two worlds, a model for the warm-to-cold snap [S].
- *Over the Garden Wall*: heavy blacks that still read bright; glazing and chromolithograph
  influences [S].
- *Wolfwalkers*: each world has its own visual language; painted backgrounds mapped onto flat
  planes stay painterly [S].
- Disney's *Legend of Sleepy Hollow* (1949): a book opens onto a map and the camera travels into
  the story in one journey, then the book closes — the model for a continuous storybook film [S].
- Disney's *Trick or Treat* (1952) has a witch at a doorstep: avoid echoing its gags [S].

**Motion**
- Judder: a camera moving on ones over a character stepping on twos makes the character
  stutter against the background. Keep root motion and camera on ones (or everything on ones)
  [S: Spider-Verse practice; verified here on V1 of *A Halloween Gift*, see
  `knowledge/motion-cadence.md` once written].
- Stride matching: drive a gait from distance travelled, keep the planted foot fixed; easing
  belongs on the root's travel [S].
- Camera follow: aim at a smoothed target (critically damped, or a centred average), ignore the
  bob, keep sub-pixel precision [S].

## What we adopted / adapted
- Our own anisotropic Kuwahara written from the paper, optional and judged on motion.
- Rim light and height fog injected per material (`storybookMaterial`), with a per-variant
  program cache key and module-scope uniforms.
- `GodRaysEffect` from a moon disc mesh.
- A tree generator adapted from three's MIT `TreeGenerator.js` (geometry only, with UVs and
  Rackham curls added), credited in `NOTICE.md`.
- Instanced geometric grass in tiles; fragment bumps on extruded stones.
- Principles only from the films above.

## What we deliberately did NOT adopt, and why
- LYGIA (non-commercial licence), Shadertoy code (no licence by default), Heckel's inline code
  (no licence): ideas only.
- three-good-godrays (tested to three 0.182, no licence field), WebGPU fog nodes, drei `Cloud`
  (network texture), brush-stroke particle renderers (strokes pop between frames).
- ez-tree as a dependency: three's own generator covers it without a new pin.

## Gotchas
- Judge painterly filters and fine detail on frame sequences, never on stills alone.
- Every time-driven uniform comes from the frame index; postprocessing effects that keep their
  own clock (Noise, Glitch) or seed with `Math.random` (SSAO, NoiseTexture) are banned.
- One convolution effect per merged `EffectPass`; an effect's `update()` reads the pass input,
  so order in a merged pass is not processing order.

## Not read
- Acerola's licence file, SimonDev's repos and ez-tree's source at a pin (reported, not read).
- Coraline/Laika lighting at a primary source (lead: Kozachik, *American Cinematographer*, Feb 2009).
