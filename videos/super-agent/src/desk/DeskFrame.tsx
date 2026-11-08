/**
 * One frame of the Register Desk: the fonts gate, the WebGL world under the kit's Stage3D, and the
 * DOM text over it, both posed by the one camera function (camera.ts).
 *
 * The Stage3D mounts only once every face is in: R3F draws when the frame changes, not when React
 * state does, so the printed textures (gl/text.ts) are drawn once, with their faces loaded
 * (packages/remotion-kit README.md, Canvas text).
 */
import { Stage3D, useFont } from '@aiv/remotion-kit';
import { useMemo, type ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { useFilmFonts } from '../look/fonts.ts';
import { deskCamera, FAR, FOV, FRAMING_B, NEAR, type Angle } from './camera.ts';
import { DeskWorld } from './DeskWorld.tsx';
import type { Footprint } from './footprints.ts';
import { DESK_HEX } from './gl/desk.ts';
import { PRINT_FONT } from './gl/text.ts';
import { Overlay } from './Overlay.tsx';
import { deskStateAt, type DeskState } from './state.ts';

/** The film frames this lookdev world is posed for; outside them it holds the nearest. */
export const LOOKDEV_SPAN: readonly [number, number] = [2100, 2340];

export interface DeskFrameProps {
  /** film frame (the leader excluded) */
  f: number;
  angle: Angle;
  bloom: boolean;
  /** the objects to draw at this state */
  objects: (s: DeskState) => ReactNode;
  /** footprints to cast instead of the layout's (the harness) */
  footprints?: Footprint[];
}

export function DeskFrame({ f, angle, bloom, objects, footprints }: DeskFrameProps) {
  const { fonts, ready } = useFilmFonts();
  const print = useFont(PRINT_FONT);
  const all = ready && print.ready;
  const wf = Math.min(Math.max(f, LOOKDEV_SPAN[0]), LOOKDEV_SPAN[1]);
  const s = useMemo(() => deskStateAt(wf), [wf]);
  const pose = useMemo(() => deskCamera(FRAMING_B, angle), [angle]);
  return (
    <AbsoluteFill style={{ background: DESK_HEX.base }}>
      {all && (
        <Stage3D shadows={false} antialias={false} camera={{ fov: FOV, near: NEAR, far: FAR, position: [pose.pos[0], pose.pos[1], pose.pos[2]] }}>
          <DeskWorld s={s} pose={pose} bloom={bloom} printFamily={print.family} sansFamily={fonts.sans} footprints={footprints}>
            {objects(s)}
          </DeskWorld>
        </Stage3D>
      )}
      <Overlay f={f} pose={pose} fonts={fonts} ready={all} />
    </AbsoluteFill>
  );
}
