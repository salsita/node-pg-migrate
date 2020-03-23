exports.up = (pgm) => {
  pgm.createTable('test-comment', {}, { comment: "table's comment" })
  pgm.dropTable('test-comment')
}

exports.down = () => null
