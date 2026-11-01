# Make every frame a pure function of its index

A video rendered in chunks, resumed after a crash, or re-rendered next month must produce
the same pixels for the same frame. That only holds if nothing but the frame index (and the
inputs) decides what a frame shows.

## Method
1. **Time comes from the index.** `t = i / fps`. No wall clock (`Date.now`, `performance.now`),
   no timers or `requestAnimationFrame`, no engine clocks (`THREE.Clock`, `useFrame` deltas),
   no helpers that animate on their own clock (drei `Float`, `Sparkles`, `CameraShake`, …).
2. **Randomness is stateless and seeded**: `rand(seed, id, k)` hashes its arguments, so any
   frame can be rendered alone, in any order. A sequential generator breaks the moment a
   render starts mid-way.
3. **No state carried between frames.** Pose everything from `i` every frame. Beware lazy
   caches: three.js `InstancedMesh` computes its bounding sphere from the first frame it
   renders and culls with it afterwards, so moving instances vanish depending on where a
   chunk starts. Set `frustumCulled = false` on them.
4. **Enforce it.** A lint ban list catches most leaks, including aliases
   (`const r = Math.random`) and `crypto.getRandomValues`. The capture page proves the rest at
   start-up: it renders a frame, renders another, renders the first again and requires
   identical pixels.
5. **Hash every frame** (SHA-256 of the RGBA) and key resumable renders to a hash of their
   inputs (sources, shared code, engine, settings, lockfile). A resume against changed inputs
   must refuse, or stale chunks survive the edit.
6. **Make containers reproducible too.** Matroska writes a random segment UID and the muxing
   date unless told otherwise (`-fflags +bitexact -flags:v +bitexact`).

## Evidence
On the reference laptop (Windows 11, Intel UHD iGPU, Chrome for Testing 156) with the web
template (150 frames, three.js WebGL scene, Canvas 2D text):
- Two fresh draft renders, the second after deleting the browser profile (cold shader cache),
  gave identical SHA-256 for all 150 frames.
- A render stopped by its time budget, refused after a source edit, and resumed after the
  edit was undone matched the uninterrupted render frame for frame.
- With bit-exact Matroska, two fresh 1080p renders gave byte-identical mezzanines, delivery
  mp4s and archive masters.
- The lint ban list was tested against five bypasses (aliased `Math.random`,
  `crypto.getRandomValues`, bare `Date()`, `window.setTimeout`, `performance.timeOrigin`);
  all are caught.

Not verified: determinism across machines or GPUs (compare with SSIM there, not bytes).

## In this repo
`@aiv/core` (`rng.ts`, `easing.ts`), the ESLint frame-code block in `eslint.config.js`, the
page runtime's warm-up and purity probe (`engines/web/src/page`), the input hash and resume
logic (`packages/pipeline/src/runner`), and the encode presets (`packages/pipeline/src/media/presets.ts`).

## Pitfalls
- A determinism bug often shows only at chunk boundaries: compare a render that starts
  mid-way (`--frames a-b`) with the same frames of a full render.
- Compare frame hashes, not container hashes, unless the muxer is bit-exact.
