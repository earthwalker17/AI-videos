/**
 * The lookdev stage: the world's foundation (portal sky on the cover, terrain and path, grass,
 * the night rig, the post chain) around whatever assets are being developed, seen through a
 * keyed camera path. Asset lookdev entries (src/lookdev/*.entry.ts) wrap their assets in it, so
 * every asset is judged in the film's own light, fog and grade, from the film's own hero view.
 */
import { PostChain, Stage3D } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { BloomEffect, DepthOfFieldEffect, ToneMappingMode, type Effect } from 'postprocessing';
import { useCallback, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Color, type Camera, type PerspectiveCamera } from 'three';
import { FPS } from '../cues.ts';
import { CamPath, type CamKey } from '../film/campath.ts';
import { Night } from '../look/Night.tsx';
import { StorybookGrade } from '../look/Post.tsx';
import { useSkyPortal } from '../look/SkyPortal.tsx';
import { Grass } from '../world/Grass.tsx';
import { BOOK, FLOOR } from '../world/layout.ts';
import { Terrain } from '../world/Terrain.tsx';

/** The hero view of the valley (bars 5–8): the reference's composition. */
export const HERO: Omit<CamKey, 'f'> = { pos: [0.3, 3.45, 7.6], look: [1.0, 2.4, -4.0], fov: 44, focus: 7.0 };

/** A camera that holds the hero view. */
export const HERO_PATH = new CamPath([
  { f: 0, ...HERO, hold: true },
  { f: 1000, ...HERO, hold: true },
]);

function CameraRig({ path, f }: { path: CamPath; f: number }) {
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

function Sky() {
  const mat = useSkyPortal();
  return (
    <mesh material={mat} position={[0, FLOOR + BOOK.d / 2, -BOOK.d / 2 + 0.03]}>
      <planeGeometry args={[BOOK.w, BOOK.d]} />
    </mesh>
  );
}

export interface LookStageProps {
  children?: ReactNode | ((f: number) => ReactNode);
  path?: CamPath;
  /** leave the ground out (close-ups of a single asset on a plain floor) */
  bare?: boolean;
}

export function LookStage({ children, path = HERO_PATH, bare = false }: LookStageProps) {
  const f = useCurrentFrame();
  const dof = useMemo(() => ({ current: null as DepthOfFieldEffect | null }), []);
  const effects = useCallback(
    (camera: Camera): Effect[] => {
      const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.75, luminanceSmoothing: 0.25, intensity: 0.9, radius: 0.8 });
      dof.current = new DepthOfFieldEffect(camera, { focusDistance: 6, focusRange: 3, bokehScale: 2.0, resolutionScale: 0.5 });
      const grade = new StorybookGrade();
      (grade.uniforms.get('uNear')!.value as Color).set('#4a1a2e');
      (grade.uniforms.get('uFar')!.value as Color).set('#2a5c80');
      return [bloom, dof.current, grade];
    },
    [dof],
  );
  useLayoutEffect(() => {
    const p = path.at(f);
    if (dof.current) {
      dof.current.cocMaterial.focusDistance = p.focus;
      dof.current.cocMaterial.focusRange = Math.max(1.2, p.focus * 0.55);
    }
  });
  return (
    <AbsoluteFill style={{ background: '#0a1118' }}>
      <Stage3D antialias={false} camera={{ fov: 44, near: 0.05, far: 80, position: [0, 3, 8] }}>
        <color attach="background" args={['#0a1118']} />
        <CameraRig path={path} f={f} />
        <Night f={f} fps={FPS} />
        <Sky />
        {!bare && <Terrain />}
        {!bare && <Grass />}
        {typeof children === 'function' ? children(f) : children}
        <PostChain effects={effects} toneMapping={ToneMappingMode.NEUTRAL} />
      </Stage3D>
    </AbsoluteFill>
  );
}
