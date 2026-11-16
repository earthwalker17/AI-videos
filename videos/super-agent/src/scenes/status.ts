/**
 * Section 6, status: what is proposed (dashed) and what is open (a gap).
 *
 * Not staged yet: it draws the resting stack.
 */
import { SECTIONS, at } from '../cues.ts';
import { rest } from './lift.ts';
import type { Section } from './section.ts';
import { strata } from './world.ts';

export const status: Section = {
  from: SECTIONS.status,
  to: SECTIONS.close,
  keys: [[at(70, 3), strata()]],
  draw(d, f) {
    rest(d, f);
  },
};
