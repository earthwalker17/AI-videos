/**
 * The whole world as built so far, through the film's own cameras: the integrator's lookdev (the
 * asset families judge their own pieces in Buildings, Graveyard, Trees, Ground). Stand-ins remain
 * where a family has not landed yet (the old pumpkin; no Clawd, ghosts or bats).
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
import { type CamPose } from '../film/campath.ts';
import { journeyAt } from '../film/journey.ts';
import { Night } from '../look/Night.tsx';
import { NightPost } from '../look/NightPost.tsx';
import { SkyDome } from '../look/SkyPortal.tsx';
import { Castle } from '../world/Castle.tsx';
import { Dressing } from '../world/Dressing.tsx';
import { Fence, Gates, Lamps } from '../world/Fence.tsx';
import { Graveyard } from '../world/Graveyard.tsx';
import { Grass } from '../world/Grass.tsx';
import { FarHouse, House } from '../world/House.tsx';
import { HERO, LAND, onGround } from '../world/layout.ts';
import { Pumpkin } from '../world/Pumpkin.tsx';
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
  /** the film frame the world's own animation runs on (wind, flicker, smoke) */
  f: number;
  /** the camera position, for the castle's parallax (default: the hero eye) */
  camPos?: readonly number[];
  gates?: number;
  door?: number;
  windows?: number;
  /** the stand-ins for families not landed yet (the V1 pumpkin); off when a family brings its own */
  standIns?: boolean;
}

/**
 * Every built piece of the world (inside LookStage, which brings the sky, terrain, grass, the light
 * and the post): asset families put their own pieces beside it, with standIns off for the ones they replace.
 */
export function WorldScene({ f, camPos = HERO.pos, gates = 0, door = 0, windows = 1, standIns = true }: WorldSceneProps) {
  return (
    <>
      <Trees f={f} />
      <Dressing f={f} />
      <Graveyard />
      <Fence />
      <Gates open={gates} />
      <Lamps />
      {standIns && <Pumpkin position={onGround(LAND.bigPumpkin.x, LAND.bigPumpkin.z, 0.55)} scale={0.62} lit={1} light={false} f={f} seed={2} rotation={LAND.bigPumpkin.yaw} />}
      <House doorOpen={door} windows={windows} f={f} />
      <Castle f={f} offset={parallax(camPos)} />
      <FarHouse cold={0} />
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
        <WorldScene f={t} camPos={pose.pos} gates={shot.gates} door={shot.door} windows={shot.windows} />
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
