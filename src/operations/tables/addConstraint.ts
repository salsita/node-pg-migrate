import type { MigrationOptions } from '../../types';
import { formatLines } from '../../utils';
import type { Name, Reversible } from '../generalTypes';
import type { DropConstraintOptions } from './dropConstraint';
import { dropConstraint } from './dropConstraint';
import type { ConstraintOptions } from './shared';
import { parseConstraints } from './shared';

export type CreateConstraintFn = (
  tableName: Name,
  constraintName: string | null,
  constraintExpressionOrOptions:
    | (ConstraintOptions & DropConstraintOptions)
    | string
) => string;

export type CreateConstraint = Reversible<CreateConstraintFn>;

export function addConstraint(mOptions: MigrationOptions): CreateConstraint {
  const _add: CreateConstraint = (
    tableName: Name,
    constraintName: string | null,
    expressionOrOptions: string | (ConstraintOptions & DropConstraintOptions)
  ) => {
    const { constraints, comments } =
      typeof expressionOrOptions === 'string'
        ? {
            constraints: [
              `${constraintName ? `CONSTRAINT ${mOptions.literal(constraintName)} ` : ''}${expressionOrOptions}`,
            ],
            comments: [],
          }
        : parseConstraints(
            tableName,
            expressionOrOptions,
            constraintName,
            mOptions.literal
          );

    const constraintStr = formatLines(constraints, '  ADD ');

    return [
      `ALTER TABLE ${mOptions.literal(tableName)}\n${constraintStr};`,
      ...comments,
    ].join('\n');
  };

  const reverse: CreateConstraintFn = (
    tableName: Name,
    constraintName: string | null,
    expressionOrOptions: string | (ConstraintOptions & DropConstraintOptions)
  ) => {
    if (constraintName === null) {
      throw new Error(
        'Impossible to automatically infer down migration for addConstraint without naming constraint'
      );
    }

    if (typeof expressionOrOptions === 'string') {
      throw new Error(
        'Impossible to automatically infer down migration for addConstraint with raw SQL expression'
      );
    }

    return dropConstraint(mOptions)(
      tableName,
      constraintName,
      expressionOrOptions
    );
  };

  _add.reverse = reverse;

  return _add;
}
