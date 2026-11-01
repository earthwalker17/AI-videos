# Journey Through Middle-Earth

A west-to-east grand tour of a floating miniature Middle-earth over one day of light,
from dawn in the Shire to moonlit Mordor, rendered entirely in code.

▶ **Watch:** https://youtu.be/kRuPq4GjhGc
**Source:** [earthwalker17/map-of-middle-earth](https://github.com/earthwalker17/map-of-middle-earth/tree/v1.0.0), tag `v1.0.0` (commit `eb36690`, the film's release)

This is a **metadata-only entry**. The film was made in its own repository before
this one existed; its code, data and renders stay there. It is listed here because
much of this repository's shared tooling was lifted from it.

## How it was made
- **Picture:** a custom three.js WebGPU + TSL renderer (terrain from community GIS
  data, atmosphere, vegetation, 24 procedural landmarks). Frames are captured
  offline by a Playwright harness: every frame is a pure function of a compiled
  timeline, read back from a render target (not screenshotted) and streamed to
  FFmpeg. The final tier uses adaptive supersampling: 12–48 samples per pixel,
  180° shutter motion blur, aperture depth of field, AgX tone mapping and film grain.
- **Sound:** an original orchestral score written as Python code, played by the
  CC0 VSCO 2 Community Edition samples through sfizz, then mixed and mastered in
  numpy to -16 LUFS.
- **Delivery:** 1920×1080, 24 fps, 227.75 s (5,466 frames), as an H.264 delivery
  file plus a ProRes 422 HQ master, both recorded with SHA256 in a release manifest.
- **Verification:** the final 11-hour render ran unattended on an Intel UHD laptop.
  Twelve sample frames re-rendered afterwards were bit-identical to the film.

## What this repository took from it
The code was adapted from commit `696e968`, two commits after `v1.0.0`;
[NOTICE](../../NOTICE.md) lists each adapted file.

- Host safety for a small machine: free-RAM guard, machine-wide lock, orphan
  browser sweep (`packages/pipeline`).
- The deterministic browser capture harness and frame sink (`engines/web`).
- The chunked, resumable render runner keyed to its inputs, encode presets with
  explicit BT.709 conversion, and the release-manifest discipline.

## Lessons
See the [map-of-middle-earth reference note](../../references/map-of-middle-earth.md).

## Licence and trademarks
<!-- REUSE-IgnoreStart: third-party rights, not notices for this file -->
This entry's text is CC BY 4.0. The film, its score and its renders are **not**
licensed for reuse: they are a non-commercial fan work. *The Lord of the Rings*,
*The Hobbit* and Middle-earth are trademarks of Middle-earth Enterprises; the books
are © The Tolkien Estate. The film is not affiliated with or endorsed by the Tolkien
Estate, Middle-earth Enterprises, HarperCollins, New Line Cinema, Warner Bros.,
Wētā Workshop, or any data author or artist credited in the source repository.
<!-- REUSE-IgnoreEnd -->
