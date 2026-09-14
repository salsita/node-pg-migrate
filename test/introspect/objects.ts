// Builders of model objects (`src/introspect/types.ts`) for the specs: each
// gives the fields a plain object of its kind has, and takes the rest.

import type {
  Aggregate,
  Cast,
  Collation,
  Column,
  CompositeAttribute,
  CompositeType,
  Constraint,
  Dependency,
  DomainType,
  EnumType,
  Extension,
  Index,
  MaterializedView,
  ModelObject,
  ObjectRef,
  Operator,
  Policy,
  RangeType,
  Routine,
  Rule,
  Schema,
  SchemaModel,
  SchemaQualifiedName,
  Sequence,
  SequenceOptions,
  Statistics,
  Table,
  Trigger,
  View,
} from '../../src/introspect/types';

let lastOid = 40_000;

/**
 * A new OID, unique among the objects of the specs.
 */
export function nextOid(): number {
  lastOid += 1;

  return lastOid;
}

type Fields<T> = Partial<Omit<T, 'kind'>>;

interface Named {
  readonly schema: string;
  readonly name: string;
}

/**
 * The schema and name of an object.
 */
export function qualified(object: Named): SchemaQualifiedName {
  return { schema: object.schema, name: object.name };
}

/**
 * A dependency of `from` on `to`.
 */
export function dependsOn(from: ObjectRef, to: ObjectRef): Dependency {
  return {
    from: { kind: from.kind, oid: from.oid },
    to: { kind: to.kind, oid: to.oid },
  };
}

export function makeSchema(name: string, fields: Fields<Schema> = {}): Schema {
  return { kind: 'schema', oid: nextOid(), schema: name, name, ...fields };
}

export function makeExtension(
  schema: string,
  name: string,
  fields: Fields<Extension> = {}
): Extension {
  return {
    kind: 'extension',
    oid: nextOid(),
    schema,
    name,
    version: '1.0',
    ...fields,
  };
}

export function makeEnum(
  schema: string,
  name: string,
  labels: ReadonlyArray<string>,
  fields: Fields<EnumType> = {}
): EnumType {
  return { kind: 'enum', oid: nextOid(), schema, name, labels, ...fields };
}

export function makeComposite(
  schema: string,
  name: string,
  attributes: ReadonlyArray<CompositeAttribute>,
  fields: Fields<CompositeType> = {}
): CompositeType {
  return {
    kind: 'composite',
    oid: nextOid(),
    schema,
    name,
    attributes,
    ...fields,
  };
}

export function makeDomain(
  schema: string,
  name: string,
  baseType: string,
  fields: Fields<DomainType> = {}
): DomainType {
  return {
    kind: 'domain',
    oid: nextOid(),
    schema,
    name,
    baseType,
    notNull: false,
    checks: [],
    ...fields,
  };
}

export function makeRange(
  schema: string,
  name: string,
  subtype: string,
  fields: Fields<RangeType> = {}
): RangeType {
  return {
    kind: 'range',
    oid: nextOid(),
    schema,
    name,
    subtype,
    multirange: { schema, name: `${name}_multirange` },
    ...fields,
  };
}

export function makeCollation(
  schema: string,
  name: string,
  fields: Fields<Collation> = {}
): Collation {
  return {
    kind: 'collation',
    oid: nextOid(),
    schema,
    name,
    provider: 'icu',
    deterministic: true,
    locale: 'und',
    ...fields,
  };
}

const TYPE_MAX: Readonly<Record<string, string>> = {
  smallint: '32767',
  integer: '2147483647',
  bigint: '9223372036854775807',
};

/**
 * The options PostgreSQL gives an ascending sequence of `type` created
 * without options.
 */
export function defaultSequenceOptions(
  type: 'smallint' | 'integer' | 'bigint' = 'bigint',
  fields: Partial<SequenceOptions> = {}
): SequenceOptions {
  return {
    type,
    start: '1',
    increment: '1',
    minValue: '1',
    maxValue: TYPE_MAX[type],
    cache: '1',
    cycle: false,
    ...fields,
  };
}

export function makeSequence(
  schema: string,
  name: string,
  fields: Fields<Sequence> = {}
): Sequence {
  return {
    kind: 'sequence',
    oid: nextOid(),
    schema,
    name,
    ...defaultSequenceOptions(),
    unlogged: false,
    ...fields,
  };
}

export function makeFunction(
  schema: string,
  name: string,
  fields: Fields<Routine> = {}
): Routine {
  return {
    kind: 'function',
    oid: nextOid(),
    schema,
    name,
    routineKind: 'function',
    arguments: [],
    identityArguments: '',
    returns: 'integer',
    returnsSet: false,
    language: 'sql',
    body: ' SELECT 1 ',
    hasSqlBody: false,
    volatility: 'VOLATILE',
    strict: false,
    securityDefiner: false,
    leakproof: false,
    parallel: 'UNSAFE',
    cost: 100,
    rows: 0,
    config: [],
    definition: `CREATE OR REPLACE FUNCTION ${schema}.${name}()\n RETURNS integer\n LANGUAGE sql\nAS $function$ SELECT 1 $function$\n`,
    ...fields,
  };
}

export function makeOperator(
  schema: string,
  name: string,
  fields: Fields<Operator> = {}
): Operator {
  return {
    kind: 'operator',
    oid: nextOid(),
    schema,
    name,
    left: { schema: 'pg_catalog', name: 'int4' },
    right: { schema: 'pg_catalog', name: 'int4' },
    function: { schema, name: 'int_op_fn' },
    hashes: false,
    merges: false,
    identityArguments: 'integer, integer',
    ...fields,
  };
}

export function makeCast(
  source: string,
  target: string,
  fields: Fields<Cast> = {}
): Cast {
  return {
    kind: 'cast',
    oid: nextOid(),
    source,
    target,
    method: 'binary',
    functionArguments: [],
    context: 'EXPLICIT',
    ...fields,
  };
}

export function makeAggregate(
  schema: string,
  name: string,
  fields: Fields<Aggregate> = {}
): Aggregate {
  return {
    kind: 'aggregate',
    oid: nextOid(),
    schema,
    name,
    identityArguments: 'text',
    argumentTypes: ['text'],
    stateFunction: `${schema}.concat_step`,
    stateType: 'text',
    finalFunctionExtra: false,
    finalFunctionModify: 'READ_ONLY',
    parallel: 'UNSAFE',
    ...fields,
  };
}

export function makeColumn(
  name: string,
  type: string,
  fields: Partial<Column> = {}
): Column {
  return {
    name,
    type,
    notNull: false,
    local: true,
    inheritCount: 0,
    options: [],
    ...fields,
  };
}

export function makeTable(
  schema: string,
  name: string,
  fields: Fields<Table> = {}
): Table {
  return {
    kind: 'table',
    oid: nextOid(),
    schema,
    name,
    partitioned: false,
    unlogged: false,
    columns: [makeColumn('id', 'integer')],
    inherits: [],
    rowLevelSecurity: false,
    forceRowLevelSecurity: false,
    options: [],
    replicaIdentity: 'DEFAULT',
    ...fields,
  };
}

export function makeConstraint(
  table: Named,
  name: string,
  type: Constraint['type'],
  definition: string,
  fields: Fields<Constraint> = {}
): Constraint {
  return {
    kind: 'constraint',
    oid: nextOid(),
    schema: table.schema,
    name,
    table: qualified(table),
    type,
    definition,
    deferrable: false,
    deferred: false,
    validated: true,
    clustered: false,
    replicaIdentity: false,
    ...fields,
  };
}

export function makeIndex(
  table: Named,
  name: string,
  fields: Fields<Index> = {}
): Index {
  return {
    kind: 'index',
    oid: nextOid(),
    schema: table.schema,
    name,
    table: qualified(table),
    definition: `CREATE INDEX ${name} ON ${table.schema}.${table.name} USING btree (id)`,
    unique: false,
    method: 'btree',
    keys: [{ column: 'id', descending: false, nullsFirst: false }],
    include: [],
    nullsNotDistinct: false,
    options: [],
    clustered: false,
    replicaIdentity: false,
    ...fields,
  };
}

export function makeView(
  schema: string,
  name: string,
  definition: string,
  fields: Fields<View> = {}
): View {
  return {
    kind: 'view',
    oid: nextOid(),
    schema,
    name,
    definition,
    options: [],
    columns: [],
    ...fields,
  };
}

export function makeMaterializedView(
  schema: string,
  name: string,
  definition: string,
  fields: Fields<MaterializedView> = {}
): MaterializedView {
  return {
    kind: 'materializedView',
    oid: nextOid(),
    schema,
    name,
    definition,
    options: [],
    columns: [],
    ...fields,
  };
}

export function makeTrigger(
  table: Named,
  name: string,
  fields: Fields<Trigger> = {}
): Trigger {
  return {
    kind: 'trigger',
    oid: nextOid(),
    schema: table.schema,
    name,
    table: qualified(table),
    timing: 'AFTER',
    events: ['INSERT'],
    updateOf: [],
    level: 'ROW',
    function: { schema: table.schema, name: 'on_change' },
    args: [],
    constraint: false,
    deferrable: false,
    deferred: false,
    enabled: 'ORIGIN',
    definition: `CREATE TRIGGER ${name} AFTER INSERT ON ${table.schema}.${table.name} FOR EACH ROW EXECUTE FUNCTION ${table.schema}.on_change()`,
    ...fields,
  };
}

export function makePolicy(
  table: Named,
  name: string,
  fields: Fields<Policy> = {}
): Policy {
  return {
    kind: 'policy',
    oid: nextOid(),
    schema: table.schema,
    name,
    table: qualified(table),
    command: 'ALL',
    permissive: true,
    roles: ['PUBLIC'],
    ...fields,
  };
}

export function makeRule(
  table: Named,
  name: string,
  definition: string,
  fields: Fields<Rule> = {}
): Rule {
  return {
    kind: 'rule',
    oid: nextOid(),
    schema: table.schema,
    name,
    table: qualified(table),
    enabled: 'ORIGIN',
    definition,
    ...fields,
  };
}

export function makeStatistics(
  table: Named,
  name: string,
  definition: string,
  fields: Fields<Statistics> = {}
): Statistics {
  return {
    kind: 'statistics',
    oid: nextOid(),
    schema: table.schema,
    name,
    table: qualified(table),
    definition,
    ...fields,
  };
}

/**
 * A model without any object.
 */
export function emptyModel(fields: Partial<SchemaModel> = {}): SchemaModel {
  return {
    schemas: [],
    extensions: [],
    enums: [],
    composites: [],
    domains: [],
    ranges: [],
    collations: [],
    sequences: [],
    functions: [],
    operators: [],
    casts: [],
    aggregates: [],
    tables: [],
    constraints: [],
    indexes: [],
    views: [],
    materializedViews: [],
    triggers: [],
    policies: [],
    rules: [],
    statistics: [],
    dependencies: [],
    unsupported: [],
    ...fields,
  };
}

/**
 * A model of these objects (each in the array of its kind, in the order
 * given) and dependencies.
 */
export function modelOf(
  objects: ReadonlyArray<ModelObject>,
  dependencies: ReadonlyArray<Dependency> = [],
  fields: Partial<SchemaModel> = {}
): SchemaModel {
  const of = <K extends ModelObject['kind']>(
    kind: K
  ): Array<Extract<ModelObject, { kind: K }>> =>
    objects.filter(
      (object): object is Extract<ModelObject, { kind: K }> =>
        object.kind === kind
    );

  return emptyModel({
    schemas: of('schema'),
    extensions: of('extension'),
    enums: of('enum'),
    composites: of('composite'),
    domains: of('domain'),
    ranges: of('range'),
    collations: of('collation'),
    sequences: of('sequence'),
    functions: of('function'),
    operators: of('operator'),
    casts: of('cast'),
    aggregates: of('aggregate'),
    tables: of('table'),
    constraints: of('constraint'),
    indexes: of('index'),
    views: of('view'),
    materializedViews: of('materializedView'),
    triggers: of('trigger'),
    policies: of('policy'),
    rules: of('rule'),
    statistics: of('statistics'),
    dependencies,
    ...fields,
  });
}
