/**
 * Section 4, fourth answer: the Router's context is a cache; the rest waits behind IDs.
 *
 * Not staged yet: it draws the resting stack.
 */
import { SECTIONS, at } from '../cues.ts';
import { rest } from './lift.ts';
import type { Section } from './section.ts';
import { LEVEL, plan } from './world.ts';

export const cache: Section = {
  from: SECTIONS.cache,
  to: SECTIONS.evidence,
  keys: [[at(55, 3), plan(LEVEL.router, 0, -150, 1.0)]],
  draw(d, f) {
    rest(d, f);
  },
};
