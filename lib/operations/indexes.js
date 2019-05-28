const _ = require("lodash");
const { template, schemalize } = require("../utils");

function generateIndexName(table, columns, options) {
  if (options.name) {
    return typeof table === "object"
      ? schemalize({ schema: table.schema, name: options.name })
      : options.name;
  }
  const cols = _.isArray(columns) ? columns.join("_") : columns;
  const uniq = options.unique ? "_unique" : "";
  return template`${table}_${cols}${uniq}_index`;
}

function generateColumnString(column) {
  const openingBracketPos = column.indexOf("(");
  const closingBracketPos = column.indexOf(")");
  const isFunction =
    openingBracketPos >= 0 && closingBracketPos > openingBracketPos;
  return isFunction
    ? column // expression
    : template`"${column}"`; // single column
}

function generateColumnsString(columns) {
  return _.isArray(columns)
    ? columns.map(generateColumnString).join(", ")
    : generateColumnString(columns);
}

function createIndex(tableName, columns, options = {}) {
  /*
   columns - the column, columns, or expression to create the index on

   Options
   name - explicitly specify the name for the index
   unique - is this a unique index
   where - where clause
   concurrently -
   opclass - name of an operator class
   options.method -  [ btree | hash | gist | spgist | gin ]
   */
  const indexName = generateIndexName(
    typeof tableName === "object" ? tableName.name : tableName,
    columns,
    options
  );
  const columnsString = generateColumnsString(columns);
  const unique = options.unique ? " UNIQUE " : "";
  const concurrently = options.concurrently ? " CONCURRENTLY " : "";
  const method = options.method ? ` USING ${options.method}` : "";
  const where = options.where ? ` WHERE ${options.where}` : "";
  const opclass = options.opclass ? ` ${options.opclass}` : "";

  return template`CREATE ${unique} INDEX ${concurrently} "${indexName}" ON "${tableName}"${method} (${columnsString}${opclass})${where};`;
}

function dropIndex(tableName, columns, options = {}) {
  const { concurrently, ifExists, cascade } = options;
  const concurrentlyStr = concurrently ? " CONCURRENTLY" : "";
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const indexName = generateIndexName(tableName, columns, options);
  const cascadeStr = cascade ? " CASCADE" : "";

  return `DROP INDEX${concurrentlyStr}${ifExistsStr} "${indexName}"${cascadeStr};`;
}

// setup reverse functions
createIndex.reverse = dropIndex;

module.exports = {
  createIndex,
  dropIndex
};
