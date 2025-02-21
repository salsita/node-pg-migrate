import type { MigrationOptions } from '../../migrationOptions';
import { applyType } from '../../utils';
import type { Name, Reversible, Type } from '../generalTypes';
import type { DropTypeAttributeOptions } from './dropTypeAttribute';
import { dropTypeAttribute } from './dropTypeAttribute';

export type AddTypeAttributeFn = (
  typeName: Name,
  attributeName: string,
  attributeType: Type & DropTypeAttributeOptions
) => string;

export type AddTypeAttribute = Reversible<AddTypeAttributeFn>;

export function addTypeAttribute(mOptions: MigrationOptions): AddTypeAttribute {
  const _alterAttributeAdd: AddTypeAttribute = (
    typeName,
    attributeName,
    attributeType
  ) => {
    const typeStr = applyType(attributeType, mOptions.typeShorthands).type;
    const typeNameStr = mOptions.literal(typeName);
    const attributeNameStr = mOptions.literal(attributeName);

    return `ALTER TYPE ${typeNameStr} ADD ATTRIBUTE ${attributeNameStr} ${typeStr};`;
  };

  _alterAttributeAdd.reverse = dropTypeAttribute(mOptions);

  return _alterAttributeAdd;
}
