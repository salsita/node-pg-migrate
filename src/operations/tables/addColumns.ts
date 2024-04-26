import type { MigrationOptions } from '../../types';
import { formatLines } from '../../utils';
import type {
  DropOptions,
  IfNotExistsOption,
  Name,
  Reversible,
} from '../generalTypes';
import { dropColumns } from './dropColumns';
import type { ColumnDefinitions } from './shared';
import { parseColumns } from './shared';

export type AddColumnsFn = (
  tableName: Name,
  newColumns: ColumnDefinitions,
  addOptions?: IfNotExistsOption & DropOptions
) => string;

export type AddColumns = Reversible<AddColumnsFn>;

export function addColumns(mOptions: MigrationOptions): AddColumns {
  const _add: AddColumns = (tableName, columns, options = {}) => {
    const { ifNotExists } = options;

    const { columns: columnLines, comments: columnComments = [] } =
      parseColumns(tableName, columns, mOptions);
    const columnsStr = formatLines(
      columnLines,
      `  ADD ${ifNotExists ? 'IF NOT EXISTS ' : ''}`
    );
    const tableNameStr = mOptions.literal(tableName);
    const alterTableQuery = `ALTER TABLE ${tableNameStr}\n${columnsStr};`;
    const columnCommentsStr =
      columnComments.length > 0 ? `\n${columnComments.join('\n')}` : '';

    return `${alterTableQuery}${columnCommentsStr}`;
  };

  _add.reverse = dropColumns(mOptions);

  return _add;
}
