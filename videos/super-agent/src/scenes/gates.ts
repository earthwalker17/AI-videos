/**
 * Section 4, the question and its first answer: "One Router for all this?", then the two gates.
 *
 * Not staged yet: it draws the resting stack.
 */
import { SECTIONS, at } from '../cues.ts';
import { rest } from './lift.ts';
import type { Section } from './section.ts';
import { LEVEL, plan, strata } from './world.ts';

export const gates: Section = {
  from: SECTIONS.spine,
  to: SECTIONS.threads,
  keys: [[at(25, 2), strata()], [at(27, 1), strata()], [at(28, 1), plan(LEVEL.world, 0, -120, 1.0)], [at(33, 3), plan(LEVEL.world, 0, -120, 1.0)]],
  draw(d, f) {
    rest(d, f);
  },
};
