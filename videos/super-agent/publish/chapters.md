# Chapters

For the YouTube description, which is where YouTube reads them from (`description.en.md` carries
the same list). YouTube's rules (references/youtube-publishing.md, chapters): the first timestamp
is 0:00 (00:00 in that note), at least three timestamps in ascending order, and each
chapter at least 10 seconds long.

```text
0:00 Your agents work in parallel
0:13 The human router
0:32 Two easy fixes
0:48 Two levels: Router and Workers
1:17 Prompting, handed over (by design)
1:30 How one Router keeps up
1:54 Waiting, handed over
2:10 The evidence: a synthetic test
2:32 Keeping it running (proposed)
2:45 Still open
3:01 Old ideas, and what it means
3:25 Sources and credits
```

**How the times are computed.** Each chapter starts on a story beat of `src/cues.ts` (`BEATS`).
Bar n starts at film frame (n − 1) × 80 (90 bpm, 4/4, 20 frames a beat at 30 fps). The final has
no test-card leader (`LEADER_FRAMES` = 0), so a film frame is a frame of the delivered video and
its time is frame / 30, written as M:SS rounded down. The film is 6,720 frames (3:44.0).

| Chapter | Beat (name in `src/cues.ts`) | Bar | Film frame | Seconds | Time | Length |
|---|---|---|---|---|---|---|
| Your agents work in parallel | 1 (Hook) | 1 | 0 × 80 = 0 | 0 / 30 = 0.000 | 0:00 | 13.3 s |
| The human router | 2 (The human router) | 6 | 5 × 80 = 400 | 400 / 30 = 13.333 | 0:13 | 18.7 s |
| Two easy fixes | 3 (Two easy fixes) | 13 | 12 × 80 = 960 | 960 / 30 = 32.000 | 0:32 | 16.0 s |
| Two levels: Router and Workers | 4 (Two levels (the turn): remembering, handed over) | 19 | 18 × 80 = 1440 | 1440 / 30 = 48.000 | 0:48 | 29.3 s |
| Prompting, handed over (by design) | 5 (Prompting each run, handed over (by design)) | 30 | 29 × 80 = 2320 | 2320 / 30 = 77.333 | 1:17 | 13.3 s |
| How one Router keeps up | 6 (How one Router keeps up) | 35 | 34 × 80 = 2720 | 2720 / 30 = 90.667 | 1:30 | 24.0 s |
| Waiting, handed over | 7 (Waiting, handed over) | 44 | 43 × 80 = 3440 | 3440 / 30 = 114.667 | 1:54 | 16.0 s |
| The evidence: a synthetic test | 8 (Many runs: the evidence) | 50 | 49 × 80 = 3920 | 3920 / 30 = 130.667 | 2:10 | 21.3 s |
| Keeping it running (proposed) | 9 (Keeping it running, handed over (proposed)) | 58 | 57 × 80 = 4560 | 4560 / 30 = 152.000 | 2:32 | 13.3 s |
| Still open | 10 (Still open) | 63 | 62 × 80 = 4960 | 4960 / 30 = 165.333 | 2:45 | 16.0 s |
| Old ideas, and what it means | 11 (Sign-off, old ideas, meaning) and 12 (Bookend) | 69 | 68 × 80 = 5440 | 5440 / 30 = 181.333 | 3:01 | 24.0 s |
| Sources and credits | 13 (End card) | 78 | 77 × 80 = 6160 | 6160 / 30 = 205.333 | 3:25 | 18.7 s |

The lengths run to the next chapter's frame, and the last to the film's end (frame 6720, 224.0 s).
Every chapter is at least 10 seconds long, also between the rounded-down timestamps (the shortest,
0:00–0:13, 1:17–1:30 and 2:32–2:45, are 13 s).

**One merge.** Beat 12, the bookend (bars 76–77, frames 6000–6159), is 160 frames, 5.3 s: too
short for a chapter of its own. It is C28's line ("Your agents work in parallel. By design, you
don't have to."), the film's closing words, so it joins beat 11, whose lines it concludes. Beat
13 then starts the end card chapter on the dissolve at frame 6160, with the source, the credits,
the non-affiliation line and the status key.

If a beat's bar in `src/cues.ts` changes, recompute this table and the list in
`description.en.md`.
