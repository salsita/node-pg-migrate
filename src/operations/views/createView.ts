import type { MigrationOptions } from '../../migrationOptions';
import { toArray } from '../../utils';
import type { Name, Reversible } from '../generalTypes';
import type { DropViewOptions } from './dropView';
import { dropView } from './dropView';
import type { ViewOptions } from './shared';
import { viewOptionStr } from './shared';

export interface CreateViewOptions {
  temporary?: boolean;

  replace?: boolean;

  recursive?: boolean;

  columns?: string | string[];

  checkOption?: 'CASCADED' | 'LOCAL';

  options?: ViewOptions;
}

export type CreateViewFn = (
  viewName: Name,
  options: CreateViewOptions & DropViewOptions,
  definition: string
) => string;

export type CreateView = Reversible<CreateViewFn>;

export function createView(mOptions: MigrationOptions): CreateView {
  const _create: CreateView = (viewName, viewOptions, definition) => {
    const {
      temporary = false,
      replace = false,
      recursive = false,
      columns = [],
      options = {},
      checkOption,
    } = viewOptions;

    const columnNames = toArray(columns).map(mOptions.literal).join(', ');
    const withOptions = Object.keys(options)
      .map(viewOptionStr(options))
      .join(', ');

    const replaceStr = replace ? ' OR REPLACE' : '';
    const temporaryStr = temporary ? ' TEMPORARY' : '';
    const recursiveStr = recursive ? ' RECURSIVE' : '';
    const columnStr = columnNames ? `(${columnNames})` : '';
    const withOptionsStr = withOptions ? ` WITH (${withOptions})` : '';
    const checkOptionStr = checkOption
      ? ` WITH ${checkOption} CHECK OPTION`
      : '';
    const viewNameStr = mOptions.literal(viewName);

    return `CREATE${replaceStr}${temporaryStr}${recursiveStr} VIEW ${viewNameStr}${columnStr}${withOptionsStr} AS ${definition}${checkOptionStr};`;
  };

  _create.reverse = dropView(mOptions);

  return _create;
}
