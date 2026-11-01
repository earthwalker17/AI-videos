/**
 * aiv — the AI-videos command line (`pnpm aiv <command>`). Exit codes follow the protocol in
 * @aiv/core EXIT: 0 ok · 1 error/failed checks · 2 refused · 3 low memory · 64 usage · 75 again.
 */
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { EXIT, ExitError } from '@aiv/core';
import type { Command } from './command.ts';
import { COMMANDS } from './commands/index.ts';

function help(): string {
  const w = Math.max(...COMMANDS.map((c) => c.name.length));
  return [
    'usage: aiv <command> [options]   (aiv <command> --help for details)',
    '',
    ...COMMANDS.map((c) => `  ${c.name.padEnd(w)}  ${c.summary}`),
    '',
    'exit codes: 0 ok · 1 error/failed checks · 2 refused · 3 low memory · 64 usage · 75 run again',
  ].join('\n');
}

/** Help flags before a `--` belong to aiv; after it they belong to the wrapped command. */
const wantsHelp = (argv: string[]) => {
  const end = argv.indexOf('--');
  return (end < 0 ? argv : argv.slice(0, end)).some((a) => a === '--help' || a === '-h');
};

export async function main(argv: string[]): Promise<number> {
  const [name, ...rest] = argv;
  if (!name || name === '--help' || name === '-h' || name === 'help') {
    const cmd = name === 'help' ? COMMANDS.find((c) => c.name === rest[0]) : undefined;
    console.log(cmd ? cmd.usage : help());
    return name ? EXIT.OK : EXIT.USAGE;
  }
  const cmd: Command | undefined = COMMANDS.find((c) => c.name === name);
  if (!cmd) {
    console.error(`aiv: unknown command '${name}'\n\n${help()}`);
    return EXIT.USAGE;
  }
  if (wantsHelp(rest)) {
    console.log(cmd.usage);
    return EXIT.OK;
  }
  try {
    return await cmd.run(rest);
  } catch (e) {
    if (e instanceof ExitError) {
      console.error(`aiv ${name}: ${e.message}`);
      return e.exit;
    }
    console.error(`aiv ${name}: ${process.env.AIV_DEBUG ? ((e as Error).stack ?? e) : ((e as Error).message ?? e)}`);
    return EXIT.ERROR;
  }
}

// a library import (tests) must not run the CLI
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const code = await main(process.argv.slice(2));
  process.exitCode = code;
  // a stray handle (a helper process, a socket) must not keep a finished command alive
  setTimeout(() => process.exit(code), 3000).unref();
}
