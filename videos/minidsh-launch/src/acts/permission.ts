/**
 * Bars 15-20: the permission. The follow-up typed in the browser (four real states), the page
 * scrolling through the live turn as the sandbox stops the write, the approval card pushed in flat
 * until it reads, the pointer pressing Allow once on the downbeat of bar 19, then a hard cut to the
 * receipt the runtime wrote, and a rest. Built as the pilot; the look check chose light panes.
 */
import { clamp, easings } from '@aiv/core';
import { prog, settle } from '@aiv/web-kit';
import { BOX, mixView, scrollBlend, screenOf, show, type CaptureKey, type View } from '../captures.ts';
import { ACTS, HITS, at } from '../cues.ts';
import { PAL, SHADOW } from '../look.ts';
import { pointer, titles, type ActModule, type Ctx } from './common.ts';

/**
 * The composer and the last turn at 2.6x (the UI's 14 px text at 36 px), 48 px clear of the frame's
 * sides and below the two-line title.
 */
export const P_COMPOSER: View = { key: 'webType4', rect: [426, 506, 700, 264], centre: [960, 700], k: 2.6 };
/** the approval card at 2.6x: its header, the command and the model's reason first (down to the code block) ... */
const P_CARD: View = { key: 'webApproval', rect: [430, 446, 690, 168], centre: [960, 680], k: 2.6 };
/** ... then down to the code block and the buttons as the pointer comes in */
const P_CARD_LOW: View = { ...P_CARD, rect: [430, 619, 690, 170], centre: [960, 700] };
/** after Allow once: the receipt the runtime wrote (a hard cut on the click), a band bleeding off both sides */
const P_RECEIPT: View = { key: 'webReceipt', rect: [439, 192, 666, 112], centre: [960, 640], k: 2.88 };

const TYPE_STEPS: readonly CaptureKey[] = ['webType1', 'webType2', 'webType3', 'webType4'];
const P0 = ACTS.permission;
const SEND = at(15, 3) + 4;
// the page scrolls: long enough that motion blur stays smooth; the two states cross at top speed
const TO_RUN = [SEND, SEND + 40] as const;
const TO_SANDBOX = [HITS.sandbox - 32, HITS.sandbox + 8] as const;
const TO_CARD = [HITS.approval - 28, HITS.approval + 2] as const;
const cross = (p: number) => clamp((p - 0.3) / 0.4);
const PAN = [at(18, 1), at(18, 3)] as const;
const PRESS = [HITS.allow - 8, HITS.allow - 4] as const;
const PUSH = [HITS.approval + 4, HITS.approval + 96] as const;
const CURSOR_IN = [at(18, 1), at(18, 4)] as const;

export const permission: ActModule = {
  // the hard cut from the pressed card to the receipt
  cuts: [HITS.allow],
  needs(f) {
    if (f < SEND) return [TYPE_STEPS[Math.min(3, Math.max(0, Math.floor((f - P0) / 12)))]!, 'webType4'];
    if (f < TO_RUN[1]) return ['webType4', 'webRun1'];
    if (f < TO_SANDBOX[0]) return ['webRun1'];
    if (f < TO_SANDBOX[1]) return ['webRun1', 'webRun6'];
    if (f < TO_CARD[0]) return ['webRun6'];
    if (f < TO_CARD[1]) return ['webRun6', 'webApproval'];
    if (f < HITS.allow) return ['webApproval'];
    return ['webReceipt'];
  },

  draw(f, c) {
    const { d, tex } = c;
    if (f < SEND) {
      const k = Math.min(3, Math.max(0, Math.floor((f - P0) / 12)));
      show(d, tex, { ...P_COMPOSER, key: TYPE_STEPS[k]! }, { radius: 18, shadow: SHADOW });
    } else if (f < TO_RUN[1]) {
      const p = prog(f, TO_RUN[0], TO_RUN[1], easings.inOutCubic);
      scrollBlend(d, tex, { ...P_COMPOSER, key: 'webRun1' }, 'webType4', 'webRun1', p, cross(p), { radius: 18, shadow: SHADOW });
    } else if (f < TO_SANDBOX[0]) {
      show(d, tex, { ...P_COMPOSER, key: 'webRun1' }, { radius: 18, shadow: SHADOW });
    } else if (f < TO_SANDBOX[1]) {
      const p = prog(f, TO_SANDBOX[0], TO_SANDBOX[1], easings.inOutCubic);
      scrollBlend(d, tex, { ...P_COMPOSER, key: 'webRun6' }, 'webRun1', 'webRun6', p, cross(p), { radius: 18, shadow: SHADOW });
    } else if (f < TO_CARD[0]) {
      show(d, tex, { ...P_COMPOSER, key: 'webRun6' }, { radius: 18, shadow: SHADOW });
    } else if (f < HITS.allow) {
      // the card arrives (the page scrolls to it), then the camera pushes in flat until it reads
      const arrive = prog(f, TO_CARD[0], TO_CARD[1], easings.inOutCubic);
      const push = prog(f, PUSH[0], PUSH[1], easings.inOutCubic);
      const pan = prog(f, PAN[0], PAN[1], easings.inOutCubic);
      const v = mixView(mixView({ ...P_COMPOSER, key: 'webApproval' }, P_CARD, push, 'webApproval'), P_CARD_LOW, pan, 'webApproval');
      if (f < TO_CARD[1]) scrollBlend(d, tex, v, 'webRun6', 'webApproval', arrive, cross(arrive), { radius: 18, shadow: SHADOW });
      else show(d, tex, v, { radius: 18, shadow: SHADOW });
      pressed(f, c, v);
      cursor(f, c, v);
    } else {
      // a hard cut on the click: the runtime's receipt, a snap-zoom settling, then a still rest
      const t = f - HITS.allow;
      const k = P_RECEIPT.k * (1 + 0.05 * (1 - settle(t, 4))) * (1 + 0.004 * easings.inOutSine(clamp(t / 240)));
      // the receipt fills the width (its words at 36 px), so it rests with a slow rise, not a push
      show(d, tex, { ...P_RECEIPT, k, centre: [960, 652 - 24 * easings.inOutSine(clamp(t / 240))] }, { radius: 14, shadow: SHADOW });
    }
    titles(f, d, 'permission');
  },
};

/** Allow once, pressed: the dark button lights a little under the pointer, held into the cut. */
function pressed(f: number, c: Ctx, v: View): void {
  const p = prog(f, PRESS[0], PRESS[1], easings.outCubic);
  if (p <= 0) return;
  const [bx, by, bw, bh] = BOX.allowOnce;
  const centre = screenOf(v, bx + bw / 2, by + bh / 2);
  c.d.box(centre, [(bw * v.k) / 2, (bh * v.k) / 2], 8 * v.k, PAL.paper, { alpha: 0.22 * p });
}

/** The pointer: in from the lower right, to Allow once, pressed on the downbeat of bar 19. */
function cursor(f: number, c: Ctx, v: View): void {
  if (f < CURSOR_IN[0]) return;
  const [bx, by, bw, bh] = BOX.allowOnce;
  const target = screenOf(v, bx + bw * 0.52, by + bh * 0.62);
  const from: [number, number] = [1760, 1130];
  const p = prog(f, CURSOR_IN[0], CURSOR_IN[1], easings.inOutCubic);
  const x = from[0] + (target[0] - from[0]) * p;
  const y = from[1] + (target[1] - from[1]) * p + Math.sin(p * Math.PI) * -40;
  const press = prog(f, PRESS[0], PRESS[1], easings.outCubic);
  pointer(c, [x, y], press);
}
