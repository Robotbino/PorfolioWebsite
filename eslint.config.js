// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Lint config for the portfolio.
 *
 * The recommended sets do the work; the additions below encode rules this
 * codebase already follows by hand, so a future edit that breaks one fails the
 * build instead of being noticed in review (or not at all).
 */
module.exports = tseslint.config(
  {
    ignores: ['dist/**', '.angular/**', 'node_modules/**', 'docs/**', 'coverage/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      // Every component in this app is OnPush and the hot path depends on it:
      // a default-strategy component would be re-checked on every event while
      // the shared rAF is running.
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      // The site has no NgModule left; keep it that way.
      '@angular-eslint/prefer-standalone': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Specs reach into private state and stub browser APIs on purpose.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
  {
    // Build tooling: Node scripts, not app code.
    files: ['scripts/**/*.mjs', 'karma.conf.js', 'eslint.config.js'],
    languageOptions: {
      globals: {
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
