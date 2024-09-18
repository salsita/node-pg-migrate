import type {
  ClientBase,
  ClientConfig,
  QueryArrayConfig,
  QueryArrayResult,
  QueryConfig,
  QueryResult,
} from 'pg';
import type * as casts from './operations/casts';
import type * as domains from './operations/domains';
import type * as extensions from './operations/extensions';
import type * as functions from './operations/functions';
import type { Name } from './operations/generalTypes';
import type * as grants from './operations/grants';
import type * as indexes from './operations/indexes';
import type * as mViews from './operations/materializedViews';
import type * as operators from './operations/operators';
import type * as policies from './operations/policies';
import type * as roles from './operations/roles';
import type * as schemas from './operations/schemas';
import type * as sequences from './operations/sequences';
import type * as sql from './operations/sql';
import type * as tables from './operations/tables';
import type * as triggers from './operations/triggers';
import type * as types from './operations/types';
import type * as views from './operations/views';
import type { PgLiteral } from './utils/PgLiteral';

export type { ClientConfig, ConnectionConfig } from 'pg';

// see ClientBase in @types/pg
export interface DB {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  query(
    queryConfig: QueryArrayConfig,
    values?: any[]
  ): Promise<QueryArrayResult>;
  query(queryConfig: QueryConfig): Promise<QueryResult>;
  query(
    queryTextOrConfig: string | QueryConfig,
    values?: any[]
  ): Promise<QueryResult>;

  select(queryConfig: QueryArrayConfig, values?: any[]): Promise<any[]>;
  select(queryConfig: QueryConfig): Promise<any[]>;
  select(
    queryTextOrConfig: string | QueryConfig,
    values?: any[]
  ): Promise<any[]>;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export interface MigrationBuilder {
  /**
   * Install an extension.
   *
   * @alias addExtension
   *
   * @see https://www.postgresql.org/docs/current/sql-createextension.html
   */
  createExtension: (...args: Parameters<extensions.CreateExtension>) => void;
  /**
   * Remove an extension.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropextension.html
   */
  dropExtension: (...args: Parameters<extensions.DropExtension>) => void;
  /**
   * Install an extension.
   *
   * @alias createExtension
   *
   * @see https://www.postgresql.org/docs/current/sql-createextension.html
   */
  addExtension: (...args: Parameters<extensions.CreateExtension>) => void;

  /**
   * Define a new table.
   *
   * @see https://www.postgresql.org/docs/current/sql-createtable.html
   */
  createTable: (...args: Parameters<tables.CreateTable>) => void;
  /**
   * Remove a table.
   *
   * @see https://www.postgresql.org/docs/current/sql-droptable.html
   */
  dropTable: (...args: Parameters<tables.DropTable>) => void;
  /**
   * Rename a table.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  renameTable: (...args: Parameters<tables.RenameTable>) => void;
  /**
   * Change the definition of a table.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  alterTable: (...args: Parameters<tables.AlterTable>) => void;

  /**
   * Add columns to a table.
   *
   * @alias addColumn
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  addColumns: (...args: Parameters<tables.AddColumns>) => void;
  /**
   * Remove columns from a table.
   *
   * @alias dropColumn
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  dropColumns: (...args: Parameters<tables.DropColumns>) => void;
  /**
   * Rename a column.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  renameColumn: (...args: Parameters<tables.RenameColumn>) => void;
  /**
   * Change the definition of a column.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  alterColumn: (...args: Parameters<tables.AlterColumn>) => void;
  /**
   * Add a column to a table.
   *
   * @alias addColumns
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  addColumn: (...args: Parameters<tables.AddColumns>) => void;
  /**
   * Remove a column from a table.
   *
   * @alias dropColumns
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  dropColumn: (...args: Parameters<tables.DropColumns>) => void;

  /**
   * Add a constraint to a table.
   *
   * @alias createConstraint
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  addConstraint: (...args: Parameters<tables.CreateConstraint>) => void;
  /**
   * Remove a constraint from a table.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  dropConstraint: (...args: Parameters<tables.DropConstraint>) => void;
  /**
   * Rename a constraint.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  renameConstraint: (...args: Parameters<tables.RenameConstraint>) => void;
  /**
   * Add a constraint to a table.
   *
   * @alias addConstraint
   *
   * @see https://www.postgresql.org/docs/current/sql-altertable.html
   */
  createConstraint: (...args: Parameters<tables.CreateConstraint>) => void;

  /**
   * Define a new data type.
   *
   * @alias addType
   *
   * @see https://www.postgresql.org/docs/current/sql-createtype.html
   */
  createType: (...args: Parameters<types.CreateType>) => void;
  /**
   * Remove a data type.
   *
   * @see https://www.postgresql.org/docs/current/sql-droptype.html
   */
  dropType: (...args: Parameters<types.DropType>) => void;
  /**
   * Define a new data type.
   *
   * @alias createType
   *
   * @see https://www.postgresql.org/docs/current/sql-createtype.html
   */
  addType: (...args: Parameters<types.CreateType>) => void;
  /**
   * Rename a data type.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  renameType: (...args: Parameters<types.RenameType>) => void;
  /**
   * Rename a data type attribute.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  renameTypeAttribute: (...args: Parameters<types.RenameTypeAttribute>) => void;
  /**
   * Rename a data type value.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  renameTypeValue: (...args: Parameters<types.RenameTypeValue>) => void;
  /**
   * Add an attribute to a data type.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  addTypeAttribute: (...args: Parameters<types.AddTypeAttribute>) => void;
  /**
   * Remove an attribute from a data type.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  dropTypeAttribute: (...args: Parameters<types.DropTypeAttribute>) => void;
  /**
   * Set an attribute of a data type.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  setTypeAttribute: (...args: Parameters<types.SetTypeAttribute>) => void;
  /**
   * Add a value to a data type.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertype.html
   */
  addTypeValue: (...args: Parameters<types.AddTypeValue>) => void;

  /**
   * Define a new index.
   *
   * @alias addIndex
   *
   * @see https://www.postgresql.org/docs/current/sql-createindex.html
   */
  createIndex: (...args: Parameters<indexes.CreateIndex>) => void;
  /**
   * Remove an index.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropindex.html
   */
  dropIndex: (...args: Parameters<indexes.DropIndex>) => void;
  /**
   * Define a new index.
   *
   * @alias createIndex
   *
   * @see https://www.postgresql.org/docs/current/sql-createindex.html
   */
  addIndex: (...args: Parameters<indexes.CreateIndex>) => void;

  /**
   * Define a new database role.
   *
   * @see https://www.postgresql.org/docs/current/sql-createrole.html
   */
  createRole: (...args: Parameters<roles.CreateRole>) => void;
  /**
   * Remove a database role.
   *
   * @see https://www.postgresql.org/docs/current/sql-droprole.html
   */
  dropRole: (...args: Parameters<roles.DropRole>) => void;
  /**
   * Change a database role.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterrole.html
   */
  alterRole: (...args: Parameters<roles.AlterRole>) => void;
  /**
   * Rename a database role.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterrole.html
   */
  renameRole: (...args: Parameters<roles.RenameRole>) => void;

  /**
   * Define a new function.
   *
   * @see https://www.postgresql.org/docs/current/sql-createfunction.html
   */
  createFunction: (...args: Parameters<functions.CreateFunction>) => void;
  /**
   * Remove a function.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropfunction.html
   */
  dropFunction: (...args: Parameters<functions.DropFunction>) => void;
  /**
   * Rename a function.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterfunction.html
   */
  renameFunction: (...args: Parameters<functions.RenameFunction>) => void;

  /**
   * Define a new trigger.
   *
   * @see https://www.postgresql.org/docs/current/sql-createtrigger.html
   */
  createTrigger: (...args: Parameters<triggers.CreateTrigger>) => void;
  /**
   * Remove a trigger.
   *
   * @see https://www.postgresql.org/docs/current/sql-droptrigger.html
   */
  dropTrigger: (...args: Parameters<triggers.DropTrigger>) => void;
  /**
   * Rename a trigger.
   *
   * @see https://www.postgresql.org/docs/current/sql-altertrigger.html
   */
  renameTrigger: (...args: Parameters<triggers.RenameTrigger>) => void;

  /**
   * Define a new schema.
   *
   * @see https://www.postgresql.org/docs/current/sql-createschema.html
   */
  createSchema: (...args: Parameters<schemas.CreateSchema>) => void;
  /**
   * Remove a schema.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropschema.html
   */
  dropSchema: (...args: Parameters<schemas.DropSchema>) => void;
  /**
   * Rename a schema.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterschema.html
   */
  renameSchema: (...args: Parameters<schemas.RenameSchema>) => void;

  /**
   * Define a new domain.
   *
   * @see https://www.postgresql.org/docs/current/sql-createdomain.html
   */
  createDomain: (...args: Parameters<domains.CreateDomain>) => void;
  /**
   * Remove a domain.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropdomain.html
   */
  dropDomain: (...args: Parameters<domains.DropDomain>) => void;
  /**
   * Change the definition of a domain.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterdomain.html
   */
  alterDomain: (...args: Parameters<domains.AlterDomain>) => void;
  /**
   * Rename a domain.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterdomain.html
   */
  renameDomain: (...args: Parameters<domains.RenameDomain>) => void;

  /**
   * Define a new sequence generator.
   *
   * @see https://www.postgresql.org/docs/current/sql-createsequence.html
   */
  createSequence: (...args: Parameters<sequences.CreateSequence>) => void;
  /**
   * Remove a sequence.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropsequence.html
   */
  dropSequence: (...args: Parameters<sequences.DropSequence>) => void;
  /**
   * Change the definition of a sequence generator.
   *
   * @see https://www.postgresql.org/docs/current/sql-altersequence.html
   */
  alterSequence: (...args: Parameters<sequences.AlterSequence>) => void;
  /**
   * Rename a sequence.
   *
   * @see https://www.postgresql.org/docs/current/sql-altersequence.html
   */
  renameSequence: (...args: Parameters<sequences.RenameSequence>) => void;

  /**
   * Define a new operator.
   *
   * @see https://www.postgresql.org/docs/current/sql-createoperator.html
   */
  createOperator: (...args: Parameters<operators.CreateOperator>) => void;
  /**
   * Remove an operator.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropoperator.html
   */
  dropOperator: (...args: Parameters<operators.DropOperator>) => void;
  /**
   * Define a new operator class.
   *
   * @see https://www.postgresql.org/docs/current/sql-createopclass.html
   */
  createOperatorClass: (
    ...args: Parameters<operators.CreateOperatorClass>
  ) => void;
  /**
   * Remove an operator class.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropopclass.html
   */
  dropOperatorClass: (...args: Parameters<operators.DropOperatorClass>) => void;
  /**
   * Rename an operator class.
   *
   * @see https://www.postgresql.org/docs/current/sql-alteropclass.html
   */
  renameOperatorClass: (
    ...args: Parameters<operators.RenameOperatorClass>
  ) => void;
  /**
   * Define a new operator family.
   *
   * @see https://www.postgresql.org/docs/current/sql-createopfamily.html
   */
  createOperatorFamily: (
    ...args: Parameters<operators.CreateOperatorFamily>
  ) => void;
  /**
   * Remove an operator family.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropopfamily.html
   */
  dropOperatorFamily: (
    ...args: Parameters<operators.DropOperatorFamily>
  ) => void;
  /**
   * Rename an operator family.
   *
   * @see https://www.postgresql.org/docs/current/sql-alteropfamily.html
   */
  renameOperatorFamily: (
    ...args: Parameters<operators.RenameOperatorFamily>
  ) => void;
  /**
   * Add an operator to an operator family.
   *
   * @see https://www.postgresql.org/docs/current/sql-alteropfamily.html
   */
  addToOperatorFamily: (
    ...args: Parameters<operators.AddToOperatorFamily>
  ) => void;
  /**
   * Remove an operator from an operator family.
   *
   * @see https://www.postgresql.org/docs/current/sql-alteropfamily.html
   */
  removeFromOperatorFamily: (
    ...args: Parameters<operators.RemoveFromOperatorFamily>
  ) => void;

  /**
   * Define a new row-level security policy for a table.
   *
   * @see https://www.postgresql.org/docs/current/sql-createpolicy.html
   */
  createPolicy: (...args: Parameters<policies.CreatePolicy>) => void;
  /**
   * Remove a row-level security policy from a table.
   *
   * @see https://www.postgresql.org/docs/current/sql-droppolicy.html
   */
  dropPolicy: (...args: Parameters<policies.DropPolicy>) => void;
  /**
   * Change the definition of a row-level security policy.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterpolicy.html
   */
  alterPolicy: (...args: Parameters<policies.AlterPolicy>) => void;
  /**
   * Rename a row-level security policy.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterpolicy.html
   */
  renamePolicy: (...args: Parameters<policies.RenamePolicy>) => void;

  /**
   * Define a new view.
   *
   * @see https://www.postgresql.org/docs/current/sql-createview.html
   */
  createView: (...args: Parameters<views.CreateView>) => void;
  /**
   * Remove a view.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropview.html
   */
  dropView: (...args: Parameters<views.DropView>) => void;
  /**
   * Change the definition of a view.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterview.html
   */
  alterView: (...args: Parameters<views.AlterView>) => void;
  /**
   * Change the definition of a view column.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterview.html
   */
  alterViewColumn: (...args: Parameters<views.AlterViewColumn>) => void;
  /**
   * Rename a view.
   *
   * @see https://www.postgresql.org/docs/current/sql-alterview.html
   */
  renameView: (...args: Parameters<views.RenameView>) => void;

  /**
   * Define a new materialized view.
   *
   * @see https://www.postgresql.org/docs/current/sql-creatematerializedview.html
   */
  createMaterializedView: (
    ...args: Parameters<mViews.CreateMaterializedView>
  ) => void;
  /**
   * Remove a materialized view.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropmaterializedview.html
   */
  dropMaterializedView: (
    ...args: Parameters<mViews.DropMaterializedView>
  ) => void;
  /**
   * Change the definition of a materialized view.
   *
   * @see https://www.postgresql.org/docs/current/sql-altermaterializedview.html
   */
  alterMaterializedView: (
    ...args: Parameters<mViews.AlterMaterializedView>
  ) => void;
  /**
   * Rename a materialized view.
   *
   * @see https://www.postgresql.org/docs/current/sql-altermaterializedview.html
   */
  renameMaterializedView: (
    ...args: Parameters<mViews.RenameMaterializedView>
  ) => void;
  /**
   * Rename a materialized view column.
   *
   * @see https://www.postgresql.org/docs/current/sql-altermaterializedview.html
   */
  renameMaterializedViewColumn: (
    ...args: Parameters<mViews.RenameMaterializedViewColumn>
  ) => void;
  /**
   * Replace the contents of a materialized view.
   *
   * @see https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html
   */
  refreshMaterializedView: (
    ...args: Parameters<mViews.RefreshMaterializedView>
  ) => void;

  /**
   * Define access privileges.
   *
   * @see https://www.postgresql.org/docs/current/sql-grant.html
   */
  grantRoles: (...args: Parameters<grants.GrantRoles>) => void;
  /**
   * Remove access privileges.
   *
   * @see https://www.postgresql.org/docs/current/sql-revoke.html
   */
  revokeRoles: (...args: Parameters<grants.RevokeRoles>) => void;
  /**
   * Define access privileges.
   *
   * @see https://www.postgresql.org/docs/current/sql-grant.html
   */
  grantOnSchemas: (...args: Parameters<grants.GrantOnSchemas>) => void;
  /**
   * Remove access privileges.
   *
   * @see https://www.postgresql.org/docs/current/sql-revoke.html
   */
  revokeOnSchemas: (...args: Parameters<grants.RevokeOnSchemas>) => void;
  /**
   * Define access privileges.
   *
   * @see https://www.postgresql.org/docs/current/sql-grant.html
   */
  grantOnTables: (...args: Parameters<grants.GrantOnTables>) => void;
  /**
   * Remove access privileges.
   *
   * @see https://www.postgresql.org/docs/current/sql-revoke.html
   */
  revokeOnTables: (...args: Parameters<grants.RevokeOnTables>) => void;

  /**
   * Define a new cast.
   *
   * @see https://www.postgresql.org/docs/current/sql-createcast.html
   */
  createCast: (...args: Parameters<casts.CreateCast>) => void;
  /**
   * Remove a cast.
   *
   * @see https://www.postgresql.org/docs/current/sql-dropcast.html
   */
  dropCast: (...args: Parameters<casts.DropCast>) => void;

  /**
   * Run raw SQL, with some optional _[very basic](http://mir.aculo.us/2011/03/09/little-helpers-a-tweet-sized-javascript-templating-engine/)_ mustache templating.
   *
   * This is a low-level operation, and you should use the higher-level operations whenever possible.
   *
   * @param sql SQL query to run.
   * @param args Optional `key/val` of arguments to replace.
   *
   * @see https://www.postgresql.org/docs/current/sql-commands.html
   */
  sql: (...args: Parameters<sql.Sql>) => void;

  /**
   * Inserts raw string, **which is not escaped**.
   *
   * @param sql String to **not escaped**.
   *
   * @example
   * { default: pgm.func('CURRENT_TIMESTAMP') }
   */
  func: (sql: string) => PgLiteral;

  /**
   * By default, all migrations are run in one transaction, but some DB
   * operations like add type value (`pgm.addTypeValue`) does not work if the
   * type is not created in the same transaction.
   * e.g. if it is created in previous migration. You need to run specific
   * migration outside a transaction (`pgm.noTransaction`).
   * Be aware that this means that you can have some migrations applied and some
   * not applied, if there is some error during migrating (leading to `ROLLBACK`).
   */
  noTransaction: () => void;

  /**
   * The `db` client instance.
   *
   * Can be used to run queries directly.
   */
  db: DB;
}

export type MigrationAction = (
  pgm: MigrationBuilder,
  run?: () => void
) => Promise<void> | void;

export type Literal = (v: Name) => string;

export type LogFn = (msg: string) => void;

export type Logger = {
  debug?: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
};

export interface MigrationBuilderActions {
  up?: MigrationAction | false;

  down?: MigrationAction | false;

  shorthands?: tables.ColumnDefinitions;
}

export interface MigrationOptions {
  typeShorthands?: tables.ColumnDefinitions;

  schemalize: Literal;

  literal: Literal;

  logger: Logger;
}

// Note these currently don't contain the parameterized types like
// bit(n), varchar(n) and so on, they have to be specified as strings
export enum PgType {
  BIGINT = 'bigint', // signed eight-byte integer
  INT8 = 'int8', // alias for bigint
  BIGSERIAL = 'bigserial', // autoincrementing eight-byte integer
  BIT_1 = 'bit', // fixed-length bit string
  BIT_VARYING = 'bit varying', // variable-length bit string
  VARBIT = 'varbit', // alias for bit varying
  SERIAL8 = 'serial8', // alias for bigserial
  BOOLEAN = 'boolean', // logical Boolean (true/false)
  BOOL = 'bool', // alias for boolean
  BOX = 'box', // rectangular box on a plane
  BYTEA = 'bytea', // binary data ("byte array")
  CHARACTER = 'character', // fixed-length character string
  CHAR = 'char', // alias for character
  CHARACTER_VARYING = 'character varying', // variable-length character string
  VARCHAR = 'varchar', // alias for character varying
  CIDR = 'cidr', // IPv4 or IPv6 network address
  CIRCLE = 'circle', // circle on a plane
  DATE = 'date', // calendar date (year, month, day)
  DOUBLE_PRECISION = 'double precision', // float8	double precision floating-point number (8 bytes)
  INET = 'inet', // IPv4 or IPv6 host address
  INTEGER = 'integer', // signed four-byte integer
  INT = 'int', // alias for int
  INT4 = 'int4', // alias for int
  INTERVAL = 'interval', // time span
  JSON = 'json', // textual JSON data
  JSONB = 'jsonb', // binary JSON data, decomposed
  LINE = 'line', // infinite line on a plane
  LSEG = 'lseg', // line segment on a plane
  MACADDR = 'macaddr', // MAC (Media Access Control) address
  MONEY = 'money', // currency amount
  NUMERIC = 'numeric', // exact numeric of selectable precision
  PATH = 'path', // geometric path on a plane
  PG_LSN = 'pg_lsn', // PostgreSQL Log Sequence Number
  POINT = 'point', // geometric point on a plane
  POLYGON = 'polygon', // closed geometric path on a plane
  REAL = 'real', // single precision floating-point number (4 bytes)
  FLOAT4 = 'float4', // alias for REAL
  SMALLINT = 'smallint', // signed two-byte integer
  INT2 = 'int2', // alias for smallint
  SMALLSERIAL = 'smallserial', // autoincrementing two-byte integer
  SERIAL2 = 'serial2', // alias for smallserial
  SERIAL = 'serial', // autoincrementing four-byte integer
  SERIAL4 = 'serial4', // alias for serial
  TEXT = 'text', // variable-length character string
  TIME = 'time', // time of day (no time zone)
  TIME_WITHOUT_TIME_ZONE = 'without time zone', // alias of time
  TIME_WITH_TIME_ZONE = 'time with time zone', // time of day, including time zone
  TIMETZ = 'timetz', // alias of time with time zone
  TIMESTAMP = 'timestamp', // date and time (no time zone)
  TIMESTAMP_WITHOUT_TIME_ZONE = 'timestamp without time zone', // alias of timestamp
  TIMESTAMP_WITH_TIME_ZONE = 'timestamp with time zone', // date and time, including time zone
  TIMESTAMPTZ = 'timestamptz', // alias of timestamp with time zone
  TSQUERY = 'tsquery', // text search query
  TSVECTOR = 'tsvector', // text search document
  TXID_SNAPSHOT = 'txid_snapshot', // user-level transaction ID snapshot
  UUID = 'uuid', // universally unique identifier
  XML = 'xml', // XML data
}

export type MigrationDirection = 'up' | 'down';

export interface RunnerOptionConfig {
  /**
   * The table storing which migrations have been run.
   */
  migrationsTable: string;

  /**
   * The schema storing table which migrations have been run.
   *
   * (defaults to same value as `schema`)
   */
  migrationsSchema?: string;

  /**
   * The schema on which migration will be run.
   *
   * @default 'public'
   */
  schema?: string | string[];

  /**
   * The directory containing your migration files. This path is resolved from `cwd()`.
   * Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern or
   * an array of glob patterns and set `useGlob = true`
   *
   * Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns
   */
  dir: string | string[];

  /**
   * Use [glob](https://www.npmjs.com/package/glob) to find migration files.
   * This will use `dir` _and_ `ignorePattern` to glob-search for migration files.
   *
   * Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns
   *
   * @default false
   */
  useGlob?: boolean;

  /**
   * Check order of migrations before running them.
   */
  checkOrder?: boolean;

  /**
   * Direction of migration-run.
   */
  direction: MigrationDirection;

  /**
   * Number of migration to run.
   */
  count?: number;

  /**
   * Treats `count` as timestamp.
   */
  timestamp?: boolean;

  /**
   * Regex pattern for file names to ignore (ignores files starting with `.` by default).
   * Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern or
   * an array of glob patterns and set `isGlob = true`
   *
   * Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns
   */
  ignorePattern?: string | string[];

  /**
   * Run only migration with this name.
   */
  file?: string;

  dryRun?: boolean;

  /**
   * Creates the configured schema if it doesn't exist.
   */
  createSchema?: boolean;

  /**
   * Creates the configured migration schema if it doesn't exist.
   */
  createMigrationsSchema?: boolean;

  /**
   * Combines all pending migrations into a single transaction so that if any migration fails, all will be rolled back.
   *
   * @default true
   */
  singleTransaction?: boolean;

  /**
   * Disables locking mechanism and checks.
   */
  noLock?: boolean;

  /**
   * Mark migrations as run without actually performing them (use with caution!).
   */
  fake?: boolean;

  /**
   * Runs [`decamelize`](https://github.com/sindresorhus/decamelize) on table/column/etc. names.
   */
  decamelize?: boolean;

  /**
   * Redirect log messages to this function, rather than `console`.
   */
  log?: LogFn;

  /**
   * Redirect messages to this logger object, rather than `console`.
   */
  logger?: Logger;

  /**
   * Print all debug messages like DB queries run (if you switch it on, it will disable `logger.debug` method).
   */
  verbose?: boolean;
}

export interface RunnerOptionUrl {
  /**
   * Connection string or client config which is passed to [new pg.Client](https://node-postgres.com/api/client#constructor)
   */
  databaseUrl: string | ClientConfig;
}

export interface RunnerOptionClient {
  /**
   * Instance of [new pg.Client](https://node-postgres.com/api/client).
   *
   * Instance should be connected to DB and after finishing migration, user is responsible to close connection.
   */
  dbClient: ClientBase;
}

export type RunnerOption = RunnerOptionConfig &
  (RunnerOptionClient | RunnerOptionUrl);
