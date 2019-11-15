import _ from 'lodash';
import { DropOptions, LiteralUnion } from '../definitions';
import { MigrationOptions } from '../migration-builder';

export type Extension =
  | 'adminpack'
  | 'amcheck'
  | 'auth_delay'
  | 'auto_explain'
  | 'bloom'
  | 'btree_gin'
  | 'btree_gist'
  | 'citext'
  | 'cube'
  | 'dblink'
  | 'dict_int'
  | 'dict_xsyn'
  | 'earthdistance'
  | 'file_fdw'
  | 'fuzzystrmatch'
  | 'hstore'
  | 'intagg'
  | 'intarray'
  | 'isn'
  | 'lo'
  | 'ltree'
  | 'pageinspect'
  | 'passwordcheck'
  | 'pg_buffercache'
  | 'pgcrypto'
  | 'pg_freespacemap'
  | 'pg_prewarm'
  | 'pgrowlocks'
  | 'pg_stat_statements'
  | 'pgstattuple'
  | 'pg_trgm'
  | 'pg_visibility'
  | 'postgres_fdw'
  | 'seg'
  | 'sepgsql'
  | 'spi'
  | 'sslinfo'
  | 'tablefunc'
  | 'tcn'
  | 'test_decoding'
  | 'tsm_system_rows'
  | 'tsm_system_time'
  | 'unaccent'
  | 'uuid-ossp'
  | 'xml2';

export interface CreateExtensionOptions {
  ifNotExists?: boolean;
  schema?: string;
}

export function dropExtension(mOptions: MigrationOptions) {
  const _drop = (
    extensions: LiteralUnion<Extension> | Array<LiteralUnion<Extension>>,
    { ifExists, cascade }: DropOptions = {}
  ) => {
    if (!_.isArray(extensions)) extensions = [extensions]; // eslint-disable-line no-param-reassign
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    return _.map(extensions, extension => {
      const extensionStr = mOptions.literal(extension);
      return `DROP EXTENSION${ifExistsStr} ${extensionStr}${cascadeStr};`;
    });
  };
  return _drop;
}

export function createExtension(mOptions: MigrationOptions) {
  const _create = (
    extensions: LiteralUnion<Extension> | Array<LiteralUnion<Extension>>,
    { ifNotExists, schema }: CreateExtensionOptions = {}
  ) => {
    if (!_.isArray(extensions)) extensions = [extensions]; // eslint-disable-line no-param-reassign
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const schemaStr = schema ? ` SCHEMA ${mOptions.literal(schema)}` : '';
    return _.map(extensions, extension => {
      const extensionStr = mOptions.literal(extension);
      return `CREATE EXTENSION${ifNotExistsStr} ${extensionStr}${schemaStr};`;
    });
  };
  _create.reverse = dropExtension(mOptions);
  return _create;
}
