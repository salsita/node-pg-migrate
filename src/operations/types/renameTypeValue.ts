import type { MigrationOptions } from '../../migrationOptions';
import { escapeValue } from '../../utils';
import type { Name, Reversible } from '../generalTypes';

export type RenameTypeValueFn = (
  typeName: Name,
  value: string,
  newValue: string
) => string;

export type RenameTypeValue = Reversible<RenameTypeValueFn>;

export function renameTypeValue(mOptions: MigrationOptions): RenameTypeValue {
  const _rename: RenameTypeValue = (typeName, value, newValue) => {
    const valueStr = escapeValue(value);
    const newValueStr = escapeValue(newValue);
    const typeNameStr = mOptions.literal(typeName);

    return `ALTER TYPE ${typeNameStr} RENAME VALUE ${valueStr} TO ${newValueStr};`;
  };

  _rename.reverse = (typeName, value, newValue) =>
    _rename(typeName, newValue, value);

  return _rename;
}
