/**
 * The film's frames: what each act draws at film frame `f` (fractional inside a frame: motion
 * blur averages sub-frames). Every function here is a pure function of `f` and the captures.
 *
 * Built so far: the permission act (bars 15-20), the pilot of the look. The other acts hold a
 * real still of their surface until they are built.
 */
import { clamp, easings } from '@aiv/core';
import { prog, settle, type Draw, type StageTexture } from '@aiv/web-kit';
import { BOX, scrollBlend, screenOf, show, mixView, themed, type CaptureKey, type View } from './captures.ts';
import { ACTS, TEXT_IN, TEXT_OUT, TITLES, actAt, at, HITS, type Act, type Tier } from './cues.ts';
import { PAL, SHADOW, TITLE_X, TITLE_Y, type Pal, type StyleId } from './look.ts';

export interface Ctx {
  d: Draw<StyleId, Pal>;
  tex: (k: CaptureKey) => StageTexture;
  cursor: StageTexture;
}

const TIER_STYLE: Record<Tier, StyleId> = { title: 'title', sub: 'sub', name: 'name', mono: 'mono', small: 'small' };

/** The scene titles (not the close card): upper-left zone, rising through their baseline. */
function titles(f: number, d: Draw<StyleId, Pal>, act: Act): void {
  for (const t of TITLES) {
    if (t.act !== act || t.act === 'close' || t.id === 't-hook') continue;
    const enter = clamp((f - (t.frame - TEXT_IN)) / TEXT_IN);
    const exit = clamp((f - t.end) / TEXT_OUT);
    if (enter <= 0 || exit >= 1) continue;
    d.text(TIER_STYLE[t.tier], t.text, TITLE_X, TITLE_Y, { enter, exit });
  }
}

// ── the permission act (bars 15-20) ─────────────────────────────────────────────────────────────

/** the composer and the last turn, the pane biased right and low under the title */
const P_COMPOSER: View = { key: 'webType4', rect: [400, 450, 780, 310], centre: [1000, 712], k: 2.25 };
/** the approval card, pushed in flat until its words read at 36 px */
const P_CARD: View = { key: 'webApproval', rect: [430, 446, 690, 345], centre: [1150, 712], k: 2.1 };
/** after Allow once: the receipt the runtime wrote (a hard cut on the click) */
const P_RECEIPT: View = { key: 'webReceipt', rect: [446, 196, 670, 118], centre: [960, 600], k: 2.7 };

const TYPE_STEPS: readonly CaptureKey[] = ['webType1', 'webType2', 'webType3', 'webType4'];
const P0 = ACTS.permission;
const SEND = at(15, 3) + 4;
const TO_RUN = [SEND, SEND + 28] as const;
const TO_SANDBOX = [HITS.sandbox - 22, HITS.sandbox + 4] as const;
const TO_CARD = [HITS.approval - 18, HITS.approval] as const;
const PUSH = [HITS.approval + 4, HITS.approval + 96] as const;
const CURSOR_IN = [at(18, 1), at(18, 4)] as const;

function permissionNeeds(f: number): CaptureKey[] {
  if (f < SEND) return [TYPE_STEPS[Math.min(3, Math.floor((f - P0) / 12))]!, 'webType4'];
  if (f < TO_RUN[1]) return ['webType4', 'webRun1'];
  if (f < TO_SANDBOX[0]) return ['webRun1'];
  if (f < TO_SANDBOX[1]) return ['webRun1', 'webRun6'];
  if (f < TO_CARD[0]) return ['webRun6'];
  if (f < TO_CARD[1]) return ['webRun6', 'webApproval'];
  if (f < HITS.allow) return ['webApproval'];
  return ['webReceipt'];
}

function permission(f: number, c: Ctx): void {
  const { d, tex } = c;
  if (f < SEND) {
    // the follow-up, typed in the composer: four real states of it, 12 frames apart
    const k = Math.min(3, Math.floor((f - P0) / 12));
    show(d, tex, { ...P_COMPOSER, key: TYPE_STEPS[k]! }, { radius: 18, shadow: SHADOW });
  } else if (f < TO_RUN[1]) {
    const p = prog(f, TO_RUN[0], TO_RUN[1], easings.inOutCubic);
    scrollBlend(d, tex, { ...P_COMPOSER, key: 'webRun1' }, 'webType4', 'webRun1', p, clamp((f - TO_RUN[0]) / 10), { radius: 18, shadow: SHADOW });
  } else if (f < TO_SANDBOX[0]) {
    show(d, tex, { ...P_COMPOSER, key: 'webRun1' }, { radius: 18, shadow: SHADOW });
  } else if (f < TO_SANDBOX[1]) {
    const p = prog(f, TO_SANDBOX[0], TO_SANDBOX[1], easings.inOutCubic);
    scrollBlend(d, tex, { ...P_COMPOSER, key: 'webRun6' }, 'webRun1', 'webRun6', p, clamp((f - TO_SANDBOX[0]) / 10), { radius: 18, shadow: SHADOW });
  } else if (f < TO_CARD[0]) {
    show(d, tex, { ...P_COMPOSER, key: 'webRun6' }, { radius: 18, shadow: SHADOW });
  } else if (f < HITS.allow) {
    // the card arrives (the page scrolls to it), then the camera pushes in flat until it reads
    const arrive = prog(f, TO_CARD[0], TO_CARD[1], easings.inOutCubic);
    const push = prog(f, PUSH[0], PUSH[1], easings.inOutCubic);
    const v = mixView({ ...P_COMPOSER, key: 'webApproval' }, P_CARD, push, 'webApproval');
    if (f < TO_CARD[1]) scrollBlend(d, tex, v, 'webRun6', 'webApproval', arrive, clamp((f - TO_CARD[0]) / 10), { radius: 18, shadow: SHADOW });
    else show(d, tex, v, { radius: 18, shadow: SHADOW });
    cursor(f, c, v);
  } else {
    // a hard cut on the click: the runtime's receipt, a snap-zoom settling, then a still rest
    const t = f - HITS.allow;
    const k = P_RECEIPT.k * (1 + 0.05 * (1 - settle(t, 4))) * (1 + 0.012 * clamp(t / 300));
    show(d, tex, { ...P_RECEIPT, k }, { radius: 14, shadow: SHADOW });
  }
  titles(f, d, 'permission');
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
  const press = f >= HITS.allow - 6 ? 1 - 0.16 * clamp(1 - Math.abs(f - (HITS.allow - 2)) / 6) : 1;
  // the arrow canvas is 18 x 25 units (4 px each) with its tip 2 units in; on screen 58 px tall
  const unit = (58 / 25) * press;
  const half: [number, number] = [9 * unit, 12.5 * unit];
  c.d.screenPane([x + half[0] - 2 * unit, y + half[1] - 2 * unit], half, c.cursor, { shadow: { offset: [0, 4], blur: 6, alpha: 0.35 } });
}

// ── placeholders until each act is built ────────────────────────────────────────────────────────

const HOLD: Partial<Record<Act, View>> = {
  hook: { key: 'webStart', rect: [0, 0, 1280, 800], centre: [1180, 620], k: 0.9 },
  terminal: { key: 'webTranscript', rect: [0, 0, 1280, 800], centre: [1180, 620], k: 0.9 },
  handoff: { key: 'webRun1', rect: [0, 0, 1280, 800], centre: [1180, 620], k: 0.9 },
  record: { key: 'webDiff', rect: [430, 180, 760, 400], centre: [1180, 680], k: 1.6 },
  desktop: { key: 'deskReadyWindow', rect: [0, 0, 1266, 753], centre: [1180, 640], k: 1.0 },
};

export function needs(f: number): CaptureKey[] {
  return [...new Set(rawNeeds(f).map(themed))];
}

function rawNeeds(f: number): CaptureKey[] {
  const act = actAt(f);
  if (act === 'permission') return permissionNeeds(f);
  const v = HOLD[act];
  return v ? [v.key] : [];
}

export function draw(f: number, c: Ctx): void {
  const act = actAt(f);
  if (act === 'permission') return permission(f, c);
  const v = HOLD[act];
  if (v) show(c.d, c.tex, v, { radius: 14, shadow: SHADOW });
  titles(f, c.d, act);
  if (act === 'close') c.d.text('name', 'MiniDSH 2.0', 960, 560, { align: 'centre', rgb: PAL.ink });
}

/**
 * Hard cuts: a frame's motion-blur sub-frames never cross one (each would show the other shot).
 * Act starts, and the click on Allow once.
 */
export const CUTS: readonly number[] = [...Object.values(ACTS).filter((f) => f > 0), HITS.allow].sort((a, b) => a - b);

/** A sub-frame instant `s` of frame `f`, kept on the frame's side of any cut between them. */
export function sameShot(f: number, s: number): number {
  for (const c of CUTS) if (Math.min(f, s) < c && c <= Math.max(f, s)) return f;
  return s;
}
