# Title and description (draft for the creator to edit before upload)

**Title:** MiniDSH 2.0: One Runtime, Every Surface

MiniDSH 2.0 is a small, local-first coding agent for your terminal, your browser and your desktop. All of them run on one runtime and share the same stored sessions.

The film follows real sessions, recorded live on the published 2.0.0 package and installer, with the waits shortened:

- In the terminal, the agent fixes a failing test. Its first edit is refused because it has not read the file yet. It reads the file, edits it, and both tests pass.
- The same session opens in the browser. Every effect there carries the runtime's own record, not the model's account of it. A follow-up needs to write outside the project, so the agent asks first, and you allow it once.
- The desktop app is the web UI in its own window, with its own Node. Quit it mid-turn and the session is kept.

There are four ways in: the terminal, the web UI, the desktop app and a headless `run`. Underneath them is one runtime in four layers, which works with DeepSeek, Anthropic or OpenAI using your own key.

MiniDSH is an experiment and a learning resource first: an architecture small enough to read whole. It studies DeepSeek Harness as a textbook and is written independently of it. It does not compete with DSH or with any product.

Install: `npm install -g minidsh` (Node 24+), or the installers on the release page. The installers are not signed, so Windows and macOS warn at first.
https://github.com/earthwalker17/MiniDSH

The film is made with code: real captures of the product, staged by a WebGL page, with a score written as code. Its source and the production framework are here:
https://github.com/earthwalker17/AI-videos

MiniDSH is an independent project inspired by DeepSeek Harness. Not affiliated with or endorsed by DeepSeek. Its web UI adapts design tokens and icons from DeepSeek Harness (MIT).

#codingagent #opensource #localfirst #deepseek #claudecode
