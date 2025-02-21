import type { MigrationOptions } from '../../migrationOptions';
import type { DropOptions, Name } from '../generalTypes';

export type DropMaterializedViewOptions = DropOptions;

export type DropMaterializedView = (
  viewName: Name,
  dropOptions?: DropMaterializedViewOptions
) => string;

export function dropMaterializedView(
  mOptions: MigrationOptions
): DropMaterializedView {
  const _drop: DropMaterializedView = (viewName, options = {}) => {
    const { ifExists = false, cascade = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const viewNameStr = mOptions.literal(viewName);

    return `DROP MATERIALIZED VIEW${ifExistsStr} ${viewNameStr}${cascadeStr};`;
  };

  return _drop;
}
