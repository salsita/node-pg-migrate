import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';

export type RenameTypeFn = (
  typeName: Name,
  newTypeName: Name
) => string | string[];

export type RenameType = RenameTypeFn & { reverse: RenameTypeFn };

export function renameType(mOptions: MigrationOptions): RenameType {
  const _rename: RenameType = (typeName, newTypeName) => {
    const typeNameStr = mOptions.literal(typeName);
    const newTypeNameStr = mOptions.literal(newTypeName);

    return `ALTER TYPE ${typeNameStr} RENAME TO ${newTypeNameStr};`;
  };

  _rename.reverse = (typeName, newTypeName) => _rename(newTypeName, typeName);

  return _rename;
}
