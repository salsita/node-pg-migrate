import type { MigrationOptions } from '../../migrationOptions';
import type { Reversible } from '../generalTypes';

export type RenameIndexFn = (name: string, newName: string) => string;
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
