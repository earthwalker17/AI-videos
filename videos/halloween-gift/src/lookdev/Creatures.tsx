/**
 * Lookdev of the creatures (world/Ghosts.tsx: the three hanging ghosts; world/Bats.tsx: the flocks
 * and the burst; kit/bat.ts: the bat; overlay/BatSvg.tsx: the overlay's bat) in the full world as
 * built (lookdev/World.tsx WorldScene, which now carries the ghosts and the flocks),
 * through the film's stage (LookStage: sky, terrain, grass, the night rig, the post).
 *
 *  CreaturesHero      the hero view: the ghosts on world/Trees.tsx GHOST_HOOKS (two toward the
 *                     moon), the far flocks by the castle and under the moon (flecks), the near
 *                     flock crossing (frames run on: --span)
 *  CreaturesGhosts    held close views: 0 under the ghosts against the moon (the reference's crop),
 *                     1 the peek ghost's face, 2 the hems from below, 3 the rope's wrap on the limb
 *  CreaturesBats      held close views of a row of bats at six phases of the flap: 0 from in front
 *                     and below, 1 from above and behind, 2 from the side; 3 the far flock and 4 the
 *                     near flock through a long lens from the hero eye
 *  CreaturesFlap      one bat on ones through a flap cycle and a half, close (--span 0-11)
 *  CreaturesPeek      the film's own camera at the shoo (journeyAt(at(11, 2))), the peek ghost let
 *                     down (lower [0, 0, 1]), Clawd's stand-in on his blocking
 *  CreaturesPeekAlt   the proposed shoo camera (SHOO_PROPOSED): 0 lower 1, 1 lower 0.5 (on its
 *                     way down), 2 lower 1 on the proposed hooks
 *  CreaturesBurst     bats squeezing out of a stand-in closed book's fore-edge, from the film's
 *                     desk camera (a frame every 2 from the start)
 *  CreaturesSvg       the overlay's SVG bat at six phases over the email card, for scale
 */
import { useLayoutEffect, useMemo } from 'react';
import { AbsoluteFill, Composition, useCurrentFrame } from 'remotion';
import { BoxGeometry, ConeGeometry } from 'three';
import { at, FPS } from '../cues.ts';
import { clawdAt } from '../film/blocking.ts';
import { CamPath, type CamPose } from '../film/campath.ts';
import { journeyAt } from '../film/journey.ts';
import type { V3 } from '../kit/bat.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { storybookMaterial } from '../look/materials.ts';
import { BatSvg } from '../overlay/BatSvg.tsx';
import { EMAIL, EmailCard } from '../overlay/EmailCard.tsx';
import { BatBurst, BatSwarm, type BatState } from '../world/Bats.tsx';
import { BOOK, FLOOR, HERO } from '../world/layout.ts';
import { GHOST_HOOKS } from '../world/Trees.tsx';
import { HERO_PATH, LookStage } from './LookStage.tsx';
import { WorldScene } from './World.tsx';

const F = FLOOR;
/** the film time the hero view's world runs on (the hero view holds over bars 5–8) */
const HERO_T = at(6);

/** Every creature over the world, at film frame t, seen from `cam` (the flecks face it). */
function Creatures({ t, cam, lower = [0, 0, 0] }: { t: number; cam: CamPose; lower?: readonly number[] }) {
  return <WorldScene f={t} camPos={cam.pos} fov={cam.fov} peek={lower[2]} nearBats={HERO_T - 72} />;
}

const HERO_POSE: CamPose = { pos: HERO.pos, look: HERO.look, fov: HERO.fov, focus: HERO.focus };

function CreaturesHero() {
  return <LookStage path={HERO_PATH}>{(f) => <Creatures t={HERO_T + f} cam={HERO_POSE} />}</LookStage>;
}

// ---- the ghosts close -------------------------------------------------------------------------------

const [H0, H1, H2] = GHOST_HOOKS;
const mid: V3 = [(H0[0] + H2[0]) / 2, (H0[1] + H2[1]) / 2 - 0.7, (H0[2] + H2[2]) / 2];
export const GHOSTS_CLOSE = new CamPath([
  // 0: from the path under the limb, looking up at the three against the moon
  { f: 0, pos: [0.95, F + 0.95, 4.05], look: mid, fov: 42, focus: 3.0, hold: true },
  // 1: the peek ghost's face, at eye height
  { f: 1, pos: [H2[0] - 0.3, H2[1] - 0.4, H2[2] + 1.05], look: [H2[0], H2[1] - 0.5, H2[2]], fov: 34, focus: 1.1, hold: true },
  // 2: the hems from below
  { f: 2, pos: [H1[0] - 0.55, F + 1.0, H1[2] + 1.25], look: [H1[0], H1[1] - 1.3, H1[2]], fov: 40, focus: 1.6, hold: true },
  // 3: the rope's wrap on the limb and the knot at the tie
  { f: 3, pos: [H0[0] - 0.25, H0[1] - 0.42, H0[2] + 1.2], look: [H0[0], H0[1] - 0.1, H0[2]], fov: 34, focus: 1.3, hold: true },
]);

function CreaturesGhosts() {
  return <LookStage path={GHOSTS_CLOSE}>{(f) => <Creatures t={HERO_T} cam={GHOSTS_CLOSE.at(f)} />}</LookStage>;
}

// ---- the bats close ---------------------------------------------------------------------------------

/** a row of six bats in the sky in front of the camera, at six phases of the flap */
const ROW: V3 = [0.2, F + 3.4, 3.6];
const SPAN = 0.3;
function rowStates(view: number, t: number): BatState[] {
  const fwd: V3 = view === 0 ? [0, -0.05, 1] : view === 1 ? [0, 0, -1] : [1, 0, 0];
  return Array.from({ length: 6 }, (_, i) => ({
    pos: view === 2 ? [ROW[0] + (i - 2.5) * 0.36, ROW[1], ROW[2]] : [ROW[0] + (i - 2.5) * 0.38, ROW[1], ROW[2]],
    fwd,
    bank: 0,
    scale: SPAN,
    phase: i / 6 + t,
    folded: 0,
    visible: true,
  }));
}
const ROW_LOOK: V3 = [ROW[0], ROW[1], ROW[2]];
/** the middle of the far flock's loop */
const CRAG_MID: V3 = [1.3, F + 3.85, -4.05];
export const BATS_CLOSE = new CamPath([
  { f: 0, pos: [ROW[0], ROW[1] - 0.95, ROW[2] + 1.5], look: ROW_LOOK, fov: 44, focus: 1.8, hold: true },
  { f: 1, pos: [ROW[0], ROW[1] + 0.9, ROW[2] + 1.6], look: ROW_LOOK, fov: 44, focus: 1.85, hold: true },
  { f: 2, pos: [ROW[0] - 0.1, ROW[1] + 0.12, ROW[2] + 1.8], look: ROW_LOOK, fov: 44, focus: 1.8, hold: true },
  // the far flock (CRAG_FLIGHT) and the near flock through a long lens from the hero eye
  { f: 3, pos: HERO.pos, look: CRAG_MID, fov: 13, focus: 12.5, hold: true },
  { f: 4, pos: HERO.pos, look: [0.8, F + 3.45, 1.0], fov: 18, focus: 7.0, hold: true },
]);

function CreaturesBats() {
  const frame = useCurrentFrame();
  const states = useMemo(() => rowStates(Math.min(frame, 2), 0), [frame]);
  return (
    <LookStage path={BATS_CLOSE}>
      {(f) => (
        <>
          <Creatures t={HERO_T} cam={BATS_CLOSE.at(f)} />
          {f <= 2 && <BatSwarm states={states} size={SPAN} />}
        </>
      )}
    </LookStage>
  );
}

/** one bat close, from in front and below, and one from the side: the cycle on ones */
const FLAP_AT: V3 = [0.2, F + 3.4, 3.6];
const FLAP_VIEW = new CamPath([
  { f: 0, pos: [FLAP_AT[0], FLAP_AT[1] - 0.18, FLAP_AT[2] + 1.0], look: FLAP_AT, fov: 40, focus: 1.0, hold: true },
  { f: 1000, pos: [FLAP_AT[0], FLAP_AT[1] - 0.18, FLAP_AT[2] + 1.0], look: FLAP_AT, fov: 40, focus: 1.0, hold: true },
]);
function CreaturesFlap() {
  const frame = useCurrentFrame();
  const states = useMemo<BatState[]>(
    () => [
      { pos: [FLAP_AT[0] - 0.2, FLAP_AT[1], FLAP_AT[2]], fwd: [0, -0.05, 1], bank: 0, scale: 0.3, phase: (frame / FPS) * 3.4, folded: 0, visible: true },
      { pos: [FLAP_AT[0] + 0.24, FLAP_AT[1] + 0.02, FLAP_AT[2] - 0.05], fwd: [1, 0, 0.15], bank: 0, scale: 0.3, phase: (frame / FPS) * 3.4 + 0.5, folded: 0, visible: true },
    ],
    [frame],
  );
  return (
    <LookStage path={FLAP_VIEW}>
      {(f) => (
        <>
          <Creatures t={HERO_T + f} cam={FLAP_VIEW.at(f)} />
          <BatSwarm states={states} size={0.3} />
        </>
      )}
    </LookStage>
  );
}

// ---- the peek ---------------------------------------------------------------------------------------

const PEEK_F = at(11, 2);
const PEEK = { at: (): CamPose => journeyAt(PEEK_F) };

/** Clawd's stand-in: his body (13 × 8 cells of 0.025) and the witch hat's height (0.4), on his blocking. */
function ClawdMarker({ f }: { f: number }) {
  const geo = useMemo(() => ({ body: new BoxGeometry(0.325, 0.2, 0.15).translate(0, 0.125, 0), hat: new ConeGeometry(0.06, 0.16, 12).translate(0, 0.31, 0) }), []);
  const mat = useMemo(() => storybookMaterial({ color: '#D77757', breakup: 0.05, rim: 0.8 }), []);
  const hat = useMemo(() => storybookMaterial({ color: '#2B1830', breakup: 0.05, rim: 0.8 }), []);
  useLayoutEffect(() => () => (geo.body.dispose(), geo.hat.dispose(), mat.dispose(), hat.dispose()), [geo, mat, hat]);
  const { pose } = clawdAt(f);
  if (!pose.visible) return null;
  return (
    <group position={pose.pos} rotation-y={pose.heading}>
      <mesh geometry={geo.body} material={mat} castShadow />
      <mesh geometry={geo.hat} material={hat} castShadow />
    </group>
  );
}

function CreaturesPeek() {
  return (
    <LookStage path={PEEK}>
      {() => (
        <>
          <Creatures t={PEEK_F} cam={PEEK.at()} lower={[0, 0, 1]} />
          <ClawdMarker f={PEEK_F} />
        </>
      )}
    </LookStage>
  );
}

/**
 * The proposed shoo camera (for film/journey.ts's shoo key, a hold): 2.45 from Clawd at the stop
 * toward the front right (41° from +x), 0.66 above him, looking up between him and the lowered
 * ghost at FLOOR + 0.92, fov 54. Clear of the ghost tree, the root stump and the stones by their
 * margins (the soft push moves it < 2 cm); the lowered ghost's eyes land near 0.15 H, his feet near 0.88 H.
 */
export const SHOO_PROPOSED: CamPose = (() => {
  const c = clawdAt(PEEK_F).pose.pos;
  const a = (41 * Math.PI) / 180;
  const pos: [number, number, number] = [c[0] + Math.cos(a) * 2.45, c[1] + 0.66, c[2] + Math.sin(a) * 2.45];
  const look: [number, number, number] = [1.37, F + 0.92, 1.61];
  return { pos, look, fov: 54, focus: Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) };
})();
const PEEK_ALT = new CamPath([
  { f: 0, ...SHOO_PROPOSED, hold: true },
  { f: 1000, ...SHOO_PROPOSED, hold: true },
]);
function CreaturesPeekAlt() {
  const frame = useCurrentFrame();
  const lower = frame === 1 ? 0.5 : 1;
  return (
    <LookStage path={PEEK_ALT}>
      {() => (
        <>
          <Creatures t={PEEK_F} cam={SHOO_PROPOSED} lower={[0, 0, lower]} />
          <ClawdMarker f={PEEK_F} />
        </>
      )}
    </LookStage>
  );
}

// ---- the burst --------------------------------------------------------------------------------------

/**
 * A stand-in for the closed V2 book on the desk (16 × 1.5 × 11, the spine at the back): plum cloth
 * boards top and bottom, the cream page block between them, its fore-edge toward the camera.
 */
const BURST_START = at(3);
const BURST_CAM = { at: (f: number): CamPose => journeyAt(BURST_START - 4 + f * 2) };
function BookStandIn() {
  const geo = useMemo(() => {
    const board = 0.12;
    return {
      pages: new BoxGeometry(BOOK.w - 0.3, BOOK.t - 2 * board, BOOK.d - 0.25).translate(-0.1, BOOK.t / 2, -0.05),
      top: new BoxGeometry(BOOK.w, board, BOOK.d).translate(0, BOOK.t - board / 2, 0),
      bottom: new BoxGeometry(BOOK.w, board, BOOK.d).translate(0, board / 2, 0),
      spine: new BoxGeometry(BOOK.w, BOOK.t, 0.2).translate(0, BOOK.t / 2, -BOOK.d / 2 + 0.1),
    };
  }, []);
  const mats = useMemo(() => ({ cloth: storybookMaterial({ kind: 'cloth', color: '#3a2438', color2: '#2a1a2a', breakup: 0.2, scale: 0.3, rim: 0.6 }), paper: storybookMaterial({ kind: 'plain', color: '#d8ccb0', color2: '#b8a888', breakup: 0.15, scale: 0.08, rim: 0.3 }) }), []);
  useLayoutEffect(
    () => () => {
      for (const g of Object.values(geo)) g.dispose();
      mats.cloth.dispose();
      mats.paper.dispose();
    },
    [geo, mats],
  );
  return (
    <>
      <mesh geometry={geo.pages} material={mats.paper} receiveShadow castShadow />
      <mesh geometry={geo.top} material={mats.cloth} receiveShadow castShadow />
      <mesh geometry={geo.bottom} material={mats.cloth} receiveShadow />
      <mesh geometry={geo.spine} material={mats.cloth} receiveShadow />
    </>
  );
}
function CreaturesBurst() {
  return (
    <LookStage path={BURST_CAM} bare>
      {(f) => (
        <>
          <BookStandIn />
          <BatBurst f={BURST_START - 4 + f * 2} start={BURST_START} origin={[0.6, BOOK.t * 0.5, BOOK.d / 2 + 0.05]} dir={[0.25, 0.55, 0.8]} count={12} size={1.0} gap={4.5} speed={5} />
        </>
      )}
    </LookStage>
  );
}

// ---- the overlay's bat ------------------------------------------------------------------------------

const CARD_H = 700;
const CARD_W = Math.round(CARD_H * EMAIL.aspect);
const CARD_AT = { left: Math.round((1920 - CARD_W) / 2), top: Math.round((1080 - CARD_H) / 2 + 30) };
function CreaturesSvg() {
  const { fonts } = useFilmFonts();
  const size = CARD_H * 0.42;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 40%, #1d3a4a 0%, #0b141c 70%)' }}>
      <div style={{ position: 'absolute', ...CARD_AT }}>
        <EmailCard width={CARD_W} height={CARD_H} fonts={fonts} seal={{ scale: 1, shake: 0 }} style={{ boxShadow: 'none' }} />
      </div>
      {Array.from({ length: 6 }, (_, i) => (
        <BatSvg key={i} phase={i / 6} size={size} style={{ position: 'absolute', left: 60 + (i % 3) * 620, top: i < 3 ? 40 : 640, transform: 'translate(0, 0)' }} />
      ))}
      {/* one at the Appeal tab's place, at the snatch */}
      <BatSvg phase={0.15} size={size * 0.8} style={{ position: 'absolute', left: CARD_AT.left + CARD_W * 0.62, top: CARD_AT.top + CARD_H * 0.52 }} />
    </AbsoluteFill>
  );
}

export function CreaturesRoot() {
  return (
    <>
      <Composition id="CreaturesHero" component={CreaturesHero} width={1920} height={1080} fps={FPS} durationInFrames={48} />
      <Composition id="CreaturesGhosts" component={CreaturesGhosts} width={1920} height={1080} fps={FPS} durationInFrames={4} />
      <Composition id="CreaturesBats" component={CreaturesBats} width={1920} height={1080} fps={FPS} durationInFrames={5} />
      <Composition id="CreaturesFlap" component={CreaturesFlap} width={1920} height={1080} fps={FPS} durationInFrames={24} />
      <Composition id="CreaturesPeek" component={CreaturesPeek} width={1920} height={1080} fps={FPS} durationInFrames={1} />
      <Composition id="CreaturesPeekAlt" component={CreaturesPeekAlt} width={1920} height={1080} fps={FPS} durationInFrames={3} />
      <Composition id="CreaturesBurst" component={CreaturesBurst} width={1920} height={1080} fps={FPS} durationInFrames={14} />
      <Composition id="CreaturesSvg" component={CreaturesSvg} width={1920} height={1080} fps={FPS} durationInFrames={1} />
    </>
  );
}
