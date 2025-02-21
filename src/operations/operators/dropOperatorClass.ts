import type { MigrationOptions } from '../../migrationOptions';
import type { DropOptions, Name } from '../generalTypes';

export type DropOperatorClassOptions = DropOptions;

export type DropOperatorClass = (
  operatorClassName: Name,
  indexMethod: Name,
  dropOptions?: DropOperatorClassOptions
) => string;

export function dropOperatorClass(
  mOptions: MigrationOptions
): DropOperatorClass {
  const _drop: DropOperatorClass = (
    operatorClassName,
    indexMethod,
    options = {}
  ) => {
    const { ifExists = false, cascade = false } = options;

    const operatorClassNameStr = mOptions.literal(operatorClassName);
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return `DROP OPERATOR CLASS${ifExistsStr} ${operatorClassNameStr} USING ${indexMethod}${cascadeStr};`;
  };

  return _drop;
}
