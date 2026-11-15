# Render React Three Fiber under Remotion so every chunk start looks the same

Remotion renders a 3D scene one frame at a time, in chunks, and each chunk usually starts on
a fresh page. Anything that is built asynchronously, posed one frame late or cached from the
first frame drawn then makes a frame depend on where its chunk began: blank first frames,
unprocessed post effects, instances that vanish. The answer is to drive everything from the
frame index, before the frame is drawn, and to build every GPU resource synchronously.

## Method
1. **Pose before the advance.** While rendering, `@remotion/three`'s `ThreeCanvas` runs R3F
   with `frameloop: 'never'` and advances it once per frame, in a passive effect after React
   commits. Set poses in JSX props or in `useLayoutEffect`, which both land before that
   advance. `useEffect` runs after the frame was drawn, so the frame comes out one frame late.
   Never animate with `useFrame` or clock-driven helpers: their time is the wall clock.
2. **Build post-processing synchronously.** Create the `EffectComposer`, render pass and one
   merged effect pass in `useMemo`, size it in `useLayoutEffect`, and take over rendering with
   a priority-1 subscription that calls `composer.render(0)`. A delta of 0 means no effect can
   accumulate time; animate effects through uniforms set from the frame index.
3. **Tone-map once, last.** Render in HDR linear light (HalfFloat buffers), put the tone
   mapping effect at the end of the chain, and let the final pass encode sRGB.
4. **Dither the 8-bit output.** Dark gradients such as vignettes and fog band in 8 bits, and
   a platform re-encode makes the bands worse. A dither keyed to the pixel position (not to
   time) removes them and stays deterministic.
5. **Light without the network.** Prefilter a procedural environment (three's
   `RoomEnvironment` through a `PMREMGenerator`) once per renderer. HDRI presets fetched from
   a CDN at render time are pixels no input hash pins.
6. **Defeat first-frame caches.** Set `frustumCulled = false` on animated `InstancedMesh`es:
   three caches their bounding sphere from the first frame it draws.
7. **Capture lossless frames.** Take PNG frames, not JPEG, and convert to video once, in post.
8. **Test chunk starts for real.** A test is only valid if pages start on frames where the
   full run did not start one. Render a range whose first chunk is partial (for example
   frames 20-149 with 60-frame chunks) and compare its frame hashes with the full run.

## Evidence
Reference laptop (Windows 11, Intel UHD iGPU, `--gl=angle` on D3D11), Remotion 4.0.539,
three 0.186.1, R3F 9.8.2, postprocessing 6.39.5. The scene is the Remotion template: shadows,
a physical iridescent material, 168 animated instances, 4x MSAA HalfFloat composer, bloom,
vignette and dithering.
- Three fresh 960x540 renders gave identical per-frame RGBA hashes and byte-identical
  lossless mezzanines. Two fresh 1920x1080 renders did too.
- Frames 20-59 rendered on a page that started at frame 20 (where the 3D canvas first mounts)
  hashed the same as in the full run, where they came from a page that started at 0 and
  mounted the canvas at 15. A page started at 75 instead of 60 matched as well.
- An engine test renders animated instances with room light, shadows and bloom on pages that
  start at frames 0, 3 and 8: the shared frames hash the same.
- Without dithering, the vignette showed contour bands in the delivered mp4 at 3x gain. With
  it, an 8x-gain crop shows fine noise instead. The cost: the lossless mezzanine grew by
  about 30-50 %.
- Cost per 1080p frame, including PNG capture, decode and lossless encode: 0.28-0.37 s.

*A Halloween Gift* (three r186, R3F 9.8.2, postprocessing 6.39.5): depth of field, god rays,
a custom Kuwahara effect in its own PostChain stage and `onBeforeCompile` materials rendered
chunk-independent once the shadow box was fixed: 12 of 12 mid-chunk frames matched on fresh
pages, and the final equalled the review cut on 1,426 of 1,440 frames (the other 14 at chunk
starts: DOM canvases over the 3D frame, and a few dark pixels by one or two levels;
`docs/ROADMAP.md`, known gaps).

Not verified: WebGPU (`ThreeWebGPUCanvas`), renders on other GPUs or with `--gl=swangle`
locally.

## In this repo
`@aiv/remotion-kit` (`packages/remotion-kit`): `Stage3D`, `PostChain` (synchronous composer,
dithering on by default), `useRoomEnvironment`. The rules, measurements and engine details are
in [`engines/remotion/ENGINE.md`](../engines/remotion/ENGINE.md); `templates/remotion` is the
runnable example. The ESLint determinism block bans `useFrame` and clock helpers in frame code.

## Pitfalls
- `@react-three/postprocessing` assembles its composer after the first render, so the first
  frames of every chunk come out without effects (seen in *THE AI STACK*).
- In three r186 a material's `envMapIntensity` is ignored when its light comes only from
  `scene.environment`; give it its own `envMap` to change its intensity. The template's chrome
  looked matte until it did.
- A glossy floor mirrors a light placed behind the subject straight into the camera as haze.
- Remotion Studio runs R3F on a wall-clock loop, so it hides nondeterminism: check by
  rendering twice, not by watching the preview.
- Under ANGLE on D3D11, `pow(x, y)` with a negative `x` returns NaN; bloom spreads it until a
  whole frame turns black. Clamp the base (seen in *THE AI STACK*).
- A directional light's shadow box set through `shadow-camera-left/right/top/bottom` props takes
  effect only on the page's first frame: three updates the shadow camera's projection when the
  shadow map is created, and R3F does not on prop changes. A box that changes per shot then
  depends on where the chunk began (different shadows mid-chunk, a pop at chunk starts). Call
  `shadow.camera.updateProjectionMatrix()` in a layout effect when it changes (seen in
  *A Halloween Gift*, three r186, R3F 9.8.2; caught by `aiv still --check`).

### From #4 V1's lit world (2026-11; source at the tag)
Video #4 V1 (archived 2026-11-15 unpublished; three 0.186.1, postprocessing 6.39.5, 1080p, 6,720
frames) drew a lit desk world under DOM text; its final passed `aiv qa`. Its code is only at
tag `video/super-agent/v1-archived`; the paths below are under `videos/super-agent/src/desk/`
there.
- **NEUTRAL tone mapping crushes a dark palette.** three's `NeutralToneMapping` subtracts an
  offset before its shoulder: 0.04 above a channel minimum of 0.08, x − 6.25x² below it, so
  linear 0.015 comes out at 0.0014. A `PreToeEffect` just before the tone mapping adds that
  offset back; under the shoulder (peak 0.76) PreToe then NEUTRAL is the identity, and above it
  emitters still roll off. A test on JS mirrors of the two shaders holds nine palette colours
  equal to 9 decimals (`gl/post.ts:7-57`, `desk.test.ts:234-248`); the GLSL itself is not
  under that test.
- **One fixed light rig.** three keys its programs on light counts, so V1's world had one
  directional key and one hemisphere fill for the whole film; light pools and shadows were
  computed in every lit shader from uniforms set once per frame in a layout effect. No light was
  added or removed, so no light change recompiled a program (`DeskWorld.tsx:6-8, :62-68`,
  `pools.ts:1-5`). Other changes still can: the dissolve's veil compiled one new program on its
  first draw (`gl/veil.ts:24-25`).
- **Analytic footprint shadows instead of shadow maps.** Each caster registers a rounded
  rectangle, circle or capsule with the heights it spans; the shader sweeps it along the key
  (0.84·h, penumbra 4 + 0.35·h) and adds contact occlusion. There is no shadow box to depend on
  where a chunk began. The uniform arrays are bounded (160 footprints, 10 pools), shader loops
  run over the uniform counts, and a test keeps each of the 6,720 frames within 152 footprints
  (8 of headroom) (`footprints.ts:1-11, :29-30`, `gl/light.ts:8-9`, `desk.test.ts:627-642`).
- **A part's footprint stays under its own top face.** The shader shades a receiver below a
  footprint's top less 0.5 u, so at exactly the top the test is a coin flip that a spring's
  wobble turns over, and the part shades itself whole for those frames (in V1's drafts, a
  blink, a slip and a band). V1 ended such footprints 0.25 u under the top
  (`TOP_CLEAR`, `footprints.ts:57-74`).
- **A depth-writing punch erases what was drawn before it.** A pass with `depthFunc: Always`
  that writes depth (a hatch's punch, the dissolve's depth reset) wipes every part drawn
  earlier in its screen area. Draw the parts that stand over it after it, by `renderOrder`
  (`objects/Trace.tsx:338-346`, `objects/YourDesk.tsx:498-499`, `gl/veil.ts:14-22`).
- **Module-level uniforms survive a remount.** Uniform objects shared at module scope keep what
  earlier frames of the same page wrote into them. V1 reset them when a world mounts
  (`ResetShared`) and keyed the WebGL tree by segment, so a page that crosses a segment
  boundary draws what a fresh page starting there draws (`DeskWorld.tsx:45-60`,
  `FilmFrame.tsx:1-5`).
- **A swapped frame component remounts the world.** V1 drew each segment with its own keyed
  frame component (`FilmFrame.tsx:154-166`), so each boundary builds a new world. The full
  draft's motion QA flagged a pop at the f5400 seam (commit `49104cc`). The seam then moved to
  f5424, inside a stillness, with one camera, one print mode and unchanged labels across it
  (commit `b5f64a2`, `film.test.ts:120-128, :166-167`), and the final's motion QA found no pop.
  Put seams where nothing moves, with the same state on both sides.
- **Bloom that only emitters reach.** V1 set the bloom threshold at 1.0 linear and clamped
  every lit material's output to 0.95, so only emissive parts reached the threshold
  (`gl/materials.ts:10-14`, `gl/desk.ts:181`, `gl/post.ts:60`).
