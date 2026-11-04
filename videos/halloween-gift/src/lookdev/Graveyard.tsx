/**
 * Lookdev of the graveyard family (world/Graveyard.tsx: the stones, the big cross, the RIP
 * stone; world/Fence.tsx: the fence, the gates, the lamps) in the film's stage (LookStage: sky,
 * terrain, grass, night rig, post), with the trees and the dressing around them. The V1 pumpkin
 * (unlit, no light of its own) and the greybox house and crag (lookdev/Probe.tsx) stand in for
 * their families, context only.
 *
 *  GraveyardHero   the hero view (gates closed)
 *  GraveyardHeroAjar  the hero view with the gates ajar (open 0.35), as the reference's
 *  GraveyardClose  one held close view per frame: 0 the front graves, 1 the big cross, 2 the
 *                  slope and the fence, 3 the broken stone, 4 the obelisk and its neighbours,
 *                  5 the lamps along the lane, 6 the gates from the slope
 *  GraveyardGates  the film's own camera at the gate beat (journeyAt(at(14))), the gates open 0.3
 *  GraveyardRip    the RIP stone and the cauldron's spot from about 1.5 units
 *  GraveyardFence  the hero view dollying slowly, 12 frames (shimmer check with --span)
 *  GraveyardSwing  the gates from above, opening 0 → 1 over frames 0..4 (clearance check)
 */
import { Composition } from 'remotion';
import { at, FPS } from '../cues.ts';
import { CamPath } from '../film/campath.ts';
import { journeyAt } from '../film/journey.ts';
import { Dressing } from '../world/Dressing.tsx';
import { Fence, Gates, Lamps } from '../world/Fence.tsx';
import { Graveyard } from '../world/Graveyard.tsx';
import { FLOOR, GATE_POSTS, LAND, onGround } from '../world/layout.ts';
import { Pumpkin } from '../world/Pumpkin.tsx';
import { Trees } from '../world/Trees.tsx';
import { HERO, LookStage } from './LookStage.tsx';
import { HouseAndCrag } from './Probe.tsx';

const F = FLOOR;

function World({ f, open = 0 }: { f: number; open?: number }) {
  return (
    <>
      <Trees f={f} />
      <Dressing f={f} />
      <Graveyard />
      <Fence />
      <Gates open={open} />
      <Lamps />
      <HouseAndCrag f={0} />
      <Pumpkin position={onGround(LAND.bigPumpkin.x, LAND.bigPumpkin.z, 0.55)} scale={0.62} lit={1} f={f} seed={2} rotation={LAND.bigPumpkin.yaw} light={false} />
    </>
  );
}

function GraveyardHero() {
  return <LookStage>{(f) => <World f={f} />}</LookStage>;
}

/** The hero view with the gates standing ajar (open 0.35), as the reference's. */
function GraveyardHeroAjar() {
  return <LookStage>{(f) => <World f={f} open={0.35} />}</LookStage>;
}

const gx = (GATE_POSTS[0][0] + GATE_POSTS[1][0]) / 2;
const gz = (GATE_POSTS[0][1] + GATE_POSTS[1][1]) / 2;

export const GRAVEYARD_CLOSE = new CamPath([
  // 0: the front graves along the path's first run
  { f: 0, pos: [-0.15, F + 0.75, 3.35], look: [-0.55, F + 0.32, 1.7], fov: 40, focus: 1.8, hold: true },
  // 1: the big cross, from the path beside the pumpkin
  { f: 1, pos: [-1.0, F + 1.0, 5.35], look: [-2.3, F + 0.95, 3.7], fov: 42, focus: 2.1, hold: true },
  // 2: up the slope to the fence
  { f: 2, pos: [-0.2, F + 1.05, 1.5], look: [-0.6, F + 0.75, -0.9], fov: 40, focus: 2.4, hold: true },
  // 3: the broken stone and its fallen top
  { f: 3, pos: [1.6, F + 0.8, 1.85], look: [2.08, F + 0.32, 0.9], fov: 40, focus: 1.1, hold: true },
  // 4: the obelisk and its neighbours
  { f: 4, pos: [-1.35, F + 0.85, 3.0], look: [-2.2, F + 0.55, 1.7], fov: 40, focus: 1.6, hold: true },
  // 5: the lamps along the lane, from the gateway
  { f: 5, pos: [gx - 0.35, F + 1.25, gz + 0.9], look: [2.6, F + 1.05, -1.2], fov: 40, focus: 2.2, hold: true },
  // 6: the gates from the slope below them
  { f: 6, pos: [gx + 0.25, F + 0.95, gz + 2.2], look: [gx, F + 1.25, gz], fov: 40, focus: 2.2, hold: true },
]);

function GraveyardClose() {
  return <LookStage path={GRAVEYARD_CLOSE}>{(f) => <World f={f} />}</LookStage>;
}

/** The film's camera at the gate beat. */
const GATE_BEAT = { at: () => journeyAt(at(14)) };

function GraveyardGates() {
  return <LookStage path={GATE_BEAT}>{(f) => <World f={f} open={0.3} />}</LookStage>;
}

const RIP = LAND.ripStone;
const ry = RIP.yaw ?? 0;
export const RIP_VIEW = new CamPath([
  {
    f: 0,
    pos: [RIP.x + Math.sin(ry) * 1.35 - 0.45, F + 0.85, RIP.z + Math.cos(ry) * 1.35 + 0.2],
    look: [(RIP.x * 2 + LAND.cauldron.x) / 3, F + 0.45, (RIP.z * 2 + LAND.cauldron.z) / 3],
    fov: 40,
    focus: 1.5,
    hold: true,
  },
  { f: 1, pos: [RIP.x + Math.sin(ry) * 1.1, F + 0.6, RIP.z + Math.cos(ry) * 1.1], look: [RIP.x, F + 0.5, RIP.z], fov: 40, focus: 1.1, hold: true },
]);

function GraveyardRip() {
  return <LookStage path={RIP_VIEW}>{(f) => <World f={f} />}</LookStage>;
}

/**
 * The shimmer check: the hero view dollying slowly right (0.12 over 12 frames: about 1.5 px a
 * frame at the fence, where its bars are 3-4 px wide), the thinnest the fence and gates get.
 */
export const FENCE_TRUCK = new CamPath([
  { f: 0, pos: HERO.pos, look: HERO.look, fov: HERO.fov, focus: HERO.focus },
  { f: 11, pos: [HERO.pos[0] + 0.12, HERO.pos[1], HERO.pos[2] - 0.03], look: [HERO.look[0] + 0.12, HERO.look[1], HERO.look[2]], fov: HERO.fov, focus: HERO.focus },
]);

function GraveyardFence() {
  return <LookStage path={FENCE_TRUCK}>{(f) => <World f={f} />}</LookStage>;
}

const SWING_KEY = { pos: [gx + 1.5, F + 1.85, gz + 1.1] as [number, number, number], look: [gx - 0.1, F + 0.55, gz - 0.35] as [number, number, number], fov: 50, focus: 2.2, hold: true };
const SWING_VIEW = new CamPath([
  { f: 0, ...SWING_KEY },
  { f: 4, ...SWING_KEY },
]);

function GraveyardSwing() {
  return <LookStage path={SWING_VIEW}>{(f) => <World f={f} open={f / 4} />}</LookStage>;
}

export function GraveyardRoot() {
  return (
    <>
      <Composition id="GraveyardHero" component={GraveyardHero} width={1920} height={1080} fps={FPS} durationInFrames={24} />
      <Composition id="GraveyardHeroAjar" component={GraveyardHeroAjar} width={1920} height={1080} fps={FPS} durationInFrames={1} />
      <Composition id="GraveyardClose" component={GraveyardClose} width={1920} height={1080} fps={FPS} durationInFrames={7} />
      <Composition id="GraveyardGates" component={GraveyardGates} width={1920} height={1080} fps={FPS} durationInFrames={1} />
      <Composition id="GraveyardRip" component={GraveyardRip} width={1920} height={1080} fps={FPS} durationInFrames={2} />
      <Composition id="GraveyardFence" component={GraveyardFence} width={1920} height={1080} fps={FPS} durationInFrames={12} />
      <Composition id="GraveyardSwing" component={GraveyardSwing} width={1920} height={1080} fps={FPS} durationInFrames={5} />
    </>
  );
}
