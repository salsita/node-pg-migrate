import type { QualifiedName } from '../baseline/types';

// Conventions of the model (see `rowsToModel()`):
//
// - Names are the ones PostgreSQL stores: no quotes, no doubled quotes.
// - SQL fragments (types, expressions, definitions) are the text of the
//   catalog functions named in their JSDoc, called while `search_path` is
//   empty, so every name in them is schema-qualified and quoted as needed.
// - An optional field is left out (never set to `undefined`) when the catalog
//   has nothing for it; arrays are always present, empty when there is
//   nothing.
// - Every array of the model is sorted by `schema`, then `name`, comparing
//   strings by UTF-16 code units (`<`), not by locale; objects that share a
//   name are further sorted by their table, then by their identity arguments.
//   Casts, which have neither a schema nor a name, are sorted by `source`,
//   then `target`.

/**
 * A name that is always qualified with its schema.
 */
export interface SchemaQualifiedName extends QualifiedName {
  /**
   * The schema of the object.
   */
  readonly schema: string;
}

/**
 * The kind of an object of the model: the value of its `kind` field.
 */
export type ObjectKind =
  | 'schema'
  | 'extension'
  | 'enum'
  | 'shellType'
  | 'composite'
  | 'domain'
  | 'range'
  | 'collation'
  | 'sequence'
  | 'function'
  | 'operator'
  | 'cast'
  | 'aggregate'
  | 'table'
  | 'constraint'
  | 'index'
  | 'view'
  | 'materializedView'
  | 'trigger'
  | 'policy'
  | 'rule'
  | 'statistics';

/**
 * A reference to an object of the model. Every object of the model is an
 * `ObjectRef` itself (it has `kind` and `oid`).
 *
 * OIDs are only unique within their catalog, so a reference needs both: the
 * kind tells the catalog (`pg_class` for tables, views, materialized views,
 * sequences and indexes, `pg_type` for enums, shell types, composites,
 * domains and ranges, `pg_proc` for functions and aggregates, `pg_collation`,
 * `pg_operator` and `pg_cast` for collations, operators and casts, …).
 */
export interface ObjectRef {
  /**
   * The kind of the object.
   */
  readonly kind: ObjectKind;

  /**
   * The OID of the object in its catalog (for a composite type, its
   * `pg_type` OID, not the OID of its `pg_class` row).
   */
  readonly oid: number;
}

/**
 * What every object of the model has.
 */
export interface CatalogObject extends ObjectRef {
  /**
   * The schema of the object (for a schema, its own name).
   */
  readonly schema: string;

  /**
   * The name of the object.
   */
  readonly name: string;

  /**
   * The comment on the object (`COMMENT ON … IS …`), when it has one.
   */
  readonly comment?: string;
}

/**
 * A schema to create (`pg_namespace`).
 *
 * The model has every schema that is not a system schema (`pg_catalog`,
 * `information_schema`, `pg_toast*`, `pg_temp*`) and is in the included
 * schemas. `public`, which every database has, is only there when its
 * comment is neither null nor the default one (`DEFAULT_PUBLIC_SCHEMA_COMMENT`
 * in `core/model.ts`), so that the comment is set; creating it is a no-op
 * (`IF NOT EXISTS`).
 */
export interface Schema extends CatalogObject {
  readonly kind: 'schema';
}

/**
 * An installed extension (`pg_extension`). Its member objects are not in
 * the model: `CREATE EXTENSION` creates them.
 *
 * Extensions are kept whatever their schema, like `pg_dump --extension=*`
 * does when schemas are included. `comment` is always left out: `CREATE
 * EXTENSION` sets the extension's own comment (the SQL output drops
 * `COMMENT ON EXTENSION` for the same reason).
 */
export interface Extension extends CatalogObject {
  readonly kind: 'extension';

  /**
   * The installed version (`extversion`), e.g. `'1.6'`.
   */
  readonly version: string;
}

/**
 * An enum type (`pg_type.typtype = 'e'`).
 */
export interface EnumType extends CatalogObject {
  readonly kind: 'enum';

  /**
   * The labels, in `enumsortorder` order.
   */
  readonly labels: ReadonlyArray<string>;
}

/**
 * A shell type (`pg_type.typtype = 'p'` that is not `typisdefined`): a type
 * that `CREATE TYPE name` declares without a definition, e.g. so that the
 * functions of a base type can refer to it before it is defined. The
 * pseudo-types of the system are not in the model.
 */
export interface ShellType extends CatalogObject {
  readonly kind: 'shellType';
}

/**
 * An attribute of a composite type.
 */
export interface CompositeAttribute {
  /**
   * The name of the attribute.
   */
  readonly name: string;

  /**
   * Its type, as `format_type(atttypid, atttypmod)` writes it, e.g.
   * `'character varying(12)'`.
   */
  readonly type: string;

  /**
   * Its collation as SQL (`quote_ident(schema) || '.' ||
   * quote_ident(name)`, e.g. `'pg_catalog."C"'`), when it is not the default
   * collation of its type.
   */
  readonly collation?: string;

  /**
   * The comment on the attribute (`COMMENT ON COLUMN type.attribute`).
   */
  readonly comment?: string;
}

/**
 * A standalone composite type (`pg_type.typtype = 'c'` whose `pg_class` row
 * has `relkind = 'c'`); the row types of tables, views and materialized
 * views are not in the model.
 */
export interface CompositeType extends CatalogObject {
  readonly kind: 'composite';

  /**
   * The attributes, in `attnum` order, without dropped ones.
   */
  readonly attributes: ReadonlyArray<CompositeAttribute>;
}

/**
 * A CHECK constraint of a domain.
 */
export interface DomainCheck {
  /**
   * The name of the constraint.
   */
  readonly name: string;

  /**
   * The checked expression, as `pg_get_expr(conbin, 0)` writes it, e.g.
   * `'(VALUE >= 0)'`: what `pg_get_constraintdef()` writes between `CHECK (`
   * and `)`.
   */
  readonly expression: string;

  /**
   * `false` for a `NOT VALID` constraint (`convalidated`).
   */
  readonly validated: boolean;

  /**
   * The comment on the constraint (`COMMENT ON CONSTRAINT … ON DOMAIN …`).
   */
  readonly comment?: string;
}

/**
 * A domain (`pg_type.typtype = 'd'`).
 */
export interface DomainType extends CatalogObject {
  readonly kind: 'domain';

  /**
   * The underlying type, as `format_type(typbasetype, typtypmod)` writes it,
   * e.g. `'numeric(12,2)'`.
   */
  readonly baseType: string;

  /**
   * Whether the domain is `NOT NULL` (`typnotnull`).
   */
  readonly notNull: boolean;

  /**
   * The name of the `NOT NULL` constraint, from PostgreSQL 17 on, which
   * stores it in `pg_constraint` (`contype = 'n'`). Left out on older
   * servers and when the domain is not `NOT NULL`.
   */
  readonly notNullConstraintName?: string;

  /**
   * The comment on the `NOT NULL` constraint (`COMMENT ON CONSTRAINT … ON
   * DOMAIN …`), from PostgreSQL 17 on.
   */
  readonly notNullConstraintComment?: string;

  /**
   * The default, as `pg_get_expr(typdefaultbin, 0)` writes it, e.g. `'0'`.
   */
  readonly default?: string;

  /**
   * The collation as SQL (see {@link CompositeAttribute.collation}), when it
   * is not the default collation of the underlying type.
   */
  readonly collation?: string;

  /**
   * The CHECK constraints, sorted by name.
   */
  readonly checks: ReadonlyArray<DomainCheck>;
}

/**
 * A range type (`pg_type.typtype = 'r'`, with its `pg_range` row). Its
 * multirange type (PostgreSQL 14+) is not a separate object: `CREATE TYPE …
 * AS RANGE` creates it.
 */
export interface RangeType extends CatalogObject {
  readonly kind: 'range';

  /**
   * The subtype, as `format_type(rngsubtype, NULL)` writes it, e.g.
   * `'double precision'`.
   */
  readonly subtype: string;

  /**
   * The subtype's operator class as SQL (e.g. `'pg_catalog.float8_ops'`),
   * when it is not the default one for the subtype.
   */
  readonly subtypeOpclass?: string;

  /**
   * The collation as SQL (see {@link CompositeAttribute.collation}), when the
   * range has one (`rngcollation <> 0`) that is not the subtype's default.
   */
  readonly collation?: string;

  /**
   * The canonical function (`rngcanonical::regproc::text`, so
   * schema-qualified), when there is one.
   */
  readonly canonical?: string;

  /**
   * The subtype difference function (`rngsubdiff::regproc::text`), when
   * there is one.
   */
  readonly subtypeDiff?: string;

  /**
   * The multirange type (`rngmultitypid`), which `CREATE TYPE … AS RANGE`
   * names `<name>_multirange` by default, or with `range` replaced by
   * `multirange` when the name contains `range`.
   */
  readonly multirange: SchemaQualifiedName;
}

/**
 * A collation (`pg_collation`) that is not built in, created with `CREATE
 * COLLATION`.
 */
export interface Collation extends CatalogObject {
  readonly kind: 'collation';

  /**
   * `collprovider`: `'libc'` (`c`), `'icu'` (`i`) or `'builtin'` (`b`,
   * PostgreSQL 17+).
   */
  readonly provider: 'libc' | 'icu' | 'builtin';

  /**
   * `collisdeterministic`: `false` for `deterministic = false`.
   */
  readonly deterministic: boolean;

  /**
   * The locale of an ICU or builtin collation (`colllocale` from PostgreSQL
   * 17 on, `colliculocale` in 15 and 16, `collcollate` before), e.g.
   * `'und-u-ks-level2'`. Left out for libc collations.
   */
  readonly locale?: string;

  /**
   * `LC_COLLATE` of a libc collation (`collcollate`), e.g. `'C'`. Left out
   * for the other providers.
   */
  readonly lcCollate?: string;

  /**
   * `LC_CTYPE` of a libc collation (`collctype`). `CREATE COLLATION` takes
   * `locale = …` when it equals `lcCollate`. Left out for the other
   * providers.
   */
  readonly lcCtype?: string;

  /**
   * The ICU tailoring rules (`collicurules`, PostgreSQL 16+), when set.
   */
  readonly rules?: string;
}

/**
 * The options of a sequence (`pg_sequence`), shared by standalone sequences
 * and identity columns.
 *
 * The numbers are `int8` values written as decimal text (`'-1'`,
 * `'9223372036854775807'`): they are exact, which JavaScript numbers are not
 * beyond `Number.MAX_SAFE_INTEGER`.
 */
export interface SequenceOptions {
  /**
   * The data type, as `format_type(seqtypid, NULL)` writes it: `'smallint'`,
   * `'integer'` or `'bigint'`.
   */
  readonly type: string;

  /**
   * `START WITH` (`seqstart`).
   */
  readonly start: string;

  /**
   * `INCREMENT BY` (`seqincrement`).
   */
  readonly increment: string;

  /**
   * `MINVALUE` (`seqmin`). PostgreSQL stores the actual bound, also when the
   * sequence was created with `NO MINVALUE`.
   */
  readonly minValue: string;

  /**
   * `MAXVALUE` (`seqmax`). PostgreSQL stores the actual bound, also when the
   * sequence was created with `NO MAXVALUE`.
   */
  readonly maxValue: string;

  /**
   * `CACHE` (`seqcache`).
   */
  readonly cache: string;

  /**
   * `CYCLE` (`seqcycle`).
   */
  readonly cycle: boolean;
}

/**
 * The column that owns a sequence (`ALTER SEQUENCE … OWNED BY`).
 */
export interface SequenceOwner {
  /**
   * The table of the column.
   */
  readonly table: SchemaQualifiedName;

  /**
   * The column.
   */
  readonly column: string;
}

/**
 * A standalone sequence (`pg_class.relkind = 'S'`), including the ones that
 * serial columns created. The sequences of identity columns are not in the
 * model: they are part of their column (see {@link ColumnIdentity}).
 */
export interface Sequence extends CatalogObject, SequenceOptions {
  readonly kind: 'sequence';

  /**
   * Whether the sequence is `UNLOGGED` (`relpersistence = 'u'`, PostgreSQL
   * 15+).
   */
  readonly unlogged: boolean;

  /**
   * The column that owns the sequence (a dependency of type `a` in
   * `pg_depend`), when there is one. `orderObjects()` sets the ownership
   * after the table is created, since the column's default usually uses the
   * sequence.
   */
  readonly ownedBy?: SequenceOwner;
}

/**
 * An argument of a function or procedure.
 */
export interface RoutineArgument {
  /**
   * How the argument is passed (`proargmodes`; `IN` when it is null).
   * Columns of `RETURNS TABLE (…)` (mode `t`) are not arguments: they are
   * part of {@link Routine.returns}.
   */
  readonly mode: 'IN' | 'OUT' | 'INOUT' | 'VARIADIC';

  /**
   * The name of the argument (`proargnames`), when it has one.
   */
  readonly name?: string;

  /**
   * Its type, as `format_type()` writes it, e.g. `'text[]'` for a VARIADIC
   * `text[]` argument.
   */
  readonly type: string;

  /**
   * Its default, as `pg_get_function_arg_default()` writes it, e.g. `'30'`.
   */
  readonly default?: string;
}

/**
 * A setting of a function or procedure (`proconfig`, `SET name = value`).
 */
export interface RoutineSetting {
  /**
   * The name of the setting, e.g. `'search_path'`.
   */
  readonly name: string;

  /**
   * The value as `proconfig` stores it after the first `=`, e.g. `'64MB'`.
   * List settings such as `search_path` keep the identifier quoting of their
   * elements: `SET search_path = ''` is stored as `search_path=""`, so the
   * value is `'""'`, and `SET search_path = pg_catalog, pg_temp` gives
   * `'pg_catalog, pg_temp'`.
   */
  readonly value: string;
}

/**
 * A function, window function or procedure (`pg_proc.prokind` `f`, `w` or
 * `p`). Aggregates are {@link Aggregate}s.
 */
export interface Routine extends CatalogObject {
  readonly kind: 'function';

  /**
   * What kind of routine it is (`prokind`): `'function'` (`f`), `'window'`
   * (`w`) or `'procedure'` (`p`).
   */
  readonly routineKind: 'function' | 'window' | 'procedure';

  /**
   * The arguments, in order (from `proallargtypes`, or `proargtypes` when
   * it is null, with `proargnames` and `proargmodes`).
   */
  readonly arguments: ReadonlyArray<RoutineArgument>;

  /**
   * The argument types that identify the routine, as
   * `pg_get_function_identity_arguments()` writes them, e.g. `'p_customer_id
   * bigint'`; `''` without arguments. Used for `COMMENT ON FUNCTION …(…)`.
   */
  readonly identityArguments: string;

  /**
   * What the function returns, as `pg_get_function_result()` writes it, e.g.
   * `'numeric'`, `'SETOF kitchen.orders'` or `'TABLE(order_id bigint,
   * placed_at timestamp with time zone)'`. Left out for procedures.
   */
  readonly returns?: string;

  /**
   * Whether the function returns a set (`proretset`), which changes the
   * default of `rows`.
   */
  readonly returnsSet: boolean;

  /**
   * The language (`pg_language.lanname`), e.g. `'plpgsql'`.
   */
  readonly language: string;

  /**
   * The body as written (`prosrc`), e.g. the PL/pgSQL source between the
   * dollar quotes. Not meaningful for a SQL-standard body (see `hasSqlBody`).
   */
  readonly body: string;

  /**
   * Whether the body is SQL-standard (`BEGIN ATOMIC …` or `RETURN …`,
   * PostgreSQL 14+: `prosqlbody IS NOT NULL`). Only `definition` has it.
   */
  readonly hasSqlBody: boolean;

  /**
   * `provolatile`: `'IMMUTABLE'` (`i`), `'STABLE'` (`s`) or `'VOLATILE'`
   * (`v`).
   */
  readonly volatility: 'IMMUTABLE' | 'STABLE' | 'VOLATILE';

  /**
   * `STRICT` / `RETURNS NULL ON NULL INPUT` (`proisstrict`).
   */
  readonly strict: boolean;

  /**
   * `SECURITY DEFINER` (`prosecdef`).
   */
  readonly securityDefiner: boolean;

  /**
   * `LEAKPROOF` (`proleakproof`).
   */
  readonly leakproof: boolean;

  /**
   * `proparallel`: `'SAFE'` (`s`), `'RESTRICTED'` (`r`) or `'UNSAFE'` (`u`).
   */
  readonly parallel: 'SAFE' | 'RESTRICTED' | 'UNSAFE';

  /**
   * `COST` (`procost`). The default is 1 for C and internal functions and
   * 100 for the others.
   */
  readonly cost: number;

  /**
   * `ROWS` (`prorows`): the default is 1000 for set-returning functions and
   * 0 (not applicable) for the others.
   */
  readonly rows: number;

  /**
   * The `SET` clauses (`proconfig`), in order.
   */
  readonly config: ReadonlyArray<RoutineSetting>;

  /**
   * The planner support function (`SUPPORT`, `prosupport`) as SQL, e.g.
   * `'pg_catalog.textlike_support'`, when there is one.
   */
  readonly support?: string;

  /**
   * The whole `CREATE OR REPLACE FUNCTION|PROCEDURE` statement, as
   * `pg_get_functiondef()` writes it (no trailing `;`), for the fallback.
   */
  readonly definition: string;
}

/**
 * An operator (`pg_operator`). Its `name` is its symbol, e.g. `'=~='`.
 *
 * Types, functions and other operators are given by their schema and the
 * name `pg_type` / `pg_proc` / `pg_operator` stores (`int4` for `integer`),
 * because `CreateOperatorOptions` quotes type and function names as
 * identifiers.
 */
export interface Operator extends CatalogObject {
  readonly kind: 'operator';

  /**
   * The type of the left operand (`oprleft`). Left out for a prefix
   * operator.
   */
  readonly left?: SchemaQualifiedName;

  /**
   * The type of the right operand (`oprright`; PostgreSQL 14+ has no postfix
   * operators).
   */
  readonly right: SchemaQualifiedName;

  /**
   * `FUNCTION` (`oprcode`).
   */
  readonly function: SchemaQualifiedName;

  /**
   * `COMMUTATOR` (`oprcom`), when set.
   */
  readonly commutator?: SchemaQualifiedName;

  /**
   * `NEGATOR` (`oprnegate`), when set.
   */
  readonly negator?: SchemaQualifiedName;

  /**
   * `RESTRICT` (`oprrest`), when set.
   */
  readonly restrict?: SchemaQualifiedName;

  /**
   * `JOIN` (`oprjoin`), when set.
   */
  readonly join?: SchemaQualifiedName;

  /**
   * `HASHES` (`oprcanhash`).
   */
  readonly hashes: boolean;

  /**
   * `MERGES` (`oprcanmerge`).
   */
  readonly merges: boolean;

  /**
   * The operand types that identify the operator, each as `format_type()`
   * writes it, `NONE` for the missing left operand of a prefix operator,
   * joined with `', '`, e.g. `'numeric, numeric'`: what `COMMENT ON OPERATOR
   * <operator> (…)` takes.
   */
  readonly identityArguments: string;
}

/**
 * A cast (`pg_cast`) created with `CREATE CAST`: not built in and not a
 * member of an extension.
 *
 * Casts belong to no schema, so they have neither `schema` nor `name`. Like
 * pg_dump, `rowsToModel()` keeps them unless `includeSchemas` is set.
 */
export interface Cast extends ObjectRef {
  readonly kind: 'cast';

  /**
   * The comment on the cast (`COMMENT ON CAST (… AS …)`), when it has one.
   */
  readonly comment?: string;

  /**
   * The source type, as `format_type(castsource, NULL)` writes it, e.g.
   * `'character varying'`.
   */
  readonly source: string;

  /**
   * The target type, as `format_type(casttarget, NULL)` writes it, e.g.
   * `'integer'`.
   */
  readonly target: string;

  /**
   * How it converts (`castmethod`): `'function'` (`f`, `WITH FUNCTION`),
   * `'inout'` (`i`, `WITH INOUT`) or `'binary'` (`b`, `WITHOUT FUNCTION`).
   */
  readonly method: 'function' | 'inout' | 'binary';

  /**
   * The function of a `'function'` cast (`castfunc`).
   */
  readonly function?: SchemaQualifiedName;

  /**
   * The argument types of `function` (its `proargtypes`), each as
   * `format_type()` writes it, e.g. `['text']` or `['numeric', 'integer',
   * 'boolean']`: what `CreateCastOptions.argumentTypes` takes. Empty for the
   * other methods.
   */
  readonly functionArguments: ReadonlyArray<string>;

  /**
   * When it applies (`castcontext`): `'EXPLICIT'` (`e`, the default),
   * `'ASSIGNMENT'` (`a`) or `'IMPLICIT'` (`i`), spelled like
   * `CreateCastOptions.as`.
   */
  readonly context: 'EXPLICIT' | 'ASSIGNMENT' | 'IMPLICIT';
}

/**
 * The part of an aggregate that computes it in moving-aggregate mode
 * (`CREATE AGGREGATE … MSFUNC = …`).
 */
export interface MovingAggregate {
  /**
   * `MSFUNC` (`aggmtransfn::regproc::text`).
   */
  readonly stateFunction: string;

  /**
   * `MINVFUNC` (`aggminvtransfn::regproc::text`).
   */
  readonly inverseFunction: string;

  /**
   * `MSTYPE`, as `format_type(aggmtranstype, NULL)` writes it.
   */
  readonly stateType: string;

  /**
   * `MSSPACE` (`aggmtransspace`), when it is not 0.
   */
  readonly stateSpace?: number;

  /**
   * `MFINALFUNC` (`aggmfinalfn::regproc::text`), when there is one.
   */
  readonly finalFunction?: string;

  /**
   * `MFINALFUNC_EXTRA` (`aggmfinalextra`).
   */
  readonly finalFunctionExtra: boolean;

  /**
   * `MFINALFUNC_MODIFY` (`aggmfinalmodify`): `'READ_ONLY'` (`r`),
   * `'SHAREABLE'` (`s`) or `'READ_WRITE'` (`w`).
   */
  readonly finalFunctionModify: 'READ_ONLY' | 'SHAREABLE' | 'READ_WRITE';

  /**
   * `MINITCOND` (`aggminitval`), when there is one.
   */
  readonly initialCondition?: string;
}

/**
 * A normal aggregate (`pg_proc.prokind = 'a'` with `pg_aggregate.aggkind =
 * 'n'`). Ordered-set and hypothetical-set aggregates are
 * {@link UnsupportedObject}s.
 *
 * Function names are `regproc::text`, and so schema-qualified.
 */
export interface Aggregate extends CatalogObject {
  readonly kind: 'aggregate';

  /**
   * The argument types, as `pg_get_function_identity_arguments()` writes
   * them, e.g. `'text'`; `''` for an aggregate over `*`.
   */
  readonly identityArguments: string;

  /**
   * The argument types, each as `format_type()` writes it; empty for an
   * aggregate over `*`.
   */
  readonly argumentTypes: ReadonlyArray<string>;

  /**
   * `SFUNC` (`aggtransfn`).
   */
  readonly stateFunction: string;

  /**
   * `STYPE`, as `format_type(aggtranstype, NULL)` writes it.
   */
  readonly stateType: string;

  /**
   * `SSPACE` (`aggtransspace`), when it is not 0.
   */
  readonly stateSpace?: number;

  /**
   * `FINALFUNC` (`aggfinalfn`), when there is one.
   */
  readonly finalFunction?: string;

  /**
   * `FINALFUNC_EXTRA` (`aggfinalextra`).
   */
  readonly finalFunctionExtra: boolean;

  /**
   * `FINALFUNC_MODIFY` (`aggfinalmodify`): `'READ_ONLY'` (`r`),
   * `'SHAREABLE'` (`s`) or `'READ_WRITE'` (`w`).
   */
  readonly finalFunctionModify: 'READ_ONLY' | 'SHAREABLE' | 'READ_WRITE';

  /**
   * `COMBINEFUNC` (`aggcombinefn`), when there is one.
   */
  readonly combineFunction?: string;

  /**
   * `SERIALFUNC` (`aggserialfn`), when there is one.
   */
  readonly serialFunction?: string;

  /**
   * `DESERIALFUNC` (`aggdeserialfn`), when there is one.
   */
  readonly deserialFunction?: string;

  /**
   * `INITCOND` (`agginitval`), when there is one.
   */
  readonly initialCondition?: string;

  /**
   * The moving-aggregate implementation (`aggmtransfn <> 0`), when there is
   * one.
   */
  readonly moving?: MovingAggregate;

  /**
   * `SORTOP` (`aggsortop`), as SQL (`OPERATOR(schema.op)`), when there is
   * one.
   */
  readonly sortOperator?: string;

  /**
   * `PARALLEL` (`proparallel` of the aggregate).
   */
  readonly parallel: 'SAFE' | 'RESTRICTED' | 'UNSAFE';
}

/**
 * The identity of an identity column (`attidentity` `a` or `d`) and its
 * sequence.
 */
export interface ColumnIdentity {
  /**
   * `GENERATED ALWAYS` (`a`) or `GENERATED BY DEFAULT` (`d`), spelled like
   * `SequenceGeneratedOptions.precedence`.
   */
  readonly generation: 'ALWAYS' | 'BY DEFAULT';

  /**
   * The identity sequence (the sequence with an `i` dependency on the
   * column). PostgreSQL names it `<table>_<column>_seq` unless `SEQUENCE
   * NAME` says otherwise (or that name is taken, or too long).
   */
  readonly sequence: SchemaQualifiedName;

  /**
   * The options of the identity sequence.
   */
  readonly options: SequenceOptions;

  /**
   * The comment on the identity sequence (`COMMENT ON SEQUENCE`), when it
   * has one.
   */
  readonly comment?: string;
}

/**
 * A generated column (`attgenerated` `s` or `v`).
 */
export interface ColumnGenerated {
  /**
   * `STORED` (`s`) or `VIRTUAL` (`v`, PostgreSQL 18+).
   */
  readonly storage: 'STORED' | 'VIRTUAL';

  /**
   * The generation expression, as `pg_get_expr(adbin, adrelid)` writes it.
   */
  readonly expression: string;
}

/**
 * A sequence owned by a column, seen from the column (see
 * {@link Column.ownedSequence}).
 */
export interface OwnedSequence {
  /**
   * The name of the sequence.
   */
  readonly name: SchemaQualifiedName;

  /**
   * Its options.
   */
  readonly options: SequenceOptions;

  /**
   * Whether it is `UNLOGGED`.
   */
  readonly unlogged: boolean;
}

/**
 * The `NOT NULL` constraint of a column, which PostgreSQL 18 stores in
 * `pg_constraint` (`contype = 'n'`).
 */
export interface NotNullConstraint {
  /**
   * The name of the constraint (by default `<table>_<column>_not_null`).
   */
  readonly name: string;

  /**
   * `NO INHERIT` (`connoinherit`).
   */
  readonly noInherit: boolean;

  /**
   * `false` for a `NOT VALID` constraint (`convalidated`).
   */
  readonly validated: boolean;

  /**
   * The comment on the constraint (`COMMENT ON CONSTRAINT … ON <table>`).
   */
  readonly comment?: string;
}

/**
 * What a column of an inheritance child or a partition gets from the columns
 * of its parents when the table is created (`CREATE TABLE … INHERITS (…)` or
 * `CREATE TABLE … PARTITION OF …`), before any `ALTER TABLE` of its own: a
 * child can then set, change or drop its default, and add `NOT NULL`.
 */
export interface ColumnInheritance {
  /**
   * The default the column gets from its parents: the one of the first parent
   * (in `inherits` order) whose column has one, as `pg_get_expr()` writes it.
   * Left out when no parent's column has a default.
   */
  readonly parentDefault?: string;

  /**
   * Whether the column gets `NOT NULL` from its parents: a parent's column is
   * `NOT NULL`, with a constraint that is not `NO INHERIT` on PostgreSQL 18.
   */
  readonly parentNotNull: boolean;

  /**
   * On PostgreSQL 18, whether the table declares the column's `NOT NULL`
   * constraint itself (`conislocal`), besides or instead of inheriting it:
   * `false` for a constraint the column only inherits, which keeps the
   * parent's name. Left out on older servers and for nullable columns.
   */
  readonly localNotNull?: boolean;
}

/**
 * A column of a table (`pg_attribute`).
 */
export interface Column {
  /**
   * The name of the column.
   */
  readonly name: string;

  /**
   * Its type, as `format_type(atttypid, atttypmod)` writes it, e.g.
   * `'numeric(12,2)'`, `'text[]'` or `'kitchen.mood'`.
   */
  readonly type: string;

  /**
   * Whether the column is `NOT NULL` (`attnotnull`).
   */
  readonly notNull: boolean;

  /**
   * Its `NOT NULL` constraint, on PostgreSQL 18 and newer, folded in from
   * the `contype = 'n'` rows of the constraints query. Left out on older
   * servers and for nullable columns.
   */
  readonly notNullConstraint?: NotNullConstraint;

  /**
   * The default, as `pg_get_expr(adbin, adrelid)` writes it, e.g.
   * `"nextval('kitchen.ticket_seq'::regclass)"` or `'now()'`. Left out for
   * generated columns, whose expression is `generated.expression`.
   */
  readonly default?: string;

  /**
   * The identity, for an identity column.
   */
  readonly identity?: ColumnIdentity;

  /**
   * The generation, for a generated column.
   */
  readonly generated?: ColumnGenerated;

  /**
   * The sequence that this column owns, when exactly one sequence of the
   * model has this column as its `ownedBy` (the same {@link Sequence}, seen
   * from the column), so that the table emitter can tell a `serial` column:
   * one whose default is `nextval('<that sequence>'::regclass)`.
   */
  readonly ownedSequence?: OwnedSequence;

  /**
   * The collation as SQL (see {@link CompositeAttribute.collation}), when it
   * is not the default collation of the column's type.
   */
  readonly collation?: string;

  /**
   * The comment on the column.
   */
  readonly comment?: string;

  /**
   * Whether the column is defined by the table itself (`attislocal`). A
   * column that a child only inherits is not local; a partition's columns are
   * never local.
   */
  readonly local: boolean;

  /**
   * How many parents the column is inherited from (`attinhcount`).
   */
  readonly inheritCount: number;

  /**
   * What the column gets from the columns of its table's parents (see
   * {@link ColumnInheritance}), for a column that the table inherits
   * (`inheritCount > 0`) from parents that are all in the model. Left out
   * otherwise.
   */
  readonly inheritance?: ColumnInheritance;

  /**
   * `ALTER COLUMN … SET STATISTICS` (`attstattarget`), when it is set (not
   * -1 and not null).
   */
  readonly statisticsTarget?: number;

  /**
   * `ALTER COLUMN … SET STORAGE` (`attstorage`: `p`, `e`, `m` or `x`), when
   * it is not the default storage of the type (`typstorage`).
   */
  readonly storage?: 'PLAIN' | 'EXTERNAL' | 'MAIN' | 'EXTENDED';

  /**
   * `ALTER COLUMN … SET COMPRESSION` (`attcompression`: `p` or `l`, PostgreSQL
   * 14+), when it is set.
   */
  readonly compression?: 'pglz' | 'lz4';

  /**
   * `ALTER COLUMN … SET (…)` (`attoptions`), each as stored, e.g.
   * `'n_distinct=100'`.
   */
  readonly options: ReadonlyArray<string>;
}

/**
 * The partition bound of a partition.
 */
export interface PartitionOf {
  /**
   * The partitioned table this table is a partition of.
   */
  readonly parent: SchemaQualifiedName;

  /**
   * The bound, as `pg_get_expr(relpartbound, oid)` writes it, e.g. `"FOR
   * VALUES FROM ('2025-01-01 00:00:00+00') TO ('2026-01-01 00:00:00+00')"`
   * or `'DEFAULT'`.
   */
  readonly bound: string;

  /**
   * `true` when the partition's columns, in `attnum` order, are not in the
   * order of its partitioned table's (it was created on its own, then
   * attached): `CREATE TABLE … PARTITION OF` would give it its partitioned
   * table's order. Left out when they are in the same order, and when the
   * partitioned table is not among the tables of the rows.
   */
  readonly ownColumnOrder?: boolean;
}

/**
 * A table (`pg_class.relkind` `r`, or `p` for a partitioned table).
 * Temporary tables are not in the model.
 */
export interface Table extends CatalogObject {
  readonly kind: 'table';

  /**
   * Whether the table is partitioned (`relkind = 'p'`).
   */
  readonly partitioned: boolean;

  /**
   * Whether the table is `UNLOGGED` (`relpersistence = 'u'`).
   */
  readonly unlogged: boolean;

  /**
   * The columns, in `attnum` order, without dropped ones; inherited columns
   * included.
   */
  readonly columns: ReadonlyArray<Column>;

  /**
   * The partition key of a partitioned table, as `pg_get_partkeydef(oid)`
   * writes it, e.g. `'RANGE (measured_at)'` or `'HASH (order_id)'`.
   */
  readonly partitionKey?: string;

  /**
   * What the table is a partition of (`relispartition`). A partition can
   * itself be partitioned (`partitionKey`).
   */
  readonly partitionOf?: PartitionOf;

  /**
   * The parents of an inheritance child, in `inhseqno` order. The parent of
   * a partition is `partitionOf`, not here.
   */
  readonly inherits: ReadonlyArray<SchemaQualifiedName>;

  /**
   * The composite type of a typed table (`CREATE TABLE … OF <type>`,
   * `reloftype`), whose attributes are the table's columns. Left out for
   * other tables.
   */
  readonly ofType?: SchemaQualifiedName;

  /**
   * `ENABLE ROW LEVEL SECURITY` (`relrowsecurity`).
   */
  readonly rowLevelSecurity: boolean;

  /**
   * `FORCE ROW LEVEL SECURITY` (`relforcerowsecurity`).
   */
  readonly forceRowLevelSecurity: boolean;

  /**
   * The storage parameters (`reloptions`), each as stored, e.g.
   * `'fillfactor=90'`.
   */
  readonly options: ReadonlyArray<string>;

  /**
   * The table access method (`pg_am.amname`), when it is not `heap`.
   */
  readonly accessMethod?: string;

  /**
   * `REPLICA IDENTITY` (`relreplident`): `'DEFAULT'` (`d`), `'NOTHING'`
   * (`n`), `'FULL'` (`f`) or `'INDEX'` (`i`, the index or constraint whose
   * `replicaIdentity` is `true`).
   */
  readonly replicaIdentity: 'DEFAULT' | 'NOTHING' | 'FULL' | 'INDEX';
}

/**
 * An index of a partition that is attached to an index of its partitioned
 * table (`relispartition`), directly or through the index of a partition that
 * is partitioned itself: the index of the table, or of its primary key, unique
 * or exclusion constraint, creates it, or attaches the partition's matching
 * index when the partition already has one.
 */
export interface PartitionIndex {
  /**
   * The partition.
   */
  readonly table: SchemaQualifiedName;

  /**
   * The name of the index (for the index of a constraint, the name of the
   * partition's constraint too).
   */
  readonly name: string;

  /**
   * The names of its columns (`pg_attribute` of the index): its key columns,
   * then its `INCLUDE` columns, the way PostgreSQL named them (e.g. `lower`
   * or `expr` for an expression). PostgreSQL names the indexes it creates for
   * partitions after these (see `ChooseIndexName()`).
   */
  readonly columns: ReadonlyArray<string>;

  /**
   * The whole `CREATE [UNIQUE] INDEX` statement, as `pg_get_indexdef(oid)`
   * writes it (with `ON ONLY` for a partitioned partition).
   */
  readonly definition: string;

  /**
   * For the index of a constraint: the partition's constraint, as
   * `pg_get_constraintdef(oid)` writes it.
   */
  readonly constraintDefinition?: string;

  /**
   * `1` for an index of a partition of the table, `2` for an index of a
   * partition of such a partition, and so on.
   */
  readonly level: number;

  /**
   * The index it is attached to (`pg_inherits.inhparent`), from `level` 2 on:
   * the index of a partitioned partition. Left out at `level` 1, where it is
   * the index that has these `partitionIndexes` (for a constraint, its index,
   * which has the constraint's name).
   */
  readonly parent?: SchemaQualifiedName;

  /**
   * Its storage parameters (`reloptions`), each as stored, e.g.
   * `'fillfactor=70'`. Left out when it has none.
   */
  readonly options?: ReadonlyArray<string>;

  /**
   * `true` when the partition is clustered on the index (`indisclustered`).
   * Left out otherwise.
   */
  readonly clustered?: boolean;

  /**
   * `true` when the index is the partition's replica identity
   * (`indisreplident`). Left out otherwise.
   */
  readonly replicaIdentity?: boolean;

  /**
   * The comment on the index (`COMMENT ON INDEX`), when it has one.
   */
  readonly comment?: string;
}

/**
 * A table constraint (`pg_constraint` with `conrelid <> 0`) other than
 * `NOT NULL` (folded into {@link Column.notNullConstraint}) and constraint
 * triggers (`contype = 't'`, which are {@link Trigger}s).
 *
 * Only constraints the table defines itself (`conislocal`) are in the
 * model, like pg_dump: the copies that inheritance children and partitions
 * only inherit are created by `INHERITS` / `PARTITION OF`, and the clones
 * that partitions get from their partitioned table (`conparentid <> 0`) by
 * adding the constraint to the partitioned table. A constraint that is both
 * local and inherited is kept (adding it merges it with the inherited one).
 */
export interface Constraint extends CatalogObject {
  readonly kind: 'constraint';

  /**
   * The table of the constraint.
   */
  readonly table: SchemaQualifiedName;

  /**
   * `contype`: `'primaryKey'` (`p`), `'unique'` (`u`), `'check'` (`c`),
   * `'foreignKey'` (`f`) or `'exclusion'` (`x`).
   */
  readonly type: 'primaryKey' | 'unique' | 'check' | 'foreignKey' | 'exclusion';

  /**
   * The constraint, as `pg_get_constraintdef(oid)` writes it, e.g. `'PRIMARY
   * KEY (id)'` or `'CHECK ((weight_grams > 0)) NOT VALID'`: what goes after
   * `ADD CONSTRAINT <name>`.
   */
  readonly definition: string;

  /**
   * `DEFERRABLE` (`condeferrable`).
   */
  readonly deferrable: boolean;

  /**
   * `INITIALLY DEFERRED` (`condeferred`).
   */
  readonly deferred: boolean;

  /**
   * `false` for a `NOT VALID` constraint (`convalidated`).
   */
  readonly validated: boolean;

  /**
   * The table a foreign key references (`confrelid`).
   */
  readonly references?: SchemaQualifiedName;

  /**
   * Whether the table is clustered on the constraint's index
   * (`indisclustered`, `ALTER TABLE … CLUSTER ON`). Always `false` for CHECK
   * constraints and foreign keys.
   */
  readonly clustered: boolean;

  /**
   * Whether the constraint's index is the table's replica identity
   * (`indisreplident`, `REPLICA IDENTITY USING INDEX`). Always `false` for
   * CHECK constraints and foreign keys.
   */
  readonly replicaIdentity: boolean;

  /**
   * The comment on the index of a primary key, unique or exclusion
   * constraint (`COMMENT ON INDEX`), which is separate from the comment on
   * the constraint.
   */
  readonly indexComment?: string;

  /**
   * For a primary key, unique or exclusion constraint of a partitioned
   * table: the indexes of the partitions (with their constraints) attached to
   * its index (see {@link PartitionIndex}), sorted by `level`, deepest
   * first, then by table and name. Left out when there are none.
   */
  readonly partitionIndexes?: ReadonlyArray<PartitionIndex>;
}

/**
 * The part of an index key that is the same for columns and expressions.
 */
export interface IndexKeyBase {
  /**
   * The operator class as SQL (e.g. `'kitchen.gin_trgm_ops'`), when it is
   * not the default one for the key's type: exactly when `pg_get_indexdef()`
   * writes it.
   */
  readonly opclass?: string;

  /**
   * The collation as SQL (see {@link CompositeAttribute.collation}), when it
   * is not the key's default collation: exactly when `pg_get_indexdef()`
   * writes it.
   */
  readonly collation?: string;

  /**
   * `DESC` (`indoption` bit 1).
   */
  readonly descending: boolean;

  /**
   * `NULLS FIRST` (`indoption` bit 2). By default nulls come last in
   * ascending order and first in descending order.
   */
  readonly nullsFirst: boolean;

  /**
   * `ALTER INDEX … ALTER COLUMN <n> SET STATISTICS` (the `attstattarget` of
   * the key's column of the index), when it is set: only an expression can
   * have one.
   */
  readonly statisticsTarget?: number;
}

/**
 * A key of an index: a column or an expression.
 */
export type IndexKey =
  | (IndexKeyBase & {
      /**
       * The name of the column (a key whose `indkey` entry is not 0).
       */
      readonly column: string;
    })
  | (IndexKeyBase & {
      /**
       * The expression (a key whose `indkey` entry is 0), as
       * `pg_get_indexdef(oid, <key number>, false)` writes it: without the
       * parentheses `CREATE INDEX` needs around most expressions, e.g.
       * `'lower(email)'` or `"(meta ->> 'type'::text)"`.
       */
      readonly expression: string;
    });

/**
 * An index (`pg_index`) that does not back a constraint (see
 * {@link Constraint}): those are created with their constraint.
 *
 * The indexes that partitions get from an index of their partitioned table
 * (`relispartition` indexes) are not in the model either: creating the
 * partitioned index, or attaching a partition, creates them. They are the
 * `partitionIndexes` of that index or constraint.
 *
 * Like pg_dump, the model leaves out the indexes that are not ready or not
 * valid (`NOT indisready`, or `NOT indisvalid`: what a failed `CREATE INDEX
 * CONCURRENTLY` leaves behind), except the indexes of partitioned tables
 * (`relkind = 'I'`), which are not valid until an index of every partition
 * is attached to them (see {@link Index.valid}).
 */
export interface Index extends CatalogObject {
  readonly kind: 'index';

  /**
   * The indexed table or materialized view.
   */
  readonly table: SchemaQualifiedName;

  /**
   * The whole `CREATE [UNIQUE] INDEX` statement, as `pg_get_indexdef(oid)`
   * writes it (no trailing `;`), for the fallback.
   */
  readonly definition: string;

  /**
   * `UNIQUE` (`indisunique`).
   */
  readonly unique: boolean;

  /**
   * The index access method (`pg_am.amname`), e.g. `'btree'`, `'gin'` or
   * `'brin'`.
   */
  readonly method: string;

  /**
   * The keys, in order (the first `indnkeyatts` entries of `indkey`).
   */
  readonly keys: ReadonlyArray<IndexKey>;

  /**
   * The `INCLUDE` columns, in order (the `indkey` entries after the keys).
   */
  readonly include: ReadonlyArray<string>;

  /**
   * The `WHERE` predicate of a partial index, as `pg_get_expr(indpred,
   * indrelid)` writes it.
   */
  readonly predicate?: string;

  /**
   * `NULLS NOT DISTINCT` (`indnullsnotdistinct`, PostgreSQL 15+; `false` on
   * older servers).
   */
  readonly nullsNotDistinct: boolean;

  /**
   * The storage parameters (`reloptions`), each as stored, e.g.
   * `'fillfactor=80'`.
   */
  readonly options: ReadonlyArray<string>;

  /**
   * Whether the table is clustered on the index (`indisclustered`).
   */
  readonly clustered: boolean;

  /**
   * Whether the index is the table's replica identity (`indisreplident`).
   */
  readonly replicaIdentity: boolean;

  /**
   * For an index of a partitioned table: the indexes of the partitions
   * attached to it (see {@link PartitionIndex}), sorted by `level`, deepest
   * first, then by table and name. Left out when there are none.
   */
  readonly partitionIndexes?: ReadonlyArray<PartitionIndex>;

  /**
   * `false` for an index of a partitioned table that is not valid
   * (`indisvalid`): one created `ON ONLY` the table that has no index of
   * some partition attached to it. Left out for a valid index.
   */
  readonly valid?: boolean;
}

/**
 * A column of a view or materialized view.
 */
export interface ViewColumn {
  /**
   * The name of the column.
   */
  readonly name: string;

  /**
   * The default of a view column (`ALTER VIEW … ALTER COLUMN … SET
   * DEFAULT`), as `pg_get_expr(adbin, adrelid)` writes it. Materialized
   * views have none.
   */
  readonly default?: string;

  /**
   * The comment on the column.
   */
  readonly comment?: string;
}

/**
 * A column of a materialized view, with the settings that `ALTER
 * MATERIALIZED VIEW … ALTER COLUMN … SET …` gives it (see the same fields of
 * {@link Column}), each left out when it is not set.
 */
export interface MaterializedViewColumn extends ViewColumn {
  /**
   * `SET STATISTICS` (`attstattarget`), when it is set.
   */
  readonly statisticsTarget?: number;

  /**
   * `SET STORAGE` (`attstorage`), when it is not the default storage of the
   * type (`typstorage`).
   */
  readonly storage?: Column['storage'];

  /**
   * `SET COMPRESSION` (`attcompression`), when it is set.
   */
  readonly compression?: Column['compression'];

  /**
   * `SET (…)` (`attoptions`), each as stored, e.g. `'n_distinct=100'`;
   * left out when there are none.
   */
  readonly options?: ReadonlyArray<string>;
}

/**
 * A view (`pg_class.relkind = 'v'`).
 */
export interface View extends CatalogObject {
  readonly kind: 'view';

  /**
   * The query, exactly as `pg_get_viewdef(oid)` writes it but without its
   * final `;` (it starts with a space and spans several lines). A recursive
   * view has its `WITH RECURSIVE` form.
   */
  readonly definition: string;

  /**
   * `WITH LOCAL|CASCADED CHECK OPTION`, from the `check_option` entry of
   * `reloptions`.
   */
  readonly checkOption?: 'LOCAL' | 'CASCADED';

  /**
   * The other `reloptions` entries, each as stored, e.g.
   * `'security_barrier=true'`.
   */
  readonly options: ReadonlyArray<string>;

  /**
   * The columns, in `attnum` order.
   */
  readonly columns: ReadonlyArray<ViewColumn>;
}

/**
 * A materialized view (`pg_class.relkind = 'm'`).
 */
export interface MaterializedView extends CatalogObject {
  readonly kind: 'materializedView';

  /**
   * The query, exactly as `pg_get_viewdef(oid)` writes it but without its
   * final `;`.
   */
  readonly definition: string;

  /**
   * The storage parameters (`reloptions`), each as stored, e.g.
   * `'autovacuum_enabled=false'`.
   */
  readonly options: ReadonlyArray<string>;

  /**
   * The table access method (`pg_am.amname`), when it is not `heap`.
   */
  readonly accessMethod?: string;

  /**
   * The columns, in `attnum` order.
   */
  readonly columns: ReadonlyArray<MaterializedViewColumn>;
}

/**
 * Whether a trigger or rule fires (`tgenabled` / `ev_enabled`): `'ORIGIN'`
 * (`O`, the default), `'DISABLED'` (`D`), `'REPLICA'` (`R`) or `'ALWAYS'`
 * (`A`).
 */
export type FiringMode = 'ORIGIN' | 'DISABLED' | 'REPLICA' | 'ALWAYS';

/**
 * An event that fires a trigger.
 */
export type TriggerEvent = 'INSERT' | 'DELETE' | 'UPDATE' | 'TRUNCATE';

/**
 * A partition's clone of a row trigger of its partitioned table (`pg_trigger`
 * with `tgparentid <> 0`): creating the trigger creates one with the same
 * name on each partition, and on the partitions of a partitioned partition
 * (the clones of its clone).
 */
export interface PartitionTrigger {
  /**
   * The partition.
   */
  readonly table: SchemaQualifiedName;

  /**
   * Whether it fires (`tgenabled`); a clone gets the firing mode of the
   * trigger it is a clone of, unless `ALTER TABLE <partition> …
   * TRIGGER` changed it.
   */
  readonly enabled: FiringMode;

  /**
   * The comment on it (`COMMENT ON TRIGGER … ON <partition>`), when it has
   * one.
   */
  readonly comment?: string;

  /**
   * Its own clones, on the partitions of a partitioned partition, sorted by
   * table. Left out when there are none.
   */
  readonly partitionTriggers?: ReadonlyArray<PartitionTrigger>;
}

/**
 * A trigger (`pg_trigger`) that is not internal (`tgisinternal`, e.g. the
 * triggers of foreign keys) and not a partition's clone of a trigger of its
 * partitioned table (`tgparentid <> 0`, see {@link PartitionTrigger}).
 */
export interface Trigger extends CatalogObject {
  readonly kind: 'trigger';

  /**
   * The table, partitioned table or view of the trigger.
   */
  readonly table: SchemaQualifiedName;

  /**
   * When it fires (`tgtype` bits 1 and 6): `'BEFORE'`, `'AFTER'` or
   * `'INSTEAD OF'`, spelled like `TriggerOptions.when`.
   */
  readonly timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';

  /**
   * The events (`tgtype` bits 2 to 5), in the order `pg_get_triggerdef()`
   * writes them: `INSERT`, `DELETE`, `UPDATE`, `TRUNCATE`.
   */
  readonly events: ReadonlyArray<TriggerEvent>;

  /**
   * The columns of `UPDATE OF …` (`tgattr`), in order; empty when the
   * trigger fires on updates of any column or not on updates.
   */
  readonly updateOf: ReadonlyArray<string>;

  /**
   * `FOR EACH ROW` or `FOR EACH STATEMENT` (`tgtype` bit 0).
   */
  readonly level: 'ROW' | 'STATEMENT';

  /**
   * The trigger function.
   */
  readonly function: SchemaQualifiedName;

  /**
   * The arguments passed to the function (`tgargs`), in order.
   */
  readonly args: ReadonlyArray<string>;

  /**
   * The `WHEN` condition, as `pg_get_triggerdef()` writes it between `WHEN
   * (` and its matching `)`.
   */
  readonly condition?: string;

  /**
   * Whether it is a constraint trigger (`tgconstraint <> 0`).
   */
  readonly constraint: boolean;

  /**
   * `DEFERRABLE` (`tgdeferrable`).
   */
  readonly deferrable: boolean;

  /**
   * `INITIALLY DEFERRED` (`tginitdeferred`).
   */
  readonly deferred: boolean;

  /**
   * The transition table of `REFERENCING OLD TABLE AS …` (`tgoldtable`).
   */
  readonly oldTable?: string;

  /**
   * The transition table of `REFERENCING NEW TABLE AS …` (`tgnewtable`).
   */
  readonly newTable?: string;

  /**
   * Whether it fires (`tgenabled`); `'ORIGIN'` unless `ALTER TABLE …
   * DISABLE|ENABLE REPLICA|ENABLE ALWAYS TRIGGER` changed it.
   */
  readonly enabled: FiringMode;

  /**
   * The whole `CREATE [CONSTRAINT] TRIGGER` statement, as
   * `pg_get_triggerdef(oid)` writes it (no trailing `;`), for the fallback.
   */
  readonly definition: string;

  /**
   * For a trigger of a partitioned table: its clones on the partitions (see
   * {@link PartitionTrigger}), sorted by table. Left out when there are none.
   */
  readonly partitionTriggers?: ReadonlyArray<PartitionTrigger>;
}

/**
 * A row-level security policy (`pg_policy`).
 */
export interface Policy extends CatalogObject {
  readonly kind: 'policy';

  /**
   * The table of the policy.
   */
  readonly table: SchemaQualifiedName;

  /**
   * `FOR …` (`polcmd`: `*`, `r`, `a`, `w` or `d`), spelled like
   * `CreatePolicyOptions.command`.
   */
  readonly command: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

  /**
   * `AS PERMISSIVE` (`true`) or `AS RESTRICTIVE` (`polpermissive`).
   */
  readonly permissive: boolean;

  /**
   * The roles of `TO …` (`polroles`), sorted: role names as PostgreSQL
   * stores them, and `'PUBLIC'` for the OID 0. The roles must exist on the
   * databases the migration runs on.
   */
  readonly roles: ReadonlyArray<string>;

  /**
   * `USING (…)`, as `pg_get_expr(polqual, polrelid)` writes it.
   */
  readonly using?: string;

  /**
   * `WITH CHECK (…)`, as `pg_get_expr(polwithcheck, polrelid)` writes it.
   */
  readonly check?: string;
}

/**
 * A rule (`pg_rewrite`) other than the `_RETURN` rule of a view (which is
 * the view's query).
 */
export interface Rule extends CatalogObject {
  readonly kind: 'rule';

  /**
   * The table or view of the rule.
   */
  readonly table: SchemaQualifiedName;

  /**
   * Whether it fires (`ev_enabled`).
   */
  readonly enabled: FiringMode;

  /**
   * The whole `CREATE RULE` statement, as `pg_get_ruledef(oid)` writes it
   * (it ends with `;`).
   */
  readonly definition: string;
}

/**
 * An extended statistics object (`pg_statistic_ext`).
 */
export interface Statistics extends CatalogObject {
  readonly kind: 'statistics';

  /**
   * The table of the statistics object.
   */
  readonly table: SchemaQualifiedName;

  /**
   * The whole `CREATE STATISTICS` statement, as
   * `pg_get_statisticsobjdef(oid)` writes it (no trailing `;`).
   */
  readonly definition: string;

  /**
   * `ALTER STATISTICS … SET STATISTICS` (`stxstattarget`), when it is set
   * (not -1 and not null).
   */
  readonly statisticsTarget?: number;
}

/**
 * The kinds of objects that `--format ts|js` cannot represent at all. A
 * baseline of a database that has any fails with `UNSUPPORTED_OBJECTS`,
 * suggesting `--format sql`.
 *
 * Publications and subscriptions are not among them: they are left out on
 * purpose, like the SQL output does (`--no-publications
 * --no-subscriptions`), since replication settings are not schema.
 */
export type UnsupportedKind =
  | 'access method'
  | 'base type'
  | 'conversion'
  | 'event trigger'
  | 'foreign data wrapper'
  | 'foreign server'
  | 'foreign table'
  | 'language'
  | 'operator class'
  | 'operator family'
  | 'ordered-set aggregate'
  | 'text search configuration'
  | 'text search dictionary'
  | 'text search parser'
  | 'text search template'
  | 'transform';

/**
 * An object of a kind that `--format ts|js` cannot represent (not a member
 * of an extension: `CREATE EXTENSION` creates those).
 */
export interface UnsupportedObject {
  /**
   * What kind of object it is.
   */
  readonly kind: UnsupportedKind;

  /**
   * The object, as the `identity` column of `pg_identify_object()` writes
   * it, e.g. `'kitchen.english_nostop'` or `'plperl'`.
   */
  readonly identity: string;
}

/**
 * An object of the model.
 */
export type ModelObject =
  | Schema
  | Extension
  | EnumType
  | ShellType
  | CompositeType
  | DomainType
  | RangeType
  | Collation
  | Sequence
  | Routine
  | Operator
  | Cast
  | Aggregate
  | Table
  | Constraint
  | Index
  | View
  | MaterializedView
  | Trigger
  | Policy
  | Rule
  | Statistics;

/**
 * An object that must exist before another one can be created.
 */
export interface Dependency {
  /**
   * The object that depends on `to`.
   */
  readonly from: ObjectRef;

  /**
   * The object that `from` needs.
   */
  readonly to: ObjectRef;
}

/**
 * The schema of a database, as `introspect()` reads it from the catalogs.
 */
export interface SchemaModel {
  /**
   * The schemas to create (see {@link Schema}).
   */
  readonly schemas: ReadonlyArray<Schema>;

  /**
   * The installed extensions.
   */
  readonly extensions: ReadonlyArray<Extension>;

  /**
   * The enum types, and the shell types (see {@link ShellType}).
   */
  readonly enums: ReadonlyArray<EnumType | ShellType>;

  /**
   * The standalone composite types.
   */
  readonly composites: ReadonlyArray<CompositeType>;

  /**
   * The domains.
   */
  readonly domains: ReadonlyArray<DomainType>;

  /**
   * The range types.
   */
  readonly ranges: ReadonlyArray<RangeType>;

  /**
   * The collations created with `CREATE COLLATION`.
   */
  readonly collations: ReadonlyArray<Collation>;

  /**
   * The sequences that are not identity sequences.
   */
  readonly sequences: ReadonlyArray<Sequence>;

  /**
   * The functions and procedures (not aggregates).
   */
  readonly functions: ReadonlyArray<Routine>;

  /**
   * The operators.
   */
  readonly operators: ReadonlyArray<Operator>;

  /**
   * The casts created with `CREATE CAST` (see {@link Cast}).
   */
  readonly casts: ReadonlyArray<Cast>;

  /**
   * The normal aggregates.
   */
  readonly aggregates: ReadonlyArray<Aggregate>;

  /**
   * The tables, partitions and partitioned tables included.
   */
  readonly tables: ReadonlyArray<Table>;

  /**
   * The table constraints (see {@link Constraint}).
   */
  readonly constraints: ReadonlyArray<Constraint>;

  /**
   * The indexes that do not back a constraint (see {@link Index}).
   */
  readonly indexes: ReadonlyArray<Index>;

  /**
   * The views.
   */
  readonly views: ReadonlyArray<View>;

  /**
   * The materialized views.
   */
  readonly materializedViews: ReadonlyArray<MaterializedView>;

  /**
   * The triggers (see {@link Trigger}).
   */
  readonly triggers: ReadonlyArray<Trigger>;

  /**
   * The row-level security policies.
   */
  readonly policies: ReadonlyArray<Policy>;

  /**
   * The rules (see {@link Rule}).
   */
  readonly rules: ReadonlyArray<Rule>;

  /**
   * The extended statistics objects.
   */
  readonly statistics: ReadonlyArray<Statistics>;

  /**
   * Which objects need which, between objects of the model, without
   * duplicates and without an object depending on itself, sorted by
   * `from.kind`, `from.oid`, `to.kind`, then `to.oid` (kinds compared as
   * strings, OIDs as numbers).
   *
   * They come from `pg_depend` (dependency types `n`, `a` and `i`, with the
   * dependencies of sub-objects such as columns, defaults, a view's
   * `_RETURN` rule, a domain's constraints or a constraint's index counted
   * as dependencies of the object they belong to; dependencies on an
   * extension's member counted as dependencies on the extension), plus the
   * implicit ones: a table's constraints, indexes, triggers, policies, rules
   * and statistics depend on it, a partition on its partitioned table, an
   * inheritance child on its parents, a foreign key on the primary key or
   * unique constraint it references, an index or constraint on the
   * partitions whose indexes it has (`partitionIndexes`), an index that is
   * not valid on every partition below its table, and a trigger on the
   * partitions of its clones (`partitionTriggers`).
   *
   * A sequence's owner is not a dependency (the column's default usually
   * depends on the sequence): it is {@link Sequence.ownedBy}.
   */
  readonly dependencies: ReadonlyArray<Dependency>;

  /**
   * The objects that `--format ts|js` cannot represent, sorted by `kind`
   * then `identity`.
   */
  readonly unsupported: ReadonlyArray<UnsupportedObject>;
}

/**
 * A comment that is set in phase 18, after everything else (see
 * `orderObjects()`). Comments on tables and on their columns are not
 * separate: they are set with the table.
 */
export type ObjectComment =
  | {
      /**
       * `COMMENT ON <kind> <object>` for any object but a table or an
       * extension (a schema, a type, a collation, a sequence, a function, an
       * operator, a cast, a constraint, an index, a view, …).
       */
      readonly on: 'object';

      /**
       * The object the comment is on.
       */
      readonly object: Exclude<ModelObject, Table | Extension>;

      /**
       * The comment.
       */
      readonly text: string;
    }
  | {
      /**
       * `COMMENT ON COLUMN <relation>.<column>` for a column of a view or
       * materialized view, or an attribute of a composite type.
       */
      readonly on: 'column';

      /**
       * The view, materialized view or composite type of the column.
       */
      readonly object: View | MaterializedView | CompositeType;

      /**
       * The name of the column or attribute.
       */
      readonly column: string;

      /**
       * The comment.
       */
      readonly text: string;
    }
  | {
      /**
       * `COMMENT ON CONSTRAINT <constraint> ON DOMAIN <domain>`.
       */
      readonly on: 'domainConstraint';

      /**
       * The domain of the constraint.
       */
      readonly object: DomainType;

      /**
       * The name of the constraint: a CHECK, or the `NOT NULL` constraint.
       */
      readonly constraint: string;

      /**
       * The comment.
       */
      readonly text: string;
    }
  | {
      /**
       * `COMMENT ON INDEX <index>` for the index of a primary key, unique or
       * exclusion constraint, which has the constraint's name.
       */
      readonly on: 'constraintIndex';

      /**
       * The constraint whose index the comment is on.
       */
      readonly object: Constraint;

      /**
       * The comment.
       */
      readonly text: string;
    };

/**
 * The phases of a migration (see `PHASES` in `core/order.ts`).
 */
export type Phase =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 99;

/**
 * A step of a migration, in the order `orderObjects()` returns them.
 */
export type OrderedObject =
  | {
      /**
       * Saves `check_function_bodies` and turns it off for the rest of the
       * transaction, like the SQL output does: always the first step.
       */
      readonly step: 'prologue';
      readonly phase: 0;
    }
  | {
      /**
       * Creates the object.
       */
      readonly step: 'create';

      /**
       * The phase of the object's kind (see `PHASES`); constraints are in
       * phase 11, except foreign keys, which are in phase 12.
       */
      readonly phase: Phase;

      /**
       * The object to create.
       */
      readonly object: ModelObject;
    }
  | {
      /**
       * Sets the owner of a sequence that has one (`ownedBy`).
       */
      readonly step: 'sequenceOwnership';
      readonly phase: 10;

      /**
       * The owned sequence.
       */
      readonly object: Sequence;
    }
  | {
      /**
       * Enables (and forces) row-level security on a table that has it.
       */
      readonly step: 'rowLevelSecurity';
      readonly phase: 16;

      /**
       * The table.
       */
      readonly object: Table;
    }
  | {
      /**
       * Sets a comment that is not set with a table.
       */
      readonly step: 'comment';
      readonly phase: 18;

      /**
       * The comment.
       */
      readonly object: ObjectComment;
    }
  | {
      /**
       * Restores `check_function_bodies`: always the last step.
       */
      readonly step: 'epilogue';
      readonly phase: 99;
    };

/**
 * What `introspect()` reads.
 */
export interface IntrospectOptions {
  /**
   * Only these schemas (exact names). Extensions are kept whatever their
   * schema; casts, which have no schema, are left out, like `pg_dump
   * --schema` does.
   *
   * (defaults to every schema that is not a system schema)
   */
  readonly includeSchemas?: ReadonlyArray<string>;

  /**
   * Leave these schemas out (exact names).
   */
  readonly excludeSchemas?: ReadonlyArray<string>;

  /**
   * The schema of the migrations table.
   */
  readonly migrationsSchema: string;

  /**
   * The migrations table, which is left out with everything that belongs
   * to it (its columns, constraints, indexes, triggers, …) and the sequences
   * its columns own.
   */
  readonly migrationsTable: string;

  /**
   * The sequence of the migrations table's `id` column, which is left out
   * even when the table does not exist.
   *
   * (defaults to `<migrationsTable>_id_seq` in `migrationsSchema`)
   */
  readonly migrationsSequence?: QualifiedName;
}

// Catalog rows: what each query of `io/queries.ts` returns, one row type per
// query. Field names are the (quoted, camelCase) column aliases of the query;
// catalog codes (`relkind`, `contype`, …) are kept as the catalog stores
// them, for `rowsToModel()` to decode. `null` is SQL NULL. int8 values are
// cast to text, and arrays to `text[]`, `int2[]` or `oid[]`, so that
// node-postgres returns them as typed here whatever type parsers are
// installed.

/**
 * A schema-qualified name in a row (a JSON object in the query), with the
 * name as the catalog stores it.
 */
export interface NameRow {
  readonly schema: string;
  readonly name: string;
}

/**
 * A row of the `schemas` query: every schema but the system ones, `public`
 * included.
 */
export interface SchemaRow {
  readonly oid: number;
  readonly name: string;
  readonly comment: string | null;
}

/**
 * A row of the `extensions` query.
 */
export interface ExtensionRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;

  /**
   * `extversion`.
   */
  readonly version: string;
}

/**
 * A row of the `enums` query.
 */
export interface EnumRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;

  /**
   * The labels, in `enumsortorder` order.
   */
  readonly labels: ReadonlyArray<string>;
  readonly comment: string | null;
}

/**
 * A row of the `shellTypes` query.
 */
export interface ShellTypeRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;
  readonly comment: string | null;
}

/**
 * A row of the `composites` query. The attributes are rows of the `columns`
 * query whose `relid` is this `relid`.
 */
export interface CompositeRow {
  /**
   * The `pg_type` OID.
   */
  readonly oid: number;

  /**
   * The OID of the type's `pg_class` row (`typrelid`).
   */
  readonly relid: number;
  readonly schema: string;
  readonly name: string;
  readonly comment: string | null;
}

/**
 * A row of the `domains` query. The constraints of the domain are rows of
 * the `constraints` query whose `typid` is this `oid`.
 */
export interface DomainRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;

  /**
   * `format_type(typbasetype, typtypmod)`.
   */
  readonly baseType: string;

  /**
   * `typnotnull`.
   */
  readonly notNull: boolean;

  /**
   * `pg_get_expr(typdefaultbin, 0)`.
   */
  readonly default: string | null;

  /**
   * The collation as SQL, when it is not the base type's default.
   */
  readonly collation: string | null;
  readonly comment: string | null;
}

/**
 * A row of the `ranges` query.
 */
export interface RangeRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;

  /**
   * `format_type(rngsubtype, NULL)`.
   */
  readonly subtype: string;

  /**
   * The operator class as SQL, when it is not the subtype's default.
   */
  readonly subtypeOpclass: string | null;

  /**
   * The collation as SQL, when it is set and not the subtype's default.
   */
  readonly collation: string | null;

  /**
   * `rngcanonical::regproc::text`, when set.
   */
  readonly canonical: string | null;

  /**
   * `rngsubdiff::regproc::text`, when set.
   */
  readonly subtypeDiff: string | null;
  readonly multirangeSchema: string;
  readonly multirangeName: string;
  readonly comment: string | null;
}

/**
 * A row of the `collations` query: collations that are not built in.
 */
export interface CollationRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;
  readonly collprovider: 'c' | 'i' | 'b';
  readonly collisdeterministic: boolean;

  /**
   * The locale of an ICU or builtin collation, whatever the server version
   * stores it in (`colllocale`, `colliculocale` or `collcollate`); null for
   * libc.
   */
  readonly locale: string | null;

  /**
   * `collcollate` of a libc collation; null for the other providers.
   */
  readonly lcCollate: string | null;

  /**
   * `collctype` of a libc collation; null for the other providers.
   */
  readonly lcCtype: string | null;

  /**
   * `collicurules` (always null before PostgreSQL 16).
   */
  readonly rules: string | null;
  readonly comment: string | null;
}

/**
 * The options of a sequence in a row (`pg_sequence`, numbers as text).
 */
export interface SequenceOptionsRow {
  /**
   * `format_type(seqtypid, NULL)`.
   */
  readonly type: string;
  readonly start: string;
  readonly increment: string;
  readonly minValue: string;
  readonly maxValue: string;
  readonly cache: string;
  readonly cycle: boolean;
}

/**
 * A row of the `sequences` query: sequences that are not identity
 * sequences.
 */
export interface SequenceRow extends SequenceOptionsRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;

  /**
   * `relpersistence`.
   */
  readonly relpersistence: 'p' | 'u';

  /**
   * The owning column (`pg_depend.deptype = 'a'` on a table column), when
   * there is one; the three `owner*` fields are all null or all set.
   */
  readonly ownerSchema: string | null;
  readonly ownerTable: string | null;
  readonly ownerColumn: string | null;
  readonly comment: string | null;
}

/**
 * A row of the `functions` query: functions, window functions and
 * procedures.
 */
export interface FunctionRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;
  readonly prokind: 'f' | 'w' | 'p';

  /**
   * `format_type()` of each type of `proallargtypes`, or of `proargtypes`
   * when `proallargtypes` is null.
   */
  readonly argTypes: ReadonlyArray<string>;

  /**
   * `proargnames` (`''` for an unnamed argument), aligned with `argTypes`.
   */
  readonly argNames: ReadonlyArray<string> | null;

  /**
   * `proargmodes` (`i`, `o`, `b`, `v` or `t`), aligned with `argTypes`;
   * null when every argument is `IN`.
   */
  readonly argModes: ReadonlyArray<string> | null;

  /**
   * `pg_get_function_arg_default(oid, n)` for each argument (null when it
   * has no default), aligned with `argTypes`.
   */
  readonly argDefaults: ReadonlyArray<string | null>;

  /**
   * `pg_get_function_identity_arguments(oid)`.
   */
  readonly identityArguments: string;

  /**
   * `pg_get_function_result(oid)`: null for procedures.
   */
  readonly result: string | null;

  /**
   * `pg_language.lanname`.
   */
  readonly language: string;

  /**
   * `prosrc`.
   */
  readonly body: string;

  /**
   * `prosqlbody IS NOT NULL` (always `false` before PostgreSQL 14).
   */
  readonly hasSqlBody: boolean;
  readonly provolatile: 'i' | 's' | 'v';
  readonly proisstrict: boolean;
  readonly prosecdef: boolean;
  readonly proleakproof: boolean;
  readonly proparallel: 's' | 'r' | 'u';
  readonly procost: number;
  readonly prorows: number;
  readonly proretset: boolean;

  /**
   * `proconfig`: `name=value` entries.
   */
  readonly proconfig: ReadonlyArray<string> | null;

  /**
   * `prosupport` as SQL; none when null or left out.
   */
  readonly support?: string | null;

  /**
   * `pg_get_functiondef(oid)`.
   */
  readonly definition: string;
  readonly comment: string | null;
}

/**
 * A row of the `operators` query.
 */
export interface OperatorRow {
  readonly oid: number;
  readonly schema: string;

  /**
   * `oprname`: the operator's symbol.
   */
  readonly name: string;

  /**
   * The `pg_type` schema and name of `oprleft`; null for a prefix operator.
   */
  readonly left: NameRow | null;

  /**
   * The `pg_type` schema and name of `oprright`.
   */
  readonly right: NameRow;

  /**
   * The `pg_proc` schema and name of `oprcode`.
   */
  readonly function: NameRow;

  /**
   * The `pg_operator` schema and name of `oprcom`; null when not set.
   */
  readonly commutator: NameRow | null;

  /**
   * The `pg_operator` schema and name of `oprnegate`; null when not set.
   */
  readonly negator: NameRow | null;

  /**
   * The `pg_proc` schema and name of `oprrest`; null when not set.
   */
  readonly restrict: NameRow | null;

  /**
   * The `pg_proc` schema and name of `oprjoin`; null when not set.
   */
  readonly join: NameRow | null;
  readonly oprcanhash: boolean;
  readonly oprcanmerge: boolean;

  /**
   * `format_type(oprleft, NULL)` (`NONE` when 0), `', '`,
   * `format_type(oprright, NULL)`.
   */
  readonly identityArguments: string;
  readonly comment: string | null;
}

/**
 * A row of the `casts` query: casts that are not built in (`oid >=
 * 16384`).
 */
export interface CastRow {
  readonly oid: number;

  /**
   * `format_type(castsource, NULL)`.
   */
  readonly source: string;

  /**
   * `format_type(casttarget, NULL)`.
   */
  readonly target: string;
  readonly castmethod: 'f' | 'i' | 'b';
  readonly castcontext: 'e' | 'a' | 'i';

  /**
   * The `pg_proc` schema and name of `castfunc`; null when 0.
   */
  readonly function: NameRow | null;

  /**
   * `format_type()` of each type of the function's `proargtypes`; empty
   * without a function.
   */
  readonly functionArguments: ReadonlyArray<string>;
  readonly comment: string | null;
}

/**
 * A row of the `aggregates` query: normal aggregates (`aggkind = 'n'`). The
 * other aggregates are rows of the `unsupported` query. Functions are
 * `regproc::text`, null when not set (`0`).
 */
export interface AggregateRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;

  /**
   * `pg_get_function_identity_arguments(oid)`.
   */
  readonly identityArguments: string;

  /**
   * `format_type()` of each type of `proargtypes`.
   */
  readonly argTypes: ReadonlyArray<string>;
  readonly stateFunction: string;

  /**
   * `format_type(aggtranstype, NULL)`.
   */
  readonly stateType: string;

  /**
   * `aggtransspace`.
   */
  readonly stateSpace: number;
  readonly finalFunction: string | null;
  readonly aggfinalextra: boolean;
  readonly aggfinalmodify: 'r' | 's' | 'w';
  readonly combineFunction: string | null;
  readonly serialFunction: string | null;
  readonly deserialFunction: string | null;

  /**
   * `agginitval`.
   */
  readonly initialCondition: string | null;
  readonly movingStateFunction: string | null;
  readonly movingInverseFunction: string | null;

  /**
   * `format_type(aggmtranstype, NULL)`, when set.
   */
  readonly movingStateType: string | null;

  /**
   * `aggmtransspace`.
   */
  readonly movingStateSpace: number;
  readonly movingFinalFunction: string | null;
  readonly aggmfinalextra: boolean;
  readonly aggmfinalmodify: 'r' | 's' | 'w';

  /**
   * `aggminitval`.
   */
  readonly movingInitialCondition: string | null;

  /**
   * `aggsortop` as SQL (`OPERATOR(schema.op)`), when set.
   */
  readonly sortOperator: string | null;
  readonly proparallel: 's' | 'r' | 'u';
  readonly comment: string | null;
}

/**
 * A row of the `tables` query: tables and partitioned tables that are not
 * temporary. Their columns are rows of the `columns` query.
 */
export interface TableRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;
  readonly relkind: 'r' | 'p';
  readonly relpersistence: 'p' | 'u';
  readonly relispartition: boolean;

  /**
   * `pg_get_partkeydef(oid)`, for a partitioned table.
   */
  readonly partitionKey: string | null;

  /**
   * `pg_get_expr(relpartbound, oid)`, for a partition.
   */
  readonly partitionBound: string | null;

  /**
   * Every parent in `pg_inherits`, in `inhseqno` order: for a partition, its
   * one parent is its partitioned table.
   */
  readonly inherits: ReadonlyArray<NameRow>;

  /**
   * The composite type of a typed table (`reloftype`), null for other
   * tables. The query always has it; rows built without it are of tables
   * that are not typed.
   */
  readonly ofType?: NameRow | null;
  readonly relrowsecurity: boolean;
  readonly relforcerowsecurity: boolean;
  readonly reloptions: ReadonlyArray<string> | null;

  /**
   * `pg_am.amname` (null for a partitioned table without one).
   */
  readonly accessMethod: string | null;
  readonly relreplident: 'd' | 'n' | 'f' | 'i';
  readonly comment: string | null;
}

/**
 * The identity sequence of a column in a row (a JSON object in the query).
 */
export interface IdentitySequenceRow extends SequenceOptionsRow {
  readonly schema: string;
  readonly name: string;

  /**
   * The comment on the sequence (`COMMENT ON SEQUENCE`), `null` without
   * one.
   */
  readonly comment?: string | null;
}

/**
 * A row of the `columns` query: the columns (`attnum > 0`, not dropped) of
 * every table, view, materialized view and composite type of the other
 * queries.
 */
export interface ColumnRow {
  /**
   * `attrelid`: the `oid` of a table or view row, or the `relid` of a
   * composite row.
   */
  readonly relid: number;
  readonly attnum: number;
  readonly name: string;

  /**
   * `format_type(atttypid, atttypmod)`.
   */
  readonly type: string;
  readonly attnotnull: boolean;

  /**
   * `pg_get_expr(adbin, adrelid)`: the default, or the generation expression
   * of a generated column.
   */
  readonly default: string | null;
  readonly attidentity: '' | 'a' | 'd';
  readonly attgenerated: '' | 's' | 'v';

  /**
   * The identity sequence, for an identity column.
   */
  readonly identitySequence: IdentitySequenceRow | null;

  /**
   * The collation as SQL, when it is not the type's default.
   */
  readonly collation: string | null;
  readonly attislocal: boolean;
  readonly attinhcount: number;

  /**
   * `attstattarget`, null when it is not set (-1 or null).
   */
  readonly statisticsTarget: number | null;
  readonly attstorage: 'p' | 'e' | 'm' | 'x';

  /**
   * `typstorage` of the column's type.
   */
  readonly typstorage: 'p' | 'e' | 'm' | 'x';

  /**
   * `attcompression` (`''` when not set; always `''` before PostgreSQL 14).
   */
  readonly attcompression: '' | 'p' | 'l';
  readonly attoptions: ReadonlyArray<string> | null;
  readonly comment: string | null;
}

/**
 * A row of the `constraints` query: constraints of tables (`relid <> 0`)
 * and domains (`typid <> 0`), without constraint triggers (`contype = 't'`)
 * and partition clones (`conparentid <> 0`). `NOT NULL` constraints
 * (`contype = 'n'`) exist from PostgreSQL 18 on for tables and 17 on for
 * domains.
 */
export interface ConstraintRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;

  /**
   * `conrelid`: the `oid` of a table row, or 0.
   */
  readonly relid: number;

  /**
   * `contypid`: the `oid` of a domain row, or 0.
   */
  readonly typid: number;
  readonly contype: 'p' | 'u' | 'c' | 'f' | 'x' | 'n';

  /**
   * `pg_get_constraintdef(oid)`.
   */
  readonly definition: string;

  /**
   * `pg_get_expr(conbin, conrelid)`, for a CHECK constraint.
   */
  readonly checkExpression: string | null;
  readonly condeferrable: boolean;
  readonly condeferred: boolean;
  readonly convalidated: boolean;

  /**
   * `conislocal`: `rowsToModel()` leaves out table constraints that are not
   * local, except `NOT NULL` ones, which it folds into their column.
   */
  readonly conislocal: boolean;
  readonly connoinherit: boolean;

  /**
   * `conkey`: the constrained columns' `attnum`s.
   */
  readonly conkey: ReadonlyArray<number> | null;

  /**
   * `conindid`: the index of a primary key, unique or exclusion constraint,
   * or the referenced index of a foreign key; 0 otherwise.
   */
  readonly conindid: number;

  /**
   * `confrelid`: the referenced table of a foreign key, or 0.
   */
  readonly confrelid: number;
  readonly referencedSchema: string | null;
  readonly referencedTable: string | null;

  /**
   * `indisclustered` of the constraint's own index (`false` without one).
   */
  readonly indexClustered: boolean;

  /**
   * `indisreplident` of the constraint's own index (`false` without one).
   */
  readonly indexReplicaIdentity: boolean;
  readonly comment: string | null;

  /**
   * The comment on the constraint's own index.
   */
  readonly indexComment: string | null;
}

/**
 * A key of an index in a row (a JSON object in the query).
 */
export interface IndexKeyRow {
  /**
   * The column, for a column key (null for an expression).
   */
  readonly column: string | null;

  /**
   * `pg_get_indexdef(oid, n, false)`, for an expression key (null for a
   * column).
   */
  readonly expression: string | null;

  /**
   * The operator class as SQL, when `pg_get_indexdef()` writes it.
   */
  readonly opclass: string | null;

  /**
   * The collation as SQL, when `pg_get_indexdef()` writes it.
   */
  readonly collation: string | null;
  readonly descending: boolean;
  readonly nullsFirst: boolean;

  /**
   * The `attstattarget` of the key's column of the index, when it is set
   * (not -1 and not null); none when null or left out.
   */
  readonly statisticsTarget?: number | null;
}

/**
 * A row of the `indexes` query: indexes that back no constraint and are not
 * partitions of a partitioned index, and that are ready and valid, unless
 * they are indexes of partitioned tables (`relkind = 'I'`), which are kept
 * when they are not valid.
 */
export interface IndexRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;

  /**
   * `indrelid`: the `oid` of a table or materialized view row.
   */
  readonly relid: number;

  /**
   * `pg_get_indexdef(oid)`.
   */
  readonly definition: string;
  readonly indisunique: boolean;
  readonly amname: string;
  readonly keys: ReadonlyArray<IndexKeyRow>;
  readonly include: ReadonlyArray<string>;

  /**
   * `pg_get_expr(indpred, indrelid)`.
   */
  readonly predicate: string | null;

  /**
   * `indnullsnotdistinct` (always `false` before PostgreSQL 15).
   */
  readonly nullsNotDistinct: boolean;
  readonly reloptions: ReadonlyArray<string> | null;
  readonly indisclustered: boolean;
  readonly indisreplident: boolean;
  readonly comment: string | null;

  /**
   * `indisvalid` (only ever `false` for an index of a partitioned table);
   * valid when left out.
   */
  readonly indisvalid?: boolean;
}

/**
 * A row of the `partitionIndexes` query: the indexes of partitions that are
 * attached to an index of their partitioned table (`relispartition`).
 */
export interface PartitionIndexRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;

  /**
   * `indrelid`: the `oid` of the partition's row in the `tables` query.
   */
  readonly relid: number;

  /**
   * `pg_inherits.inhparent`: the index it is attached to, a row of the
   * `indexes` query, the `conindid` of a row of the `constraints` query, or
   * another row of this query.
   */
  readonly parent: number;

  /**
   * The names of the columns of the index, in order.
   */
  readonly columns: ReadonlyArray<string>;

  /**
   * `pg_get_indexdef(oid)`.
   */
  readonly definition: string;

  /**
   * `pg_get_constraintdef()` of the partition's constraint that the index
   * backs, if any.
   */
  readonly constraintDefinition: string | null;

  /**
   * The index's `reloptions`; none when null or left out.
   */
  readonly reloptions?: ReadonlyArray<string> | null;

  /**
   * `indisclustered`; `false` when left out.
   */
  readonly indisclustered?: boolean;

  /**
   * `indisreplident`; `false` when left out.
   */
  readonly indisreplident?: boolean;

  /**
   * The comment on the index; none when null or left out.
   */
  readonly comment?: string | null;
}

/**
 * A row of the `views` query: views and materialized views. Their columns
 * are rows of the `columns` query.
 */
export interface ViewRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;
  readonly relkind: 'v' | 'm';

  /**
   * `pg_get_viewdef(oid)`, with its final `;`.
   */
  readonly definition: string;
  readonly reloptions: ReadonlyArray<string> | null;

  /**
   * `pg_am.amname` (null for a view).
   */
  readonly accessMethod: string | null;
  readonly comment: string | null;
}

/**
 * A row of the `triggers` query: triggers that are not internal and not
 * partition clones.
 */
export interface TriggerRow {
  readonly oid: number;

  /**
   * The schema of the trigger's table.
   */
  readonly schema: string;
  readonly name: string;

  /**
   * `tgrelid`: the `oid` of a table or view row.
   */
  readonly relid: number;

  /**
   * `tgtype` (see `TRIGGER_TYPE` in `core/model.ts`).
   */
  readonly tgtype: number;
  readonly tgenabled: 'O' | 'D' | 'R' | 'A';
  readonly functionSchema: string;
  readonly functionName: string;

  /**
   * `tgargs`: each argument followed by a zero byte (node-postgres returns a
   * `Buffer`).
   */
  readonly tgargs: Uint8Array;

  /**
   * The names of the `tgattr` columns, in order.
   */
  readonly updateOf: ReadonlyArray<string>;

  /**
   * `tgqual IS NOT NULL`: `definition` has a `WHEN (…)` clause.
   */
  readonly hasCondition: boolean;

  /**
   * `tgconstraint <> 0`.
   */
  readonly isConstraint: boolean;
  readonly tgdeferrable: boolean;
  readonly tginitdeferred: boolean;
  readonly tgoldtable: string | null;
  readonly tgnewtable: string | null;

  /**
   * `pg_get_triggerdef(oid)`.
   */
  readonly definition: string;
  readonly comment: string | null;
}

/**
 * A row of the `partitionTriggers` query: the clones of triggers on
 * partitions (`tgparentid <> 0`), whatever `tgisinternal` says.
 */
export interface PartitionTriggerRow {
  readonly oid: number;

  /**
   * `tgrelid`: the `oid` of the partition's row in the `tables` query.
   */
  readonly relid: number;

  /**
   * `tgparentid`: the trigger it is a clone of, a row of the `triggers`
   * query or another row of this query.
   */
  readonly parent: number;
  readonly tgenabled: 'O' | 'D' | 'R' | 'A';
  readonly comment: string | null;
}

/**
 * A row of the `policies` query.
 */
export interface PolicyRow {
  readonly oid: number;

  /**
   * The schema of the policy's table.
   */
  readonly schema: string;
  readonly name: string;

  /**
   * `polrelid`: the `oid` of a table row.
   */
  readonly relid: number;
  readonly polcmd: '*' | 'r' | 'a' | 'w' | 'd';
  readonly polpermissive: boolean;

  /**
   * The role names of `polroles`, `'PUBLIC'` for 0.
   */
  readonly roles: ReadonlyArray<string>;

  /**
   * `pg_get_expr(polqual, polrelid)`.
   */
  readonly using: string | null;

  /**
   * `pg_get_expr(polwithcheck, polrelid)`.
   */
  readonly check: string | null;
  readonly comment: string | null;
}

/**
 * A row of the `rules` query: rules other than `_RETURN`.
 */
export interface RuleRow {
  readonly oid: number;

  /**
   * The schema of the rule's table or view.
   */
  readonly schema: string;
  readonly name: string;

  /**
   * `ev_class`: the `oid` of a table or view row.
   */
  readonly relid: number;

  /**
   * `ev_enabled`.
   */
  readonly enabled: 'O' | 'D' | 'R' | 'A';

  /**
   * `pg_get_ruledef(oid)`.
   */
  readonly definition: string;
  readonly comment: string | null;
}

/**
 * A row of the `statistics` query.
 */
export interface StatisticsRow {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;

  /**
   * `stxrelid`: the `oid` of a table row.
   */
  readonly relid: number;

  /**
   * `pg_get_statisticsobjdef(oid)`.
   */
  readonly definition: string;

  /**
   * `stxstattarget`, null when it is not set (-1 or null).
   */
  readonly statisticsTarget: number | null;
  readonly comment: string | null;
}

/**
 * A row of the `dependencies` query: a `pg_depend` row of type `n`, `a` or
 * `i` whose objects the query already mapped to the objects the model has:
 *
 * - `pg_attrdef` (a default) → the `pg_class` row of its table or view;
 * - `pg_rewrite` of a view's `_RETURN` rule → the `pg_class` row of the view;
 * - `pg_constraint` of a domain → the domain's `pg_type` row;
 * - `pg_class` of a constraint's index → the `pg_constraint` row;
 * - `pg_class` of a composite type (`relkind = 'c'`) → its `pg_type` row;
 * - `pg_type` of an array → its element type, of a table's or view's row type
 *   → the `pg_class` row, of a multirange → its range type;
 * - a member of an extension → the `pg_extension` row;
 * - sub-objects (columns) → their object (sub-ids are dropped).
 *
 * Catalogs are the `regclass` text of `classid` / `refclassid`, e.g.
 * `'pg_class'`, `'pg_proc'`, `'pg_collation'`, `'pg_operator'` or
 * `'pg_cast'`. Rows whose objects are not in the model are ignored by
 * `rowsToModel()`.
 */
export interface DependencyRow {
  readonly classid: string;
  readonly objid: number;
  readonly refclassid: string;
  readonly refobjid: number;
  readonly deptype: 'n' | 'a' | 'i';
}

/**
 * A row of the `unsupported` query: objects of the kinds that `--format
 * ts|js` cannot represent that are not members of an extension.
 */
export interface UnsupportedRow {
  readonly kind: UnsupportedKind;

  /**
   * The object's schema, null for objects that have none (languages, event
   * triggers, foreign data wrappers, …), which are always in scope.
   */
  readonly schema: string | null;

  /**
   * `pg_identify_object(…).identity`.
   */
  readonly identity: string;
}

/**
 * What the introspection queries return, one array of rows per query of
 * `io/queries.ts` (the keys are the query names).
 *
 * Every query reads the objects of every schema but the system ones
 * (`pg_catalog`, `information_schema`, `pg_toast*`, `pg_temp*`) and leaves
 * out members of extensions (`pg_depend.deptype = 'e'`) and derived objects
 * (see each row type). `rowsToModel()` applies `includeSchemas` /
 * `excludeSchemas` and leaves out the migrations table.
 */
export interface CatalogRows {
  readonly schemas: ReadonlyArray<SchemaRow>;
  readonly extensions: ReadonlyArray<ExtensionRow>;
  readonly enums: ReadonlyArray<EnumRow>;

  /**
   * The shell types (none when left out).
   */
  readonly shellTypes?: ReadonlyArray<ShellTypeRow>;
  readonly composites: ReadonlyArray<CompositeRow>;
  readonly domains: ReadonlyArray<DomainRow>;
  readonly ranges: ReadonlyArray<RangeRow>;
  readonly collations: ReadonlyArray<CollationRow>;
  readonly sequences: ReadonlyArray<SequenceRow>;
  readonly functions: ReadonlyArray<FunctionRow>;
  readonly operators: ReadonlyArray<OperatorRow>;
  readonly casts: ReadonlyArray<CastRow>;
  readonly aggregates: ReadonlyArray<AggregateRow>;
  readonly tables: ReadonlyArray<TableRow>;
  readonly columns: ReadonlyArray<ColumnRow>;
  readonly constraints: ReadonlyArray<ConstraintRow>;
  readonly indexes: ReadonlyArray<IndexRow>;

  /**
   * The indexes of partitions attached to the indexes of their partitioned
   * tables (none when left out).
   */
  readonly partitionIndexes?: ReadonlyArray<PartitionIndexRow>;
  readonly views: ReadonlyArray<ViewRow>;
  readonly triggers: ReadonlyArray<TriggerRow>;

  /**
   * The clones of triggers on partitions (none when left out).
   */
  readonly partitionTriggers?: ReadonlyArray<PartitionTriggerRow>;
  readonly policies: ReadonlyArray<PolicyRow>;
  readonly rules: ReadonlyArray<RuleRow>;
  readonly statistics: ReadonlyArray<StatisticsRow>;
  readonly dependencies: ReadonlyArray<DependencyRow>;
  readonly unsupported: ReadonlyArray<UnsupportedRow>;
}
