exports.up = (pgm) => {
  pgm.renameDomain('d', 'dom');
};
