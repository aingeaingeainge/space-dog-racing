import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * ECMAScript leaves these implementation-defined, so their results differ between engine
 * versions and would break seed-replay across machines. Route them through
 * `quantize()` in determinism.ts instead.
 */
const UNSTABLE_MATH = ['pow', 'exp', 'expm1', 'log', 'log2', 'log10', 'log1p', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'cbrt', 'hypot'];
const TRANSCENDENTAL = UNSTABLE_MATH.map((property) => ({
  object: 'Math',
  property,
  message: `Math.${property} is implementation-defined: wrap it in quantize() from determinism.ts`,
}));
const BASE_ENGINE_RESTRICTIONS = [
  { object: 'Math', property: 'random', message: 'Engine randomness must come from rng.ts' },
  { object: 'Date', property: 'now', message: 'Engine must not read the clock' },
];

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'backups/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'packages/engine/scripts/**/*.ts', 'packages/engine/test/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  { files: ['packages/web/src/**/*.{ts,tsx}'], languageOptions: { globals: globals.browser } },
  {
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-properties': ['error', ...BASE_ENGINE_RESTRICTIONS, ...TRANSCENDENTAL],
      'no-restricted-globals': ['error', 'document', 'window', 'localStorage'],
    },
  },
  {
    // determinism.ts is the single place allowed to call the unstable functions.
    files: ['packages/engine/src/determinism.ts'],
    rules: {
      'no-restricted-properties': ['error', ...BASE_ENGINE_RESTRICTIONS],
    },
  },
);
