/**
 * Bars 21-26: the desktop app (Windows, the official 2.0.0 installer; its own session, a different
 * task on the same project). Its own window arrives; the camera reads its line ("A new session works
 * in tinytable. Its log is kept; nothing it does is hidden from you."); the window mid-turn on
 * Windows, where the shell is refused until asked; the pointer closes the window mid-turn on the
 * quit hit; the window collapses into the teal dot, rests, and reopens from it with the session
 * kept ("Stopped · The turn was cancelled before it finished.").
 */
import { clamp, easings } from '@aiv/core';
import { prog, settle, type Vec2 } from '@aiv/web-kit';
import { mixView, show, type CaptureKey, type View } from '../captures.ts';
import { ACTS, HITS, at } from '../cues.ts';
import { PAL, SHADOW } from '../look.ts';
import { pointer, titles, world, type ActModule } from './common.ts';

/** The window captures are 1266 x 753 at 1x; their content area (the 3x captures' CSS px) starts at (1, 57). */
const WIN_W = 1266;
const WIN_H = 753;
const CONTENT_AT: Vec2 = [1, 57];
const WIN: Vec2 = [1150, 612];

const winView = (key: CaptureKey, k = 1, centre: Vec2 = WIN): View => ({ key, rect: [0, 0, WIN_W, WIN_H], centre, k });
/** A view (in window px) of a content rectangle, at a screen centre and scale, right and low under the title. */
function contentWindowView(key: CaptureKey, rect: readonly [number, number, number, number], k: number): View {
  return { key, rect: [rect[0] + CONTENT_AT[0], rect[1] + CONTENT_AT[1], rect[2], rect[3]], centre: [1150, 700], k };
}
/** The same view on the 3x content capture (its CSS px are the window's minus the content offset). */
function asContent(key: CaptureKey, v: View): View {
  return { key, rect: [v.rect[0] - CONTENT_AT[0], v.rect[1] - CONTENT_AT[1], v.rect[2], v.rect[3]], centre: v.centre, k: v.k };
}

/** the hero line and the composer of the ready window */
const HERO: readonly [number, number, number, number] = [380, 218, 760, 284];
const HERO_K = 2.0;
/** the kept session: the "Stopped" note and the composer below it */
const KEPT: readonly [number, number, number, number] = [400, 380, 720, 300];
const KEPT_K = 2.0;

const ARRIVE = [ACTS.desktop, ACTS.desktop + 24] as const;
const PUSH = [at(22, 3), at(23, 2)] as const;
const MIDTURN = at(23, 3);
const CLOSE_AT: Vec2 = [WIN[0] + (1241 - WIN_W / 2), WIN[1] + (15 - WIN_H / 2)];
const COLLAPSE = [HITS.collapse - 20, HITS.collapse + 4] as const;
const REOPEN = [HITS.reopen, HITS.reopen + 26] as const;
const READ_KEPT = [at(26, 2), at(26, 4)] as const;

export const desktop: ActModule = {
  needs(f) {
    if (f < MIDTURN) return f < PUSH[0] ? ['deskReadyWindow'] : ['deskReadyWindow', 'deskReady'];
    if (f < HITS.reopen) return ['deskBeforeQuitWindow'];
    return f < READ_KEPT[0] ? ['deskSessionWindow'] : ['deskSessionWindow', 'deskSession'];
  },

  draw(f, c) {
    const { d, tex } = c;
    if (f < MIDTURN) {
      // the window arrives on the cut, then the camera narrows onto its own line (a crop, not a
      // bigger window), with the 3x content laid over the 1x window once it is magnified
      const k = 0.94 + 0.06 * settle(f - ARRIVE[0], 7);
      const push = prog(f, PUSH[0], PUSH[1], easings.inOutCubic);
      const v = mixView(winView('deskReadyWindow', k), contentWindowView('deskReadyWindow', HERO, HERO_K), push);
      show(d, tex, v, { radius: 10 + 6 * push, shadow: SHADOW });
      const sharp = clamp((v.k - 1.25) / 0.25);
      if (sharp > 0) show(d, tex, asContent('deskReady', v), { radius: 10 + 6 * push, opacity: sharp });
    } else if (f < HITS.reopen) {
      // mid-turn on Windows: the shell refused until asked; then the window is closed mid-turn
      const collapse = prog(f, COLLAPSE[0], COLLAPSE[1], easings.inCubic);
      if (collapse < 1) {
        const k = 1 - 0.985 * collapse;
        show(d, tex, winView('deskBeforeQuitWindow', k), { radius: 10 * k, shadow: SHADOW, opacity: 1 - 0.6 * clamp((collapse - 0.7) / 0.3) });
      }
      if (collapse > 0.6) d.dot(world(WIN), 9 * clamp((collapse - 0.6) / 0.4), PAL.teal);
      // the pointer: to the window's close button, pressed on the quit hit
      if (f < COLLAPSE[0]) {
        const q = prog(f, MIDTURN + 10, HITS.quit - 4, easings.inOutCubic);
        const from: Vec2 = [1500, 900];
        const press = clamp(1 - Math.abs(f - (HITS.quit - 2)) / 6);
        pointer(c, [from[0] + (CLOSE_AT[0] - from[0]) * q, from[1] + (CLOSE_AT[1] - from[1]) * q], press);
      }
    } else {
      // reopened from the dot: the session is there, and it opens
      const open = prog(f, REOPEN[0], REOPEN[1], easings.outExpo);
      const read = prog(f, READ_KEPT[0], READ_KEPT[1], easings.inOutCubic);
      const base = winView('deskSessionWindow', 0.02 + 0.98 * open);
      const v = mixView(base, contentWindowView('deskSessionWindow', KEPT, KEPT_K), read);
      show(d, tex, v, { radius: 10 + 6 * read, shadow: SHADOW, opacity: clamp(open * 3) });
      if (open < 0.4) d.dot(world(WIN), 9 * (1 - open / 0.4), PAL.teal);
      const sharp = clamp((v.k - 1.25) / 0.25);
      if (sharp > 0) show(d, tex, asContent('deskSession', v), { radius: 10 + 6 * read, opacity: sharp });
    }
    titles(f, d, 'desktop');
  },
};
