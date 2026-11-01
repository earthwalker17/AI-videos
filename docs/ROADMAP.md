# Roadmap

Forward-looking infrastructure work only, capped at 150 lines. Per-video state lives
in each `video.json` (`status`, `next`); history lives in git and in the
Decisions section of `docs/ARCHITECTURE.md`.

## Now: foundation (session 1)
- [x] M0 bootstrap: repo hygiene, pinned pnpm workspace, determinism lint
- [x] M1 web engine slice: render → post → qa → release, verified on real output
- [ ] M2 Remotion engine slice against the same post/qa/release
- [ ] M3 the video slot: schemas, gates, `aiv new`, `aiv check`, catalog, prior films
- [ ] M4 docs, licensing, knowledge cards, CI
- [ ] M5 whole-repo review, publish v0.1.0

## Known gaps (from M1, not blocking)
- Post is one-shot, not chunked; the assembly decode check reads the whole mezzanine.
  Measure both on the first long film before optimising.
- Only tested on Windows: the macOS/Linux backends (vm_stat memory, Metal/GL GPU
  strings, `--use-angle=metal`) and a real WebGPU page capture need a host to run on.
- No interactive `--wait` queue for `aiv render` (it exits 75 when the heavy lock is held).
