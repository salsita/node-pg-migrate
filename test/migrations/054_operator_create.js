exports.up = (pgm) => {
  pgm.createType('complex', {
    r: 'integer',
    i: 'integer',
  })
  pgm.createFunction(
    'complex_add',
    ['complex', 'complex'],
    {
      returns: 'complex',
      language: 'plpgsql',
    },
    `
BEGIN
  return ROW($1.r + $2.r, $1.i + $2.i);
END;
  `,
  )
  pgm.createOperator('+', {
    left: 'complex',
    right: 'complex',
    procedure: 'complex_add',
    commutator: '+',
  })
}
