import type { MigrationOptions } from '../../migrationOptions';
import type { IfExistsOption, Name } from '../generalTypes';

export type DropTypeAttributeOptions = IfExistsOption;

export type DropTypeAttribute = (
  typeName: Name,
  attributeName: string,
  dropOptions?: DropTypeAttributeOptions
) => string;

export function dropTypeAttribute(
  mOptions: MigrationOptions
): DropTypeAttribute {
  const _drop: DropTypeAttribute = (typeName, attributeName, options = {}) => {
    const { ifExists = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const typeNameStr = mOptions.literal(typeName);
    const attributeNameStr = mOptions.literal(attributeName);

    return `ALTER TYPE ${typeNameStr} DROP ATTRIBUTE ${attributeNameStr}${ifExistsStr};`;
  };

  return _drop;
}
