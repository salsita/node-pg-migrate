import { escapeValue } from '../utils';
import { Value } from '../definitions';

export interface CreateViewOptions {
  temporary?: boolean;
  replace?: boolean;
  recursive?: boolean;
  columns?: string | string[];
  checkOption?: 'CASCADED' | 'LOCAL';
}

export interface AlterViewOptions {
  checkOption?: null | false | 'CASCADED' | 'LOCAL';
}

export interface AlterViewColumnOptions {
  default?: Value;
}

export function dropView(mOptions) {
  const _drop = (viewName, { ifExists, cascade } = {}) => {
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const viewNameStr = mOptions.literal(viewName);
    return `DROP VIEW${ifExistsStr} ${viewNameStr}${cascadeStr};`;
  };
  return _drop;
}

export function createView(mOptions) {
  const _create = (viewName, options, definition) => {
    const {
      temporary,
      replace,
      recursive,
      columns = [],
      checkOption
    } = options;
    // prettier-ignore
    const columnNames = (Array.isArray(columns) ? columns : [columns]).map(mOptions.literal).join(", ");
    const replaceStr = replace ? ' OR REPLACE' : '';
    const temporaryStr = temporary ? ' TEMPORARY' : '';
    const recursiveStr = recursive ? ' RECURSIVE' : '';
    const columnStr = columnNames ? `(${columnNames})` : '';
    const checkOptionStr = checkOption
      ? ` WITH ${checkOption} CHECK OPTION`
      : '';
    const viewNameStr = mOptions.literal(viewName);

    return `CREATE${replaceStr}${temporaryStr}${recursiveStr} VIEW ${viewNameStr}${columnStr} AS ${definition}${checkOptionStr};`;
  };
  _create.reverse = dropView(mOptions);
  return _create;
}

export function alterView(mOptions) {
  const _alter = (viewName, options) => {
    const { checkOption } = options;
    const clauses = [];
    if (checkOption !== undefined) {
      if (checkOption) {
        clauses.push(`SET check_option = ${checkOption}`);
      } else {
        clauses.push(`RESET check_option`);
      }
    }
    return clauses
      .map(clause => `ALTER VIEW ${mOptions.literal(viewName)} ${clause};`)
      .join('\n');
  };
  return _alter;
}

export function alterViewColumn(mOptions) {
  const _alter = (viewName, columnName, options) => {
    const { default: defaultValue } = options;
    const actions = [];
    if (defaultValue === null) {
      actions.push('DROP DEFAULT');
    } else if (defaultValue !== undefined) {
      actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`);
    }
    const viewNameStr = mOptions.literal(viewName);
    const columnNameStr = mOptions.literal(columnName);
    return actions
      .map(
        action =>
          `ALTER VIEW ${viewNameStr} ALTER COLUMN ${columnNameStr} ${action};`
      )
      .join('\n');
  };
  return _alter;
}

export function renameView(mOptions) {
  const _rename = (viewName, newViewName) => {
    const viewNameStr = mOptions.literal(viewName);
    const newViewNameStr = mOptions.literal(newViewName);
    return `ALTER VIEW ${viewNameStr} RENAME TO ${newViewNameStr};`;
  };
  _rename.reverse = (viewName, newViewName) => _rename(newViewName, viewName);
  return _rename;
}
