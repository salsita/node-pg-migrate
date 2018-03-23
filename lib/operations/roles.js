import { isArray } from 'lodash';
import { template, escapeValue } from '../utils';

const formatRoleOptions = (roleOptions = {}) => {
  const options = [];
  if (roleOptions.superuser !== undefined) {
    options.push(roleOptions.superuser ? 'SUPERUSER' : 'NOSUPERUSER');
  }
  if (roleOptions.createdb !== undefined) {
    options.push(roleOptions.createdb ? 'CREATEDB' : 'NOCREATEDB');
  }
  if (roleOptions.createrole !== undefined) {
    options.push(roleOptions.createrole ? 'CREATEROLE' : 'NOCREATEROLE');
  }
  if (roleOptions.inherit !== undefined) {
    options.push(roleOptions.inherit ? 'INHERIT' : 'NOINHERIT');
  }
  if (roleOptions.login !== undefined) {
    options.push(roleOptions.login ? 'LOGIN' : 'NOLOGIN');
  }
  if (roleOptions.replication !== undefined) {
    options.push(roleOptions.replication ? 'REPLICATION' : 'NOREPLICATION');
  }
  if (roleOptions.bypassrls !== undefined) {
    options.push(roleOptions.bypassrls ? 'BYPASSRLS' : 'NOBYPASSRLS');
  }
  if (roleOptions.limit) {
    options.push(`CONNECTION LIMIT ${Number(roleOptions.limit)}`);
  }
  if (roleOptions.password !== undefined) {
    options.push(`${roleOptions.encrypted === false ? 'UNENCRYPTED' : 'ENCRYPTED'} PASSWORD ${escapeValue(roleOptions.password)}`);
  }
  if (roleOptions.valid !== undefined) {
    options.push(`VALID UNTIL ${roleOptions.valid ? escapeValue(roleOptions.valid) : "'infinity'"}`);
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
  const options = formatRoleOptions({
    ...roleOptions,
    superuser: roleOptions.superuser || false,
    createdb: roleOptions.createdb || false,
    createrole: roleOptions.createrole || false,
    inherit: roleOptions.inherit !== false,
    login: roleOptions.login || false,
    replication: roleOptions.replication || false,
  });
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
