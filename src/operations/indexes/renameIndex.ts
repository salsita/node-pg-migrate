import type { MigrationOptions } from '../../migrationOptions';
import type { AlterIndexAction, IfExistsOption } from '../generalTypes';

export interface RenameIndexOptions extends IfExistsOption {
  clause?: AlterIndexAction;
  no?: boolean;
  columNumber?: number;
  colum?: boolean;
  integer?: number;
  ownedBy?: string | string[];
  noWait?: boolean;
}

export type RenameIndex = (
  name: string,
  newName: string | null,
  options?: RenameIndexOptions
) => string;

export function renameIndex(mOptions: MigrationOptions): RenameIndex {
  const _rename: RenameIndex = (name, newName, options = {}) => {
    const {
      clause = 'rename',
      no = false,
      columNumber,
      integer,
      ownedBy,
      noWait = false,
      ifExists = false,
      colum = false,
    } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const noStr = no ? ' NO' : '';
    const columStr = colum ? ' COLUMN' : '';
    const noWaitStr = noWait ? ' NOWAIT' : '';
    const listOwners = Array.isArray(ownedBy) ? ownedBy.join(', ') : ownedBy;
    const ownerByStr = ownedBy ? ` OWNED BY ${listOwners}` : '';
    const indexNameStr = mOptions.literal(name);
    const newNameStr = newName && mOptions.literal(newName);

    switch (clause) {
      case 'rename':
        return `ALTER INDEX${ifExistsStr} ${indexNameStr} RENAME TO ${newNameStr};`;
      case 'set-table':
        return `ALTER INDEX${ifExistsStr} ${indexNameStr} SET TABLESPACE ${newNameStr};`;
      case 'attach-partition':
        return `ALTER INDEX ${indexNameStr} ATTACH PARTITION ${newNameStr};`;
      case 'extension':
        return `ALTER INDEX ${indexNameStr}${noStr} DEPENDS ON EXTENSION ${newNameStr};`;
      case 'alter':
        return `ALTER INDEX${ifExistsStr} ${indexNameStr} ALTER${columStr} ${columNumber}
    SET STATISTICS ${integer};`;
      case 'all':
        return `ALTER INDEX ALL IN TABLESPACE ${indexNameStr}${ownerByStr} SET TABLESPACE ${newNameStr}${noWaitStr};`;
    }
  };

  return _rename;
}
