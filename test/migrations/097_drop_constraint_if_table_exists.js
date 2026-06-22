export const up = (pgm) => {
  const tableName = 'drop_constraint_if_table_exists';
  const constraintName = 'drop_constraint_if_table_exists_check';

  pgm.createTable(tableName, {
    id: 'id',
    value: 'integer',
  });

  pgm.addConstraint(tableName, constraintName, {
    check: 'value > 0',
  });

  pgm.dropTable(tableName);

  pgm.dropConstraint(tableName, constraintName, {
    ifTableExists: true,
    ifExists: true,
  });
};

export const down = () => null;
