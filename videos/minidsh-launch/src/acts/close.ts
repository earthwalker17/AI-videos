/** The close act (bars 35-42): to be built. */
import { titles, type ActModule } from './common.ts';

export const close: ActModule = {
  needs: () => [],
  draw(f, c) {
    titles(f, c.d, 'close');
  },
};
