import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { computeInputHash, renderSettings } from '../runner/inputHash.ts';
import { PROFILES } from '../runner/profiles.ts';
import { resolveTarget } from '../runner/target.ts';
import { tempRepo, type TempRepo } from '../testing.ts';
import { audioRoots, computeAudioHash, describeAudioChanges, modulesOutsideAudioHash, sharedCodeMismatches } from './hash.ts';

let repo: TempRepo;
afterEach(() => repo?.cleanup());

const adapter = { name: 'fake', adapterVersion: '1', inputs: () => ['engines/fake/page'] };
const picture = () => {
  const target = resolveTarget('demo', repo.root);
  return computeInputHash({ target, adapter, settings: renderSettings(target, PROFILES.draft, { width: 160, height: 90 }) }).hash;
};
const audio = () => computeAudioHash(resolveTarget('demo', repo.root));

function scratch(): TempRepo {
  const r = tempRepo();
  r.write('videos/demo/src/cues.ts', 'export const cues = {};\n');
  r.write('videos/demo/audio/index.ts', 'export default { tracks: {} };\n');
  r.write('packages/pipeline/src/audio/runtime/render.ts', 'export {};\n');
  return r;
}

describe('audio input hash', () => {
  it('covers the score, the cue sheet, @aiv/core and the runtime; the picture hash ignores the score', () => {
    repo = scratch();
    expect(audio().roots).toEqual(['packages/core/src', 'packages/pipeline/src/audio/runtime', 'videos/demo/audio', 'videos/demo/src/cues.ts']);
    expect(audio().inputs.map((f) => f.path)).toEqual(['packages/core/src/index.ts', 'packages/pipeline/src/audio/runtime/render.ts', 'videos/demo/audio/index.ts', 'videos/demo/src/cues.ts']);
    let pic = picture();
    let aud = audio().hash;
    const step = (what: string, edit: () => void, expectPicture: boolean, expectAudio: boolean) => {
      edit();
      const [p, a] = [picture(), audio().hash];
      expect(p !== pic, `${what}: picture hash changed`).toBe(expectPicture);
      expect(a !== aud, `${what}: audio hash changed`).toBe(expectAudio);
      [pic, aud] = [p, a];
    };
    step('the score', () => repo.write('videos/demo/audio/index.ts', 'export default { tracks: { a: () => [] } };\n'), false, true);
    step('a new score module', () => repo.write('videos/demo/audio/drums.ts', 'export {};\n'), false, true);
    step('the library pins', () => repo.write('videos/demo/audio/library.json', '{"schemaVersion":1,"libraries":[]}\n'), false, true);
    step('the cue sheet', () => repo.write('videos/demo/src/cues.ts', 'export const cues = { a: 1 };\n'), true, true);
    step('other picture code', () => repo.write('videos/demo/src/Scene.tsx', 'export {};\n'), true, false);
    step('the synthesis runtime', () => repo.write('packages/pipeline/src/audio/runtime/render.ts', 'export const x = 1;\n'), false, true);
    step('the stage orchestration', () => repo.write('packages/pipeline/src/audio/stage.ts', 'export {};\n'), false, false);
    step('@aiv/core', () => repo.write('packages/core/src/index.ts', 'export const x = 2;\n'), true, true);
    step('the lockfile', () => repo.write('pnpm-lock.yaml', "lockfileVersion: '9.1'\n"), true, true);
    step('notes and tests', () => {
      repo.write('videos/demo/audio/NOTES.md', '# score notes\n');
      repo.write('videos/demo/audio/index.test.ts', 'test;\n');
    }, false, false);
  });

  it('names what changed', () => {
    repo = scratch();
    const before = audio();
    repo.write('videos/demo/audio/index.ts', 'export default 2;\n');
    repo.write('videos/demo/audio/new.ts', 'export {};\n');
    repo.write('videos/demo/audio/library.json', '{}\n');
    expect(describeAudioChanges(before, audio())).toBe('audio/library.json changed; changed videos/demo/audio/index.ts; added videos/demo/audio/library.json, videos/demo/audio/new.ts');
  });

  it('modules outside the roots are reported; node_modules and the code repo’s shared roots are not', () => {
    repo = scratch();
    const at = (root: string, rel: string) => join(root, ...rel.split('/'));
    const roots = audioRoots('videos/demo');
    const code = join(repo.root, '..', 'code-repo');
    const files = [
      at(repo.root, 'videos/demo/audio/index.ts'),
      at(repo.root, 'videos/demo/src/cues.ts'),
      at(repo.root, 'videos/demo/src/other.ts'),
      at(repo.root, 'packages/pipeline/src/qa/qa.ts'),
      at(repo.root, 'node_modules/.pnpm/zod@4/node_modules/zod/index.js'),
      at(code, 'packages/pipeline/src/audio/runtime/render.ts'),
      at(code, 'packages/core/src/rng.ts'),
      at(code, 'packages/pipeline/src/audio/stage.ts'),
      at(code, 'videos/other/audio/index.ts'),
    ];
    expect(modulesOutsideAudioHash(files, repo.root, roots, code)).toEqual([files[2], files[3], files[7], files[8]]);
    expect(modulesOutsideAudioHash(files.slice(0, 5), repo.root, roots, repo.root)).toEqual([files[2], files[3]]);
  });

  it("another repository's runtime and @aiv/core must be byte-identical to the target's hashed copies", () => {
    repo = scratch();
    const code = join(repo.root, 'code-repo');
    const put = (rel: string, text: string) => {
      const f = join(code, ...rel.split('/'));
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, text);
      return f;
    };
    const same = put('packages/pipeline/src/audio/runtime/render.ts', 'export {};\n');
    const core = put('packages/core/src/index.ts', 'export const x = 99;\n');
    const extra = put('packages/core/src/rng.ts', 'export {};\n');
    const notShared = put('packages/pipeline/src/audio/stage.ts', 'export {};\n');
    const inputs = audio().inputs;
    expect(sharedCodeMismatches([same, core, extra, notShared, core], repo.root, code, inputs)).toEqual(['packages/core/src/index.ts', 'packages/core/src/rng.ts']);
    // the code's own repository: its hash covers what ran
    expect(sharedCodeMismatches([core], code, code, [])).toEqual([]);
  });
});
