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
  const { references, match, onDelete, onUpdate } = options;
  const clauses = [];
  clauses.push(
    typeof references === "string" &&
      (references.startsWith('"') || references.endsWith(")"))
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

const parseDeferrable = options =>
  `DEFERRABLE INITIALLY ${options.deferred ? "DEFERRED" : "IMMEDIATE"}`;

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
        referencesConstraintName,
        referencesConstraintComment,
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
        const name =
          referencesConstraintName ||
          (referencesConstraintComment ? `${tableName}_fk_${columnName}` : "");
        constraints.push(
          (name ? `CONSTRAINT "${name}" ` : "") + parseReferences(options)
        );
        if (referencesConstraintComment) {
          comments.push(
            comment(
              `CONSTRAINT "${name}" ON`,
              tableName,
              referencesConstraintComment
            )
          );
        }
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
    constraints: multiplePrimaryColumns ? { primaryKey: primaryColumns } : {},
    comments
  };
};

const parseConstraints = (table, options, optionName) => {
  const {
    check,
    unique,
    primaryKey,
    foreignKeys,
    exclude,
    deferrable,
    comment: optionComment
  } = options;
  const tableName = typeof table === "object" ? table.name : table;
  let constraints = [];
  const comments = [];
  if (check) {
    if (_.isArray(check)) {
      check.forEach((ch, i) => {
        const name = optionName || `${tableName}_chck_${i + 1}`;
        constraints.push(`CONSTRAINT "${name}" CHECK (${ch})`);
      });
    } else {
      const name = optionName || `${tableName}_chck`;
      constraints.push(`CONSTRAINT "${name}" CHECK (${check})`);
    }
  }
  if (unique) {
    const uniqueArray = _.isArray(unique) ? unique : [unique];
    const isArrayOfArrays = uniqueArray.some(uniqueSet => _.isArray(uniqueSet));
    (isArrayOfArrays ? uniqueArray : [uniqueArray]).forEach(uniqueSet => {
      const cols = _.isArray(uniqueSet) ? uniqueSet : [uniqueSet];
      const name = optionName || `${tableName}_uniq_${cols.join("_")}`;
      constraints.push(
        `CONSTRAINT "${name}" UNIQUE (${quote(cols).join(", ")})`
      );
    });
  }
  if (primaryKey) {
    const name = optionName || `${tableName}_pkey`;
    const key = quote(_.isArray(primaryKey) ? primaryKey : [primaryKey]).join(
      ", "
    );
    constraints.push(`CONSTRAINT "${name}" PRIMARY KEY (${key})`);
  }
  if (foreignKeys) {
    (_.isArray(foreignKeys) ? foreignKeys : [foreignKeys]).forEach(fk => {
      const {
        columns,
        referencesConstraintName,
        referencesConstraintComment
      } = fk;
      const cols = _.isArray(columns) ? columns : [columns];
      const name =
        referencesConstraintName ||
        optionName ||
        `${tableName}_fk_${cols.join("_")}`;
      const key = quote(cols).join(", ");
      constraints.push(
        `CONSTRAINT "${name}" FOREIGN KEY (${key}) ${parseReferences(fk)}`
      );
      if (referencesConstraintComment) {
        comments.push(
          comment(
            `CONSTRAINT "${name}" ON`,
            tableName,
            referencesConstraintComment
          )
        );
      }
    });
  }
  if (exclude) {
    const name = optionName || `${tableName}_excl`;
    constraints.push(`CONSTRAINT "${name}" EXCLUDE ${exclude}`);
  }

  if (deferrable) {
    constraints = constraints.map(
      constraint => `${constraint} ${parseDeferrable(options)}`
    );
  }
  if (optionComment) {
    if (!optionName)
      throw new Error("cannot comment on unspecified constraints");
    comments.push(
      comment(`CONSTRAINT "${optionName}" ON`, tableName, optionComment)
    );
  }
  return {
    constraints,
    comments
  };
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
      constraints: crossColumnConstraints,
      comments: columnComments = []
    } = parseColumns(tableName, columns, typeShorthands);
    const dupes = _.intersection(
      Object.keys(optionsConstraints),
      Object.keys(crossColumnConstraints)
    );
    if (dupes.length > 0) {
      const dupesStr = dupes.join(", ");
      throw new Error(
        `There is duplicate constraint definition in table and columns options: ${dupesStr}`
      );
    }

    const constraints = { ...optionsConstraints, ...crossColumnConstraints };
    const {
      constraints: constraintLines,
      comments: constraintComments
    } = parseConstraints(tableName, constraints, "");
    const tableDefinition = [...columnLines, ...constraintLines].concat(
      like ? [parseLike(like)] : []
    );

    const temporaryStr = temporary ? " TEMPORARY" : "";
    const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
    const inheritsStr = inherits ? template` INHERITS ("${inherits}")` : "";

    const createTableQuery = template`CREATE TABLE${temporaryStr}${ifNotExistsStr} "${tableName}" (
${formatLines(tableDefinition)}
)${inheritsStr};`;
    const comments = [...columnComments, ...constraintComments];
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
  const { constraints, comments } =
    typeof expression === "string"
      ? { constraints: [expression], comments: [] }
      : parseConstraints(tableName, expression, constraintName);
  const constraintStr = formatLines(constraints, "  ADD ");
  return [
    template`ALTER TABLE "${tableName}"\n${constraintStr};`,
    ...comments
  ].join("\n");
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
