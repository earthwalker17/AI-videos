# GitHub storage limits — files, LFS, Releases, Pages, runners

| | |
|---|---|
| Upstream | GitHub Docs source https://github.com/github/docs (content/repositories/working-with-files/managing-large-files/*, content/billing/concepts/product-billing/git-lfs.md, content/repositories/releasing-projects-on-github/about-releases.md, content/pages/getting-started-with-github-pages/github-pages-limits.md); rendered at https://docs.github.com |
| Pin | github/docs `33b1f4a6fec2d9b6fd3d374afa56bcd9f0875b57` (2026-10-31) |
| Licence | CC BY 4.0 (GitHub docs content): short excerpts with attribution allowed |
| Accessed | 2026-11-01 |
| Stale after | 2027-05-01, or on any GitHub billing announcement. |

## What it is
The size, bandwidth and hosting limits that decide where each kind of file in this repo lives.

## Why it matters here
The repo is public and will hold 50–100 videos. LFS mistakes are billed to the owner and
cannot be undone without recreating the repo; Pages has a hard size cap.

## Key facts
**Repository files** [V]
- Git warns on files over 50 MiB; GitHub blocks files over 100 MiB; browser uploads max 25 MiB.
- Repositories should ideally stay under 1 GB;
  > Quoted from https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github (accessed 2026-11-01): "less than 5 GB is strongly recommended"

**Git LFS** [V]
- Free (and Pro) include 10 GiB storage and 10 GiB bandwidth per month; per-file maximum 2 GB on Free; usage is billed to the repository owner, public repos included.
  > Quoted from https://docs.github.com/en/billing/concepts/product-billing/git-lfs (accessed 2026-11-01): "Forking and pulling a repository counts against the parent repository's bandwidth usage."
- LFS downloads by GitHub Actions count against the owner too. With a $0 budget, LFS is blocked for the rest of the month once bandwidth runs out.
- Removing LFS objects requires deleting and recreating the repository (losing stars and issues).
- Legacy overage prices were $0.07/GiB-month storage and $0.0875/GiB bandwidth; current docs defer to a calculator [S].

**Releases** [V]
- Each asset must be under 2 GiB; up to 1000 assets per release.
  > Quoted from https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases (accessed 2026-11-01): "no limit on the total size of a release, nor bandwidth usage"

**Pages** [V]: published site at most 1 GB; soft bandwidth limit 100 GB/month; 10-minute deploy timeout. lemo-opuscar's 73 web cuts are already ~0.7 GB, so copying cuts into a Pages site does not scale to 100 videos.

**Actions runners for public repos** [V]: standard Linux runner 4 vCPU, 16 GB RAM, 14 GB SSD, free; 6-hour job limit; 10 GB cache; no GPU (WebGL only via SwiftShader).

**Non-GitHub stores** (from the gen-AI research) [V]
- Hugging Face: free public storage is "best-effort"; free private storage 100 GB; recommended < 100k files per repo, < 10k entries per folder; Storage Buckets are a mutable, non-versioned, S3-compatible repo type.
- Cloudflare R2: 10 GB-month free, then $0.015/GB-month, zero egress; `r2.dev` URLs are for non-production traffic, so public use needs a custom domain.

**Evidence from other repos** [V] (see `multi-video-repos.md`): incomplete LFS patterns letting ~98 MiB `.MOV` files into plain git; 700–870 MB repos from committed media and notebooks; HyperFrames notes that non-recursive LFS patterns leaked binaries into history permanently.

## What we adopted / adapted
- Storage tiers, no Git LFS: **T0** git = text plus binaries ≤ 2 MiB each; **T1** GitHub Releases = delivery file and archival master, each ≤ 2 GiB, tracked by a sha256 release manifest; **T2** local or private = ProRes, non-redistributable files, recorded by hash only.
- `aiv check` enforces the 2 MiB cap; generated outputs (`out/`, `.cache/`) never enter git.
- Pages (if used) holds posters and stills and embeds YouTube or links Release assets.
- CI runs on free runners: typecheck, lint, tests, checks and tiny `swangle` smoke renders asserting ranges, not bytes.

## What we deliberately did NOT adopt, and why
- Git LFS, even for small binaries: bandwidth from forks and CI is billed to the owner; mistakes are permanent.
- Copying release media into the Pages site: 1 GB cap.
- DVC: heavier than a sha256 manifest plus fetch script.

## Gotchas
- Gitignore cannot re-include a file under an ignored directory: ignore `dir/*`, then whitelist the manifest.
- Release asset URLs redirect to a download host; whether they stream well in a `<video>` element (range requests, content-disposition) is unverified.
- Free runners have more RAM than the reference laptop but no GPU: hardware-GL checks stay local.

## Not read
Release download rate limits; GitHub Packages and container registry quotas; Actions artifact storage and retention limits; LFS on paid plans; whether Release assets stream in browsers.
