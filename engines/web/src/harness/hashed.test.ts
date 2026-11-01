// The served-file check that keeps a page from rendering pixels the input hash does not pin.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { unhashedFiles } from './adapter.ts';
import { requestedFile } from './server.ts';

const root = mkdtempSync(join(tmpdir(), 'aiv-hashed-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const at = (rel: string) => join(root, ...rel.split('/'));

describe('served files vs the input hash', () => {
  it('passes hashed roots, node_modules and the pre-bundle; names everything else', () => {
    const roots = ['engines/web/src/page', 'packages/core/src', 'videos/demo/src', 'videos/demo/src/index.html'];
    const cache = at('.cache/vite/demo');
    const ok = ['videos/demo/src/index.html', 'videos/demo/src/scene/a.ts', 'packages/core/src/rng.ts', 'engines/web/src/page/index.ts', 'node_modules/.pnpm/three@0.186.1/node_modules/three/build/three.module.js', '.cache/vite/demo/deps/three.js'];
    const bad = ['videos/demo/video.json', 'videos/other/src/x.ts', 'styles-old/tokens.ts', 'packages/core/srcx/a.ts', 'engines/web/package.json'];
    expect(unhashedFiles([...ok, ...bad].map(at), root, roots, cache)).toEqual(bad.map(at));
    // outside the repository altogether
    expect(unhashedFiles([join(tmpdir(), 'elsewhere.ts')], root, roots, cache)).toHaveLength(1);
  });

  it('maps a request to the file it serves: /@fs/ paths and files in the page folder', () => {
    const page = at('videos/demo/src');
    mkdirSync(join(page, 'public'), { recursive: true });
    writeFileSync(join(page, 'data.json'), '{}');
    writeFileSync(join(page, 'public', 'logo.png'), 'x');
    expect(requestedFile('/data.json?t=1', page)).toBe(join(page, 'data.json'));
    expect(requestedFile('/logo.png', page)).toBe(join(page, 'public', 'logo.png'));
    expect(requestedFile('/@fs/C:/dev/x/y.ts', page)).toBe('C:/dev/x/y.ts');
    expect(requestedFile('/@fs/home/u/y.ts', page)).toBe('/home/u/y.ts');
    for (const internal of ['/@vite/client', '/@id/three', '/__aiv/frame?i=1', '/missing.png']) expect(requestedFile(internal, page), internal).toBeNull();
  });
});
