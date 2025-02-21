import type { MigrationOptions } from '../../migrationOptions';
import type { DropOptions, Name } from '../generalTypes';

export interface DropOperatorOptions extends DropOptions {
  left?: Name;

  right?: Name;
}

export type DropOperator = (
  operatorName: Name,
  dropOptions?: DropOperatorOptions
) => string;

export function dropOperator(mOptions: MigrationOptions): DropOperator {
  const _drop: DropOperator = (operatorName, options = {}) => {
    const {
      left = 'none',
      right = 'none',
      ifExists = false,
      cascade = false,
    } = options;

    const operatorNameStr = mOptions.schemalize(operatorName);
    const leftStr = mOptions.literal(left);
    const rightStr = mOptions.literal(right);

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return `DROP OPERATOR${ifExistsStr} ${operatorNameStr}(${leftStr}, ${rightStr})${cascadeStr};`;
  };

  return _drop;
}
