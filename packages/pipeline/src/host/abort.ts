// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/gpuLock.ts
/**
 * Cleanups that must run when the process is interrupted (Ctrl+C, console closed, killed by a
 * supervisor): close the browser, kill an encoder tree, release the heavy-job lock. Without
 * them an interrupted render leaves a browser holding RAM and a lock that blocks everyone for
 * two minutes.
 */
const cleanups = new Set<() => unknown>();
let installed = false;
let aborting = false;

/** Register a cleanup for interruption; returns the unregister function. Newest runs first. */
export function onAbort(fn: () => unknown): () => void {
  cleanups.add(fn);
  install();
  return () => {
    cleanups.delete(fn);
  };
}

/** Run every registered cleanup (newest first, capped at 10 s), then exit with `code`. */
export function abortProcess(reason: string, code: number): void {
  if (aborting) return;
  aborting = true;
  console.warn(`[aiv] ${reason}: cleaning up…`);
  const run = async () => {
    for (const fn of [...cleanups].reverse()) {
      try {
        await fn();
      } catch {
        /* keep tearing down */
      }
    }
  };
  // a hung cleanup must not keep the process (and the lock) alive forever
  const cap = new Promise((r) => setTimeout(r, 10_000).unref());
  void Promise.race([run(), cap]).finally(() => process.exit(code));
}

function install(): void {
  if (installed) return;
  installed = true;
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP'] as const) process.on(sig, () => abortProcess(sig, 130));
}
