import { acquireHeavy, createLog } from '@aiv/pipeline';

/**
 * Run in-process heavy work (an encode, a full decode) under the machine-wide slot. Returns the
 * protocol code when the slot is not available (75 busy, 3 low memory).
 */
export async function withHeavySlot(label: string, wait: boolean, fn: () => Promise<number>, o: { json?: boolean } = {}): Promise<number> {
  // with --json, stdout is the report: lock waits and sweeps go to stderr
  const log = createLog('heavy', { infoToStderr: o.json });
  const slot = await acquireHeavy({ label, wait, log });
  if (!slot.ok) {
    log.error(slot.reason);
    return slot.exit;
  }
  try {
    return await fn();
  } finally {
    slot.release();
  }
}
