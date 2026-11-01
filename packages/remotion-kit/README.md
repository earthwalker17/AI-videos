# @aiv/remotion-kit

Deterministic building blocks for Remotion compositions, rendered by the
[Remotion engine](../../engines/remotion/ENGINE.md). The kit is frame code, so the
determinism lint applies to it. It holds only what the template needs; promote more here by
the rule of two.

| Export | What |
|---|---|
| `Stage3D` | `@remotion/three`'s `ThreeCanvas`, set up for deterministic, colour-correct renders (see below). |
| `PostChain` | A postprocessing `EffectComposer` that is built synchronously and takes over rendering. |
| `useRoomEnvironment()` | Image-based light from three's procedural `RoomEnvironment`, prefiltered once (PMREM), with no network. |
| `TestCard`, `SwatchStrip` | The DOM test card and the `@aiv/core` swatch strip, laid out at the render size. |
| `Title`, `useInter()`, `INTER` | Text in Inter. Each frame is held until the font is loaded. |
| `useRenderScale()`, `useRenderSize()` | Output pixels per CSS pixel (0.5 for draft), and the output size. |

## Stage3D

`Stage3D` sizes the canvas to the composition in CSS px.
- **Resolution.** The drawing buffer is at the render scale: one canvas pixel per output
  pixel (960x540 for draft). It never uses the monitor's `devicePixelRatio`.
- **Colour.** Linear workflow: three's colour management is on and the output is sRGB.
- **Tone mapping.** The renderer tone-maps (ACES Filmic by default) unless a `PostChain`
  renders; the chain tone-maps in its last effect.
- **Shadows.** PCF shadow maps, on by default.
- **Opaque canvas.** The mezzanine has no alpha.

While rendering, `ThreeCanvas` runs R3F with `frameloop: 'never'`. It advances R3F once per
frame, in a passive effect after React has committed that frame. So:
- **pose in JSX props or `useLayoutEffect`**: both land before that advance;
- **never pose in `useEffect`**: it runs after the frame was drawn, so the frame is off by one;
- **never use `useFrame` or clock-driven drei helpers**. The lint bans them in frame code.

## PostChain

`@react-three/postprocessing` assembles its composer and adds its effects after the first
render. Under Remotion, the first frames of every page then come out blank or unprocessed
(THE AI STACK). Every chunk starts a fresh page, so that would hit every chunk boundary.

`PostChain` instead creates its parts in `useMemo`:
- the composer, with HalfFloat buffers and 4x MSAA;
- the render pass;
- one merged effect pass, with a `ToneMappingEffect` last. It dithers its 8-bit output by
  default (`dithering`). Without it, dark gradients such as a vignette or fog band, and
  YouTube's re-encode makes the bands worse. three's dither is a fixed hash of the pixel
  position (±0.5 code value), so it is the same in every render.

It sizes the composer in `useLayoutEffect` and renders from the very first R3F advance.

**Render takeover.** R3F hands rendering over through a priority subscription:
`useFrame(…, 1)`. That is the kit's one use of `useFrame`; the import carries the single
`eslint-disable` and its reason. The callback reads neither R3F's state nor its delta,
because both are wall-clock based. It calls `composer.render(0)`.

**Rules for effects:**
- Pass a **stable** `effects` factory (module scope or `useCallback`). A new function each
  render rebuilds the composer every frame.
- Effects get delta 0, so nothing may accumulate time. An effect that animates (noise,
  glitch, grain) needs a uniform set from `useCurrentFrame()`.

Verified (`engines/remotion/ENGINE.md`): in the template, frames 20-59 rendered on a page
that starts at 20, and frames 75-119 on a page that starts at 75, hash the same as in the
full run, whose pages start at 0 and 60. The engine test `adapter.test.ts` checks that each
chunk's first frame is drawn. It also renders a fixture with animated instances, room light,
shadows and bloom on pages that start at 0, 3 and 8, and checks that the shared frames hash
the same.

## Lessons from THE AI STACK, encoded here

- **Build the post chain synchronously.** That is `PostChain`.
- **Memoize heavy resources.** An unmemoized environment re-captures every frame.
  `useRoomEnvironment` builds once per renderer. Geometries and materials that are not JSX
  should be made in `useMemo`, as the template's `Bars` does.
- **Clamp `pow()` bases in custom shaders.** Under ANGLE/D3D11, `pow(x, y)` with a
  possibly negative `x` returns NaN at rare poses. Bloom then spreads it, and a whole frame
  went black at full resolution only. Write `pow(max(x, 0.0), y)` (or `abs`, if the sign is
  meaningless).
- **Depth of field.** When a DoF effect is added, copy the camera's near, far and focal
  settings into it every frame (from the frame-posed camera). Objects that are transparent
  without depth writes get blurred as if they were background: give them depth writes or
  keep them out of the DoF pass.
- **InstancedMesh culling.** three caches an `InstancedMesh`'s bounding sphere from the
  first frame it draws. Set `frustumCulled={false}` on animated instances, or a frame
  depends on where its chunk started.

## Found while building the template

- **`envMapIntensity` does nothing under `scene.environment`.** For a standard or physical
  material without an `envMap` of its own, three (r186) uses `scene.environmentIntensity` and
  ignores the material's `envMapIntensity`. To make one object reflect more than the rest,
  for example chrome, pass `useRoomEnvironment()`'s texture as its `envMap`, with its own
  intensity. The template's crystal looked matte grey until it did this.
- **Mind what a glossy floor mirrors.** A light placed behind the subject, such as a rim
  light, is reflected straight at the camera by a glossy floor and washes the frame in haze.

## Fonts

Inter comes from the pinned `@fontsource-variable/inter` package (SIL OFL 1.1), imported as a
file URL through Remotion's bundler. It is registered with `FontFace` under the family
`"AIV Inter"`, a name no system font has, so a fallback face cannot pass for it.
`useInter()` holds the frame with `delayRender` until the face is loaded and usable. A failed
load cancels the render.
