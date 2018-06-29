const { t } = require("../utils");

function sql(...args) {
  // applies some very basic templating using the utils.p
  let s = t(...args);
  // add trailing ; if not present
  if (s.lastIndexOf(";") !== s.length - 1) {
    s += ";";
  }
  return s;
}

module.exports = {
  sql
};
