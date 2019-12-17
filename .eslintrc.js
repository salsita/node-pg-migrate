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
    'no-console': 0,
    'no-underscore-dangle': 0,
    'security/detect-object-injection': 0,
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/no-explicit-any': 0,
    'import/extensions': ['error', 'never'],
  },
  overrides: [
    {
      files: ['*.js', 'node-pg-migrate'],
      rules: {
        '@typescript-eslint/no-var-requires': 0,
        '@typescript-eslint/camelcase': 0,
      },
    },
  ],
}
