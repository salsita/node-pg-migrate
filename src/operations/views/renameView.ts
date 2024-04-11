import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';

export type RenameViewFn = (
  viewName: Name,
  newViewName: Name
) => string | string[];

export type RenameView = RenameViewFn & { reverse: RenameViewFn };

export function renameView(mOptions: MigrationOptions): RenameView {
  const _rename: RenameView = (viewName, newViewName) => {
    const viewNameStr = mOptions.literal(viewName);
    const newViewNameStr = mOptions.literal(newViewName);

    return `ALTER VIEW ${viewNameStr} RENAME TO ${newViewNameStr};`;
  };

  _rename.reverse = (viewName, newViewName) => _rename(newViewName, viewName);

  return _rename;
}
