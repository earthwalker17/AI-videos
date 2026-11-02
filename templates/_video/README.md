<!-- aiv:stub: write this file, then delete this line (aiv check counts a file holding it as not written) -->
# {{title}}

One or two sentences: what this video is and who it is for.

**Series:** {{series}} · **Number:** {{number}} · **Engine:** {{engine}}
▶ **Watch:** the YouTube link, once published.

## How it was made
The stack, how the code is organised, and the numbers that matter (length, frame rate,
render time per frame, total render time).

## Reproduce it
```sh
pnpm aiv audio {{slug}}            # videos with a score (audio/)
pnpm aiv render {{slug}} --profile final
pnpm aiv post {{slug}} --profile final
pnpm aiv qa {{slug}} --profile final
```
A published video is rebuilt from its release tag `video/{{slug}}/v<N>`, not from `main`.

## Reusable
What others can lift from this video (also listed in `video.json` `reusable`).

## Lessons
What this video taught that the next one should know. Verified lessons become
[knowledge cards](../../knowledge/README.md).

## Licence
This text is CC BY 4.0 and the code MIT ([licensing](../../docs/LICENSING.md)). The film
itself: see `video.json` `license` and `CREDITS.md`.
