# Roadmap

Forward-looking infrastructure work only, capped at 150 lines. Per-video state lives
in each `video.json` (`status`, `next`); history lives in git, in `CHANGELOG.md` and in the
Decisions section of `docs/ARCHITECTURE.md`.

## Done: the foundation (v0.1.0)
- [x] Repository hygiene, pinned pnpm workspace, determinism lint
- [x] Web engine: render → post → qa → release, verified on real output
- [x] Remotion engine against the same post/qa/release (no contract change)
- [x] The video slot: schemas, gates, `aiv new`, `aiv check`, catalog, prior films
- [x] Docs, licensing, knowledge cards, CI
- [x] Whole-repo review; acceptance test (a fresh agent made a web and a Remotion video
      from the docs alone)

## Done: the first film (*A Halloween Gift*, published 2026-11-06)
- [x] **Audio from code** (decisions 21-25): the audio stage (`aiv audio`), the cue sheet,
  pinned sample libraries, per-track sha256 in `post.json` and the release manifest,
  stale-picture and stale-audio refusals, audio QA.
- [x] Motion QA on the mezzanine (decision 27), lookdev stills with a reference compare
  (decision 28), the Remotion GPU program cache (`engines/remotion/ENGINE.md`).

## Next: built when a film needs it
Built when a film needs them, not before:
- **Large inputs** (`videos/<slug>/media/`, decision 17): the `media/manifest.json` schema,
  an `aiv check` that verifies listed files and hashes, and engine access to media files
  (Remotion's `staticFile` serves `assets/` only). Still deferred: the first film needed none.
- **Generated material** (`gen/`, `assets/` and `publish/` sidecars): a provenance sidecar
  schema derived from the first real one (`videos/halloween-gift/publish/thumbnail.provenance.json`,
  as `render.json` was derived from the first render), and a check of rights classes against
  `video.json` `license.film`.
- **Colour on the final**: a test-card leader that QA measures and post trims from the
  delivery, so the final itself is colour-verified (today the review cut is the evidence).
- **Web kit**: promote the web template's test card and font loader to a shared package
  when the second web video exists (the Remotion side already shares them).
- **Several formats per piece** (16:9 plus a 9:16 Short, as three series plan): decide
  between `deliverables[]` in `video.json` and linked slots, with the first such piece.

## Known gaps (not blocking)
- Post is one-shot, not chunked; the assembly decode check reads the whole mezzanine.
  Measure both on the first long film before optimising.
- Only tested on Windows: the macOS/Linux backends (vm_stat memory, Metal/GL GPU
  strings, `--use-angle=metal`), Remotion's Linux/macOS headless shells and a real WebGPU
  page capture need a host to run on. CI renders both templates on Linux with software GL.
- On macOS and Linux the orphan sweep parses `ps` output by whitespace, so a repository
  path with spaces defeats it (the docs require a path without spaces).
- No interactive `--wait` queue for `aiv render` (it exits 75 when the heavy lock is held).
- Remotion engine:
  - page-side network fetches are not intercepted (bundled files are checked; the docs ban
    runtime loads);
  - Ctrl+C during a render is verified only through the budget and low-memory exits, which
    share its cleanup;
  - every chunk starts Remotion's local server again (about 1 s), because the shared-server
    option is internal API.
  - a page's first frame can composite DOM work over the 3D frame differently from mid-chunk:
    *A Halloween Gift*'s per-frame grain canvas over the email card and a CSS shadow under the
    bat's tab differed on three chunk-start frames between the final and the review cut
    (invisible in motion; 1,426 of 1,440 frames identical). Draw DOM canvases on the CPU
    (`willReadFrequently`) or give the engine one warm-up frame per chunk, then test with
    `aiv still --check` on frames right after a chunk start;
  - a few dark pixels can differ by one or two levels across a chunk start (GPU rounding, cause
    not traced).
- `aiv check` does not lint STYLE.md headings; add it when the second style exists.
- Audio QA (found on *A Halloween Gift*):
  - the hit check proves timing, not audibility: its onset finder accepts any doubling of
    energy, so a hit buried in thunder passed; add a prominence measure (peak after the cue
    against the peak before it) before making the check fail;
  - the AAC encode can add about 1.5 dB of true peak at 192k (draft) over the mastered bed,
    leaving the delivery exactly at the -1 dBTP limit; post could measure the encoded true peak
    and re-master with the margin it actually needs.
