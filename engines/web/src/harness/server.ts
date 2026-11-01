// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/capture/server.ts
/**
 * The page server: a Vite dev server rooted at the target's page folder, plus the frame sink.
 *
 * A capture server serves one immutable checkout, so no HMR and no file watcher. The WebSocket
 * stays: Vite injects its client into every page and the client logs an error without it.
 * Dependencies are pre-bundled from the page's index.html at EVERY start (cache per target under
 * .cache/vite/): Vite keys its cache on the lockfile, not on the imports, so a stale cache misses
 * an import added since the last run and re-bundles mid-session. A re-optimisation during a
 * capture is an error: Vite would reload the page or serve a second copy of a dependency (two
 * three.js instances; seen with a new three/addons import).
 *
 * POST /__aiv/frame?i=&w=&h=[&ms=] carries one frame's RGBA bytes; the reply comes only after the
 * handler resolved (the frame is in the encoder), 500 + the message when it threw. Bound to
 * 127.0.0.1 only.
 *
 * servedFiles() lists every file the page got: the module graph (imports, ?url/?raw assets)
 * plus files fetched by URL (/@fs/… and the page folder), so the adapter can check them all
 * against the input hash.
 */
import { statSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join, relative, resolve, sep } from 'node:path';
import type { Log } from '@aiv/pipeline';
import { createLogger, createServer, type Logger, type Plugin } from 'vite';
import { FRAME_SINK } from '../page/index.ts';

export interface FrameEvent {
  i: number;
  width: number;
  height: number;
  /** the page's render + readback time, ms */
  ms?: number;
  rgba: Buffer;
}

export type FrameHandler = (ev: FrameEvent) => Promise<void>;

export interface PageServer {
  /** http://127.0.0.1:<port> */
  url: string;
  setHandler(h: FrameHandler | null): void;
  /** Vite re-optimised dependencies after start (the page may now mix two copies of a module) */
  reoptimized(): string | null;
  /** absolute paths of every file served to the page so far */
  servedFiles(): string[];
  /** the dependency pre-bundle folder (built from node_modules) */
  cacheDir: string;
  close(): Promise<void>;
}

export interface PageServerOptions {
  /** repo root (the only folder Vite may serve files from) */
  root: string;
  /** absolute folder served as / (the entry's folder) */
  pageDir: string;
  /** absolute entry html */
  entry: string;
  /** cache folder name under .cache/vite/ */
  cacheKey: string;
  /** dependencies the page imports dynamically (the crawl from index.html cannot see them) */
  include?: string[];
  log: Log;
}

const isFile = (p: string) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

/** The file a plain GET maps to: /@fs/<abs> or a file in the page folder (or its public/), else null. */
export function requestedFile(url: string, pageDir: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url, 'http://x').pathname);
  } catch {
    return null;
  }
  if (path.startsWith('/@fs/')) {
    const abs = path.slice('/@fs'.length);
    // Windows: /@fs/C:/dev/… → C:/dev/…
    return /^\/[A-Za-z]:\//.test(abs) ? abs.slice(1) : abs;
  }
  // Vite's own endpoints and the frame sink are not files
  if (path.startsWith('/@') || path.startsWith('/__')) return null;
  for (const base of [pageDir, join(pageDir, 'public')]) {
    const f = resolve(base, `.${path}`);
    if (isFile(f)) return f;
  }
  return null;
}

function frameSink(getHandler: () => FrameHandler | null, record: (url: string) => void): Plugin {
  return {
    name: 'aiv-frame-sink',
    configureServer(server) {
      // before Vite's own middlewares: every request the page makes passes here
      server.middlewares.use((req, _res, next) => {
        if (req.method === 'GET' && req.url) record(req.url);
        next();
      });
      server.middlewares.use(FRAME_SINK, (req, res) => {
        const reply = (status: number, body: string) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(body);
        };
        if (req.method !== 'POST') return reply(405, 'POST only');
        const q = new URL(req.url ?? '', 'http://x').searchParams;
        // Number(null) is 0: a missing parameter must not read as frame 0
        const int = (k: string) => (/^\d+$/.test(q.get(k) ?? '') ? Number(q.get(k)) : NaN);
        const i = int('i');
        const width = int('w');
        const height = int('h');
        const ms = q.has('ms') ? Number(q.get('ms')) : undefined;
        if (![i, width, height].every(Number.isInteger) || !width || !height) return reply(400, 'expected ?i=&w=&h= as integers');
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('error', (e) => reply(400, `request error: ${e.message}`));
        req.on('end', () => {
          const rgba = Buffer.concat(chunks);
          if (rgba.length !== width * height * 4) return reply(400, `frame ${i}: ${rgba.length} bytes, expected ${width * height * 4} (${width}x${height} RGBA)`);
          const handler = getHandler();
          if (!handler) return reply(503, 'no capture in progress');
          handler({ i, width, height, ms: Number.isFinite(ms) ? ms : undefined, rgba }).then(
            () => reply(200, 'ok'),
            (e: unknown) => reply(500, e instanceof Error ? e.message : String(e)),
          );
        });
      });
    },
  };
}

/** Vite's info lines are noise here, except the one that says it re-bundled dependencies. */
function viteLogger(log: Log, onReoptimize: (msg: string) => void): Logger {
  const base = createLogger('info', { allowClearScreen: false });
  return {
    ...base,
    info(msg) {
      if (/optimized dependencies changed|new dependencies optimized|reloading/i.test(msg)) onReoptimize(msg.trim());
    },
    warn: (msg) => log.warn(`vite: ${msg.trim()}`),
    warnOnce: (msg) => log.warn(`vite: ${msg.trim()}`),
    error: (msg) => log.error(`vite: ${msg.trim()}`),
  };
}

export async function startPageServer(o: PageServerOptions): Promise<PageServer> {
  let handler: FrameHandler | null = null;
  let reopt: string | null = null;
  const fetched = new Set<string>();
  const cacheDir = join(o.root, '.cache', 'vite', o.cacheKey);
  const server = await createServer({
    configFile: false,
    root: o.pageDir,
    base: '/',
    // no index.html fallback: a missing asset must 404, not quietly return the page
    appType: 'mpa',
    cacheDir,
    // .env files near a video are never read into a page
    envDir: false,
    clearScreen: false,
    customLogger: viteLogger(o.log, (m) => (reopt ??= m)),
    plugins: [
      frameSink(
        () => handler,
        (url) => {
          const f = requestedFile(url, o.pageDir);
          if (f) fetched.add(resolve(f));
        },
      ),
    ],
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: true,
      hmr: false,
      // the harness collects the page console itself (fail-fast rules, error context)
      forwardConsole: false,
      watch: null,
      fs: { strict: true, allow: [o.root] },
    },
    optimizeDeps: {
      entries: [relative(o.pageDir, o.entry).split(sep).join('/')],
      include: o.include ?? [],
      force: true,
    },
  });
  await server.listen();
  const addr = server.httpServer?.address() as AddressInfo | null;
  if (!addr || typeof addr !== 'object') {
    await server.close();
    throw new Error('the page server did not bind a port');
  }
  return {
    url: `http://127.0.0.1:${addr.port}`,
    setHandler: (h) => (handler = h),
    reoptimized: () => reopt,
    servedFiles: () => [...new Set([...[...server.environments.client.moduleGraph.fileToModulesMap.keys()].map((f) => resolve(f)), ...fetched])].sort(),
    cacheDir,
    close: () => server.close(),
  };
}
