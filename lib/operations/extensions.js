var utils = require('../utils');
var _ = require('lodash');

var ops = module.exports = {
  create: function( extensions ) {
    if ( !_.isArray(extensions) ) extensions = [extensions];
    return _.map(extensions, function(extension){
      return utils.t('CREATE EXTENSION {extension};', {
        extension: extension
      });
    });
  },

  drop: function( extensions ) {
    if ( !_.isArray(extensions) ) extensions = [extensions];
    return _.map(extensions, function(extension){
      return utils.t('DROP EXTENSION {extension};', {
        extension: extension
      });
    });
  },
}

// setup reverse functions
ops.create.reverse = ops.drop;