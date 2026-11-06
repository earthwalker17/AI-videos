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

Not verified: WebGPU (`ThreeWebGPUCanvas`), depth of field, custom shaders beyond the
built-in effects, renders on other GPUs or with `--gl=swangle` locally.

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
