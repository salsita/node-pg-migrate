import type { MigrationOptions } from '../../types';
import type { DropOptions, Name } from '../generalTypes';

export type DropOperatorFamily = (
  operatorFamilyName: Name,
  newSchemaName: Name,
  dropOptions?: DropOptions
) => string | string[];

export function dropOperatorFamily(
  mOptions: MigrationOptions
): DropOperatorFamily {
  const _drop: DropOperatorFamily = (
    operatorFamilyName,
    indexMethod,
    options = {}
  ) => {
    const { ifExists, cascade } = options;

    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return `DROP OPERATOR FAMILY${ifExistsStr} ${operatorFamilyNameStr} USING ${indexMethod}${cascadeStr};`;
  };

  return _drop;
}
