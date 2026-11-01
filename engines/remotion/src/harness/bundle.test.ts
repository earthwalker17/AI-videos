import { join } from 'node:path';
import type { VideoConfig } from '@aiv/core';
import { filesOutsideHash, repoRoot, type Target } from '@aiv/pipeline';
import { describe, expect, it } from 'vitest';
import { assertBundleFiles, bundleKey, duplicatePackages, moduleFiles, packageRoot } from './bundle.ts';

const root = join('/', 'repo');
const at = (...p: string[]) => join(root, ...p);
const roots = ['templates/remotion/src', 'packages/core/src', 'packages/remotion-kit/src', 'engines/remotion/src/harness'];

const target = (dir: string, relDir: string, entry: string, composition?: string): Target => {
  const config: VideoConfig = { slug: 't', title: 't', engine: 'remotion', entry, composition, format: { width: 64, height: 36, fps: 10 } };
  return { spec: 'x', kind: 'template', slug: `_t-${composition ?? 'main'}`, dir: join(dir, ...relDir.split('/')), relDir, configPath: '', config, root: dir };
};

describe('bundle checks', () => {
  it('finds bundled files outside the input roots (node_modules is pinned by the lockfile)', () => {
    const files = [
      at('templates', 'remotion', 'src', 'index.ts'),
      at('packages', 'remotion-kit', 'src', 'Stage3D.tsx'),
      at('node_modules', '.pnpm', 'three@0.186.1', 'node_modules', 'three', 'build', 'three.module.js'),
      at('engines', 'remotion', 'package.json'),
      at('templates', 'remotion', 'src-old', 'x.ts'),
      join('/', 'elsewhere', 'x.ts'),
    ];
    expect(filesOutsideHash(files, root, roots)).toEqual([at('engines', 'remotion', 'package.json'), at('templates', 'remotion', 'src-old', 'x.ts'), join('/', 'elsewhere', 'x.ts')]);
    expect(() => assertBundleFiles(files, root, roots, 'templates/remotion')).toThrow(/3 file\(s\) the input hash does not cover: engines\/remotion\/package\.json/);
  });

  it('names the package folder of a file, scoped or not', () => {
    expect(packageRoot('/r/node_modules/.pnpm/react@19.3.1/node_modules/react/index.js')).toEqual({ name: 'react', dir: '/r/node_modules/.pnpm/react@19.3.1/node_modules/react' });
    expect(packageRoot('C:\\r\\node_modules\\@react-three\\fiber\\dist\\x.js')?.name).toBe('@react-three/fiber');
    expect(packageRoot('/r/src/x.ts')).toBeNull();
  });

  it('refuses two copies of a single-instance package', () => {
    const one = ['/r/node_modules/.pnpm/three@0.186.1/node_modules/three/build/three.module.js', '/r/node_modules/.pnpm/three@0.186.1/node_modules/three/examples/jsm/environments/RoomEnvironment.js'];
    expect(duplicatePackages(one).size).toBe(0);
    const two = [...one, '/r/node_modules/.pnpm/three@0.170.0/node_modules/three/build/three.module.js', '/r/node_modules/.pnpm/zod@4.5.4/node_modules/zod/index.js', '/r/node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.js'];
    const dup = duplicatePackages(two);
    // zod is not on the single-instance list
    expect([...dup.keys()]).toEqual(['three']);
    expect(() => assertBundleFiles(two, '/r', ['src'], 'x')).toThrow(/two copies of three/);
  });

  it('reads the files of concatenated modules (production mode drops their root module)', () => {
    const concatenated = { modules: [{ resource: '/r/src/index.ts', buildInfo: { fileDependencies: ['/r/src/index.ts'] } }, { resource: '/r/src/Root.tsx?x=1' }] };
    const plain = { resource: '/r/src/a.css', buildInfo: { fileDependencies: ['/r/src/a.css', '/r/src/b.css'] } };
    expect([...moduleFiles([concatenated, plain, {}])].sort()).toEqual(['/r/src/Root.tsx', '/r/src/a.css', '/r/src/b.css', '/r/src/index.ts']);
  });
});

describe('bundle key', () => {
  it('is one per entry and file state, not per composition', () => {
    const root = repoRoot();
    const inputs = () => ['engines/remotion/src/harness'];
    const fx = (entry: string, composition: string) => target(root, 'engines/remotion/src/fixtures', entry, composition);
    expect(bundleKey(fx('src/index.ts', 'Main'), inputs)).toBe(bundleKey(fx('src/index.ts', 'Gl'), inputs));
    expect(bundleKey(fx('src/index.ts', 'Main'), inputs)).not.toBe(bundleKey(fx('src/leak.ts', 'Main'), inputs));
  });
});
