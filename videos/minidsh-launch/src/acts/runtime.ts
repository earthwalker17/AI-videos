/** The runtime act (bars 27-34): to be built. */
import { titles, type ActModule } from './common.ts';

export const runtime: ActModule = {
  needs: () => [],
  draw(f, c) {
    titles(f, c.d, 'runtime');
  },
};
