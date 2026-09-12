import type {
  Aggregate,
  AggregateRow,
  Cast,
  CastRow,
  CatalogRows,
  Collation,
  CollationRow,
  Column,
  ColumnGenerated,
  ColumnIdentity,
  ColumnInheritance,
  ColumnRow,
  CompositeAttribute,
  CompositeRow,
  CompositeType,
  Constraint,
  ConstraintRow,
  Dependency,
  DomainCheck,
  DomainRow,
  DomainType,
  EnumRow,
  EnumType,
  Extension,
  ExtensionRow,
  FiringMode,
  FunctionRow,
  Index,
  IndexKey,
  IndexKeyRow,
  IndexRow,
  IntrospectOptions,
  MaterializedView,
  MovingAggregate,
  NameRow,
  NotNullConstraint,
  ObjectKind,
  ObjectRef,
  Operator,
  OperatorRow,
  OwnedSequence,
  Policy,
  PolicyRow,
  RangeRow,
  RangeType,
  Routine,
  RoutineArgument,
  Rule,
  RuleRow,
  Schema,
  SchemaModel,
  SchemaQualifiedName,
  SchemaRow,
  Sequence,
  SequenceOptions,
  SequenceOptionsRow,
  SequenceOwner,
  SequenceRow,
  Statistics,
  StatisticsRow,
  Table,
  TableRow,
  Trigger,
  TriggerEvent,
  TriggerRow,
  UnsupportedObject,
  View,
  ViewColumn,
  ViewRow,
} from '../types';
import { catalogDependencies, finishDependencies, refOf } from './dependencies';
import { compareText, oidKey, sortByKey } from './sort';
import {
  splitSetting,
  triggerArguments,
  triggerCondition,
  withoutFinalSemicolon,
} from './text';

/**
 * The comment of the `public` schema in a new database. `rowsToModel()`
 * only keeps `public` when its comment is something else.
 */
export const DEFAULT_PUBLIC_SCHEMA_COMMENT = 'standard public schema';

/**
 * The bits of `pg_trigger.tgtype` (`TRIGGER_TYPE_*` in PostgreSQL's
 * `pg_trigger.h`). A trigger that is neither `BEFORE` nor `INSTEAD` fires
 * `AFTER`; one without `ROW` fires `FOR EACH STATEMENT`.
 */
export const TRIGGER_TYPE = {
  ROW: 1,
  BEFORE: 2,
  INSERT: 4,
  DELETE: 8,
  UPDATE: 16,
  TRUNCATE: 32,
  INSTEAD: 64,
} as const;

// What the catalog codes mean (see the model's types).

const PROVIDERS: Readonly<
  Record<CollationRow['collprovider'], Collation['provider']>
> = { c: 'libc', i: 'icu', b: 'builtin' };

const ROUTINE_KINDS: Readonly<
  Record<FunctionRow['prokind'], Routine['routineKind']>
> = { f: 'function', w: 'window', p: 'procedure' };

/**
 * `proargmodes` codes; `t` (a column of `RETURNS TABLE`) is not an argument.
 */
const ARGUMENT_MODES: ReadonlyMap<string, RoutineArgument['mode']> = new Map([
  ['i', 'IN'],
  ['o', 'OUT'],
  ['b', 'INOUT'],
  ['v', 'VARIADIC'],
]);

const VOLATILITIES: Readonly<
  Record<FunctionRow['provolatile'], Routine['volatility']>
> = { i: 'IMMUTABLE', s: 'STABLE', v: 'VOLATILE' };

const PARALLEL_SAFETY: Readonly<
  Record<FunctionRow['proparallel'], Routine['parallel']>
> = { s: 'SAFE', r: 'RESTRICTED', u: 'UNSAFE' };

const CAST_METHODS: Readonly<Record<CastRow['castmethod'], Cast['method']>> = {
  f: 'function',
  i: 'inout',
  b: 'binary',
};

const CAST_CONTEXTS: Readonly<Record<CastRow['castcontext'], Cast['context']>> =
  { e: 'EXPLICIT', a: 'ASSIGNMENT', i: 'IMPLICIT' };

const FINAL_FUNCTION_MODIFY: Readonly<
  Record<AggregateRow['aggfinalmodify'], Aggregate['finalFunctionModify']>
> = { r: 'READ_ONLY', s: 'SHAREABLE', w: 'READ_WRITE' };

const REPLICA_IDENTITIES: Readonly<
  Record<TableRow['relreplident'], Table['replicaIdentity']>
> = { d: 'DEFAULT', n: 'NOTHING', f: 'FULL', i: 'INDEX' };

const IDENTITY_GENERATIONS: Readonly<
  Record<'a' | 'd', ColumnIdentity['generation']>
> = { a: 'ALWAYS', d: 'BY DEFAULT' };

const GENERATED_STORAGES: Readonly<
  Record<'s' | 'v', ColumnGenerated['storage']>
> = { s: 'STORED', v: 'VIRTUAL' };

const STORAGES: Readonly<
  Record<ColumnRow['attstorage'], NonNullable<Column['storage']>>
> = { p: 'PLAIN', e: 'EXTERNAL', m: 'MAIN', x: 'EXTENDED' };

const COMPRESSIONS: Readonly<
  Record<ColumnRow['attcompression'], Column['compression'] | null>
> = { '': null, p: 'pglz', l: 'lz4' };

/**
 * `contype` codes of the constraints of the model; `n` rows are folded into
 * their column or domain instead.
 */
const CONSTRAINT_TYPES: Readonly<
  Record<ConstraintRow['contype'], Constraint['type'] | null>
> = {
  p: 'primaryKey',
  u: 'unique',
  c: 'check',
  f: 'foreignKey',
  x: 'exclusion',
  n: null,
};

const FIRING_MODES: Readonly<Record<TriggerRow['tgenabled'], FiringMode>> = {
  O: 'ORIGIN',
  D: 'DISABLED',
  R: 'REPLICA',
  A: 'ALWAYS',
};

const POLICY_COMMANDS: Readonly<
  Record<PolicyRow['polcmd'], Policy['command']>
> = { '*': 'ALL', r: 'SELECT', a: 'INSERT', w: 'UPDATE', d: 'DELETE' };

/**
 * The events of a trigger, in the order `pg_get_triggerdef()` writes them,
 * with their `tgtype` bits.
 */
const TRIGGER_EVENTS: ReadonlyArray<readonly [TriggerEvent, number]> = [
  ['INSERT', TRIGGER_TYPE.INSERT],
  ['DELETE', TRIGGER_TYPE.DELETE],
  ['UPDATE', TRIGGER_TYPE.UPDATE],
  ['TRUNCATE', TRIGGER_TYPE.TRUNCATE],
];

/**
 * An object with a name, as far as sorting is concerned.
 */
interface Sortable {
  readonly oid: number;
  readonly schema: string;
  readonly name: string;
  readonly table?: SchemaQualifiedName;
  readonly identityArguments?: string;
}

/**
 * A table, view or materialized view of the model, which other objects
 * (columns, constraints, indexes, triggers, …) belong to.
 */
interface Relation {
  readonly ref: ObjectRef;
  readonly name: SchemaQualifiedName;
}

/**
 * The `NOT NULL` constraint of a table column (PostgreSQL 18).
 */
interface NotNullRow {
  /**
   * The constraint, as the column has it.
   */
  readonly constraint: NotNullConstraint;

  /**
   * Whether the table declares it itself (`conislocal`).
   */
  readonly local: boolean;
}

/**
 * The rows of the `constraints` query, by what they become.
 */
interface ConstraintRows {
  /**
   * The constraints of each domain, by the domain's OID.
   */
  readonly byDomain: ReadonlyMap<number, ReadonlyArray<ConstraintRow>>;

  /**
   * The `NOT NULL` constraints of table columns, by `<relid>:<attnum>`.
   */
  readonly notNull: ReadonlyMap<string, NotNullRow>;

  /**
   * The other constraints of tables.
   */
  readonly tables: ReadonlyArray<ConstraintRow>;
}

/**
 * A field that is only there when the catalog has a value for it.
 *
 * @param key The name of the field.
 * @param value The value; `null` and `undefined` leave the field out.
 * @returns An object to spread into the object that has the field.
 */
function optional<K extends string, V>(
  key: K,
  value: V | null | undefined
): Partial<Record<K, V>> {
  const field: Partial<Record<K, V>> = {};
  if (value != null) {
    field[key] = value;
  }

  return field;
}

/**
 * A schema-qualified name from a name in a row.
 *
 * @param row The name in the row.
 * @returns The name.
 */
function qualifiedName(row: NameRow): SchemaQualifiedName {
  return { schema: row.schema, name: row.name };
}

/**
 * A name of a row that is only there when it is set (see {@link optional}).
 *
 * @param key The name of the field.
 * @param row The name in the row, or `null`.
 * @returns An object to spread into the object that has the field.
 */
function optionalName<K extends string>(
  key: K,
  row: NameRow | null
): Partial<Record<K, SchemaQualifiedName>> {
  return optional(key, row === null ? null : qualifiedName(row));
}

/**
 * The fields that every object of a schema has.
 *
 * @param kind The kind of the object.
 * @param row Its row.
 * @returns `kind`, `oid`, `schema`, `name` and `comment`.
 */
function catalogObject<K extends ObjectKind>(
  kind: K,
  row: {
    readonly oid: number;
    readonly schema: string;
    readonly name: string;
    readonly comment: string | null;
  }
): {
  readonly kind: K;
  readonly oid: number;
  readonly schema: string;
  readonly name: string;
  readonly comment?: string;
} {
  return {
    kind,
    oid: row.oid,
    schema: row.schema,
    name: row.name,
    ...optional('comment', row.comment),
  };
}

/**
 * The sort key of an object of a schema (see `SchemaModel`): schema, name,
 * table, identity arguments, and the OID so that the order never depends on
 * the order of the rows.
 *
 * @param object The object.
 * @returns The key.
 */
function objectKey(object: Sortable): string[] {
  return [
    object.schema,
    object.name,
    object.table?.schema ?? '',
    object.table?.name ?? '',
    object.identityArguments ?? '',
    oidKey(object.oid),
  ];
}

/**
 * Sorts objects of a schema by {@link objectKey}.
 *
 * @param objects The objects.
 * @returns A sorted copy.
 */
function sortObjects<T extends Sortable>(objects: ReadonlyArray<T>): T[] {
  return sortByKey(objects, objectKey);
}

/**
 * Groups rows by a number.
 *
 * @param rows The rows.
 * @param key The number of a row.
 * @returns The rows of each number, in their order.
 */
function groupBy<T>(
  rows: ReadonlyArray<T>,
  key: (row: T) => number
): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group === undefined) {
      groups.set(key(row), [row]);
    } else {
      group.push(row);
    }
  }

  return groups;
}

/**
 * Whether objects of a schema are in scope.
 *
 * @param facts Which schemas are in scope.
 * @returns A function that tells whether a schema is in scope.
 */
function scopeOf(facts: IntrospectOptions): (schema: string) => boolean {
  const { includeSchemas, excludeSchemas = [] } = facts;

  return (schema) =>
    (includeSchemas === undefined || includeSchemas.includes(schema)) &&
    !excludeSchemas.includes(schema);
}

/**
 * The key of a column, for the maps of owned sequences.
 *
 * @param schema The schema of the table.
 * @param table The table.
 * @param column The column.
 * @returns The key.
 */
function columnKey(schema: string, table: string, column: string): string {
  return JSON.stringify([schema, table, column]);
}

/**
 * The key of a schema-qualified name, for maps by name.
 *
 * @param name The name.
 * @returns The key.
 */
function nameKey(name: SchemaQualifiedName): string {
  return JSON.stringify([name.schema, name.name]);
}

function schemaOf(row: SchemaRow): Schema {
  return {
    kind: 'schema',
    oid: row.oid,
    schema: row.name,
    name: row.name,
    ...optional('comment', row.comment),
  };
}

function extensionOf(row: ExtensionRow): Extension {
  return {
    kind: 'extension',
    oid: row.oid,
    schema: row.schema,
    name: row.name,
    version: row.version,
  };
}

function enumOf(row: EnumRow): EnumType {
  return { ...catalogObject('enum', row), labels: row.labels };
}

function compositeAttributeOf(row: ColumnRow): CompositeAttribute {
  return {
    name: row.name,
    type: row.type,
    ...optional('collation', row.collation),
    ...optional('comment', row.comment),
  };
}

function compositeOf(
  row: CompositeRow,
  columns: ReadonlyArray<ColumnRow>
): CompositeType {
  return {
    ...catalogObject('composite', row),
    attributes: columns.map(compositeAttributeOf),
  };
}

function domainOf(
  row: DomainRow,
  constraints: ReadonlyArray<ConstraintRow>
): DomainType {
  const notNull = constraints.find(({ contype }) => contype === 'n');
  const checks = constraints.flatMap((constraint): DomainCheck[] =>
    constraint.contype === 'c' && constraint.checkExpression !== null
      ? [
          {
            name: constraint.name,
            expression: constraint.checkExpression,
            validated: constraint.convalidated,
            ...optional('comment', constraint.comment),
          },
        ]
      : []
  );

  return {
    ...catalogObject('domain', row),
    baseType: row.baseType,
    notNull: row.notNull,
    ...optional('notNullConstraintName', notNull?.name),
    ...optional('default', row.default),
    ...optional('collation', row.collation),
    checks: sortByKey(checks, ({ name }) => [name]),
  };
}

function rangeOf(row: RangeRow): RangeType {
  return {
    ...catalogObject('range', row),
    subtype: row.subtype,
    ...optional('subtypeOpclass', row.subtypeOpclass),
    ...optional('collation', row.collation),
    ...optional('canonical', row.canonical),
    ...optional('subtypeDiff', row.subtypeDiff),
    multirange: { schema: row.multirangeSchema, name: row.multirangeName },
  };
}

function collationOf(row: CollationRow): Collation {
  return {
    ...catalogObject('collation', row),
    provider: PROVIDERS[row.collprovider],
    deterministic: row.collisdeterministic,
    ...optional('locale', row.locale),
    ...optional('lcCollate', row.lcCollate),
    ...optional('lcCtype', row.lcCtype),
    ...optional('rules', row.rules),
  };
}

function sequenceOptionsOf(row: SequenceOptionsRow): SequenceOptions {
  return {
    type: row.type,
    start: row.start,
    increment: row.increment,
    minValue: row.minValue,
    maxValue: row.maxValue,
    cache: row.cache,
    cycle: row.cycle,
  };
}

function sequenceOwnerOf(row: SequenceRow): SequenceOwner | undefined {
  const { ownerSchema, ownerTable, ownerColumn } = row;
  if (ownerSchema === null || ownerTable === null || ownerColumn === null) {
    return undefined;
  }

  return {
    table: { schema: ownerSchema, name: ownerTable },
    column: ownerColumn,
  };
}

function sequenceOf(row: SequenceRow): Sequence {
  return {
    ...catalogObject('sequence', row),
    ...sequenceOptionsOf(row),
    unlogged: row.relpersistence === 'u',
    ...optional('ownedBy', sequenceOwnerOf(row)),
  };
}

function routineArgumentsOf(row: FunctionRow): RoutineArgument[] {
  return row.argTypes.flatMap((type, index): RoutineArgument[] => {
    const mode = ARGUMENT_MODES.get(row.argModes?.[index] ?? 'i');
    if (mode === undefined) {
      return [];
    }

    const name = row.argNames?.[index];

    return [
      {
        mode,
        ...optional('name', name === '' ? null : name),
        type,
        ...optional('default', row.argDefaults[index]),
      },
    ];
  });
}

function routineOf(row: FunctionRow): Routine {
  return {
    ...catalogObject('function', row),
    routineKind: ROUTINE_KINDS[row.prokind],
    arguments: routineArgumentsOf(row),
    identityArguments: row.identityArguments,
    ...optional('returns', row.result),
    returnsSet: row.proretset,
    language: row.language,
    body: row.body,
    hasSqlBody: row.hasSqlBody,
    volatility: VOLATILITIES[row.provolatile],
    strict: row.proisstrict,
    securityDefiner: row.prosecdef,
    leakproof: row.proleakproof,
    parallel: PARALLEL_SAFETY[row.proparallel],
    cost: row.procost,
    rows: row.prorows,
    config: (row.proconfig ?? []).map(splitSetting),
    definition: row.definition,
  };
}

function operatorOf(row: OperatorRow): Operator {
  return {
    ...catalogObject('operator', row),
    ...optionalName('left', row.left),
    right: qualifiedName(row.right),
    function: qualifiedName(row.function),
    ...optionalName('commutator', row.commutator),
    ...optionalName('negator', row.negator),
    ...optionalName('restrict', row.restrict),
    ...optionalName('join', row.join),
    hashes: row.oprcanhash,
    merges: row.oprcanmerge,
    identityArguments: row.identityArguments,
  };
}

function castOf(row: CastRow): Cast {
  return {
    kind: 'cast',
    oid: row.oid,
    ...optional('comment', row.comment),
    source: row.source,
    target: row.target,
    method: CAST_METHODS[row.castmethod],
    ...optionalName('function', row.function),
    functionArguments: row.functionArguments,
    context: CAST_CONTEXTS[row.castcontext],
  };
}

function movingAggregateOf(row: AggregateRow): MovingAggregate | undefined {
  const { movingStateFunction, movingInverseFunction, movingStateType } = row;
  if (
    movingStateFunction === null ||
    movingInverseFunction === null ||
    movingStateType === null
  ) {
    return undefined;
  }

  return {
    stateFunction: movingStateFunction,
    inverseFunction: movingInverseFunction,
    stateType: movingStateType,
    ...optional(
      'stateSpace',
      row.movingStateSpace === 0 ? null : row.movingStateSpace
    ),
    ...optional('finalFunction', row.movingFinalFunction),
    finalFunctionExtra: row.aggmfinalextra,
    finalFunctionModify: FINAL_FUNCTION_MODIFY[row.aggmfinalmodify],
    ...optional('initialCondition', row.movingInitialCondition),
  };
}

function aggregateOf(row: AggregateRow): Aggregate {
  return {
    ...catalogObject('aggregate', row),
    identityArguments: row.identityArguments,
    argumentTypes: row.argTypes,
    stateFunction: row.stateFunction,
    stateType: row.stateType,
    ...optional('stateSpace', row.stateSpace === 0 ? null : row.stateSpace),
    ...optional('finalFunction', row.finalFunction),
    finalFunctionExtra: row.aggfinalextra,
    finalFunctionModify: FINAL_FUNCTION_MODIFY[row.aggfinalmodify],
    ...optional('combineFunction', row.combineFunction),
    ...optional('serialFunction', row.serialFunction),
    ...optional('deserialFunction', row.deserialFunction),
    ...optional('initialCondition', row.initialCondition),
    ...optional('moving', movingAggregateOf(row)),
    ...optional('sortOperator', row.sortOperator),
    parallel: PARALLEL_SAFETY[row.proparallel],
  };
}

function identityOf(row: ColumnRow): Pick<Column, 'identity'> {
  const { attidentity, identitySequence } = row;
  if (attidentity === '' || identitySequence === null) {
    return {};
  }

  return {
    identity: {
      generation: IDENTITY_GENERATIONS[attidentity],
      sequence: qualifiedName(identitySequence),
      options: sequenceOptionsOf(identitySequence),
      ...optional('comment', identitySequence.comment),
    },
  };
}

function generatedOf(row: ColumnRow): Pick<Column, 'generated'> {
  const { attgenerated, default: expression } = row;
  if (attgenerated === '' || expression === null) {
    return {};
  }

  return {
    generated: { storage: GENERATED_STORAGES[attgenerated], expression },
  };
}

/**
 * The default of a column, as the model has it: generated columns have none
 * (their expression is `generated.expression`).
 *
 * @param row The column.
 * @returns The default, or `null`.
 */
function defaultOf(row: ColumnRow): string | null {
  return row.attgenerated === '' ? row.default : null;
}

/**
 * What a column gets from the columns of its table's parents (see
 * `ColumnInheritance`).
 *
 * @param row The column.
 * @param parents The columns of each parent of its table, in `inherits`
 * order, with the parent's OID; `undefined` when a parent is not among the
 * tables of the rows.
 * @param notNull The `NOT NULL` constraints of table columns, by
 * `<relid>:<attnum>`.
 * @returns What the column gets, or `undefined` when it inherits nothing
 * that the rows show.
 */
function columnInheritance(
  row: ColumnRow,
  parents:
    | ReadonlyArray<{
        readonly oid: number;
        readonly columns: ReadonlyArray<ColumnRow>;
      }>
    | undefined,
  notNull: ReadonlyMap<string, NotNullRow>
): ColumnInheritance | undefined {
  if (row.attinhcount === 0 || parents === undefined) {
    return undefined;
  }

  const inherited = parents.flatMap(({ oid, columns }) =>
    columns
      .filter((column) => column.name === row.name)
      .map((column) => ({ oid, column }))
  );
  if (inherited.length === 0) {
    return undefined;
  }

  const parentDefault = inherited
    .map(({ column }) => defaultOf(column))
    .find((expression) => expression !== null);
  const parentNotNull = inherited.some(
    ({ oid, column }) =>
      column.attnotnull &&
      notNull.get(`${oid}:${column.attnum}`)?.constraint.noInherit !== true
  );

  return {
    ...optional('parentDefault', parentDefault),
    parentNotNull,
    ...optional(
      'localNotNull',
      notNull.get(`${row.relid}:${row.attnum}`)?.local
    ),
  };
}

function columnOf(
  row: ColumnRow,
  notNullConstraint: NotNullConstraint | undefined,
  ownedSequence: OwnedSequence | undefined,
  inheritance?: ColumnInheritance
): Column {
  return {
    name: row.name,
    type: row.type,
    notNull: row.attnotnull,
    ...optional('notNullConstraint', notNullConstraint),
    ...optional('default', defaultOf(row)),
    ...identityOf(row),
    ...generatedOf(row),
    ...optional('ownedSequence', ownedSequence),
    ...optional('collation', row.collation),
    ...optional('comment', row.comment),
    local: row.attislocal,
    inheritCount: row.attinhcount,
    ...optional('inheritance', inheritance),
    ...optional('statisticsTarget', row.statisticsTarget),
    ...optional(
      'storage',
      row.attstorage === row.typstorage ? null : STORAGES[row.attstorage]
    ),
    ...optional('compression', COMPRESSIONS[row.attcompression]),
    options: row.attoptions ?? [],
  };
}

function partitionOfTable(row: TableRow): Pick<Table, 'partitionOf'> {
  const parent = row.inherits.at(0);
  if (
    !row.relispartition ||
    parent === undefined ||
    row.partitionBound === null
  ) {
    return {};
  }

  return {
    partitionOf: { parent: qualifiedName(parent), bound: row.partitionBound },
  };
}

function tableOf(row: TableRow, columns: ReadonlyArray<Column>): Table {
  return {
    ...catalogObject('table', row),
    partitioned: row.relkind === 'p',
    unlogged: row.relpersistence === 'u',
    columns,
    ...optional('partitionKey', row.partitionKey),
    ...partitionOfTable(row),
    inherits: row.relispartition ? [] : row.inherits.map(qualifiedName),
    rowLevelSecurity: row.relrowsecurity,
    forceRowLevelSecurity: row.relforcerowsecurity,
    options: row.reloptions ?? [],
    ...optional(
      'accessMethod',
      row.accessMethod === 'heap' ? null : row.accessMethod
    ),
    replicaIdentity: REPLICA_IDENTITIES[row.relreplident],
  };
}

function constraintOf(
  row: ConstraintRow,
  type: Constraint['type'],
  table: SchemaQualifiedName
): Constraint {
  const { referencedSchema, referencedTable } = row;

  return {
    ...catalogObject('constraint', row),
    table,
    type,
    definition: row.definition,
    deferrable: row.condeferrable,
    deferred: row.condeferred,
    validated: row.convalidated,
    ...optional(
      'references',
      referencedSchema === null || referencedTable === null
        ? null
        : { schema: referencedSchema, name: referencedTable }
    ),
    clustered: row.indexClustered,
    replicaIdentity: row.indexReplicaIdentity,
    ...optional('indexComment', row.indexComment),
  };
}

function indexKeyOf(row: IndexKeyRow): IndexKey {
  const settings = {
    ...optional('opclass', row.opclass),
    ...optional('collation', row.collation),
    descending: row.descending,
    nullsFirst: row.nullsFirst,
  };

  return row.column === null
    ? { expression: row.expression ?? '', ...settings }
    : { column: row.column, ...settings };
}

function indexOf(row: IndexRow, table: SchemaQualifiedName): Index {
  return {
    ...catalogObject('index', row),
    table,
    definition: row.definition,
    unique: row.indisunique,
    method: row.amname,
    keys: row.keys.map(indexKeyOf),
    include: row.include,
    ...optional('predicate', row.predicate),
    nullsNotDistinct: row.nullsNotDistinct,
    options: row.reloptions ?? [],
    clustered: row.indisclustered,
    replicaIdentity: row.indisreplident,
  };
}

function viewColumnOf(row: ColumnRow): ViewColumn {
  return {
    name: row.name,
    ...optional('default', row.default),
    ...optional('comment', row.comment),
  };
}

/**
 * The `reloptions` entry of a view that holds its check option.
 */
const CHECK_OPTION = 'check_option=';

/**
 * The check option of a view, from its `reloptions`.
 *
 * @param options The `reloptions` of the view.
 * @returns `WITH CASCADED|LOCAL CHECK OPTION`, when it has one.
 */
function checkOptionOf(
  options: ReadonlyArray<string>
): View['checkOption'] | undefined {
  const option = options.find((entry) => entry.startsWith(CHECK_OPTION));
  if (option === undefined) {
    return undefined;
  }

  return option === `${CHECK_OPTION}cascaded` ? 'CASCADED' : 'LOCAL';
}

function viewOf(row: ViewRow, columns: ReadonlyArray<ColumnRow>): View {
  const options = row.reloptions ?? [];

  return {
    ...catalogObject('view', row),
    definition: withoutFinalSemicolon(row.definition),
    ...optional('checkOption', checkOptionOf(options)),
    options: options.filter((option) => !option.startsWith(CHECK_OPTION)),
    columns: columns.map(viewColumnOf),
  };
}

function materializedViewOf(
  row: ViewRow,
  columns: ReadonlyArray<ColumnRow>
): MaterializedView {
  return {
    ...catalogObject('materializedView', row),
    definition: withoutFinalSemicolon(row.definition),
    options: row.reloptions ?? [],
    ...optional(
      'accessMethod',
      row.accessMethod === 'heap' ? null : row.accessMethod
    ),
    columns: columns.map(viewColumnOf),
  };
}

function triggerTiming(tgtype: number): Trigger['timing'] {
  if ((tgtype & TRIGGER_TYPE.BEFORE) !== 0) {
    return 'BEFORE';
  }

  return (tgtype & TRIGGER_TYPE.INSTEAD) === 0 ? 'AFTER' : 'INSTEAD OF';
}

function triggerOf(row: TriggerRow, table: SchemaQualifiedName): Trigger {
  return {
    ...catalogObject('trigger', row),
    table,
    timing: triggerTiming(row.tgtype),
    events: TRIGGER_EVENTS.filter(([, bit]) => (row.tgtype & bit) !== 0).map(
      ([event]) => event
    ),
    updateOf: row.updateOf,
    level: (row.tgtype & TRIGGER_TYPE.ROW) === 0 ? 'STATEMENT' : 'ROW',
    function: { schema: row.functionSchema, name: row.functionName },
    args: triggerArguments(row.tgargs),
    ...optional(
      'condition',
      row.hasCondition ? triggerCondition(row.definition) : null
    ),
    constraint: row.isConstraint,
    deferrable: row.tgdeferrable,
    deferred: row.tginitdeferred,
    ...optional('oldTable', row.tgoldtable),
    ...optional('newTable', row.tgnewtable),
    enabled: FIRING_MODES[row.tgenabled],
    definition: row.definition,
  };
}

function policyOf(row: PolicyRow, table: SchemaQualifiedName): Policy {
  return {
    ...catalogObject('policy', row),
    table,
    command: POLICY_COMMANDS[row.polcmd],
    permissive: row.polpermissive,
    roles: row.roles.toSorted(compareText),
    ...optional('using', row.using),
    ...optional('check', row.check),
  };
}

function ruleOf(row: RuleRow, table: SchemaQualifiedName): Rule {
  return {
    ...catalogObject('rule', row),
    table,
    enabled: FIRING_MODES[row.enabled],
    definition: row.definition,
  };
}

function statisticsOf(
  row: StatisticsRow,
  table: SchemaQualifiedName
): Statistics {
  return {
    ...catalogObject('statistics', row),
    table,
    definition: row.definition,
    ...optional('statisticsTarget', row.statisticsTarget),
  };
}

/**
 * Sorts the rows of the `constraints` query by what they become.
 *
 * @param rows The rows.
 * @returns The rows of domains, the NOT NULL constraints of columns and the
 * other table constraints.
 */
function splitConstraints(rows: ReadonlyArray<ConstraintRow>): ConstraintRows {
  const domainRows: ConstraintRow[] = [];
  const notNull = new Map<string, NotNullRow>();
  const tables: ConstraintRow[] = [];
  for (const row of rows) {
    const attnum = row.conkey?.at(0);
    if (row.typid !== 0) {
      domainRows.push(row);
    } else if (row.contype !== 'n') {
      tables.push(row);
    } else if (attnum !== undefined) {
      notNull.set(`${row.relid}:${attnum}`, {
        constraint: {
          name: row.name,
          noInherit: row.connoinherit,
          validated: row.convalidated,
        },
        local: row.conislocal,
      });
    }
  }

  return {
    byDomain: groupBy(domainRows, ({ typid }) => typid),
    notNull,
    tables,
  };
}

/**
 * The sequences of the model that each column owns, when it owns exactly
 * one.
 *
 * @param sequences The sequences of the model.
 * @returns The owned sequence of each column, by {@link columnKey}.
 */
function ownedSequences(
  sequences: ReadonlyArray<Sequence>
): Map<string, OwnedSequence | undefined> {
  const owned = new Map<string, OwnedSequence | undefined>();
  for (const sequence of sequences) {
    const { ownedBy } = sequence;
    if (ownedBy !== undefined) {
      const key = columnKey(
        ownedBy.table.schema,
        ownedBy.table.name,
        ownedBy.column
      );
      owned.set(
        key,
        owned.has(key)
          ? undefined
          : {
              name: { schema: sequence.schema, name: sequence.name },
              options: sequenceOptionsOf(sequence),
              unlogged: sequence.unlogged,
            }
      );
    }
  }

  return owned;
}

/**
 * Builds the model of a schema from the rows of the introspection queries.
 *
 * - Scope: rows whose `schema` is not in `includeSchemas` (when set) or is in
 *   `excludeSchemas` are left out, with everything that belongs to their
 *   objects; extensions are kept whatever their schema, and so are
 *   unsupported objects without a schema. Casts, which have no schema, are
 *   kept unless `includeSchemas` is set (like `pg_dump --schema`).
 * - The migrations table (`migrationsSchema`.`migrationsTable`) is left out
 *   with its columns, constraints, indexes, triggers, policies, rules and
 *   statistics, and so are the sequences its columns own and
 *   `migrationsSequence` (default `<migrationsTable>_id_seq` in
 *   `migrationsSchema`). Names are compared exactly.
 * - `public` is only kept when its comment is neither null nor
 *   {@link DEFAULT_PUBLIC_SCHEMA_COMMENT}.
 * - Catalog codes become the model's values (see each type): `tgtype` bits
 *   (see {@link TRIGGER_TYPE}) become `timing`, `events` and `level`;
 *   `attstorage` is only kept when it differs from `typstorage`; `-1`/null
 *   statistics targets, `''` codes, a `heap` access method and null texts
 *   are left out.
 * - Columns go to their table, view, materialized view or composite type
 *   (by `relid`), in `attnum` order. The `default` of a generated column is
 *   its `generated.expression`. A column gets `ownedSequence` when exactly one
 *   kept sequence is owned by it. A column that its table inherits
 *   (`attinhcount > 0`) gets `inheritance` from the columns of the same name
 *   of the table's parents (its `inherits` rows, found by name among the
 *   tables of the rows), unless a parent is not among them: the first
 *   parent default, whether a parent's column is `NOT NULL` (without `NO
 *   INHERIT`), and the `conislocal` of its own `NOT NULL` row.
 * - Table constraints that are not local (`conislocal`) are left out. `NOT
 *   NULL` rows (`contype = 'n'`) are folded into their column (`conkey`) as
 *   `notNullConstraint`, or into their domain as `notNullConstraintName`;
 *   the CHECK rows of a domain become its `checks`.
 * - The arguments of a routine come from `argTypes`, `argNames` (`''` is no
 *   name), `argModes` and `argDefaults`, without `TABLE` (`t`) columns;
 *   `proconfig` entries are split at their first `=`.
 * - The arguments of a trigger are the zero-terminated parts of `tgargs`,
 *   decoded as UTF-8; its `condition` is taken from `definition` when
 *   `hasCondition`.
 * - A view's `definition` loses its final `;`, and the `check_option` entry
 *   of its `reloptions` becomes `checkOption`.
 * - A partition's parent is its one `inherits` row (`partitionOf.parent`),
 *   so its `inherits` is empty.
 * - `dependencies` are the rows of the `dependencies` query between objects
 *   of the model, as `ObjectRef`s, plus the implicit ones (see
 *   `SchemaModel.dependencies`).
 * - Every array is sorted as the model's conventions say (see
 *   `SchemaModel`), so the same rows in any order give the same model.
 *
 * @param rows The rows of every introspection query.
 * @param facts Which schemas are in scope, and where the migrations table is.
 * @returns The model.
 */
export function rowsToModel(
  rows: CatalogRows,
  facts: IntrospectOptions
): SchemaModel {
  const inScope = scopeOf(facts);
  const { migrationsSchema, migrationsTable } = facts;
  const migrationsSequence = {
    schema: facts.migrationsSequence?.schema ?? migrationsSchema,
    name: facts.migrationsSequence?.name ?? `${migrationsTable}_id_seq`,
  };
  const columnRows = groupBy(
    rows.columns.toSorted((a, b) => a.attnum - b.attnum),
    ({ relid }) => relid
  );
  const columnsOf = (relid: number): ColumnRow[] => columnRows.get(relid) ?? [];
  const constraintRows = splitConstraints(rows.constraints);
  const implicit: Dependency[] = [];
  const relations = new Map<number, Relation>();
  const addRelation = (object: Table | View | MaterializedView): void => {
    relations.set(object.oid, {
      ref: refOf(object),
      name: { schema: object.schema, name: object.name },
    });
  };

  const sequences = sortObjects(
    rows.sequences
      .filter(
        (row) =>
          inScope(row.schema) &&
          !(
            row.schema === migrationsSequence.schema &&
            row.name === migrationsSequence.name
          ) &&
          !(
            row.ownerSchema === migrationsSchema &&
            row.ownerTable === migrationsTable
          )
      )
      .map(sequenceOf)
  );
  const owned = ownedSequences(sequences);

  // The parents of a table, for what its columns inherit from theirs: every
  // table of the rows, in or out of scope.
  const tableOids = new Map(rows.tables.map((row) => [nameKey(row), row.oid]));
  const parentsOf = (
    row: TableRow
  ):
    | Array<{ readonly oid: number; readonly columns: ColumnRow[] }>
    | undefined => {
    const parents = row.inherits.map((parent) =>
      tableOids.get(nameKey(parent))
    );

    return parents.every((oid) => oid !== undefined)
      ? parents.map((oid) => ({ oid, columns: columnsOf(oid) }))
      : undefined;
  };

  const tables = sortObjects(
    rows.tables
      .filter(
        (row) =>
          inScope(row.schema) &&
          !(row.schema === migrationsSchema && row.name === migrationsTable)
      )
      .map((row) => {
        const parents = parentsOf(row);

        return tableOf(
          row,
          columnsOf(row.oid).map((column) =>
            columnOf(
              column,
              constraintRows.notNull.get(`${row.oid}:${column.attnum}`)
                ?.constraint,
              owned.get(columnKey(row.schema, row.name, column.name)),
              columnInheritance(column, parents, constraintRows.notNull)
            )
          )
        );
      })
  );
  const views = sortObjects(
    rows.views
      .filter((row) => row.relkind === 'v' && inScope(row.schema))
      .map((row) => viewOf(row, columnsOf(row.oid)))
  );
  const materializedViews = sortObjects(
    rows.views
      .filter((row) => row.relkind === 'm' && inScope(row.schema))
      .map((row) => materializedViewOf(row, columnsOf(row.oid)))
  );
  for (const relation of [...tables, ...views, ...materializedViews]) {
    addRelation(relation);
  }

  /**
   * Builds the objects of a family that belong to a relation of the model,
   * adding their implicit dependency on it.
   */
  const onRelation = <
    R extends { readonly relid: number },
    T extends ObjectRef,
  >(
    familyRows: ReadonlyArray<R>,
    build: (row: R, table: SchemaQualifiedName) => T | undefined
  ): T[] =>
    familyRows.flatMap((row) => {
      const relation = relations.get(row.relid);
      if (relation === undefined) {
        return [];
      }

      const object = build(row, relation.name);
      if (object === undefined) {
        return [];
      }

      implicit.push({ from: refOf(object), to: relation.ref });

      return [object];
    });

  const constraints = sortObjects(
    onRelation(constraintRows.tables, (row, table) => {
      const type = CONSTRAINT_TYPES[row.contype];

      return type === null || !row.conislocal
        ? undefined
        : constraintOf(row, type, table);
    })
  );
  const indexes = sortObjects(onRelation(rows.indexes, indexOf));
  const triggers = sortObjects(onRelation(rows.triggers, triggerOf));
  const policies = sortObjects(onRelation(rows.policies, policyOf));
  const rules = sortObjects(onRelation(rows.rules, ruleOf));
  const statistics = sortObjects(
    onRelation(rows.statistics, (row, table) =>
      inScope(row.schema) ? statisticsOf(row, table) : undefined
    )
  );

  // A foreign key needs the key it references: the constraint that owns the
  // referenced index, or the unique index itself.
  const keys = new Map<number, ObjectRef>();
  for (const index of indexes) {
    keys.set(index.oid, refOf(index));
  }

  const constraintByOid = new Map(
    constraints.map((constraint) => [constraint.oid, constraint])
  );
  for (const row of constraintRows.tables) {
    const constraint = constraintByOid.get(row.oid);
    if (
      constraint !== undefined &&
      constraint.type !== 'foreignKey' &&
      row.conindid !== 0
    ) {
      keys.set(row.conindid, refOf(constraint));
    }
  }

  for (const row of constraintRows.tables) {
    const constraint = constraintByOid.get(row.oid);
    const key = keys.get(row.conindid);
    if (constraint?.type === 'foreignKey' && key !== undefined) {
      implicit.push({ from: refOf(constraint), to: key });
    }
  }

  // A partition needs its partitioned table, an inheritance child its
  // parents.
  const tablesByName = new Map(tables.map((table) => [nameKey(table), table]));
  for (const table of tables) {
    const parents =
      table.partitionOf === undefined
        ? table.inherits
        : [table.partitionOf.parent];
    for (const parent of parents) {
      const parentTable = tablesByName.get(nameKey(parent));
      if (parentTable !== undefined) {
        implicit.push({ from: refOf(table), to: refOf(parentTable) });
      }
    }
  }

  const model = {
    schemas: sortObjects(
      rows.schemas
        .filter(
          (row) =>
            inScope(row.name) &&
            (row.name !== 'public' ||
              (row.comment !== null &&
                row.comment !== DEFAULT_PUBLIC_SCHEMA_COMMENT))
        )
        .map(schemaOf)
    ),
    extensions: sortObjects(rows.extensions.map(extensionOf)),
    enums: sortObjects(
      rows.enums.filter((row) => inScope(row.schema)).map(enumOf)
    ),
    composites: sortObjects(
      rows.composites
        .filter((row) => inScope(row.schema))
        .map((row) => compositeOf(row, columnsOf(row.relid)))
    ),
    domains: sortObjects(
      rows.domains
        .filter((row) => inScope(row.schema))
        .map((row) => domainOf(row, constraintRows.byDomain.get(row.oid) ?? []))
    ),
    ranges: sortObjects(
      rows.ranges.filter((row) => inScope(row.schema)).map(rangeOf)
    ),
    collations: sortObjects(
      rows.collations.filter((row) => inScope(row.schema)).map(collationOf)
    ),
    sequences,
    functions: sortObjects(
      rows.functions.filter((row) => inScope(row.schema)).map(routineOf)
    ),
    operators: sortObjects(
      rows.operators.filter((row) => inScope(row.schema)).map(operatorOf)
    ),
    casts: sortByKey(
      facts.includeSchemas === undefined ? rows.casts.map(castOf) : [],
      (cast) => [cast.source, cast.target, oidKey(cast.oid)]
    ),
    aggregates: sortObjects(
      rows.aggregates.filter((row) => inScope(row.schema)).map(aggregateOf)
    ),
    tables,
    constraints,
    indexes,
    views,
    materializedViews,
    triggers,
    policies,
    rules,
    statistics,
  };

  const objects: ObjectRef[] = Object.values(model).flat();
  const unsupported: UnsupportedObject[] = sortByKey(
    rows.unsupported
      .filter((row) => row.schema === null || inScope(row.schema))
      .map(({ kind, identity }) => ({ kind, identity })),
    ({ kind, identity }) => [kind, identity]
  );

  return {
    ...model,
    dependencies: finishDependencies([
      ...catalogDependencies(objects, rows.dependencies),
      ...implicit,
    ]),
    unsupported,
  };
}
