exports.params = ['integer', { name: 'arg2', mode: 'in', type: 'integer' }];

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
  `
  );

  pgm.createFunction(
    'check_password',
    [
      { name: 'uname', type: 'text' },
      { name: 'pass', type: 'text' },
    ],
    {
      replace: true,
      returns: 'boolean',
      language: 'plpgsql',
      security: 'DEFINER',
    },
    `
DECLARE passed BOOLEAN;
BEGIN
  SELECT (pwd = $2) INTO passed
  FROM pwds
  WHERE username = $1;
  RETURN passed;
END;
`
  );
};
