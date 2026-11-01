# Roadmap

Forward-looking infrastructure work only, capped at 150 lines. Per-video state lives
in each `video.json` (`status`, `next`); history lives in git and in the
Decisions section of `docs/ARCHITECTURE.md`.

## Now: foundation (session 1)
- [x] M0 bootstrap: repo hygiene, pinned pnpm workspace, determinism lint
- [x] M1 web engine slice: render → post → qa → release, verified on real output
- [x] M2 Remotion engine slice against the same post/qa/release (no contract change)
- [ ] M3 the video slot: schemas, gates, `aiv new`, `aiv check`, catalog, prior films
- [ ] M4 docs, licensing, knowledge cards, CI
- [ ] M5 whole-repo review, publish v0.1.0

## Known gaps (not blocking)
- Post is one-shot, not chunked; the assembly decode check reads the whole mezzanine.
  Measure both on the first long film before optimising.
- Only tested on Windows: the macOS/Linux backends (vm_stat memory, Metal/GL GPU
  strings, `--use-angle=metal`), Remotion's Linux/macOS headless shells and a real WebGPU
  page capture need a host to run on. CI renders both templates on Linux with software GL.
- No interactive `--wait` queue for `aiv render` (it exits 75 when the heavy lock is held).
- Remotion engine:
  - page-side network fetches are not intercepted (bundled files are checked; the docs ban
    runtime loads);
  - Ctrl+C during a render is verified only through the budget and low-memory exits, which
    share its cleanup;
  - every chunk starts Remotion's local server again (about 1 s), because the shared-server
    option is internal API.
