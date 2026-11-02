/**
 * Small actors and set dressing: tattered tissue ghosts hanging from a branch (cyan eyes that
 * follow the pail), a cauldron bubbling cyan, gauze strips of mist drifting between the sheets,
 * and paper bats on springs. Everything moves on twos from the frame index.
 */
import { rand } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { Color, DoubleSide, LatheGeometry, ShaderMaterial, Vector2, type BufferAttribute } from 'three';
import { twos } from '../film/timeline.ts';
import { NOISE_GLSL } from '../look/glsl.ts';

/** A tattered plum sheet hanging from a thread, swaying; `look` turns its eyes (-1 left .. 1 right). */
export function HangingGhost({ position, f, seed, look = 0, drop = 0 }: { position: [number, number, number]; f: number; seed: number; look?: number; drop?: number }) {
  const { geo, rest } = useMemo(() => {
    const pts: Vector2[] = [];
    const prof: [number, number][] = [
      [0.0, 0.0],
      [0.13, -0.04],
      [0.2, -0.16],
      [0.21, -0.32],
      [0.26, -0.6],
      [0.31, -0.86],
    ];
    for (const [x, y] of prof) pts.push(new Vector2(x, y));
    const geo = new LatheGeometry(pts, 32);
    // a tattered hem: drop alternate wedges of the lowest ring
    const p = geo.attributes.position as BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < -0.8) {
        const a = Math.atan2(p.getZ(i), p.getX(i));
        p.setY(i, p.getY(i) - 0.08 * Math.max(0, Math.sin(a * 7 + seed)) - 0.04 * rand(seed, i, 0));
      }
    }
    geo.computeVertexNormals();
    return { geo, rest: Float32Array.from(p.array as Float32Array) };
  }, [seed]);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  const t = twos(f) / 24;
  const p = geo.attributes.position as BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = rest[i * 3 + 1];
    const w = Math.max(0, -y) ** 1.6;
    p.setX(i, rest[i * 3] + w * 0.05 * Math.sin(2.1 * t + seed + y * 3));
    p.setZ(i, rest[i * 3 + 2] + w * 0.04 * Math.sin(1.7 * t + seed * 2));
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  const [x, y, z] = position;
  return (
    <group position={[x, y - drop, z]} rotation-z={0.06 * Math.sin(1.3 * t + seed)}>
      {/* the thread */}
      <mesh position-y={0.5 + drop / 2}>
        <cylinderGeometry args={[0.004, 0.004, 1 + drop, 4]} />
        <meshBasicMaterial color="#0d1015" />
      </mesh>
      <mesh geometry={geo} castShadow={false}>
        <meshStandardMaterial color="#3a2638" roughness={0.95} side={DoubleSide} transparent opacity={0.92} emissive="#1d1024" emissiveIntensity={0.6} />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * 0.07 + look * 0.03, -0.2, 0.19]} scale={[0.035, 0.05, 0.01]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color={[0.7, 2.4, 2.7]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** An iron cauldron on three legs, a cyan brew glowing and bubbling. */
export function Cauldron({ position, f, scale = 1 }: { position: [number, number, number]; f: number; scale?: number }) {
  const geo = useMemo(() => {
    const pts: Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const a = Math.PI * (0.15 + 0.8 * t);
      pts.push(new Vector2(0.42 * Math.sin(a) + (t > 0.92 ? 0.04 : 0), -0.36 * Math.cos(a)));
    }
    return new LatheGeometry(pts, 28);
  }, []);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  const hold = twos(f);
  return (
    <group position={position} scale={scale}>
      <mesh geometry={geo} position-y={0.46} castShadow>
        <meshStandardMaterial color="#14171a" roughness={0.5} metalness={0.6} side={DoubleSide} />
      </mesh>
      <mesh position-y={0.74} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.36, 28]} />
        <meshBasicMaterial color={[0.35, 1.6, 1.9]} toneMapped={false} />
      </mesh>
      {Array.from({ length: 5 }, (_, k) => {
        const life = ((hold + k * 7) % 18) / 18;
        return (
          <mesh key={k} position={[(rand(9, k, 0) - 0.5) * 0.4, 0.76 + life * 0.08, (rand(9, k, 1) - 0.5) * 0.4]} scale={0.03 + 0.04 * Math.sin(life * Math.PI)}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial color={[0.6, 2.2, 2.4]} toneMapped={false} />
          </mesh>
        );
      })}
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[Math.cos((k * 2 * Math.PI) / 3) * 0.28, 0.08, Math.sin((k * 2 * Math.PI) / 3) * 0.28]}>
          <cylinderGeometry args={[0.03, 0.02, 0.18, 6]} />
          <meshStandardMaterial color="#14171a" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
      <pointLight color="#57CEE2" intensity={1.8} distance={2.5} decay={2} position-y={1.0} />
    </group>
  );
}

/** A strip of gauze mist: soft-edged, drifting fbm, additive and faint. */
export function Gauze({ position, size, f, seed, opacity = 0.35, color = '#7fb8c4' }: { position: [number, number, number]; size: [number, number]; f: number; seed: number; opacity?: number; color?: string }) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uT: { value: 0 }, uSeed: { value: seed }, uOpacity: { value: opacity }, uColor: { value: new Color(color) } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          ${NOISE_GLSL}
          uniform float uT, uSeed, uOpacity; uniform vec3 uColor; varying vec2 vUv;
          void main() {
            vec2 p = vec2(vUv.x * 4.0 + uT * 0.05 + uSeed, vUv.y * 1.5);
            float n = aivFbm(p + aivFbm(p * 1.7 - uT * 0.03));
            float edge = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.45, vUv.y) * smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
            float a = clamp((n - 0.35) * 1.6, 0.0, 1.0) * edge * uOpacity;
            gl_FragColor = vec4(uColor * a, a);
          }
        `,
      }),
    [seed, opacity, color],
  );
  useLayoutEffect(() => () => mat.dispose(), [mat]);
  mat.uniforms.uT.value = twos(f) / 24;
  return (
    <mesh position={position} material={mat} renderOrder={5}>
      <planeGeometry args={size} />
    </mesh>
  );
}

/** A paper bat on a wire spring, bobbing and flapping on twos. */
export function SpringBat({ position, f, seed, scale = 1 }: { position: [number, number, number]; f: number; seed: number; scale?: number }) {
  const t = twos(f) / 24;
  const flap = Math.sin(t * 14 + seed) * 0.7;
  const bob = Math.sin(t * 3 + seed) * 0.08;
  const [x, y, z] = position;
  return (
    <group position={[x, y + bob, z]} scale={scale}>
      <mesh position-y={-0.5 - bob / 2}>
        <cylinderGeometry args={[0.004, 0.004, 1 - bob, 4]} />
        <meshBasicMaterial color="#0d1015" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshStandardMaterial color="#141016" roughness={0.9} />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <group key={s} position={[s * 0.02, 0, 0]} rotation-z={s * flap}>
          <mesh position={[s * 0.13, 0, 0]}>
            <boxGeometry args={[0.24, 0.005, 0.12]} />
            <meshStandardMaterial color="#141016" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
