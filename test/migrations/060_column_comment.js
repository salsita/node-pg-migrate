exports.comment = 'comment on column id';

exports.up = (pgm) => {
  pgm.createSchema('test');
  pgm.createTable({ schema: 'test', name: 'tcc' }, {
    id: { type: 'id', comment: exports.comment },
  });
};
