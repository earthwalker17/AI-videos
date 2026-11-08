# Facts: Who Routes the Agents?

The film explains one article: *Exploring Super-agent Design: Towards a More Autonomous Agent
System* by the DeepSeek Harness team, written by Yujia Qiao, who also built the system. Every
claim, number, date and attribution in the approved treatment (2026-11-08) has a row below.
The rows quote the treatment's lines. SCRIPT.md fixes the final copy in session 2, and any
line that changes there is checked again here before the script is locked. Sources are in
[sources.jsonl](sources.jsonl), one JSON object per line. The fuller research note is
[references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md).

**Conventions**
- **Article blocks** are numbered from 1, in the order the fxtwitter API (a third-party proxy
  for public X data) returns the article's 143 blocks. Block 1 is the machine-translation
  notice and block 143 the credits. Three embedded blocks matter: block 112 is fig 23 with its
  caption, block 113 the results table and block 119 fig 27.
- **Prototype references** are `file:line` in `deepseek-ai/dsh-superagent-prototype` at
  `8c32a9d`.
- **Tags:** [V] read at a primary source; [S] secondary (press or a reprint); [U] unverified
  or our own inference (the legend in `references/README.md`).
- **Cue ids:** C1–C28 are the treatment's 28 narration lines in order. The title card and the
  end card are the other two text cues.
- **Checked:** every row was checked on 2026-11-08. How: **A** = the English article read
  through the fxtwitter API; **P** = the prototype's files read at `8c32a9d`; **R** = the
  IT之家 and 量子位 pages read; **calc** = our arithmetic on the article's numbers, shown under
  "Numbers and their caveats".
- **Quotes** are at most 25 words and attributed by source id. Each source's URL and access
  date are in sources.jsonl.

| Claim | As said in the video | Source id | Checked |
|---|---|---|---|
| The article names the design and its system Super-agent (block 8) and credits it to shared work by the DeepSeek Harness team (block 143) [V]. DeepSeek Harness is "an open-source agent harness developed by DeepSeek AI" (its README, line 5) [V], so "DeepSeek's Harness team" is accurate | Title card subline: "Super-agent, a design by DeepSeek's Harness team" | x-article-super-agent; deepseek-harness-fcc0ad4 | 2026-11-08 · A; README at `fcc0ad4` |
| Agents use a single session as the unit of work, and sessions are isolated. A user running several tasks in parallel switches between sessions by hand and remembers what each contains. Multi-tasking is limited by human attention (block 6) [V]. The two short sentences are our framing of this | C1 "Your AI agents work in parallel. You can't." | x-article-super-agent | 2026-11-08 · A |
| As above: each session holds its own context, and the user has to remember what each one contains (block 6) [V] | C2 "Each session knows one task. You must know them all." | x-article-super-agent | 2026-11-08 · A |
| "In our experience", a person can usually follow only 3 to 5 active sessions at once (block 6). This is the authors' experience, not a measurement [V]. IT之家 and 量子位 report it as the team's observation [S] | C3 "In the authors' experience, you can follow about 3–5." The picture grows the tiles from 5 to 8 with about four lit, and draws no number or threshold | x-article-super-agent; ithome-2026-10-31; qbitai-2026-10-31 | 2026-11-08 · A; R |
| Our framing. The article says the user switches between sessions by hand and keeps track of them (block 6); it does not call the person a router [V] | C4 "You've quietly become their router." | x-article-super-agent | 2026-11-08 · A |
| Routing every event to one session gives the most continuous context. But a ReAct loop works one step at a time, so tasks take long and throughput stays low, and the tasks' details interleave in one context, which degrades the results (block 23) [V] | C5 "All in one session: it remembers, but is serial and muddled." | x-article-super-agent | 2026-11-08 · A |
| A new session per event maximises concurrent throughput. Without a shared global context the results are disconnected, and several sessions replying separately confuse the user (block 24) [V] | C6 "One per event: fast, but disconnected, and all reply to you." | x-article-super-agent | 2026-11-08 · A |
| The two extremes are a trade-off between continuity and throughput (block 22) [V]. "Speed" stands for throughput | C7 "Continuity or speed: must we pick one?" | x-article-super-agent | 2026-11-08 · A |
| Splitting the work between two layers gets both continuity and throughput (block 25) [V] | C8 "Super-agent keeps both, on two levels." | x-article-super-agent | 2026-11-08 · A |
| The Router layer is long-lived and receives human interaction from every entry point (block 31), and it still sees every event (block 58). The authors run it as one long-lived LLM session (block 33) [V] | C9 "Above: one long-lived Router hears every channel." Label "Router" | x-article-super-agent | 2026-11-08 · A |
| The Router layer is designed not to execute tasks: it only deals with people and dispatches (block 31), and it does not break down individual tasks (block 32) [V]. In the prototype the main Session has no file write or edit tools (cordis.patch.yml:163–167), and its prompt forbids adding plans or requirements to a request (prompts/dispatch.md:14, 38) [V] | C10 "It hands each task over whole and never does the work." The picture strikes out a split sketch | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P |
| Each Worker has an isolated context and a full set of execution tools, and works on a single task (block 39) [V] | C11 "Below: each task gets its own Worker, context and tools." Label "Worker" | x-article-super-agent | 2026-11-08 · A |
| At `8c32a9d` the two levels exist. There is one long-lived main Session in the Router role: it evaluates Triggers, dispatches Tickets and replies (docs/001-domain.md:80), under a single stored id (docs/007-architecture.md:475). Each Ticket gets one Executor Session, `worker-<ticket id>`, with its own directory (docs/003-execution.md:25) [V]. The README calls the code a research prototype that differs from the article and leaves some of its designs unimplemented (README.md:3, 5). Block 141 says it exists to validate the approach and is not an official DeepSeek product [V] | Tag "two levels: built in the public research prototype / 双层架构：公开研究原型已实现", f1680–1810: under C11 only, ending where C12 begins (open item 2) | dsh-superagent-prototype-8c32a9d; x-article-super-agent | 2026-11-08 · P; A |
| Design: Workers never deal with people directly. They report to the Router layer, which handles every reply (block 40) [V]. The prototype only partly follows this. Its Router delivers IM answers and results, but Workers write their own acknowledgements, which the host posts in the request's original thread, and they reply to GitHub review threads themselves (prompts/replies.md:13, 17, 25; prompts/work.md:18, 28) [V]. The line states the design, not what is built, so the built tag has ended before it (open item 2, resolved) | C12 "Workers report up. Only the Router talks to you." The picture sends one reply to you on a cased line, solid because the prototype's Router does deliver IM answers and results | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P |
| "Sessions should be an implementation detail of the system, not a mental burden on its users" (block 27) [V] | C13 "Sessions become an implementation detail, not your burden." | x-article-super-agent | 2026-11-08 · A |
| Two-stage filtering. Code checks deterministic conditions and drops most irrelevant messages before any model is called (the Fast Path). The remaining candidates go to an LLM, which decides against policies written as prompts (the Slow Path) (blocks 47–50) [V]. The prototype builds it as a gate followed by a model assessment (docs/001-domain.md:33) [V] | C14 "By design: rules drop most noise; a model judges the rest." The picture has railway points and a gate | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P |
| At `8c32a9d` the accept mode defaults to `observe` (src/policy.ts:84). A proactive ("inferred") candidate that the model approves is recorded as "would accept" and is not taken until an operator switches to `auto` (src/policy.ts:55; docs/002-authorization.md:98). "Explicit requests work in every mode" (docs/002-authorization.md:101) [V] | Gate tag "prototype: proactive pickup off by default / 原型：主动接单默认关闭" | dsh-superagent-prototype-8c32a9d | 2026-11-08 · P |
| Triggers that arrive while the Router is mid-turn queue up and go into its next LLM call together. Time per request grows much more slowly than the batch size (blocks 33–35) [V]. The prototype batches in its own way: each Thread's queued Triggers become one Eval batch, and relays that reach the busy main Session are delivered together at its next step (docs/001-domain.md:43; docs/007-architecture.md:42, 93) [V] | C15 "Can one Router keep up? Waiting events go in together." The picture gathers one bundle per downbeat and shows no batch size | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P |
| In the Router stress test the Router called a real model and the Workers used mock models (block 118). As the Triggers needing a decision rose from about 1 to about 40 a minute, the amortised inference time per decision fell from 6.4 s to 1.6 s (block 120; fig 27 is block 119) [V]. These are the authors' numbers: the public repository holds no experiment code (its 236-entry tree at `8c32a9d` has no benchmark or experiment files) [V] | C16 "Stress test: ~40× the load, less average time per decision." Plate "stress test · mock Workers / 压测 · 模拟 Worker" with "~1 → ~40 /min" and "6.4 s → 1.6 s avg" (open item 4, resolved) | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P (tree listing); calc |
| Code passes a Thread's follow-up events straight to the subscribed Worker. The Router handles only new tasks and cross-task coordination (blocks 53, 56–57) [V]. The prototype builds it as Subscription fan-out (docs/001-domain.md:37) [V] | C17 "Follow-ups in a Thread go straight to its Worker." The picture takes it over a flyover | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P |
| Without pass-through, tasks finish in about the same time (p50/p95 12.6/15.5 min against 12.4/15.7, block 113). But the Router makes "about 30% more decisions per run", and cache-read tokens rise from 23.2M to 31.8M (block 116). Pass-through "does not make tasks finish faster or better" (block 116) [V]. 30% more without pass-through is about 23% fewer with it (open item 1, resolved) | C18 "Not faster tasks: about 23% fewer Router decisions." / 任务不会更快 但 Router 决策约少 23%. The picture draws the tally shorter than its ghost, which runs about 1.3× as long | x-article-super-agent | 2026-11-08 · A; calc |
| The experiments use synthetic workloads and simplified environments, so the results are "indicative only" (block 106) [V]. "Re-plotted" is ours: the chart is drawn from the article's table (block 113) | Chart tag "synthetic test · re-plotted · indicative only / 模拟实验 · 本片重绘 · 仅供参考" | x-article-super-agent | 2026-11-08 · A |
| Each run had about 300 messages, about 20 of them work requests. Coding was simulated by a tool that only consumes time. Four designs ran at the same time, each 5 times (block 108) [V] | C19 "Their test is synthetic: ~300 messages, ~20 work requests." The picture shows about 300 ticks with 20 inked | x-article-super-agent | 2026-11-08 · A |
| The results table (block 113) [V] gives p50/p95 minutes and cache-read tokens per run. Super-agent: 12.4/15.7, 23.2M. Without pass-through: 12.6/15.5, 31.8M. Single session with a subagent tool and the neutral prompt: 20.4/29.5, 6.1M. The same with the delegation-first prompt: 13.8/29.0, 10.8M. The film draws three lanes on one unitless scale, a dot at p50 and a terminus bar at p95, and shows no minutes | Lanes "one session · 单 Session", "one session, told to delegate · 被要求委派的单 Session" and "two levels · 双层架构"; legend "● typical ┃ slowest / ● 中位 ┃ 最慢" | x-article-super-agent | 2026-11-08 · A |
| p95 is 15.7 against 29.5 (≈ 0.53) and against 29.0 (≈ 0.54) (block 113) [V] | C20 "Slowest tasks: about half the time of a single session." | x-article-super-agent | 2026-11-08 · A; calc |
| p50 is 12.4 against 13.8 for the delegation-first baseline: (13.8 − 12.4)/13.8 ≈ 10%. That baseline is the stronger one at p50 (13.8 against 20.4) (block 113) [V] | C21 "Typical tasks: only ~10% faster than the stronger baseline." | x-article-super-agent | 2026-11-08 · A; calc |
| With the neutral prompt the model called no subagent in any of the 5 runs. With the delegation-first prompt it delegated in 4 of 5; in the fifth it did the work itself, which made the long tail (block 115) [V]. The neutral prompt still mentions subagents: "Use a subagent for a piece of work when appropriate" (block 110), so the choice was left to the model (open item 3, resolved) | C22 "Left to choose, the single session never delegated." / 自行决定时 单 Session 从未委派. The picture slides lane 2's terminus out for the run it did itself | x-article-super-agent | 2026-11-08 · A |
| The two-level architecture handles delegation at the system level: the Router does not execute work, and each Worker receives only its Threads' messages (block 115). It uses more cache-read tokens, trading tokens for shorter, steadier completion times (block 116) [V]. 23.2/10.8 ≈ 2.1 and 23.2/6.1 ≈ 3.8, shown as "2–4×" | C23 "Two levels make delegation structural, at 2–4× the tokens." Token bars proportional to 6.1M, 10.8M and 23.2M, headed "cache-read tokens per run · 每次运行的缓存读取 token" | x-article-super-agent | 2026-11-08 · A; calc |
| Design (§5): the Agent Loop runs in stateless cloud containers and keeps its state in a database, so a sleeping or offline local device no longer stops the agent (blocks 90, 92). Each endpoint runs a lightweight daemon that keeps no session state (block 96) [V]. The prototype has none of this: it runs as one local DeepSeek Harness process serving 127.0.0.1 (docs/006-deployment.md:7) with one SQLite state file (docs/007-architecture.md:452) and no endpoint daemon [V] | C24 "Proposed: a cloud loop that works while your laptop sleeps." Tag "proposed · not in the public prototype / 设想 · 公开原型未实现"; dashed machines, tethers and state depot | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P |
| An open problem (§8.4): if a server-side intrusion or a prompt injection compromises the cloud Agent Loop, every endpoint device connected to it could be taken over (block 135) [V]. Security is one of four open areas (block 122) | C25 "Open risk: a hijacked loop could reach all connected machines." The picture runs hatching along every tether, and a sketched "?" stays | x-article-super-agent | 2026-11-08 · A |
| Models need less and less human intervention on single tasks, so the bottleneck is shifting to human attention (blocks 4, 139) [V] | C26 "As models need less help, your attention becomes the limit." | x-article-super-agent | 2026-11-08 · A |
| People's role moves up, to higher-level decisions and sign-off (blocks 4, 139) [V] | C27 "So people move up: to decisions, and to sign-off." | x-article-super-agent | 2026-11-08 · A |
| The design's aim is that the system takes over managing sessions and syncing context (block 139) [V]. "By design" claims that aim, not a measured outcome | C28 "Your agents work in parallel. By design, you don't have to." | x-article-super-agent | 2026-11-08 · A |
| The English title [V] | End card: "Source: 'Exploring Super-agent Design: Towards a More Autonomous Agent System'" | x-article-super-agent | 2026-11-08 · A |
| "Yujia Qiao implemented the system and wrote the article"; the article is "based on shared work by the DeepSeek Harness team" (block 143) [V] | End card: "DeepSeek Harness team · author Yujia Qiao" / "DeepSeek Harness 团队 作者 Yujia Qiao" | x-article-super-agent | 2026-11-08 · A |
| The Chinese original appeared on 2026-10-31. At 21:36:35 Beijing time IT之家 reported that the DeepSeek Harness team had published it that day, and 量子位 reported it at 21:49:44. A post linking its WeChat address dates from 14:41:48 UTC that day, and Bloomberg (in syndication) dates the WeChat post to Saturday, 31 October [S]. The original itself was not read [U] | End card: "Chinese original 31 Oct 2026" / "中文原文 2026-10-31" | ithome-2026-10-31; qbitai-2026-10-31; x-post-shao-meng-2026-10-31; bloomberg-deccan-2026-11-01; wechat-original | 2026-11-08 · R; the linking post via the fxtwitter API; Bloomberg in the Deccan Chronicle syndication |
| The X post carrying the article was created 2026-11-01T11:37:54Z (19:37 Beijing time). The article's first block says it is a machine translation of the Chinese original (block 1) [V] | End card: "machine-translated 1 Nov 2026" / "英文机译 2026-11-01" | x-post-super-agent; x-article-super-agent | 2026-11-08 · A |
| IT之家 gives the Chinese title as 《Super-agent 设计探索：迈向更自主的 Agent 系统》 [S]. 量子位 gives "Super-agent：迈向更自主的Agent系统", without 设计探索 [S]. The IT之家 form matches the English title; it stays [S] until the original is read | zh end card: 原文：《Super-agent 设计探索：迈向更自主的 Agent 系统》 | ithome-2026-10-31; qbitai-2026-10-31 | 2026-11-08 · R |
| Our own statements: we drew the charts from the article's numbers (blocks 113, 120), and the film has no affiliation with DeepSeek | End card: "Charts re-plotted from the authors' synthetic tests · Not affiliated with DeepSeek" / "图表据作者模拟实验重绘 独立解读 与 DeepSeek 无关联" | x-article-super-agent | 2026-11-08 · A |
| Solid lines are what the prototype has at `8c32a9d`. Dashed lines are what the article proposes and the prototype lacks. Sketched lines are what the article lists as open (§8). See "Built vs proposed" | End-card key "solid: built · dashed: proposed · sketch: open / 实线：已实现 · 虚线：设想 · 手绘线：未解" (open item 6, resolved) | dsh-superagent-prototype-8c32a9d; x-article-super-agent | 2026-11-08 · P; A |

## Open before the script locks
1. **C18 overstated the decision saving: resolved 2026-11-08.** The article says that without
   pass-through the Router makes about 30% more decisions (block 116), so with it the Router
   makes about 23% fewer (1 − 1/1.3 ≈ 0.23). The approved line said "about 30% fewer", the
   same slip as turning the article's "about 37% more" tokens into "37% fewer". It now reads
   "Not faster tasks: about 23% fewer Router decisions." / 任务不会更快 但 Router 决策约少 23%
   (the treatment's 决策少约 23% with 约 moved before 少, pending the zh sign-off), with its
   holds re-checked (SCRIPT.md). The ghost tally is drawn about 1.3× as long as the real one,
   so the real tally is about 77% of the ghost.
2. **C12 sat under the built tag: resolved 2026-11-08.** "Only the Router talks to you" is the
   article's design; the prototype only partly follows it, since its Workers write their own
   acknowledgements and reply on GitHub. The tag now runs f1680–1810 and ends where C12
   begins, so it sits only under C11 (a Worker per task, which is built). The Router's reply
   line in C12 stays solid: the prototype's Router does deliver IM answers and results, and
   only the word "only" is the design.
3. **"Unprompted" (C22): resolved 2026-11-08.** The baseline had a neutral prompt that still
   allowed a subagent "when appropriate" (block 110), not no prompt. C22 now reads "Left to
   choose, the single session never delegated." / 自行决定时 单 Session 从未委派. The longer
   EN line holds by moving C19–C21 20 frames earlier inside beat 6 (SCRIPT.md).
4. **The stress plate: resolved 2026-11-08.** It reads "~1 → ~40 /min", as the article says
   about 1 to about 40 (block 120).
5. **双层 or 两级: resolved 2026-11-08.** The coverage calls the architecture 双层架构 and
   uses 两级 for the two-stage filter (两级过滤). The architecture is 双层架构 everywhere it is
   named (C8, the built tag, the third lane, C23). No line names the filter, so 两级 is not
   used.
6. **The end-card key's third entry: resolved 2026-11-08, pending the zh sign-off.** "sketch:
   open" / 手绘线：未解. 手绘线 names a line type, as 实线 and 虚线 do; 草图 (TREATMENT.md's
   adaptation) names a drawing, and the synthesis's 铅笔 belonged to its light look. Sketch
   lines in the summary map are the act-one ghost and the "?", both outside what is built or
   proposed.

All the zh copy, including these choices, waits for the user's sign-off (SCRIPT.md, "zh
sign-off").

## Built vs proposed
At `8c32a9d` (the only commit on the prototype's default branch, MIT) the matrix is as
follows. All entries are [V], read in the repository's docs and code by the research and
verify passes on 2026-11-08, with the cited lines re-read for this file.

| Part | In the article | At `8c32a9d` | In the film |
|---|---|---|---|
| Two levels: one long-lived Router, one Worker per task | §2 | Built. One main Session in the Router role (docs/001-domain.md:80; docs/007-architecture.md:475). Per Ticket, an Executor Session and its own directory (docs/003-execution.md:25). 3 Workers by default, 1–16 allowed, plus one slot kept for a person's message (src/policy.ts:93; docs/003-execution.md:57–61) | Solid, with the built tag |
| The Router neither executes nor decomposes | Blocks 31–32 | Built differently. No write or edit tools, but a restricted shell: `bash`, file reads and job tools (src/app/sessions.ts:263). "Avoiding code reads is a prompt rule, not a tool restriction" (docs/007-architecture.md:507). The article's Router "can run without a Bash tool" (block 31); that is an option the prototype does not take | Solid. The Router is never shown as shell-less |
| Event sources | Chat, email, calendar, code review, CI (block 44) | GitHub, plus Feishu if switched on. No email or calendar (docs/001-domain.md:68) | Generic glyphs. The envelope stands for the article's channels, not the prototype's |
| Two-stage filtering | §3.1 | Built: a gate, then a model assessment. Proactive pickup is only recorded by default (`observe`); explicit requests work in every mode | Solid points and gate, with the off-by-default tag |
| Threads, subscription and pass-through | §3.2 | Built as many-to-many Subscription fan-out (docs/001-domain.md:37) | Solid flyover |
| Batching | Blocks 33–35; the stress test in §7.2 | Built in its own form: per-Thread Eval batches (docs/001-domain.md:43), and relays to a busy main Session delivered together at its next step (docs/007-architecture.md:42). The stress-test numbers are the authors' and cannot be reproduced from the repository | Solid bundle. The plate says "stress test · mock Workers" |
| Only the Router replies to people | Block 40 | In part. The Router delivers IM answers and results; Workers write their own acknowledgements, posted in the original thread, and reply to GitHub review threads (prompts/replies.md:13, 17, 25; prompts/work.md:18, 28) | Design: C12 comes after the built tag has ended; the Router's reply line is solid (open item 2) |
| Inline & Spill, Chain of Recall | §3.3 | In prototype form: cards with a preview and a read pointer, and reads by ID | Left out |
| Acting ahead ("silently reproduce and fix") | §3.4 | Only a test fixture, not a default rule | Left out |
| Asynchronous full-duplex loop | §4.1. Block 83: in DeepSeek Harness, not enabled by default | The presets move shell commands to background jobs after 5 s (docs/003-execution.md:27) | Left out |
| 100-word IM cap | Block 87 | Built (src/infra/text.ts:3) | Left out |
| Cloud compute with state in a database; endpoint daemons; BYOM | §5 | Absent: one local process and one SQLite file | Dashed |
| Watchdog | §6 | Absent as an agent. There is only an hourly status-and-restart prompt, run from another profile (docs/006-deployment.md:133–141) | Left out |
| Sharding, long-term memory, sessionless UI, A2A, security | §8 | Absent; open in the article | A sketched "?" for security only |
| The §7 experiments | §7 | No experiment code in the repository | Credited to the authors' tests |

Answers to the fact questions the treatment left open:
- **Do the prototype's Workers reply to people?** Yes, in part. They write their own
  acknowledgements, which the host posts in the request's original thread, and they reply to
  GitHub review threads. IM answers and results go through the Router.
- **Is batching in the prototype?** Yes, per Thread, and relays to a busy main Session are
  taken together at its next step, so a solid bundle is fair. The §7.2 numbers come from the
  authors' test only.
- **Is a request addressed to the agent "proactive pickup"?** No. Explicit requests from
  allowed people work in every mode (docs/000-philosophy.md:11). Only unaddressed ("inferred")
  candidates are record-only by default. The film never shows its request addressed to the
  agent, and the gate's model judges it, so it reads as a proactive pickup: out of the box the
  prototype would record it, not take it [U, our reading of the picture]. This is why that
  beat says "By design" and carries the gate tag.
- **"~40×" for 1 → 40 a minute** is fair as the ratio of arrival rates.

## Numbers and their caveats
**The ablation (§7 and §7.1, blocks 106–116)**
- **Setup.** The workload is synthetic, in a simplified environment, and the results are
  "indicative only" (block 106). Each run had about 300 messages and about 20 work requests.
  Coding was simulated by a tool that only consumes time, so the test measures scheduling,
  not coding. Four designs ran at the same time, each 5 times (block 108). The article names
  no model.
- **Clock.** Fig 23's caption (block 112) says message intervals and work durations were
  scaled by 1/4 and model call times were not. The table (block 113) does not say which clock
  its minutes use. So the film shows no minutes. The lanes share one unitless scale: dot (p50)
  and terminus (p95) at 20.4 and 29.5, 13.8 and 29.0, and 12.4 and 15.7. No line states a
  duration.
- **Slowest tasks (p95).** 15.7/29.5 ≈ 0.53 and 15.7/29.0 ≈ 0.54, so "about half" against
  both single-session baselines.
- **Typical tasks (p50).** (13.8 − 12.4)/13.8 ≈ 0.10, so "~10%" against the stronger
  baseline. Against the neutral-prompt baseline the same sum gives (20.4 − 12.4)/20.4 ≈ 0.39.
  That baseline never delegated, so the film does not use 39%.
- **Tokens.** 23.2/10.8 ≈ 2.1 and 23.2/6.1 ≈ 3.8, shown as "2–4×", rounded to whole numbers.
- **Pass-through.** It makes tasks no faster: p50 12.4 against 12.6 and p95 15.7 against
  15.5. Without it, tokens are 31.8/23.2 ≈ 1.37 times as many (the article's "about 37%
  more"), so with it there are about 27% fewer (1 − 23.2/31.8 ≈ 0.27). Without it the Router
  makes about 30% more decisions, so with it about 23% fewer (1 − 1/1.3 ≈ 0.23). C18 now
  says "about 23% fewer" (open item 1, resolved).
- **Delegation.** The neutral prompt delegated in 0 of 5 runs and the delegation-first prompt
  in 4 of 5 (block 115).

**The stress test (§7.2, blocks 118–120)**
- The Router called a real model; the Workers used mock models (block 118).
- Triggers needing a decision rose from about 1 to about 40 a minute. "~40×" is the ratio of
  arrival rates (40/1).
- The average batch size grew from 1.0 to 2.8 and the time per request from 2.5 s to 3.9 s.
  The amortised inference time per decision fell from 6.4 s to 1.6 s, a quarter (block 120).
- Time per decision is an amortised average, not the time any one decision takes. A decision
  can span several LLM requests (block 118), so it cannot be derived from request time and
  batch size. The film shows only the end points of arrivals and of time per decision,
  labelled "avg", and neither batch size nor time per request.
- These numbers come from the authors' test, not from the public code.

**Other numbers**
- **3–5** is the authors' experience (block 6), never a measured limit.
- **Real-world durations:** the film says nothing about them. The workload was synthetic and
  the coding simulated.

## Chinese text check
**Pending.** The user, the fluent reader, signs off every zh string in session 2, when
SCRIPT.md fixes the copy. Until then every zh line in the treatment is a draft.
- **Sources.** The Chinese original was not read: WeChat served a verification page
  (wechat-original) and the Zhihu copy returned HTTP 403 (zhihu-copy). The terms therefore
  follow IT之家 and 量子位 [S] (ithome-2026-10-31, qbitai-2026-10-31), the prototype's own zh
  glossary [V] where it fits, and a third-party full reprint [S] (eimoon-reprint) only as a
  cross-check.
- **Numbers.** The zh lines carry the same numbers and caveats as the EN lines, and open item
  1 applies to both.

| zh in the film | Where | Source status |
|---|---|---|
| 谁来调度智能体？ | Title | Our title [U]. Both reports use 调度, and 量子位 calls the Router 总调度员 [S] |
| 智能体 | Title, C1, C28 | The prototype's glossary: Agent 智能体 (docs/001-domain.md:79) [V]. DeepSeek Harness's zh docs: 智能体团队 (deepseek-harness-fcc0ad4) [V] |
| Super-agent（超级智能体） | Title card | The coverage keeps Super-agent in Latin script [S]. The gloss 超级智能体 is ours [U] |
| DeepSeek Harness 团队 | Title card, end card | IT之家: DeepSeek Harness 官方团队 [S] |
| Session, Router, Worker, Thread, token (Latin) | Throughout | IT之家: Router 层 / Worker 层 and 活跃 Session [S]. 量子位: 上层的Router, 下层的Worker [S]. The prototype names them 主 Session and 执行器 Session, and Thread 线程 [V]; we do not use these, and 线程 would also read as an OS thread |
| 据作者经验 … 3–5 个 | C3 | IT之家: 3 至 5 个活跃 Session; 量子位: 3到5个活跃Session, both as the team's observation [S] |
| 人肉 Router | C4 | Our coinage [U]. Its register is for the user to judge |
| 串行 / 串味 | C5 | Ours [U] |
| 连续性 / 速度 | C7 | Ours [U]. IT之家 names the four traits 连续、高效、主动和持久 [S]; 速度 matches the EN "speed" |
| 双层架构 | C8, built tag, third lane, C23 | The coverage and the reprint call the architecture 双层架构 (IT之家's headline; 量子位; the reprint's §2) [S]. Both reports and the reprint use 两级 for the two-stage filter (IT之家 两级过滤, 量子位 两级事件过滤机制) [S], which no line names, so 两级 is not used (open item 5, resolved) |
| 渠道 | C9 | The prototype's glossary: Channel 渠道 [V]. IT之家: 不同渠道 [S]. The reprint's 多信道 is not used |
| 实现细节 / 负担 | C13 | The reprint words the line as Session being 实现细节 rather than 认知负担 [S]; not in IT之家 or 量子位 |
| 公开研究原型 / 原型 | Tags | IT之家: 原型实现 [S]. The README: "research prototype" [V] |
| 主动接单 | Gate tag | Ours [U]. 主动 is the article's trait as IT之家 lists it (连续、高效、主动和持久) [S] |
| 合并处理 | C15 | Ours [U]. IT之家: 合并积压事件 [S]. The reprint titles §7.2 Router层的批处理 [S] |
| 压测 / 模拟 Worker / 均摊 | Plate, C16 | Ours [U] |
| 直通 | C17 | IT之家: 事件直通机制; 量子位: 订阅与直通机制 [S] |
| 决策 | C18, C27 | 量子位: Router的决策次数 [S] |
| 模拟实验 / 本片重绘 / 仅供参考 | Chart tag, C19 | Ours [U]. The reprint titles §7 初步实验 [S] |
| 约 300 条消息 约 20 个工作请求 | C19 | IT之家: 约 300 条消息，其中约 20 条为工作请求 [S] |
| 中位 / 中位数 / 最慢 | Legend, C21 | 量子位: 中位数 and 95分位数 [S]. 最慢 for p95 is ours [U] |
| 基线 / 委派 / 被要求委派 / 自行决定 | C21, C22, lane | Ours [U] |
| 缓存读取 token | Token header, C23 | 量子位: 读取缓存Token [S] |
| 设想 · 公开原型未实现 | Tag, C24 | Ours [U] |
| 云端 | C24 | IT之家 and 量子位: 云端 Agent [S] |
| 循环被劫持 / 相连机器都可能失守 | C25 | Ours [U] |
| 注意力 / 瓶颈 | C26 | IT之家: 限制生产力进一步提升的因素正逐渐转向人的注意力 [S]. 瓶颈 is ours [U] |
| 决策 / 验收 | C27 | The reprint: 更高层的决策与验收 [S]; not in IT之家 or 量子位 |
| 原文：《Super-agent 设计探索：迈向更自主的 Agent 系统》 | End card | IT之家 [S]; 量子位 drops 设计探索 [S] |
| 英文机译 | End card | The English is a machine translation (block 1) [V], and 英文机译 says so; the treatment had 英译 |
| 图表据作者模拟实验重绘 / 独立解读 与 DeepSeek 无关联 | End card | Ours |
| 实线：已实现 · 虚线：设想 · 手绘线：未解 | End-card key | Ours [U]. 手绘线 is a line type like 实线 and 虚线; it replaces the treatment's 草图 and the synthesis's 铅笔 (open item 6, resolved) |

## Simplifications
- **"Router" stands for "the Router layer".** The article lets that layer be more than one
  session and partly code (blocks 29, 33). The film draws one ring, the design the authors
  chose (block 33).
- **"Hears every channel".** Code drops the noise first. The Router still sees every event
  (block 58) but judges only new events with no subscriber.
- **Workers are single platforms.** In the article a Worker may use subagents or be an Agent
  Team itself (block 42).
- **"Slowest" and "typical".** "Slowest" means p95, the 95th percentile, and "typical" means
  p50, the median.
- **Lane names.** Both single-session designs had a subagent tool. "One session" is the
  neutral prompt and "told to delegate" the delegation-first prompt. "Left to choose" (C22)
  means the neutral prompt, which allowed a subagent "when appropriate" (open item 3).
- **Rounded figures.** "~40× the load" means about 40 times the arrival rate of Triggers that
  need a decision. "2–4×" rounds 2.1× and 3.8×.
- **The charts** are re-plotted as unitless lanes. The tick strip draws "about 300" and
  "about 20" as exactly 300 and 20 ticks.
- **The request is an illustration.** It is a generic, bug-like event: a vermilion pill with a
  beetle glyph. Its route (filter, Router, Worker, follow-up, sign-off) shows the design, not
  a documented case. None of the article's examples, IDs or dialogues are used.
- **"About 3–5" in the picture.** The tiles grow from 5 to 8 with about four lit, with no
  number or threshold drawn.
- **Batching** is drawn as one bundle per downbeat that grows with the load. No batch size is
  shown.
- **"Proposed" for §5.** The article describes it as design. Its internal instance is "built on
  these ideas" and runs continuously (block 138), but how it is deployed is not public, and
  the public prototype runs locally.
- **The hijack.** The article names a server-side intrusion or a prompt injection (block 135).
  The film shows one route: a hatched message entering through chat.
- **Left out, with where to find them:**
  - the full-duplex loop (blocks 77–83);
  - Inline & Spill and Chain of Recall (blocks 63–71);
  - acting ahead (blocks 73–74);
  - per-channel norms and the 100-word cap (blocks 85–88);
  - the Watchdog (blocks 100–104);
  - credentials (block 136);
  - sharding and long-term memory (blocks 37, 124–125);
  - sessionless interfaces (blocks 127–129);
  - A2A (blocks 131–132);
  - the systems lineage (block 138).

## Not claimed
- **No endorsement or affiliation.** The film is an independent explainer, not made, reviewed
  or endorsed by DeepSeek or the DeepSeek Harness team. The end card and the README say so,
  and the published descriptions will too.
- **Not a product.** The article presents architectural ideas, not DeepSeek Harness features
  (block 2). The prototype exists to validate the approach and is not an official DeepSeek
  product (block 141; README.md:3). The film says nothing about release plans.
- **No competitor comparison.** Nothing is said about other agent products, better or worse,
  and there is no "rival" framing. The article names no other agent product; the only outside
  agent work it cites is Anthropic's essay (block 97). The film is made with Claude.
- **3–5 is the authors' experience** (block 6), not a measured limit. The film does not tie
  it to psychology research.
- **The request is an illustration**, not a documented case.
- **The prototype's proactive pickup is off by default** (`observe`). The film does not show
  the public prototype taking unrequested work out of the box.
- **Nothing about real-world task durations.** No minutes appear on screen. The test's coding
  was simulated, its clock scaled (block 112), and the table's clock is not stated.
- **No misreadings.** The Router does not decompose tasks (block 32). Workers do not talk to
  each other directly (blocks 41, 124). There is no "39% faster" and no "16 vs 29 minutes".
- **Nothing beyond the public code.** The film does not say that the prototype's Router is
  shell-less, or that the cloud loop, BYOM, the Watchdog or the experiment code exist in the
  public repository.
- **No model named.** The article names none.
- **Not new theory.** The article says it applies classic systems ideas (block 138), and the
  film does not call the idea new or first.
- **Not Anthropic's image.** The brain/hands metaphor of Anthropic's essay
  (anthropic-managed-agents), which the article cites in block 97, is not used.
- **Nothing about the security of the shipped code.** The open risk on screen is the article's
  own, about its proposed cloud design (block 135), not a finding about DeepSeek Harness or
  the prototype.
- **"By design, you don't have to"** states the design's aim, not a measured result.
