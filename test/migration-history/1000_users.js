// Two unqualified migrations: they only work when they run against the schema holding their
// objects - see test/integration/migration-history-it.spec.ts.
export const up = (pgm) => {
  pgm.createTable('users', { id: 'id' });
};
