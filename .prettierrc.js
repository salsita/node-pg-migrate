module.exports = {
  printWidth: 80,
  parser: 'babel',
  singleQuote: true,
  overrides: [
    {
      files: '*.json',
      options: { parser: 'json' }
    },
    {
      files: '*.md',
      options: { parser: 'markdown' }
    }
  ]
};
