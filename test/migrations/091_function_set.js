export const up = (pgm) => {
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
      set: [
        {
          configurationParameter: 'search_path',
          value: "''",
        },
      ],
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
