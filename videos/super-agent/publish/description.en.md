# Title and description (proposed; the creator decides at upload)

**Title:** Who Routes the Agents?

**Alternative titles** (each under 70 characters):
- Who Routes the Agents? One Router, Many Workers, Explained
- I Made an Explainer on AI Agent Routing with Opus 5.5
- Who Routes the Agents? DeepSeek's Super-agent Design, Explained (the only title that names the
  company, where it reads closest to official material; the body carries the non-affiliation
  line, and docs/LICENSING.md rules out anything that implies endorsement)

**Description** (paste the text below the rule as plain text: YouTube does not render Markdown.
YouTube's Data API allows a description of at most 5,000 bytes, with no angle brackets; this
body is about 4,750 bytes and has none. Neither rule is in references/youtube-publishing.md yet.)

**Before pasting:**
- Confirm that the final passed `aiv qa`: the body says automated QA checked every cut.
- The film-folder link, and the FACTS.md it leads to, resolve only once `main` is pushed, and the
  push waits until the film is published. Push straight after the upload, or paste the body
  without that link and add it after the push. After `aiv release` the frozen copy is at
  https://github.com/earthwalker17/AI-videos/tree/video/super-agent/v1/videos/super-agent, which
  can replace the link then. The repository link just above it works today.

---

When one person runs many AI agent sessions, that person quietly becomes their router: switching between sessions, prompting each run, waiting, and keeping it all running. In the authors' experience, a person can usually follow only 3 to 5 active sessions at once.

This text-led explainer (no voice) walks through "Exploring Super-agent Design: Towards a More Autonomous Agent System" by the DeepSeek Harness team, written by Yujia Qiao. Its answer is two levels: one long-lived Router hears every channel, hands each task over whole and never does the work; below it, each task gets its own Worker, context and tools. Sessions should be, in the article's words, "an implementation detail of the system, not a mental burden on its users."

Along the way: listening for events instead of a prompt for each run (by design), how one Router keeps up (batching, context as a cache, recall by ID), follow-ups that go straight to their Worker, and jobs that run in the background, so new input never waits on them.

It keeps three things apart:
- Built (solid): what the public research prototype has at commit 8c32a9d, such as the two levels, the two-stage event filter and the 100-word cap on chat replies. Out of the box it only records work nobody asked for, rather than taking it on.
- Shown in the authors' synthetic test (simulated coding, five runs per design, "indicative only" in their words): the slowest tasks took about half the time of a single session, typical tasks were only about 10% faster than the stronger baseline (a single session told to delegate), and the two levels used 2–4× the cache-read tokens of the single-session designs.
- Proposed (dashed): a cloud loop that works while your laptop sleeps, and a watchdog that checks progress. Still open (sketched): sharding the Router, stepping in midway, and a hijacked loop that could reach every connected machine.

Chapters
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

How it was made
I made this film with Opus 5.5 in Claude Code, and every frame and every note is code. The picture is Remotion 4 with a lit WebGL world (three.js through React Three Fiber) under a DOM text layer: a desk of paper, light and machines, where the Router is a register deck with a tape reel and each Worker a walled bay. The score is original, synthesised in TypeScript, with no samples. No generative image, video, music or voice model is used.

My first look test was too simple and crude, so the look was rebuilt as this lit desk, and the story grew from under three minutes to nearly four to explain how the design works, not only the problem. AI frame critics reviewed rendered frames over several rounds, a reviewer agent with no project context told me what it took away, and automated QA checked every cut (loudness, black and frozen frames). Every claim on screen is listed with its source in the film's FACTS.md.

The film lives in my AI Videos repository, which builds shared infrastructure for rendering, audio, QA and reproducible releases:
https://github.com/earthwalker17/AI-videos
Its script, facts, sources, code and score are in the film's folder:
https://github.com/earthwalker17/AI-videos/tree/main/videos/super-agent

Sources
The article (English machine translation, X, 1 Nov 2026): https://x.com/i/article/2116829218935857152
The Chinese original (WeChat, 31 Oct 2026 per press reports; the link as given in a third-party post, not read: WeChat showed a verification page): https://mp.weixin.qq.com/s/zoS7GlReWPhfCjENGxXCdg
The research prototype at the commit the film describes: https://github.com/deepseek-ai/dsh-superagent-prototype/tree/8c32a9dc5d72c033816c6a8110b37f40cf94fba4

None of this is new theory, as the authors say. For classic reading behind it (my pointers, not the article's), try Lampson's "Hints for Computer System Design" (1983) and Denning's working set (1968).

The film is licensed CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
The code in the repository is MIT.

This film is an independent explainer. It is not affiliated with, sponsored or endorsed by DeepSeek or the DeepSeek Harness team; their names only identify the work being explained. The prototype is a research prototype, not an official DeepSeek product. The film shows no logos or interfaces, and its charts are re-plotted from the article's published numbers rather than copied from its figures.

#claudecode #aiagents #creativecoding #threejs #remotion #explainer
