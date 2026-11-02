/**
 * Clawd, a papercraft puppet built on the Claude Code CLI's model sheet: a 13 x 8 body with no
 * mouth, two 1 x 2 vertical slit eyes in rows 2-3, 2 x 2 arm stubs in rows 4-5 and four 1 x 2
 * legs in columns 0, 2, 10 and 12, in #D77757. The costume (a crooked plum witch hat with an
 * orange band and a mint buckle, an ember-tipped twig wand, a carved pumpkin pail) is ours.
 */
import { useMemo } from 'react';
import { BoxGeometry, ConeGeometry, CylinderGeometry, Object3D, SphereGeometry, TorusGeometry } from 'three';
import type { ClawdPose } from '../film/actors.ts';
import { fibreTexture } from '../look/paper.ts';
import { Pumpkin } from './Pumpkin.tsx';

/** one cell of the model sheet, in world units: the body is 0.65 x 0.40 */
export const U = 0.05;
export const CLAWD = '#D77757';
const EYE = '#141414';
const HAT = '#2B1830';
const BAND = '#E9862E';
const BUCKLE = '#DCE6B7';

/** Clawd's own key light: a soft, cool spot from the front right that travels with the puppet (stop-motion practice). */
export function ClawdKey({ pose, intensity = 10 }: { pose: ClawdPose; intensity?: number }) {
  const target = useMemo(() => new Object3D(), []);
  if (!pose.visible) return null;
  const [x, y, z] = pose.pos;
  target.position.set(x, y + 0.3, z);
  target.updateMatrixWorld();
  return (
    <>
      <primitive object={target} />
      <spotLight position={[x + 1.4, y + 2.4, z + 2.6]} target={target} intensity={intensity} angle={0.42} penumbra={1} decay={1.6} distance={9} color="#d8ecef" />
    </>
  );
}

export function Clawd({ pose, f }: { pose: ClawdPose; f: number }) {
  const geo = useMemo(
    () => ({
      body: new BoxGeometry(13 * U, 8 * U, 6 * U),
      leg: new BoxGeometry(1 * U, 2 * U, 1.2 * U),
      arm: new BoxGeometry(2 * U, 2 * U, 2 * U),
      eye: new BoxGeometry(1 * U, 2 * U, 0.2 * U),
      hat: new ConeGeometry(4.2 * U, 9 * U, 24, 1, true),
      brim: new CylinderGeometry(6.5 * U, 6.5 * U, 0.3 * U, 32),
      band: new CylinderGeometry(4.0 * U, 4.25 * U, 1.2 * U, 24, 1, true),
      buckle: new BoxGeometry(1.6 * U, 1.2 * U, 0.3 * U),
      handle: new TorusGeometry(2.2 * U, 0.18 * U, 6, 24, Math.PI),
      wand: new CylinderGeometry(0.25 * U, 0.35 * U, 9 * U, 6),
      ember: new SphereGeometry(0.7 * U, 12, 8),
    }),
    [],
  );
  if (!pose.visible) return null;
  const legLift = (pair: 0 | 1) => (pose.walk === null ? 0 : Math.max(0, Math.sin((pose.walk + pair * 0.5) * Math.PI * 2)) * 1.2 * U);
  const bob = pose.walk === null ? 0 : Math.abs(Math.sin(pose.walk * Math.PI * 2)) * 0.6 * U;
  const bodyY = 2 * U + 4 * U + bob;
  // the eyes: open slits, a closed line, a wink, or slid left/right
  const eyeShift = pose.eyes === 'left' ? -1 : pose.eyes === 'right' ? 1 : 0;
  const eyeH = (side: -1 | 1) => (pose.eyes === 'closed' || (pose.eyes === 'wink' && side === 1) ? 0.25 : 1);
  return (
    <group position={[pose.pos[0], pose.pos[1] + pose.hop, pose.pos[2]]} rotation-y={pose.heading}>
      {/* the pop-up hinge: lies flat (rise 0) and springs up about its front edge */}
      <group position-z={3 * U} rotation-x={-(1 - pose.rise) * (Math.PI / 2)}>
        <group position-z={-3 * U}>
          {[0, 2, 10, 12].map((c, i) => (
            <mesh key={c} geometry={geo.leg} position={[(c - 6) * U, U + legLift(i % 2 === 0 ? 0 : 1), 0]} castShadow>
              <meshStandardMaterial color={CLAWD} roughness={0.9} bumpMap={fibreTexture()} bumpScale={0.35} />
            </mesh>
          ))}
          <mesh geometry={geo.body} position-y={bodyY} castShadow receiveShadow>
            <meshStandardMaterial color={CLAWD} roughness={0.9} bumpMap={fibreTexture()} bumpScale={0.35} />
          </mesh>
          {/* arm stubs at rows 4-5 (counted from the top of the body) */}
          {([-1, 1] as const).map((s) => {
            const up = pose.arms === 'up' || (pose.arms === 'one-up' && s === 1);
            return (
              <mesh key={s} geometry={geo.arm} position={[s * 7.5 * U, bodyY + (up ? 4 : -1) * U, 0]} castShadow>
                <meshStandardMaterial color={CLAWD} roughness={0.9} bumpMap={fibreTexture()} bumpScale={0.35} />
              </mesh>
            );
          })}
          {([-1, 1] as const).map((s) => (
            <mesh key={s} geometry={geo.eye} position={[(s * 3.5 + eyeShift * 0.6) * U, bodyY + 1.0 * U, 3.05 * U]} scale-y={eyeH(s)}>
              <meshBasicMaterial color={EYE} />
            </mesh>
          ))}
          {/* the witch hat, tilted and crooked */}
          <group position={[0.6 * U, bodyY + 4 * U + pose.hatTip * 2.5 * U, pose.hatTip * 1.5 * U]} rotation={[pose.hatTip * -0.35, 0, -0.18 + pose.hatTip * 0.25]}>
            <mesh geometry={geo.brim} position-y={0.15 * U} castShadow>
              <meshStandardMaterial color={HAT} roughness={0.9} />
            </mesh>
            <mesh geometry={geo.hat} position-y={4.6 * U} rotation-z={0.12} castShadow>
              <meshStandardMaterial color={HAT} roughness={0.9} side={2} />
            </mesh>
            <mesh geometry={geo.band} position-y={1.0 * U}>
              <meshStandardMaterial color={BAND} roughness={0.8} side={2} />
            </mesh>
            <mesh geometry={geo.buckle} position={[0, 1.0 * U, 4.2 * U]}>
              <meshStandardMaterial color={BUCKLE} roughness={0.6} />
            </mesh>
          </group>
          {/* the gift: a black envelope with an orange ribbon and a pumpkin wax seal stamped @, held up */}
          {pose.envelope > 0.02 && (
            <group position={[0, bodyY + 12 * U, 0.5 * U]} scale={pose.envelope}>
              <mesh>
                <boxGeometry args={[10 * U, 6.5 * U, 0.4 * U]} />
                <meshStandardMaterial color="#141016" roughness={0.6} />
              </mesh>
              <mesh position-z={0.25 * U}>
                <boxGeometry args={[10.2 * U, 0.7 * U, 0.2 * U]} />
                <meshStandardMaterial color="#E9862E" roughness={0.6} emissive="#5a2a08" emissiveIntensity={0.4} />
              </mesh>
              <mesh position-z={0.25 * U}>
                <boxGeometry args={[0.7 * U, 6.7 * U, 0.2 * U]} />
                <meshStandardMaterial color="#E9862E" roughness={0.6} emissive="#5a2a08" emissiveIntensity={0.4} />
              </mesh>
              <mesh position-z={0.45 * U} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[1.5 * U, 1.5 * U, 0.4 * U, 20]} />
                <meshStandardMaterial color="#c8322a" roughness={0.45} emissive="#4a0a06" emissiveIntensity={0.5} />
              </mesh>
            </group>
          )}
          {/* the pumpkin pail on the left arm, the wand in the right */}
          <group position={[-9.8 * U, bodyY - 6.5 * U, 1 * U]}>
            <Pumpkin position={[0, 0, 0]} scale={2.8 * U} lit={pose.pailLit} f={f} seed={9} grin="small" light={false} rotation={0.4} />
            <mesh geometry={geo.handle} position-y={4.6 * U}>
              <meshStandardMaterial color="#2a2420" roughness={0.6} metalness={0.5} />
            </mesh>
            {pose.pailLit > 0 && <pointLight color="#ff9a3c" intensity={1.6 * pose.pailLit} distance={1.6} decay={2} position={[0, 2.5 * U, 3 * U]} />}
          </group>
          <group position={[8.5 * U, bodyY - 0.5 * U, 1.5 * U]} rotation={[pose.wand * -1.1, 0, -0.5 + pose.wand * 0.6]}>
            <mesh geometry={geo.wand} position-y={4.5 * U}>
              <meshStandardMaterial color="#1A1210" roughness={1} />
            </mesh>
            <mesh geometry={geo.ember} position-y={9.2 * U}>
              <meshBasicMaterial color={[4, 1.6, 0.4]} toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
