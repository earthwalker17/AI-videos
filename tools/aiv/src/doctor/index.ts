// The doctor's sections, in print order. Engines register theirs here (one import + one entry),
// e.g. the web engine's browser / GPU-path section.
import { CORE_SECTIONS } from './core.ts';
import type { DoctorSection } from './types.ts';
import { webSection } from './web.ts';

export const SECTIONS: DoctorSection[] = [...CORE_SECTIONS, webSection];

export type { DoctorItem, DoctorSection, DoctorStatus, DoctorContext } from './types.ts';
