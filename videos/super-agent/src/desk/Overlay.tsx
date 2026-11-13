/**
 * The Register Desk's DOM text layer: every line meant to be read, over the WebGL world
 * (docs/ARCHITECTURE.md decision 30). The notes come from the cue sheet (desk/onScreen.ts
 * narrationAt), set in the kit's NotesBlock lower left as the EN line alone. What zh is drawn is one
 * policy (look/zhInPicture.ts, the user's decisions of 2026-11-13 and 2026-11-14): no notes line and
 * no tag draws its zh, the role label "you · 你" does. The signed-off zh lines stay in the cue sheet
 * (WORDS), where the reading-time checks and the score read them. The role labels ("Router", "Worker",
 * "you · 你") sit on hairline leaders whose feet are projected through the same camera pose as the
 * world (camera.ts `project`), so they land on their objects at either pitch. All text in
 * `GREY_TEXT` layers (no LCD fringes), ≤ 136 px, fonts gated by useFont; nothing moves while read.
 */
import { progress } from '@aiv/core';
import type { CamPose } from '@aiv/remotion-kit';
import { AbsoluteFill } from 'remotion';
import { TEXT_IN, TEXT_OUT, WORDS, cue } from '../cues.ts';
import { cueReveal, narrationAt } from './onScreen.ts';
import { AS_TYPED, GREY_TEXT, Label, NotesBlock, lineWidth, revealState, type RevealState, type TextLook } from '../kit/text.tsx';
import type { FilmFonts } from '../look/fonts.ts';
import { NOTES, TYPE } from '../look/tokens.ts';
import { pictureLine, zhInPicture } from '../look/zhInPicture.ts';
import { project } from './camera.ts';
import { DESK_HEX } from './gl/desk.ts';
import { BAYS, DISPATCH_HOUSING, YOU, rectC, type P3 } from './layout.ts';

/**
 * Text colours of the Register Desk (synthesis §2, Palette): EN and zh; `secondary`, the tags' secondary tone (the zh
 * lines' grey), for a tag that must not outshine the print it stands beside (beat 8's load tag, R2-L3-08); `ink`, the
 * print's ink (gl/text.ts INK), for a leader's run and dot on light paper (TagSpec.paperEdge).
 */
export const TEXT_HEX = { en: '#ECE9E2', zh: '#BAB7AF', secondary: '#BAB7AF', leader: '#C9C6BE', ink: '#2A2B2A' } as const;

export function notesLookDesk(fonts: FilmFonts): { en: TextLook; zh: TextLook; tick: string } {
  return {
    en: { family: fonts.sans, weight: TYPE.notesEn.weight, size: TYPE.notesEn.size, color: TEXT_HEX.en, numeric: 'tabular-nums' },
    zh: { family: fonts.sans, weight: TYPE.notesZh.weight, size: TYPE.notesZh.size, color: TEXT_HEX.zh },
    tick: TEXT_HEX.en,
  };
}

/** A role label: its text, the world point its leader's foot sits on, and where the label goes from there (screen px). */
export interface RoleLabel {
  text: string;
  foot: P3;
  /** from the foot to the label's baseline start (anchor start) or end (anchor end) */
  dx: number;
  dy: number;
  anchor: 'start' | 'end';
  /** entering (the turn): the hairline drawn so far from the foot (0..1), then the label wiped in left to right (0..1); absent: landed */
  leader?: number;
  wipe?: number;
  /** leaving (a camera move it would ride more than 40 px): its fade out (1 landed .. 0 gone); absent: 1 */
  opacity?: number;
}

export const ROLE_LABELS: readonly RoleLabel[] = [
  // its leader ends on the deck's own body at its east end, the dispatch housing under the ramp (never a rail, never the reel:
  // the reel is the Router's log, not the Router); the label sits on clear ground east of the deck, its leader rising to it
  // clear above the ramp's slit, so nothing dispatched out of the housing ever passes under the hairline
  { text: WORDS.router.en, foot: [240, 232, DISPATCH_HOUSING.z[1] + 0.5], dx: 159, dy: 12, anchor: 'start' },
  // the reporting Worker: the leader ends on the test bay's south wall, below its nameplate
  { text: WORDS.worker.en, foot: [rectC(BAYS.tests.box)[0] + 70, BAYS.tests.box.y0 + 3, 20], dx: 52, dy: 58, anchor: 'start' },
  // beside your desk: a clear hairline from the slab's west edge out to the label (design D3)
  { text: pictureLine(WORDS.you), foot: [YOU.slab.x0 + 14, rectC(YOU.slab)[1] - 30, YOU.top], dx: -84, dy: 30, anchor: 'end' },
];

/** The leader's ends (screen px): from the foot to the label's nearest corner, stopping short of the text. */
export function leaderOf(foot: [number, number], l: RoleLabel, width: number, size: number): { a: [number, number]; b: [number, number]; x: number; y: number } {
  const x = foot[0] + l.dx;
  const y = foot[1] + l.dy;
  // the corner of the text box nearest the foot: above the baseline (cap height) or at it
  const cx = l.anchor === 'start' ? x - 6 : x + 6;
  const cy = l.dy < 0 ? y + 8 : y - 0.78 * size - 6;
  void width;
  return { a: foot, b: [cx, cy], x, y };
}

/**
 * A tag (the cache tag in still (c)): its EN, 40 px, shown on its cue's window (a 6 f wipe in, a 6 f
 * fade out), on a hairline leader that ends on the body it qualifies (design D3). `at` is the screen
 * point the EN line's baseline starts (anchor start) or ends (anchor end) on. Its zh is drawn under
 * the EN only where the zh policy keeps it (look/zhInPicture.ts): since 2026-11-14 no tag's is.
 */
export interface TagSpec {
  cue: string;
  /**
   * When one cue places several tags (the six idea labels on 'ideas'): each its own id (its key and its wipe's clip; default
   * the cue's id) and its own `from`, the film frame its wipe starts (default its cue's window start); all fade with the cue.
   */
  id?: string;
  from?: number;
  words: { en: string; 'zh-Hans': string };
  at: readonly [number, number];
  anchor: 'start' | 'end';
  foot: P3;
  /**
   * Something must pass the leader's foot inside the tag's window (the cache tag's: beat 6.4's reading thread leaves
   * from it): from this film frame the leader, whole, fades out with its foot's dot over 6 f (TAG_LEADER_FADE), never
   * cut short (a hairline ending in mid-air: R2-L2-09); the text stays.
   */
  leaderUntil?: number;
  /** with `leaderUntil`: from this film frame the whole leader fades back in over 6 f (the cache tag's, once the reading thread's last hop has left its foot and landed) */
  leaderBack?: number;
  /** a long tag set on more than one line (its words broken where the copy breaks, never re-worded): EN lines, then the zh lines drawn if the zh policy keeps its zh */
  lines?: { en: readonly string[]; zh?: readonly string[] };
  /** its lines' leading, if not TAG_GAP */
  gap?: number;
  /** Opt-in: its words in the tags' secondary tone (TEXT_HEX.secondary), so print it stands beside leads (beat 8's load tag); absent: TEXT_HEX.en. */
  tone?: 'secondary';
  /**
   * Opt-in: its foot lies on light paper (beat 8's load tag, on the sheet), where the leader's light tone and its dot
   * vanish: the paper's edge the leader crosses, as two world points on it. The leader's run on the paper and its foot's
   * dot are drawn in the print's ink (TEXT_HEX.ink), its run over the dark desk in the leader's tone (`leaderOnPaper`).
   */
  paperEdge?: readonly [P3, P3];
  /**
   * Opt-in (the idea labels, beat11.ts TAGS_11): the storyboard's reveal from its own `from` (its contact frame), as a role
   * label enters: its hairline leader draws out of its foot over 6 f (the foot's dot on the contact frame itself), then its
   * text wipes in over 8 f; it fades with its cue. Absent: the cue's 6 f wipe, the leader growing with it (every other tag).
   */
  reveal?: 'leader';
  /** Opt-in: a factor on its opacity at film frame f (a focus hold fading it toward the stepped world's value, beat9.ts domDimAt); absent: 1. */
  dim?: (f: number) => number;
}
/** One line's baseline under the one before it (a zh line's under its EN), and where the leader leaves the text block. */
export const TAG_GAP = 50;

/** The lines a tag draws: its EN lines, and its zh lines only where the zh policy keeps its words' zh (look/zhInPicture.ts). */
export function tagText(t: Pick<TagSpec, 'words' | 'lines'>): { en: readonly string[]; zh: readonly string[] } {
  const zh = zhInPicture(t.words);
  return { en: t.lines?.en ?? [t.words.en], zh: zh === null ? [] : (t.lines?.zh ?? [zh]) };
}

/** A tag's block on screen: each line's baseline and width, the block's box, and where its leader leaves it (px). */
export interface TagLayout {
  en: readonly { text: string; y: number; w: number }[];
  zh: readonly { text: string; y: number; w: number }[];
  /** the block's west edge, its width, its top and bottom (the wipe's clip is built round them) */
  x0: number;
  w: number;
  top: number;
  bottom: number;
  /** where the leader leaves the block (its end at the text) */
  l: readonly [number, number];
}

/**
 * A tag's block for its foot's screen point and a measure of its lines (px; `zh` true for a zh line). The leader leaves
 * the block's edge nearest the foot: a foot under or over the block meets its bottom (the lowest line running over the
 * foot) or top edge straight above or below it; a foot to its side meets the side, one line's middle (a one-line tag),
 * between the lines (two) or level with the foot inside the block (more).
 */
export function tagLayout(t: TagSpec, foot: readonly [number, number], measure: (text: string, zh: boolean) => number): TagLayout {
  const { en, zh } = tagText(t);
  const gap = t.gap ?? TAG_GAP;
  const enL = en.map((text, i) => ({ text, y: t.at[1] + i * gap, w: measure(text, false) }));
  const zhL = zh.map((text, i) => ({ text, y: t.at[1] + (en.length + i) * gap, w: measure(text, true) }));
  const all = [...enL, ...zhL];
  const w = Math.max(...all.map((x) => x.w)) + 8;
  const x0 = t.anchor === 'start' ? t.at[0] - 4 : t.at[0] - w + 4;
  const top = t.at[1] - 40;
  const bottom = all[all.length - 1]!.y + 20;
  const over = foot[0] > x0 - 8 && foot[0] < x0 + w + 8;
  const lx = over ? foot[0] : foot[0] < x0 ? x0 - 8 : x0 + w + 8;
  // a foot under the block meets the lowest line that runs over it (a shorter line under a longer one leaves it the longer's)
  const under = all.filter((x) => {
    const [a, b] = t.anchor === 'start' ? [t.at[0] - 4, t.at[0] + x.w + 4] : [t.at[0] - x.w - 4, t.at[0] + 4];
    return foot[0] >= a && foot[0] <= b;
  });
  const floor = under.length ? Math.max(...under.map((x) => x.y)) + 20 : bottom;
  const n = all.length;
  const side = n > 2 ? Math.min(Math.max(foot[1], top + 12), bottom - 12) : n === 2 ? t.at[1] + gap / 2 - 12 : t.at[1] - TAG_MID;
  const ly = over ? (foot[1] > t.at[1] ? floor : top) : side;
  return { en: enL, zh: zhL, x0, w, top, bottom, l: [lx, ly] };
}
/** A one-line tag's middle over its baseline (px): its caps' and x-height's middles straddle it at 40 px. */
export const TAG_MID = 12;

/**
 * How much of a leader from its foot `a` (on the paper) to its end `b` lies on paper whose edge runs through screen
 * points p and q: the fraction along a→b where it crosses the edge's line, 1 if it never does (TagSpec.paperEdge).
 */
export function leaderOnPaper(a: readonly [number, number], b: readonly [number, number], p: readonly [number, number], q: readonly [number, number]): number {
  const cross = (u: readonly [number, number], v: readonly [number, number]) => u[0] * v[1] - u[1] * v[0];
  const e: [number, number] = [q[0] - p[0], q[1] - p[1]];
  const den = cross(e, [b[0] - a[0], b[1] - a[1]]);
  const t = den === 0 ? 1 : cross(e, [p[0] - a[0], p[1] - a[1]]) / den;
  return t > 0 && t < 1 ? t : 1;
}

/** How long the leader takes to fade out (from `leaderUntil`) and back in (from `leaderBack`), frames. */
export const TAG_LEADER_FADE = 6;
/** The leader's opacity at film frame f under `leaderUntil` and `leaderBack` (1 without them): the whole hairline fades, its length never changes. */
export function tagLeaderOpacity(t: Pick<TagSpec, 'leaderUntil' | 'leaderBack'>, f: number): number {
  if (t.leaderUntil === undefined) return 1;
  const out = Math.min(1, Math.max(0, (f - t.leaderUntil) / TAG_LEADER_FADE));
  const back = t.leaderBack === undefined ? 0 : Math.min(1, Math.max(0, (f - t.leaderBack) / TAG_LEADER_FADE));
  return Math.min(1, Math.max(0, 1 - out + back));
}

/** A tag's reveal at film frame f: its cue's window (the cue sheet's 6 f wipe in and fade out), its wipe from its own `from` if it has one. */
export function tagReveal(t: Pick<TagSpec, 'cue' | 'from'>, f: number): RevealState {
  if (t.from === undefined) return cueReveal(t.cue, f);
  const c = cue(t.cue);
  return revealState(f, { frame: t.from + TEXT_IN, end: c.end ?? c.frame }, TEXT_IN, TEXT_OUT);
}
/** The opt-in reveal's leader and wipe frames (TagSpec.reveal 'leader'): the leader's 6 f from the contact frame, then the text's 8 f. */
export const TAG_LEADER = { leader: 6, wipe: 8 } as const;
/**
 * A 'leader' tag's reveal at film frame f (TagSpec.reveal): `leader` (0..1) the hairline drawn out of its foot, its first
 * step on `from` (the contact frame: the foot's dot shows there), whole on from + 5; `wipe` the text from from + 6, whole
 * on from + 13; the opacity its cue's fade out.
 */
export function tagLeaderReveal(t: Pick<TagSpec, 'cue' | 'from'>, f: number): RevealState & { leader: number } {
  const c = cue(t.cue);
  const from = t.from ?? c.frame - TEXT_IN;
  const end = c.end ?? c.frame;
  if (f < from || f >= end + TEXT_OUT) return { visible: false, wipe: 0, opacity: 0, leader: 0 };
  const leader = Math.min(1, (f - from + 1) / TAG_LEADER.leader);
  const wipe = progress(f, from + TAG_LEADER.leader - 1, from + TAG_LEADER.leader - 1 + TAG_LEADER.wipe, 'outQuad');
  const opacity = 1 - progress(f, end, end + TEXT_OUT);
  return { visible: opacity > 0, wipe, opacity, leader };
}

/** A soft ground's solid core (px, whole pixels): the feather lies outside it. */
export interface GroundBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The feather's profile, from its outer edge (0) to the core (1): smoothstep, so it has no visible edge at either end. */
const FEATHER_STOPS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1].map((t) => ({ t, a: t * t * (3 - 2 * t) }));

/**
 * A soft ground in one flat colour, drawn with no filter: the union of `boxes`, each a solid core feathered `feather` px
 * outward on FEATHER_STOPS (its four sides linear gradients, its four corners radial ones, all on whole pixels, so the
 * nine pieces meet without a seam), is the mask a full-frame rect of `color` at `alpha` is drawn through. `edge` (a
 * left-to-right reveal, px): the ground is whole west of it and fades out over `edgeFeather` px east of it, so it leads
 * a wipe that reveals to the same x; absent, it is whole.
 */
export function SoftGround({ id, boxes, feather, color, alpha, edge, edgeFeather = feather }: { id: string; boxes: readonly GroundBox[]; feather: number; color: string; alpha: number; edge?: number; edgeFeather?: number }) {
  const F = Math.round(feather);
  const radial = (cx: number, cy: number, key: string) => (
    <radialGradient id={`${id}-${key}`} cx={cx} cy={cy} r={1} fx={cx} fy={cy}>
      {FEATHER_STOPS.map(({ t }) => (
        <stop key={t} offset={t} stopColor="#fff" stopOpacity={(1 - t) * (1 - t) * (3 - 2 * (1 - t))} />
      ))}
    </radialGradient>
  );
  const lin = (key: string, x1: number, y1: number, x2: number, y2: number) => (
    <linearGradient id={`${id}-${key}`} x1={x1} y1={y1} x2={x2} y2={y2}>
      {FEATHER_STOPS.map(({ t, a }) => (
        <stop key={t} offset={t} stopColor="#fff" stopOpacity={a} />
      ))}
    </linearGradient>
  );
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        {lin('l', 0, 0, 1, 0)}
        {lin('r', 1, 0, 0, 0)}
        {lin('t', 0, 0, 0, 1)}
        {lin('b', 0, 1, 0, 0)}
        {radial(1, 1, 'tl')}
        {radial(0, 1, 'tr')}
        {radial(1, 0, 'bl')}
        {radial(0, 0, 'br')}
        <mask id={`${id}-shape`} maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}>
          {boxes.map((b, i) => {
            const [x0, y0, x1, y1] = [Math.round(b.x0), Math.round(b.y0), Math.round(b.x1), Math.round(b.y1)];
            const w = x1 - x0;
            const h = y1 - y0;
            return (
              <g key={i}>
                <rect x={x0} y={y0} width={w} height={h} fill="#fff" />
                <rect x={x0 - F} y={y0} width={F} height={h} fill={`url(#${id}-l)`} />
                <rect x={x1} y={y0} width={F} height={h} fill={`url(#${id}-r)`} />
                <rect x={x0} y={y0 - F} width={w} height={F} fill={`url(#${id}-t)`} />
                <rect x={x0} y={y1} width={w} height={F} fill={`url(#${id}-b)`} />
                <rect x={x0 - F} y={y0 - F} width={F} height={F} fill={`url(#${id}-tl)`} />
                <rect x={x1} y={y0 - F} width={F} height={F} fill={`url(#${id}-tr)`} />
                <rect x={x0 - F} y={y1} width={F} height={F} fill={`url(#${id}-bl)`} />
                <rect x={x1} y={y1} width={F} height={F} fill={`url(#${id}-br)`} />
              </g>
            );
          })}
        </mask>
        {edge !== undefined && (
          <>
            <linearGradient id={`${id}-edge`} gradientUnits="userSpaceOnUse" x1={edge + edgeFeather} y1={0} x2={edge} y2={0}>
              {FEATHER_STOPS.map(({ t, a }) => (
                <stop key={t} offset={t} stopColor="#fff" stopOpacity={a} />
              ))}
            </linearGradient>
            <mask id={`${id}-wipe`} maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}>
              <rect x={0} y={0} width={1920} height={1080} fill={`url(#${id}-edge)`} />
            </mask>
          </>
        )}
      </defs>
      <g mask={edge !== undefined ? `url(#${id}-wipe)` : undefined}>
        <rect x={0} y={0} width={1920} height={1080} fill={color} opacity={alpha} mask={`url(#${id}-shape)`} />
      </g>
    </svg>
  );
}

/**
 * Notes that cross the world (opt-in by cue id; every other line is drawn on the bare slate as before): a halo in the
 * desk's slate tone that hugs the lines' own ink (the glyphs dilated `dilate` px, with round joins, then feathered by a
 * gaussian of `blur` px), at `alpha`, under the lines; it wipes in just ahead of the line's own wipe and fades with it.
 * It is the type's ground, shaped like the type: no box, so it never puts a corner or a band on a world part beside
 * the words. C28: the bookend's framing is the hook's (the end card and key are sized at it), so its line runs over
 * your lamp's arm and the in-tray's #0405 slip and its "≤ 100" tab; the halo gives every glyph a slate to read on
 * there (at least 4.5:1), where a camera move or a moved world would break the rhyme.
 */
export const NOTES_GROUND: Readonly<Partial<Record<string, NotesGroundSpec>>> = {
  // C15 and N4-N6 in the 2.4x close: their tails run over the deck's parts and across the light notes card, whose edges
  // cut through them (R2-L2-10); the halo keeps every glyph on the slate there
  c15: { dilate: 10, blur: 6, alpha: 0.85 },
  n4: { dilate: 10, blur: 6, alpha: 0.85 },
  n5: { dilate: 10, blur: 6, alpha: 0.85 },
  n6: { dilate: 10, blur: 6, alpha: 0.85 },
  c28: { dilate: 10, blur: 6, alpha: 0.85 },
  // the credit (desk/ActOneFrame.tsx CreditLine draws it): your loop's tape comes up under it as bar 3 eases out (L1-04:
  // its box knockout cut the tape on a hard edge right of "team"); its halo stops just over the ascenders (`top`: the
  // tape's lower edge lies a few px over them through the credit's hold, and the halo's full reach put soft dark dents
  // in it above k, H and t: R-A6-halo-bites)
  credit: { dilate: 10, blur: 6, alpha: 0.85, top: { gap: 2, fade: 8 } },
};
/**
 * A notes halo: the glyphs dilated `dilate` px, feathered by a gaussian of `blur` px, at `alpha`; with `top`, cut off
 * above the line's ascenders (NOTES_ASCENT over its baseline): whole to `gap` px over them, gone `fade` px further up.
 */
export interface NotesGroundSpec {
  dilate: number;
  blur: number;
  alpha: number;
  top?: { gap: number; fade: number };
}
/** The notes' ascender height as a share of their size (the sans's caps and ascenders: 35 px at 48). */
export const NOTES_ASCENT = 0.73;
/** Where a halo with `top` is whole up to and where it has gone (screen y, px), for a line of `size` px. */
export const notesHaloTop = (g: NotesGroundSpec, size: number): { full: number; zero: number } | null =>
  g.top ? { full: NOTES.enBaseline - NOTES_ASCENT * size - g.top.gap, zero: NOTES.enBaseline - NOTES_ASCENT * size - g.top.gap - g.top.fade } : null;
/** How far a notes halo reaches past the ink, px: the dilation and three of the feather's standard deviations. */
export const notesHaloReach = (g: { dilate: number; blur: number }) => g.dilate + 3 * g.blur;

/** The halo under a notes line opted in by its cue id (NOTES_GROUND), on the line's own reveal; null for every other line. */
export function NotesGround({ id, f, en, look }: { id: string; f: number; en: string; look: { en: TextLook } }) {
  const g = NOTES_GROUND[id];
  if (!g) return null;
  const s = revealState(f, cue(id), TEXT_IN, TEXT_OUT);
  if (!s.visible) return null;
  const W = lineWidth(en, look.en);
  const R = notesHaloReach(g);
  // the notes block reveals its line to one edge, NOTES.x + W x its wipe (kit/text.tsx NotesBlock); the halo is whole
  // to an edge that leads it by R x the wipe and fades over R past it, so when the wipe ends (edge at the halo's own
  // reach) the mask already covers all of it and is dropped with no change
  const edge = s.wipe >= 1 ? undefined : NOTES.x + (W + R) * s.wipe;
  const top = notesHaloTop(g, look.en.size);
  const hid = `halo-${id}`;
  const line = (text: string, baseline: number, l: TextLook) => (
    <text x={NOTES.x} y={baseline} fontFamily={l.family} fontWeight={l.weight} fontSize={l.size} fill={DESK_HEX.base} stroke={DESK_HEX.base} strokeWidth={2 * g.dilate} strokeLinejoin="round" style={{ ...AS_TYPED, fontVariantNumeric: l.numeric }}>
      {text}
    </text>
  );
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, opacity: s.opacity }}>
      <defs>
        <filter id={`${hid}-blur`} filterUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080} colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={g.blur} />
        </filter>
        {edge !== undefined && (
          <>
            <linearGradient id={`${hid}-edge`} gradientUnits="userSpaceOnUse" x1={edge + R} y1={0} x2={edge} y2={0}>
              {FEATHER_STOPS.map(({ t, a }) => (
                <stop key={t} offset={t} stopColor="#fff" stopOpacity={a} />
              ))}
            </linearGradient>
            <mask id={`${hid}-wipe`} maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}>
              <rect x={0} y={0} width={1920} height={1080} fill={`url(#${hid}-edge)`} />
            </mask>
          </>
        )}
        {top && (
          <>
            <linearGradient id={`${hid}-top`} gradientUnits="userSpaceOnUse" x1={0} y1={top.zero} x2={0} y2={top.full}>
              {FEATHER_STOPS.map(({ t, a }) => (
                <stop key={t} offset={t} stopColor="#fff" stopOpacity={a} />
              ))}
            </linearGradient>
            <mask id={`${hid}-topcut`} maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}>
              <rect x={0} y={0} width={1920} height={1080} fill={`url(#${hid}-top)`} />
            </mask>
          </>
        )}
      </defs>
      <g mask={edge !== undefined ? `url(#${hid}-wipe)` : undefined}>
        <g mask={top ? `url(#${hid}-topcut)` : undefined}>
          <g filter={`url(#${hid}-blur)`} opacity={g.alpha}>
            {line(en, NOTES.enBaseline, look.en)}
          </g>
        </g>
      </g>
    </svg>
  );
}

/** `labels`: the role labels in view (act one has only yours); `tags`: the tags shown on their cues. */
export function Overlay({ f, pose, fonts, ready, labels = ROLE_LABELS, tags = [] }: { f: number; pose: CamPose; fonts: FilmFonts; ready: boolean; labels?: readonly RoleLabel[]; tags?: readonly TagSpec[] }) {
  if (!ready) return null;
  const look = notesLookDesk(fonts);
  const size = TYPE.label.size;
  return (
    <AbsoluteFill>
      {/* the notes' grounds (opt-in, NOTES_GROUND) under every DOM line */}
      {narrationAt(f).map((id) => {
        return <NotesGround key={`ground-${id}`} id={id} f={f} en={WORDS[id].en} look={look} />;
      })}
      <svg width={1920} height={1080} style={{ ...GREY_TEXT, position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {labels.map((l) => {
          const foot = project(pose, l.foot);
          const w = lineWidth(l.text, { family: fonts.sans, weight: TYPE.label.weight, size });
          const { a, b, x, y } = leaderOf(foot, l, w, size);
          if (l.leader !== undefined || l.wipe !== undefined) {
            // entering: the leader draws from the foot, then the label wipes in (left to right) from its leader's end
            const k = l.leader ?? 1;
            const x0 = l.anchor === 'start' ? x - 8 : x - w - 8;
            const id = `wipe-label-${l.text.replace(/[^a-z]/gi, '')}`;
            return (
              <g key={l.text}>
                <defs>
                  <clipPath id={id}>
                    <rect x={x0} y={y - size * 1.4} width={(w + 16) * (l.wipe ?? 1)} height={size * 2} />
                  </clipPath>
                </defs>
                <line x1={a[0]} y1={a[1]} x2={a[0] + (b[0] - a[0]) * k} y2={a[1] + (b[1] - a[1]) * k} stroke={TEXT_HEX.leader} strokeWidth={2.5} strokeLinecap="round" />
                {/* the foot's dot grows with its leader (and shrinks with it as a label exits) */}
                <circle cx={a[0]} cy={a[1]} r={4 * Math.min(1, 3 * k)} fill={TEXT_HEX.en} />
                {(l.wipe ?? 1) > 0 && (
                  <g clipPath={`url(#${id})`}>
                    <Label x={x} y={y} text={l.text} family={fonts.sans} size={size} weight={TYPE.label.weight} cjkWeight={TYPE.label.cjkWeight} color={TEXT_HEX.en} anchor={l.anchor} />
                  </g>
                )}
              </g>
            );
          }
          return (
            <g key={l.text} opacity={l.opacity}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={TEXT_HEX.leader} strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={a[0]} cy={a[1]} r={4} fill={TEXT_HEX.en} />
              <Label x={x} y={y} text={l.text} family={fonts.sans} size={size} weight={TYPE.label.weight} cjkWeight={TYPE.label.cjkWeight} color={TEXT_HEX.en} anchor={l.anchor} />
            </g>
          );
        })}
      </svg>
      {tags.map((t) => {
        const lr = t.reveal === 'leader' ? tagLeaderReveal(t, f) : null;
        const r = lr ?? tagReveal(t, f);
        if (!r.visible) return null;
        const id = t.id ?? t.cue;
        const foot = project(pose, t.foot);
        const tsize = TYPE.label.size;
        const L = tagLayout(t, foot, (x, zh) => lineWidth(x, { family: fonts.sans, weight: zh ? TYPE.label.cjkWeight : TYPE.label.weight, size: tsize }));
        const [lx, ly] = L.l;
        // the leader grows out of its foot with the wipe (or, opted in, before it: TagSpec.reveal); whole, it may fade out
        // and back in while something passes its foot (leaderUntil, leaderBack)
        const grow = lr ? lr.leader : Math.min(1, r.wipe * 1.6);
        const lo = tagLeaderOpacity(t, f);
        const colour = t.tone === 'secondary' ? TEXT_HEX.secondary : TEXT_HEX.en;
        // a foot on light paper (paperEdge): the leader's run on the paper, to where it crosses the edge, and the dot in ink
        const onPaper = t.paperEdge ? leaderOnPaper(foot, [lx, ly], project(pose, t.paperEdge[0]), project(pose, t.paperEdge[1])) : 0;
        const along = (k: number) => [foot[0] + (lx - foot[0]) * k, foot[1] + (ly - foot[1]) * k] as const;
        return (
          <svg key={id} width={1920} height={1080} style={{ ...GREY_TEXT, position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: r.opacity * (t.dim?.(f) ?? 1) }}>
            <defs>
              <clipPath id={`wipe-${id}`}>
                <rect x={L.x0 - 4} y={t.at[1] - 60} width={(L.w + 8) * r.wipe} height={L.bottom - t.at[1] + 90} />
              </clipPath>
            </defs>
            {lo > 0 && onPaper === 0 && (
              <g opacity={lo < 1 ? lo : undefined}>
                <line x1={foot[0]} y1={foot[1]} x2={foot[0] + (lx - foot[0]) * grow} y2={foot[1] + (ly - foot[1]) * grow} stroke={TEXT_HEX.leader} strokeWidth={2.5} strokeLinecap="round" />
                <circle cx={foot[0]} cy={foot[1]} r={lr ? 4 * Math.min(1, 3 * lr.leader) : 4} fill={TEXT_HEX.en} />
              </g>
            )}
            {lo > 0 && onPaper > 0 && (
              <g opacity={lo < 1 ? lo : undefined}>
                {grow > onPaper && <line x1={along(onPaper)[0]} y1={along(onPaper)[1]} x2={along(grow)[0]} y2={along(grow)[1]} stroke={TEXT_HEX.leader} strokeWidth={2.5} strokeLinecap="round" />}
                <line x1={foot[0]} y1={foot[1]} x2={along(Math.min(grow, onPaper))[0]} y2={along(Math.min(grow, onPaper))[1]} stroke={TEXT_HEX.ink} strokeWidth={2.5} strokeLinecap="round" />
                <circle cx={foot[0]} cy={foot[1]} r={lr ? 4 * Math.min(1, 3 * lr.leader) : 4} fill={TEXT_HEX.ink} />
              </g>
            )}
            <g clipPath={`url(#wipe-${id})`}>
              {L.en.map((x, i) => (
                <Label key={`en${i}`} x={t.at[0]} y={x.y} text={x.text} family={fonts.sans} size={tsize} weight={TYPE.label.weight} cjkWeight={TYPE.label.cjkWeight} color={colour} anchor={t.anchor} />
              ))}
              {L.zh.map((x, i) => (
                <Label key={`zh${i}`} x={t.at[0]} y={x.y} text={x.text} family={fonts.sans} size={tsize} weight={TYPE.label.cjkWeight} cjkWeight={TYPE.label.cjkWeight} color={TEXT_HEX.zh} anchor={t.anchor} />
              ))}
            </g>
          </svg>
        );
      })}
      {narrationAt(f).map((id) => {
        // the EN line, and its zh under it only if the zh policy kept it (it keeps no narration line's: look/zhInPicture.ts)
        const zh = zhInPicture(WORDS[id]);
        return <NotesBlock key={id} f={f} span={cue(id)} en={WORDS[id].en} zh={zh ?? undefined} layout={NOTES} look={look} ready={ready} />;
      })}
    </AbsoluteFill>
  );
}
