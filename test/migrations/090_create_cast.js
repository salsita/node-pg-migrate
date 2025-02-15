export const up = (pgm) => {
  pgm.createCast('varchar', 'integer', {
    inout: true,
    as: 'IMPLICIT',
  });

  pgm.createFunction(
    'text_to_integer',
    ['text'],
    {
      returns: 'integer',
      language: 'plpgsql',
    },
    `
BEGIN
  RETURN CAST($1 AS integer);
END;
  `
  );
  pgm.createCast('text', 'integer', {
    functionName: 'text_to_integer',
    argumentTypes: ['text'],
    as: 'ASSIGNMENT',
  });
};
