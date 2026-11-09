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
import { PlaneGeometry, Vector4, type PerspectiveCamera } from 'three';
import type { CamPose } from '@aiv/remotion-kit';
import { DESK_HEX, makeDeskMaterial } from './gl/desk.ts';
import { setLight } from './gl/light.ts';
import { afterToneMapping, effectsNoBloom, effectsWithBloom } from './gl/post.ts';
import { FAR, NEAR } from './camera.ts';
import { footprintsAt, type Footprint } from './footprints.ts';
import { DeskKit } from './kit.tsx';
import { KEY, type Pool } from './layout.ts';
import { poolsAt } from './pools.ts';
import type { DeskState } from './state.ts';

/** The key and fill: one value budget (design D4): unpooled paper near paper idle (~155), enamel near 199; only the pooled reply, cell and in-tray reach paper-lit. */
export const LIGHTS = { key: 2.12, fill: 0.84, sky: '#FFFFFF', ground: '#B0B0B0' } as const;

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
function LightState({ s, footprints, pools }: { s: DeskState; footprints?: Footprint[]; pools?: Pool[] }) {
  useLayoutEffect(() => {
    setLight(footprints ?? footprintsAt(s), pools ?? poolsAt(s));
  }, [s, footprints, pools]);
  return null;
}

/** The desk's history marks: the grooves (whole hand-overs) and act one's pressed folders. Neither exists yet in act one. */
export interface DeskMarks {
  grooves: boolean;
  /** all (true), none (false), or how deep each folder is pressed so far (0..1, as beat3.ts IMPRINTS: the turn presses them in) */
  imprints: boolean | readonly number[];
}

function Ground({ marks }: { marks?: DeskMarks }) {
  const geometry = useMemo(() => new PlaneGeometry(9000, 7000), []);
  const material = useMemo(() => makeDeskMaterial(), []);
  // a mark that is absent moves out of every lookup (the shader is unchanged): grooves get empty boxes, imprints sit far off
  const original = useMemo(() => ({ box: material.uniforms.uGrooveBox.value as Vector4[], imp: material.uniforms.uImp.value as Vector4[], rot: material.uniforms.uImpRot.value as Vector4[] }), [material]);
  const depths = Array.isArray(marks?.imprints) ? (marks.imprints as readonly number[]) : null;
  useLayoutEffect(() => {
    material.uniforms.uGrooveBox.value = marks?.grooves === false ? original.box.map(() => new Vector4(1e6, 1e6, -1e6, -1e6)) : original.box;
    material.uniforms.uImp.value = marks?.imprints === false ? original.imp.map(() => new Vector4(1e6, 1e6, 1, 1)) : original.imp;
    // pressed part way: each imprint's depth rides in its rotation vector's w (gl/desk.ts)
    material.uniforms.uImpRot.value = depths ? original.rot.map((r, i) => new Vector4(r.x, r.y, r.z, depths[i] ?? 1)) : original.rot;
  }, [material, original, marks?.grooves, marks?.imprints, depths]);
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
  /** pools instead of the act-two ones (act one: your lamp only) */
  pools?: Pool[];
  /** which history marks the desk shows (default: all) */
  marks?: DeskMarks;
  /** which strings the printed textures print (default all; gl/text.ts makePrintTextures) */
  printKeep?: (text: string) => boolean;
}

export function DeskWorld({ s, pose, bloom, printFamily, sansFamily, children, footprints, pools, marks, printKeep }: DeskWorldProps) {
  return (
    <>
      <color attach="background" args={[DESK_HEX.base]} />
      <Rig pose={pose} />
      <directionalLight position={[KEY[0], KEY[1], KEY[2]]} intensity={LIGHTS.key} color="#FFFFFF" />
      <hemisphereLight position={[0, 0, 1]} args={[LIGHTS.sky, LIGHTS.ground, LIGHTS.fill]} />
      <LightState s={s} footprints={footprints} pools={pools} />
      <Ground marks={marks} />
      <DeskKit printFamily={printFamily} sansFamily={sansFamily} step={s.step.amount} stepLate={s.testsStep} printKeep={printKeep}>
        {children}
      </DeskKit>
      <PostChain effects={bloom ? effectsWithBloom : effectsNoBloom} afterToneMapping={afterToneMapping} toneMapping={ToneMappingMode.NEUTRAL} multisampling={4} />
    </>
  );
}
