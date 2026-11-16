/**
 * Section 4, third answer: arrivals wait for the running call to end, then enter together.
 *
 * Not staged yet: it draws the resting stack.
 */
import { SECTIONS, at } from '../cues.ts';
import { rest } from './lift.ts';
import type { Section } from './section.ts';
import { LEVEL, plan } from './world.ts';

export const batch: Section = {
  from: SECTIONS.batch,
  to: SECTIONS.cache,
  keys: [[at(42, 1), plan(LEVEL.router, 0, -150, 1.0)]],
  draw(d, f) {
    rest(d, f);
  },
};
