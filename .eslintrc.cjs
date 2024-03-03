// @ts-check
const { defineConfig } = require('eslint-define-config');
const { readGitignoreFiles } = require('eslint-gitignore');

/// <reference types="@eslint-types/prettier" />
/// <reference types="@eslint-types/typescript-eslint" />

module.exports = defineConfig({
  ignorePatterns: [
    ...readGitignoreFiles(),
    'templates',
    '.eslintrc.cjs', // Skip self linting
  ],
  root: true,
  env: {
    node: true,
  },
  reportUnusedDisableDirectives: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    project: ['./tsconfig.lint.json'],
    warnOnUnsupportedTypeScriptVersion: false,
  },
  rules: {
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'no-else-return': 'error',
    'prefer-exponentiation-operator': 'error',
    'prefer-template': 'error',

    '@typescript-eslint/array-type': [
      'error',
      { default: 'array-simple', readonly: 'generic' },
    ],
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        format: ['PascalCase'],
        selector: ['class', 'interface', 'typeAlias'],
        leadingUnderscore: 'forbid',
        trailingUnderscore: 'forbid',
      },
      {
        format: ['UPPER_CASE', 'snake_case'],
        selector: ['enumMember'],
        leadingUnderscore: 'forbid',
        trailingUnderscore: 'forbid',
      },
      {
        format: ['PascalCase'],
        selector: ['typeParameter'],
        prefix: ['T'],
        leadingUnderscore: 'forbid',
        trailingUnderscore: 'forbid',
      },
    ],
    '@typescript-eslint/no-inferrable-types': [
      'error',
      { ignoreParameters: true },
    ],
    '@typescript-eslint/no-unnecessary-condition': 'off', // requires `strictNullChecks` to be enabled
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/padding-line-between-statements': [
      'error',
      { blankLine: 'always', prev: 'block-like', next: '*' },
    ],
    '@typescript-eslint/prefer-regexp-exec': 'error',
    // TODO @Shinigami92 2024-02-29: Enable restrict-template-expressions later
    // '@typescript-eslint/restrict-template-expressions': [
    //   'error',
    //   { allowNumber: true, allowBoolean: true },
    // ],
    '@typescript-eslint/switch-exhaustiveness-check': [
      'error',
      { requireDefaultForNonUnion: true },
    ],
    '@typescript-eslint/unbound-method': 'off',

    // TODO @Shinigami92 2024-02-29: Remove these later
    '@typescript-eslint/no-base-to-string': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-implied-eval': 'off',
    '@typescript-eslint/no-redundant-type-constituents': 'off',
    '@typescript-eslint/no-throw-literal': 'off',
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/prefer-promise-reject-errors': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/unified-signatures': 'off',
  },
});
