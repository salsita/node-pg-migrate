exports.up = (pgm) => {
  pgm.createCast('text', 'integer', {
    as: 'IMPLICIT',
  });

  pgm.createCast('text', 'integer', {
    as: 'ASSIGNMENT',
  });

  pgm.createCast('text', 'integer', {
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
