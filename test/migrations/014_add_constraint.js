export const constraint = 'chck_nmbr';

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addConstraint('t1', constraint, {
    check: 'nmbr < 30',
    comment: 'nmbr must be less than 30',
  });

  // Test for issue #939
  pgm.createSchema('payroll_reports');
  pgm.createTable(
    { schema: 'payroll_reports', name: 'upload_headers' },
    {
      id: { type: 'serial', primaryKey: true },
      paycode_type: 'text',
      aggregate_paycode_type: 'text',
      meta_field_type: 'text',
      is_remark: 'boolean',
    }
  );
  pgm.addConstraint(
    { schema: 'payroll_reports', name: 'upload_headers' },
    'chk_only_one_header_type',
    {
      check: [
        `(
      CASE WHEN paycode_type IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN aggregate_paycode_type IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN meta_field_type IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN is_remark THEN 1 ELSE 0 END
     ) <= 1`,
      ],
      comment:
        "If no type present/truthy, it's ignored; cannot have more than one active at once",
    }
  );
};
