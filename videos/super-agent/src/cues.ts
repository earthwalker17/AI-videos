/**
 * The film's one timeline (docs/ARCHITECTURE.md, decision 22): 66 bars of 4/4 at 90 bpm, 30 fps.
 * A beat is 20 frames, a bar 80, the film 5280 frames (2:56.0). The picture (src/) and the score
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
export const BARS = 66;
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
 * - Narration (c1–c28) is one EN line over one zh-Hans line in the lower-left notes block.
 *   The zh lines follow the Netflix zh-Hans style (references/subtitles.md): no commas or
 *   full stops, a space for a pause, full-width ： and ？.
 * - Tags, the plate and the chart carry their own EN and zh strings. Where both languages read
 *   the same (numbers, "Router", "Worker"), the picture draws the string once.
 * - A '\n' is a line break the picture keeps (the end card).
 * - Every zh-Hans string waits for the user's sign-off (SCRIPT.md, "zh sign-off").
 */
export const WORDS = {
  // beat 1: the title cartouche and its credit subline
  title: { en: 'Who Routes the Agents?', 'zh-Hans': '谁来调度智能体？' },
  credit: { en: 'Super-agent, a design by DeepSeek’s Harness team', 'zh-Hans': 'Super-agent（超级智能体）· DeepSeek Harness 团队的设计' },

  // narration, C1–C28
  c1: { en: 'Your AI agents work in parallel. You can’t.', 'zh-Hans': 'AI 智能体可以并行 你却不能' },
  c2: { en: 'Each session knows one task. You must know them all.', 'zh-Hans': '每个 Session 只懂一件事 你得全记住' },
  c3: { en: 'In the authors’ experience, you can follow about 3–5.', 'zh-Hans': '据作者经验 一个人约能跟进 3–5 个' },
  c4: { en: 'You’ve quietly become their router.', 'zh-Hans': '你悄悄成了人肉 Router' },
  c5: { en: 'All in one session: it remembers, but is serial and muddled.', 'zh-Hans': '全塞进一个 Session：记得住 却串行又串味' },
  c6: { en: 'One per event: fast, but disconnected, and all reply to you.', 'zh-Hans': '一事一个 Session：快 但互不相通 都来找你' },
  c7: { en: 'Continuity or speed: must we pick one?', 'zh-Hans': '连续性和速度 只能二选一？' },
  c8: { en: 'Super-agent keeps both, on two levels.', 'zh-Hans': 'Super-agent 用双层架构 两者兼得' },
  c9: { en: 'Above: one long-lived Router hears every channel.', 'zh-Hans': '上层：常驻的 Router 接收各渠道消息' },
  c10: { en: 'It hands each task over whole and never does the work.', 'zh-Hans': '任务整个派出 它从不亲自动手' },
  c11: { en: 'Below: each task gets its own Worker, context and tools.', 'zh-Hans': '下层：一事一个 Worker 上下文与工具独立' },
  c12: { en: 'Workers report up. Only the Router talks to you.', 'zh-Hans': 'Worker 向上汇报 只有 Router 和你说话' },
  c13: { en: 'Sessions become an implementation detail, not your burden.', 'zh-Hans': 'Session 成了实现细节 不再是你的负担' },
  c14: { en: 'By design: rules drop most noise; a model judges the rest.', 'zh-Hans': '按设计：规则滤掉大半噪声 余下由模型判断' },
  c15: { en: 'Can one Router keep up? Waiting events go in together.', 'zh-Hans': 'Router 忙得过来吗？排队的事件合并处理' },
  c16: { en: 'Stress test: ~40× the load, less average time per decision.', 'zh-Hans': '压测：负载约 40 倍 决策均摊耗时反而更短' },
  c17: { en: 'Follow-ups in a Thread go straight to its Worker.', 'zh-Hans': '同一 Thread 的后续 直通它的 Worker' },
  c18: { en: 'Not faster tasks: about 23% fewer Router decisions.', 'zh-Hans': '任务不会更快 但 Router 决策约少 23%' },
  c19: { en: 'Their test is synthetic: ~300 messages, ~20 work requests.', 'zh-Hans': '模拟实验：约 300 条消息 约 20 个工作请求' },
  c20: { en: 'Slowest tasks: about half the time of a single session.', 'zh-Hans': '最慢的任务：耗时约为单 Session 的一半' },
  c21: { en: 'Typical tasks: only ~10% faster than the stronger baseline.', 'zh-Hans': '中位数：比更强的基线只快约 10%' },
  c22: { en: 'Left to choose, the single session never delegated.', 'zh-Hans': '自行决定时 单 Session 从未委派' },
  c23: { en: 'Two levels make delegation structural, at 2–4× the tokens.', 'zh-Hans': '双层架构把委派写进结构 代价 2–4 倍 token' },
  c24: { en: 'Proposed: a cloud loop that works while your laptop sleeps.', 'zh-Hans': '设想：云端常驻 你合上电脑它也不停' },
  c25: { en: 'Open risk: a hijacked loop could reach all connected machines.', 'zh-Hans': '未解风险：循环被劫持 相连机器都可能失守' },
  c26: { en: 'As models need less help, your attention becomes the limit.', 'zh-Hans': '单任务越来越不用人盯 瓶颈成了注意力' },
  c27: { en: 'So people move up: to decisions, and to sign-off.', 'zh-Hans': '于是人的角色上移：做决策 做验收' },
  c28: { en: 'Your agents work in parallel. By design, you don’t have to.', 'zh-Hans': '智能体照样并行 按设计 你不必再分身' },

  // the diagram's persistent labels
  router: { en: 'Router', 'zh-Hans': 'Router' },
  worker: { en: 'Worker', 'zh-Hans': 'Worker' },
  you: { en: 'you', 'zh-Hans': '你' },

  // beat 4: the built tag, scoped to the two levels; it ends before C12 (FACTS.md, open item 2)
  tagBuilt: { en: 'two levels: built in the public research prototype', 'zh-Hans': '双层架构：公开研究原型已实现' },
  // beat 5: the gate tag, and the stress plate (a header and two rows of endpoints)
  tagGate: { en: 'prototype: proactive pickup off by default', 'zh-Hans': '原型：主动接单默认关闭' },
  plateHead: { en: 'stress test · mock Workers', 'zh-Hans': '压测 · 模拟 Worker' },
  plateArrivals: { en: '~1 → ~40 /min', 'zh-Hans': '~1 → ~40 /min' },
  plateDecision: { en: '6.4 s → 1.6 s avg', 'zh-Hans': '6.4 s → 1.6 s avg' },
  // beat 6: the timetable's header tag, lane names, legend (drawn beside a dot and a bar) and token header
  tagChart: { en: 'synthetic test · re-plotted · indicative only', 'zh-Hans': '模拟实验 · 本片重绘 · 仅供参考' },
  laneOne: { en: 'one session', 'zh-Hans': '单 Session' },
  laneTold: { en: 'one session, told to delegate', 'zh-Hans': '被要求委派的单 Session' },
  laneTwo: { en: 'two levels', 'zh-Hans': '双层架构' },
  legendTypical: { en: 'typical', 'zh-Hans': '中位' },
  legendSlowest: { en: 'slowest', 'zh-Hans': '最慢' },
  tokenHead: { en: 'cache-read tokens per run', 'zh-Hans': '每次运行的缓存读取 token' },
  // beat 7: the proposed tag, beside the dashed parts
  tagProposed: { en: 'proposed · not in the public prototype', 'zh-Hans': '设想 · 公开原型未实现' },

  // beat 9: the end card, and its line-style key (each entry beside a swatch of its line)
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

/** The narration cue ids in order: c1 … c28 (TREATMENT.md's C1–C28). */
export const NARRATION = Array.from({ length: 28 }, (_, i) => `c${i + 1}`) as readonly WordsId[];

/** The nine story beats: each starts on a downbeat and is marked `beat-<n>` in the sheet. */
export const BEATS = [
  { id: 'beat-1', bar: 1, name: 'Hook' },
  { id: 'beat-2', bar: 6, name: 'You’ve become the router' },
  { id: 'beat-3', bar: 11, name: 'Two easy fixes' },
  { id: 'beat-4', bar: 17, name: 'Two levels (the turn)' },
  { id: 'beat-5', bar: 28, name: 'Keeping up' },
  { id: 'beat-6', bar: 37, name: 'What the test shows' },
  { id: 'beat-7', bar: 46, name: 'Still open' },
  { id: 'beat-8', bar: 50, name: 'Sign-off, rest, meaning' },
  { id: 'beat-9', bar: 57, name: 'Bookend and credits' },
] as const;

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

  // 1 · Hook (bars 1-5): the request sinks in the noise; the title cartouche
  hit('request', at(1, 2), 'one pill turns vermilion: the request motif, A4 then D5, on FM mallet'),
  line('c1', at(1, 2), at(2, 4)),
  hit('title-thump', at(3), 'the camera starts to ease out: a low felt-piano D and a soft thump'),
  shown('card', 'title', at(3), at(5, 4), WORDS.title),
  shown('text', 'credit', at(3, 3), at(5, 4), WORDS.credit),

  // 2 · You've become the router (bars 6-10)
  line('c2', at(6), at(7, 3.5)),
  line('c3', at(7, 3.5), at(9, 2)),
  hit('hub', at(10), 'the hops stop dead; the interchange ring closes round you: a low felt-piano D and an ink scratch'),
  line('c4', at(9, 2), at(10, 4)),

  // 3 · Two easy fixes (bars 11-16)
  line('c5', at(11, 2), at(13, 1.5)),
  line('c6', at(13, 1.5), at(15)),
  line('c7', at(15), at(16, 2.5)),
  span('rest', 'rest-breath', at(16, 3), at(17), 'the half-bar breath: a Dsus2 hangs, then near silence'),

  // 4 · Two levels, the turn (bars 17-27)
  hit('turn', at(17), 'the ink arrives: every voice collapses into one D-major unison arpeggio'),
  line('c8', at(17), at(18, 3)),
  line('c9', at(18, 3), at(20, 1.5)),
  line('c10', at(20, 1.5), at(21, 4)),
  line('c11', at(21, 4), at(23, 3.5)),
  shown('text', 'tag-built', at(22), at(23, 3.5), WORDS.tagBuilt),
  line('c12', at(23, 3.5), at(25, 2)),
  line('c13', at(25, 2), at(27)),
  span('rest', 'rest-27', at(27), at(28), 'the system runs on the beat, nothing new: the pad and two plucks'),

  // 5 · Keeping up (bars 28-36)
  line('c14', at(28), at(30)),
  shown('text', 'tag-gate', at(28, 3.5), at(30), WORDS.tagGate),
  line('c15', at(30), at(31, 4.5)),
  hit('batch', at(31), 'the first bundle goes in: the queued ticks release as one chord'),
  line('c16', at(31, 4.5), at(33, 4.5)),
  hit('plate-detent', at(32), 'the stress plate sets: a soft mechanical detent'),
  shown('text', 'plate', at(32), at(34), read(WORDS.plateHead, WORDS.plateArrivals, WORDS.plateDecision)),
  line('c17', at(33, 4.5), at(35, 2.5)),
  hit('flyover', at(35), 'the follow-up crosses over the Router: the motif an octave up, and the Router’s chord is skipped'),
  line('c18', at(35, 2.5), at(37)),

  // 6 · What the test shows (bars 37-45)
  shown('text', 'tag-chart', at(37, 1.5), at(46), WORDS.tagChart),
  line('c19', at(37, 1.5), at(38, 4.5)),
  line('c20', at(38, 4.5), at(40, 3.5)),
  shown('text', 'chart-lanes', at(38, 4.5), at(46), read(WORDS.laneOne, WORDS.laneTold, WORDS.laneTwo, WORDS.legendTypical, WORDS.legendSlowest)),
  line('c21', at(40, 3.5), at(42, 2.5)),
  line('c22', at(42, 2.5), at(44, 1.5)),
  line('c23', at(44, 1.5), at(46)),
  shown('text', 'chart-tokens', at(44, 2), at(46), WORDS.tokenHead),

  // 7 · Still open (bars 46-49)
  line('c24', at(46, 2), at(48)),
  shown('text', 'tag-proposed', at(46, 3), at(50), WORDS.tagProposed),
  span('silence', 'silence-intrusion', at(48), at(48, 3), 'two beats of silence before the intrusion'),
  hit('intrusion', at(48, 3), 'the hatched pill reaches the Router: a low D–E♭ minor second'),
  line('c25', at(48), at(50)),

  // 8 · Sign-off, rest, meaning (bars 50-56)
  hit('stamp', at(51), 'your ring stamps the reply: a felt stamp thump, and the motif completes as A4, D5, F♯5'),
  span('rest', 'rest-signoff', at(51, 3), at(53), 'the route traced at 0.5×: the held Dmaj9 and the scratching drag'),
  line('c26', at(53), at(54, 4.5)),
  line('c27', at(54, 4.5), at(56, 3.5)),

  // 9 · Bookend and credits (bars 57-66)
  hit('bookend', at(58, 2), 'as at f20 a pill turns vermilion: the motif once, with no felt-piano answer'),
  line('c28', at(57, 3), at(59, 3)),
  mark('dissolve', at(59, 3), 'dissolve to the bare ground, never to black'),
  shown('card', 'end', at(60), at(66, 4), WORDS.end),
  shown('text', 'end-key', at(60, 3), at(66, 4), read(WORDS.keySolid, WORDS.keyDashed, WORDS.keySketch)),
  span('hold', 'hold-end', at(60), at(66, 4), 'the end card is still: freezedetect allows it'),
  span('rest', 'rest-tail', at(66, 4), FILM_FRAMES, 'the bare ground: the last mallet note decays to nothing by the end'),
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
