import type { MigrationOptions } from '../../types';
import type { DropOptions, Name } from '../generalTypes';
import { dropOperatorFamily } from './dropOperatorFamily';

export type CreateOperatorFamilyFn = (
  operatorFamilyName: Name,
  indexMethod: Name,
  options?: DropOptions
) => string | string[];

export type CreateOperatorFamily = CreateOperatorFamilyFn & {
  reverse: CreateOperatorFamilyFn;
};

export function createOperatorFamily(
  mOptions: MigrationOptions
): CreateOperatorFamily {
  const _create: CreateOperatorFamily = (operatorFamilyName, indexMethod) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);

    return `CREATE OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod};`;
  };

  _create.reverse = dropOperatorFamily(mOptions);

  return _create;
}
