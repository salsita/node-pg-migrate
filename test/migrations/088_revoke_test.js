import { constants } from './085_grant_tables_schemas_roles.js';
import { utils } from './086_grant_test.js';

const { schema, table, role1, role2, tablePrivileges, schemaPrivilege } =
  constants;
const { hasTablePrivileges, hasSchemaPrivilege, isMemberOf } = utils;

export const up = async (pgm) => {
  const hasGrantedTablePrivileges = await hasTablePrivileges(
    pgm,
    role1,
    table,
    tablePrivileges
  );

  if (hasGrantedTablePrivileges) {
    throw new Error(`${role1}'s table privileges were not revoked`);
  }

  const hasGrantedSchemaPrivilege = await hasSchemaPrivilege(
    pgm,
    role1,
    schema,
    schemaPrivilege
  );

  if (hasGrantedSchemaPrivilege) {
    throw new Error(
      `${role1}'s ${schemaPrivilege} schema privilege was not revoked`
    );
  }

  const isMemberOfRole1 = await isMemberOf(pgm, role2, [role1]);

  if (isMemberOfRole1) {
    throw new Error(`${role2}'s membership of ${role1} was not revoked`);
  }
};

export const down = () => null;
