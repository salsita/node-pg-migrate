import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';

export type RenameTypeAttributeFn = (
  typeName: Name,
  attributeName: string,
  newAttributeName: string
) => string | string[];

export type RenameTypeAttribute = RenameTypeAttributeFn & {
  reverse: RenameTypeAttributeFn;
};

export function renameTypeAttribute(
  mOptions: MigrationOptions
): RenameTypeAttribute {
  const _rename: RenameTypeAttribute = (
    typeName,
    attributeName,
    newAttributeName
  ) => {
    const typeNameStr = mOptions.literal(typeName);
    const attributeNameStr = mOptions.literal(attributeName);
    const newAttributeNameStr = mOptions.literal(newAttributeName);

    return `ALTER TYPE ${typeNameStr} RENAME ATTRIBUTE ${attributeNameStr} TO ${newAttributeNameStr};`;
  };

  _rename.reverse = (typeName, attributeName, newAttributeName) =>
    _rename(typeName, newAttributeName, attributeName);

  return _rename;
}
