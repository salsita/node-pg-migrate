const { params } = require('./039_function_create')

exports.up = (pgm) => {
  pgm.renameFunction('f', params, 'add')
}
