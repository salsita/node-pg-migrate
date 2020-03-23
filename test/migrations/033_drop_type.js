exports.up = (pgm) => {
  pgm.createType('list_for_drop', ['a', 'b', 'c'])
  pgm.dropType('list_for_drop')
}

exports.down = () => null
