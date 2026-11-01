# Changelog

Infrastructure releases of this repository. Each video has its own release
(`video/<slug>/v<N>`, with its manifest in `videos/<slug>/release/`), so videos are not
listed here.

## v0.1.0 · 2026-11-01

The foundation: everything a first film needs, verified end to end on real renders.

- **Two engines** behind one runner: `web` (any page, three.js WebGL/WebGPU, pinned Chrome
  for Testing) and `remotion` (React, Remotion, React Three Fiber). Both stream lossless
  frames with per-frame hashes into an FFV1 mezzanine; resumable chunked renders refuse to
  resume when an input changed.
- **Post, QA and release** shared by every engine: one BT.709 conversion, two-pass
  loudness to -14 LUFS, QA on the delivered files (swatch colours, loudness, tags, black
  and frozen frames, a contact sheet), and release manifests with hashes and provenance.
  Same-host renders are byte-identical.
- **The video slot**: `aiv new`, `video.json` and `series.json` schemas, lifecycle gates
  with human approvals, frozen published videos, generated catalog and index, and
  `aiv check` (schemas, gates, generated files, file hygiene, privacy, provenance, docs)
  as a pre-commit hook.
- **Templates** for both engines, five series guides, the two earlier films as catalog
  records, knowledge cards for verified techniques, reference notes, Claude Code skills
  and a frame-critic agent.
- **Host safety** for small machines: a machine-wide heavy-job lock, a free-memory guard,
  time budgets and a sweep of orphaned browsers.
- REUSE-compliant licensing (MIT code, CC BY 4.0 prose and media) and CI on Linux and
  Windows that also renders both templates.
