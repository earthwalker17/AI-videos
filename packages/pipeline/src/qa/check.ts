import type { QaCheck } from '@aiv/core';

/** One QA check record. Informational checks (`info`) are reported but never fail the report. */
export const check = (id: string, passed: boolean, detail: string, value?: unknown, info = false): QaCheck => ({ id, passed, detail, ...(value !== undefined ? { value } : {}), ...(info ? { info: true } : {}) });
