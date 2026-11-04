/**
 * Lookdev of the buildings family (world/House.tsx, world/Castle.tsx) in the film's own sky,
 * ground, grass, light and post, with the trees, the dressing and the greybox stones and fence
 * around them:
 *  - BuildingsHero: the hero view (the reference's composition);
 *  - BuildingsDoor: the film's door two-shot (frame 0 the door shut, 1 open, 2 half open), with the
 *    windows at 0.4 (the papers are the focal point) and the moon's shadow box fitted to the door
 *    yard (the film should key Night's `shadow` box per shot the same way: see DOOR_SHADOW);
 *  - BuildingsDoorWide: the film's pull-back door shot (same frames, same shadow box);
 *  - BuildingsDoorDefault: the two-shot through the default LookStage (the default shadow box), for comparison;
 *  - BuildingsDoorFramed: a PROPOSAL, not the film's: the two-shot pulled back and tilted down (the
 *    lanterns whole, the 横批 clear of the top, more yard for Clawd);
 *  - BuildingsHeroClear: DIAGNOSTIC, the hero view with the storybook fog off (forms and values);
 *  - BuildingsCastle: the crag and the castle from the hero eye on a long lens (frame 0), and two
 *    moved cameras with the film's parallax offset (frames 1, 2: is the crag's foot grounded?);
 *  - BuildingsClose: held close views: the cottage three-quarter (0), its roof, owls and chimney
 *    (1), the far window house warm (2) and cold (3), the door front close (4), the cottage from
 *    the lane (5).
 */
import { Stage3D } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { AbsoluteFill, Composition, useCurrentFrame } from 'remotion';
import { type PerspectiveCamera } from 'three';
import { FPS } from '../cues.ts';
import { CamPath, type CamKey, type CamPose } from '../film/campath.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { Night } from '../look/Night.tsx';
import { NightPost } from '../look/NightPost.tsx';
import { SkyDome } from '../look/SkyPortal.tsx';
import { Grass } from '../world/Grass.tsx';
import { Terrain } from '../world/Terrain.tsx';
import { Castle, castleStats } from '../world/Castle.tsx';
import { Dressing } from '../world/Dressing.tsx';
import { FarHouse, farHouseStats, House, houseStats } from '../world/House.tsx';
import { fromHouse, fromV1Door, HERO, LAND, onGround } from '../world/layout.ts';
import { Pumpkin } from '../world/Pumpkin.tsx';
import { Trees } from '../world/Trees.tsx';
import { NIGHT } from '../look/materials.ts';
import { LOOK_POST, LookStage } from './LookStage.tsx';
import { Fence, Stones } from './Probe.tsx';

const hold = (f: number, k: Omit<CamKey, 'f' | 'hold'>): CamKey => ({ f, ...k, hold: true });
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const DOOR_POS = fromV1Door([1.2, 1.75, 3.0]);
const DOOR_LOOK = fromV1Door([0.0, 2.4, -1.3]);
const WIDE_POS = fromV1Door([0.7, 1.9, 4.4]);
const WIDE_LOOK = fromV1Door([-0.15, 2.55, -1.0]);

/** a proposal (not the film's): the two-shot pulled back and tilted down so the lanterns are whole and the yard reads */
const FRAMED_POS = fromV1Door([1.35, 1.95, 4.1]);
const FRAMED_LOOK = fromV1Door([0.0, 2.2, -1.3]);
const FRAMED_PATH = new CamPath([0, 1, 2, 3].map((f) => hold(f, { pos: FRAMED_POS, look: FRAMED_LOOK, fov: 38, focus: dist(FRAMED_POS, FRAMED_LOOK) })));
const DOOR_PATH = new CamPath([0, 1, 2, 3].map((f) => hold(f, { pos: DOOR_POS, look: DOOR_LOOK, fov: 36, focus: dist(DOOR_POS, DOOR_LOOK) })));
const WIDE_PATH = new CamPath([0, 1, 2, 3].map((f) => hold(f, { pos: WIDE_POS, look: WIDE_LOOK, fov: 36, focus: dist(WIDE_POS, WIDE_LOOK) })));
/** the door: shut, open, half open, shut */
const doorAt = (f: number) => [0, 1, 0.5, 0][Math.min(3, f)] ?? 0;

const CRAG_LOOK: [number, number, number] = [LAND.crag.x - 0.1, 4.5, LAND.crag.z];
const FAR_LOOK: [number, number, number] = [LAND.farHouse.x, 2.95, LAND.farHouse.z];
const CASTLE_PATH = new CamPath([
  hold(0, { pos: HERO.pos, look: CRAG_LOOK, fov: 17, focus: dist(HERO.pos, CRAG_LOOK) }),
  hold(1, { pos: [2.6, 2.6, 3.2], look: [3.4, 3.3, -4.7], fov: 30, focus: 8 }),
  hold(2, { pos: [-0.8, 3.9, 5.0], look: [2.2, 3.8, -4.7], fov: 34, focus: 10 }),
  // the far house on its knoll, from the hero eye on a very long lens
  hold(3, { pos: HERO.pos, look: FAR_LOOK, fov: 6, focus: dist(HERO.pos, FAR_LOOK) }),
]);
/** the film's parallax for the castle: (camera − HERO.pos) × [0.75, 0.45, 0] */
const parallax = (p: readonly number[]): [number, number, number] => [(p[0] - HERO.pos[0]) * 0.75, (p[1] - HERO.pos[1]) * 0.45, 0];

const house = (p: [number, number, number]) => fromHouse(p);
const CLOSE_PATH = new CamPath([
  hold(0, { pos: house([-2.2, 0.9, 3.6]), look: house([0.35, 1.3, -0.5]), fov: 40, focus: 4.4 }),
  hold(1, { pos: house([-0.6, 2.6, 2.4]), look: house([0.8, 2.6, -0.8]), fov: 38, focus: 3.3 }),
  // the far window house, from beside the last house's right end (clear of its tall wing)
  hold(2, { pos: [7.2, 2.95, -1.7], look: [6.05, 2.62, -3.6], fov: 34, focus: 2.2 }),
  hold(3, { pos: [7.2, 2.95, -1.7], look: [6.05, 2.62, -3.6], fov: 34, focus: 2.2 }),
  hold(4, { pos: house([0.45, 0.55, 1.35]), look: house([0, 0.75, 0]), fov: 40, focus: 1.45 }),
  hold(5, { pos: house([-3.2, 0.75, 1.2]), look: house([0.2, 1.2, -0.4]), fov: 40, focus: 3.6 }),
]);

/**
 * The moon's shadow box for the door shots: centred on the door, wide and tall enough for the house's
 * walls (shorter, the moon leaks into the room over the back wall), a shadow texel about 3.3 mm
 * across instead of 6-8. (The stepped plum/teal edges on the yard are not shadows: they are the
 * terrain's turf/dirt material groups meeting along its 4.6 cm quads; see the report.)
 */
const DOOR_W = fromHouse([0.3, 0, 0.6]);
export const DOOR_SHADOW = { x: DOOR_W[0], z: DOOR_W[2], hw: 3.4, hd: 3.4 };

function Rig({ path, f }: { path: { at(f: number): CamPose }; f: number }) {
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

/** LookStage with the Night's shadow box keyed for the shot (LookStage keeps the default box). */
function ShotStage({ path, shadow, children }: { path: { at(f: number): CamPose }; shadow: { x: number; z: number; hw: number; hd: number }; children: (f: number) => ReactNode }) {
  const f = useCurrentFrame();
  // mount the stage only once the fonts are in: its text canvases are drawn once, at mount (look/fonts.ts)
  const { ready } = useFilmFonts();
  return (
    <AbsoluteFill style={{ background: '#0a1118' }}>
      {ready && (
        <Stage3D antialias={false} camera={{ fov: 44, near: 0.05, far: 80, position: [0, 3, 8] }}>
          <color attach="background" args={['#0a1118']} />
          <Rig path={path} f={f} />
          <Night f={f} fps={FPS} shadow={shadow} />
          <SkyDome />
          <Terrain />
          <Grass />
          {children(f)}
          <NightPost f={f} focus={path.at(f).focus} {...LOOK_POST} />
        </Stage3D>
      )}
    </AbsoluteFill>
  );
}

function World({ f, doorOpen = 0, cold = 0, offset = [0, 0, 0], windows = 1 }: { f: number; doorOpen?: number; cold?: number; offset?: [number, number, number]; windows?: number }) {
  return (
    <>
      <Trees f={f} />
      <Dressing f={f} />
      <Stones />
      <Fence />
      <Pumpkin position={onGround(LAND.bigPumpkin.x, LAND.bigPumpkin.z, 0.55)} scale={0.62} lit={1} f={f} seed={2} rotation={LAND.bigPumpkin.yaw} />
      <House doorOpen={doorOpen} windows={windows} f={f} />
      <Castle f={f} offset={offset} />
      <FarHouse cold={cold} />
    </>
  );
}

function BuildingsHero() {
  return <LookStage>{(f) => <World f={f} />}</LookStage>;
}

/** DIAGNOSTIC ONLY (never the film): the hero view with the storybook fog off, to judge forms and values. */
function NoFog() {
  useLayoutEffect(() => {
    NIGHT.uSbFogOn.value = 0;
    return () => {
      NIGHT.uSbFogOn.value = 1;
    };
  }, []);
  return null;
}
function BuildingsHeroClear() {
  return (
    <LookStage>
      {(f) => (
        <>
          <NoFog />
          <World f={f} />
        </>
      )}
    </LookStage>
  );
}

function BuildingsDoor() {
  return (
    <ShotStage path={DOOR_PATH} shadow={DOOR_SHADOW}>
      {(f) => <World f={f} doorOpen={doorAt(f)} offset={parallax(DOOR_POS)} windows={0.4} />}
    </ShotStage>
  );
}

function BuildingsDoorFramed() {
  return (
    <ShotStage path={FRAMED_PATH} shadow={DOOR_SHADOW}>
      {(f) => <World f={f} doorOpen={doorAt(f)} offset={parallax(FRAMED_POS)} windows={0.4} />}
    </ShotStage>
  );
}

function BuildingsDoorDefault() {
  return <LookStage path={DOOR_PATH}>{(f) => <World f={f} doorOpen={doorAt(f)} offset={parallax(DOOR_POS)} windows={0.4} />}</LookStage>;
}

function BuildingsDoorWide() {
  return (
    <ShotStage path={WIDE_PATH} shadow={DOOR_SHADOW}>
      {(f) => <World f={f} doorOpen={doorAt(f)} offset={parallax(WIDE_POS)} windows={0.4} />}
    </ShotStage>
  );
}

function BuildingsCastle() {
  return <LookStage path={CASTLE_PATH}>{(f) => <World f={f} offset={parallax(CASTLE_PATH.at(f).pos)} />}</LookStage>;
}

function BuildingsClose() {
  return <LookStage path={CLOSE_PATH} post={{ ...LOOK_POST, rays: false }}>{(f) => <World f={f} cold={f === 3 ? 1 : 0} offset={parallax(CLOSE_PATH.at(f).pos)} />}</LookStage>;
}

/** The family's triangle counts per material (one draw call each), as text. */
function BuildingsStats() {
  const text = useMemo(() => {
    const parts = { house: houseStats(), castle: castleStats(), farHouse: farHouseStats() };
    const total = Object.values(parts).reduce((a, p) => a + Object.values(p).reduce((b, v) => b + v, 0), 0);
    return JSON.stringify({ ...parts, total }, null, 1);
  }, []);
  return (
    <AbsoluteFill style={{ background: '#111', color: '#eee', fontSize: 22, padding: 40, whiteSpace: 'pre', fontFamily: 'monospace' }}>{text}</AbsoluteFill>
  );
}

export function BuildingsRoot() {
  return (
    <>
      <Composition id="BuildingsHero" component={BuildingsHero} width={1920} height={1080} fps={FPS} durationInFrames={48} />
      <Composition id="BuildingsHeroClear" component={BuildingsHeroClear} width={1920} height={1080} fps={FPS} durationInFrames={1} />
      <Composition id="BuildingsDoor" component={BuildingsDoor} width={1920} height={1080} fps={FPS} durationInFrames={4} />
      <Composition id="BuildingsDoorWide" component={BuildingsDoorWide} width={1920} height={1080} fps={FPS} durationInFrames={4} />
      <Composition id="BuildingsDoorDefault" component={BuildingsDoorDefault} width={1920} height={1080} fps={FPS} durationInFrames={4} />
      <Composition id="BuildingsDoorFramed" component={BuildingsDoorFramed} width={1920} height={1080} fps={FPS} durationInFrames={4} />
      <Composition id="BuildingsCastle" component={BuildingsCastle} width={1920} height={1080} fps={FPS} durationInFrames={4} />
      <Composition id="BuildingsClose" component={BuildingsClose} width={1920} height={1080} fps={FPS} durationInFrames={6} />
      <Composition id="BuildingsStats" component={BuildingsStats} width={1920} height={1080} fps={FPS} durationInFrames={1} />
    </>
  );
}
