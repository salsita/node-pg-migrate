import type { MigrationOptions } from '../../types';
import type { DropOptions, Name } from '../generalTypes';
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
  options: CreateViewOptions & DropOptions,
  definition: string
) => string | string[];

export type CreateView = CreateViewFn & { reverse: CreateViewFn };

export function createView(mOptions: MigrationOptions): CreateView {
  const _create: CreateView = (viewName, viewOptions, definition) => {
    const {
      temporary,
      replace,
      recursive,
      columns = [],
      options = {},
      checkOption,
    } = viewOptions;

    const columnNames = (Array.isArray(columns) ? columns : [columns])
      .map(mOptions.literal)
      .join(', ');
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
