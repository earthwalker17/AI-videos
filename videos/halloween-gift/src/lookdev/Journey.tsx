/**
 * The film's camera journey (film/journey.ts) over the world as far as it is built: the asset
 * families that exist, greybox stand-ins (lookdev/Probe.tsx) for the rest, and an orange box
 * hopping where Clawd's V2 blocking puts him (film/blocking.ts). For judging framing, pacing and
 * continuity on stills or spans before the film is assembled. The desk shots show no desk yet.
 */
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry } from 'three';
import { clawdAt } from '../film/blocking.ts';
import { journeyAt } from '../film/journey.ts';
import { storybookMaterial } from '../look/materials.ts';
import { Dressing } from '../world/Dressing.tsx';
import { Pumpkin } from '../world/Pumpkin.tsx';
import { Trees } from '../world/Trees.tsx';
import { LAND, onGround } from '../world/layout.ts';
import { LookStage } from './LookStage.tsx';
import { Fence, HouseAndCrag, Stones } from './Probe.tsx';

const JOURNEY = { at: journeyAt };

/** Clawd's stand-in: his body (13 × 8 cells of 0.025) on four legs, posed and squashed by the blocking. */
function ClawdBox({ f }: { f: number }) {
  const geo = useMemo(() => new BoxGeometry(0.325, 0.2, 0.15).translate(0, 0.125, 0), []);
  const mat = useMemo(() => storybookMaterial({ color: '#D77757', breakup: 0.05, rim: 0.8 }), []);
  useLayoutEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  const { pose, hop } = clawdAt(f);
  if (!pose.visible) return null;
  const sy = (hop?.sy ?? 1) * Math.max(0.02, Math.min(1, pose.rise));
  const sxz = hop?.sxz ?? 1;
  return <mesh geometry={geo} material={mat} position={pose.pos} rotation-y={pose.heading + Math.PI / 2} scale={[sxz, sy, sxz]} castShadow />;
}

export function Journey() {
  return (
    <LookStage path={JOURNEY}>
      {(f) => (
        <>
          <Trees f={f} />
          <Dressing f={f} />
          <Stones />
          <Fence />
          <HouseAndCrag f={f} />
          <Pumpkin position={onGround(LAND.bigPumpkin.x, LAND.bigPumpkin.z, 0.55)} scale={0.62} lit={1} f={f} seed={2} rotation={LAND.bigPumpkin.yaw} />
          <ClawdBox f={f} />
        </>
      )}
    </LookStage>
  );
}
