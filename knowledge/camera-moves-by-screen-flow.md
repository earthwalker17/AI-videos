# Plan a camera move by how fast its picture moves, before rendering it

A camera path that looks fine as positions and angles can still strobe at 24 fps without
motion blur, or wipe a near object across the lens: what the eye sees is how many pixels the
picture moves per frame, and that depends on how far away everything is. Estimate that screen
flow numerically from the scene's layout while you design the keys, and shape the move so the
flow stays low: back away along the line of sight (the picture shrinks evenly) rather than
truck sideways past near things, and swing round the subject while the camera is still close
and slow, not while it is fast.

## Method
1. **Flow, per frame.** Cast rays through a coarse screen grid (48 × 27 is enough) for frame f;
   intersect each with a cheap stand-in of the scene: the ground's heightfield (march the ray,
   step growing with distance), the desk plane, and point samples of the big near objects (a
   tree's vertices as small spheres); a ray that hits nothing is sky (rotation only). Project
   each hit with frame f + 1's camera and take the screen distance. Report the median and the
   90th percentile in pixels at the delivery height, and which near object covers how much of
   the frame at what distance.
2. **Budgets** (24 fps, no motion blur): median about 40 px a frame or less for a move that
   should read as smooth; up to ~60 px briefly; a near object (closer than ~3 units at the
   film's scale) crossing the frame centre is a wipe, not a move. The 90th percentile tells you
   when one object is whipping past even if the median is calm.
3. **Shapes that keep flow low.**
   - *Pull-out:* keep the camera on a line from what it looks at and grow the distance by a
     constant factor per frame (an exponential schedule eased at both ends). The world shrinks
     evenly; the flow is a slow radial zoom, a few per cent a frame.
   - *Orbit, not truck, near the subject:* aim at the subject while swinging round it; a truck
     at the same speed slides the near ground under the lens.
   - *Turn the aim late:* move the aim from the subject to the next target once the camera is
     far, when a rotation moves everything little.
   - *Clear the obstacles by route, not by height alone:* list the near objects' extents by
     height band (a tree's crown spreads at the top) and pick the side where the camera never
     comes within a few units, or rise above them before passing.
4. **Check, then render.** Write a test that the path's step stays under a limit that grows
   with the distance to what it looks at (a base plus a few per cent of it), so later edits
   cannot slip a jump in, and confirm on a short draft span at the delivery frame rate.

## Evidence
*A Halloween Gift* (`videos/halloween-gift`, 2026-11-05): the crane out of the door yard and up
out of the book measured 100–200 px median per frame, with the ghost tree's trunk passing 1.7
units from the lens (the critique called it a strobe and a wipe). Re-shaped by this method
(an orbit up round Clawd, then an exponential back-away along the line of sight to a wide view
of the open book), it measured about 40 px median for most of its length and ~55 px while
swinging round him, the tree never nearer than ~4 units in frame; the push into the pop-up shot
and its exit went from 133 and 147 px to 87 and 65 px by spreading them over more frames.
Verified on rendered stills and a 21-frame span of the close, then by the motion check of the
whole film: on the 1080p review and final mezzanines (2026-11-06) it flagged no judder, twos or
pop, the crane out included.

## In this repo
The estimate was a short script against the film's layout (`world/layout.ts` groundHeight, the
trees' geometry, `film/journey.ts` journeyAt), not yet a shared tool; the guard is the step test
in `videos/halloween-gift/src/film/journey.test.ts`. A shared version (any engine's camera path
against a scene's heightfield and proxies) belongs in `tools/aiv` once a second film needs it.

## Pitfalls
- The stand-in scene leaves things out (walls, props): the estimate is a lower bound near them.
- A point-sample metric over world points over-weights the near ground; sample the screen, not
  the world.
- Raising the camera over an obstacle can put it level with the obstacle's crown, which then
  fills the frame against the sky: check the coverage, not just the distance.
- Motion blur (sub-frame accumulation) would raise every budget; without it, the budgets above
  hold.
