# Script: Who Routes the Agents?

There is no narration voice: the film is text-led ("Text-led, no voice (Recommended)", chosen
by the user on 2026-11-08), so the on-screen lines are the narration. Each line is one English
line over one Simplified Chinese line in the lower-left notes block (EN baseline y 938, zh
y 992, at most 1560 px wide). The tags, the stress plate and the chart sit in the diagram,
beside what they qualify.

- **One source.** Every string and frame below comes from [src/cues.ts](src/cues.ts) (`WORDS`
  and the cue sheet). [src/cues.test.ts](src/cues.test.ts) checks the rules stated here. Change
  the copy there first, then here.
- **Frames.** Frames are film frames at 30 fps (90 bpm, 80 frames a bar), counted after the
  review cut's 15-frame test card. The frames of a cue are its on-screen window: a 6-frame
  left-to-right wipe in at the start and a 6-frame fade out at the end. The line is fully
  visible and unchanged for the window minus 12 frames ("Visible").
- **Holds.** "Needs" is max(1.8 s, reading time + 0.6 s) + 0.1 s for that language. Reading
  time is CJK characters / 4.5 + other non-space characters / 15
  (`readingSeconds` in `@aiv/core`). Every cue clears it in both languages; the smallest
  margins beyond it are 0.06 s (C7 in zh, C19 in zh) and 0.10 s (C2, C9, C17 and the gate tag).
- **Lines.** Every English line is at most 62 characters and every zh line at most 34 CJK
  widths. The zh lines follow the Netflix zh-Hans style
  ([references/subtitles.md](../../references/subtitles.md)): no commas or full stops, a
  space for a pause, full-width ： and ？.
- **Captions.** The sidecar SRT files (en, zh-Hans) are generated from the same cue sheet in
  session 4. They carry these lines, not a separate translation.
- **Status.** The English copy is fixed and checked against [FACTS.md](FACTS.md). **Every
  zh-Hans string is a draft until the user signs it off** (the checklist under
  [zh sign-off](#zh-sign-off)).

**Budget.** 30 text cues (28 narration lines, the title card and the end card), plus 9 more:
the credit subline, four tags, the stress plate, the lane names with the legend, the token
header and the end-card key. English: 302 words (255 narration, 11 title and credit, 36 end card).
Chinese: 426 Han (364 narration, 17 title and credit, 45 end card). Narration windows cover
129.7 s of the 157.3 s before the end card.

## en

### Narration and on-screen text
| Cue | Beat | Frames | Time | Visible | Needs | On screen |
|---|---|---|---|---|---|---|
| C1 | 1 | f20–140 | 0:00.7–0:04.7 | 3.60 s | 3.10 s | Your AI agents work in parallel. You can’t. |
| Title | 1 | f160–380 | 0:05.3–0:12.7 | 6.93 s | 1.97 s | Who Routes the Agents? |
| Credit subline | 1 | f200–380 | 0:06.7–0:12.7 | 5.60 s | 3.50 s | Super-agent, a design by DeepSeek’s Harness team |
| C2 | 2 | f400–530 | 0:13.3–0:17.7 | 3.93 s | 3.57 s | Each session knows one task. You must know them all. |
| C3 | 2 | f530–660 | 0:17.7–0:22.0 | 3.93 s | 3.70 s | In the authors’ experience, you can follow about 3–5. |
| C4 | 2 | f660–780 | 0:22.0–0:26.0 | 3.60 s | 2.77 s | You’ve quietly become their router. |
| C5 | 3 | f820–970 | 0:27.3–0:32.3 | 4.60 s | 4.03 s | All in one session: it remembers, but is serial and muddled. |
| C6 | 3 | f970–1120 | 0:32.3–0:37.3 | 4.60 s | 4.03 s | One per event: fast, but disconnected, and all reply to you. |
| C7 | 3 | f1120–1230 | 0:37.3–0:41.0 | 3.27 s | 2.83 s | Continuity or speed: must we pick one? |
| C8 | 4 | f1280–1400 | 0:42.7–0:46.7 | 3.60 s | 2.90 s | Super-agent keeps both, on two levels. |
| C9 | 4 | f1400–1530 | 0:46.7–0:51.0 | 3.93 s | 3.57 s | Above: one long-lived Router hears every channel. |
| C10 | 4 | f1530–1660 | 0:51.0–0:55.3 | 3.93 s | 3.63 s | It hands each task over whole and never does the work. |
| C11 | 4 | f1660–1810 | 0:55.3–1:00.3 | 4.60 s | 3.83 s | Below: each task gets its own Worker, context and tools. |
| Built tag | 4 | f1680–1810 | 0:56.0–1:00.3 | 3.93 s | 3.57 s | two levels: built in the public research prototype |
| C12 | 4 | f1810–1940 | 1:00.3–1:04.7 | 3.93 s | 3.37 s | Workers report up. Only the Router talks to you. |
| C13 | 4 | f1940–2080 | 1:04.7–1:09.3 | 4.27 s | 4.10 s | Sessions become an implementation detail, not your burden. |
| C14 | 5 | f2160–2320 | 1:12.0–1:17.3 | 4.93 s | 3.90 s | By design: rules drop most noise; a model judges the rest. |
| Gate tag | 5 | f2210–2320 | 1:13.7–1:17.3 | 3.27 s | 3.17 s | prototype: proactive pickup off by default |
| C15 | 5 | f2320–2470 | 1:17.3–1:22.3 | 4.60 s | 3.70 s | Can one Router keep up? Waiting events go in together. |
| C16 | 5 | f2470–2630 | 1:22.3–1:27.7 | 4.93 s | 4.03 s | Stress test: ~40× the load, less average time per decision. |
| Stress plate | 5 | f2480–2640 | 1:22.7–1:28.0 | 4.93 s | 3.63 s | stress test · mock Workers / ~1 → ~40 /min / 6.4 s → 1.6 s avg |
| C17 | 5 | f2630–2750 | 1:27.7–1:31.7 | 3.60 s | 3.43 s | Follow-ups in a Thread go straight to its Worker. |
| C18 | 5 | f2750–2880 | 1:31.7–1:36.0 | 3.93 s | 3.63 s | Not faster tasks: about 23% fewer Router decisions. |
| Chart tag | 6 | f2890–3600 | 1:36.3–2:00.0 | 23.27 s | 3.30 s | synthetic test · re-plotted · indicative only |
| C19 | 6 | f2890–3030 | 1:36.3–1:41.0 | 4.27 s | 4.03 s | Their test is synthetic: ~300 messages, ~20 work requests. |
| C20 | 6 | f3030–3170 | 1:41.0–1:45.7 | 4.27 s | 3.77 s | Slowest tasks: about half the time of a single session. |
| Lanes and legend | 6 | f3030–3600 | 1:41.0–2:00.0 | 18.60 s | 4.57 s | one session / one session, told to delegate / two levels · ● typical ┃ slowest |
| C21 | 6 | f3170–3310 | 1:45.7–1:50.3 | 4.27 s | 4.10 s | Typical tasks: only ~10% faster than the stronger baseline. |
| C22 | 6 | f3310–3450 | 1:50.3–1:55.0 | 4.27 s | 3.63 s | Left to choose, the single session never delegated. |
| C23 | 6 | f3450–3600 | 1:55.0–2:00.0 | 4.60 s | 4.03 s | Two levels make delegation structural, at 2–4× the tokens. |
| Token header | 6 | f3460–3600 | 1:55.3–2:00.0 | 4.27 s | 2.17 s | cache-read tokens per run |
| C24 | 7 | f3620–3760 | 2:00.7–2:05.3 | 4.27 s | 4.03 s | Proposed: a cloud loop that works while your laptop sleeps. |
| Proposed tag | 7 | f3640–3920 | 2:01.3–2:10.7 | 8.93 s | 2.83 s | proposed · not in the public prototype |
| C25 | 7 | f3760–3920 | 2:05.3–2:10.7 | 4.93 s | 4.23 s | Open risk: a hijacked loop could reach all connected machines. |
| C26 | 8 | f4160–4310 | 2:18.7–2:23.7 | 4.60 s | 4.03 s | As models need less help, your attention becomes the limit. |
| C27 | 8 | f4310–4450 | 2:23.7–2:28.3 | 4.27 s | 3.43 s | So people move up: to decisions, and to sign-off. |
| C28 | 9 | f4520–4680 | 2:30.7–2:36.0 | 4.93 s | 3.97 s | Your agents work in parallel. By design, you don’t have to. |
| End card | 9 | f4720–5260 | 2:37.3–2:55.3 | 17.60 s | 15.70 s | see below |
| Line-style key | 9 | f4760–5260 | 2:38.7–2:55.3 | 16.27 s | 3.17 s | solid: built · dashed: proposed · sketch: open |

Text-free stretches: 0:00.0–0:00.7, 0:04.7–0:05.3, 0:12.7–0:13.3, 0:26.0–0:27.3,
0:41.0–0:42.7 (the breath and the turn's downbeat), 1:09.3–1:12.0 (the bar-27 rest),
1:36.0–1:36.3 (the glide south), 2:00.0–2:00.7 (the rise back to the map), 2:10.7–2:18.7
(the sign-off and the bars 51–52 rest), 2:28.3–2:30.7, 2:36.0–2:37.3 (the dissolve) and
2:55.3–2:56.0 (the bare ground).

### Labels
Persistent, drawn once in the diagram (40 px, with a ground-colour knockout):
- **Router**, from the turn (C9), beside the interchange ring.
- **Worker**, from C11, beside the request's platform.
- **you · 你**, beside your ring.

The sketch "?" of beat 7 is a drawn glyph, not text.

### End card
Lower-left in the cartouche, from f4720; the key and its swatches are added at f4760.

```
Source: “Exploring Super-agent Design:
Towards a More Autonomous Agent System”
DeepSeek Harness team · author Yujia Qiao
Chinese original 31 Oct 2026 · machine-translated 1 Nov 2026
Charts re-plotted from the authors’ synthetic tests
Not affiliated with DeepSeek

━━ solid: built   ╍╍ dashed: proposed   ∼∼ sketch: open
```

The card holds 17.6 s, which also covers YouTube's end-screen window. Read on its own it needs
15.7 s (15.6 s in zh); the card and the key together need about 18.2 s (18.9 s in zh), more
than the hold, so a viewer who reads every line does not finish the key. Whether the key comes
in earlier, or a line of the card goes, is still open.

## zh-Hans

### 旁白与屏幕文字
| Cue | Beat | Frames | Time | Visible | Needs | 屏幕文字 |
|---|---|---|---|---|---|---|
| C1 | 1 | f20–140 | 0:00.7–0:04.7 | 3.60 s | 3.28 s | AI 智能体可以并行 你却不能 |
| Title | 1 | f160–380 | 0:05.3–0:12.7 | 6.93 s | 2.32 s | 谁来调度智能体？ |
| Credit subline | 1 | f200–380 | 0:06.7–0:12.7 | 5.60 s | 4.86 s | Super-agent（超级智能体）· DeepSeek Harness 团队的设计 |
| C2 | 2 | f400–530 | 0:13.3–0:17.7 | 3.93 s | 3.83 s | 每个 Session 只懂一件事 你得全记住 |
| C3 | 2 | f530–660 | 0:17.7–0:22.0 | 3.93 s | 3.79 s | 据作者经验 一个人约能跟进 3–5 个 |
| C4 | 2 | f660–780 | 0:22.0–0:26.0 | 3.60 s | 2.66 s | 你悄悄成了人肉 Router |
| C5 | 3 | f820–970 | 0:27.3–0:32.3 | 4.60 s | 4.34 s | 全塞进一个 Session：记得住 却串行又串味 |
| C6 | 3 | f970–1120 | 0:32.3–0:37.3 | 4.60 s | 4.34 s | 一事一个 Session：快 但互不相通 都来找你 |
| C7 | 3 | f1120–1230 | 0:37.3–0:41.0 | 3.27 s | 3.21 s | 连续性和速度 只能二选一？ |
| C8 | 4 | f1280–1400 | 0:42.7–0:46.7 | 3.60 s | 3.43 s | Super-agent 用双层架构 两者兼得 |
| C9 | 4 | f1400–1530 | 0:46.7–0:51.0 | 3.93 s | 3.83 s | 上层：常驻的 Router 接收各渠道消息 |
| C10 | 4 | f1530–1660 | 0:51.0–0:55.3 | 3.93 s | 3.59 s | 任务整个派出 它从不亲自动手 |
| C11 | 4 | f1660–1810 | 0:55.3–1:00.3 | 4.60 s | 4.28 s | 下层：一事一个 Worker 上下文与工具独立 |
| Built tag | 4 | f1680–1810 | 0:56.0–1:00.3 | 3.93 s | 3.66 s | 双层架构：公开研究原型已实现 |
| C12 | 4 | f1810–1940 | 1:00.3–1:04.7 | 3.93 s | 3.72 s | Worker 向上汇报 只有 Router 和你说话 |
| C13 | 4 | f1940–2080 | 1:04.7–1:09.3 | 4.27 s | 4.06 s | Session 成了实现细节 不再是你的负担 |
| C14 | 5 | f2160–2320 | 1:12.0–1:17.3 | 4.93 s | 4.77 s | 按设计：规则滤掉大半噪声 余下由模型判断 |
| Gate tag | 5 | f2210–2320 | 1:13.7–1:17.3 | 3.27 s | 2.99 s | 原型：主动接单默认关闭 |
| C15 | 5 | f2320–2470 | 1:17.3–1:22.3 | 4.60 s | 4.28 s | Router 忙得过来吗？排队的事件合并处理 |
| C16 | 5 | f2470–2630 | 1:22.3–1:27.7 | 4.93 s | 4.46 s | 压测：负载约 40 倍 决策均摊耗时反而更短 |
| Stress plate | 5 | f2480–2640 | 1:22.7–1:28.0 | 4.93 s | 3.52 s | 压测 · 模拟 Worker / ~1 → ~40 /min / 6.4 s → 1.6 s avg |
| C17 | 5 | f2630–2750 | 1:27.7–1:31.7 | 3.60 s | 3.50 s | 同一 Thread 的后续 直通它的 Worker |
| C18 | 5 | f2750–2880 | 1:31.7–1:36.0 | 3.93 s | 3.74 s | 任务不会更快 但 Router 决策约少 23% |
| Chart tag | 6 | f2890–3600 | 1:36.3–2:00.0 | 23.27 s | 3.50 s | 模拟实验 · 本片重绘 · 仅供参考 |
| C19 | 6 | f2890–3030 | 1:36.3–1:41.0 | 4.27 s | 4.21 s | 模拟实验：约 300 条消息 约 20 个工作请求 |
| C20 | 6 | f3030–3170 | 1:41.0–1:45.7 | 4.27 s | 4.12 s | 最慢的任务：耗时约为单 Session 的一半 |
| Lanes and legend | 6 | f3030–3600 | 1:41.0–2:00.0 | 18.60 s | 5.19 s | 单 Session / 被要求委派的单 Session / 双层架构 · ● 中位 ┃ 最慢 |
| C21 | 6 | f3170–3310 | 1:45.7–1:50.3 | 4.27 s | 3.63 s | 中位数：比更强的基线只快约 10% |
| C22 | 6 | f3310–3450 | 1:50.3–1:55.0 | 4.27 s | 3.39 s | 自行决定时 单 Session 从未委派 |
| C23 | 6 | f3450–3600 | 1:55.0–2:00.0 | 4.60 s | 4.34 s | 双层架构把委派写进结构 代价 2–4 倍 token |
| Token header | 6 | f3460–3600 | 1:55.3–2:00.0 | 4.27 s | 3.03 s | 每次运行的缓存读取 token |
| C24 | 7 | f3620–3760 | 2:00.7–2:05.3 | 4.27 s | 4.10 s | 设想：云端常驻 你合上电脑它也不停 |
| Proposed tag | 7 | f3640–3920 | 2:01.3–2:10.7 | 8.93 s | 2.77 s | 设想 · 公开原型未实现 |
| C25 | 7 | f3760–3920 | 2:05.3–2:10.7 | 4.93 s | 4.77 s | 未解风险：循环被劫持 相连机器都可能失守 |
| C26 | 8 | f4160–4310 | 2:18.7–2:23.7 | 4.60 s | 4.48 s | 单任务越来越不用人盯 瓶颈成了注意力 |
| C27 | 8 | f4310–4450 | 2:23.7–2:28.3 | 4.27 s | 3.88 s | 于是人的角色上移：做决策 做验收 |
| C28 | 9 | f4520–4680 | 2:30.7–2:36.0 | 4.93 s | 4.26 s | 智能体照样并行 按设计 你不必再分身 |
| End card | 9 | f4720–5260 | 2:37.3–2:55.3 | 17.60 s | 15.63 s | 见下 |
| Line-style key | 9 | f4760–5260 | 2:38.7–2:55.3 | 16.27 s | 4.01 s | 实线：已实现 · 虚线：设想 · 手绘线：未解 |

The plate's rows and the labels "Router" and "Worker" read the same in both languages and are
drawn once; "you · 你" is one bilingual label.

### 片尾卡
```
原文：《Super-agent 设计探索：迈向更自主的 Agent 系统》
DeepSeek Harness 团队 · 作者 Yujia Qiao
中文原文 2026-10-31 · 英文机译 2026-11-01
图表据作者模拟实验重绘
独立解读 与 DeepSeek 无关联

━━ 实线：已实现   ╍╍ 虚线：设想   ∼∼ 手绘线：未解
```

## Changes since the treatment
The treatment's copy (2026-11-08) with these changes, each re-checked against FACTS.md and the
holds:
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

## zh sign-off
**Signed off 2026-11-08.** Asked whether every zh-Hans string in this section is correct, the
user, the fluent reader, answered "Correct as written". That covers the 28 narration lines, the
title, the tags, the chart labels, the end card, and the choices below (双层架构, 手绘线, the
Netflix-style punctuation). Any string added or changed after that date needs the same check
again.

For the user, the fluent reader: tick each string or write the change beside it. The terms
are explained in the glossary below. Every string is in `src/cues.ts`; a changed line has to
clear its hold again (`pnpm exec vitest run videos/super-agent/src/cues.test.ts`), so a
longer line may need a shorter one elsewhere in its beat.

**Questions first**
- [ ] **人肉 Router** (C4): is the register right for Bilibili tech viewers? Alternative:
  你不知不觉成了它们的调度员 (needs 3.59 s of the 3.60 s).
- [ ] **串行又串味** (C5): 串味 for details of several tasks mixing in one context.
- [ ] **主动接单** (gate tag) for proactive pickup.
- [ ] **avg** on the stress plate: keep the Latin abbreviation, or write 平均 / 均值 in a zh
  row?
- [ ] **手绘线** in the key (alternatives: 草图, 草绘线, 铅笔线).
- [ ] **英文机译** (alternative: 英译, as the treatment had it).
- [ ] **双层架构** for the architecture everywhere, and no 两级.
- [ ] **自行决定时** (C22) for the neutral-prompt baseline.
- [ ] **后续** as a noun in C17 (同一 Thread 的后续). 后续消息 needs 3.94 s of the 3.60 s.
- [ ] **决策约少 23%** (C18), or the treatment's 决策少约 23%: the same length, so either holds.
- [ ] **按设计** (C14, C28): natural enough, or 按照设计 / 设计上?
- [ ] **ISO dates** (2026-10-31) on the end card, and **·** as the separator in one line.
- [ ] **The Chinese title of the source**, 《Super-agent 设计探索：迈向更自主的 Agent 系统》, is
  as IT之家 cites it; 量子位 leaves out 设计探索 and the original was not read (FACTS.md).

**Every string**
- [ ] Title 谁来调度智能体？
- [ ] Credit Super-agent（超级智能体）· DeepSeek Harness 团队的设计 (the gloss 超级智能体 is ours)
- [ ] C1 AI 智能体可以并行 你却不能
- [ ] C2 每个 Session 只懂一件事 你得全记住
- [ ] C3 据作者经验 一个人约能跟进 3–5 个
- [ ] C4 你悄悄成了人肉 Router
- [ ] C5 全塞进一个 Session：记得住 却串行又串味
- [ ] C6 一事一个 Session：快 但互不相通 都来找你
- [ ] C7 连续性和速度 只能二选一？
- [ ] C8 Super-agent 用双层架构 两者兼得
- [ ] C9 上层：常驻的 Router 接收各渠道消息
- [ ] C10 任务整个派出 它从不亲自动手
- [ ] C11 下层：一事一个 Worker 上下文与工具独立
- [ ] Built tag 双层架构：公开研究原型已实现
- [ ] C12 Worker 向上汇报 只有 Router 和你说话
- [ ] C13 Session 成了实现细节 不再是你的负担
- [ ] C14 按设计：规则滤掉大半噪声 余下由模型判断
- [ ] Gate tag 原型：主动接单默认关闭
- [ ] C15 Router 忙得过来吗？排队的事件合并处理
- [ ] C16 压测：负载约 40 倍 决策均摊耗时反而更短
- [ ] Plate 压测 · 模拟 Worker
- [ ] C17 同一 Thread 的后续 直通它的 Worker
- [ ] C18 任务不会更快 但 Router 决策约少 23%
- [ ] Chart tag 模拟实验 · 本片重绘 · 仅供参考
- [ ] C19 模拟实验：约 300 条消息 约 20 个工作请求
- [ ] C20 最慢的任务：耗时约为单 Session 的一半
- [ ] Lanes 单 Session · 被要求委派的单 Session · 双层架构
- [ ] Legend 中位 · 最慢
- [ ] C21 中位数：比更强的基线只快约 10%
- [ ] C22 自行决定时 单 Session 从未委派
- [ ] C23 双层架构把委派写进结构 代价 2–4 倍 token
- [ ] Token header 每次运行的缓存读取 token
- [ ] C24 设想：云端常驻 你合上电脑它也不停
- [ ] Proposed tag 设想 · 公开原型未实现
- [ ] C25 未解风险：循环被劫持 相连机器都可能失守
- [ ] C26 单任务越来越不用人盯 瓶颈成了注意力
- [ ] C27 于是人的角色上移：做决策 做验收
- [ ] C28 智能体照样并行 按设计 你不必再分身
- [ ] Label 你
- [ ] End card (all five lines) and the key 实线：已实现 · 虚线：设想 · 手绘线：未解

## Glossary EN → zh-Hans
Router, Worker, Session, Thread and token stay in Latin script, as the Chinese coverage writes
them. Status tags as in [FACTS.md](FACTS.md): [V] read at a primary source, [S] secondary,
[U] ours. The full table is in
[references/deepseek-superagent-2026-11.md](../../references/deepseek-superagent-2026-11.md).

| EN | zh-Hans | Source |
|---|---|---|
| agent | 智能体 | The prototype's glossary (docs/001-domain.md:79) [V] |
| Super-agent | Super-agent（超级智能体）, glossed once | Latin in the coverage [S]; the gloss is ours [U] |
| two-level architecture | 双层架构 | IT之家, 量子位, the reprint [S] |
| two-stage filtering | 两级过滤 (not used on screen) | IT之家, 量子位 [S] |
| Router (layer) / Worker (layer) | Router / Worker, 上层 / 下层 | IT之家 Router 层, 量子位 上层的Router [S] |
| session | Session | IT之家 活跃 Session [S]; DeepSeek Harness zh docs 会话 [V] |
| route, dispatch | 调度, 派出 | IT之家 and 量子位 调度 [S]; 派出 ours [U] |
| channel | 渠道 | The prototype's glossary (Channel 渠道) [V]; IT之家 [S] |
| pass-through | 直通 | IT之家 事件直通机制, 量子位 订阅与直通机制 [S] |
| decision | 决策 | 量子位 Router的决策次数 [S] |
| stress test, mock Worker | 压测, 模拟 Worker | Ours [U] |
| synthetic test | 模拟实验 | Ours [U] |
| median / p95 | 中位数, 中位 / 最慢 | 量子位 中位数 [S]; 最慢 ours [U] |
| baseline, delegate | 基线, 委派 | Ours [U] |
| cache-read tokens | 缓存读取 token | 量子位 读取缓存Token [S] |
| research prototype | 研究原型 | The README "research prototype" [V]; IT之家 原型实现 [S] |
| proactive pickup | 主动接单 | Ours [U]; 主动 is IT之家's trait [S] |
| proposed | 设想 | Ours [U] |
| attention | 注意力 | IT之家 [S] |
| sign-off | 验收 | The reprint 更高层的决策与验收 [S] |
| solid / dashed / sketch line | 实线 / 虚线 / 手绘线 | Standard drawing terms; 手绘线 ours [U] |
