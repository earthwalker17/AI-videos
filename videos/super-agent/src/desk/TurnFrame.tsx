/**
 * One frame of the turn (MT2, film f1400–1660; desk/turn.ts): the same world, light set, kit and DOM
 * text layer as act one and act two, posed by the turn's schedule. The camera is the film's
 * (camera.ts cameraAt: bar 19's downbeat, 1.2x to 0.85x over two bars), so the DOM labels and the
 * notes ride the same pose; the narration is the cue sheet's (C8, then C9). History marks: no
 * grooves yet (no task has been handed over), the folders' imprints as they are pressed in.
 */
import { Stage3D, useFont } from '@aiv/remotion-kit';
import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import { AbsoluteFill } from 'remotion';
import { WORDS } from '../cues.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { cameraAt, FAR, FOV, NEAR, type Angle } from './camera.ts';
import { DeskWorld } from './DeskWorld.tsx';
import { DESK_HEX } from './gl/desk.ts';
import { PRINT_FONT } from './gl/text.ts';
import { useDeskMats } from './kit.tsx';
import { CHUTE, REEL, YOU, rectC } from './layout.ts';
import { ActOneObjects } from './objects/ActOne.tsx';
import { Chute } from './objects/Links.tsx';
import { Feeders, Gate } from './objects/Intake.tsx';
import { DeckPose, Register } from './objects/Register.tsx';
import { TurnObjects } from './objects/Turn.tsx';
import { YourDesk } from './objects/YourDesk.tsx';
import { Overlay, type RoleLabel } from './Overlay.tsx';
import { TURN_SPAN, imprintsAt, turnAt, turnDeskState, turnFootprints, turnPools, type TurnState } from './turn.ts';
import type { DeskState } from './state.ts';

/** The labels as they re-enter once the camera has settled: yours at your act-two place, the Router's on its reel (as ROLE_LABELS). */
function turnLabels(t: TurnState): RoleLabel[] {
  const out: RoleLabel[] = [];
  if (t.labels.you) out.push({ text: `${WORDS.you.en} · ${WORDS.you['zh-Hans']}`, foot: [YOU.slab.x0 + 14, rectC(YOU.slab)[1] - 30, YOU.top], dx: -84, dy: 30, anchor: 'end', ...t.labels.you });
  if (t.labels.router) out.push({ text: WORDS.router.en, foot: [REEL.x + 92, REEL.y - 40, REEL.packZ[1]], dx: 150, dy: 30, anchor: 'start', ...t.labels.router });
  return out;
}

/** The chute hinges down from the deck's south-west corner (riding with the deck), its posts telescoping to the desk. */
const CHUTE_AXIS = (() => {
  const d = new Vector3(CHUTE[CHUTE.length - 1][0] - CHUTE[0][0], CHUTE[CHUTE.length - 1][1] - CHUTE[0][1], 0).normalize();
  return new Vector3(d.y, -d.x, 0).negate();
})();
function TurnChute({ t }: { t: TurnState }) {
  const q = useMemo(() => new Quaternion().setFromAxisAngle(CHUTE_AXIS, t.parts.chute), [t.parts.chute]);
  const top = CHUTE[0];
  return (
    <DeckPose pose={t.deck}>
      <group position={[top[0], top[1], top[2]]} quaternion={q}>
        <group position={[-top[0], -top[1], -top[2]]}>
          <Chute posts={t.parts.posts} />
        </group>
      </group>
    </DeckPose>
  );
}

/** The Register posed by the turn (its tape's material from the kit). */
function TurnRegister({ s, t }: { s: DeskState; t: TurnState }) {
  const m = useDeskMats();
  const tape = t.tape.leader < 1 ? null : t.tape.print === 'first' ? m.printed.tapeFirst : m.printed.tapeBlank;
  return <Register s={s} turn={{ deck: t.deck, parts: t.parts, tape, hammer: t.tape.hammer, jewel: t.tape.jewel }} />;
}

export interface TurnFrameProps {
  /** film frame (the leader excluded) */
  f: number;
  angle: Angle;
  bloom: boolean;
  /** draw the objects (false: the bare desk with the same light) */
  objects?: boolean;
}

export function TurnFrame({ f, angle, bloom, objects = true }: TurnFrameProps) {
  const { fonts, ready } = useFilmFonts();
  const print = useFont(PRINT_FONT);
  const all = ready && print.ready;
  const wf = Math.min(Math.max(f, TURN_SPAN[0]), TURN_SPAN[1]);
  const t = useMemo(() => turnAt(wf), [wf]);
  const s = useMemo(() => turnDeskState(wf), [wf]);
  const footprints = useMemo(() => turnFootprints(t), [t]);
  const pools = useMemo(() => turnPools(t), [t]);
  const imprints = useMemo(() => imprintsAt(t), [t]);
  const pose = useMemo(() => cameraAt(wf, angle), [wf, angle]);
  const labels = useMemo(() => turnLabels(t), [t]);
  return (
    <AbsoluteFill style={{ background: DESK_HEX.base }}>
      {all && (
        <Stage3D shadows={false} antialias={false} camera={{ fov: FOV, near: NEAR, far: FAR, position: [pose.pos[0], pose.pos[1], pose.pos[2]] }}>
          <DeskWorld s={s} pose={pose} bloom={bloom} printFamily={print.family} sansFamily={fonts.sans} footprints={footprints} pools={pools} marks={{ grooves: false, imprints }}>
            {objects && (
              <>
                <YourDesk s={s} pose={t.you} />
                <Feeders s={s} turn={{ spool: t.intake.spool, mail: t.intake.mail, calendar: t.intake.calendar }} />
                <Gate s={s} drop={{ gate: t.intake.gate, belt: t.intake.belt }} />
                {f >= 1452 && <TurnChute t={t} />}
                <ActOneObjects a={t.act} printFamily={print.family} press={t.press} loop={false} />
                {f >= 1452 && <TurnRegister s={s} t={t} />}
                <TurnObjects t={t} printFamily={print.family} />
              </>
            )}
          </DeskWorld>
        </Stage3D>
      )}
      <Overlay f={f} pose={pose} fonts={fonts} ready={all} labels={labels} />
    </AbsoluteFill>
  );
}
