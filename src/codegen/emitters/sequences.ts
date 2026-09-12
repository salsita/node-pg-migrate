import type { Sequence } from '../../introspect/types';
import { isEmpty, object, statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteIdentifier } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { emitFallback } from './fallback';
import {
  hasUnsafeNumber,
  hasZero,
  sequenceOptionsCode,
  sequenceOptionsSql,
  writtenSequenceOptions,
} from './sequenceOptions';

/**
 * `pgm.createSequence(name, { type, increment, minvalue, maxvalue, start,
 * cache, cycle })`, leaving out the options that have their default value.
 *
 * Fallback (`CREATE [UNLOGGED] SEQUENCE …` built from the model) when the
 * sequence is unlogged, reason `'unlogged sequence'`, or when a value it has
 * to write is beyond `Number.MAX_SAFE_INTEGER`, reason `'bigint option'`, or
 * is `0`, which `createSequence` leaves out as it skips falsy values, reason
 * `'zero option'`.
 *
 * @param sequence The sequence.
 * @param ctx The migration context.
 */
export function emitSequence(sequence: Sequence, ctx: EmitContext): Emitted {
  const written = writtenSequenceOptions(sequence, 'bigint');
  const reasons: string[] = [];
  if (sequence.unlogged) {
    reasons.push('unlogged sequence');
  }

  if (hasUnsafeNumber(written)) {
    reasons.push('bigint option');
  }

  if (hasZero(written)) {
    reasons.push('zero option');
  }

  if (reasons.length > 0) {
    const clauses = sequenceOptionsSql(written)
      .map((clause) => ` ${clause}`)
      .join('');

    return emitFallback(
      `CREATE${sequence.unlogged ? ' UNLOGGED' : ''} SEQUENCE ${qualifiedName(sequence)}${clauses};`,
      reasons.join(', ')
    );
  }

  const options = object(sequenceOptionsCode(written));

  return {
    kind: 'code',
    code: statement('createSequence', [
      nameCode(sequence, ctx),
      ...(isEmpty(options) ? [] : [options]),
    ]),
  };
}

/**
 * `pgm.alterSequence(name, { owner: '<table>.<column>' })` for a sequence
 * with `ownedBy`. Never a fallback.
 *
 * The owner is written schema-qualified (`alterSequence` writes it as it
 * is), each name quoted when it needs quotes.
 *
 * @param sequence The owned sequence.
 * @param ctx The migration context.
 */
export function emitSequenceOwnership(
  sequence: Sequence,
  ctx: EmitContext
): Emitted {
  const owner = sequence.ownedBy;
  const ownerSql =
    owner === undefined
      ? 'NONE'
      : [owner.table.schema, owner.table.name, owner.column]
          .map(quoteIdentifier)
          .join('.');

  return {
    kind: 'code',
    code: statement('alterSequence', [
      nameCode(sequence, ctx),
      object([['owner', str(ownerSql)]]),
    ]),
  };
}
