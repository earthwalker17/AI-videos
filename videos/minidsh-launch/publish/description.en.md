# Title and description as uploaded (YouTube, 2026-11-24 23:44 UTC)

Read back from the public watch page on 2026-11-25. The creator edited the draft before the
upload; the text below is theirs, as published.

**Title:** My MiniDSH 2.0 is Finally Out: One Runtime, Three Surfaces

MiniDSH is a small, local-first coding agent harness for your terminal, browser and desktop. All of them sit above one runtime and share the same stored sessions.

Install: npm install -g minidsh
GitHub: https://github.com/earthwalker17/MiniDSH

The film follows real sessions, recorded live on the published 2.0.0 package and installer, with the waits shortened:
- In the terminal, the agent fixes a failing test. Its first edit is refused because the file hasn't been read yet; It then reads the file, edits it, and both tests pass.
- The same session opens in the browser. There, the edit carries the runtime's own record of what it wrote (its size and hash), not the model's account of it; A follow-up needs to write outside the project: the sandbox refuses the write, the agent asks to run that one command with full access, and you allow it once.
- The desktop app is the web UI in its own window, with its own Node inside. Quit it mid-turn and the session is kept.

There are four ways in: the terminal, the web UI, the desktop app and a headless run. Underneath them is one runtime in four layers, which works with DeepSeek, Anthropic and OpenAI using your own key.

MiniDSH is my own experiment and learning resource first: an architecture small enough to read whole. It studies DeepSeek Harness (DSH) as a textbook and is written independently from scratch. It doesn't compete with DSH or other similar products.

The film is made with code by Opus 5.5 in Claude Code under my direction: real captures of the product, staged by a WebGL page, with a score written as code. No generative image, video or music model was used. The film's source and the production framework:
https://github.com/earthwalker17/AI-videos

An independent project inspired by DeepSeek Harness. Not affiliated with or endorsed by DeepSeek. Its web UI adapts design tokens and icons from DeepSeek Harness (MIT, © DeepSeek; see MiniDSH's NOTICE).

#aiagents #opensource #developertools #deepseek #claudecode

## What the watch page shows (2026-11-25)
- **Captions:** only YouTube's auto-generated English track. `captions/en.srt` was not uploaded;
  it can still be added in Studio.
- **Chapters:** none; the description carries no chapter list. [chapters.md](chapters.md) is kept
  for a later edit.
- **Licence:** the page does not show it. `video.json` `license.film` is CC BY 4.0, which holds
  for the film whatever YouTube's setting.
- **The thumbnail** on YouTube is the creator's export, with the model's drawing of the mark;
  `thumbnail.jpg` here carries the real mark
  ([thumbnail.provenance.json](thumbnail.provenance.json)).
- **"No generative image, video or music model"** is about the film; the thumbnail is ChatGPT's
  ([ai-disclosure.md](ai-disclosure.md)).

## For X (draft, not yet posted; 277 of 280 characters, the link counted as 23)

> MiniDSH 2.0: one runtime, every surface.
>
> A small, local-first coding agent for your terminal, browser and desktop. Real tools and kept sessions; by default, wider writes need approval. Your own DeepSeek, Anthropic or OpenAI key.
>
> npm install -g minidsh
> github.com/earthwalker17/MiniDSH

Attach the delivery file (`minidsh-launch-v1.mp4` in the GitHub release `video/minidsh-launch/v1`,
1080p60, 84 s, H.264 and AAC, within X's upload limits). Post as the first reply: "An independent
project inspired by DeepSeek Harness. Not affiliated with or endorsed by DeepSeek. Its web UI
adapts design tokens and icons from DeepSeek Harness (MIT, © DeepSeek)."

## For Product Hunt (draft, not yet posted)

- **Name:** MiniDSH
- **Tagline** (50 characters): A small, local-first coding agent with one runtime
- **Description** (259 characters, within 260): A small, architecture-first coding-agent harness. Terminal, web UI, desktop app and headless run share one runtime and stored sessions. By default it writes only in your workspace; a command needing more asks. Bring your own DeepSeek, Anthropic or OpenAI key.
- **Topics:** Developer Tools, Open Source, Artificial Intelligence
- **Logo:** MiniDSH's own `docs/images/logo/minidsh-logo-240.png` (240×240).
- **Gallery:** the thumbnail and two or three real stills from the final (the Record card, the
  approval card, the end card); the video: https://youtu.be/HpzzGoYtYEc
- **First comment:** MiniDSH is my own project, an experiment and a learning resource first: an architecture you can read and change. Its code is free and MIT-licensed; model calls are billed by your provider, on your own key. An independent project inspired by DeepSeek Harness. Not affiliated with or endorsed by DeepSeek. Its web UI adapts design tokens and icons from DeepSeek Harness (MIT, © DeepSeek).
