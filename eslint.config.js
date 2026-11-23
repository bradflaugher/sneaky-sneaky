import js from '@eslint/js';
import globals from 'globals';

const rules = {
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-constant-condition': ['error', { checkLoops: false }],
  eqeqeq: ['error', 'always'],
  'prefer-const': 'error',
  'no-var': 'error',
};

export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules,
  },
  {
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules,
  },
];
