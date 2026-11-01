# references/ — pinned notes on external sources

These notes preserve what research has already established about upstream projects,
platform rules and licences, so later work can consult them instead of repeating broad
research. Each note is pinned (commit, version or access date), tagged by how well each
fact was verified, and says what this repo took, what it refused and what nobody read.
`sources.json` lists every source with its licence and excerpt policy.

The first set was written from research done on 2026-11-01: primary sources where
possible, contradictions re-checked at the source, and a review of the map-of-middle-earth
tooling.

## Policy: notes are maps, not copies
- No source dumps and no vendored third-party text. A note says what a source contains,
  why it matters here and where to look; the upstream stays the authority.
- Facts are restated in our own words.
- Direct quotes only when the exact wording matters (a licence clause, a limit stated in
  words), at most 25 words, inline-attributed with URL and access date, formatted as:

  > Quoted from https://example.org/page (accessed 2026-11-01): "exact words"

- Follow each source's `excerpt_policy` in `sources.json` (`link-only`, `facts-paraphrased`,
  `short-quote`, `cc-by-excerpt`, `vendorable`). Proprietary help pages and terms are
  paraphrased; Remotion docs and skills are never copied.
- No image or other asset-file URLs: cite the article or repository page instead.
- No local absolute paths, usernames, host names or research-dump paths. Host facts use a
  coarse host class (OS, CPU class, GPU family, RAM).
- Code adapted from a source is not a reference: it lives in `packages/`, `engines/` or
  `tools/` with SPDX and Adapted-from headers (see `licensing-tooling.md`).
- The notes themselves are repository prose (CC BY 4.0). Quoted passages remain their
  owners' and are not covered by that licence (`docs/LICENSING.md`).

## Verification legend
| Tag | Meaning |
|---|---|
| [V] | Verified at a primary source (upstream repo at the pin, registry metadata, official docs or licence text) on the access date |
| [S] | Secondary source (a summary, third-party article or benchmark, or a project's own notes not checked at the pin) |
| [U] | Unverified: inference, estimate or design proposal |

A tag after a group heading applies to every bullet in that group unless a bullet carries
its own tag. Tags reflect each source as read on the note's access date.

## How to use
1. **Read the note for your topic first** (index below; `sources.json` for URLs and licences).
2. **Research only what is missing or stale**: anything past its "Stale after" date, tagged
   [U]/[S] and decision-relevant, or listed under "Not read". Prefer primary sources.
3. **Write back** in the same change:
   - update pins and access dates for what you re-checked, and promote or demote tags;
   - mark falsified claims in place (strike the old claim with ~~ ~~, add the corrected fact with its date and source) rather than silently deleting them;
   - move items you read out of "Not read", and add what you deliberately skipped;
   - add or update the entry in `sources.json` (and the index table here).
4. New topic: copy the header block (Upstream, Pin, Licence, Accessed, Stale after) and the
   sections *What it is · Why it matters here · Key facts · What we adopted / adapted ·
   What we deliberately did NOT adopt, and why · Gotchas · Not read*.

## Refresh policy
Every note carries a "Stale after" hint sized to how fast its upstream moves (two weeks for
pre-1.0 engines, a month for release-train projects and provider terms, longer for
structural lessons). A stale note is still a useful map, but re-check before a decision
rests on it. Version pins at repo HEAD live in the root config; when they change, update
`toolchain-2026-11.md` or start a new dated toolchain note.

## Index
| File | Topic | Pin | Upstream licence | Stale after |
|---|---|---|---|---|
| [lemo-opuscar.md](lemo-opuscar.md) | Page-contract capture, readcheck, ASR QA, mastering; STYLE/DEMO/TREATMENT method, DIRECTOR quality bars, provenance files, catalog generator, plugin layout | `bebbbe1aa92a3cb4bb6f83500e61b23a17d1aa00` | MIT (films CC BY 4.0; fonts OFL; packs CC0/CC BY) | 2026-12-01 |
| [map-of-middle-earth.md](map-of-middle-earth.md) | Our earlier film repo ("MAP" in these notes): readback capture, host safety, chunked resumable renderer, BT.709 encode presets, QA/lock, music engine, Blender runner, provenance, lookdev numbers | `696e968e9d550327beda9e663ef5aec6961583c9` | MIT (renders not MIT) | frozen at pin |
| [remotion.md](remotion.md) | Versions, licence obligations, v5 checklist, ThreeCanvas semantics, `--gl`, bt601 default, headless-shell location, Windows iGPU issues, skills | v4.0.539 (`e50b41a4`); licence at `fe9ffaa7` | Remotion License (source-available); `@remotion/three` MIT | next upgrade / 2026-12-01 |
| [r3f-drei-postprocessing.md](r3f-drei-postprocessing.md) | Peer constraints (three < 0.187, React < 19.4), R3F 10 / WebGPU, clock-driven helpers to ban, deterministic replacements | three 0.186.1, R3F 9.8.2, drei 10.7.9 (`bf6f4add`), postprocessing 6.39.5 | MIT; postprocessing Zlib | 2026-12-01 |
| [hyperframes.md](hyperframes.md) | Candidate HTML engine: seek determinism, `hf-seek`, FrameAdapter, Windows CI, telemetry, GSAP licence | `ee50cd2fc0d0fe4a4eac22683ed23b6066289ab3` (0.8.225) | Apache-2.0 (GSAP proprietary) | 2026-11-15 |
| [manim.md](manim.md) | ManimCE vs ManimGL, 0.22 CLI changes, Typst math, seeding, Windows wheels | CE v0.22.1 (`16ea443e`); GL `fafa083a` | MIT (3b1b/videos CC BY-NC-SA) | 2027-01-01 |
| [code-video-engines-survey.md](code-video-engines-survey.md) | Verdicts on 16+ engines and capture techniques (Motion Canvas, Revideo, Theatre.js, editly, Twick, timecut, Blender, glslViewer, p5, mediabunny, page.clock, beginFrame) | per row, 2026-11-01 | per row | 2026-12-01 / 2027-05-01 |
| [multi-video-repos.md](multi-video-repos.md) | 3b1b, WelchLabs, Polylog, motion-canvas examples, Remotion monorepos, shotcraft, toolkit, micro films, OpenMontage: patterns and failures with evidence | per repo, 2026-11-01 | mixed (NC/GPL/AGPL: ideas only) | 2027-05-01 |
| [genai-landscape-2026-11.md](genai-landscape-2026-11.md) | Model retirements, prices, open-weight licences, music/voice terms, rights classes A–D, sidecar fields, IPTC/C2PA, cost control | dated snapshots 2026-11-01 | proprietary terms (facts); Google docs CC BY 4.0 | 2026-12-01 |
| [youtube-publishing.md](youtube-publishing.md) | Upload encode spec, thumbnails, captions, chapters, multi-language audio, CC BY option and Content ID, Audio Library, AI disclosure, inauthentic content | accessed 2026-11-01 | Google help (paraphrase only) | 2026-12-01 (policy) / 2027-05-01 (spec) |
| [subtitles.md](subtitles.md) | Netflix en-US / zh-Hans limits; narration text vs subtitle text; on-screen readcheck rules | guides dated 2025-07-04 / 2025-12-19 | Netflix proprietary (facts only) | 2027-11-01 |
| [github-storage-limits.md](github-storage-limits.md) | File limits, LFS billing (forks, Actions), Releases 2 GiB/asset, Pages 1 GB, runners; HF and R2 alternatives | github/docs `33b1f4a6` | CC BY 4.0 | 2027-05-01 |
| [claude-code-packaging.md](claude-code-packaging.md) | Skill locations, nested lazy loading, `paths`, description cap, CLAUDE.md size, git-subdir plugins, third-party plugins | accessed 2026-11-01 | Anthropic docs (paraphrase) | 2026-12-01 |
| [licensing-tooling.md](licensing-tooling.md) | REUSE 3.3 / REUSE.toml, SPDX and Adapted-from headers, gitleaks and custom rules, font rules, licence-trap table | REUSE 3.3; reuse 6.3.0; gitleaks v8.30.1 | CC BY-SA 4.0 (spec); MIT (gitleaks) | 2027-05-01 |
| [toolchain-2026-11.md](toolchain-2026-11.md) | Pinned vs latest versions with the constraint behind each gap; Python 3.13 rationale; encode throughput on the reference host class; Windows traps | 2026-11-01 snapshot | facts only | 2026-12-01 |
| [sources.json](sources.json) | Machine-readable list of every source (id, url, pin, licence, excerpt policy, why, note, status) | 2026-11-01 | — | with the notes |
