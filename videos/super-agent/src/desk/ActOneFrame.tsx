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
import { Stage3D, useFont } from '@aiv/remotion-kit';
import { useLayoutEffect, useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { FIX_A, FIX_B, WORDS } from '../cues.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { NOTES, TYPE } from '../look/tokens.ts';
import { GREY_TEXT, Label, lineWidth, type TextLook } from '../kit/text.tsx';
import { cueReveal } from './onScreen.ts';
import type { FilmFonts } from '../look/fonts.ts';
import { ACT_ONE_END, YOU_SHIFT_A, actOneAt, actOneFootprints, actOnePools, youLabelAt } from './actOne.ts';
import { fixAAt, fixAFootprints, fixBAt, fixBFootprints } from './beat3.ts';
import { cameraAt, FAR, FOV, NEAR, type Angle } from './camera.ts';
import { DeskWorld } from './DeskWorld.tsx';
import { DESK_HEX } from './gl/desk.ts';
import { STEP_OWN } from './gl/materials.ts';
import { PRINT_FONT } from './gl/text.ts';
import { YOU } from './layout.ts';
import { ActOneObjects } from './objects/ActOne.tsx';
import { Feeders } from './objects/Intake.tsx';
import { CARD_HEX, CardText, CardWorld, cardAt, cardContactFootprint, cardFootprint, type CardSpec } from './objects/TitleCard.tsx';
import { FixA, FixB } from './objects/Turn.tsx';
import { YourDesk } from './objects/YourDesk.tsx';
import { Overlay, SoftGround, notesLookDesk, type GroundBox, type RoleLabel } from './Overlay.tsx';
import { Step } from './kit.tsx';
import { deskStateAt, type DeskState } from './state.ts';
import type { Press } from './turn.ts';

/**
 * "you · 你": a hairline from your in-tray's east wall (it ends on a body of your desk) out past the loop to clear ground,
 * crossing the tape south of F8's note, where it is bare (still (a)'s critic: it crossed tape print), the label on clear
 * ground above Fix B's trays (beat 3).
 */
export const ACT_ONE_LABELS: readonly RoleLabel[] = [{ text: `${WORDS.you.en} · ${WORDS.you['zh-Hans']}`, foot: [YOU.inTray.x1 - 2 + YOU_SHIFT_A[0], YOU.inTray.y0 + 14 + YOU_SHIFT_A[1], YOU.top + 18], dx: 172, dy: -40, anchor: 'start' }];

/**
 * The title card (STORYBOARD 1.2): a bone index card posted in once C1 has gone, landing on the thump (`title-thump`,
 * f160) as the camera starts to ease out. It lies low on the desk in the world, so it rides the move with the desk: on the
 * flat tail of the heap south of the request (its showing corner stays in view the whole time), east of the calendar pad
 * and west of your loop's clip, above the notes band at the hook's 1.6x and inside title-safe at 1.2x. Its underside
 * rests on the flat leaves and the envelope under its north-west corner (the heap's tail; HEAP pieces 3, 7, 13 and the
 * calendar's torn leaf). The title wipes in on `title`; its lettering is 36 u and 31 u (58 px and 50 px at the hook, 43 px
 * and 37 px at 1.2x). The credit (a text cue) is set as a line in the notes band, knocked out of whatever it crosses
 * (your loop's tape comes up under it as the camera eases out). Both fade by f380, as the card slides off the west edge
 * (wholly off on f379).
 */
const [TITLE_EN_1, TITLE_EN_2] = [WORDS.title.en.slice(0, WORDS.title.en.indexOf(' the ')), WORDS.title.en.slice(WORDS.title.en.indexOf(' the ') + 1)];
export const TITLE_CARD: CardSpec = {
  place: { x0: -878, y1: 82, w: 294, d: 134, z: 3.4 },
  // it leaves 11 f before it is gone (3 f anticipation, an 8 f slide): its title fades on its cue (f374) as it goes
  frames: { enter: 141, land: 160, leave: 368, gone: 380 },
  mark: '№',
  // top right: over the card's own margin, clear of the lettering
  hole: { x: 279, y: 14, r: 5 },
  lines: [
    { text: TITLE_EN_1, size: 36, weight: TYPE.titleEn.weight, color: CARD_HEX.ink, x: 20, y: 41, cue: 'title' },
    { text: TITLE_EN_2, size: 36, weight: TYPE.titleEn.weight, color: CARD_HEX.ink, x: 20, y: 79, cue: 'title' },
    { text: WORDS.title['zh-Hans'], size: 31, weight: TYPE.titleZh.weight, color: CARD_HEX.zh, x: 20, y: 120, cue: 'title' },
  ],
};
/** The credit: a text cue, set in the notes band like every line meant to be read (screen-fixed, still while read). */
export const CREDIT_CUE = 'credit';
/** The credit's knockout round its line's box (px, each side). */
export const CREDIT_KO = 9;
/** A line's ink box over and under its baseline (em): the Latin ascenders and the Han glyphs' tops, the descenders. */
export const CREDIT_INK = { up: 0.95, down: 0.27 } as const;

/**
 * The EN line's knockout top (em over its baseline and px more): its tallest ink (the ascenders, the apostrophe) and a
 * hair; the feather lies over it. The knockout's top had stood a quarter em and CREDIT_KO over the ink, and as the camera
 * eased out it sliced the loop's tape flat along a line where no glyph was (wave 4's critic P2-b).
 */
export const CREDIT_TOP = { up: 0.8, pad: 2 } as const;
/** One line's knockout box (px: its ink box and CREDIT_KO round it; `top`, px over the baseline, if given), from its measured width. */
export function creditBox(x: number, baseline: number, width: number, size: number, top?: number): { x: number; y: number; w: number; h: number } {
  const y = baseline - (top ?? CREDIT_INK.up * size + CREDIT_KO);
  return { x: x - CREDIT_KO, y, w: width + 2 * CREDIT_KO, h: baseline + CREDIT_INK.down * size + CREDIT_KO - y };
}

/**
 * The credit in the notes band (NOTES: the tick and the EN line, like every caption since the zh captions were dropped on
 * 2026-11-13, Overlay.tsx; a 6 f wipe in, a 6 f fade out), knocked out of the desk's tone as one box (its ink box and
 * 9 px round it): as the camera eases out your loop's tape comes up under the line, and the box takes it out under it, so
 * every glyph sits on the desk's tone (the desk renders there at its base, within a code). One box, not a knockout round
 * each glyph, which left scalloped tape slivers between and over them (the critic's P2). The knockout's edge is feathered
 * (CREDIT_FEATHER, Overlay.tsx SoftGround), so the tape fades into it rather than being cut square by an edge with nothing
 * there to cut it (wave 0's critic P2-3); its wipe leads the words' with the same feather.
 */
function CreditLine({ f, fonts, ready }: { f: number; fonts: FilmFonts; ready: boolean }) {
  const r = cueReveal(CREDIT_CUE, f);
  if (!r.visible || !ready) return null;
  const look = notesLookDesk(fonts);
  const clip = r.wipe >= 1 ? undefined : `inset(0px ${((1 - r.wipe) * (1920 - NOTES.x)).toFixed(2)}px 0px 0px)`;
  const box = (text: string, baseline: number, l: TextLook, top?: number): GroundBox => {
    const b = creditBox(NOTES.x, baseline, lineWidth(text, l), l.size, top);
    return { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h };
  };
  const edge = r.wipe >= 1 ? undefined : NOTES.x + r.wipe * (1920 - NOTES.x);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: r.opacity }}>
        <SoftGround id="credit-ko" boxes={[box(WORDS.credit.en, NOTES.enBaseline, look.en, CREDIT_TOP.up * look.en.size + CREDIT_TOP.pad)]} feather={CREDIT_FEATHER} color={DESK_HEX.base} alpha={1} edge={edge} />
      </div>
      <CreditWords r={r} clip={clip} look={look} />
    </>
  );
}
/** The knockout's feather outside its boxes (px). */
export const CREDIT_FEATHER = 10;
function CreditWords({ r, clip, look }: { r: { opacity: number }; clip: string | undefined; look: ReturnType<typeof notesLookDesk> }) {
  return (
    <div style={{ ...GREY_TEXT, position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, clipPath: clip, opacity: r.opacity }}>
      <svg width={1920} height={1080} style={{ display: 'block', overflow: 'visible' }}>
        <rect x={NOTES.tick.x} y={NOTES.tick.top} width={NOTES.tick.width} height={NOTES.tick.height} fill={look.tick} />
        <Label x={NOTES.x} y={NOTES.enBaseline} text={WORDS.credit.en} family={look.en.family} size={look.en.size} weight={look.en.weight} color={look.en.color} />
      </svg>
    </div>
  );
}

/** Beat 3's Fix A and Fix B (desk/beat3.ts): pure schedules of the film frame, which the turn takes over from f1400. */
export const fixAOf = (f: number) => fixAAt(f);
export const fixBOf = (f: number) => fixBAt(f);

/** Fix A's folder before the turn presses it. */
const UNPRESSED: Press = { k: 0, scaleZ: 1, tilt: 0, sink: 0 };

/** Act one's footprints at a frame: the world's, the title card's, Fix A's and Fix B's in beat 3 (at most MAX_FOOTPRINTS: actOne.test.ts). */
export function actOneFrameFootprints(f: number) {
  const a = actOneAt(f);
  const fp = actOneFootprints(a);
  const cs = cardAt(TITLE_CARD, f);
  const card = cardFootprint(TITLE_CARD, cs);
  if (card) fp.push(card);
  const contact = cardContactFootprint(TITLE_CARD, cs);
  if (contact) fp.push(contact);
  if (f >= FIX_A.in) fp.push(...fixAFootprints(fixAOf(f)));
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
  const footprints = useMemo(() => actOneFrameFootprints(wf), [wf]);
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
                <CardWorld spec={TITLE_CARD} f={wf} printFamily={print.family} />
                {fa && (
                  // Fix A steps down on its own ramp (STEP_LATE: actOne.ts actOneStepA) while the focus is on Fix B (3.2)
                  <Step on='late'>
                    <FixA fixA={fa} pressA={UNPRESSED} />
                  </Step>
                )}
                {fb && <FixB fixB={fb.b} f={wf} tear={fb.tear} followUp={fb.followUp} posts={fb.posts} riffle={fb.riffle} />}
              </>
            )}
          </DeskWorld>
        </Stage3D>
      )}
      <Overlay f={f} pose={pose} fonts={fonts} ready={all} labels={labels} />
      {all && <CardText spec={TITLE_CARD} f={wf} family={fonts.sans} pose={pose} />}
      <CreditLine f={f} fonts={fonts} ready={all} />
    </AbsoluteFill>
  );
}
