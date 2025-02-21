import type { MigrationOptions } from '../../migrationOptions';
import type { Name } from '../generalTypes';
import type { OperatorListDefinition } from './shared';
import { operatorMap } from './shared';

export type RemoveFromOperatorFamily = (
  operatorFamilyName: Name,
  indexMethod: Name,
  operatorList: OperatorListDefinition[]
) => string;

export const removeFromOperatorFamily = (
  mOptions: MigrationOptions
): RemoveFromOperatorFamily => {
  const method: RemoveFromOperatorFamily = (
    operatorFamilyName,
    indexMethod,
    operatorList
  ) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);
    const operatorListStr = operatorList
      .map(operatorMap(mOptions))
      .join(',\n  ');

    return `ALTER OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod} DROP
  ${operatorListStr};`;
  };

  return method;
};
