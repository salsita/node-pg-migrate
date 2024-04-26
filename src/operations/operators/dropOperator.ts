import type { MigrationOptions } from '../../types';
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
    const { ifExists, cascade, left, right } = options;

    const operatorNameStr = mOptions.schemalize(operatorName);
    const leftStr = mOptions.literal(left || 'none');
    const rightStr = mOptions.literal(right || 'none');

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return `DROP OPERATOR${ifExistsStr} ${operatorNameStr}(${leftStr}, ${rightStr})${cascadeStr};`;
  };

  return _drop;
}
