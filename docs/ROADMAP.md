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

## Now: what *Who Routes the Agents?* (#4, `super-agent`) needs
The first 2D, text-led, bilingual film, and the second scored one. Each item is built and
verified in its own commit, in this order (the video's README has the session plan).

Changed 2026-11-08: lookdev round 1 was not approved, because the look is too simple and crude
to be worth watching. A look-rework session now comes before the build. The remaining items
(captions, Bilibili publishing) move back one session. The reworked look (the Register Desk,
lookdev round 2) was signed off on 2026-11-10. Session 4 (2026-11-10 to 11-11) built part 1:
the film plays as one continuous world, beats 1–6 (f0–3439) are built on draft renders, an
animatic covers the rest, and the score is laid on the 84 bars (composed for bars 1–43). Part 2
(beats 7–13 and the rest of the score) is next.
- [x] **Determinism lint for 2D DOM work** (2026-11-08): frame code may not use CSS
  `transition`/`animation`/`@keyframes`, the Web Animations API or `ResizeObserver`/
  `IntersectionObserver`.
- [x] **Dependencies** (2026-11-08): `@remotion/paths` and `@remotion/layout-utils` 4.0.539, plus
  fontsource IBM Plex Sans, Noto Sans SC and JetBrains Mono.
- [x] **Score kit** (2026-11-08, decision 29): the generic DSP, convolution, reverb, mastering,
  mixer and grid timeline, copied from the frozen film and bit-identical to it with default options,
  plus oscillators, ADSR, delay, ducking and Karplus–Strong, at `@aiv/pipeline/audio/kit`. The
  film's instruments stay in its own `audio/`.
- [x] **2D measurements** (2026-11-08):
  - 0.20–0.21 s/frame and 0.49 MiB/frame at 1080p;
  - deterministic across fresh runs and at chunk starts with text ≤ 136 px (`engines/remotion/ENGINE.md`,
    `knowledge/dom-text-determinism.md`);
  - a flat ground, because CSS gradients band.
  Follow-ups are under Known gaps.
- [x] **The look rework's infrastructure** (2026-11-09, decisions 30–31):
  - a diagram film is a lit WebGL world under DOM text, posed by one camera function;
  - `aiv still --span --encode --inner` for motion tests and their fresh-page check;
  - `@aiv/remotion-kit` gains the frozen film's noise, `FinishEffect`, `Curve`, `CamPath`
    and `screenBoxAt`, now hashing with public-domain MurmurHash3 fmix32;
  - IBM Plex Mono 5.3.0 replaces JetBrains Mono;
  - the frame-critic's calibrated "finished craft" criterion.

  The WebGL world measured 0.37–0.62 s/frame and 1.31 MiB/frame at 1080p, deterministic on
  fresh pages.
- [ ] **The build** (the video's README has the session plan):
  - [x] part 1 (session 4, 2026-11-11): beats 1–6, the animatic and the score for bars 1–43, on
    draft renders;
  - [ ] part 2: beats 7–13 and the rest of the score; then the review cut.
- [ ] **Two-user promotions:** `readingSeconds` and the hold rule → `@aiv/core` are done
  (2026-11-08). Still to do:
  - the bilingual caption pattern and the cue-text helpers → `@aiv/remotion-kit` / `@aiv/core`,
    when the film's notes block settles;
  - the film's 2D motion kit (`videos/super-agent/src/kit/`), promoted with the next 2D explainer.
- [ ] **Captions:** an SRT draft generator from cue-sheet text events and a per-language
  subtitle linter (the limits in `references/subtitles.md`), in `@aiv/pipeline` and `aiv`.

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
- **Bilibili publishing**: a `references/bilibili-publishing.md` (AI-content label, 自制
  declaration, covers, CC subtitles, 合集), and whether `video.json` records a Bilibili
  release. Planned for #4 and dropped on 2026-11-13: the user publishes *Who Routes the
  Agents?* on YouTube only, so its zh captions were removed (the film's README, Decisions).

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
- 2D DOM pages (found on *Who Routes the Agents?*, 2026-11-08):
  - the kit's `TestCard` and `Title` text is not in a composited layer and probably gets LCD
    colour fringes. An engine-wide `--disable-lcd-text` launch flag would fix every page; it
    changes the templates' frame hashes;
  - `@aiv/remotion-kit` has no `"sideEffects": false`, so a 2D video bundles 18 three.js modules,
    `@remotion/three` and `Stage3D`/`PostChain` (React Three Fiber and postprocessing are dropped);
  - a 200 px Plex line is not bit-exact across pages at 1080p: keep DOM text ≤ 136 px
    (`knowledge/dom-text-determinism.md`).
- **Licence to confirm (found 2026-11-09).** The frozen *A Halloween Gift*'s `look/glsl.ts` and
  `look/NightPost.tsx` hashes have the exact form and constants of David Hoskins' "Hash without
  Sine" (shadertoy.com/view/4djSRW). Shadertoy refuses automated fetches, so the licence stated
  there is unread here. If it is MIT, add its `SPDX-FileCopyrightText` and `NOTICE.md` rows for
  the film. The kit no longer carries it: since 2026-11-09 `@aiv/remotion-kit`'s `NOISE_GLSL`,
  `NOISE3_GLSL` and `FinishEffect` use their own hash (MurmurHash3's fmix32, public domain).
  New shaders use the kit's hash.
- QA's black and freeze thresholds are hard-coded (`qa.ts`).
  - A dark look must keep its ground above limited-range luma 38 (or declare `qa.allowBlack`).
  - Still diagram holds over 3 s need `hold` cues or `qa.allowFreeze`.
  - The cue-sheet intent checks (text hold, cuts on bars) run only inside `aiv audio`, so an
    unscored video gets none of them.
  - Motion QA measures whole-frame change, so a one-frame pop or swap of a small part passes it
    (found on *Who Routes the Agents?*, 2026-11-11). A cue-aware step test per tile would catch
    them; today tile diffs round each event and code reviews that run the schedules frame by
    frame do.
- Audio QA (found on *A Halloween Gift*):
  - the hit check proves timing, not audibility: its onset finder accepts any doubling of
    energy, so a hit buried in thunder passed; add a prominence measure (peak after the cue
    against the peak before it) before making the check fail;
  - the AAC encode can add about 1.5 dB of true peak at 192k (draft) over the mastered bed,
    leaving the delivery exactly at the -1 dBTP limit; post could measure the encoded true peak
    and re-master with the margin it actually needs.
