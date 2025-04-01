import type { MigrationOptions } from '../../migrationOptions';
import type { DropOptions, Name } from '../generalTypes';

export type DropTableOptions = DropOptions;

export type DropTable = (
  tableName: Name,
  dropOptions?: DropTableOptions
) => string;

export function dropTable(mOptions: MigrationOptions): DropTable {
  const _drop: DropTable = (tableName, options = {}) => {
    const { ifExists = false, cascade = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const tableNameStr = mOptions.literal(tableName);

    return `DROP TABLE${ifExistsStr} ${tableNameStr}${cascadeStr};`;
  };

  return _drop;
}
