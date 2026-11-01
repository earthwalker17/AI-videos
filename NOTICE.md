# Notice

This repository adapts code from the open-source projects below. Each adapted file
keeps an `SPDX-License-Identifier` header and an `Adapted from <url>@<commit>` line;
files adapted from a third party also keep that party's `SPDX-FileCopyrightText`.
Ideas and methods taken without code are credited in the relevant `ENGINE.md`,
knowledge card or [reference note](references/README.md) instead.

How this repository is licensed: [`docs/LICENSING.md`](docs/LICENSING.md).

## Upstream projects

| Project | Commit | Licence | Copyright |
|---|---|---|---|
| [earthwalker17/map-of-middle-earth](https://github.com/earthwalker17/map-of-middle-earth) | [`696e968`](https://github.com/earthwalker17/map-of-middle-earth/tree/696e968e9d550327beda9e663ef5aec6961583c9) | MIT | earthwalker17 (same author) |
| [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) | [`bebbbe1`](https://github.com/lemomo-ai/lemo-opuscar/tree/bebbbe1aa92a3cb4bb6f83500e61b23a17d1aa00) | MIT | Copyright (c) 2026 LemoLab |

The MIT licence text that applies to both is in [`LICENSES/MIT.txt`](LICENSES/MIT.txt).

## What was adapted

### map-of-middle-earth @ 696e968
The capture, host-safety and encode stack of *Journey Through Middle-Earth*,
generalised from one film to any video and any engine.

| Here | Upstream file |
|---|---|
| `packages/core/src/rng.ts` | [src/core/rng.ts](https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/src/core/rng.ts) (bit-identical output) |
| `packages/pipeline/src/host/lock.ts`<br>`packages/pipeline/src/host/abort.ts` | [tools/capture/gpuLock.ts](https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/gpuLock.ts) |
| `packages/pipeline/src/host/memory.ts`<br>`packages/pipeline/src/host/orphans.ts`<br>`packages/pipeline/src/host/keepAwake.ts` | [tools/capture/host.ts](https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/host.ts) |
| `packages/pipeline/src/host/heavy.ts` | [tools/heavy.ts](https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/heavy.ts) |
| `packages/pipeline/src/media/presets.ts`<br>`packages/pipeline/src/media/encoder.ts`<br>`packages/pipeline/src/media/probe.ts`<br>`packages/pipeline/src/media/mux.ts` | [tools/capture/ffmpeg.ts](https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/ffmpeg.ts) |
| `packages/pipeline/src/runner/runner.ts` | [tools/capture/film.ts](https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/film.ts) |
| `engines/web/src/harness/browser.ts` | [tools/capture/browser.ts](https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/browser.ts) |
| `engines/web/src/harness/server.ts` | [tools/capture/server.ts](https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/server.ts) |
| `engines/web/src/harness/adapter.ts` | [tools/capture/session.ts](https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/session.ts) |
| `engines/web/src/page/index.ts` | [src/render/capture.ts](https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/src/render/capture.ts) |

### lemo-opuscar @ bebbbe1

| Here | Upstream file |
|---|---|
| `packages/pipeline/src/media/audio.ts` | [core/render/mux.sh](https://github.com/lemomo-ai/lemo-opuscar/blob/bebbbe1aa92a3cb4bb6f83500e61b23a17d1aa00/core/render/mux.sh): two-pass loudnorm with measured values and `linear=true`, exact-length padding and trimming |

## Dependencies
npm dependencies are installed from the registry and not redistributed here. Some
carry terms for whoever renders with them (notably Remotion, which has its own
licence); see [`docs/LICENSING.md`](docs/LICENSING.md#dependencies-with-their-own-terms).
