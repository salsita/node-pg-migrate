import type { MigrationOptions } from '../../migrationOptions';
import type { DropOptions, Name } from '../generalTypes';

export type DropViewOptions = DropOptions;

export type DropView = (
  viewName: Name,
  dropOptions?: DropViewOptions
) => string;

export function dropView(mOptions: MigrationOptions): DropView {
  const _drop: DropView = (viewName, options = {}) => {
    const { ifExists = false, cascade = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const viewNameStr = mOptions.literal(viewName);

    return `DROP VIEW${ifExistsStr} ${viewNameStr}${cascadeStr};`;
  };

  return _drop;
}
