import { acquireHeavy, createLog } from '@aiv/pipeline';

/**
 * Run in-process heavy work (an encode, a full decode) under the machine-wide slot. Returns the
 * protocol code when the slot is not available (75 busy, 3 low memory).
 */
export async function withHeavySlot(label: string, wait: boolean, fn: () => Promise<number>): Promise<number> {
  const log = createLog('heavy');
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
