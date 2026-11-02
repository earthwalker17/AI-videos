import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { caseMismatch, formatLibraryManifest, libraryDir, LibraryManifest, openLibrary, type LibraryEntry } from './library.ts';
import { encodeWav } from './wav.ts';

const COMMIT = '6dd651d55dde97fd4028699be9d4481f26917891';
let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), 'aiv-lib-'));
  dirs.push(d);
  return d;
};
const put = (file: string, bytes: Uint8Array | string) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
};
const pin = (path: string, bytes: Uint8Array | string) => ({ path, bytes: Buffer.byteLength(bytes), sha256: createHash('sha256').update(bytes).digest('hex') });

const wav = encodeWav([Float32Array.of(0, 0.5, -0.5)], 44100, 's24');
const sfz = '<region> sample=Harp/C4.wav\n';

function setup() {
  const root = temp();
  const store = libraryDir(root, 'harp', COMMIT);
  put(join(store, 'Harp', 'C4.wav'), wav);
  put(join(store, 'harp.sfz'), sfz);
  const entry: LibraryEntry = { id: 'harp', repo: 'https://github.com/example/harp', commit: COMMIT, license: 'CC0-1.0', files: [pin('Harp/C4.wav', wav), pin('harp.sfz', sfz)] };
  return { root, store, entry };
}

describe('sample libraries', () => {
  it('reads pinned files, verified, and lists what was read', () => {
    const { root, entry } = setup();
    const lib = openLibrary({ root, slug: 'demo', entry, pin: false });
    expect(lib.readText('harp.sfz')).toBe(sfz);
    const w = lib.readWav('Harp/C4.wav');
    expect(w.sampleRate).toBe(44100);
    expect([...w.channels[0]]).toEqual([0, 0.5, -0.5]);
    expect(lib.reads()).toEqual(entry.files);
  });

  it('refuses a file whose bytes are not the pinned ones', () => {
    const { root, store, entry } = setup();
    put(join(store, 'harp.sfz'), '<region> sample=Harp/D4.wav\n');
    const lib = openLibrary({ root, slug: 'demo', entry, pin: false });
    expect(() => lib.readText('harp.sfz')).toThrow(/not the pinned file.*aiv doctor --fix/);
    // and even in --pin mode: a pin is never silently replaced
    expect(() => openLibrary({ root, slug: 'demo', entry, pin: true }).readText('harp.sfz')).toThrow(/not the pinned file/);
  });

  it('refuses an unpinned file unless pinning, and paths outside the library always', () => {
    const { root, store, entry } = setup();
    put(join(store, 'Harp', 'D4.wav'), wav);
    const strict = openLibrary({ root, slug: 'demo', entry, pin: false });
    expect(() => strict.readWav('Harp/D4.wav')).toThrow(/not pinned in audio\/library\.json: run aiv audio demo --pin/);
    for (const bad of ['../secret.txt', 'Harp/../../x', '/etc/passwd', 'C:/x.wav', 'Harp\\C4.wav', './harp.sfz', ''])
      expect(() => strict.readText(bad), bad).toThrow(/outside the library/);
    const pinning = openLibrary({ root, slug: 'demo', entry, pin: true });
    pinning.readWav('Harp/D4.wav');
    expect(pinning.reads().map((f) => f.path)).toEqual(['Harp/D4.wav']);
    expect(() => pinning.readText('../secret.txt')).toThrow(/outside the library/);
  });

  it('a missing store file: an error naming the fix; in --pin mode the seed fills it', () => {
    const { root, entry } = setup();
    const seed = temp();
    put(join(seed, 'Harp', 'E4.wav'), wav);
    expect(() => openLibrary({ root, slug: 'demo', entry, pin: true }).readWav('Harp/E4.wav')).toThrow(/not in the store.*librarySeeds\.harp/);
    const lib = openLibrary({ root, slug: 'demo', entry, pin: true, seed });
    lib.readWav('Harp/E4.wav');
    expect(existsSync(join(libraryDir(root, 'harp', COMMIT), 'Harp', 'E4.wav'))).toBe(true);
    expect(lib.reads()).toEqual([pin('Harp/E4.wav', wav)]);
  });

  it('a path must name the file in its exact letter case (a case-insensitive disk would accept it)', () => {
    const { root, store, entry } = setup();
    // the pure check, on any file system
    const tree: Record<string, string[]> = { [store]: ['Harp', 'harp.sfz'], [join(store, 'Harp')]: ['C4.wav'] };
    const list = (folder: string) => tree[folder] ?? [];
    expect(caseMismatch(store, 'Harp/C4.wav', list)).toBeNull();
    expect(caseMismatch(store, 'harp/c4.wav', list)).toBe('Harp/C4.wav');
    expect(caseMismatch(store, 'Harp/D4.wav', list)).toBeNull();
    // on this disk: refused either way (NTFS/APFS find the file, Linux does not)
    const insensitive = existsSync(join(store, 'harp', 'c4.wav'));
    const pinning = openLibrary({ root, slug: 'demo', entry, pin: true });
    expect(() => pinning.readWav('harp/c4.wav')).toThrow(insensitive ? /harp\/c4\.wav is spelled Harp\/C4\.wav in the store: library paths are case-sensitive/ : /not in the store/);
    expect(pinning.reads()).toEqual([]);
    // the seed is held to the same rule before anything is copied from it
    const seed = temp();
    put(join(seed, 'Harp', 'E4.wav'), wav);
    const fromSeed = openLibrary({ root, slug: 'demo', entry, pin: true, seed });
    expect(() => fromSeed.readWav('harp/E4.wav')).toThrow(insensitive ? /spelled Harp\/E4\.wav in the seed/ : /not in the store/);
    expect(existsSync(join(store, 'Harp', 'E4.wav'))).toBe(false);
  });

  it('library.json: strict, licences CC0/CC BY only, sorted, formatted stably', () => {
    const { entry } = setup();
    const m = { schemaVersion: 1, libraries: [entry] };
    expect(LibraryManifest.safeParse(m).success).toBe(true);
    const unsorted = { ...m, libraries: [{ ...entry, files: [...entry.files].reverse() }] };
    expect(LibraryManifest.safeParse(unsorted).error?.issues[0].message).toMatch(/sorted by path/);
    expect(LibraryManifest.safeParse({ ...m, libraries: [{ ...entry, license: 'CC-BY-NC-4.0' }] }).success).toBe(false);
    expect(LibraryManifest.safeParse({ ...m, libraries: [{ ...entry, license: 'CC-BY-4.0' }] }).success).toBe(true);
    expect(LibraryManifest.safeParse({ ...m, libraries: [{ ...entry, commit: COMMIT.slice(0, 12) }] }).success).toBe(false);
    expect(LibraryManifest.safeParse({ ...m, libraries: [{ ...entry, files: [{ ...entry.files[0], path: '../x' }] }] }).success).toBe(false);
    expect(LibraryManifest.safeParse({ ...m, extra: 1 }).success).toBe(false);
    const text = formatLibraryManifest(LibraryManifest.parse(m));
    expect(formatLibraryManifest({ schemaVersion: 1, libraries: [{ ...entry, files: [...entry.files].reverse() }] })).toBe(text);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "libraries": [\n');
  });
});
