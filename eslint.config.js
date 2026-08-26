const tseslint = require('typescript-eslint');

module.exports = [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'openspec/**', '.atl/**'],
  },
  ...tseslint.configs.recommended,
  {
    // Node CJS tooling configs legitimately use require(); TS sources keep full strictness.
    files: ['eslint.config.js', 'jest.preset.js', '**/jest.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
