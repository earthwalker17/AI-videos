/**
 * Bars 10-11: the hand-off. A match cut on the sentence both surfaces show: the terminal's
 * "● Both tests pass." becomes the web UI's "Both tests pass." at the same place on screen, in the
 * same session, now in a browser. The camera pulls back to the whole page in a generic browser
 * frame (our own, on 127.0.0.1); the session sits in the sidebar. The pointer appears.
 */
import { easings } from '@aiv/core';
import { prog, type Vec2 } from '@aiv/web-kit';
import { mixView, show, type View } from '../captures.ts';
import { ACTS, at } from '../cues.ts';
import { PAL, SHADOW } from '../look.ts';
import { pointer, titles, type ActModule, type Ctx } from './common.ts';

/** The web page at the cut: its "Both tests pass." (CSS 454, 591) where the terminal showed it. */
export const V_MATCH: View = { key: 'webDiff', rect: [400, 330, 880, 520], centre: [1182, 503], k: 1.6 };
/** The whole page, framed in our browser window. */
export const V_PAGE: View = { key: 'webDiff', rect: [0, 0, 1280, 800], centre: [1172, 668], k: 0.94 };

const PULL = [at(10, 2), at(11, 2)] as const;

/** Our browser frame around a page view: a dark bar with an address pill. Not any real browser's. */
export function browserFrame(c: Ctx, v: View, opacity = 1): void {
  if (opacity <= 0) return;
  const w = v.rect[2] * v.k;
  const h = v.rect[3] * v.k;
  const bar = 46;
  const cx = v.centre[0];
  const top = v.centre[1] - h / 2 - bar;
  c.d.box([cx, top + (h + bar) / 2], [w / 2 + 8, (h + bar) / 2 + 8], 18, PAL.chrome, { alpha: opacity });
  for (let i = 0; i < 3; i++) c.d.box([cx - w / 2 + 26 + i * 22, top + bar / 2 + 4], [6, 6], 6, PAL.chromeLine, { alpha: opacity });
  const pill: Vec2 = [cx, top + bar / 2 + 4];
  c.d.box(pill, [170, 15], 15, PAL.chromeLine, { alpha: opacity });
  c.d.text('label', '127.0.0.1:20555', pill[0], pill[1] + 9, { align: 'centre', rgb: PAL.dim, alpha: opacity });
}

export const handoff: ActModule = {
  needs: () => ['webDiff'],
  draw(f, c) {
    const p = prog(f, PULL[0], PULL[1], easings.inOutCubic);
    const v = mixView(V_MATCH, V_PAGE, p);
    browserFrame(c, v, prog(f, PULL[0] + 10, PULL[1], easings.outCubic));
    show(c.d, c.tex, v, { radius: 12, shadow: SHADOW });
    // the pointer enters as the page settles, and rests by the session in the sidebar
    if (f > at(11, 1)) {
      const q = prog(f, at(11, 1), ACTS.record - 10, easings.inOutCubic);
      const sidebar: Vec2 = [v.centre[0] + (150 - 640) * v.k, v.centre[1] + (178 - 400) * v.k];
      pointer(c, [1700 + (sidebar[0] - 1700) * q, 1120 + (sidebar[1] - 1120) * q]);
    }
    titles(f, c.d, 'handoff');
  },
};
