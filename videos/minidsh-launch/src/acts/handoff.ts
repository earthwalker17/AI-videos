/** The handoff act: a placeholder holding a real still until the act is built. */
import { show, type View } from '../captures.ts';
import { SHADOW } from '../look.ts';
import { titles, type ActModule } from './common.ts';

const HOLD: View | null = { key: 'webRun1', rect: [0, 0, 1280, 800], centre: [1180, 620], k: 0.9 };

export const handoff: ActModule = {
  needs: () => (HOLD ? [HOLD.key] : []),
  draw(f, c) {
    if (HOLD) show(c.d, c.tex, HOLD, { radius: 14, shadow: SHADOW });
    titles(f, c.d, 'handoff');
  },
};
