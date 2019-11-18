module.exports = {
  parser: 'typescript',
  semi: false,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 120,
  tabWidth: 2,
  overrides: [
    {
      files: '*.json',
      options: { parser: 'json' },
    },
    {
      files: '*.md',
      options: { parser: 'markdown' },
    },
  ],
}
