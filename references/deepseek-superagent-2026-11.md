# DeepSeek Harness "Super-agent" design article and its research prototype (2026-11)

| | |
|---|---|
| Upstream | Article (English, X): https://x.com/DeepSeekHarness/status/2116857257245987236 · Chinese original (WeChat, not read): https://mp.weixin.qq.com/s/zoS7GlReWPhfCjENGxXCdg · prototype: https://github.com/deepseek-ai/dsh-superagent-prototype · DeepSeek Harness: https://github.com/deepseek-ai/deepseek-harness |
| Pin | Article: X article id `2116829218935857152`, status `2116857257245987236`, created and last modified 2026-11-01T11:37:54Z, 143 blocks (read as JSON through the public api.fxtwitter.com proxy). Wayback: the X status at `20261104183343`, the prototype repo page at `20261104092814`. Prototype `8c32a9dc5d72c033816c6a8110b37f40cf94fba4` (its only commit). DeepSeek Harness `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` (2026-11-04, branch `master`). |
| Licence | Article and figures: no licence stated, so facts are paraphrased, quotes stay short and figures are never reused. Prototype and DeepSeek Harness: MIT ("Copyright (c) 2026 DeepSeek Harness Team" for the prototype). |
| Accessed | 2026-11-08 (prototype and Harness first read 2026-11-07, about 23:40 UTC) |
| Stale after | 2026-12-08 for the prototype, the Harness (a pre-1.0 developer preview) and the reach counts. Check the article for edits or errata before the review cut and again before release. |

## What it is
A design essay by the DeepSeek Harness team, *Exploring Super-agent Design: Towards a More Autonomous Agent System*; Yujia Qiao implemented the system and wrote the article (block 143). It argues that once one person runs many agent sessions, the limit is human attention, not the model. Its answer is a long-lived **Router** that talks to people and dispatches work without doing it, above isolated **Workers** that each run one task. Further mechanisms (event filtering, Thread subscriptions, context handling, an async loop, compute/state/environment separation, a Watchdog) and two small synthetic experiments follow. The team also published an MIT research prototype: a DeepSeek Harness plugin that acts as a coding agent for one GitHub repository.

## Why it matters here
Video #4 (`videos/super-agent`, *Who Routes the Agents? / 谁来调度智能体？*) explains this article. Its facts gate needs every on-screen claim pinned to a block, the prototype SHA or a snapshot, and the film labels each part built, proposed or open: the matrix below is the source of truth for that.

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
| 100-word IM cap | **Built**: counted with `Intl.Segmenter('zh')`, enforced in the Feishu outbox, splitting refused; GitHub replies have no word cap (the schema allows 20,000 characters) and open with an automated-agent disclosure line | `src/infra/text.ts:2-16`, `src/app/outbox.ts:29` |
| Stateless cloud compute + database | **Absent**: one local process, SQLite | `docs/007-architecture.md:452` |
| Endpoint daemons / BYOM | **Absent** (the Harness has SSH providers; unused) | — |
| Watchdog | **Absent as an agent**: an hourly status-and-restart prompt from another Harness profile; no model-judged progress check | `docs/006-deployment.md:133-141` |
| Sharding; experiment harness; memory, sessionless UI, A2A | **Absent** (one master session; unit and integration tests only) | `docs/007-architecture.md:475` |

The article's own short summary (block 124) is what is built: one long-lived Router Session, subscription with pass-through, no direct Worker-to-Worker messages.

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
10. The prototype differs from the article: the Router keeps a shell, Workers reply on GitHub, and there is no cloud, BYOM, Watchdog, sharding or experiment harness.
11. Security is unsolved: one hijacked loop could reach every connected machine.

## What we adopted / adapted
Video #4's use of this note (treatment approved 2026-11-08):
- **Built vs proposed from the matrix.** Solid line = in the public prototype at `8c32a9d`; dashed = proposed; a sketch "?" = open. The built tag is scoped to the two levels; proactive pickup carries an "off by default" tag; always-on parts and the security risk are dashed or open.
- **The core claim** as blocks 25, 31–32 and 124 state it: a Router that neither executes nor decomposes (a split sketch is struck out), one Worker per request.
- **Numbers**: p95 ≈ ½, p50 about 10% against the stronger baseline, 2–4× tokens (2.1× / 3.8×), pass-through's saving in Router decisions rather than time (about 30% more decisions without it, about 23% fewer with it: not "30% fewer"), and the stress test's endpoints only (1 → 40/min, 6.4 → 1.6 s average, mock Workers). The chart is labelled "synthetic · re-plotted · indicative only", with no minutes on screen; "authors' experience" stays attached to 3–5.
- **Credit and terms**: plain-text credit (title, DeepSeek Harness team, Yujia Qiao, the zh and EN dates) and a non-affiliation line; URLs off-screen (description, CREDITS.md, `sources.jsonl`, README). zh copy keeps the Latin technical terms, glossed as IT之家 and 量子位 do.
- **Facts**: FACTS.md cites 1-based block numbers, the prototype SHA, the Wayback timestamps and the access date.

## What we deliberately did NOT adopt, and why
- **Competitor comparisons and the "rival" framing**: the film is made with Claude, so they would not be neutral, and the article names no other product; its only outside reference is Anthropic's post.
- **Anthropic's brain/hands metaphor**: it is Anthropic's image, not DeepSeek's; the film uses its own (a laptop shuts while dashed always-on parts carry on).
- **The article's figures**: no layouts (module map with [2]–[6] tags, hub and spoke, sieve, thread cards, bypass lane, pointer graph, swimlanes, cloud over machines), no white-and-blue palette, cover art, matplotlib charts, IDs or dialogues. Data is re-plotted in our style and credited.
- **Psychology on screen** (the Cowan coincidence invites a false proof), reach numbers, star counts and the CVE.
- **Mechanisms cut for length**: the full-duplex loop (needs its own diagram), Inline & Spill and Chain of Recall (too deep for under three minutes), speculative work (only a test fixture in the prototype), the Watchdog and credential leakage (text budget). If a narrated version is ever made, the systems-ideas framing (block 138) and the full-duplex beat come back first.
- **Prototype misdepictions**: a shell-less Router, sandboxed Workers, §7.2 numbers shown as properties of the public code.

## Gotchas
- Research reports mix 0-based and 1-based block numbers; this repo uses 1-based. Odd figure numbers (1–27) in some reports are X `localMediaId` values, not the article's numbering.
- "About 37% fewer tokens with pass-through" is an arithmetic slip: 37% more without it means about 27% fewer with it. The same slip turns "about 30% more Router decisions without it" into "30% fewer with it"; the correct figure is about 23% fewer.
- The prototype's 5 s is a foreground-to-background threshold, not a shell cap.
- Grepping the prototype for "pass-through", "Chain of Recall", "watchdog", "spill", "BYOM", "daemon", "speculative" or "full-duplex" finds nothing: pass-through is "Subscription fan-out", and the roles are 主 Session / 执行器 Session.
- A request addressed to the agent is explicit and works in every accept mode; only *inferred* work waits for `auto`.
- The X article is editable and needs a login, and the fxtwitter proxy is third-party: keep the Wayback snapshots, and a local hash of the fetched JSON in `.cache/` (never in git).

## Not read
- The Chinese original (WeChat verification page; Zhihu 403; the Bilibili column empty; the CSDN copy 521): zh terms come from IT之家, 量子位 and one reprint.
- X replies and quote-posts, Reddit, Zhihu search, the original Bloomberg and SCMP pages (403); no coverage found in 机器之心, InfoQ 中文, 36氪 or V2EX.
- The internal Super-agent instance, the experiment code, the model used, and whether the table minutes are time-scaled.
- Every prototype source file in full (docs, prompts, presets and the cited files were read); the deepseek.com Harness page beyond a summary.
- Leroy 2009 (attention residue) beyond its metadata; the Olsen & Goodrich fan-out paper; the full text of Mark et al. 2008.
