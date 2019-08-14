const { createSchemalize } = require('../lib/utils');

const options = {
  typeShorthands: {},
  schemalize: createSchemalize(false, false),
  literal: createSchemalize(false, true)
};

module.exports = {
  options
};
