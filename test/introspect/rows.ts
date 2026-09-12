// Builders of catalog rows (`CatalogRows` in `src/introspect/types.ts`) for
// the `rowsToModel()` specs: each gives the columns a plain object of its
// kind has, and takes the rest.

import type {
  AggregateRow,
  CastRow,
  CatalogRows,
  CollationRow,
  ColumnRow,
  CompositeRow,
  ConstraintRow,
  DependencyRow,
  DomainRow,
  EnumRow,
  ExtensionRow,
  FunctionRow,
  IndexRow,
  IntrospectOptions,
  OperatorRow,
  PolicyRow,
  RangeRow,
  RuleRow,
  SchemaRow,
  SequenceRow,
  StatisticsRow,
  TableRow,
  TriggerRow,
  UnsupportedRow,
  ViewRow,
} from '../../src/introspect/types';

/**
 * Where the migrations table is, as `baseline()` passes it by default.
 */
export const FACTS: IntrospectOptions = {
  migrationsSchema: 'public',
  migrationsTable: 'pgmigrations',
};

/**
 * The rows of a database without any object.
 */
export function emptyRows(fields: Partial<CatalogRows> = {}): CatalogRows {
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
    columns: [],
    constraints: [],
    indexes: [],
    views: [],
    triggers: [],
    policies: [],
    rules: [],
    statistics: [],
    dependencies: [],
    unsupported: [],
    ...fields,
  };
}

export function schemaRow(
  oid: number,
  name: string,
  comment: string | null = null
): SchemaRow {
  return { oid, name, comment };
}

export function extensionRow(
  oid: number,
  schema: string,
  name: string,
  version = '1.0'
): ExtensionRow {
  return { oid, schema, name, version };
}

export function enumRow(
  oid: number,
  schema: string,
  name: string,
  labels: ReadonlyArray<string>,
  comment: string | null = null
): EnumRow {
  return { oid, schema, name, labels, comment };
}

export function compositeRow(
  oid: number,
  relid: number,
  schema: string,
  name: string,
  comment: string | null = null
): CompositeRow {
  return { oid, relid, schema, name, comment };
}

export function domainRow(
  oid: number,
  schema: string,
  name: string,
  fields: Partial<DomainRow> = {}
): DomainRow {
  return {
    oid,
    schema,
    name,
    baseType: 'integer',
    notNull: false,
    default: null,
    collation: null,
    comment: null,
    ...fields,
  };
}

export function rangeRow(
  oid: number,
  schema: string,
  name: string,
  fields: Partial<RangeRow> = {}
): RangeRow {
  return {
    oid,
    schema,
    name,
    subtype: 'double precision',
    subtypeOpclass: null,
    collation: null,
    canonical: null,
    subtypeDiff: null,
    multirangeSchema: schema,
    multirangeName: `${name}_multirange`,
    comment: null,
    ...fields,
  };
}

export function collationRow(
  oid: number,
  schema: string,
  name: string,
  fields: Partial<CollationRow> = {}
): CollationRow {
  return {
    oid,
    schema,
    name,
    collprovider: 'c',
    collisdeterministic: true,
    locale: null,
    lcCollate: 'C',
    lcCtype: 'C',
    rules: null,
    comment: null,
    ...fields,
  };
}

export function sequenceRow(
  oid: number,
  schema: string,
  name: string,
  fields: Partial<SequenceRow> = {}
): SequenceRow {
  return {
    oid,
    schema,
    name,
    type: 'bigint',
    start: '1',
    increment: '1',
    minValue: '1',
    maxValue: '9223372036854775807',
    cache: '1',
    cycle: false,
    relpersistence: 'p',
    ownerSchema: null,
    ownerTable: null,
    ownerColumn: null,
    comment: null,
    ...fields,
  };
}

export function functionRow(
  oid: number,
  schema: string,
  name: string,
  fields: Partial<FunctionRow> = {}
): FunctionRow {
  return {
    oid,
    schema,
    name,
    prokind: 'f',
    argTypes: [],
    argNames: null,
    argModes: null,
    argDefaults: [],
    identityArguments: '',
    result: 'integer',
    language: 'sql',
    body: ' SELECT 1 ',
    hasSqlBody: false,
    provolatile: 'v',
    proisstrict: false,
    prosecdef: false,
    proleakproof: false,
    proparallel: 'u',
    procost: 100,
    prorows: 0,
    proretset: false,
    proconfig: null,
    definition: `CREATE OR REPLACE FUNCTION ${schema}.${name}()\n RETURNS integer\n LANGUAGE sql\nAS $function$ SELECT 1 $function$\n`,
    comment: null,
    ...fields,
  };
}

export function operatorRow(
  oid: number,
  schema: string,
  name: string,
  fields: Partial<OperatorRow> = {}
): OperatorRow {
  return {
    oid,
    schema,
    name,
    left: { schema: 'pg_catalog', name: 'numeric' },
    right: { schema: 'pg_catalog', name: 'numeric' },
    function: { schema, name: 'roughly_equal' },
    commutator: null,
    negator: null,
    restrict: null,
    join: null,
    oprcanhash: false,
    oprcanmerge: false,
    identityArguments: 'numeric, numeric',
    comment: null,
    ...fields,
  };
}

export function castRow(
  oid: number,
  source: string,
  target: string,
  fields: Partial<CastRow> = {}
): CastRow {
  return {
    oid,
    source,
    target,
    castmethod: 'b',
    castcontext: 'e',
    function: null,
    functionArguments: [],
    comment: null,
    ...fields,
  };
}

export function aggregateRow(
  oid: number,
  schema: string,
  name: string,
  fields: Partial<AggregateRow> = {}
): AggregateRow {
  return {
    oid,
    schema,
    name,
    identityArguments: 'text',
    argTypes: ['text'],
    stateFunction: `${schema}.pipe_concat`,
    stateType: 'text',
    stateSpace: 0,
    finalFunction: null,
    aggfinalextra: false,
    aggfinalmodify: 'r',
    combineFunction: null,
    serialFunction: null,
    deserialFunction: null,
    initialCondition: null,
    movingStateFunction: null,
    movingInverseFunction: null,
    movingStateType: null,
    movingStateSpace: 0,
    movingFinalFunction: null,
    aggmfinalextra: false,
    aggmfinalmodify: 'r',
    movingInitialCondition: null,
    sortOperator: null,
    proparallel: 'u',
    comment: null,
    ...fields,
  };
}

export function tableRow(
  oid: number,
  schema: string,
  name: string,
  fields: Partial<TableRow> = {}
): TableRow {
  return {
    oid,
    schema,
    name,
    relkind: 'r',
    relpersistence: 'p',
    relispartition: false,
    partitionKey: null,
    partitionBound: null,
    inherits: [],
    relrowsecurity: false,
    relforcerowsecurity: false,
    reloptions: null,
    accessMethod: 'heap',
    relreplident: 'd',
    comment: null,
    ...fields,
  };
}

export function columnRow(
  relid: number,
  attnum: number,
  name: string,
  type: string,
  fields: Partial<ColumnRow> = {}
): ColumnRow {
  return {
    relid,
    attnum,
    name,
    type,
    attnotnull: false,
    default: null,
    attidentity: '',
    attgenerated: '',
    identitySequence: null,
    collation: null,
    attislocal: true,
    attinhcount: 0,
    statisticsTarget: null,
    attstorage: 'p',
    typstorage: 'p',
    attcompression: '',
    attoptions: null,
    comment: null,
    ...fields,
  };
}

export function constraintRow(
  oid: number,
  schema: string,
  name: string,
  relid: number,
  contype: ConstraintRow['contype'],
  definition: string,
  fields: Partial<ConstraintRow> = {}
): ConstraintRow {
  return {
    oid,
    schema,
    name,
    relid,
    typid: 0,
    contype,
    definition,
    checkExpression: null,
    condeferrable: false,
    condeferred: false,
    convalidated: true,
    conislocal: true,
    connoinherit: false,
    conkey: null,
    conindid: 0,
    confrelid: 0,
    referencedSchema: null,
    referencedTable: null,
    indexClustered: false,
    indexReplicaIdentity: false,
    comment: null,
    indexComment: null,
    ...fields,
  };
}

export function indexRow(
  oid: number,
  schema: string,
  name: string,
  relid: number,
  fields: Partial<IndexRow> = {}
): IndexRow {
  return {
    oid,
    schema,
    name,
    relid,
    definition: `CREATE INDEX ${name} ON ${schema}.t USING btree (id)`,
    indisunique: false,
    amname: 'btree',
    keys: [
      {
        column: 'id',
        expression: null,
        opclass: null,
        collation: null,
        descending: false,
        nullsFirst: false,
      },
    ],
    include: [],
    predicate: null,
    nullsNotDistinct: false,
    reloptions: null,
    indisclustered: false,
    indisreplident: false,
    comment: null,
    ...fields,
  };
}

export function viewRow(
  oid: number,
  schema: string,
  name: string,
  definition: string,
  fields: Partial<ViewRow> = {}
): ViewRow {
  return {
    oid,
    schema,
    name,
    relkind: 'v',
    definition,
    reloptions: null,
    accessMethod: null,
    comment: null,
    ...fields,
  };
}

export function triggerRow(
  oid: number,
  schema: string,
  name: string,
  relid: number,
  fields: Partial<TriggerRow> = {}
): TriggerRow {
  return {
    oid,
    schema,
    name,
    relid,
    tgtype: 5,
    tgenabled: 'O',
    functionSchema: schema,
    functionName: 'on_change',
    tgargs: new Uint8Array(),
    updateOf: [],
    hasCondition: false,
    isConstraint: false,
    tgdeferrable: false,
    tginitdeferred: false,
    tgoldtable: null,
    tgnewtable: null,
    definition: `CREATE TRIGGER ${name} AFTER INSERT ON ${schema}.t FOR EACH ROW EXECUTE FUNCTION ${schema}.on_change()`,
    comment: null,
    ...fields,
  };
}

export function policyRow(
  oid: number,
  schema: string,
  name: string,
  relid: number,
  fields: Partial<PolicyRow> = {}
): PolicyRow {
  return {
    oid,
    schema,
    name,
    relid,
    polcmd: '*',
    polpermissive: true,
    roles: ['PUBLIC'],
    using: null,
    check: null,
    comment: null,
    ...fields,
  };
}

export function ruleRow(
  oid: number,
  schema: string,
  name: string,
  relid: number,
  definition: string,
  fields: Partial<RuleRow> = {}
): RuleRow {
  return {
    oid,
    schema,
    name,
    relid,
    enabled: 'O',
    definition,
    comment: null,
    ...fields,
  };
}

export function statisticsRow(
  oid: number,
  schema: string,
  name: string,
  relid: number,
  definition: string,
  fields: Partial<StatisticsRow> = {}
): StatisticsRow {
  return {
    oid,
    schema,
    name,
    relid,
    definition,
    statisticsTarget: null,
    comment: null,
    ...fields,
  };
}

export function dependencyRow(
  classid: string,
  objid: number,
  refclassid: string,
  refobjid: number,
  deptype: DependencyRow['deptype'] = 'n'
): DependencyRow {
  return { classid, objid, refclassid, refobjid, deptype };
}

export function unsupportedRow(
  kind: UnsupportedRow['kind'],
  schema: string | null,
  identity: string
): UnsupportedRow {
  return { kind, schema, identity };
}
