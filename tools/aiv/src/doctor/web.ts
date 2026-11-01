/**
 * The web engine's doctor section: is the pinned Chrome for Testing installed (--fix installs
 * it), and does a capture page get hardware WebGL / WebGPU? The probe launches the browser, so
 * it runs only when the heavy-job slot is free.
 */
import { acquireHeavy, silentLog, spawnTool } from '@aiv/pipeline';
import type { DoctorItem, DoctorSection } from './types.ts';

const item = (status: DoctorItem['status'], label: string, detail: string, fix?: string): DoctorItem => ({ status, label, detail, ...(fix ? { fix } : {}) });

async function install(root: string): Promise<number> {
  const { installCommand } = await import('@aiv/engine-web');
  const cmd = installCommand(root);
  console.error('[doctor] installing the pinned browser into .cache/browsers (about 170 MB download)…');
  // progress to stderr: stdout may be --json
  const child = spawnTool(cmd.file, cmd.args, { env: cmd.env, stdio: ['ignore', 2, 2] });
  return new Promise((resolve) => {
    child.on('error', () => resolve(1));
    child.on('close', (c) => resolve(c ?? 1));
  });
}

export const webSection: DoctorSection = {
  title: 'web engine (browser, GPU path)',
  async run({ root, fix }) {
    const web = await import('@aiv/engine-web');
    const items: DoctorItem[] = [];
    let pin = web.pinnedBrowser(root);
    if (!pin.installed && fix) {
      const code = await install(root);
      pin = web.pinnedBrowser(root);
      if (code !== 0 || !pin.installed) items.push(item('fail', 'install', `playwright-core install exited ${code}`, 'check the network, then pnpm aiv doctor --fix again'));
    }
    items.push(
      pin.installed
        ? item('ok', 'pinned browser', `Chrome for Testing ${pin.version} (playwright-core ${pin.playwright}) in .cache/browsers`)
        : item('fail', 'pinned browser', `Chrome for Testing ${pin.version} is not installed`, 'pnpm aiv doctor --fix (downloads about 170 MB into .cache/browsers)'),
    );
    const sys = web.systemChrome();
    items.push(item('info', 'system Chrome', sys.found ? `${sys.version ?? 'installed'} (only with --browser system: not pinned)` : 'not found (not needed)'));
    if (!pin.installed) return items;

    const slot = await acquireHeavy({ label: 'doctor GPU probe', wait: false, log: silentLog() });
    if (!slot.ok) {
      items.push(item('info', 'GPU probe', `skipped: ${slot.reason}`));
      return items;
    }
    try {
      const p = await web.probeGpu({ root, log: silentLog() });
      const allow = web.softwareAllowed();
      const gl = p.gpu.webglRenderer;
      items.push(
        !gl
          ? item('fail', 'WebGL', 'unavailable in the capture browser', 'update the GPU driver; check chrome://gpu in the same Chrome build')
          : web.isSoftwareRenderer(gl)
            ? item(allow ? 'warn' : 'fail', 'WebGL', `SOFTWARE: ${gl}`, 'update the GPU driver; renders refuse software GL unless AIV_ALLOW_SOFTWARE_GL=1 (CI only)')
            : item('ok', 'WebGL', `hardware: ${gl}`),
      );
      const g = p.gpu.webgpu;
      items.push(
        !g
          ? item('warn', 'WebGPU', `unavailable: ${p.gpu.webgpuError ?? 'no adapter'} (only WebGPU pages need it)`)
          : g.fallback || web.isSoftwareRenderer(web.webgpuLabel(g))
            ? item('warn', 'WebGPU', `SOFTWARE: ${web.webgpuLabel(g)} (WebGPU pages will refuse to render)`)
            : item('ok', 'WebGPU', `hardware: ${web.webgpuLabel(g)}`),
      );
      items.push(item('info', 'probe', `${p.browser}, new headless, ${p.seconds.toFixed(1)} s`));
    } catch (e) {
      items.push(item('fail', 'GPU probe', (e as Error).message.split('\n')[0], 'pnpm aiv doctor --fix; AIV_DEBUG=1 for details'));
    } finally {
      slot.release();
    }
    return items;
  },
};
