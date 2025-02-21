import type { MigrationOptions } from '../../migrationOptions';
import type { DropOptions, Name } from '../generalTypes';

export type DropOperatorFamilyOptions = DropOptions;

export type DropOperatorFamily = (
  operatorFamilyName: Name,
  newSchemaName: Name,
  dropOptions?: DropOperatorFamilyOptions
) => string;

export function dropOperatorFamily(
  mOptions: MigrationOptions
): DropOperatorFamily {
  const _drop: DropOperatorFamily = (
    operatorFamilyName,
    indexMethod,
    options = {}
  ) => {
    const { ifExists = false, cascade = false } = options;

    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return `DROP OPERATOR FAMILY${ifExistsStr} ${operatorFamilyNameStr} USING ${indexMethod}${cascadeStr};`;
  };

  return _drop;
}
