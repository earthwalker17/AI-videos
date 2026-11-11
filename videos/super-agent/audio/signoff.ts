/**
 * Bars 69-77 (f5440-6159): beats 11 and 12, the sign-off, the old ideas and the bookend (STORYBOARD 11.1-12.1, Sound
 * column), on BEAT_11's and END's contact frames. continuity.ts resolves bar 67's suspension on the stamp, holds the
 * Dmaj9 through `rest-signoff` at its rest level, brings the bass back for bars 71-73, and from bar 76 ticks once a
 * beat (the frame-0 rhythm) while the pad fades out to the dissolve.
 *
 *   11.1  `stamp`: your desk stamps the reply green: a felt stamp thump, and the motif completes as A4, D5, F♯5 (short:
 *         gone before the rest); the route's trace draws out and home as one slow scratching drag that follows it
 *         across the image (it starts on the stamp, outside the rest, and is so far down that the rest stays 20 dB
 *         under the mix); the four plates retire inside the rest, silently
 *   11.2  the six idea labels land as clicks on their beats, each at its part; the key sets (a soft print tap)
 *   11.3  for the beat the act-one card is up, the theme returns, softer: act one's first three folder motifs in D
 *         Dorian on muted marimba, in their 4:3:5 subdivisions, over the pad's suspension; the neck collar seats on
 *         your lamp's neck (a small detent)
 *   11.4  as your lamp turns to the next reply, the motif once at half speed (A4 then D5, a beat apart)
 *   12.1  `bookend`: as at f20 a slip turns vermilion: the motif once, with no felt-piano answer (and no F♮ falling
 *         after it)
 */
import { BEAT_11, END } from '../src/cues.ts';
import { LV, M, panned, type Desk } from './common.ts';
import { detent, inkClick, paperThump, printTap, sketchScratch } from './foley.ts';
import { marimba } from './instruments.ts';
import { SCREEN, X, panAt, screenPan } from './places.ts';

const { D3, A3, D4, F4, A4, C5, D5, Fs5 } = M;

/** The act-one theme for one card's beat: act one's folders 1-3 (their first notes, their own subdivisions over two beats: 4, 3 and 5 a bar). */
export const THEME: readonly { notes: readonly number[]; perBar: number; pan: number }[] = [
  { notes: [D4, F4], perBar: 4, pan: -0.1 },
  { notes: [D3, A3], perBar: 3, pan: 0.05 },
  { notes: [A4, C5, D5], perBar: 5, pan: -0.25 },
];

/** Where the trace is across the desk at film frame f: out from the chat spout to the request's bay, then home to your in-tray (summary.ts TRACE_F). */
export function traceX(f: number): number {
  const [o0, o1] = BEAT_11.trace.out;
  const [, h1] = BEAT_11.trace.home;
  if (f <= o1) return X.chatFeeder + (X.bugBay - X.chatFeeder) * Math.max(0, (f - o0) / (o1 - o0));
  return X.bugBay + (X.inTray - X.bugBay) * Math.min(1, (f - o1) / (h1 - o1));
}

/** The ticks this part marks (continuity.ts leaves those beats to it): the labels on 2 and 4, the key, the bookend. */
export const signoffBeats = (d: Desk): number[] => [...BEAT_11.ideas, BEAT_11.keyMap, END.bookend.turn].map((f) => d.f(f));

export function signoff(d: Desk): void {
  const { T, seed, m, music, foley } = d;
  const fps = T.ctx.fps;
  const B = BEAT_11;

  // ===== 11.1: the stamp, the motif completed, the drag along the trace ===========================================
  const stamp = d.f(B.stamp);
  const you = panAt(X.inTray, B.stamp);
  foley(stamp, paperThump(seed, 3), { part: 'stamp', db: LV.thump - 1, pan: you, sends: { hall: 0.1 } });
  d.motif(stamp, { pan: you, db: LV.motif, notes: [A4, D5, Fs5], tau: 0.22, until: m.signoff[0] });
  const [from] = B.trace.out;
  const [, to] = B.trace.home;
  const drag = sketchScratch(seed, { len: (to - from) / fps, k: 12 });
  foley(d.f(from), panned(drag, (t) => panAt(traceX(from + t * fps), from + t * fps)), { part: 'drag', db: LV.drag, pan: 0 });

  // ===== 11.2: the idea labels on their beats, the key ================================================================
  B.ideas.forEach((f, i) => foley(d.f(f), inkClick(seed, 30 + i), { part: 'label', db: LV.label, pan: screenPan(SCREEN.ideas[i]), sends: { hall: 0.12 } }));
  foley(d.f(B.keyMap), printTap(seed, 10), { part: 'key', db: LV.keySet, pan: screenPan(SCREEN.keyMap), sends: { hall: 0.1 } });

  // ===== 11.3: the act-one card, the theme softer; the collar seats ======================================================
  const card = d.f(B.actOneCard.rise);
  const cardPan = screenPan(SCREEN.actOneCard);
  THEME.forEach((v, i) =>
    v.notes.forEach((midi, j) => {
      const at = card + T.beats((j * 4) / v.perBar);
      music(at, marimba(midi, { seed, k: 7800 + 10 * i + j, vel: 0.55, bright: 0.2, tau: 0.5 }), { part: 'theme', db: LV.theme, pan: cardPan + v.pan, sends: { hall: 0.4 } });
    }),
  );
  foley(d.f(B.collar.to), detent(seed, 2), { part: 'collar', db: LV.collar, pan: panAt(X.lampHead, B.collar.to), sends: { hall: 0.1 } });

  // ===== 11.4: the motif once at half speed, as your lamp turns to the next reply ==========================================
  const turn = B.lampTurns[0];
  d.motif(d.f(turn), { pan: panAt(X.lampHead, turn), db: LV.motif - 3, step: 1, tau: 0.45 });

  // ===== 12.1: the bookend: the motif once, no answer ======================================================================
  d.motif(d.f(END.bookend.turn), { pan: -0.45, db: LV.motif - 2 });
}
