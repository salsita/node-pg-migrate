/* eslint-disable global-require */
const [major] = process.versions.node.split(".");
if (Number(major) >= 8) {
  module.exports = require("./lib/runner");
} else {
  module.exports = require("./dist/runner"); // eslint-disable-line import/no-unresolved
}
