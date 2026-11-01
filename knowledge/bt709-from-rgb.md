# Convert RGB frames to BT.709 once, explicitly, and check it from the final file

Rendered frames are sRGB-encoded RGB. Video delivery is YUV with a colour matrix and a
range. Leave either implicit and players guess, usually wrong in a way that shifts every
colour slightly: reds and skin tones drift, blacks lift or crush.

## Method
1. Keep the intermediate lossless RGB (FFV1 `bgr0`), tagged as sRGB-encoded full-range RGB.
2. Convert exactly **once**, in the delivery encode, with the matrix and range spelled out,
   then tag the frames:
   ```sh
   -vf "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd,format=yuv420p,\
   setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"
   ```
   With FFmpeg 8, the output flags `-color_primaries`/`-color_trc` alone did not reach the
   stream (ffprobe reported nothing); `setparams` on the frames does.
3. Never re-tag without converting. A YUV source in another matrix or range (for example
   BT.601 from a renderer default) goes through a real conversion (`zscale`), not a new tag.
4. **Verify from the final file**: render known colour patches into a few frames, decode them
   from the delivery file with an explicit BT.709 limited-range matrix, and compare each patch
   centre with its RGB value. A tolerance of ±3 code values separates rounding from real
   errors.

## Evidence
Measured with seven patches (near-black 16, near-white 235, mid-grey 128, red, green, blue,
skin) on 960x540 and 1920x1080 renders:
- Correct path: worst deviation 2.0 code values with libx264, and 2.0–2.56 with the Intel
  QSV hardware encoder.
- BT.601 data tagged as BT.709: off by 15–20 code values.
- Full-range data tagged as limited: off by 10–20 code values.
- `full_chroma_int` in the swscale flags made no difference (identical output);
  `full_chroma_inp` measured 0.01–0.17 dB lower PSNR, so neither is used.

Not verified: HDR and wide-gamut delivery (out of scope), and how each player displays the
result (the tags are what a player needs).

## In this repo
`toBt709Filter` and the presets in `packages/pipeline/src/media/presets.ts`; the swatch strip
in `@aiv/core` (`swatches.ts`); the swatch check in `packages/pipeline/src/qa`. A video opts in
with `qa.swatchFrames` in `video.json`.

## Pitfalls
- Checking the intermediate proves nothing about the delivery: decode the final file.
- Some engines (Remotion's default) encode BT.601. Either set BT.709 explicitly or hand over
  lossless RGB and convert once downstream.
