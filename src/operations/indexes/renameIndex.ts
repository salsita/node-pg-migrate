import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';

export type RenameIndexFn = (name: Name, newName: Name) => string;
export type RenameIndex = Reversible<RenameIndexFn>;

export function renameIndex(mOptions: MigrationOptions): RenameIndex {
  const _rename: RenameIndex = (name, newName) => {
    const indexNameStr = mOptions.literal(name);
    const newNameStr = mOptions.literal(newName);

    return `ALTER INDEX ${indexNameStr} RENAME TO ${newNameStr};`;
  };

  _rename.reverse = (name, newName) => _rename(newName, name);

  return _rename;
}
