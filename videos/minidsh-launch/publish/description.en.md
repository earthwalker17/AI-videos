# Title and description (draft for the creator to edit before upload)

The YouTube text is plain text: paste it as it stands (no Markdown in it). Upload notes follow it.

**Title:** MiniDSH 2.0: One Runtime, Every Surface

MiniDSH 2.0 is a small, local-first coding agent for your terminal, your browser and your desktop. All of them run on one runtime and share the same stored sessions.

Install: npm install -g minidsh · https://github.com/earthwalker17/MiniDSH

The film follows real sessions, recorded live on the published 2.0.0 package and installer, with the waits shortened:

- In the terminal, the agent fixes a failing test. Its first edit is refused because it has not read the file yet. It reads the file, edits it, and both tests pass.
- The same session opens in the browser. There, the edit carries the runtime's own record of what it wrote (its size and hash), not the model's account of it. A follow-up needs to write outside the project: the sandbox refuses the write, the agent asks to run that one command with full access, and you allow it once.
- The desktop app is the web UI in its own window, with its own Node inside. Quit it mid-turn and the session is kept.

There are four ways in: the terminal, the web UI, the desktop app and a headless run. Underneath them is one runtime in four layers, which works with DeepSeek, Anthropic or OpenAI using your own key.

MiniDSH is my own project, an experiment and a learning resource first: an architecture small enough to read whole. It studies DeepSeek Harness (DSH) as a textbook and is written independently of it. It does not compete with DSH or with any product.

It needs Node 24 or later; on Windows also PowerShell 7, and on Linux bubblewrap, so that shell commands can be confined. Desktop installers for Windows, macOS and Linux are on the release page. They are not signed by a publisher, so Windows and macOS may warn or block them at first; the guide has the steps and how to check a download against SHA256SUMS.

The film is made with code, written by Claude Code (Claude Opus 5.5) under my direction: real captures of the product, staged by a WebGL page, with a score written as code. No generative image, video, music or voice model was used. MiniDSH's own code was also written by coding-agent sessions, against an architecture written down first; its case study reports what held and what did not. The film's source and the production framework:
https://github.com/earthwalker17/AI-videos
The film is CC BY 4.0 and its code MIT; MiniDSH is MIT.

Chapters
0:00 Terminal: no edit before a read
0:18 Browser: the same session, the runtime's record
0:28 Permission: a write outside the workspace needs approval
0:40 Desktop: quit mid-turn, the session is kept
0:52 One runtime
1:08 Install

MiniDSH is an independent project inspired by DeepSeek Harness. Not affiliated with or endorsed by DeepSeek. Its web UI adapts design tokens and icons from DeepSeek Harness (MIT, © DeepSeek; see MiniDSH's NOTICE).

#codingagent #opensource #localfirst #deepseek #claudecode

## Upload notes (not part of the description)
- **Licence:** Creative Commons – Attribution (`video.json` `license.film` is CC BY 4.0).
- **Captions:** upload `publish/captions/en.srt` as English.
- **Chapters:** the block above is [chapters.md](chapters.md); YouTube builds chapters only from
  the description.
- **The AI-videos link** shows the film's source only once `main` is pushed: push before the
  description goes public, or right after the upload.
- **Thumbnail:** any product UI in it is a real capture (series rule: generative AI only for
  backgrounds, never a fabricated product screen). Frame 0 of the final is the poster.

## For X (draft; 277 of 280 characters, the link counted as 23)

> MiniDSH 2.0: one runtime, every surface.
>
> A small, local-first coding agent for your terminal, browser and desktop. Real tools and kept sessions; by default, wider writes need approval. Your own DeepSeek, Anthropic or OpenAI key.
>
> npm install -g minidsh
> github.com/earthwalker17/MiniDSH

Attach the delivery file (`minidsh-launch.mp4`, 1080p60, 84 s, H.264 and AAC, within X's upload
limits). Post as the first reply: "An independent project inspired by DeepSeek Harness. Not
affiliated with or endorsed by DeepSeek. Its web UI adapts design tokens and icons from DeepSeek
Harness (MIT, © DeepSeek)."

## For Product Hunt (draft)

- **Name:** MiniDSH
- **Tagline** (50 characters): A small, local-first coding agent with one runtime
- **Description** (259 characters, within 260): A small, architecture-first coding-agent harness. Terminal, web UI, desktop app and headless run share one runtime and stored sessions. By default it writes only in your workspace; a command needing more asks. Bring your own DeepSeek, Anthropic or OpenAI key.
- **Topics:** Developer Tools, Open Source, Artificial Intelligence
- **Logo:** MiniDSH's own `docs/images/logo/minidsh-logo-240.png` (240×240).
- **Gallery:** the thumbnail and two or three real stills from the final (the Record card, the
  approval card, the end card); the YouTube link as the video, public before the launch.
- **First comment:** MiniDSH is my own project, an experiment and a learning resource first: an architecture you can read and change. Its code is free and MIT-licensed; model calls are billed by your provider, on your own key. An independent project inspired by DeepSeek Harness. Not affiliated with or endorsed by DeepSeek. Its web UI adapts design tokens and icons from DeepSeek Harness (MIT, © DeepSeek).
