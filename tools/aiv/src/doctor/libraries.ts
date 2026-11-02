/**
 * The sample-library store: every file a video pins in audio/library.json must be in
 * .cache/libraries/<id>@<commit>/ with its pinned bytes and sha256, or `aiv audio` fails on it.
 * --fix fills what is missing or wrong: from the seed checkout in aiv.local.json librarySeeds
 * (copied only when its sha256 matches), else downloaded at the pinned commit. CI never
 * downloads (it runs `doctor --fix` for the browsers, but no score): there a missing file is a
 * warning, so a rate limit or an LFS quota can never fail a build that does not need the samples.
 */
import { fillStoreFile, pinnedLibraries, readLocalConfig, storeFileState, type Fetcher } from '@aiv/pipeline';
import type { DoctorItem, DoctorSection } from './types.ts';

const item = (status: DoctorItem['status'], label: string, detail: string, fix?: string): DoctorItem => ({ status, label, detail, ...(fix ? { fix } : {}) });

export interface LibrariesOptions {
  /** the download function (tests pass a double; they never touch the network) */
  fetch?: Fetcher;
  /** whether --fix may download (default: not on CI) */
  download?: boolean;
}

export function librariesSection(o: LibrariesOptions = {}): DoctorSection {
  return {
    title: 'sample libraries',
    async run({ root, fix }) {
      const download = o.download ?? !process.env.CI;
      const scan = pinnedLibraries(root);
      const items: DoctorItem[] = scan.errors.map((e) => item('fail', 'library.json', e, 'fix the file (aiv check names the problem), or re-pin with aiv audio <slug> --pin'));
      if (!scan.libraries.length) {
        if (!items.length) items.push(item('info', 'libraries', 'no video pins a sample library (videos/*/audio/library.json)'));
        return items;
      }
      const seeds = readLocalConfig(root).librarySeeds ?? {};
      for (const lib of scan.libraries) {
        const label = `${lib.id}@${lib.commit.slice(0, 12)}`;
        const seed = seeds[lib.id];
        let bad = lib.files.filter((f) => storeFileState(root, lib, f) !== 'ok');
        const failures: string[] = [];
        if (bad.length && fix) {
          let copied = 0;
          let downloaded = 0;
          for (const f of bad) {
            const r = await fillStoreFile({ root, lib, file: f, seed, fetch: o.fetch, download });
            if (!r.ok) failures.push(`${f.path}: ${r.detail}`);
            else if (r.from === 'seed') copied++;
            else downloaded++;
          }
          if (copied || downloaded) items.push(item('info', label, `filled ${copied} file(s) from the seed, downloaded ${downloaded}`));
          bad = lib.files.filter((f) => storeFileState(root, lib, f) !== 'ok');
        }
        const where = `.cache/libraries/${lib.id}@${lib.commit}`;
        if (!bad.length) {
          items.push(item('ok', label, `${lib.files.length} pinned file(s) in ${where} (${lib.pinnedBy.join(', ')})${seed ? ' · seed set' : ''}`));
          continue;
        }
        const listed = failures.length ? `: ${failures.slice(0, 3).join('; ')}${failures.length > 3 ? ` and ${failures.length - 3} more` : ''}` : ` (first: ${bad[0].path})`;
        const detail = `${bad.length} of ${lib.files.length} pinned file(s) missing or not the pinned bytes in ${where}${listed}`;
        if (!download) items.push(item('warn', label, `${detail}; CI never downloads sample libraries (it runs no score)`));
        else
          items.push(
            item('fail', label, detail, fix ? `set librarySeeds.${lib.id} in aiv.local.json to a checkout of ${lib.repo} at ${lib.commit.slice(0, 12)}, or check the network` : 'pnpm aiv doctor --fix'),
          );
      }
      return items;
    },
  };
}
