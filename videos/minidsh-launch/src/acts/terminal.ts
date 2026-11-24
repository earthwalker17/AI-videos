/** The terminal act: a placeholder holding a real still until the act is built. */
import { show, type View } from '../captures.ts';
import { SHADOW } from '../look.ts';
import { titles, type ActModule } from './common.ts';

const HOLD = null as View | null;

export const terminal: ActModule = {
  needs: () => (HOLD ? [HOLD.key] : []),
  draw(f, c) {
    if (HOLD) show(c.d, c.tex, HOLD, { radius: 14, shadow: SHADOW });
    titles(f, c.d, 'terminal');
  },
};
