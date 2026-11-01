/**
 * The Remotion engine's doctor section: is Remotion's Chrome Headless Shell installed in
 * node_modules/.remotion (--fix downloads it, once per repo), and does it get hardware WebGL
 * with the render's --gl flag (angle; swangle only with AIV_ALLOW_SOFTWARE_GL=1)? The probe
 * launches the shell, so it runs only when the heavy-job slot is free and memory allows.
 */
import { acquireHeavy, isSoftwareRenderer, silentLog, softwareAllowed } from '@aiv/pipeline';
import type { DoctorItem, DoctorSection } from './types.ts';

const item = (status: DoctorItem['status'], label: string, detail: string, fix?: string): DoctorItem => ({ status, label, detail, ...(fix ? { fix } : {}) });

export const remotionSection: DoctorSection = {
  title: 'remotion engine (headless shell, GPU path)',
  async run({ root, fix }) {
    const rem = await import('@aiv/engine-remotion');
    const items: DoctorItem[] = [];
    let shell = rem.headlessShell(root);
    if (!shell.ok && fix) {
      console.error(`[doctor] installing Remotion's Chrome Headless Shell ${shell.expected ?? ''} into node_modules/.remotion (about 120 MB download)…`);
      try {
        shell = await rem.installHeadlessShell(root);
      } catch (e) {
        items.push(item('fail', 'install', (e as Error).message.split('\n')[0], 'check the network, then pnpm aiv doctor --fix again'));
      }
    }
    items.push(
      shell.ok
        ? item('ok', 'headless shell', `Chrome Headless Shell ${shell.installed} (Remotion ${rem.REMOTION_VERSION}) in node_modules/.remotion`)
        : item('fail', 'headless shell', shell.installed ? `${shell.installed} installed, Remotion ${rem.REMOTION_VERSION} expects ${shell.expected}` : `not installed (Remotion ${rem.REMOTION_VERSION} expects ${shell.expected})`, 'pnpm aiv doctor --fix (downloads about 120 MB into node_modules/.remotion)'),
    );
    items.push(item('info', 'licence', 'Remotion is source-available (Remotion License): free for individuals and organisations of up to 3 people, a company licence otherwise (https://www.remotion.dev/license)'));
    if (!shell.ok) return items;

    const slot = await acquireHeavy({ label: 'doctor GPU probe (remotion)', wait: false, log: silentLog() });
    if (!slot.ok) {
      items.push(item('info', 'GPU probe', `skipped: ${slot.reason}`));
      return items;
    }
    try {
      const gl = rem.defaultGl();
      const p = await rem.probeGpu({ root, gl, log: silentLog() });
      const r = p.webgl.renderer;
      const allow = softwareAllowed();
      items.push(
        !r
          ? item('fail', 'WebGL', `unavailable with --gl=${gl}: ${p.webgl.error ?? 'no context'}`, 'update the GPU driver; check pnpm exec remotion gpu --gl=angle')
          : isSoftwareRenderer(r)
            ? item(allow ? 'warn' : 'fail', 'WebGL', `SOFTWARE (--gl=${gl}): ${r}`, 'update the GPU driver; renders refuse software GL unless AIV_ALLOW_SOFTWARE_GL=1 (CI only)')
            : item('ok', 'WebGL', `hardware (--gl=${gl}): ${r}`),
      );
      items.push(item('info', 'probe', `${p.browser}, ${p.seconds.toFixed(1)} s`));
    } catch (e) {
      items.push(item('fail', 'GPU probe', (e as Error).message.split('\n')[0], 'pnpm aiv doctor --fix; AIV_DEBUG=1 for details'));
    } finally {
      slot.release();
    }
    return items;
  },
};
