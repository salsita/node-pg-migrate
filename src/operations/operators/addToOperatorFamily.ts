import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';
import { removeFromOperatorFamily } from './removeFromOperatorFamily';
import type { OperatorListDefinition } from './shared';
import { operatorMap } from './shared';

export type AddToOperatorFamilyFn = (
  operatorFamilyName: Name,
  indexMethod: Name,
  operatorList: OperatorListDefinition[]
) => string | string[];

export type AddToOperatorFamily = AddToOperatorFamilyFn & {
  reverse: AddToOperatorFamilyFn;
};

export const addToOperatorFamily = (
  mOptions: MigrationOptions
): AddToOperatorFamily => {
  const method: AddToOperatorFamily = (
    operatorFamilyName,
    indexMethod,
    operatorList
  ) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);
    const operatorListStr = operatorList
      .map(operatorMap(mOptions))
      .join(',\n  ');

    return `ALTER OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod} ADD
  ${operatorListStr};`;
  };

  method.reverse = removeFromOperatorFamily(mOptions);

  return method;
};
