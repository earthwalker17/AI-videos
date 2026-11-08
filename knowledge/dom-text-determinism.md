# Keep DOM text under the size where headless Chrome rasters it differently per page, and out of LCD antialiasing

A 2D explainer drawn as DOM text and SVG in headless Chrome must give the same pixels whether a
frame is the first on a fresh page or the hundredth in a chunk. Three things in the browser break
that or spoil the delivery even when the frame code is pure:
- very large text is rastered differently from page to page;
- text on an opaque page gets LCD subpixel colour fringes;
- CSS gradients band on a dark ground.

The answer is a size limit, a compositing-layer hint and a flat ground (or a baked dither).

## Method
1. **Bound text size.** Measure, on your browser build and GPU, the largest size whose glyphs are
   bit-identical across fresh pages and mid-chunk frames. Set every type size at or below it, or
   draw anything larger as SVG paths or on a CPU canvas.
2. **Keep text out of LCD antialiasing.** On an opaque frame the shell may antialias text
   per subpixel. That gives red and blue fringes, which 4:2:0 chroma subsampling then smears in
   every delivery. Put each text block in its own composited layer over a transparent background
   (a `will-change: transform` hint, not a filter: nothing is resampled). The browser then
   antialiases it in grey. A browser flag that disables LCD text is the engine-wide alternative.
3. **No CSS gradients on a dark ground without a dither.** The browser does not dither them,
   so an 8-bit ramp shows as wide one-code bands. Keep the ground flat, or bake the gradient
   with its dither into an image loaded the way the renderer waits for (Remotion `<Img>`). Never
   use a CSS `background-image: url()`; Remotion cannot wait on it.
4. **Prove it** with two fresh full-size renders (identical frame hashes) and frames from the
   middle of chunks rendered again as chunk starts (identical hashes). Repeat after any type,
   font or ground change.

## Evidence
2026-11-08, reference host class: Windows 11, 4-core 10th-gen Intel, Intel UHD iGPU, 8 GB.
Chrome Headless Shell 157.0.8080.0, `--gl=angle`, Remotion 4.0.539. The determinism probe of
`videos/super-agent` (`src/lookdev/ProbeScene.tsx`):
- **Large text.** A 200 px IBM Plex Sans SemiBold line differed by up to 2 code values on 32–363
  pixels in 9 of 15 fresh-page against mid-chunk comparisons at 1080p; one frame gave three
  different hashes in three calls. A layer did not help.
  - A 160 px Noto Sans SC Medium line stayed bit-exact.
  - With the Plex line at 136 px, everything matched (below).
  - The kit's canvas tests had found GPU raster variance from 166 px at weight 600, never up to
    136 px (`packages/remotion-kit/README.md`, Canvas text).
- **LCD antialiasing.** On the opaque frame the 40–48 px notes and labels had red and blue
  fringes up to 162 code values apart; in a `will-change: transform` layer, at most 9.
- **Banding.** A +2% luma radial lift (#202226 to #25272B) showed clean 1-code bands 90–270 px
  wide. A seeded 0/+1/+2 dither tile broke up the band edges, but the average still stepped.
- **The pass, with text ≤ 136 px.** Two `--fresh` 1080p renders of 315 frames gave identical
  frame hashes and a byte-identical FFV1 mezzanine. `aiv still --check review` matched all 12
  mid-chunk frames rendered as chunk starts. The scene had Plex, Noto Sans SC and JetBrains Mono
  text, SVG draw-on, a token on a path, a 1.0–1.6× camera zoom, screen-space labels and the
  dither tile.

Not verified: other GPUs and browser builds (the bound is per host; re-measure); sizes between
136 and 160 px in Plex; whether the kit's `TestCard` and `Title` text (not in a layer) also fringe.

## In this repo
- `MAX_TEXT_PX` (136) and the tests on it: `videos/super-agent/src/look/tokens.ts`.
- `GREY_TEXT` and the text components that use it: `videos/super-agent/src/kit/text.tsx`.
- The flat ground and the `<Img>`-loaded dither tile: `src/look/Ground.tsx`, `src/kit/dither.tsx`.
- Measurements: `engines/remotion/ENGINE.md`, Measured on the reference host.
- The check commands: the `render-verify` skill.

## Pitfalls
- A text size that passes at draft (half size) can fail at 1080p: check at full size.
- A knockout (a stroke in the ground colour under a label) leaves a dark halo if the ground under
  it is lifted: keep knockouts on a flat ground.
- Characters missing from a family fall back to another one (here, U+2192 → came from Noto Sans
  SC inside JetBrains Mono numbers): `useFont`'s coverage proof catches a missing glyph, not a
  mismatched one.
