/** Lookdev probe (page.ts) with the bloom threshold at 0.8, under the panes' whites: a pane must still not bloom. */
import { MAX_RESIDENT } from '@aiv/web-kit';
import { bootProbe } from './page.ts';

bootProbe({ cap: MAX_RESIDENT, finish: { bloomThreshold: 0.8 } });
