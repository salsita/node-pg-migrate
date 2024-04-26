import type { MigrationOptions } from '../../types';
import type { DropOptions, Name } from '../generalTypes';

export type DropMaterializedView = (
  viewName: Name,
  options?: DropOptions
) => string;

export function dropMaterializedView(
  mOptions: MigrationOptions
): DropMaterializedView {
  const _drop: DropMaterializedView = (viewName, options = {}) => {
    const { ifExists, cascade } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const viewNameStr = mOptions.literal(viewName);

    return `DROP MATERIALIZED VIEW${ifExistsStr} ${viewNameStr}${cascadeStr};`;
  };

  return _drop;
}
