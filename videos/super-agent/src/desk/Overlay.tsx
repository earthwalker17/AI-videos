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
import { narrationAt } from '../film/onScreen.ts';
import { GREY_TEXT, Label, NotesBlock, lineWidth, type TextLook } from '../kit/text.tsx';
import type { FilmFonts } from '../look/fonts.ts';
import { NOTES, TYPE } from '../look/tokens.ts';
import { project } from './camera.ts';
import { BAYS, REEL_FRAME, REEL_FRAME_Z, YOU, rectC, type P3 } from './layout.ts';

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
}

export const ROLE_LABELS: readonly RoleLabel[] = [
  // on clear ground east of the deck, between its frame and the Thread cord's descent (>= 12 px from both)
  { text: WORDS.router.en, foot: [REEL_FRAME[2].x1 - 8, 300, REEL_FRAME_Z[1]], dx: 40, dy: 26, anchor: 'start' },
  // the reporting Worker: the leader ends on the test tower bay's nameplate
  { text: WORDS.worker.en, foot: [rectC(BAYS.tests.box)[0] + 40, BAYS.tests.box.y0 - 8, 0], dx: 30, dy: 44, anchor: 'start' },
  // beside your desk, at its west edge (not a heading for the notes)
  { text: `${WORDS.you.en} · ${WORDS.you['zh-Hans']}`, foot: [YOU.slab.x0 + 2, rectC(YOU.slab)[1] - 30, YOU.top], dx: -24, dy: 16, anchor: 'end' },
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

export function Overlay({ f, pose, fonts, ready }: { f: number; pose: CamPose; fonts: FilmFonts; ready: boolean }) {
  if (!ready) return null;
  const look = notesLookDesk(fonts);
  const size = TYPE.label.size;
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ ...GREY_TEXT, position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {ROLE_LABELS.map((l) => {
          const foot = project(pose, l.foot);
          const w = lineWidth(l.text, { family: fonts.sans, weight: TYPE.label.weight, size });
          const { a, b, x, y } = leaderOf(foot, l, w, size);
          return (
            <g key={l.text}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={TEXT_HEX.leader} strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={a[0]} cy={a[1]} r={4} fill={TEXT_HEX.en} />
              <Label x={x} y={y} text={l.text} family={fonts.sans} size={size} weight={TYPE.label.weight} cjkWeight={TYPE.label.cjkWeight} color={TEXT_HEX.en} anchor={l.anchor} />
            </g>
          );
        })}
      </svg>
      {narrationAt(f).map((id) => {
        const w = WORDS[id] as { en: string; 'zh-Hans': string };
        return <NotesBlock key={id} f={f} span={cue(id)} en={w.en} zh={w['zh-Hans']} layout={NOTES} look={look} ready={ready} />;
      })}
    </AbsoluteFill>
  );
}
