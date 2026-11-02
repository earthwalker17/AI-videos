// The doctor's library section over a scratch repo: never the network (a fetch double).
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { encodeWav, githubUrls, tempRepo, type Fetcher, type TempRepo } from '@aiv/pipeline';
import { librariesSection } from './libraries.ts';

const COMMIT = '6dd651d55dde97fd4028699be9d4481f26917891';
const REPO = 'https://github.com/sgossner/VSCO-2-CE';
let repo: TempRepo;
afterEach(() => repo?.cleanup());

const a = Buffer.from(encodeWav([Float32Array.of(0.1)], 44100, 's24'));
const b = Buffer.from('<region> sample=b.wav\n');
const pin = (path: string, x: Buffer) => ({ path, bytes: x.length, sha256: createHash('sha256').update(x).digest('hex') });

describe('doctor: sample libraries', () => {
  it('reports missing pinned files and --fix fills them from the seed, then by download', async () => {
    repo = tempRepo();
    repo.write('videos/demo/audio/library.json', JSON.stringify({ schemaVersion: 1, libraries: [{ id: 'vsco2-ce', repo: REPO, commit: COMMIT, license: 'CC0-1.0', files: [pin('Harp/a.wav', a), pin('harp.sfz', b)] }] }));
    repo.write('seed/harp.sfz', b.toString());
    repo.write('aiv.local.json', JSON.stringify({ librarySeeds: { 'vsco2-ce': join(repo.root, 'seed') } }));
    const asked: string[] = [];
    const net: Fetcher = async (url) => {
      asked.push(url);
      const ok = url === githubUrls(REPO, COMMIT, 'Harp/a.wav')!.raw;
      return { ok, status: ok ? 200 : 404, arrayBuffer: async () => (ok ? a.buffer.slice(a.byteOffset, a.byteOffset + a.length) : new ArrayBuffer(0)) as ArrayBuffer };
    };
    const section = librariesSection({ fetch: net, download: true });

    const before = await section.run({ root: repo.root });
    expect(before).toEqual([expect.objectContaining({ status: 'fail', label: 'vsco2-ce@6dd651d55dde', detail: expect.stringMatching(/2 of 2 pinned file\(s\) missing/), fix: 'pnpm aiv doctor --fix' })]);
    expect(asked).toEqual([]);

    const fixed = await section.run({ root: repo.root, fix: true });
    expect(fixed.map((i) => i.status)).toEqual(['info', 'ok']);
    expect(fixed[0].detail).toBe('filled 1 file(s) from the seed, downloaded 1');
    expect(asked).toHaveLength(1);
    expect((await section.run({ root: repo.root })).map((i) => i.status)).toEqual(['ok']);
  });

  it('on CI (downloads off) --fix never fetches, and a missing file is a warning, not a failure', async () => {
    repo = tempRepo();
    repo.write('videos/demo/audio/library.json', JSON.stringify({ schemaVersion: 1, libraries: [{ id: 'vsco2-ce', repo: REPO, commit: COMMIT, license: 'CC0-1.0', files: [pin('Harp/a.wav', a)] }] }));
    const asked: string[] = [];
    const net: Fetcher = async (url) => {
      asked.push(url);
      return { ok: false, status: 500, arrayBuffer: async () => new ArrayBuffer(0) };
    };
    const items = await librariesSection({ fetch: net, download: false }).run({ root: repo.root, fix: true });
    expect(items).toEqual([expect.objectContaining({ status: 'warn', detail: expect.stringMatching(/Harp\/a\.wav: no seed, and downloads are off; CI never downloads/) })]);
    expect(asked).toEqual([]);
  });

  it('says so when no video pins a library', async () => {
    repo = tempRepo();
    expect(await librariesSection().run({ root: repo.root })).toEqual([expect.objectContaining({ status: 'info', label: 'libraries' })]);
  });
});
