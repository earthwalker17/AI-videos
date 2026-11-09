/**
 * Every object of the Register Desk at a state (one component per role, objects/*.tsx). From the turn's end (f1661,
 * desk/film.ts) it also carries beat 4 over from the turn: the old heap and the request rising out of it, the notes
 * loop's riders on the reel until they are wound in, the request's dispatch ride, the hatches in the slate, and the
 * counterfactual cards (desk/beat4.ts).
 */
import { useMemo } from 'react';
import { CARD_SPOT, RIDE, cardPose } from '../beat4.ts';
import type { DeskState } from '../state.ts';
import { TURN_SPAN, heldActOne } from '../turn.ts';
import { BugBay, DocsBay, FreshBay, RequestCarrier, TestsBay } from './Bay.tsx';
import { Cache } from './Cache.tsx';
import { Counterfactual, GhostBacklog, SplitPieces, useGhostFace, useSplitFace } from './Counterfactual.tsx';
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

/** Beat 4's two counterfactual cards (4.3 the split, 4.4 the ghost Router). */
function Cards({ s }: { s: DeskState }) {
  const { split, ghost } = s.b4.cards;
  const splitFace = useSplitFace(CARD_SPOT.w, CARD_SPOT.h);
  const ghostFace = useGhostFace(CARD_SPOT.w, CARD_SPOT.h);
  return (
    <>
      {split && (
        <Counterfactual pose={cardPose(split)} w={CARD_SPOT.w} h={CARD_SPOT.h} face={splitFace} strike={split.strike}>
          <SplitPieces play={split.play} h={CARD_SPOT.h} />
        </Counterfactual>
      )}
      {ghost && (
        <Counterfactual pose={cardPose(ghost)} w={CARD_SPOT.w} h={CARD_SPOT.h} face={ghostFace} strike={ghost.strike}>
          <GhostBacklog play={ghost.play} w={CARD_SPOT.w} h={CARD_SPOT.h} />
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
      <Chute />
      <Cords s={s} />
      <Cargo s={s} />
      <FreshBay s={s} />
      <Dispatch s={s} />
      <Hatches s={s} />
      {!b4.heap.gone && s.f < RIDE.out && <BeatFourHeap s={s} />}
      {riding && <RequestCarrier pose={riding} />}
      {cards && <Cards s={s} />}
      <Cache s={s} />
      <DeskUniforms s={s} />
    </>
  );
}
