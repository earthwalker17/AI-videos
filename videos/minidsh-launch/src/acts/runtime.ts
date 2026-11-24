/**
 * Bars 27-34: one runtime, the climax. A pull-back finds the three surfaces of the film hanging
 * from one bar; they are drawn up into it and four paper strips unroll from it instead: MiniDSH
 * 2.0.0's src/ (app/ capabilities/ core/ kernel/) with its real module names. The four ways in dock
 * on app/ on the beats of bar 28. Then the callbacks, faster each time: a one-beat insert of a real
 * moment slams onto the module that did it and stamps it (the refused edit, Allow once, the kept
 * session, the model picker). On the bar-33 downbeat everything is lit and the teal dot lands as
 * the full stop of "One runtime."
 */
import { clamp, easings } from '@aiv/core';
import { settle, type StageTexture, type Vec2 } from '@aiv/web-kit';
import { CAPTURES, themed, type CaptureKey } from '../captures.ts';
import { ACTS, BEAT, HITS, TEXT_IN, TEXT_OUT, TITLES, at } from '../cues.ts';
import { PAL, SHADOW, SHADOW_NEAR, TITLE_X, TITLE_Y } from '../look.ts';
import { TUI_H, TUI_W } from '../tui.ts';
import type { ActModule, Ctx } from './common.ts';
import { BAR_SPAN, BAR_Y, CAPS, CORE, STRIPS, TITLE_DOT_R, about, drawMap, pt, rowBox, runtimeWords, titleDot, type MapState, type View } from './runtime-map.ts';

const R0 = ACTS.runtime;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ── the camera ────────────────────────────────────────────────────────────────────────────────

/** the pull-back finds the trio from the desktop's pane */
const PULL_FIX: Vec2 = [1522, 490];
/** the map's own move: in through the callbacks, back out to the lit whole, then a drift */
const PUSH_FIX: Vec2 = [1140, 610];

function camera(f: number): View {
  const pull = about(PULL_FIX, 1 + 0.3 * (1 - settle(f - R0, 16)));
  let k: number;
  if (f < at(28)) k = 1;
  else if (f < HITS.cbModels) k = 1 + 0.028 * easings.inOutSine((f - at(28)) / (HITS.cbModels - at(28)));
  else if (f < HITS.lit + 6) k = lerp(1.028, 0.985, easings.inOutCubic((f - HITS.cbModels) / (HITS.lit + 6 - HITS.cbModels)));
  else k = 0.985 + 0.016 * clamp((f - (HITS.lit + 6)) / (at(36) - HITS.lit - 6));
  const push = about(PUSH_FIX, k);
  return { k: push.k * pull.k, o: [push.o[0] + push.k * pull.o[0], push.o[1] + push.k * pull.o[1]] };
}

// ── the bar, the trio, the strips ─────────────────────────────────────────────────────────────

/** the bar's line while it holds the trio */
const BAR_A = 330;
const BAR_A_SPAN: Vec2 = [110, 1810];
const BAR_MOVE = [at(27, 4) - 16, at(28, 1) + 18] as const;
const RETRACT0 = at(27, 3) + 16;
/** strips unroll from here, one after another */
const UNROLL0 = at(28, 1) - 10;

interface Hang {
  key: CaptureKey | null;
  /** the texture px shown */
  crop: readonly [number, number, number, number];
  x0: number;
  w: number;
}
/** The film's three surfaces, as each last showed itself: the terminal's pass, the web's final turn, the desktop's kept session. */
const TRIO: readonly Hang[] = [
  { key: null, crop: [0, 0, TUI_W, TUI_H], x0: 130, w: 533 },
  { key: 'webFinal', crop: [0, 0, 1280 * CAPTURES.webFinal.scale, 800 * CAPTURES.webFinal.scale], x0: 693, w: 533 },
  { key: 'deskSessionWindow', crop: [0, 0, 1266, 753], x0: 1256, w: 533 },
];
const TERM_PAINT = 535;
const retract = (f: number, i: number): number => easings.inCubic(clamp((f - (RETRACT0 + 3 * i)) / 26));
const RETRACT_END = RETRACT0 + 6 + 26;

function bar(f: number): MapState['bar'] {
  const p = easings.inOutCubic(clamp((f - BAR_MOVE[0]) / (BAR_MOVE[1] - BAR_MOVE[0])));
  return { y: lerp(BAR_A, BAR_Y, p), x0: lerp(BAR_A_SPAN[0], BAR_SPAN[0], p), x1: lerp(BAR_A_SPAN[1], BAR_SPAN[1], p) };
}

/** The map's state at film frame `f` (the close act continues from it). */
export function mapAt(f: number): MapState {
  return {
    f,
    view: camera(f),
    bar: bar(f),
    unroll: STRIPS.map((_, i) => easings.outExpo(clamp((f - (UNROLL0 + 6 * i)) / 72))),
    light: easings.outCubic(clamp((f - (HITS.lit - 2)) / 8)),
  };
}

/** A pane of the trio hanging from the bar, drawn up into it by `lift` (0..1 of its height). */
function hang(c: Ctx, h: Hang, b: MapState['bar'], lift: number, v: View): void {
  const tex: StageTexture = h.key ? c.tex(themed(h.key)) : c.term(TERM_PAINT);
  const H = (h.w * h.crop[3]) / h.crop[2];
  const hidden = lift * H;
  if (hidden >= H - 0.5) return;
  const frac = hidden / H;
  const crop = [h.crop[0], h.crop[1] + h.crop[3] * frac, h.crop[2], h.crop[3] * (1 - frac)] as const;
  const top = b.y;
  const bottom = b.y + H - hidden;
  const centre = pt(v, h.x0 + h.w / 2, (top + bottom) / 2);
  const half: Vec2 = [(h.w / 2) * v.k, ((bottom - top) / 2) * v.k];
  c.d.screenPane(centre, half, tex, { crop, radius: 12 * v.k, shadow: SHADOW });
  if (!h.key) c.d.box(centre, half, 12 * v.k, PAL.chromeLine, { stroke: 1.4 });
}

// ── the callbacks ─────────────────────────────────────────────────────────────────────────────

interface Insert {
  hit: number;
  /** a capture, or null for the terminal's refused edit */
  key: CaptureKey | null;
  /** texture px */
  crop: readonly [number, number, number, number];
  /** design width; the height follows the crop */
  w: number;
  radius: number;
  /** where it pops up (design px) */
  from: Vec2;
  /** the rows it lands on */
  si: number;
  row: number;
  n: number;
}
const css = (k: CaptureKey, x: number, y: number, w: number, h: number) => {
  const s = CAPTURES[k].scale;
  return [x * s, y * s, w * s, h * s] as const;
};
/** paint 423: the refused edit, row 5 of the terminal ("✕ Edit file  src/table.js · FS_NOT_OBSERVED") */
const REFUSAL_PAINT = 423;
const INSERTS: readonly Insert[] = [
  { hit: HITS.cbRead, key: null, crop: [40, 342, 1112, 76], w: 640, radius: 8, from: [1150, 420], si: CAPS, row: 6, n: 1 },
  { hit: HITS.cbAllow, key: 'webApproval', crop: css('webApproval', 437, 451, 677, 336), w: 500, radius: 12, from: [1556, 566], si: CORE, row: 1, n: 1 },
  { hit: HITS.cbKept, key: 'deskSession', crop: css('deskSession', 438, 461, 640, 62), w: 600, radius: 9, from: [1120, 760], si: CAPS, row: 12, n: 1 },
  { hit: HITS.cbModels, key: 'deskModels', crop: css('deskModels', 853, 205, 196, 478), w: 172, radius: 8, from: [1330, 566], si: CAPS, row: 7, n: 3 },
];

/** One beat up, then it slams onto its rows; the stamp presses on the hit. */
function drawInsert(c: Ctx, ins: Insert, f: number, v: View): void {
  const t = f - (ins.hit - BEAT);
  if (t < 0 || f >= ins.hit) return;
  const tex = ins.key ? c.tex(themed(ins.key)) : c.term(REFUSAL_PAINT);
  const h = (ins.w * ins.crop[3]) / ins.crop[2];
  const pop = 0.9 + 0.1 * settle(t, 3);
  const slam = easings.inCubic(clamp((f - (ins.hit - 9)) / 9));
  const box = rowBox(ins.si, ins.row, ins.n);
  const x = lerp(ins.from[0], box.c[0], slam);
  const y = lerp(ins.from[1] - 6 * clamp(t / 21), box.c[1], slam);
  const hw = lerp((ins.w / 2) * pop, box.half[0], slam);
  const hh = lerp((h / 2) * pop, box.half[1], slam);
  const alpha = clamp(t / 4) * (1 - clamp((slam - 0.55) / 0.45));
  const centre = pt(v, x, y);
  const half: Vec2 = [hw * v.k, hh * v.k];
  const radius = lerp(ins.radius, 6, slam) * v.k;
  c.d.screenPane(centre, half, tex, { crop: ins.crop, radius, opacity: alpha, shadow: { ...SHADOW_NEAR, alpha: SHADOW_NEAR.alpha * (1 - slam) } });
  if (!ins.key) c.d.box(centre, half, radius, PAL.chromeLine, { stroke: 1.4, alpha });
}

// ── titles ────────────────────────────────────────────────────────────────────────────────────

/** The act's titles but "One runtime.", which is drawn with its teal full stop. */
function titles(f: number, c: Ctx): void {
  for (const t of TITLES) {
    if (t.act !== 'runtime' || t.id === 't-runtime') continue;
    const enter = clamp((f - (t.frame - TEXT_IN)) / TEXT_IN);
    const exit = clamp((f - t.end) / TEXT_OUT);
    if (enter <= 0 || exit >= 1) continue;
    c.d.text('title', t.text, TITLE_X, TITLE_Y, { enter, exit });
  }
  runtimeWords(f, c);
  // the teal dot drops into the full stop on the bar-33 downbeat
  const p = clamp((f - (HITS.lit - 14)) / 14);
  if (p > 0) {
    const d = titleDot(c);
    const y = d[1] - 120 * (1 - easings.inQuad(p));
    c.d.box([d[0], y], [TITLE_DOT_R, TITLE_DOT_R], TITLE_DOT_R, PAL.teal, { alpha: clamp(p * 5) });
  }
}

export const runtime: ActModule = {
  needs(f) {
    const keys: CaptureKey[] = [];
    if (f < RETRACT_END) for (const h of TRIO) if (h.key) keys.push(h.key);
    for (const ins of INSERTS) if (ins.key && f >= ins.hit - BEAT && f < ins.hit) keys.push(ins.key);
    return keys;
  },

  draw(f, c) {
    const m = mapAt(f);
    if (f < RETRACT_END) TRIO.forEach((h, i) => hang(c, h, m.bar, retract(f, i), m.view));
    drawMap(c, m);
    for (const ins of INSERTS) drawInsert(c, ins, f, m.view);
    titles(f, c);
  },
};
