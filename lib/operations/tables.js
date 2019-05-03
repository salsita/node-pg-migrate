const _ = require("lodash");
const {
  escapeValue,
  template,
  quote,
  applyType,
  applyTypeAdapters,
  comment,
  schemalize,
  formatLines
} = require("../utils");
const { parseSequenceOptions } = require("./sequences");

const parseReferences = options => {
  const {
    references,
    referencesConstraintName,
    match,
    onDelete,
    onUpdate
  } = options;
  const clauses = [];
  if (referencesConstraintName) {
    clauses.push(`CONSTRAINT "${referencesConstraintName}"`);
  }
  clauses.push(
    typeof references === "string"
      ? `REFERENCES ${references}`
      : template`REFERENCES "${references}"`
  );
  if (match) {
    clauses.push(`MATCH ${match}`);
  }
  if (onDelete) {
    clauses.push(`ON DELETE ${onDelete}`);
  }
  if (onUpdate) {
    clauses.push(`ON UPDATE ${onUpdate}`);
  }
  return clauses.join(" ");
};

const parseDeferrable = options => {
  const { deferrable, deferred } = options;
  return deferrable
    ? `DEFERRABLE INITIALLY ${deferred ? "DEFERRED" : "IMMEDIATE"}`
    : null;
};

const parseColumns = (tableName, columns, extendingTypeShorthands = {}) => {
  let columnsWithOptions = _.mapValues(columns, column =>
    applyType(column, extendingTypeShorthands)
  );

  const primaryColumns = _.chain(columnsWithOptions)
    .map((options, columnName) => (options.primaryKey ? columnName : null))
    .filter()
    .value();
  const multiplePrimaryColumns = primaryColumns.length > 1;

  if (multiplePrimaryColumns) {
    columnsWithOptions = _.mapValues(columnsWithOptions, options => ({
      ...options,
      primaryKey: false
    }));
  }

  const comments = _.chain(columnsWithOptions)
    .map(
      (options, columnName) =>
        typeof options.comment !== "undefined" &&
        comment(
          "COLUMN",
          `${schemalize(tableName)}"."${columnName}`,
          options.comment
        )
    )
    .filter()
    .value();

  return {
    columns: _.map(columnsWithOptions, (options, columnName) => {
      const {
        type,
        collation,
        default: defaultValue,
        unique,
        primaryKey,
        notNull,
        check,
        references,
        deferrable,
        generated
      } = options;
      const constraints = [];
      if (collation) {
        constraints.push(`COLLATE ${collation}`);
      }
      if (defaultValue !== undefined) {
        constraints.push(`DEFAULT ${escapeValue(defaultValue)}`);
      }
      if (unique) {
        constraints.push("UNIQUE");
      }
      if (primaryKey) {
        constraints.push("PRIMARY KEY");
      }
      if (notNull) {
        constraints.push("NOT NULL");
      }
      if (check) {
        constraints.push(`CHECK (${check})`);
      }
      if (references) {
        constraints.push(parseReferences(options));
      }
      if (deferrable) {
        constraints.push(parseDeferrable(options));
      }
      if (generated) {
        const sequenceOptions = parseSequenceOptions(
          extendingTypeShorthands,
          generated
        ).join(" ");
        constraints.push(
          `GENERATED ${generated.precedence} AS IDENTITY${
            sequenceOptions ? ` (${sequenceOptions})` : ""
          }`
        );
      }

      const constraintsStr = constraints.length
        ? ` ${constraints.join(" ")}`
        : "";

      const sType = typeof type === "object" ? `"${schemalize(type)}"` : type;

      return template`"${columnName}" ${sType}${constraintsStr}`;
    }),
    constraints: {
      ...(multiplePrimaryColumns ? { primaryKey: primaryColumns } : {})
    },
    comments
  };
};

const parseConstraints = (table, options, genName) => {
  const {
    check,
    unique,
    primaryKey,
    foreignKeys,
    exclude,
    deferrable
  } = options;
  const tableName = typeof table === "object" ? table.name : table;
  const constraints = [];
  if (check) {
    if (_.isArray(check)) {
      check.forEach((ch, i) => {
        const name = genName ? `CONSTRAINT "${tableName}_chck_${i + 1}" ` : "";
        constraints.push(`${name}CHECK (${ch})`);
      });
    } else {
      const name = genName ? `CONSTRAINT "${tableName}_chck" ` : "";
      constraints.push(`${name}CHECK (${check})`);
    }
  }
  if (unique) {
    const uniqueArray = _.isArray(unique) ? unique : [unique];
    const isArrayOfArrays = uniqueArray.some(uniqueSet => _.isArray(uniqueSet));
    (isArrayOfArrays ? uniqueArray : [uniqueArray]).forEach(uniqueSet => {
      const cols = _.isArray(uniqueSet) ? uniqueSet : [uniqueSet];
      const name = genName
        ? `CONSTRAINT "${tableName}_uniq_${cols.join("_")}" `
        : "";
      constraints.push(`${name}UNIQUE (${quote(cols).join(", ")})`);
    });
  }
  if (primaryKey) {
    const name = genName ? `CONSTRAINT "${tableName}_pkey" ` : "";
    const key = quote(_.isArray(primaryKey) ? primaryKey : [primaryKey]).join(
      ", "
    );
    constraints.push(`${name}PRIMARY KEY (${key})`);
  }
  if (foreignKeys) {
    (_.isArray(foreignKeys) ? foreignKeys : [foreignKeys]).forEach(fk => {
      const { columns } = fk;
      const cols = _.isArray(columns) ? columns : [columns];
      const name = genName
        ? `CONSTRAINT "${tableName}_fk_${cols.join("_")}" `
        : "";
      const key = quote(cols).join(", ");
      constraints.push(`${name}FOREIGN KEY (${key}) ${parseReferences(fk)}`);
    });
  }
  if (exclude) {
    const name = genName ? `CONSTRAINT "${tableName}_excl" ` : "";
    constraints.push(`${name}EXCLUDE ${exclude}`);
  }

  return deferrable
    ? constraints.map(constraint => `${constraint} ${parseDeferrable(options)}`)
    : constraints;
};

const parseLike = like => {
  const formatOptions = (name, options) =>
    (_.isArray(options) ? options : [options])
      .map(option => ` ${name} ${option}`)
      .join("");

  const table = typeof like === "string" || !like.table ? like : like.table;
  const options = like.options
    ? [
        formatOptions("INCLUDING", like.options.including),
        formatOptions("EXCLUDING", like.options.excluding)
      ].join("")
    : "";
  return template`LIKE "${table}"${options}`;
};

// TABLE
function dropTable(tableName, { ifExists, cascade } = {}) {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";
  return template`DROP TABLE${ifExistsStr} "${tableName}"${cascadeStr};`;
}

function createTable(typeShorthands) {
  const _create = (tableName, columns, options = {}) => {
    const {
      temporary,
      ifNotExists,
      inherits,
      like,
      constraints: optionsConstraints = {},
      comment: tableComment
    } = options;
    const {
      columns: columnLines,
      constraints: columnsConstraints,
      comments: columnComments = []
    } = parseColumns(tableName, columns, typeShorthands);
    const dupes = _.intersection(
      Object.keys(optionsConstraints),
      Object.keys(columnsConstraints)
    );
    if (dupes.length > 0) {
      const dupesStr = dupes.join(", ");
      throw new Error(
        `There is duplicate constraint definition in table and columns options: ${dupesStr}`
      );
    }

    const constraints = { ...optionsConstraints, ...columnsConstraints };
    const constraintLines = parseConstraints(tableName, constraints, true);
    const tableDefinition = [...columnLines, ...constraintLines].concat(
      like ? [parseLike(like)] : []
    );

    const temporaryStr = temporary ? " TEMPORARY" : "";
    const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
    const inheritsStr = inherits ? template` INHERITS ("${inherits}")` : "";

    const createTableQuery = template`CREATE TABLE${temporaryStr}${ifNotExistsStr} "${tableName}" (
${formatLines(tableDefinition)}
)${inheritsStr};`;
    const comments = columnComments;
    if (typeof tableComment !== "undefined") {
      comments.push(comment("TABLE ", tableName, tableComment));
    }
    return `${createTableQuery}${
      comments.length > 0 ? `\n${comments.join("\n")}` : ""
    }`;
  };
  _create.reverse = dropTable;
  return _create;
}

function alterTable(tableName, options) {
  const alterDefinition = [];
  if (options.levelSecurity) {
    alterDefinition.push(`${options.levelSecurity} ROW LEVEL SECURITY`);
  }
  return template`ALTER TABLE "${tableName}"
${formatLines(alterDefinition)};`;
}

// COLUMNS
function dropColumns(tableName, columns, { ifExists, cascade } = {}) {
  if (typeof columns === "string") {
    columns = [columns]; // eslint-disable-line no-param-reassign
  } else if (!_.isArray(columns) && typeof columns === "object") {
    columns = _.keys(columns); // eslint-disable-line no-param-reassign
  }
  const columnsStr = formatLines(
    quote(columns),
    `  DROP ${ifExists ? " IF EXISTS" : ""}`,
    `${cascade ? " CASCADE" : ""},`
  );
  return template`ALTER TABLE "${tableName}"
${columnsStr};`;
}

function addColumns(typeShorthands) {
  const _add = (tableName, columns, { ifNotExists } = {}) => {
    const {
      columns: columnLines,
      comments: columnComments = []
    } = parseColumns(tableName, columns, typeShorthands);
    const columnsStr = formatLines(
      columnLines,
      `  ADD ${ifNotExists ? "IF NOT EXISTS " : ""}`
    );
    const alterTableQuery = template`ALTER TABLE "${tableName}"\n${columnsStr};`;
    const columnCommentsStr =
      columnComments.length > 0 ? `\n${columnComments.join("\n")}` : "";
    return `${alterTableQuery}${columnCommentsStr}`;
  };
  _add.reverse = dropColumns;
  return _add;
}

function alterColumn(typeShorthands) {
  return (tableName, columnName, options) => {
    const {
      default: defaultValue,
      type,
      collation,
      using,
      notNull,
      allowNull,
      comment: columnComment,
      generated
    } = options;
    const actions = [];
    if (defaultValue === null) {
      actions.push("DROP DEFAULT");
    } else if (defaultValue !== undefined) {
      actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`);
    }
    if (type) {
      const typeStr = applyTypeAdapters(type);
      const collationStr = collation ? `COLLATE ${collation}` : "";
      const usingStr = using ? ` USING ${using}` : "";
      actions.push(`SET DATA TYPE ${typeStr}${collationStr}${usingStr}`);
    }
    if (notNull) {
      actions.push("SET NOT NULL");
    } else if (notNull === false || allowNull) {
      actions.push("DROP NOT NULL");
    }
    if (generated !== undefined) {
      if (!generated) {
        actions.push("DROP IDENTITY");
      } else {
        const sequenceOptions = parseSequenceOptions(
          typeShorthands,
          generated
        ).join(" ");
        actions.push(
          `SET GENERATED ${generated.precedence} AS IDENTITY${
            sequenceOptions ? ` (${sequenceOptions})` : ""
          }`
        );
      }
    }

    const queries = [];
    if (actions.length > 0) {
      const columnsStr = formatLines(actions, `  ALTER "${columnName}" `);
      queries.push(template`ALTER TABLE "${tableName}"\n${columnsStr};`);
    }
    if (typeof columnComment !== "undefined") {
      queries.push(
        comment(
          "COLUMN ",
          template`${tableName}"."${columnName}`,
          columnComment
        )
      );
    }
    return queries.join("\n");
  };
}

function renameTable(tableName, newName) {
  return template`ALTER TABLE "${tableName}" RENAME TO "${newName}";`;
}

const undoRenameTable = (tableName, newName) => renameTable(newName, tableName);

function renameColumn(tableName, columnName, newName) {
  return template`ALTER TABLE "${tableName}" RENAME "${columnName}" TO "${newName}";`;
}

const undoRenameColumn = (tableName, columnName, newName) =>
  renameColumn(tableName, newName, columnName);

function renameConstraint(tableName, constraintName, newName) {
  return template`ALTER TABLE "${tableName}" RENAME CONSTRAINT "${constraintName}" TO "${newName}";`;
}

const undoRenameConstraint = (tableName, constraintName, newName) =>
  renameConstraint(tableName, newName, constraintName);

function addConstraint(tableName, constraintName, expression) {
  const constraint = constraintName ? `CONSTRAINT "${constraintName}" ` : "";
  const constraintStr = formatLines(
    typeof expression === "string"
      ? [expression]
      : parseConstraints(tableName, expression, false),
    `  ADD ${constraint}`
  );
  return template`ALTER TABLE "${tableName}"\n${constraintStr};`;
}

function dropConstraint(tableName, constraintName, { ifExists, cascade } = {}) {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";
  return template`ALTER TABLE "${tableName}" DROP CONSTRAINT${ifExistsStr} "${constraintName}"${cascadeStr};`;
}

addColumns.reverse = dropColumns;
addConstraint.reverse = dropConstraint;
renameColumn.reverse = undoRenameColumn;
renameConstraint.reverse = undoRenameConstraint;
renameTable.reverse = undoRenameTable;

module.exports = {
  createTable,
  dropTable,
  alterTable,
  renameTable,
  addColumns,
  dropColumns,
  alterColumn,
  renameColumn,
  addConstraint,
  dropConstraint,
  renameConstraint
};
