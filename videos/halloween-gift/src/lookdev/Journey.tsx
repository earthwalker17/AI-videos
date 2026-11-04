/**
 * The film's camera journey (film/journey.ts) over the world as built (lookdev/World.tsx
 * WorldScene, driven by the V2 beats: the gates, the door, the cottage's windows, the foot band),
 * and an orange box hopping where Clawd's V2 blocking puts him (film/blocking.ts). For judging
 * framing, pacing and continuity on stills or spans before the film is assembled. The desk shots
 * show no desk yet.
 */
import { useLayoutEffect, useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { BoxGeometry } from 'three';
import { bigPumpkinLitAt, doorOpenAt, farColdAt, footAt, gatesOpenAt, pumpkinsLitAt, windowsAt } from '../film/beats.ts';
import { clawdAt } from '../film/blocking.ts';
import { journeyAt } from '../film/journey.ts';
import { storybookMaterial } from '../look/materials.ts';
import { LOOK_POST, LookStage } from './LookStage.tsx';
import { WorldScene } from './World.tsx';

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
  const frame = useCurrentFrame();
  return (
    <LookStage path={JOURNEY} post={{ ...LOOK_POST, foot: footAt(frame) }}>
      {(f) => (
        <>
          <WorldScene f={f} camPos={journeyAt(f).pos} fov={journeyAt(f).fov} gates={gatesOpenAt(f)} door={doorOpenAt(f)} windows={windowsAt(f)} bigLit={bigPumpkinLitAt(f)} lit={pumpkinsLitAt(f)} farCold={farColdAt(f)} />
          <ClawdBox f={f} />
        </>
      )}
    </LookStage>
  );
}
