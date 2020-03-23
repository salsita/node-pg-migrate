exports.up = (pgm) => {
  pgm.createTable('names', {
    id: 'id',
    name: { type: 'varchar(10)' },
  })
  return new Promise((resolve) => setTimeout(resolve, 10))
}
