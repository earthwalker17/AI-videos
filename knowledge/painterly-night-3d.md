# A painted moonlit night in real-time 3D comes from the darks, the depth and the sky, not from the models

Real-time 3D lit by a moon behind the scene renders as black cut-outs with a cyan outline: every
face toward the camera is in shadow, and shadows in a physically based renderer are close to
black. A painted night is the opposite: the darks carry a coloured mid-value (plum near the
viewer, slate and teal further off), depth turns forms toward the haze, and the sky is a
dramatic, value-rich half of the picture. Matching a painted reference starts with those three
in the shared look, before any asset is refined.

## Method
1. **Measure against the reference first.** Average the picture over a coarse grid (8 × 5
   cells) in sRGB and compare cell by cell with the same grid of the reference, plus a few named
   regions (sky, the bright mid-ground, the near ground, the darkest corner). It tells you which
   way each part is off (too dark, too blue, no red) where a glance only says "too dark".
2. **A coloured floor under the darks.** Give every material a soft wrapped fill whose colour
   depends on the distance from the lens (plum near, teal in the mid-ground), proportional to
   the albedo, so a shadowed face keeps its texture. After tone mapping, lay a floor under the
   whole picture (`c = lift + c × (1 − lift)`), warmer low in the frame and cooler high, and let
   the vignette darken red less than green and blue toward the bottom corners (they go maroon,
   not grey).
3. **No shadow-crushing grades.** A split tone written as "multiply the shadows by a tint"
   (`c × tint × 2`) darkens them by half when the tint is dark: shift hue at constant luminance
   instead (divide the tint by its own luminance), and only on the darks and mid-tones, so a lit
   face or a glow keeps its colour.
4. **Depth, by distance as well as height.** Height fog alone leaves mid-ground trees as black
   silhouettes above the fog layer. Add an aerial term that grows with distance only
   (`1 − exp(−(d − d0)/L)`, capped well below 1) and keep per-material fog multipliers near 1;
   multipliers used to fake depth overshoot as soon as the shared fog improves.
5. **The sky is a direction, all round.** Draw the sky from the view direction (a "portal"
   shader) on a dome round the whole set, not on a backdrop card: a card shows its edge, or the
   void past it, the first time a wide or close camera looks past it. Clouds from 3D noise of
   the direction have no seam. Dark cloud masses against a brighter sky, with edges lit toward
   the moon (sample the density a little toward the moon: where it falls, the edge takes the
   light), give the reference's drama; similar cloud and sky colours read as a flat gradient.
6. **Keep the moon small and its halo tight.** A wide halo, bloom and god rays together wash
   out everything near the moon, including the silhouettes framing it.

## Evidence
*A Halloween Gift* V2 lookdev, the hero view against its painted reference (1920 × 1080,
Remotion 4.0.539 + React Three Fiber 9.8, three 0.186, postprocessing 6.39, an integrated
laptop GPU through ANGLE/D3D11), 2026-11-04, same assets throughout:
- Before (height fog, a cool front fill, the multiply split tone, a sky card): value-grid mean
  absolute difference 0.086, a third of the frame near black (k-means cluster `#0c0e14`, 33 %)
  where the reference's darkest dominant colour is a plum `#342632`; the sky card ended left of
  the frame's right edge (black void, moon cut in half).
- After steps 2 to 6: value-grid difference 0.066; the reference's plum and maroon now appear
  among the frame's six dominant colours; no void. The palette distance (CIEDE2000 between
  matched k-means palettes) moved 10.3 → 11.2 because the clusters re-formed; it is a weaker
  guide than the grid.
- The first try overshot (aerial fog to 0.78, a wide halo): the grid difference rose to 0.148
  and the frame washed out to flat cyan. Ten measured rounds brought it down; the numbers are in
  the commit `feat(halloween-gift): the V2 look against the reference`.
- A Kuwahara (painterly) pass on the same probe cut the high-frequency temporal energy ("boil")
  of moving grass by 42 % at about 0.3 s a 1080p frame on that GPU (measured on a 12-frame
  span without grain).

- With the real graveyard and buildings in place (2026-11-04, later): a deep maroon band
  across the bottom fifth of the frame (green and blue darkened about 80 %, red 40 %, after tone
  mapping), a greyer near ambient (`#5e2a32` → `#4a3040`), a more cyan sky, and the landmarks
  moved to the reference's screen positions (projected numerically, not by eye) took the hero to
  value-grid 0.044 and palette distance 9.4.

The other shots (the desk, the door close-ups, the email) were judged by eye: 16 checkpoint
frames at 1080p, two adversarial critique rounds and the user's approval of the film
(2026-11-06). They were not measured against a reference (the painting shows only the hero
view), and the maroon foot band varies along the journey (`FilmV2` `footAt`).

## In this repo
- `videos/halloween-gift/src/look/`: `materials.ts` (the storybook material: ambient, rim, fog,
  aerial), `SkyPortal.tsx` (the portal sky on the cover and the dome), `NightPost.tsx` and
  `Post.tsx` (the grade, the floor, the vignette), `Night.tsx` (the light rig).
- `pnpm aiv still <slug> --ref <image>` writes the compare sheet with the value grid and the
  palettes (`packages/pipeline/src/stills/`).

## Pitfalls
- Raising the ambient light everywhere (a stronger hemisphere) brightens the lit mid-ground as
  much as the darks: the value structure flattens. The fill has to depend on distance.
- A warm grade near the lens also warms anything dark-red near the lens: a plum-coloured root
  mass went crimson until its own fill was lowered.
- A stand-in with a strong, wide practical light (here a point light reaching 6 units) tints
  everything near it; judge the shared look with stand-ins unlit, or the grade gets tuned against
  a light that will not be in the film.
- A maroon foot band is a per-shot setting: across a close shot it darkens the actors' feet.
- Depth of field blurs the sky the most (it is the farthest thing): clouds turn to mush unless
  the blur is gentle.
