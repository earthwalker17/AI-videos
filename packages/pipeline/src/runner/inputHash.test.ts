import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { tempRepo, type TempRepo } from '../testing.ts';
import { computeInputHash, filesOutsideHash, renderSettings } from './inputHash.ts';
import { PROFILES } from './profiles.ts';
import { resolveTarget } from './target.ts';

let repo: TempRepo;
afterEach(() => repo?.cleanup());

const adapter = { name: 'fake', adapterVersion: '1', inputs: () => ['engines/fake/page'] };

function hashOf(r: TempRepo, over: Partial<{ adapterVersion: string; profile: keyof typeof PROFILES }> = {}) {
  const target = resolveTarget('demo', r.root);
  const profile = PROFILES[over.profile ?? 'draft'];
  return computeInputHash({ target, adapter: { ...adapter, adapterVersion: over.adapterVersion ?? '1' }, settings: renderSettings(target, profile, { width: 160, height: 90 }) });
}

describe('inputHash', () => {
  it('is stable and independent of where the repo lives', () => {
    repo = tempRepo();
    repo.write('engines/fake/page/runtime.ts', 'export {};\n');
    const other = tempRepo();
    other.write('engines/fake/page/runtime.ts', 'export {};\n');
    try {
      const a = hashOf(repo);
      expect(hashOf(repo).hash).toBe(a.hash);
      expect(hashOf(other).hash).toBe(a.hash);
      expect(a.roots).toEqual(['engines/fake/page', 'packages/core/src', 'videos/demo/src', 'videos/demo/src/index.ts']);
      expect(a.files).toBe(3);
    } finally {
      other.cleanup();
    }
  });

  it('changes with source, assets, core, adapter inputs, adapter version, lockfile and settings', () => {
    repo = tempRepo();
    let prev = hashOf(repo).hash;
    const differs = (what: string, fn: () => void, over = {}) => {
      fn();
      const h = hashOf(repo, over).hash;
      expect(h, what).not.toBe(prev);
      prev = h;
    };
    differs('src edit', () => repo.write('videos/demo/src/index.ts', 'export const scene = 2;\n'));
    differs('new src file', () => repo.write('videos/demo/src/scene/a.ts', 'export {};\n'));
    differs('asset', () => repo.write('videos/demo/assets/logo.svg', '<svg/>'));
    differs('core', () => repo.write('packages/core/src/index.ts', 'export const x = 2;\n'));
    differs('another frame package', () => repo.write('packages/remotion-kit/src/index.ts', 'export {};\n'));
    differs('a style', () => repo.write('styles/house/tokens.ts', 'export const ink = 1;\n'));
    differs('adapter input', () => repo.write('engines/fake/page/runtime.ts', 'export {};\n'));
    differs('lockfile', () => repo.write('pnpm-lock.yaml', "lockfileVersion: '9.1'\n"));
    differs('adapter version', () => {}, { adapterVersion: '2' });
    prev = hashOf(repo).hash;
    differs('profile', () => {}, { profile: 'review' });
  });

  it('ignores tests, dot-files and metadata-only video.json edits', () => {
    repo = tempRepo();
    const base = hashOf(repo).hash;
    repo.write('videos/demo/src/index.test.ts', 'test;\n');
    repo.write('videos/demo/src/.DS_Store', 'x');
    repo.write('videos/demo/README.md', '# notes\n');
    // node-only: no page can load it (the web engine fails on served files outside the roots)
    repo.write('packages/pipeline/src/qa.ts', 'export {};\n');
    repo.write('videos/demo/video.json', JSON.stringify({ slug: 'demo', title: 'Renamed', engine: 'fake', entry: 'src/index.ts', format: { width: 320, height: 180, fps: 30 }, status: 'review' }));
    expect(hashOf(repo).hash).toBe(base);
    repo.write('videos/demo/video.json', JSON.stringify({ slug: 'demo', title: 'Renamed', engine: 'fake', entry: 'src/index.ts', format: { width: 320, height: 180, fps: 25 } }));
    expect(hashOf(repo).hash).not.toBe(base);
  });
});

describe('filesOutsideHash', () => {
  it('reports exactly the files whose edits leave the input hash unchanged', () => {
    repo = tempRepo();
    const files = [
      'videos/demo/src/sub/a.tsx',
      'videos/demo/assets/img.png',
      'videos/demo/media/bed.wav',
      'videos/demo/src/notes.md',
      'styles/look/STYLE.md',
      'styles/look.css',
      'packages/kit/src/k.ts',
      'engines/fake/page/h.ts',
      'videos/demo/src/dist/b.ts',
      'videos/demo/src/out/c.ts',
      'videos/demo/src/.gen/d.ts',
      'videos/demo/src/deep/.cache/e.ts',
      'videos/demo/src/x.test.ts',
      'videos/demo/src/.hidden.ts',
      'videos/demo/src/node_modules/f.js',
      'videos/demo/other/g.ts',
      'packages/kit/package.json',
    ];
    for (const f of files) repo.write(f, 'a');
    // pinned by the lockfile line (outside every root): neither hashed as a file nor reported
    repo.write('node_modules/.pnpm/three@1/node_modules/three/index.js', 'a');
    const abs = (rel: string) => join(repo.root, ...rel.split('/'));
    const { roots } = hashOf(repo);
    for (const f of [...files, 'videos/demo/src/index.ts']) {
      const before = hashOf(repo).hash;
      const text = readFileSync(abs(f), 'utf8');
      writeFileSync(abs(f), `${text}b`);
      const hashed = hashOf(repo).hash !== before;
      writeFileSync(abs(f), text);
      expect(filesOutsideHash([abs(f)], repo.root, roots).length === 0, `${f}: hashed=${hashed}`).toBe(hashed);
    }
    expect(filesOutsideHash([abs('node_modules/.pnpm/three@1/node_modules/three/index.js')], repo.root, roots)).toEqual([]);
    expect(filesOutsideHash([join(repo.root, '..', 'elsewhere.ts')], repo.root, roots)).toHaveLength(1);
  });
});
