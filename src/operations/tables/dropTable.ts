import type { MigrationOptions } from '../../types';
import type { DropOptions, Name } from '../generalTypes';

export type DropTable = (tableName: Name, dropOptions?: DropOptions) => string;

export function dropTable(mOptions: MigrationOptions): DropTable {
  const _drop: DropTable = (tableName, options = {}) => {
    const { ifExists, cascade } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const tableNameStr = mOptions.literal(tableName);

    return `DROP TABLE${ifExistsStr} ${tableNameStr}${cascadeStr};`;
  };

  return _drop;
}
