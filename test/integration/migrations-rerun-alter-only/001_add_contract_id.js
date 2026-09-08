// Mirrors the reported case: the table itself predates the migrations folder,
// so this migration can only succeed when it resolves the *existing* table.
exports.up = (pgm) => {
  pgm.addColumn('users', { contract_id: { type: 'varchar(255)' } });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'contract_id');
};
