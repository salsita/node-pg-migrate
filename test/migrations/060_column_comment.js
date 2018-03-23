exports.comment = 'comment on column id';

exports.up = (pgm) => {
  pgm.createTable({ schema: 'circle_test', name: 'tcc' }, {
    id: { type: 'id', comment: exports.comment },
  });
};
