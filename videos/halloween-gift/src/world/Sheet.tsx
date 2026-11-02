/**
 * The neighbour in a homemade bedsheet-ghost costume: a cream sheet over a person, two round
 * eyeholes (only shadow inside: no face, no skin), slippers under the hem, a teal bowl of
 * wrapped candies held in hands that are just bulges in the cloth. Cloth sways on twos. After
 * the seal the sheet sags and is 'ghosted' (teal, the eyeholes glow cyan); it recovers when the
 * door closes. The person is never caricatured; the costume does all the acting.
 */
import { lerp, rand } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { Color, LatheGeometry, SphereGeometry, Vector2, type BufferAttribute } from 'three';
import type { UserPose } from '../film/actors.ts';
import { twos } from '../film/timeline.ts';
import { fibreTexture } from '../look/paper.ts';

const CREAM = new Color('#E6ECDD');
const GHOST = new Color('#5f9ea6');

const PROFILE: [number, number][] = [
  [0.0, 2.3],
  [0.2, 2.25],
  [0.33, 2.08],
  [0.37, 1.88],
  [0.36, 1.66],
  [0.44, 1.3],
  [0.53, 0.75],
  [0.6, 0.25],
  [0.64, 0.02],
];

export function Sheet({ pose, f, bowl = true }: { pose: UserPose; f: number; bowl?: boolean }) {
  const { geo, rest, eye, candy } = useMemo(() => {
    const geo = new LatheGeometry(
      PROFILE.slice()
        .reverse()
        .map(([x, y]) => new Vector2(x, y)),
      48,
    );
    const rest = Float32Array.from((geo.attributes.position as BufferAttribute).array);
    return { geo, rest, eye: new SphereGeometry(0.07, 16, 10), candy: new SphereGeometry(0.06, 10, 8) };
  }, []);
  useLayoutEffect(() => () => (geo.dispose(), eye.dispose(), candy.dispose()), [geo, eye, candy]);
  // cloth: a wavy hem and a slow sway, posed on twos; the sag lowers and widens it
  const t = twos(f) / 24;
  const pos = geo.attributes.position as BufferAttribute;
  const sag = 1 - pose.stand;
  for (let i = 0; i < pos.count; i++) {
    const x = rest[i * 3];
    const y = rest[i * 3 + 1];
    const z = rest[i * 3 + 2];
    const a = Math.atan2(z, x);
    const low = Math.max(0, 1 - y / 1.2);
    const hem = y < 0.2 ? 0.035 * Math.sin(8 * a + 1.3) : 0;
    const sway = low * low * 0.03 * Math.sin(2.2 * t + a * 2);
    const widen = 1 + low * sag * 0.45;
    pos.setXYZ(i, x * widen + sway, y + hem, z * widen);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const color = CREAM.clone().lerp(GHOST, pose.ghosted);
  const eyeGlow = pose.ghosted;
  const [px, py, pz] = pose.pos;
  return (
    <group position={[px, py + pose.hop, pz]} scale={[1, pose.stand, 1]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.92} bumpMap={fibreTexture()} bumpScale={0.25} emissive="#0f3a40" emissiveIntensity={0.6 * pose.ghosted} />
      </mesh>
      {/* eyeholes: shadow only; ghosted, they glow cyan */}
      {([-1, 1] as const).map((s) => (
        <mesh key={s} geometry={eye} position={[s * 0.12, 1.92, 0.33]} scale={[1, 1.25 - 0.9 * Math.max(0, sag - 0.1), 0.35]}>
          <meshStandardMaterial color="#050608" emissive="#57CEE2" emissiveIntensity={3 * eyeGlow} roughness={1} />
        </mesh>
      ))}
      {/* slippers */}
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * 0.16, 0.04, 0.5]} scale={[0.1, 0.05, 0.18]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#6d7378" roughness={1} />
        </mesh>
      ))}
      {bowl && (
        <group position={[0, lerp(1.2, 0.85, sag), 0.55]} rotation-x={sag * 0.6}>
          <mesh scale={[0.32, 0.14, 0.32]} position-y={-0.05}>
            <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color="#2f7f86" roughness={0.35} side={2} />
          </mesh>
          {Array.from({ length: 9 }, (_, k) => (
            <mesh key={k} geometry={candy} position={[(rand(5, k, 0) - 0.5) * 0.36, 0.0 + rand(5, k, 1) * 0.05, (rand(5, k, 2) - 0.5) * 0.36]} scale={[1.4, 0.8, 0.8]}>
              <meshStandardMaterial color={['#c8322a', '#e9862e', '#dce6b7', '#7a4fa0'][k % 4]} roughness={0.4} />
            </mesh>
          ))}
          {/* hands: bulges in the sheet either side of the bowl */}
          {([-1, 1] as const).map((s) => (
            <mesh key={s} position={[s * 0.33, -0.02, 0]} scale={[0.1, 0.09, 0.12]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color={color} roughness={0.92} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
