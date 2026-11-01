/**
 * Exit-code protocol of every aiv command and long job. Agents branch on these, so they are
 * part of the public contract.
 */
export const EXIT = {
  OK: 0,
  /** an error, or checks that failed */
  ERROR: 1,
  /** refused on purpose (e.g. resume against changed inputs, a dirty tree for a release) */
  REFUSED: 2,
  /** not enough free memory to start or continue safely */
  LOW_MEMORY: 3,
  /** bad command line */
  USAGE: 64,
  /** the per-call budget ran out or the machine is busy: run the same command again */
  AGAIN: 75,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/** An Error that carries the exit code a command should end with. */
export class ExitError extends Error {
  readonly exit: ExitCode;
  constructor(exit: ExitCode, message: string) {
    super(message);
    this.name = 'ExitError';
    this.exit = exit;
  }
}

/** The exit code for any thrown value: ExitError's own, otherwise ERROR. */
export const exitOf = (e: unknown): ExitCode => (e instanceof ExitError ? e.exit : EXIT.ERROR);
