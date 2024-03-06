import type { MigrationOptions } from '../types';
import { formatLines } from '../utils';
import type { Nullable } from './generalTypes';
import type {
  AlterMaterializedView,
  CreateMaterializedView,
  DropMaterializedView,
  RefreshMaterializedView,
  RenameMaterializedView,
  RenameMaterializedViewColumn,
  StorageParameters,
} from './viewsMaterializedTypes';

export type {
  CreateMaterializedView,
  DropMaterializedView,
  AlterMaterializedView,
  RenameMaterializedView,
  RenameMaterializedViewColumn,
  RefreshMaterializedView,
};

const dataClause = (data?: boolean) =>
  data !== undefined ? ` WITH${data ? '' : ' NO'} DATA` : '';

const storageParameterStr =
  <
    TStorageParameters extends Nullable<StorageParameters>,
    TKey extends keyof TStorageParameters,
  >(
    storageParameters: TStorageParameters
  ) =>
  (key: TKey) => {
    const value =
      storageParameters[key] === true ? '' : ` = ${storageParameters[key]}`;

    // @ts-expect-error: Implicit conversion of a 'symbol' to a 'string' will fail at runtime. Consider wrapping this expression in 'String(...)'. ts(2731)
    return `${key}${value}`;
  };

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

export function createMaterializedView(
  mOptions: MigrationOptions
): CreateMaterializedView {
  const _create: CreateMaterializedView = (viewName, options, definition) => {
    const {
      ifNotExists,
      columns = [],
      tablespace,
      storageParameters = {},
      data,
    } = options;

    const columnNames = (Array.isArray(columns) ? columns : [columns])
      .map(mOptions.literal)
      .join(', ');
    const withOptions = Object.keys(storageParameters)
      .map(storageParameterStr(storageParameters))
      .join(', ');

    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const columnsStr = columnNames ? `(${columnNames})` : '';
    const withOptionsStr = withOptions ? ` WITH (${withOptions})` : '';
    const tablespaceStr = tablespace
      ? `TABLESPACE ${mOptions.literal(tablespace)}`
      : '';
    const dataStr = dataClause(data);
    const viewNameStr = mOptions.literal(viewName);

    return `CREATE MATERIALIZED VIEW${ifNotExistsStr} ${viewNameStr}${columnsStr}${withOptionsStr}${tablespaceStr} AS ${definition}${dataStr};`;
  };

  _create.reverse = dropMaterializedView(mOptions);

  return _create;
}

export function alterMaterializedView(
  mOptions: MigrationOptions
): AlterMaterializedView {
  const _alter: AlterMaterializedView = (viewName, options) => {
    const { cluster, extension, storageParameters = {} } = options;

    const clauses: string[] = [];

    if (cluster !== undefined) {
      if (cluster) {
        clauses.push(`CLUSTER ON ${mOptions.literal(cluster)}`);
      } else {
        clauses.push('SET WITHOUT CLUSTER');
      }
    }

    if (extension) {
      clauses.push(`DEPENDS ON EXTENSION ${mOptions.literal(extension)}`);
    }

    const withOptions = Object.keys(storageParameters)
      .filter((key) => storageParameters[key] !== null)
      .map(storageParameterStr(storageParameters))
      .join(', ');

    if (withOptions) {
      clauses.push(`SET (${withOptions})`);
    }

    const resetOptions = Object.keys(storageParameters)
      .filter((key) => storageParameters[key] === null)
      .join(', ');

    if (resetOptions) {
      clauses.push(`RESET (${resetOptions})`);
    }

    const clausesStr = formatLines(clauses);
    const viewNameStr = mOptions.literal(viewName);

    return `ALTER MATERIALIZED VIEW ${viewNameStr}\n${clausesStr};`;
  };

  return _alter;
}

export function renameMaterializedView(
  mOptions: MigrationOptions
): RenameMaterializedView {
  const _rename: RenameMaterializedView = (viewName, newViewName) => {
    const viewNameStr = mOptions.literal(viewName);
    const newViewNameStr = mOptions.literal(newViewName);

    return `ALTER MATERIALIZED VIEW ${viewNameStr} RENAME TO ${newViewNameStr};`;
  };

  _rename.reverse = (viewName, newViewName) => _rename(newViewName, viewName);

  return _rename;
}

export function renameMaterializedViewColumn(
  mOptions: MigrationOptions
): RenameMaterializedViewColumn {
  const _rename: RenameMaterializedViewColumn = (
    viewName,
    columnName,
    newColumnName
  ) => {
    const viewNameStr = mOptions.literal(viewName);
    const columnNameStr = mOptions.literal(columnName);
    const newColumnNameStr = mOptions.literal(newColumnName);

    return `ALTER MATERIALIZED VIEW ${viewNameStr} RENAME COLUMN ${columnNameStr} TO ${newColumnNameStr};`;
  };

  _rename.reverse = (viewName, columnName, newColumnName) =>
    _rename(viewName, newColumnName, columnName);

  return _rename;
}

export function refreshMaterializedView(
  mOptions: MigrationOptions
): RefreshMaterializedView {
  const _refresh: RefreshMaterializedView = (viewName, options = {}) => {
    const { concurrently, data } = options;

    const concurrentlyStr = concurrently ? ' CONCURRENTLY' : '';
    const dataStr = dataClause(data);
    const viewNameStr = mOptions.literal(viewName);

    return `REFRESH MATERIALIZED VIEW${concurrentlyStr} ${viewNameStr}${dataStr};`;
  };

  _refresh.reverse = _refresh;

  return _refresh;
}
