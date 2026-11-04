/**
 * Lookdev of the characters family (world/Clawd2.tsx: Clawd V2; world/Neighbour.tsx: the
 * neighbour in the bedsheet; world/Letter2.tsx: the gift letter) in the whole world as built
 * (lookdev/World.tsx WorldScene) through the film's stage (CharStage: LookStage's sky, terrain,
 * grass, night rig and post chain, with the film's moon shadow box per shot, the door yard's for
 * the door spread, and the post's foot band at each view's film frame). Every pose comes from
 * film/blocking.ts (the V2 blocking, on ones) and every world beat from film/beats.ts, at the film
 * frame each view names.
 *
 *  CharactersHero      the hero view with Clawd at his pop-up spot beside the giant pumpkin (bar 8,
 *                      just before he sets off): 0 the hero eye, 1 a long lens on him from the hero
 *                      eye (the same light: the hue measurement)
 *  CharactersClawd     Clawd held close: 0 three-quarter front at the pop-up spot, 1 side, 2 from
 *                      behind against the moon (the rim), 3 a hop's top (stretched, legs tucked), 4 a
 *                      landing's squash, 5 wink and hat tip, 6 the ta-da (arms up, the envelope), 7 a
 *                      knock (wand forward), 8 half risen from flat, 9 at the door yard's wait spot
 *  CharactersDoor      the film's door two-shot (V1's arrival key: fromV1Door([1.2, 1.75, 3.0]) at
 *                      fromV1Door([0, 2.4, -1.3]), fov 36), foot band 0.3: 0 the ta-da (bar 22.2, the
 *                      letter shown risen), 1 the letter up and cracked (23.3), 2 the slats turning
 *                      (25.2 + 7), 3 sealed and ghosted (26 + 12), 4 the bowl tipped, sagging (30.2),
 *                      5 the sweet in the air on its way to the pail (30.2 + 13)
 *  CharactersDoorFilm  the same five frames through the film's own camera (journeyAt)
 *  CharactersLetter    the letter: 0 risen and cracked through the film's camera (23.3); 1-3 a close
 *                      front view, the seal intact, cracking, cracked; 4-6 the slats turning (flip
 *                      0.25, 0.5, 0.75) through the film's push; 7 face B, 8 face B sealed; 9 the slats
 *                      mid-turn from the side
 *  CharactersNeighbour the neighbour held close: 0 front, 1 three-quarter from Clawd's side, 2 side,
 *                      3 ghosted, 4 sagging with the bowl tipped, 5 the hop, 6 the eyeholes (long lens),
 *                      7 the bowl (long lens), 8 full length (the slippers, the hem), 9 the sweet's
 *                      drop into Clawd's pail (30.2 + 12, Clawd in shot)
 */
import { Stage3D } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, type ReactNode } from 'react';
import { AbsoluteFill, Composition, useCurrentFrame } from 'remotion';
import type { PerspectiveCamera } from 'three';
import { at, FPS } from '../cues.ts';
import type { ClawdPose, UserPose } from '../film/actors.ts';
import { bigPumpkinLitAt, doorOpenAt, farColdAt, footAt, letterAt, pailLitAt, pumpkinsLitAt, windowsAt, type LetterBeat } from '../film/beats.ts';
import { clawdAt, userAt, WAIT_SPOT } from '../film/blocking.ts';
import { CamPath, type CamKey, type CamPose } from '../film/campath.ts';
import type { HopState } from '../film/gait.ts';
import { journeyAt } from '../film/journey.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { Night } from '../look/Night.tsx';
import { NightPost } from '../look/NightPost.tsx';
import { SkyDome } from '../look/SkyPortal.tsx';
import { Clawd2, clawdSmooth, pail2World } from '../world/Clawd2.tsx';
import { Grass } from '../world/Grass.tsx';
import { fromV1Door, HERO, onGround } from '../world/layout.ts';
import { Letter2, LETTER2, LETTER2_AT, LETTER2_YAW } from '../world/Letter2.tsx';
import { Neighbour } from '../world/Neighbour.tsx';
import { Terrain } from '../world/Terrain.tsx';
import { DOOR_SHADOW } from './Buildings.tsx';
import { LOOK_POST } from './LookStage.tsx';
import { WorldScene } from './World.tsx';

type V3 = [number, number, number];
const hold = (f: number, k: Omit<CamKey, 'f' | 'hold'>): CamKey => ({ f, ...k, hold: true });
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const view = (f: number, pos: V3, look: V3, fov: number, focus?: number): CamKey => hold(f, { pos, look, fov, focus: focus ?? dist(pos, look) });
/** A held path: one view per composition frame. */
const views = (vs: [V3, V3, number, number?][]) => new CamPath([...vs.map(([p, l, fov, fo], i) => view(i, p, l, fov, fo)), view(vs.length + 50, vs[vs.length - 1][0], vs[vs.length - 1][1], vs[vs.length - 1][2], vs[vs.length - 1][3])]);
const fromPose = (p: CamPose): [V3, V3, number, number] => [[...p.pos], [...p.look], p.fov, p.focus];

// ---- the stage: LookStage's, with the film's moon shadow box and foot band per frame ----------------

type ShadowBox = { x: number; z: number; hw: number; hd: number };
/** the film's boxes (film/FilmV2.tsx): the valley, and the door yard for the door spread */
const WIDE_SHADOW: ShadowBox = { x: 0, z: 0, hw: 8.5, hd: 6 };

function CameraRig({ path, f }: { path: { at(f: number): CamPose }; f: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    const p = path.at(f);
    camera.position.set(...p.pos);
    camera.fov = p.fov;
    camera.near = 0.05;
    camera.far = 80;
    camera.updateProjectionMatrix();
    camera.lookAt(...p.look);
    camera.updateMatrixWorld();
  }, [camera, path, f]);
  return null;
}

/**
 * LookStage (lookdev/LookStage.tsx) as the film has it per shot: the moon's shadow box (the door
 * yard's for the door spread: the bowl's shadow on the sheet, Clawd's on the yard) and the post's
 * foot band at the film frame each view shows (film/beats.ts footAt; Clawd undoes its tint).
 */
function CharStage({ path, film, children }: { path: { at(f: number): CamPose }; film: (f: number) => { film: number; door: boolean }; children: (f: number) => ReactNode }) {
  const f = useCurrentFrame();
  // mount the stage only once the fonts are in: its text canvases are drawn once, at mount (look/fonts.ts)
  const { ready } = useFilmFonts();
  const shot = film(f);
  return (
    <AbsoluteFill style={{ background: '#0a1118' }}>
      {ready && (
        <Stage3D antialias={false} camera={{ fov: 44, near: 0.05, far: 80, position: [0, 3, 8] }}>
          <color attach="background" args={['#0a1118']} />
          <CameraRig path={path} f={f} />
          <Night f={f} fps={FPS} shadow={shot.door ? DOOR_SHADOW : WIDE_SHADOW} />
          <SkyDome />
          <Terrain />
          <Grass />
          {children(f)}
          <NightPost f={f} focus={path.at(f).focus} {...LOOK_POST} foot={footAt(shot.film)} />
        </Stage3D>
      )}
    </AbsoluteFill>
  );
}

/** where the neighbour's sweet lands: Clawd's pail at the landing (bar 31) */
const PAIL_AT_DROP = (() => {
  const s = clawdAt(at(31));
  return pail2World({ ...s.pose }, s.hop);
})();

/** The world at a film frame of the door spread (its beats at that frame). */
function DoorWorld({ film, cam, fov }: { film: number; cam: readonly number[]; fov: number }) {
  return <WorldScene f={film} camPos={cam} fov={fov} gates={1} door={doorOpenAt(film)} windows={windowsAt(film)} bigLit={bigPumpkinLitAt(film)} lit={pumpkinsLitAt(film)} farCold={farColdAt(film)} />;
}

/** The door spread's actors at a film frame (the letter's beat may be overridden). */
function DoorActors({ film, cam, letter, blink = true }: { film: number; cam: readonly number[]; letter?: Partial<LetterBeat>; blink?: boolean }) {
  const s = clawdAt(film);
  const l = { ...letterAt(film), ...letter };
  return (
    <>
      <Clawd2 pose={{ ...s.pose, pailLit: pailLitAt(film) }} hop={s.hop} f={film} smooth={clawdSmooth(clawdAt, film)} blink={blink} camPos={cam} />
      <Neighbour pose={userAt(film)} f={film} pail={PAIL_AT_DROP} />
      <Letter2 rise={l.rise} flip={l.flip} sealed={l.sealed} crack={l.crack} f={film} />
    </>
  );
}

// ---- the hero view --------------------------------------------------------------------------

/** bar 8: popped up beside the giant, just before he sets off */
const HERO_FILM = at(8);
const heroState = clawdAt(HERO_FILM);
const HERO_CLAWD = heroState.pose.pos;
const HERO_VIEWS = views([
  [HERO.pos, HERO.look, HERO.fov, HERO.focus],
  [HERO.pos, [HERO_CLAWD[0], HERO_CLAWD[1] + 0.16, HERO_CLAWD[2]], 5],
]);

function CharactersHero() {
  return (
    <CharStage path={HERO_VIEWS} film={() => ({ film: HERO_FILM, door: false })}>
      {() => (
        <>
          <WorldScene f={HERO_FILM} camPos={HERO.pos} fov={HERO.fov} />
          <Clawd2 pose={{ ...heroState.pose, pailLit: pailLitAt(HERO_FILM) }} hop={heroState.hop} f={HERO_FILM} smooth={clawdSmooth(clawdAt, HERO_FILM)} blink={false} camPos={HERO.pos} />
        </>
      )}
    </CharStage>
  );
}

// ---- Clawd close ------------------------------------------------------------------------------

const POP = onGround(HERO_CLAWD[0], HERO_CLAWD[2]);
const WAIT = onGround(WAIT_SPOT[0], WAIT_SPOT[2]);
const base: ClawdPose = { ...heroState.pose, pos: POP, heading: 0.35, eyes: 'open', arms: 'down', wand: 0, envelope: 0, hatTip: 0, rise: 1, pailLit: 1, walk: null, hop: 0, visible: true };
const hopTop: HopState = { s: 0, lift: 0.07, sy: 1.06, sxz: 1 / Math.sqrt(1.06), tuck: 1, moving: true };
const squash: HopState = { s: 0, lift: 0, sy: 0.85, sxz: 1 / Math.sqrt(0.85), tuck: 0, moving: true };
const CLOSE: { pose: ClawdPose; hop: HopState | null; at: V3 }[] = [
  { pose: base, hop: null, at: POP },
  { pose: { ...base, heading: Math.PI / 2 + 0.25 }, hop: null, at: POP },
  { pose: { ...base, heading: Math.PI - 0.5 }, hop: null, at: POP },
  { pose: { ...base, pos: onGround(POP[0], POP[2], hopTop.lift) }, hop: hopTop, at: POP },
  { pose: base, hop: squash, at: POP },
  { pose: { ...base, eyes: 'wink', hatTip: 1 }, hop: null, at: POP },
  { pose: { ...base, arms: 'up', envelope: 1 }, hop: null, at: POP },
  { pose: { ...base, heading: 0.9, wand: 1 }, hop: null, at: POP },
  { pose: { ...base, rise: 0.5 }, hop: null, at: POP },
  { pose: { ...base, pos: WAIT, heading: 0.1 }, hop: null, at: WAIT },
];
const closeCam = (c: V3, i: number): [V3, V3, number] => {
  const look: V3 = [c[0], c[1] + 0.15, c[2]];
  if (i === 1) return [[c[0] + 0.85, c[1] + 0.3, c[2] + 0.55], look, 30];
  if (i === 2) return [[c[0] - 0.6, c[1] + 0.3, c[2] + 0.95], look, 30];
  if (i === 6) return [[c[0] + 0.55, c[1] + 0.36, c[2] + 1.25], [c[0], c[1] + 0.26, c[2]], 30];
  if (i === 9) return [[c[0] + 0.3, c[1] + 0.26, c[2] + 1.0], look, 30];
  return [[c[0] + 0.5, c[1] + 0.3, c[2] + 0.95], look, 30];
};
const CLOSE_VIEWS = views(CLOSE.map((c, i) => closeCam(c.at, i)));

const closeFilm = (f: number) => {
  const door = CLOSE[Math.min(f, CLOSE.length - 1)].at === WAIT;
  return { film: door ? at(22, 2) : HERO_FILM, door };
};

function CharactersClawd() {
  return (
    <CharStage path={CLOSE_VIEWS} film={closeFilm}>
      {(f) => {
        const c = CLOSE[Math.min(f, CLOSE.length - 1)];
        const { film, door } = closeFilm(f);
        const cam = CLOSE_VIEWS.at(f).pos;
        return (
          <>
            {door ? <DoorWorld film={film} cam={cam} fov={30} /> : <WorldScene f={film} camPos={cam} fov={30} />}
            <Clawd2 pose={c.pose} hop={c.hop} f={film} blink={false} camPos={cam} />
          </>
        );
      }}
    </CharStage>
  );
}

// ---- the door two-shot ------------------------------------------------------------------------

/** the film's door two-shot (V1's arrival key, carried onto the house) */
const DOOR_CAM = { pos: fromV1Door([1.2, 1.75, 3.0]), look: fromV1Door([0.0, 2.4, -1.3]), fov: 36, focus: 4.1 * 0.5 };
/** the door frames: the ta-da (bar 22.2), the letter up (23.3), the slats flipping, sealed and ghosted, the bowl tipped, the sweet in the air */
export const DOOR_FRAMES = [at(22, 2), at(23, 3), at(25, 2) + 7, at(26) + 12, at(30, 2), at(30, 2) + 13];
/** frame 0 shows the letter risen (it rises on bar 23, after the ta-da) */
const DOOR_LETTER: (Partial<LetterBeat> | undefined)[] = [{ rise: 1, crack: 0, flip: 0 }];
const DOOR_VIEWS = views(DOOR_FRAMES.map(() => [DOOR_CAM.pos, DOOR_CAM.look, DOOR_CAM.fov, DOOR_CAM.focus]));
const DOOR_FILM_VIEWS = views(DOOR_FRAMES.map((film) => fromPose(journeyAt(film))));

const doorFilm = (f: number) => ({ film: DOOR_FRAMES[Math.min(f, DOOR_FRAMES.length - 1)], door: true });

function doorShot(path: CamPath) {
  return function DoorShot() {
    return (
      <CharStage path={path} film={doorFilm}>
        {(f) => {
          const i = Math.min(f, DOOR_FRAMES.length - 1);
          const film = DOOR_FRAMES[i];
          const cam = path.at(f);
          return (
            <>
              <DoorWorld film={film} cam={cam.pos} fov={cam.fov} />
              <DoorActors film={film} cam={cam.pos} letter={DOOR_LETTER[i]} />
            </>
          );
        }}
      </CharStage>
    );
  };
}
const CharactersDoor = doorShot(DOOR_VIEWS);
const CharactersDoorFilm = doorShot(DOOR_FILM_VIEWS);

// ---- the letter -------------------------------------------------------------------------------

const LETTER_C: V3 = [LETTER2_AT[0], LETTER2_AT[1] + LETTER2.base + LETTER2.h / 2, LETTER2_AT[2]];
/** a point in front of the letter (its local x right, z out of it), in the world */
const letterLocal = (x: number, y: number, z: number): V3 => [LETTER2_AT[0] + x * Math.cos(LETTER2_YAW) + z * Math.sin(LETTER2_YAW), LETTER2_AT[1] + y, LETTER2_AT[2] - x * Math.sin(LETTER2_YAW) + z * Math.cos(LETTER2_YAW)];
const CLOSE_LETTER: [V3, V3, number] = [letterLocal(0.12, LETTER2.base + LETTER2.h * 0.5 + 0.06, 1.45), LETTER_C, 32];
const SIDE_LETTER: [V3, V3, number] = [letterLocal(0.95, LETTER2.base + LETTER2.h * 0.6, 0.85), LETTER_C, 30];
const LETTER_SHOTS: { film: number; cam: [V3, V3, number, number?]; letter?: Partial<LetterBeat> }[] = [
  { film: at(23, 3), cam: fromPose(journeyAt(at(23, 3))) },
  { film: at(23, 2), cam: CLOSE_LETTER, letter: { rise: 1, crack: 0, flip: 0 } },
  { film: at(23, 2), cam: CLOSE_LETTER, letter: { rise: 1, crack: 0.5, flip: 0 } },
  { film: at(23, 3), cam: CLOSE_LETTER, letter: { rise: 1, crack: 1, flip: 0 } },
  { film: at(25, 2) + 4, cam: fromPose(journeyAt(at(25, 2) + 4)), letter: { flip: 0.25 } },
  { film: at(25, 2) + 9, cam: fromPose(journeyAt(at(25, 2) + 9)), letter: { flip: 0.5 } },
  { film: at(25, 2) + 13, cam: fromPose(journeyAt(at(25, 2) + 13)), letter: { flip: 0.75 } },
  { film: at(25, 3) + 6, cam: fromPose(journeyAt(at(25, 3) + 6)), letter: { flip: 1, sealed: false } },
  { film: at(26) + 6, cam: fromPose(journeyAt(at(26) + 6)) },
  { film: at(25, 2) + 9, cam: SIDE_LETTER, letter: { flip: 0.5 } },
];
const LETTER_VIEWS = views(LETTER_SHOTS.map((s) => s.cam));

function CharactersLetter() {
  return (
    <CharStage path={LETTER_VIEWS} film={(f) => ({ film: LETTER_SHOTS[Math.min(f, LETTER_SHOTS.length - 1)].film, door: true })}>
      {(f) => {
        const s = LETTER_SHOTS[Math.min(f, LETTER_SHOTS.length - 1)];
        const cam = LETTER_VIEWS.at(f);
        return (
          <>
            <DoorWorld film={s.film} cam={cam.pos} fov={cam.fov} />
            <DoorActors film={s.film} cam={cam.pos} letter={s.letter} />
          </>
        );
      }}
    </CharStage>
  );
}

// ---- the neighbour ------------------------------------------------------------------------------

/** V1 door coordinates (floor 1.2) of the neighbour fully out: x −0.25, z −1.05; eyes at 3.12 */
const V1N = (x: number, y: number, z: number): V3 => fromV1Door([x, y, z]);
const N_LOOK = V1N(-0.25, 2.75, -1.05);
const NEIGHBOUR_SHOTS: { film: number; cam: [V3, V3, number]; pose?: Partial<UserPose> }[] = [
  { film: at(21, 2), cam: [V1N(-0.1, 3.0, 3.4), N_LOOK, 30] },
  { film: at(21, 2), cam: [V1N(2.3, 2.9, 2.5), N_LOOK, 30] },
  { film: at(21, 2), cam: [V1N(3.5, 2.8, -0.7), N_LOOK, 30] },
  { film: at(26) + 12, cam: [V1N(-0.1, 3.0, 3.4), N_LOOK, 30] },
  { film: at(30, 2), cam: [V1N(1.9, 2.8, 2.9), V1N(-0.2, 2.45, -1.0), 30] },
  { film: at(20, 3) + 6, cam: [V1N(0.6, 2.9, 3.4), N_LOOK, 30] },
  { film: at(26) + 12, cam: [V1N(0.1, 3.1, 1.4), V1N(-0.25, 3.08, -0.9), 14] },
  { film: at(21, 2), cam: [V1N(0.2, 3.3, 1.3), V1N(-0.25, 2.35, -0.5), 16] },
  { film: at(21, 2), cam: [V1N(0.5, 2.25, 4.0), V1N(-0.25, 2.25, -1.05), 30] },
  { film: at(30, 2) + 12, cam: [V1N(1.7, 2.45, 3.4), V1N(0.4, 1.9, -0.6), 34] },
];
const NEIGHBOUR_VIEWS = views(NEIGHBOUR_SHOTS.map((s) => s.cam));

function CharactersNeighbour() {
  return (
    <CharStage path={NEIGHBOUR_VIEWS} film={(f) => ({ film: NEIGHBOUR_SHOTS[Math.min(f, NEIGHBOUR_SHOTS.length - 1)].film, door: true })}>
      {(f) => {
        const s = NEIGHBOUR_SHOTS[Math.min(f, NEIGHBOUR_SHOTS.length - 1)];
        const cam = NEIGHBOUR_VIEWS.at(f);
        const c = clawdAt(s.film);
        return (
          <>
            <DoorWorld film={s.film} cam={cam.pos} fov={cam.fov} />
            <Neighbour pose={{ ...userAt(s.film), ...s.pose }} f={s.film} pail={PAIL_AT_DROP} />
            {f === NEIGHBOUR_SHOTS.length - 1 && <Clawd2 pose={{ ...c.pose, pailLit: pailLitAt(s.film) }} hop={c.hop} f={s.film} smooth={clawdSmooth(clawdAt, s.film)} camPos={cam.pos} />}
          </>
        );
      }}
    </CharStage>
  );
}

export function CharactersRoot() {
  return (
    <>
      <Composition id="CharactersHero" component={CharactersHero} width={1920} height={1080} fps={FPS} durationInFrames={2} />
      <Composition id="CharactersClawd" component={CharactersClawd} width={1920} height={1080} fps={FPS} durationInFrames={CLOSE.length} />
      <Composition id="CharactersDoor" component={CharactersDoor} width={1920} height={1080} fps={FPS} durationInFrames={DOOR_FRAMES.length} />
      <Composition id="CharactersDoorFilm" component={CharactersDoorFilm} width={1920} height={1080} fps={FPS} durationInFrames={DOOR_FRAMES.length} />
      <Composition id="CharactersLetter" component={CharactersLetter} width={1920} height={1080} fps={FPS} durationInFrames={LETTER_SHOTS.length} />
      <Composition id="CharactersNeighbour" component={CharactersNeighbour} width={1920} height={1080} fps={FPS} durationInFrames={NEIGHBOUR_SHOTS.length} />
    </>
  );
}
