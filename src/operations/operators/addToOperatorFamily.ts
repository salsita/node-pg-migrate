import type { MigrationOptions } from '../../migrationOptions';
import { formatLines, formatSeparator } from '../../utils';
import type { Name, Reversible } from '../generalTypes';
import { removeFromOperatorFamily } from './removeFromOperatorFamily';
import type { OperatorListDefinition } from './shared';
import { operatorMap } from './shared';

export type AddToOperatorFamilyFn = (
  operatorFamilyName: Name,
  indexMethod: string,
  operatorList: OperatorListDefinition[]
) => string;

export type AddToOperatorFamily = Reversible<AddToOperatorFamilyFn>;

export const addToOperatorFamily = (
  mOptions: MigrationOptions
): AddToOperatorFamily => {
  const method: AddToOperatorFamily = (
    operatorFamilyName,
    indexMethod,
    operatorList
  ) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);
    const operatorListStr = formatLines(
      operatorList.map(operatorMap(mOptions)),
      '  ',
      ',',
      mOptions.pretty
    );

    return `ALTER OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod} ADD${formatSeparator(mOptions.pretty)}${operatorListStr};`;
  };

  method.reverse = removeFromOperatorFamily(mOptions);

  return method;
};
