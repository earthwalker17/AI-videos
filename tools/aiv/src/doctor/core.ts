/**
 * Engine-independent doctor sections: toolchain pins, ffmpeg capabilities, Python/uv (advisory
 * until the first Python module lands), PATH traps, host memory, disk and the heavy-job lock.
 */
import { readFileSync, statfsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import {
  DEFAULT_MIN_FREE_MB,
  detectHwEncoder,
  exec,
  ffmpegBin,
  ffmpegVersion,
  findOrphanBrowsers,
  fmtMem,
  hostMemory,
  lockStatus,
  mediaBins,
  pnpmVersion,
  readLocalConfig,
  which,
} from '@aiv/pipeline';
import { versionAtLeast, type DoctorItem, type DoctorSection } from './types.ts';

const ok = (label: string, detail: string): DoctorItem => ({ status: 'ok', label, detail });
const warn = (label: string, detail: string, fix?: string): DoctorItem => ({ status: 'warn', label, detail, ...(fix ? { fix } : {}) });
const fail = (label: string, detail: string, fix?: string): DoctorItem => ({ status: 'fail', label, detail, ...(fix ? { fix } : {}) });
const info = (label: string, detail: string): DoctorItem => ({ status: 'info', label, detail });

export const toolchainSection: DoctorSection = {
  title: 'toolchain',
  async run({ root }) {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { engines?: { node?: string }; packageManager?: string };
    const nodeMin = /(\d+(?:\.\d+)*)/.exec(pkg.engines?.node ?? '')?.[1] ?? '0';
    const node = process.version.slice(1);
    const pnpmPin = /^pnpm@(.+)$/.exec(pkg.packageManager ?? '')?.[1];
    const pnpm = await pnpmVersion();
    return [
      versionAtLeast(node, nodeMin) ? ok('node', `${node} (needs ≥ ${nodeMin})`) : fail('node', `${node} is older than ${nodeMin}`, `install Node ${nodeMin} or newer (see .nvmrc)`),
      !pnpm
        ? fail('pnpm', 'not found', 'corepack enable, or install pnpm')
        : pnpmPin && pnpm !== pnpmPin
          ? warn('pnpm', `${pnpm}, but the repo pins ${pnpmPin}`, `corepack use pnpm@${pnpmPin}`)
          : ok('pnpm', pnpm),
    ];
  },
};

const REQUIRED_ENCODERS = ['libx264', 'ffv1', 'aac', 'pcm_s24le'];
const REQUIRED_FILTERS = ['scale', 'zscale', 'setparams', 'loudnorm', 'ebur128', 'blackdetect', 'freezedetect', 'silencedetect', 'tile', 'amix', 'apad', 'atrim', 'select'];

export const mediaSection: DoctorSection = {
  title: 'ffmpeg',
  async run() {
    const bins = mediaBins();
    if (!bins.ffmpeg || !bins.ffprobe)
      return [fail('ffmpeg', `${!bins.ffmpeg ? 'ffmpeg' : 'ffprobe'} not found (PATH or FFMPEG_BIN / FFPROBE_BIN)`, 'install a full ffmpeg 8 build (Windows: winget install Gyan.FFmpeg)')];
    const items: DoctorItem[] = [];
    const v = await ffmpegVersion();
    items.push(ok('version', `${v.version} · buildconf ${v.buildconfHash}${process.env.FFMPEG_BIN ? ' · FFMPEG_BIN' : ''}`));
    const enc = (await exec(ffmpegBin(), ['-hide_banner', '-encoders'], { timeoutMs: 20_000 })).stdout;
    const encoders = new Set([...enc.matchAll(/^ [VAS][\w.]{5} (\S+)/gm)].map((m) => m[1]));
    const missingEnc = REQUIRED_ENCODERS.filter((e) => !encoders.has(e));
    items.push(missingEnc.length ? fail('encoders', `missing ${missingEnc.join(', ')}`, 'install a full (GPL) ffmpeg build') : ok('encoders', REQUIRED_ENCODERS.join(', ')));
    const fil = (await exec(ffmpegBin(), ['-hide_banner', '-filters'], { timeoutMs: 20_000 })).stdout;
    const filters = new Set([...fil.matchAll(/^ [T.][S.] (\S+)\s+\S+->\S+/gm)].map((m) => m[1]));
    const missingFil = REQUIRED_FILTERS.filter((f) => !filters.has(f));
    items.push(missingFil.length ? fail('filters', `missing ${missingFil.join(', ')}`, 'install a full ffmpeg build (zscale needs libzimg)') : ok('filters', REQUIRED_FILTERS.join(', ')));
    items.push(filters.has('drawtext') ? ok('drawtext', 'contact sheets get frame labels') : warn('drawtext', 'missing: contact sheets are unlabelled'));
    const hw = await detectHwEncoder();
    items.push(info('preview encoder', hw ? `${hw} (hardware, verified with a 1-frame encode)` : 'libx264 ultrafast (no working hardware H.264 encoder)'));
    return items;
  },
};

/** Where standalone uv installs land; anything else is likely a copy bundled with another app. */
function standardUvDirs(): string[] {
  const home = homedir();
  const dirs = [join(home, '.local', 'bin'), join(home, '.cargo', 'bin'), '/usr/local/bin', '/usr/bin', '/opt/homebrew/bin', join(home, 'scoop', 'shims')];
  for (const k of ['UV_INSTALL_DIR', 'XDG_BIN_HOME', 'CARGO_HOME']) if (process.env[k]) dirs.push(k === 'CARGO_HOME' ? join(process.env[k]!, 'bin') : process.env[k]!);
  if (process.env.LOCALAPPDATA) dirs.push(join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links'));
  return dirs.map((d) => normalize(d).toLowerCase());
}

export const pythonSection: DoctorSection = {
  title: 'python (advisory until the first Python module)',
  async run() {
    const items: DoctorItem[] = [];
    const uvPath = which('uv');
    if (!uvPath) items.push(warn('uv', 'not found', 'install a standalone uv ≥ 0.13 (https://docs.astral.sh/uv/getting-started/installation/), then `uv python install 3.13`'));
    else {
      const out = (await exec(uvPath, ['--version'], { timeoutMs: 15_000 }).catch(() => null))?.stdout ?? '';
      const ver = /uv (\d+\.\d+\.\d+)/.exec(out)?.[1] ?? 'unknown';
      const dir = normalize(dirname(uvPath)).toLowerCase();
      const standalone = standardUvDirs().includes(dir) || dir.includes(`${normalize('/WinGet/Packages/').toLowerCase()}astral-sh.uv`);
      if (!versionAtLeast(ver, '0.13')) items.push(warn('uv', `${ver} is older than 0.13`, 'install a standalone uv ≥ 0.13'));
      else items.push(ok('uv', ver));
      if (!standalone) items.push(warn('uv location', 'uv on PATH is not in a standard install location: it may be a copy bundled with another application', 'install a standalone uv and put it first on PATH'));
    }
    const py = which('python') ?? which('python3');
    if (!py) items.push(info('python', 'not on PATH (the repo will use uv-managed Python 3.13)'));
    else {
      const r = await exec(py, ['-c', 'import sys,json;print(json.dumps([sys.version.split()[0], sys.prefix != sys.base_prefix]))'], { timeoutMs: 15_000 }).catch(() => null);
      const [ver, venv] = r?.code === 0 ? (JSON.parse(r.stdout.trim()) as [string, boolean]) : ['unknown', false];
      items.push(venv ? warn('python', `${ver}, but bare python on PATH is a virtual environment (probably another tool's)`, 'run Python through uv (uv run) once the repo has a Python workspace') : info('python', `${ver} on PATH (the repo will pin 3.13 through uv)`));
    }
    return items;
  },
};

export const pathTrapsSection: DoctorSection = {
  title: 'PATH traps',
  async run() {
    const items: DoctorItem[] = [];
    const convert = which('convert');
    const sysRoot = normalize(process.env.SystemRoot ?? 'C:\\Windows').toLowerCase();
    if (!convert) items.push(info('convert', 'not on PATH'));
    // never execute the Windows volume converter, not even with --version
    else if (process.platform === 'win32' && normalize(convert).toLowerCase().startsWith(sysRoot))
      items.push(warn('convert', "'convert' is the Windows disk-conversion tool, not ImageMagick", 'never call convert; use magick (ImageMagick 7), ffmpeg or sharp'));
    else {
      const r = await exec(convert, ['-version'], { timeoutMs: 10_000 }).catch(() => null);
      items.push(/ImageMagick/.test(r?.stdout ?? '') ? ok('convert', 'ImageMagick') : warn('convert', 'not ImageMagick', 'use magick, ffmpeg or sharp'));
    }
    items.push(which('magick') ? ok('magick', 'ImageMagick 7 on PATH') : info('magick', 'not installed (optional; ffmpeg covers the pipeline)'));
    return items;
  },
};

export const hostSection: DoctorSection = {
  title: 'host',
  async run({ root }) {
    const items: DoctorItem[] = [];
    let minFree = DEFAULT_MIN_FREE_MB;
    try {
      const cfg = readLocalConfig(root);
      minFree = cfg.minFreeMB ?? minFree;
      items.push(ok('aiv.local.json', Object.keys(cfg).length ? `keys: ${Object.keys(cfg).join(', ')}` : 'absent (defaults)'));
    } catch (e) {
      items.push(fail('aiv.local.json', (e as Error).message.split('\n')[0], 'fix or delete aiv.local.json'));
    }
    const mem = await hostMemory();
    items.push(mem.availMB >= minFree ? ok('memory', fmtMem(mem)) : warn('memory', `${fmtMem(mem)}: below the ${minFree} MB a heavy job needs`, 'close unused apps before rendering'));
    const s = statfsSync(root);
    const freeGB = (Number(s.bavail) * Number(s.bsize)) / 2 ** 30;
    items.push(freeGB >= 10 ? ok('disk', `${freeGB.toFixed(1)} GB free`) : freeGB >= 2 ? warn('disk', `${freeGB.toFixed(1)} GB free (renders need several GB)`, 'delete old out/ runs') : fail('disk', `${freeGB.toFixed(1)} GB free`, 'free disk space before rendering'));
    const lock = lockStatus();
    items.push(info('heavy-job lock', lock.held ? `held by ${lock.info?.owner ?? '?'} (pid ${lock.info?.pid ?? '?'}, heartbeat ${lock.heartbeatAgeS} s${lock.stale ? ', stale: will be reclaimed' : ''})` : 'free'));
    const orphans = await findOrphanBrowsers(root);
    items.push(orphans.length ? warn('capture browsers', `${orphans.length} browser process(es) on this repo's profiles`, 'they are swept automatically by the next heavy job; or close them') : ok('capture browsers', 'none running'));
    return items;
  },
};

export const CORE_SECTIONS: DoctorSection[] = [toolchainSection, mediaSection, pythonSection, pathTrapsSection, hostSection];
