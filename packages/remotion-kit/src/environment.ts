/**
 * Image-based light without the network: three's procedural RoomEnvironment, prefiltered once
 * with a PMREMGenerator and set as scene.environment. drei's <Environment preset> fetches HDRIs
 * from a CDN at render time (pixels the input hash does not pin), and an unmemoized environment
 * re-captures every frame (THE AI STACK): this one is built once per renderer and reused.
 *
 * `intensity` lights every standard material without an envMap of its own: for those, three
 * (r186) uses scene.environmentIntensity and IGNORES the material's envMapIntensity. To make one
 * object reflect more (chrome), pass the returned texture as its envMap with its own intensity.
 */
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { PMREMGenerator, type Texture } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface RoomEnvironmentOptions {
  /** scene.environmentIntensity (default 1) */
  intensity?: number;
  /** PMREM blur in radians (default 0.04) */
  blur?: number;
}

export function useRoomEnvironment({ intensity = 1, blur = 0.04 }: RoomEnvironmentOptions = {}): Texture {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const texture = useMemo(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const t = pmrem.fromScene(room, blur).texture;
    room.dispose();
    pmrem.dispose();
    return t;
  }, [gl, blur]);
  useLayoutEffect(() => {
    scene.environment = texture;
    scene.environmentIntensity = intensity;
    return () => {
      if (scene.environment === texture) scene.environment = null;
    };
  }, [scene, texture, intensity]);
  useLayoutEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
