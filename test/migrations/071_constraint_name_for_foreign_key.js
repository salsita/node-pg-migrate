exports.up = (pgm) => {
  pgm.createTable('ft1', { id: 'id' })
  pgm.createTable('ft2', {
    id: {
      type: 'integer',
      notNull: true,
      references: 'ft1',
      referencesConstraintName: 'my_constraint_name',
    },
  })
  pgm.renameConstraint('ft2', 'my_constraint_name', 'better_constraint_name')
}
