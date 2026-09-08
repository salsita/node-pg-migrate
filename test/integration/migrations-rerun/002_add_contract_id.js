exports.up = (pgm) => {
  pgm.addColumn('users', { contract_id: { type: 'varchar(255)' } });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'contract_id');
};
