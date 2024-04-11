import type { MigrationOptions } from '../../types';
import type { DropOptions, Name } from '../generalTypes';

export type DropView = (
  viewName: Name,
  options?: DropOptions
) => string | string[];

export function dropView(mOptions: MigrationOptions): DropView {
  const _drop: DropView = (viewName, options = {}) => {
    const { ifExists, cascade } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const viewNameStr = mOptions.literal(viewName);

    return `DROP VIEW${ifExistsStr} ${viewNameStr}${cascadeStr};`;
  };

  return _drop;
}
