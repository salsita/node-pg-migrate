import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';
import type { DropOperatorOptions } from './dropOperator';
import { dropOperator } from './dropOperator';

export interface CreateOperatorOptions {
  procedure: Name;

  left?: Name;

  right?: Name;

  commutator?: Name;

  negator?: Name;

  restrict?: Name;

  join?: Name;

  hashes?: boolean;

  merges?: boolean;
}

export type CreateOperatorFn = (
  operatorName: Name,
  operatorOptions: CreateOperatorOptions & DropOperatorOptions
) => string;

export type CreateOperator = Reversible<CreateOperatorFn>;

export function createOperator(mOptions: MigrationOptions): CreateOperator {
  const _create: CreateOperator = (operatorName, options) => {
    const {
      procedure,
      left,
      right,
      commutator,
      negator,
      restrict,
      join,
      hashes = false,
      merges = false,
    } = options;

    const defs: string[] = [];
    defs.push(`PROCEDURE = ${mOptions.literal(procedure)}`);

    if (left) {
      defs.push(`LEFTARG = ${mOptions.literal(left)}`);
    }

    if (right) {
      defs.push(`RIGHTARG = ${mOptions.literal(right)}`);
    }

    if (commutator) {
      defs.push(`COMMUTATOR = ${mOptions.schemalize(commutator)}`);
    }

    if (negator) {
      defs.push(`NEGATOR = ${mOptions.schemalize(negator)}`);
    }

    if (restrict) {
      defs.push(`RESTRICT = ${mOptions.literal(restrict)}`);
    }

    if (join) {
      defs.push(`JOIN = ${mOptions.literal(join)}`);
    }

    if (hashes) {
      defs.push('HASHES');
    }

    if (merges) {
      defs.push('MERGES');
    }

    const operatorNameStr = mOptions.schemalize(operatorName);

    return `CREATE OPERATOR ${operatorNameStr} (${defs.join(', ')});`;
  };

  _create.reverse = dropOperator(mOptions);

  return _create;
}
