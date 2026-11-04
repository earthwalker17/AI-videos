/**
 * The V2 film's picture: one continuous storybook world. The closed book on the desk (the
 * lightning on the window, the bats squeezing out of the fore-edge), the cover bursting open and
 * the world growing out of the page on the score's six pops, the camera's one journey into the
 * story and through it (film/journey.ts), every beat a pure function of the frame (film/beats.ts),
 * the actors on their V2 blocking (film/blocking.ts), the cover closing across the lens and the
 * slam back on the desk; the words as DOM over it (overlay/OverlayV2.tsx).
 *
 * A constant scene: everything is built once and stays mounted (lights never mount or unmount);
 * what is not in a shot is hidden or simply out of frame.
 */
import { Stage3D } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { PerspectiveCamera } from 'three';
import { at, FPS } from '../cues.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { GrowClock, Grows } from '../look/Grows.tsx';
import { NIGHT } from '../look/materials.ts';
import { Night } from '../look/Night.tsx';
import { NightPost } from '../look/NightPost.tsx';
import { SkyDome } from '../look/SkyPortal.tsx';
import { LOOK_POST } from '../lookdev/LookStage.tsx';
import { WorldBats, WorldScene } from '../lookdev/World.tsx';
import { OverlayV2 } from '../overlay/OverlayV2.tsx';
import { BatBurst } from '../world/Bats.tsx';
import { Book2, BOOK_EDGE } from '../world/Book2.tsx';
import { Clawd2, clawdSmooth, pail2World } from '../world/Clawd2.tsx';
import { Desk2 } from '../world/Desk2.tsx';
import { Grass } from '../world/Grass.tsx';
import { fromHouse } from '../world/layout.ts';
import { Letter2 } from '../world/Letter2.tsx';
import { Neighbour } from '../world/Neighbour.tsx';
import { Terrain } from '../world/Terrain.tsx';
import {
  bigPumpkinLitAt,
  BURST,
  coverAt,
  doorOpenAt,
  farColdAt,
  footAt,
  gatesOpenAt,
  GROW,
  grownAt,
  immersionAt,
  letterAt,
  pailLitAt,
  pumpkinsLitAt,
  windowsAt,
} from './beats.ts';
import { clawdAt, userAt } from './blocking.ts';
import type { CamPose } from './campath.ts';
import { journeyAt } from './journey.ts';

export const NIGHT_BG = '#0a1118';

/** The moon's shadow box per shot (Night's `shadow`): the desk round the book, the valley, the door yard. */
const DESK_SHADOW = { x: 0, z: 0, hw: 15, hd: 8 };
const WIDE_SHADOW = { x: 0, z: 0, hw: 8.5, hd: 6 };
const DOOR_AT = fromHouse([0.3, 0, 0.6]);
const DOOR_SHADOW = { x: DOOR_AT[0], z: DOOR_AT[2], hw: 3.4, hd: 3.4 };
/**
 * The box changes only where the change cannot be seen: to the valley once the camera is inside
 * the story (the dome hides the desk), to the door yard as the camera arrives at the door
 * two-shot, back to the valley as Clawd trots off, to the desk behind the closing cover.
 */
function shadowAt(f: number, immersion: number) {
  if (immersion < 0.999) return DESK_SHADOW;
  if (f >= at(17) && f < at(33, 2)) return DOOR_SHADOW;
  return WIDE_SHADOW;
}

function Rig({ pose }: { pose: CamPose }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...pose.pos);
    camera.fov = pose.fov;
    camera.near = 0.05;
    camera.far = 120;
    camera.updateProjectionMatrix();
    camera.lookAt(...pose.look);
    camera.updateMatrixWorld();
  }, [camera, pose]);
  return null;
}

/** The storybook fog: none on the desk, faded in with the immersion as the camera enters the story. */
function FogAmount({ amount }: { amount: number }) {
  useLayoutEffect(() => {
    NIGHT.uSbFogOn.value = amount;
  }, [amount]);
  return null;
}

/** where the neighbour's sweet drops: Clawd's pail's opening as he holds it up (the grace beat, bar 30 beat 2 .. bar 31) */
const CANDY_PAIL = (() => {
  const c = clawdAt(at(31));
  return pail2World(c.pose, c.hop);
})();

/** the world is on stage from the cover's burst to the slam (under the closed cover otherwise; the cover is still half open at the hidden cut) */
const WORLD_ON = [at(4), at(35) + 1] as const;

function Picture({ f, pose }: { f: number; pose: CamPose }) {
  const imm = immersionAt(f);
  const grown = grownAt(f);
  const world = f >= WORLD_ON[0] && f < WORLD_ON[1];
  const clawd = clawdAt(f);
  const letter = letterAt(f);
  return (
    <>
      <Night f={f} fps={FPS} shadow={shadowAt(f, imm)} />
      <FogAmount amount={imm} />
      <GrowClock f={f} schedule={GROW} />
      <SkyDome immersion={imm} />
      <Desk2 f={f} props={imm < 0.999} beam={1 - imm} />
      <Book2 cover={coverAt(f)} f={f} immersion={imm} />
      <group visible={world}>
        <Grows page>
          <Terrain />
        </Grows>
        <Grows fade={grown}>
          <Grass />
          <WorldScene f={f} camPos={pose.pos} fov={pose.fov} gates={gatesOpenAt(f)} door={doorOpenAt(f)} windows={windowsAt(f)} bigLit={bigPumpkinLitAt(f)} lit={pumpkinsLitAt(f)} farCold={farColdAt(f)} bats={false} />
        </Grows>
        <WorldBats f={f} camPos={pose.pos} fov={pose.fov} />
        <Clawd2 pose={{ ...clawd.pose, pailLit: pailLitAt(f) }} hop={clawd.hop} f={f} smooth={clawdSmooth(clawdAt, f)} camPos={pose.pos} />
        <Neighbour pose={userAt(f)} f={f} pail={CANDY_PAIL} />
        <Letter2 rise={letter.rise} flip={letter.flip} sealed={letter.sealed} crack={letter.crack} f={f} />
      </group>
      <group visible={f >= BURST.start - 2 && f < at(5)}>
        <BatBurst f={f} start={BURST.start} origin={BOOK_EDGE.origin} dir={BOOK_EDGE.dir} count={BURST.count} size={BURST.size} gap={BOOK_EDGE.gap} speed={BURST.speed} scatter={BURST.scatter} rise={BURST.rise} stagger={BURST.stagger} ambient={0.25} tone={0.6} />
      </group>
    </>
  );
}

export function FilmV2() {
  const f = useCurrentFrame();
  // the stage mounts only once every face is in: R3F draws when the frame changes, not when
  // `ready` does, so a text canvas drawn before would be the one in the frame (look/fonts.ts)
  const { fonts, ready } = useFilmFonts();
  const pose = journeyAt(f);
  return (
    <AbsoluteFill style={{ background: NIGHT_BG }}>
      {ready && (
        <Stage3D antialias={false} camera={{ fov: 30, near: 0.05, far: 120, position: [9, 7, 12] }}>
          <color attach="background" args={[NIGHT_BG]} />
          <Rig pose={pose} />
          <Picture f={f} pose={pose} />
          <NightPost f={f} focus={pose.focus} {...LOOK_POST} foot={footAt(f)} />
        </Stage3D>
      )}
      <OverlayV2 f={f} fonts={fonts} />
    </AbsoluteFill>
  );
}
