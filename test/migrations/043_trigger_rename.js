exports.up = (pgm) => {
  pgm.renameTrigger('tt', 't', 'trig');
  pgm.renameFunction('t', [], 'trig');
};
