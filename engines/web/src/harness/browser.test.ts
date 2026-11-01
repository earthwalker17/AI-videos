import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chromeArgs, PLAYWRIGHT_DISABLED_FEATURES, playwrightDir } from './browser.ts';

/** The disabledFeatures array of the INSTALLED playwright-core (chromiumSwitches.ts, bundled). */
function installedDisabledFeatures(): string[] {
  const src = readFileSync(join(playwrightDir(), 'lib', 'coreBundle.js'), 'utf8');
  const m = /disabledFeatures = \[([\s\S]*?)\]\.filter\(Boolean\)/.exec(src);
  if (!m) throw new Error('disabledFeatures not found in playwright-core: the bundle layout changed, re-check browser.ts by hand');
  return [...m[1].matchAll(/^\s*"([A-Za-z]+)"/gm)].map((x) => x[1]);
}

describe('chrome flags', () => {
  it('our --disable-features is a superset of what playwright-core passes (Chrome keeps only the last switch)', () => {
    const theirs = installedDisabledFeatures();
    expect(theirs.length).toBeGreaterThan(5);
    const missing = theirs.filter((f) => !PLAYWRIGHT_DISABLED_FEATURES.includes(f));
    expect(missing, 'add these to PLAYWRIGHT_DISABLED_FEATURES in browser.ts').toEqual([]);
  });

  it('passes one --disable-features switch with both lists, ANGLE D3D11 on Windows, sRGB colour', () => {
    const args = chromeArgs('win32');
    const df = args.filter((a) => a.startsWith('--disable-features='));
    expect(df).toHaveLength(1);
    expect(df[0]).toContain('Translate');
    expect(df[0]).toContain('CalculateNativeWinOcclusion');
    expect(args).toContain('--use-angle=d3d11');
    expect(args).toContain('--force-color-profile=srgb');
    expect(chromeArgs('linux').some((a) => a.startsWith('--use-angle'))).toBe(false);
  });
});
