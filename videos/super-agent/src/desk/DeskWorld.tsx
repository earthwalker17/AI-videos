/**
 * The Register Desk at a film frame: the camera, the fixed light set, the desk, every object, and
 * the post chain (docs/ARCHITECTURE.md decision 30). Everything is posed from the frame in props
 * and layout effects, before ThreeCanvas advances R3F (knowledge/r3f-under-remotion.md).
 *
 * The light set never changes (three keys its programs on light counts): a directional key from
 * (−0.55, 0.45, 0.70) and a hemisphere fill; enamel alone reflects the room environment. Lamp pools
 * and shadows are analytic (gl/light.ts), set once per frame from the state.
 */
import { PostChain } from '@aiv/remotion-kit';
import { useThree } from '@react-three/fiber';
import { ToneMappingMode } from 'postprocessing';
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { PlaneGeometry, type PerspectiveCamera } from 'three';
import type { CamPose } from '@aiv/remotion-kit';
import { DESK_HEX, makeDeskMaterial } from './gl/desk.ts';
import { setLight } from './gl/light.ts';
import { afterToneMapping, effectsNoBloom, effectsWithBloom } from './gl/post.ts';
import { FAR, NEAR } from './camera.ts';
import { footprintsAt, type Footprint } from './footprints.ts';
import { DeskKit } from './kit.tsx';
import { KEY } from './layout.ts';
import { poolsAt } from './pools.ts';
import type { DeskState } from './state.ts';

/** The key and fill: a flat top in full key shows about 85% of its albedo (the pools lift what has attention above it), a south face (fill only) about a quarter. */
export const LIGHTS = { key: 2.45, fill: 0.98, sky: '#FFFFFF', ground: '#B0B0B0' } as const;

function Rig({ pose }: { pose: CamPose }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    camera.up.set(0, 1, 0);
    camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    camera.fov = pose.fov;
    camera.near = NEAR;
    camera.far = FAR;
    camera.updateProjectionMatrix();
    camera.lookAt(pose.look[0], pose.look[1], pose.look[2]);
    camera.updateMatrixWorld();
  }, [camera, pose]);
  return null;
}

/** The frame's shadows and pools, uploaded before the frame is drawn. */
function LightState({ s, footprints }: { s: DeskState; footprints?: Footprint[] }) {
  useLayoutEffect(() => {
    setLight(footprints ?? footprintsAt(s), poolsAt(s));
  }, [s, footprints]);
  return null;
}

function Ground() {
  const geometry = useMemo(() => new PlaneGeometry(9000, 7000), []);
  const material = useMemo(() => makeDeskMaterial(), []);
  useLayoutEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

export interface DeskWorldProps {
  s: DeskState;
  pose: CamPose;
  bloom: boolean;
  printFamily: string;
  /** the film's sans stack (the trait plate's words) */
  sansFamily: string;
  /** the objects (they draw with the kit's materials) */
  children: ReactNode;
  /** footprints to cast instead of the layout's (the harness) */
  footprints?: Footprint[];
}

export function DeskWorld({ s, pose, bloom, printFamily, sansFamily, children, footprints }: DeskWorldProps) {
  return (
    <>
      <color attach="background" args={[DESK_HEX.base]} />
      <Rig pose={pose} />
      <directionalLight position={[KEY[0], KEY[1], KEY[2]]} intensity={LIGHTS.key} color="#FFFFFF" />
      <hemisphereLight position={[0, 0, 1]} args={[LIGHTS.sky, LIGHTS.ground, LIGHTS.fill]} />
      <LightState s={s} footprints={footprints} />
      <Ground />
      <DeskKit printFamily={printFamily} sansFamily={sansFamily} step={s.step.amount}>
        {children}
      </DeskKit>
      <PostChain effects={bloom ? effectsWithBloom : effectsNoBloom} afterToneMapping={afterToneMapping} toneMapping={ToneMappingMode.NEUTRAL} multisampling={4} />
    </>
  );
}
