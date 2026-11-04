# @aiv/remotion-kit

Deterministic building blocks for Remotion compositions, rendered by the
[Remotion engine](../../engines/remotion/ENGINE.md). The kit is frame code, so the
determinism lint applies to it. It holds only what the template needs; promote more here by
the rule of two.

| Export | What |
|---|---|
| `Stage3D` | `@remotion/three`'s `ThreeCanvas`, set up for deterministic, colour-correct renders (see below). |
| `PostChain` | A postprocessing `EffectComposer` that is built synchronously and takes over rendering, with optional ordered effect stages and custom passes. |
| `useRoomEnvironment()` | Image-based light from three's procedural `RoomEnvironment`, prefiltered once (PMREM), with no network. |
| `TestCard`, `SwatchStrip` | The DOM test card and the `@aiv/core` swatch strip, laid out at the render size. |
| `Title`, `useInter()`, `INTER` | Text in Inter. Each frame is held until the font is loaded. |
| `useFont(spec)`, `loadFont(spec)` | Any other font, from its files and the film's strings. Each frame is held until the font is loaded, and the render fails if the font lacks a character (see [Fonts](#fonts)). |
| `textCanvas(w, h)`, `textContext(canvas)`, `fillTextChecked(g, text, x, y)` | Text in a 2D canvas that rasters the same in every render: a CPU canvas, and a `fillText` that throws while a face it needs is still loading (see [Canvas text](#canvas-text)). |
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

`PostChain` instead creates its parts in `useMemo` (`buildPostChain`), in this order:
- the composer, with HalfFloat buffers and 4x MSAA;
- the render pass;
- the optional custom `passes` (below);
- one effect pass per entry of the optional `stages` (below);
- the last effect pass: the `effects`, a `ToneMappingEffect`, then the optional
  `afterToneMapping` effects. It dithers its 8-bit output by default (`dithering`). Without
  it, dark gradients such as a vignette or fog show banding in 8 bits, and YouTube's
  re-encode makes the bands worse. three's dither is a fixed hash of the pixel position
  (±0.5 code value), so it is the same in every render.

It sizes the composer in `useLayoutEffect` and renders from the very first R3F advance.
Without `stages` and `passes`, the chain is the render pass and the one merged pass, as it
was before they existed: the template renders the same frame hashes with and without the
change that added them.

**Render takeover.** R3F hands rendering over through a priority subscription:
`useFrame(…, 1)`. That is the kit's one use of `useFrame`; the import carries the single
`eslint-disable` and its reason. The callback reads neither R3F's state nor its delta,
because both are wall-clock based. It calls `composer.render(0)`.

**Rules for effects:**
- Pass **stable** `effects`, `stages`, `passes` and `afterToneMapping` factories (module
  scope, `useMemo` or `useCallback`). A new function each render rebuilds the composer every
  frame.
- Effects get delta 0, so nothing may accumulate time. An effect that animates (noise,
  glitch, grain) needs its time from the frame: a uniform set from `useCurrentFrame()`, or
  the `time` prop (below).
- **One convolution effect per stage.** postprocessing merges a pass's effects into one
  shader and throws `Convolution effects cannot be merged` when it holds two effects that
  sample neighbouring pixels. In postprocessing 6.39.5 those are `ChromaticAberrationEffect`,
  `SMAAEffect`, `BokehEffect` and `RealisticBokehEffect`, plus any custom effect with
  `EffectAttribute.CONVOLUTION`. An effect that moves the image (a `mainUv` shader) cannot
  share a stage with one either. `PostChain` checks both before it builds a pass and names
  the effects and the stage; put the second effect in a stage of its own.

**Ordering inside one pass.** postprocessing sorts a pass's effects by their attributes,
highest first (`EffectPass.setEffects`: `effects.sort((a, b) => b.attributes - a.attributes)`;
the sort is stable): `CONVOLUTION` (2) before `DEPTH` (1) before `NONE` (0), whatever the order
of the list. And every effect of a pass samples the pass's input, not the previous effect's
output. So inside one pass a painterly filter (Kuwahara, a convolution) would run first, on the
raw scene, and the depth of field and bloom would never reach it. `stageOrder(effects)` in
`src/effectOrder.ts` gives the order a pass will run (the tests use it; the package does not
export it).

**`stages`.** `stages: (camera) => Effect[][]`. Each inner array becomes its own
`EffectPass`, in order, after the render pass and the custom passes and before the last pass.
A stage sees the previous stage's output; an empty stage is skipped. Stages run in HDR linear
light: they write the composer's HalfFloat buffers, with no tone mapping, no sRGB encode and
no dither (only the last pass dithers and draws to the canvas). For example, focus and glow
first, then the painterly filter on their result, then the grade:

```tsx
const stages = (camera: Camera) => [[new DepthOfFieldEffect(camera, dofOptions), new BloomEffect(bloomOptions)], [new Kuwahara()]];
const effects = () => [new Grade()];
<PostChain stages={stages} effects={effects} afterToneMapping={grain} />;
```

**`passes`.** `passes: (camera) => Pass[]` are custom passes, for a filter that needs render
targets of its own (an anisotropic Kuwahara: structure tensor, blur, filter). They run right
after the render pass, before the stages, in order. The composer initializes them and calls
their `setSize`; they get delta 0 and do not get the `time` prop, so they take their time from
the frame through their own uniforms. `PostChain` gives only the last pass `renderToScreen`,
even when a custom pass was built with it.

The order of the whole chain is therefore render pass → `passes` → `stages` → `effects` →
tone mapping → `afterToneMapping` → sRGB encode → dither.

Not yet verified by a render: `stages` and `passes` are checked by `PostChain.test.ts`, which
builds chains against a stand-in renderer and checks the passes, their order, their effects,
dithering and `renderToScreen`, not pixels.

**`afterToneMapping`.** Effects that must act on display values (film grain, a paper
texture, a final colour wash) run after the `ToneMappingEffect`, in the last pass. They see
tone-mapped linear values in [0, 1], before the sRGB encode and the dither. postprocessing
sorts a pass's effects by their attributes, highest first (`EffectPass.setEffects`:
`effects.sort((a, b) => b.attributes - a.attributes)`; the sort is stable). Only effects with
`EffectAttribute.NONE` therefore stay after the tone mapping, so `PostChain` throws for a
depth or convolution effect there instead of letting it run before the tone mapping.

**`time`.** Seconds, from the frame index (`frame / fps`). Before each render `PostChain`
sets the shared `time` uniform (`EffectMaterial.time`) of every effect pass, the stages and
the last pass; `NoiseEffect` and custom effect shaders read it. With delta 0 that value is
exactly what the shaders get. Without `time` the uniform stays 0, as before, so existing
chains render the same pixels.

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

### Any other font: `useFont(spec)`

```tsx
import fellUrl from '@fontsource/im-fell-english/files/im-fell-english-latin-400-normal.woff2';
import { useFont, type FontSpec } from '@aiv/remotion-kit';

// the latin file's unicode-range, copied from the package's index.css
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';

// module scope: the spec may not change after the first render
const FELL: FontSpec = {
  family: 'IM Fell English',
  sources: [{ url: fellUrl, unicodeRange: LATIN, weight: '400' }],
  sample: 'Happy Halloween · The End', // every string the film shows in this font
};

const { family, ready } = useFont(FELL); // family = '"AIV IM Fell English"'
```

- **Coverage.** Every character of `sample` except whitespace must lie in the
  `unicodeRange` of a source, or the render fails and names the characters
  (`U+8282 '节'`). A source **without** `unicodeRange` counts as covering every character,
  because the loader cannot look inside a font file. So give every subset file its range,
  and put every string the film shows in that font into the sample, in every language.
- **Loading.** Each source becomes a `FontFace` of the family `AIV <family>` with its
  range. The sources whose range holds a sample character, spaces included, are loaded
  before the frame is released; the browser picks the face per character. A space need not
  be covered, but the file that holds it is loaded, or the browser would fetch it during the
  render and early frames would lay text out with another space width. So keep the film's
  real spacing (`' '`, `'　'`) in the sample. `loadFont(spec)` does the same outside React and
  resolves to the font-family value.
- **`ready`.** React state. The frame is held until the font is loaded, and the hold is
  released in the commit in which `ready` became true. The hold is taken at commit (a layout
  effect), so a render React discards cannot leave it open. DOM text is safe with that alone.
  Canvas text is not: it is drawn when the code draws it, so draw it only once `ready` is
  true. Inside a `Stage3D`, R3F draws when the frame changes (`@remotion/three` advances it
  in an effect keyed on the frame), not when state changes, so a texture redrawn on `ready`
  never reaches the frame. So call `useFont` outside the `Stage3D` and mount the `Stage3D`
  only once `ready` is true (`ready ? <Stage3D>…</Stage3D> : null`). Measured: see
  [Canvas text](#canvas-text).
- **A CJK font.** fontsource splits it into subset files, one per unicode-range:
  `unicode.json` maps each subset (`[N]`, `latin`, …) to the range of
  `files/<name>-<subset>-wght-normal.woff2` (`@fontsource-variable/noto-serif-sc` 5.3.1:
  101 subsets, 97 of them numbered CJK chunks). Give each subset the film needs
  as a source, with its range from `unicode.json` and the variable weight (`'200 900'`).
  Only the subsets the sample touches are loaded. When a subset is missing, the coverage
  error names the character, and `unicode.json` tells which subset holds it.

## Canvas text

Text drawn into a 2D canvas (a `CanvasTexture`, a DOM canvas) varied from render to render on
the same inputs, from two causes. Measured on 2026-11-05 in chrome-headless-shell 157.0.8080.0
(ANGLE D3D11, an Intel iGPU) under Remotion 4.0.539, with the halloween-gift film.
- **A face that is still loading.** A character whose face (a unicode-range subset file) has
  not loaded yet is drawn in a fallback font: Chrome's default CJK fallback, a heavy sans,
  about 25-33% more ink and larger. Which of the 8 Noto Serif SC files were in at the first
  draw differed every run, so the cover title and the door couplets came out as a different
  mix of serif and sans characters each time. The film drew its text canvases inside a
  `Stage3D` mounted before the fonts were ready; the redraw on `ready` never reached the frame.
  With every pre-ready `fillText` suppressed, those texts rendered blank.
- **A GPU canvas.** Chrome's 2D canvas is GPU-accelerated by default, and it rasters large
  glyphs a level or two differently from page to page: from 166 px at weight 600 and up, and
  at every weight and font (Latin too) from 200 px. Up to 136 px it never varied. The
  variant follows the GPU process's history. A CPU canvas (`willReadFrequently: true`) never
  varied, across pages and browser launches.

Neither fix works alone; with both, every text canvas has one hash. So:
- **Gate.** Call `useFont` / `useInterState` outside the `Stage3D` and mount the `Stage3D`
  only once every face is ready. `ThreeCanvas` takes its own hold in that commit (a child's
  layout effect runs before the font hook's), so the frame is never released in between. Each
  text canvas is then drawn once, with every face loaded.
- **CPU canvas.** Draw text on `textCanvas(w, h)` (a new canvas, `{ c, g }`) or
  `textContext(canvas)` (a canvas you have, such as a DOM `<canvas>`). Both open the canvas
  with `TEXT_CONTEXT` (`{ willReadFrequently: true }`). A canvas keeps the settings of its
  first `getContext`, so `textContext` throws for one already opened as a GPU canvas. A canvas
  that never gets text can stay on the GPU.
- **Check.** `fillTextChecked(g, text, x, y, maxWidth?)` is `g.fillText` after
  `document.fonts.check(g.font, text)`, and it throws instead of drawing while a face the text
  needs is loading. Set `g.font` with the kit's family (explicit weight and px). The check
  passes a family with no registered face (a system font), so it guards the gate and does not
  replace it.

What did not help: `document.fonts.load(font, text)` for every string before drawing, or
waiting animation frames after `ready` (same variance). Not tested: DOM text at large sizes.
Verified with the film at draft: frames 82 (cover), 594 (door couplets), 840 (gift card), 882,
906 and 1008 (email face) had one hash each over three separate calls (82, 594 and 906 also
with the GPU program cache off). Before, frame 594 gave eight different hashes in eight runs.
`canvasText.test.ts` checks the context settings and the check against a stand-in document,
not pixels.
