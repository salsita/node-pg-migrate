const { template, quote, escapeValue } = require("../utils");

function dropView(viewName, { ifExists, cascade } = {}) {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";
  return template`DROP VIEW${ifExistsStr} "${viewName}"${cascadeStr};`;
}

function createView(viewName, options, definition) {
  const { temporary, replace, recursive, columns = [], checkOption } = options;
  // prettier-ignore
  const columnNames = quote(Array.isArray(columns) ? columns : [columns]).join(", ");
  const replaceStr = replace ? " OR REPLACE" : "";
  const temporaryStr = temporary ? " TEMPORARY" : "";
  const recursiveStr = recursive ? " RECURSIVE" : "";
  const columnStr = columnNames ? `(${columnNames})` : "";
  const checkOptionStr = checkOption ? ` WITH ${checkOption} CHECK OPTION` : "";

  return template`CREATE${replaceStr}${temporaryStr}${recursiveStr} VIEW "${viewName}"${columnStr} AS ${definition}${checkOptionStr};`;
}

function alterView(viewName, options) {
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
    .map(clause => template`ALTER VIEW "${viewName}" ${clause};`)
    .join("\n");
}

function alterViewColumn(viewName, columnName, options) {
  const { default: defaultValue } = options;
  const actions = [];
  if (defaultValue === null) {
    actions.push("DROP DEFAULT");
  } else if (defaultValue !== undefined) {
    actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`);
  }
  return actions
    .map(
      action =>
        template`ALTER VIEW "${viewName}" ALTER COLUMN ${columnName} ${action};`
    )
    .join("\n");
}

function renameView(viewName, newViewName) {
  return template`ALTER VIEW "${viewName}" RENAME TO "${newViewName}";`;
}

const undoRename = (viewName, newViewName) => renameView(newViewName, viewName);

createView.reverse = dropView;
renameView.reverse = undoRename;

module.exports = {
  createView,
  dropView,
  alterView,
  alterViewColumn,
  renameView
};
