/**
 * The command contract. Each command lives in commands/<name>.ts and is listed in
 * commands/index.ts; `aiv --help` is generated from these fields.
 */
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { EXIT, ExitError } from '@aiv/core';

export interface Command {
  name: string;
  /** one line for `aiv --help` */
  summary: string;
  /** full usage text for `aiv <name> --help` */
  usage: string;
  /** returns the exit code (protocol: 0 ok, 1 error/failed, 2 refused, 3 low memory, 64 usage, 75 again) */
  run(argv: string[]): Promise<number>;
}

type Options = NonNullable<ParseArgsConfig['options']>;

/** node:util parseArgs, strict, with usage errors mapped to exit 64. */
export function parse<O extends Options>(argv: string[], options: O, usage: string) {
  try {
    return parseArgs({ args: argv, options, allowPositionals: true, strict: true });
  } catch (e) {
    throw new ExitError(EXIT.USAGE, `${(e as Error).message}\n\n${usage}`);
  }
}

/** A positive integer flag value, or a usage error. */
export function intFlag(v: string | undefined, name: string, usage: string): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new ExitError(EXIT.USAGE, `--${name} takes a whole number (got '${v}')\n\n${usage}`);
  return n;
}

export function usageError(message: string, usage: string): never {
  throw new ExitError(EXIT.USAGE, `${message}\n\n${usage}`);
}
