import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

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
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Engine randomness must come from rng.ts' },
        { object: 'Date', property: 'now', message: 'Engine must not read the clock' },
      ],
      'no-restricted-globals': ['error', 'document', 'window', 'localStorage'],
    },
  },
);
