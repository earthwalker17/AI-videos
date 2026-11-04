/**
 * The pop-up sets standing on the book's pages: the valley (the reference painting's view), the
 * graveyard, the lane to the last house; the door spread lives in DoorSet.tsx. Every card rises
 * on its hinge on twos; only the current and the next set are mounted.
 */
import { lerp, progress } from '@aiv/core';
import { at } from '../cues.ts';
import { FLOOR, rise, slideAway, twos, pageTurn, type SetId } from '../film/timeline.ts';
import { drawCastle, drawFarHouse, drawFence, drawGate, drawHills, drawStone, drawTree, drawWitch } from '../look/cutouts.ts';
import { clawdAt } from '../film/actors.ts';
import { Cauldron, Gauze, HangingGhost, SpringBat } from './Props.tsx';
import { Card } from './Card.tsx';
import { DoorSet } from './DoorSet.tsx';
import type { LetterFonts } from './Letter.tsx';
import { Ground, VALLEY_PATH } from './Ground.tsx';
import { Pumpkin } from './Pumpkin.tsx';


function Valley({ f }: { f: number }) {
  const r = (k: number) => rise(f, at(4) + 6 + k * 3) * (1 - pageTurn(f));
  const boil = (seed: number) => ({ f, seed });
  return (
    <group>
      <Ground seed={21} path={VALLEY_PATH} />
      {/* the castle on its floating rock, glowing through (far: aerial perspective) */}
      <Card at={[-0.5, FLOOR + 1.55, -3.55]} size={[4.2, 4.0]} rise={r(0)} backlight={0.0} emissiveIntensity={2.2} draw={(g, w, h, e) => drawCastle(g, e, w, h, 11, '#2c6684', '#9fe8f0')} boil={boil(1)} shadow={false} />
      <Card at={[0, FLOOR, -3.1]} size={[12, 2.4]} rise={r(1)} draw={(g, w, h) => drawHills(g, w, h, 3, '#1f5670')} backlight={0.25} glow="#2f7f96" boil={boil(2)} shadow={false} />
      <Card at={[0, FLOOR, -2.3]} size={[12, 1.8]} rise={r(2)} draw={(g, w, h) => drawHills(g, w, h, 4, '#173d50')} backlight={0.1} glow="#1f5670" boil={boil(3)} />
      <Card at={[-1.6, FLOOR, -1.3]} size={[7.0, 1.15]} rise={r(3)} tilt={0.03} draw={(g, w, h) => drawFence(g, w, h, 5)} boil={boil(4)} />
      <Card at={[-4.5, FLOOR, -0.4]} size={[3.6, 5.2]} rise={r(4)} tilt={-0.06} draw={(g, w, h) => drawTree(g, w, h, 7, { lean: 0.35, eyes: true })} boil={boil(5)} />
      <Card at={[4.7, FLOOR, 0.3]} size={[3.2, 4.6]} rise={r(4)} tilt={0.05} draw={(g, w, h) => drawTree(g, w, h, 8, { lean: -0.3 })} boil={boil(6)} />
      {/* a witch on a broom crosses the moon on a visible wire (paper theatre) */}
      <group position={[lerp(0.6, 4.4, progress(twos(f), at(5), at(8, 3), 'inOutSine')), FLOOR + 4.25 + 0.06 * Math.sin(twos(f) * 0.3), -3.7]} rotation-z={-0.08 + 0.05 * Math.sin(twos(f) * 0.2)}>
        <Card at={[0, 0, 0]} size={[1.0, 0.62]} rise={r(0)} draw={(g, w, h) => drawWitch(g, w, h)} shadow={false} />
        <mesh position-y={2.5}>
          <cylinderGeometry args={[0.005, 0.005, 4.4, 4]} />
          <meshStandardMaterial color="#8a7a50" metalness={0.8} roughness={0.4} />
        </mesh>
      </group>
      <SpringBat position={[1.6, FLOOR + 3.2, -1.6]} f={f} seed={5} scale={0.9} />
      <SpringBat position={[-2.8, FLOOR + 3.6, -2.2]} f={f} seed={6} scale={0.7} />
      <Gauze position={[0, FLOOR + 0.45, -2.0]} size={[11, 1.0]} f={f} seed={2.2} />
      <Gauze position={[0, FLOOR + 0.25, 0.8]} size={[11, 0.7]} f={f} seed={3.4} opacity={0.2} />
      <Pumpkin position={[-2.15, FLOOR, 2.7]} scale={0.95} lit={f >= at(5) ? progress(f, at(5), at(5) + 4) : 0} f={f} seed={2} rotation={0.35} />
      {[
        [1.75, -0.6, 0.26, 3],
        [2.15, -0.75, 0.22, 4],
        [1.95, -0.95, 0.2, 5],
      ].map(([x, z, sc, sd]) => (
        <Pumpkin key={sd} position={[x, FLOOR, z]} scale={sc} lit={f >= at(5) ? 0.8 : 0} f={f} seed={sd} grin="small" light={sd === 3} rotation={-0.2} />
      ))}
    </group>
  );
}

function Graveyard({ f, serif, ready }: { f: number; serif: string; ready: boolean }) {
  const r = (k: number) => rise(f, at(9) + 8 + k * 3) * (1 - slideAway(f));
  const slide = slideAway(f) * 9;
  const boil = (seed: number) => ({ f, seed });
  // the ghosts' eyes follow the pail as Clawd passes (x of Clawd, from the blocking table)
  const cx = clawdAt(f).pos[0];
  const lookAt = (x: number) => Math.max(-1, Math.min(1, (cx - x) / 2));
  const shoo = progress(twos(f), at(11, 2), at(11, 2) + 8, 'outCubic');
  const peek = progress(twos(f), at(10, 3), at(11, 2), 'inOutSine') * (1 - shoo);
  return (
    <group position-x={slide}>
      <Ground seed={22} path={[[0.0, 0.6], [0.3, 0.56], [0.6, 0.6], [1.0, 0.55]]} />
      <Card at={[0, FLOOR, -3.1]} size={[12, 2.2]} rise={r(0)} draw={(g, w, h) => drawHills(g, w, h, 12, '#1f5670')} backlight={0.25} glow="#2f7f96" boil={boil(11)} shadow={false} />
      <Card at={[0, FLOOR, -2.2]} size={[11.6, 1.1]} rise={r(1)} draw={(g, w, h) => drawFence(g, w, h, 13)} boil={boil(12)} />
      <Card at={[-1.7, FLOOR, -1.5]} size={[3.8, 5.4]} rise={r(1)} tilt={-0.04} draw={(g, w, h) => drawTree(g, w, h, 14, { lean: 0.25, eyes: true })} boil={boil(13)} />
      <Card at={[4.8, FLOOR, -1.0]} size={[2.8, 4.2]} rise={r(2)} tilt={0.06} draw={(g, w, h) => drawTree(g, w, h, 15, { lean: -0.35 })} boil={boil(14)} />
      {r(1) > 0.95 &&
        [-0.95, -0.35, 0.25].map((x, i) => <HangingGhost key={x} position={[x, FLOOR + 2.05, -1.25]} f={f} seed={i + 3} look={lookAt(x)} drop={i === 1 ? peek * 0.7 : 0} />)}
      {(
        [
          [-3.6, -0.9, 0.62, 0.9, 'round', -0.12],
          [-2.4, 0.9, 0.55, 0.8, 'cross', 0.1],
          [-0.6, -0.5, 0.5, 0.75, 'obelisk', -0.06],
          [1.15, -0.35, 0.7, 0.95, 'round', 0.08],
          [3.3, 0.85, 0.6, 0.8, 'round', -0.14],
          [4.3, -0.4, 0.5, 0.9, 'cross', 0.12],
        ] as const
      ).map(([x, z, w, h, kind, tilt], i) => (
        <Card key={x} at={[x, FLOOR, z]} size={[w, h]} rise={r(2 + (i % 3))} tilt={tilt} draw={(g, W, H) => drawStone(g, W, H, kind, '#56666f', x === 1.15 ? 'RIP' : undefined, `${Math.round(H * 0.26)}px ${serif}`)} boil={boil(20 + i)} drawKey={x === 1.15 ? ready : undefined} text={x === 1.15} />
      ))}
      {f >= at(9) + 8 && (
        <>
          <Cauldron position={[2.3, FLOOR, -0.5]} f={f} scale={0.8} />
          <SpringBat position={[1.0, FLOOR + 2.6, -1.6]} f={f} seed={1} />
          <SpringBat position={[3.1, FLOOR + 3.0, -2.0]} f={f} seed={2} scale={0.8} />
          <Gauze position={[0, FLOOR + 0.35, -1.7]} size={[11, 0.9]} f={f} seed={1.3} />
          <Gauze position={[0, FLOOR + 0.25, 1.4]} size={[11, 0.7]} f={f} seed={4.1} opacity={0.22} />
        </>
      )}
      {/* foreground stones that wipe past the truck */}
      <Card at={[-2.4, FLOOR, 2.1]} size={[0.38, 0.55]} rise={r(5)} tilt={0.15} draw={(g, W, H) => drawStone(g, W, H, 'round', '#3a454c')} boil={boil(30)} />
      <Card at={[2.3, FLOOR, 2.1]} size={[0.32, 0.6]} rise={r(5)} tilt={-0.1} draw={(g, W, H) => drawStone(g, W, H, 'cross', '#3a454c')} boil={boil(31)} />
    </group>
  );
}

function Lane({ f }: { f: number }) {
  const r = (k: number) => rise(f, at(13) + 4 + k * 3);
  const boil = (seed: number) => ({ f, seed });
  // the gates creak open on bar 14 (an ember flick), on twos, with a little bounce
  const gate = progress(twos(f), at(14), at(14) + 20, 'outCubic') * 1.35;
  return (
    <group>
      <Ground seed={23} path={[[0.5, 1.0], [0.48, 0.75], [0.53, 0.5], [0.5, 0.22]]} />
      <Card at={[0, FLOOR, -3.3]} size={[12, 2.0]} rise={r(0)} draw={(g, w, h) => drawHills(g, w, h, 16, '#1f5670')} backlight={0.25} glow="#2f7f96" boil={boil(40)} shadow={false} />
      <Card at={[0, FLOOR, -2.8]} size={[3.4, 4.6]} rise={r(1)} emissiveIntensity={1.7} draw={(g, w, h, e) => drawFarHouse(g, e, w, h, 17)} boil={boil(41)} />
      <Card at={[-4.3, FLOOR, -1.2]} size={[3.2, 4.6]} rise={r(2)} tilt={-0.05} draw={(g, w, h) => drawTree(g, w, h, 18, { lean: 0.3 })} boil={boil(42)} />
      <Card at={[4.4, FLOOR, -0.9]} size={[3.0, 4.4]} rise={r(2)} tilt={0.05} draw={(g, w, h) => drawTree(g, w, h, 19, { lean: -0.3, eyes: true })} boil={boil(43)} />
      {/* a lantern-lit path: small jack-o'-lanterns either side */}
      {[
        [-0.75, 0.4, 3],
        [0.85, -0.3, 4],
        [-0.7, -1.2, 5],
        [0.7, -1.9, 6],
      ].map(([x, z, sd]) => (
        <Pumpkin key={sd} position={[x, FLOOR, z]} scale={0.22} lit={1} f={f} seed={sd} grin="small" light={sd === 3 || sd === 5} rotation={-x * 0.3} />
      ))}
      {/* the crooked gates, swinging open toward the camera on their hinges */}
      <group position={[-1.3, FLOOR, 2.4]} rotation-y={gate}>
        <Card at={[0.65, 0, 0]} size={[1.3, 2.1]} rise={r(3)} draw={(g, w, h) => drawGate(g, w, h, 50)} />
      </group>
      <group position={[1.3, FLOOR, 2.4]} rotation-y={-gate}>
        <Card at={[-0.65, 0, 0]} size={[1.3, 2.1]} rise={r(3)} draw={(g, w, h) => drawGate(g, w, h, 51, true)} />
      </group>
      <Card at={[-3.6, FLOOR, 2.4]} size={[4.6, 1.2]} rise={r(3)} draw={(g, w, h) => drawFence(g, w, h, 52)} boil={boil(44)} />
      <Card at={[3.6, FLOOR, 2.4]} size={[4.6, 1.2]} rise={r(3)} draw={(g, w, h) => drawFence(g, w, h, 53)} boil={boil(45)} />
      <Gauze position={[0, FLOOR + 0.3, -1.4]} size={[11, 0.9]} f={f} seed={7.2} />
    </group>
  );
}

export function Sets({ f, on, fonts, ready }: { f: number; on: SetId[]; fonts: LetterFonts & { cjk: string }; ready: boolean }) {
  return (
    <>
      {on.includes('valley') && <Valley f={f} />}
      {on.includes('graveyard') && <Graveyard f={f} serif={fonts.serif} ready={ready} />}
      {on.includes('lane') && <Lane f={f} />}
      {on.includes('door') && <DoorSet f={f} fonts={fonts} ready={ready} />}
    </>
  );
}
