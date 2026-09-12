import type { CatalogRows } from '../types';

/**
 * The name of an introspection query: the key of `CatalogRows` its rows go
 * to.
 */
export type QueryName = keyof CatalogRows;

// The queries must never run code of the database they read. A database can
// define casts (`CREATE CAST (text AS integer) WITH FUNCTION …`), which apply
// whatever the search path, and functions and operators of its own. So every
// query here:
//
// - calls `pg_catalog`'s functions, schema-qualified, and compares with
//   `OPERATOR(pg_catalog.…)`, on operands of the same built-in types;
// - never casts a value to another type, except between built-in types whose
//   cast is built in (`name` to `text`, `regproc` to `oid`, …): `pg_cast`
//   has at most one row per pair of types, so no database can replace those.
//   `int8` values that must come back as text go through `format('%s', …)`,
//   which calls the output function of their type, and typed literals
//   (`'0'::pg_catalog.oid`) call input functions, not casts;
// - reads the columns that only some server versions have through
//   `to_jsonb()` of the whole catalog row, so the same text runs on every
//   version.

const EQ = 'OPERATOR(pg_catalog.=)';
const NE = 'OPERATOR(pg_catalog.<>)';
const GT = 'OPERATOR(pg_catalog.>)';
const GE = 'OPERATOR(pg_catalog.>=)';
const LE = 'OPERATOR(pg_catalog.<=)';
const PLUS = 'OPERATOR(pg_catalog.+)';
const BIT_AND = 'OPERATOR(pg_catalog.&)';
const FIELD = 'OPERATOR(pg_catalog.->>)';

/**
 * The OID 0: no object.
 */
const NO_OID = `'0'::pg_catalog.oid`;

/**
 * The first OID of the objects that are not built in (`FirstNormalObjectId`).
 */
const FIRST_NORMAL_OID = `'16384'::pg_catalog.oid`;

/**
 * The OID of a system catalog, e.g. `pg_class`, to compare with `classid`
 * columns.
 *
 * @param name The name of the catalog.
 * @returns An SQL expression of type `oid`.
 */
function catalog(name: string): string {
  return `'pg_catalog.${name}'::pg_catalog.regclass::pg_catalog.oid`;
}

/**
 * A `"char"[]` literal, e.g. for `relkind` codes.
 *
 * @param codes The codes, e.g. `['r', 'p']`.
 * @returns An SQL expression of type `"char"[]`.
 */
function codes(values: ReadonlyArray<string>): string {
  return `'{${values.join(',')}}'::pg_catalog."char"[]`;
}

/**
 * A condition that holds for the schemas of the user: not `pg_catalog`,
 * `information_schema`, `pg_toast*` or `pg_temp*` (names that start with
 * `pg_` are reserved for the system).
 *
 * @param namespace The alias of a `pg_namespace` row.
 * @returns An SQL condition.
 */
function isUserSchema(namespace: string): string {
  return `${namespace}.nspname ${NE} 'information_schema' AND NOT pg_catalog.starts_with(pg_catalog.text(${namespace}.nspname), 'pg_')`;
}

/**
 * A condition that holds for objects that no extension created and, when
 * `derived` is set, that are not an internal part of another object either
 * (`pg_depend.deptype` `e`, or `e` and `i`).
 *
 * @param catalogName The catalog of the object, e.g. `pg_class`.
 * @param oid An SQL expression for the object's OID.
 * @param derived Whether internal dependencies (`i`) leave the object out
 * too.
 * @returns An SQL condition.
 */
function isOwnObject(
  catalogName: string,
  oid: string,
  derived = false
): string {
  return `NOT EXISTS (SELECT FROM pg_catalog.pg_depend AS member WHERE member.classid ${EQ} ${catalog(catalogName)} AND member.objid ${EQ} ${oid} AND member.deptype ${EQ} ANY (${codes(derived ? ['e', 'i'] : ['e'])}))`;
}

/**
 * The comment on an object, or on a column of a relation.
 *
 * @param catalogName The catalog of the object, e.g. `pg_class`.
 * @param oid An SQL expression for the object's OID.
 * @param subId An SQL expression for the column number, `0` for the object.
 * @returns An SQL expression of type `text`, null without a comment.
 */
function commentOn(catalogName: string, oid: string, subId = '0'): string {
  return `(SELECT com.description FROM pg_catalog.pg_description AS com WHERE com.classoid ${EQ} ${catalog(catalogName)} AND com.objoid ${EQ} ${oid} AND com.objsubid ${EQ} ${subId})`;
}

/**
 * A catalog of objects that have a name and a schema, with the columns that
 * hold them.
 */
interface NamedCatalog {
  readonly table: string;
  readonly name: string;
  readonly namespace: string;
}

const TYPES: NamedCatalog = {
  table: 'pg_type',
  name: 'typname',
  namespace: 'typnamespace',
};

const ROUTINES: NamedCatalog = {
  table: 'pg_proc',
  name: 'proname',
  namespace: 'pronamespace',
};

const OPERATORS: NamedCatalog = {
  table: 'pg_operator',
  name: 'oprname',
  namespace: 'oprnamespace',
};

const COLLATIONS: NamedCatalog = {
  table: 'pg_collation',
  name: 'collname',
  namespace: 'collnamespace',
};

const OPERATOR_CLASSES: NamedCatalog = {
  table: 'pg_opclass',
  name: 'opcname',
  namespace: 'opcnamespace',
};

/**
 * Something about an object that has a name and a schema, from its OID.
 *
 * @param named The catalog of the object.
 * @param oid An SQL expression for the object's OID.
 * @param value What to return, from `q` (the object's row) and `qn` (the row
 * of its schema).
 * @returns An SQL expression, null when there is no such object (OID 0).
 */
function aboutNamed(named: NamedCatalog, oid: string, value: string): string {
  return `(SELECT ${value} FROM pg_catalog.${named.table} AS q JOIN pg_catalog.pg_namespace AS qn ON qn.oid ${EQ} q.${named.namespace} WHERE q.oid ${EQ} ${oid})`;
}

/**
 * The quoted, schema-qualified name of an object as SQL, e.g.
 * `pg_catalog."C"` or `kitchen.pipe_concat`.
 */
function qualifiedSql(named: NamedCatalog, oid: string): string {
  return aboutNamed(
    named,
    oid,
    `pg_catalog.format('%I.%I', qn.nspname, q.${named.name})`
  );
}

/**
 * The schema and stored name of an object, as a JSON object (`NameRow`).
 */
function nameJson(named: NamedCatalog, oid: string): string {
  return aboutNamed(
    named,
    oid,
    `pg_catalog.json_build_object('schema', qn.nspname, 'name', q.${named.name})`
  );
}

/**
 * The name of an object as `pg_get_indexdef()` writes it while the search
 * path is empty: unqualified in `pg_catalog`, qualified elsewhere.
 */
function writtenName(named: NamedCatalog, oid: string): string {
  return aboutNamed(
    named,
    oid,
    `CASE WHEN qn.nspname ${EQ} 'pg_catalog' THEN pg_catalog.quote_ident(pg_catalog.text(q.${named.name})) ELSE pg_catalog.format('%I.%I', qn.nspname, q.${named.name}) END`
  );
}

/**
 * The options of a sequence (`SequenceOptionsRow`): each field with its SQL,
 * given the alias of a `pg_sequence` row. The `int8` values come back as
 * their decimal text.
 */
const SEQUENCE_OPTIONS: ReadonlyArray<
  readonly [field: string, sql: (sequence: string) => string]
> = [
  ['type', (s) => `pg_catalog.format_type(${s}.seqtypid, NULL)`],
  ['start', (s) => `pg_catalog.format('%s', ${s}.seqstart)`],
  ['increment', (s) => `pg_catalog.format('%s', ${s}.seqincrement)`],
  ['minValue', (s) => `pg_catalog.format('%s', ${s}.seqmin)`],
  ['maxValue', (s) => `pg_catalog.format('%s', ${s}.seqmax)`],
  ['cache', (s) => `pg_catalog.format('%s', ${s}.seqcache)`],
  ['cycle', (s) => `${s}.seqcycle`],
];

/**
 * The options of a sequence as select-list items.
 */
function sequenceOptionColumns(sequence: string): string {
  return SEQUENCE_OPTIONS.map(
    ([field, sql]) => `${sql(sequence)} AS "${field}"`
  ).join(',\n  ');
}

/**
 * The options of a sequence as arguments of `json_build_object()`.
 */
function sequenceOptionFields(sequence: string): string {
  return SEQUENCE_OPTIONS.map(
    ([field, sql]) => `'${field}', ${sql(sequence)}`
  ).join(', ');
}

/**
 * The `format_type()` of each type of an `oid[]` or `oidvector`, in order,
 * as `text[]`.
 */
function typeNames(types: string): string {
  return `ARRAY(SELECT pg_catalog.format_type(arg.type, NULL) FROM pg_catalog.unnest(${types}) WITH ORDINALITY AS arg(type, position) ORDER BY arg.position)`;
}

/**
 * The storage parameters of a relation (`reloptions`), then those of its
 * TOAST table prefixed with `toast.`, the way `WITH (…)` takes them and
 * pg_dump writes them; null when there are none.
 *
 * @param relation The alias of a `pg_class` row.
 * @returns An SQL expression of type `text[]`.
 */
function storageParameters(relation: string): string {
  return `(
    SELECT pg_catalog.array_agg(parameter.value ORDER BY parameter.part, parameter.position)
    FROM (
      SELECT 0 AS part, own.value, own.position
      FROM pg_catalog.unnest(${relation}.reloptions) WITH ORDINALITY AS own(value, position)
      UNION ALL
      SELECT 1, pg_catalog.concat('toast.', toast_option.value), toast_option.position
      FROM pg_catalog.pg_class AS toast
      CROSS JOIN LATERAL pg_catalog.unnest(toast.reloptions) WITH ORDINALITY AS toast_option(value, position)
      WHERE toast.oid ${EQ} ${relation}.reltoastrelid
    ) AS parameter
  )`;
}

/**
 * `FROM` the types of the user of one `typtype`, as `t` (`pg_type`) and `n`
 * (`pg_namespace`), without the ones of extensions, and more joins.
 */
function userTypes(typtype: string, joins = ''): string {
  return `FROM pg_catalog.pg_type AS t
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} t.typnamespace${joins}
WHERE t.typtype ${EQ} '${typtype}' AND ${isUserSchema('n')} AND ${isOwnObject('pg_type', 't.oid')}`;
}

/**
 * `FROM` the relations of the user of some `relkind`s, as `c` (`pg_class`)
 * and `n` (`pg_namespace`): not temporary, not created by an extension.
 */
function userRelations(relkinds: ReadonlyArray<string>): string {
  return `FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} c.relnamespace
WHERE c.relkind ${EQ} ANY (${codes(relkinds)}) AND c.relpersistence ${NE} 't'
  AND ${isUserSchema('n')} AND ${isOwnObject('pg_class', 'c.oid')}`;
}

const SCHEMAS = `SELECT n.oid, n.nspname AS name, ${commentOn('pg_namespace', 'n.oid')} AS comment
FROM pg_catalog.pg_namespace AS n
WHERE ${isUserSchema('n')} AND ${isOwnObject('pg_namespace', 'n.oid')}`;

// The extensions created with the database (`plpgsql`) are left out, like
// pg_dump does.
const EXTENSIONS = `SELECT e.oid, n.nspname AS schema, e.extname AS name, e.extversion AS version
FROM pg_catalog.pg_extension AS e
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} e.extnamespace
WHERE e.oid ${GE} ${FIRST_NORMAL_OID}`;

const ENUMS = `SELECT t.oid, n.nspname AS schema, t.typname AS name,
  ARRAY(SELECT pg_catalog.text(l.enumlabel) FROM pg_catalog.pg_enum AS l WHERE l.enumtypid ${EQ} t.oid ORDER BY l.enumsortorder) AS labels,
  ${commentOn('pg_type', 't.oid')} AS comment
${userTypes('e')}`;

const COMPOSITES = `SELECT t.oid, t.typrelid AS relid, n.nspname AS schema, t.typname AS name,
  ${commentOn('pg_type', 't.oid')} AS comment
${userTypes('c', `\nJOIN pg_catalog.pg_class AS c ON c.oid ${EQ} t.typrelid AND c.relkind ${EQ} 'c'`)}`;

// A domain's collation is only there when it differs from the one of its
// base type, like pg_dump does.
const DOMAINS = `SELECT t.oid, n.nspname AS schema, t.typname AS name,
  pg_catalog.format_type(t.typbasetype, t.typtypmod) AS "baseType",
  t.typnotnull AS "notNull",
  pg_catalog.pg_get_expr(t.typdefaultbin, ${NO_OID}) AS "default",
  CASE WHEN t.typcollation ${NE} base.typcollation THEN ${qualifiedSql(COLLATIONS, 't.typcollation')} END AS collation,
  ${commentOn('pg_type', 't.oid')} AS comment
${userTypes('d', `\nJOIN pg_catalog.pg_type AS base ON base.oid ${EQ} t.typbasetype`)}`;

const RANGES = `SELECT t.oid, n.nspname AS schema, t.typname AS name,
  pg_catalog.format_type(r.rngsubtype, NULL) AS subtype,
  CASE WHEN NOT opc.opcdefault THEN ${qualifiedSql(OPERATOR_CLASSES, 'r.rngsubopc')} END AS "subtypeOpclass",
  CASE WHEN r.rngcollation ${NE} ${NO_OID} AND r.rngcollation ${NE} sub.typcollation THEN ${qualifiedSql(COLLATIONS, 'r.rngcollation')} END AS collation,
  ${qualifiedSql(ROUTINES, 'r.rngcanonical::pg_catalog.oid')} AS canonical,
  ${qualifiedSql(ROUTINES, 'r.rngsubdiff::pg_catalog.oid')} AS "subtypeDiff",
  mn.nspname AS "multirangeSchema",
  mt.typname AS "multirangeName",
  ${commentOn('pg_type', 't.oid')} AS comment
${userTypes(
  'r',
  `
JOIN pg_catalog.pg_range AS r ON r.rngtypid ${EQ} t.oid
JOIN pg_catalog.pg_type AS sub ON sub.oid ${EQ} r.rngsubtype
JOIN pg_catalog.pg_opclass AS opc ON opc.oid ${EQ} r.rngsubopc
JOIN pg_catalog.pg_type AS mt ON mt.oid ${EQ} r.rngmultitypid
JOIN pg_catalog.pg_namespace AS mn ON mn.oid ${EQ} mt.typnamespace`
)}`;

// The locale of ICU and builtin collations moved from `collcollate` (14) to
// `colliculocale` (15, 16) and `colllocale` (17+); `collicurules` is 16+.
const COLLATIONS_QUERY = `SELECT co.oid, n.nspname AS schema, co.collname AS name,
  co.collprovider,
  co.collisdeterministic,
  CASE WHEN co.collprovider ${NE} 'c' THEN COALESCE(fields.data ${FIELD} 'colllocale', fields.data ${FIELD} 'colliculocale', fields.data ${FIELD} 'collcollate') END AS locale,
  CASE WHEN co.collprovider ${EQ} 'c' THEN fields.data ${FIELD} 'collcollate' END AS "lcCollate",
  CASE WHEN co.collprovider ${EQ} 'c' THEN fields.data ${FIELD} 'collctype' END AS "lcCtype",
  fields.data ${FIELD} 'collicurules' AS rules,
  ${commentOn('pg_collation', 'co.oid')} AS comment
FROM pg_catalog.pg_collation AS co
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} co.collnamespace
CROSS JOIN LATERAL (SELECT pg_catalog.to_jsonb(co) AS data) AS fields
WHERE ${isUserSchema('n')} AND ${isOwnObject('pg_collation', 'co.oid')}`;

// Identity sequences (an `i` dependency on their column) are left out: they
// belong to their column. An owned sequence has an `a` dependency on the
// column that owns it.
const SEQUENCES = `SELECT c.oid, n.nspname AS schema, c.relname AS name,
  ${sequenceOptionColumns('s')},
  c.relpersistence,
  owned.nspname AS "ownerSchema",
  owned.relname AS "ownerTable",
  owned.attname AS "ownerColumn",
  ${commentOn('pg_class', 'c.oid')} AS comment
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} c.relnamespace
JOIN pg_catalog.pg_sequence AS s ON s.seqrelid ${EQ} c.oid
LEFT JOIN LATERAL (
  SELECT tn.nspname, tc.relname, ta.attname
  FROM pg_catalog.pg_depend AS d
  JOIN pg_catalog.pg_class AS tc ON tc.oid ${EQ} d.refobjid
  JOIN pg_catalog.pg_namespace AS tn ON tn.oid ${EQ} tc.relnamespace
  JOIN pg_catalog.pg_attribute AS ta ON ta.attrelid ${EQ} d.refobjid AND ta.attnum ${EQ} d.refobjsubid
  WHERE d.classid ${EQ} ${catalog('pg_class')} AND d.objid ${EQ} c.oid
    AND d.refclassid ${EQ} ${catalog('pg_class')} AND d.deptype ${EQ} 'a'
) AS owned ON true
WHERE c.relkind ${EQ} 'S' AND ${isUserSchema('n')} AND ${isOwnObject('pg_class', 'c.oid')}
  AND NOT EXISTS (
    SELECT FROM pg_catalog.pg_depend AS d
    WHERE d.classid ${EQ} ${catalog('pg_class')} AND d.objid ${EQ} c.oid
      AND d.refclassid ${EQ} ${catalog('pg_class')} AND d.deptype ${EQ} 'i'
  )`;

// The arguments are the types of `proallargtypes` when it is set (it has
// the OUT and TABLE ones too), else of `proargtypes`. The functions that
// `CREATE TYPE … AS RANGE` makes depend on their type internally (`i`).
const FUNCTIONS = `SELECT p.oid, n.nspname AS schema, p.proname AS name,
  p.prokind,
  args.types AS "argTypes",
  p.proargnames AS "argNames",
  CASE WHEN p.proargmodes IS NOT NULL THEN ARRAY(SELECT pg_catalog.text(m.mode) FROM pg_catalog.unnest(p.proargmodes) WITH ORDINALITY AS m(mode, position) ORDER BY m.position) END AS "argModes",
  args.defaults AS "argDefaults",
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS "identityArguments",
  pg_catalog.pg_get_function_result(p.oid) AS result,
  l.lanname AS language,
  p.prosrc AS body,
  p.prosqlbody IS NOT NULL AS "hasSqlBody",
  p.provolatile,
  p.proisstrict,
  p.prosecdef,
  p.proleakproof,
  p.proparallel,
  p.procost,
  p.prorows,
  p.proretset,
  p.proconfig,
  pg_catalog.pg_get_functiondef(p.oid) AS definition,
  ${commentOn('pg_proc', 'p.oid')} AS comment
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} p.pronamespace
JOIN pg_catalog.pg_language AS l ON l.oid ${EQ} p.prolang
CROSS JOIN LATERAL (
  SELECT
    COALESCE(pg_catalog.array_agg(pg_catalog.format_type(arg.type, NULL) ORDER BY arg.position), '{}'::pg_catalog.text[]) AS types,
    COALESCE(pg_catalog.array_agg(pg_catalog.pg_get_function_arg_default(p.oid, pg_catalog.int4(arg.position)) ORDER BY arg.position), '{}'::pg_catalog.text[]) AS defaults
  FROM (
    SELECT a.type, a.position FROM pg_catalog.unnest(p.proallargtypes) WITH ORDINALITY AS a(type, position)
    UNION ALL
    SELECT a.type, a.position FROM pg_catalog.unnest(p.proargtypes) WITH ORDINALITY AS a(type, position)
    WHERE p.proallargtypes IS NULL
  ) AS arg
) AS args
WHERE p.prokind ${EQ} ANY (${codes(['f', 'w', 'p'])}) AND ${isUserSchema('n')} AND ${isOwnObject('pg_proc', 'p.oid', true)}`;

// The operand types of an operator's identity are what `COMMENT ON OPERATOR`
// takes: `NONE` for the missing left operand of a prefix operator. Shell
// operators (no function), which `COMMUTATOR` and `NEGATOR` create for
// operators that don't exist yet, are left out like pg_dump does: creating
// the operator that names them creates them again.
const OPERATORS_QUERY = `SELECT o.oid, n.nspname AS schema, o.oprname AS name,
  ${nameJson(TYPES, 'o.oprleft')} AS "left",
  ${nameJson(TYPES, 'o.oprright')} AS "right",
  ${nameJson(ROUTINES, 'o.oprcode::pg_catalog.oid')} AS "function",
  ${nameJson(OPERATORS, 'o.oprcom')} AS commutator,
  ${nameJson(OPERATORS, 'o.oprnegate')} AS negator,
  ${nameJson(ROUTINES, 'o.oprrest::pg_catalog.oid')} AS "restrict",
  ${nameJson(ROUTINES, 'o.oprjoin::pg_catalog.oid')} AS "join",
  o.oprcanhash,
  o.oprcanmerge,
  pg_catalog.format('%s, %s', CASE WHEN o.oprleft ${EQ} ${NO_OID} THEN 'NONE' ELSE pg_catalog.format_type(o.oprleft, NULL) END, pg_catalog.format_type(o.oprright, NULL)) AS "identityArguments",
  ${commentOn('pg_operator', 'o.oid')} AS comment
FROM pg_catalog.pg_operator AS o
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} o.oprnamespace
WHERE o.oprcode::pg_catalog.oid ${NE} ${NO_OID} AND ${isUserSchema('n')} AND ${isOwnObject('pg_operator', 'o.oid')}`;

// The cast from a range type to its multirange type depends on the range
// type internally (`i`).
const CASTS = `SELECT ca.oid,
  pg_catalog.format_type(ca.castsource, NULL) AS source,
  pg_catalog.format_type(ca.casttarget, NULL) AS target,
  ca.castmethod,
  ca.castcontext,
  ${nameJson(ROUTINES, 'ca.castfunc')} AS "function",
  COALESCE((SELECT ${typeNames('p.proargtypes')} FROM pg_catalog.pg_proc AS p WHERE p.oid ${EQ} ca.castfunc), '{}'::pg_catalog.text[]) AS "functionArguments",
  ${commentOn('pg_cast', 'ca.oid')} AS comment
FROM pg_catalog.pg_cast AS ca
WHERE ca.oid ${GE} ${FIRST_NORMAL_OID} AND ${isOwnObject('pg_cast', 'ca.oid', true)}`;

/**
 * The function of a `regproc` column of `pg_aggregate`, as SQL.
 */
function aggregateFunction(column: string): string {
  return qualifiedSql(ROUTINES, `a.${column}::pg_catalog.oid`);
}

const AGGREGATES = `SELECT p.oid, n.nspname AS schema, p.proname AS name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS "identityArguments",
  ${typeNames('p.proargtypes')} AS "argTypes",
  ${aggregateFunction('aggtransfn')} AS "stateFunction",
  pg_catalog.format_type(a.aggtranstype, NULL) AS "stateType",
  a.aggtransspace AS "stateSpace",
  ${aggregateFunction('aggfinalfn')} AS "finalFunction",
  a.aggfinalextra,
  a.aggfinalmodify,
  ${aggregateFunction('aggcombinefn')} AS "combineFunction",
  ${aggregateFunction('aggserialfn')} AS "serialFunction",
  ${aggregateFunction('aggdeserialfn')} AS "deserialFunction",
  a.agginitval AS "initialCondition",
  ${aggregateFunction('aggmtransfn')} AS "movingStateFunction",
  ${aggregateFunction('aggminvtransfn')} AS "movingInverseFunction",
  CASE WHEN a.aggmtranstype ${NE} ${NO_OID} THEN pg_catalog.format_type(a.aggmtranstype, NULL) END AS "movingStateType",
  a.aggmtransspace AS "movingStateSpace",
  ${aggregateFunction('aggmfinalfn')} AS "movingFinalFunction",
  a.aggmfinalextra,
  a.aggmfinalmodify,
  a.aggminitval AS "movingInitialCondition",
  ${aboutNamed(OPERATORS, 'a.aggsortop', `pg_catalog.format('OPERATOR(%I.%s)', qn.nspname, q.oprname)`)} AS "sortOperator",
  p.proparallel,
  ${commentOn('pg_proc', 'p.oid')} AS comment
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_aggregate AS a ON a.aggfnoid::pg_catalog.oid ${EQ} p.oid
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} p.pronamespace
WHERE p.prokind ${EQ} 'a' AND a.aggkind ${EQ} 'n' AND ${isUserSchema('n')} AND ${isOwnObject('pg_proc', 'p.oid', true)}`;

const TABLES = `SELECT c.oid, n.nspname AS schema, c.relname AS name,
  c.relkind,
  c.relpersistence,
  c.relispartition,
  CASE WHEN c.relkind ${EQ} 'p' THEN pg_catalog.pg_get_partkeydef(c.oid) END AS "partitionKey",
  CASE WHEN c.relispartition THEN pg_catalog.pg_get_expr(c.relpartbound, c.oid) END AS "partitionBound",
  COALESCE((
    SELECT pg_catalog.json_agg(pg_catalog.json_build_object('schema', pn.nspname, 'name', pc.relname) ORDER BY i.inhseqno)
    FROM pg_catalog.pg_inherits AS i
    JOIN pg_catalog.pg_class AS pc ON pc.oid ${EQ} i.inhparent
    JOIN pg_catalog.pg_namespace AS pn ON pn.oid ${EQ} pc.relnamespace
    WHERE i.inhrelid ${EQ} c.oid
  ), '[]'::pg_catalog.json) AS inherits,
  c.relrowsecurity,
  c.relforcerowsecurity,
  ${storageParameters('c')} AS reloptions,
  (SELECT am.amname FROM pg_catalog.pg_am AS am WHERE am.oid ${EQ} c.relam) AS "accessMethod",
  c.relreplident,
  ${commentOn('pg_class', 'c.oid')} AS comment
${userRelations(['r', 'p'])}`;

// A column's collation is only there when it differs from the one of its
// type, like pg_dump does. `attstattarget` is -1 (up to 16) or null (17+)
// when it is not set.
const COLUMNS = `SELECT a.attrelid AS relid, a.attnum, a.attname AS name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
  a.attnotnull,
  (SELECT pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) FROM pg_catalog.pg_attrdef AS ad WHERE ad.adrelid ${EQ} a.attrelid AND ad.adnum ${EQ} a.attnum) AS "default",
  a.attidentity,
  a.attgenerated,
  CASE WHEN a.attidentity ${NE} '' THEN (
    SELECT pg_catalog.json_build_object('schema', sn.nspname, 'name', sc.relname, ${sequenceOptionFields('s')}, 'comment', ${commentOn('pg_class', 'sc.oid')})
    FROM pg_catalog.pg_depend AS d
    JOIN pg_catalog.pg_class AS sc ON sc.oid ${EQ} d.objid
    JOIN pg_catalog.pg_namespace AS sn ON sn.oid ${EQ} sc.relnamespace
    JOIN pg_catalog.pg_sequence AS s ON s.seqrelid ${EQ} sc.oid
    WHERE d.classid ${EQ} ${catalog('pg_class')} AND d.refclassid ${EQ} ${catalog('pg_class')}
      AND d.refobjid ${EQ} a.attrelid AND d.refobjsubid ${EQ} a.attnum AND d.deptype ${EQ} 'i'
  ) END AS "identitySequence",
  CASE WHEN a.attcollation ${NE} ty.typcollation THEN ${qualifiedSql(COLLATIONS, 'a.attcollation')} END AS collation,
  a.attislocal,
  a.attinhcount,
  CASE WHEN a.attstattarget ${GE} 0 THEN a.attstattarget END AS "statisticsTarget",
  a.attstorage,
  ty.typstorage,
  a.attcompression,
  a.attoptions,
  ${commentOn('pg_class', 'a.attrelid', 'a.attnum')} AS comment
FROM pg_catalog.pg_attribute AS a
JOIN pg_catalog.pg_type AS ty ON ty.oid ${EQ} a.atttypid
JOIN pg_catalog.pg_class AS c ON c.oid ${EQ} a.attrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} c.relnamespace
WHERE a.attnum ${GT} 0 AND NOT a.attisdropped
  AND c.relkind ${EQ} ANY (${codes(['r', 'p', 'v', 'm', 'c'])}) AND c.relpersistence ${NE} 't'
  AND ${isUserSchema('n')}`;

// Partition clones (`conparentid <> 0`) and constraint triggers (`t`) are
// left out. Only primary keys, unique and exclusion constraints own their
// index (`conindid`); a foreign key's is the one it references.
const CONSTRAINTS = `SELECT co.oid, n.nspname AS schema, co.conname AS name,
  co.conrelid AS relid,
  co.contypid AS typid,
  co.contype,
  pg_catalog.pg_get_constraintdef(co.oid) AS definition,
  CASE WHEN co.contype ${EQ} 'c' THEN pg_catalog.pg_get_expr(co.conbin, co.conrelid) END AS "checkExpression",
  co.condeferrable,
  co.condeferred,
  co.convalidated,
  co.conislocal,
  co.connoinherit,
  co.conkey,
  co.conindid,
  co.confrelid,
  CASE WHEN co.contype ${EQ} 'f' THEN (SELECT rn.nspname FROM pg_catalog.pg_class AS rc JOIN pg_catalog.pg_namespace AS rn ON rn.oid ${EQ} rc.relnamespace WHERE rc.oid ${EQ} co.confrelid) END AS "referencedSchema",
  CASE WHEN co.contype ${EQ} 'f' THEN (SELECT rc.relname FROM pg_catalog.pg_class AS rc WHERE rc.oid ${EQ} co.confrelid) END AS "referencedTable",
  own.indisclustered IS TRUE AS "indexClustered",
  own.indisreplident IS TRUE AS "indexReplicaIdentity",
  ${commentOn('pg_constraint', 'co.oid')} AS comment,
  CASE WHEN own.indexrelid IS NOT NULL THEN ${commentOn('pg_class', 'own.indexrelid')} END AS "indexComment"
FROM pg_catalog.pg_constraint AS co
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} co.connamespace
LEFT JOIN pg_catalog.pg_index AS own ON own.indexrelid ${EQ} co.conindid AND co.contype ${EQ} ANY (${codes(['p', 'u', 'x'])})
WHERE co.contype ${NE} 't' AND co.conparentid ${EQ} ${NO_OID}
  AND ${isUserSchema('n')} AND ${isOwnObject('pg_constraint', 'co.oid')}`;

/**
 * Whether `pg_get_indexdef()` writes `text` right after a key: the key is
 * `written.key`, in parentheses unless it is a function call, in the keys
 * part of the definition (`def.keys`).
 */
function followsKey(text: string): string {
  return `(pg_catalog.strpos(def.keys, pg_catalog.concat(written.key, ${text})) ${GT} 0 OR pg_catalog.strpos(def.keys, pg_catalog.concat('(', written.key, ')', ${text})) ${GT} 0)`;
}

// A key's collation and operator class are there exactly when
// pg_get_indexdef() writes them, so they are looked for in its definition,
// after `CREATE … USING <method> (`: it leaves out the collation of an
// expression key when it is the expression's own, which the catalogs don't
// store (a column key's is the column's). pg_get_indexdef() writes a key
// like pg_get_indexdef(oid, <key number>, false) does (for a column, its
// quoted name), but an expression in parentheses unless it is a function
// call, and a collation or an operator class unqualified in pg_catalog (the
// search path is empty).
const INDEXES = `SELECT ic.oid, n.nspname AS schema, ic.relname AS name,
  i.indrelid AS relid,
  def.definition,
  i.indisunique,
  am.amname,
  COALESCE((
    SELECT pg_catalog.json_agg(pg_catalog.json_build_object(
      'column', key_column.name,
      'expression', CASE WHEN k.attnum ${EQ} 0 THEN written.key END,
      'opclass', CASE WHEN written.opclass IS NOT NULL AND ${followsKey(`coll.clause, ' ', written.opclass`)} THEN ${qualifiedSql(OPERATOR_CLASSES, 'k.opclass')} END,
      'collation', CASE WHEN coll.clause ${NE} '' THEN ${qualifiedSql(COLLATIONS, 'k.coll_oid')} END,
      'descending', (k.option ${BIT_AND} 1) ${NE} 0,
      'nullsFirst', (k.option ${BIT_AND} 2) ${NE} 0
    ) ORDER BY k.position)
    FROM ROWS FROM (
      pg_catalog.unnest(i.indkey),
      pg_catalog.unnest(i.indclass),
      pg_catalog.unnest(i.indcollation),
      pg_catalog.unnest(i.indoption)
    ) WITH ORDINALITY AS k(attnum, opclass, coll_oid, option, position)
    LEFT JOIN LATERAL (
      SELECT pg_catalog.text(ta.attname) AS name, ta.attcollation AS collation
      FROM pg_catalog.pg_attribute AS ta
      WHERE ta.attrelid ${EQ} i.indrelid AND ta.attnum ${EQ} k.attnum AND k.attnum ${NE} 0
    ) AS key_column ON true
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN k.attnum ${EQ} 0
          THEN pg_catalog.pg_get_indexdef(i.indexrelid, pg_catalog.int4(k.position), false)
          ELSE pg_catalog.quote_ident(key_column.name)
        END AS key,
        ${writtenName(COLLATIONS, 'k.coll_oid')} AS collation,
        ${writtenName(OPERATOR_CLASSES, 'k.opclass')} AS opclass
    ) AS written
    CROSS JOIN LATERAL (
      SELECT CASE WHEN written.collation IS NOT NULL AND CASE
          WHEN k.attnum ${NE} 0 THEN k.coll_oid ${NE} key_column.collation
          ELSE ${followsKey(`' COLLATE ', written.collation`)}
        END THEN pg_catalog.concat(' COLLATE ', written.collation) ELSE '' END AS clause
    ) AS coll
    WHERE k.position ${LE} i.indnkeyatts
  ), '[]'::pg_catalog.json) AS keys,
  ARRAY(
    SELECT pg_catalog.text(ta.attname)
    FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY AS k(attnum, position)
    JOIN pg_catalog.pg_attribute AS ta ON ta.attrelid ${EQ} i.indrelid AND ta.attnum ${EQ} k.attnum
    WHERE k.position ${GT} i.indnkeyatts
    ORDER BY k.position
  ) AS include,
  pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS predicate,
  COALESCE(pg_catalog.to_jsonb(i) ${FIELD} 'indnullsnotdistinct', 'false') ${EQ} 'true' AS "nullsNotDistinct",
  ic.reloptions,
  i.indisclustered,
  i.indisreplident,
  ${commentOn('pg_class', 'ic.oid')} AS comment
FROM pg_catalog.pg_index AS i
JOIN pg_catalog.pg_class AS ic ON ic.oid ${EQ} i.indexrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} ic.relnamespace
JOIN pg_catalog.pg_am AS am ON am.oid ${EQ} ic.relam
JOIN pg_catalog.pg_class AS tc ON tc.oid ${EQ} i.indrelid
JOIN pg_catalog.pg_namespace AS tn ON tn.oid ${EQ} tc.relnamespace
CROSS JOIN LATERAL (
  SELECT pg_catalog.pg_get_indexdef(i.indexrelid) AS definition,
    pg_catalog.format('CREATE %sINDEX %I ON %s%I.%I USING %I (',
      CASE WHEN i.indisunique THEN 'UNIQUE ' ELSE '' END, ic.relname,
      CASE WHEN ic.relkind ${EQ} 'I' THEN 'ONLY ' ELSE '' END, tn.nspname, tc.relname, am.amname) AS prefix
) AS start
CROSS JOIN LATERAL (
  SELECT start.definition,
    CASE WHEN pg_catalog.starts_with(start.definition, start.prefix)
      THEN pg_catalog.substr(start.definition, pg_catalog.char_length(start.prefix) ${PLUS} 1)
      ELSE start.definition
    END AS keys
) AS def
WHERE NOT ic.relispartition AND ${isUserSchema('n')} AND ${isOwnObject('pg_class', 'ic.oid')}
  AND NOT EXISTS (
    SELECT FROM pg_catalog.pg_constraint AS co
    WHERE co.conindid ${EQ} i.indexrelid AND co.conrelid ${EQ} i.indrelid AND co.contype ${EQ} ANY (${codes(['p', 'u', 'x'])})
  )`;

const VIEWS = `SELECT c.oid, n.nspname AS schema, c.relname AS name,
  c.relkind,
  pg_catalog.pg_get_viewdef(c.oid) AS definition,
  ${storageParameters('c')} AS reloptions,
  (SELECT am.amname FROM pg_catalog.pg_am AS am WHERE am.oid ${EQ} c.relam) AS "accessMethod",
  ${commentOn('pg_class', 'c.oid')} AS comment
${userRelations(['v', 'm'])}`;

// Internal triggers (those of foreign keys) and partition clones
// (`tgparentid <> 0`) are left out.
const TRIGGERS = `SELECT t.oid, n.nspname AS schema, t.tgname AS name,
  t.tgrelid AS relid,
  t.tgtype,
  t.tgenabled,
  fn.nspname AS "functionSchema",
  f.proname AS "functionName",
  t.tgargs,
  ARRAY(
    SELECT pg_catalog.text(ta.attname)
    FROM pg_catalog.unnest(t.tgattr) WITH ORDINALITY AS k(attnum, position)
    JOIN pg_catalog.pg_attribute AS ta ON ta.attrelid ${EQ} t.tgrelid AND ta.attnum ${EQ} k.attnum
    ORDER BY k.position
  ) AS "updateOf",
  t.tgqual IS NOT NULL AS "hasCondition",
  t.tgconstraint ${NE} ${NO_OID} AS "isConstraint",
  t.tgdeferrable,
  t.tginitdeferred,
  t.tgoldtable,
  t.tgnewtable,
  pg_catalog.pg_get_triggerdef(t.oid) AS definition,
  ${commentOn('pg_trigger', 't.oid')} AS comment
FROM pg_catalog.pg_trigger AS t
JOIN pg_catalog.pg_class AS c ON c.oid ${EQ} t.tgrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} c.relnamespace
JOIN pg_catalog.pg_proc AS f ON f.oid ${EQ} t.tgfoid
JOIN pg_catalog.pg_namespace AS fn ON fn.oid ${EQ} f.pronamespace
WHERE NOT t.tgisinternal AND t.tgparentid ${EQ} ${NO_OID}
  AND ${isUserSchema('n')} AND ${isOwnObject('pg_trigger', 't.oid')}`;

const POLICIES = `SELECT p.oid, n.nspname AS schema, p.polname AS name,
  p.polrelid AS relid,
  p.polcmd,
  p.polpermissive,
  ARRAY(
    SELECT CASE WHEN r.role ${EQ} ${NO_OID} THEN 'PUBLIC' ELSE (SELECT pg_catalog.text(ro.rolname) FROM pg_catalog.pg_roles AS ro WHERE ro.oid ${EQ} r.role) END
    FROM pg_catalog.unnest(p.polroles) AS r(role)
  ) AS roles,
  pg_catalog.pg_get_expr(p.polqual, p.polrelid) AS "using",
  pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS "check",
  ${commentOn('pg_policy', 'p.oid')} AS comment
FROM pg_catalog.pg_policy AS p
JOIN pg_catalog.pg_class AS c ON c.oid ${EQ} p.polrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} c.relnamespace
WHERE ${isUserSchema('n')} AND ${isOwnObject('pg_policy', 'p.oid')}`;

// The `_RETURN` rule of a view is its query, not a rule of the model.
const RULES = `SELECT r.oid, n.nspname AS schema, r.rulename AS name,
  r.ev_class AS relid,
  r.ev_enabled AS enabled,
  pg_catalog.pg_get_ruledef(r.oid) AS definition,
  ${commentOn('pg_rewrite', 'r.oid')} AS comment
FROM pg_catalog.pg_rewrite AS r
JOIN pg_catalog.pg_class AS c ON c.oid ${EQ} r.ev_class
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} c.relnamespace
WHERE r.rulename ${NE} '_RETURN' AND ${isUserSchema('n')} AND ${isOwnObject('pg_rewrite', 'r.oid')}`;

// `stxstattarget` is -1 (up to 16) or null (17+) when it is not set.
const STATISTICS = `SELECT s.oid, n.nspname AS schema, s.stxname AS name,
  s.stxrelid AS relid,
  pg_catalog.pg_get_statisticsobjdef(s.oid) AS definition,
  CASE WHEN s.stxstattarget ${GE} 0 THEN s.stxstattarget END AS "statisticsTarget",
  ${commentOn('pg_statistic_ext', 's.oid')} AS comment
FROM pg_catalog.pg_statistic_ext AS s
JOIN pg_catalog.pg_namespace AS n ON n.oid ${EQ} s.stxnamespace
WHERE ${isUserSchema('n')} AND ${isOwnObject('pg_statistic_ext', 's.oid')}`;

/**
 * Maps one side of the `pg_depend` rows `e` to the objects the model has:
 * a sub-object to the object it belongs to (twice, for an array of a row
 * type), then a member of an extension to the extension.
 *
 * @param side The alias of the result, with the columns `classid` and
 * `objid`.
 * @param classid The column of `e` with the catalog.
 * @param objid The column of `e` with the OID.
 * @returns The joins.
 */
function mappedObject(side: string, classid: string, objid: string): string {
  const first = `${side}_first`;
  const second = `${side}_second`;

  return `LEFT JOIN parents AS ${first}_parent ON ${first}_parent.classid ${EQ} e.${classid} AND ${first}_parent.objid ${EQ} e.${objid}
CROSS JOIN LATERAL (SELECT COALESCE(${first}_parent.parent_classid, e.${classid}) AS classid, COALESCE(${first}_parent.parent_objid, e.${objid}) AS objid) AS ${first}
LEFT JOIN parents AS ${second}_parent ON ${second}_parent.classid ${EQ} ${first}.classid AND ${second}_parent.objid ${EQ} ${first}.objid
CROSS JOIN LATERAL (SELECT COALESCE(${second}_parent.parent_classid, ${first}.classid) AS classid, COALESCE(${second}_parent.parent_objid, ${first}.objid) AS objid) AS ${second}
LEFT JOIN members AS ${side}_member ON ${side}_member.classid ${EQ} ${second}.classid AND ${side}_member.objid ${EQ} ${second}.objid
CROSS JOIN LATERAL (SELECT CASE WHEN ${side}_member.extension IS NULL THEN ${second}.classid ELSE ${catalog('pg_extension')} END AS classid, COALESCE(${side}_member.extension, ${second}.objid) AS objid) AS ${side}`;
}

/**
 * The catalogs of the objects of the model, as an `oid[]`.
 */
const MODEL_CATALOGS = `ARRAY[${[
  'pg_namespace',
  'pg_extension',
  'pg_type',
  'pg_collation',
  'pg_class',
  'pg_proc',
  'pg_operator',
  'pg_cast',
  'pg_constraint',
  'pg_trigger',
  'pg_policy',
  'pg_rewrite',
  'pg_statistic_ext',
]
  .map(catalog)
  .join(', ')}]`;

// The objects created with the database have OIDs below FirstNormalObjectId:
// what depends on them can always be created, so those rows are left out
// early.
const DEPENDENCIES = `WITH
parents (classid, objid, parent_classid, parent_objid) AS (
  SELECT ${catalog('pg_attrdef')}, ad.oid, ${catalog('pg_class')}, ad.adrelid
  FROM pg_catalog.pg_attrdef AS ad WHERE ad.oid ${GE} ${FIRST_NORMAL_OID}
  UNION ALL
  SELECT ${catalog('pg_rewrite')}, rw.oid, ${catalog('pg_class')}, rw.ev_class
  FROM pg_catalog.pg_rewrite AS rw WHERE rw.rulename ${EQ} '_RETURN' AND rw.oid ${GE} ${FIRST_NORMAL_OID}
  UNION ALL
  SELECT ${catalog('pg_constraint')}, co.oid, ${catalog('pg_type')}, co.contypid
  FROM pg_catalog.pg_constraint AS co WHERE co.contypid ${NE} ${NO_OID}
  UNION ALL
  SELECT ${catalog('pg_class')}, co.conindid, ${catalog('pg_constraint')}, co.oid
  FROM pg_catalog.pg_constraint AS co WHERE co.contype ${EQ} ANY (${codes(['p', 'u', 'x'])}) AND co.conindid ${NE} ${NO_OID}
  UNION ALL
  SELECT ${catalog('pg_class')}, c.oid, ${catalog('pg_type')}, c.reltype
  FROM pg_catalog.pg_class AS c WHERE c.relkind ${EQ} 'c' AND c.oid ${GE} ${FIRST_NORMAL_OID}
  UNION ALL
  SELECT ${catalog('pg_type')}, el.typarray, ${catalog('pg_type')}, el.oid
  FROM pg_catalog.pg_type AS el WHERE el.typarray ${GE} ${FIRST_NORMAL_OID}
  UNION ALL
  SELECT ${catalog('pg_type')}, t.oid, ${catalog('pg_class')}, t.typrelid
  FROM pg_catalog.pg_type AS t JOIN pg_catalog.pg_class AS c ON c.oid ${EQ} t.typrelid
  WHERE c.relkind ${NE} 'c' AND t.oid ${GE} ${FIRST_NORMAL_OID}
  UNION ALL
  SELECT ${catalog('pg_type')}, r.rngmultitypid, ${catalog('pg_type')}, r.rngtypid
  FROM pg_catalog.pg_range AS r WHERE r.rngtypid ${GE} ${FIRST_NORMAL_OID}
),
members (classid, objid, extension) AS (
  SELECT d.classid, d.objid, d.refobjid FROM pg_catalog.pg_depend AS d WHERE d.deptype ${EQ} 'e'
),
edges AS (
  SELECT d.classid, d.objid, d.refclassid, d.refobjid, d.deptype
  FROM pg_catalog.pg_depend AS d
  WHERE d.deptype ${EQ} ANY (${codes(['n', 'a', 'i'])})
    AND d.objid ${GE} ${FIRST_NORMAL_OID} AND d.refobjid ${GE} ${FIRST_NORMAL_OID}
)
SELECT DISTINCT
  (SELECT pg_catalog.text(cat.relname) FROM pg_catalog.pg_class AS cat WHERE cat.oid ${EQ} f.classid) AS classid,
  f.objid,
  (SELECT pg_catalog.text(cat.relname) FROM pg_catalog.pg_class AS cat WHERE cat.oid ${EQ} t.classid) AS refclassid,
  t.objid AS refobjid,
  e.deptype
FROM edges AS e
${mappedObject('f', 'classid', 'objid')}
${mappedObject('t', 'refclassid', 'refobjid')}
WHERE (f.classid ${NE} t.classid OR f.objid ${NE} t.objid)
  AND f.classid ${EQ} ANY (${MODEL_CATALOGS}) AND t.classid ${EQ} ANY (${MODEL_CATALOGS})`;

/**
 * One kind of object that `--format ts|js` can't represent, as a part of the
 * `unsupported` query.
 *
 * @param kind The `UnsupportedKind`.
 * @param catalogName The catalog of the objects.
 * @param from The rest of the query: a `FROM` with the alias `x` for the
 * catalog row, and `xn` for the `pg_namespace` row of objects that have a
 * schema, and a `WHERE`.
 * @param hasSchema Whether the objects have a schema.
 */
function unsupported(
  kind: string,
  catalogName: string,
  from: string,
  hasSchema: boolean
): string {
  const schema = hasSchema ? 'xn.nspname' : 'NULL::pg_catalog.name';

  return `SELECT '${kind}' AS kind, ${schema} AS schema,
  (pg_catalog.pg_identify_object(${catalog(catalogName)}, x.oid, 0)).identity AS identity
${from} AND ${isOwnObject(catalogName, 'x.oid')}`;
}

/**
 * `FROM` a catalog of objects that have a schema, in the user's schemas.
 */
function inUserSchemas(table: string, namespaceColumn: string): string {
  return `FROM pg_catalog.${table} AS x
JOIN pg_catalog.pg_namespace AS xn ON xn.oid ${EQ} x.${namespaceColumn}
WHERE ${isUserSchema('xn')}`;
}

/**
 * `FROM` a catalog of objects without a schema, keeping the ones that are
 * not built in.
 */
function notBuiltIn(table: string): string {
  return `FROM pg_catalog.${table} AS x WHERE x.oid ${GE} ${FIRST_NORMAL_OID}`;
}

// A base type of the user is one that is not the array type of another
// type (`CREATE TYPE` makes one for every type).
const UNSUPPORTED = [
  unsupported('access method', 'pg_am', notBuiltIn('pg_am'), false),
  unsupported(
    'base type',
    'pg_type',
    `${inUserSchemas('pg_type', 'typnamespace')} AND x.typtype ${EQ} 'b'
  AND NOT EXISTS (SELECT FROM pg_catalog.pg_type AS el WHERE el.typarray ${EQ} x.oid)`,
    true
  ),
  unsupported(
    'conversion',
    'pg_conversion',
    inUserSchemas('pg_conversion', 'connamespace'),
    true
  ),
  unsupported(
    'event trigger',
    'pg_event_trigger',
    notBuiltIn('pg_event_trigger'),
    false
  ),
  unsupported(
    'foreign data wrapper',
    'pg_foreign_data_wrapper',
    notBuiltIn('pg_foreign_data_wrapper'),
    false
  ),
  unsupported(
    'foreign server',
    'pg_foreign_server',
    notBuiltIn('pg_foreign_server'),
    false
  ),
  unsupported(
    'foreign table',
    'pg_class',
    `${inUserSchemas('pg_class', 'relnamespace')} AND x.relkind ${EQ} 'f'`,
    true
  ),
  unsupported('language', 'pg_language', notBuiltIn('pg_language'), false),
  unsupported(
    'operator class',
    'pg_opclass',
    inUserSchemas('pg_opclass', 'opcnamespace'),
    true
  ),
  unsupported(
    'operator family',
    'pg_opfamily',
    inUserSchemas('pg_opfamily', 'opfnamespace'),
    true
  ),
  unsupported(
    'ordered-set aggregate',
    'pg_proc',
    `${inUserSchemas('pg_proc', 'pronamespace')}
  AND EXISTS (SELECT FROM pg_catalog.pg_aggregate AS a WHERE a.aggfnoid::pg_catalog.oid ${EQ} x.oid AND a.aggkind ${NE} 'n')`,
    true
  ),
  unsupported(
    'text search configuration',
    'pg_ts_config',
    inUserSchemas('pg_ts_config', 'cfgnamespace'),
    true
  ),
  unsupported(
    'text search dictionary',
    'pg_ts_dict',
    inUserSchemas('pg_ts_dict', 'dictnamespace'),
    true
  ),
  unsupported(
    'text search parser',
    'pg_ts_parser',
    inUserSchemas('pg_ts_parser', 'prsnamespace'),
    true
  ),
  unsupported(
    'text search template',
    'pg_ts_template',
    inUserSchemas('pg_ts_template', 'tmplnamespace'),
    true
  ),
  unsupported('transform', 'pg_transform', notBuiltIn('pg_transform'), false),
].join('\nUNION ALL\n');

/**
 * The SQL of the introspection queries, by name, in the order `introspect()`
 * runs them.
 *
 * Each query is ONE set-based query for a whole family of objects (never one
 * query per object) and takes no parameters, so `introspect()` runs the same
 * number of queries whatever the size of the schema. The queries run while
 * `search_path` is empty, so the catalog functions they call
 * (`format_type()`, `pg_get_expr()`, `pg_get_*def()`) schema-qualify every
 * name. Each returns the columns of its row type in `CatalogRows`, and works
 * on every supported PostgreSQL version.
 *
 * They never run code of the database they read: every function and
 * operator they use is `pg_catalog`'s, and they cast no value to a type that
 * a cast of the database could produce (see the comment at the top of this
 * file).
 */
export const QUERIES: Readonly<Record<QueryName, string>> = {
  schemas: SCHEMAS,
  extensions: EXTENSIONS,
  enums: ENUMS,
  composites: COMPOSITES,
  domains: DOMAINS,
  ranges: RANGES,
  collations: COLLATIONS_QUERY,
  sequences: SEQUENCES,
  functions: FUNCTIONS,
  operators: OPERATORS_QUERY,
  casts: CASTS,
  aggregates: AGGREGATES,
  tables: TABLES,
  columns: COLUMNS,
  constraints: CONSTRAINTS,
  indexes: INDEXES,
  views: VIEWS,
  triggers: TRIGGERS,
  policies: POLICIES,
  rules: RULES,
  statistics: STATISTICS,
  dependencies: DEPENDENCIES,
  unsupported: UNSUPPORTED,
};
