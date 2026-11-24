// SPDX-License-Identifier: MIT
/**
 * The web take for the MiniDSH launch film: drives the real web UI of a running `minidsh web`
 * host (the published package, in WSL) through the film's beats and saves stills at three times
 * the pixel density, in both themes where the state is stable, plus the on-screen boxes of every
 * element the film's cursor goes to.
 *
 * It uses MiniDSH's own page driver and browser launcher (src/test-support/web-ui.ts and
 * src/capabilities/tool-browser/launch.ts, read from the checkout named by $MINIDSH, never written),
 * so it clicks and types the way MiniDSH's browser tests and its README pictures do.
 *
 *   MINIDSH=<checkout> node videos/minidsh-launch/capture/web_take.ts --url <link minidsh web printed> \
 *        --out .cache/minidsh-launch/takes/web-1 [--session "second test"] [--follow "<follow-up>"]
 *
 * The link carries a one-time sign-in token: it is read from the command line and never printed.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    out: { type: 'string' },
    session: { type: 'string', default: 'second test' },
    follow: { type: 'string', default: 'Run the tests and write their output to ../reports/tests.txt' },
    width: { type: 'string', default: '1280' },
    height: { type: 'string', default: '800' },
    scale: { type: 'string', default: '3' },
    'wait-ms': { type: 'string', default: '240000' },
  },
});
const MINIDSH = process.env.MINIDSH;
if (!MINIDSH || !values.url || !values.out) {
  console.error('usage: MINIDSH=<checkout> node web_take.ts --url <link> --out <dir> [--session <title part>] [--follow <text>]');
  process.exit(64);
}
const from = (p: string) => import(pathToFileURL(join(MINIDSH, p)).href);
const { launchBrowser } = await from('src/capabilities/tool-browser/launch.ts');
const { testBrowser } = await from('src/test-support/browser-fixture.ts');
const { APPROVAL_ARMED, pageOpener } = await from('src/test-support/web-ui.ts');
if (!testBrowser) throw new Error('no Chrome, Edge or Chromium found (set MINIDSH_TEST_BROWSER)');

const [width, height, scale, waitMs] = [values.width, values.height, values.scale, values['wait-ms']].map(Number) as [number, number, number, number];
const out = resolve(values.out);
mkdirSync(out, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'aiv-minidsh-web-'));

const SHOWN = `document.querySelector('#hero').hidden && document.querySelector('#log').children.length > 0`;
const IDLE = `${SHOWN} && document.querySelector('#working').hidden`;
/** Elements whose boxes the film's cursor and close-ups need, by name (CSS px, viewport). */
const TARGETS: Record<string, string> = {
  sessionRow: '#sessions .session-row[data-shot="1"]',
  editButton: '#log button[data-shot-click="edit"]',
  diff: '#log .diff',
  prompt: '#prompt',
  approval: '#approval',
  allowOnce: '#approval .btn.primary',
  working: '#working',
};
const t0 = Date.now(); // capture tooling, not frame code: wall time only labels the take's stills
const manifest: { name: string; theme: string; t: number; boxes: Record<string, number[] | null> }[] = [];

type Page = {
  evaluate<T>(e: string): Promise<T>;
  waitFor(p: string, ms?: number): Promise<void>;
  click(s: string): Promise<void>;
  type(s: string, t: string): Promise<void>;
  press(k: string): Promise<void>;
  setViewport(w: number, h: number, s?: number): Promise<void>;
  screenshot(p: string): Promise<void>;
  unexpectedProblems(): Promise<{ source: string; level: string; text: string }[]>;
};

async function settle(page: Page, ms = 450): Promise<void> {
  await new Promise((r) => setTimeout(r, ms)); // CSS transitions (120-300 ms) finish before a still
  await page.evaluate('document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))');
}
async function boxes(page: Page): Promise<Record<string, number[] | null>> {
  const json = await page.evaluate<string>(`JSON.stringify(Object.fromEntries(Object.entries(${JSON.stringify(TARGETS)}).map(([k, s]) => { const el = document.querySelector(s); if (!el) return [k, null]; const r = el.getBoundingClientRect(); return [k, [r.x, r.y, r.width, r.height]] })))`);
  return JSON.parse(json);
}
async function shot(page: Page, name: string, themes: string[] = ['light', 'dark']): Promise<void> {
  for (const theme of themes) {
    await page.evaluate(`window.minidshTheme.set(${JSON.stringify(theme)})`);
    await settle(page, 250);
    const file = join(out, `${name}-${theme}.png`);
    await page.screenshot(file);
    manifest.push({ name, theme, t: Date.now() - t0, boxes: await boxes(page) });
    console.log(`${name}-${theme}`);
  }
  await page.evaluate(`window.minidshTheme.set('light')`);
}
/** Clicks the first transcript button whose text matches `pattern` (a RegExp source, case-insensitive). */
async function clickButtonWith(page: Page, pattern: string, mark: string): Promise<void> {
  const i = await page.evaluate<number>(`[...document.querySelectorAll('#log button')].findIndex((b) => new RegExp(${JSON.stringify(pattern)}, 'i').test(b.textContent.replace(/\\s+/g, ' ')))`);
  if (i < 0) {
    const all = await page.evaluate<string[]>(`[...document.querySelectorAll('#log button')].map((b) => b.textContent.trim().replace(/\\s+/g, ' ').slice(0, 80))`);
    throw new Error(`no transcript button matches /${pattern}/: ${all.join(' | ')}`);
  }
  await page.evaluate(`document.querySelectorAll('#log button')[${i}].setAttribute('data-shot-click', ${JSON.stringify(mark)})`);
  await page.click(`#log button[data-shot-click="${mark}"]`);
  await settle(page);
}

const browser = await launchBrowser({ executablePath: testBrowser.path, profileRoot: join(scratch, 'profiles'), headless: true, allowHosts: [], declared: [], window: { width, height } });
let failed: unknown;
try {
  const { openPage } = pageOpener(browser, values.url);
  const page = (await openPage()) as Page;
  await page.setViewport(width, height, scale);
  await page.evaluate(`window.minidshTheme.set('light')`);
  await page.waitFor(`document.querySelectorAll('#sessions .session-row').length > 0`, 30_000);
  await settle(page);
  await shot(page, 'w01-start');

  // The session the terminal started, opened from the sidebar.
  const idx = await page.evaluate<number>(`[...document.querySelectorAll('#sessions .session-row')].findIndex((r) => r.textContent.toLowerCase().includes(${JSON.stringify(values.session!.toLowerCase())}))`);
  if (idx < 0) throw new Error(`no session row contains "${values.session}"`);
  await page.evaluate(`document.querySelectorAll('#sessions .session-row')[${idx}].setAttribute('data-shot', '1')`);
  await shot(page, 'w02-sidebar-hover');
  await page.click('#sessions .session-row[data-shot="1"]');
  await page.waitFor(SHOWN, 30_000);
  await settle(page);
  await shot(page, 'w03-transcript');

  // The edit's card: its diff and the runtime's record.
  const groups = await page.evaluate<string[]>(`[...document.querySelectorAll('#log button')].map((b) => b.textContent.trim().replace(/\\s+/g, ' ').slice(0, 80))`);
  writeFileSync(join(out, 'buttons.txt'), groups.join('\n'));
  // The folded group that holds the edit, then the edit that went through (not a refused one).
  await clickButtonWith(page, 'edited files', 'group');
  await shot(page, 'w04a-group', ['light']);
  await clickButtonWith(page, '^Edit file.*[+][0-9]', 'edit');
  await page.evaluate(`(() => { const el = document.querySelector('#log .diff'); if (el) el.scrollIntoView({ block: 'center' }) })()`);
  await settle(page, 700);
  await shot(page, 'w04-diff');

  // The follow-up, typed in steps, then sent.
  await page.waitFor(`document.querySelector('#prompt') !== null && !document.querySelector('#prompt').disabled`, 30_000);
  const words = values.follow!.split(' ');
  const steps = [Math.ceil(words.length / 4), Math.ceil(words.length / 2), Math.ceil((3 * words.length) / 4), words.length];
  let typed = 0;
  for (const [k, n] of steps.entries()) {
    const chunk = words.slice(typed, n).join(' ');
    await page.type('#prompt', (typed > 0 ? ' ' : '') + chunk);
    typed = n;
    await settle(page, 200);
    await shot(page, `w05-type-${k + 1}`, k === steps.length - 1 ? ['light', 'dark'] : ['light']);
  }
  for (let presses = 0; presses < 5 && (await page.evaluate<string>(`document.querySelector('#prompt').value`)) !== ''; presses++) {
    await page.press('Enter');
    await page.waitFor(`document.querySelector('#prompt').value === ''`, 3_000).catch(() => undefined);
  }

  // The live turn: light-theme stills while it works, both themes at the approval.
  const deadline = Date.now() + waitMs;
  let n = 0;
  let approved = 0;
  while (Date.now() < deadline) {
    if (await page.evaluate<boolean>(APPROVAL_ARMED)) {
      await settle(page, 300);
      await shot(page, `w07-approval-${approved + 1}`);
      await page.click('#approval .btn.primary');
      approved++;
      await settle(page, 600);
      await shot(page, `w08-allowed-${approved}`, ['light']);
      continue;
    }
    if (n > 2 && (await page.evaluate<boolean>(IDLE))) break;
    await settle(page, 350);
    await shot(page, `w06-run-${String(++n).padStart(2, '0')}`, ['light']);
  }
  await settle(page, 900);
  await shot(page, 'w09-final');
  await page.evaluate(`(() => { const all = [...document.querySelectorAll('#log *')].filter((el) => el.children.length === 0 && /Allowed once by you/.test(el.textContent)); if (all[0]) all[0].scrollIntoView({ block: 'center' }) })()`);
  await settle(page, 700);
  await shot(page, 'w10-receipt');
  const problems = await page.unexpectedProblems();
  if (problems.length) console.warn(`page problems: ${problems.map((p) => `${p.source}/${p.level}: ${p.text}`).join(' | ').slice(0, 600)}`);
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ width, height, scale, approvals: approved, follow: values.follow, stills: manifest }, null, 1));
  console.log(`done: ${manifest.length} stills, ${approved} approval(s)`);
} catch (e) {
  failed = e;
} finally {
  await browser.close();
  rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}
if (failed) {
  console.error(`web_take: ${failed instanceof Error ? failed.stack : String(failed)}`);
  process.exit(1);
}
