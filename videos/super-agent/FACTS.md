# Facts: Who Routes the Agents?

The film explains one article: *Exploring Super-agent Design: Towards a More Autonomous Agent
System* by the DeepSeek Harness team, written by Yujia Qiao, who also built the system. Every
claim, number, date and attribution on screen in the 3:45 cut (84 bars, 36 narration lines,
the strings of [src/cues.ts](src/cues.ts) on 2026-11-09) has a row below, and the rows quote
those strings. The 2:56 cut's rows were first checked against the approved treatment
(2026-11-08); the rows the 3:45 cut adds or changes were checked on 2026-11-09. Pictures are
described in the Register Desk look (TREATMENT.md), which replaced the dark ink map. Any line
that changes in SCRIPT.md is checked again here before the script is locked. Sources are in
[sources.jsonl](sources.jsonl), one JSON object per line. The fuller research note, with the
accuracy questions Q1–Q10, is
[references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md).

**Conventions**
- **Article blocks** are numbered from 1, in the order the fxtwitter API (api.fxtwitter.com, a
  third-party mirror of public X data) returns the article's 143 blocks. Block 1 is the
  machine-translation notice and block 143 the credits. Three embedded blocks matter: block 112
  is fig 23 with its caption, block 113 the results table and block 119 fig 27.
- **Prototype references** are `file:line` in `deepseek-ai/dsh-superagent-prototype` at
  `8c32a9d`. DeepSeek Harness references are at `fcc0ad4`.
- **Tags:** [V] read at a primary source; [S] secondary (press or a reprint); [U] unverified
  or our own inference (the legend in `references/README.md`). Article facts are [V] as read
  through the mirror.
- **Cue ids:** C1–C28 are the 2:56 cut's 28 narration lines. The 3:45 cut keeps 25 of them
  under their old ids (C13, C16 and C19 are cut) and adds N1–N11, so it has 36 narration
  lines (`c*` and `n*` in `src/cues.ts`). The title card and the end card are text cues too.
  Tags and labels go by their cue ids (`tag-100`, `tag-load`, …), and frames are on-screen
  windows [from, to) with the 6-frame wipe in and fade out.
- **Status:** built (in the prototype at `8c32a9d`), built in prototype form, proposed (in
  the article, absent from the prototype), open (§8), or the authors' framing.
- **Checked:** the date and how. **A** = the English article read through the fxtwitter API;
  **P** = the prototype's files read at `8c32a9d`; **R** = the IT之家 and 量子位 pages read;
  **calc** = our arithmetic on the article's numbers, shown under "Numbers and their caveats".
- **Quotes** are at most 25 words and attributed by source id. Each source's URL and access
  date are in sources.jsonl.

| Claim | As said in the video | Source id | Checked |
|---|---|---|---|
| The article names the design and its system Super-agent (block 8) and credits it to shared work by the DeepSeek Harness team (block 143) [V]. DeepSeek Harness is "an open-source agent harness developed by DeepSeek AI" (its README, line 5) [V], so "DeepSeek's Harness team" is accurate | Title card subline: "Super-agent, a design by DeepSeek's Harness team" | x-article-super-agent; deepseek-harness-fcc0ad4 | 2026-11-08 · A; README at `fcc0ad4` |
| Agents use a single session as the unit of work, and sessions are isolated. A user running several tasks in parallel switches between sessions by hand and remembers what each contains. Multi-tasking is limited by human attention (block 6) [V]. The two short sentences are our framing of this | C1 "Your AI agents work in parallel. You can't." | x-article-super-agent | 2026-11-08 · A |
| As above: each session holds its own context, and the user has to remember what each one contains (block 6) [V] | C2 "Each session knows one task. You must know them all." | x-article-super-agent | 2026-11-08 · A |
| "In our experience", a person can usually follow only 3 to 5 active sessions at once (block 6). This is the authors' experience, not a measurement [V]. IT之家 and 量子位 report it as the team's observation [S] | C3 "In the authors' experience, you can follow about 3–5." Of eight folders, about four stay warm under your lamp; no number, threshold or "3–5" stamp is drawn | x-article-super-agent; ithome-2026-10-31; qbitai-2026-10-31 | 2026-11-08 · A; R |
| The person's load as the article describes it: switching sessions by hand and remembering what each holds (block 6); a synchronous session that blocks on long operations, stops when the device goes offline and takes a lot of manual effort to keep running (block 7); a human prompt before each run (block 44) [V]. Calling these four chores is our framing [U] | N1 "You switch, prompt each run, wait, and keep it all running." / 切换 逐次下指令 等待 还得守着它们别停. The four chores arrive one a beat, in the line's order (f680–740): the notes loop tightens round your desk, then the starter key, the sand-glass and the lid strut land | x-article-super-agent | 2026-11-09 · A |
| Our framing. The article says the user switches between sessions by hand and keeps track of them (block 6); it does not call the person a router [V] | C4 "You've quietly become their router." The notes loop closes round your desk with its clip (f880) | x-article-super-agent | 2026-11-08 · A |
| Routing every event to one session gives the most continuous context. But a ReAct loop works one step at a time, so tasks take long and throughput stays low, and the tasks' details interleave in one context, which degrades the results (block 23) [V] | C5 "All in one session: it remembers, but is serial and muddled." | x-article-super-agent | 2026-11-08 · A |
| A new session per event maximises concurrent throughput. Without a shared global context the results are disconnected, and several sessions replying separately confuse the user (block 24) [V] | C6 "One per event: fast, but disconnected, and all reply to you." | x-article-super-agent | 2026-11-08 · A |
| The two extremes are a trade-off between continuity and throughput (block 22) [V]. "Speed" stands for throughput | C7 "Continuity or speed: must we pick one?" | x-article-super-agent | 2026-11-08 · A |
| Splitting the work between two layers gets both continuity and throughput (block 25) [V] | C8 "Super-agent keeps both, on two levels." | x-article-super-agent | 2026-11-08 · A |
| The Router layer is long-lived and receives human interaction from every entry point (block 31), and it still sees every event (block 58). The authors run it as one long-lived LLM session (block 33) [V] | C9 "Above: one long-lived Router hears every channel." Label "Router" | x-article-super-agent | 2026-11-08 · A |
| The four traits are Continuous, Productive, Proactive and Persistent (blocks 13–16). Block 18 maps the five modules onto them: two levels → Continuous and Productive; event-driven triggers → Proactive; full-duplex multi-channel → Continuous and Productive; compute/state/environment separation and the Watchdog → Persistent [V]. They are requirements, not code: the authors' framing. Pairing each trait with one chore is ours [U]. The zh words are IT之家's, also in 量子位, the eimoon reprint and 智东西 [S] (Q7) | Trait plates, each docking on the part that took its chore over: "Continuous · 连续" on the Register's tape (f1640), "Proactive · 主动" at the intake (f2340), "Productive · 高效" on the job rail (f3720), all enamel; "Persistent · 持久" in vellum, as proposed (f4620) | x-article-super-agent; ithome-2026-10-31; qbitai-2026-10-31; eimoon-reprint | 2026-11-09 · A; R |
| The Router layer is designed not to execute tasks: it only deals with people and dispatches (block 31), and it does not break down individual tasks (block 32) [V]. In the prototype the main Session has no file write or edit tools (cordis.patch.yml:163–167), and its prompt forbids adding plans or requirements to a request (prompts/dispatch.md:14, 38) [V] | C10 "It hands each task over whole and never does the work." A grey-stock card of a three-way split rises and is struck through | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P |
| All cross-task information and decisions meet in the Router layer, so it is the one sequence point; it does not execute, so that this single node never becomes the bottleneck (block 31). It still sees every event (block 58) [V]. In the prototype the main Session assesses proactive candidates (src/app/assessment.ts:84–104; prompts/shared.md:3) and hears of every person's follow-up as a notice (src/app/runtime.ts:142–146; src/app/notices.ts:98–106) [V]. "Never the bottleneck" is the design's reason; the prototype's main Session keeps a restricted shell (src/app/sessions.ts:263) | N2 "Why? Every task passes here; it must never be the bottleneck." / 为什么？任务都经过它 它绝不能成为瓶颈. A grey-stock card of a Register with a workbench backs a queue up at its door and is struck out; the real Register keeps its restricted-shell key | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-09 · A; P |
| Each Worker has an isolated context and a full set of execution tools, and works on a single task (block 39) [V] | C11 "Below: each task gets its own Worker, context and tools." Label "Worker" | x-article-super-agent | 2026-11-08 · A |
| At `8c32a9d` the two levels exist. There is one long-lived main Session in the Router role: it evaluates Triggers, dispatches Tickets and replies (docs/001-domain.md:80), under a single stored id (docs/007-architecture.md:475). Each Ticket gets one Executor Session, `worker-<ticket id>`, with its own directory (docs/003-execution.md:25) [V]. The README calls the code a research prototype that differs from the article and leaves some of its designs unimplemented (README.md:3, 5). Block 141 says it exists to validate the approach and is not an official DeepSeek product [V] | Tag "two levels: built in the public research prototype / 双层架构：公开研究原型已实现", f2000–2130: under C11 only, ending where C12 begins (open item 2) | dsh-superagent-prototype-8c32a9d; x-article-super-agent | 2026-11-08 · P; A; frames 2026-11-09 |
| Design: Workers never deal with people directly. They report to the Router layer, which handles every reply (block 40) [V]. The prototype only partly follows this. Its Router delivers IM answers and results, but Workers write their own acknowledgements, which the host posts in the request's original thread, and they reply to GitHub review threads themselves (prompts/replies.md:13, 17, 25; prompts/work.md:18, 28) [V]. The line states the design, not what is built, so the built tag has ended before it (open item 2; Q3) | C12 "Workers report up. Only the Router talks to you." Report cards fly up to the Register, and one reply slip goes down the chute to you, solid because the prototype's Router does deliver IM answers and results. The alternative wording is open item 7 | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P; Q3 2026-11-09 |
| Event-driven triggers replace a human prompt before each run (block 44). Proactive: it watches its environment, acts on what is worth it and otherwise stays quiet (block 15) [V]. The prototype listens to GitHub, and to Feishu if switched on (docs/001-domain.md:68) [V]. Built for those events; out of the box it takes only explicit requests, and unaddressed work is recorded, not taken (the row after C14). So beat 5 is named "by design" | N3 "It listens for events, so no one has to prompt each run." / 它监听事件 不必再由人逐次下指令. The starter key lifts off your tray into the intake and the Proactive plate docks (f2340); the gate tag wipes in with N3 (f2320), so the plate never stands without it | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-09 · A; P |
| Two-stage filtering. Code checks deterministic conditions and drops most irrelevant messages before any model is called (the Fast Path). The remaining candidates go to an LLM, which decides against policies written as prompts (the Slow Path) (blocks 47–50) [V]. The prototype builds it as a code gate (src/core/intake.ts:25–28; src/policy.ts:191–211) followed by a model assessment that the main Session runs (src/app/assessment.ts:84–104; src/app/runtime.ts:131–133; docs/001-domain.md:33) [V] (Q10) | C14 "By design: rules drop most noise; a model judges the rest." Gate fingers and a spike on the intake (code), then a loupe on the Register's throat (the model), for new events with no subscriber | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P; Q10 2026-11-09 |
| At `8c32a9d` the accept mode defaults to `observe` (src/policy.ts:84). A proactive ("inferred") candidate that the model approves is recorded as "would accept" and is not taken until an operator switches to `auto` (src/policy.ts:55; docs/002-authorization.md:98). "Explicit requests work in every mode" (docs/002-authorization.md:101) [V] | Gate tag "prototype: proactive pickup off by default / 原型：主动接单默认关闭", f2320–2630, under N3 (from its first frame, before the Proactive plate docks) and C14 | dsh-superagent-prototype-8c32a9d | 2026-11-08 · P; frames 2026-11-09 |
| Triggers that arrive while the Router is mid-turn queue up and go into its next LLM call together. Time per request grows much more slowly than the batch size (blocks 33–35) [V]. The prototype batches in its own way: each Thread's queued Triggers become one Eval batch, and relays that reach the busy main Session are delivered together at its next step (docs/001-domain.md:43; docs/007-architecture.md:42, 93) [V] | C15 "Can one Router keep up? Waiting events go in together." Queued slips butt into one strip that is read in one sweep on the downbeat (f2800). No batch size is shown | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P |
| In a burst a Router step has a long input and a short output. Merged Triggers are computed in parallel in prefill, so merging adds little overhead and time per request grows much more slowly than the batch size (blocks 33, 35) [V]. The gain holds only up to a limit set by context length and by how many Triggers the model handles accurately in one turn (block 35), and the time per request does rise, from 2.5 s to 3.9 s (block 120). The authors' explanation and test, not the public code (open item 9) | N4 "Long input, short output: merging events adds little time." / 输入长 输出短：合并处理只多花一点时间. A long strip is read in one sweep and a short slip printed; three more events lengthen the strip but barely the sweep | x-article-super-agent | 2026-11-09 · A |
| In the Router stress test the Router called a real model and the Workers used mock models (block 118). As the Triggers needing a decision rose from about 1 to about 40 a minute, the amortised inference time per decision fell from 6.4 s to 1.6 s (block 120; fig 27 is block 119) [V]. These are the authors' numbers: the public repository holds no experiment code (its 236-entry tree at `8c32a9d` has no benchmark or experiment files) [V] | Plate "stress test · mock Workers / 压测 · 模拟 Worker" with "~1 → ~40 /min" and "6.4 s → 1.6 s avg", f2880–3040, the evidence beside N4 (open item 4, resolved). C16 ("~40× the load") was cut; the plate keeps the endpoints | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P (tree listing); calc |
| The context window is treated as a cache: inline what will likely be needed soon and spill the rest outside, leaving a reference or a summary (blocks 62–63). Start with the ID and a summary, inline related IDs and nearby content, and cut long content at a small cap with a pointer to read on (blocks 65–67) [V]. Built in prototype form, most clearly at the Router: a `worker_report` card carries a summary of up to 600 characters, plus a read pointer when truncated (docs/007-architecture.md:589; src/app/notices.ts:110–112), and other messages appear as 50-character stubs (:546) [V]. The line leaves out inlining the neighbours | N5 "Context is a cache: a summary in view, a pointer to the rest." / 上下文是缓存：摘要放进来 其余只留指针. At the Register's reading window the request's report keeps its header and summary inside; its body folds into a pointer tab that drops into the drawer; older cards shrink to stubs. No card sizes | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-09 · A; P |
| The Router has a context problem of its own: follow-ups go straight to Workers and past tasks pile up, yet a user may raise an old task in another channel (block 68). Triggers, Threads and Worker Sessions carry IDs. Each recalled object inlines the next hop's summaries and IDs, so the model walks back hop by hop, as far as it needs (blocks 70–71) [V]. It reduces what the Router loses over long runs and does not end it (blocks 68–71); memory over months stays open (block 125). Prototype form only (next row) | N6 "Asked in another channel? It follows IDs back, hop by hop." / 换个渠道问起？它顺着 ID 一跳一跳找回来. A GitHub comment asks about the request; a reading-thread hops from a tape row to its stub, the Thread cord and the bay's last report, and a short answer goes back. It starts on GitHub because the prototype has no email source | x-article-super-agent | 2026-11-09 · A |
| As for N5, plus: every ID a page shows can be read through a tool, so a Session walks from one object to the next (docs/007-architecture.md:575), and card previews are 160 characters (src/app/cards.ts:8) [V]. There is no dedicated multi-hop recall algorithm [U] | Tag "prototype: summaries and read pointers / 原型：摘要加读取指针", f3080–3400, under N5 and N6 | dsh-superagent-prototype-8c32a9d | 2026-11-09 · P |
| Code passes a Thread's follow-up events straight to the subscribed Worker. The Router handles only new tasks and cross-task coordination (blocks 53, 56–57) [V]. The prototype builds it as Subscription fan-out (docs/001-domain.md:37) [V]. It skips the Router's decision, not its view: the Router still sees every event (block 58). In the prototype a person's follow-up gets no Eval but reaches the main Session as a `follow_up` notice, on which it may only stop the work (src/core/intake.ts:56–58; src/app/runtime.ts:142–146; src/app/notices.ts:79–80, 98–106); bot and CI follow-ups go to the code gate (src/core/model.ts:75–76) [V] (Q1) | C17 "Follow-ups in a Thread go straight to its Worker." The follow-up rides its Thread's cord over the Register to its bay (f3520). A faint notice row is added to the Register's tape and no decision is made; nothing says or shows that the Router does not see it | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P; Q1 2026-11-09 |
| Without pass-through, tasks finish in about the same time (p50/p95 12.6/15.5 min against 12.4/15.7, block 113). But the Router makes "about 30% more decisions per run", and cache-read tokens rise from 23.2M to 31.8M (block 116). Pass-through "does not make tasks finish faster or better" (block 116) [V]. 30% more without pass-through is about 23% fewer with it (open item 1, resolved) | C18 "Not faster tasks: about 23% fewer Router decisions." / 任务不会更快 但 Router 决策约少 23%. A grey-stock ghost tally runs about 1.3× as long as the real one | x-article-super-agent | 2026-11-08 · A; calc |
| A blocking `run()` holds the loop until the tool returns; an async call returns "Started" at once and its result comes back later as a new event (blocks 79, 81). New input is handled as soon as the current inference step ends, not when background tools finish (block 82) [V]. Built in the prototype through Harness background jobs: the worker and router presets move a foreground shell command to a background job after 5 s (docs/003-execution.md:27, 29), with 5 s shell and job waits (cordis.patch.yml:38–56), and a finished job wakes the Session (docs/003-execution.md:33) [V]. "Them" are the jobs once in the background: a command runs in the foreground for up to 5 s first. Block 83 says the Harness does not enable this by default (open item 8) | N7 "Jobs run in the background; new input never waits on them." / 耗时操作转入后台 新输入不必等它跑完. A grey-stock card shows the shut door of a blocking loop; then the long job peels off onto a side rail (f3720) while the door stays open, and docks back as an event (f3800). The names `start()` and `stop()` never appear | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-09 · A; P |
| As for N7. The 5 s is the presets' foreground-to-background threshold, not a cap on the job (docs/003-execution.md:27, 29) [V]. Worker subagents use the Harness `standard` preset, where it is 60 s; that stays off screen | Tag "prototype: background after 5 s / 原型：5 秒后转入后台", f3720–3820, as the Productive plate docks | dsh-superagent-prototype-8c32a9d | 2026-11-09 · P |
| IM keeps interruptions few and speaks only when a decision or sign-off is needed: "One simple, effective hard rule we have verified is a cap of 100 words per reply." (block 87) [V]. GitHub and other async channels get structured, dense output (block 88). Built: `IM_WORDS = 100` (src/infra/text.ts:3), counted in `Intl.Segmenter('zh')` word-like segments and enforced in the Feishu outbox, which refuses to split (src/app/outbox.ts:29); acknowledgements are held to 100 words in every channel (src/app/tools/executor.ts:33) [V]. The cap protects attention, not waiting, though it sits in beat 7 | Tag "chat replies: ≤ 100 words / 聊天回复：≤ 100 词", f3820–3920, on the reply slip's stop tab. The slip goes from the Register to you (solid); a heavy dossier lands in the repo channel with no sender line (Q2) | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-09 · A; P |
| The experiments use synthetic workloads and simplified environments, so the results are "indicative only" (block 106) [V]. "Re-plotted" is ours: the chart is drawn from the article's table (block 113) | Chart tag "synthetic test · re-plotted · indicative only / 模拟实验 · 本片重绘 · 仅供参考", f4000–4560, wiping in with C20 once the camera has arrived at the test sheet | x-article-super-agent | 2026-11-08 · A |
| Each run had about 300 messages, about 20 of them work requests. Coding was simulated by a tool that only consumes time. Four designs ran at the same time, each 5 times (block 108) [V] | Tag "per run: ~300 messages · ~20 work requests / 每次运行：约 300 条消息 · 约 20 个工作请求", f4000–4560, beside the chart tag. C19 was cut and its numbers moved here. The vermilion request is never one of the test's work requests | x-article-super-agent | 2026-11-08 · A; tag 2026-11-09 |
| The results table (block 113) [V] gives p50/p95 minutes and cache-read tokens per run. Super-agent: 12.4/15.7, 23.2M. Without pass-through: 12.6/15.5, 31.8M. Single session with a subagent tool and the neutral prompt: 20.4/29.5, 6.1M. The same with the delegation-first prompt: 13.8/29.0, 10.8M (the mapping confirmed, Q8). The film draws three lanes on one unitless scale, p50 and p95 marked on each, and shows no minutes | Lanes "one session · 单 Session", "one session, told to delegate · 被要求委派的单 Session" and "two levels · 双层架构"; legend "typical · slowest / 中位 · 最慢"; f4000–4560 | x-article-super-agent | 2026-11-08 · A; Q8 2026-11-09 |
| p95 is 15.7 against 29.5 (≈ 0.53) and against 29.0 (≈ 0.54) (block 113) [V] | C20 "Slowest tasks: about half the time of a single session." Hero stamp "~½" beside the lanes' cuts (f4040–4560; the same string in both languages) | x-article-super-agent | 2026-11-08 · A; calc |
| p50 is 12.4 against 13.8 for the delegation-first baseline: (13.8 − 12.4)/13.8 ≈ 10%. That baseline is the stronger one at p50 (13.8 against 20.4) (block 113) [V] | C21 "Typical tasks: only ~10% faster than the stronger baseline." Hero stamp "~10%" beside the bracket between the typical holes (f4160–4560; the same string in both languages) | x-article-super-agent | 2026-11-08 · A; calc |
| With the neutral prompt the model called no subagent in any of the 5 runs. With the delegation-first prompt it delegated in 4 of 5; in the fifth it did the work itself, which made the long tail (block 115) [V]. The neutral prompt still mentions subagents: "Use a subagent for a piece of work when appropriate" (block 110), so the choice was left to the model (open item 3, resolved) | C22 "Left to choose, the single session never delegated." / 自行决定时 单 Session 从未委派. The picture marks lane 2's long tail as the run it did itself | x-article-super-agent | 2026-11-08 · A |
| The two-level architecture handles delegation at the system level: the Router does not execute work, and each Worker receives only its Threads' messages (block 115). It uses more cache-read tokens, trading tokens for shorter, steadier completion times (block 116) [V]. 23.2/10.8 ≈ 2.1 and 23.2/6.1 ≈ 3.8, shown as "2–4×" | C23 "Two levels make delegation structural, at 2–4× the tokens." Token stacks in the ratio 6.1 : 10.8 : 23.2, headed "cache-read tokens per run · 每次运行的缓存读取 token" (f4420–4560). Hero stamp "2–4×" beside the stacks (f4440–4560; the same string in both languages) | x-article-super-agent | 2026-11-08 · A; calc |
| Design (§5): the Agent Loop runs in stateless cloud containers and keeps its state in a database, so a sleeping or offline local device no longer stops the agent (blocks 90, 92). Each endpoint runs a lightweight daemon that keeps no session state (block 96) [V]. The prototype has none of this: it runs as one local DeepSeek Harness process serving 127.0.0.1 (docs/006-deployment.md:7) with one SQLite state file (docs/007-architecture.md:452) and no endpoint daemon [V] | C24 "Proposed: a cloud loop that works while your laptop sleeps." Tag "proposed · not in the public prototype / 设想 · 公开原型未实现", f4600–4960, under C24 and N8. The lid shuts; the loop, a state cabinet and a daemon clip beside each machine are vellum sheets laid flat beside the machines, never a cloud above them. The Persistent plate docks in vellum (f4620) | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-08 · A; P |
| Design (§6): an independent control loop outside the main system (block 101). Many failures are not crashes: "the process is still running, but the model is stuck in an unproductive loop or has drifted from its goal." (block 102). A Watchdog Session on scheduled messages handles infrastructure failures and has the model judge whether each Worker is making real progress (block 103) [V]. The prototype has no Watchdog. Its operator can schedule an hourly status-and-restart prompt, run by an agent in another Harness profile, which reads the log after a failed restart and judges no progress or drift (docs/006-deployment.md:133–141) [V] (Q4). Proposed | N8 "A watchdog checks progress, not just that it's alive." / 看门狗盯的是进展 不只是还活着. Under the proposed tag. The inspection station is all vellum, outside the system's boundary. The Worker it flags keeps its solid work light, since a running Worker is built, while its spool circles one step | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-09 · A; P |
| An open problem (§8.4): if a server-side intrusion or a prompt injection compromises the cloud Agent Loop, every endpoint device connected to it could be taken over (block 135) [V]. Security is one of four open areas (block 122) | C25 "Open risk: a hijacked loop could reach all connected machines." Two beats of silence (f4960–5000), then a hatched slip reaches the Register (f5000) and the etch spreads along the vellum tethers, one machine a beat. A pencil "?" stays | x-article-super-agent | 2026-11-08 · A |
| Sharding the Router would trade the shared memory and continuity of one Router for throughput (block 37); when and how finely to shard is open (block 124); at the tested load there was no need to shard (block 120). After months of running, long-term memory becomes the main bottleneck (block 125) [V]. The prototype has one main Session (docs/007-architecture.md:475) [V]. "Speed" stands for throughput, as in C7. Open | N9 "Shard the Router and continuity trades against speed again." / Router 一分片 连续性和速度又要权衡. In pencil the Register splits and its tape tears; C7's balance returns for one beat; the tape fades beyond the window (memory over months) | x-article-super-agent; dsh-superagent-prototype-8c32a9d | 2026-11-09 · A; P |
| Many tasks still need a person partway through; how to let users step in, take over or work alongside at any point is open (block 128) [V]. The line qualifies C27 and C28. Open | N10 "Many tasks still need you midway: how to step in is open." / 许多任务仍需人中途介入 怎么介入尚未解决. A pencil handle with a "?" on a running bay's door, just beyond your lamp | x-article-super-agent | 2026-11-09 · A |
| Block 17 says classic systems ideas apply, and block 138 that the design applies them "rather than proposing new theory" [V]. The authors' framing | N11 "None of this is new theory: it is classic systems design." / 这些不是新理论 而是经典的系统设计 | x-article-super-agent | 2026-11-09 · A |
| The article names each idea itself: Fast/Slow Path (block 47), batching in prefill (blocks 33–35), the context cache (block 63), the full-duplex async loop (block 79), compute and state separation (block 90) and an external control loop (block 101) [V]. It also names the global sequence point (31) and speculative execution (73), which get no label. Analogies the article does not draw (pub/sub, actors, the event loop, Lampson, Denning) stay in the description and README. The authors' framing | Labels "Fast / Slow Path · batching · cache · full-duplex · compute–state split · control loop" / "Fast / Slow Path · 批处理 · 缓存 · 全双工 · 存算分离 · 控制回路", f5580–5870 (Fast / Slow Path reads the same in both languages and is drawn once), one settling on its part of the 0.5× summary map a beat | x-article-super-agent | 2026-11-09 · A |
| Models need less and less human intervention on single tasks, so the bottleneck is shifting to human attention (blocks 4, 139) [V] | C26 "As models need less help, your attention becomes the limit." | x-article-super-agent | 2026-11-08 · A |
| People's role moves up, to higher-level decisions and sign-off (blocks 4, 139) [V]. N10 qualifies it (block 128) | C27 "So people move up: to decisions, and to sign-off." | x-article-super-agent | 2026-11-08 · A |
| The design's aim is that the system takes over managing sessions and syncing context (block 139) [V]. "By design" claims that aim, not a measured outcome | C28 "Your agents work in parallel. By design, you don't have to." | x-article-super-agent | 2026-11-08 · A |
| The English title [V] | End card: "Source: 'Exploring Super-agent Design: Towards a More Autonomous Agent System'" | x-article-super-agent | 2026-11-08 · A |
| "Yujia Qiao implemented the system and wrote the article"; the article is "based on shared work by the DeepSeek Harness team" (block 143) [V] | End card: "DeepSeek Harness team · author Yujia Qiao" / "DeepSeek Harness 团队 · 作者 Yujia Qiao" | x-article-super-agent | 2026-11-08 · A |
| The Chinese original appeared on 2026-10-31. At 21:36:35 Beijing time IT之家 reported that the DeepSeek Harness team had published it that day, and 量子位 reported it at 21:49:44. A post linking its WeChat address dates from 14:41:48 UTC that day, and Bloomberg (in syndication) dates the WeChat post to Saturday, 31 October [S]. The original itself was not read [U] | End card: "Chinese original 31 Oct 2026" / "中文原文 2026-10-31" | ithome-2026-10-31; qbitai-2026-10-31; x-post-shao-meng-2026-10-31; bloomberg-deccan-2026-11-01; wechat-original | 2026-11-08 · R; the linking post via the fxtwitter API; Bloomberg in the Deccan Chronicle syndication |
| The X post carrying the article was created 2026-11-01T11:37:54Z (19:37 Beijing time). The article's first block says it is a machine translation of the Chinese original (block 1) [V] | End card: "machine-translated 1 Nov 2026" / "英文机译 2026-11-01" | x-post-super-agent; x-article-super-agent | 2026-11-08 · A |
| IT之家 gives the Chinese title as 《Super-agent 设计探索：迈向更自主的 Agent 系统》 [S]. 量子位 gives "Super-agent：迈向更自主的Agent系统", without 设计探索 [S]. The IT之家 form matches the English title; it stays [S] until the original is read | zh end card: 原文：《Super-agent 设计探索：迈向更自主的 Agent 系统》 | ithome-2026-10-31; qbitai-2026-10-31 | 2026-11-08 · R |
| Our own statements: we drew the charts from the article's numbers (blocks 113, 120), and the film has no affiliation with DeepSeek | End card: "Charts re-plotted from the authors' synthetic tests · Not affiliated with DeepSeek" / "图表据作者模拟实验重绘 独立解读 与 DeepSeek 无关联" | x-article-super-agent | 2026-11-08 · A |
| Solid parts (enamel and graphite) are what the prototype has at `8c32a9d`. Dashed parts (vellum with a dashed edge) are what the article proposes and the prototype lacks. Sketched parts (pencil) are what the article lists as open (§8). See "Built vs proposed" | Key "solid: built · dashed: proposed · sketch: open / 实线：已实现 · 虚线：设想 · 手绘线：未解", each entry beside a sample of its material: first as a legend on the summary map (f5590–6010), then on the end card (f6240–6700) (open item 6, resolved) | dsh-superagent-prototype-8c32a9d; x-article-super-agent | 2026-11-08 · P; A; frames 2026-11-09 |

## Open before the script locks
1. **C18 overstated the decision saving: resolved 2026-11-08.** The article says that without
   pass-through the Router makes about 30% more decisions (block 116), so with it the Router
   makes about 23% fewer (1 − 1/1.3 ≈ 0.23). The approved line said "about 30% fewer", the
   same slip as turning the article's "about 37% more" tokens into "37% fewer". It now reads
   "Not faster tasks: about 23% fewer Router decisions." / 任务不会更快 但 Router 决策约少 23%
   (the treatment's 决策少约 23% with 约 moved before 少, signed off on 2026-11-08), with its
   holds re-checked (SCRIPT.md). The ghost tally is drawn about 1.3× as long as the real one,
   so the real tally is about 77% of the ghost.
2. **C12 sat under the built tag: resolved 2026-11-08.** "Only the Router talks to you" is the
   article's design; the prototype only partly follows it, since its Workers write their own
   acknowledgements and reply on GitHub. The tag now ends where C12 begins (f2130 in the 3:45
   cut), so it sits only under C11 (a Worker per task, which is built). The Router's reply in
   C12 stays solid: the prototype's Router does deliver IM answers and results, and only the
   word "only" is the design.
3. **"Unprompted" (C22): resolved 2026-11-08.** The baseline had a neutral prompt that still
   allowed a subagent "when appropriate" (block 110), not no prompt. C22 now reads "Left to
   choose, the single session never delegated." / 自行决定时 单 Session 从未委派.
4. **The stress plate: resolved 2026-11-08.** It reads "~1 → ~40 /min", as the article says
   about 1 to about 40 (block 120).
5. **双层 or 两级: resolved 2026-11-08.** The coverage calls the architecture 双层架构 and
   uses 两级 for the two-stage filter (两级过滤). The architecture is 双层架构 everywhere it is
   named (C8, the built tag, the third lane, C23). No line names the filter, so 两级 is not
   used.
6. **The end-card key's third entry: resolved and signed off 2026-11-08.** "sketch:
   open" / 手绘线：未解. 手绘线 names a line type, as 实线 and 虚线 do; 草图 (TREATMENT.md's
   adaptation) names a drawing. In the Register Desk this status is drawn in pencil, kept for
   what is open; the counterfactuals are grey-stock cards, not sketches.

**The 3:45 cut's accuracy questions (Q1–Q10): settled 2026-11-09**, against the article
(through the mirror) and the prototype at `8c32a9d`.

| # | Question | Answer | What the film does |
|---|---|---|---|
| Q1 | Do pass-through follow-ups reach the Router? | Yes, as a notice, not a decision (block 58; src/app/runtime.ts:142–146; src/app/notices.ts:98–106) | A faint notice row on the Register's tape. Never says or shows that the Router does not see them |
| Q2 | Who posts PRs and GitHub replies? | Design: the Router layer handles all external interaction (block 86). Prototype: Workers, through `gh` (prompts/worker.md:5; prompts/work.md:28–29), all under one agent account (src/sources/github-channel.ts:1). The Router writes the acceptance acknowledgement, answers, results and questions (src/app/tools/main.ts:53, 224–233) | The GitHub dossier has no sender line and no Router-to-GitHub delivery line |
| Q3 | Does C12 hold for IM? | Mostly: the Router owns answers, results and questions (prompts/replies.md:25, 31; prompts/work.md:18), but Workers' short acknowledgements are posted in the IM thread (prompts/replies.md:17) | C12 stays as signed off, a design statement after the built tag; an alternative is open item 7 |
| Q4 | Can any part of the Watchdog be drawn as built? | No: the hourly check restarts the service and reads logs, with no progress or drift check (docs/006-deployment.md:133–141) | N8 under the proposed tag; the station in vellum |
| Q5 | Do card sizes go on screen? | They are prototype details ("Numbers and their caveats") | Off screen. tag-cache says "prototype: summaries and read pointers" |
| Q6 | Is the async loop on in the prototype? | Yes, in its presets: background after 5 s (docs/003-execution.md:27, 29) | tag-jobs "prototype: background after 5 s"; never `start()`/`stop()`. Block 83 is open item 8 |
| Q7 | Are the trait words the authors'? | 连续 / 高效 / 主动 / 持久 in IT之家, 量子位, the eimoon reprint and 智东西 (via Sina, 2026-11-01) [S]; the original is unread | Used, pending the zh sign-off |
| Q8 | Is the token mapping right? | Yes: 23.2M Super-agent, 31.8M without pass-through, 6.1M neutral prompt, 10.8M delegation-first, in "cache-read tokens per run (all sessions)" (block 113) | Unchanged |
| Q9 | Is a Ticket stub on the Router's tape fair? | As a metaphor. Code writes the Ticket (src/app/store.ts:75; docs/001-domain.md:35, 37); the Router's record holds the route result, then ticket cards with a `read: ticket/<id>` pointer (docs/007-architecture.md:536; src/app/cards.ts:26–33) | A stub on the tape, the full record behind its pointer. The Register never holds the whole Ticket |
| Q10 | Does the Router run the Slow Path? | Yes. The code gate comes first (src/core/intake.ts:25–28; src/policy.ts:191–211), then the main Session assesses proactive candidates (src/app/assessment.ts:84–104; prompts/shared.md:3); explicit requests are routed, not assessed | The loupe on the Register's throat, for new events with no subscriber |

**Still open**

7. **C12's wording, an option for the user.** C12 stays as signed off: "Workers report up.
   Only the Router talks to you." The alternative is "Workers report up. Only the Router
   answers you." It holds in the prototype's IM too, where Workers post only short
   acknowledgements, though on GitHub Workers still reply to review threads
   (prompts/work.md:28). It would need a new zh line, the zh sign-off and its hold
   re-checked.
8. **Block 83 against the Harness default.** Block 83 says DeepSeek Harness implements the
   async mechanism but does not yet enable it by default. At Harness `fcc0ad4` the bash
   tool's `promoteOnTimeout` and `enableRunInBackground` default to true and the `standard`
   preset mounts `tool-jobs` [V, code], so block 83 may be dated or mean something narrower
   [U]. Which preset a fresh Harness profile gets was not read. The film speaks only of the
   prototype (tag-jobs) and says neither "on by default in DeepSeek Harness" nor "off".
9. **N4 and "up to a point".** Block 35 bounds the batching gain by context length and by how
   many Triggers the model handles accurately in one turn, and the time per request does rise
   (2.5 s → 3.9 s, block 120). N4 says "adds little time", block 33's own word, and the plate
   shows only the endpoints. Either keep N4 as it is, or add the limit, which needs a new hold
   and a zh check. To be decided before the copy locks.

The zh lines kept from the 2:56 cut were signed off on 2026-11-08; every new zh string waits
for the user's sign-off (SCRIPT.md, "zh sign-off").

## Built vs proposed
At `8c32a9d` (the only commit on the prototype's default branch, MIT) the matrix is as
follows. All entries are [V], read in the repository's docs and code by the research and
verify passes on 2026-11-08, with the cited lines re-read for this file and the 3:45 cut's
rows re-checked on 2026-11-09.

| Part | In the article | At `8c32a9d` | In the film |
|---|---|---|---|
| Two levels: one long-lived Router, one Worker per task | §2 | Built. One main Session in the Router role (docs/001-domain.md:80; docs/007-architecture.md:475). Per Ticket, an Executor Session and its own directory (docs/003-execution.md:25). 3 Workers by default, 1–16 allowed, plus one slot kept for a person's message (src/policy.ts:93; docs/003-execution.md:57–61) | Enamel and graphite, with the built tag under C11 |
| The Router neither executes nor decomposes | Blocks 31–32 | Built differently. No write or edit tools, but a restricted shell: `bash`, file reads and job tools (src/app/sessions.ts:263). "Avoiding code reads is a prompt rule, not a tool restriction" (docs/007-architecture.md:507). The article's Router "can run without a Bash tool" (block 31); that is an option the prototype does not take. The main Session also runs the Slow-Path assessment (Q10) | Solid, with no workbench. The Register always carries its restricted-shell key: it is never shown shell-less |
| Event sources | Chat, email, calendar, code review, CI (block 44) | GitHub, plus Feishu if switched on. No email or calendar (docs/001-domain.md:68) | Generic forms: chat slip, punched card, envelope, calendar leaf. They stand for the article's channels, not the prototype's. N6's question comes from GitHub |
| Two-stage filtering | §3.1 | Built: a code gate, then a model assessment by the main Session. Proactive pickup is only recorded by default (`observe`); explicit requests work in every mode | Solid gate and loupe, with the gate tag under N3 and C14 |
| Threads, subscription and pass-through | §3.2 | Built as many-to-many Subscription fan-out (docs/001-domain.md:37). A person's follow-up skips Eval but reaches the main Session as a notice (Q1) | Solid cord ride, with a faint notice row on the tape |
| Batching | Blocks 33–35; the stress test in §7.2 | Built in its own form: per-Thread Eval batches (docs/001-domain.md:43), and relays to a busy main Session delivered together at its next step (docs/007-architecture.md:42). The stress-test numbers are the authors' and cannot be reproduced from the repository | Solid strip and sweep. The plate says "stress test · mock Workers" |
| Only the Router replies to people | Blocks 40, 86 | In part. The Router delivers IM answers and results; Workers write their own acknowledgements, posted in the original thread, open PRs and reply to GitHub review threads (prompts/replies.md:13, 17, 25; prompts/work.md:18, 28–29) | Design: C12 comes after the built tag has ended; the reply slip is solid; the GitHub dossier has no sender line (Q2) |
| Inline & Spill, Chain of Recall | §3.3 | In prototype form: `worker_report` cards with a summary and a read pointer, 50-character stubs, 160-character previews, every shown ID readable through a tool (docs/007-architecture.md:546, 575, 589; src/app/cards.ts:8); no dedicated multi-hop recall [U] | N5 and N6 at the Register's reading window, under tag-cache. No card sizes |
| Acting ahead ("silently reproduce and fix") | §3.4 | Only a test fixture, not a default rule | Left out |
| Asynchronous full-duplex loop | §4.1. Block 83: in DeepSeek Harness, not enabled by default | Built through Harness background jobs: the worker and router presets move a foreground command to a job after 5 s (docs/003-execution.md:27, 29), and a finished job wakes the Session (:33) | N7, with tag-jobs: a capsule on a side rail while the door stays open (open item 8) |
| 100-word IM cap | Block 87 | Built (src/infra/text.ts:3; src/app/outbox.ts:29); acknowledgements are capped in every channel (src/app/tools/executor.ts:33) | tag-100 on the reply slip |
| Cloud compute with state in a database; endpoint daemons; BYOM | §5 | Absent: one local process and one SQLite file | Vellum (dashed), under the proposed tag. BYOM is picture only |
| Watchdog | §6 | Absent. The operator can set up an hourly status-and-restart prompt, run by an agent in another Harness profile (docs/006-deployment.md:133–141): the infrastructure half only, with no progress or drift judgement | N8 under the proposed tag; the station in vellum |
| Sharding, long-term memory, sessionless UI, A2A, security | §8 | Absent; open in the article | Pencil: the split Register and its torn tape (N9), the missing handle (N10), the hijack's "?" (C25). A2A and the rest of sessionless UI are left out |
| The §7 experiments | §7 | No experiment code in the repository | Credited to the authors' tests |
| Four traits | Blocks 13–16, 18 | Requirements, not code | Enamel plates; Persistent's in vellum |

Answers to the fact questions the treatment left open (the 3:45 cut's are Q1–Q10 above):
- **Do the prototype's Workers reply to people?** Yes, in part. They write their own
  acknowledgements, which the host posts in the request's original thread, and they reply to
  GitHub review threads. IM answers and results go through the Router.
- **Is batching in the prototype?** Yes, per Thread, and relays to a busy main Session are
  taken together at its next step, so a solid strip is fair. The §7.2 numbers come from the
  authors' test only.
- **Is a request addressed to the agent "proactive pickup"?** No. Explicit requests from
  allowed people work in every mode (docs/000-philosophy.md:11). Only unaddressed ("inferred")
  candidates are record-only by default. The film never shows its request addressed to the
  agent, and the Register's loupe judges it, so it reads as a proactive pickup: out of the box
  the prototype would record it, not take it [U, our reading of the picture]. This is why beat
  5 is named "by design" and N3 and C14 sit under the gate tag.
- **"~40×"** no longer appears: C16 was cut, and the plate shows the arrival rates.

## Numbers and their caveats
**The ablation (§7 and §7.1, blocks 106–116)**
- **Setup.** The workload is synthetic, in a simplified environment, and the results are
  "indicative only" (block 106). Each run had about 300 messages and about 20 work requests
  (tag-load). Coding was simulated by a tool that only consumes time, so the test measures
  scheduling, not coding. Four designs ran at the same time, each 5 times (block 108). The
  article names no model.
- **Clock.** Fig 23's caption (block 112) says message intervals and work durations were
  scaled by 1/4 and model call times were not. The table (block 113) does not say which clock
  its minutes use. So the film shows no minutes. The lanes share one unitless scale, with p50
  and p95 at 20.4 and 29.5, 13.8 and 29.0, and 12.4 and 15.7. No line states a duration.
- **Slowest tasks (p95).** 15.7/29.5 ≈ 0.53 and 15.7/29.0 ≈ 0.54, so "about half" (C20, and
  the stamp "~½") against both single-session baselines.
- **Typical tasks (p50).** (13.8 − 12.4)/13.8 ≈ 0.10, so "~10%" (C21 and its stamp) against
  the stronger baseline. Against the neutral-prompt baseline the same sum gives
  (20.4 − 12.4)/20.4 ≈ 0.39. That baseline never delegated, so the film does not use 39%.
- **Tokens.** 23.2/10.8 ≈ 2.1 and 23.2/6.1 ≈ 3.8, shown as "2–4×" (C23 and its stamp),
  rounded to whole numbers.
- **Pass-through.** It makes tasks no faster: p50 12.4 against 12.6 and p95 15.7 against
  15.5. Without it, tokens are 31.8/23.2 ≈ 1.37 times as many (the article's "about 37%
  more"), so with it there are about 27% fewer (1 − 23.2/31.8 ≈ 0.27). Without it the Router
  makes about 30% more decisions, so with it about 23% fewer (1 − 1/1.3 ≈ 0.23). C18 says
  "about 23% fewer" (open item 1, resolved).
- **Delegation.** The neutral prompt delegated in 0 of 5 runs and the delegation-first prompt
  in 4 of 5 (block 115).

**The stress test (§7.2, blocks 118–120)**
- The Router called a real model; the Workers used mock models (block 118).
- Triggers needing a decision rose from about 1 to about 40 a minute. The plate shows these
  arrival rates; C16's "~40×", their ratio, was cut with C16.
- The average batch size grew from 1.0 to 2.8 and the time per request from 2.5 s to 3.9 s.
  The amortised inference time per decision fell from 6.4 s to 1.6 s, a quarter (block 120).
- Time per decision is an amortised average, not the time any one decision takes. A decision
  can span several LLM requests (block 118), so it cannot be derived from request time and
  batch size. The film shows only the end points of arrivals and of time per decision,
  labelled "avg", and neither batch size nor time per request.
- N4 gives the authors' reason (blocks 33, 35). "Little" is block 33's word; the gain holds
  only up to a limit (block 35; open item 9).
- These numbers come from the authors' test, not from the public code.

**Prototype numbers**
- **On screen, two:** "5 s" (tag-jobs, the presets' foreground-to-background threshold,
  docs/003-execution.md:27, 29) and "100 words" (tag-100, `IM_WORDS`, src/infra/text.ts:3).
  A word there is an `Intl.Segmenter('zh')` word-like segment, so a zh 词 is a segmented word,
  not a character.
- **Off screen (Q5):** the card sizes behind N5 and N6 stay off screen; tag-cache says
  "prototype form" only.

  | Item | Size | Where |
  |---|---|---|
  | `worker_report` summary | Up to 600 characters, plus a `read:` pointer when truncated | docs/007-architecture.md:589; src/app/notices.ts:110–112 |
  | Message stubs | 50 characters | docs/007-architecture.md:546; src/app/assessment.ts:37 |
  | Card previews | 160 characters | src/app/cards.ts:8 |
  | Assignment inline | Up to 1,500 characters | docs/007-architecture.md:594; src/executor/dsh.ts:113 |
  | Pages | 4,000 UTF-16 code units, 8,000 at most | docs/007-architecture.md:577; src/app/tools/tool.ts:30–31 |

- **Also off screen:** the `standard` preset's 60 s threshold for Worker subagents, the 3
  Workers by default (1–16), and the 30-word routing notes.

**Other numbers**
- **3–5** is the authors' experience (block 6), never a measured limit, and the picture draws
  no number for it.
- **Real-world durations:** the film says nothing about them. The workload was synthetic and
  the coding simulated.

## Chinese text check
**Signed off 2026-11-08.** The user, the fluent reader, checked every zh-Hans string of the
2:56 cut in SCRIPT.md (section "zh sign-off", the same strings as `src/cues.ts` `WORDS`) and
answered "Correct as written". Any string added or changed after that date needs the same
check again.
- **New in the 3:45 cut: signed off 2026-11-09 ("Correct as written").** N1–N11, tag-100,
  tag-load, tag-cache, tag-jobs, the four trait words and the six classic-idea labels. The three hero stamps ("~½",
  "~10%", "2–4×") are the same strings in both languages and need no translation, only the
  tick in the checklist. C13, C16 and C19 were cut, so their signed-off strings are no longer
  on screen; C19's numbers return in tag-load, in new wording.
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
| 切换 / 逐次下指令 / 等待 / 守着它们别停 | N1 (draft) | Ours [U]. The chores rhyme with their hand-overs: 逐次下指令 returns in N3, 切换 as 换个渠道 in N6, 等待 as 等它跑完 in N7, 别停 as 它也不停 in C24 |
| 人肉 Router | C4 | Our coinage [U]. Its register is for the user to judge |
| 串行 / 串味 | C5 | Ours [U] |
| 连续性 / 速度 | C7, N9 | Ours [U]. IT之家 names the four traits 连续、高效、主动和持久 [S]; 速度 matches the EN "speed" |
| 双层架构 | C8, built tag, third lane, C23 | The coverage and the reprint call the architecture 双层架构 (IT之家's headline; 量子位; the reprint's §2) [S]. Both reports and the reprint use 两级 for the two-stage filter (IT之家 两级过滤, 量子位 两级事件过滤机制) [S], which no line names, so 两级 is not used (open item 5, resolved) |
| 渠道 | C9, N6 | The prototype's glossary: Channel 渠道 [V]. IT之家: 不同渠道 [S]. The reprint's 多信道 is not used |
| 连续 / 主动 / 高效 / 持久 | Trait plates (draft) | IT之家, 量子位, the eimoon reprint and 智东西 (via Sina, 2026-11-01) [S] (Q7) |
| 任务都经过它 / 瓶颈 | N2 (draft), C26 | Ours [U]. 瓶颈 passes from the Router in N2 to your attention in C26 |
| 公开研究原型 / 原型 | Tags | IT之家: 原型实现 [S]. The README: "research prototype" [V] |
| 监听事件 | N3 (draft) | Ours [U] |
| 主动接单 | Gate tag | Ours [U]. 主动 is the article's trait as IT之家 lists it (连续、高效、主动和持久) [S] |
| 合并处理 | C15, N4 (draft) | Ours [U]. IT之家: 合并积压事件 [S]. The reprint titles §7.2 Router层的批处理 [S] |
| 输入长 输出短 | N4 (draft) | Ours [U] |
| 压测 / 模拟 Worker | Plate | Ours [U] |
| 上下文是缓存 / 摘要 / 指针 · 摘要加读取指针 | N5, tag-cache (drafts) | Ours [U]. 读取指针 renders the prototype's `read:` pointer [V] |
| 顺着 ID 一跳一跳 | N6 (draft) | Ours [U]. IT之家 names the mechanism 链式召回（Chain of Recall）[S], which no line uses |
| 直通 | C17 | IT之家: 事件直通机制; 量子位: 订阅与直通机制 [S] |
| 决策 | C18, C27 | 量子位: Router的决策次数 [S] |
| 耗时操作转入后台 · 5 秒后转入后台 | N7, tag-jobs (drafts) | Ours [U]. IT之家's 异步 ReAct Loop [S] is not used |
| 聊天回复：≤ 100 词 | tag-100 (draft) | Ours [U]. 词 matches the prototype's word count [V]; whether 词 reads naturally is a question for the sign-off. 聊天回复 replaced the draft 群聊回复, which was narrower than "chat": the article's example is a group chat (block 85), but the cap covers every IM reply (block 87) |
| 模拟实验 / 本片重绘 / 仅供参考 | Chart tag | Ours [U]. The reprint titles §7 初步实验 [S] |
| 每次运行：约 300 条消息 · 约 20 个工作请求 | tag-load (draft) | IT之家: 约 300 条消息，其中约 20 条为工作请求 [S]; 个 as in the signed-off C19 |
| 中位 / 中位数 / 最慢 | Legend, C21 | 量子位: 中位数 and 95分位数 [S]. 最慢 for p95 is ours [U] |
| 基线 / 委派 / 被要求委派 / 自行决定 | C21, C22, lane | Ours [U] |
| 缓存读取 token | Token header, C23 | 量子位: 读取缓存Token [S] |
| 设想 · 公开原型未实现 | Tag, C24 | Ours [U] |
| 云端 | C24 | IT之家 and 量子位: 云端 Agent [S] |
| 看门狗 / 进展 / 还活着 | N8 (draft) | 量子位: 看门狗 [S]; IT之家: 外部控制回路 [S]. Keeping "Watchdog" in Latin is the alternative. 进展 / 还活着 are ours [U] |
| 循环被劫持 / 相连机器都可能失守 | C25 | Ours [U] |
| 分片 / 权衡 | N9 (draft) | Ours [U] |
| 中途介入 / 尚未解决 | N10 (draft) | Ours [U] |
| 新理论 / 经典的系统设计 | N11 (draft) | Ours [U] |
| Fast / Slow Path · 批处理 · 缓存 · 全双工 · 存算分离 · 控制回路 | Labels (drafts) | Fast / Slow Path kept in Latin, as the glossary keeps it [U]; the English label reads the same, so it is drawn once. 批处理: the reprint's §7.2 [S]. 全双工: the reprint's 全双工交互 [S]. 存算分离: the reprint [S]. 控制回路: IT之家's 外部控制回路 [S]. 缓存 is ours [U] |
| 注意力 / 瓶颈 | C26 | IT之家: 限制生产力进一步提升的因素正逐渐转向人的注意力 [S]. 瓶颈 is ours [U] |
| 决策 / 验收 | C27 | The reprint: 更高层的决策与验收 [S]; not in IT之家 or 量子位 |
| 原文：《Super-agent 设计探索：迈向更自主的 Agent 系统》 | End card | IT之家 [S]; 量子位 drops 设计探索 [S] |
| 英文机译 | End card | The English is a machine translation (block 1) [V], and 英文机译 says so; the treatment had 英译 |
| 图表据作者模拟实验重绘 / 独立解读 与 DeepSeek 无关联 | End card | Ours |
| 实线：已实现 · 虚线：设想 · 手绘线：未解 | Summary-map legend, end-card key | Ours [U]. 手绘线 is a line type like 实线 and 虚线; it replaces the treatment's 草图 (open item 6, resolved). The Register Desk draws this status in pencil, so 铅笔线 stays the sign-off's alternative |

## Simplifications
- **"Router" stands for "the Router layer".** The article lets that layer be more than one
  session and partly code (blocks 29, 33). The film draws one Register, the design the
  authors chose (block 33).
- **"Hears every channel".** Code drops the noise first. The Router still sees every event
  (block 58) but judges only new events with no subscriber.
- **The chores.** "Four chores", and the pairing of each with one trait, are our framing of
  blocks 6, 7, 44 and 18. The trait words are the article's (blocks 13–16).
- **Workers are single bays.** In the article a Worker may use subagents or be an Agent Team
  itself (block 42).
- **Pass-through is a ride over the Register.** It skips the Router's decision, not its view:
  a faint notice row stays on the tape (Q1).
- **The Ticket stub.** A stub on the Register's tape stands for the Ticket record, with the
  full record behind its pointer; the Register never holds the whole Ticket (Q9).
- **Context as a cache at the Router.** The article applies Inline & Spill to whichever
  session gets an event (block 62). The film shows it at the Register's window, where the
  prototype's `worker_report` cards make it clearest, and leaves out inlining the neighbours.
- **Recall as hops along the film's own routes** (tape row, stub, Thread cord, the bay's last
  report), not the article's pointer graph. It starts from a GitHub comment because the
  prototype has no email source.
- **The slip and the dossier.** A short slip with a "≤ 100" stop tab stands for IM replies,
  and a heavy dossier for a PR's dense detail (block 88). The dossier has no sender line,
  because the design and the prototype differ on who posts it (Q2).
- **"Slowest" and "typical".** "Slowest" means p95, the 95th percentile, and "typical" means
  p50, the median.
- **Lane names.** Both single-session designs had a subagent tool. "One session" is the
  neutral prompt and "told to delegate" the delegation-first prompt. "Left to choose" (C22)
  means the neutral prompt, which allowed a subagent "when appropriate" (open item 3).
- **Rounded figures.** "2–4×" rounds 2.1× and 3.8×, and the stamp "~½" rounds 0.53 and
  0.54. The plate keeps "~1 → ~40 /min" as the article gives it.
- **The charts** are re-plotted as unitless lanes. tag-load gives "about 300" and "about 20"
  in words; any marks drawn for them count exactly 300 and 20.
- **The request is an illustration.** It is a generic, bug-like event: a vermilion chat slip
  1.3× the size of the others, with a beetle cut-out. Its route through every mechanism
  (filter, Register, Worker, report, recall, follow-up, background job, reply, sign-off) shows
  the design, not a documented case. It is never one of the test's work requests. None of the
  article's examples, IDs or dialogues are used, on screen or in the micro-print.
- **"About 3–5" in the picture.** About four of eight folders stay warm, with no number or
  threshold drawn.
- **Batching** is drawn as one strip a downbeat that grows with the load. No batch size is
  shown.
- **The Watchdog's stuck Worker.** The Worker's work light is solid, since a running Worker is
  built; the sightline that flags it is vellum, since the progress check is proposed.
- **"Proposed" for §5.** The article describes it as design. Its internal instance is "built on
  these ideas" and runs continuously (block 138), but how it is deployed is not public, and
  the public prototype runs locally.
- **The hijack.** The article names a server-side intrusion or a prompt injection (block 135).
  The film shows one route: a hatched message entering through chat.
- **The open problems in pencil.** Sharding (N9), memory over months (the tape fading in N9's
  picture), stepping in midway (N10) and the hijack (C25). The other open areas are left out.
- **Left out, with where to find them:**
  - acting ahead (blocks 73–74);
  - the lighter-model point for the Router (block 32);
  - BYOM in words (blocks 97–98; picture only);
  - per-channel norms beyond the 100-word cap (blocks 85–86, 88);
  - the Watchdog's repairs and maintainer questions (block 104);
  - credentials (block 136);
  - Worker topology and a Router-trained model (block 124);
  - sessionless interfaces beyond stepping in (blocks 127, 129);
  - A2A and context boundaries (blocks 131–132);
  - C13's "implementation detail" line (block 27), which goes to the description.

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
- **Proactive is "by design".** Beat 5 is named "by design", and N3 and C14 sit under the gate
  tag "prototype: proactive pickup off by default". The film does not show the public
  prototype taking unrequested work out of the box; the Proactive plate names the trait, not
  a default.
- **Nothing about real-world task durations.** No minutes appear on screen. The test's coding
  was simulated, its clock scaled (block 112), and the table's clock is not stated.
- **No misreadings.** The Router does not decompose tasks (block 32). Workers do not talk to
  each other directly (blocks 41, 124). The Router is never said or shown not to see
  follow-ups: it skips only the decision (block 58; Q1). There is no "39% faster" and no "16 vs
  29 minutes".
- **No "forgets nothing".** Recall along IDs reduces what the Router loses (blocks 68–71); it
  does not end forgetting, and memory over months is open (block 125).
- **Nothing beyond the public code.** The Register always carries its restricted-shell key:
  the prototype's Router is never shown shell-less. The cloud loop, BYOM, the Watchdog and the
  experiment code are never shown as in the public repository, and the prototype's card sizes
  stay off screen.
- **The Watchdog is only proposed.** Its station is vellum, under the proposed tag. The
  prototype's hourly restart check is not shown as a Watchdog, and no progress judgement is
  drawn solid (Q4).
- **Nothing about Harness defaults.** The film says neither that the async loop is on by
  default in DeepSeek Harness nor that it is off in the prototype (open item 8), and never
  names `start()` or `stop()`.
- **No model named.** The article names none.
- **Not new theory.** The article says it applies classic systems ideas (blocks 17, 138), and
  N11 says so. The film does not call the idea new or first, and it labels only the six ideas
  the article names.
- **Not Anthropic's image.** The brain/hands metaphor of Anthropic's essay
  (anthropic-managed-agents), which the article cites in block 97, is not used.
- **Nothing about the security of the shipped code.** The open risk on screen is the article's
  own, about its proposed cloud design (block 135), not a finding about DeepSeek Harness or
  the prototype.
- **"By design, you don't have to"** states the design's aim, not a measured result. N10
  qualifies it: many tasks still need a person midway (block 128).
