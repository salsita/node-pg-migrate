exports.up = (pgm) => {
  pgm.createCast('bigint', 'int4');

  pgm.createCast('bigint', 'int4', {
    functionName: 'int4',
    argumentTypes: ['bigint'],
    as: 'ASSIGNMENT',
  });

  pgm.createCast('bigint', 'int4', {
    as: 'ASSIGNMENT',
  });

  pgm.createCast('text', 'integer', {
    inout: true,
    as: 'IMPLICIT',
  });
};
