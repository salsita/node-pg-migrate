var utils = require('../utils');

module.exports = {
  create: function( extension ) {
    return utils.t('CREATE EXTENSION {extension};', {
      extension: extension
    });
  },

  drop: function( extension ) {
    return utils.t('DROP EXTENSION {extension};', {
      extension: extension
    });
  }
}