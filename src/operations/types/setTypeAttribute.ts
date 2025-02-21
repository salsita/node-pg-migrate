import type { MigrationOptions } from '../../migrationOptions';
import { applyType } from '../../utils';
import type { Name, Type } from '../generalTypes';

export type SetTypeAttribute = (
  typeName: Name,
  attributeName: string,
  attributeType: Type
) => string;

export function setTypeAttribute(mOptions: MigrationOptions): SetTypeAttribute {
  return (typeName, attributeName, attributeType) => {
    const typeStr = applyType(attributeType, mOptions.typeShorthands).type;
    const typeNameStr = mOptions.literal(typeName);
    const attributeNameStr = mOptions.literal(attributeName);

    return `ALTER TYPE ${typeNameStr} ALTER ATTRIBUTE ${attributeNameStr} SET DATA TYPE ${typeStr};`;
  };
}
