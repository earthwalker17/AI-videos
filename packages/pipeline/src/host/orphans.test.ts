import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { classify, ownedProfile, profileOwner, REMOTION_PROFILE_MARKER, REMOTION_PROFILE_PREFIX, staleRemotionProfiles, userDataDir, type ProcRow } from './orphans.ts';

const WIN = process.platform === 'win32';
const root = WIN ? 'C:\\dev\\AI-videos' : '/home/u/AI-videos';
const shell = WIN
  ? 'C:\\dev\\AI-videos\\node_modules\\.remotion\\chrome-headless-shell\\win64\\chrome-headless-shell-win64\\chrome-headless-shell.exe'
  : '/home/u/AI-videos/node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell';
const tmp = WIN ? 'C:\\Users\\x\\AppData\\Local\\Temp\\' : '/tmp/';
const profile = (k: string) => `${tmp}${REMOTION_PROFILE_PREFIX}${k}`;
const row = (o: Partial<ProcRow>): ProcRow => ({ pid: 100, name: 'chrome.exe', cmd: '', exe: '', ...o });
const hs = (pid: number, ppid: number, prof?: string): ProcRow =>
  row({ pid, ppid, name: 'chrome-headless-shell.exe', exe: shell, cmd: prof ? `"${shell}" --user-data-dir=${prof} --headless=old` : `"${shell}" --type=gpu-process` });

// this process is 900; 500 is a live Studio/CLI node process, 600 a dead one
const SELF = 900;
const opts = { self: SELF, alive: (pid: number) => pid === 500 || pid === SELF, owned: (dir: string) => dir === profile('marked') };

describe('orphan attribution', () => {
  it('claims this repo’s web browsers and only attributable Remotion shells', () => {
    const rows: ProcRow[] = [
      // an aiv render's shell (marked profile) and its child without the flag
      hs(1, 600, profile('marked')),
      hs(2, 1),
      // a shell Remotion launched in this process after a crash (no marker), and its child
      hs(3, SELF, profile('replaced')),
      hs(4, 3),
      // a shell whose node parent is gone: an orphan nobody drives
      hs(5, 600, profile('orphan')),
      // a Studio / `remotion render` shell of this repo: live parent, no marker → left alone
      hs(10, 500, profile('studio')),
      hs(11, 10),
      // the web engine's pinned Chrome on a repo profile
      row({ pid: 20, exe: join(root, '.cache', 'browsers', 'chrome.exe'), cmd: `chrome --user-data-dir="${join(root, '.cache', 'browser-profiles', 'web-x')}"` }),
      // another repo's headless shell, the user's Chrome, another tool's puppeteer profile
      row({ pid: 30, ppid: 600, name: 'chrome-headless-shell.exe', exe: shell.replace('AI-videos', 'other-repo'), cmd: `x --user-data-dir=${profile('marked')}` }),
      row({ pid: 31, exe: WIN ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/opt/google/chrome/chrome', cmd: 'chrome --user-data-dir=/home/u/.config/google-chrome' }),
      row({ pid: 32, ppid: 600, exe: WIN ? 'C:\\tools\\node_modules\\puppeteer\\chrome.exe' : '/srv/puppeteer/chrome', cmd: `chrome --user-data-dir=${profile('tool')}` }),
      // a folder merely named like the cache, beside it
      row({ pid: 33, ppid: 600, exe: join(root, 'node_modules', '.remotion-old', 'x.exe'), cmd: '' }),
    ];
    const got = classify(rows, root, opts);
    expect(got.map((o) => [o.pid, o.engine])).toEqual([
      [1, 'remotion'],
      [2, 'remotion'],
      [3, 'remotion'],
      [4, 'remotion'],
      [5, 'remotion'],
      [20, 'web'],
    ]);
    expect(got[0].profile).toBe(profile('marked'));
    expect(got[1].profile).toBe('');
  });

  it('leaves a shell alone when its parent is unknown and nothing else attributes it', () => {
    expect(classify([row({ pid: 1, exe: shell, cmd: `x --user-data-dir=${profile('a')}` })], root, opts)).toEqual([]);
  });

  it('reads --user-data-dir quoted and bare', () => {
    expect(userDataDir('x --user-data-dir="C:\\a b\\c" --y')).toBe('C:\\a b\\c');
    expect(userDataDir('x --user-data-dir=/tmp/p --y')).toBe('/tmp/p');
    expect(userDataDir('x --y')).toBeNull();
  });
});

describe('stale Remotion profiles', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('deletes only profiles that are attributable to this repo and unused', () => {
    dir = mkdtempSync(join(tmpdir(), 'aiv-orphans-'));
    const mk = (name: string, marker?: string) => {
      const d = join(dir, name);
      mkdirSync(d);
      if (marker !== undefined) writeFileSync(join(d, REMOTION_PROFILE_MARKER), `${marker}\n`);
      return d;
    };
    const repo = join(dir, 'repo');
    const ours = mk(`${REMOTION_PROFILE_PREFIX}ours`, profileOwner(repo));
    const busy = mk(`${REMOTION_PROFILE_PREFIX}busy`, profileOwner(repo));
    const killed = mk(`${REMOTION_PROFILE_PREFIX}killed`);
    const other = mk(`${REMOTION_PROFILE_PREFIX}other-repo`, WIN ? 'c:\\elsewhere' : '/elsewhere');
    mk(`${REMOTION_PROFILE_PREFIX}unmarked`);
    mk('unrelated', profileOwner(repo));
    expect(staleRemotionProfiles(repo, { tmp: dir, killed: [killed], busy: [busy] }).sort()).toEqual([killed, ours].sort());
    expect([ownedProfile(ours, repo), ownedProfile(other, repo), ownedProfile(killed, repo)]).toEqual([true, false, false]);
  });
});
