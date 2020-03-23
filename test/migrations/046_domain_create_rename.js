exports.up = (pgm) => {
  pgm.createDomain('d', 'integer', {
    check: 'VALUE BETWEEN 0 AND 10',
  })
  pgm.renameDomain('d', 'dom')
  pgm.createTable('td', {
    d: 'dom',
  })
}
