import type { MigrationOptions } from '../../types';
import type { DropOptions, Name } from '../generalTypes';

export type DropOperatorClass = (
  operatorClassName: Name,
  indexMethod: Name,
  dropOptions?: DropOptions
) => string | string[];

export function dropOperatorClass(
  mOptions: MigrationOptions
): DropOperatorClass {
  const _drop: DropOperatorClass = (
    operatorClassName,
    indexMethod,
    options = {}
  ) => {
    const { ifExists, cascade } = options;

    const operatorClassNameStr = mOptions.literal(operatorClassName);
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return `DROP OPERATOR CLASS${ifExistsStr} ${operatorClassNameStr} USING ${indexMethod}${cascadeStr};`;
  };

  return _drop;
}
