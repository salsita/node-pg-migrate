import {
  DEFAULT_MAX_LOCKS_PER_TRANSACTION,
  estimateRelations,
  requiredMaxLocksPerTransaction,
} from '../baseline/core/locks';
import { BaselineError } from '../baseline/errors';
import type { DumpStats } from '../baseline/types';
import { objectIdentity, orderObjects } from '../introspect/core/order';
import type {
  Dependency,
  ModelObject,
  ObjectComment,
  OrderedObject,
  SchemaModel,
  Sequence,
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
 * How a kind of object is written in messages.
 */
function kindLabel(kind: string): string {
  return kind === 'materializedView' ? 'materialized view' : kind;
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
 * The sequences that `serial` columns create, each with the table that has
 * the column (see `serialSequences()`).
 */
function serialSequencesOf(model: SchemaModel): Map<Sequence, ModelObject> {
  const byName = new Map(
    model.sequences.map((sequence) => [
      `${sequence.schema} ${sequence.name}`,
      sequence,
    ])
  );
  const found = new Map<Sequence, ModelObject>();
  for (const table of model.tables) {
    for (const name of serialSequences(table)) {
      const sequence = byName.get(`${name.schema} ${name.name}`);
      if (sequence !== undefined) {
        found.set(sequence, table);
      }
    }
  }

  return found;
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
 * whatever uses the sequence is created after the table), and renders the
 * file (`renderMigration()`); `stats` counts what the migration creates, and
 * sizes the header's `max_locks_per_transaction` note.
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

  const serial = serialSequencesOf(model);
  const steps = orderObjects({
    ...model,
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
