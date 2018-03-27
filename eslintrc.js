module.exports = {
  "extends": [
    "eslint:recommended",
    "eslint-config-airbnb-base",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:security/recommended",
    "plugin:prettier/recommended"
  ],
  "parser": "babel-eslint",
  "env": {
    "node": true,
    "mocha": true
  },
  "plugins": [
    "import",
    "security"
  ]
};
