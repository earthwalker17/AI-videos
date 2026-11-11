/**
 * One frame of the turn (MT2, film f1400–1660; desk/turn.ts): the same world, light set, kit and DOM
 * text layer as act one and act two, posed by the turn's schedule. The camera is the film's
 * (camera.ts cameraAt: bar 19's downbeat, 1.2x to 0.85x over two bars), so the DOM labels and the
 * notes ride the same pose; the narration is the cue sheet's (C8, then C9). History marks: no
 * grooves yet (no task has been handed over), the imprints as they are pressed in.
 *
 * Its last frame (f1660) is the world act two takes over (desk/film.ts, FilmFrame): the same print mode as act two
 * (film.ts keepFilm), the bays closed and idle, the reel at the angle beat 4 turns on from, the request rising out of
 * the old heap (desk/beat4.ts, drawn by the same components), your lamp at act two's level.
 */
import { Stage3D, useFont } from '@aiv/remotion-kit';
import { useLayoutEffect, useMemo } from 'react';
import { Vector4 } from 'three';
import { AbsoluteFill } from 'remotion';
import { useFilmFonts } from '../look/fonts.ts';
import { cameraAt, FAR, FOV, NEAR, type Angle } from './camera.ts';
import { DeskWorld } from './DeskWorld.tsx';
import { DESK_GROOVE_CUT, DESK_HEX, DESK_HOLES, HOLE_SHUT } from './gl/desk.ts';
import { PRINT_FONT } from './gl/text.ts';
import { REQUEST_FROM } from './beat4.ts';
import { keepFilm } from './film.ts';
import { useDeskSets } from './kit.tsx';
import type { Rect } from './layout.ts';
import { ActOneObjects } from './objects/ActOne.tsx';
import { TurnChute } from './objects/Links.tsx';
import { Feeders, Gate } from './objects/Intake.tsx';
import { Register } from './objects/Register.tsx';
import { Backlog, TurnObjects } from './objects/Turn.tsx';
import { YourDesk } from './objects/YourDesk.tsx';
import { Overlay, ROLE_LABELS, type RoleLabel } from './Overlay.tsx';
import { TURN, TURN_SPAN, chutePath, imprintsAt, turnAt, turnDeskState, turnFootprints, turnHoles, turnPools, type TurnState } from './turn.ts';
import type { DeskState } from './state.ts';

/**
 * The labels as they enter once the camera has settled (your act-one label left as beat 3 began): yours at your act-two
 * place, the Router's on the dispatch housing (both as ROLE_LABELS).
 */
function turnLabels(t: TurnState): RoleLabel[] {
  const out: RoleLabel[] = [];
  if (t.labels.you) out.push({ ...ROLE_LABELS[2], ...t.labels.you });
  if (t.labels.router) out.push({ ...ROLE_LABELS[0], ...t.labels.router });
  return out;
}

/** The Register posed by the turn: its tape's run (the leader the turn lays, then its rows as beat 4 prints them: desk/beat4.ts), its head, its jewel. */
function TurnRegister({ s, t }: { s: DeskState; t: TurnState }) {
  return <Register s={s} turn={{ deck: t.deck, parts: t.parts, tape: t.tape.leader >= 1, hammer: t.tape.hammer, jewel: t.tape.jewel }} />;
}

/** A hatch in the desk over a bay's box (with its seam). */
const holeOf = (r: Rect): Vector4 => new Vector4(r.x0 - 1.2, r.y0 - 1.2, r.x1 + 1.2, r.y1 + 1.2);

/** What the turn sets on shared uniforms before the frame is drawn: the hatches the bays rise through, the vellum feeders' opacity. */
function TurnUniforms({ t }: { t: TurnState }) {
  const sets = useDeskSets();
  const holes = turnHoles(t);
  const key = holes.map((h) => `${h.x0},${h.y0}`).join(';');
  const mail = t.intake.mail.k;
  const calendar = t.intake.calendar.k;
  const step = t.step;
  useLayoutEffect(() => {
    for (let i = 0; i < DESK_HOLES.value.length; i++) DESK_HOLES.value[i] = holes[i] ? holeOf(holes[i]) : HOLE_SHUT();
    // no groove is cut before a task is handed over (beat 4)
    DESK_GROOVE_CUT.value.splice(0, DESK_GROOVE_CUT.value.length, 0, 0, 0, 0);
    // the vellum drawings are laid down as the generic feeders press flat (a stepped drawing a step fainter, as DeskUniforms does)
    for (const [set, k] of [
      [sets.full, 0],
      [sets.stepped, step],
    ] as const) {
      set.vellumMail.opacity = mail * (1 - 0.4 * k);
      set.vellumCalendar.opacity = calendar * (1 - 0.4 * k);
    }
  }, [key, sets, mail, calendar, step]);
  return null;
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
  const chute = useMemo(() => (t.parts.chute > 0 ? chutePath(t.parts.chute) : null), [t.parts.chute]);
  return (
    <AbsoluteFill style={{ background: DESK_HEX.base }}>
      {all && (
        <Stage3D shadows={false} antialias={false} camera={{ fov: FOV, near: NEAR, far: FAR, position: [pose.pos[0], pose.pos[1], pose.pos[2]] }}>
          <DeskWorld s={s} pose={pose} bloom={bloom} printFamily={print.family} sansFamily={fonts.sans} footprints={footprints} pools={pools} marks={{ grooves: false, imprints }} printKeep={keepFilm}>
            <TurnUniforms t={t} />
            {objects && (
              <>
                <YourDesk s={s} pose={t.you} />
                <Feeders s={s} turn={{ spool: t.intake.spool, mail: t.intake.mail, calendar: t.intake.calendar }} />
                <Gate s={s} belt={t.intake.belt} />
                {chute && <TurnChute path={chute} posts={t.parts.posts} />}
                {/* act one's folders and heap until the request starts out of the heap (its crease gathering: beat4.ts REQUEST_FROM); then the heap and the request as beat 4 moves them (act two draws the same) */}
                {wf < REQUEST_FROM ? <ActOneObjects a={t.act} printFamily={print.family} press={t.press} loop={false} stepRequest={t.step > 0} /> : <Backlog a={t.act} heap={s.b4.heap} request={s.b4.request} f={wf} stepRequest={t.step > 0} />}
                {wf >= TURN.deckIn && <TurnRegister s={s} t={t} />}
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
