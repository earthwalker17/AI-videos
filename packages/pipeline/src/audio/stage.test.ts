// The audio stage end to end on a scratch repo: real child processes (node --import tsx).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { AudioResult, EXIT } from '@aiv/core';
import { tempRepo, withAudioRuntime, type TempRepo } from '../testing.ts';
import { silentLog } from '../util/log.ts';
import { repoRoot } from '../util/paths.ts';
import { exec } from '../util/proc.ts';
import { LibraryManifest, libraryDir } from './runtime/library.ts';
import { encodeWav, readWav } from './runtime/wav.ts';
import { runAudioStage } from './stage.ts';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';
/** This repository (the code under test), not the scratch repo. */
const CODE = repoRoot(dirname(fileURLToPath(import.meta.url)));
let repo: TempRepo;
afterEach(() => repo?.cleanup());

const cues = (over: Record<string, unknown> = {}) =>
  `export const cues = ${JSON.stringify({ schemaVersion: 1, fps: 30, filmFrames: 60, leaderFrames: 6, events: [{ id: 'knock', kind: 'hit', frame: 30 }], ...over })};\n`;

/** A 2 s score: a quiet sine plus a click on the 'knock' cue. No imports: a scratch repo has no node_modules. */
const SCORE = `
const sine = (ctx, f, a) => {
  const x = new Float32Array(ctx.filmSamples);
  for (let i = 0; i < x.length; i++) x[i] = a * Math.sin((2 * Math.PI * f * i) / ctx.sampleRate);
  return x;
};
export default {
  tracks: {
    tone: (ctx) => {
      const l = sine(ctx, 440, 0.25);
      const r = sine(ctx, 440, 0.25);
      const hit = ctx.frameToSample(ctx.cues.events.find((e) => e.id === 'knock').frame);
      l[hit] = r[hit] = 0.9;
      return [l, r];
    },
    air: async (ctx) => [sine(ctx, 110, 0.05), sine(ctx, 111, 0.05)],
  },
};
`;

function scratch(score = SCORE, cueSheet = cues()): TempRepo {
  const r = withAudioRuntime(tempRepo());
  r.write('videos/demo/src/cues.ts', cueSheet);
  r.write('videos/demo/audio/index.ts', score);
  return r;
}

const stage = (o: { verify?: boolean; pin?: boolean; lines?: string[] } = {}) => runAudioStage({ slug: 'demo', root: repo.root, verify: o.verify, pin: o.pin, log: silentLog(o.lines) });
const readAudioJson = () => AudioResult.parse(JSON.parse(readFileSync(join(repo.root, 'out/demo/audio/audio.json'), 'utf8')));

describe('aiv audio (stage)', () => {
  it('renders every track, leader + film, with the click on its cue frame, and writes audio.json', async () => {
    repo = scratch();
    const lines: string[] = [];
    const r = await stage({ lines });
    expect(r.exit).toBe(EXIT.OK);
    const a = readAudioJson();
    expect(a.tracks.map((t) => t.name)).toEqual(['air', 'tone']);
    // (6 + 60) frames at 30 fps
    expect(a.tracks.every((t) => t.samples === 105_600 && t.channels === 2 && t.path === `out/demo/audio/${t.name}.wav`)).toBe(true);
    const tone = readWav(readFileSync(join(repo.root, 'out/demo/audio/tone.wav')));
    expect(tone.sampleRate).toBe(48000);
    // silence under the leader, the click 30 film frames after it
    expect(tone.channels[0].subarray(0, 9600).every((x) => x === 0)).toBe(true);
    expect(tone.channels[0][9600 + 48_000]).toBeCloseTo(0.9, 6);
    expect(a.tracks[1].peakDb).toBeCloseTo(20 * Math.log10(0.9), 1);
    expect(a.tracks[1].loudness?.i).toBeLessThan(-10);
    expect(a.tracks[1].sha256).toBe(createHash('sha256').update(readFileSync(join(repo.root, 'out/demo/audio/tone.wav'))).digest('hex'));
    expect(a.cues).toMatchObject({ path: 'videos/demo/src/cues.ts', sheet: { filmFrames: 60, leaderFrames: 6 } });
    const paths = a.inputs.map((f) => f.path);
    expect(paths.filter((p) => p.startsWith('videos/'))).toEqual(['videos/demo/audio/index.ts', 'videos/demo/src/cues.ts']);
    expect(paths).toEqual(expect.arrayContaining(['packages/core/src/index.ts', 'packages/pipeline/src/audio/runtime/render.ts', 'packages/pipeline/src/audio/runtime/child.ts']));
    expect(paths.every((p) => /^(packages\/core\/src|packages\/pipeline\/src\/audio\/runtime|videos\/demo)\//.test(p) && !p.endsWith('.test.ts'))).toBe(true);
    expect(a.checks.map((c) => [c.id, c.passed])).toEqual([['cuts.bars', true], ['text.hold', true], ['card.length', true]]);
    expect(a.verified).toBe(false);
    expect(JSON.stringify(a)).not.toMatch(/[A-Za-z]:[\\/]|\/tmp\//);
    // no temp folders or job files left behind
    expect(existsSync(join(repo.root, 'out/demo/audio/.render-1'))).toBe(false);
  });

  it('--verify: two fresh processes give identical bytes; a score that reads process state fails', async () => {
    repo = scratch();
    expect((await stage({ verify: true })).exit).toBe(EXIT.OK);
    expect(readAudioJson().verified).toBe(true);
    repo.write('videos/demo/audio/index.ts', SCORE.replace('l[hit] = r[hit] = 0.9;', 'l[hit] = r[hit] = (process.pid % 97) / 100;'));
    await expect(stage({ verify: true })).rejects.toMatchObject({ exit: EXIT.ERROR, message: expect.stringMatching(/not deterministic: tone/) });
  }, 120_000);

  it('refuses a score that loads a repo file the audio hash does not cover (CommonJS and ES modules)', async () => {
    repo = scratch(`import { gain } from '../src/other.ts';\n${SCORE.replace('0.25)', '0.25 * gain)')}`);
    repo.write('videos/demo/src/other.ts', 'export const gain = 1;\n');
    const refused = { exit: EXIT.REFUSED, message: expect.stringMatching(/does not cover: videos\/demo\/src\/other\.ts\./) };
    // no package.json: tsx compiles the score to CommonJS (require)
    await expect(stage()).rejects.toMatchObject(refused);
    expect(existsSync(join(repo.root, 'out/demo/audio/audio.json'))).toBe(false);
    // "type": "module", as at the repository root: ES modules (import)
    repo.write('package.json', '{ "type": "module" }\n');
    await expect(stage()).rejects.toMatchObject(refused);
    // the same helper inside audio/ is fine
    repo.write('videos/demo/audio/other.ts', 'export const gain = 1;\n');
    repo.write('videos/demo/audio/index.ts', `import { gain } from './other.ts';\n${SCORE.replace('0.25)', '0.25 * gain)')}`);
    expect((await stage()).exit).toBe(EXIT.OK);
  }, 120_000);

  it('a failed intent check exits 1 after writing the tracks; a wrong fps or a bad track is an error', async () => {
    repo = scratch(SCORE, cues({ events: [{ id: 'knock', kind: 'hit', frame: 30 }, { id: 'title', kind: 'card', frame: 0, end: 30 }] }));
    const r = await stage();
    expect(r.exit).toBe(EXIT.ERROR);
    expect(r.failed.map((c) => c.id)).toEqual(['card.length']);
    expect(readAudioJson().checks.find((c) => c.id === 'card.length')).toMatchObject({ passed: false, detail: expect.stringMatching(/title \(1\.00 s\)/) });
    expect(existsSync(join(repo.root, 'out/demo/audio/tone.wav'))).toBe(true);

    repo.write('videos/demo/src/cues.ts', cues({ fps: 24 }));
    await expect(stage()).rejects.toMatchObject({ exit: EXIT.ERROR, message: expect.stringMatching(/fps 24, video\.json format\.fps is 30/) });
    repo.write('videos/demo/src/cues.ts', cues());
    repo.write('videos/demo/audio/index.ts', 'export default { tracks: { short: (ctx) => [new Float32Array(10), new Float32Array(10)] } };\n');
    await expect(stage()).rejects.toMatchObject({ exit: EXIT.ERROR, message: expect.stringMatching(/track 'short': left has 10 samples, expected ctx\.filmSamples = 96000/) });
  }, 120_000);

  it('library files: unpinned reads fail, --pin records them (from the seed), pinned reads are verified', async () => {
    const harp = encodeWav([Float32Array.of(0.5, 0.25, 0)], 44100, 's24');
    const score = `export default { tracks: { harp: (ctx) => {
      const w = ctx.library('harp').readWav('Harp/C4.wav');
      const l = new Float32Array(ctx.filmSamples);
      l.set(w.channels[0], ctx.frameToSample(30));
      return [l, l.slice()];
    } } };\n`;
    repo = scratch(score);
    // the seed: a git checkout of the library, anywhere on the machine (here inside the scratch repo's out/)
    const seed = join(repo.root, 'out', 'seed');
    writeFileSync(repo.write('out/seed/Harp/C4.wav', ''), harp);
    const git = async (...args: string[]) => {
      const r = await exec('git', ['-c', 'user.name=aiv', '-c', 'user.email=aiv@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: seed });
      expect(r.code, r.stderr).toBe(0);
      return r.stdout.trim();
    };
    await git('init', '-q');
    await git('add', '-A');
    await git('commit', '-q', '--no-verify', '-m', 'seed');
    const commit = await git('rev-parse', 'HEAD');
    repo.write('aiv.local.json', JSON.stringify({ librarySeeds: { harp: seed } }));
    const lib = (at: string) => ({ schemaVersion: 1, libraries: [{ id: 'harp', repo: 'https://github.com/example/harp', commit: at, license: 'CC0-1.0', files: [] }] });

    // a seed at another commit is never pinned from: its bytes are not the pinned commit's
    repo.write('videos/demo/audio/library.json', `${JSON.stringify(lib(COMMIT))}\n`);
    const lines: string[] = [];
    await expect(stage({ pin: true, lines })).rejects.toMatchObject({ exit: EXIT.ERROR, message: expect.stringMatching(/Harp\/C4\.wav is not in the store/) });
    expect(lines.join('\n')).toMatch(/librarySeeds\.harp \(aiv\.local\.json\) is not used: it is at commit [0-9a-f]{12}, the library is pinned at 0123456789ab/);
    expect(lines.join('\n')).not.toContain(seed);

    repo.write('videos/demo/audio/library.json', `${JSON.stringify(lib(commit))}\n`);
    await expect(stage()).rejects.toMatchObject({ exit: EXIT.ERROR, message: expect.stringMatching(/Harp\/C4\.wav is not pinned in audio\/library\.json: run aiv audio demo --pin/) });
    // nor with modified tracked files
    writeFileSync(join(seed, 'Harp', 'C4.wav'), encodeWav([Float32Array.of(0.1)], 44100, 's24'));
    await expect(stage({ pin: true, lines })).rejects.toMatchObject({ exit: EXIT.ERROR, message: expect.stringMatching(/not in the store/) });
    expect(lines.join('\n')).toMatch(/is not used: it has modified tracked files/);
    writeFileSync(join(seed, 'Harp', 'C4.wav'), harp);
    expect((await stage({ pin: true })).exit).toBe(EXIT.OK);
    const pinned = LibraryManifest.parse(JSON.parse(readFileSync(join(repo.root, 'videos/demo/audio/library.json'), 'utf8')));
    expect(pinned.libraries[0].files).toEqual([{ path: 'Harp/C4.wav', bytes: harp.length, sha256: createHash('sha256').update(harp).digest('hex') }]);
    expect(readFileSync(join(repo.root, 'videos/demo/audio/library.json'), 'utf8')).toMatch(/^\{\n {2}"schemaVersion": 1,\n[\s\S]*\}\n$/);
    const a = readAudioJson();
    expect(a.libraries).toEqual([{ id: 'harp', commit, files: 1 }]);
    // the hash in audio.json is the one after pinning
    expect(a.settings.library).toBe(createHash('sha256').update(readFileSync(join(repo.root, 'videos/demo/audio/library.json'))).digest('hex'));

    expect((await stage()).exit).toBe(EXIT.OK);
    writeFileSync(join(libraryDir(repo.root, 'harp', commit), 'Harp', 'C4.wav'), encodeWav([Float32Array.of(0.5, 0.25, 0.1)], 44100, 's24'));
    await expect(stage()).rejects.toMatchObject({ exit: EXIT.ERROR, message: expect.stringMatching(/not the pinned file.*aiv doctor --fix/) });
  }, 120_000);

  it('a score may import @aiv/pipeline/audio and @aiv/core through node_modules, not the rest of @aiv/pipeline', async () => {
    repo = scratch(`import { defineScore } from '@aiv/pipeline/audio';
import { rand } from '@aiv/core';
export default defineScore({ tracks: { hiss: (ctx) => {
  const l = new Float32Array(ctx.filmSamples);
  for (let i = 0; i < l.length; i++) l[i] = 0.01 * (rand(ctx.seed, 'hiss', i) * 2 - 1);
  return [l, l.slice()];
} } });
`);
    repo.write('package.json', '{ "type": "module" }\n');
    // the scratch repo borrows this repository's dependencies (pnpm links @aiv/* to packages/)
    const link = join(repo.root, 'node_modules');
    symlinkSync(join(CODE, 'node_modules'), link, 'junction');
    try {
      expect((await stage({ verify: true })).exit).toBe(EXIT.OK);
      repo.write('videos/demo/audio/index.ts', `import { sha256 } from '@aiv/pipeline';\nconsole.log(sha256('x'));\n${SCORE}`);
      await expect(stage()).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/does not cover: .*packages\/pipeline\/src\/index\.ts/) });
    } finally {
      unlinkSync(link);
    }
    expect(existsSync(join(CODE, 'node_modules', 'vitest'))).toBe(true);
  }, 120_000);

  it('the score process gets almost no environment: nothing a score could read changes its bytes unhashed', async () => {
    repo = scratch(`console.log('env ' + Object.keys(process.env).sort().join(','));\n${SCORE}`);
    const saved = { ...process.env };
    process.env.AIV_TEST_GAIN = '0.5';
    process.env.NODE_OPTIONS = '--no-deprecation';
    const lines: string[] = [];
    try {
      expect((await stage({ lines })).exit).toBe(EXIT.OK);
    } finally {
      process.env = saved;
    }
    const env = lines.find((l) => l.startsWith('score: env '))!.slice('score: env '.length).split(',');
    expect(env.filter((k) => /^(AIV_|NODE_OPTIONS$|npm_|VITEST)/i.test(k))).toEqual([]);
    // what the stage passes, plus what Windows process creation (libuv) always adds
    const allowed = /^(PATH|SystemRoot|windir|TEMP|TMP|TMPDIR|HOME|USERPROFILE|HOMEDRIVE|HOMEPATH|LOGONSERVER|SYSTEMDRIVE|USERDOMAIN|USERNAME)$/i;
    expect(env.filter((k) => !allowed.test(k))).toEqual([]);
  });

  it("refuses when the runtime that ran is not the target's hashed copy (another checkout's code)", async () => {
    repo = scratch();
    expect((await stage()).exit).toBe(EXIT.OK);
    repo.write('packages/pipeline/src/audio/runtime/render.ts', `${readFileSync(join(CODE, 'packages/pipeline/src/audio/runtime/render.ts'), 'utf8')}// an older copy\n`);
    await expect(stage()).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/another checkout's runtime .*packages\/pipeline\/src\/audio\/runtime\/render\.ts differ/) });
    rmSync(join(repo.root, 'packages/pipeline/src/audio/runtime/child.ts'));
    repo.write('packages/pipeline/src/audio/runtime/render.ts', readFileSync(join(CODE, 'packages/pipeline/src/audio/runtime/render.ts'), 'utf8'));
    await expect(stage()).rejects.toMatchObject({ exit: EXIT.REFUSED, message: expect.stringMatching(/runtime\/child\.ts differ/) });
  });

  it("passes a score's console output on, and needs the score and the cue sheet", async () => {
    repo = scratch(`console.log('tuning up');\n${SCORE}`);
    const lines: string[] = [];
    expect((await stage({ lines })).exit).toBe(EXIT.OK);
    expect(lines).toContain('score: tuning up');
    repo.write('videos/demo/src/cues.ts', '');
    await expect(stage()).rejects.toMatchObject({ exit: EXIT.ERROR, message: expect.stringMatching(/must export `cues`/) });
  });
});
