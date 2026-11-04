/**
 * The whole world as built so far, through the film's own cameras: the integrator's lookdev (the
 * asset families judge their own pieces in Buildings, Graveyard, Trees, Ground, Props, Creatures).
 * The actors (Clawd, the neighbour, the letter) are not part of the world: compositions add them.
 *  - WorldHero: the hero view (the reference's composition), one frame;
 *  - WorldShots: one frame per beat of the journey (journeyAt at the beat's film frame), the door
 *    shots under the door's shadow box.
 */
import { Stage3D } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { AbsoluteFill, Composition, useCurrentFrame } from 'remotion';
import { type PerspectiveCamera } from 'three';
import { at, FPS } from '../cues.ts';
import { ghostLowerAt } from '../film/beats.ts';
import { type CamPose } from '../film/campath.ts';
import { journeyAt } from '../film/journey.ts';
import { Night } from '../look/Night.tsx';
import { NightPost } from '../look/NightPost.tsx';
import { SkyDome } from '../look/SkyPortal.tsx';
import { BatFlock, CRAG_FLIGHT, GRAVEYARD_FLIGHT, MOON_FLIGHT } from '../world/Bats.tsx';
import { Castle } from '../world/Castle.tsx';
import { Dressing } from '../world/Dressing.tsx';
import { Fence, Gates, Lamps } from '../world/Fence.tsx';
import { Graveyard } from '../world/Graveyard.tsx';
import { Grass } from '../world/Grass.tsx';
import { Ghosts } from '../world/Ghosts.tsx';
import { FarHouse, House } from '../world/House.tsx';
import { HERO } from '../world/layout.ts';
import { Cauldron, Coffin, Fireflies } from '../world/Props2.tsx';
import { BigPumpkin, PumpkinPatch } from '../world/Pumpkins.tsx';
import { Terrain } from '../world/Terrain.tsx';
import { Trees } from '../world/Trees.tsx';
import { DOOR_SHADOW } from './Buildings.tsx';
import { LOOK_POST } from './LookStage.tsx';

const WIDE_SHADOW = { x: 0, z: 0, hw: 8.5, hd: 6 };

interface Shot {
  label: string;
  /** the film frame whose journey camera this shot takes (null: the hero view) */
  film: number | null;
  gates: number;
  door: number;
  windows: number;
  shadow: { x: number; z: number; hw: number; hd: number };
}
export const SHOTS: Shot[] = [
  { label: 'hero', film: null, gates: 0, door: 0, windows: 1, shadow: WIDE_SHADOW },
  { label: 'truck', film: at(9, 2), gates: 0, door: 0, windows: 1, shadow: WIDE_SHADOW },
  { label: 'shoo', film: at(11, 2), gates: 0, door: 0, windows: 1, shadow: WIDE_SHADOW },
  { label: 'climb', film: at(12, 3), gates: 0, door: 0, windows: 1, shadow: WIDE_SHADOW },
  { label: 'gates', film: at(14, 2), gates: 0.6, door: 0, windows: 1, shadow: WIDE_SHADOW },
  { label: 'lane', film: at(15, 2), gates: 1, door: 0, windows: 1, shadow: WIDE_SHADOW },
  { label: 'door', film: at(17, 2), gates: 1, door: 0, windows: 0.4, shadow: DOOR_SHADOW },
  { label: 'door-open', film: at(19), gates: 1, door: 1, windows: 0.4, shadow: DOOR_SHADOW },
];

const heroPose: CamPose = { pos: HERO.pos, look: HERO.look, fov: HERO.fov, focus: HERO.focus };
const poseOf = (s: Shot): CamPose => (s.film === null ? heroPose : journeyAt(s.film));
/** the film's parallax for the castle: (camera − HERO.pos) × [0.75, 0.45, 0] */
const parallax = (p: readonly number[]): [number, number, number] => [(p[0] - HERO.pos[0]) * 0.75, (p[1] - HERO.pos[1]) * 0.45, 0];

function Rig({ pose }: { pose: CamPose }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...pose.pos);
    camera.fov = pose.fov;
    camera.near = 0.05;
    camera.far = 80;
    camera.updateProjectionMatrix();
    camera.lookAt(...pose.look);
    camera.updateMatrixWorld();
  }, [camera, pose]);
  return null;
}

export interface WorldSceneProps {
  /** the film frame the world's own animation runs on (wind, flicker, smoke, the bats' flight) */
  f: number;
  /** the camera position: the castle's (and its bats') parallax, the far bats turned to face it (default: the hero eye) */
  camPos?: readonly number[];
  /** the camera's fov: far bats smaller than a few pixels are drawn as flecks */
  fov?: number;
  gates?: number;
  door?: number;
  windows?: number;
  /** the giant jack-o'-lantern's candle, 0 out .. 1 (film/beats.ts bigPumpkinLitAt) */
  bigLit?: number;
  /** the small pumpkins' candles (film/beats.ts pumpkinsLitAt) */
  lit?: number;
  /** the peek ghost let down, 0 .. 1 (film/beats.ts ghostLowerAt; default: its curve at f) */
  peek?: number;
  /** the far window gone cold (film/beats.ts farColdAt) */
  farCold?: number;
  /** the film frame the near flock starts its pass over the graveyard (default: through the hero view's hold) */
  nearBats?: number;
  /** ignored: no stand-ins remain in the world (kept for lookdevs written against the older scene) */
  standIns?: boolean;
}

/**
 * Every built piece of the world (inside LookStage, which brings the sky, terrain, grass, the light
 * and the post). The giant jack-o'-lantern's candle (the scene's one point light) is always mounted.
 */
export function WorldScene({ f, camPos = HERO.pos, fov = HERO.fov, gates = 0, door = 0, windows = 1, bigLit = 1, lit = 1, peek, farCold = 0, nearBats = at(6) - 72 }: WorldSceneProps) {
  const offset = parallax(camPos);
  const lod = { eye: [camPos[0], camPos[1], camPos[2]] as const, fov };
  return (
    <>
      <Trees f={f} />
      <Dressing f={f} />
      <Graveyard />
      <Fence />
      <Gates open={gates} />
      <Lamps />
      <BigPumpkin f={f} lit={bigLit} />
      <PumpkinPatch f={f} lit={lit} />
      <Cauldron f={f} />
      <Coffin />
      <Fireflies f={f} />
      <Ghosts f={f} lower={[0, 0, peek ?? ghostLowerAt(f)]} />
      <House doorOpen={door} windows={windows} f={f} />
      <Castle f={f} offset={offset} />
      <FarHouse cold={farCold} />
      <BatFlock f={f} path={CRAG_FLIGHT} count={14} seed={21} size={0.12} speed={0.75} spread={0.26} flap={5.2} eyes={false} fog={0.3} offset={offset} lod={lod} />
      <BatFlock f={f} path={MOON_FLIGHT} count={9} seed={33} size={0.1} speed={0.6} spread={0.2} flap={5.4} eyes={false} fog={0.3} lod={lod} />
      <BatFlock f={f} path={GRAVEYARD_FLIGHT} count={6} seed={5} size={0.2} speed={1.25} spread={0.28} flap={3.8} start={nearBats} gap={0.8} eyes={false} fog={0.8} lod={{ ...lod, px: 16 }} />
    </>
  );
}

function WorldStage({ shots }: { shots: Shot[] }) {
  const f = useCurrentFrame();
  const shot = shots[Math.min(f, shots.length - 1)];
  const pose = poseOf(shot);
  // the world's own animation (wind, flicker) runs on the film frame the camera comes from
  const t = shot.film ?? at(6);
  return (
    <AbsoluteFill style={{ background: '#0a1118' }}>
      <Stage3D antialias={false} camera={{ fov: 44, near: 0.05, far: 80, position: [0, 3, 8] }}>
        <color attach="background" args={['#0a1118']} />
        <Rig pose={pose} />
        <Night f={t} fps={FPS} shadow={shot.shadow} />
        <SkyDome />
        <Terrain />
        <Grass />
        <WorldScene f={t} camPos={pose.pos} fov={pose.fov} gates={shot.gates} door={shot.door} windows={shot.windows} />
        <NightPost f={t} focus={pose.focus} {...LOOK_POST} />
      </Stage3D>
    </AbsoluteFill>
  );
}

const HERO_ONLY = SHOTS.slice(0, 1);
function WorldHero() {
  return <WorldStage shots={HERO_ONLY} />;
}
function WorldShots() {
  return <WorldStage shots={SHOTS} />;
}

export function WorldRoot() {
  return (
    <>
      <Composition id="WorldHero" component={WorldHero} width={1920} height={1080} fps={FPS} durationInFrames={1} />
      <Composition id="WorldShots" component={WorldShots} width={1920} height={1080} fps={FPS} durationInFrames={SHOTS.length} />
    </>
  );
}
