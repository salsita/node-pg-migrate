module.exports = {
  printWidth: 80,
  parser: "babylon",
  overrides: [
    {
      files: "*.json",
      options: { parser: "json" }
    },
    {
      files: "*.md",
      options: { parser: "markdown" }
    }
  ]
};
