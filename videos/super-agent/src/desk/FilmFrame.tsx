/**
 * The film (src/Main.tsx): one Register Desk frame per film frame, drawn by the segment that owns it
 * (desk/film.ts). Each segment is the frame component its lookdev still was signed off through, keyed by
 * the segment, so its WebGL world mounts fresh at each boundary (a page crossing one draws what a fresh
 * page starting there does: DeskWorld ResetShared, the kit's sets rebuilt with the world).
 *
 * From BUILT_TO on the film is the animatic (session 4): the act-two world runs without its story events,
 * the summary plays as still (d) was built, and the words of each cue not built yet sit on a slate.
 */
import { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { NARRATION, cues } from '../cues.ts';
import { GREY_TEXT, Label } from '../kit/text.tsx';
import { useFilmFonts } from '../look/fonts.ts';
import { TYPE } from '../look/tokens.ts';
import { ActOneFrame } from './ActOneFrame.tsx';
import { cameraAt, type Angle } from './camera.ts';
import { DeskFrame } from './DeskFrame.tsx';
import { ACT2_TAGS, BUILT_TO, act2LabelsAt, keepFilm, segmentAt, segmentSpan, summaryLabelsAt } from './film.ts';
import { PRINT_FONT } from './gl/text.ts';
import { keepTexture } from './marks.ts';
import { Proposed } from './objects/Proposed.tsx';
import { Trace } from './objects/Trace.tsx';
import { World } from './objects/World.tsx';
import { cueReveal } from './onScreen.ts';
import { TEXT_HEX } from './Overlay.tsx';
import { poseD, summaryAt, summaryDeskState } from './summary.ts';
import { TurnFrame } from './TurnFrame.tsx';

/** The film's pitch and bloom: the user's picks on style frame (b) (2026-11-09: "15° tilt", "Bloom 0.3"). */
export const ANGLE: Angle = 15;
export const BLOOM = true;

/** The print face's CSS family (the kit's useFont registers it as `"AIV <family>"`). */
const PRINT_CSS = `"AIV ${PRINT_FONT.family}"`;

/** Act two, from the turn's end: the desk world through the film's camera, its labels and tags on their schedules. */
export function Act2Frame({ f, angle = ANGLE, bloom = BLOOM }: { f: number; angle?: Angle; bloom?: boolean }) {
  const labels = useMemo(() => act2LabelsAt(f), [f]);
  return <DeskFrame f={f} angle={angle} bloom={bloom} poseAt={cameraAt} span={segmentSpan('act2')} labels={labels} tags={ACT2_TAGS} printKeep={keepFilm} objects={(s) => <World s={s} />} />;
}

/** The summary at the sign-off (still (d)), then held: the whole system at 0.64x with the route traced once. */
export function SummaryFrame({ f, angle = ANGLE, bloom = BLOOM, objects = true }: { f: number; angle?: Angle; bloom?: boolean; objects?: boolean }) {
  const labels = useMemo(() => summaryLabelsAt(f), [f]);
  return (
    <DeskFrame
      f={f}
      angle={angle}
      bloom={bloom}
      poseAt={poseD}
      span={segmentSpan('summary')}
      stateAt={summaryDeskState}
      printKeep={keepTexture}
      labels={labels}
      objects={(s) =>
        objects ? (
          <>
            <World s={s} />
            <Proposed />
            <Trace a={summaryAt(s.f)} printFamily={PRINT_CSS} />
          </>
        ) : null
      }
    />
  );
}

/** Narration is drawn by the notes block; every other text or card cue from BUILT_TO on is not built yet. */
const NARRATED = new Set<string>(NARRATION);
const SLATE_CUES = cues.events.filter((e) => (e.kind === 'text' || e.kind === 'card') && !NARRATED.has(e.id) && e.frame >= BUILT_TO);

/**
 * The animatic's slate: the words of each cue the world does not draw yet, upper right, EN over zh, on its
 * cue's window (the 6 f wipe in and fade out), under a small "animatic" mark, so the cue sheet's timing can be
 * read against the picture and the score. Draft only: every cue gets its real place as its beat is built.
 */
function AnimaticSlate({ f }: { f: number }) {
  const { fonts, ready } = useFilmFonts();
  if (!ready || f < BUILT_TO) return null;
  const size = TYPE.label.size;
  const shown = SLATE_CUES.filter((e) => cueReveal(e.id, f).visible);
  let y = 132;
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ ...GREY_TEXT, position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <Label x={1824} y={84} text="animatic · not built yet" family={fonts.sans} size={36} weight={400} cjkWeight={400} color={TEXT_HEX.zh} anchor="end" />
        {shown.map((e) => {
          const r = cueReveal(e.id, f);
          const lines = Object.entries(e.text ?? {}).flatMap(([lang, s]) => s.split('\n').map((t) => ({ lang, t })));
          const g = (
            <g key={e.id} opacity={r.opacity}>
              {lines.map((l, i) => (
                <Label key={i} x={1824} y={y + i * 50} text={l.t} family={fonts.sans} size={size} weight={l.lang === 'en' ? TYPE.label.weight : TYPE.label.cjkWeight} cjkWeight={TYPE.label.cjkWeight} color={l.lang === 'en' ? TEXT_HEX.en : TEXT_HEX.zh} anchor="end" />
              ))}
            </g>
          );
          y += lines.length * 50 + 24;
          return g;
        })}
      </svg>
    </AbsoluteFill>
  );
}

/** One film frame. */
export function FilmFrame({ f }: { f: number }) {
  const kind = segmentAt(f);
  return (
    <AbsoluteFill>
      {kind === 'actOne' && <ActOneFrame key="actOne" f={f} angle={ANGLE} bloom={BLOOM} />}
      {kind === 'turn' && <TurnFrame key="turn" f={f} angle={ANGLE} bloom={BLOOM} />}
      {kind === 'act2' && <Act2Frame key="act2" f={f} />}
      {kind === 'summary' && <SummaryFrame key="summary" f={f} />}
      <AnimaticSlate f={f} />
    </AbsoluteFill>
  );
}

