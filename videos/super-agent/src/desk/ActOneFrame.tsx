/**
 * One frame of act one (desk/actOne.ts): the same world, light set, kit and DOM text layer as
 * DeskFrame, posed for the frames before the turn. The camera is FRAMING_A; the light is act one's
 * (your lamp's pool only, the footprints of what exists then); the desk shows none of the history
 * marks that come later (grooves, pressed folders); the only role label is yours.
 */
import { Stage3D, useFont } from '@aiv/remotion-kit';
import { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { WORDS } from '../cues.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { ACT_ONE_END, YOU_SHIFT_A, actOneAt, actOneFootprints, actOnePools } from './actOne.ts';
import { deskCamera, FAR, FOV, FRAMING_A, NEAR, type Angle } from './camera.ts';
import { DeskWorld } from './DeskWorld.tsx';
import { DESK_HEX } from './gl/desk.ts';
import { PRINT_FONT } from './gl/text.ts';
import { YOU, rectC } from './layout.ts';
import { ActOneObjects } from './objects/ActOne.tsx';
import { Feeders } from './objects/Intake.tsx';
import { YourDesk } from './objects/YourDesk.tsx';
import { Overlay, type RoleLabel } from './Overlay.tsx';
import { deskStateAt, type DeskState } from './state.ts';

/** "you · 你": a hairline from the desk's east end (it ends on the slab) out past the loop to clear ground. */
export const ACT_ONE_LABELS: readonly RoleLabel[] = [{ text: `${WORDS.you.en} · ${WORDS.you['zh-Hans']}`, foot: [YOU.slab.x1 - 16 + YOU_SHIFT_A[0], rectC(YOU.slab)[1] + YOU_SHIFT_A[1] + 10, YOU.top], dx: 150, dy: 30, anchor: 'start' }];

export interface ActOneFrameProps {
  /** film frame (the leader excluded) */
  f: number;
  angle: Angle;
  bloom: boolean;
  /** draw the objects (false: the bare desk with the same light, for the silhouette sheet) */
  objects?: boolean;
}

export function ActOneFrame({ f, angle, bloom, objects = true }: ActOneFrameProps) {
  const { fonts, ready } = useFilmFonts();
  const print = useFont(PRINT_FONT);
  const all = ready && print.ready;
  const wf = Math.min(Math.max(f, 0), ACT_ONE_END - 1);
  const a = useMemo(() => actOneAt(wf), [wf]);
  const s = useMemo((): DeskState => ({ ...deskStateAt(wf), step: a.step }), [wf, a]);
  const footprints = useMemo(() => actOneFootprints(a), [a]);
  const pools = useMemo(() => actOnePools(a), [a]);
  const pose = useMemo(() => deskCamera(FRAMING_A, angle), [angle]);
  return (
    <AbsoluteFill style={{ background: DESK_HEX.base }}>
      {all && (
        <Stage3D shadows={false} antialias={false} camera={{ fov: FOV, near: NEAR, far: FAR, position: [pose.pos[0], pose.pos[1], pose.pos[2]] }}>
          <DeskWorld s={s} pose={pose} bloom={bloom} printFamily={print.family} sansFamily={fonts.sans} footprints={footprints} pools={pools} marks={{ grooves: false, imprints: false }}>
            {objects && (
              <>
                <YourDesk s={s} />
                <Feeders s={s} />
                <ActOneObjects a={a} printFamily={print.family} />
              </>
            )}
          </DeskWorld>
        </Stage3D>
      )}
      <Overlay f={f} pose={pose} fonts={fonts} ready={all} labels={ACT_ONE_LABELS} />
    </AbsoluteFill>
  );
}
