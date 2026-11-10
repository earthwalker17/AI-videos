/**
 * Every object of the Register Desk at a state (one component per role, objects/*.tsx). From the turn's end (f1661,
 * desk/film.ts) it also carries beat 4 over from the turn: the old heap (pressed flat into the slate as history once the
 * request is in) and the request riding out of it, the notes loop's riders on the reel until they are wound in, the
 * request's dispatch ride, the bays' lids and hatches, the tests and docs carriers, and the counterfactual cards
 * (desk/beat4.ts).
 */
import { useMemo } from 'react';
import { CARD_SPOT, RIDE, cardPose } from '../beat4.ts';
import type { DeskState } from '../state.ts';
import { TURN_SPAN, heldActOne } from '../turn.ts';
import { BugBay, DocsBay, FreshBay, RequestCarrier, TestsBay } from './Bay.tsx';
import { Cache } from './Cache.tsx';
import { Counterfactual, GhostPlay, SplitPlay } from './Counterfactual.tsx';
import { DeskUniforms, Dispatch, Hatches } from './Dispatch.tsx';
import { Feeders, Gate } from './Intake.tsx';
import { Cargo, Chute, Cords } from './Links.tsx';
import { Register } from './Register.tsx';
import { Backlog, ReelRiders } from './Turn.tsx';
import { YourDesk } from './YourDesk.tsx';

/** The old heap and the request rising out of it (act one's state as the turn holds it). */
function BeatFourHeap({ s }: { s: DeskState }) {
  const a = useMemo(() => heldActOne(TURN_SPAN[1]), []);
  return <Backlog a={a} heap={s.b4.heap} request={s.b4.request} f={s.f} />;
}

/** Beat 4's two counterfactual cards (4.3 the request torn three ways, 4.4 the Register with a bench bolted on). */
function Cards({ s }: { s: DeskState }) {
  const { split, ghost } = s.b4.cards;
  return (
    <>
      {split && (
        <Counterfactual pose={cardPose(split, 'split')} w={CARD_SPOT.w} h={CARD_SPOT.h} strike={split.strike}>
          <SplitPlay play={split.play} />
        </Counterfactual>
      )}
      {ghost && (
        <Counterfactual pose={cardPose(ghost, 'ghost')} w={CARD_SPOT.w} h={CARD_SPOT.h} strike={ghost.strike}>
          <GhostPlay play={ghost.play} />
        </Counterfactual>
      )}
    </>
  );
}

export function World({ s }: { s: DeskState }) {
  const b4 = s.b4;
  const riding = b4.request.pose && s.f >= RIDE.out ? b4.request.pose : null;
  const cards = b4.cards.split !== null || b4.cards.ghost !== null;
  return (
    <>
      <Register s={s} />
      {b4.riders && <ReelRiders angle={b4.reel} sink={b4.riders.sink} />}
      <BugBay s={s} />
      <TestsBay s={s} />
      <DocsBay s={s} />
      <YourDesk s={s} />
      <Feeders s={s} />
      <Gate s={s} />
      <Chute s={s} />
      <Cords s={s} />
      <Cargo s={s} />
      <FreshBay s={s} />
      <Dispatch s={s} />
      <Hatches s={s} />
      <BeatFourHeap s={s} />
      {riding && <RequestCarrier pose={riding} />}
      {cards && <Cards s={s} />}
      <Cache s={s} />
      <DeskUniforms s={s} />
    </>
  );
}
