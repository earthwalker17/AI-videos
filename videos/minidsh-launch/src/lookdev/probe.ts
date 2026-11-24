/** Lookdev probe: UI captures as panes (page.ts), with the kit's default residency cap. */
import { MAX_RESIDENT } from '@aiv/web-kit';
import { bootProbe } from './page.ts';

bootProbe({ cap: MAX_RESIDENT });
