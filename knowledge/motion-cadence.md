# Animate everything on ones when the camera moves, and measure cadence, not stills

A stylised film often animates its characters "on twos" (a new pose every other frame) for a
hand-made feel. Under a moving camera that reads as judder: the background slides every frame
while the character stands still on one frame and jumps on the next, so the eye sees the
character stutter against the world. A still frame never shows it, so a review of stills
passes it. The answer: when the camera moves, everything moves on ones, and motion is checked
by measuring the frame-to-frame differences of the rendered film, not by looking at frames.

## Method
1. **One cadence per shot.** If the camera moves, every visible thing (actors, props, cloth,
   flicker, wind) moves on ones. Keep twos only for shots with a locked camera, if at all.
   Texture "boil" (a pattern re-seeded every other frame) is twos too.
2. **No sliding feet.** Lock a walk to the ground: a ballistic hop per beat (or a foot plant
   per step) whose landing frames are the score's footfalls, with squash on landing and
   anticipation before take-off, and the travel between landings eased. Linear starts and
   `abs(sin)` bobs make cusps that read as jerks.
3. **Camera paths without kinks.** Piecewise eased keys stop at every key. Use a spline
   through the keys (centripetal Catmull-Rom) with a monotone, C1 time warp (Fritsch-Carlson),
   zero velocity only where the storyboard holds, and aim a follow camera at a centred moving
   average of the subject's path (a pure function of the frame), not at the subject itself.
4. **Measure the cadence.** Decode the film to small grey frames and take, per frame, the mean
   absolute difference D[i] to the previous frame, for the whole picture and for a grid of
   tiles. Over 12-frame windows that really move (median D above the grain floor):
   - alternation A = mean |D[i] − D[i+1]| / mean D;
   - parity ratio R = the median D of the even frames over that of the odd ones (or its
     inverse, whichever is ≥ 1);
   - consistency C = the share of inner frames that are a local maximum (high parity) or
     minimum (low parity) as the parity says: steps on twos give 1, chance about 1/3.

   A part of the picture on twos while the rest moves on ones shows as R ≥ 1.2, A ≥ 0.15,
   C ≥ 0.75 in some tiles: judder. The whole picture holding every other frame is twos.
5. **Measure the lossless file.** An encoder's frame types make D alternate on their own (a
   pan on ones encoded with B-frames, or a hardware preset, can look like twos). Measure the
   lossless intermediate; on a lossy file, ask for a run of several flagged windows and a
   coarse (block-averaged) difference that moves, not just the grain.
6. **Flashes and pops are cue questions.** A luma jump or a one-frame difference spike is fine
   on a scripted hit and a defect anywhere else: compare them with the cue sheet.

## Evidence
*A Halloween Gift* V1 draft (960x540, 24 fps, 1452 frames; Remotion 4.0.539 + R3F, actors on
twos, camera on ones), 2026-11-04:
- Frame-difference energy over the graveyard walk (13-18 s) alternated every other frame
  (≈ 9.7 / 12.7 / 9.4 / 10.4 …), and the walk's feet slid 3.4 units in 54 frames on 0.1-unit
  legs.
- The motion check above, run on the FFV1 mezzanine, flagged judder at 11.2-19.4 s (the walk)
  and in six other camera moves, every one a camera move with actors on twos, and none on the
  Remotion template (camera and bars on ones), even at looser thresholds.
- On 110 lossy encodes of a grainy pan on ones, a single-window rule made 45 false judder
  spans; the lossy rule (a run of ≥ 3 windows, coarse movement) made none and still flags a
  subject on twos through the same encoders.

Not verified yet: the V2 picture of the same film (everything on ones, hop gait, spline camera)
through the same check; that result is added here when the V2 draft is measured.

## In this repo
- `aiv qa` runs the check (`packages/pipeline/src/qa/motion.ts`; ARCHITECTURE decision 27):
  `motion.png`, `motion.json`, frame strips of each flagged span and a `motion.watch` list;
  information only, `--no-motion` skips it.
- The hop gait and the camera spline: `videos/halloween-gift/src/film/{gait,campath}.ts`, with
  tests that check footfalls against the score, no skating and velocity continuity.

## Pitfalls
- Deterministic does not mean smooth: a frame that is a pure function of its index can still
  step on twos (`Math.floor(f / 2)`), and every chunk-start test passes it.
- Grain changes every frame and lifts the floor of D: set the motion floor above it, and
  measure boil on a span without grain or with the grain's share known.
- A one-frame flicker of a light (lightning as a light popped for a frame) is a flash; soften
  it into a pulse of a few frames unless the cut is the point.
