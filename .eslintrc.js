module.exports = {
  extends: [
    'eslint:recommended',
    'eslint-config-airbnb-base',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:security/recommended',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import', 'security'],
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      typescript: {},
    },
  },
  env: {
    node: true,
    mocha: true,
  },
  rules: {
    'no-underscore-dangle': 'off',
    'security/detect-object-injection': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'import/extensions': ['error', 'never'],
  },
  overrides: [
    {
      files: ['*.js', 'node-pg-migrate'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/camelcase': 'off',
      },
    },
  ],
}
