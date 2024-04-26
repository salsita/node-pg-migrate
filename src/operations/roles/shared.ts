import { escapeValue, toArray } from '../../utils';
import type { Value } from '../generalTypes';

export interface RoleOptions {
  superuser?: boolean;

  createdb?: boolean;

  createrole?: boolean;

  inherit?: boolean;

  login?: boolean;

  replication?: boolean;

  bypassrls?: boolean;

  limit?: number;

  password?: Value;

  encrypted?: boolean;

  valid?: Value;

  inRole?: string | string[];

  role?: string | string[];

  admin?: string | string[];
}

export function formatRoleOptions(roleOptions: RoleOptions = {}): string {
  const options: string[] = [];

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
    const encrypted =
      roleOptions.encrypted === false ? 'UNENCRYPTED' : 'ENCRYPTED';
    options.push(`${encrypted} PASSWORD ${escapeValue(roleOptions.password)}`);
  }

  if (roleOptions.valid !== undefined) {
    const valid = roleOptions.valid
      ? escapeValue(roleOptions.valid)
      : "'infinity'";
    options.push(`VALID UNTIL ${valid}`);
  }

  if (roleOptions.inRole) {
    const inRole = toArray(roleOptions.inRole).join(', ');
    options.push(`IN ROLE ${inRole}`);
  }

  if (roleOptions.role) {
    const role = toArray(roleOptions.role).join(', ');
    options.push(`ROLE ${role}`);
  }

  if (roleOptions.admin) {
    const admin = toArray(roleOptions.admin).join(', ');
    options.push(`ADMIN ${admin}`);
  }

  return options.join(' ');
}
