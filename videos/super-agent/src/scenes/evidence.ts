/**
 * Section 5, evidence: the authors' synthetic test, re-plotted without units.
 *
 * Not staged yet: it draws the resting stack.
 */
import { SECTIONS, at } from '../cues.ts';
import { rest } from './lift.ts';
import type { Section } from './section.ts';
import { strata } from './world.ts';

export const evidence: Section = {
  from: SECTIONS.evidence,
  to: SECTIONS.status,
  keys: [[at(56, 3), strata()]],
  draw(d, f) {
    rest(d, f);
  },
};
