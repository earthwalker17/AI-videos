# Facts: Who Routes the Agents? (V2)

Sections 1 to 10 are V1's research on the article, its prototype and its reception, kept so that V2
need not redo it (V1: tag `video/super-agent/v1-archived`). **Section 11 is the claims table for
V2's script:** every on-screen claim, number, date and attribution, with the finding it rests on.
The article's text hash and the prototype's commit were re-checked on 2026-11-16 and are unchanged.
Sources: [sources.jsonl](sources.jsonl). Fuller note:
[references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md).

## Conventions
- **Tags:** [V] primary source; [S] secondary (press, a reprint); [U] unverified or our inference
  (`references/README.md`); [calc] our arithmetic on the article's numbers. **[V via mirror]:** the
  article was read as JSON through api.fxtwitter.com, a third-party mirror (x.com needs a login);
  every [V] on an article fact carries that caveat.
- **Blocks** are numbered from 1 in the mirror's order (143 blocks). Figures are atomic blocks:
  112 (completion chart and caption), 113 (results table), 119 (batching chart). Some reports use
  0-based indices or X `localMediaId` values ("fig 23" = block 112, "fig 27" = block 119): cite blocks.
- **Pins:** article id 2116829218935857152, created = last modified 2026-11-01T11:37:54Z; Wayback:
  the X post `20261104183343`, the prototype page `20261104092814`; text hash: sha256 of
  `JSON.stringify(blocks.map(b => b.text))` =
  `d1a1fdc670eb78799d37237e73a4597e7b3cb5029a59f6deb16e2eab27d458b9` (143 blocks; same in three fetches);
  prototype `file:line` at `8c32a9d`, Harness at `fcc0ad4`. Read 2026-11-07/08, re-checked 2026-11-09. **Stale after
  2026-12-08:** V2 locked on 2026-11-17, inside that window; re-check the article for edits and the
  repositories for commits before any later use.
- **Licence:** the article states none: paraphrase facts, quote ≤ 25 words with the source id,
  never reuse its figures, examples, IDs or dialogues; charts are redrawn and labelled re-plotted.
  Prototype and Harness: MIT.

## 1. The article and its versions
| Finding | Source id | Status |
|---|---|---|
| English title *Exploring Super-agent Design: Towards a More Autonomous Agent System*; about 6,900 words, 13 inline figures, a dark cover image, one Markdown results table | x-article-super-agent | [V via mirror] |
| "Yujia Qiao implemented the system and wrote the article", "based on shared work by the DeepSeek Harness team" (block 143) | x-article-super-agent | [V via mirror] |
| DeepSeek Harness is "an open-source agent harness developed by DeepSeek AI" (README line 5), so "DeepSeek's Harness team" is accurate | deepseek-harness-fcc0ad4 | [V] |
| Posted on X by DeepSeekHarness, status 2116857257245987236, 2026-11-01T11:37:54Z (19:37 Beijing time) | x-post-super-agent | [V via mirror] |
| Block 1: a machine translation of a Chinese original. Block 2: architectural ideas, not existing DeepSeek Harness features | x-article-super-agent | [V via mirror] |
| The Chinese original came first, 2026-10-31: IT之家 reported it at 21:36:35 Beijing time (13:36Z), 量子位 at 21:49:44; a post linking its WeChat address dates from 14:41:48Z; Bloomberg (syndicated) dates the WeChat post to Saturday 31 October | ithome-2026-10-31; qbitai-2026-10-31; x-post-shao-meng-2026-10-31; bloomberg-deccan-2026-11-01 | [S] |
| The original was **not read**: WeChat served a verification page (not bypassed), the Zhihu copy HTTP 403, a Bilibili column was empty, a CSDN copy 521. deepseek.com's /harness/ page links DeepSeek's official Zhihu organisation: suggests, does not prove, an official copy there | wechat-original; zhihu-copy | [U] |
| zh title: IT之家 《Super-agent 设计探索：迈向更自主的 Agent 系统》 (matches the English); 量子位 "Super-agent：迈向更自主的Agent系统" (no 设计探索). Use the IT之家 form, marked [S], until the original is read | ithome-2026-10-31; qbitai-2026-10-31 | [S] |
| A full Chinese reprint credited to the Zhihu copy: for cross-checking terms only, faithfulness unverified | eimoon-reprint | [S] |

## 2. The architecture as the article proposes it
Source: x-article-super-agent [V via mirror], paraphrased; quotes verbatim.

| Topic | What the article says | Blocks |
|---|---|---|
| Problem | Single tasks need ever less supervision, but the session is still the unit of work and sessions are isolated: the user switches by hand and remembers what each holds. "In our experience, a person can usually follow only 3 to 5 active sessions at once." A synchronous session blocks on long operations, mixes contexts, stops when the device goes offline, takes much manual effort to keep running. One task is limited by the model, many by human attention | 4–7 |
| Four traits | Continuous, Productive, Proactive, Persistent; no single ReAct loop gives all four, so five modules (§2–§6) do. Map: two levels → Continuous + Productive; event-driven triggers → Proactive; full-duplex multi-channel → Continuous + Productive; compute/state/environment separation + Watchdog → Persistent. Requirements, not code | 12–18 |
| Two levels (§2) | One session for all is continuous but serial and its tasks interleave; one per event is parallel but disconnected and several sessions reply separately; a trade-off of continuity against throughput, hence two layers. Sessions become "an implementation detail of the system, not a mental burden on its users" | 22–27 |
| Router layer | Long-lived; takes human interaction from every entry point; the one global sequence point, coordinator and memory; does not execute, so this single node never becomes the bottleneck; "can run without a Bash tool at all" (31). Dispatches whole tasks, tracks their relations, does not break them down, unlike an Agent Team lead; in the authors' experience a lighter model usually gives both speed and quality (32). Run as one long-lived LLM session, though the layer may be more than one session and partly code (29, 33). Mid-turn Triggers queue and enter the next call together (33–35), enough "for a team of our current size" (36). Sharding would trade shared memory and continuity for throughput (37) | 29–37 |
| Workers | Isolated context, full execution tools, one task; they decide the result, so usually need the most capable models (39). Never deal with people; report to the Router (40). No direct Worker-to-Worker messages: conflicts surface through shared Thread subscriptions, the Router relaying rare cross-task cases (41, 60). A Worker may use subagents or be an Agent Team (42) | 39–42, 60 |
| Triggers, filtering (§3) | Event-driven triggers replace a human prompt before each run (44). Two stages: a code Fast Path on deterministic conditions drops most noise before any model call; an LLM Slow Path judges the rest against policies written as prompts (which session runs it is not said) | 44, 47–50 |
| Threads, pass-through | A Thread is the event stream of one PR, IM topic or email chain. The Router creates a Worker for a Thread's first event; code passes follow-ups to the subscribed Worker; the Router handles new tasks and cross-task coordination, **but still sees every event** (58). Many-to-many | 53–60 |
| Inline & Spill | "Wasting the context window is wasting the model's intelligence." (62). The window is a cache: inline what is likely needed soon, spill the rest behind a reference or summary (63). Locality: ID and summary, then related IDs and nearby content, then truncate at a small cap with a pointer (65–67). Applies to whichever session an event reaches (62) | 62–67 |
| Chain of Recall | Follow-ups bypass the Router and tasks pile up, yet a user may raise an old task elsewhere. Triggers, Threads, Worker Sessions carry IDs; each recalled object inlines the next hop's summaries and IDs, so the model walks back hop by hop. "It reduces how much earlier information the Router layer loses over long runs" (68) | 68–71 |
| Acting ahead | Speculative execution: start background work on a signal, deliver what proves useful, discard the rest; team example "silently reproduce and fix" | 73–74 |
| Full-duplex (§4) | Blocking `run()` becomes async `start()`/`stop()`: "Started" at once, the result later as a new event; new input is handled when the current inference step ends. "DeepSeek Harness already implements this asynchronous task mechanism, but it is not yet enabled by default." (83) | 79–83 |
| Channels | The Router layer handles all external interaction (86). IM speaks only when a decision or sign-off is needed: "One simple, effective hard rule we have verified is a cap of 100 words per reply." (87). GitHub, email, documents get structured, dense output (88) | 84–88 |
| Compute, state, env (§5) | Stateless cloud containers, state in a database; environments stay where they are; a thin endpoint daemon with no session state; BYOM for intermittently online machines. Compared with Anthropic's managed-agents essay (97; anthropic-managed-agents) | 89–99 |
| Watchdog (§6) | An independent control loop outside the system: "the process is still running, but the model is stuck in an unproductive loop or has drifted from its goal." (102). A Watchdog Session on scheduled messages handles infrastructure failures and has the model judge each Worker's real progress; maintainers can ask it why something failed | 100–104 |
| Conclusion | Classic systems ideas: "Rather than proposing new theory" (138). Named by the article itself: Fast/Slow Path (47), global sequence point (31), batching in prefill (33–35), context cache (63–64), speculative execution (73), async loop (79–81), compute–storage separation (90), external control loop (101). People move up to "higher-level decisions and sign-off" (4, 139). An internal instance runs continuously on these ideas (9, 138): not checkable. The prototype is "not an official DeepSeek product" (141) | 17, 137–141 |

## 3. The public prototype at `8c32a9d`
Source: dsh-superagent-prototype-8c32a9d [V] unless marked.
- **Repo:** created 2026-10-31T09:32:46Z; one commit (authored 12:05:39Z, committed 12:06:31Z,
  "DeepSeek Harness Team"; an earlier root `6337fc8` has the identical tree); no tags, releases,
  issues or PRs. README: a research prototype, much of it engineered by coding agents, not the
  internal version; some article designs are future directions (README.md:3, 5).
- **What it is:** "a proactive coding agent for one GitHub repository", a Harness bundle
  (`cordis.patch.yml`; presets `dsh-superagent-worker`, `dsh-superagent-router`): one local process
  on 127.0.0.1 (docs/006-deployment.md:7), one SQLite file, `@deepseek-ai/dsh` 0.2.1-rc.3. Router
  and Worker models are set separately (`eval.model`, `executor.model`); none is hard-coded. Both
  presets run `danger-full-access`: "defaults, not a security boundary" (docs/003-execution.md:80).

| Article design | At `8c32a9d` | Where |
|---|---|---|
| Two levels | **Built.** One main Session in the Router role, one stored id; per Ticket an Executor Session `worker-<ticket id>` with its own directory; 3 Workers by default (1–16) plus one slot for a person's message. Code writes the Ticket; the Router's record holds the route result, then ticket cards with a `read: ticket/<id>` pointer | docs/001-domain.md:35, 37, 80; docs/007-architecture.md:475, 536; docs/003-execution.md:25, 57–61; src/policy.ts:93; src/app/store.ts:75; src/app/cards.ts:26–33 |
| Router does not execute | **Built differently.** No write or edit tools (cordis.patch.yml:163–167) but a restricted shell (`bash`, file reads, job tools); "Avoiding code reads is a prompt rule, not a tool restriction" | src/app/sessions.ts:263; docs/007-architecture.md:507 |
| Router does not decompose | **Prompt rules:** no plans or requirements added to a request; routing notes ≤ 30 words | prompts/dispatch.md:14, 38; src/infra/text.ts:3–4 |
| Only the Router replies | **In part.** The Router writes the acceptance ack, answers, results, questions; Workers write their own acks (posted in the original thread), open PRs via `gh` and reply to GitHub review threads, all under one agent account | src/app/tools/main.ts:53, 224–233; prompts/replies.md:13, 17, 25; prompts/work.md:18, 28–29; src/sources/github-channel.ts:1 |
| Event sources | **GitHub** (polled every 60 s by default), **Feishu** if switched on; no email, calendar, Slack, timer or webhook | docs/001-domain.md:68 |
| Two-stage filtering | **Built:** a code gate, then a model assessment by the main Session; explicit requests are routed, not assessed | src/core/intake.ts:25–28; src/policy.ts:191–211; src/app/assessment.ts:84–104 |
| Proactive pickup | **Off by default:** accept mode `off`/`observe`/`auto`, default `observe`; an approved inferred candidate is recorded as "would accept". "Explicit requests work in every mode" | src/policy.ts:55, 84; docs/002-authorization.md:98, 101 |
| Subscription, pass-through | **Built** as "Subscription fan-out", many-to-many. A person's follow-up gets no Eval but reaches the main Session as a `follow_up` notice, on which it may only stop the work; bot and CI follow-ups still go to Eval | docs/001-domain.md:37; src/core/intake.ts:56–58; src/app/runtime.ts:142–146; src/app/notices.ts:98–106 |
| Batching | **Own form:** per-Thread Eval batches; relays to a busy main Session delivered together at its next step (mock-host test: 5 follow-ups = 1 delivery while busy, 2 while idle) | docs/001-domain.md:43; docs/007-architecture.md:42, 93; tests/followups.spec.ts:91–116 |
| Inline & Spill, Chain of Recall | **Prototype form:** `worker_report` summaries ≤ 600 characters plus a read pointer when truncated; 50-character message stubs; 160-character card previews; assignments inlined ≤ 1,500 characters; pages 4,000 UTF-16 units (8,000 max); every shown ID readable through a tool. No dedicated multi-hop recall [U] | docs/007-architecture.md:546, 575, 577, 589, 594; src/app/cards.ts:8 |
| Acting ahead | **Mechanism only;** the `silent-bugfix` rule is a test fixture, not a default | tests/runtime.spec.ts:295–318 |
| Async loop | **Via Harness background jobs:** worker and router presets move a foreground command to a job after 5 s (a threshold, not a cap; Worker subagents use the Harness `standard` preset, 60 s); a finished job wakes the Session; `start()`/`stop()` are not names in the code | docs/003-execution.md:27, 29, 33; cordis.patch.yml:38–56 |
| 100-word IM cap | **Built:** `IM_WORDS = 100` in `Intl.Segmenter('zh')` word-like segments, enforced in the Feishu outbox (no splitting); acks capped in every channel; other GitHub replies have no word cap (schema allows 20,000 characters) | src/infra/text.ts:3; src/app/outbox.ts:29; src/app/tools/executor.ts:33 |
| Cloud + DB, daemons, BYOM | **Absent** | docs/007-architecture.md:452 |
| Watchdog | **Infrastructure half only, set up by the operator:** an hourly status-and-restart prompt run by an agent in another Harness profile, reading the log after a failed restart; no progress or drift judgement | docs/006-deployment.md:133–141 |
| Sharding, experiments, memory, A2A | **Absent:** one main Session; no experiment or benchmark code | docs/007-architecture.md:475 |

**DeepSeek Harness** (deepseek-harness-fcc0ad4) [V]: MIT, TypeScript, "Everything is a Plugin", a
developer preview (repo created 2026-08-13; npm `@deepseek-ai/dsh` 0.2.2-rc.1 at access); models
via adapters (DeepSeek's lists `deepseek-flash`, `deepseek-v4-pro`). At `fcc0ad4` the bash tool's
`promoteOnTimeout` and `enableRunInBackground` default to true and the `standard` preset mounts
`tool-jobs`, so block 83 may be dated or narrower [U]. CVE-2026-82533 (2026-09-08, before
0.1.2-alpha.1) is the Harness's, not the prototype's (shared note).

## 4. The authors' synthetic tests (§7)
Source: x-article-super-agent [V via mirror]; ratios [calc]. Results table (block 113), "Cache-read
tokens per run (all sessions)":

| Design | p50 / p95 (min) | Cache-read tokens |
|---|---|---|
| Super-agent | 12.4 / 15.7 | 23.2M |
| Super-agent without pass-through | 12.6 / 15.5 | 31.8M |
| Single session + subagent tool, neutral prompt | 20.4 / 29.5 | 6.1M |
| Single session + subagent tool, delegation prompt | 13.8 / 29.0 | 10.8M |

| Item | Finding | Blocks |
|---|---|---|
| Setup | Synthetic workloads, simplified environments, "so the results below are indicative only." Four designs ran at the same time on a group-chat and GitHub CI stream; each run had about 300 messages, about 20 of them work requests; coding was simulated by a tool that only consumes time, so scheduling is measured, not coding; 5 runs per design. No model named | 106, 108 |
| Clock | The chart caption scales message intervals and work durations by 1/4, not model call times; the table gives minutes without saying which clock | 112, 113 |
| Delegation | Neutral prompt: 0 of 5 runs delegated. Delegation-first: 4 of 5; in the fifth the model judged the work small and did it itself (the long tail). The neutral prompt still says "Use a subagent for a piece of work when appropriate" (110). The table's "delegation prompt" and block 115's "delegation-first prompt" are one design | 110, 115 |
| Pass-through | About the same completion time; without it the Router makes "about 30% more decisions per run" and tokens go 23.2M → 31.8M ("about 37% more"); it "does not make tasks finish faster or better" | 116 |
| Derived [calc] | p95: 15.7/29.5 ≈ 0.53, 15.7/29.0 ≈ 0.54 (about half). p50: (13.8 − 12.4)/13.8 ≈ 10% against the stronger, delegation-first baseline; (20.4 − 12.4)/20.4 ≈ 39% against the neutral one, which never delegated. Tokens: 23.2/10.8 ≈ 2.1×, 23.2/6.1 ≈ 3.8×. With pass-through: about 27% fewer tokens (1 − 23.2/31.8), about 23% fewer decisions (1 − 1/1.3) | 113, 116 |
| Router stress test (§7.2) | Real Router model, mock Workers (118). Triggers needing a decision from about 1 to about 40 a minute: average batch size 1.0 → 2.8, time per request 2.5 s → 3.9 s, amortised inference time per decision 6.4 s → 1.6 s (120). A decision can span several LLM requests, so per-decision time is not request time ÷ batch size (118). The gain is bounded by context length and by how many Triggers the model handles accurately in one turn (35). Removing pass-through raised the Router's peak load, yet a single Router still did not reach its throughput limit: no need to shard at the current team size (120) | 35, 118–120 |
| Reproducibility | No experiment code is public (dsh-superagent-prototype-8c32a9d [V]) | — |

## 5. Open, or explicitly not claimed
| Area | Finding | Source, blocks |
|---|---|---|
| Open problems (§8, four areas) | Scaling: when and how finely to shard, Worker topology, a Router-trained model (124); memory, the main bottleneck after months (125). Working without sessions: presenting tasks (127); stepping in, taking over or working alongside mid-task (128); per-domain designs (129). Context boundaries and A2A (131–132). Security: untrusted input keeps the scope small (134); a loop compromised by server-side intrusion or prompt injection could take over every connected endpoint (135); credentials leak through context (136) | x-article-super-agent [V via mirror], 122–136 |
| Honest caveats | Ideas, not a product (2, 141); 3–5 is experience (6); 5 synthetic runs; the big gain is the tail (p95); 2.1–3.8× the tokens; the internal instance's unprompted work (9, 138) is unverifiable, and the public prototype is reactive out of the box (`observe`) | x-article-super-agent; dsh-superagent-prototype-8c32a9d |
| 3–5 and attention research | Cowan's ~4 chunks matches 3–5 by coincidence; switch and interruption costs are well supported; two small 2026 preprints on supervising AI agents (N=11, N=16) give no fixed limit. Safe wording: "the authors find about three to five; switching and interruptions are known to be costly", never "science says 3–5" | shared note [V] / [V abstract]; no id here |

## 6. Accuracy traps for writing V2
What V1's checks caught. They bind any script about this article.

| Trap | The faithful reading |
|---|---|
| "37% fewer tokens" / "30% fewer decisions" with pass-through | Inverted: about 27% fewer tokens and about 23% fewer decisions. Recompute every number from the article's figures |
| "39% faster" | Against the baseline that never delegated; about 10% against the stronger one. Name the baseline |
| Minutes on screen; "16 vs 29 minutes"; "20.4 vs 29.5" as two designs | Table clock unstated, chart scaled 1/4: claim no real-world durations. Those are p95s of synthetic runs, and one baseline's p50/p95 |
| "Unprompted" baseline | The neutral prompt allowed a subagent "when appropriate": "left to choose" |
| Batching "adds little" | Block 33's word, but bounded (35); time per request rises 2.5 → 3.9 s; per-decision time is an amortised average |
| "Follow-ups skip the Router" | They skip its decision, not its view (58); the prototype sends a notice |
| The Router plans, splits or works | It neither decomposes (32) nor executes (31). But the prototype's Router keeps a restricted shell: never say or show it shell-less |
| Metaphors that split work | A kitchen brigade, or a manager handing out subtasks, implies decomposition, which block 32 rules out. Brain and hands is Anthropic's image (anthropic-managed-agents) |
| "Only the Router talks to you" as built | The design (40, 86); prototype Workers ack and reply on GitHub. Keep any "built" label off it |
| Proactive "taken over" | "By design": the prototype records inferred work (`observe`); explicit requests work in every mode |
| "Forgets nothing" | Recall reduces loss (68); memory over months is open (125) |
| The 100-word cap as a waiting fix | It protects attention (87); a "word" is a segmented word, not a character |
| The 5 s as a cap; Harness defaults | A foreground-to-background threshold. Say neither "on by default" nor "off" (block 83 vs the code); `start()`/`stop()` are the article's names, not the code's |
| The hourly check as a Watchdog; "absent as an agent" | It is run by an agent; what is absent is the progress and drift judgement. Not a Watchdog |
| §5 as built | Proposed: the internal instance is "built on these ideas" (138), but its deployment is not public; the prototype runs locally |
| Reading 50 characters as one fact | It appears twice: the article's locality example (66) and the prototype's stubs (docs/007-architecture.md:546) |
| Unnamed simplifications | "Router" stands for the Router layer (29, 33); "speed" for throughput; "slowest" = p95, "typical" = p50; both single-session baselines had a subagent tool; "2–4×" rounds 2.1/3.8 and "~½" rounds 0.53/0.54; Inline & Spill applies to any session (62); an illustrative example is never a documented case or one of the test's requests |

**Not claimed** (accuracy): no affiliation with or endorsement by DeepSeek; not a product, no
release plans (2, 141); no model named; not new theory (17, 138), and only the ideas the article
names are labelled as its own (pub/sub, actors, the event loop, Lampson, Denning are our
analogies); the security risk is the article's, about its proposed cloud design (135), not a
finding about shipped code. **V1's editorial choices, which V2 kept:** no competitor comparison
or "rival" framing (the article names no other agent product, and the film is made with Claude);
not Anthropic's brain/hands image (anthropic-managed-agents).

## 7. Terminology and translation
Authors' terms via ithome-2026-10-31, qbitai-2026-10-31 [S] or eimoon-reprint [S, weaker]; prototype
terms [V] (dsh-superagent-prototype-8c32a9d). The user's zh sign-offs covered V1's strings only.

| EN | Authors' zh [S] | Prototype [V] / note |
|---|---|---|
| Super-agent; agent | Super-agent kept in Latin; "Agent 系统" in both titles | Agent 智能体 (docs/001-domain.md:79); Harness zh docs 智能体团队, 子智能体; gloss 超级智能体 is ours [U] |
| route; the Router | both reports use 调度; 量子位 calls the Router 总调度员 | — |
| two-level architecture | 双层架构 (IT之家 headline, 量子位, reprint) | 两级 is the filter's: keep them apart |
| Router / Worker layer | Router 层 / Worker 层 (IT之家); 上层的Router / 下层的Worker (量子位) | 主 Session (`orchestrator`) / 执行器 Session |
| Session, Trigger, Thread | kept in Latin (IT之家: 活跃 Session) | Harness zh docs 会话; 线程 reads as an OS thread: keep "Thread" |
| two-stage filtering | 两级过滤 (IT之家); 两级事件过滤机制 (量子位); Fast/Slow Path kept | 准入 Gate / 研判 Assessment |
| subscription, pass-through | 订阅与直通机制 (量子位); 事件直通机制 (IT之家) | "Subscription fan-out". Grep finds none of: pass-through, Chain of Recall, watchdog, spill, BYOM, daemon, speculative, full-duplex |
| Chain of Recall; speculative execution | 链式召回（Chain of Recall）, 投机执行机制 (IT之家); §3.4 提前行动 (reprint) | — |
| full-duplex; async loop; channel | 全双工交互, 多信道交互 (reprint); 异步 ReAct Loop, 不同渠道 (IT之家) | Channel 渠道 |
| compute–storage separation; BYOM | 存算分离 (reprint); BYOM (IT之家) | — |
| Watchdog; sequence point | 看门狗 (量子位), 外部控制回路 (IT之家); 序点（Sequence Point） (reprint) | — |
| the four traits | 连续 / 高效 / 主动 / 持久 (IT之家, 量子位, reprint, 智东西 via Sina) | the original's own words unread |
| decisions, sign-off | 更高层的决策与验收 (reprint); Router的决策次数 (量子位) | — |
| p50 / p95; cache-read tokens | 中位数 / 95分位数; 读取缓存Token (量子位) | — |
| the test's load | 约 300 条消息，其中约 20 条为工作请求 (IT之家) | — |

## 8. Name collisions and look-alikes
- **Unrelated namesakes:** arXiv 2504.10519 *Toward Super Agent System with Hybrid AI Routers*
  (2025); a community plugin "dsh-super-agent" [S]; a Show HN "Superagent" (Sept 2026); super-agent.io [S].
- **"Super"** names the system around the loop (12–17), not a more capable model.
- **Neighbours** (docs as of 2026-11-08, shared note) [V]: Anthropic's *Building effective agents*
  (2024-12-19): orchestrator-workers, a central model breaking tasks down, the contrast with this
  Router; Claude Code Projects: one long-lived coordinator over cloud worker threads, which plans
  and splits goals; Codex cloud: a workspace per task, no coordinator described; Copilot cloud
  agent: background work, PRs, repository events. The article cites only anthropic-managed-agents.

## 9. Public discussion and reception
From the shared note [V as read; the critics' claims S]; no sources.jsonl ids except Bloomberg.

| Where | Finding |
|---|---|
| Reach, 2026-11-08 | About 3.23M views, 13.7k likes, 898 quotes, 18.3k bookmarks, no community note; the prototype 20,813 stars. Both drift: date any use |
| Expert debate | Thin: every Hacker News submission scored 1–11 points, no comments; X replies unreadable. IT之家, 量子位 and 智东西 are descriptive |
| Press | Bloomberg's headline (bloomberg-deccan-2026-11-01) says DeepSeek aims to rival Anthropic, though its text calls the work a prototype; Entrepreneur India, Techzine and a YouTube video echo a "Claude Code rival" angle; Interesting Engineering notes the benchmark's limits but misreads (the Router decomposes; "16 vs 29 minutes") |
| Blogs | redreamality (Nov 2), the best critique: praises the attention framing, the non-working Router, subscriptions, batching and the `observe` default; criticises the 3.8× tokens, the synthetic workload, the unnamed model and security; wrongly credits the article with a "65% … Claude Tag" figure. 掘金 says the Router decomposes; aicodewith ran the test suite (1,197 tests pass), no end-to-end ticket; explainx headlines "39%" |
| Other misreadings | A new product; 3–5 as measured; Workers talk to each other; the prototype's Router has no shell |

## 10. Not read, and still open
- **Not read:** the Chinese original; X replies and quote-posts, Reddit, Zhihu search, the original
  Bloomberg and SCMP pages (403); the internal instance, the experiment code, the model; every
  prototype file in full; which preset a fresh Harness profile gets.
- **Open:** whether the table's minutes are time-scaled; what block 83's "default" means; the
  original's own zh terms; prototype checks not repeated on 2026-11-09 (per-Thread batching, the
  160-character previews, the Trigger sources, acting ahead as a fixture only).

## 11. Claims table for V2's script
One row per block of on-screen text in `src/cues.ts` (the block id is in code type). "Ours" marks a
framing the film adds; it is never presented as the article's words. Numbers were recomputed from
the article's table (section 4) on 2026-11-17.

| Block | On screen | Rests on | Tag |
|---|---|---|---|
| `q`, `youdo`, `q2` | WHO ROUTES THE AGENTS? / YOU DO. | Blocks 4–7: the session is the unit of work, sessions are isolated, the user switches by hand and remembers what each holds. The question and its answer are ours | [V via mirror]; framing ours |
| `sess` | SESSION, and the count 1 to 7 beside the cells | Blocks 4–7: the session is the unit of work. The count is the film's own illustration of sessions adding up; it is set solid, because hollow numerals are kept for the authors' test figures | [V via mirror]; count ours |
| `few` | One team finds a person can usually follow 3 to 5 sessions. | Block 6: "In our experience, a person can usually follow only 3 to 5 active sessions at once." The team is the authors; it is experience, not a measurement (section 5) | [V via mirror] |
| `title` | THE SUPER-AGENT DESIGN / from DeepSeek's Harness team / TWO LEVELS · A DESIGN, NOT A PRODUCT | Title (section 1); block 143 and the Harness README line 5; blocks 2 and 141 (ideas, not existing features; not an official product); two levels: blocks 22–27 | [V via mirror], [V] |
| `router` | ONE LONG-LIVED ROUTER, with channels CHAT, CODE REVIEW, EMAIL | Blocks 29–33 (long-lived; takes human interaction from every entry point), 84–88 (IM, GitHub, email, documents). The three names show the design; the prototype has GitHub and Feishu only (section 3), and the film puts no "prototype" mark on them | [V via mirror] |
| `routes` | IT ROUTES. IT NEVER EXECUTES. / Whole tasks go down, unsplit. | Block 31 (does not execute), block 32 (dispatches whole tasks, does not break them down) | [V via mirror] |
| `proto1` | PROTOTYPE ROUTER: KEEPS A SHELL, NO WRITE TOOLS | cordis.patch.yml:163–167; src/app/sessions.ts:263; docs/007-architecture.md:507. The stamp is the caveat to "it never executes": the prototype's Router has no write or edit tools but keeps `bash`, file reads and job tools. It says "keeps a shell", not "restricted shell": the presets run `danger-full-access` (section 3), so no sandbox is claimed | [V] |
| `worker` | A WORKER: ITS OWN CONTEXT / One task. Full tools. | Block 39 | [V via mirror] |
| `answers` | By design, only the Router answers you. | Blocks 40, 86. "By design" because the prototype's Workers acknowledge and reply on GitHub (section 3) | [V via mirror], [V] |
| `spine` | ONE ROUTER FOR ALL THIS? | Our question. The article raises the same concern itself (31: the single node "never becomes the bottleneck"; 36–37 on sharding) | ours |
| `events` | EVENTS, NOT JUST PROMPTS | Block 44: event-driven triggers replace a human prompt before each run. The film says "events" throughout | [V via mirror] |
| `gate1` | GATE ONE: PLAIN CODE / No model runs. | Blocks 47–50: a code Fast Path on deterministic conditions, before any model call. Prototype: src/core/intake.ts:25–28, src/policy.ts:191–211 | [V via mirror], [V] |
| `gate2` | THEN A MODEL JUDGES. | Blocks 47–50: an LLM Slow Path judges the rest against policies. The article does not say which session runs it; in the prototype the main Session does (src/app/assessment.ts:84–104), so the picture names no separate agent | [V via mirror], [V] |
| `proto2` | PROTOTYPE DEFAULT: UNASKED WORK IS ONLY RECORDED | Accept mode `observe` by default: an approved inferred candidate is recorded as "would accept"; explicit requests work in every mode (src/policy.ts:55, 84; docs/002-authorization.md:98, 101) | [V] |
| `v1` | 1. FEW REACH THE ROUTER. | Block 47: the Fast Path "drops most noise before any model call". No number is given, and none is shown. "Reach" means reach a model's judgement: in the prototype the Router's own session judges what the code gate lets through (`gate2`), and in the picture seven events of about ninety get that far. (The first wording, "most never reach it", left two first-time viewers unsure what "it" was.) Follow-ups are the next answer: the Router sees them without deciding (`follow`) | [V via mirror] |
| `follow` | FOLLOW-UPS GO STRAIGHT IN / Seen by the Router. Not decided. | Blocks 53–60: code passes follow-ups to the subscribed Worker; the Router still sees every event (58). Prototype: a person's follow-up reaches the main Session as a notice (src/app/runtime.ts:142–146) | [V via mirror], [V] |
| `cheaper` | CHEAPER, NOT FASTER / ~27% fewer tokens than without it / AUTHORS' TEST | Block 116 and the table (113): 23.2M against 31.8M cache-read tokens per run, 1 − 23.2/31.8 = 27.0%; it "does not make tasks finish faster or better". "Tokens" on screen are the table's cache-read tokens, here and in `price`. This figure comes 18 bars before the test's caveats (`test`): it carries its source stamp, and the block's reading time has no room for "synthetic" as well | [V via mirror], [calc] |
| `v2` | 2. FOLLOW-UPS SKIP ITS DECISION. | As `follow`: its decision, not its view | [V via mirror] |
| `wait` | ARRIVALS WAIT, THEN ENTER TOGETHER | Blocks 33–35: events that arrive mid-turn queue and enter the next call together | [V via mirror] |
| `cost` | 6.4 s → 1.6 s / model time per decision, at ~40× the load / AUTHORS' STRESS TEST · MOCK WORKERS | Blocks 118–120: a real Router model with mock Workers; amortised inference time per decision 6.4 s → 1.6 s as events needing a decision rise from about 1 to about 40 a minute: 40 times the load, said without the unit because the test's clock is unstated. The time per request rises (2.5 s → 3.9 s), so the picture never shows calls getting shorter | [V via mirror], [calc] |
| `limit` | UP TO A LIMIT PER CALL. | Block 35: bounded by the context length and by how many events the model handles accurately in one turn | [V via mirror] |
| `v3` | 3. THE REST ARRIVE TOGETHER. | As `wait` | [V via mirror] |
| `cache` | ITS CONTEXT IS A CACHE / What it needs soon stays in view. | Blocks 62–67 (the window as a cache; inline what is likely needed soon, spill the rest behind a reference or summary). The article applies it to whichever session an event reaches; the film shows it on the Router | [V via mirror] |
| `recall` | BY DESIGN: RECALL BY ID / It loses less. Not nothing. | Blocks 68–71: each recalled object inlines the next hop's summaries and IDs; it "reduces how much earlier information the Router layer loses". "By design": the prototype has summaries and read pointers, and reads any shown ID through a tool, but has no dedicated multi-hop recall (section 3); the picture draws only the single hop, solid. Memory over months is open (125) | [V via mirror], [V]; the prototype's lack of multi-hop recall is [U] |
| `v4` | 4. DETAILS WAIT BEHIND IDS. | As `cache` and `recall` | [V via mirror] |
| `test` | THE AUTHORS' TEST / Synthetic. 5 runs. Indicative only. | Blocks 106, 108: synthetic workloads, "indicative only", 5 runs per design, simulated coding | [V via mirror] |
| `test` (rows) | SUPER-AGENT · ONE SESSION + SUBAGENT TOOL / told to delegate first (stays beside the row's name under every length; the rows are named under the standing caveats) | The table's rows (113): the Super-agent, and the single session with a subagent tool under the delegation prompt (110, 115) | [V via mirror] |
| `slow` | SLOWEST TASKS: ABOUT HALF THE TIME / P95 · RE-PLOTTED | p95 15.7 against 29.0: 0.54. Lengths drawn in that ratio, with no unit (the table's clock is unstated and the chart is time-scaled) | [V via mirror], [calc] |
| `typ` | TYPICAL TASKS: ABOUT 10% FASTER / P50 | p50 12.4 against 13.8: 10.1% less. Against the baseline that never delegated it would be 39%; the film uses the stronger baseline and names it | [V via mirror], [calc] |
| `price` | THE PRICE: 2–4× THE TOKENS / told to delegate first / left to choose (each lower band named at its tip, under the one name ONE SESSION + SUBAGENT TOOL; no multiple stands beside a band: the lengths carry 2.1× and 3.8×) | Cache-read tokens 23.2M against 10.8M (2.1×, the delegation prompt) and 6.1M (3.8×, the neutral prompt, which allowed a subagent "when appropriate": "left to choose") | [V via mirror], [calc] |
| `proposed` | PROPOSED / Running in the cloud. A check for stuck Workers. | Sections 5 and 6 of the article (blocks 89–104). Neither is in the prototype: it runs locally, and its hourly restart prompt judges no progress (section 3) | [V via mirror], [V] |
| `open` | OPEN / Long memory. Security. Stepping in mid-task. More Routers. | Blocks 122–136: memory after months (125), security (134–136), stepping in or taking over mid-task (128), when and how to shard (124) | [V via mirror] |
| `notyou`, `decide` | NOT YOU. BY DESIGN / YOU DECIDE. YOU SIGN OFF. | Blocks 4 and 139: people move up to "higher-level decisions and sign-off". "By design" stays on screen because the public prototype builds only part of it | [V via mirror]; framing ours |
| `recap` | 1. FEW REACH THE ROUTER. / 2. FOLLOW-UPS SKIP ITS DECISION. / 3. THE REST ARRIVE TOGETHER. / 4. DETAILS WAIT BEHIND IDS. | The four verdicts again, word for word (`v1` to `v4`), as one list | as `v1`–`v4` |
| `end` | WHO ROUTES THE AGENTS? / After "Exploring Super-agent Design" by the DeepSeek Harness team, 2026 / An independent explainer. Not affiliated with DeepSeek. | The article's title and credit (section 1), posted 2026-11-01 (the Chinese original 2026-10-31 [S]); the non-affiliation statement is ours | [V via mirror] |

**What the picture adds to the words** (each checked against the same findings). Illustrative
events, tasks, counts and proportions are the film's own, never the article's examples or data.

- **Throughout.** A ring marks an event a person sent. A capsule is one whole task and is never
  split. Green light means a model is running; it is the film's only glow. Dashed marks are
  proposed, gaps are open. The only lines are history or a subscription. The names YOU, ROUTER,
  WORKERS and EVENTS stand on the stack whenever it is seen edge-on, each in the band of what it
  names; CODE, MODEL, RECORDED, ID and the two rows of the re-plot are named the same way.
- **Flat (bars 1–8).** Seven sessions, counted 1 to 7, and one coral dot for your attention: the
  film's illustration of the article's "3 to 5", not its data. A session you have left goes pale;
  no claim is made about what it does meanwhile.
- **The lift (bars 9–12).** Your trail becomes the Router's line: the film's image for "the person
  is the router today", not a mechanism of the design. The pulse that runs along the line as it
  forms is drawn in bone, not in light: no model runs yet.
- **Who answers (bars 23–24).** One report (a plain dot, no ring) rises from the working cell to
  the Router's line, whose model runs once on it, and one dot rises from the line to you; nothing
  goes from the Worker to you. This is the design's route (blocks 40, 86), drawn with ordinary solid
  marks under the words "By design": the prototype's Workers also acknowledge and reply on GitHub
  (section 3).
- **The question (bars 25–26).** A crowd of events presses under the Router with nothing lit. It is
  the film's picture of a worry, not a measured load, and it never shares a frame with a figure.
- **Gates.** No green appears before the model gate. The code gate's check is drawn as immediate; no
  latency is claimed (the prototype polls GitHub every 60 s). The model gate is a rule on the
  events' plane named only MODEL: no separate agent is drawn, because the article does not say
  which session judges and in the prototype the Router's own session does. The proportion is the
  film's: about eighty events end as ash at the code gate against seven that reach the model; the
  article says "most noise" and gives no number, and none is on screen. One ringed event is
  stopped at the code gate and lies in the ash with its ring; the three ringed events the model
  judges pass. The sources support "explicit requests work in every mode", not "every message from
  a person is acted on" (about 20 of the test's 300 messages were requests). Ringed events get a
  model pulse, as in the article's slow path; the prototype routes explicit requests without
  assessing them (section 3). A passed event crosses the MODEL rule before it rises towards the
  Router. An unasked event the model accepts stops at a shelf named RECORDED as a hollow outline
  (drawn larger than a running event, for legibility only): recorded, not started (observe mode).
- **Threads.** The request rises to the Router and gets one model call. A thin line from its lane to
  the Worker's cell is the subscription. Every follow-up shown is a person's; in the prototype bot
  and CI follow-ups still go to the model. A tick on the rail means "seen"; nine ticks to one
  lit decision is illustrative, not the test's ratio (about 27% fewer tokens, about 23% fewer
  decisions). Follow-ups arrive at one pace and the Worker's light turns at one pace throughout:
  not faster.
- **Batch.** While the test's figures are on screen every call holds three (the test's average batch
  was 2.8 at its highest load) and lasts longer than a call of one, never shorter. A call has
  four places: the film's own number for "a bound", which the article does not count. The rate of
  arrivals on screen is not the test's 1 to 40 a minute.
- **Cache.** The most recent items stay whole; the article's rule is "likely needed soon", which the
  picture shows as recency. Ticks, bodies and the shelf are solid (the prototype has summaries,
  stubs and read pointers); the shelf as a place is the film's image, and a tick is named ID. The
  recall is one hop, drawn solid: the named ID is read, a line runs to its own body, and a copy
  returns to the call (the prototype reads any shown ID through a tool). The article's chain of
  recall, object to object, is not drawn; "by design" in the headline covers it and the article's
  claim about loss. A piece of another body falls off the shelf and lies under it in ash: less is
  lost, not nothing.
- **Evidence.** Before any length, the same stream of events runs along both rows (the designs ran
  on one synthetic stream; its rings are simulated people). Lengths are exact ratios from one left
  edge: 15.7 to 29.0, then 12.4 to 13.8 on that same scale with the slowest left behind in ash,
  then 23.2 to 10.8 to 6.1 on a scale of their own. No axis, tick, unit or figure is drawn, and the
  trails' common pace is not a clock. The token bands are lit although they stand for a total.
  The third band is the single session left to choose. "told to delegate first" stands beside the
  baseline's name under every length; at the price the one name heads both lower bands and each
  band's own words stand at its tip. No multiple is set beside a band (two cold readers took it for
  that band's own cost): the headline says 2–4× and the lengths show which is which.
- **Status.** Proposed: a dashed copy of the Router's whole line hovering just over its rail, its
  sentence over the Router's slab (running in the cloud) and a dashed session in front of the Workers (the check for stuck Workers); neither is
  drawn solid. Open: a gap in the rail (long memory), a coral reach from you that stops short of a
  working cell on an open end (stepping in mid-task), a slice through the Router's slab (more Routers) and a window in the
  Workers' face with the world's events showing through (security: untrusted input, the film's
  reading of blocks 134–136, not a finding about the prototype).
- **Close.** A result comes up by way of the Router, whose model runs once on it: our inference from
  the Router being the session that answers people (blocks 40, 86). A coral ring round a result
  means a person signed it off; no approval mechanism of the prototype is claimed. The recap repeats
  the four verdicts and adds nothing. Far below the recap, and under the end card, the Router's line
  lights now and then: the film's picture of the design running on without you, not a claim about
  any deployment.
