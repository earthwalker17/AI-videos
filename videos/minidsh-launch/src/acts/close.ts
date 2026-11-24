/**
 * Bars 35-42: the close. "One runtime" sinks away and the whole map (the bar, the strips, the ways
 * in, the session file) contracts into its teal full stop, which swells as it takes the map in and
 * becomes the subject: a flat teal dot of 40 px. It drops from there into MiniDSH's mark, which has
 * gathered at the centre large enough to own the frame, landing on bar 36; the tile gives under it
 * and settles. Then the mark scales down into the lockup as the name rises beside it, one motion.
 * The end card builds in three groups, each entering together and fully readable at the latest
 * cue among its lines (cues.ts): the lockup and the line; the install line, the dependency note and
 * the URL; the non-affiliation line and the note on the footage. It stands still while it is read;
 * its last frames are a still poster.
 */
import { clamp, easings } from '@aiv/core';
import { mix, settle, type Rgb, type Vec2 } from '@aiv/web-kit';
import { ACTS, HITS, TEXT_IN, title } from '../cues.ts';
import { PAL, SHADOW_NEAR, type StyleId } from '../look.ts';
import { DOT_R, MARK_UNITS, dotOf } from '../mark.ts';
import type { ActModule, Ctx } from './common.ts';
import { TITLE_DOT_R, drawMap, runtimeWords, titleDot } from './runtime-map.ts';
import { mapAt } from './runtime.ts';

const C0 = ACTS.close;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const cue = (id: string): number => title(id).frame;

// ── the beats ─────────────────────────────────────────────────────────────────────────────────

/** the map contracts into the dot as one object, accelerating */
const CONTRACT = [C0 + 4, C0 + 58] as const;
/** the dot drops from the full stop into the mark */
const DROP = [CONTRACT[1] + 2, HITS.mark] as const;
/** the mark gathers at the centre before the dot lands */
const MARK_IN = [HITS.mark - 52, HITS.mark - 6] as const;

/**
 * The end card's groups: each enters together and is fully readable at the latest cue among its
 * lines, so no line shows before its cue (the earlier lines of a group show later than theirs).
 */
const G1 = Math.max(cue('c-name'), cue('c-tag'));
const G2 = Math.max(cue('c-install'), cue('c-dep'), cue('c-url'));
const G3 = Math.max(cue('c-legal'), cue('c-real'));
/** the mark moves into the lockup; the name rises with the move's last stretch, once the tile has cleared its place */
const LOCK = [G1 - 64, G1 - 4] as const;
const NAME_IN = [G1 - 18, G1] as const;

// ── the end card ──────────────────────────────────────────────────────────────────────────────

/** the mark's 24-unit box at the landing (its dot 40 px across, its tile 275 px) and in the lockup, px */
const MARK_BIG = 300;
const MARK_S = 132;
const MARK_AT: Vec2 = [960, 520];
const GAP = 44;
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

/**
 * The mark's centre and box size at frame `f`: gathering at the centre, giving under the dot as it
 * lands (a damped dip and recovery), then moving into the lockup.
 */
function markPose(c: Ctx, f: number): { at: Vec2; s: number } {
  const p = easings.inOutCubic(clamp((f - LOCK[0]) / (LOCK[1] - LOCK[0])));
  const gather = 0.92 + 0.08 * settle(f - MARK_IN[0], 9);
  const t = f - HITS.mark;
  const give = t > 0 ? 1 - 0.07 * Math.sin((2 * Math.PI * t) / 20) * Math.exp(-t / 9) : 1;
  return { at: lerp2(MARK_AT, lockup(c).mark, p), s: lerp(MARK_BIG, MARK_S, p) * gather * give };
}

/** A group's entrance, 0..1, fully in at `g`. */
const groupIn = (f: number, g: number): number => clamp((f - (g - TEXT_IN)) / TEXT_IN);

/** A card line, rising through its baseline as one line. */
function line(c: Ctx, id: string, enter: number, style: StyleId, y: number, rgb: Rgb, x = 960, align: 'left' | 'centre' = 'centre'): void {
  if (enter > 0) c.d.text(style, title(id).text, x, y, { enter, rgb, align, by: 'line' });
}

function card(c: Ctx, f: number): void {
  const { d } = c;
  const a = clamp((f - MARK_IN[0]) / 12);
  if (a > 0) {
    const pose = markPose(c, f);
    const u = c.mark.width / MARK_UNITS;
    const half = tile(pose.s) / 2;
    d.screenPane(pose.at, [half, half], c.mark, {
      crop: [u, u, 22 * u, 22 * u],
      radius: (7 * pose.s) / MARK_UNITS,
      opacity: a,
      shadow: { ...SHADOW_NEAR, alpha: SHADOW_NEAR.alpha * a },
    });
  }

  // group 1: the name rises beside the mark as it settles into the lockup, the line with it
  const L = lockup(c);
  line(c, 'c-name', clamp((f - NAME_IN[0]) / (NAME_IN[1] - NAME_IN[0])), 'name', L.name[1], PAL.ink, L.name[0], 'left');
  const g1 = groupIn(f, G1);
  line(c, 'c-tag', g1, 'sub', TAG_Y, mix(PAL.ink, PAL.dim, 0.28));

  // group 2: the install line in a terminal chip, the dependency note, the URL
  const g2 = groupIn(f, G2);
  if (g2 > 0) {
    const it = title('c-install');
    const lay = d.type.layout('mono', it.text);
    const half: Vec2 = [lay.widths[0]! / 2 + 30, 36];
    const e = easings.outCubic(g2);
    d.box([960, PILL_Y + 8 * (1 - e)], half, 14, PAL.chrome, { alpha: e });
    d.box([960, PILL_Y + 8 * (1 - e)], half, 14, PAL.chromeLine, { alpha: e, stroke: 1.4 });
    d.text('mono', it.text, 960, PILL_Y + lay.cap / 2, { enter: g2, align: 'centre', by: 'line' });
  }
  line(c, 'c-dep', g2, 'small', DEP_Y, PAL.dim);
  line(c, 'c-url', g2, 'mono', URL_Y, PAL.ink);

  // group 3: the legal note and the footage note
  const g3 = groupIn(f, G3);
  line(c, 'c-legal', g3, 'small', LEGAL_Y, PAL.dim);
  line(c, 'c-real', g3, 'small', REAL_Y, PAL.dim);
}

/**
 * The teal dot: the full stop of "One runtime", swelling from 14 to 40 px as the map pours into it,
 * then a drop into the mark, landing on bar 36; then the mark's own, giving with the tile. Flat
 * teal, no glow.
 */
function dot(c: Ctx, f: number): void {
  const from = titleDot(c);
  const pose = markPose(c, f);
  const to = dotOf(pose.at, pose.s);
  const p = clamp((f - DROP[0]) / (DROP[1] - DROP[0]));
  // a small rise, then an accelerating fall into its place
  const x = lerp(from[0], to[0], easings.inOutSine(p));
  const y = lerp(from[1], to[1], easings.inQuad(p)) - 70 * Math.sin(Math.PI * p);
  const swell = easings.inOutCubic(clamp((f - CONTRACT[0]) / (DROP[1] - CONTRACT[0])));
  const r = f < DROP[1] ? lerp(TITLE_DOT_R, (DOT_R * MARK_BIG) / MARK_UNITS, swell) : (DOT_R * pose.s) / MARK_UNITS;
  c.d.box([x, y], [r, r], r, PAL.teal);
}

export const close: ActModule = {
  // the map draws no captures
  needs: () => [],
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
