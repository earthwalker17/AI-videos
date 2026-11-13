# Script: Who Routes the Agents?

There is no narration voice: the film is text-led ("Text-led, no voice (Recommended)", chosen
by the user on 2026-11-08), so the on-screen lines are the narration. This is the 3:45 cut
("~3:45, full depth (Recommended)", chosen by the user on 2026-11-08/09): 84 bars (6,720
frames, 3:44.0), 13 beats and 36 narration lines. Each line is one English line in the
lower-left notes block (baseline y 938, at most 1560 px wide). It was written as an English line
over a Simplified Chinese one (zh at y 992). On 2026-11-13 the user dropped Bilibili, and with it
the zh captions, so the picture draws the English line alone. The zh copy below stays signed off
and in the cue sheet, which still checks its holds. The tags, the plates, the labels and the test
sheet sit in the world, beside what they qualify, and keep their zh.

- **One source.** Every string and frame below comes from [src/cues.ts](src/cues.ts) (`WORDS`,
  `NARRATION`, `BEATS` and the cue sheet). [src/cues.test.ts](src/cues.test.ts) checks the rules
  stated here. Change the copy there first, then here.
- **Frames.** Frames are film frames at 30 fps (90 bpm, 80 frames a bar; bar n, beat b starts
  at (n − 1) × 80 + (b − 1) × 20), counted after the review cut's 15-frame test card. The frames
  of a cue are its on-screen window: a 6-frame left-to-right wipe in at the start and a 6-frame
  fade out at the end. The line is fully visible and unchanged for the window minus 12 frames
  ("Visible").
- **Holds.** "Needs" is max(1.8 s, reading time + 0.6 s) + 0.1 s for that language. Reading
  time is CJK characters / 4.5 + other non-space characters / 15
  (`readingSeconds` in `@aiv/core`). Every cue clears it in both languages. The smallest
  margins beyond it are all in zh: 0.06 s (C7, N2, N4, N5 and C27), then 0.10 s (C2, C9 and
  C17). In English the smallest is 0.17 s (C17, C21 and N9); among the tags it is the built
  tag's 0.28 s in zh.
- **Lines.** Every English line is at most 62 characters and every zh line at most 34 CJK
  widths. The zh lines follow the Netflix zh-Hans style
  ([references/subtitles.md](../../references/subtitles.md)): no commas or full stops, a
  space for a pause, full-width ： and ？.
- **Sizes.** Text meant to be read is at least 36 px. Small real print on paper and plates
  (at least 18 px) is texture only: it carries no line of the film and is not listed here
  ("Micro-print as texture (Recommended)", chosen by the user on 2026-11-08/09).
- **Captions.** The sidecar SRT files (en, zh-Hans) are generated from the same cue sheet.
  They carry these lines, not a separate translation.
- **Status.** The 25 kept English lines are fixed and checked against [FACTS.md](FACTS.md).
  The 11 new lines and the new tags, plates and labels were checked against the article and
  the prototype at `8c32a9d`, and the three stamps repeat the checked numbers of C20, C21 and
  C23; they go to the user in both languages at the copy gate. The kept
  zh strings were signed off on 2026-11-08 and the new ones on 2026-11-09 ("Correct as
  written"; the record is under [zh sign-off](#zh-sign-off)).

**Budget.** 38 text cues (36 narration lines, the title card and the end card), plus 18 more:
the credit subline, eight tags (built, gate, cache, jobs, reply cap, chart, load, proposed),
the stress plate, the lane names with the legend, the token header, the test sheet's three
hero stamps, the classic-idea labels, the key on the summary map and the end-card key.
English: 394 words (347 narration, 11 title and credit, 36 end card). Chinese: 561 Han (499
narration, 17 title and credit, 45 end card). The new lines bring 119 of the words and 178 of
the Han; the tags, plate, chart text, stamps, key, labels and trait plates add 99 words and
148 Han more (the stamps 3 words and no Han). Narration windows cover 168.3 s of the
206.7 s before the end card (81.5%; the 2:56 cut covered 82.4%). Most text-free stretches
are under 1.4 s, short of a bar of picture-only time per mechanism; the animatic decides
whether N11 goes to buy more (it is the first line to cut).

## en

### Narration and on-screen text
| Cue | Beat | Frames | Time | Visible | Needs | On screen |
|---|---|---|---|---|---|---|
| C1 | 1 | f20–140 | 0:00.7–0:04.7 | 3.60 s | 3.10 s | Your AI agents work in parallel. You can’t. |
| Title | 1 | f160–380 | 0:05.3–0:12.7 | 6.93 s | 1.97 s | Who Routes the Agents? |
| Credit subline | 1 | f200–380 | 0:06.7–0:12.7 | 5.60 s | 3.50 s | Super-agent, a design by DeepSeek’s Harness team |
| C2 | 2 | f400–530 | 0:13.3–0:17.7 | 3.93 s | 3.57 s | Each session knows one task. You must know them all. |
| C3 | 2 | f530–660 | 0:17.7–0:22.0 | 3.93 s | 3.70 s | In the authors’ experience, you can follow about 3–5. |
| N1 | 2 | f660–810 | 0:22.0–0:27.0 | 4.60 s | 3.97 s | You switch, prompt each run, wait, and keep it all running. |
| C4 | 2 | f830–950 | 0:27.7–0:31.7 | 3.60 s | 2.77 s | You’ve quietly become their router. |
| C5 | 3 | f980–1130 | 0:32.7–0:37.7 | 4.60 s | 4.03 s | All in one session: it remembers, but is serial and muddled. |
| C6 | 3 | f1130–1280 | 0:37.7–0:42.7 | 4.60 s | 4.03 s | One per event: fast, but disconnected, and all reply to you. |
| C7 | 3 | f1280–1390 | 0:42.7–0:46.3 | 3.27 s | 2.83 s | Continuity or speed: must we pick one? |
| C8 | 4 | f1440–1560 | 0:48.0–0:52.0 | 3.60 s | 2.90 s | Super-agent keeps both, on two levels. |
| C9 | 4 | f1560–1690 | 0:52.0–0:56.3 | 3.93 s | 3.57 s | Above: one long-lived Router hears every channel. |
| C10 | 4 | f1690–1820 | 0:56.3–1:00.7 | 3.93 s | 3.63 s | It hands each task over whole and never does the work. |
| N2 | 4 | f1820–1970 | 1:00.7–1:05.7 | 4.60 s | 4.10 s | Why? Every task passes here; it must never be the bottleneck. |
| C11 | 4 | f1980–2130 | 1:06.0–1:11.0 | 4.60 s | 3.83 s | Below: each task gets its own Worker, context and tools. |
| Built tag | 4 | f2000–2130 | 1:06.7–1:11.0 | 3.93 s | 3.57 s | two levels: built in the public research prototype |
| C12 | 4 | f2130–2260 | 1:11.0–1:15.3 | 3.93 s | 3.37 s | Workers report up. Only the Router talks to you. |
| N3 | 5 | f2320–2460 | 1:17.3–1:22.0 | 4.27 s | 3.70 s | It listens for events, so no one has to prompt each run. |
| Gate tag | 5 | f2320–2630 | 1:17.3–1:27.7 | 9.93 s | 3.17 s | prototype: proactive pickup off by default |
| C14 | 5 | f2470–2630 | 1:22.3–1:27.7 | 4.93 s | 3.90 s | By design: rules drop most noise; a model judges the rest. |
| C15 | 6 | f2720–2870 | 1:30.7–1:35.7 | 4.60 s | 3.70 s | Can one Router keep up? Waiting events go in together. |
| N4 | 6 | f2870–3020 | 1:35.7–1:40.7 | 4.60 s | 4.03 s | Long input, short output: merging events adds little time. |
| Stress plate | 6 | f2880–3040 | 1:36.0–1:41.3 | 4.93 s | 3.63 s | stress test · mock Workers / ~1 → ~40 /min / 6.4 s → 1.6 s avg |
| N5 | 6 | f3060–3210 | 1:42.0–1:47.0 | 4.60 s | 3.97 s | Context is a cache: a summary in view, a pointer to the rest. |
| Cache tag | 6 | f3080–3400 | 1:42.7–1:53.3 | 10.27 s | 2.97 s | prototype: summaries and read pointers |
| N6 | 6 | f3250–3400 | 1:48.3–1:53.3 | 4.60 s | 3.90 s | Asked in another channel? It follows IDs back, hop by hop. |
| C17 | 7 | f3440–3560 | 1:54.7–1:58.7 | 3.60 s | 3.43 s | Follow-ups in a Thread go straight to its Worker. |
| C18 | 7 | f3560–3690 | 1:58.7–2:03.0 | 3.93 s | 3.63 s | Not faster tasks: about 23% fewer Router decisions. |
| N7 | 7 | f3690–3840 | 2:03.0–2:08.0 | 4.60 s | 3.90 s | Jobs run in the background; new input never waits on them. |
| Jobs tag | 7 | f3720–3820 | 2:04.0–2:07.3 | 2.93 s | 2.50 s | prototype: background after 5 s |
| Reply-cap tag | 7 | f3820–3920 | 2:07.3–2:10.7 | 2.93 s | 2.10 s | chat replies: ≤ 100 words |
| Chart tag | 8 | f4000–4560 | 2:13.3–2:32.0 | 18.27 s | 3.30 s | synthetic test · re-plotted · indicative only |
| Load tag | 8 | f4000–4560 | 2:13.3–2:32.0 | 18.27 s | 3.03 s | per run: ~300 messages · ~20 work requests |
| C20 | 8 | f4000–4140 | 2:13.3–2:18.0 | 4.27 s | 3.77 s | Slowest tasks: about half the time of a single session. |
| Lanes and legend | 8 | f4000–4560 | 2:13.3–2:32.0 | 18.27 s | 4.57 s | one session / one session, told to delegate / two levels · typical · slowest |
| Half stamp | 8 | f4040–4560 | 2:14.7–2:32.0 | 16.93 s | 1.90 s | ~½ |
| C21 | 8 | f4140–4280 | 2:18.0–2:22.7 | 4.27 s | 4.10 s | Typical tasks: only ~10% faster than the stronger baseline. |
| Ten-percent stamp | 8 | f4160–4560 | 2:18.7–2:32.0 | 12.93 s | 1.90 s | ~10% |
| C22 | 8 | f4280–4410 | 2:22.7–2:27.0 | 3.93 s | 3.63 s | Left to choose, the single session never delegated. |
| C23 | 8 | f4410–4560 | 2:27.0–2:32.0 | 4.60 s | 4.03 s | Two levels make delegation structural, at 2–4× the tokens. |
| Token header | 8 | f4420–4560 | 2:27.3–2:32.0 | 4.27 s | 2.17 s | cache-read tokens per run |
| Token stamp | 8 | f4440–4560 | 2:28.0–2:32.0 | 3.60 s | 1.90 s | 2–4× |
| C24 | 9 | f4580–4720 | 2:32.7–2:37.3 | 4.27 s | 4.03 s | Proposed: a cloud loop that works while your laptop sleeps. |
| Proposed tag | 9 | f4600–4960 | 2:33.3–2:45.3 | 11.60 s | 2.83 s | proposed · not in the public prototype |
| N8 | 9 | f4770–4900 | 2:39.0–2:43.3 | 3.93 s | 3.70 s | A watchdog checks progress, not just that it’s alive. |
| C25 | 10 | f4960–5120 | 2:45.3–2:50.7 | 4.93 s | 4.23 s | Open risk: a hijacked loop could reach all connected machines. |
| N9 | 10 | f5120–5260 | 2:50.7–2:55.3 | 4.27 s | 4.10 s | Shard the Router and continuity trades against speed again. |
| N10 | 10 | f5270–5440 | 2:55.7–3:01.3 | 5.27 s | 3.77 s | Many tasks still need you midway: how to step in is open. |
| N11 | 11 | f5570–5720 | 3:05.7–3:10.7 | 4.60 s | 3.83 s | None of this is new theory: it is classic systems design. |
| Classic ideas | 11 | f5580–5870 | 3:06.0–3:15.7 | 9.27 s | 5.10 s | Fast / Slow Path · batching · cache · full-duplex · compute–state split · control loop |
| Map key | 11 | f5590–6010 | 3:06.3–3:20.3 | 13.60 s | 3.17 s | solid: built · dashed: proposed · sketch: open |
| C26 | 11 | f5720–5870 | 3:10.7–3:15.7 | 4.60 s | 4.03 s | As models need less help, your attention becomes the limit. |
| C27 | 11 | f5870–6000 | 3:15.7–3:20.0 | 3.93 s | 3.43 s | So people move up: to decisions, and to sign-off. |
| C28 | 12 | f6010–6160 | 3:20.3–3:25.3 | 4.60 s | 3.97 s | Your agents work in parallel. By design, you don’t have to. |
| End card | 13 | f6200–6700 | 3:26.7–3:43.3 | 16.27 s | 15.70 s | see below |
| Line-style key | 13 | f6240–6700 | 3:28.0–3:43.3 | 14.93 s | 3.17 s | solid: built · dashed: proposed · sketch: open |

Text-free stretches, 22.7 s in all: 0:00.0–0:00.7, 0:04.7–0:05.3, 0:12.7–0:13.3,
0:27.0–0:27.7, 0:31.7–0:32.7 (the beat of silence after the hub), 0:46.3–0:48.0 (the breath
and the turn's downbeat), 1:05.7–1:06.0, 1:15.3–1:17.3 (the three-beat rest: the system runs
on the beat), 1:27.7–1:30.7 (the filter at work), 1:41.3–1:42.0, 1:53.3–1:54.7, 2:10.7–2:13.3
(the camera's bar-50 move to the test sheet), 2:32.0–2:32.7, 2:55.3–2:55.7, 3:01.3–3:05.7 (the stamp and the sign-off rest, the route traced
at 0.5×), 3:25.3–3:26.7 (the dissolve) and 3:43.3–3:44.0 (the bare desk).

### Labels and plates
Drawn once in the world, 40 px on a hairline leader, and still once they have landed
(TREATMENT.md, revision 2):
- **Router**, from the turn (C9), beside the Register, the raised deck.
- **Worker**, from C11, beside the request's bay.
- **you · 你**, beside your desk.
- **The four trait plates** (the article's trait words, blocks 13–16), one EN · zh plate each.
  Each docks on the part that took a chore over and stays:

  | Plate | Docks | The chore handed over | Material |
  |---|---|---|---|
  | Continuous · 连续 | f1640, under C9 | remember and switch: your notes loop becomes the Register's tape | enamel |
  | Proactive · 主动 | f2340, under N3 and the gate tag | prompt each run: the starter key lifts into the intake | enamel |
  | Productive · 高效 | f3720, under N7 | wait: the sand-glass moves onto the job rail | enamel |
  | Persistent · 持久 | f4620, under C24 | keep it running: the lid strut moves onto the vellum loop | vellum (proposed) |

- **The classic-idea labels** (f5580–5870): six labels settle one per beat on their parts of
  the 0.5× summary map under N11 and stay through C26. They name only the ideas the article
  names itself (block 138): Fast / Slow Path (block 47), batching (33–35), cache (63),
  full-duplex (79), compute–state split (90) and control loop (101). Fast / Slow Path reads
  the same in both languages, so that label is drawn once.
- **The test sheet's hero stamps** (`stampHalf`, `stampTen`, `stampTokens`): not 40 px labels
  but hero numbers, 160–220 px, stamped with a 3 f ink spread beside the line they prove and
  drawn as canvas textures (TREATMENT.md, Type). They stay on the sheet until it slides away
  at f4560. Each reads the same in both languages and is drawn once:

  | Stamp | Frames | Beside | What it rounds (FACTS.md) |
  |---|---|---|---|
  | ~½ | f4040–4560 | C20, the lanes' slowest cuts | p95 15.7/29.5 ≈ 0.53 and 15.7/29.0 ≈ 0.54 |
  | ~10% | f4160–4560 | C21, the bracket between the typical holes | (13.8 − 12.4)/13.8 ≈ 0.10 |
  | 2–4× | f4440–4560 | C23, the token stacks | 23.2/10.8 ≈ 2.1 and 23.2/6.1 ≈ 3.8 |

The pencil "?" marks of beat 10 are drawn glyphs, not text.

### End card
Lower-left, from f6200; the key, each entry beside a sample of its material, is added at f6240.

```
Source: “Exploring Super-agent Design:
Towards a More Autonomous Agent System”
DeepSeek Harness team · author Yujia Qiao
Chinese original 31 Oct 2026 · machine-translated 1 Nov 2026
Charts re-plotted from the authors’ synthetic tests
Not affiliated with DeepSeek

solid: built   dashed: proposed   sketch: open
```

The card holds 16.3 s (17.6 s in the 2:56 cut); with the 0.7 s of bare desk after it, it
covers the film's last 17 s, where a YouTube end screen sits. Read on its own it needs 15.7 s
(15.6 s in zh); with the key, 18.2 s (18.9 s in zh), more than the hold. The key no longer has
to be read here: the same three strings stand on the summary map as its legend (the map key,
13.6 s against 3.2 s, 4.0 s in zh). That settles the 2:56 cut's open question (bring the key in
earlier, or drop a line of the card).

## zh-Hans

### 旁白与屏幕文字
| Cue | Beat | Frames | Time | Visible | Needs | 屏幕文字 |
|---|---|---|---|---|---|---|
| C1 | 1 | f20–140 | 0:00.7–0:04.7 | 3.60 s | 3.28 s | AI 智能体可以并行 你却不能 |
| Title | 1 | f160–380 | 0:05.3–0:12.7 | 6.93 s | 2.32 s | 谁来调度智能体？ |
| Credit subline | 1 | f200–380 | 0:06.7–0:12.7 | 5.60 s | 4.86 s | Super-agent（超级智能体）· DeepSeek Harness 团队的设计 |
| C2 | 2 | f400–530 | 0:13.3–0:17.7 | 3.93 s | 3.83 s | 每个 Session 只懂一件事 你得全记住 |
| C3 | 2 | f530–660 | 0:17.7–0:22.0 | 3.93 s | 3.79 s | 据作者经验 一个人约能跟进 3–5 个 |
| N1 | 2 | f660–810 | 0:22.0–0:27.0 | 4.60 s | 4.48 s | 切换 逐次下指令 等待 还得守着它们别停 |
| C4 | 2 | f830–950 | 0:27.7–0:31.7 | 3.60 s | 2.66 s | 你悄悄成了人肉 Router |
| C5 | 3 | f980–1130 | 0:32.7–0:37.7 | 4.60 s | 4.34 s | 全塞进一个 Session：记得住 却串行又串味 |
| C6 | 3 | f1130–1280 | 0:37.7–0:42.7 | 4.60 s | 4.34 s | 一事一个 Session：快 但互不相通 都来找你 |
| C7 | 3 | f1280–1390 | 0:42.7–0:46.3 | 3.27 s | 3.21 s | 连续性和速度 只能二选一？ |
| C8 | 4 | f1440–1560 | 0:48.0–0:52.0 | 3.60 s | 3.43 s | Super-agent 用双层架构 两者兼得 |
| C9 | 4 | f1560–1690 | 0:52.0–0:56.3 | 3.93 s | 3.83 s | 上层：常驻的 Router 接收各渠道消息 |
| C10 | 4 | f1690–1820 | 0:56.3–1:00.7 | 3.93 s | 3.59 s | 任务整个派出 它从不亲自动手 |
| N2 | 4 | f1820–1970 | 1:00.7–1:05.7 | 4.60 s | 4.54 s | 为什么？任务都经过它 它绝不能成为瓶颈 |
| C11 | 4 | f1980–2130 | 1:06.0–1:11.0 | 4.60 s | 4.28 s | 下层：一事一个 Worker 上下文与工具独立 |
| Built tag | 4 | f2000–2130 | 1:06.7–1:11.0 | 3.93 s | 3.66 s | 双层架构：公开研究原型已实现 |
| C12 | 4 | f2130–2260 | 1:11.0–1:15.3 | 3.93 s | 3.72 s | Worker 向上汇报 只有 Router 和你说话 |
| N3 | 5 | f2320–2460 | 1:17.3–1:22.0 | 4.27 s | 4.03 s | 它监听事件 不必再由人逐次下指令 |
| Gate tag | 5 | f2320–2630 | 1:17.3–1:27.7 | 9.93 s | 2.99 s | 原型：主动接单默认关闭 |
| C14 | 5 | f2470–2630 | 1:22.3–1:27.7 | 4.93 s | 4.77 s | 按设计：规则滤掉大半噪声 余下由模型判断 |
| C15 | 6 | f2720–2870 | 1:30.7–1:35.7 | 4.60 s | 4.28 s | Router 忙得过来吗？排队的事件合并处理 |
| N4 | 6 | f2870–3020 | 1:35.7–1:40.7 | 4.60 s | 4.54 s | 输入长 输出短：合并处理只多花一点时间 |
| Stress plate | 6 | f2880–3040 | 1:36.0–1:41.3 | 4.93 s | 3.52 s | 压测 · 模拟 Worker / ~1 → ~40 /min / 6.4 s → 1.6 s avg |
| N5 | 6 | f3060–3210 | 1:42.0–1:47.0 | 4.60 s | 4.54 s | 上下文是缓存：摘要放进来 其余只留指针 |
| Cache tag | 6 | f3080–3400 | 1:42.7–1:53.3 | 10.27 s | 2.77 s | 原型：摘要加读取指针 |
| N6 | 6 | f3250–3400 | 1:48.3–1:53.3 | 4.60 s | 4.46 s | 换个渠道问起？它顺着 ID 一跳一跳找回来 |
| C17 | 7 | f3440–3560 | 1:54.7–1:58.7 | 3.60 s | 3.50 s | 同一 Thread 的后续 直通它的 Worker |
| C18 | 7 | f3560–3690 | 1:58.7–2:03.0 | 3.93 s | 3.74 s | 任务不会更快 但 Router 决策约少 23% |
| N7 | 7 | f3690–3840 | 2:03.0–2:08.0 | 4.60 s | 4.48 s | 耗时操作转入后台 新输入不必等它跑完 |
| Jobs tag | 7 | f3720–3820 | 2:04.0–2:07.3 | 2.93 s | 2.61 s | 原型：5 秒后转入后台 |
| Reply-cap tag | 7 | f3820–3920 | 2:07.3–2:10.7 | 2.93 s | 2.14 s | 聊天回复：≤ 100 词 |
| Chart tag | 8 | f4000–4560 | 2:13.3–2:32.0 | 18.27 s | 3.50 s | 模拟实验 · 本片重绘 · 仅供参考 |
| Load tag | 8 | f4000–4560 | 2:13.3–2:32.0 | 18.27 s | 4.28 s | 每次运行：约 300 条消息 · 约 20 个工作请求 |
| C20 | 8 | f4000–4140 | 2:13.3–2:18.0 | 4.27 s | 4.12 s | 最慢的任务：耗时约为单 Session 的一半 |
| Lanes and legend | 8 | f4000–4560 | 2:13.3–2:32.0 | 18.27 s | 5.19 s | 单 Session / 被要求委派的单 Session / 双层架构 · 中位 · 最慢 |
| Half stamp | 8 | f4040–4560 | 2:14.7–2:32.0 | 16.93 s | 1.90 s | ~½ |
| C21 | 8 | f4140–4280 | 2:18.0–2:22.7 | 4.27 s | 3.63 s | 中位数：比更强的基线只快约 10% |
| Ten-percent stamp | 8 | f4160–4560 | 2:18.7–2:32.0 | 12.93 s | 1.90 s | ~10% |
| C22 | 8 | f4280–4410 | 2:22.7–2:27.0 | 3.93 s | 3.39 s | 自行决定时 单 Session 从未委派 |
| C23 | 8 | f4410–4560 | 2:27.0–2:32.0 | 4.60 s | 4.34 s | 双层架构把委派写进结构 代价 2–4 倍 token |
| Token header | 8 | f4420–4560 | 2:27.3–2:32.0 | 4.27 s | 3.03 s | 每次运行的缓存读取 token |
| Token stamp | 8 | f4440–4560 | 2:28.0–2:32.0 | 3.60 s | 1.90 s | 2–4× |
| C24 | 9 | f4580–4720 | 2:32.7–2:37.3 | 4.27 s | 4.10 s | 设想：云端常驻 你合上电脑它也不停 |
| Proposed tag | 9 | f4600–4960 | 2:33.3–2:45.3 | 11.60 s | 2.77 s | 设想 · 公开原型未实现 |
| N8 | 9 | f4770–4900 | 2:39.0–2:43.3 | 3.93 s | 3.81 s | 看门狗盯的是进展 不只是还活着 |
| C25 | 10 | f4960–5120 | 2:45.3–2:50.7 | 4.93 s | 4.77 s | 未解风险：循环被劫持 相连机器都可能失守 |
| N9 | 10 | f5120–5260 | 2:50.7–2:55.3 | 4.27 s | 3.99 s | Router 一分片 连续性和速度又要权衡 |
| N10 | 10 | f5270–5440 | 2:55.7–3:01.3 | 5.27 s | 4.92 s | 许多任务仍需人中途介入 怎么介入尚未解决 |
| N11 | 11 | f5570–5720 | 3:05.7–3:10.7 | 4.60 s | 4.26 s | 这些不是新理论 而是经典的系统设计 |
| Classic ideas | 11 | f5580–5870 | 3:06.0–3:15.7 | 9.27 s | 5.12 s | Fast / Slow Path · 批处理 · 缓存 · 全双工 · 存算分离 · 控制回路 |
| Map key | 11 | f5590–6010 | 3:06.3–3:20.3 | 13.60 s | 4.01 s | 实线：已实现 · 虚线：设想 · 手绘线：未解 |
| C26 | 11 | f5720–5870 | 3:10.7–3:15.7 | 4.60 s | 4.48 s | 单任务越来越不用人盯 瓶颈成了注意力 |
| C27 | 11 | f5870–6000 | 3:15.7–3:20.0 | 3.93 s | 3.88 s | 于是人的角色上移：做决策 做验收 |
| C28 | 12 | f6010–6160 | 3:20.3–3:25.3 | 4.60 s | 4.26 s | 智能体照样并行 按设计 你不必再分身 |
| End card | 13 | f6200–6700 | 3:26.7–3:43.3 | 16.27 s | 15.63 s | 见下 |
| Line-style key | 13 | f6240–6700 | 3:28.0–3:43.3 | 14.93 s | 4.01 s | 实线：已实现 · 虚线：设想 · 手绘线：未解 |

The plate's rows, the numbers, the three hero stamps (~½, ~10%, 2–4×) and the labels
"Router", "Worker" and "Fast / Slow Path" read the same in both languages and are drawn once.
"you · 你" and the four trait plates are bilingual, one string each.

### 片尾卡
```
原文：《Super-agent 设计探索：迈向更自主的 Agent 系统》
DeepSeek Harness 团队 · 作者 Yujia Qiao
中文原文 2026-10-31 · 英文机译 2026-11-01
图表据作者模拟实验重绘
独立解读 与 DeepSeek 无关联

实线：已实现   虚线：设想   手绘线：未解
```

## Changes since the treatment
The treatment's copy (2026-11-08), changed in two rounds. The first round was re-checked
against FACTS.md and the holds, the second against the article, the prototype at `8c32a9d`
and the holds.

### 2026-11-08: the 2:56 cut
The frames in this list are the 2:56 cut's; the 3:45 cut moved every window (below).
- **C18** reads "about 23% fewer" (the treatment's correction); zh 决策约少 23% (word order).
- **C22** "Unprompted" became **"Left to choose"** / 自行决定时. The baseline had a neutral
  prompt that allowed a subagent "when appropriate" (block 110), so it was not unprompted. The
  line got its hold by moving C19–C21 20 frames earlier inside beat 6 (C19 now starts f2890,
  10 frames after the beat-6 downbeat).
- **The built tag** now ends where C12 begins (f1680–1810, was f1680–1940). It sits only
  under C11, which is built, and never under "Only the Router talks to you", which is the
  design (Workers in the prototype also reply on GitHub). The Router's reply line in C12 stays
  solid: the prototype's Router does deliver IM answers and results.
- **The stress plate** reads "~1 → ~40 /min": the article says about 1 to about 40.
- **双层架构 for the architecture** (C8, the built tag, the third lane, C23), as IT之家 and
  量子位 write it. 两级 is the coverage's word for the two-stage filter (两级过滤), which no
  line names, so 两级 is no longer used.
- **The key's third entry** is "sketch: open" / 手绘线：未解. 手绘线 is a line type like 实线
  and 虚线; the treatment's 草图 names a drawing, not a line.
- **The end card** says "machine-translated" / 英文机译: the article's first block says the
  English is a machine translation of the Chinese original.
- **zh copy edits for natural reading**, each within its hold: C1 可以并行 (智能体能并行 read
  能 twice); C3 一个人约能跟进; C7 连续性和速度; C8 用双层架构 两者兼得; C9 接收各渠道消息
  (a Router receives messages, not channels); C10 任务整个派出; C14 余下由模型判断 (模型判其余
  was clipped); C20 单 Session 的一半; C21 比更强的基线 (比较强的基线 can be read as 比较 +
  强的基线); the lane 被要求委派的单 Session; the token header 每次运行的 (每轮 can mean one
  turn of a conversation); the gate tag 原型： to mirror the English.
- **Windows** moved inside their bars: C1 ends f140 (was f130) for the zh hold; C14 starts on
  the beat-5 downbeat, f2160 (was f2170); C19–C22 as above; the gate tag f2210–2320, the plate
  f2480–2640 (bar 32 to bar 34), the chart tag f2890–3600, the lanes f3030–3600, the token
  header f3460–3600 and the proposed tag f3640–3920 were placed here (the treatment gave no
  frames). The tags stay lower case, as the other tags are.

### 2026-11-09: the 3:45 cut
- **Length and spine.** The user chose "~3:45, full depth (Recommended)": 84 bars, 13 beats,
  36 narration lines (TREATMENT.md, revision 2). The spine is the human router's four chores,
  handed over one by one: remember and switch (Continuous, at the turn), prompt each run
  (Proactive, by design), wait (Productive) and keep it running (Persistent, proposed). The
  chores that cannot be handed over yet are the open problems of beat 10. The through-line is
  continuity against speed: C7 asks it and N9 brings it back. The 25 kept lines are verbatim;
  only their windows moved.
- **Three cuts.** **C13** overlapped C12; its block-27 line goes to the description. **C16**:
  the stress plate keeps the endpoints and N4 now gives the reason, so the plate moved beside
  N4. **C19**: its numbers became the load tag on the test sheet.
- **Eleven new lines**, n1–n11 in `WORDS`:

  | Line | What it carries (blocks) | Status on screen |
  |---|---|---|
  | N1 | The four chores, in the order they leave you (6, 7, 44) | Our framing; no tag |
  | N2 | Why the Router never does the work (31) | Design intent |
  | N3 | Listening for events (15, 44) | Built for GitHub; unaddressed pickup stays under the gate tag |
  | N4 | Why merging events is cheap: long input, short output (33, 35) | Built; the stress plate (118–120) is its evidence |
  | N5 | Context as a cache (62–63, 65–67), drawn at the Router | Prototype form: the cache tag |
  | N6 | Chain of Recall (68, 70–71) | Prototype form: the cache tag |
  | N7 | Background jobs: new input never waits (79, 81–83) | Built through background jobs: the jobs tag |
  | N8 | The Watchdog's progress check (101–103) | Proposed: under the proposed tag |
  | N9 | Sharding and long-term memory (37, 124–125) | Open, in sketch line |
  | N10 | Stepping in midway (128) | Open; it qualifies C27–C28 |
  | N11 | Classic systems design (138) | The article's own claim; the six labels |

- **Four new tags.**
  - **tag-cache**, "prototype: summaries and read pointers", under N5 and N6. The prototype's
    cards carry short summaries with `read:` pointers, and every ID a page shows can be read;
    it has no dedicated multi-hop recall.
  - **tag-jobs**, "prototype: background after 5 s", under N7. The prototype's presets move a
    foreground command to a background job after 5 s. Block 83 says the loop is not on by
    default in DeepSeek Harness, so no string says whether the loop is on or off by default.
  - **tag-100**, "chat replies: ≤ 100 words", the stop tab on the chat reply (block 87; the
    prototype's 100-word limit). It protects your attention; no line files it under waiting.
  - **tag-load**, "per run: ~300 messages · ~20 work requests", beside the chart tag (block
    108): C19's numbers.
- **The chart and load tags wipe in with C20** (f4000–4560), once the camera has arrived at
  the test sheet; the bar-50 move to it (f3920–4000) carries no text.
- **Three hero stamps** on the test sheet, `WORDS` entries so that the reading checks see
  them: "~½" beside C20 (f4040–4560), "~10%" beside C21 (f4160–4560) and "2–4×" beside C23
  (f4440–4560), the same strings in both languages (see [Labels and plates](#labels-and-plates)).
- **The trait plates and the classic-idea labels** (see [Labels and plates](#labels-and-plates)):
  the four trait words, with their zh as IT之家 reports them, and six labels for the ideas the
  article names (blocks 47, 33–35, 63, 79, 90, 101). The first label reads "Fast / Slow Path"
  in both languages, as the reprint writes it.
- **N2's wording stays true to pass-through.** The draft read "All traffic meets here" /
  一切在此交汇. But follow-ups in a Thread go straight to their Worker without a Router decision
  (block 57), even though the Router still sees them (block 58) and the prototype sends it a
  notice. So the line says what holds, "Every task passes here" / 任务都经过它. For the same
  reason C17's picture draws a faint notice row on the Register's tape, and no line says the
  Router does not see a follow-up.
- **The gate tag now also covers N3** (f2320–2630, from N3's first frame to the end of C14; it
  was under C14 only), so N3 and the Proactive plate (f2340) are never on screen without it.
  The built tag still ends where C12 begins (f2000–2130).
- **C27 is shortened to end on bar 76** (f5870–6000), the bookend's downbeat, so it stays
  inside beat 11. It holds with 0.06 s to spare in zh.
- **The proposed tag** covers both C24 and N8 (f4600–4960), and **the key** is read on the
  summary map before the end card (see [End card](#end-card)).
- **C12 stays as signed off.** "Workers report up. Only the Router answers you." is recorded as
  an open option for the user ([zh sign-off](#zh-sign-off)).

## zh sign-off
**Signed off 2026-11-08.** Asked whether every zh-Hans string in this section is correct, the
user, the fluent reader, answered "Correct as written". That covers the 28 narration lines, the
title, the tags, the chart labels, the end card, and the choices below (双层架构, 手绘线, the
Netflix-style punctuation). Any string added or changed after that date needs the same check
again.

**What that sign-off still covers.** The 3:45 cut keeps these signed-off strings unchanged:
the title and credit; 25 narration lines (C1–C12, C14, C15, C17, C18, C20–C28); the built,
gate, chart and proposed tags; the stress plate; the lane names, the legend and the token
header; the end card and the key (now also on the summary map); and the label 你. C13, C16 and
C19 are cut. The questions and the per-string list behind that answer are in git history.

**Signed off 2026-11-09.** The user was asked to check every new zh-Hans string below (N1–N11, the
tags, the trait plates, the idea labels and the stamps) and to choose between keeping C12 and the
alternative wording. Their answers: **"Correct as written"** for every new string, and **"Keep C12
as signed off"**. The questions and checklist are kept as the record of what was asked.

For later changes: The terms are explained in the
glossary below. Every string is in `src/cues.ts`; a changed line has to clear its hold again
(`pnpm exec vitest run videos/super-agent/src/cues.test.ts`), so a longer line may need a
shorter one elsewhere in its beat. Lines marked † have under 0.1 s to spare in zh.

**Questions first**
- [x] **C12, an open option.** C12 stays "Workers report up. Only the Router talks to you." as
  signed off, outside the built tag. The alternative "Workers report up. Only the Router
  answers you." holds for the prototype too: there the host also posts Workers' short
  acknowledgements in the chat thread, but answers, results and questions come only from the
  Router. It fits C12's window (needs 3.37 s of the 3.93 s), but it needs a new zh line and
  this sign-off.
- [x] **逐次下指令** (N1, N3) for "prompt each run": the repeat is meant, the chore and its
  hand-over. 守着它们别停 (N1) is answered by C24's 它也不停.
- [x] **任务都经过它** (N2), chosen over the draft 一切在此交汇 so as not to say that follow-ups
  pass through the Router.
- [x] **只多花一点时间** (N4) for the article's "adds little time".
- [x] **指针** (N5) and **读取指针** (cache tag) for a read pointer; **摘要加读取指针** as a tag.
- [x] **一跳一跳找回来** (N6) for "follows IDs back, hop by hop".
- [x] **耗时操作** (N7) for "jobs", and **转入后台** (N7, jobs tag).
- [x] **看门狗** (N8), as 量子位 writes it, or **Watchdog** in Latin like Router and Worker
  (Watchdog 盯的是进展 不只是还活着 needs 3.68 s of the 3.93 s).
- [x] **一分片** (N9) for "shard"; **介入** (N10) for "step in".
- [x] **≤ 100 词** (reply-cap tag): the limit counts words; does 词 read naturally, or is
  another unit clearer without changing the limit?
- [x] **5 秒后** (jobs tag) written with 秒, where the stress plate keeps "s".
- [x] **连续 / 主动 / 高效 / 持久** for the traits, as IT之家, 量子位 and the reprint report
  them; the Chinese original was not read.
- [x] **存算分离** for "compute–state split": the reprint's word, which reads as
  compute–storage separation; the reprint's §5 heading is 计算、状态与环境的分离.
- [x] **控制回路** for "control loop" (IT之家 外部控制回路) and **批处理** for "batching".

**Resolved since the drafts**
- **聊天回复** (reply-cap tag) replaces 群聊回复, which narrowed the cap to group chats: the
  article's example is a group chat (block 85), but the cap covers every IM reply (block 87).
  The unit 词 is still the question above.
- **Fast / Slow Path** is now the English label too (it was lower case), so the two languages
  read the same and the label is drawn once. It stays in the list below for the tick.

**Every new string**
- [x] N1 切换 逐次下指令 等待 还得守着它们别停
- [x] N2 为什么？任务都经过它 它绝不能成为瓶颈 †
- [x] N3 它监听事件 不必再由人逐次下指令
- [x] N4 输入长 输出短：合并处理只多花一点时间 †
- [x] N5 上下文是缓存：摘要放进来 其余只留指针 †
- [x] N6 换个渠道问起？它顺着 ID 一跳一跳找回来
- [x] N7 耗时操作转入后台 新输入不必等它跑完
- [x] N8 看门狗盯的是进展 不只是还活着
- [x] N9 Router 一分片 连续性和速度又要权衡
- [x] N10 许多任务仍需人中途介入 怎么介入尚未解决
- [x] N11 这些不是新理论 而是经典的系统设计
- [x] tagCache 原型：摘要加读取指针
- [x] tagJobs 原型：5 秒后转入后台
- [x] tag100 聊天回复：≤ 100 词
- [x] tagLoad 每次运行：约 300 条消息 · 约 20 个工作请求
- [x] stampHalf ~½ (the same string in both languages; no translation)
- [x] stampTen ~10% (the same string in both languages; no translation)
- [x] stampTokens 2–4× (the same string in both languages; no translation)
- [x] traitContinuous 连续
- [x] traitProactive 主动
- [x] traitProductive 高效
- [x] traitPersistent 持久
- [x] ideaFastSlow Fast / Slow Path
- [x] ideaBatching 批处理
- [x] ideaCache 缓存
- [x] ideaDuplex 全双工
- [x] ideaSplit 存算分离
- [x] ideaControl 控制回路

## Glossary EN → zh-Hans
Router, Worker, Session, Thread, ID, token and Fast / Slow Path stay in Latin script, as the
Chinese coverage writes them. Status tags as in [FACTS.md](FACTS.md): [V] read at a primary
source, [S] secondary, [U] ours. The full table is in
[references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md).

| EN | zh-Hans | Source |
|---|---|---|
| agent | 智能体 | The prototype's glossary (docs/001-domain.md:79) [V] |
| Super-agent | Super-agent（超级智能体）, glossed once | Latin in the coverage [S]; the gloss is ours [U] |
| two-level architecture | 双层架构 | IT之家, 量子位, the reprint [S] |
| two-stage filtering | 两级过滤 (not used on screen) | IT之家, 量子位 [S] |
| Fast / Slow Path | Fast / Slow Path | The reprint [S] |
| Router (layer) / Worker (layer) | Router / Worker, 上层 / 下层 | IT之家 Router 层, 量子位 上层的Router [S] |
| session | Session | IT之家 活跃 Session [S]; DeepSeek Harness zh docs 会话 [V] |
| route, dispatch | 调度, 派出 | IT之家 and 量子位 调度 [S]; 派出 ours [U] |
| channel | 渠道 | The prototype's glossary (Channel 渠道) [V]; IT之家 [S] |
| context | 上下文 | Ours [U] |
| prompt each run | 逐次下指令 | Ours [U] |
| bottleneck | 瓶颈 | Ours [U] |
| listen for events | 监听事件 | Ours [U] |
| batching; merge events | 批处理; 合并处理 | Ours [U] |
| cache; summary; (read) pointer | 缓存; 摘要; (读取)指针 | Ours [U] |
| hop by hop | 一跳一跳 | Ours [U] |
| pass-through | 直通 | IT之家 事件直通机制, 量子位 订阅与直通机制 [S] |
| decision | 决策 | 量子位 Router的决策次数 [S] |
| full-duplex | 全双工 | The reprint 全双工交互 [S] |
| job, run in the background | 耗时操作, 转入后台 | Ours [U] |
| chat reply | 聊天回复 | Ours [U] |
| stress test, mock Worker | 压测, 模拟 Worker | Ours [U] |
| synthetic test | 模拟实验 | Ours [U] |
| message, work request | 消息, 工作请求 | Ours [U] |
| median / p95 | 中位数, 中位 / 最慢 | 量子位 中位数 [S]; 最慢 ours [U] |
| baseline, delegate | 基线, 委派 | Ours [U] |
| cache-read tokens | 缓存读取 token | 量子位 读取缓存Token [S] |
| research prototype | 研究原型 | The README "research prototype" [V]; IT之家 原型实现 [S] |
| proactive pickup | 主动接单 | Ours [U]; 主动 is IT之家's trait [S] |
| Continuous / Proactive / Productive / Persistent | 连续 / 主动 / 高效 / 持久 | IT之家, 量子位, the reprint [S] |
| proposed | 设想 | Ours [U] |
| watchdog | 看门狗 | 量子位 看门狗; IT之家 外部控制回路 [S] |
| progress | 进展 | Ours [U] |
| compute–state split | 存算分离 | The reprint 存算分离 [S] |
| control loop | 控制回路 | IT之家 外部控制回路 [S] |
| shard | 分片 | Ours [U] |
| step in | 介入 | Ours [U] |
| classic systems design | 经典的系统设计 | Ours [U] |
| attention | 注意力 | IT之家 [S] |
| sign-off | 验收 | The reprint 更高层的决策与验收 [S] |
| solid / dashed / sketch line | 实线 / 虚线 / 手绘线 | Standard drawing terms; 手绘线 ours [U] |
