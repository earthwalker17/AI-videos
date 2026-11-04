/**
 * The night's light: the moon as one shadow-casting directional light from behind the world
 * (upper right, as in the reference, so every silhouette gets a rim), a teal sky / maroon ground
 * hemisphere, and a faint fill from the camera side that models faces (look/materials.ts's
 * storybook ambient keeps them off black, plum near the lens and teal beyond). A fixed set of lights:
 * lights never mount or unmount (that recompiles every material mid-chunk); practicals that come
 * and go change their intensity instead. Sets the storybook materials' shared uniforms.
 */
import { useLayoutEffect, useMemo } from 'react';
import { Object3D } from 'three';
import { FLOOR } from '../world/layout.ts';
import { NIGHT, setNightTime } from './materials.ts';

export interface NightProps {
  f: number;
  fps: number;
  /** moonlight multiplier (the cold snap lowers the warm practicals, not this) */
  moon?: number;
  /** shadow box: centre x, z and half sizes (keyed per shot by the caller) */
  shadow?: { x: number; z: number; hw: number; hd: number };
}

export function Night({ f, fps, moon = 1, shadow = { x: 0, z: 0, hw: 8.5, hd: 6 } }: NightProps) {
  const target = useMemo(() => new Object3D(), []);
  const dir = NIGHT.uSbMoonDir.value;
  const D = 16;
  const cx = shadow.x;
  const cz = shadow.z;
  target.position.set(cx, FLOOR, cz);
  target.updateMatrixWorld();
  useLayoutEffect(() => setNightTime(f / fps), [f, fps]);
  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={['#4a7fa3', '#2c1628', 0.4]} />
      <directionalLight
        castShadow
        target={target}
        position={[cx + dir.x * D, FLOOR + dir.y * D, cz + dir.z * D]}
        intensity={2.6 * moon}
        color="#c6dff0"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadow.hw}
        shadow-camera-right={shadow.hw}
        shadow-camera-top={shadow.hd}
        shadow-camera-bottom={-shadow.hd}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      />
      {/* a faint fill from the viewer's side (the storybook ambient in the materials keeps faces
          off black; this only models them a little) */}
      <directionalLight position={[-2, FLOOR + 4, 12]} intensity={0.2} color="#9a9aac" />
    </>
  );
}
