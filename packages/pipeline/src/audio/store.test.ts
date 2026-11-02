// The sample-library store, filled from a seed or a (mocked) download: CI never fetches.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { tempRepo, type TempRepo } from '../testing.ts';
import { libraryDir } from './runtime/library.ts';
import { encodeWav } from './runtime/wav.ts';
import { fillStoreFile, githubUrls, pinnedLibraries, storeFileState, type Fetcher } from './store.ts';

const COMMIT = '6dd651d55dde97fd4028699be9d4481f26917891';
const REPO = 'https://github.com/sgossner/VSCO-2-CE';
let repo: TempRepo;
afterEach(() => repo?.cleanup());

const wav = Buffer.from(encodeWav([Float32Array.of(0.1, -0.1)], 44100, 's24'));
const sfz = Buffer.from('<region> sample=Strings/Viola C4.wav\n');
const pin = (path: string, b: Buffer) => ({ path, bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') });
const manifest = (files: ReturnType<typeof pin>[]) => `${JSON.stringify({ schemaVersion: 1, libraries: [{ id: 'vsco2-ce', repo: REPO, commit: COMMIT, license: 'CC0-1.0', files }] }, null, 2)}\n`;

/** A fetch double: URL → body; anything else is a 404. Records what was asked for. */
function fakeFetch(bodies: Record<string, Buffer>): Fetcher & { asked: string[] } {
  const asked: string[] = [];
  const f = async (url: string) => {
    asked.push(url);
    const b = bodies[url];
    return { ok: !!b, status: b ? 200 : 404, arrayBuffer: async () => (b ? b.buffer.slice(b.byteOffset, b.byteOffset + b.length) : new ArrayBuffer(0)) as ArrayBuffer };
  };
  return Object.assign(f, { asked });
}

describe('library store', () => {
  it('collects the pins of every video and reports contradictions', () => {
    repo = tempRepo();
    repo.write('videos/demo/audio/library.json', manifest([pin('Strings/Viola C4.wav', wav), pin('viola.sfz', sfz)]));
    repo.write('videos/other/video.json', '{}');
    repo.write('videos/other/audio/library.json', manifest([pin('viola.sfz', Buffer.from('other'))]));
    repo.write('videos/broken/audio/library.json', '{ "schemaVersion": 1, "libraries": [ { "id": "X" } ] }');
    const scan = pinnedLibraries(repo.root);
    expect(scan.libraries).toHaveLength(1);
    expect(scan.libraries[0]).toMatchObject({ id: 'vsco2-ce', commit: COMMIT, pinnedBy: ['videos/demo/audio/library.json', 'videos/other/audio/library.json'] });
    expect(scan.libraries[0].files.map((f) => f.path)).toEqual(['Strings/Viola C4.wav', 'viola.sfz']);
    expect(scan.errors.join('\n')).toMatch(/videos\/broken\/audio\/library\.json: libraries\.0/);
    expect(scan.errors.join('\n')).toMatch(/viola\.sfz: videos\/other\/audio\/library\.json pins another file/);
  });

  it('fills from the seed only when the sha256 matches, else downloads (following LFS pointers) and verifies', async () => {
    repo = tempRepo();
    const lib = { id: 'vsco2-ce', commit: COMMIT, repo: REPO };
    const files = [pin('Strings/Viola C4.wav', wav), pin('viola.sfz', sfz)];
    repo.write('videos/demo/audio/library.json', manifest(files));
    const seed = join(repo.root, 'seed');
    repo.write('seed/viola.sfz', sfz.toString());
    repo.write('seed/Strings/Viola C4.wav', 'a different take');
    expect(files.map((f) => storeFileState(repo.root, lib, f))).toEqual(['missing', 'missing']);

    const urls = githubUrls(REPO, COMMIT, 'Strings/Viola C4.wav')!;
    expect(urls.raw).toBe(`https://raw.githubusercontent.com/sgossner/VSCO-2-CE/${COMMIT}/Strings/Viola%20C4.wav`);
    expect(urls.lfs).toBe(`https://media.githubusercontent.com/media/sgossner/VSCO-2-CE/${COMMIT}/Strings/Viola%20C4.wav`);
    const pointer = Buffer.from('version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 12\n');
    const net = fakeFetch({ [urls.raw]: pointer, [urls.lfs]: wav });

    const sfzFill = await fillStoreFile({ root: repo.root, lib, file: files[1], seed, fetch: net });
    expect(sfzFill).toMatchObject({ ok: true, from: 'seed' });
    expect(net.asked).toEqual([]);
    const wavFill = await fillStoreFile({ root: repo.root, lib, file: files[0], seed, fetch: net });
    expect(wavFill).toMatchObject({ ok: true, from: 'download' });
    expect(net.asked).toEqual([urls.raw, urls.lfs]);
    expect(readFileSync(join(libraryDir(repo.root, 'vsco2-ce', COMMIT), 'Strings', 'Viola C4.wav'))).toEqual(wav);
    expect(files.map((f) => storeFileState(repo.root, lib, f))).toEqual(['ok', 'ok']);

    // a download that is not the pinned file is never stored
    const wrong = await fillStoreFile({ root: repo.root, lib, file: pin('x.wav', wav), fetch: fakeFetch({ [githubUrls(REPO, COMMIT, 'x.wav')!.raw]: sfz }) });
    expect(wrong).toMatchObject({ ok: false, detail: expect.stringMatching(/not the pinned one/) });
    expect(storeFileState(repo.root, lib, pin('x.wav', wav))).toBe('missing');
    expect(await fillStoreFile({ root: repo.root, lib, file: pin('y.wav', wav), fetch: fakeFetch({}) })).toMatchObject({ ok: false, detail: 'no seed; download failed (HTTP 404)' });
    expect(await fillStoreFile({ root: repo.root, lib: { ...lib, repo: 'https://example.org/lib' }, file: pin('y.wav', wav) })).toMatchObject({ ok: false, detail: expect.stringMatching(/not a GitHub repository/) });
  });
});
