import { template } from '../utils';

export const drop = (schema_name, { ifExists, cascade } = {}) =>
  template`DROP SCHEMA${ifExists ? ' IF EXISTS' : ''} "${schema_name}"${cascade ? ' CASCADE' : ''};`;

export const create = (schema_name, options) => {
  const {
    ifNotExists,
    authorization,
  } = options;
  return template`CREATE SCHEMA${ifNotExists ? ' IF NOT EXISTS' : ''} "${schema_name}"${authorization ? ` AUTHORIZATION ${authorization}` : ''};`;
};

// RENAME
export const rename = (schema_name, new_schema_name) =>
  template`ALTER SCHEMA  "${schema_name}" RENAME TO "${new_schema_name}";`;

export const undoRename = (schema_name, new_schema_name) =>
  rename(new_schema_name, schema_name);

create.reverse = drop;
rename.reverse = undoRename;
