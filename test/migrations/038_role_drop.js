exports.up = (pgm) => {
  pgm.dropRole('rx');
};

exports.down = (pgm) => {
  pgm.createRole('rx', { password: 'p', login: false });
};
