import type { MigrationOptions } from '../../migrationOptions';
import { applyType } from '../../utils';
import type { Name, Reversible, Type } from '../generalTypes';
import type { DropOperatorClassOptions } from './dropOperatorClass';
import { dropOperatorClass } from './dropOperatorClass';
import type { OperatorListDefinition } from './shared';
import { operatorMap } from './shared';

export interface CreateOperatorClassOptions {
  default?: boolean;

  family?: string;
}

export type CreateOperatorClassFn = (
  operatorClassName: Name,
  type: Type,
  indexMethod: Name,
  operatorList: OperatorListDefinition[],
  operatorClassOptions: CreateOperatorClassOptions & DropOperatorClassOptions
) => string;

export type CreateOperatorClass = Reversible<CreateOperatorClassFn>;

export function createOperatorClass(
  mOptions: MigrationOptions
): CreateOperatorClass {
  const _create: CreateOperatorClass = (
    operatorClassName,
    type,
    indexMethod,
    operatorList,
    options
  ) => {
    const { default: isDefault, family } = options;

    const operatorClassNameStr = mOptions.literal(operatorClassName);
    const defaultStr = isDefault ? ' DEFAULT' : '';
    const typeStr = mOptions.literal(applyType(type).type);
    const indexMethodStr = mOptions.literal(indexMethod);
    const familyStr = family ? ` FAMILY ${family}` : '';
    const operatorListStr = operatorList
      .map(operatorMap(mOptions))
      .join(',\n  ');

    return `CREATE OPERATOR CLASS ${operatorClassNameStr}${defaultStr} FOR TYPE ${typeStr} USING ${indexMethodStr}${familyStr} AS
  ${operatorListStr};`;
  };

  _create.reverse = (
    operatorClassName,
    type,
    indexMethod,
    operatorList,
    options
  ) => dropOperatorClass(mOptions)(operatorClassName, indexMethod, options);

  return _create;
}
