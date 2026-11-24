/** The record act: a placeholder holding a real still until the act is built. */
import { show, type View } from '../captures.ts';
import { SHADOW } from '../look.ts';
import { titles, type ActModule } from './common.ts';

const HOLD: View | null = { key: 'webDiff', rect: [430, 180, 760, 400], centre: [1180, 680], k: 1.6 };

export const record: ActModule = {
  needs: () => (HOLD ? [HOLD.key] : []),
  draw(f, c) {
    if (HOLD) show(c.d, c.tex, HOLD, { radius: 14, shadow: SHADOW });
    titles(f, c.d, 'record');
  },
};
