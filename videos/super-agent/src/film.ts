/**
 * The film: for a frame, pose the camera, draw the scene that is playing and set its type. Every
 * part is a pure function of the film frame, so any frame renders on its own.
 */
import { clamp, easings } from '@aiv/core';
import { CARD_BLOCKS, FILM_FRAMES, LINES, SECTIONS, at, type Line, type Tier } from './cues.ts';
import { Camera, mixPose, type Pose } from './kit/camera.ts';
import { Draw } from './kit/draw.ts';
import { FINISH, PALETTES, STYLES, mix, type PaletteName, type Rgb, type StyleId } from './kit/look.ts';
import type { Stage } from './kit/stage.ts';
import { TEXT_IN, TEXT_OUT, lineState, prog } from './kit/time.ts';
import type { Type } from './kit/type.ts';
import { batch } from './scenes/batch.ts';
import { cache } from './scenes/cache.ts';
import { close } from './scenes/close.ts';
import { evidence } from './scenes/evidence.ts';
import { flat } from './scenes/flat.ts';
import { gates } from './scenes/gates.ts';
import { levels, ROUTER_VIEW, WORKER_VIEW } from './scenes/levels.ts';
import { DROP, TAUT, lift, strataNames, you, YOU_HOME } from './scenes/lift.ts';
import type { Anchor, Place, Section } from './scenes/section.ts';
import { status } from './scenes/status.ts';
import { threads } from './scenes/threads.ts';
import { LEVEL, SLAB, edgeOn, plan, slab, strata } from './scenes/world.ts';

export interface FilmOptions {
  palette: PaletteName;
  /** sub-frames averaged per frame (motion blur); 1 draws the frame's own instant only */
  subframes: number;
}

// ── the camera: one rig, keyed on the grid ─────────────────────────────────────────────────────

/** Sections 4 to 7, in film order: each is one module (scenes/section.ts). */
const LATER: readonly Section[] = [gates, threads, batch, cache, evidence, status, close];

const KEYS: ReadonlyArray<readonly [number, Pose]> = [
  [0, plan(LEVEL.workers, 0, 20, 1.06)],
  [at(7, 1), plan(LEVEL.workers, 0, 20, 1.0)],
  [DROP, plan(LEVEL.workers, 0, 20, 1.0)],
  [TAUT + 14, strata()],
  [at(13, 1), strata(1.16)],
  [at(14, 1), ROUTER_VIEW],
  [at(20, 1), ROUTER_VIEW],
  [at(21, 1), WORKER_VIEW],
  [at(24, 3), WORKER_VIEW],
  ...LATER.flatMap((s) => s.keys),
];
for (let k = 1; k < KEYS.length; k++) {
  if (KEYS[k]![0] < KEYS[k - 1]![0]) throw new Error(`film: camera key at frame ${KEYS[k]![0]} comes before the one at ${KEYS[k - 1]![0]}`);
}

function poseAt(f: number): Pose {
  let k = 0;
  while (k + 1 < KEYS.length && f >= KEYS[k + 1]![0]) k++;
  const a = KEYS[k]!;
  const b = KEYS[Math.min(k + 1, KEYS.length - 1)]!;
  if (a === b || b[0] === a[0]) return a[1];
  return mixPose(a[1], b[1], easings.inOutCubic(clamp((f - a[0]) / (b[0] - a[0]))));
}

// ── the typesetter: where each line of the cue sheet sits ──────────────────────────────────────

const TIER_STYLE: Record<Tier, StyleId> = { h1: 'h1', h2: 'h2', h3: 'h3', sup: 'sup', stamp: 'stamp', num: 'num', verdict: 'verdict', label: 'label' };
const LEFT = 150;
const MARGIN = 120;

/** A block's place, set by hand; a function when it hangs on something in the scene. */
const PLACE: Record<string, Place> = {
  q: { x: 960, y: 322, align: 'centre' },
  few: { x: LEFT, y: 170, align: 'left' },
  youdo: { x: 960, y: 610, align: 'centre' },
  // the title stands on the Router's slab
  title: (d) => ({ x: 596, y: d.cam.project([0, LEVEL.router, -SLAB.halfD]).y - 28, align: 'left' }),
  proto1: { x: LEFT, y: 560, align: 'left' },
  ...Object.assign({}, ...LATER.map((s) => s.place ?? {})),
};

/** A line placed on its own, away from its block's stack. */
const LINE_PLACE: Record<string, (d: Draw) => Anchor> = {
  // the credit is a kicker over the title; the stamp lies on the Router's top, in front of its rail
  'title.by': (d) => ({ x: 600, y: d.cam.project([0, LEVEL.router, -SLAB.halfD]).y - 152, align: 'left' }),
  'title.not': (d) => ({ x: 600, y: d.cam.project([0, LEVEL.router, SLAB.halfD]).y - 14, align: 'left' }),
  ...Object.assign({}, ...LATER.map((s) => s.linePlace ?? {})),
};

/** Lines their scene sets beside a mark. */
const SCENE_SET = new Set<string>(['sess', 'ch.chat', 'ch.review', 'ch.mail', ...LATER.flatMap((s) => s.own ?? [])]);
/** Words that name you are coral: [first glyph, one past the last], by line. */
const YOU_GLYPHS: Record<string, ReadonlyArray<readonly [number, number]>> = {
  youdo: [[0, 3]],
  notyou: [[3, 6]],
  decide: [[0, 3], [10, 13]],
};
/** how far the scene steps back behind type that takes the frame */
const DIM: Partial<Record<Tier, number>> = { h1: 0.74, verdict: 0.6 };
/** under any other line, the ground is deepened a little, softly: what lies on planes beneath never reads through the words */
const SCRIM = 0.5;

function defaultAnchor(first: Line, type: Type): Anchor {
  const lay = type.layout(TIER_STYLE[first.tier], first.text);
  const rows = lay.widths.length;
  switch (first.tier) {
    case 'h1':
      return { x: 960, y: 540 + lay.cap / 2 - ((rows - 1) * lay.lineStep) / 2, align: 'centre' };
    case 'verdict':
      return { x: 960, y: 580, align: 'centre' };
    case 'num':
      return { x: 960, y: 620, align: 'centre' };
    case 'h2':
      return { x: LEFT, y: 286, align: 'left' };
    default:
      return { x: LEFT, y: 226, align: 'left' };
  }
}

const BLOCKS = new Map<string, Line[]>();
for (const l of LINES) BLOCKS.set(l.block, [...(BLOCKS.get(l.block) ?? []), l]);

function typeset(d: Draw, f: number): void {
  for (const [id, all] of BLOCKS) {
    const ls = all.filter((l) => !SCENE_SET.has(l.id));
    if (ls.length === 0) continue;
    const from = Math.min(...ls.map((l) => l.frame)) - TEXT_IN;
    const to = Math.max(...ls.map((l) => l.end)) + TEXT_OUT;
    if (f <= from || f >= to) continue;
    const first = ls[0]!;
    const place = PLACE[id];
    const a = typeof place === 'function' ? place(d) : (place ?? defaultAnchor(first, d.type));
    const dim = DIM[first.tier];
    if (dim) {
      const s = lineState(first.id, f);
      d.box([960, 540], [960, 540], 0, d.pal.ground[0], { alpha: dim * s.enter * (1 - s.exit) });
    }
    let y = a.y;
    let prev: StyleId | null = null;
    for (const l of ls) {
      const style = TIER_STYLE[l.tier];
      const lay = d.type.layout(style, l.text);
      const own = LINE_PLACE[l.id]?.(d);
      const at2 = own ?? a;
      if (!own && prev) y += STYLES[style].px * 1.02 + (prev === 'sup' || prev === 'stamp' ? 22 : 32);
      const s = lineState(l.id, f);
      // a line never leaves the title-safe frame: it is set smaller instead
      const room = at2.align === 'left' ? 1920 - MARGIN - at2.x : at2.align === 'right' ? at2.x - MARGIN : 2 * Math.min(at2.x - MARGIN, 1920 - MARGIN - at2.x);
      const fit = Math.min(1, room / lay.width);
      if (!dim && !CARD_BLOCKS.includes(id) && s.enter > 0 && s.exit < 1) {
        const w = lay.width * fit;
        const x0 = at2.align === 'left' ? at2.x : at2.align === 'centre' ? at2.x - w / 2 : at2.x - w;
        const top = (own ? own.y : y) - lay.cap * fit;
        const bottom = (own ? own.y : y) + (lay.widths.length - 1) * lay.lineStep * fit;
        d.box([x0 + w / 2, (top + bottom) / 2], [w / 2 + 56, (bottom - top) / 2 + 44], 60, d.pal.ground[0], { alpha: SCRIM * s.enter * (1 - s.exit), feather: 120 });
      }
      const spans = YOU_GLYPHS[l.id];
      const tint = spans ? (k: number): Rgb | undefined => (spans.some(([a0, a1]) => k >= a0 && k < a1) ? d.pal.you : undefined) : undefined;
      d.text(style, l.text, at2.x, own ? own.y : y, { align: at2.align, enter: s.enter, exit: s.exit, scale: fit, rgb: l.tier === 'stamp' ? mix(d.pal.bone, d.pal.ash, 0.35) : undefined, tint });
      if (!own) {
        y += (lay.widths.length - 1) * lay.lineStep * fit;
        prev = style;
      }
    }
  }
}

// ── the scenes ─────────────────────────────────────────────────────────────────────────────────

function scene(d: Draw, f: number): void {
  if (f < DROP) {
    slab(d, LEVEL.workers, LEVEL.workers);
    flat(d, f);
  } else if (f < SECTIONS.levels) lift(d, f);
  else if (f < SECTIONS.spine) {
    levels(d, f);
    // leaving the strata and coming back to them, the names and you are still there
    const e = edgeOn(d);
    you(d, YOU_HOME, e, e);
    strataNames(d, 1);
  } else (LATER.find((s) => f < s.to) ?? close).draw(d, f);
  typeset(d, f);
}

export class Film {
  constructor(
    private readonly stage: Stage,
    private readonly type: Type,
    private readonly opts: FilmOptions,
  ) {}

  /** Draw film frame `i` (0 is the first frame after the leader) onto the stage's canvas. */
  render(i: number): void {
    const pal = PALETTES[this.opts.palette];
    const n = Math.max(1, this.opts.subframes);
    this.stage.beginFrame();
    for (let s = 0; s < n; s++) {
      // the shutter is open around the frame's own instant
      const f = n === 1 ? i : i + ((s + 0.5) / n - 0.5) * FINISH.shutter;
      const cam = new Camera(poseAt(f));
      this.stage.beginSub(cam);
      scene(new Draw(this.stage, this.type, cam, pal, f), f);
      this.stage.endSub({ colours: pal.ground, centre: [960, 500], radius: [1050, 620] }, 1 / n);
    }
    const fade = prog(i, 0, 18, easings.outCubic) * (1 - prog(i, FILM_FRAMES - 24, FILM_FRAMES - 2, easings.inCubic));
    this.stage.present(fade);
  }
}

/** Every line must fit the frame at its style's size, or nearly: fail the page if one cannot. */
export function checkCopy(type: Type): void {
  for (const l of LINES) {
    const lay = type.layout(TIER_STYLE[l.tier], l.text);
    if (lay.width > (1920 - 2 * MARGIN) * 1.25) throw new Error(`film: line '${l.id}' is ${Math.round(lay.width)} px wide at its size; the frame has ${1920 - 2 * MARGIN}`);
  }
}

/** Line widths in reference px, for checking a layout by eye. */
export function copyWidths(type: Type): Array<{ id: string; tier: Tier; width: number }> {
  return LINES.map((l) => ({ id: l.id, tier: l.tier, width: Math.round(type.layout(TIER_STYLE[l.tier], l.text).width) }));
}
