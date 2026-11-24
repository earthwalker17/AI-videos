/** Lookdev probe (page.ts) with one resident texture: every change of capture evicts and re-uploads. Frame 4 needs two, so it is refused here. */
import { bootProbe } from './page.ts';

bootProbe({ cap: 1 });
