/**
 * The runtime map: MiniDSH 2.0.0's src/ as four paper strips of receipt stock hanging from one bar,
 * each printed with its complete module list; the four ways in docked on app/; the stamps the
 * callbacks press; the session file on disk beside the strips (storage, not a layer); the four
 * surfaces back at the outer ends of their ways in once everything is lit; and "One runtime."
 * whose full stop is the teal dot. The runtime act draws it, and the close act draws its last state
 * contracting into the dot.
 *
 * Positions are design px; a `View` maps them to the screen (a uniform scale and a shift), so the
 * camera, and the close's contraction, move everything together, type included. Type is sized
 * against the camera (runtime.ts): module names print at 22.4 design px, texture in the lit wide
 * (k 0.9: 20 px) and 36 px or more in the framings that dock or stamp them (k 1.75 and 1.62); the
 * layer heads read at 36 px or more in every framing.
 */
import { clamp, easings } from '@aiv/core';
import { hex, mix, scale, settle, type Rgb, type StageTexture, type Vec2 } from '@aiv/web-kit';
import { CAPTURES, themed, type CaptureKey } from '../captures.ts';
import { HITS, TEXT_IN, TEXT_OUT, at, title } from '../cues.ts';
import { PAL, SHADOW_NEAR, TITLE_X, TITLE_Y } from '../look.ts';
import { TUI_H, TUI_W } from '../tui.ts';
import type { Ctx } from './common.ts';

// ── views ─────────────────────────────────────────────────────────────────────────────────────

/** screen = p * k + o */
export interface View {
  k: number;
  o: Vec2;
}
/** A view scaling by `k` about the screen point `fix`. */
export const about = (fix: Vec2, k: number): View => ({ k, o: [fix[0] * (1 - k), fix[1] * (1 - k)] });
/** `v`, then a contraction by `s` towards the screen point `to` (s > 1 pushes in). */
export const toward = (v: View, to: Vec2, s: number): View => ({ k: v.k * s, o: [to[0] + (v.o[0] - to[0]) * s, to[1] + (v.o[1] - to[1]) * s] });
/** A design point on the screen. */
export const pt = (v: View, x: number, y: number): Vec2 => [x * v.k + v.o[0], y * v.k + v.o[1]];
/** The view that puts design point `p` at screen point `s`, `k` screen px per design px. */
export const framing = (p: Vec2, s: Vec2, k: number): View => ({ k, o: [s[0] - p[0] * k, s[1] - p[1] * k] });
/** The design point under screen point `s`. */
export const unpt = (v: View, s: Vec2): Vec2 => [(s[0] - v.o[0]) / v.k, (s[1] - v.o[1]) / v.k];

/**
 * A camera move from `a` to `b`: a zoom about the one design point both views put at the same
 * screen point, its scale moving geometrically (a pull-back reads evenly), or a plain pan when the
 * scales are equal.
 */
export function between(a: View, b: View, t: number): View {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const k = a.k * Math.pow(b.k / a.k, t);
  const dk = a.k - b.k;
  if (Math.abs(dk) < 1e-6) return { k, o: [a.o[0] + (b.o[0] - a.o[0]) * t, a.o[1] + (b.o[1] - a.o[1]) * t] };
  const p: Vec2 = [(b.o[0] - a.o[0]) / dk, (b.o[1] - a.o[1]) / dk];
  const q = pt(a, p[0], p[1]);
  return { k, o: [q[0] - p[0] * k, q[1] - p[1] * k] };
}

// ── the strips ────────────────────────────────────────────────────────────────────────────────

export interface Strip {
  head: string;
  rows: readonly string[];
  x: number;
  w: number;
}

/**
 * MiniDSH v2.0.0 src/: the four layers of the one package, each with every module in it, folders
 * first and then files, as an editor's explorer lists them (checked against the 2.0.0 package
 * the official installer bundles: dist/ mirrors src/ one module per entry).
 */
export const STRIPS: readonly Strip[] = [
  {
    head: 'app/',
    rows: ['terminal/', 'web/', 'cli.ts', 'compose.ts', 'config.ts', 'headless.ts', 'home.ts', 'inspect.ts', 'present.ts', 'serve.ts', 'settings.ts', 'version.ts', 'web.ts'],
    x: 700,
    w: 184,
  },
  {
    head: 'capabilities/',
    rows: [
      'approval-headless/', 'attachments-local/', 'authority-presets/', 'compaction-basic/', 'composition-record/', 'context-runtime/',
      'credentials-local/', 'fs-local/', 'fs-observation-policy/', 'llm-anthropic/', 'llm-deepseek/', 'llm-openai/', 'llm-retry/',
      'model-roles/', 'persistence-jsonl/', 'protocol/', 'session-title/', 'settings-local/', 'shell-stdio/', 'skills/', 'spill-local/',
      'tool-browser/', 'tool-editor/', 'tool-history/', 'tool-jobs/', 'tool-shell/', 'tool-subagent/', 'tool-view-image/',
      'tool-web-search/', 'workspace-instructions/',
    ],
    x: 928,
    w: 356,
  },
  {
    head: 'core/',
    rows: [
      'agent/', 'approval/', 'attachments/', 'compaction/', 'credentials/', 'effects/', 'fs/', 'invariants/', 'jobs/', 'llm/', 'loop/',
      'metering/', 'persistence/', 'presets/', 'prompt/', 'sandbox/', 'session/', 'settings/', 'shell/', 'spill/', 'tools/',
      'ids.ts', 'json.ts', 'process.ts', 'scope.ts', 'text.ts',
    ],
    x: 1328,
    w: 196,
  },
  { head: 'kernel/', rows: ['bus.ts', 'context.ts', 'errors.ts', 'index.ts', 'tokens.ts'], x: 1568, w: 204 },
];
export const APP = 0;
export const CAPS = 1;
export const CORE = 2;

/** The bar the strips hang from (its centre line), in the strips' layout. */
export const BAR_Y = 300;
export const BAR_H = 30;
/** the bar's span over the strips */
export const BAR_SPAN: Vec2 = [STRIPS[0]!.x - 26, STRIPS[3]!.x + STRIPS[3]!.w + 26];

/** module names: Plex Mono 500 ('mono', 40 px) at 22.4 design px, so the stamped and docked framings print them at 36-40 px from a full-size raster */
const NS = 0.56;
/** layer heads: the large mono ('table', 66 px) at 40.9 design px, at least 36 px in every framing */
const HS = 0.62;
/** the ways in, the run line and the bar's label (37 px in the bar-28 framing) */
export const TS = 0.53;
/** the session file, read in the callbacks' framing (36 px there) */
const FS = 0.56;
const ROW = 24;
const HEAD_BASE = 57;
const RULE_Y = 70;
const ROW0 = 98;
const PAD_X = 16;

export const stripH = (s: Strip): number => ROW0 + (s.rows.length - 1) * ROW + 22;
export const rowBase = (row: number): number => BAR_Y + ROW0 + row * ROW;
/** Rows `row` .. `row + n - 1` of strip `si` as a box on the paper: centre and half size (design px). */
export function rowBox(si: number, row: number, n = 1): { c: Vec2; half: Vec2 } {
  const s = STRIPS[si]!;
  const top = rowBase(row) - 19;
  const bottom = rowBase(row + n - 1) + 7;
  return { c: [s.x + s.w / 2, (top + bottom) / 2], half: [s.w / 2 - 7, (bottom - top) / 2] };
}

/** The refusal's red, the terminal UI's own (#e5534b). */
export const RED = hex('#e5534b');

export interface Stamp {
  si: number;
  row: number;
  /** rows it spans (default 1) */
  n?: number;
  rgb: Rgb;
  /** the frame it lands */
  at: number;
}
/** What each callback lights: the real code path of the moment it recalls. */
export const STAMPS: readonly Stamp[] = [
  { si: CAPS, row: 8, rgb: RED, at: HITS.cbRead }, // fs-observation-policy/: the refused edit
  { si: CORE, row: 1, rgb: PAL.amber, at: HITS.cbAllow }, // core/approval/: Allow once
  { si: CORE, row: 15, rgb: PAL.amber, at: HITS.cbAllow + 4 }, // core/sandbox/: the refusal that asked for it
  { si: CAPS, row: 14, rgb: PAL.paperInk, at: HITS.cbKept }, // persistence-jsonl/: the kept session
  { si: CAPS, row: 9, n: 3, rgb: PAL.paperInk, at: HITS.cbModels }, // llm-anthropic/, llm-deepseek/, llm-openai/: the picker
];

export interface Tab {
  label: string;
  /** the app/ row it enters */
  row: number;
  /** the beat it docks on */
  at: number;
  /** plugs into that tab instead of the strip */
  into?: number;
}
/** The four ways in: each enters app/ where the code takes it. */
export const TABS: readonly Tab[] = [
  { label: 'terminal', row: 0, at: at(28, 2) },
  { label: 'web', row: 12, at: at(28, 3) },
  { label: 'desktop', row: 12, at: at(28, 4), into: 1 },
  { label: 'headless run', row: 5, at: at(29, 1) },
];

/** The session file persistence-jsonl writes: storage on disk beside the strips, not a layer. */
export const FILE = { label: 'sessions/<id>.jsonl', row: 14, at: HITS.cbKept + 5 } as const;

/** The terminal's last paint (its pass), shown wherever the film recalls the terminal as a whole. */
export const TERM_PAINT = 535;
/** The captures the lit map's surfaces show. */
export const SURFACE_KEYS: readonly CaptureKey[] = ['webFinal', 'deskSessionWindow'];

export interface MapState {
  /** the frame: stamps press by it */
  f: number;
  view: View;
  bar: { y: number; x0: number; x1: number };
  /** per strip, 0..1: how far it has unrolled from the bar */
  unroll: readonly number[];
  /** 0: the half-light of the callbacks; 1: lit */
  light: number;
  /** 0..1: the surfaces back at the ends of their ways in */
  surfaces: number;
  /** the close: everything contracting into a screen point, by element (0-3 strips, 4 tabs, 5 file, 6 bar, 7 surfaces) */
  shrink?: { to: Vec2; s: (el: number) => number };
}

const SHADE = hex('#05070a');
const TAB_RGB = hex('#2a2f38');
const TAB_LINE = hex('#4a515d');
const BAR_RGB = hex('#262a32');
const BAR_LIGHT = hex('#59606c');
const PAPER_DIM = scale(PAL.paper, 0.72);

/** an element's view: the camera, the strips hanging from wherever the bar is, and the close's contraction */
function viewOf(m: MapState, el: number): View {
  const dy = el === 6 ? 0 : m.bar.y - BAR_Y;
  const v: View = { k: m.view.k, o: [m.view.o[0], m.view.o[1] + dy * m.view.k] };
  return m.shrink ? toward(v, m.shrink.to, m.shrink.s(el)) : v;
}

const TAB_HALF = 13;
/** A tab's box (design px): its left and right edges and its centre line. */
export function tabBox(c: Ctx, k: number): { x0: number; x1: number; y: number } {
  const t = TABS[k]!;
  const w = c.d.type.layout('mono', t.label).widths[0]! * TS + 28;
  const x1 = t.into === undefined ? STRIPS[APP]!.x + 12 : tabBox(c, t.into).x0 + 10;
  return { x0: x1 - w, x1, y: rowBase(t.row) - 7 };
}

/** The tab's slide in: 0 off to the left, 1 docked (most of the way on its beat, a long tail after). */
const dock = (f: number, k: number): number => easings.outExpo(clamp((f - (TABS[k]!.at - 12)) / 34));

/** Draws the map. */
export function drawMap(c: Ctx, m: MapState): void {
  const { d } = c;
  // shadows on the ink: the strips', and the bar's
  for (let si = 0; si < STRIPS.length; si++) {
    const u = m.unroll[si]!;
    if (u <= 0) continue;
    const s = STRIPS[si]!;
    const v = viewOf(m, si);
    if (v.k < 0.02) continue;
    const h = stripH(s) * u;
    const lift = 0.7 + 0.3 * m.light;
    d.box(pt(v, s.x + s.w / 2 + 22, BAR_Y + h / 2 + 40), [(s.w / 2) * v.k, (h / 2) * v.k], 8 * v.k, SHADE, { alpha: 0.6 * lift, feather: 42 * v.k });
  }

  // the ways in, tucked under app/
  const tv = viewOf(m, 4);
  if (tv.k > 0.02) {
    for (let k = TABS.length - 1; k >= 0; k--) drawTab(c, m, tv, k);
  }
  drawSurfaces(c, m, viewOf(m, 7));
  drawFile(c, m, viewOf(m, 5));

  for (let si = 0; si < STRIPS.length; si++) drawStrip(c, m, si, viewOf(m, si));
  drawBar(c, m, viewOf(m, 6));
}

function drawTab(c: Ctx, m: MapState, v: View, k: number): void {
  const p = dock(m.f, k);
  if (p <= 0) return;
  const { d } = c;
  const b = tabBox(c, k);
  const slide = (1 - p) * -260;
  const a = clamp((m.f - (TABS[k]!.at - 12)) / 6);
  const cx = (b.x0 + b.x1) / 2 + slide;
  const half: Vec2 = [((b.x1 - b.x0) / 2) * v.k, TAB_HALF * v.k];
  d.box(pt(v, cx + 4, b.y + 8), half, 6 * v.k, SHADE, { alpha: 0.5 * a, feather: 10 * v.k });
  d.box(pt(v, cx, b.y), half, 5 * v.k, TAB_RGB, { alpha: a });
  d.box(pt(v, cx, b.y), half, 5 * v.k, TAB_LINE, { alpha: a, stroke: 1.3 * v.k });
  d.text('mono', TABS[k]!.label, ...pt(v, b.x0 + 14 + slide, b.y + 7.5), { scale: TS * v.k, rgb: PAL.ink, alpha: a });
}

/** The surfaces, back on the lit downbeat at the outer ends of their ways in: the terminal's pass, the run line, the web page, the desktop window. */
function drawSurfaces(c: Ctx, m: MapState, v: View): void {
  const p = m.surfaces;
  if (p <= 0 || v.k < 0.02) return;
  const { d } = c;
  const g = 0.9 + 0.1 * p;
  const slide = (1 - p) * -36;
  const pane = (right: number, cy: number, w: number, h: number, tex: StageTexture, crop: readonly [number, number, number, number], line: boolean) => {
    const centre = pt(v, right - w / 2 + slide, cy);
    const half: Vec2 = [(w / 2) * g * v.k, (h / 2) * g * v.k];
    d.screenPane(centre, half, tex, { crop, radius: 7 * v.k, opacity: p, shadow: { ...SHADOW_NEAR, alpha: SHADOW_NEAR.alpha * p } });
    if (line) d.box(centre, half, 7 * v.k, PAL.chromeLine, { stroke: 1.4 * v.k, alpha: p });
  };
  const term = tabBox(c, 0);
  pane(term.x0 - 16, term.y, 200, (200 * TUI_H) / TUI_W, c.term(TERM_PAINT), [0, 0, TUI_W, TUI_H], true);
  // the web page stands on its tab; the desktop window hangs from the outer end of its own, which plugs into the web's
  const web = tabBox(c, 1);
  const ws = CAPTURES.webFinal.scale;
  const wh = (190 * 800) / 1280;
  pane(web.x1 - 22, web.y - TAB_HALF - 3 - wh / 2, 190, wh, c.tex(themed('webFinal')), [0, 0, 1280 * ws, 800 * ws], false);
  const desk = tabBox(c, 2);
  const dh = (290 * 753) / 1266;
  pane(desk.x0 + 150, desk.y + TAB_HALF + 4 + dh / 2, 290, dh, c.tex('deskSessionWindow'), [0, 0, 1266, 753], false);
  // the headless run: its command line
  const run = tabBox(c, 3);
  const label = 'minidsh run';
  const w = d.type.layout('mono', label).widths[0]! * TS + 28;
  const cx = run.x0 - 16 - w / 2 + slide;
  const half: Vec2 = [(w / 2) * g * v.k, 15 * g * v.k];
  d.box(pt(v, cx + 4, run.y + 8), half, 6 * v.k, SHADE, { alpha: 0.45 * p, feather: 10 * v.k });
  d.box(pt(v, cx, run.y), half, 6 * v.k, PAL.term, { alpha: p });
  d.box(pt(v, cx, run.y), half, 6 * v.k, PAL.chromeLine, { alpha: p, stroke: 1.4 * v.k });
  d.text('mono', label, ...pt(v, cx, run.y + 7.5), { scale: TS * g * v.k, rgb: PAL.ink, alpha: p, align: 'centre' });
}

function drawFile(c: Ctx, m: MapState, v: View): void {
  const p = easings.outExpo(clamp((m.f - FILE.at) / 30));
  if (p <= 0 || v.k < 0.02) return;
  const { d } = c;
  const w = d.type.layout('mono', FILE.label).widths[0]! * FS + 32;
  const x1 = STRIPS[CAPS]!.x - 24;
  // it slides out from under capabilities/, where persistence-jsonl wrote it
  const cx = x1 - w / 2 + (1 - p) * (w * 0.8);
  const y = rowBase(FILE.row) - 3;
  const half: Vec2 = [(w / 2) * v.k, 16 * v.k];
  const a = clamp((m.f - FILE.at) / 4);
  d.box(pt(v, cx + 8, y + 16), half, 8 * v.k, SHADE, { alpha: 0.5 * a, feather: 16 * v.k });
  d.box(pt(v, cx, y), half, 7 * v.k, PAL.term, { alpha: a });
  d.box(pt(v, cx, y), half, 7 * v.k, PAL.dim, { alpha: a, stroke: 1.8 * v.k });
  d.text('mono', FILE.label, ...pt(v, cx - w / 2 + 16, y + 8), { scale: FS * v.k, rgb: PAL.ink, alpha: a });
}

function drawStrip(c: Ctx, m: MapState, si: number, v: View): void {
  const u = m.unroll[si]!;
  if (u <= 0 || v.k < 0.02) return;
  const { d } = c;
  const s = STRIPS[si]!;
  const H = stripH(s);
  const edge = BAR_Y + H * u;
  const cx = s.x + s.w / 2;
  const paper = mix(PAPER_DIM, PAL.paper, m.light);
  d.box(pt(v, cx, (BAR_Y + edge) / 2), [(s.w / 2) * v.k, ((edge - BAR_Y) / 2) * v.k], 3 * v.k, paper);
  // the bar's contact shadow on the paper
  d.box(pt(v, cx, BAR_Y + 16), [(s.w / 2) * v.k, 6 * v.k], 0, SHADE, { alpha: 0.22, feather: 9 * v.k });
  // a torn edge: the paper's teeth travel down with it
  teeth(c, v, s.x, s.w, edge, paper);

  const shown = (base: number) => clamp((edge - (base + 6)) / 16);
  const ink = PAL.paperInk;
  const head = shown(BAR_Y + HEAD_BASE);
  if (head > 0) {
    d.text('table', s.head, ...pt(v, s.x + PAD_X, BAR_Y + HEAD_BASE), { scale: HS * v.k, rgb: ink, enter: head });
    d.box(pt(v, cx, BAR_Y + RULE_Y), [(s.w / 2 - PAD_X) * v.k, 0.9 * v.k], 0, ink, { alpha: 0.3 * head });
  }
  // stamps under their names
  for (const st of STAMPS) if (st.si === si) stamp(c, v, st, m.f);
  const dim = 0.55 + 0.45 * m.light;
  s.rows.forEach((name, row) => {
    const base = rowBase(row);
    const e = shown(base);
    if (e <= 0) return;
    const lit = STAMPS.some((st) => st.si === si && row >= st.row && row < st.row + (st.n ?? 1) && m.f >= st.at) || (si === APP && TABS.some((t, k) => t.row === row && dock(m.f, k) > 0.85));
    d.text('mono', name, ...pt(v, s.x + PAD_X, base), { scale: NS * v.k, rgb: ink, alpha: lit ? 1 : dim, enter: e });
  });
}

/** The torn bottom edge of a strip: small diamonds in the paper's colour along `edge`. */
function teeth(c: Ctx, v: View, x: number, w: number, edge: number, rgb: Rgb): void {
  const n = Math.round(w / 12);
  const step = w / n;
  const h = (step / (2 * Math.SQRT2)) * v.k;
  const st = c.d.stage;
  st.space(false);
  for (let i = 0; i < n; i++) {
    const p = pt(v, x + (i + 0.5) * step, edge);
    st.shape([p[0], p[1], 0], [Math.SQRT1_2, Math.SQRT1_2, 0], [-Math.SQRT1_2, Math.SQRT1_2, 0], [h, h], 0, 0, 0, 0, rgb, 1, 0);
  }
}

/** A stamp: a rounded outline and fill in its colour, pressed with a quick drop onto the paper. */
function stamp(c: Ctx, v: View, st: Stamp, f: number): void {
  const t = f - st.at;
  if (t < 0) return;
  const { d } = c;
  const b = rowBox(st.si, st.row, st.n);
  const press = 1 - easings.outCubic(clamp(t / 5));
  const k = 1 + 0.3 * press;
  const half: Vec2 = [b.half[0] * k * v.k, b.half[1] * k * v.k];
  const p = pt(v, b.c[0], b.c[1]);
  // in the air it casts a shadow; on the paper the fresh ink settles
  if (press > 0) d.box([p[0] + 4 * press * v.k, p[1] + 7 * press * v.k], half, 6 * v.k, SHADE, { alpha: 0.28 * press, feather: 8 * v.k });
  const fresh = 1 - settle(t, 5);
  d.box(p, half, 6 * v.k, st.rgb, { alpha: 0.2 + 0.3 * fresh });
  d.box(p, half, 6 * v.k, st.rgb, { stroke: 2.2 * v.k });
}

function drawBar(c: Ctx, m: MapState, v: View): void {
  if (v.k < 0.02) return;
  const { d } = c;
  const { y, x0, x1 } = m.bar;
  const cx = (x0 + x1) / 2;
  const half: Vec2 = [((x1 - x0) / 2) * v.k, (BAR_H / 2) * v.k];
  d.box(pt(v, cx + 6, y + 18), half, (BAR_H / 2) * v.k, SHADE, { alpha: 0.6, feather: 18 * v.k });
  d.box(pt(v, cx, y), half, 7 * v.k, BAR_RGB);
  // lit from above: a highlight along its top edge, a darker underside
  d.box(pt(v, cx, y - BAR_H / 2 + 2), [((x1 - x0) / 2 - 6) * v.k, 0.9 * v.k], 0.9 * v.k, BAR_LIGHT);
  d.box(pt(v, cx, y + BAR_H / 2 - 3), [((x1 - x0) / 2 - 2) * v.k, 3 * v.k], 2 * v.k, SHADE, { alpha: 0.35, feather: 2 * v.k });
  const label = clamp(m.unroll[0]! * 3);
  if (label > 0) d.text('mono', 'src/', ...pt(v, x0 + 22, y + 7), { scale: TS * v.k, rgb: PAL.dim, alpha: label });
}

// ── "One runtime." ─────────────────────────────────────────────────────────────────────────────

/** The teal dot of the title, a flat crisp disc in place of its full stop. */
export const TITLE_DOT_R = 7;

/** Where the title's full stop sits (screen px). */
export function titleDot(c: Ctx): Vec2 {
  const w = c.d.type.layout('title', 'One runtime').widths[0]!;
  return [TITLE_X + w + 5 + TITLE_DOT_R, TITLE_Y - TITLE_DOT_R];
}

/** "One runtime" without its full stop, entering and leaving at its cues. */
export function runtimeWords(f: number, c: Ctx): void {
  const t = title('t-runtime');
  const enter = clamp((f - (t.frame - TEXT_IN)) / TEXT_IN);
  const exit = clamp((f - t.end) / TEXT_OUT);
  if (enter > 0 && exit < 1) c.d.text('title', 'One runtime', TITLE_X, TITLE_Y, { enter, exit });
}
