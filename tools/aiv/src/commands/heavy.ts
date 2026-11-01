import { runHeavy } from '@aiv/pipeline';
import { intFlag, parse, usageError, type Command } from '../command.ts';

const usage = `usage: aiv heavy <label> [--min-free-mb N] [--no-wait] [--wait-min N] -- <command> [args…]

Runs <command> as a heavy job, one at a time machine-wide: memory guard (without the lock),
then the heavy-job lock, an orphan sweep of this repo's capture browsers, the command, release.
The command is spawned without a shell; its exit code is passed through.

  --min-free-mb N   free RAM the job needs (default: AIV_MIN_FREE_MB, aiv.local.json, 1500)
  --no-wait         do not wait for memory or the lock: exit 75 at once when busy (agents)
  --wait-min N      wait up to N minutes for memory (default 3)

exit: the command's code · 3 low memory · 64 usage · 75 busy (run again later)`;

export const heavy: Command = {
  name: 'heavy',
  summary: 'run a command as a heavy job (memory guard → machine-wide lock → command)',
  usage,
  async run(argv) {
    const sep = argv.indexOf('--');
    if (sep < 0) usageError('missing -- before the command', usage);
    const head = argv.slice(0, sep);
    const [cmd, ...args] = argv.slice(sep + 1);
    if (!cmd) usageError('missing the command after --', usage);
    const { values, positionals } = parse(head, { 'min-free-mb': { type: 'string' }, 'no-wait': { type: 'boolean' }, 'wait-min': { type: 'string' } }, usage);
    if (positionals.length !== 1) usageError('expected exactly one <label>', usage);
    const waitMin = intFlag(values['wait-min'], 'wait-min', usage);
    return runHeavy({
      label: positionals[0],
      cmd,
      args,
      minFreeMB: intFlag(values['min-free-mb'], 'min-free-mb', usage),
      wait: !values['no-wait'],
      memoryWaitMs: waitMin !== undefined ? waitMin * 60_000 : undefined,
    });
  },
};
