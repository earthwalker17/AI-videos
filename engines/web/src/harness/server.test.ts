import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, silentLog } from '@aiv/pipeline';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPageServer, type FrameEvent, type PageServer } from './server.ts';

const root = repoRoot();
let dir: string;
let srv: PageServer;

beforeAll(async () => {
  // a page folder inside the repo (Vite may serve only from the repo root)
  mkdirSync(join(root, 'out'), { recursive: true });
  dir = mkdtempSync(join(root, 'out', 'test-server-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>t</title>');
  srv = await startPageServer({ root, pageDir: dir, entry: join(dir, 'index.html'), cacheKey: '_test-server', log: silentLog() });
}, 60_000);
afterAll(async () => {
  await srv?.close();
  rmSync(dir, { recursive: true, force: true });
  rmSync(join(root, '.cache', 'vite', '_test-server'), { recursive: true, force: true });
});

const post = (q: string, bytes: number) => fetch(`${srv.url}/__aiv/frame?${q}`, { method: 'POST', body: new Uint8Array(bytes) });

describe('page server frame sink', () => {
  it('binds 127.0.0.1 only and serves the page; no SPA fallback', async () => {
    expect(srv.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect((await fetch(`${srv.url}/index.html`)).status).toBe(200);
    // a missing asset must be a 404, not the page
    expect((await fetch(`${srv.url}/missing.png`)).status).toBe(404);
  });

  it('answers only after the handler finished, with its error as a 500', async () => {
    const seen: FrameEvent[] = [];
    let finished = false;
    srv.setHandler(async (ev) => {
      seen.push(ev);
      await new Promise((r) => setTimeout(r, 50));
      finished = true;
    });
    const ok = await post('i=3&w=4&h=2&ms=1.5', 4 * 2 * 4);
    expect(ok.status).toBe(200);
    expect(finished).toBe(true);
    expect(seen.map((e) => [e.i, e.width, e.height, e.ms, e.rgba.length])).toEqual([[3, 4, 2, 1.5, 32]]);

    srv.setHandler(async () => {
      throw new Error('encoder gone');
    });
    const bad = await post('i=4&w=4&h=2', 32);
    expect(bad.status).toBe(500);
    expect(await bad.text()).toBe('encoder gone');
    srv.setHandler(null);
  });

  it('rejects malformed frames before the handler sees them', async () => {
    let called = 0;
    srv.setHandler(async () => {
      called++;
    });
    expect((await post('i=1&w=4&h=2', 31)).status).toBe(400);
    expect((await post('w=4&h=2', 32)).status).toBe(400);
    expect((await fetch(`${srv.url}/__aiv/frame?i=1&w=4&h=2`)).status).toBe(405);
    expect(called).toBe(0);
    srv.setHandler(null);
    expect((await post('i=1&w=4&h=2', 32)).status).toBe(503);
  });
});
