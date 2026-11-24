/**
 * Bars 12-14: the record. In the browser, the same session's edit card: the read, the edit that
 * went through (+7 -1), its diff, and above it the "Record" the runtime wrote for that effect
 * ("wrote table.js · 641 B · sha256 3e895076e748"). The receipt lifts out of the card on the hit;
 * then the camera moves down the same page to the composer, where the permission act begins.
 */
import { easings } from '@aiv/core';
import { bump, prog, settle } from '@aiv/web-kit';
import { mixView, screenOf, show, type View } from '../captures.ts';
import { ACTS, HITS, at } from '../cues.ts';
import { SHADOW, SHADOW_NEAR } from '../look.ts';
import { pointer, titles, type ActModule } from './common.ts';
import { P_COMPOSER } from './permission.ts';
import { V_PAGE, browserFrame } from './handoff.ts';

/** the edit card: its rows, the Record and the start of the diff */
const V_CARD: View = { key: 'webDiff', rect: [480, 64, 760, 330], centre: [1130, 700], k: 2.05 };
/** the receipt chip itself (CSS px in the page) */
const CHIP = [512, 145, 318, 28] as const;

const PUSH = [ACTS.record, at(12, 4)] as const;
const LIFT = [HITS.receipt - 8, HITS.receipt + 12] as const;
const DOWN = [at(14, 3), ACTS.permission] as const;

export const record: ActModule = {
  needs: () => ['webDiff'],
  draw(f, c) {
    const push = prog(f, PUSH[0], PUSH[1], easings.inOutCubic);
    let v = mixView(V_PAGE, V_CARD, push);
    if (f >= DOWN[0]) v = mixView(V_CARD, { ...P_COMPOSER, key: 'webDiff' }, prog(f, DOWN[0], DOWN[1], easings.inOutCubic));
    browserFrame(c, v, 1 - push);
    const lift = f < DOWN[0] ? bump(f, LIFT[0], LIFT[1], DOWN[0] - 10) : 0;
    show(c.d, c.tex, v, { radius: 14, shadow: SHADOW, gain: 1 - 0.28 * lift });

    // the receipt lifts out of the card: the same pixels, nearer, with a closer shadow
    if (lift > 0) {
      const [x, y, w, h] = CHIP;
      const centre = screenOf(v, x + w / 2, y + h / 2);
      const s = 1 + 0.16 * lift * settle(f - LIFT[0], 5);
      const chip: View = { key: 'webDiff', rect: [x, y, w, h], centre: [centre[0], centre[1] - 18 * lift], k: v.k * s };
      show(c.d, c.tex, chip, { radius: 10, shadow: SHADOW_NEAR });
    }
    // the pointer leaves the sidebar as the card fills the frame
    if (f < PUSH[1]) {
      const from = screenOf(V_PAGE, 150, 178);
      pointer(c, [from[0] + 600 * push, from[1] + 700 * push]);
    }
    titles(f, c.d, 'record');
  },
};
