/**
 * One frame of act one (desk/actOne.ts; STORYBOARD 1.1–3.3, film f0–1399): the same world, light set,
 * kit and DOM text layer as DeskFrame, posed for the frames before the turn. The camera is the film's
 * (camera.ts cameraAt: the hook at 1.6x, bar 3's ease out to FRAMING_A); the light is act one's (your
 * lamp's pool only, the footprints of what exists then); the desk shows none of the history marks that
 * come later (grooves, pressed folders); the only role label is yours, from beat 2.
 *
 * Beat 1 lays the title card over the desk's lower-left (objects/TitleCard.tsx); beat 3 brings in Fix A
 * and Fix B (desk/beat3.ts) through the turn's own components (objects/Turn.tsx FixA, FixB), so at
 * f1400 TurnFrame takes over the same objects in the same poses.
 */
import { Stage3D, useFont, type CamPose } from '@aiv/remotion-kit';
import { useLayoutEffect, useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { FIX_A, FIX_B, WORDS } from '../cues.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { TYPE } from '../look/tokens.ts';
import { ACT_ONE_END, YOU_SHIFT_A, actOneAt, actOneFootprints, actOnePools, youLabelAt } from './actOne.ts';
import { TRAY_CARD, fixAAt, fixAFootprints, fixBAt, fixBFootprints } from './beat3.ts';
import { cameraAt, FAR, FOV, NEAR, project, type Angle } from './camera.ts';
import { DeskWorld } from './DeskWorld.tsx';
import { DESK_HEX } from './gl/desk.ts';
import { STEP_OWN } from './gl/materials.ts';
import { PRINT_FONT } from './gl/text.ts';
import { YOU, type P3 } from './layout.ts';
import { ActOneObjects, FollowUpCard } from './objects/ActOne.tsx';
import { Feeders } from './objects/Intake.tsx';
import { CARD_HEX, CardText, CardWorld, cardAt, cardFootprint, type CardSpec } from './objects/TitleCard.tsx';
import { FixA, FixB, GREY_LIGHT } from './objects/Turn.tsx';
import { YourDesk } from './objects/YourDesk.tsx';
import { Overlay, type RoleLabel } from './Overlay.tsx';
import { Step } from './kit.tsx';
import { deskStateAt, type DeskState } from './state.ts';
import { fixATurnAt, fixBTurnAt, loopTurnAt, shiftAt, type FixATurn, type FixBTurn, type Press } from './turn.ts';

/**
 * "you · 你": a hairline from your in-tray's east wall (it ends on a body of your desk) out past the loop to clear ground,
 * crossing the tape south of F8's note, where it is bare (still (a)'s critic: it crossed tape print), the label on clear
 * ground above Fix B's trays (beat 3).
 */
export const ACT_ONE_LABELS: readonly RoleLabel[] = [{ text: `${WORDS.you.en} · ${WORDS.you['zh-Hans']}`, foot: [YOU.inTray.x1 - 2 + YOU_SHIFT_A[0], YOU.inTray.y0 + 14 + YOU_SHIFT_A[1], YOU.top + 18], dx: 172, dy: -40, anchor: 'start' }];

/**
 * The title card (STORYBOARD 1.2): lower-left, inside title-safe, over the notes band (free from C1's fade at f140 to
 * C2's wipe at f400), clear of your desk at 1.2x (the frame opens on your lamp, laptop and empty chore tray). It slides
 * in on bar 2's last beat and lands on the thump (`title-thump`, f160) as the camera starts to ease out; the title
 * wipes in on `title`, the credit on `credit`; both fade by f380, and the card lifts and slides away.
 */
const [TITLE_EN_1, TITLE_EN_2] = [WORDS.title.en.slice(0, WORDS.title.en.indexOf(' the ')), WORDS.title.en.slice(WORDS.title.en.indexOf(' the ') + 1)];
const CREDIT_EN = WORDS.credit.en;
const CREDIT_EN_CUT = CREDIT_EN.indexOf(' by ') + 4;
const CREDIT_ZH = WORDS.credit['zh-Hans'];
const CREDIT_ZH_CUT = CREDIT_ZH.indexOf('·') + 1;
export const TITLE_CARD: CardSpec = {
  rect: { x: 96, y: 446, w: 656, h: 580 },
  frames: { enter: 138, land: 160, leave: 380, gone: 392 },
  mark: 'No.',
  hole: { x: 600, y: 48, r: 13 },
  lines: [
    { text: TITLE_EN_1, size: TYPE.titleEn.size, weight: TYPE.titleEn.weight, color: CARD_HEX.ink, x: 52, y: 150, cue: 'title' },
    { text: TITLE_EN_2, size: TYPE.titleEn.size, weight: TYPE.titleEn.weight, color: CARD_HEX.ink, x: 52, y: 246, cue: 'title' },
    { text: WORDS.title['zh-Hans'], size: TYPE.titleZh.size, weight: TYPE.titleZh.weight, color: CARD_HEX.zh, x: 52, y: 330, cue: 'title' },
    { text: CREDIT_EN.slice(0, CREDIT_EN_CUT).trimEnd(), size: TYPE.sublineEn.size, weight: TYPE.sublineEn.weight, color: CARD_HEX.ink, x: 52, y: 410, cue: 'credit' },
    { text: CREDIT_EN.slice(CREDIT_EN_CUT), size: TYPE.sublineEn.size, weight: TYPE.sublineEn.weight, color: CARD_HEX.ink, x: 52, y: 458, cue: 'credit' },
    { text: CREDIT_ZH.slice(0, CREDIT_ZH_CUT), size: TYPE.sublineZh.size, weight: TYPE.sublineZh.weight, color: CARD_HEX.zh, x: 52, y: 512, cue: 'credit' },
    { text: CREDIT_ZH.slice(CREDIT_ZH_CUT).trimStart(), size: TYPE.sublineZh.size, weight: TYPE.sublineZh.weight, color: CARD_HEX.zh, x: 52, y: 560, cue: 'credit' },
  ],
};

/** The turn's own Fix A and Fix B at f1400, which beat 3 runs up to (desk/beat3.ts fixAAt, fixBAt); made once, on first use. */
let atTurn: { a: FixATurn; b: FixBTurn } | null = null;
const turnFixes = () => (atTurn ??= { a: fixATurnAt(1400, loopTurnAt(1400)), b: fixBTurnAt(1400, shiftAt) });
export const fixAOf = (f: number) => fixAAt(f, turnFixes().a);
export const fixBOf = (f: number) => fixBAt(f, turnFixes().b);

/** Fix A's folder in the turn's pose at f1400 (not yet pressed), and the queue-only instances' (no folder drawn). */
const UNPRESSED: Press = { k: 0, scaleZ: 1, tilt: 0, sink: 0 };
const NO_FOLDER: Press = { k: 1, scaleZ: 0.06, tilt: 0.06, sink: 0 };

/** Act one's footprints at a frame: the world's, the title card's, Fix A's and Fix B's in beat 3 (at most MAX_FOOTPRINTS: actOne.test.ts). */
export function actOneFrameFootprints(f: number, pose: CamPose) {
  const a = actOneAt(f);
  const fp = actOneFootprints(a);
  const card = cardFootprint(TITLE_CARD, cardAt(TITLE_CARD, f), pose);
  if (card) fp.push(card);
  const inFrame = (p: P3) => {
    const s = project(pose, p);
    return s[0] > -60 && s[0] < 1980 && s[1] > -60 && s[1] < 1140;
  };
  if (f >= FIX_A.in) fp.push(...fixAFootprints(fixAOf(f), inFrame));
  if (f >= FIX_B.in) fp.push(...fixBFootprints(fixBOf(f)));
  return fp;
}

/** What act one sets on the kit's shared uniforms before the frame is drawn: the `own` ramp (beat 3's focus on the fixes). */
function ActOneUniforms({ own }: { own: number }) {
  useLayoutEffect(() => {
    STEP_OWN.value = own;
  }, [own]);
  return null;
}

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
  const s = useMemo((): DeskState => ({ ...deskStateAt(wf), step: a.step, testsStep: a.stepA }), [wf, a]);
  const pose = useMemo(() => cameraAt(wf, angle), [wf, angle]);
  const footprints = useMemo(() => actOneFrameFootprints(wf, pose), [wf, pose]);
  const pools = useMemo(() => actOnePools(a), [a]);
  const fa = useMemo(() => (wf >= FIX_A.in ? fixAOf(wf) : null), [wf]);
  const fb = useMemo(() => (wf >= FIX_B.in ? fixBOf(wf) : null), [wf]);
  const labels = useMemo((): RoleLabel[] => {
    const r = youLabelAt(wf);
    return r ? [{ ...ACT_ONE_LABELS[0], ...r }] : [];
  }, [wf]);
  return (
    <AbsoluteFill style={{ background: DESK_HEX.base }}>
      {all && (
        <Stage3D shadows={false} antialias={false} camera={{ fov: FOV, near: NEAR, far: FAR, position: [pose.pos[0], pose.pos[1], pose.pos[2]] }}>
          <DeskWorld s={s} pose={pose} bloom={bloom} printFamily={print.family} sansFamily={fonts.sans} footprints={footprints} pools={pools} marks={{ grooves: false, imprints: false }}>
            <ActOneUniforms own={a.step.own?.amount ?? 0} />
            {objects && (
              <>
                <YourDesk s={s} />
                <Feeders s={s} />
                <ActOneObjects a={a} printFamily={print.family} />
                <CardWorld spec={TITLE_CARD} f={wf} pose={pose} printFamily={print.family} />
                {fa && (
                  <group position={[0, -fa.rise, 0]}>
                    <Step on={a.stepA > 0 ? 'late' : false}>
                      <FixA fixA={fa.main} pressA={UNPRESSED} />
                      <FixA fixA={fa.extras[0]} pressA={NO_FOLDER} />
                      <FixA fixA={fa.extras[1]} pressA={NO_FOLDER} />
                    </Step>
                  </group>
                )}
                {fb && (
                  <>
                    <group position={[fb.rise, 0, 0]}>
                      <FixB fixB={fb.b} f={wf} />
                    </group>
                    {fb.followUp && <FollowUpCard p={fb.followUp.p} rot={fb.followUp.rot} tilt={fb.followUp.tilt} w={TRAY_CARD.w} d={TRAY_CARD.d} hex={GREY_LIGHT} />}
                  </>
                )}
              </>
            )}
          </DeskWorld>
        </Stage3D>
      )}
      <Overlay f={f} pose={pose} fonts={fonts} ready={all} labels={labels} />
      {all && <CardText spec={TITLE_CARD} f={wf} family={fonts.sans} />}
    </AbsoluteFill>
  );
}
