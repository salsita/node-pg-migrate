import type { MigrationOptions } from '../../types';
import { applyType } from '../../utils';
import type { IfExistsOption, Name, Type } from '../generalTypes';
import { dropTypeAttribute } from './dropTypeAttribute';

export type AddTypeAttributeFn = (
  typeName: Name,
  attributeName: string,
  attributeType: Type & IfExistsOption
) => string | string[];

export type AddTypeAttribute = AddTypeAttributeFn & {
  reverse: AddTypeAttributeFn;
};

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
