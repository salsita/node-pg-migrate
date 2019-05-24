// Type definitions for node-pg-migrate
// Project: https://github.com/salsita/node-pg-migrate
// Definitions by: Bradley Ayers <https://github.com/bradleyayers>
// Definitions by: Sam Grönblom <https://github.com/sgronblo>
// Definitions by: Jan Doležel <https://github.com/dolezel>
// Definitions by: Christopher Quadflieg <https://github.com/Shinigami92>

type LiteralUnion<T extends U, U = string> = T | (U & { zz_IGNORE_ME?: never });

interface ValueArray extends Array<Value> {}

export type Value = null | boolean | string | number | PgLiteral | ValueArray

export type Name = string | { schema?: string, name: string }

export type Type = string | { type: string }

export type Action = 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT'

export interface ReferencesOptions {
    referencesConstraintName?: string
    references?: Name
    onDelete?: Action
    onUpdate?: Action
    match?: 'FULL' | 'SIMPLE'
}

export interface ForeignKeyOptions extends ReferencesOptions {
    columns: Name | Name[]
}

export interface ConstraintOptions {
    check?: string | string[]
    unique?: Name[] | Name[][]
    primaryKey?: Name | Name[]
    foreignKeys?: ForeignKeyOptions | ForeignKeyOptions[]
    exclude?: string
    deferrable?: boolean
    deferred?: boolean
}

export interface ColumnDefinition extends ReferencesOptions {
    type: string
    collation?: string
    unique?: boolean
    primaryKey?: boolean
    notNull?: boolean
    default?: Value
    check?: string
    deferrable?: boolean
    deferred?: boolean
    comment?: string | null
    generated?: { precedence: 'ALWAYS' | 'BY DEFAULT' } & SequenceOptions
}

export type Like = 'COMMENTS' | 'CONSTRAINTS' | 'DEFAULTS' | 'IDENTITY' | 'INDEXES' | 'STATISTICS' | 'STORAGE' | 'ALL'

export interface LikeOptions {
    including?: Like | Like[]
    excluding?: Like | Like[]
}

export interface TableOptions {
    temporary?: boolean
    ifNotExists?: boolean
    inherits?: Name
    like?: Name | { table: Name, options?: LikeOptions }
    constraints?: ConstraintOptions
    comment?: string | null
}

export interface AlterColumnOptions {
    type?: string
    default?: Value
    notNull?: boolean
    allowNull?: boolean
    collation?: string
    using?: string
    comment?: string | null
    generated?: null | false | ({ precedence: 'ALWAYS' | 'BY DEFAULT' } & SequenceOptions)
}

export interface CreateIndexOptions {
    name?: string
    unique?: boolean
    where?: string
    concurrently?: boolean
    opclass?: string
    method?: 'btree' | 'hash' | 'gist' | 'spgist' | 'gin'
}

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
    ifNotExists?: boolean
    schema?: string
}

export interface ColumnDefinitions {
    [name: string]: ColumnDefinition | string
}

export interface AlterTableOptions {
    levelSecurity: 'DISABLE' | 'ENABLE' | 'FORCE' | 'NO FORCE'
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

export interface RoleOptions {
    superuser?: boolean
    createdb?: boolean
    createrole?: boolean
    inherit?: boolean
    login?: boolean
    replication?: boolean
    bypassrls?: boolean
    limit?: number
    password?: Value
    encrypted?: boolean
    valid?: Value
    inRole?: string | string[]
    role?: string | string[]
    admin?: string | string[]
}

export interface IfExistsOption {
    ifExists?: boolean
}

export interface IfNotExistsOption {
    ifNotExists?: boolean
}

export interface CascadeOption {
    cascade?: boolean
}

export type AddOptions = IfNotExistsOption
export type DropOptions = IfExistsOption & CascadeOption

interface DropIndexOptionsEn {
    name?: string
    concurrently?: boolean
}

export type DropIndexOptions = DropIndexOptionsEn & DropOptions

export interface FunctionParamType {
    mode?: 'IN' | 'OUT' | 'INOUT' | 'VARIADIC'
    name?: string
    type: string
    default?: Value
}

export type FunctionParam = string | FunctionParamType

export interface FunctionOptions {
    returns?: string
    language: string
    replace?: boolean
    window?: boolean
    behavior?: 'IMMUTABLE' | 'STABLE' | 'VOLATILE'
    onNull?: boolean
    parallel?: 'UNSAFE' | 'RESTRICTED' | 'SAFE'
}

interface TriggerOptionsEn {
    when?: 'BEFORE' | 'AFTER' | 'INSTEAD OF'
    operation: string | string[]
    constraint?: boolean
    function?: Name
    functionParams?: Value[],
    level?: 'STATEMENT' | 'ROW'
    condition?: string
    deferrable?: boolean
    deferred?: boolean
}

export type TriggerOptions = TriggerOptionsEn & FunctionOptions

interface DomainOptions {
    default?: Value
    notNull?: boolean
    check?: string
    constraintName?: string
}

interface DomainOptionsCreateEn {
    collation?: string
}

interface DomainOptionsAlterEn {
    allowNull?: boolean
}

export type DomainOptionsCreate = DomainOptionsCreateEn & DomainOptions

export type DomainOptionsAlter = DomainOptionsAlterEn & DomainOptions

interface SequenceOptions {
    type?: Type
    increment?: number
    minvalue?: number | null | false
    maxvalue?: number | null | false
    start?: number
    cache?: number
    cycle?: boolean
    owner?: string | null | false
}

interface SequenceOptionsCreateEn {
    temporary?: boolean
    ifNotExists?: boolean
}

interface SequenceOptionsAlterEn {
    restart?: number | true
}

export type SequenceOptionsCreate = SequenceOptionsCreateEn & SequenceOptions

export type SequenceOptionsAlter = SequenceOptionsAlterEn & SequenceOptions

export interface CreateOperatorOptions {
    procedure: Name
    left?: Name
    right?: Name
    commutator?: Name
    negator?: Name
    restrict?: Name
    join?: Name
    hashes?: boolean
    merges?: boolean
}

export interface DropOperatorOptions {
    left?: Name
    right?: Name
    ifExists?: boolean
    cascade?: boolean
}

export interface CreateOperatorClassOptions {
    default?: boolean
    family?: string
}

export interface OperatorListDefinition {
    type: 'function' | 'operator'
    number: number
    name: Name
    params?: FunctionParam[]
}

export interface PolicyOptions {
    role: string | string[]
    using: string
    check: string
}

export interface CreatePolicyOptionsEn {
    command: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
}

export type CreatePolicyOptions = CreatePolicyOptionsEn & PolicyOptions

export interface CreateViewOptions {
    temporary?: boolean
    replace?: boolean
    recursive?: boolean
    columns?: string | string[]
    checkOption?: 'CASCADED' | 'LOCAL'
}

export interface AlterViewOptions {
    checkOption?: null | false | 'CASCADED' | 'LOCAL'
}

export interface AlterViewColumnOptions {
    default?: Value
}

export interface CreateMaterializedViewOptions {
    ifNotExists?: boolean
    columns?: string | string[]
    tablespace?: string
    storageParameters: object
    data?: boolean
}

export interface AlterMaterializedViewOptions {
    cluster?: null | false | string
    extension?: string
    storageParameters?: object
}

export interface RefreshMaterializedViewOptions {
    concurrently?: boolean
    data?: boolean
}

import { QueryConfig, QueryResult, Client } from "pg";

// see ClientBase in @types/pg
interface DB {
    query(queryConfig: QueryConfig): Promise<QueryResult>;
    query(queryTextOrConfig: string | QueryConfig, values?: any[]): Promise<QueryResult>;

    select(queryConfig: QueryConfig): Promise<any[]>;
    select(queryTextOrConfig: string | QueryConfig, values?: any[]): Promise<any[]>;
}

export interface MigrationBuilder {
    // Tables
    createTable(tableName: Name, columns: ColumnDefinitions, options?: TableOptions): void
    dropTable(tableName: Name, dropOptions?: DropOptions): void
    renameTable(tableName: Name, newtableName: Name): void
    alterTable(tableName: Name, alterOptions: AlterTableOptions): void

    // Columns
    addColumns(tableName: Name, newColumns: ColumnDefinitions, addOptions?: AddOptions): void
    addColumn(tableName: Name, newColumns: ColumnDefinitions, addOptions?: AddOptions): void
    dropColumns(tableName: Name, columns: string | string[] | { [name: string]: any }, dropOptions?: DropOptions): void
    dropColumn(tableName: Name, columns: string | string[] | { [name: string]: any }, dropOptions?: DropOptions): void
    renameColumn(tableName: Name, oldColumnName: string, newColumnName: string): void
    alterColumn(tableName: Name, columnName: string, options: AlterColumnOptions): void

    // Constraints
    addConstraint(tableName: Name, constraintName: string | null, expression: string | ConstraintOptions): void
    createConstraint(tableName: Name, constraintName: string | null, expression: string | ConstraintOptions): void
    dropConstraint(tableName: Name, constraintName: string, options?: DropOptions): void
    renameConstraint(tableName: Name, oldConstraintName: string, newConstraintName: string): void

    // Indexes
    createIndex(tableName: Name, columns: string | string[], options?: CreateIndexOptions): void
    addIndex(tableName: Name, columns: string | string[], options?: CreateIndexOptions): void
    dropIndex(tableName: Name, columns: string | string[], options?: DropIndexOptions): void

    // Extensions
    createExtension(extension: LiteralUnion<Extension> | Array<LiteralUnion<Extension>>, options?: CreateExtensionOptions): void
    addExtension(extension: LiteralUnion<Extension> | Array<LiteralUnion<Extension>>, options?: CreateExtensionOptions): void
    dropExtension(extension: LiteralUnion<Extension> | Array<LiteralUnion<Extension>>, dropOptions?: DropOptions): void

    // Types
    createType(typeName: Name, values: Value[] | { [name: string]: Type }): void
    addType(typeName: Name, values: Value[] | { [name: string]: Type }): void
    dropType(typeName: Name, dropOptions?: DropOptions): void
    renameType(typeName: Name, newTypeName: Name): void
    addTypeAttribute(typeName: Name, attributeName: string, attributeType: Type): void
    dropTypeAttribute(typeName: Name, attributeName: string, options: IfExistsOption): void
    setTypeAttribute(typeName: Name, attributeName: string, attributeType: Type): void
    addTypeValue(typeName: Name, value: Value, options?: { ifNotExists?: boolean, before?: string, after?: string }): void
    renameTypeAttribute(typeName: Name, attributeName: string, newAttributeName: string): void
    renameTypeValue(typeName: Name, value: string, newValue: string): void

    // Roles
    createRole(roleName: Name, roleOptions?: RoleOptions): void
    dropRole(roleName: Name, options?: IfExistsOption): void
    alterRole(roleName: Name, roleOptions: RoleOptions): void
    renameRole(oldRoleName: Name, newRoleName: Name): void

    // Functions
    createFunction(functionName: Name, functionParams: FunctionParam[], functionOptions: FunctionOptions, definition: Value): void
    dropFunction(functionName: Name, functionParams: FunctionParam[], dropOptions?: DropOptions): void
    renameFunction(oldFunctionName: Name, functionParams: FunctionParam[], newFunctionName: Name): void

    // Triggers
    createTrigger(tableName: Name, triggerName: Name, triggerOptions: TriggerOptions, definition?: Value): void
    dropTrigger(tableName: Name, triggerName: Name, dropOptions?: DropOptions): void
    renameTrigger(tableName: Name, oldTriggerName: Name, newTriggerName: Name): void

    // Schemas
    createSchema(schemaName: string, schemaOptions?: { ifNotExists?: boolean, authorization?: string }): void
    dropSchema(schemaName: string, dropOptions?: DropOptions): void
    renameSchema(oldSchemaName: string, newSchemaName: string): void

    // Domains
    createDomain(domainName: Name, type: Type, domainOptions?: DomainOptionsCreate): void
    dropDomain(domainName: Name, dropOptions?: DropOptions): void
    alterDomain(domainName: Name, domainOptions: DomainOptionsAlter): void
    renameDomain(oldDomainName: Name, newDomainName: Name): void

    // Sequences
    createSequence(sequenceName: Name, sequenceOptions?: SequenceOptionsCreate): void
    dropSequence(sequenceName: Name, dropOptions?: DropOptions): void
    alterSequence(sequenceName: Name, sequenceOptions: SequenceOptionsAlter): void
    renameSequence(oldSequenceName: Name, newSequenceName: Name): void

    // Operators
    createOperator(operatorName: Name, options?: CreateOperatorOptions): void
    dropOperator(operatorName: Name, dropOptions?: DropOperatorOptions): void
    createOperatorClass(operatorClassName: Name, type: Type, indexMethod: Name, operatorList: OperatorListDefinition, options: CreateOperatorClassOptions): void
    dropOperatorClass(operatorClassName: Name, indexMethod: Name, dropOptions?: DropOptions): void
    renameOperatorClass(oldOperatorClassName: Name, indexMethod: Name, newOperatorClassName: Name): void
    createOperatorFamily(operatorFamilyName: Name, indexMethod: Name): void
    dropOperatorFamily(operatorFamilyName: Name, newSchemaName: Name, dropOptions?: DropOptions): void
    renameOperatorFamily(oldOperatorFamilyName: Name, indexMethod: Name, newOperatorFamilyName: Name): void
    addToOperatorFamily(operatorFamilyName: Name, indexMethod: Name, operatorList: OperatorListDefinition): void
    removeFromOperatorFamily(operatorFamilyName: Name, indexMethod: Name, operatorList: OperatorListDefinition): void

    // Policies
    createPolicy(tableName: Name, policyName: string, options?: CreatePolicyOptions): void
    dropPolicy(tableName: Name, policyName: string, options?: IfExistsOption): void
    alterPolicy(tableName: Name, policyName: string, options: PolicyOptions): void
    renamePolicy(tableName: Name, policyName: string, newPolicyName: string): void

    createView(viewName: Name, options: CreateViewOptions, definition: string): void
    dropView(viewName: Name, options?: DropOptions): void
    alterView(viewName: Name, options: AlterViewOptions): void
    alterViewColumn(viewName: Name, options: AlterViewColumnOptions): void
    renameView(viewName: Name, newViewName: Name): void

    createMaterializedView(viewName: Name, options: CreateMaterializedViewOptions, definition: string): void
    dropMaterializedView(viewName: Name, options?: DropOptions): void
    alterMaterializedView(viewName: Name, options: AlterMaterializedViewOptions): void
    renameMaterializedView(viewName: Name, newViewName: Name): void
    renameMaterializedViewColumn(viewName: Name, columnName: string, newColumnName: string): void
    refreshMaterializedView(viewName: Name, options?: RefreshMaterializedViewOptions): void

    sql(sql: string, args?: object): void
    func(sql: string): PgLiteral
    noTransaction(): void

    db: DB
}

export class PgLiteral {
    static create(str: string): PgLiteral
    constructor(str: string)
    toString(): string
}

export interface ConnectionConfig {
    user?: string;
    database?: string;
    password?: string;
    port?: number;
    host?: string;
    connectionString?: string;
}

import { TlsOptions } from "tls";

export interface ClientConfig extends ConnectionConfig {
    ssl?: boolean | TlsOptions;
}

export interface RunnerOptionUrl {
    databaseUrl: string | ClientConfig
}

export interface RunnerOptionClient {
    dbClient: Client
}

export interface RunnerOptionConfig {
    migrationsTable: string
    migrationsSchema?: string
    schema?: string
    dir: string
    checkOrder?: boolean
    direction: 'up' | 'down'
    count: number
    timestamp?: boolean
    ignorePattern: string
    file?: string
    dryRun?: boolean
    createSchema?: boolean
    createMigrationsSchema?: boolean
    singleTransaction?: boolean
    noLock?: boolean,
    fake?: boolean,
    log?: (msg:string) => void;
}

export type RunnerOption = RunnerOptionConfig & (RunnerOptionClient | RunnerOptionUrl)

export default function (options: RunnerOption): Promise<void>
