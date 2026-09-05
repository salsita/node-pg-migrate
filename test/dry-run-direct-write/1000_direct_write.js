// Migrations may reach past the builder and talk to the database directly. Such a write is
// exactly what a dry run must refuse - see test/integration/dry-run-it.spec.ts.
export const up = async (pgm) => {
  await pgm.db.query('CREATE TABLE direct_write_table (id integer)');
};

export const down = async (pgm) => {
  await pgm.db.query('DROP TABLE direct_write_table');
};
