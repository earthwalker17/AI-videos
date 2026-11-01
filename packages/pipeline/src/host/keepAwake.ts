// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/host.ts
/**
 * Keep the machine from idle-sleeping while a long job runs, without changing power settings:
 * a helper process holds the request and dies with us, so it never outlives the job. The
 * display may still turn off; closing a laptop lid still sleeps.
 *  - win32: hidden PowerShell holding SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)
 *    until its stdin closes
 *  - darwin: caffeinate -i -w <our pid>
 *  - linux: systemd-inhibit around a `cat` that ends when its stdin closes (when available)
 * Returns release(); a no-op when no backend is available.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import type { Log } from '../util/log.ts';
import { which } from '../util/proc.ts';

// 2147483649 = ES_CONTINUOUS | ES_SYSTEM_REQUIRED in decimal: PowerShell reads 0x80000001 as a
// negative Int32, which the uint parameter rejects
const WIN_SCRIPT =
  "Add-Type -Namespace Aiv -Name Power -MemberDefinition '[DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint f);'; " +
  'if ([Aiv.Power]::SetThreadExecutionState(2147483649) -eq 0) { [Console]::Error.WriteLine("SetThreadExecutionState failed") }; [void][Console]::In.ReadToEnd()';

export function keepAwake(log?: Log): () => void {
  let p: ChildProcess | null = null;
  try {
    if (process.platform === 'win32') {
      p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WIN_SCRIPT], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    } else if (process.platform === 'darwin') {
      p = spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: ['pipe', 'ignore', 'pipe'] });
    } else if (which('systemd-inhibit')) {
      p = spawn('systemd-inhibit', ['--what=idle:sleep', '--who=aiv', '--why=render in progress', '--mode=block', 'cat'], { stdio: ['pipe', 'ignore', 'pipe'] });
    }
  } catch {
    p = null;
  }
  if (!p) return () => {};
  const proc = p;
  let warned = false;
  proc.stderr?.on('data', (d: Buffer) => {
    if (!warned) log?.warn(`keep-awake helper: ${d.toString().trim().split('\n')[0]}`);
    warned = true;
  });
  proc.on('error', () => {});
  proc.stdin?.on('error', () => {});
  // the helper must never keep this process alive; when we exit its stdin closes and it ends
  proc.unref();
  for (const s of [proc.stdin, proc.stderr]) (s as unknown as { unref?: () => void } | null)?.unref?.();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    proc.stdin?.end();
    if (process.platform === 'darwin') proc.kill();
    else setTimeout(() => proc.kill(), 5000).unref();
  };
}
