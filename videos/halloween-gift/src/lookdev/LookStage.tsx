/**
 * The lookdev stage: the world's foundation (the sky dome, inside the story; terrain and path, grass,
 * the night rig, the post chain) around whatever assets are being developed, seen through a
 * keyed camera path. Asset lookdev entries (src/lookdev/*.entry.ts) wrap their assets in it, so
 * every asset is judged in the film's own light, fog and grade, from the film's own hero view.
 */
import { Stage3D } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, type ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { type PerspectiveCamera } from 'three';
import { FPS } from '../cues.ts';
import { CamPath, type CamKey, type CamPose } from '../film/campath.ts';
import { Night } from '../look/Night.tsx';
import { NightPost, type NightPostOptions } from '../look/NightPost.tsx';
import { SkyDome } from '../look/SkyPortal.tsx';
import { Grass } from '../world/Grass.tsx';
import { HERO as LAYOUT_HERO } from '../world/layout.ts';
import { Terrain } from '../world/Terrain.tsx';

/** The hero view of the valley (bars 5–8): the reference's composition (world/layout.ts). */
export const HERO: Omit<CamKey, 'f'> = LAYOUT_HERO;

/** A camera that holds the hero view. */
export const HERO_PATH = new CamPath([
  { f: 0, ...HERO, hold: true },
  { f: 1000, ...HERO, hold: true },
]);

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

export interface LookStageProps {
  children?: ReactNode | ((f: number) => ReactNode);
  /** the camera: a CamPath, or anything with at(f) → CamPose (the film's journey) */
  path?: { at(f: number): CamPose };
  /** leave the ground out (close-ups of a single asset on a plain floor) */
  bare?: boolean;
  /** options of the film's post chain (look/NightPost.tsx); default LOOK_POST */
  post?: NightPostOptions;
}

/** The post the lookdev judges assets under: the painterly stage and soft moon rays (probe, 2026-11-04). */
export const LOOK_POST: NightPostOptions = { paint: 3, rays: true };

export function LookStage({ children, path = HERO_PATH, bare = false, post = LOOK_POST }: LookStageProps) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#0a1118' }}>
      <Stage3D antialias={false} camera={{ fov: 44, near: 0.05, far: 80, position: [0, 3, 8] }}>
        <color attach="background" args={['#0a1118']} />
        <CameraRig path={path} f={f} />
        <Night f={f} fps={FPS} />
        <SkyDome />
        {!bare && <Terrain />}
        {!bare && <Grass />}
        {typeof children === 'function' ? children(f) : children}
        <NightPost f={f} focus={path.at(f).focus} {...post} />
      </Stage3D>
    </AbsoluteFill>
  );
}
