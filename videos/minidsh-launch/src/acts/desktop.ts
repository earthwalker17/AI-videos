/** The desktop act: a placeholder holding a real still until the act is built. */
import { show, type View } from '../captures.ts';
import { SHADOW } from '../look.ts';
import { titles, type ActModule } from './common.ts';

const HOLD: View | null = { key: 'deskReadyWindow', rect: [0, 0, 1266, 753], centre: [1180, 640], k: 1.0 };

export const desktop: ActModule = {
  needs: () => (HOLD ? [HOLD.key] : []),
  draw(f, c) {
    if (HOLD) show(c.d, c.tex, HOLD, { radius: 14, shadow: SHADOW });
    titles(f, c.d, 'desktop');
  },
};
