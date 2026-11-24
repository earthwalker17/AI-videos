/**
 * Bars 21-26: the desktop app (Windows, the official 2.0.0 installer; its own session, a different
 * task on the same project). Its own window arrives under the title; the camera narrows onto its own
 * line ("A new session works in tinytable. Its log is kept; nothing it does is hidden from you.");
 * a cut on bar 23 to the whole window mid-turn (Working, the stop button), and the pointer closes
 * it on the quit hit (the close button lights red, as Windows does); the window
 * stops and recedes, collapses into the teal dot, rests, and reopens from it with the session kept
 * ("Stopped · The turn was cancelled before it finished.").
 */
import { clamp, easings } from '@aiv/core';
import { hex, prog, settle, type Vec2 } from '@aiv/web-kit';
import { mixView, screenOf, show, type CaptureKey, type View } from '../captures.ts';
import { ACTS, CUTS, HITS, at } from '../cues.ts';
import { PAL, SHADOW } from '../look.ts';
import { pointer, titles, world, type ActModule, type Ctx } from './common.ts';

/** The window captures are 1266 x 753 at 1x; their content area (the 3x captures' CSS px) starts at (1, 57). */
const WIN_W = 1266;
const WIN_H = 753;
const CONTENT_AT: Vec2 = [1, 57];
/** the whole window: 0.9x, its top at y 361, under the title zone */
const WIN: Vec2 = [1130, 700];
const WIN_K = 0.9;

const winView = (key: CaptureKey, k = 1, centre: Vec2 = WIN): View => ({ key, rect: [0, 0, WIN_W, WIN_H], centre, k: k * WIN_K });
/** A view (in window px) of a content rectangle, at a screen centre and scale. */
function contentWindowView(key: CaptureKey, rect: readonly [number, number, number, number], k: number, centre: Vec2): View {
  return { key, rect: [rect[0] + CONTENT_AT[0], rect[1] + CONTENT_AT[1], rect[2], rect[3]], centre, k };
}
/** The same view on the 3x content capture (its CSS px are the window's minus the content offset). */
function asContent(key: CaptureKey, v: View): View {
  return { key, rect: [v.rect[0] - CONTENT_AT[0], v.rect[1] - CONTENT_AT[1], v.rect[2], v.rect[3]], centre: v.centre, k: v.k };
}

/** the mark, the name and its line (content CSS px), read at 2.9x: the line's 12.5 px text at 36 px */
const HERO: readonly [number, number, number, number] = [470, 214, 586, 100];
const HERO_K = 2.9;
/** the kept session: the "Stopped" note, the composer and its context line, whole */
export const KEPT: readonly [number, number, number, number] = [424, 446, 680, 240];
export const KEPT_K = 2.65;
/** where the kept card sits on screen when read (the runtime act opens on this framing) */
export const KEPT_AT: Vec2 = [960, 708];
/** the window px of the content area's origin */
export { CONTENT_AT };

const ARRIVE = [ACTS.desktop, ACTS.desktop + 24] as const;
const PUSH = [at(21, 3), at(22, 3)] as const;
/** the cut to the whole window mid-turn, on bar 23: two seconds of it before the quit */
const MIDTURN = CUTS.window;
const COLLAPSE = [HITS.collapse - 20, HITS.collapse + 4] as const;
const STOPPING = [HITS.quit + 4, COLLAPSE[0]] as const;
const REOPEN = [HITS.reopen, HITS.reopen + 26] as const;
const READ_KEPT = [at(26, 2) - 10, at(26, 4)] as const;
/** the window's close button (window px) and Windows' red for it */
const CLOSE_BTN: readonly [number, number, number, number] = [1219, 1, 46, 29];
const CLOSE_RED = hex('#c42b1c');
/** the dot, the window's last trace: as large as the mark's dot reads, drifting while it rests */
const DOT_R = 17;
const DOT_REST: Vec2 = [1040, 640];

export const desktop: ActModule = {
  // from its line to the whole window mid-turn
  cuts: [MIDTURN],
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
      const drift = 1 + 0.03 * prog(f, PUSH[1], MIDTURN, easings.inOutSine);
      const hero = contentWindowView('deskReadyWindow', HERO, HERO_K * drift, [960, 690]);
      const v = mixView(winView('deskReadyWindow', k), hero, push);
      show(d, tex, v, { radius: 10 + 6 * push, shadow: SHADOW });
      const sharp = clamp((v.k - 1.25) / 0.25);
      if (sharp > 0) show(d, tex, asContent('deskReady', v), { radius: 10 + 6 * push, opacity: sharp });
    } else if (f < HITS.reopen) {
      // the whole window mid-turn; the pointer closes it; it stops, recedes, and collapses into the dot
      const stopping = prog(f, STOPPING[0], STOPPING[1], easings.inOutSine);
      const collapse = prog(f, COLLAPSE[0], COLLAPSE[1], easings.inCubic);
      const approach = prog(f, MIDTURN, HITS.quit, easings.inOutSine);
      const v = winView('deskBeforeQuitWindow', (1 + 0.05 * approach) * (1 - 0.1 * stopping) * (1 - 0.985 * collapse));
      if (collapse < 1) {
        show(d, tex, v, { radius: 10 * v.k, shadow: SHADOW, gain: 1 - 0.28 * stopping, opacity: 1 - 0.6 * clamp((collapse - 0.7) / 0.3) });
        closeButton(f, c, v);
      }
      if (collapse > 0.6 && collapse < 1) d.dot(world(WIN), DOT_R * clamp((collapse - 0.6) / 0.4), PAL.teal);
      if (collapse >= 1) {
        // the rest: the dot drifts a little toward the middle of the frame
        const q = prog(f, COLLAPSE[1], HITS.reopen, easings.inOutSine);
        d.dot(world([WIN[0] + (DOT_REST[0] - WIN[0]) * q, WIN[1] + (DOT_REST[1] - WIN[1]) * q]), DOT_R, PAL.teal);
      }
      // the pointer: in to the close button, pressed on the quit hit, then away
      if (f < COLLAPSE[0]) {
        const btn = screenOf(v, CLOSE_BTN[0] + CLOSE_BTN[2] / 2 + 4, CLOSE_BTN[1] + CLOSE_BTN[3] / 2 + 3);
        const from: Vec2 = [1640, 980];
        const q = prog(f, MIDTURN + 50, HITS.quit - 6, easings.inOutCubic);
        const away = prog(f, HITS.quit + 8, HITS.quit + 50, easings.inCubic);
        const press = clamp(1 - Math.abs(f - (HITS.quit - 1)) / 5);
        const tip: Vec2 = [from[0] + (btn[0] - from[0]) * q + 260 * away, from[1] + (btn[1] - from[1]) * q + 160 * away];
        pointer(c, tip, press);
      }
    } else {
      // reopened from the dot: the session is there, and the camera reads what became of the turn
      const open = prog(f, REOPEN[0], REOPEN[1], easings.outExpo);
      const read = prog(f, READ_KEPT[0], READ_KEPT[1], easings.inOutCubic);
      const centre: Vec2 = [DOT_REST[0] + (WIN[0] - DOT_REST[0]) * open, DOT_REST[1] + (WIN[1] - DOT_REST[1]) * open];
      const base = winView('deskSessionWindow', 0.02 + 0.98 * open, centre);
      const v = mixView(base, contentWindowView('deskSessionWindow', KEPT, KEPT_K, KEPT_AT), read);
      show(d, tex, v, { radius: 10 + 6 * read, shadow: SHADOW, opacity: clamp(open * 3) });
      if (open < 0.4) d.dot(world(DOT_REST), DOT_R * (1 - open / 0.4), PAL.teal);
      const sharp = clamp((v.k - 1.25) / 0.25);
      if (sharp > 0) show(d, tex, asContent('deskSession', v), { radius: 10 + 6 * read, opacity: sharp });
    }
    titles(f, d, 'desktop');
  },
};

/** The close button lights Windows' red under the pointer (hover), a shade deeper when pressed. */
function closeButton(f: number, c: Ctx, v: View): void {
  const hover = prog(f, HITS.quit - 10, HITS.quit - 6) * (1 - prog(f, HITS.quit + 10, HITS.quit + 16));
  if (hover <= 0) return;
  const [x, y, w, h] = CLOSE_BTN;
  const centre = screenOf(v, x + w / 2, y + h / 2);
  const half: Vec2 = [(w * v.k) / 2, (h * v.k) / 2];
  const pressed = clamp(1 - Math.abs(f - HITS.quit) / 4);
  c.d.box(centre, half, 4 * v.k, CLOSE_RED, { alpha: hover * (1 - 0.18 * pressed) });
  const s = 5 * v.k;
  c.d.path([[centre[0] - s, centre[1] - s], [centre[0] + s, centre[1] + s]], 1.1 * v.k, PAL.ink, { alpha: hover });
  c.d.path([[centre[0] + s, centre[1] - s], [centre[0] - s, centre[1] + s]], 1.1 * v.k, PAL.ink, { alpha: hover });
}
