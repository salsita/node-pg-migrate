import {
  DEFAULT_MAX_LOCKS_PER_TRANSACTION,
  estimateRelations,
  requiredMaxLocksPerTransaction,
} from '../baseline/core/locks';
import { BaselineError } from '../baseline/errors';
import type { DumpStats } from '../baseline/types';
import { objectIdentity, orderObjects } from '../introspect/core/order';
import type {
  Column,
  Dependency,
  ModelObject,
  ObjectComment,
  ObjectRef,
  OrderedObject,
  SchemaModel,
  SchemaQualifiedName,
  Sequence,
  Table,
  UnsupportedObject,
} from '../introspect/types';
import { emitAggregate } from './emitters/aggregates';
import { emitCast } from './emitters/casts';
import { emitCollation } from './emitters/collations';
import { emitComment } from './emitters/comments';
import { emitComposite } from './emitters/composites';
import { emitConstraint } from './emitters/constraints';
import { emitDomain } from './emitters/domains';
import { emitEnum } from './emitters/enums';
import { emitExtension } from './emitters/extensions';
import { emitFunction } from './emitters/functions';
import { emitIndex } from './emitters/indexes';
import { emitMaterializedView } from './emitters/materializedViews';
import { emitOperator } from './emitters/operators';
import { emitPolicy } from './emitters/policies';
import { emitEpilogue, emitPrologue } from './emitters/prologue';
import { emitRange } from './emitters/ranges';
import { emitRowLevelSecurity } from './emitters/rowLevelSecurity';
import { emitRule } from './emitters/rules';
import { emitSchema } from './emitters/schemas';
import { emitSequence, emitSequenceOwnership } from './emitters/sequences';
import { emitStatistics } from './emitters/statistics';
import { emitTable, serialSequences } from './emitters/tables';
import { emitTrigger } from './emitters/triggers';
import { emitShellType } from './emitters/types';
import { emitView } from './emitters/views';
import { renderMigration } from './render';
import type {
  EmitContext,
  Emitted,
  Fallback,
  GeneratedMigration,
  GenerateOptions,
  OutputLanguage,
} from './types';

export type {
  Emitted,
  EmitContext,
  Fallback,
  GeneratedMigration,
  GenerateOptions,
  OutputLanguage,
  RenderOptions,
} from './types';

/**
 * How the kinds of objects whose name is not a word are written in messages.
 */
const KIND_LABELS: Readonly<Record<string, string>> = {
  materializedView: 'materialized view',
  shellType: 'shell type',
};

/**
 * How a kind of object is written in messages.
 */
function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

/**
 * The identity of what a comment is on, as `Fallback.identity` writes it:
 * the object, with `.column` for a column, `<constraint> on <domain>` for a
 * domain constraint, and the index (`schema.name`) for the index of a
 * constraint.
 */
function commentIdentity(comment: ObjectComment): string {
  if (comment.on === 'object') {
    return objectIdentity(comment.object);
  }

  if (comment.on === 'column') {
    return `${objectIdentity(comment.object)}.${comment.column}`;
  }

  if (comment.on === 'domainConstraint') {
    return `${comment.constraint} on ${objectIdentity(comment.object)}`;
  }

  return `${comment.object.schema}.${comment.object.name}`;
}

/**
 * Each kind of object of the model, with the type of its objects.
 */
type ObjectOfKind = { [O in ModelObject as O['kind']]: O };

/**
 * The emitter of each kind of object.
 */
const EMITTERS: {
  readonly [K in keyof ObjectOfKind]: (
    object: ObjectOfKind[K],
    ctx: EmitContext
  ) => Emitted;
} = {
  schema: emitSchema,
  extension: emitExtension,
  enum: emitEnum,
  shellType: emitShellType,
  composite: emitComposite,
  domain: emitDomain,
  range: emitRange,
  collation: emitCollation,
  sequence: emitSequence,
  function: emitFunction,
  operator: emitOperator,
  cast: emitCast,
  aggregate: emitAggregate,
  table: emitTable,
  constraint: emitConstraint,
  index: emitIndex,
  view: emitView,
  materializedView: emitMaterializedView,
  trigger: emitTrigger,
  policy: emitPolicy,
  rule: emitRule,
  statistics: emitStatistics,
};

/**
 * Emits the step that creates an object with the emitter of its kind.
 */
function emitObject<K extends keyof ObjectOfKind>(
  kind: K,
  object: ObjectOfKind[K],
  ctx: EmitContext
): Emitted {
  return EMITTERS[kind](object, ctx);
}

/**
 * What a step emits and, for a fallback, what to report about it.
 */
interface EmittedStep {
  readonly emitted: Emitted;
  readonly kind: string;
  readonly identity: string;
}

/**
 * The code of a step and, when it is a fallback, what to report about it;
 * `undefined` for the steps of the sequences that `serial` columns create.
 */
function emitStep(
  step: OrderedObject,
  ctx: EmitContext,
  serial: ReadonlySet<Sequence>
): EmittedStep | undefined {
  if (step.step === 'prologue') {
    return { emitted: emitPrologue(), kind: 'prologue', identity: '' };
  }

  if (step.step === 'epilogue') {
    return { emitted: emitEpilogue(), kind: 'epilogue', identity: '' };
  }

  if (step.step === 'comment') {
    return {
      emitted: emitComment(step.object, ctx),
      kind: 'comment',
      identity: commentIdentity(step.object),
    };
  }

  const { object } = step;
  if (object.kind === 'sequence' && serial.has(object)) {
    return undefined;
  }

  let emitted: Emitted;
  if (step.step === 'sequenceOwnership') {
    emitted = emitSequenceOwnership(step.object, ctx);
  } else if (step.step === 'rowLevelSecurity') {
    emitted = emitRowLevelSecurity(step.object, ctx);
  } else {
    emitted = emitObject(object.kind, object, ctx);
  }

  return { emitted, kind: object.kind, identity: objectIdentity(object) };
}

/**
 * The key of an object in a graph of {@link waitsFor}.
 */
function refKey(ref: ObjectRef): string {
  return `${ref.kind}:${String(ref.oid)}`;
}

/**
 * The key of a schema-qualified name.
 */
function nameKey(name: SchemaQualifiedName): string {
  return `${name.schema} ${name.name}`;
}

/**
 * Adds `to` to the keys that `from` has in a graph of keys.
 */
function addEdge(
  graph: Map<string, Set<string>>,
  from: string,
  to: string
): void {
  const edges = graph.get(from) ?? new Set<string>();
  edges.add(to);
  graph.set(from, edges);
}

/**
 * What each object waits for, by {@link refKey}, the way `orderObjects()`
 * orders them: its dependencies, and its table (for the objects of a
 * table), the table it references (for a foreign key), its partitioned table
 * (for a partition) or its parents (for an inheritance child).
 */
function waitsFor(model: SchemaModel): Map<string, Set<string>> {
  const relations = new Map(
    [...model.tables, ...model.views, ...model.materializedViews].map(
      (relation) => [nameKey(relation), refKey(relation)]
    )
  );
  const graph = new Map<string, Set<string>>();
  const waitForRelation = (
    from: ObjectRef,
    name: SchemaQualifiedName | undefined
  ): void => {
    const to = name === undefined ? undefined : relations.get(nameKey(name));
    if (to !== undefined) {
      addEdge(graph, refKey(from), to);
    }
  };

  for (const { from, to } of model.dependencies) {
    addEdge(graph, refKey(from), refKey(to));
  }

  for (const object of [
    ...model.constraints,
    ...model.indexes,
    ...model.triggers,
    ...model.policies,
    ...model.rules,
    ...model.statistics,
  ]) {
    waitForRelation(object, object.table);
  }

  for (const constraint of model.constraints) {
    waitForRelation(constraint, constraint.references);
  }

  for (const table of model.tables) {
    for (const parent of [table.partitionOf?.parent, ...table.inherits]) {
      waitForRelation(table, parent);
    }
  }

  return graph;
}

/**
 * Whether making a sequence wait for a table would make a cycle in a graph
 * of {@link waitsFor} that has none: whether the table waits, directly or
 * not, for another object that uses the sequence.
 *
 * @param graph What each object waits for.
 * @param users The objects that use the sequence.
 * @param table The table.
 */
function makesCycle(
  graph: ReadonlyMap<string, ReadonlySet<string>>,
  users: ReadonlySet<string>,
  table: string
): boolean {
  const others = new Set(users);
  others.delete(table);
  if (others.size === 0) {
    return false;
  }

  const seen = new Set([table]);
  const stack = [table];
  for (let key = stack.pop(); key !== undefined; key = stack.pop()) {
    for (const next of graph.get(key) ?? []) {
      if (others.has(next)) {
        return true;
      }

      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }

  return false;
}

/**
 * A table whose columns do not own the sequences of `names` (by
 * {@link nameKey}) any more, so that the table emitter does not make them
 * `serial`.
 */
function withoutOwnedSequences(
  table: Table,
  names: ReadonlySet<string>
): Table {
  const owns = ({ ownedSequence }: Column): boolean =>
    ownedSequence !== undefined && names.has(nameKey(ownedSequence.name));
  if (!table.columns.some(owns)) {
    return table;
  }

  return {
    ...table,
    columns: table.columns.map((column) => {
      if (!owns(column)) {
        return column;
      }

      const { ownedSequence: _, ...rest } = column;

      return rest;
    }),
  };
}

/**
 * The `serial` columns of a model (see {@link serialColumnsOf}).
 */
interface SerialColumns {
  /**
   * The sequences that `serial` columns create, each with the table that
   * has the column.
   */
  readonly sequences: Map<Sequence, ModelObject>;

  /**
   * The model to emit: the columns that could be `serial` but are not do
   * not own their sequence (`ownedSequence`), so that the table emitter
   * does not make them `serial`.
   */
  readonly model: SchemaModel;
}

/**
 * The columns that are written as `serial`, with the sequences they create
 * (see `serialSequences()`).
 *
 * Such a sequence waits for its table instead of the other way round (see
 * {@link orderingDependencies}), which would make a cycle when the table
 * waits, directly or not, for something else that uses the sequence (e.g. a
 * column default that calls a function whose body uses the sequence): that
 * column is not `serial` then, and its sequence is created and owned on its
 * own. The tables are taken in order, each after the sequences of the
 * `serial` columns before it were made to wait for their tables, so the
 * steps can always be ordered when the model's dependencies can.
 */
function serialColumnsOf(model: SchemaModel): SerialColumns {
  const byName = new Map(
    model.sequences.map((sequence) => [nameKey(sequence), sequence])
  );
  const graph = waitsFor(model);
  const users = new Map<string, Set<string>>();
  for (const { from, to } of model.dependencies) {
    if (to.kind === 'sequence') {
      addEdge(users, refKey(to), refKey(from));
    }
  }

  const sequences = new Map<Sequence, ModelObject>();
  const notSerial = new Set<string>();
  for (const table of model.tables) {
    const key = refKey(table);
    for (const name of serialSequences(table)) {
      const sequence = byName.get(nameKey(name));
      if (sequence === undefined) {
        continue;
      }

      const sequenceKey = refKey(sequence);
      if (makesCycle(graph, users.get(sequenceKey) ?? new Set(), key)) {
        notSerial.add(nameKey(name));
      } else {
        sequences.set(sequence, table);
        graph.get(key)?.delete(sequenceKey);
        addEdge(graph, sequenceKey, key);
      }
    }
  }

  return {
    sequences,
    model: {
      ...model,
      tables: model.tables.map((table) =>
        withoutOwnedSequences(table, notSerial)
      ),
    },
  };
}

/**
 * The dependencies to order the steps with: those of the model, except that
 * a sequence that a `serial` column creates waits for the table of the
 * column instead of the table waiting for it, so that whatever uses the
 * sequence comes after the table that creates it.
 */
function orderingDependencies(
  model: SchemaModel,
  serial: ReadonlyMap<Sequence, ModelObject>
): Dependency[] {
  const owners = new Map(
    [...serial].map(([sequence, table]) => [sequence.oid, table.oid])
  );
  const kept = model.dependencies.filter(
    ({ from, to }) =>
      !(
        from.kind === 'table' &&
        to.kind === 'sequence' &&
        owners.get(to.oid) === from.oid
      )
  );

  return [
    ...kept,
    ...[...serial].map(([sequence, table]) => ({
      from: { kind: sequence.kind, oid: sequence.oid },
      to: { kind: table.kind, oid: table.oid },
    })),
  ];
}

/**
 * What a migration creates, counted like a dump (see `DumpStats`).
 */
function statsOf(model: SchemaModel): DumpStats {
  const identitySequences = model.tables
    .flatMap((table) => table.columns)
    .filter((column) => column.local && column.identity !== undefined).length;

  return {
    tables: model.tables.length,
    indexes: model.indexes.length,
    indexBackedConstraints: model.constraints.filter(
      (constraint) =>
        constraint.type !== 'check' && constraint.type !== 'foreignKey'
    ).length,
    sequences: model.sequences.length + identitySequences,
    views: model.views.length,
    materializedViews: model.materializedViews.length,
  };
}

function unsupportedError(
  unsupported: ReadonlyArray<UnsupportedObject>,
  language: OutputLanguage
): BaselineError {
  const lines = unsupported.map(
    ({ kind, identity }) => `  - ${kind} ${identity}`
  );

  return new BaselineError(
    'UNSUPPORTED_OBJECTS',
    [
      `A --format ${language} baseline cannot represent ${String(unsupported.length)} object(s) of this database:`,
      ...lines,
      'Use --format sql for this database.',
    ].join('\n')
  );
}

function strictError(
  fallbacks: ReadonlyArray<Fallback>,
  language: OutputLanguage
): BaselineError {
  const lines = fallbacks.map(
    ({ kind, identity, reason }) =>
      `  - ${kindLabel(kind)} ${identity}: ${reason}`
  );

  return new BaselineError(
    'UNSUPPORTED_OBJECTS',
    [
      `--strict: a --format ${language} baseline of this database needs raw SQL (pgm.sql) for ${String(fallbacks.length)} object(s):`,
      ...lines,
      'Leave out --strict to write them as pgm.sql() calls, or use --format sql.',
    ].join('\n')
  );
}

/**
 * Generates a TypeScript or JavaScript baseline migration made of `pgm`
 * calls from the model of a schema.
 *
 * Orders the steps (`orderObjects()`), emits each one with the emitter of
 * its kind (a `serial` column's sequence and its ownership are part of the
 * table, so they are not emitted on their own; for the ordering, such a
 * sequence waits for its table instead of the other way round, so that
 * whatever uses the sequence is created after the table, and a column is
 * only `serial` when that makes no dependency cycle, see
 * {@link serialColumnsOf}), and renders the file (`renderMigration()`);
 * `stats` counts what the migration creates, and sizes the header's
 * `max_locks_per_transaction` note.
 *
 * Throws a `BaselineError` with code `UNSUPPORTED_OBJECTS` when the model has
 * objects that no migration can represent (`model.unsupported`, suggesting
 * `--format sql`), when the dependencies have a cycle, or, with `strict`,
 * when any object needs a fallback; the message lists every such object and
 * why.
 *
 * @param model The schema.
 * @param options The language, the default schema and what the header says.
 * @returns The migration, its fallbacks and what it creates.
 */
export function generateMigration(
  model: SchemaModel,
  options: GenerateOptions
): GeneratedMigration {
  const { language } = options;
  if (model.unsupported.length > 0) {
    throw unsupportedError(model.unsupported, language);
  }

  const { sequences: serial, model: toEmit } = serialColumnsOf(model);
  const steps = orderObjects({
    ...toEmit,
    dependencies: orderingDependencies(model, serial),
  });
  const ctx: EmitContext = { defaultSchema: options.defaultSchema, language };
  const serialSet = new Set(serial.keys());
  const emitted: Emitted[] = [];
  const fallbacks: Fallback[] = [];
  for (const step of steps) {
    const result = emitStep(step, ctx, serialSet);
    if (result !== undefined) {
      emitted.push(result.emitted);
      if (result.emitted.kind === 'fallback') {
        fallbacks.push({
          kind: result.kind,
          identity: result.identity,
          reason: result.emitted.reason,
        });
      }
    }
  }

  if (options.strict === true && fallbacks.length > 0) {
    throw strictError(fallbacks, language);
  }

  const stats = statsOf(model);
  const relations = estimateRelations(stats);
  const locks = requiredMaxLocksPerTransaction(
    relations,
    options.maxConnections,
    options.maxPreparedTransactions
  );
  const content = renderMigration(emitted, {
    language,
    header: {
      migrationName: options.migrationName,
      fakeCommand: options.fakeCommand,
      source: options.source,
      materializedViews: stats.materializedViews,
      relations,
      ...(locks > DEFAULT_MAX_LOCKS_PER_TRANSACTION
        ? { requiredMaxLocksPerTransaction: locks }
        : {}),
    },
  });

  return { content, fallbacks, stats };
}
