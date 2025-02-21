import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';
import { dataClause } from './shared';

export interface RefreshMaterializedViewOptions {
  concurrently?: boolean;

  data?: boolean;
}

export type RefreshMaterializedViewFn = (
  viewName: Name,
  materializedViewOptions?: RefreshMaterializedViewOptions
) => string;

export type RefreshMaterializedView = Reversible<RefreshMaterializedViewFn>;

export function refreshMaterializedView(
  mOptions: MigrationOptions
): RefreshMaterializedView {
  const _refresh: RefreshMaterializedView = (viewName, options = {}) => {
    const { concurrently = false, data } = options;

    const concurrentlyStr = concurrently ? ' CONCURRENTLY' : '';
    const dataStr = dataClause(data);
    const viewNameStr = mOptions.literal(viewName);

    return `REFRESH MATERIALIZED VIEW${concurrentlyStr} ${viewNameStr}${dataStr};`;
  };

  _refresh.reverse = _refresh;

  return _refresh;
}
