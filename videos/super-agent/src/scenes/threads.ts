/**
 * Section 4, second answer: follow-ups go straight to the Worker that is subscribed.
 *
 * Not staged yet: it draws the resting stack.
 */
import { SECTIONS, at } from '../cues.ts';
import { rest } from './lift.ts';
import type { Section } from './section.ts';
import { strata } from './world.ts';

export const threads: Section = {
  from: SECTIONS.threads,
  to: SECTIONS.batch,
  keys: [[at(35, 1), strata(1.12, 300)], [at(41, 1), strata(1.12, 300)]],
  draw(d, f) {
    rest(d, f);
  },
};
