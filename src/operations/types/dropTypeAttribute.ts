import type { MigrationOptions } from '../../types';
import type { IfExistsOption, Name } from '../generalTypes';

export type DropTypeAttribute = (
  typeName: Name,
  attributeName: string,
  options: IfExistsOption
) => string | string[];

export function dropTypeAttribute(
  mOptions: MigrationOptions
): DropTypeAttribute {
  const _drop: DropTypeAttribute = (
    typeName,
    attributeName,
    { ifExists } = {}
  ) => {
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const typeNameStr = mOptions.literal(typeName);
    const attributeNameStr = mOptions.literal(attributeName);

    return `ALTER TYPE ${typeNameStr} DROP ATTRIBUTE ${attributeNameStr}${ifExistsStr};`;
  };

  return _drop;
}
