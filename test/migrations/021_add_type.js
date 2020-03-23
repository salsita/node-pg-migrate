exports.up = (pgm) => {
  pgm.createType('list', ['a', 'b', 'c'])
  pgm.createType('obj', {
    id: 'integer',
  })
}
