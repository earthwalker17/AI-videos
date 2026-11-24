/**
 * Bars 35-42: the close. "One runtime" sinks away and the whole map (the bar, the strips, the ways
 * in, the session file, the surfaces) contracts into its teal full stop. The dot drops from there into MiniDSH's
 * mark, which has gathered at the centre, landing on bar 36; the mark then settles into the lockup
 * as the name rises beside it. The end card builds line by line at its cues and stands still while
 * it is read: the name, the positioning, the install line, the URL, the non-affiliation line and
 * the note on the footage. Its last frames are a still poster.
 */
import { clamp, easings } from '@aiv/core';
import { bump, mix, settle, type Rgb, type Vec2 } from '@aiv/web-kit';
import { ACTS, HITS, TEXT_IN, title } from '../cues.ts';
import { PAL, SHADOW_NEAR, type StyleId } from '../look.ts';
import { DOT_R, MARK_UNITS, dotOf } from '../mark.ts';
import type { ActModule, Ctx } from './common.ts';
import { SURFACE_KEYS, TITLE_DOT_R, drawMap, runtimeWords, titleDot } from './runtime-map.ts';
import { mapAt } from './runtime.ts';

const C0 = ACTS.close;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// ── the beats ─────────────────────────────────────────────────────────────────────────────────

/** the map contracts into the dot as one object, accelerating */
const CONTRACT = [C0 + 4, C0 + 58] as const;
/** the dot drops from the full stop into the mark */
const DROP = [CONTRACT[1] + 2, HITS.mark] as const;
/** the mark gathers at the centre before the dot lands */
const MARK_IN = [HITS.mark - 52, HITS.mark - 6] as const;
/** then settles into the lockup as the name rises */
const SETTLE = [HITS.mark + 12, title('c-name').frame - TEXT_IN - 2] as const;

// ── the end card ──────────────────────────────────────────────────────────────────────────────

/** the mark's 24-unit box at the landing and in the lockup, px */
const MARK_BIG = 212;
const MARK_S = 132;
const MARK_AT: Vec2 = [960, 488];
const GAP = 34;
const LOCK_Y = 236;

const TAG_Y = 392;
const PILL_Y = 504;
const DEP_Y = 586;
const URL_Y = 646;
const LEGAL_Y = 796;
const REAL_Y = 938;

const tile = (s: number): number => (s * 22) / MARK_UNITS;

/** The lockup: the mark's centre and the name's baseline start, centred as one unit. */
function lockup(c: Ctx): { mark: Vec2; name: Vec2 } {
  const lay = c.d.type.layout('name', 'MiniDSH 2.0');
  const t = tile(MARK_S);
  const left = 960 - (t + GAP + lay.widths[0]!) / 2;
  return { mark: [left + t / 2, LOCK_Y], name: [left + t + GAP, LOCK_Y + lay.cap / 2] };
}

/** The mark's centre and box size at frame `f`: at the centre for the landing, then in the lockup. */
function markPose(c: Ctx, f: number): { at: Vec2; s: number } {
  const p = easings.inOutCubic(clamp((f - SETTLE[0]) / (SETTLE[1] - SETTLE[0])));
  return { at: lerp2(MARK_AT, lockup(c).mark, p), s: lerp(MARK_BIG, MARK_S, p) };
}

/** A card line: enters at its cue (rising through its baseline) and stays. */
function line(c: Ctx, f: number, id: string, style: StyleId, y: number, rgb: Rgb, x = 960, align: 'left' | 'centre' = 'centre'): void {
  const t = title(id);
  const enter = clamp((f - (t.frame - TEXT_IN)) / TEXT_IN);
  if (enter > 0) c.d.text(style, t.text, x, y, { enter, rgb, align });
}

function card(c: Ctx, f: number): void {
  const { d } = c;
  // the mark: it gathers (a scale settling), dips as the dot lands, then moves into the lockup
  const a = clamp((f - MARK_IN[0]) / 12);
  if (a > 0) {
    const pose = markPose(c, f);
    const k = (0.92 + 0.08 * settle(f - MARK_IN[0], 9)) * (1 - 0.03 * bump(f, HITS.mark, HITS.mark + 3, HITS.mark + 16));
    const u = c.mark.width / MARK_UNITS;
    const half = (tile(pose.s) / 2) * k;
    d.screenPane(pose.at, [half, half], c.mark, {
      crop: [u, u, 22 * u, 22 * u],
      radius: ((7 * pose.s) / MARK_UNITS) * k,
      opacity: a,
      shadow: { ...SHADOW_NEAR, alpha: SHADOW_NEAR.alpha * a },
    });
  }

  const L = lockup(c);
  line(c, f, 'c-name', 'name', L.name[1], PAL.ink, L.name[0], 'left');
  line(c, f, 'c-tag', 'sub', TAG_Y, mix(PAL.ink, PAL.dim, 0.28));
  // the install line in a terminal chip
  const it = title('c-install');
  const ip = clamp((f - (it.frame - TEXT_IN)) / TEXT_IN);
  if (ip > 0) {
    const lay = d.type.layout('mono', it.text);
    const half: Vec2 = [lay.widths[0]! / 2 + 30, 36];
    const e = easings.outCubic(ip);
    d.box([960, PILL_Y + 8 * (1 - e)], half, 14, PAL.chrome, { alpha: e });
    d.box([960, PILL_Y + 8 * (1 - e)], half, 14, PAL.chromeLine, { alpha: e, stroke: 1.4 });
    d.text('mono', it.text, 960, PILL_Y + lay.cap / 2, { enter: ip, align: 'centre' });
  }
  line(c, f, 'c-dep', 'small', DEP_Y, PAL.dim);
  line(c, f, 'c-url', 'mono', URL_Y, PAL.ink);
  line(c, f, 'c-legal', 'small', LEGAL_Y, PAL.dim);
  line(c, f, 'c-real', 'small', REAL_Y, PAL.dim);
}

/** The teal dot: the full stop of "One runtime", then a drop into the mark, landing on bar 36; then the mark's own. */
function dot(c: Ctx, f: number): void {
  const from = titleDot(c);
  const pose = markPose(c, f);
  const to = dotOf(pose.at, pose.s);
  const p = clamp((f - DROP[0]) / (DROP[1] - DROP[0]));
  // a small rise, then an accelerating fall into its place
  const x = lerp(from[0], to[0], easings.inOutSine(p));
  const y = lerp(from[1], to[1], easings.inQuad(p)) - 70 * Math.sin(Math.PI * p);
  const r = lerp(TITLE_DOT_R, (DOT_R * pose.s) / MARK_UNITS, easings.inOutCubic(p));
  c.d.box([x, y], [r, r], r, PAL.teal);
}

export const close: ActModule = {
  // the lit map's surfaces contract with it
  needs: (f) => (f < CONTRACT[1] ? [...SURFACE_KEYS] : []),
  draw(f, c) {
    if (f < CONTRACT[1]) {
      const m = mapAt(f);
      const s = 1 - easings.inCubic(clamp((f - CONTRACT[0]) / (CONTRACT[1] - CONTRACT[0])));
      m.shrink = { to: titleDot(c), s: () => s };
      drawMap(c, m);
    }
    runtimeWords(f, c);
    card(c, f);
    dot(c, f);
  },
};
