import { isArray } from 'lodash';
import { template, escapeValue } from '../utils';

const formatRoleOptions = (role_options = {}) => {
  const options = [];
  options.push(role_options.superuser ? 'SUPERUSER' : 'NOSUPERUSER');
  options.push(role_options.createdb ? 'CREATEDB' : 'NOCREATEDB');
  options.push(role_options.createrole ? 'CREATEROLE' : 'NOCREATEROLE');
  options.push(!role_options.inherit ? 'NOINHERIT' : 'INHERIT');
  options.push(role_options.login ? 'LOGIN' : 'NOLOGIN');
  options.push(role_options.replication ? 'REPLICATION' : 'NOREPLICATION');
  if (role_options.bypassrls !== undefined) {
    options.push(role_options.bypassrls ? 'BYPASSRLS' : 'NOBYPASSRLS');
  }
  if (role_options.limit) {
    options.push(`CONNECTION LIMIT ${Number(role_options.limit)}`);
  }
  if (role_options.password) {
    options.push(`${!role_options.encrypted ? 'UNENCRYPTED' : 'ENCRYPTED'} PASSWORD ${escapeValue(role_options.password)}`);
  }
  if (role_options.valid) {
    options.push(`VALID UNTIL ${escapeValue(role_options.valid)}`);
  }
  if (role_options.inRole) {
    options.push(`IN ROLE ${isArray(role_options.inRole) ? role_options.inRole.join(',') : role_options.inRole}`);
  }
  if (role_options.role) {
    options.push(`ROLE ${isArray(role_options.role) ? role_options.role.join(',') : role_options.role}`);
  }
  if (role_options.admin) {
    options.push(`IN ROLE ${isArray(role_options.admin) ? role_options.admin.join(',') : role_options.admin}`);
  }

  return options.join(' ');
};

export const create = (role_name, role_options = {}) => {
  const options = formatRoleOptions(role_options);
  return template`CREATE ROLE ${role_name}${options ? ` WITH ${options}` : ''};`;
};

export const drop = role_name => `DROP ROLE "${role_name}";`;

export const alter = (role_name, role_options = {}) => {
  const options = formatRoleOptions(role_options);
  return template`ALTER ROLE ${role_name}${options ? ` WITH ${options}` : ''};`;
};

export const rename = (old_role_name, new_role_name) =>
  template`ALTER ROLE ${old_role_name} RENAME TO ${new_role_name};`;

export const undoRename = (old_role_name, new_role_name) =>
  rename(new_role_name, old_role_name);

// setup reverse functions
create.reverse = drop;
rename.reverse = undoRename;
