/**
 * A tiny tagged logger: info to stdout (stderr with `infoToStderr`, when stdout carries JSON),
 * warnings and errors to stderr. AIV_QUIET=1 hides info.
 */
export interface Log {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  child(tag: string): Log;
}

export function createLog(tag = 'aiv', o: { infoToStderr?: boolean } = {}): Log {
  const quiet = process.env.AIV_QUIET === '1';
  return {
    info: (m) => {
      if (!quiet) (o.infoToStderr ? console.error : console.log)(`[${tag}] ${m}`);
    },
    warn: (m) => console.warn(`[${tag}] WARNING: ${m}`),
    error: (m) => console.error(`[${tag}] ${m}`),
    child: (t) => createLog(`${tag}:${t}`, o),
  };
}

/** Swallows everything (tests); collects lines when given an array. */
export function silentLog(lines?: string[]): Log {
  const push = (m: string) => lines?.push(m);
  return { info: push, warn: push, error: push, child: () => silentLog(lines) };
}
