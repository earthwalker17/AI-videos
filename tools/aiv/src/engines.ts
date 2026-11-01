// The engine registry: video.json `engine` → its adapter. Loaded lazily, so commands that render
// nothing (doctor, qa, release) do not pay for Vite, Playwright or webpack at startup.
import { EXIT, ExitError } from '@aiv/core';
import type { EngineAdapter } from '@aiv/pipeline';

export interface EngineOptions {
  /** web engine: pinned Chrome for Testing (default) or the installed Chrome */
  browser?: 'pinned' | 'system';
}

const ENGINES: Record<string, (o: EngineOptions) => Promise<EngineAdapter>> = {
  web: async (o) => (await import('@aiv/engine-web')).webAdapter({ browser: o.browser }),
  remotion: async (o) => {
    // Remotion renders with its own pinned headless shell; --gl follows AIV_ALLOW_SOFTWARE_GL
    if (o.browser === 'system') throw new ExitError(EXIT.USAGE, "--browser system applies to the web engine; the remotion engine always renders with Remotion's pinned Chrome Headless Shell");
    return (await import('@aiv/engine-remotion')).remotionAdapter();
  },
};

export const engineNames = (): string[] => Object.keys(ENGINES);

export async function engineAdapter(name: string, o: EngineOptions = {}): Promise<EngineAdapter> {
  const make = ENGINES[name];
  if (!make) throw new ExitError(EXIT.ERROR, `video.json engine '${name}' has no adapter (known: ${engineNames().join(', ')})`);
  return make(o);
}
