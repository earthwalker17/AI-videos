// The engine registry: video.json `engine` → its adapter. Loaded lazily, so commands that render
// nothing (doctor, qa, release) do not pay for Vite or Playwright at startup.
import { EXIT, ExitError } from '@aiv/core';
import type { EngineAdapter } from '@aiv/pipeline';

export interface EngineOptions {
  /** web engine: pinned Chrome for Testing (default) or the installed Chrome */
  browser?: 'pinned' | 'system';
}

const ENGINES: Record<string, (o: EngineOptions) => Promise<EngineAdapter>> = {
  web: async (o) => (await import('@aiv/engine-web')).webAdapter({ browser: o.browser }),
};

export const engineNames = (): string[] => Object.keys(ENGINES);

export async function engineAdapter(name: string, o: EngineOptions = {}): Promise<EngineAdapter> {
  const make = ENGINES[name];
  if (!make) throw new ExitError(EXIT.ERROR, `video.json engine '${name}' has no adapter (known: ${engineNames().join(', ')})`);
  return make(o);
}
