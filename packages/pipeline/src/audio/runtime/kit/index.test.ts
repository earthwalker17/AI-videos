// The kit is shared by every scored video and covered by every audio hash: it must stay pure DSP.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as kit from './index.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const sources = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

describe('the score kit', () => {
  it('imports only @aiv/core, the score contract (../types.ts) and itself: no video, no Node, no stage machinery', () => {
    for (const f of sources) {
      const text = readFileSync(`${dir}/${f}`, 'utf8');
      const specs = [...text.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
      for (const s of specs) expect(s === '@aiv/core' || s === '../types.ts' || /^\.\/[a-z]+\.ts$/.test(s), `${f}: ${s}`).toBe(true);
    }
  });

  it('exports every module from its index', () => {
    const index = readFileSync(`${dir}/index.ts`, 'utf8');
    for (const f of sources.filter((x) => x !== 'index.ts')) expect(index, f).toContain(`export * from './${f}';`);
    for (const name of ['Mixer', 'master', 'timeline', 'Osc', 'adsr', 'delay', 'duckGain', 'pluck', 'ModalBank', 'convolver', 'hallIr', 'fft', 'norm', 'blep', 'fmBell']) expect(kit, name).toHaveProperty(name);
  });
});
