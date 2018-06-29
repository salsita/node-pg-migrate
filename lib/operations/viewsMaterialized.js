const { template, quote, formatLines } = require("../utils");

const dataClause = data =>
  data !== undefined ? ` WITH${data ? "" : " NO"} DATA` : "";
const storageParameterStr = storageParameters => key => {
  const value =
    storageParameters[key] === true ? "" : ` = ${storageParameters[key]}`;
  return `${key}${value}`;
};

function dropMaterializedView(viewName, { ifExists, cascade } = {}) {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";
  return template`DROP MATERIALIZED VIEW${ifExistsStr} "${viewName}"${cascadeStr};`;
}

function createMaterializedView(viewName, options, definition) {
  const {
    ifNotExists,
    columns = [],
    tablespace,
    storageParameters = {},
    data
  } = options;
  // prettier-ignore
  const columnNames = quote(Array.isArray(columns) ? columns : [columns]).join(", ");
  const withOptions = Object.keys(storageParameters)
    .map(storageParameterStr(storageParameters))
    .join(", ");

  const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
  const columnsStr = columnNames ? `(${columnNames})` : "";
  const withOptionsStr = withOptions ? ` WITH (${withOptions})` : "";
  const tablespaceStr = tablespace ? `TABLESPACE ${tablespace}` : "";
  const dataStr = dataClause(data);

  return template`CREATE MATERIALIZED VIEW${ifNotExistsStr} "${viewName}"${columnsStr}${withOptionsStr}${tablespaceStr} AS ${definition}${dataStr};`;
}

function alterMaterializedView(viewName, options) {
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
    .map(storageParameterStr(storageParameters))
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
  const clausesStr = formatLines(clauses);
  return template`ALTER MATERIALIZED VIEW "${viewName}"\n${clausesStr};`;
}

function renameMaterializedView(viewName, newViewName) {
  return template`ALTER MATERIALIZED VIEW "${viewName}" RENAME TO "${newViewName}";`;
}

const undoRename = (viewName, newViewName) =>
  renameMaterializedView(newViewName, viewName);

function renameMaterializedViewColumn(viewName, columnName, newColumnName) {
  return template`ALTER MATERIALIZED VIEW "${viewName}" RENAME COLUMN ${columnName} TO "${newColumnName}";`;
}

const undoRenameColumn = (viewName, columnName, newColumnName) =>
  renameMaterializedViewColumn(viewName, newColumnName, columnName);

function refreshMaterializedView(viewName, { concurrently, data } = {}) {
  const concurrentlyStr = concurrently ? " CONCURRENTLY" : "";
  const dataStr = dataClause(data);
  return template`REFRESH MATERIALIZED VIEW${concurrentlyStr} "${viewName}"${dataStr};`;
}

createMaterializedView.reverse = dropMaterializedView;
renameMaterializedView.reverse = undoRename;
renameMaterializedViewColumn.reverse = undoRenameColumn;
refreshMaterializedView.reverse = refreshMaterializedView;

module.exports = {
  createMaterializedView,
  dropMaterializedView,
  alterMaterializedView,
  renameMaterializedView,
  renameMaterializedViewColumn,
  refreshMaterializedView
};
