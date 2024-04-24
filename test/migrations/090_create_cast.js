exports.up = (pgm) => {
  pgm.createCast('integer', 'bigint', {
    as: 'IMPLICIT',
  });

  pgm.createCast('integer', 'bigint', {
    as: 'ASSIGNMENT',
  });

  pgm.createCast('integer', 'bigint', {
    inout: true,
    as: 'IMPLICIT',
  });

  pgm.createFunction(
    'text_to_integer',
    ['integer'],
    {
      returns: 'integer',
      language: 'plpgsql',
    },
    `
BEGIN
  CAST($1 AS integer);
END;
  `
  );
  pgm.createCast('text', 'integer', {
    functionName: 'text_to_integer',
    argumentTypes: ['text'],
    as: 'ASSIGNMENT',
  });
};
