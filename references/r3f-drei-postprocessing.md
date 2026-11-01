# React Three Fiber, drei, postprocessing — pins and determinism

| | |
|---|---|
| Upstream | https://github.com/pmndrs/react-three-fiber · https://github.com/pmndrs/drei · https://github.com/pmndrs/postprocessing · https://github.com/pmndrs/react-postprocessing · https://github.com/mrdoob/three.js |
| Pin | three 0.186.1 · @react-three/fiber 9.8.2 · @react-three/drei 10.7.9 (source read at `bf6f4addf47467d3885de272d94ca5127f6ef68f`) · @react-three/postprocessing 3.2.2 · postprocessing 6.39.5 · react 19.3.1 · three.js manual at tag r187 (`456a78fd22f4ce11d929fd62c8579b83be06008a`) |
| Licence | three, R3F, drei, @react-three/postprocessing: MIT · postprocessing: Zlib |
| Accessed | 2026-11-01 |
| Stale after | When postprocessing widens its three peer range, R3F 10 goes stable, React 19.4 ships, or 2026-12-01, whichever comes first. |

## What it is
The 3D stack under Remotion's `@remotion/three` (and usable on its own in web pages):
three.js, the React renderer R3F, the drei helper library, and the pmndrs post-processing
stack.

## Why it matters here
Its peer ranges fix our pins, and several popular helpers read the wall clock or
`Math.random`, which breaks "a frame is a pure function of its index".

## Key facts
**Peer constraints** (npm registry, 2026-11-01) [V]
- postprocessing 6.39.5 (latest 6.x, 2026-09-09; 7.x only alpha/beta) declares peer three `>= 0.168.0 < 0.187.0`. three `latest` is 0.187.0 (2026-10-30). So three stays on **0.186.1** (`@types/three` 0.186.0).
- @react-three/postprocessing 3.2.2 needs postprocessing ^6.36.0 and R3F ≥ 9.7.0.
- R3F 9.8.2 (2026-10-15) peers react `>=19 <19.4`; 9.8.0 added React 19.3 support. drei 10.7.9 peers R3F ^9 and React ^19.
- A real October 2026 Remotion + R3F film uses the same set (three 0.186.1, R3F 9.8.1, drei 10.7.9, postprocessing 6.39.5); that repo has no licence, so ideas only.
- Remotion's internal catalog is more conservative (three 0.178.0, R3F 9.2.0, React 19.3.1).

**R3F 10 and WebGPU** [V unless marked]
- R3F v10.0.0-alpha.6 (2026-10-17) makes `WebGPURenderer` the default `<Canvas>`, moves WebGL to `@react-three/fiber/legacy`, and throws if `gl={…}` is passed to the default import.
- `@remotion/three` imports the default Canvas, so an R3F 10 drift would silently switch to WebGPU and break GLSL-based drei and postprocessing [U].
- The three.js r187 manual still calls WebGPURenderer experimental; ShaderMaterial, RawShaderMaterial, `onBeforeCompile` and `EffectComposer` are unsupported on it and need TSL node materials and the new post stack; `forceWebGL: true` forces the WebGL2 fallback.
- TSL `time` / `deltaTime` nodes read `performance.now()`: never use them in anything that renders (from MAP; see `map-of-middle-earth.md`) [V].

**Nondeterministic drei helpers** (grep of `src/core` at `bf6f4add` for `clock.elapsedTime`, `delta`, `Math.random`) [V]
`Float`, `Sparkles`, `Stars`, `Cloud`, `MeshDistortMaterial`, `MeshWobbleMaterial`, `CameraShake`, `useAnimations` (calls `mixer.update(delta)`), `AccumulativeShadows` (random, frame-accumulated), `Trail`. Plus R3F `useFrame` for animation.

**Deterministic replacements** [V as practice; design ours]
- Every motion is a pure function of `frame` / `fps` (`useCurrentFrame()` under Remotion; the frame index under `engines/web`).
- Seeded randomness: Remotion `random(seed)` or our `@aiv/core` rng; never `Math.random`.
- Animation mixers: `mixer.setTime(frame / fps)` instead of `update(delta)`.
- Float/particles/camera shake re-implemented from frame-derived values; camera rigs from `interpolate()` and `CatmullRomCurve3`.
- Time-based effects (noise, glitch, film grain) driven by frame-derived uniforms.
- For asynchronously fed textures under Remotion, the docs say to advance the canvas rather than `invalidate()`.

**Sequencing tools** [V]: Theatre.js is effectively stalled (last public commit 2024-04-11 with a "1.0 moved private" notice; npm 0.7.2 from 2024-05; `@theatre/r3f` peers R3F ^8; `@theatre/studio` is AGPL-3.0-only). `@remotion/gsap` seeks a paused GSAP timeline per frame, but GSAP is proprietary.

**Pixels across machines** [V]: ANGLE backends differ (D3D11 on Intel vs SwiftShader vs Vulkan), so frames are not bit-identical across hosts; same-host renders can be.

## What we adopted / adapted
- Catalog pins exactly as above in the root `pnpm-workspace.yaml` (with the reason written next to them).
- ESLint determinism rules in `packages/core/src`, `engines/web/src/page`, `templates/*/src`, `videos/*/src`: ban `useFrame`, `Date.now`, `performance.now`, `Math.random`, timers and the clock-driven drei helpers.
- `@aiv/remotion-kit` `Stage3D` (synchronously built postprocessing, title, swatch strip) over `<ThreeCanvas>`.
- Determinism contract: decoded-frame sha256 identical on the same host; SSIM only across hosts.
- WebGL as the default 3D path; WebGPU/TSL only as an isolated, opt-in module when a video needs it.

## What we deliberately did NOT adopt, and why
- three 0.187: breaks the postprocessing peer range.
- R3F 10 alpha, React 19.4: outside the peer ranges of the stack we use.
- The drei helpers listed above, and `useFrame`-driven animation.
- Theatre.js: stalled, R3F 8 only, AGPL studio.
- GSAP in reusable components (fine inside a single video if documented; see `hyperframes.md`).

## Gotchas
- Renovate/Dependabot will propose three 0.187.0 and React 19.4: reject until the peers move.
- Studio preview runs `frameloop='always'`, so clock-driven code looks correct there and only fails in renders (especially with concurrency > 1).
- `<ThreeCanvas>` needs explicit width/height and `layout="none"` on inner Sequences.
- lemo-opuscar's `core/three/post.js` was written for three 0.170 addons (EffectComposer, GTAOPass, UnrealBloomPass, OutputPass): re-test imports at 0.186 before reusing it; its DOF assumes a perspective camera.
- Clamp before `pow()` in custom shaders: a negative base gives NaN (the cause of a bloom blackout in THE AI STACK, per MAP's notes).

## Not read
drei folders outside `src/core` (e.g. web/ helpers) were not scanned; effects inside postprocessing / @react-three/postprocessing that use time uniforms (noise, glitch) were not audited; `@react-three/rapier` or other physics (would need a fixed-step, seeded audit).
