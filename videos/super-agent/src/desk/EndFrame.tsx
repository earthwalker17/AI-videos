/**
 * The end's own world (STORYBOARD 13.2-13.3, film f6200-6719; film.ts SEGMENTS 'end'): from the end card's landing the
 * world has dissolved to the bare desk (desk/end.ts veilAt, complete on f6199), so this segment draws only what is left:
 * the bare desk under the key light at the bookend's framing (DeskWorld's ground with no marks: no grooves, no imprints,
 * its hatches shut), the end card (objects/End.tsx EndCardBody) and the end key's plate (EndKey), their shadows the only
 * footprints and the end's one soft pool the only pool (endCard.ts endPools; gl/veil.ts END_LIGHT lit the veil's bare desk
 * the same way under the dissolve, so f6199 and f6200 draw the same desk). Over it, the card's lettering (objects/End.tsx
 * EndCardText on the 'end' cue) and the key's words (EndText). One WebGL world, as every segment: FilmFrame keys it, so it
 * mounts fresh at the landing.
 */
import { Stage3D, useFont } from '@aiv/remotion-kit';
import { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { useFilmFonts } from '../look/fonts.ts';
import { cameraAt, FAR, FOV, NEAR, type Angle } from './camera.ts';
import { DeskWorld, type DeskMarks } from './DeskWorld.tsx';
import { endCardAt, endPools, endWorldFootprints } from './endCard.ts';
import { keepFilm } from './film.ts';
import { DESK_HEX } from './gl/desk.ts';
import { PRINT_FONT } from './gl/text.ts';
import { EndCardBody, EndCardText, EndKey, EndText } from './objects/End.tsx';
import { Overlay } from './Overlay.tsx';
import { summaryDeskState } from './summary.ts';

/** The print face's CSS family (FilmFrame's PRINT_CSS: the card's "№" prints in it in both worlds). */
export const END_PRINT_CSS = `"AIV ${PRINT_FONT.family}"`;

/** The bare desk: no grooves, no imprints (gl/veil.ts's veil is the same slate). */
const BARE: DeskMarks = { grooves: false, imprints: false };

export function EndFrame({ f, angle, bloom }: { f: number; angle: Angle; bloom: boolean }) {
  const { fonts, ready } = useFilmFonts();
  const print = useFont(PRINT_FONT);
  const all = ready && print.ready;
  const s = useMemo(() => summaryDeskState(f), [f]);
  const pose = useMemo(() => cameraAt(f, angle), [f, angle]);
  const footprints = useMemo(() => endWorldFootprints(f), [f]);
  const pools = useMemo(() => endPools(f), [f]);
  const card = useMemo(() => endCardAt(f), [f]);
  return (
    <AbsoluteFill style={{ background: DESK_HEX.base }}>
      {all && (
        <Stage3D shadows={false} antialias={false} camera={{ fov: FOV, near: NEAR, far: FAR, position: [pose.pos[0], pose.pos[1], pose.pos[2]] }}>
          <DeskWorld s={s} pose={pose} bloom={bloom} printFamily={print.family} sansFamily={fonts.sans} footprints={footprints} pools={pools} marks={BARE} printKeep={keepFilm}>
            <EndCardBody f={f} printFamily={END_PRINT_CSS} />
            <EndKey f={f} />
          </DeskWorld>
        </Stage3D>
      )}
      <Overlay f={f} pose={pose} fonts={fonts} ready={all} labels={[]} tags={[]} />
      {all && <EndCardText f={f} family={fonts.sans} pose={pose} state={card} />}
      {all && <EndText f={f} />}
    </AbsoluteFill>
  );
}
