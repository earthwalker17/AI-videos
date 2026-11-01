/**
 * Child processes without a shell. Every tool is spawned with shell:false and an argument
 * array, so paths with spaces and quotes need no manual quoting. The one exception is a
 * Windows batch file (.cmd/.bat, e.g. the pnpm and npx shims): CreateProcess cannot run it, so
 * it goes through `cmd.exe /d /s /c` with arguments escaped for cmd's parser (see cmdLine).
 */
import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { delimiter, extname, isAbsolute, join } from 'node:path';

const WIN = process.platform === 'win32';

/** Resolve a command on PATH (PATHEXT on Windows). Absolute or relative paths are checked as given. */
export function which(cmd: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const exts = WIN ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
  const candidates = (base: string) => (WIN && !extname(base) ? exts.map((e) => base + e) : WIN ? [base, ...exts.map((e) => base + e)] : [base]);
  const isFile = (p: string) => {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  };
  if (isAbsolute(cmd) || cmd.includes('/') || cmd.includes('\\')) return candidates(cmd).find(isFile) ?? null;
  const dirs = (env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean);
  for (const d of dirs) {
    const hit = candidates(join(d, cmd)).find(isFile);
    if (hit) return hit;
  }
  return null;
}

// cmd.exe metacharacters; ^ escapes them outside quotes (the quotes themselves are escaped
// too, so cmd never enters a quoted region and every metacharacter stays escaped). The same
// technique as the cross-spawn package (MIT); proven by the hostile-argument test.
const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

function msvcrtQuote(arg: string): string {
  // backslashes before a quote or the closing quote double, quotes get a backslash
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`;
}

/**
 * The command line for `cmd.exe /d /s /c "<line>"`. A shim that forwards `%*` to another
 * program has its arguments parsed by cmd twice, so they are escaped twice.
 */
export function cmdLine(file: string, args: readonly string[], shim: boolean): string {
  const esc = (s: string) => s.replace(CMD_META, '^$1');
  const argText = args.map((a) => {
    const once = esc(msvcrtQuote(a));
    return shim ? esc(once) : once;
  });
  return [esc(file), ...argText].join(' ');
}

const isBatch = (file: string) => WIN && /\.(cmd|bat)$/i.test(file);

function forwardsArgs(file: string): boolean {
  try {
    return readFileSync(file, 'utf8').includes('%*');
  } catch {
    return false;
  }
}

export interface Resolved {
  file: string;
  args: string[];
  /** cmd.exe needs the command line passed through untouched */
  windowsVerbatimArguments?: boolean;
}

/** What to actually spawn for cmd + args: the resolved executable, or cmd.exe for a batch file. */
export function resolveSpawn(cmd: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env): Resolved {
  const file = which(cmd, env) ?? cmd;
  if (!isBatch(file)) return { file, args: [...args] };
  const comspec = env.ComSpec ?? env.COMSPEC ?? 'cmd.exe';
  return { file: comspec, args: ['/d', '/s', '/c', `"${cmdLine(file, args, forwardsArgs(file))}"`], windowsVerbatimArguments: true };
}

/** spawn() with shell:false, hidden console windows and batch-file handling. */
export function spawnTool(cmd: string, args: readonly string[], opts: SpawnOptions = {}): ChildProcess {
  const r = resolveSpawn(cmd, args, opts.env ?? process.env);
  return spawn(r.file, r.args, { windowsHide: true, ...opts, shell: false, windowsVerbatimArguments: r.windowsVerbatimArguments });
}

export interface ExecResult {
  code: number;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** bytes written to stdin, then closed */
  input?: string | Uint8Array;
  timeoutMs?: number;
  /** keep at most this many trailing characters of stderr (default 4 Mi) */
  maxStderr?: number;
  signal?: AbortSignal;
}

function collect(proc: ChildProcess, opts: ExecOptions): Promise<{ code: number; signal: NodeJS.Signals | null; out: Buffer; err: string }> {
  const maxErr = opts.maxStderr ?? 4 * 1024 * 1024;
  const out: Buffer[] = [];
  let err = '';
  proc.stdout?.on('data', (d: Buffer) => out.push(d));
  proc.stderr?.on('data', (d: Buffer) => {
    err += d.toString('utf8');
    if (err.length > maxErr) err = err.slice(-maxErr);
  });
  if (opts.input !== undefined) proc.stdin?.end(opts.input);
  else proc.stdin?.end();
  proc.stdin?.on('error', () => {
    /* the child may exit before reading its input; its exit code tells */
  });
  let timer: NodeJS.Timeout | undefined;
  if (opts.timeoutMs) timer = setTimeout(() => killTree(proc.pid), opts.timeoutMs);
  return new Promise((resolve, reject) => {
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? (signal ? 1 : 0), signal, out: Buffer.concat(out), err });
    });
  });
}

/** Run a tool to completion and collect its output (stdout as UTF-8). Never throws on a non-zero exit. */
export async function exec(cmd: string, args: readonly string[], opts: ExecOptions = {}): Promise<ExecResult> {
  const p = spawnTool(cmd, args, { cwd: opts.cwd, env: opts.env, signal: opts.signal, stdio: ['pipe', 'pipe', 'pipe'] });
  const r = await collect(p, opts);
  return { code: r.code, signal: r.signal, stdout: r.out.toString('utf8'), stderr: r.err };
}

/** Like exec, with stdout as raw bytes (decoded frames). */
export async function execBuffer(cmd: string, args: readonly string[], opts: ExecOptions = {}): Promise<{ code: number; stdout: Buffer; stderr: string }> {
  const p = spawnTool(cmd, args, { cwd: opts.cwd, env: opts.env, signal: opts.signal, stdio: ['pipe', 'pipe', 'pipe'] });
  const r = await collect(p, opts);
  return { code: r.code, stdout: r.out, stderr: r.err };
}

/**
 * Kill a process and all its descendants. Windows does not kill children with their parent,
 * so a killed wrapper (cmd.exe, a node script) would leave its tool running: taskkill /T.
 */
export function killTree(pid: number | undefined): void {
  if (!pid) return;
  if (WIN) {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    // a detached child leads its own process group: kill the group
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
}

/** Whether a pid is alive (EPERM = alive but not ours). */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** A short PowerShell query (Windows), stdout trimmed; null when it fails. */
export async function powershell(script: string, opts: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}): Promise<string | null> {
  if (!WIN) return null;
  try {
    const r = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeoutMs: opts.timeoutMs ?? 30_000, env: opts.env });
    return r.code === 0 ? r.stdout.trim() : null;
  } catch {
    return null;
  }
}
