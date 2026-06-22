import type { MigrationOptions } from '../../migrationOptions';
import type { AlterIndexAction, IfExistsOption } from '../generalTypes';

export interface AlterIndexOptions extends IfExistsOption {
  clause?: AlterIndexAction;
  no?: boolean;
  ownedBy?: string | string[];
  noWait?: boolean;
  // integer?: number; -- breaking change, not supported yet
  // columNumber?: number; -- breaking change, not supported yet
  // colum?: boolean; -- breaking change, not supported yet
}

export type AlterIndex = (
  name: string,
  newName: string,
  options?: AlterIndexOptions
  // newName: string | AlterIndexOptions, -- breaking change, not supported yet
) => string;

export function alterIndex(mOptions: MigrationOptions): AlterIndex {
  const _alter: AlterIndex = (name, newName, options = {}) => {
    const {
      clause = 'set-table',
      no = false,
      ownedBy,
      noWait = false,
      ifExists = false,
      // columNumber, -- breaking change, not supported yet
      // colum = false, -- breaking change, not supported yet
      // integer,  -- breaking change, not supported yet
    } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const noStr = no ? ' NO' : '';
    const noWaitStr = noWait ? ' NOWAIT' : '';
    const listOwners = Array.isArray(ownedBy) ? ownedBy.join(', ') : ownedBy;
    const ownerByStr = ownedBy ? ` OWNED BY ${listOwners}` : '';
    const indexNameStr = mOptions.literal(name);
    const newNameStr = newName && mOptions.literal(newName);
    // const columStr = colum ? " COLUMN" : ""; -- breaking change, not supported yet

    switch (clause) {
      case 'set-table':
        return `ALTER INDEX${ifExistsStr} ${indexNameStr} SET TABLESPACE ${newNameStr};`;
      case 'attach-partition':
        return `ALTER INDEX ${indexNameStr} ATTACH PARTITION ${newNameStr};`;
      case 'extension':
        return `ALTER INDEX ${indexNameStr}${noStr} DEPENDS ON EXTENSION ${newNameStr};`;
      // case "alter": -- breaking change, not supported yet
      //   return `ALTER INDEX${ifExistsStr} ${indexNameStr} ALTER${columStr} ${columNumber} SET STATISTICS ${integer};`;
      case 'all':
        return `ALTER INDEX ALL IN TABLESPACE ${indexNameStr}${ownerByStr} SET TABLESPACE ${newNameStr}${noWaitStr};`;
    }
  };

  return _alter;
}
