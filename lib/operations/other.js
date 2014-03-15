var utils = require('../utils');

module.exports = {
  sql: function(sql, args){
    // applies some very basic templating using the utils.p
    var s = utils.t(sql, args);
    if (s.lastIndexOf(';') != (s.length - 1))
      s += ';';
    return s;
  }
}
