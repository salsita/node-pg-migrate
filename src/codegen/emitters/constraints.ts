import type { Constraint } from '../../introspect/types';
import { statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteName } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { withStatements } from './fallback';
import type { IndexLabel } from './shared';
import { hasLineBreak, namedPartitionIndexes } from './shared';

/**
 * What PostgreSQL names the index of each kind of constraint after.
 */
const INDEX_LABELS: Readonly<Partial<Record<Constraint['type'], IndexLabel>>> =
  { primaryKey: 'pkey', unique: 'key', exclusion: 'excl' };

/**
 * `pgm.addConstraint(table, name, definition)`, the definition as
 * `pg_get_constraintdef()` wrote it.
 *
 * Fallback when the table is clustered on the constraint's index or uses it
 * as its replica identity: the constraint is added, then `pgm.sql('ALTER
 * TABLE … CLUSTER ON …')` / `pgm.sql('ALTER TABLE … REPLICA IDENTITY USING
 * INDEX …')`, reason `'CLUSTER ON'` / `'replica identity'`. Also when the
 * definition has a line break (in a string constant), which `addConstraint`
 * would turn into a space: the constraint is added with `pgm.sql('ALTER TABLE
 * … ADD CONSTRAINT …')`, reason `'line break'`.
 *
 * A primary key, unique or exclusion constraint of a partitioned table comes
 * with the constraints of its partitions (`partitionIndexes`), except those
 * whose name is not the one PostgreSQL would give them: each of those is
 * added to its partition first, with its own definition, so that adding the
 * constraint of the partitioned table attaches it instead of adding one with
 * another name.
 *
 * @param constraint The constraint.
 * @param ctx The migration context.
 */
export function emitConstraint(
  constraint: Constraint,
  ctx: EmitContext
): Emitted {
  const table = qualifiedName(constraint.table);
  const name = quoteName(constraint.name);
  const label = INDEX_LABELS[constraint.type];
  const partitions =
    label === undefined
      ? []
      : namedPartitionIndexes(constraint.partitionIndexes, label).map(
          (partitionIndex) => ({
            table: partitionIndex.table,
            name: partitionIndex.name,
            definition:
              partitionIndex.constraintDefinition ?? constraint.definition,
          })
        );
  const reasons: string[] = [];
  const statements: string[] = [];
  const multiline = hasLineBreak(constraint.definition);
  if (multiline) {
    statements.push(
      ...[...partitions, constraint].map(
        (added) =>
          `ALTER TABLE ${qualifiedName(added.table)} ADD CONSTRAINT ${quoteName(added.name)} ${added.definition};`
      )
    );
  }

  if (constraint.clustered) {
    reasons.push('CLUSTER ON');
    statements.push(`ALTER TABLE ${table} CLUSTER ON ${name};`);
  }

  if (constraint.replicaIdentity) {
    reasons.push('replica identity');
    statements.push(
      `ALTER TABLE ${table} REPLICA IDENTITY USING INDEX ${name};`
    );
  }

  if (multiline) {
    reasons.push('line break');
  }

  const code = multiline
    ? ''
    : [...partitions, constraint]
        .map((added) =>
          statement('addConstraint', [
            nameCode(added.table, ctx),
            str(added.name),
            str(added.definition),
          ])
        )
        .join('\n');

  return withStatements(code, statements, reasons);
}
