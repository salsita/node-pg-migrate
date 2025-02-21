import type { MigrationOptions } from '../../migrationOptions';
import { formatLines } from '../../utils';
import type { IfNotExistsOption, Name, Reversible } from '../generalTypes';
import type { DropColumnsOptions } from './dropColumns';
import { dropColumns } from './dropColumns';
import type { ColumnDefinitions } from './shared';
import { parseColumns } from './shared';

export type AddColumnsOptions = IfNotExistsOption;

export type AddColumnsFn = (
  tableName: Name,
  newColumns: ColumnDefinitions,
  addOptions?: AddColumnsOptions & DropColumnsOptions
) => string;

export type AddColumns = Reversible<AddColumnsFn>;

export function addColumns(mOptions: MigrationOptions): AddColumns {
  const _add: AddColumns = (tableName, columns, options = {}) => {
    const { ifNotExists = false } = options;

    const { columns: columnLines, comments: columnComments = [] } =
      parseColumns(tableName, columns, mOptions);
    const ifNotExistsStr = ifNotExists ? 'IF NOT EXISTS ' : '';
    const columnsStr = formatLines(columnLines, `  ADD ${ifNotExistsStr}`);
    const tableNameStr = mOptions.literal(tableName);
    const alterTableQuery = `ALTER TABLE ${tableNameStr}\n${columnsStr};`;
    const columnCommentsStr =
      columnComments.length > 0 ? `\n${columnComments.join('\n')}` : '';

    return `${alterTableQuery}${columnCommentsStr}`;
  };

  _add.reverse = dropColumns(mOptions);

  return _add;
}
