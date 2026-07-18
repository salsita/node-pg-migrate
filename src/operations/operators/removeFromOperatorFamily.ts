import type { MigrationOptions } from '../../migrationOptions';
import { formatLines, formatSeparator } from '../../utils';
import type { Name } from '../generalTypes';
import type { OperatorListDefinition } from './shared';
import { operatorMap } from './shared';

export type RemoveFromOperatorFamily = (
  operatorFamilyName: Name,
  indexMethod: string,
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
    const operatorListStr = formatLines(
      operatorList.map(operatorMap(mOptions)),
      '  ',
      ',',
      mOptions.pretty
    );

    return `ALTER OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod} DROP${formatSeparator(mOptions.pretty)}${operatorListStr};`;
  };

  return method;
};
