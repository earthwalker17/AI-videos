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

## Done: built for *Who Routes the Agents?* V1 (#4, archived 2026-11-15)
V1 was finished and then archived unpublished on 2026-11-15. It is at the tag
`video/super-agent/v1-archived`; the slot's `V1.md` holds the record. The infrastructure it needed
stays.
- [x] **Determinism lint for 2D DOM work** (2026-11-08): frame code may not use CSS
  `transition`/`animation`/`@keyframes`, the Web Animations API or `ResizeObserver`/
  `IntersectionObserver`.
- [x] **Dependencies** (2026-11-08): `@remotion/paths` and `@remotion/layout-utils` 4.0.539, plus
  fontsource IBM Plex Sans, Noto Sans SC and IBM Plex Mono 5.3.0. Plex Mono replaced JetBrains Mono
  on 2026-11-09.
- [x] **Score kit** (2026-11-08, decision 29): the generic DSP, convolution, reverb, mastering, mixer
  and grid timeline, copied from the frozen film and bit-identical to it with default options.
  Also oscillators, ADSR, delay, ducking and Karplus–Strong, at `@aiv/pipeline/audio/kit`.
- [x] **2D and lit-world measurements** (2026-11-08 to 11-15, `engines/remotion/ENGINE.md`):
  DOM text is deterministic at 136 px or less (`knowledge/dom-text-determinism.md`), and CSS
  gradients band. The lit WebGL world is deterministic on fresh pages; its cost is in ENGINE.md.
- [x] **The lit world's infrastructure** (2026-11-09, decisions 30–31):
  - `aiv still --span --encode --inner` for motion tests and their fresh-page check;
  - `@aiv/remotion-kit` gains the frozen film's noise, `FinishEffect`, `Curve`, `CamPath` and
    `screenBoxAt`, now hashing with public-domain MurmurHash3 fmix32;
  - the frame-critic's calibrated "finished craft" criterion.
- [x] **Captions** (2026-11-15, decision 32): `aiv captions` drafts SRT from cue text and lints it.
- [x] **Archiving an unpublished film** (2026-11-15, decision 33): `archived` without a release
  needs only a written README (docs/PRODUCTION.md, "Archive an unpublished video").

## Done: #4 V2, *Who Routes the Agents?* (published 2026-11-17, https://youtu.be/-b7g5XIgEn0)
The first web-engine film and the first at 60 fps (decision 34). It needed no new infrastructure;
its kit stays in its slot, and the 60 fps measurements are in `engines/web/ENGINE.md`.

## Now
- [ ] **QA's hit-onset detector.** It read ten of V2's thirteen hits 65 to 115 ms late and six
  of V1's 55 to 110 ms late, each placed on its frame: measure onsets in a high band.
- [ ] **Motion QA at 60 fps.** Its windows are counted in frames, tuned at 24 and 30 fps: scale
  them by fps.
- [ ] **One verdict from `aiv qa`.** A final has two reports (the delivery, then the archive
  master); #4's archive failed a check after the first was read as the result. Print one at the end.
- [ ] **Unused dependencies.** Nothing at HEAD imports fontsource Noto Sans SC, `@remotion/paths`
  or `@remotion/layout-utils`: remove them (V1 rebuilds from its tag's own lockfile).
- [ ] **Two-user promotions.** Only at V1's tag: the caption pattern and cue-text helpers,
  `planSlices`, `PreToeEffect`, the analytic footprint light, the 2D motion kit. Only in V2's
  frozen slot: its WebGL2 stage, glyph atlas and camera rig. Each moves to a shared package
  when a second film needs it.

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
- **A voice track**: text-to-speech or a recorded voice in `media/`, with captions aligned from
  `SCRIPT.md`'s subtitle text (decision 32 notes the gap). Built when a film is narrated.
- **Bilibili publishing**: a `references/bilibili-publishing.md` (AI-content label, 自制
  declaration, covers, CC subtitles, 合集), and whether `video.json` records a Bilibili
  release. Planned for #4 V1, dropped on 2026-11-13; #4 was published on YouTube only.

## Known gaps (not blocking)
- Post is one-shot, not chunked; the assembly decode check reads the whole mezzanine.
  Measure both on the first long film before optimising.
- Only tested on Windows: the macOS/Linux backends (vm_stat memory, Metal/GL GPU
  strings, `--use-angle=metal`), Remotion's Linux/macOS headless shells and a real WebGPU
  page capture need a host to run on. CI renders both templates on Linux with software GL.
- On macOS and Linux the orphan sweep parses `ps` output by whitespace, so a repository
  path with spaces defeats it (the docs require a path without spaces).
- No interactive `--wait` queue for `aiv render` (it exits 75 when the heavy lock is held).
- Browser profiles piled up on Windows during #4 V1 (654 unmarked `puppeteer_dev_chrome_profile-*`
  folders, 0.9 GB; none after V2's web-engine renders). The engine deletes only the profiles it
  marks (ENGINE.md, Browser hygiene); which launches leave the others is not traced.
- CI on `windows-latest` fails one audio-stage test (a score importing `@aiv/pipeline/audio`
  through a scratch repo's `node_modules` junction); it passes on the reference host and on Linux.
- A render call killed while the joined mezzanine is checked and hashed leaves a complete but
  unverified `mezzanine.mkv`. A rerun joins again beside it, so the disk must hold two copies. The
  runner could verify and reuse it instead.
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
