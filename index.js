/* eslint-disable global-require */
const [major] = process.versions.node.split(".");
if (Number(major) >= 8) {
  module.exports = require("./lib/runner");
} else {
  module.exports = require("./dist/runner"); // eslint-disable-line import/no-unresolved
}

module.exports.PgType = {
  BIGINT: "bigint", // signed eight-byte integer
  INT8: "int8", // alias for bigint
  BIGSERIAL: "bigserial", // autoincrementing eight-byte integer
  BIT_1: "bit", // fixed-length bit string
  BIT_VARYING: "bit varying", // variable-length bit string
  VARBIT: "varbit", // alias for bit varying
  SERIAL8: "serial8", // alias for bigserial
  BOOLEAN: "boolean", // logical Boolean (true/false)
  BOOL: "bool", // alias for boolean
  BOX: "box", // rectangular box on a plane
  BYTEA: "bytea", // binary data ("byte array")
  CHARACTER: "character", // fixed-length character string
  CHAR: "char", // alias for character
  CHARACTER_VARYING: "character varying", // variable-length character string
  VARCHAR: "varchar", // alias for character varying
  CIDR: "cidr", // IPv4 or IPv6 network address
  CIRCLE: "circle", // circle on a plane
  DATE: "date", // calendar date (year, month, day)
  DOUBLE_PRECISION: "double precision", // float8	double precision floating-point number (8 bytes)
  INET: "inet", // IPv4 or IPv6 host address
  INTEGER: "integer", // signed four-byte integer
  INT: "int", // alias for int
  INT4: "int4", // alias for int
  INTERVAL: "interval", // time span
  JSON: "json", // textual JSON data
  JSONB: "jsonb", // binary JSON data, decomposed
  LINE: "line", // infinite line on a plane
  LSEG: "lseg", // line segment on a plane
  MACADDR: "macaddr", // MAC (Media Access Control) address
  MONEY: "money", // currency amount
  NUMERIC: "numeric", // exact numeric of selectable precision
  PATH: "path", // geometric path on a plane
  PG_LSN: "pg_lsn", // PostgreSQL Log Sequence Number
  POINT: "point", // geometric point on a plane
  POLYGON: "polygon", // closed geometric path on a plane
  REAL: "real", // single precision floating-point number (4 bytes)
  FLOAT4: "float4", // alias for REAL
  SMALLINT: "smallint", // signed two-byte integer
  INT2: "int2", // alias for smallint
  SMALLSERIAL: "smallserial", // autoincrementing two-byte integer
  SERIAL2: "serial2", // alias for smallserial
  SERIAL: "serial", // autoincrementing four-byte integer
  SERIAL4: "serial4", // alias for serial
  TEXT: "text", // variable-length character string
  TIME: "time", // time of day (no time zone)
  TIME_WITHOUT_TIME_ZONE: "without time zone", // alias of time
  TIME_WITH_TIME_ZONE: "time with time zone", // time of day, including time zone
  TIMETZ: "timetz", // alias of time with time zone
  TIMESTAMP: "timestamp", // date and time (no time zone)
  TIMESTAMP_WITHOUT_TIME_ZONE: "timestamp without time zone", // alias of timestamp
  TIMESTAMP_WITH_TIME_ZONE: "timestamp with time zone", // date and time, including time zone
  TIMESTAMPTZ: "timestamptz", // alias of timestamp with time zone
  TSQUERY: "tsquery", // text search query
  TSVECTOR: "tsvector", // text search document
  TXID_SNAPSHOT: "txid_snapshot", // user-level transaction ID snapshot
  UUID: "uuid", // universally unique identifier
  XML: "xml" // XML data
};
