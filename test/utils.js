const { createSchemalize } = require('../lib/utils');

module.exports = {
  options1: {
    typeShorthands: {},
    schemalize: createSchemalize(false, false),
    literal: createSchemalize(false, true)
  },
  options2: {
    typeShorthands: {},
    schemalize: createSchemalize(true, false),
    literal: createSchemalize(true, true)
  }
};
