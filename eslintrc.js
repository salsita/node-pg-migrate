module.exports = {
  extends: [
    "eslint:recommended",
    "eslint-config-airbnb-base",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:security/recommended",
    "plugin:prettier/recommended"
  ],
  parser: "babel-eslint",
  env: {
    node: true,
    mocha: true
  },
  rules: {
    "no-console": 0,
    "no-underscore-dangle": 0,
    "security/detect-object-injection": 0,
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: ["mocha.bootstrap.js", "/test/**"]
      }
    ]
  },
  plugins: ["import", "security"]
};
