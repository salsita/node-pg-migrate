import { LiteralUnion, DropOptions, IfNotExistsOption } from './generalTypes'

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
  | 'xml2'

export interface CreateExtensionOptions extends IfNotExistsOption {
  schema?: string
}

type StringExtension = LiteralUnion<Extension>
type CreateExtensionFn = (
  extension: StringExtension | Array<StringExtension>,
  options?: CreateExtensionOptions & DropOptions,
) => string | string[]
export type CreateExtension = CreateExtensionFn & { reverse: CreateExtensionFn }
export type DropExtension = (
  extension: StringExtension | Array<StringExtension>,
  dropOptions?: DropOptions,
) => string | string[]
