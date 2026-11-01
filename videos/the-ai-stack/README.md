# THE AI STACK

A 5½-minute, narration-free 3D tour of the whole AI stack, from energy and chips
through tokens, the Transformer, training and inference, up to chat and agents.

▶ **Watch:** https://youtu.be/LDH7UhHeKG4
**Series:** [3D Concept Visualizations](../../series/concept-viz/SERIES.md)

This is a **metadata-only entry**. The film predates this repository and its
source was not preserved; only the published film and the lessons below remain.
Those lessons shaped the shared Remotion tooling here.

## How it was made
- Remotion 4 + React Three Fiber 9 + three.js 0.186; 10,150 frames at 30 fps
  (about 5:38), 1920×1080.
- A single source of truth for timing: per-chapter JSON timelines, a lead-owned
  design-system package and a component library, and one entry point per chapter
  so chapters could be built and rendered independently.
- A procedural score generated in Python.
- Rendered on an Intel UHD laptop at roughly 0.8–1.2 s per frame (concurrency 1;
  concurrency 2 was not faster).

## Lessons (hard-won, now encoded in shared tooling)
- `@react-three/postprocessing` builds its composer in an effect, so the first
  frames under Remotion render blank. Build the post chain synchronously.
- drei `<Environment>` must be memoized, or it re-captures every frame.
- The depth-of-field material needs the camera settings copied every frame, and
  transparent objects without depth writes get blurred by depth of field.
- Under ANGLE/D3D11, `pow()` of a possibly negative base returns NaN at rare poses;
  bloom then blacks out the whole frame for one frame at full resolution only.
  Clamp `pow` bases.
- The render script reused chunks without a code hash, so stale chunks survived
  edits. Resumable rendering must be keyed to a hash of its inputs.
- On a 7.6 GB machine, headless Chrome's GPU buffers count against RAM: render
  with concurrency 1, in foreground chunks of 10 minutes or less.

## Licence
This entry's text is CC BY 4.0. The film itself is published on YouTube and is
not part of this repository.
