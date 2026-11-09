/**
 * The film's one timeline (docs/ARCHITECTURE.md, decision 22): 84 bars of 4/4 at 90 bpm, 30 fps.
 * A beat is 20 frames, a bar 80, the film 6720 frames (3:44.0). The picture (src/) and the score
 * (audio/) both import this module, and it is in both input hashes, so a timing change rebuilds
 * both. Frames count from the end of the test-card leader.
 *
 * Every on-screen string lives here (WORDS, en and zh-Hans), so the text the audio stage checks
 * for reading time is the text the picture draws. A `text` span is the time a line is fully
 * visible and unchanged: its 6-frame wipe in comes before `frame`, its 6-frame fade out after
 * `end` (TREATMENT.md, Motion grammar). SCRIPT.md lists the same copy with its frames, and
 * STORYBOARD.md what the picture and the score do on each cue.
 *
 * Imports only @aiv/core: the audio stage hashes this file on its own, so it may not pull in
 * other files of src/.
 */
import { CueSheet, type CueEvent } from '@aiv/core';

export const FPS = 30;
export const BPM = 90;
export const BEATS_PER_BAR = 4;
/** frames per beat (20) and per bar (80) */
export const BEAT = (FPS * 60) / BPM;
export const BAR = BEAT * BEATS_PER_BAR;
export const BARS = 84;
export const FILM_FRAMES = BARS * BAR;
/** the test card before the film (video.json qa.swatchFrames [0, 15]); 0 for the final (decision 24) */
export const LEADER_FRAMES = 15;
/** frames a text line takes to wipe in before its span, and to fade out after it */
export const TEXT_IN = 6;
export const TEXT_OUT = 6;

/** The film frame where bar `n` (1-based) beat `b` (1-based, fractions allowed) starts. */
export const at = (n: number, b = 1): number => Math.round((n - 1) * BAR + (b - 1) * BEAT);

/** Seconds of a film frame. */
export const sec = (f: number): number => f / FPS;

/** One on-screen string per language (`en`, `zh-Hans`). */
export type Words = Readonly<Record<string, string>>;

/**
 * The on-screen words, per language: the reading-time checks use these exact strings.
 * - Narration is one EN line over one zh-Hans line in the lower-left notes block: the 25 lines
 *   kept from the 2:56 cut keep their ids (c1–c28 without c13, c16, c19; their zh was signed off
 *   on 2026-11-08), and the 3:45 cut's new lines are n1–n11 (session 3, 2026-11-09).
 *   The zh lines follow the Netflix zh-Hans style (references/subtitles.md): no commas or
 *   full stops, a space for a pause, full-width ： and ？.
 * - Tags, the plate and the chart carry their own EN and zh strings. Where both languages read
 *   the same (numbers, "Router", "Worker"), the picture draws the string once.
 * - A '\n' is a line break the picture keeps (the end card).
 * - The kept zh strings were signed off on 2026-11-08; every new zh string (the n-lines, the new
 *   tags, plates, stamps and labels) was signed off on 2026-11-09 (SCRIPT.md, "zh sign-off").
 */
export const WORDS = {
  // beat 1: the title cartouche and its credit subline
  title: { en: 'Who Routes the Agents?', 'zh-Hans': '谁来调度智能体？' },
  credit: { en: 'Super-agent, a design by DeepSeek’s Harness team', 'zh-Hans': 'Super-agent（超级智能体）· DeepSeek Harness 团队的设计' },

  // narration, in film order. c* = kept verbatim from the 2:56 cut (zh signed off 2026-11-08);
  // n* = new in the 3:45 cut (zh signed off 2026-11-09, SCRIPT.md)
  // beat 1 · Hook
  c1: { en: 'Your AI agents work in parallel. You can’t.', 'zh-Hans': 'AI 智能体可以并行 你却不能' },
  // beat 2 · The human router: the four chores land on you
  c2: { en: 'Each session knows one task. You must know them all.', 'zh-Hans': '每个 Session 只懂一件事 你得全记住' },
  c3: { en: 'In the authors’ experience, you can follow about 3–5.', 'zh-Hans': '据作者经验 一个人约能跟进 3–5 个' },
  n1: { en: 'You switch, prompt each run, wait, and keep it all running.', 'zh-Hans': '切换 逐次下指令 等待 还得守着它们别停' },
  c4: { en: 'You’ve quietly become their router.', 'zh-Hans': '你悄悄成了人肉 Router' },
  // beat 3 · Two easy fixes
  c5: { en: 'All in one session: it remembers, but is serial and muddled.', 'zh-Hans': '全塞进一个 Session：记得住 却串行又串味' },
  c6: { en: 'One per event: fast, but disconnected, and all reply to you.', 'zh-Hans': '一事一个 Session：快 但互不相通 都来找你' },
  c7: { en: 'Continuity or speed: must we pick one?', 'zh-Hans': '连续性和速度 只能二选一？' },
  // beat 4 · Two levels, the turn (remember and switch, handed over: Continuous)
  c8: { en: 'Super-agent keeps both, on two levels.', 'zh-Hans': 'Super-agent 用双层架构 两者兼得' },
  c9: { en: 'Above: one long-lived Router hears every channel.', 'zh-Hans': '上层：常驻的 Router 接收各渠道消息' },
  c10: { en: 'It hands each task over whole and never does the work.', 'zh-Hans': '任务整个派出 它从不亲自动手' },
  n2: { en: 'Why? Every task passes here; it must never be the bottleneck.', 'zh-Hans': '为什么？任务都经过它 它绝不能成为瓶颈' },
  c11: { en: 'Below: each task gets its own Worker, context and tools.', 'zh-Hans': '下层：一事一个 Worker 上下文与工具独立' },
  c12: { en: 'Workers report up. Only the Router talks to you.', 'zh-Hans': 'Worker 向上汇报 只有 Router 和你说话' },
  // beat 5 · Prompting each run, handed over (Proactive, by design)
  n3: { en: 'It listens for events, so no one has to prompt each run.', 'zh-Hans': '它监听事件 不必再由人逐次下指令' },
  c14: { en: 'By design: rules drop most noise; a model judges the rest.', 'zh-Hans': '按设计：规则滤掉大半噪声 余下由模型判断' },
  // beat 6 · How one Router keeps up: batching, context as a cache, recall
  c15: { en: 'Can one Router keep up? Waiting events go in together.', 'zh-Hans': 'Router 忙得过来吗？排队的事件合并处理' },
  n4: { en: 'Long input, short output: merging events adds little time.', 'zh-Hans': '输入长 输出短：合并处理只多花一点时间' },
  n5: { en: 'Context is a cache: a summary in view, a pointer to the rest.', 'zh-Hans': '上下文是缓存：摘要放进来 其余只留指针' },
  n6: { en: 'Asked in another channel? It follows IDs back, hop by hop.', 'zh-Hans': '换个渠道问起？它顺着 ID 一跳一跳找回来' },
  // beat 7 · Waiting, handed over (Productive)
  c17: { en: 'Follow-ups in a Thread go straight to its Worker.', 'zh-Hans': '同一 Thread 的后续 直通它的 Worker' },
  c18: { en: 'Not faster tasks: about 23% fewer Router decisions.', 'zh-Hans': '任务不会更快 但 Router 决策约少 23%' },
  n7: { en: 'Jobs run in the background; new input never waits on them.', 'zh-Hans': '耗时操作转入后台 新输入不必等它跑完' },
  // beat 8 · Many runs: the evidence (C19's numbers moved to tagLoad)
  c20: { en: 'Slowest tasks: about half the time of a single session.', 'zh-Hans': '最慢的任务：耗时约为单 Session 的一半' },
  c21: { en: 'Typical tasks: only ~10% faster than the stronger baseline.', 'zh-Hans': '中位数：比更强的基线只快约 10%' },
  c22: { en: 'Left to choose, the single session never delegated.', 'zh-Hans': '自行决定时 单 Session 从未委派' },
  c23: { en: 'Two levels make delegation structural, at 2–4× the tokens.', 'zh-Hans': '双层架构把委派写进结构 代价 2–4 倍 token' },
  // beat 9 · Keeping it running, handed over (Persistent, proposed)
  c24: { en: 'Proposed: a cloud loop that works while your laptop sleeps.', 'zh-Hans': '设想：云端常驻 你合上电脑它也不停' },
  n8: { en: 'A watchdog checks progress, not just that it’s alive.', 'zh-Hans': '看门狗盯的是进展 不只是还活着' },
  // beat 10 · Still open: the chores you cannot hand over yet
  c25: { en: 'Open risk: a hijacked loop could reach all connected machines.', 'zh-Hans': '未解风险：循环被劫持 相连机器都可能失守' },
  n9: { en: 'Shard the Router and continuity trades against speed again.', 'zh-Hans': 'Router 一分片 连续性和速度又要权衡' },
  n10: { en: 'Many tasks still need you midway: how to step in is open.', 'zh-Hans': '许多任务仍需人中途介入 怎么介入尚未解决' },
  // beat 11 · Sign-off, old ideas, meaning
  n11: { en: 'None of this is new theory: it is classic systems design.', 'zh-Hans': '这些不是新理论 而是经典的系统设计' },
  c26: { en: 'As models need less help, your attention becomes the limit.', 'zh-Hans': '单任务越来越不用人盯 瓶颈成了注意力' },
  c27: { en: 'So people move up: to decisions, and to sign-off.', 'zh-Hans': '于是人的角色上移：做决策 做验收' },
  // beat 12 · Bookend
  c28: { en: 'Your agents work in parallel. By design, you don’t have to.', 'zh-Hans': '智能体照样并行 按设计 你不必再分身' },

  // the world's persistent labels
  router: { en: 'Router', 'zh-Hans': 'Router' },
  worker: { en: 'Worker', 'zh-Hans': 'Worker' },
  you: { en: 'you', 'zh-Hans': '你' },
  // the four traits (article blocks 13–16; zh as IT之家 reports them), on enamel plates that dock on
  // the part that took each chore over; Persistent's plate is vellum (proposed)
  traitContinuous: { en: 'Continuous', 'zh-Hans': '连续' },
  traitProactive: { en: 'Proactive', 'zh-Hans': '主动' },
  traitProductive: { en: 'Productive', 'zh-Hans': '高效' },
  traitPersistent: { en: 'Persistent', 'zh-Hans': '持久' },

  // beat 4: the built tag, scoped to the two levels; it ends before C12 (FACTS.md, open item 2)
  tagBuilt: { en: 'two levels: built in the public research prototype', 'zh-Hans': '双层架构：公开研究原型已实现' },
  // beat 5: the gate tag, under the proactive claim and the filter
  tagGate: { en: 'prototype: proactive pickup off by default', 'zh-Hans': '原型：主动接单默认关闭' },
  // beat 6: the stress plate (a header and two rows of endpoints), the evidence for n4
  plateHead: { en: 'stress test · mock Workers', 'zh-Hans': '压测 · 模拟 Worker' },
  plateArrivals: { en: '~1 → ~40 /min', 'zh-Hans': '~1 → ~40 /min' },
  plateDecision: { en: '6.4 s → 1.6 s avg', 'zh-Hans': '6.4 s → 1.6 s avg' },
  // beat 6: context as a cache and recall exist in prototype form (cards.ts 160-character
  // previews, read: pointers, every shown ID readable; no dedicated multi-hop recall)
  tagCache: { en: 'prototype: summaries and read pointers', 'zh-Hans': '原型：摘要加读取指针' },
  // beat 7: the async loop is on in the prototype's presets (docs/003-execution.md:27,29)
  tagJobs: { en: 'prototype: background after 5 s', 'zh-Hans': '原型：5 秒后转入后台' },
  // beat 7: the chat reply's stop tab (article block 87; prototype IM_WORDS = 100)
  tag100: { en: 'chat replies: ≤ 100 words', 'zh-Hans': '聊天回复：≤ 100 词' },
  // beat 8: the test sheet's header tag and load tag, lane names, legend and token header
  tagChart: { en: 'synthetic test · re-plotted · indicative only', 'zh-Hans': '模拟实验 · 本片重绘 · 仅供参考' },
  tagLoad: { en: 'per run: ~300 messages · ~20 work requests', 'zh-Hans': '每次运行：约 300 条消息 · 约 20 个工作请求' },
  laneOne: { en: 'one session', 'zh-Hans': '单 Session' },
  laneTold: { en: 'one session, told to delegate', 'zh-Hans': '被要求委派的单 Session' },
  laneTwo: { en: 'two levels', 'zh-Hans': '双层架构' },
  legendTypical: { en: 'typical', 'zh-Hans': '中位' },
  legendSlowest: { en: 'slowest', 'zh-Hans': '最慢' },
  tokenHead: { en: 'cache-read tokens per run', 'zh-Hans': '每次运行的缓存读取 token' },
  // the test sheet's hero stamps, set in the world as canvas textures beside C20, C21 and C23
  stampHalf: { en: '~½', 'zh-Hans': '~½' },
  stampTen: { en: '~10%', 'zh-Hans': '~10%' },
  stampTokens: { en: '2–4×', 'zh-Hans': '2–4×' },
  // beat 9: the proposed tag, beside the vellum parts
  tagProposed: { en: 'proposed · not in the public prototype', 'zh-Hans': '设想 · 公开原型未实现' },
  // beat 11: the classic systems ideas the article names (blocks 47, 33–35, 63, 79, 90, 101),
  // one label settling on its part of the summary map per beat
  ideaFastSlow: { en: 'Fast / Slow Path', 'zh-Hans': 'Fast / Slow Path' },
  ideaBatching: { en: 'batching', 'zh-Hans': '批处理' },
  ideaCache: { en: 'cache', 'zh-Hans': '缓存' },
  ideaDuplex: { en: 'full-duplex', 'zh-Hans': '全双工' },
  ideaSplit: { en: 'compute–state split', 'zh-Hans': '存算分离' },
  ideaControl: { en: 'control loop', 'zh-Hans': '控制回路' },

  // beat 13: the end card, and its status key (each entry beside a sample of its material); the
  // same key is read earlier as a legend on the summary map (beat 11)
  end: {
    en: [
      'Source: “Exploring Super-agent Design:',
      'Towards a More Autonomous Agent System”',
      'DeepSeek Harness team · author Yujia Qiao',
      'Chinese original 31 Oct 2026 · machine-translated 1 Nov 2026',
      'Charts re-plotted from the authors’ synthetic tests',
      'Not affiliated with DeepSeek',
    ].join('\n'),
    'zh-Hans': [
      '原文：《Super-agent 设计探索：迈向更自主的 Agent 系统》',
      'DeepSeek Harness 团队 · 作者 Yujia Qiao',
      '中文原文 2026-10-31 · 英文机译 2026-11-01',
      '图表据作者模拟实验重绘',
      '独立解读 与 DeepSeek 无关联',
    ].join('\n'),
  },
  keySolid: { en: 'solid: built', 'zh-Hans': '实线：已实现' },
  keyDashed: { en: 'dashed: proposed', 'zh-Hans': '虚线：设想' },
  keySketch: { en: 'sketch: open', 'zh-Hans': '手绘线：未解' },
} as const satisfies Record<string, Words>;

export type WordsId = keyof typeof WORDS;

/** The 36 narration cue ids in film order (SCRIPT.md). */
export const NARRATION = [
  'c1',
  'c2', 'c3', 'n1', 'c4',
  'c5', 'c6', 'c7',
  'c8', 'c9', 'c10', 'n2', 'c11', 'c12',
  'n3', 'c14',
  'c15', 'n4', 'n5', 'n6',
  'c17', 'c18', 'n7',
  'c20', 'c21', 'c22', 'c23',
  'c24', 'n8',
  'c25', 'n9', 'n10',
  'n11', 'c26', 'c27',
  'c28',
] as const satisfies readonly WordsId[];

/**
 * The 13 story beats: each starts on a downbeat and is marked `beat-<n>` in the sheet. The spine
 * is the human router's four chores, handed over one by one (TREATMENT.md, revision 2).
 */
export const BEATS = [
  { id: 'beat-1', bar: 1, name: 'Hook' },
  { id: 'beat-2', bar: 6, name: 'The human router' },
  { id: 'beat-3', bar: 13, name: 'Two easy fixes' },
  { id: 'beat-4', bar: 19, name: 'Two levels (the turn): remembering, handed over' },
  { id: 'beat-5', bar: 30, name: 'Prompting each run, handed over (by design)' },
  { id: 'beat-6', bar: 35, name: 'How one Router keeps up' },
  { id: 'beat-7', bar: 44, name: 'Waiting, handed over' },
  { id: 'beat-8', bar: 50, name: 'Many runs: the evidence' },
  { id: 'beat-9', bar: 58, name: 'Keeping it running, handed over (proposed)' },
  { id: 'beat-10', bar: 63, name: 'Still open' },
  { id: 'beat-11', bar: 69, name: 'Sign-off, old ideas, meaning' },
  { id: 'beat-12', bar: 76, name: 'Bookend' },
  { id: 'beat-13', bar: 78, name: 'End card' },
] as const;

// ------------------------------------------------------------------------------------------------
// The event schedule (session 4, the build): plain data that the picture (src/desk) and the score
// (audio/) both read, so a sound and the motion that causes it cannot drift apart (TREATMENT.md,
// Rules of the medium 6: every effect is a sum over the cue sheet's event list). Film frames. The
// larger moments are also cue events below (hits on beats, marks anywhere), which QA and the audio
// stage see; the picture's own sub-steps (anticipation, flight, settle) hang off these frames.

/**
 * Act one: your lamp's visits, [frame the swing starts, folder n] (STORYBOARD 1.1-2.3). Quarters
 * among the first five, then all eight as they arrive, then only the four you can still follow, in
 * eighths and sixteenths; it stops dead on F3 at f870 and stays there through beat 3.
 */
export const LAMP_VISITS: readonly (readonly [number, number])[] = (() => {
  const v: [number, number][] = [];
  const cycleAll = [1, 3, 2, 5, 4, 1, 3, 5];
  for (let f = 0, k = 0; f < 400; f += BEAT, k++) v.push([f, cycleAll[k % cycleAll.length]!]);
  const all8 = [6, 1, 7, 3, 8, 2, 5, 4];
  for (let f = 400, k = 0; f < 560; f += BEAT, k++) v.push([f, all8[k % all8.length]!]);
  const four = [5, 1, 7, 3];
  for (let f = 560, k = 0; f < 640; f += BEAT, k++) v.push([f, four[k % 4]!]);
  for (let f = 640, k = 0; f < 800; f += BEAT / 2, k++) v.push([f, four[k % 4]!]);
  for (let f = 800, k = 0; f < 870; f += BEAT / 4, k++) v.push([f, four[k % 4]!]);
  v.push([870, 3]);
  return v;
})();
/** Folders F6-F8 land in beat 2 (5 → 8), on beats. */
export const ARRIVE: Readonly<Record<number, number>> = { 6: 420, 7: 460, 8: 500 };
/** A folder's warmth decays with this time constant (frames) once the lamp leaves; its pen works above `penOn`, its flag snaps up under `flagUp`. */
export const WARMTH = { tau: 120, penOn: 0.35, flagUp: 0.3 } as const;

/**
 * Beat 3, Fix A (STORYBOARD 3.1): one grey-stock folder with every feeder pouring onto its one
 * tape. It emerges on bar 13's downbeat; its queue advances one station on every beat from the
 * next one through the turn's last advance (src/desk/turn.ts TURN.advance, f1400).
 */
export const FIX_A = { in: at(13), steps: Array.from({ length: (at(18, 3) - at(13, 2)) / BEAT + 1 }, (_, i) => at(13, 2) + i * BEAT) } as const;
/**
 * Fix B (3.2): eight trays, one per event. They emerge on bar 15's downbeat and tick in parallel;
 * replies 0-6 leave their trays for your in-tray on these frames (reply 7 is the turn's, posted at
 * f1394). A follow-up lands in tray 6, away from its task's tray 2, and the break mark between the
 * two draws in.
 */
export const FIX_B = { in: at(15), replies: [1150, 1160, 1180, 1200, 1230, 1250, 1270], followUp: 1210, breakMark: 1220 } as const;
/** Both fixes stand at full contrast from here (3.3). */
export const BOTH_FIXES = at(17);

/**
 * Beat 4 after the turn (STORYBOARD 4.2-4.5), in cause order. The request rises out of the old heap
 * and is stamped in; a counterfactual card (the request torn three ways) rises 12 f, is struck 6 f
 * and exits 8 f; the index arm detents toward the bay floor, a hatch opens, the bug bay's bench rises
 * and the request rides its groove whole; the Thread's subscription inks into the request's own row
 * on the tape (its cord waits for C17, design D1). Under N2 the neck-collar gauge shows, needle low;
 * two arrivals take the next rows (still (b)'s tape has room for exactly two before #0408) while the
 * index detents on beats 2 and 4; and a ghost card (a Router with a bench, its backlog piling at its
 * door for a bar) is struck. Under C11 two more tasks are dispatched and their bays rise; the Worker
 * label enters. Every frame here is a contact frame: the picture's event lands on it (the cue is the
 * contract; the sound sits on it).
 */
export const BEAT_4 = {
  requestRise: 1648,
  requestIn: at(22),
  splitCard: 1700,
  splitStrike: at(22, 3),
  armBug: at(22, 4),
  dispatchBug: at(23),
  threadRow: 1800,
  gauge: 1826,
  ghostCard: at(24),
  ghostStrike: at(25),
  rows: [at(24, 2), at(24, 4)],
  armTests: 1990,
  dispatchTests: at(26),
  armDocs: 2030,
  dispatchDocs: at(26, 3),
  workerLabel: 2070,
} as const;
/** MT1's handshake and next dispatch (src/desk/state.ts EVENTS_B and EVENTS_D, which desk.test.ts holds equal to these): the card ejects, the record stamps in, the reply lands in your in-tray, the fresh bay rises. */
export const MT1 = { reportUp: 2164, stampIn: 2190, replyLands: 2234, dispatchFresh: 2289 } as const;

/**
 * Beat 5 (STORYBOARD 5.1-5.3): the starter key lifts off your tray on `trait-proactive` (f2340),
 * arcs to the intake and docks as its trip; the Proactive plate docks on the beat after. Then the
 * two-stage filter: each slip reaches the gate's fingers at `f`. Code flips most of them onto the
 * spike (the finger 4 f, impaled at +12 f, the pile grows at +13 f); a kept one rides on to the loupe
 * on the Register's throat, which scans 12 f over the policy card and notches it `notchAfter` frames
 * after the gate (the model). The spike enters at f2470.
 */
export const BEAT_5 = {
  keyDock: 2356,
  plateDock: at(30, 3),
  spikeIn: 2470,
  flip: 4,
  impale: 12,
  notchAfter: 26,
  slips: [
    { f: 2480, keep: false },
    { f: 2490, keep: false },
    { f: 2500, keep: false },
    { f: 2520, keep: true },
    { f: 2530, keep: false },
    { f: 2550, keep: false },
    { f: 2560, keep: false },
    { f: 2580, keep: true },
    { f: 2590, keep: false },
    { f: 2610, keep: false },
    { f: 2620, keep: false },
    { f: 2650, keep: true },
    { f: 2660, keep: false },
    { f: 2680, keep: false },
    { f: 2690, keep: false },
  ],
} as const;

/**
 * Beat 6 (STORYBOARD 6.1-6.4). Batching: waiting slips butt into one strip at the throat, landing
 * on these frames; on the next downbeat a reading bar sweeps the whole strip (14 f + 1 f a slip) and
 * every cell lights within 6 f (prefill); then a short slip punches out one cell per 2 f (decode) and
 * leaves as dispatches. The second strip is longer, its sweep barely so. The cache fold is state.ts
 * EVENTS_C (the card ejects at f3080, folds at f3120). Recall (6.4): a review card from the card
 * feeder enters the throat and is stamped in as a new row; on bar 42's downbeat the reel rewinds over
 * 24 f, then a reading-thread hops to the request's stub, its Thread's row and its bay's last report
 * (10 f a hop, 4 f dwell), and a short answer goes back.
 */
export const BEAT_6 = {
  batches: [
    { sweep: at(36), slips: [2730, 2744, 2756, 2770, 2782] },
    { sweep: at(38), slips: [2820, 2836, 2850, 2866, 2896, 2910, 2924, 2938] },
  ],
  /** a sweep takes sweepBase + sweepPerSlip × slips frames */
  sweepBase: 14,
  sweepPerSlip: 1,
  decodeCell: 2,
  cacheEject: 3080,
  cacheFold: at(40),
  recall: { card: 3232, stampIn: 3260, rewind: at(42), rewindFrames: 24, hops: [3304, 3318, 3332], answer: 3350 },
} as const;

/** The on-screen window of a text or card cue: its span plus the wipe in and the fade out. */
export const textWindow = (e: CueEvent): [number, number] => [e.frame - TEXT_IN, (e.end ?? e.frame) + TEXT_OUT];

/** Each language's strings of several WORDS entries, joined by spaces: what a reader of that language reads. */
const read = (...entries: Words[]): Record<string, string> => {
  const langs = [...new Set(entries.flatMap((w) => Object.keys(w)))];
  return Object.fromEntries(langs.map((l) => [l, entries.map((w) => w[l] ?? '').filter(Boolean).join(' ')]));
};

const hit = (id: string, frame: number, label: string): CueEvent => ({ id, kind: 'hit', frame, label });
const mark = (id: string, frame: number, label: string): CueEvent => ({ id, kind: 'mark', frame, label });
const span = (kind: 'rest' | 'silence' | 'hold', id: string, frame: number, end: number, label: string): CueEvent => ({ id, kind, frame, end, label });
/**
 * A text or card cue from its on-screen window [from, to) on the grid (TREATMENT.md's cue
 * frames): the line wipes in over [from, from + TEXT_IN) and fades out over [to - TEXT_OUT, to),
 * so the span, the fully visible time the reading check measures, is [from + TEXT_IN, to - TEXT_OUT).
 */
const shown = (kind: 'text' | 'card', id: string, from: number, to: number, text: Record<string, string>): CueEvent => ({ id, kind, frame: from + TEXT_IN, end: to - TEXT_OUT, text: { ...text } });
const line = (id: WordsId, from: number, to: number): CueEvent => shown('text', id, from, to, WORDS[id]);

const events: CueEvent[] = [
  ...BEATS.map((b) => mark(b.id, at(b.bar), b.name)),

  // 1 · Hook (bars 1-5): the request sinks in the noise; the title card
  hit('request', at(1, 2), 'one slip turns vermilion: the request motif, A4 then D5, on FM mallet'),
  line('c1', at(1, 2), at(2, 4)),
  hit('title-thump', at(3), 'the camera starts to ease out: a low felt-piano D and a soft thump'),
  shown('card', 'title', at(3), at(5, 4), WORDS.title),
  shown('text', 'credit', at(3, 3), at(5, 4), WORDS.credit),

  // 2 · The human router (bars 6-12): the four chores land on your desk, one per beat
  line('c2', at(6), at(7, 3.5)),
  line('c3', at(7, 3.5), at(9, 2)),
  line('n1', at(9, 2), at(11, 1.5)),
  hit('chore-switch', at(9, 3), 'remember and switch: the notes loop tightens round the desk'),
  hit('chore-prompt', at(9, 4), 'prompt each run: the starter key lands in the chore tray'),
  hit('chore-wait', at(10), 'wait: the sand-glass lands'),
  hit('chore-keep', at(10, 2), 'keep it running: the lid strut props the laptop open'),
  line('c4', at(11, 2.5), at(12, 4.5)),
  hit('hub', at(12), 'the notes loop closes with its clip: a low felt-piano D and a dry scratch'),
  span('silence', 'silence-hub', at(12, 4), at(13), 'one beat of silence after the hub'),

  // 3 · Two easy fixes (bars 13-18)
  mark('fix-a', FIX_A.in, 'Fix A rises in grey stock west of your lamp: every feeder pours onto its one tape (hard left)'),
  mark('fix-b', FIX_B.in, 'Fix B’s eight trays rise east of your lamp and tick in parallel (hard right)'),
  mark('fix-b-break', FIX_B.breakMark, 'a follow-up lands in a different tray from its task: the break mark'),
  mark('both-fixes', BOTH_FIXES, 'both fixes at full contrast, either side of your desk'),
  line('c5', at(13, 2), at(15, 1.5)),
  line('c6', at(15, 1.5), at(17)),
  line('c7', at(17), at(18, 2.5)),
  span('rest', 'rest-breath', at(18, 3), at(19), 'the half-bar breath: a Dsus2 hangs, then near silence'),

  // 4 · Two levels, the turn (bars 19-29): the routing job lifts off your desk
  hit('turn', at(19), 'the loop lifts off and becomes the Register: every voice collapses into one D-major unison arpeggio'),
  line('c8', at(19), at(20, 3)),
  line('c9', at(20, 3), at(22, 1.5)),
  mark('trait-continuous', at(21, 3), 'the notes loop is now the Register’s tape: the Continuous plate docks'),
  mark('request-rise', BEAT_4.requestRise, 'the request rises out of the old heap toward the throat'),
  hit('request-in', BEAT_4.requestIn, 'the request is stamped in, its stub on the tape: the motif’s first station'),
  line('c10', at(22, 1.5), at(23, 4)),
  mark('split-card', BEAT_4.splitCard, 'a grey-stock card rises: the request torn three ways'),
  hit('strike-split', BEAT_4.splitStrike, 'an ink rule strikes the split card: a dry scratch'),
  mark('arm-bug', BEAT_4.armBug, 'the index arm detents toward the bay floor'),
  hit('dispatch-bug', BEAT_4.dispatchBug, 'a hatch opens and the bug bay’s bench rises; the request’s folder slides its groove: a knock, then its marimba voice'),
  mark('thread-row', BEAT_4.threadRow, 'the request’s Thread subscription inks into its row on the tape (no cord until C17)'),
  line('n2', at(23, 4), at(25, 3.5)),
  mark('gauge', BEAT_4.gauge, 'the neck-collar gauge on the throat shows, its needle low'),
  mark('ghost-router', BEAT_4.ghostCard, 'a grey-stock card rises: a Router with a bench, its backlog piling at the door for a bar'),
  ...BEAT_4.rows.map((f, i) => mark(`row-${i + 1}`, f, 'an arrival takes the next row on the tape')),
  hit('strike-ghost', BEAT_4.ghostStrike, 'the ghost Router is struck: the smeared cluster fades'),
  line('c11', at(25, 4), at(27, 3.5)),
  mark('arm-tests', BEAT_4.armTests, 'the index arm detents toward the test tower’s hatch'),
  hit('dispatch-tests', BEAT_4.dispatchTests, 'the test tower rises from its hatch: a knock, then its marimba voice'),
  shown('text', 'tag-built', at(26), at(27, 3.5), WORDS.tagBuilt),
  mark('arm-docs', BEAT_4.armDocs, 'the index arm detents toward the docs galley’s hatch'),
  hit('dispatch-docs', BEAT_4.dispatchDocs, 'the docs galley rises from its hatch: a knock, then its marimba voice (three voices at most)'),
  mark('worker-label', BEAT_4.workerLabel, 'the Worker label enters on the bug bay'),
  mark('report-up', MT1.reportUp, 'the test tower’s report card ejects and flies up under the transit light'),
  mark('stamp-in', MT1.stampIn, 'the report stamps in on the tape'),
  mark('reply-lands', MT1.replyLands, 'the reply lands in your in-tray: one felt-piano note'),
  mark('dispatch-fresh', MT1.dispatchFresh, 'the fresh bay rises from its hatch, inside the rest: no knock'),
  line('c12', at(27, 3.5), at(29, 2)),
  span('rest', 'rest-model', at(29, 2), at(30), 'three beats: the system runs on the beat, the bays step down; the pad and one pluck'),

  // 5 · Prompting each run, handed over (bars 30-34), by design
  line('n3', at(30), at(31, 4)),
  mark('trait-proactive', at(30, 2), 'the starter key lifts off your tray into the intake: the Proactive plate docks'),
  mark('key-dock', BEAT_5.keyDock, 'the starter key docks on the intake as its trip'),
  mark('plate-proactive', BEAT_5.plateDock, 'the Proactive plate docks on the intake; your lamp has dimmed a step'),
  shown('text', 'tag-gate', at(30), at(33, 4.5), WORDS.tagGate),
  mark('spike-in', BEAT_5.spikeIn, 'the spike stands up beside the gate: the filter starts'),
  line('c14', at(31, 4.5), at(33, 4.5)),

  // 6 · How one Router keeps up (bars 35-43): batching, context as a cache, recall
  line('c15', at(35), at(36, 4.5)),
  hit('batch', at(36), 'the queued strip is read in one sweep: the held ticks release as one chord'),
  line('n4', at(36, 4.5), at(38, 4)),
  hit('plate-detent', at(37), 'the stress plate sets: a soft mechanical detent'),
  shown('text', 'plate', at(37), at(39), read(WORDS.plateHead, WORDS.plateArrivals, WORDS.plateDecision)),
  hit('batch-2', BEAT_6.batches[1].sweep, 'the longer strip is swept, barely longer: a thicker chord'),
  line('n5', at(39, 2), at(41, 1.5)),
  mark('cache-eject', BEAT_6.cacheEject, 'the request bay’s report card ejects toward the reading window'),
  hit('cache-fold', BEAT_6.cacheFold, 'the body folds into a pointer tab: paper, then a pointer tick as it lands in the drawer'),
  shown('text', 'tag-cache', at(39, 3), at(43, 3), WORDS.tagCache),
  mark('review-card', BEAT_6.recall.card, 'a GitHub review comment, a punched card, enters the throat'),
  mark('review-in', BEAT_6.recall.stampIn, 'nothing subscribes to it: it is stamped in as a new row'),
  line('n6', at(41, 3.5), at(43, 3)),
  hit('recall', BEAT_6.recall.rewind, 'the reel rewinds over 24 f as the camera eases out'),
  ...BEAT_6.recall.hops.map((f, i) => mark(`hop-${i + 1}`, f, ['the thread hops to the request’s stub: A4', 'to its Thread’s row: D5', 'to its bay’s last report: A4 (F♯5 is kept for the stamp)'][i]!)),
  mark('recall-answer', BEAT_6.recall.answer, 'a short answer goes back'),

  // 7 · Waiting, handed over (bars 44-49)
  line('c17', at(44), at(45, 3)),
  hit('flyover', at(45), 'the follow-up rides its Thread over the Register: the motif an octave up, and the Router’s chord is skipped'),
  line('c18', at(45, 3), at(47, 1.5)),
  line('n7', at(47, 1.5), at(49)),
  hit('job-peel', at(47, 3), 'the long job peels off onto its side rail while the door stays open'),
  shown('text', 'tag-jobs', at(47, 3), at(48, 4), WORDS.tagJobs),
  mark('trait-productive', at(47, 3), 'the sand-glass lifts off your tray onto the job rail: the Productive plate docks'),
  hit('job-dock', at(48, 3), 'the job docks back as an event'),
  shown('text', 'tag-100', at(48, 4), at(50), WORDS.tag100),

  // 8 · Many runs: the evidence (bars 50-57)
  shown('text', 'tag-chart', at(51), at(58), WORDS.tagChart),
  shown('text', 'tag-load', at(51), at(58), WORDS.tagLoad),
  line('c20', at(51), at(52, 4)),
  shown('text', 'chart-lanes', at(51), at(58), read(WORDS.laneOne, WORDS.laneTold, WORDS.laneTwo, WORDS.legendTypical, WORDS.legendSlowest)),
  shown('text', 'stamp-half', at(51, 3), at(58), WORDS.stampHalf),
  line('c21', at(52, 4), at(54, 3)),
  shown('text', 'stamp-ten', at(53), at(58), WORDS.stampTen),
  line('c22', at(54, 3), at(56, 1.5)),
  line('c23', at(56, 1.5), at(58)),
  shown('text', 'chart-tokens', at(56, 2), at(58), WORDS.tokenHead),
  shown('text', 'stamp-tokens', at(56, 3), at(58), WORDS.stampTokens),

  // 9 · Keeping it running, handed over (bars 58-62): proposed
  line('c24', at(58, 2), at(60)),
  shown('text', 'tag-proposed', at(58, 3), at(63), WORDS.tagProposed),
  mark('trait-persistent', at(58, 4), 'the lid strut lifts off onto the vellum loop: the Persistent plate docks, in vellum'),
  line('n8', at(60, 3.5), at(62, 2)),

  // 10 · Still open (bars 63-68): the chores you cannot hand over yet
  span('silence', 'silence-intrusion', at(63), at(63, 3), 'two beats of silence before the intrusion'),
  hit('intrusion', at(63, 3), 'the hatched slip reaches the Register: a low D–E♭ minor second'),
  line('c25', at(63), at(65)),
  line('n9', at(65), at(66, 4)),
  line('n10', at(66, 4.5), at(69)),

  // 11 · Sign-off, old ideas, meaning (bars 69-75)
  hit('stamp', at(69), 'your desk stamps the reply green: a felt stamp thump, and the motif completes as A4, D5, F♯5'),
  span('rest', 'rest-signoff', at(69, 3), at(70, 3.5), 'the route traced at 0.5×: the held Dmaj9 and the scratching drag'),
  line('n11', at(70, 3.5), at(72, 3)),
  shown('text', 'ideas', at(70, 4), at(74, 2.5), read(WORDS.ideaFastSlow, WORDS.ideaBatching, WORDS.ideaCache, WORDS.ideaDuplex, WORDS.ideaSplit, WORDS.ideaControl)),
  shown('text', 'key-map', at(70, 4.5), at(76, 1.5), read(WORDS.keySolid, WORDS.keyDashed, WORDS.keySketch)),
  line('c26', at(72, 3), at(74, 2.5)),
  line('c27', at(74, 2.5), at(76)),

  // 12 · Bookend (bars 76-77)
  line('c28', at(76, 1.5), at(78)),
  hit('bookend', at(76, 3), 'as at f20 a slip turns vermilion: the motif once, with no felt-piano answer'),

  // 13 · End card (bars 78-84)
  mark('dissolve', at(78), 'dissolve to the bare desk, never to black'),
  shown('card', 'end', at(78, 3), at(84, 4), WORDS.end),
  shown('text', 'end-key', at(79), at(84, 4), read(WORDS.keySolid, WORDS.keyDashed, WORDS.keySketch)),
  span('hold', 'hold-end', at(78, 3), at(84, 4), 'the end card is still: freezedetect allows it'),
  span('rest', 'rest-tail', at(84, 4), FILM_FRAMES, 'the bare desk: the last mallet note decays to nothing by the end'),
];

/** The validated cue sheet (picture and score). */
export const cues: CueSheet = CueSheet.parse({
  schemaVersion: 1,
  fps: FPS,
  filmFrames: FILM_FRAMES,
  leaderFrames: LEADER_FRAMES,
  grid: { bpm: BPM, beatsPerBar: BEATS_PER_BAR, offsetFrames: 0 },
  events,
});

/** A cue by id; throws on a typo, so a renamed cue cannot silently vanish from the picture. */
export function cue(id: string): CueEvent {
  const e = cues.events.find((x) => x.id === id);
  if (!e) throw new Error(`no cue '${id}' in src/cues.ts`);
  return e;
}
