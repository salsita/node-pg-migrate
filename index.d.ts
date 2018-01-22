// Type definitions for node-pg-migrate 2.3
// Project: https://github.com/salsita/node-pg-migrate
// Definitions by: Bradley Ayers <https://github.com/bradleyayers>
// Definitions by: Sam Grönblom <https://github.com/sgronblo>
// Definitions by: Jan Doležel <https://github.com/dolezel>

interface ValueArray extends Array<Value> {}

export type Value = null | boolean | string | number | PgLiteral | ValueArray

export type Name = string | { schema?: string, name: string }

export type Type = string | { type: string }

export interface ForeignKeyOptions {
    columns: Name | Name[]
    references?: Name
    onDelete?: string
    onUpdate?: string
    match?: 'FULL' | 'SIMPLE'
}

export interface ConstraintOptions {
    check?: string
    unique?: Name[] | Name[][]
    primaryKey?: Name | Name[]
    foreignKeys?: ForeignKeyOptions | ForeignKeyOptions[]
    exclude?: string
    deferrable?: boolean
    deferred?: boolean
}

export interface ColumnDefinition {
    type: string
    collation?: string
    unique?: boolean
    primaryKey?: boolean
    notNull?: boolean
    default?: Value
    check?: string
    references?: Name
    onDelete?: string
    onUpdate?: string
    match?: 'FULL' | 'SIMPLE'
    deferrable?: boolean
    deferred?: boolean
}

export interface TableOptions {
    temporary?: boolean
    ifNotExists?: boolean
    inherits?: Name
    like?: Name
    constraints?: ConstraintOptions
}

export interface ColumnOptions {
    type?: string
    default?: Value
    notNull?: boolean
    allowNull?: boolean
    collation?: string
    using?: string
}

export interface CreateIndexOptions {
    name?: string
    unique?: boolean
    where?: string
    concurrently?: boolean
    method?: 'btree' | 'hash' | 'gist' | 'spgist' | 'gin'
}

export interface ColumnDefinitions {
    [name: string]: ColumnDefinition | string
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

export interface CascadeOption {
    cascade?: boolean
}

export type DropOptions = IfExistsOption & CascadeOption

interface DropIndexOptionsEn {
    name?: string
    concurrently?: boolean
}

export type DropIndexOptions = DropIndexOptionsEn & DropOptions

export interface FunctionParamType {
    mode: 'IN' | 'OUT' | 'INOUT' | 'VARIADIC'
    name: string
    type: string
    default: Value
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
    when: 'BEFORE' | 'AFTER' | 'INSTEAD OF'
    operation: string | string[]
    constraint: boolean
    function: Name
    level: 'STATEMENT' | 'ROW'
    condition: string
    deferrable: boolean
    deferred: boolean
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
    type?: string
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

export interface MigrationBuilder {
    // Tables
    createTable(tableName: Name, columns: ColumnDefinitions, options?: TableOptions): void
    dropTable(tableName: Name, drop_options: DropOptions): void
    renameTable(tablename: Name, new_tablename: Name): void

    // Columns
    addColumns(tablename: Name, new_columns: ColumnDefinitions): void
    addColumn(tablename: Name, new_columns: ColumnDefinitions): void
    dropColumns(tablename: Name, columns: string | string[] | { [name: string]: any }, drop_options: DropOptions): void
    dropColumn(tablename: Name, columns: string | string[] | { [name: string]: any }, drop_options: DropOptions): void
    renameColumn(tablename: Name, old_column_name: string, new_column_name: string): void
    alterColumn(tableName: Name, columnName: string, options: ColumnOptions): void

    // Constraints
    addConstraint(tablename: Name, constraint_name: string | null, expression: string | ConstraintOptions): void
    createConstraint(tablename: Name, constraint_name: string | null, expression: string | ConstraintOptions): void
    dropConstraint(tablename: Name, constraint_name: string, options: DropOptions): void
    renameConstraint(tablename: Name, old_constraint_name: string, new_constraint_name: string): void

    // Indexes
    createIndex(tableName: Name, columns: string | string[], options?: CreateIndexOptions): void
    addIndex(tableName: Name, columns: string | string[], options?: CreateIndexOptions): void
    dropIndex(tableName: Name, columns: string | string[], options?: DropIndexOptions): void

    // Extensions
    createExtension(extension: string | string[]): void
    addExtension(extension: string | string[]): void
    dropExtension(extension: string | string[], drop_options: DropOptions): void

    // Types
    createType(type_name: Name, values: Value[] | { [name: string]: Type }): void
    addType(type_name: Name, values: Value[] | { [name: string]: Type }): void
    dropType(type_name: Name, drop_options: DropOptions): void
    renameType(type_name: Name, new_type_name: Name): void
    addTypeAttribute(type_name: Name, attribute_name: string, attribute_type: Type): void
    dropTypeAttribute(type_name: Name, attribute_name: string, options: IfExistsOption): void
    setTypeAttribute(type_name: Name, attribute_name: string, attribute_type: Type): void
    addTypeValue(type_name: Name, value: Value, options: { ifNotExists?: boolean, before?: string, after?: string }): void
    renameTypeAttribute(type_name: Name, attribute_name: string, new_attribute_name: string): void

    // Roles
    createRole(role_name: Name, role_options: RoleOptions): void
    dropRole(role_name: Name, options: IfExistsOption): void
    alterRole(role_name: Name, role_options: RoleOptions): void
    renameRole(old_role_name: Name, new_role_name: Name): void

    // Functions
    createFunction(function_name: Name, function_params: FunctionParam[], function_options: FunctionOptions, definition: Value): void
    dropFunction(function_name: Name, function_params: FunctionParam[], drop_options: DropOptions): void
    renameFunction(old_function_name: Name, function_params: FunctionParam[], new_function_name: Name): void

    // Triggers
    createTrigger(table_name: Name, trigger_name: Name, trigger_options: TriggerOptions, definition?: Value): void
    dropTrigger(table_name: Name, trigger_name: Name, drop_options: DropOptions): void
    renameTrigger(table_name: Name, old_trigger_name: Name, new_trigger_name: Name): void

    // Schemas
    createSchema(schema_name: string, schema_options: { ifNotExists?: boolean, authorization?: string }): void
    dropSchema(schema_name: string, drop_options: DropOptions): void
    renameSchema(old_schema_name: string, new_schema_name: string): void

    // Domains
    createDomain(domain_name: Name, domain_options: DomainOptionsCreate): void
    dropDomain(domain_name: Name, drop_options: DropOptions): void
    alterDomain(domain_name: Name, domain_options: DomainOptionsAlter): void
    renameDomain(old_domain_name: Name, new_domain_name: Name): void

    // Domains
    createSequence(sequence_name: Name, sequence_options: SequenceOptionsCreate): void
    dropSequence(sequence_name: Name, drop_options: DropOptions): void
    alterSequence(sequence_name: Name, sequence_options: SequenceOptionsAlter): void
    renameSequence(old_sequence_name: Name, new_sequence_name: Name): void

    sql(sql: string, args?: object): void
    func(sql: string): PgLiteral
    noTransaction(): void
}

export class PgLiteral {
    static create(str: string): PgLiteral
    constructor(str: string)
    toString(): string
}

export interface RunnerOption {
    database_url: string
    migrations_table: string
    migrations_schema?: string
    schema?: string
    dir: string
    checkOrder?: boolean
    direction: 'up' | 'down'
    count: number
    ignorePattern: string
    file?: string
    dryRun?: boolean
    typeShorthands?: { [name: string]: string }
}

export default function (options: RunnerOption): Promise<void>
