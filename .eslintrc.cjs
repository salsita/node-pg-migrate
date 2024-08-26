// @ts-check
const { defineConfig } = require('eslint-define-config');
const { readGitignoreFiles } = require('eslint-gitignore');

/// <reference types="@eslint-types/prettier" />
/// <reference types="@eslint-types/typescript-eslint" />
/// <reference types="@eslint-types/unicorn" />

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
    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    project: ['./tsconfig.json'],
    warnOnUnsupportedTypeScriptVersion: false,
  },
  rules: {
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'no-else-return': 'error',
    'prefer-exponentiation-operator': 'error',
    'prefer-template': 'error',
    quotes: 'off',

    'unicorn/consistent-function-scoping': 'off',
    'unicorn/filename-case': 'off',
    'unicorn/import-style': [
      'error',
      { styles: { 'node:path': { named: true } } },
    ],
    'unicorn/no-array-callback-reference': 'off', // reduces readability
    'unicorn/no-array-reduce': 'off',
    'unicorn/no-nested-ternary': 'off', // incompatible with prettier
    'unicorn/no-null': 'off', // incompatible with TypeScript
    'unicorn/no-zero-fractions': 'off', // deactivated to raise awareness of floating operations
    'unicorn/number-literal-case': 'off', // incompatible with prettier
    'unicorn/prefer-module': 'off',
    'unicorn/prefer-ternary': 'off', // ternaries aren't always better
    'unicorn/prefer-type-error': 'off',

    // TODO @Shinigami92 2024-04-27: Potentially enable later
    'unicorn/no-process-exit': 'off',
    'unicorn/prefer-at': 'off',
    'unicorn/prefer-native-coercion-functions': 'off',
    'unicorn/prefer-string-raw': 'off',
    'unicorn/prefer-string-replace-all': 'off',
    'unicorn/prefer-structured-clone': 'off',
    'unicorn/prefer-top-level-await': 'off',
    'unicorn/prevent-abbreviations': 'off',

    '@typescript-eslint/array-type': [
      'error',
      { default: 'array-simple', readonly: 'generic' },
    ],
    '@typescript-eslint/ban-ts-comment': [
      'error',
      {
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': 'allow-with-description',
      },
    ],
    '@typescript-eslint/consistent-type-exports': 'error',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        disallowTypeAnnotations: false,
        fixStyle: 'separate-type-imports',
      },
    ],
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
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-redundant-type-constituents': 'off',
    '@typescript-eslint/no-unnecessary-condition': 'off', // requires `strictNullChecks` to be enabled
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/padding-line-between-statements': [
      'error',
      { blankLine: 'always', prev: 'block-like', next: '*' },
    ],
    '@typescript-eslint/prefer-regexp-exec': 'error',
    '@typescript-eslint/quotes': ['error', 'single', { avoidEscape: true }],
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
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/unified-signatures': 'off',
  },
  overrides: [
    {
      files: ['test/migrations/*.js', 'test/migrations/*.cjs'],
      rules: {
        'unicorn/prefer-module': 'off',

        '@typescript-eslint/no-throw-literal': 'off',
      },
    },
  ],
});
