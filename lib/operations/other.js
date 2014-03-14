var utils = require('../utils');

module.exports = {
  sql: function(sql, args){
    // applies some very basic templating using the utils.p
    return utils.t(sql, args);
  }
}