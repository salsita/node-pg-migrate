exports.up = (pgm) => {
  pgm.createSchema('extension-test')
  pgm.createExtension('ltree', { schema: 'extension-test' })
}
