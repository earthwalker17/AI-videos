/**
 * The Register Desk's DOM text layer: every line meant to be read, over the WebGL world
 * (docs/ARCHITECTURE.md decision 30). The notes come from the cue sheet (desk/onScreen.ts
 * narrationAt), set in the kit's NotesBlock lower left; the role labels ("Router", "Worker",
 * "you · 你") sit on hairline leaders whose feet are projected through the same camera pose as the
 * world (camera.ts `project`), so they land on their objects at either pitch. All text in
 * `GREY_TEXT` layers (no LCD fringes), ≤ 136 px, fonts gated by useFont; nothing moves while read.
 */
import { progress } from '@aiv/core';
import type { CamPose } from '@aiv/remotion-kit';
import { AbsoluteFill } from 'remotion';
import { TEXT_IN, TEXT_OUT, WORDS, cue } from '../cues.ts';
import { cueReveal, narrationAt } from './onScreen.ts';
import { GREY_TEXT, Label, NotesBlock, lineWidth, revealState, type RevealState, type TextLook } from '../kit/text.tsx';
import type { FilmFonts } from '../look/fonts.ts';
import { NOTES, TYPE } from '../look/tokens.ts';
import { project } from './camera.ts';
import { BAYS, DISPATCH_HOUSING, YOU, rectC, type P3 } from './layout.ts';

/** Text colours of the Register Desk (synthesis §2, Palette): EN and zh. */
export const TEXT_HEX = { en: '#ECE9E2', zh: '#BAB7AF', leader: '#C9C6BE' } as const;

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
  { text: `${WORDS.you.en} · ${WORDS.you['zh-Hans']}`, foot: [YOU.slab.x0 + 14, rectC(YOU.slab)[1] - 30, YOU.top], dx: -84, dy: 30, anchor: 'end' },
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
 * A tag (the cache tag in still (c)): EN over zh, 40 px, shown on its cue's window (a 6 f wipe in,
 * a 6 f fade out), on a hairline leader that ends on the body it qualifies (design D3). `at` is the
 * screen point the EN line's baseline starts (anchor start) or ends (anchor end) on; the zh line sits
 * under it.
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
   * A camera move inside the tag's window (the cache tag over bar 42's ease-out): the text stays dead still where it
   * is, and from this film frame its leader retracts into the text over 6 f, so no hairline is dragged by the move.
   */
  leaderUntil?: number;
  /** a long tag set on more than one line (its words broken where the copy breaks, never re-worded): EN lines, then zh lines */
  lines?: { en: readonly string[]; zh: readonly string[] };
  /** its lines' leading, if tighter than TAG_GAP (the gate tag, so its zh line clears the conversation spool's flange under it) */
  gap?: number;
  /**
   * Opt-in (the idea labels, beat11.ts TAGS_11): the storyboard's reveal from its own `from` (its contact frame), as a role
   * label enters: its hairline leader draws out of its foot over 6 f (the foot's dot on the contact frame itself), then its
   * text wipes in over 8 f; it fades with its cue. Absent: the cue's 6 f wipe, the leader growing with it (every other tag).
   */
  reveal?: 'leader';
}
/** The zh line's baseline under the EN line's (and one line's under the one before it), and where the leader leaves the text block. */
export const TAG_GAP = 50;

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

/** `labels`: the role labels in view (act one has only yours); `tags`: the tags shown on their cues. */
export function Overlay({ f, pose, fonts, ready, labels = ROLE_LABELS, tags = [] }: { f: number; pose: CamPose; fonts: FilmFonts; ready: boolean; labels?: readonly RoleLabel[]; tags?: readonly TagSpec[] }) {
  if (!ready) return null;
  const look = notesLookDesk(fonts);
  const size = TYPE.label.size;
  return (
    <AbsoluteFill>
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
        const en = t.lines?.en ?? [t.words.en];
        const zh = t.lines?.zh ?? [t.words['zh-Hans']];
        const gap = t.gap ?? TAG_GAP;
        const enY = en.map((_, i) => t.at[1] + i * gap);
        const zhY = zh.map((_, i) => t.at[1] + (en.length + i) * gap);
        const wEns = en.map((x) => lineWidth(x, { family: fonts.sans, weight: TYPE.label.weight, size: tsize }));
        const wZhs = zh.map((x) => lineWidth(x, { family: fonts.sans, weight: TYPE.label.cjkWeight, size: tsize }));
        const wEn = Math.max(...wEns);
        const wZh = Math.max(...wZhs);
        const w = Math.max(wEn, wZh) + 8;
        const x0 = t.anchor === 'start' ? t.at[0] - 4 : t.at[0] - w + 4;
        const top = t.at[1] - 40;
        const bottom = zhY[zhY.length - 1] + 20;
        // the leader leaves the block's edge nearest the foot: a side, between its lines, or (a foot under or over the
        // block) its bottom or top edge straight above or below the foot
        const over = foot[0] > x0 - 8 && foot[0] < x0 + w + 8;
        const lx = over ? foot[0] : foot[0] < x0 ? x0 - 8 : x0 + w + 8;
        // a foot under the block meets the lowest line that runs over it (a shorter line under a longer one leaves it the longer's)
        const spans = [...wEns, ...wZhs].map((lw) => (t.anchor === 'start' ? [t.at[0] - 4, t.at[0] + lw + 4] : [t.at[0] - lw - 4, t.at[0] + 4]));
        const ys = [...enY, ...zhY];
        const under = ys.filter((_, i) => foot[0] >= spans[i]![0]! && foot[0] <= spans[i]![1]!);
        const floor = under.length ? Math.max(...under) + 20 : bottom;
        const ly = over ? (foot[1] > t.at[1] ? floor : top) : en.length + zh.length > 2 ? Math.min(Math.max(foot[1], top + 12), bottom - 12) : t.at[1] + gap / 2 - 12;
        // the leader grows out of its foot with the wipe (or, opted in, before it: TagSpec.reveal); under a camera move it
        // retracts into the text (leaderUntil)
        const grow = lr ? lr.leader : Math.min(1, r.wipe * 1.6);
        const keep = t.leaderUntil === undefined ? 1 : 1 - Math.min(1, Math.max(0, (f - t.leaderUntil) / 6));
        const from: readonly [number, number] = keep < 1 ? [lx + (foot[0] - lx) * keep, ly + (foot[1] - ly) * keep] : foot;
        return (
          <svg key={id} width={1920} height={1080} style={{ ...GREY_TEXT, position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: r.opacity }}>
            <defs>
              <clipPath id={`wipe-${id}`}>
                <rect x={x0 - 4} y={t.at[1] - 60} width={(w + 8) * r.wipe} height={bottom - t.at[1] + 90} />
              </clipPath>
            </defs>
            {keep > 0 && <line x1={from[0]} y1={from[1]} x2={foot[0] + (lx - foot[0]) * grow} y2={foot[1] + (ly - foot[1]) * grow} stroke={TEXT_HEX.leader} strokeWidth={2.5} strokeLinecap="round" />}
            {keep >= 1 && <circle cx={foot[0]} cy={foot[1]} r={lr ? 4 * Math.min(1, 3 * lr.leader) : 4} fill={TEXT_HEX.en} />}
            <g clipPath={`url(#wipe-${id})`}>
              {en.map((x, i) => (
                <Label key={`en${i}`} x={t.at[0]} y={enY[i]} text={x} family={fonts.sans} size={tsize} weight={TYPE.label.weight} cjkWeight={TYPE.label.cjkWeight} color={TEXT_HEX.en} anchor={t.anchor} />
              ))}
              {zh.map((x, i) => (
                <Label key={`zh${i}`} x={t.at[0]} y={zhY[i]} text={x} family={fonts.sans} size={tsize} weight={TYPE.label.cjkWeight} cjkWeight={TYPE.label.cjkWeight} color={TEXT_HEX.zh} anchor={t.anchor} />
              ))}
            </g>
          </svg>
        );
      })}
      {narrationAt(f).map((id) => {
        const w = WORDS[id] as { en: string; 'zh-Hans': string };
        return <NotesBlock key={id} f={f} span={cue(id)} en={w.en} zh={w['zh-Hans']} layout={NOTES} look={look} ready={ready} />;
      })}
    </AbsoluteFill>
  );
}
