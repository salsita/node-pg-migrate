exports.up = (pgm) => {
  pgm.dropTrigger('tt', 'trig');
  pgm.dropFunction('trig', []);
};

exports.down = (pgm) => {
  pgm.createTrigger('tt', 'trig', {
    when: 'before',
    operation: ['insert', 'update'],
    level: 'row',
    language: 'plpgsql',
  }, `
BEGIN
  NEW.a := NEW.a + 1;
  return NEW;
END;
  `);
};
