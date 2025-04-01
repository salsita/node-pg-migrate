// Note these currently don't contain the parameterized types like
// bit(n), varchar(n) and so on, they have to be specified as strings
/**
 * @see https://www.postgresql.org/docs/current/datatype.html
 */
export const PgType = Object.freeze({
  /**
   * signed eight-byte integer
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-INT
   */
  BIGINT: 'bigint',
  /**
   * alias for bigint
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-INT
   */
  INT8: 'int8',
  /**
   * autoincrementing eight-byte integer
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-SERIAL
   */
  BIGSERIAL: 'bigserial',
  /**
   * alias for bigserial
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-SERIAL
   */
  SERIAL8: 'serial8',
  /**
   * fixed-length bit string
   *
   * @see https://www.postgresql.org/docs/current/datatype-bit.html#DATATYPE-BIT
   */
  BIT: 'bit',
  /**
   * fixed-length bit string
   *
   * @see https://www.postgresql.org/docs/current/datatype-bit.html#DATATYPE-BIT
   */
  BIT_1: 'bit',
  /**
   * variable-length bit string
   *
   * @see https://www.postgresql.org/docs/current/datatype-bit.html#DATATYPE-BIT
   */
  BIT_VARYING: 'bit varying',
  /**
   * alias for bit varying
   *
   * @see https://www.postgresql.org/docs/current/datatype-bit.html#DATATYPE-BIT
   */
  VARBIT: 'varbit',
  /**
   * logical Boolean (true/false)
   *
   * @see https://www.postgresql.org/docs/current/datatype-boolean.html#DATATYPE-BOOLEAN
   */
  BOOLEAN: 'boolean',
  /**
   * alias for boolean
   *
   * @see https://www.postgresql.org/docs/current/datatype-boolean.html#DATATYPE-BOOLEAN
   */
  BOOL: 'bool',
  /**
   * rectangular box on a plane
   *
   * @see https://www.postgresql.org/docs/current/datatype-geometric.html#DATATYPE-GEOMETRIC
   */
  BOX: 'box',
  /**
   * binary data ("byte array")
   *
   * @see https://www.postgresql.org/docs/current/datatype-binary.html#DATATYPE-BINARY
   */
  BYTEA: 'bytea',
  /**
   * fixed-length character string
   *
   * @see https://www.postgresql.org/docs/current/datatype-character.html#DATATYPE-CHARACTER
   */
  CHARACTER: 'character',
  /**
   * alias for character
   *
   * @see https://www.postgresql.org/docs/current/datatype-character.html#DATATYPE-CHARACTER
   */
  CHAR: 'char',
  /**
   * variable-length character string
   *
   * @see https://www.postgresql.org/docs/current/datatype-character.html#DATATYPE-CHARACTER
   */
  CHARACTER_VARYING: 'character varying',
  /**
   * alias for character varying
   *
   * @see https://www.postgresql.org/docs/current/datatype-character.html#DATATYPE-CHARACTER
   */
  VARCHAR: 'varchar',
  /**
   * IPv4 or IPv6 network address
   *
   * @see https://www.postgresql.org/docs/current/datatype-net-types.html#DATATYPE-NET-TYPES
   */
  CIDR: 'cidr',
  /**
   * circle on a plane
   *
   * @see https://www.postgresql.org/docs/current/datatype-geometric.html#DATATYPE-GEOMETRIC
   */
  CIRCLE: 'circle',
  /**
   * calendar date (year, month, day)
   *
   * @see https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-DATETIME
   */
  DATE: 'date',
  /**
   * float8	double precision floating-point number (8 bytes)
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-FLOAT
   */
  DOUBLE_PRECISION: 'double precision',
  /**
   * alias for double precision
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-FLOAT
   */
  FLOAT8: 'float8',
  /**
   * IPv4 or IPv6 host address
   *
   * @see https://www.postgresql.org/docs/current/datatype-net-types.html#DATATYPE-NET-TYPES
   */
  INET: 'inet',
  /**
   * signed four-byte integer
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-INT
   */
  INTEGER: 'integer',
  /**
   * alias for integer
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-INT
   */
  INT: 'int',
  /**
   * alias for integer
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-INT
   */
  INT4: 'int4',
  /**
   * time span
   *
   * @see https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-DATETIME
   */
  INTERVAL: 'interval',
  /**
   * textual JSON data
   *
   * @see https://www.postgresql.org/docs/current/datatype-json.html#DATATYPE-JSON
   */
  JSON: 'json',
  /**
   * binary JSON data, decomposed
   *
   * @see https://www.postgresql.org/docs/current/datatype-json.html#DATATYPE-JSON
   */
  JSONB: 'jsonb',
  /**
   * infinite line on a plane
   *
   * @see https://www.postgresql.org/docs/current/datatype-geometric.html#DATATYPE-GEOMETRIC
   */
  LINE: 'line',
  /**
   * line segment on a plane
   *
   * @see https://www.postgresql.org/docs/current/datatype-geometric.html#DATATYPE-GEOMETRIC
   */
  LSEG: 'lseg',
  /**
   * MAC (Media Access Control) address
   *
   * @see https://www.postgresql.org/docs/current/datatype-net-types.html#DATATYPE-NET-TYPES
   */
  MACADDR: 'macaddr',
  /**
   * MAC (Media Access Control) address (EUI-64 format)
   *
   * @see https://www.postgresql.org/docs/current/datatype-net-types.html#DATATYPE-NET-TYPES
   */
  MACADDR8: 'macaddr8',
  /**
   * currency amount
   *
   * @see https://www.postgresql.org/docs/current/datatype-money.html#DATATYPE-MONEY
   */
  MONEY: 'money',
  /**
   * exact numeric of selectable precision
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-NUMERIC-DECIMAL
   */
  NUMERIC: 'numeric',
  /**
   * alias for numeric
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-NUMERIC-DECIMAL
   */
  DECIMAL: 'decimal',
  /**
   * geometric path on a plane
   *
   * @see https://www.postgresql.org/docs/current/datatype-geometric.html#DATATYPE-GEOMETRIC
   */
  PATH: 'path',
  /**
   * PostgreSQL Log Sequence Number
   *
   * @see https://www.postgresql.org/docs/current/datatype-pg-lsn.html#DATATYPE-PG-LSN
   */
  PG_LSN: 'pg_lsn',
  /**
   * user-level transaction ID snapshot
   */
  PG_SNAPSHOT: 'pg_snapshot',
  /**
   * geometric point on a plane
   *
   * @see https://www.postgresql.org/docs/current/datatype-geometric.html#DATATYPE-GEOMETRIC
   */
  POINT: 'point',
  /**
   * closed geometric path on a plane
   *
   * @see https://www.postgresql.org/docs/current/datatype-geometric.html#DATATYPE-GEOMETRIC
   */
  POLYGON: 'polygon',
  /**
   * single precision floating-point number (4 bytes)
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-FLOAT
   */
  REAL: 'real',
  /**
   * alias for real
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-FLOAT
   */
  FLOAT4: 'float4',
  /**
   * signed two-byte integer
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-INT
   */
  SMALLINT: 'smallint',
  /**
   * alias for smallint
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-INT
   */
  INT2: 'int2',
  /**
   * autoincrementing two-byte integer
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-SERIAL
   */
  SMALLSERIAL: 'smallserial',
  /**
   * alias for smallserial
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-SERIAL
   */
  SERIAL2: 'serial2',
  /**
   * autoincrementing four-byte integer
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-SERIAL
   */
  SERIAL: 'serial',
  /**
   * alias for serial
   *
   * @see https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-SERIAL
   */
  SERIAL4: 'serial4',
  /**
   * variable-length character string
   *
   * @see https://www.postgresql.org/docs/current/datatype-character.html#DATATYPE-CHARACTER
   */
  TEXT: 'text',
  /**
   * time of day (no time zone)
   *
   * @see https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-DATETIME
   */
  TIME: 'time',
  /**
   * alias of time
   *
   * @see https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-DATETIME
   */
  TIME_WITHOUT_TIME_ZONE: 'time without time zone',
  /**
   * time of day, including time zone
   *
   * @see https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-DATETIME
   */
  TIME_WITH_TIME_ZONE: 'time with time zone',
  /**
   * alias of time with time zone
   *
   * @see https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-DATETIME
   */
  TIMETZ: 'timetz',
  /**
   * date and time (no time zone)
   *
   * @see https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-DATETIME
   */
  TIMESTAMP: 'timestamp',
  /**
   * alias of timestamp
   *
   * @see https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-DATETIME
   */
  TIMESTAMP_WITHOUT_TIME_ZONE: 'timestamp without time zone',
  /**
   * date and time, including time zone
   *
   * @see https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-DATETIME
   */
  TIMESTAMP_WITH_TIME_ZONE: 'timestamp with time zone',
  /**
   * alias of timestamp with time zone
   *
   * @see https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-DATETIME
   */
  TIMESTAMPTZ: 'timestamptz',
  /**
   * text search query
   *
   * @see https://www.postgresql.org/docs/current/datatype-textsearch.html#DATATYPE-TSQUERY
   */
  TSQUERY: 'tsquery',
  /**
   * text search document
   *
   * @see https://www.postgresql.org/docs/current/datatype-textsearch.html#DATATYPE-TSVECTOR
   */
  TSVECTOR: 'tsvector',
  /**
   * user-level transaction ID snapshot
   *
   * @deprecated see `PG_SNAPSHOT`
   */
  TXID_SNAPSHOT: 'txid_snapshot',
  /**
   * universally unique identifier
   *
   * @see https://www.postgresql.org/docs/current/datatype-uuid.html#DATATYPE-UUID
   */
  UUID: 'uuid',
  /**
   * XML data
   *
   * @see https://www.postgresql.org/docs/current/datatype-xml.html#DATATYPE-XML
   */
  XML: 'xml',
});

export type PgType = (typeof PgType)[keyof typeof PgType];
