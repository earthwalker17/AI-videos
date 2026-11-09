/**
 * The Register Desk's DOM text layer: every line meant to be read, over the WebGL world
 * (docs/ARCHITECTURE.md decision 30). The notes come from the cue sheet (film/onScreen.ts
 * narrationAt), set in the kit's NotesBlock lower left; the role labels ("Router", "Worker",
 * "you · 你") sit on hairline leaders whose feet are projected through the same camera pose as the
 * world (camera.ts `project`), so they land on their objects at either pitch. All text in
 * `GREY_TEXT` layers (no LCD fringes), ≤ 136 px, fonts gated by useFont; nothing moves while read.
 */
import type { CamPose } from '@aiv/remotion-kit';
import { AbsoluteFill } from 'remotion';
import { WORDS, cue } from '../cues.ts';
import { cueReveal, narrationAt } from '../film/onScreen.ts';
import { GREY_TEXT, Label, NotesBlock, lineWidth, type TextLook } from '../kit/text.tsx';
import type { FilmFonts } from '../look/fonts.ts';
import { NOTES, TYPE } from '../look/tokens.ts';
import { project } from './camera.ts';
import { BAYS, REEL, YOU, rectC, type P3 } from './layout.ts';

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
}

export const ROLE_LABELS: readonly RoleLabel[] = [
  // its leader ends on the reel's body; the label sits on clear ground east of the deck
  { text: WORDS.router.en, foot: [REEL.x + 92, REEL.y - 40, REEL.packZ[1]], dx: 150, dy: 30, anchor: 'start' },
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
  words: { en: string; 'zh-Hans': string };
  at: readonly [number, number];
  anchor: 'start' | 'end';
  foot: P3;
}
/** The zh line's baseline under the EN line's, and where the leader leaves the text block. */
export const TAG_GAP = 50;

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
                <circle cx={a[0]} cy={a[1]} r={4} fill={TEXT_HEX.en} />
                {(l.wipe ?? 1) > 0 && (
                  <g clipPath={`url(#${id})`}>
                    <Label x={x} y={y} text={l.text} family={fonts.sans} size={size} weight={TYPE.label.weight} cjkWeight={TYPE.label.cjkWeight} color={TEXT_HEX.en} anchor={l.anchor} />
                  </g>
                )}
              </g>
            );
          }
          return (
            <g key={l.text}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={TEXT_HEX.leader} strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={a[0]} cy={a[1]} r={4} fill={TEXT_HEX.en} />
              <Label x={x} y={y} text={l.text} family={fonts.sans} size={size} weight={TYPE.label.weight} cjkWeight={TYPE.label.cjkWeight} color={TEXT_HEX.en} anchor={l.anchor} />
            </g>
          );
        })}
      </svg>
      {tags.map((t) => {
        const r = cueReveal(t.cue, f);
        if (!r.visible) return null;
        const foot = project(pose, t.foot);
        const tsize = TYPE.label.size;
        const wEn = lineWidth(t.words.en, { family: fonts.sans, weight: TYPE.label.weight, size: tsize });
        const wZh = lineWidth(t.words['zh-Hans'], { family: fonts.sans, weight: TYPE.label.cjkWeight, size: tsize });
        const w = Math.max(wEn, wZh) + 8;
        const x0 = t.anchor === 'start' ? t.at[0] - 4 : t.at[0] - w + 4;
        // the leader leaves the block's edge nearest the foot, between its two lines
        const lx = foot[0] < x0 ? x0 - 8 : x0 + w + 8;
        const ly = t.at[1] + TAG_GAP / 2 - 12;
        return (
          <svg key={t.cue} width={1920} height={1080} style={{ ...GREY_TEXT, position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: r.opacity }}>
            <defs>
              <clipPath id={`wipe-${t.cue}`}>
                <rect x={x0 - 4} y={t.at[1] - 60} width={(w + 8) * r.wipe} height={TAG_GAP + 90} />
              </clipPath>
            </defs>
            <line x1={foot[0]} y1={foot[1]} x2={foot[0] + (lx - foot[0]) * Math.min(1, r.wipe * 1.6)} y2={foot[1] + (ly - foot[1]) * Math.min(1, r.wipe * 1.6)} stroke={TEXT_HEX.leader} strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={foot[0]} cy={foot[1]} r={4} fill={TEXT_HEX.en} />
            <g clipPath={`url(#wipe-${t.cue})`}>
              <Label x={t.at[0]} y={t.at[1]} text={t.words.en} family={fonts.sans} size={tsize} weight={TYPE.label.weight} cjkWeight={TYPE.label.cjkWeight} color={TEXT_HEX.en} anchor={t.anchor} />
              <Label x={t.at[0]} y={t.at[1] + TAG_GAP} text={t.words['zh-Hans']} family={fonts.sans} size={tsize} weight={TYPE.label.cjkWeight} cjkWeight={TYPE.label.cjkWeight} color={TEXT_HEX.zh} anchor={t.anchor} />
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
