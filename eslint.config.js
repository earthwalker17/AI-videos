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

const SEEDED = 'Use the seeded rng from @aiv/core (or remotion random(seed)).';
const FRAME_TIME = 'Derive time from the frame index (renderFrame(i) / useCurrentFrame()).';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', 'out/**', '.cache/**', '**/dist/**', '**/.remotion/**', ...FROZEN],
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
      'no-restricted-syntax': [
        'error',
        // Member expressions, not calls, so aliasing (`const r = Math.random`) is caught too.
        { selector: "MemberExpression[object.name='Math'][property.name='random']", message: SEEDED },
        { selector: "MemberExpression[object.name='crypto'][property.name=/^(getRandomValues|randomUUID)$/]", message: SEEDED },
        { selector: "MemberExpression[object.name='MathUtils'][property.name=/^(randFloat|randFloatSpread|randInt|generateUUID|seededRandom)$/]", message: SEEDED },
        { selector: "MemberExpression[object.name='Date'][property.name='now']", message: FRAME_TIME },
        { selector: "CallExpression[callee.name='Date']", message: FRAME_TIME },
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: FRAME_TIME },
        { selector: "MemberExpression[object.name='performance'][property.name=/^(now|timeOrigin)$/]", message: FRAME_TIME },
        { selector: "CallExpression[callee.name=/^(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)$/]", message: FRAME_TIME },
        { selector: "CallExpression[callee.property.name=/^(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)$/]", message: FRAME_TIME },
        { selector: "MemberExpression[object.name='document'][property.name='timeline']", message: FRAME_TIME },
        { selector: "NewExpression[callee.name='Clock'], NewExpression[callee.property.name='Clock']", message: FRAME_TIME },
        { selector: "MemberExpression[property.name=/^(getElapsedTime|getDelta)$/]", message: FRAME_TIME },
      ],
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
          ],
        },
      ],
    },
  },
);
