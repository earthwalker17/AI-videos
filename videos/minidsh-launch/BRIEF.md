# Brief: MiniDSH 2.0: One Runtime, Every Surface

The launch film for MiniDSH 2.0, the creator's own small coding-agent harness
([github.com/earthwalker17/MiniDSH](https://github.com/earthwalker17/MiniDSH), MIT). The brief was
given on 2026-11-24 and planned the same day. MiniDSH's own roadmap names this film as its next step
(BLUEPRINT §1, "S23 Launch material").

## Audience
- **Who.** Developers who use or follow AI coding agents: on YouTube, on X and on Product Hunt.
- **What they know.** Most have never heard of MiniDSH. Some know DeepSeek Harness (DSH), which
  MiniDSH studies, and may assume a link that does not exist.

## Promise
In about 80 seconds, the viewer sees one real coding task done by MiniDSH. It runs in the terminal,
continues in the browser and has its own desktop app. The viewer leaves knowing three things:
- MiniDSH checks the model (no edit before a read, writes fenced, wider actions asked);
- it keeps a record (every step in a log; sessions outlive the process);
- all of it is one small runtime behind every surface.

## Shape
- **Length.** About 84 s: 42 bars at 120 bpm, inside the 1–2 minutes asked for.
- **Format.** 16:9, 1920×1080, web engine. 60 fps unless the pilot measures it too costly; 30 is
  acceptable, and the reference is 30.
- **Language.** English only. No voice; concise animated titles in the scene; captions drafted
  from the cue sheet.
- **Score.** An original score in code, cut to the same cue sheet.
- **Footage.** Real product footage only:
  - live sessions on DeepSeek, from the published npm package (2.0.0) and the published Windows
    installer;
  - the terminal and the browser in WSL, one session carried from one to the other;
  - the desktop app on Windows, as its own session of a different task.
- **Text bar.** Text a viewer must read is at least 36 px (font size) at 1080p; the creator chose
  the font-size reading on 2026-11-24. Product UI is magnified about ×2.6 to reach it; UI shown as
  a picture is texture (at least 18 px).
- **Series.** `product-launch`, its first film.

## Scope (what the film covers and leaves out)
- **Covered:** MiniDSH 2.0.0: the terminal UI, the web UI, the desktop app (Windows), and the
  headless `run` named in the runtime map.
- **Not shown:** macOS and Linux desktop builds (they exist; only the Windows build was used by
  hand); skills, background jobs, the browser tool, delegation, compaction.
- **Never claimed:**
  - an official, native, offline or private product;
  - a tiny codebase;
  - read or network sandboxing;
  - shell confinement on Windows;
  - any comparison with DSH.
- The end card carries the project's own non-affiliation line ([FACTS.md](FACTS.md)).

## References
- **The bar: the DSH "Creator Mode" film** (X, 2026-11-02; 99 s, 1080p30). Studied locally under
  `.cache/refs/minidsh-launch/`, never committed.
  - Learn from: real UI close-ups, cursor-driven interaction, the demo-then-statement rhythm.
  - Never copy: its titles, colours, type, backgrounds, logo or montage devices
    (see [TREATMENT.md](TREATMENT.md)).
- **Method: op7418/guizang-product-video-skill @ `18842e0`** (AGPL-3.0). Read as a guide only;
  nothing of it is in this repository or the film
  ([references/guizang-product-video-skill.md](../../references/guizang-product-video-skill.md)).
- **MiniDSH's own pictures and recorded session** (`docs/images/` at v2.0.0): the zero-cost fallback
  for any surface whose live take fails.

## Risks
- **Facts.** Every on-screen line is checked against MiniDSH's sources ([FACTS.md](FACTS.md)).
  Several tempting lines overclaim, found by a fact check on 2026-11-24.
- **Live takes vary.** The edit refusal and a clean escalation may not recur. The plan allows at
  most three takes per surface and holds fallback copy; nothing is staged.
- **Privacy.** No key, user name or home path in any frame or log: neutral paths
  (`/code/tinytable`, `C:\code\tinytable`), MiniDSH's own log scanner, and a look at every
  still.
- **Rights.**
  - The captures show MIT software (MiniDSH).
  - Its web UI adapts DSH's design tokens and icons (MIT, © DeepSeek), credited in
    [CREDITS.md](CREDITS.md).
  - The model's words on screen are product output.
- **Budget.** One session of about 20 hours on an 8 GB laptop. The plan's shortcuts, in order: 30 fps,
  desktop stills only, the published fallback pictures, one draft round.
