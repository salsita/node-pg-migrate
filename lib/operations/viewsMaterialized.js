import { template, quote, formatLines } from "../utils";

const dataClause = data =>
  data !== undefined ? ` WITH${data ? "" : " NO"} DATA` : "";

export const drop = (viewName, { ifExists, cascade } = {}) =>
  template`DROP MATERIALIZED VIEW${ifExists ? " IF EXISTS" : ""} "${viewName}"${
    cascade ? " CASCADE" : ""
  };`;

export const create = (viewName, options, definition) => {
  const {
    ifNotExists,
    columns = [],
    tablespace,
    storageParameters = {},
    data
  } = options;
  const columnNames = quote(Array.isArray(columns) ? columns : [columns]).join(
    ", "
  );
  const withOptions = Object.keys(storageParameters)
    .map(
      key =>
        `${key}${
          storageParameters[key] === true ? "" : ` = ${storageParameters[key]}`
        }`
    )
    .join(", ");

  return template`CREATE MATERIALIZED VIEW${
    ifNotExists ? " IF NOT EXISTS" : ""
  } "${viewName}"${columnNames ? `(${columnNames})` : ""}${
    withOptions ? ` WITH (${withOptions})` : ""
  }${tablespace ? `TABLESPACE ${tablespace}` : ""} AS ${definition}${dataClause(
    data
  )};`;
};

export const alter = (viewName, options) => {
  const { cluster, extension, storageParameters = {} } = options;
  const clauses = [];
  if (cluster !== undefined) {
    if (cluster) {
      clauses.push(`CLUSTER ON "${cluster}"`);
    } else {
      clauses.push(`SET WITHOUT CLUSTER`);
    }
  }
  if (extension) {
    clauses.push(`DEPENDS ON EXTENSION "${extension}"`);
  }
  const withOptions = Object.keys(storageParameters)
    .filter(key => storageParameters[key])
    .map(
      key =>
        `${key}${
          storageParameters[key] === true ? "" : ` = ${storageParameters[key]}`
        }`
    )
    .join(", ");
  if (withOptions) {
    clauses.push(`SET (${withOptions})`);
  }
  const resetOptions = Object.keys(storageParameters)
    .filter(key => !storageParameters[key])
    .join(", ");
  if (resetOptions) {
    clauses.push(`RESET (${resetOptions})`);
  }
  return template`ALTER MATERIALIZED VIEW "${viewName}"\n${formatLines(
    clauses
  )};`;
};

export const rename = (viewName, newViewName) =>
  template`ALTER MATERIALIZED VIEW "${viewName}" RENAME TO "${newViewName}";`;

export const undoRename = (viewName, newViewName) =>
  rename(newViewName, viewName);

export const renameColumn = (viewName, columnName, newColumnName) =>
  template`ALTER MATERIALIZED VIEW "${viewName}" RENAME COLUMN ${columnName} TO "${newColumnName}";`;

export const undoRenameColumn = (viewName, columnName, newColumnName) =>
  renameColumn(viewName, newColumnName, columnName);

export const refresh = (viewName, { concurrently, data } = {}) =>
  template`REFRESH MATERIALIZED VIEW${
    concurrently ? " CONCURRENTLY" : ""
  } "${viewName}"${dataClause(data)};`;

create.reverse = drop;
rename.reverse = undoRename;
renameColumn.reverse = undoRenameColumn;
refresh.reverse = refresh;
