/**
 * Every object of the Register Desk at a state (one component per role, objects/*.tsx).
 */
import type { DeskState } from '../state.ts';
import { BugBay, DocsBay, TestsBay } from './Bay.tsx';
import { Feeders, Gate } from './Intake.tsx';
import { Cargo, Chute, Cords } from './Links.tsx';
import { Register } from './Register.tsx';
import { YourDesk } from './YourDesk.tsx';

export function World({ s }: { s: DeskState }) {
  return (
    <>
      <Register s={s} />
      <BugBay s={s} />
      <TestsBay s={s} />
      <DocsBay s={s} />
      <YourDesk s={s} />
      <Feeders s={s} />
      <Gate s={s} />
      <Chute />
      <Cords s={s} />
      <Cargo s={s} />
    </>
  );
}
