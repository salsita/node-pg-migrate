exports.params = ['integer', { name: 'arg2', mode: 'in', type: 'integer' }]

exports.up = (pgm) => {
  pgm.createFunction(
    'f',
    exports.params,
    {
      returns: 'integer',
      language: 'plpgsql',
    },
    `
BEGIN
  return $1 + arg2;
END;
  `,
  )
}
