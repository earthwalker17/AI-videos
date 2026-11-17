# DeepSeek Harness "Super-agent" design article and its research prototype (2026-11)

| | |
|---|---|
| Upstream | Article (English, X): https://x.com/DeepSeekHarness/status/2116857257245987236 · Chinese original (WeChat, not read): https://mp.weixin.qq.com/s/zoS7GlReWPhfCjENGxXCdg · prototype: https://github.com/deepseek-ai/dsh-superagent-prototype · DeepSeek Harness: https://github.com/deepseek-ai/deepseek-harness |
| Pin | Article: X article id `2116829218935857152`, status `2116857257245987236`, created and last modified 2026-11-01T11:37:54Z, 143 blocks (read as JSON through the public api.fxtwitter.com proxy; re-read there on 2026-11-09: still 143 blocks, modified time unchanged). Wayback: the X status at `20261104183343`, the prototype repo page at `20261104092814`. Prototype `8c32a9dc5d72c033816c6a8110b37f40cf94fba4` (its only commit). DeepSeek Harness `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` (2026-11-04, branch `master`). Article text: sha256 of the UTF-8 `JSON.stringify(blocks.map(b => b.text))` over the proxy JSON's `article.content.blocks` is `d1a1fdc670eb78799d37237e73a4597e7b3cb5029a59f6deb16e2eab27d458b9` (143 blocks, modified 2026-11-01T11:37:54Z), the same in the three fetches of 2026-11-08 and 2026-11-09 (computed 2026-11-15). Recompute it on a re-fetch to see whether the text changed; a whole-file hash changes with the reach counts. |
| Licence | Article and figures: no licence stated, so facts are paraphrased, quotes stay short and figures are never reused. Prototype and DeepSeek Harness: MIT ("Copyright (c) 2026 DeepSeek Harness Team" for the prototype). |
| Accessed | 2026-11-08 (prototype and Harness first read 2026-11-07, about 23:40 UTC). The mechanism details and matrix notes were re-checked 2026-11-09: the article through the proxy, the prototype files and Harness presets at the pins. |
| Stale after | 2026-12-08 for the prototype, the Harness (a pre-1.0 developer preview) and the reach counts. V2's script locked on 2026-11-17 against the text hash re-checked on 2026-11-16; check the article for edits or errata (the text hash in Pin) again before any later film or correction. |

## What it is
A design essay by the DeepSeek Harness team, *Exploring Super-agent Design: Towards a More Autonomous Agent System*; Yujia Qiao implemented the system and wrote the article (block 143). It argues that once one person runs many agent sessions, the limit is human attention, not the model. Its answer is a long-lived **Router** that talks to people and dispatches work without doing it, above isolated **Workers** that each run one task. Further mechanisms (event filtering, Thread subscriptions, context handling, an async loop, compute/state/environment separation, a Watchdog) and two small synthetic experiments follow. The team also published an MIT research prototype: a DeepSeek Harness plugin that acts as a coding agent for one GitHub repository.

## Why it matters here
Video #4 (`videos/super-agent`) explains this article: V1 of *Who Routes the Agents?* was archived unpublished on 2026-11-15, and V2 was published on 2026-11-17 (https://youtu.be/-b7g5XIgEn0). Its facts gate needs every on-screen claim pinned to a block, the prototype SHA or a snapshot, and the series rule is to say on screen what is built and what is proposed (`series/science-explainers/SERIES.md`, "Built or proposed"): the matrix below is the source of truth for that.

## Key facts — publication [V unless marked]
- **English version.** Block 1 says it is a machine translation of a Chinese original; block 2 says it presents architectural ideas, not existing DeepSeek Harness features. About 6,900 words, 13 inline figures, a dark cover image and one Markdown results table.
- **Block numbers in this repo are 1-based**: fxtwitter `article.content.blocks` index + 1, re-checked against the JSON on 2026-11-08. Some research reports used 0-based indices; convert before citing them. Figures are `atomic` blocks; in the entityMap, key 12 is the completion chart (its caption), key 13 the results table, key 14 the batching chart.
- **Chinese original first.** IT之家 reported it at 2026-10-31 21:36 Beijing time (13:36Z) and 量子位 at 21:49; Bloomberg (syndicated copy) calls it a WeChat post. The English X article followed at 19:37 Beijing time on 11-01. The WeChat URL above was linked by a third-party X post (2026-10-31T14:41Z); WeChat served a verification page, which was not bypassed. A Zhihu copy (zhuanlan.zhihu.com/p/2099987320443237060) returned 403; deepseek.com's /harness/ page links DeepSeek's official Zhihu organisation, which suggests but does not prove an official copy there.
- **Chinese title** [S]: IT之家 gives 《Super-agent 设计探索：迈向更自主的 Agent 系统》, matching the English title; 量子位 renders it 「Super-agent：迈向更自主的Agent系统」. Use the IT之家 form, marked secondary, until the original is read.
- **Reach on 2026-11-08**: about 3.23M views, 13.7k likes, 898 quotes, 18.3k bookmarks, no community note; the prototype had 20,813 stars. Both drift: date any use.
- **Name collisions**: arXiv 2504.10519, *Toward Super Agent System with Hybrid AI Routers* (2025), is unrelated; so are a community plugin "dsh-super-agent" [S], a Show HN "Superagent" (Sept 2026) and super-agent.io [S].

## Key facts — the argument, by section [V, paraphrased]
1. **Super-agent (blocks 4–19).** Single-task agents need ever less supervision, and personal agents watch chat, mail and calendars (none named). But the session is still the unit of work and sessions are isolated, so the user switches and remembers what each knows (block 6):
   > Quoted from https://x.com/DeepSeekHarness/status/2116857257245987236 (accessed 2026-11-08): "In our experience, a person can usually follow only 3 to 5 active sessions at once."

   One task is limited by the model, many tasks by attention. Four traits: **Continuous, Productive, Proactive, Persistent** (blocks 13–16). No single ReAct loop gives all four, so they come from the architecture: five modules, §2–§6 (block 18). An internal instance runs on DeepSeek Harness (blocks 9, 138).
2. **Two levels (blocks 21–42).** One session for everything is continuous but serial; one per event is parallel but disconnected (blocks 23–24); hence two layers (block 25), and sessions become "an implementation detail of the system, not a mental burden on its users" (block 27). The **Router** is long-lived, hears every channel, and is the global sequence point, coordinator and memory; it does not execute and "can run without a Bash tool at all" (block 31). It dispatches whole tasks and tracks their relations but **does not break tasks down**, unlike an Agent Team lead; an Agent Team can be prompted into this shape, and a lighter model usually suffices (block 32). One LLM session copes because Triggers queued during a turn merge into the next call (blocks 33–35), enough "for a team of our current size" (block 36); sharding would trade shared memory for throughput (block 37). **Workers** have an isolated context, full tools and one task (block 39), never talk to people and report to the Router (block 40), and do not message peers: conflicts surface through shared Thread subscriptions, the Router relaying rare cross-task cases (blocks 41, 60).
3. **Event-driven triggers (blocks 43–75).** Two-stage filtering: a code Fast Path (source, group, allowlists), then an LLM Slow Path against policies written as prompts (blocks 47–50). A Thread is the event stream of one PR, IM topic or email chain (block 54). The Router creates a Worker for a Thread's first event and the Worker subscribes; code passes follow-ups straight through, and the Router only evaluates unsubscribed events; subscriptions are many-to-many (blocks 56–60). Context as a cache: Inline & Spill with locality, Chain of Recall along an ID reference graph (blocks 62–71). Acting ahead: speculative background work, delivered if useful, else discarded (blocks 73–74).
4. **Full-duplex, multi-channel (blocks 76–88).** Blocking `run()` becomes async `start()`/`stop()`: "Started" at once, the result later as a new event (blocks 79–82); the Harness "already implements" this but not by default (block 83). IM stays light, with a verified hard cap of 100 words per reply (block 87); GitHub and other async channels get dense output (block 88).
5. **Compute, state, environments (blocks 89–99).** Stateless cloud containers with state in a database (block 92); lightweight endpoint daemons, environments left in place (block 96). Compared with Anthropic's managed-agents post: same decoupling, but DeepSeek must connect personal, intermittently online machines, **BYOM** (blocks 97–98).
6. **Watchdog (blocks 100–104).** An external control-loop session on scheduled messages: infrastructure failures, plus a model-judged check that Workers progress and do not drift.
7. **Experiments (blocks 105–120)**, below.
8. **Open problems (blocks 121–136).** Scaling (sharding, Worker topology, a Router-trained model; block 124), long-term memory (block 125), working without sessions and stepping in mid-task (blocks 127–129), context boundaries and A2A (blocks 131–132), security: a loop compromised by intrusion or prompt injection could take over every connected endpoint, and credentials leak through context (blocks 134–136).
9. **Conclusion (blocks 137–140).** Classic systems ideas "rather than proposing new theory" (block 138); people move up to "higher-level decisions and sign-off" (block 139). Block 141 calls the prototype "not an official DeepSeek product".

## Key facts — the mechanisms in detail [V via mirror unless marked; paraphrased]
Read 2026-11-08 and re-read 2026-11-09 in the article's JSON through api.fxtwitter.com. **[V via mirror]** means checked in that third-party copy, not on x.com itself. The earlier [V] tags on article facts in this note rest on the same copy.

- **Traits and their modules (blocks 12–18).**
  - Continuous: one agent wherever people already work, so nobody has to ask which session holds what. The article's example: Plan A asked in IM, then Plan B in a PR comment, and it adjusts.
  - Productive: several complex tasks run in parallel, and it takes the next instruction before the last one finishes.
  - Proactive: it watches its environment, acts on what is worth it and otherwise stays quiet.
  - Persistent: always online, in real environments, recovering by itself.
  - Block 18 maps modules to traits: two levels → Continuous and Productive; event-driven → Proactive; full-duplex multi-channel → Continuous and Productive; compute/state/environment separation plus the Watchdog → Persistent.
- **What people still do by hand (blocks 6, 7, 44).**
  - Switching sessions by hand and remembering what each one holds (6).
  - One synchronous session that blocks on long operations, mixes task contexts, stops when the device goes offline, and takes a lot of manual effort to keep running (7).
  - A human prompt before each run (44).
  - #4 V1 called these four chores and paired each with a trait: our framing [U], not the article's.
- **Why the Router never works (blocks 31–32, 39, 53, 58).**
  - All cross-task information and decisions meet in the Router, so it is the one sequence point, coordinator and memory. It does not execute, so that this single node never becomes the bottleneck (31).
  - It handles only cold starts and cross-task coordination; code sends follow-ups to their Worker (53).
  - It still sees every event, to track global state, but evaluates only events that have no subscriber yet (58).
  - In the authors' experience the Router's work is simpler than expected, and a lighter model usually gives both speed and quality (32). Workers decide the result and the code quality, so they usually need the most capable models (39).
- **Why batching is cheap (blocks 33–35).**
  - Triggers that arrive during a turn queue up and go into the next call together, at little extra cost (33).
  - At a steady rate they arrive one at a time and replies come back quickly (34).
  - In a burst, a Router step has a long input and a short output. Merged Triggers are computed in parallel in prefill, so time per request grows much more slowly than batch size. The amortised time per decision falls as the backlog grows, up to a limit set by context length and by how many Triggers the model handles accurately in one turn (35).
- **Inline & Spill (blocks 62–67).** Inject too much and attention is diluted; inject too little and the model spends steps reading through tools (62):
  > Quoted from https://x.com/DeepSeekHarness/status/2116857257245987236 (accessed 2026-11-09): "Wasting the context window is wasting the model's intelligence."

  - The window is treated as a cache (63). Inline what will likely be needed soon. Spill the rest outside, leaving a reference or summary in the window.
  - With locality, in three steps (65–67):
    1. Start with the object's ID and a summary.
    2. Inline related IDs, then content near in space or time. The article's examples: the first 50 characters, the IM messages around a message and the one it replies to, and neighbouring review comments.
    3. Truncate long content at a small cap and leave a pointer to read on.
  - It applies to whichever session an event is routed to (62).
- **Chain of Recall (blocks 68–71, 125).**
  - The Router has a context problem of its own: follow-ups bypass it and past tasks pile up, yet a user may raise an old task in another channel (68).
  - Triggers, Threads and Worker Sessions carry IDs. Each injected object inlines its neighbours' IDs, which form a reference graph. Each object recalled through a tool inlines the next hop's summaries and IDs, so the model walks back hop by hop, as far as it needs (70).
  - The example: the message's Thread → a related Worker Session → another review Thread linked to that Worker (71).
  - It lessens forgetting; it does not end it:
    > Quoted from https://x.com/DeepSeekHarness/status/2116857257245987236 (accessed 2026-11-09): "It reduces how much earlier information the Router layer loses over long runs"
  - After months of running, long-term memory becomes the main bottleneck (125).
- **Acting ahead (blocks 73–74).**
  - This is speculative execution. On a signal, it starts background work before knowing whether the result will be used, spending compute so that people wait less and step in less. It delivers what proves useful and discards the rest (73).
  - The personal example: on a meeting invitation, it checks for conflicts, gathers background and drafts a reply.
  - The team example: the internal user group's "silently reproduce and fix" policy. The agent speaks only once it has confirmed the issue and found a simple fix; otherwise it stays silent (74).
- **Full-duplex (blocks 77–83).**
  - There are two problems: long background work must not block the conversation (§4.1), and replies must suit each channel (§4.2) (77).
  - A synchronous `run()` blocks the loop until the tool returns (79).
  - An async `start()` returns "Started" at once, and the result comes back later as a new event. `stop()` ends a command that runs too long (81).
  - New input is handled when the current inference step ends, not when background tools finish (82).
  - Block 83:
    > Quoted from https://x.com/DeepSeekHarness/status/2116857257245987236 (accessed 2026-11-09): "DeepSeek Harness already implements this asynchronous task mechanism, but it is not yet enabled by default."
- **Channel norms (blocks 84–88).**
  - Logs that suit a terminal swamp a group chat (85).
  - The two levels solve part of this: a task's verbose reasoning stays in its Worker, and the Router layer handles all external interaction. Prompts set each channel's norms (86).
  - IM keeps interruptions few. It speaks only when a decision or sign-off is needed, asks direct questions and gives short conclusions (87):
    > Quoted from https://x.com/DeepSeekHarness/status/2116857257245987236 (accessed 2026-11-09): "One simple, effective hard rule we have verified is a cap of 100 words per reply."
  - GitHub, email and documents get structured, dense output, such as a PR with the background, the change description and the verification results (88).
  - The cap serves attention, not waiting.
- **Compute, state, environments and BYOM (blocks 89–99).**
  - One device holds the loop's compute, the session state and the execution environment, so the agent stops when that device sleeps (90).
  - Step one: stateless, elastic cloud containers, with the state in a database (92).
  - Step two: leave environments where they are, because in the broad sense context includes the execution environment itself (94).
  - The alternatives fail. Rebuilding an environment in a cloud sandbox misses uncommitted changes, private credentials, intranet services and specific hardware. Moving work to the cloud costs users too much (95).
  - Each endpoint runs a thin daemon that keeps no session state and only runs commands (96).
  - BYOM connects people's own machines, which may be online only now and then, alongside cloud-hosted and on-demand machines (97). When a device reconnects, the cloud agent runs the tasks that need it (98).
- **Watchdog (blocks 100–104).**
  - A long-running system needs an independent control loop outside the main system (101).
  - Many failures are not crashes (102), so it watches task progress as well as liveness:
    > Quoted from https://x.com/DeepSeekHarness/status/2116857257245987236 (accessed 2026-11-09): "the process is still running, but the model is stuck in an unproductive loop or has drifted from its goal."
  - It is a Watchdog Session driven by scheduled messages (103). It handles infrastructure failures (API errors, failed state recovery), has the model judge whether each Worker is making substantive progress or drifting, fixes anomalies and rechecks transient external failures.
  - It has full tools, so maintainers can ask it why something failed and have it adjust prompts or trigger rules while the system runs (104).
- **Open problems, in detail (blocks 121–136).** There are four areas (122).
  - **Scaling.** When and how finely to shard the Router; when peer Workers should talk, and in what topology; training a model for Router work (judging events, batched dispatch, recall) (124). Memory over months (125).
  - **Working without sessions.**
    - How to present tasks to users. The chat window is central partly through path dependence; interaction may move into domain interfaces such as GitHub Issues and PRs; one visible conversation need not be one session (127).
    - Many tasks still need a person partway through. How to let users step in, take over or work alongside at any point is open (128).
    - Final designs will be customised per domain (129).
  - **Context boundaries.** Provisioning instances amounts to choosing which context is shared and which is isolated (131). A2A here means agent-to-agent communication in general, not one protocol, across permission boundaries (132).
  - **Security.**
    - Until it is solved, untrusted input keeps the system to a small, trusted scope (134).
    - The cloud/endpoint design assumes the two trust each other, and one compromised loop could take over every connected device (135).
    - Credentials can leak through context with no breach at all, so the agent must use them without seeing them (136).
- **Classic systems, by the article's own count (blocks 17, 137–140).**
  - The ideas it names itself: Fast/Slow Path (47), the global sequence point (31), batching in prefill (33–35), the context cache with Inline/Spill from compiler optimisation and locality (63–64), speculative execution (73), the async loop (79–81), compute–storage separation (90) and an external control loop (101).
  - Block 17 says classic systems ideas apply. Block 138 says the design applies them instead of new theory. It also says the internal instance runs continuously: it reproduces and fixes issues, answers code reviews and helps develop DeepSeek Harness itself.
  - Block 139 credits the five modules with taking over session management and context syncing.
  - The further analogies in the lineage table below (pub/sub, actors, the event loop, Lampson, Denning) are ours [U], not the article's.
- **Further quotable lines**: blocks 62 and 102 (quoted above), block 138's "rather than proposing new theory" (section 9 above), and block 27:
  > Quoted from https://x.com/DeepSeekHarness/status/2116857257245987236 (accessed 2026-11-09): "a design habit carried over from low-level LLM APIs"

## Key facts — experiments [V numbers; ratios our arithmetic, U]
- **Setup** (blocks 106, 108, 114): synthetic workloads, simplified environments;
  > Quoted from https://x.com/DeepSeekHarness/status/2116857257245987236 (accessed 2026-11-08): "so the results below are indicative only."
- Four designs ran at the same time on a group-chat and GitHub CI stream: about 300 messages per run, about 20 of them work requests. Coding was a tool that only consumes time, so scheduling is measured, not coding. 5 runs per design, timed from request to result message. No model is named. The chart caption scales message intervals and work durations by 1/4 but not model calls; whether the table's minutes use that clock is not stated [U].
- **§7.1 table** (entity 13):

  | Design | p50 / p95 (min) | Cache-read tokens per run |
  |---|---|---|
  | Super-agent | 12.4 / 15.7 | 23.2M |
  | Super-agent without pass-through | 12.6 / 15.5 | 31.8M |
  | Single session + subagent tool, neutral prompt | 20.4 / 29.5 | 6.1M |
  | Single session + subagent tool, delegation-first prompt | 13.8 / 29.0 | 10.8M |

- **Prompt sensitivity** (block 115): the neutral prompt delegated in none of 5 runs; delegation-first in 4 of 5, and in the fifth the model judged the work "small" and did it itself (the long tail).
- **Derived** [U]: p95 is 0.53 and 0.54 of the two baselines (46.8% / 45.9% lower); p50 is 39% lower than neutral but only about 10% lower than delegation-first; tokens 3.8× and 2.1× the baselines.
- **Pass-through** (block 116): about the same completion time either way; without it the Router makes about 30% more decisions and tokens rise 23.2M → 31.8M ("about 37% more"). So with it the Router makes about 23% fewer decisions and uses about 27% fewer tokens, and saves no time.
- **§7.2 Router batching** (blocks 118, 120): real Router model, mock Workers. As arrivals rise from about 1 to 40 Triggers/min, batch size goes 1.0 → 2.8, time per request 2.5 → 3.9 s, amortised time per decision 6.4 → 1.6 s. A decision can span several LLM requests, so per-decision time is not per-request time ÷ batch size; the limit depends on context length and accuracy (block 35). Conclusion: no need to shard at the current team size.
- No experiment code is public, so none of this can be reproduced.

## Key facts — the prototype at `8c32a9d` [V unless marked]
- **Repo.** Created 2026-10-31T09:32:46Z; one commit (authored 12:05:39Z, committed 12:06:31Z, "DeepSeek Harness Team"), 216 files. An earlier root `6337fc8` has the identical tree (history rewritten, content the same); `pushed_at` (2026-11-03) moved while `main` did not. No tags or releases; issues and PRs off.
- **README caveats.** A research prototype, not an official DeepSeek product, much of it engineered by coding agents; not identical to the internal version; some article designs are future directions it does not implement.
- **What it is.** "A proactive coding agent for one GitHub repository" as a Harness bundle: `cordis.patch.yml` adds three plugins (core, `github-watch`, `feishu-watch` off by default) and two presets, `dsh-superagent-worker` and `dsh-superagent-router`; a "Superagent" panel appears in the Harness web UI.
- **How it runs.** One local process in tmux serving 127.0.0.1, state in one SQLite file, a dedicated GitHub user account; install pins `@deepseek-ai/dsh` 0.2.1-rc.3. POSIX in practice (tmux; executor paths must start with `/`), though the presets have `pwsh` branches [U]. No model is hard-coded: `eval.model` (Router) and `executor.model` (Workers) default to the Harness profile's model.
- **Security.** Both presets run `danger-full-access` as the operator's OS user, bypassing the sandbox plugins they mount; the wrappers are "defaults, not a security boundary" (`docs/003-execution.md:80`). The panel API's `sameOrigin()` (`src/app/http.ts:75-78`) trusts a loopback Host header plus a custom header, with no secret; a third-party "audit" of it was relayed but not reproduced [S].

| Article design | Status at `8c32a9d` | Where |
|---|---|---|
| Two levels: long-lived Router, one isolated Worker per task | **Built.** Main Session (`orchestrator`) plus a `worker-<ticketId>` Session and directory (git worktree) per Ticket; `maxWorkers` 3 (1–16) plus one slot for a person's message | `src/executor/dsh.ts`, `src/policy.ts:93`, `src/limits.ts:6`, `docs/003-execution.md:53-61` |
| Router does not execute | **Built differently.** No write, edit, subagents or web, but a restricted `bash` with read and job tools; commands move to the background after 5 s (a threshold, not a cap); a `noWait` guard refuses `sleep`, timeouts over 30 s and job waits over 5 s; "Avoiding code reads is a prompt rule, not a tool restriction". It also runs the Slow-Path assessment | `src/app/sessions.ts:69-86,263`, `docs/007-architecture.md:507` |
| Router does not decompose | **Built as prompt rules**: no implementation plans; routing notes ≤ 30 words | `prompts/dispatch.md`, `src/infra/text.ts` |
| Workers never talk to people | **Built differently.** Workers post GitHub acknowledgements, open PRs, reply to and resolve review threads; only IM goes through the Router; no messaging other Tickets' Sessions | `prompts/replies.md:13-25,31`, `prompts/work.md:18,28` |
| Event sources | **Built for GitHub** (notifications polled every 60 s by default) **and optional Feishu IM**; no email, calendar, Slack, timer or webhook | `src/sources/`, `docs/001-domain.md` |
| Two-stage filtering | **Built.** Code gate (scope, allow and bot lists, admission table, accept mode), then LLM assessment against team-written rules (defaults "Copy fixes", "Visual fixes") | `src/policy.ts:62-65`, `src/admission.ts` |
| Proactive pickup | **Built, off by default.** Accept mode `off` / `observe` / `auto`, default `observe` (records "would accept"); explicit requests work in every mode | `src/policy.ts:55,84`, `docs/002-authorization.md:97-101` |
| Threads, subscription, pass-through | **Built** as "Subscription fan-out" (the word "pass-through" does not occur): many-to-many, no gate check; a person's message to a live Ticket skips assessment; Workers can hand a message back or drop an unrelated Thread | `src/core/intake.ts:34-59` |
| Router batching | **Built, two forms**: per-Thread assessment batching, and a main-Session inbox that claims steered messages together (a mock-host test: 5 follow-ups = 1 delivery while busy, 2 while idle). The §7.2 numbers are not from this code | `docs/001-domain.md:43`, `tests/followups.spec.ts:91-116` |
| Inline & Spill; Chain of Recall | **Built in prototype form**: cards with a 160-character preview and a `read:` pointer, pages of 4,000 code units (8,000 max), every shown ID readable through a tool; no separate multi-hop algorithm [U] | `src/app/cards.ts`, `docs/007-architecture.md:550-594` |
| Acting ahead (speculative) | **Mechanism only**: `auto`, rules and silent drop exist; the "silently reproduce and fix" rule (`silent-bugfix`) is a test fixture, not a default | `tests/runtime.spec.ts:295-318` |
| Async full-duplex loop | **Built through Harness background jobs**: a foreground command becomes a job after 5 s (60 s in the standard preset), completion is delivered in-session (waking an idle agent), `job_kill` stops it; the names `start()`/`stop()` are not in the code | Harness `packages/shell/tool-bash`, `packages/jobs/tool-jobs`; `cordis.patch.yml:38-56` |
| 100-word IM cap | **Built**: counted with `Intl.Segmenter('zh')`, enforced in the Feishu outbox, splitting refused. ~~GitHub replies have no word cap (the schema allows 20,000 characters)~~ Acknowledgements are held to 100 words in every channel, GitHub included; other GitHub replies have no word cap (the reply schema allows 20,000 characters) [V 2026-11-09]. GitHub replies open with an automated-agent disclosure line | `src/infra/text.ts:2-16`, `src/app/outbox.ts:29`, `src/app/tools/executor.ts:33`, `src/app/tools/main.ts:231` |
| Stateless cloud compute + database | **Absent**: one local process, SQLite | `docs/007-architecture.md:452` |
| Endpoint daemons / BYOM | **Absent** (the Harness has SSH providers; unused) | — |
| Watchdog | ~~**Absent as an agent**~~ **Infrastructure half only, set up by the operator** [V 2026-11-09]: an hourly status-and-restart prompt, run by an agent in another Harness profile, that also reads the log and fixes what it can after a failed restart; no model-judged progress check | `docs/006-deployment.md:133-141` |
| Sharding; experiment harness; memory, sessionless UI, A2A | **Absent** (one master session; unit and integration tests only) | `docs/007-architecture.md:475` |

The article's own short summary (block 124) is what is built: one long-lived Router Session, subscription with pass-through, no direct Worker-to-Worker messages.

**Matrix notes** [V at `8c32a9d`: read 2026-11-08, re-checked 2026-11-09]
- **Inline & Spill in numbers** (`docs/007-architecture.md`):
  - At the Router, a `worker_report` arrives as a card with a summary of up to 600 characters. When the summary is truncated, the card adds `chars` and a read pointer (:589); `src/app/notices.ts` truncates behind `ticket/<id>/result`.
  - Other loaded messages appear as 50-character `{id, from, preview}` stubs (:546). That is also the article's own example length (block 66).
  - A Trigger's text is inlined up to 4,000 characters. Thread messages get 400 characters, or 1,200 for the two on either side of the Trigger (:543–545).
  - A Worker's first message inlines up to 1,500 characters of the assignment (:594). Read pointers appear only for truncated content.
  - So the mechanism is clearest at the Router. These numbers are the prototype's, not the article's (Q5 below).
- **Isolation by ID** (:573, :575):
  - An Executor Session reads only its own Ticket, its Threads, the Triggers that reached it, the prompt versions it worked under and the originals. Its pages leave out the ids of what it cannot read: Decisions and other Tickets.
  - Every id a page shows can be read, so a Session walks from one object to the next. That is Chain of Recall in prototype form, and isolation is enforced by which IDs a Worker ever sees.
- **Pass-through still informs the Router** [V 2026-11-09]:
  - A person's follow-up on a subscribed Thread goes to the live Ticket's Executor with no Eval. The main Session still gets a `follow_up` notice: the worker decides, and the main Session may only stop the work (`src/app/notices.ts:78-105`, `src/core/model.ts:75-87`, `docs/007-architecture.md:585`).
  - Bot and CI messages on that Thread also fan out to the Ticket, and they still go to Eval (`src/core/intake.ts:56-58`).
  - This matches the article: the Router sees every event but evaluates only the unsubscribed ones (block 58).
- **Background jobs** (`docs/003-execution.md:27, 29, 47`):
  - The worker preset moves a foreground shell command to a background job after 5 s, so a Worker takes new messages at its next step. The router preset has the same 5 s shell and job-wait limits.
  - Worker subagents use the Harness `standard` preset, where the threshold is 60 s.
  - At Harness `fcc0ad4` [V 2026-11-09], the bash tool's `promoteOnTimeout` and `enableRunInBackground` default to true, and the `standard` preset (order 1) mounts `tool-jobs` (`packages/shell/tool-bash/README.md`, `packages/bundle/web-app/presets/standard.patch.yml`). Whether block 83's "not yet enabled by default" refers to this is [U] (Q6 below).
- **Word caps** (`src/infra/text.ts:3-4`):
  - `IM_WORDS = 100` and `NOTE_WORDS = 30`. A word is an `Intl.Segmenter('zh')` word-like segment, and link labels and URLs count.
  - The 100-word cap covers Feishu replies (`src/app/outbox.ts:29`), every acknowledgement in any channel (`src/app/tools/executor.ts:33`, `src/app/assessment.ts:276`, `docs/007-architecture.md:548`) and notes to a Ticket's worker (`src/app/tools/main.ts:181`) [V 2026-11-09].
  - The main Session's reply tool accepts only an answer, a ready result or a request for human action, and refuses progress updates (`src/app/tools/main.ts:224-231`). That builds block 87's rule of speaking only when a person is needed.
- **The hourly check** (`docs/006-deployment.md:133-141`) [V 2026-11-09]:
  - The operator asks an agent in their usual Harness profile to schedule an hourly prompt. It runs in that profile so that it keeps working while the service is down.
  - The prompt runs `status` and says nothing when all is well. It reports errors or setup needs without restarting. Otherwise it restarts, respecting an intentional stop; if the restart fails, it reads the newest log and the troubleshooting section, fixes what it can and reports.
  - That is the infrastructure half of block 103, set up by hand. Nothing judges Worker progress or drift, and nothing tunes prompts or rules (block 104).
- **Models**: the Router's and the Workers' models are set separately (`eval.model`, `executor.model`, above). So the lighter-Router idea of block 32 is configurable in the prototype, not demonstrated by it.

## Key facts — DeepSeek Harness itself [V at `fcc0ad4` unless marked]
- An open-source agent harness on Cordis, "Everything is a Plugin" (even the model adapter and agent loop are plugins); MIT, TypeScript; a **developer preview** whose README warns of compatibility-breaking changes. Issues off, Discussions on.
- Repo created 2026-08-13T11:56:32Z. npm `@deepseek-ai/dsh`: 0.0.1-rc.1 (2026-08-10), 0.1.0-rc.6 (2026-08-13), 0.2.1-rc.3 (2026-10-23), 0.2.2-rc.1 (2026-11-04, latest at access). Launch reported alongside DeepSeek-V4-Pro availability on 2026-08-13 [S]; the preview's HN thread had 747 points and 314 comments.
- Local web UI; profiles `web`, `headless`, `sdk`, `sdk-minimal`, `acp`; a Python SDK and an Electron app; subagent providers include Claude Code, Codex and ACP. The DeepSeek adapter lists `deepseek-flash` and `deepseek-v4-pro` (1,048,576-token window); other providers go through an adapter, so it is not tied to DeepSeek models.
- **CVE-2026-82533** (VulnCheck, 2026-09-08): authentication bypass via Host-header spoofing in the Harness before 0.1.2-alpha.1 (CWE-807); the record carries CVSS 4.0 9.4 and CVSS 3.1 9.6. The Harness, not the prototype.

## Key facts — reception [V as read; the critics' claims S]
- **Expert debate is thin.** Every Hacker News submission of the article or repo scored 1–11 points with no comments; the Bloomberg thread holds one dismissive remark about the first dsh release. X replies were not readable.
- **Press framings.** Bloomberg's headline (syndicated copy) says DeepSeek aims to rival Anthropic, though its text calls the work a prototype; Entrepreneur India, Techzine and a YouTube video echo a "Claude Code rival" angle. Interesting Engineering calls it an early research project and notes the benchmark's limits but misreads two points (below). IT之家, 量子位 and 智东西 are descriptive (not a new product, open problems listed, no outside experts).
- **Blogs.** redreamality (Nov 2), the best critique, praises the attention framing, the non-working Router, subscriptions, batching and the `observe` default; criticises the 3.8× tokens, the synthetic workload, the unnamed model and security; calls the "rival" framing off target; but wrongly credits the article with a "65% … Claude Tag" figure (the article never mentions Claude). 掘金: "Router动嘴，Worker干活", yet says the Router decomposes. aicodewith ran the test suite (1,197 tests pass), no end-to-end ticket. explainx headlines "39%".

| Misreading | Seen in | What the article says |
|---|---|---|
| The Router decomposes or plans tasks | Interesting Engineering, 掘金 | Dispatches whole tasks, does not break them down (block 32) |
| A new DeepSeek product, a rival to Anthropic or Claude Code | Bloomberg headline, Entrepreneur India, Techzine, YouTube | Ideas, not features (block 2); prototype, not an official product (block 141) |
| 3–5 sessions is a measured human limit | many blogs (IE attributes it correctly) | "In our experience" (block 6) |
| "One task took 16 vs 29 minutes" | Interesting Engineering | p95 values of synthetic runs with simulated coding (blocks 108, 115) |
| "20.4 vs 29.5 minutes" as two designs | a search-indexed blog | p50 and p95 of one baseline (table) |
| "39% faster" | explainx | p50 against the baseline that never delegated; about 10% against delegation-first |
| "Super" means a more capable model | casual readers | It names the system around the loop (blocks 12–17) |
| Workers talk to each other | some blogs | No direct Worker-to-Worker messages (blocks 41, 60, 124) |
| The prototype's Router has no shell | secondary write-ups [U] | The article says it *can* run without Bash (block 31); the prototype keeps one |

**Context** [V]: the article names only Anthropic's *Scaling Managed Agents: Decoupling the brain from the hands* (2026-04-08) and characterises it fairly (block 97). Anthropic's *Building effective agents* (2024-12-19) defines orchestrator-workers as a central model breaking tasks down: the contrast with this Router. The idea is not without precedent (docs as of 2026-11-08): Claude Code Projects runs one long-lived coordinator over cloud worker threads, though its coordinator plans and splits goals; Codex cloud gives each task its own cloud workspace (its page describes no coordinator), and Copilot cloud agent works in the background, opens PRs and can act on repository events.

## Key facts — lineage: classic ideas behind the analogies
| Article idea | Classic idea | Reference |
|---|---|---|
| Fast/Slow Path filtering | Handle normal and worst cases separately; shed load | Lampson, *Hints for Computer System Design* (1983) [V] |
| Router batching | Batch where possible; prefill processes a long input in parallel, decode one token at a time | Lampson [V]; SARATHI arXiv 2308.16369, Splitwise 2311.18677 [V]; database group commit as an analogy [U] |
| Acting ahead | Compute in background; speculate and hold output until confirmed | Lampson [V]; Speculator (Nightingale et al., SOSP 2005, doi 10.1145/1095810.1095829) [V] |
| Compute/state separation | Stateless compute, durable state elsewhere | Snowflake SIGMOD 2016 [U: not stated in its abstract]; Aurora SIGMOD 2017 [V]; Anthropic Managed Agents [V] |
| Context window as a cache | Working set and locality; OS-style memory tiers for LLMs | Denning 1968 and 2005 [V]; MemGPT arXiv 2310.08560 [V] |
| Inline & Spill | Register spilling; "by value vs by reference" is the safer analogy | Chaitin 1982, doi 10.1145/872726.806984 [V]; analogy advice [U] |
| Threads and subscriptions | Publish/subscribe: decoupled in time, space and synchronisation | Eugster et al. 2003, doi 10.1145/857076.857078 [V] |
| Isolated Workers | Actors: private state, message passing | Hewitt, arXiv 1008.1459 [V] |
| A Router that never blocks; async loop | Never block the event loop; hand heavy work to a pool | Node.js "Don't block the event loop" [V]; OSTEP, event-based concurrency [V] |
| Watchdog | Watchdog timers, control loops, supervisors; the article adds a model-judged progress check | Linux watchdog API, Kubernetes controllers, Erlang/OTP supervisors [V] |

## Key facts — what psychology supports, and what it does not
| Source | Supports | Does not support |
|---|---|---|
| Cowan 2001 / 2010 (PMID 11515286, 20445769) [V] | About 4 chunks (3–5) in working memory, rehearsal blocked | That anyone can supervise 3–5 sessions: the match is coincidence |
| Monsell 2003 (PMID 12639695) [V] | Switch costs: slower and more errors just after a switch | Costs per agent session, or over minutes |
| Altmann, Trafton & Hambrick 2014 (PMID 23294345) [V] | Interruptions of about 2.8 s doubled sequence errors; 4.4 s tripled them | Real software work |
| Mark, Gudith & Klocke CHI 2008 [V abstract] | Interrupted people worked faster but with more stress and effort | Lower output quality |
| González & Mark CHI 2004; Parnin & Rugaber ICPC 2009 [V abstract] | About 3 min per task before switching; only 10% of resumed programming sessions began coding within a minute | Anything about AI agents |
| Cummings & Mitchell 2008 (doi 10.1109/tsmca.2007.914757) [V abstract] | Multi-UAV supervision: wait times cut predicted operator capacity by up to 67% (36% under management by exception) | Numbers for coding agents (analogy only) |
| Chou et al. arXiv 2610.33588; ParallelPilot arXiv 2609.33113 (2026 preprints) [V abstract] | Developers spent about a third of observed time prompting or checking AI (N=11); supervision tooling added about one concurrent agent (N=16) | A fixed limit; ParallelPilot found no significant gain in perceived control |

Safe wording: "the authors find about three to five; switching and interruptions are known to be costly", never "science says 3–5".

## Key facts — EN → zh-Hans glossary
Sources: authors' terms via IT之家 or 量子位 [S]; a full reprint credited to the Zhihu copy (blog.eimoon.com, 2026-11-01) [S, reprint: weaker]; the prototype's glossary (`docs/001-domain.md`, `src/client/locales.ts`) [V]; proposals [U]. The user signs off all zh copy.

| EN | Use in zh-Hans | Authors' Chinese | Prototype [V] / note |
|---|---|---|---|
| Super-agent | Super-agent (gloss 超级智能体 once [U]) | kept in Latin script [S, reprint] | — |
| two-level architecture | 双层架构 | 双层架构 [S, reprint] | — |
| Router layer | Router 层 | Router 层 (IT之家), 上层的Router (量子位) [S] | 主 Session (`orchestrator`) |
| Worker layer | Worker 层 | Worker 层 (IT之家), 下层的Worker (量子位) [S] | 执行器 Session |
| session | Session（会话） | Session [S, reprint] | Harness zh docs: 会话 [V] |
| Trigger / Thread | Trigger / Thread (kept) | kept; also 环境事件 [S, reprint] | 触发 / 线程 (clashes with OS threads: keep "Thread") |
| subscription and pass-through | 订阅与直通 | 订阅与直通机制 (量子位), 事件直通机制 (IT之家) [S] | 订阅; 扇出 (fan-out) |
| two-stage filtering, Fast/Slow Path | 两级过滤; Fast Path / Slow Path kept | 两级过滤 [S, reprint] | 准入 Gate / 研判 Assessment |
| Inline & Spill | kept (gloss 内联与溢出 [U]) | kept [S, reprint] | — |
| Chain of Recall | 链式召回 | 链式召回（Chain of Recall）(IT之家) [S] | — |
| acting ahead / speculative execution | 提前行动 / 投机执行 | 投机执行机制 (IT之家) [S]; §3.4 提前行动 [S, reprint] | standard 推测执行, also 投机性执行 [S, zh.wikipedia] |
| full-duplex; async ReAct loop | 全双工; 异步 ReAct Loop | 全双工交互 [S, reprint]; 异步 ReAct Loop (IT之家) [S] | — |
| multi-channel | 多信道 or 渠道 (pick one) | 多信道交互 [S, reprint]; IT之家 writes 不同渠道 | Channel 渠道 |
| compute-storage separation | 存算分离 | 存算分离; §5 计算、状态与环境的分离 [S, reprint] | — |
| BYOM; daemon | BYOM（Bring Your Own Machine）; daemon | BYOM (IT之家) [S]; 端侧 / 轻量 daemon [S, reprint] | standard 守护进程 |
| Watchdog | Watchdog（看门狗） | 看门狗 (量子位), 外部控制回路 (IT之家) [S] | — |
| Continuous / Productive / Proactive / Persistent | 连续 / 高效 / 主动 / 持久 | the same list (IT之家) [S] | — |
| sequence point; sign-off | 序点; 验收 | 序点（Sequence Point）; 更高层的决策与验收 [S, reprint] | — |
| attention bottleneck | 人的注意力瓶颈 [U] | 多任务的上限取决于人的注意力 [S, reprint] | — |
| Agent Team; subagent; Ticket | Agent Team（智能体团队）; 子智能体; 工单 | kept [S, reprint] | Harness zh docs [V]; 工单 |

## Key facts — honest caveats
1. Ideas, not a product; the prototype is not official (blocks 2, 141; README).
2. The English text is a machine translation; the Chinese original was not read.
3. "3 to 5 sessions" is the authors' experience, not a measurement.
4. The experiments are synthetic, small (5 runs) and "indicative only": simulated coding, chart time scaled by 1/4, no model named.
5. The baseline is prompt-sensitive: the large gain is the tail (p95); p50 is about 10% better than the stronger baseline.
6. The design costs 2.1–3.8× the tokens; pass-through saves Router decisions and tokens, not time.
7. The batching test used mock Workers, and its numbers belong to the authors' setup, not the public code.
8. "Enough for a team of our current size": scale, sharding and long-term memory are open.
9. The unprompted PRs (blocks 9, 138) come from the internal instance, which cannot be checked; the public prototype is reactive out of the box (`observe`).
10. The prototype differs from the article: the Router keeps a shell, Workers reply on GitHub, and there is no cloud, BYOM, ~~Watchdog~~ model-judged Watchdog (only an operator-set hourly restart check, matrix 2026-11-09), sharding or experiment harness.
11. Security is unsolved: one hijacked loop could reach every connected machine.

## Key facts — accuracy questions (raised 2026-11-08)
Raised by the critique of 2026-11-08; settled at the source on 2026-11-09 unless the last column says "Open". How a film shows each answer is that film's choice. (Q9, about a picture metaphor of #4 V1, was dropped on 2026-11-15.)

| # | Question | Answer | Still open |
|---|---|---|---|
| Q1 | Does a pass-through follow-up reach the Router at all? | Yes, in both. Article: the Router sees every event but evaluates only unsubscribed ones (block 58) [V via mirror]. Prototype: a person's follow-up reaches the main Session as a `follow_up` notice, and bot or CI messages still go to Eval (matrix notes) [V 2026-11-09]. Settled 2026-11-09 | Nothing. A picture of the Router's record must say whether it records decisions (a follow-up adds none) or arrivals (a follow-up arrives without a decision) |
| Q2 | Who posts the PR? | The design gives all external interaction to the Router layer (blocks 60, 86); in the prototype, Workers open PRs (`prompts/work.md`). Settled 2026-11-09 | Re-check if the prototype changes; show no sender unless the film says whether it means the design or the prototype |
| Q3 | Does "only the Router talks to people" hold in the prototype? | In IM only. Workers post their own acknowledgements through `orchestrator_ack` (`src/app/tools/executor.ts:29`) and reply on review threads (`prompts/replies.md`). Settled 2026-11-09 | Nothing. A "built" label covers the two levels, not this claim |
| Q4 | Can any part of the Watchdog be shown as built? | Only the infrastructure check exists: an agent-run hourly prompt that never judges progress (matrix) [V 2026-11-09]. Settled 2026-11-09 | Nothing. The Watchdog is proposed; a running Worker may be shown as built, a progress judgement never |
| Q5 | Are the prototype's card sizes article facts? | No: 600-character reports, 50-character stubs, 160-character previews, 1,500-character assignments and 4,000-unit pages are prototype details [V]. Settled 2026-11-09 | Nothing. If shown, they are labelled as the prototype's |
| Q6 | Is the async job loop on by default? | Block 83: in the Harness but not enabled by default. The prototype's presets switch it on at 5 s. At `fcc0ad4` the Harness `standard` preset looks switched on too [V code; U reading] | Open: which preset a fresh Harness profile gets, and what block 83 means by "default" |
| Q7 | Are the zh terms for the four traits the authors'? | 连续 / 高效 / 主动 / 持久 come from IT之家 [S] | Open: the Chinese original's own terms, once it can be read (WeChat, Zhihu) |
| Q8 | Is the token mapping right? | Yes [V via mirror, 2026-11-09]. Entity 13: 6.1M = single session, neutral prompt; 10.8M = single session, delegation prompt; 23.2M = Super-agent. The column is "cache-read tokens per run (all sessions)". Settled 2026-11-09 | Nothing |
| Q10 | Where does the Slow Path sit? | The article sends candidate events to an LLM without saying which session runs it (block 50); in the prototype the main Session runs the assessment after the code gate (matrix). Settled for the prototype 2026-11-09 | Nothing to check. The article does not say; a picture that puts it at the Router, after the code gate, shows the prototype's form |

## Sources found in V1's session notes (URLs; not re-read since 2026-11-08)
#4 V1's research notes (written 2026-11-07 to 2026-11-09) held these URLs and facts, which this note named without a link or left out. They were copied here on 2026-11-15, before those notes were deleted; the tags are the notes' own. Paraphrased; no article text or figure is kept.
- **Context** (accessed 2026-11-08) [V as noted then]:
  - Anthropic, *Building effective agents* (2024-12-19), https://www.anthropic.com/engineering/building-effective-agents: its orchestrator-workers pattern has a central model work out the subtasks, the contrast named under reception above.
  - Anthropic, *How we built our multi-agent research system* (2025-06-13), https://www.anthropic.com/engineering/multi-agent-research-system: an Opus 4 lead with Sonnet 4 subagents, 90.2% better than a single agent on an internal eval, about 15× the tokens of chat, a poor fit for shared-context work and most coding, and a lead that runs synchronously.
  - Cognition, *Don't Build Multi-Agents* (2025-06-12), https://cognition.com/blog/dont-build-multi-agents, and *Multi-Agents: What's Actually Working* (2026-04-22), https://cognition.com/blog/multi-agents-working: share full context; multi-agent setups work when writes stay single-threaded. V1's reading [U]: one Worker per whole task is close to single-threaded writes, and the neutral prompt's 0 of 5 delegations fits Cognition's finding that a model left to decide when to escalate is unreliable.
  - Claude Code docs as of 2026-11-08: subagents (background, up to 20 concurrent by default, 3 nesting levels), https://code.claude.com/docs/en/sub-agents; agent teams (experimental; teammates message each other directly, unlike Workers; the docs suggest starting with 3–5 teammates, a coincidence with block 6), https://code.claude.com/docs/en/agent-teams; Projects (a coordinator that sees what its threads report, not each of their steps), https://code.claude.com/docs/en/claude-projects and https://claude.com/blog/projects-redesigned (2026-09-17). These products change fast: date any comparison.
  - Codex cloud, https://learn.chatgpt.com/docs/cloud, and GitHub Copilot cloud agent, https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent.
  - Personal agents of the kind section 1 alludes to, neither named in the article: OpenClaw (MIT, about 394k stars) and Hermes Agent (MIT, about 261.5k) [V GitHub API then]. A count found no mention of Claude, OpenAI, Codex, Cursor or Devin in the article.
- **Reception** (accessed 2026-11-08): Interesting Engineering (B. Stojkovski, 11-01), https://interestingengineering.com/app/read/ai-robotics/china-deepseek-architecture-multi-agent-ai, which gives 3–5 as the team's estimate; 智东西 via Sina, https://finance.sina.cn/tech/csj/2026-11-01/detail-inixepty4335109.d.html; redreamality (11-02), https://redreamality.com/cn/blog/deepseek-super-agent-router-worker-architecture/; 掘金 (11-04), https://juejin.cn/post/7704197912935252002; 人人都是产品经理 (11-04), https://www.woshipm.com/ai/6488815.html, a practitioner who agrees with the shape (partly promotional); aicodewith (11-01), https://aicodewith.ai/zh/blog/deepseek-super-agent-review-dsh-superagent; explainx, https://explainx.ai/blog/deepseek-super-agent-architecture-router-worker-triggers-watchdog-2026; Hacker News through https://hn.algolia.com/api/v1/search?query=dsh-superagent (items 50326523, 50334601, 50316116, 50321277, 50327721 and 50323920; the Bloomberg thread is 50323814); the AI LABS YouTube video, id `3DklR44DHnM` [V oEmbed]; the Harness CVE advisory, https://advisories.gitlab.com/pkg/npm/@deepseek-ai/dsh-client-connection/; a Bilibili column, cv53698541 [U: it did not load].
- **Lineage and psychology ids** missing from the tables above: Lampson's *Hints*, https://courses.csail.mit.edu/6.826/1999/html/00-Hints-for-computer-system-design.html (long version arXiv 2011.02455); DistServe arXiv 2401.09670; group commit doi 10.1145/602259.602261 [U: analogy]; Snowflake doi 10.1145/2882903.2903741; Denning doi 10.1145/363095.363141 and 10.1145/1070838.1070856; https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop; OSTEP, https://pages.cs.wisc.edu/~remzi/OSTEP/; https://docs.kernel.org/watchdog/watchdog-api.html; https://kubernetes.io/docs/concepts/architecture/controller/; https://www.erlang.org/doc/system/sup_princ.html. Mark 2008 doi 10.1145/1357054.1357072; González & Mark 2004 doi 10.1145/985692.985707; Parnin & Rugaber 2009 doi 10.1109/icpc.2009.5090030; Leroy 2009 doi 10.1016/j.obhdp.2009.04.002 [metadata only]. Not in the tables: Meyer et al., TSE 2017, doi 10.1109/tse.2017.2656886, on fragmented developer work (correlational) [V then].
- **Prototype setup** [V at `8c32a9d`, `docs/006-deployment.md` unless marked; read 2026-11-07, about 23:40 UTC]: Node ^22.19 or ≥ 24 (`package.json`), pnpm, git 2.32+, tmux, Python 3.8+, gh 2.48+ and a model provider set up in the Harness; a dedicated GitHub *user* account, because a GitHub App cannot be the agent; setup strips environment variables whose names contain KEY, PASSWORD, SECRET or TOKEN; the panel binds 127.0.0.1:3082; records are never deleted (`docs/007-architecture.md:484`), so the database only grows. The Harness repo then had 275,733 stars and 33,724 forks.
- **The article's figures** (an inventory, so they can be avoided) [V as viewed 2026-11-08]: 13 inline figures and a dark cover. White ground, slate-grey rounded boxes, one saturated blue accent for active parts, grey for passive ones, dashed lines for slow or asynchronous paths, charts in default matplotlib. One running example, a bug report about a view that goes blank on a session switch, runs through figures 9, 11 and 13 by X `localMediaId` (Gotchas): the bug report in the sieve, then its IM thread and its PR thread with CI and review, then the bypass. The problem itself, attention, has no figure. The most visual ideas, in the researcher's judgement [U]: hub and spoke (7), a two-stage sieve (9), the pass-through bypass (13), a speculative PR on a side track (17), blocked against flowing swimlanes (19), a device that sleeps while the loop survives (21), completion curves (23). Their layouts are on the do-not-copy list below; their data may be re-plotted, as that list says.
- **The reprint's section headings** [S: the blog.eimoon.com reprint; U until the original is read]: 1 Super-agent · 2 双层架构 (Router层, Worker层) · 3 事件驱动 (事件过滤, 事件路由, 上下文组织, 提前行动) · 4 面向人的交互 (全双工交互, 多信道交互) · 5 计算、状态与环境的分离 · 6 Watchdog · 7 初步实验 (消融实验, Router层的批处理) · 8 开放问题 · 9 结语.

## What we adopted / adapted
Used by #4 V1 (*Who Routes the Agents?*, archived unpublished 2026-11-15; source at tag `video/super-agent/v1-archived`). Its narrative is in `videos/super-agent/V1.md`. Its line-by-line use of this note (lines N1–N11, their status tags and the swaps) is in this note and in `videos/super-agent/FACTS.md`, both at the tag. The accuracy rules it followed hold for any film of this article:
- **The core claim** as blocks 25, 31–32 and 124 state it: a Router that neither executes nor decomposes, and one Worker per task.
- **Built, proposed and open shown on screen**, from the matrix at `8c32a9d`. Each label covers exactly the parts it is true for: "built" covers the two levels, and proactive pickup is off by default.
- **The numbers to use**: p95 about half; p50 about 10% lower against the stronger baseline (39% only against the one that never delegated); 2.1–3.8× the tokens; pass-through saves Router decisions and tokens (about 23% fewer decisions, about 27% fewer tokens), not time. Results are re-plotted and labelled synthetic and indicative only. The table's clock is not stated, so minutes need that caveat; #4 V1 showed none.
- **The stress test** labelled "mock Workers", with per-decision time never derived from batch size and request time (block 118). #4 V1 showed only its endpoints (about 1 → 40 Triggers/min, 6.4 → 1.6 s per decision).
- **Credit**: a plain-text credit (title, the DeepSeek Harness team, Yujia Qiao, the zh and EN dates) and a non-affiliation line; URLs off screen.
- **"Authors' experience"** stays attached to 3–5 sessions.
- **Facts** cite 1-based block numbers, the prototype SHA, the Wayback timestamps and the access date.

## What we deliberately did NOT adopt, and why
- **Competitor comparisons and the "rival" framing** (#4 V1's editorial choice, which V2 kept): a film made with Claude would not be neutral, and the article names no other product; its only outside reference is Anthropic's post.
- **Anthropic's brain/hands metaphor**: it is Anthropic's image, not DeepSeek's; #4 V1 used its own (a laptop shuts while dashed always-on parts carry on).
- **The article's figures**: no layouts (module map with [2]–[6] tags, hub and spoke, sieve, thread cards, bypass lane, pointer graph, swimlanes, cloud over machines), no white-and-blue palette, cover art, matplotlib charts, IDs or dialogues. Data is re-plotted in our style and credited.
- **Psychology on screen** (the Cowan coincidence invites a false proof), reach numbers, star counts and the CVE.
- **Mechanisms #4 V1 left out** (its 2:56 cut also left out the full-duplex loop, Inline & Spill, Chain of Recall, the Watchdog and the systems-ideas framing; the 3:44 cut of 2026-11-09 brought them back). Not doctrine for V2:
  - Acting ahead (blocks 73–74): only a test fixture in the prototype.
  - The lighter Router model (block 32): configurable in the prototype, not demonstrated by it.
  - Credential leakage (block 136).
  - Context boundaries across teams and A2A (blocks 131–132), a Router-trained model, and sessionless interfaces beyond stepping in midway.
  - The §7.2 batch sizes (1.0 → 2.8) and per-request times (2.5 → 3.9 s): V1 showed the endpoints only.
  - BYOM in words (V1 showed it as a picture, proposed).
  - The prototype's card numbers.
  - Analogies the article does not name (pub/sub, actors, the event loop, Lampson, Denning): description and README only.
- **Prototype misdepictions**: a shell-less Router, sandboxed Workers, §7.2 numbers shown as properties of the public code.

## Gotchas
- Research reports mix 0-based and 1-based block numbers; this repo uses 1-based. Odd figure numbers (1–27) in some reports are X `localMediaId` values, not the article's numbering.
- "About 37% fewer tokens with pass-through" is an arithmetic slip: 37% more without it means about 27% fewer with it. The same slip turns "about 30% more Router decisions without it" into "30% fewer with it"; the correct figure is about 23% fewer.
- The prototype's 5 s is a foreground-to-background threshold, not a shell cap.
- Grepping the prototype for "pass-through", "Chain of Recall", "watchdog", "spill", "BYOM", "daemon", "speculative" or "full-duplex" finds nothing: pass-through is "Subscription fan-out", and the roles are 主 Session / 执行器 Session.
- A request addressed to the agent is explicit and works in every accept mode; only *inferred* work waits for `auto`.
- The X article is editable and needs a login, and the fxtwitter proxy is third-party: keep the Wayback snapshots, and compare any re-fetch with the text hash in Pin (no copy of the fetched JSON is kept, in git or `.cache/`).
- **[V via mirror]** marks article facts read through api.fxtwitter.com. The Pin records that the article was read through that proxy, so the older [V] article tags carry the same caveat.
- **Overclaims to avoid** (critique of 2026-11-08):
  - "Forgets nothing": recall reduces loss (block 68), and long-term memory is open (block 125).
  - "Taken over" for Proactive: pickup is `observe` by default, and acting ahead is a mechanism plus a test fixture. Write "by design" or "can take over", with "off by default" beside it.
  - Filing the 100-word cap under waiting: it protects attention (block 87).
  - Drawing Inline & Spill inside a Worker: it is clearest at the Router's `worker_report` cards.
- **"People only sign off" needs block 128.** Block 139 moves people up to decisions and sign-off, but block 128 leaves stepping in, taking over or working alongside mid-task open. #4 V1 qualified its sign-off ending with it.
- **"Follow-ups skip the Router" means they skip its decision, not its view.** The Router sees every event (block 58), and the prototype sends it a `follow_up` notice.
- **Block 83 versus the code.** The article says the async loop is in the Harness but not enabled by default. The prototype's presets switch it on at 5 s, and the Harness `standard` preset at `fcc0ad4` appears to as well. Write neither "on by default in DeepSeek Harness" nor "off in the prototype".
- **Block 18 files multi-channel under Continuous and Productive.** The cap's attention reading comes from block 87, not from the trait map.
- **"Delegation prompt" and "delegation-first prompt" are one design.** The table (entity 13) uses the first name, block 115 the second.
- **The 50 characters appear twice:** as the article's locality example (block 66) and as the prototype's message stubs (`docs/007-architecture.md:546`). Neither is the source of the other's number.
- **The prototype's hourly check is run by an agent**, so "absent as an agent" was wrong (struck in the matrix). What is absent is the progress and drift judgement.

## Not read
- The Chinese original (WeChat verification page; Zhihu 403; the Bilibili column empty; the CSDN copy 521): zh terms come from IT之家, 量子位 and one reprint.
- X replies and quote-posts, Reddit, Zhihu search, the original Bloomberg and SCMP pages (403); no coverage found in 机器之心, InfoQ 中文, 36氪 or V2EX.
- The internal Super-agent instance, the experiment code, the model used, and whether the table minutes are time-scaled.
- Every prototype source file in full (docs, prompts, presets and the cited files were read); the deepseek.com Harness page beyond a summary.
- Leroy 2009 (attention residue) beyond its metadata; the Olsen & Goodrich fan-out paper; the full text of Mark et al. 2008.
- Which preset a fresh Harness profile selects, and how the job runtime (`dsh-jobs-local`) is wired. At `fcc0ad4` only the bash tool's README and the preset files were read (Q6).
- The Chinese original's own terms for the four traits and the new mechanisms (Q7).
- Prototype checks not repeated on 2026-11-09 and still resting on the matrix: per-Thread batching, the 160-character previews, the Trigger sources, and acting ahead as a test fixture only.
