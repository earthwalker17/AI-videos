/**
 * Bars 27-34: one runtime, the climax. The act opens on the desktop act's last framing (the kept
 * session) and pulls back: the crop opens to the whole window, and the window turns out to hang
 * from one bar beside the web page and the terminal, overlapping, one cluster. They are drawn up
 * into the bar and four paper strips unroll from it instead: MiniDSH 2.0.0's src/ (app/
 * capabilities/ core/ kernel/) with every module name. The camera reads the four ways in as they
 * dock on app/ on the beats of bar 28, trucks right across the map on bar 29 and holds a close
 * framing where each callback's stamp prints at 36 px or more: a one-beat insert of a real moment
 * slams onto the module that did it and stamps it (the refused edit, Allow once, the kept session,
 * the model picker). It pulls back to the whole map for the bar-33 downbeat: everything lit, the
 * surfaces back at the outer ends of their ways in, and the teal dot lands as the full stop of
 * "One runtime."
 */
import { clamp, easings } from '@aiv/core';
import { settle, type StageTexture, type Vec2 } from '@aiv/web-kit';
import { CAPTURES, show, themed, type CaptureKey, type View as CaptureView } from '../captures.ts';
import { ACTS, BEAT, HITS, TEXT_IN, TEXT_OUT, TITLES, at } from '../cues.ts';
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
  SURFACE_KEYS,
  TERM_PAINT,
  TITLE_DOT_R,
  between,
  drawMap,
  framing,
  pt,
  rowBox,
  runtimeWords,
  titleDot,
  toward,
  unpt,
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
/** the four ways in and app/, their type at 37-39 px, under "Four ways in." */
const V_APP = framing([629, 300], [960, 330], 1.75);
/** capabilities/ and core/ rows 0-15, every stamp at 36 px or more, the bar clear of the title */
const V_CB = framing([1150, 300], [960, 300], 1.62);
/** the whole map and its surfaces */
const V_LIT = framing([954, 300], [930, 318], 0.9);

const PULL = [R0, R0 + 66] as const;
const PUSH = [R0 + 108, R0 + 148] as const;
/** the lateral truck across the map on bar 29, arriving a little before the first insert (at least 36 frames long if the callbacks move earlier) */
const TRUCK = [Math.min(Math.max(at(29, 1) + 14, HITS.cbRead - BEAT - 76), HITS.cbRead - BEAT - 40), HITS.cbRead - BEAT - 4] as const;
/** back out to the whole map, landing on the bar-33 downbeat (never sooner than the last stamp allows) */
const PULL_LIT = [Math.max(HITS.cbModels + 6, HITS.lit - 114), HITS.lit] as const;
const DRIFT_END = at(36);

const holdApp = (f: number): View => toward(V_APP, [960, 600], 1 + 0.015 * clamp((f - PUSH[1]) / (TRUCK[0] - PUSH[1])));
const holdCb = (f: number): View => toward(V_CB, [1000, 1000], 1 + 0.025 * clamp((f - TRUCK[1]) / (PULL_LIT[0] - TRUCK[1])));
const holdLit = (f: number): View => toward(V_LIT, [960, 560], 1 + 0.018 * clamp((f - (HITS.lit + 6)) / (DRIFT_END - HITS.lit - 6)));

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
    // the surfaces come back with the pull-back's last beat and land on the downbeat
    surfaces: easings.inOutCubic(clamp((f - (HITS.lit - 18)) / 18)),
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
  /** design width; the height follows the crop */
  w: number;
  radius: number;
  /** where it pops up, on the screen of the callbacks' framing */
  pop: Vec2;
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
  { hit: HITS.cbRead, key: null, crop: [40, 342, 1112, 76], w: 600, radius: 8, pop: [930, 600], si: CAPS, row: 8, n: 1 },
  { hit: HITS.cbAllow, key: 'webApproval', crop: css('webApproval', 437, 451, 677, 336), w: 440, radius: 12, pop: [1290, 760], si: CORE, row: 1, n: 1 },
  { hit: HITS.cbKept, key: 'deskSession', crop: css('deskSession', 438, 461, 640, 62), w: 540, radius: 9, pop: [900, 870], si: CAPS, row: 14, n: 1 },
  { hit: HITS.cbModels, key: 'deskModels', crop: css('deskModels', 853, 205, 196, 478), w: 150, radius: 8, pop: [1420, 640], si: CAPS, row: 9, n: 3 },
];

/** One beat up, then it slams onto its rows; the stamp presses on the hit. */
function drawInsert(c: Ctx, ins: Insert, f: number, v: View): void {
  const t = f - (ins.hit - BEAT);
  if (t < 0 || f >= ins.hit) return;
  const tex = ins.key ? c.tex(themed(ins.key)) : c.term(REFUSAL_PAINT);
  const from = unpt(V_CB, ins.pop);
  const h = (ins.w * ins.crop[3]) / ins.crop[2];
  const pop = 0.9 + 0.1 * settle(t, 3);
  const slam = easings.inCubic(clamp((f - (ins.hit - 9)) / 9));
  const box = rowBox(ins.si, ins.row, ins.n);
  const x = lerp(from[0], box.c[0], slam);
  const y = lerp(from[1] - 6 * clamp(t / 21), box.c[1], slam);
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
    if (f < RETRACT_END) keys.push('webFinal', 'deskSessionWindow');
    if (f < PULL[1]) keys.push('deskSession');
    for (const ins of INSERTS) if (ins.key && f >= ins.hit - BEAT && f < ins.hit) keys.push(ins.key);
    if (f >= HITS.lit - 18) keys.push(...SURFACE_KEYS);
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
