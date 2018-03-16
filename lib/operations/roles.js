import { isArray } from 'lodash';
import { template, escapeValue } from '../utils';

const formatRoleOptions = (roleOptions = {}) => {
  const options = [];
  options.push(roleOptions.superuser ? 'SUPERUSER' : 'NOSUPERUSER');
  options.push(roleOptions.createdb ? 'CREATEDB' : 'NOCREATEDB');
  options.push(roleOptions.createrole ? 'CREATEROLE' : 'NOCREATEROLE');
  options.push(roleOptions.inherit === false ? 'NOINHERIT' : 'INHERIT');
  options.push(roleOptions.login ? 'LOGIN' : 'NOLOGIN');
  options.push(roleOptions.replication ? 'REPLICATION' : 'NOREPLICATION');
  if (roleOptions.bypassrls !== undefined) {
    options.push(roleOptions.bypassrls ? 'BYPASSRLS' : 'NOBYPASSRLS');
  }
  if (roleOptions.limit) {
    options.push(`CONNECTION LIMIT ${Number(roleOptions.limit)}`);
  }
  if (roleOptions.password) {
    options.push(`${roleOptions.encrypted === false ? 'UNENCRYPTED' : 'ENCRYPTED'} PASSWORD ${escapeValue(roleOptions.password)}`);
  }
  if (roleOptions.valid) {
    options.push(`VALID UNTIL ${escapeValue(roleOptions.valid)}`);
  }
  if (roleOptions.inRole) {
    options.push(`IN ROLE ${isArray(roleOptions.inRole) ? roleOptions.inRole.join(',') : roleOptions.inRole}`);
  }
  if (roleOptions.role) {
    options.push(`ROLE ${isArray(roleOptions.role) ? roleOptions.role.join(',') : roleOptions.role}`);
  }
  if (roleOptions.admin) {
    options.push(`ADMIN ${isArray(roleOptions.admin) ? roleOptions.admin.join(',') : roleOptions.admin}`);
  }

  return options.join(' ');
};

export const create = (roleName, roleOptions = {}) => {
  const options = formatRoleOptions(roleOptions);
  return template`CREATE ROLE "${roleName}"${options ? ` WITH ${options}` : ''};`;
};

export const drop = (roleName, { ifExists } = {}) =>
  template`DROP ROLE${ifExists ? ' IF EXISTS' : ''} "${roleName}";`;

export const alter = (roleName, roleOptions = {}) => {
  const options = formatRoleOptions(roleOptions);
  return template`ALTER ROLE "${roleName}"${options ? ` WITH ${options}` : ''};`;
};

export const rename = (oldRoleName, newRoleName) =>
  template`ALTER ROLE "${oldRoleName}" RENAME TO "${newRoleName}";`;

export const undoRename = (oldRoleName, newRoleName) =>
  rename(newRoleName, oldRoleName);

// setup reverse functions
create.reverse = drop;
rename.reverse = undoRename;
