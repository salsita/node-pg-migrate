import { defineConfig } from 'oxlint';

export default defineConfig({
  //#region global
  ignorePatterns: [
    'docs/.vitepress/config.mts',
    'docs/.vitepress/theme/index.ts',
    'templates',
    'test/jiti/migrations/**/*.js',
    'test/jiti/migrations/**/*.mjs',
  ],
  options: {
    reportUnusedDisableDirectives: 'error',
    typeAware: true,
    typeCheck: true,
  },
  plugins: ['typescript', 'unicorn', 'import', 'vitest'],
  //#endregion

  rules: {
    //#region javascript
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    // not available in oxlint
    // 'logical-assignment-operators': 'error',
    'no-else-return': 'error',
    'prefer-exponentiation-operator': 'error',
    'prefer-template': 'error',
    //#endregion

    //#region typescript
    'typescript/array-type': [
      'error',
      { default: 'array-simple', readonly: 'generic' },
    ],
    'typescript/ban-ts-comment': [
      'error',
      {
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': 'allow-with-description',
      },
    ],
    'typescript/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        disallowTypeAnnotations: false,
        fixStyle: 'separate-type-imports',
      },
    ],
    'typescript/explicit-module-boundary-types': 'error',
    // not available in oxlint
    // 'typescript/naming-convention': [
    //   'error',
    //   {
    //     format: ['PascalCase'],
    //     selector: ['class', 'interface', 'typeAlias'],
    //     leadingUnderscore: 'forbid',
    //     trailingUnderscore: 'forbid',
    //   },
    //   {
    //     format: ['UPPER_CASE', 'snake_case'],
    //     selector: ['enumMember'],
    //     leadingUnderscore: 'forbid',
    //     trailingUnderscore: 'forbid',
    //   },
    //   {
    //     format: ['PascalCase'],
    //     selector: ['typeParameter'],
    //     prefix: ['T'],
    //     leadingUnderscore: 'forbid',
    //     trailingUnderscore: 'forbid',
    //   },
    // ],
    'typescript/no-confusing-void-expression': [
      'error',
      {
        ignoreArrowShorthand: true,
      },
    ],
    'typescript/no-inferrable-types': ['error', { ignoreParameters: true }],
    'typescript/no-non-null-assertion': 'warn',
    'typescript/no-unnecessary-condition': 'off', // requires `strictNullChecks` to be enabled
    'typescript/no-unsafe-assignment': 'off',
    'typescript/no-unsafe-call': 'off',
    'typescript/no-unsafe-member-access': 'off',
    'typescript/prefer-regexp-exec': 'error',
    'typescript/restrict-plus-operands': [
      'error',
      {
        allowAny: false,
        allowBoolean: false,
        allowNullish: false,
        allowNumberAndString: true,
        allowRegExp: false,
      },
    ],
    // TODO @Shinigami92 2024-02-29: Enable restrict-template-expressions later
    // 'typescript/restrict-template-expressions': [
    //   'error',
    //   { allowNumber: true, allowBoolean: true },
    // ],
    'typescript/switch-exhaustiveness-check': [
      'error',
      { requireDefaultForNonUnion: true },
    ],
    'typescript/unbound-method': 'off',

    // TODO @Shinigami92 2024-02-29: Remove these later
    'typescript/consistent-type-exports': 'off',
    'typescript/no-base-to-string': 'off',
    'typescript/no-deprecated': 'off',
    'typescript/no-floating-promises': 'off',
    'typescript/no-unnecessary-type-parameters': 'off',
    'typescript/no-unsafe-argument': 'off',
    'typescript/no-unsafe-return': 'off',
    'typescript/no-useless-default-assignment': 'off',
    'typescript/no-var-requires': 'off',
    'typescript/restrict-template-expressions': 'off',
    'typescript/unified-signatures': 'off',
    //#endregion

    //#region import
    'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    //#endregion

    //#region unicorn
    'unicorn/filename-case': 'off',
    'unicorn/no-array-callback-reference': 'off', // reduces readability
    'unicorn/no-nested-ternary': 'off', // incompatible with formatter
    'unicorn/no-null': 'off', // incompatible with TypeScript
    'unicorn/no-object-as-default-parameter': 'off', // https://github.com/sindresorhus/eslint-plugin-unicorn/issues/2199
    'unicorn/no-zero-fractions': 'off', // deactivated to raise awareness of floating operations
    'unicorn/number-literal-case': 'off', // incompatible with formatter
    'unicorn/numeric-separators-style': 'off', // "magic numbers" may carry specific meaning
    'unicorn/prefer-string-slice': 'off', // string.substring is sometimes easier to use
    'unicorn/prefer-ternary': 'off', // ternaries aren't always better

    // TODO @Shinigami92 2024-04-27: Potentially enable later
    'unicorn/consistent-existence-index-check': 'off',
    'unicorn/consistent-function-scoping': 'off',
    'unicorn/no-process-exit': 'off',
    'unicorn/prefer-at': 'off',
    'unicorn/prefer-native-coercion-functions': 'off',
    'unicorn/prefer-string-raw': 'off',
    'unicorn/prefer-string-replace-all': 'off',
    'unicorn/prefer-structured-clone': 'off',
    'unicorn/prefer-top-level-await': 'off',
    'unicorn/prefer-type-error': 'off',
    //#endregion
  },

  //#region overrides
  overrides: [
    {
      files: ['test/**/*.spec.ts', 'test/**/*.spec.d.ts'],
      rules: {
        'typescript/no-deprecated': 'off',

        'typescript/restrict-template-expressions': [
          'error',
          {
            allowNumber: true,
            allowBoolean: true,
            allowAny: true,
          },
        ],

        'unicorn/no-useless-undefined': ['error', { checkArguments: false }],

        'vitest/expect-expect': 'off',
        'vitest/no-alias-methods': 'error',
        'vitest/prefer-each': 'error',
        'vitest/prefer-to-have-length': 'error',
        'vitest/require-mock-type-parameters': 'off',
        'vitest/require-to-throw-message': 'off',
        'vitest/valid-describe-callback': 'off',
        'vitest/valid-expect': ['error', { maxArgs: 2 }],
        'vitest/warn-todo': 'warn',
      },
    },
    {
      files: ['test/migrations/*.js'],
      rules: {
        'no-undef': 'off',
        'preserve-caught-error': 'off',
        'typescript/explicit-module-boundary-types': 'off',
        'typescript/no-require-imports': 'off',
        'typescript/only-throw-error': 'off',
        'unicorn/no-array-reduce': 'off',
        'unicorn/prefer-module': 'off',
      },
    },
  ],
  //#endregion
});
