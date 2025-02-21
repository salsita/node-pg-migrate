import type { MigrationOptions } from '../../migrationOptions';
import { escapeValue } from '../../utils';
import type { Name, Value } from '../generalTypes';

export interface AlterViewColumnOptions {
  default?: Value;
}

export type AlterViewColumn = (
  viewName: Name,
  columnName: string,
  viewColumnOptions: AlterViewColumnOptions
) => string;

export function alterViewColumn(mOptions: MigrationOptions): AlterViewColumn {
  const _alter: AlterViewColumn = (viewName, columnName, options) => {
    const { default: defaultValue } = options;

    const actions: string[] = [];

    if (defaultValue === null) {
      actions.push('DROP DEFAULT');
    } else if (defaultValue !== undefined) {
      actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`);
    }

    const viewNameStr = mOptions.literal(viewName);
    const columnNameStr = mOptions.literal(columnName);

    return actions
      .map(
        (action) =>
          `ALTER VIEW ${viewNameStr} ALTER COLUMN ${columnNameStr} ${action};`
      )
      .join('\n');
  };

  return _alter;
}
