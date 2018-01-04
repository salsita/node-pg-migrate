// Original definitions by: Bradley Ayers <https://github.com/bradleyayers>
// TypeScript Version: 2.3

declare module 'node-pg-migrate' {
    export interface ColumnDefinition {
        type: string;
        collation?: string
        unique?: boolean;
        primaryKey?: boolean;
        notNull?: boolean;
        default?: string
        check?: string;
        references?: string;
        onDelete?: string;
        onUpdate?: string;
        match?: 'FULL' | 'SIMPLE'
        deferrable?: boolean
        deferred?: boolean
    }

    export interface ColumnOptions {
        type?: string;
        default?: string | PgLiteral | null;
        notNull?: boolean;
        allowNull?: boolean;
    }

    export interface CreateIndexOptions {
        name?: string;
        unique?: boolean;
        where?: string;
        concurrently?: boolean;
        method?: 'btree' | 'hash' | 'gist' | 'spgist' | 'gin';
    }

    export interface ColumnDefinitions {
        [name: string]: ColumnDefinition | string;
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

    export type TableDescriptor = string | { schema: string, name: string };

    export interface RoleOptions {
        superuser?: boolean
        createdb?: boolean
        createrole?: boolean
        inherit?: boolean
        login?: boolean
        replication?: boolean
        bypassrls?: boolean
        limit?: number
        password?: string
        encrypted?: boolean
        valid?: string
        inRole?: string | string[]
        role?: string | string[]
        admin?: string | string[]
    }

    export interface DropOptions {
        ifExists?: boolean,
        cascade?: boolean
    }

    export interface FunctionParam {
        mode: 'IN' | 'OUT' | 'INOUT' | 'VARIADIC'
        name: string
        type: string
        default: string
    }

    export interface FunctionOptions {
        returns: string
        language: string
        replace: boolean
        window: boolean
        behavior: 'IMMUTABLE' | 'STABLE' | 'VOLATILE'
        onNull: boolean
        parallel: 'UNSAFE' | 'RESTRICTED' | 'SAFE'
    }

    export interface TriggerOptions {
        when: 'BEFORE' | 'AFTER' | 'INSTEAD OF'
        operation: string | string[]
        constraint: boolean
        function: string
        level: 'STATEMENT' | 'ROW'
        condition: string
        deferrable: boolean
        deferred: boolean
    }

    export interface MigrationBuilder {
        // Tables
        createTable(tableName: TableDescriptor, columns: ColumnDefinitions, options?: { inherits?: string }): void;
        dropTable(tableName: TableDescriptor): void;
        renameTable(tablename: TableDescriptor, new_tablename: TableDescriptor): void;

        // Columns
        addColumns(tablename: TableDescriptor, new_columns: ColumnDefinitions): void;
        addColumn(tablename: TableDescriptor, new_columns: ColumnDefinitions): void;
        dropColumns(tablename: TableDescriptor, columns: string[] | { [name: string]: any }): void;
        dropColumn(tablename: TableDescriptor, columns: string[] | { [name: string]: any }): void;
        renameColumn(tablename: TableDescriptor, old_column_name: string, new_column_name: string): void;
        alterColumn(tableName: TableDescriptor, columnName: string, options: ColumnOptions): void;

        // Constraints
        addConstraint(tablename: TableDescriptor, constraint_name: string, expression: string): void;
        createConstraint(tablename: TableDescriptor, constraint_name: string, expression: string): void;
        dropConstraint(tablename: TableDescriptor, constraint_name: string): void;
        renameConstraint(tablename: TableDescriptor, old_constraint_name: string, new_constraint_name: string): void;

        // Indexes
        createIndex(tableName: TableDescriptor, columns: string | string[], options?: CreateIndexOptions): void;
        addIndex(tableName: TableDescriptor, columns: string | string[], options?: CreateIndexOptions): void;
        dropIndex(tableName: TableDescriptor, columns: string | string[], options?: CreateIndexOptions): void;

        // Extensions
        createExtension(extension: string | string[]): void;
        addExtension(extension: string | string[]): void;
        dropExtension(extension: string | string[]): void;

        // Types
        createType(type_name: string, values: string[] | { [name: string]: string }): void;
        addType(type_name: string, values: string[] | { [name: string]: string }): void;
        dropType(type_name: string): void;
        renameType(type_name: string, new_type_name: string): void;
        addTypeAttribute(type_name: string, attribute_name: string, attribute_type: string): void;
        dropTypeAttribute(type_name: string, attribute_name: string, options: { ifExists?: boolean }): void;
        setTypeAttribute(type_name: string, attribute_name: string, attribute_type: string): void;
        addTypeValue(type_name: string, value: string, options: { ifNotExists?: boolean, before?: string, after?: string }): void;
        renameTypeAttribute(type_name: string, attribute_name: string, new_attribute_name: string): void;

        // Roles
        createRole(role_name: string, role_options: RoleOptions): void;
        dropRole(role_name: string): void;
        alterRole(role_name: string, role_options: RoleOptions): void;
        renameRole(old_role_name: string, new_role_name: string): void;

        // Functions
        createFunction(function_name: string, function_params: FunctionParam[], function_options: FunctionOptions, definition: string): void;
        dropFunction(function_name: string, function_params: FunctionParam[], drop_options: DropOptions): void;
        renameFunction(old_function_name: string, function_params: FunctionParam[], new_function_name: string): void;

        // Triggers
        createTrigger(table_name: string, trigger_name: string, trigger_options: TriggerOptions): void;
        dropTrigger(table_name: string, trigger_name: string, drop_options: DropOptions): void;
        renameTrigger(table_name: string, old_trigger_name: string, new_trigger_name: string): void;

        // Schemas
        createSchema(schema_name: string, schema_options: { ifNotExists?: boolean, authorization?: string }): void
        dropSchema(schema_name: string, drop_options: DropOptions): void
        renameSchema(old_schema_name: string, new_schema_name: string): void

        sql(sql: string, args?: object): void;
        func(sql: string): PgLiteral;

        noTransaction(): void;
    }

    export default function(options: any): Promise<void>;

    export class PgLiteral {
        static create(str: string): PgLiteral;
        constructor(str: string);
    }

}
