/**
 * Bars 27-34: one runtime, the climax. The act opens on the desktop act's last framing (the kept
 * session) and pulls back: the crop opens to the whole window, and the window turns out to hang
 * from one bar beside the web page and the terminal, overlapping, one cluster. They are drawn up
 * into the bar and four paper strips unroll from it instead: MiniDSH 2.0.0's src/ (app/
 * capabilities/ core/ kernel/) with every module name. The camera reads the four ways in as they
 * dock in their column beside app/ on the beats of bar 28, trucks across the map on bar 29 and
 * holds a close framing where each callback's stamp prints at 36 px or more: a one-beat insert of
 * a real moment rises beside the module that did it (never over its row), and on the hit the insert
 * presses and the module is stamped (the refused edit, Allow once, the kept session, the model
 * picker). No framing cuts a label, strip or pane at the frame's edge: what is not wholly in frame
 * is wholly out of it, or a bold bleed (the long strips hanging past the bottom). It pulls back to
 * the whole map for the bar-33 downbeat, where the five stamped code paths are promoted and the
 * rest dims; the teal dot lands as the full stop of "One runtime."; and a slow push towards the
 * stamps carries the hold into the close, which contracts the map from wherever the push has got.
 */
import { clamp, easings } from '@aiv/core';
import { bump, settle, type StageTexture, type Vec2 } from '@aiv/web-kit';
import { CAPTURES, show, themed, type CaptureKey, type View as CaptureView } from '../captures.ts';
import { ACTS, BEAT, HITS, TITLES, at } from '../cues.ts';
import { PAL, SHADOW, SHADOW_NEAR, TITLE_X, TITLE_Y } from '../look.ts';
import { TUI_H, TUI_W } from '../tui.ts';
import type { ActModule, Ctx } from './common.ts';
import { CONTENT_AT, KEPT, KEPT_AT, KEPT_K } from './desktop.ts';
import {
  BAR_SPAN,
  BAR_Y,
  CAPS,
  CORE,
  STRIPS,
  TERM_PAINT,
  TITLE_DOT_R,
  between,
  drawMap,
  framing,
  pt,
  rowBase,
  runtimeWords,
  titleDot,
  titleMotion,
  toward,
  type MapState,
  type View,
} from './runtime-map.ts';

const R0 = ACTS.runtime;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const IDENTITY: View = { k: 1, o: [0, 0] };

// ── the cluster: the film's three surfaces hanging from one bar ───────────────────────────────

/** the bar's line while it holds them, and its span */
const BAR_A = 340;
const BAR_A_SPAN: Vec2 = [100, 1820];

/** The desktop window (1266 x 753 at 1x; its content capture starts at (1, 57)), in front, right. */
const WIN_W = 1266;
const WIN_H = 753;
const DESK_X0 = 1050;
const DESK_S = 740 / WIN_W;
/**
 * The desktop act's last framing (desktop.ts): its KEPT rectangle of the content, here in window
 * px, at KEPT_K screen px per window px, centred at [1010, 720], corner radius 16. The act opens
 * on exactly this picture. Keep these in step with desktop.ts.
 */
const KEPT_WIN = [KEPT[0] + CONTENT_AT[0], KEPT[1] + CONTENT_AT[1], KEPT[2], KEPT[3]] as const;
const KEPT_C: Vec2 = [KEPT_WIN[0] + KEPT_WIN[2] / 2, KEPT_WIN[1] + KEPT_WIN[3] / 2];
const K0 = KEPT_K / DESK_S;

/** The terminal and the web page, behind it to the left, smaller (farther), each overlapping the next by about an eighth. */
interface Hang {
  key: CaptureKey | null;
  /** the texture px shown */
  crop: readonly [number, number, number, number];
  x0: number;
  w: number;
}
const BEHIND: readonly Hang[] = [
  { key: null, crop: [0, 0, TUI_W, TUI_H], x0: 150, w: 470 },
  { key: 'webFinal', crop: [0, 0, 1280 * CAPTURES.webFinal.scale, 800 * CAPTURES.webFinal.scale], x0: 545, w: 600 },
];
/** once the window's crop has opened, the web page and then the terminal are lowered from the bar beside it */
const DROP0 = [R0 + 46, R0 + 38] as const;
const drop = (f: number, i: number): number => easings.outCubic(clamp((f - DROP0[i]!) / 24));

// ── the camera ────────────────────────────────────────────────────────────────────────────────

/** the desktop act's last picture, as a view of the cluster */
const V_START = framing([DESK_X0 + KEPT_C[0] * DESK_S, BAR_A + KEPT_C[1] * DESK_S], KEPT_AT, K0);
/**
 * The four ways in and app/, their type at 37-39 px, under "Four ways in.": the label column, app/
 * and capabilities/ wholly in frame, core/ just past the right edge (wholly out), capabilities/
 * hanging past the bottom.
 */
const V_APP = framing([STRIPS[CORE]!.x, BAR_Y], [1924, 330], 1.75);
/**
 * The callbacks: every stamp at 36 px or more, the label column wholly in frame (its left edge at
 * x 165, at least 155 after the hold's push), app/ capabilities/ core/ in frame, kernel/ just past
 * the right edge (wholly out); the bar clear of the title above it, core/sandbox/ (row 15) above
 * y 1020.
 */
const V_CB = framing([STRIPS[CAPS]!.x, BAR_Y], [912, 262], 1.62);
/** the whole map, its right edge at x 1800, the bar at y 300 under "One runtime." */
const V_LIT = framing([STRIPS[3]!.x + STRIPS[3]!.w, BAR_Y], [1800, 300], 0.9);

const PULL = [R0, R0 + 66] as const;
const PUSH = [R0 + 108, R0 + 148] as const;
/** the lateral truck across the map on bar 29, arriving a little before the first insert (at least 36 frames long if the callbacks move earlier) */
const TRUCK = [Math.min(Math.max(at(29, 1) + 14, HITS.cbRead - BEAT - 76), HITS.cbRead - BEAT - 40), HITS.cbRead - BEAT - 4] as const;
/** back out to the whole map, landing on the bar-33 downbeat (never sooner than the last stamp allows) */
const PULL_LIT = [Math.max(HITS.cbModels + 6, HITS.lit - 114), HITS.lit] as const;
/**
 * The lit hold is never dead: from the downbeat a slow push (7%) towards the stamped modules, about
 * a point low on them so the long strips' torn ends stay in frame; it runs on into the close, whose
 * contraction starts from wherever it has got.
 */
const LIT_PUSH = [HITS.lit, at(36)] as const;
const LIT_TO: Vec2 = [1300, 700];

const holdApp = (f: number): View => toward(V_APP, [960, 600], 1 + 0.015 * clamp((f - PUSH[1]) / (TRUCK[0] - PUSH[1])));
const holdCb = (f: number): View => toward(V_CB, [800, 800], 1 + 0.015 * clamp((f - TRUCK[1]) / (PULL_LIT[0] - TRUCK[1])));
const holdLit = (f: number): View => toward(V_LIT, LIT_TO, 1 + 0.07 * easings.inOutSine(clamp((f - LIT_PUSH[0]) / (LIT_PUSH[1] - LIT_PUSH[0]))));

function camera(f: number): View {
  const io = easings.inOutCubic;
  if (f < PULL[1]) return between(V_START, IDENTITY, io(clamp((f - PULL[0]) / (PULL[1] - PULL[0]))));
  if (f < PUSH[1]) return between(IDENTITY, V_APP, io(clamp((f - PUSH[0]) / (PUSH[1] - PUSH[0]))));
  if (f < TRUCK[0]) return holdApp(f);
  if (f < TRUCK[1]) return between(holdApp(TRUCK[0]), V_CB, io((f - TRUCK[0]) / (TRUCK[1] - TRUCK[0])));
  if (f < PULL_LIT[0]) return holdCb(f);
  if (f < PULL_LIT[1]) return between(holdCb(PULL_LIT[0]), V_LIT, io((f - PULL_LIT[0]) / (PULL_LIT[1] - PULL_LIT[0])));
  return holdLit(f);
}

// ── the bar, the cluster, the strips ──────────────────────────────────────────────────────────

/** drawn up into the bar left to right, after a look at the whole cluster */
const RETRACT0 = R0 + 90;
const retract = (f: number, i: number): number => easings.inCubic(clamp((f - (RETRACT0 + 4 * i)) / 22));
const RETRACT_END = RETRACT0 + 8 + 22;
/** the bar rises to the strips' line, and (once the cluster is gone) narrows to their span */
const BAR_RISE = [R0 + 102, R0 + 132] as const;
const BAR_NARROW = [R0 + 112, R0 + 140] as const;
/** strips unroll from here, one after another */
const UNROLL0 = R0 + 112;

function bar(f: number): MapState['bar'] {
  const p = easings.inOutCubic(clamp((f - BAR_RISE[0]) / (BAR_RISE[1] - BAR_RISE[0])));
  const q = easings.inOutCubic(clamp((f - BAR_NARROW[0]) / (BAR_NARROW[1] - BAR_NARROW[0])));
  return { y: lerp(BAR_A, BAR_Y, p), x0: lerp(BAR_A_SPAN[0], BAR_SPAN[0], q), x1: lerp(BAR_A_SPAN[1], BAR_SPAN[1], q) };
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

/** The terminal or the web page hanging from the bar, drawn up into it by `lift` (0..1 of its height). */
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

/**
 * The desktop window: on the cut exactly the desktop act's crop of its kept session; as the camera
 * pulls back the crop opens (holding its size on screen until it reaches the window's edges), with
 * the 3x content over the 1x window while magnified, as in the desktop act; then drawn up into the
 * bar like the others.
 */
function desk(c: Ctx, f: number, b: MapState['bar'], v: View): void {
  const lift = retract(f, 2);
  if (lift >= 1) return;
  const ks = DESK_S * v.k;
  // the crop: the kept card, opened as far as the pull-back has room for, inside the window
  const grow = K0 / v.k;
  const w = Math.min(WIN_W, KEPT_WIN[2] * grow);
  const h0 = Math.min(WIN_H, KEPT_WIN[3] * grow);
  const cx = clamp(KEPT_C[0], w / 2, WIN_W - w / 2);
  const cy = clamp(KEPT_C[1], h0 / 2, WIN_H - h0 / 2);
  // drawn up into the bar: the window's bottom rises (it is whole by then)
  const h = h0 - lift * WIN_H;
  if (h <= 0.5) return;
  const rect = [cx - w / 2, cy - h0 / 2, w, h] as const;
  const centre = pt(v, DESK_X0 + (rect[0] + w / 2) * DESK_S, b.y + (rect[1] + h / 2) * DESK_S);
  const e = clamp((v.k - 1) / (K0 - 1));
  const radius = lerp(12, 16, e);
  const view: CaptureView = { key: 'deskSessionWindow', rect, centre, k: ks };
  show(c.d, c.tex, view, { radius, shadow: SHADOW });
  const sharp = clamp((ks - 1.25) / 0.25);
  if (sharp > 0) show(c.d, c.tex, { key: 'deskSession', rect: [rect[0] - CONTENT_AT[0], rect[1] - CONTENT_AT[1], w, h], centre, k: ks }, { radius, opacity: sharp });
}

// ── the callbacks ─────────────────────────────────────────────────────────────────────────────

interface Insert {
  hit: number;
  /** a capture, or null for the terminal's refused edit */
  key: CaptureKey | null;
  /** texture px */
  crop: readonly [number, number, number, number];
  /**
   * the strip rows it covers, first and last: its top edge sits just above the first row's type and
   * its bottom just below the last row's, so it never cuts a line of type in half; its scale
   * follows (each insert's one key word reads at 36 px or more, noted at its crop)
   */
  rows: readonly [number, number];
  /** its right edge, design px: beside the module it stamps, never over that row */
  x1: number;
  radius: number;
  /**
   * a fixed scale (screen px per texture px in the callbacks' framing) for a crop shorter than its
   * rows, padded to their height with `bg`, a plain stretch of the same texture's background
   */
  k?: number;
  bg?: readonly [number, number, number, number];
}
const css = (k: CaptureKey, x: number, y: number, w: number, h: number) => {
  const s = CAPTURES[k].scale;
  return [x * s, y * s, w * s, h * s] as const;
};
/** design px between an insert and the strip it stands beside: 24 screen px in the callbacks' framing */
const NEAR = 24 / V_CB.k;
/** An insert's box in design px: centre and half size. */
function insertBox(ins: Insert): { c: Vec2; half: Vec2 } {
  const top = rowBase(ins.rows[0]) - 18;
  const bottom = rowBase(ins.rows[1]) + 6;
  const hh = (bottom - top) / 2;
  const hw = ins.k ? (ins.crop[2] * ins.k) / V_CB.k / 2 : (hh * ins.crop[2]) / ins.crop[3];
  return { c: [ins.x1 - hw, top + hh], half: [hw, hh] };
}

/**
 * paint 423: the refused edit, row 5 of the terminal ("✕ Edit file  src/table.js · FS_NOT_OBSERVED",
 * canvas y 354-406; the diff follows from 408): its 40 px glyphs at 37 px, padded to rows 5-6 with
 * the empty row above it, a row clear above fs-observation-policy/ (row 8), overhanging
 * capabilities/ into the gutter so it keeps clear of the label column
 */
const REFUSAL_PAINT = 423;
const REFUSAL_CROP = [52, 356, 1064, 50] as const;
const REFUSAL_BG = [52, 306, 1064, 44] as const;
/** the approval card's last two buttons: over capabilities/ rows 0-3, "Allow once" (16 px) at 41 px, left of core/approval/ */
const ALLOW_CROP = css('webApproval', 822, 722, 284, 60);
/** the kept session's note: over rows 11-14 left of capabilities/, "Stopped" (13 px) at 37 px, level with persistence-jsonl/ */
const KEPT_CROP = css('deskSession', 444, 463, 268, 54);
/** the model picker's names: DeepSeek's models, the anthropic group, its first model; over rows 2-13 left of the llm-* rows (clear of the session file below), the names (14 px) at 38 px */
const MODELS_CROP = css('deskModels', 858, 238, 134, 174);
const CAPS_X1 = STRIPS[CAPS]!.x + STRIPS[CAPS]!.w;
const INSERTS: readonly Insert[] = [
  { hit: HITS.cbRead, key: null, crop: REFUSAL_CROP, rows: [5, 6], x1: CAPS_X1 + 40 / V_CB.k, radius: 8, k: 0.926, bg: REFUSAL_BG },
  { hit: HITS.cbAllow, key: 'webApproval', crop: ALLOW_CROP, rows: [0, 3], x1: STRIPS[CORE]!.x - NEAR, radius: 12 },
  { hit: HITS.cbKept, key: 'deskSession', crop: KEPT_CROP, rows: [11, 14], x1: STRIPS[CAPS]!.x - NEAR, radius: 12 },
  { hit: HITS.cbModels, key: 'deskModels', crop: MODELS_CROP, rows: [2, 13], x1: STRIPS[CAPS]!.x - NEAR, radius: 12 },
];
/** an insert rises a beat before its hit, presses with the stamp on the hit, and leaves soon after */
const OUT = [6, 16] as const;
const insertLive = (ins: Insert, f: number): boolean => f >= ins.hit - BEAT && f < ins.hit + OUT[1];

/** One beat up beside its module, a press with the stamp on the hit, then it sinks away. */
function drawInsert(c: Ctx, ins: Insert, f: number, v: View): void {
  if (!insertLive(ins, f)) return;
  const t = f - (ins.hit - BEAT);
  const tex = ins.key ? c.tex(themed(ins.key)) : c.term(REFUSAL_PAINT);
  const leave = easings.inCubic(clamp((f - (ins.hit + OUT[0])) / (OUT[1] - OUT[0])));
  const pop = 0.94 + 0.06 * settle(t, 3);
  const press = 1 - 0.03 * bump(f, ins.hit - 3, ins.hit, ins.hit + 10);
  const s = pop * press * (1 - 0.05 * leave);
  const alpha = clamp(t / 4) * (1 - leave);
  const b = insertBox(ins);
  const centre = pt(v, b.c[0], b.c[1] + 10 * (1 - settle(t, 4)) + 14 * leave);
  const half: Vec2 = [b.half[0] * s * v.k, b.half[1] * s * v.k];
  const radius = (ins.radius / V_CB.k) * v.k;
  const shadow = { ...SHADOW_NEAR, alpha: SHADOW_NEAR.alpha * alpha };
  if (ins.bg && ins.k) {
    // the plain background to the rows' height, the crop at its own scale centred on it
    c.d.screenPane(centre, half, tex, { crop: ins.bg, radius, opacity: alpha, shadow });
    const ch = ((ins.crop[3] * ins.k) / V_CB.k / 2) * s * v.k;
    c.d.screenPane(centre, [half[0], ch], tex, { crop: ins.crop, opacity: alpha });
  } else {
    c.d.screenPane(centre, half, tex, { crop: ins.crop, radius, opacity: alpha, shadow });
  }
  // a dark contact edge, so a light card reads on the paper (and the dark terminal on the ink)
  c.d.box(centre, half, radius, ins.key ? PAL.paperInk : PAL.chromeLine, { stroke: (ins.key ? 2.4 : 1.6) * (v.k / V_CB.k), alpha: alpha * (ins.key ? 0.85 : 1) });
}

// ── titles ────────────────────────────────────────────────────────────────────────────────────

/** The act's titles but "One runtime.", which is drawn with its teal full stop; each rises as one line, none over another. */
function titles(f: number, c: Ctx): void {
  for (const t of TITLES) {
    if (t.act !== 'runtime' || t.id === 't-runtime') continue;
    const { enter, exit } = titleMotion(f, t.id);
    if (enter <= 0 || exit >= 1) continue;
    c.d.text('title', t.text, TITLE_X, TITLE_Y, { enter, exit, by: 'line' });
  }
  runtimeWords(f, c);
  // the teal dot drops into the full stop with the words' rise (over 6 frames at least), landing on the bar-33 downbeat
  const [w0, w1] = titleMotion(f, 't-runtime').in;
  const d0 = Math.min(w0, w1 - 6);
  const p = clamp((f - d0) / (w1 - d0));
  if (p > 0) {
    const d = titleDot(c);
    const y = d[1] - 120 * (1 - easings.inQuad(p));
    c.d.box([d[0], y], [TITLE_DOT_R, TITLE_DOT_R], TITLE_DOT_R, PAL.teal, { alpha: clamp(p * 5) });
  }
}

export const runtime: ActModule = {
  needs(f) {
    const keys: CaptureKey[] = [];
    if (f < RETRACT_END) keys.push('webFinal', 'deskSessionWindow');
    if (f < PULL[1]) keys.push('deskSession');
    for (const ins of INSERTS) if (ins.key && insertLive(ins, f)) keys.push(ins.key);
    return keys;
  },

  draw(f, c) {
    const m = mapAt(f);
    if (f < RETRACT_END) {
      BEHIND.forEach((h, i) => hang(c, h, m.bar, Math.max(1 - drop(f, i), retract(f, i)), m.view));
      desk(c, f, m.bar, m.view);
    }
    drawMap(c, m);
    for (const ins of INSERTS) drawInsert(c, ins, f, m.view);
    titles(f, c);
  },
};
