/**
 * Section 7, the close: one coral touch signs a result off; the title question returns; the end card.
 *
 * Not staged yet: it draws the resting stack.
 */
import { FILM_FRAMES, SECTIONS, at } from '../cues.ts';
import { rest, YOU_HOME } from './lift.ts';
import type { Section } from './section.ts';
import { LEVEL, plan, strata } from './world.ts';

export const close: Section = {
  from: SECTIONS.close,
  to: FILM_FRAMES,
  keys: [[at(72, 1), plan(LEVEL.you, YOU_HOME[0] + 520, 0, 1.0)], [at(75, 1), plan(LEVEL.you, YOU_HOME[0] + 520, 0, 1.0)], [at(76, 1), strata(1.26)], [FILM_FRAMES, strata(1.3)]],
  draw(d, f) {
    rest(d, f);
  },
};
