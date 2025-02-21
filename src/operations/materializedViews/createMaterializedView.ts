import type { MigrationOptions } from '../../migrationOptions';
import { toArray } from '../../utils';
import type { IfNotExistsOption, Name, Reversible } from '../generalTypes';
import type { DropMaterializedViewOptions } from './dropMaterializedView';
import { dropMaterializedView } from './dropMaterializedView';
import type { StorageParameters } from './shared';
import { dataClause, storageParameterStr } from './shared';

export interface CreateMaterializedViewOptions extends IfNotExistsOption {
  columns?: string | string[];

  tablespace?: string;

  storageParameters?: StorageParameters;

  data?: boolean;
}

export type CreateMaterializedViewFn = (
  viewName: Name,
  materializedViewOptions: CreateMaterializedViewOptions &
    DropMaterializedViewOptions,
  definition: string
) => string;

export type CreateMaterializedView = Reversible<CreateMaterializedViewFn>;

export function createMaterializedView(
  mOptions: MigrationOptions
): CreateMaterializedView {
  const _create: CreateMaterializedView = (viewName, options, definition) => {
    const {
      ifNotExists = false,
      columns = [],
      tablespace,
      storageParameters = {},
      data,
    } = options;

    const columnNames = toArray(columns).map(mOptions.literal).join(', ');
    const withOptions = Object.keys(storageParameters)
      .map(storageParameterStr(storageParameters))
      .join(', ');

    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const columnsStr = columnNames ? `(${columnNames})` : '';
    const withOptionsStr = withOptions ? ` WITH (${withOptions})` : '';
    const tablespaceStr = tablespace
      ? ` TABLESPACE ${mOptions.literal(tablespace)}`
      : '';
    const dataStr = dataClause(data);
    const viewNameStr = mOptions.literal(viewName);

    return `CREATE MATERIALIZED VIEW${ifNotExistsStr} ${viewNameStr}${columnsStr}${withOptionsStr}${tablespaceStr} AS ${definition}${dataStr};`;
  };

  _create.reverse = dropMaterializedView(mOptions);

  return _create;
}
