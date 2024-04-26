import type { MigrationOptions } from '../../types';
import { formatLines } from '../../utils';
import type { DropOptions, Name } from '../generalTypes';

export type DropColumns = (
  tableName: Name,
  columns: string | string[] | { [name: string]: unknown },
  dropOptions?: DropOptions
) => string;

export function dropColumns(mOptions: MigrationOptions): DropColumns {
  const _drop: DropColumns = (tableName, columns, options = {}) => {
    const { ifExists, cascade } = options;

    if (typeof columns === 'string') {
      columns = [columns];
    } else if (!Array.isArray(columns) && typeof columns === 'object') {
      columns = Object.keys(columns);
    }

    const columnsStr = formatLines(
      columns.map(mOptions.literal),
      `  DROP ${ifExists ? 'IF EXISTS ' : ''}`,
      `${cascade ? ' CASCADE' : ''},`
    );

    return `ALTER TABLE ${mOptions.literal(tableName)}
${columnsStr};`;
  };

  return _drop;
}
