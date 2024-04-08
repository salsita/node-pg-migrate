import type {
  ClientBase,
  ClientConfig,
  QueryArrayConfig,
  QueryArrayResult,
  QueryConfig,
  QueryResult,
} from 'pg';
import type * as domains from './operations/domains';
import type * as extensions from './operations/extensionsTypes';
import type * as functions from './operations/functionsTypes';
import type { Name } from './operations/generalTypes';
import type * as indexes from './operations/indexesTypes';
import type * as operators from './operations/operatorsTypes';
import type * as other from './operations/othersTypes';
import type PgLiteral from './operations/PgLiteral';
import type * as policies from './operations/policiesTypes';
import type * as roles from './operations/rolesTypes';
import type * as schemas from './operations/schemasTypes';
import type * as sequences from './operations/sequencesTypes';
import type * as tables from './operations/tablesTypes';
import type * as triggers from './operations/triggersTypes';
import type * as types from './operations/typesTypes';
import type * as mViews from './operations/viewsMaterializedTypes';
import type * as views from './operations/viewsTypes';

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
  createExtension: (...args: Parameters<extensions.CreateExtension>) => void;
  dropExtension: (...args: Parameters<extensions.DropExtension>) => void;
  addExtension: (...args: Parameters<extensions.CreateExtension>) => void;

  createTable: (...args: Parameters<tables.CreateTable>) => void;
  dropTable: (...args: Parameters<tables.DropTable>) => void;
  renameTable: (...args: Parameters<tables.RenameTable>) => void;
  alterTable: (...args: Parameters<tables.AlterTable>) => void;

  addColumns: (...args: Parameters<tables.AddColumns>) => void;
  dropColumns: (...args: Parameters<tables.DropColumns>) => void;
  renameColumn: (...args: Parameters<tables.RenameColumn>) => void;
  alterColumn: (...args: Parameters<tables.AlterColumn>) => void;
  addColumn: (...args: Parameters<tables.AddColumns>) => void;
  dropColumn: (...args: Parameters<tables.DropColumns>) => void;

  addConstraint: (...args: Parameters<tables.CreateConstraint>) => void;
  dropConstraint: (...args: Parameters<tables.DropConstraint>) => void;
  renameConstraint: (...args: Parameters<tables.RenameConstraint>) => void;
  createConstraint: (...args: Parameters<tables.CreateConstraint>) => void;

  createType: (...args: Parameters<types.CreateType>) => void;
  dropType: (...args: Parameters<types.DropType>) => void;
  addType: (...args: Parameters<types.CreateType>) => void;
  renameType: (...args: Parameters<types.RenameType>) => void;
  renameTypeAttribute: (...args: Parameters<types.RenameTypeAttribute>) => void;
  renameTypeValue: (...args: Parameters<types.RenameTypeValue>) => void;
  addTypeAttribute: (...args: Parameters<types.AddTypeAttribute>) => void;
  dropTypeAttribute: (...args: Parameters<types.DropTypeAttribute>) => void;
  setTypeAttribute: (...args: Parameters<types.SetTypeAttribute>) => void;
  addTypeValue: (...args: Parameters<types.AddTypeValue>) => void;

  createIndex: (...args: Parameters<indexes.CreateIndex>) => void;
  dropIndex: (...args: Parameters<indexes.DropIndex>) => void;
  addIndex: (...args: Parameters<indexes.CreateIndex>) => void;

  createRole: (...args: Parameters<roles.CreateRole>) => void;
  dropRole: (...args: Parameters<roles.DropRole>) => void;
  alterRole: (...args: Parameters<roles.AlterRole>) => void;
  renameRole: (...args: Parameters<roles.RenameRole>) => void;

  createFunction: (...args: Parameters<functions.CreateFunction>) => void;
  dropFunction: (...args: Parameters<functions.DropFunction>) => void;
  renameFunction: (...args: Parameters<functions.RenameFunction>) => void;

  createTrigger: (...args: Parameters<triggers.CreateTrigger>) => void;
  dropTrigger: (...args: Parameters<triggers.DropTrigger>) => void;
  renameTrigger: (...args: Parameters<triggers.RenameTrigger>) => void;

  createSchema: (...args: Parameters<schemas.CreateSchema>) => void;
  dropSchema: (...args: Parameters<schemas.DropSchema>) => void;
  renameSchema: (...args: Parameters<schemas.RenameSchema>) => void;

  createDomain: (...args: Parameters<domains.CreateDomain>) => void;
  dropDomain: (...args: Parameters<domains.DropDomain>) => void;
  alterDomain: (...args: Parameters<domains.AlterDomain>) => void;
  renameDomain: (...args: Parameters<domains.RenameDomain>) => void;

  createSequence: (...args: Parameters<sequences.CreateSequence>) => void;
  dropSequence: (...args: Parameters<sequences.DropSequence>) => void;
  alterSequence: (...args: Parameters<sequences.AlterSequence>) => void;
  renameSequence: (...args: Parameters<sequences.RenameSequence>) => void;

  createOperator: (...args: Parameters<operators.CreateOperator>) => void;
  dropOperator: (...args: Parameters<operators.DropOperator>) => void;
  createOperatorClass: (
    ...args: Parameters<operators.CreateOperatorClass>
  ) => void;
  dropOperatorClass: (...args: Parameters<operators.DropOperatorClass>) => void;
  renameOperatorClass: (
    ...args: Parameters<operators.RenameOperatorClass>
  ) => void;
  createOperatorFamily: (
    ...args: Parameters<operators.CreateOperatorFamily>
  ) => void;
  dropOperatorFamily: (
    ...args: Parameters<operators.DropOperatorFamily>
  ) => void;
  renameOperatorFamily: (
    ...args: Parameters<operators.RenameOperatorFamily>
  ) => void;
  addToOperatorFamily: (
    ...args: Parameters<operators.AddToOperatorFamily>
  ) => void;
  removeFromOperatorFamily: (
    ...args: Parameters<operators.RemoveFromOperatorFamily>
  ) => void;

  createPolicy: (...args: Parameters<policies.CreatePolicy>) => void;
  dropPolicy: (...args: Parameters<policies.DropPolicy>) => void;
  alterPolicy: (...args: Parameters<policies.AlterPolicy>) => void;
  renamePolicy: (...args: Parameters<policies.RenamePolicy>) => void;

  createView: (...args: Parameters<views.CreateView>) => void;
  dropView: (...args: Parameters<views.DropView>) => void;
  alterView: (...args: Parameters<views.AlterView>) => void;
  alterViewColumn: (...args: Parameters<views.AlterViewColumn>) => void;
  renameView: (...args: Parameters<views.RenameView>) => void;

  createMaterializedView: (
    ...args: Parameters<mViews.CreateMaterializedView>
  ) => void;
  dropMaterializedView: (
    ...args: Parameters<mViews.DropMaterializedView>
  ) => void;
  alterMaterializedView: (
    ...args: Parameters<mViews.AlterMaterializedView>
  ) => void;
  renameMaterializedView: (
    ...args: Parameters<mViews.RenameMaterializedView>
  ) => void;
  renameMaterializedViewColumn: (
    ...args: Parameters<mViews.RenameMaterializedViewColumn>
  ) => void;
  refreshMaterializedView: (
    ...args: Parameters<mViews.RefreshMaterializedView>
  ) => void;

  sql: (...args: Parameters<other.Sql>) => void;

  func: (sql: string) => PgLiteral;

  noTransaction: () => void;

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
   * The directory containing your migration files.
   */
  dir: string;

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
   */
  ignorePattern?: string;

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
