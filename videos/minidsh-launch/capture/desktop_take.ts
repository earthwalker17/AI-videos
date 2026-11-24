// SPDX-License-Identifier: MIT
/**
 * The desktop take for the MiniDSH launch film, on Windows, with the official installed app:
 *
 *   A. first start (an empty data folder): the Welcome page;
 *   B. a seeded folder: the window ready, the model picker, then a task, quit MID-TURN through the
 *      window (the native "Quit MiniDSH? Work is running…" box, answered Quit), and "Stopping…";
 *   C. the app started again: the session is still there, and opens.
 *
 * Stills: the web content at 3x pixel density over CDP, and the window itself (native frame, menu
 * bar, dialogs) with PrintWindow through MiniDSH's own Capture-Window.ps1. The app is driven with
 * MiniDSH's own DesktopApp (src/test-support/desktop-app.ts, read from $MINIDSH, never written),
 * over the debugging pipe only this process holds, on a home and data folders of its own.
 *
 *   MINIDSH=<checkout> node videos/minidsh-launch/capture/desktop_take.ts --out .cache/minidsh-launch/takes/desk-1 \
 *        [--exe <MiniDSH.exe>] [--folder C:\code\tinytable] [--home C:\code\.minidsh] [--data C:\code\.minidsh-desktop] \
 *        [--task "<task>"] [--phases A,B,C]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    exe: { type: 'string', default: join(process.env.LOCALAPPDATA ?? '', 'Programs', 'MiniDSH', 'MiniDSH.exe') },
    folder: { type: 'string', default: 'C:\\code\\tinytable' },
    home: { type: 'string', default: 'C:\\code\\.minidsh' },
    data: { type: 'string', default: 'C:\\code\\.minidsh-desktop' },
    task: { type: 'string', default: 'Add a test that negative numbers are aligned to the right too, then run the tests.' },
    phases: { type: 'string', default: 'A,B,C' },
    'quit-after-ms': { type: 'string', default: '4000' },
  },
});
const MINIDSH = process.env.MINIDSH;
if (!MINIDSH || !values.out) {
  console.error('usage: MINIDSH=<checkout> node desktop_take.ts --out <dir> [--exe …] [--phases A,B,C]');
  process.exit(64);
}
if (!existsSync(values.exe!)) {
  console.error(`no MiniDSH.exe at ${values.exe}: install the official v2.0.0 first, or pass --exe`);
  process.exit(2);
}
const from = (p: string) => import(pathToFileURL(join(MINIDSH, p)).href);
const { DesktopApp, answerNativeDialog } = await from('src/test-support/desktop-app.ts');
const { APPROVAL_ARMED } = await from('src/test-support/web-ui.ts');
const CAPTURE_WINDOW = join(MINIDSH, 'scripts', 'shots', 'Capture-Window.ps1');

type Page = {
  evaluate<T>(e: string): Promise<T>;
  waitFor(p: string, ms?: number): Promise<void>;
  click(s: string): Promise<void>;
  type(s: string, t: string): Promise<void>;
  press(k: string): Promise<void>;
  setViewport(w: number, h: number, s?: number): Promise<void>;
  screenshot(p: string): Promise<void>;
};
const out = resolve(values.out);
mkdirSync(out, { recursive: true });
const phases = new Set(values.phases!.split(','));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const notes: Record<string, unknown> = {};
const SHOWN = `document.querySelector('#hero').hidden && document.querySelector('#log').children.length > 0`;
const WORKING = `!document.querySelector('#working').hidden`;
const DROP = ['DEEPSEEK_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'MINIDSH_MODEL'];

function windowShot(name: string, target: { pid?: number; title?: string }): void {
  const args = ['-NoLogo', '-NoProfile', '-File', CAPTURE_WINDOW, '-Out', join(out, `${name}.png`)];
  if (target.title) args.push('-Title', target.title);
  else args.push('-ProcessId', String(target.pid));
  const r = spawnSync('pwsh', args, { encoding: 'utf8', timeout: 60_000 });
  console.log(r.status === 0 ? `${name} (window)` : `${name}: window capture failed: ${(r.stderr || r.stdout).slice(0, 300)}`);
}
async function settle(page: Page, ms = 450): Promise<void> {
  await pause(ms);
  await page.evaluate('document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))');
}
/** The page's content at three times its pixels, then back to the window's own density. */
async function contentShot(page: Page, name: string): Promise<void> {
  const [w, h] = JSON.parse(await page.evaluate<string>('JSON.stringify([innerWidth, innerHeight])')) as [number, number];
  await page.setViewport(w, h, 3);
  await settle(page, 300);
  await page.screenshot(join(out, `${name}.png`));
  await page.setViewport(w, h, 1);
  notes[name] = { css: [w, h] };
  console.log(`${name} (content ${w}x${h} @3x)`);
}
function seed(data: string, folders: string[]): void {
  rmSync(data, { recursive: true, force: true });
  mkdirSync(data, { recursive: true });
  // a 16:9-friendly window, placed where the whole frame is on screen
  writeFileSync(join(data, 'settings.json'), `${JSON.stringify({ version: 1, folders, window: { x: 120, y: 60, width: 1280, height: 760, maximized: false } })}\n`);
}
async function closeIdle(app: InstanceType<typeof DesktopApp>): Promise<void> {
  try {
    app.closeWindow();
    await app.waitForExit(30_000);
  } catch {
    app.child.kill('SIGKILL');
  }
}

mkdirSync(resolve(values.home!), { recursive: true });

if (phases.has('A')) {
  // A first start: no folders yet, so the shell shows its Welcome page.
  const data = `${resolve(values.data!)}-welcome`;
  rmSync(data, { recursive: true, force: true });
  mkdirSync(data, { recursive: true });
  const app = new DesktopApp({ exe: values.exe, userData: data, home: resolve(values.home!), drop: DROP });
  try {
    const shell = (await app.page('minidsh-shell:', 120_000)) as Page;
    await shell.waitFor(`document.body.innerText.includes('Welcome to MiniDSH')`, 60_000);
    await settle(shell, 800);
    await contentShot(shell, 'd01-welcome');
    windowShot('d01-welcome-window', { pid: app.pid });
  } finally {
    await closeIdle(app);
  }
}

if (phases.has('B')) {
  const data = resolve(values.data!);
  seed(data, [resolve(values.folder!)]);
  const app = new DesktopApp({ exe: values.exe, userData: data, home: resolve(values.home!), drop: DROP });
  let exited = false;
  try {
    const page = (await app.page('http://127.0.0.1', 120_000)) as Page;
    await page.waitFor(`document.querySelector('#hero')?.textContent.includes('works in') && document.querySelector('#prompt') !== null && !document.querySelector('#prompt').disabled`, 120_000);
    await settle(page, 800);
    windowShot('d02-ready-window', { pid: app.pid });
    await contentShot(page, 'd02-ready');

    // The model picker: providers and their models, the reasoning effort.
    const opened = await page.evaluate<boolean>(`(() => { const b = [...document.querySelectorAll('button')].find((b) => /DeepSeek-V4/.test(b.textContent)); if (!b) return false; b.setAttribute('data-shot', 'model'); return true })()`);
    if (opened) {
      await page.click('button[data-shot="model"]');
      await settle(page, 500);
      await contentShot(page, 'd03-models');
      windowShot('d03-models-window', { pid: app.pid });
      await page.press('Escape');
      await settle(page, 300);
    }

    // The task, then a quit while the turn is running.
    await page.type('#prompt', values.task!);
    await settle(page, 200);
    await contentShot(page, 'd04-typed');
    for (let presses = 0; presses < 5 && (await page.evaluate<string>(`document.querySelector('#prompt').value`)) !== ''; presses++) {
      await page.evaluate(`document.querySelector('#prompt').focus()`);
      await page.press('Enter');
      await page.waitFor(`document.querySelector('#prompt').value === ''`, 3_000).catch(() => undefined);
    }
    await page.waitFor(`${SHOWN} && ${WORKING}`, 90_000);
    const started = Date.now();
    let k = 0;
    for (;;) {
      await settle(page, 350);
      await contentShot(page, `d05-run-${String(++k).padStart(2, '0')}`);
      const rows = await page.evaluate<number>(`document.querySelectorAll('#log .process, #log .row, #log button').length`);
      const armed = await page.evaluate<boolean>(`Boolean(${APPROVAL_ARMED})`).catch(() => false);
      const working = await page.evaluate<boolean>(`Boolean(${WORKING})`);
      if (!working && !armed) {
        notes.quitMissed = 'the turn ended before the quit';
        break;
      }
      if (Date.now() - started > Number(values['quit-after-ms']) || armed || rows > 6) break;
    }
    windowShot('d06-before-quit-window', { pid: app.pid });
    app.closeWindow();
    await pause(1200);
    windowShot('d07-quit-dialog', { title: 'MiniDSH' });
    windowShot('d07-quit-window', { pid: app.pid });
    const answered = answerNativeDialog(app.pid, 'Quit', 20_000);
    notes.quitDialog = answered;
    console.log(`quit dialog: ${JSON.stringify(answered)}`);
    try {
      const shell = (await app.page('minidsh-shell:', 5_000)) as Page;
      await shell.waitFor(`document.body.innerText.includes('Stopping')`, 5_000);
      await contentShot(shell, 'd08-stopping');
      windowShot('d08-stopping-window', { pid: app.pid });
    } catch (e) {
      notes.stopping = `not captured: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`;
    }
    await app.waitForExit(60_000);
    exited = true;
  } finally {
    if (!exited) await closeIdle(app);
  }
}

if (phases.has('C')) {
  // Started again: the session the quit interrupted is kept, and opens.
  const data = resolve(values.data!);
  const app = new DesktopApp({ exe: values.exe, userData: data, home: resolve(values.home!), drop: DROP });
  try {
    const page = (await app.page('http://127.0.0.1', 120_000)) as Page;
    await page.waitFor(`document.querySelectorAll('#sessions .session-row').length > 0`, 120_000);
    await settle(page, 800);
    windowShot('d09-reopened-window', { pid: app.pid });
    await contentShot(page, 'd09-reopened');
    await page.click('#sessions .session-row');
    await page.waitFor(SHOWN, 60_000);
    await settle(page, 800);
    await contentShot(page, 'd10-session');
    windowShot('d10-session-window', { pid: app.pid });
  } finally {
    await closeIdle(app);
  }
}
writeFileSync(join(out, 'notes.json'), JSON.stringify(notes, null, 1));
console.log('desktop take done');
