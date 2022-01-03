import { MigrationBuilder, ColumnDefinitions } from '../../../dist'

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('t3', {
    id: 'id',
    string: { type: 'text', notNull: true },
    created: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  })
  pgm.grantRoles([{ name: 'role1', schema: 'test' }, 'role4'], { name: 'role3' })
  pgm.grantTables(['DELETE', 'INSERT'], ['table1', 'table2'], ['role1', 'role2'], { withGrantOption: true })
  pgm.grantTables('ALL', ['table1', 'table2'], ['role1', 'role2'], { withGrantOption: true })
  // problem here is that you need this scheme parameter extra instead of tables - can it be typed?
  pgm.grantTables('ALL', 'ALL', 'scheme1', ['role1', 'role2'], { withGrantOption: true })

  pgm.grantRoles('rds_iam_role', 'approle')
  pgm.grantSchema('USAGE', 'schema1', 'appRole')
  pgm.grantAllTables(['DELETE', 'INSERT'], 'scheme1', ['role1', 'role2'])
  pgm.grantAllTables('REFERENCES', 'scheme1', ['role1', 'role2'])

  // 2 questions
  // - if i want to have those ALL ALL permutations in function names - pass ALL as an argument?
  // - if i want to have different functions for different objects - use overload instead?
}
