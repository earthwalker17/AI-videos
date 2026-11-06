import { existsSync, readFileSync } from 'node:fs';
import { configDefaults, defineConfig } from 'vitest/config';

// Published videos are frozen (catalog.json `frozen`): rebuilt from their release tag, so
// their tests are not run against today's toolchain (as eslint.config.js and tsconfig.json).
const catalogFile = new URL('./catalog.json', import.meta.url);
const FROZEN: string[] = existsSync(catalogFile) ? JSON.parse(readFileSync(catalogFile, 'utf8')).frozen.map((p: string) => `${p}/**`) : [];

// One worker: the reference host has 7.6 GB RAM shared with its GPU, and some
// tests spawn ffmpeg.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'engines/*/src/**/*.test.ts', 'tools/*/src/**/*.test.ts', 'videos/*/audio/**/*.test.ts', 'videos/*/src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, ...FROZEN],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 60_000,
  },
});
