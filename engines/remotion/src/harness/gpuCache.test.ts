/**
 * The GPU program cache's store handling, on plain folders (no browser): a session works on a
 * copy, commit makes the copy the store with its host, a store of another host is not served,
 * and working folders of dead processes are swept while the profile link never takes the cache
 * with it.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gpuCacheKey, gpuCacheRoot, openGpuCache, type GpuHost } from './gpuCache.ts';

const HOST: GpuHost = { browser: 'chrome-headless-shell 1.2.3', gl: 'angle', renderer: 'ANGLE (Test GPU, D3D11)', driver: 'Test 1.0' };
const roots: string[] = [];
const tempRoot = () => {
  const r = mkdtempSync(join(tmpdir(), 'aiv-gpucache-test-'));
  roots.push(r);
  return r;
};
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe('gpu program cache', () => {
  it('keys a store by browser version and gl backend', () => {
    expect(gpuCacheKey('157.0.8080.0', 'angle')).toBe('157.0.8080.0-angle');
    expect(gpuCacheKey('a/b c', 'swangle')).toBe('a_b_c-swangle');
  });

  it('starts cold, commits the working copy as the store, and seeds the next session from it', async () => {
    const root = tempRoot();
    const key = gpuCacheKey('1.2.3', 'angle');
    const a = openGpuCache(root, key);
    expect(a.builtOn).toBeNull();
    expect(a.serves(HOST)).toBe(true);
    writeFileSync(join(a.work, 'entry'), 'program');
    await a.commit(HOST);
    const base = join(gpuCacheRoot(root), key);
    expect(readFileSync(join(base, 'store', 'entry'), 'utf8')).toBe('program');
    expect(JSON.parse(readFileSync(join(base, 'store.json'), 'utf8'))).toEqual(HOST);
    expect(existsSync(a.work)).toBe(false);

    const b = openGpuCache(root, key);
    expect(b.builtOn).toEqual(HOST);
    expect(b.serves(HOST)).toBe(true);
    expect(readFileSync(join(b.work, 'entry'), 'utf8')).toBe('program');
    // the store is not touched while a session works on its copy
    writeFileSync(join(b.work, 'entry2'), 'more');
    expect(existsSync(join(base, 'store', 'entry2'))).toBe(false);
    b.discard();
    expect(existsSync(b.work)).toBe(false);
    expect(readdirSync(join(base, 'store'))).toEqual(['entry']);
  });

  it('does not serve a store built on another host, and reset empties it', async () => {
    const root = tempRoot();
    const key = gpuCacheKey('1.2.3', 'angle');
    const a = openGpuCache(root, key);
    writeFileSync(join(a.work, 'entry'), 'program');
    await a.commit(HOST);
    const b = openGpuCache(root, key);
    expect(b.serves({ ...HOST, driver: 'Test 2.0' })).toBe(false);
    expect(b.serves({ ...HOST, renderer: 'ANGLE (Other GPU, D3D11)' })).toBe(false);
    b.reset();
    expect(b.builtOn).toBeNull();
    expect(readdirSync(b.work)).toEqual([]);
    const base = join(gpuCacheRoot(root), key);
    expect(existsSync(join(base, 'store'))).toBe(false);
    expect(existsSync(join(base, 'store.json'))).toBe(false);
    await b.commit({ ...HOST, driver: 'Test 2.0' });
    expect(JSON.parse(readFileSync(join(base, 'store.json'), 'utf8')).driver).toBe('Test 2.0');
  });

  it('trusts no store without its host record', () => {
    const root = tempRoot();
    const key = gpuCacheKey('1.2.3', 'angle');
    const store = join(gpuCacheRoot(root), key, 'store');
    mkdirSync(store, { recursive: true });
    writeFileSync(join(store, 'entry'), 'program');
    const s = openGpuCache(root, key);
    expect(s.builtOn).toBeNull();
    expect(readdirSync(s.work)).toEqual([]);
    s.discard();
  });

  it('sweeps working folders of dead processes, keeps its own', () => {
    const root = tempRoot();
    const key = gpuCacheKey('1.2.3', 'angle');
    const base = join(gpuCacheRoot(root), key);
    // pid 0x7ffffff0 does not exist
    const dead = join(base, `work-${0x7ffffff0}-0`);
    const deadOld = join(base, `old-${0x7ffffff0}-3`);
    mkdirSync(dead, { recursive: true });
    mkdirSync(deadOld, { recursive: true });
    const a = openGpuCache(root, key);
    expect(existsSync(dead)).toBe(false);
    expect(existsSync(deadOld)).toBe(false);
    const b = openGpuCache(root, key);
    expect(existsSync(a.work)).toBe(true);
    a.discard();
    b.discard();
  });

  it('links a profile to the working copy; deleting the profile keeps the cache', () => {
    const root = tempRoot();
    const s = openGpuCache(root, gpuCacheKey('1.2.3', 'angle'));
    const profile = join(root, 'profile');
    mkdirSync(profile);
    s.link(profile);
    writeFileSync(join(profile, 'Default', 'GPUCache', 'index'), 'x');
    expect(readFileSync(join(s.work, 'index'), 'utf8')).toBe('x');
    // as Remotion's and the engine's own cleanup delete the profile
    rmSync(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
    expect(existsSync(profile)).toBe(false);
    expect(readFileSync(join(s.work, 'index'), 'utf8')).toBe('x');
    s.discard();
  });
});
