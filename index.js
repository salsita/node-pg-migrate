/* eslint-disable global-require */
const runner = require('./dist/runner')
const definitions = require('./dist/definitions')

module.exports = runner.default
module.exports.default = runner.default
module.exports.PgLiteral = runner.PgLiteral
module.exports.Migration = runner.Migration
module.exports.PgType = definitions.PgType
