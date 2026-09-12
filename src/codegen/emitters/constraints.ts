import type { Constraint } from '../../introspect/types';
import { statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteName } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { withStatements } from './fallback';
import { hasLineBreak } from './shared';

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
 * @param constraint The constraint.
 * @param ctx The migration context.
 */
export function emitConstraint(
  constraint: Constraint,
  ctx: EmitContext
): Emitted {
  const table = qualifiedName(constraint.table);
  const name = quoteName(constraint.name);
  const reasons: string[] = [];
  const statements: string[] = [];
  const multiline = hasLineBreak(constraint.definition);
  if (multiline) {
    statements.push(
      `ALTER TABLE ${table} ADD CONSTRAINT ${name} ${constraint.definition};`
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
    : statement('addConstraint', [
        nameCode(constraint.table, ctx),
        str(constraint.name),
        str(constraint.definition),
      ]);

  return withStatements(code, statements, reasons);
}
