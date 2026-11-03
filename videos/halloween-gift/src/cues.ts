/**
 * The film's one timeline (docs/ARCHITECTURE.md, decision 22): 40 bars of a 3/4 waltz at
 * 120 bpm, 24 fps. A beat is 12 frames, a bar 36, the film 1440 frames (60.0 s). The picture
 * (src/) and the score (audio/) both import this module, and it is in both input hashes, so a
 * timing change rebuilds both. Frames count from the end of the test-card leader.
 *
 * Imports only @aiv/core: the audio stage hashes this file on its own, so it may not pull in
 * other files of src/.
 */
import { CueSheet, type CueEvent } from '@aiv/core';

export const FPS = 24;
export const BPM = 120;
export const BEATS_PER_BAR = 3;
/** frames per beat (12) and per bar (36) */
export const BEAT = (FPS * 60) / BPM;
export const BAR = BEAT * BEATS_PER_BAR;
export const BARS = 40;
export const FILM_FRAMES = BARS * BAR;
/** the review cut's test card: one beat (0.5 s); 0 for the final (decision 24) */
export const LEADER_FRAMES = 12;

/** The film frame where bar `n` (1-based) beat `b` (1-based, fractions allowed) starts. */
export const at = (n: number, b = 1): number => Math.round((n - 1) * BAR + (b - 1) * BEAT);

/** Seconds of a film frame. */
export const sec = (f: number): number => f / FPS;

const hit = (id: string, frame: number, label?: string): CueEvent => ({ id, kind: 'hit', frame, ...(label ? { label } : {}) });
const mark = (id: string, frame: number, label?: string): CueEvent => ({ id, kind: 'mark', frame, ...(label ? { label } : {}) });
const span = (kind: 'rest' | 'silence' | 'black' | 'hold', id: string, frame: number, end: number, label?: string): CueEvent => ({ id, kind, frame, end, ...(label ? { label } : {}) });
const text = (kind: 'text' | 'card', id: string, frame: number, end: number, words: Record<string, string>): CueEvent => ({ id, kind, frame, end, text: words });

/** The on-screen words, per language: the cue sheet's reading-time checks use these strings. */
export const WORDS = {
  title: { en: 'A Halloween Gift', 'zh-Hans': '万圣节礼物' },
  caption1: { en: 'On Halloween night,\nClawd set out with a gift.', 'zh-Hans': '万圣节之夜，\nClawd 带着礼物出门了。' },
  caption2: { en: 'The last house was still awake.', 'zh-Hans': '最后一户人家，还没睡。' },
  couplet: { 'zh-Hans': '代码千行一次过 账号百年永不封 一路绿灯 福' },
  gift: { en: 'A GIFT FOR YOU' },
  email: { en: 'ACCOUNT SUSPENDED Suspicious signals detected. Happy Halloween! Appeal', 'zh-Hans': '封号 申诉' },
  end: { en: 'A Halloween Gift The End Fan parody. Not affiliated with Anthropic. Fictional email.', 'zh-Hans': '万圣节礼物 完 粉丝恶搞，与 Anthropic 无关，邮件纯属虚构。' },
} as const;

/** The knock, "shave and a haircut": five knocks; "two bits" never comes (that is silence 1). */
export const KNOCKS = [at(17, 1), at(17, 2), at(17, 2.5), at(17, 3), at(18, 1)];

const events: CueEvent[] = [
  // 1-3 · the closed book on the desk: the hook
  text('card', 'title', 0, at(4), WORDS.title),
  hit('lightning', 4, 'lightning flash on the cover'),
  hit('book-knock-1', at(2, 1), 'the book knocks from inside'),
  hit('book-knock-2', at(2, 3)),
  hit('cover-burst', at(4), 'the cover bursts open'),
  // 4-8 · the valley spread
  hit('pumpkin-light', at(5), 'the giant jack-o-lantern lights'),
  hit('clawd-pop', at(7), 'Clawd pops up'),
  text('text', 'caption-1', at(5, 2), at(8, 3), WORDS.caption1),
  // 9-12 · into the graveyard (one continuous world: no page turn)
  hit('gust', at(9), 'a cold gust as Clawd enters the graveyard'),
  hit('ghost-shoo', at(11, 2), 'ember flick shoos the ghost'),
  // 13-16 · the mist parts; the gates; the last house
  hit('mist-part', at(13), 'the ground mist parts before the gates'),
  hit('gate-creak', at(14), 'the gates creak open'),
  hit('gate-clang', at(15)),
  text('text', 'caption-2', at(14, 2), at(16, 3), WORDS.caption2),
  // 17-20 · the door: knock, silence, the user
  mark('arrive-door', at(17), 'the camera arrives at the door two-shot on the knock'),
  text('text', 'couplet', at(17), at(21), WORDS.couplet),
  ...KNOCKS.map((f, i) => hit(`knock-${i + 1}`, f)),
  span('silence', 'silence-1', at(18, 3), at(20), 'where "two bits" should be'),
  hit('door-creak', at(20), 'the door flap lifts'),
  // 21-24 · the gift
  hit('ta-da', at(22), 'Clawd produces the envelope'),
  hit('seal-crack', at(23), 'the wax seal cracks; the letter rises'),
  text('text', 'gift-face', at(23, 2), at(25), WORDS.gift),
  span('silence', 'silence-2', at(24), at(25), 'the slats quiver'),
  // 25-28 · the email
  hit('ding-1', at(25, 1), 'ding (two)'),
  hit('ding-2', at(25, 2), 'ding (bits): the slats flip'),
  hit('seal-thunk', at(26), 'the 封号 seal; every pumpkin goes out'),
  text('text', 'email', at(25, 3), at(29) - 2, WORDS.email),
  hit('appeal-snatch', at(27, 3), 'a bat snatches the Appeal tab'),
  // 29-33 · ghosted, the candy, the exit
  mark('pull-back', at(29)),
  hit('candy-drop', at(31), 'the user drops a candy in the pail'),
  hit('pail-relight', at(31, 2)),
  hit('wink', at(32)),
  hit('door-close', at(33)),
  hit('far-ding-1', at(33, 3), 'a far window flips cold'),
  hit('far-ding-2', at(33, 3.5)),
  // 34-40 · the book closes; the end card
  hit('book-slam', at(35), 'the book slams shut'),
  mark('out-of-book', at(35), 'the camera comes out of the book onto the desk as the cover slams'),
  text('card', 'end', at(35, 2), FILM_FRAMES, WORDS.end),
  hit('end-seal', at(36), 'the 完 seal'),
  hit('book-knock-3', at(38, 1), 'the closed book knocks again'),
  hit('book-knock-4', at(38, 3)),
  span('silence', 'silence-end', at(40), FILM_FRAMES, 'silent tail'),
];

export const cues = CueSheet.parse({
  schemaVersion: 1,
  fps: FPS,
  filmFrames: FILM_FRAMES,
  leaderFrames: LEADER_FRAMES,
  grid: { bpm: BPM, beatsPerBar: BEATS_PER_BAR, offsetFrames: 0 },
  events,
});

/** The frame of a cue by id (throws on a typo, so a renamed cue cannot silently drift). */
export function cue(id: string): number {
  const e = cues.events.find((x) => x.id === id);
  if (!e) throw new Error(`unknown cue '${id}'`);
  return e.frame;
}
