exports.up = (pgm) => {
  pgm.createSequence('s', { minvalue: 10 })
  pgm.renameSequence('s', 'seq')
  pgm.createTable('ts', {
    id: { type: 'integer', default: pgm.func("nextval('seq')") },
  })
}
