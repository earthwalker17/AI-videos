import { defineConfig } from 'vitest/config';

// One worker: the reference host has 7.6 GB RAM shared with its GPU, and some
// tests spawn ffmpeg.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'engines/*/src/**/*.test.ts', 'tools/*/src/**/*.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 60_000,
  },
});
