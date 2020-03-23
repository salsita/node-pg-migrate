exports.up = (pgm) => {
  pgm.createTable('tt', {
    a: 'integer',
  })
  pgm.createTrigger(
    'tt',
    't',
    {
      when: 'before',
      operation: 'insert',
      level: 'row',
      language: 'plpgsql',
    },
    `
BEGIN
  NEW.a := NEW.a + 1;
  return NEW;
END;
  `,
  )
  pgm.renameTrigger('tt', 't', 'trig')
  pgm.renameFunction('t', [], 'trig')
}
