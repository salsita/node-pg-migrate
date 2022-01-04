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
  // pgm.grantTables(['DELETE', 'INSERT'], { tables: ['table1', 'table2'] }, ['role1', 'role2'], { withGrantOption: true })
  // pgm.grantTables('ALL', { tables: ['table1', 'table2'] }, ['role1', 'role2'], { withGrantOption: true })
  // problem here is that you need this scheme parameter extra instead of tables - can it be typed?
  // maybe scheme or tables via object... if one defined another ignored?
  // pgm.grantTables('ALL', { scheme: '' }, ['role1', 'role2'], { withGrantOption: true })

  pgm.grantTables({
    privileges: ['DELETE'],
    tables: 'ALL',
    schema: 'schema1',
    roles: ['role1', 'role2'],
  })

  pgm.grantOnTables({
    privileges: ['DELETE'],
    tables: 'ALL',
    schema: 'schema1',
    roles: ['role1'],
  })

  pgm.grantOnTables({
    privileges: ['DELETE'],
    tables: ['table1'],
    roles: ['role1'],
  })

  pgm.grantOnColumns({
    columns: [
      {
        privileges: 'ALL',
        name: 'name',
      },
    ],
    tables: ['table1', 'table2'],
    roles: ['role1'],
    withGrantOption: true,
  })

  pgm.grantOnSchemas({
    privileges: ['CREATE', 'USAGE'],
    schemas: ['schema1', 'schema2'],
    roles: ['role1', 'role2'],
  })

  pgm.grantRoles('rds_iam_role', 'approle')
  pgm.grantSchema('USAGE', 'schema1', 'appRole')
  pgm.grantAllTables(['DELETE', 'INSERT'], 'scheme1', ['role1', 'role2'])
  pgm.grantAllTables('REFERENCES', 'scheme1', ['role1', 'role2'])

  // 2 questions
  // - if i want to have those ALL ALL permutations in function names - pass ALL as an argument?
  // - if i want to have different functions for different objects - use overload instead?
}
