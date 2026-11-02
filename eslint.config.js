// ESLint flat config. The determinism block encodes the frame contract
// (docs/ARCHITECTURE.md, decision 7): every frame must be a pure function of its
// index, so frame code may not read clocks, timers or unseeded randomness.
import { existsSync, readFileSync } from 'node:fs';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Published videos are frozen: rebuilt from their release tag, never linted against today's rules.
// The list is generated into catalog.json by `pnpm aiv check --fix` (tsconfig.json gets the same).
const catalogFile = new URL('./catalog.json', import.meta.url);
const FROZEN = existsSync(catalogFile) ? JSON.parse(readFileSync(catalogFile, 'utf8')).frozen.map((p) => `${p}/**`) : [];

const FRAME_CODE = [
  'packages/core/src/**',
  'packages/remotion-kit/src/**',
  'engines/web/src/page/**',
  'templates/*/src/**',
  'videos/*/src/**',
  'styles/**',
  // the engines' test compositions are rendered and compared to exact pixels
  'engines/*/src/fixtures/**',
];

// drei helpers that animate from the wall clock or Math.random. They look fine in a
// live preview and produce different frames per render worker.
const CLOCK_DRIVEN_DREI = [
  'Float',
  'Sparkles',
  'Stars',
  'Cloud',
  'Clouds',
  'MeshDistortMaterial',
  'MeshWobbleMaterial',
  'CameraShake',
  'Trail',
  'AccumulativeShadows',
  'useAnimations',
];

// drei helpers that fetch from a CDN at render time (fonts, HDRIs, decoders, textures): a page
// may only load files the input hash covers, and a fetch can change or fail between renders.
const CDN_DREI = ['Text', 'Text3D', 'Environment', 'useEnvironment', 'useGLTF', 'MatcapTexture', 'useMatcapTexture', 'NormalTexture', 'useNormalTexture', 'useKTX2'];

// postprocessing classes that build their noise textures with Math.random: every page (every
// chunk start) gets different noise, so frames differ by where a chunk began.
const RANDOM_POSTPROCESSING = ['SSAOEffect', 'GlitchEffect', 'NoiseTexture'];

// The score of a video (videos/<slug>/audio) and the audio stage's synthesis runtime: the same
// determinism rules as frame code, because the bytes of a track are a pure function of its inputs.
const AUDIO_CODE = ['videos/*/audio/**', 'packages/pipeline/src/audio/runtime/**'];

const SEEDED = 'Use the seeded rng from @aiv/core (or remotion random(seed)).';
const SCORE_PROCESS = 'A score is a function of its context (ctx.cues, ctx.seed, ctx.library): never of process state or the environment.';
const FRAME_TIME = 'Derive time from the frame index (renderFrame(i) / useCurrentFrame()).';

// Clocks, timers and unseeded randomness. Member expressions, not calls, so aliasing
// (`const r = Math.random`) is caught too; each also in its qualified form
// (`globalThis.Math.random`, `THREE.MathUtils.randFloat`).
const NONDETERMINISM = [
  { selector: "MemberExpression[object.name='Math'][property.name='random']", message: SEEDED },
  { selector: "MemberExpression[object.property.name='Math'][property.name='random']", message: SEEDED },
  { selector: "MemberExpression[object.name='crypto'][property.name=/^(getRandomValues|randomUUID)$/]", message: SEEDED },
  { selector: "MemberExpression[object.property.name='crypto'][property.name=/^(getRandomValues|randomUUID)$/]", message: SEEDED },
  { selector: "MemberExpression[object.name='MathUtils'][property.name=/^(randFloat|randFloatSpread|randInt|generateUUID|seededRandom)$/]", message: SEEDED },
  { selector: "MemberExpression[object.property.name='MathUtils'][property.name=/^(randFloat|randFloatSpread|randInt|generateUUID|seededRandom)$/]", message: SEEDED },
  { selector: "MemberExpression[object.name='Date'][property.name='now']", message: FRAME_TIME },
  { selector: "MemberExpression[object.property.name='Date'][property.name='now']", message: FRAME_TIME },
  { selector: "CallExpression[callee.name='Date']", message: FRAME_TIME },
  { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: FRAME_TIME },
  { selector: "MemberExpression[object.name='performance'][property.name=/^(now|timeOrigin)$/]", message: FRAME_TIME },
  { selector: "MemberExpression[object.property.name='performance'][property.name=/^(now|timeOrigin)$/]", message: FRAME_TIME },
  { selector: "CallExpression[callee.name=/^(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)$/]", message: FRAME_TIME },
  { selector: "CallExpression[callee.property.name=/^(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)$/]", message: FRAME_TIME },
  { selector: "MemberExpression[object.name='document'][property.name='timeline']", message: FRAME_TIME },
  { selector: "NewExpression[callee.name='Clock'], NewExpression[callee.property.name='Clock']", message: FRAME_TIME },
  { selector: "MemberExpression[property.name=/^(getElapsedTime|getDelta|elapsedTime)$/]", message: FRAME_TIME },
];

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', 'out/**', '.cache/**', '**/dist/**', '**/.remotion/**', '.claude/worktrees/**', ...FROZEN],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: FRAME_CODE,
    rules: {
      'no-restricted-syntax': ['error', ...NONDETERMINISM],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@react-three/fiber',
              importNames: ['useFrame'],
              message: `useFrame runs on the render loop, not the frame index. ${FRAME_TIME}`,
            },
            {
              name: '@react-three/drei',
              importNames: CLOCK_DRIVEN_DREI,
              message: 'This drei helper animates from the wall clock or Math.random; build a frame-driven equivalent.',
            },
            {
              name: '@react-three/drei',
              importNames: CDN_DREI,
              message: 'This drei helper fetches from a CDN at render time; load files from the video (assets/, a pinned package) and draw text on a CanvasTexture or in the DOM.',
            },
            {
              name: 'postprocessing',
              importNames: RANDOM_POSTPROCESSING,
              message: 'This postprocessing class seeds its noise with Math.random: frames would differ at every chunk start. Write a frame-driven equivalent.',
            },
          ],
          patterns: [
            // frame code runs in a page (and @aiv/core everywhere): no Node built-ins
            { group: ['node:*'], message: 'Frame code runs in the browser: no Node built-ins.' },
            { group: ['@aiv/pipeline', '@aiv/pipeline/*'], message: '@aiv/pipeline is Node-only: a page cannot load it.' },
          ],
        },
      ],
    },
  },
  {
    // a score reads its inputs only through the stage's context (cues, verified sample files), so
    // the audio input hash sees every file the bytes depend on: no Node built-ins here
    files: ['videos/*/audio/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@aiv/pipeline', message: 'A score imports @aiv/pipeline/audio (the score API), never the pipeline itself: the stage refuses it.' }],
          patterns: [
            { group: ['node:*', 'fs', 'fs/*', 'path', 'os', 'child_process', 'worker_threads'], message: 'A score reads files only through its context (ctx.library, ctx.cues): no Node built-ins.' },
            { group: ['@aiv/remotion-kit', '@aiv/remotion-kit/*', 'remotion', '@remotion/*', 'react', 'three'], message: 'A score runs in Node, not in the page.' },
            // a path into packages/ would reach the stage's internals (opening a library's store directly)
            { group: ['**/packages/**'], message: 'Import shared code by package name (@aiv/core, @aiv/pipeline/audio), never by a path into packages/.' },
          ],
        },
      ],
      // process.env, pid, hrtime, argv…: state of the machine or the run, not of the inputs
      // (the stage also starts the score with an almost empty environment)
      'no-restricted-globals': ['error', { name: 'process', message: SCORE_PROCESS }],
      'no-restricted-properties': ['error', { object: 'globalThis', property: 'process', message: SCORE_PROCESS }, { object: 'global', property: 'process', message: SCORE_PROCESS }],
    },
  },
  {
    files: AUDIO_CODE,
    rules: {
      'no-restricted-syntax': ['error', ...NONDETERMINISM.map((r) => (r.message === FRAME_TIME ? { ...r, message: 'Derive time from the sample index (ctx.sampleRate), never a clock.' } : r))],
    },
  },
);
